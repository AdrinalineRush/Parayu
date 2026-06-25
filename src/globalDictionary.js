// Developer-controlled GLOBAL dictionary: Malayalam slang/word -> corrected
// English, curated by the developer and shipped to every user. Distinct from the
// per-user `dictionary` in store.js (which users edit in the Dictionary tab).
//
// Resolution order, most-specific first:
//   1. remote cache in userData (written by Step 2's refreshGlobalDictionary)
//   2. bundled baseline in assets/ (always present, works offline / first run)
// so a downloaded update transparently supersedes the shipped baseline, and the
// app still functions with no network and on first launch.
//
// Entry shape: { from, to, phrase?, stage? }
//   phrase:true  -> substring match (multi-word slang); false/absent -> whole-word
//   stage:"post" -> applied to Whisper's (English) output  [wired now]
//   stage:"pre"  -> Malayalam-script normalization before translate  [Step 5]

const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');
const { wholeWordRegex } = require('./store');

// Where the app pulls dictionary updates from — the Supabase Edge Function that
// serves the developer-curated dictionary as { version, updated, entries[] }.
// (See SUPABASE_INTEGRATION.md.) The endpoint is public read (Verify JWT off),
// so a plain GET works. Empty string would disable remote sync (baseline only).
const REMOTE_URL = 'https://mjwgwqtioxlpnmbpduxx.supabase.co/functions/v1/global-dictionary';

// Abort a stuck fetch instead of hanging the launch flow (mirrors whisper.js).
const FETCH_IDLE_TIMEOUT_MS = 15000;

let cache = null; // in-memory { version, entries } once loaded

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds a forgiving whole-word matcher for a Manglish (romanized Malayalam)
// entry. Tolerates: case, surrounding punctuation, length variation (doubled vs
// single letters — e.g. "oo"/"o", "nn"/"n"), and comma-separated spellings in
// one `from` (e.g. "sugamano, sukhamano"). Returns null if nothing usable.
function manglishRegex(from) {
  const variants = String(from).split(',').map((raw) => {
    // Strip leading/trailing punctuation/space so "sugamano?" -> "sugamano".
    const core = raw.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!core) return null;
    // Collapse each run of the same character to "<char>+" so length differences
    // (doubled vowels/consonants, repeated whitespace) still match.
    let pat = '';
    for (let i = 0; i < core.length; ) {
      const ch = core[i];
      let j = i + 1;
      while (j < core.length && core[j].toLowerCase() === ch.toLowerCase()) j++;
      pat += escapeRegExp(ch) + '+';
      i = j;
    }
    return pat;
  }).filter(Boolean);

  if (!variants.length) return null;
  const body = variants.map((v) => `(?:${v})`).join('|');
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'giu');
  } catch (_e) {
    return new RegExp(`\\b(?:${body})\\b`, 'gi');
  }
}

// Remote-updated copy lives in userData so it survives app updates.
function cachePath() {
  return path.join(app.getPath('userData'), 'global-dictionary.json');
}

// Baseline shipped in the app. electron-builder copies assets/ to the app's
// Resources via `extraResources`; in dev it sits at <repoRoot>/assets.
function bundledPath() {
  try {
    const packaged = path.join(process.resourcesPath || '', 'assets', 'global-dictionary.json');
    if (fs.existsSync(packaged)) return packaged;
  } catch (_) { /* fall through to dev path */ }
  return path.join(__dirname, '..', 'assets', 'global-dictionary.json');
}

function readJson(p) {
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data && Array.isArray(data.entries)) return data;
  } catch (_) { /* missing or malformed — caller falls back */ }
  return null;
}

// Loads (and memoizes) the active dictionary: remote cache wins over baseline.
function loadGlobalDictionary() {
  cache = readJson(cachePath()) || readJson(bundledPath()) || { version: 0, entries: [] };
  return cache;
}

function getGlobalDictionary() {
  return cache || loadGlobalDictionary();
}

// Admin-only (dev build): persist an edited dictionary to the userData cache so
// the change takes effect locally on the next dictation. Normalizes the shape
// and stamps the date; the caller controls `version`.
function saveGlobalDictionary(data) {
  const out = {
    version: Number(data && data.version) || 1,
    updated: new Date().toISOString().slice(0, 10),
    entries: Array.isArray(data && data.entries) ? data.entries : []
  };
  fs.writeFileSync(cachePath(), JSON.stringify(out, null, 2), 'utf8');
  invalidate(); // next access re-reads the freshly written cache
  return out;
}

// Drops the memoized copy so the next access re-reads from disk (used after a
// remote refresh or an admin edit writes a new file).
function invalidate() {
  cache = null;
}

// Fetches a URL and resolves with the parsed JSON, following redirects (GitHub
// raw / jsDelivr / most CDNs issue them). Rejects on any non-2xx, network error,
// timeout, or malformed body so callers can treat all failures uniformly.
function fetchJson(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Parayu' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
        return resolve(fetchJson(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Dictionary fetch failed (HTTP ${res.statusCode})`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data || !Array.isArray(data.entries)) throw new Error('Bad shape');
          resolve(data);
        } catch (e) { reject(e); }
      });
    });
    req.setTimeout(FETCH_IDLE_TIMEOUT_MS, () => req.destroy(new Error('Dictionary fetch timed out')));
    req.on('error', reject);
  });
}

// Best-effort background sync: pulls the remote dictionary and overwrites the
// userData cache only when it's strictly newer (higher `version`) than whatever
// we'd otherwise use. Safe to call fire-and-forget on launch — any failure
// (offline, bad endpoint, malformed JSON) is swallowed and the app keeps using
// the cached/bundled copy. Returns true if the cache was updated.
async function refreshGlobalDictionary() {
  if (!REMOTE_URL) return false;
  try {
    const remote = await fetchJson(REMOTE_URL);
    const current = getGlobalDictionary();
    const remoteVer = Number(remote.version) || 0;
    const currentVer = Number(current.version) || 0;
    if (remoteVer <= currentVer) return false;
    fs.writeFileSync(cachePath(), JSON.stringify(remote, null, 2), 'utf8');
    invalidate(); // next access re-reads the fresh cache
    return true;
  } catch (_) {
    return false; // keep the existing dictionary; never break launch
  }
}

// Longest `from` first so multi-word phrases and longer terms win over the
// shorter fragments they contain.
function sortedEntries(entries) {
  return [...entries].sort((a, b) => (b.from || '').length - (a.from || '').length);
}

// Applies the global dictionary for a given stage, returning the new text and
// how many replacements were made (folded into the Insights "Fixes made" count).
function applyGlobalDictionary(text, stage = 'post') {
  const { entries } = getGlobalDictionary();
  let out = text;
  let count = 0;
  for (const e of sortedEntries(entries)) {
    if (!e || !e.from) continue;
    if ((e.stage || 'post') !== stage) continue;
    let re;
    if (e.manglish) re = manglishRegex(e.from);
    else if (e.phrase) re = new RegExp(escapeRegExp(e.from), 'gi');
    else re = wholeWordRegex(e.from);
    if (!re) continue;
    out = out.replace(re, () => { count++; return e.to || ''; });
  }
  return { text: out, count };
}

module.exports = { applyGlobalDictionary, getGlobalDictionary, loadGlobalDictionary, refreshGlobalDictionary, saveGlobalDictionary, invalidate };
