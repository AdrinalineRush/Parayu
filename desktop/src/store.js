const Store = require('electron-store');

const store = new Store({
  defaults: {
    history: [],       // { id, text, rawText, timestamp, words }
    dictionary: [],     // { from, to }
    snippets: [],        // { trigger, expansion }
    // Insights counters. speakingSeconds powers words-per-minute; corrected /
    // dictionaryFixes power the "Fixes made" card; longestStreak is tracked
    // alongside the running streak.
    stats: { totalWords: 0, lastActiveDate: null, streak: 0, longestStreak: 0,
      speakingSeconds: 0, wordsCorrected: 0, dictionaryFixes: 0 },
    appUsage: {},        // { [appName]: { words, count } } — where dictations landed
    hotkey: process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space',
    micDeviceId: null,
    aiCleanup: true,
    dictationMode: 'toggle',
    selectedModel: 'tiny',
    inputLanguage: 'en',
    translateMalayalam: true,
    aiFormatterEnabled: true,
    cleanupMode: 'smart',
    alwaysFormat: false,
    formatterProvider: 'private_offline',
    formatterOutputMode: 'transcribe',
    formatterTone: 'natural',
    formatterTimeoutMs: 2500,
    formatterModel: 'fast_3b',
    skipLlmForShortDictations: true,
    formatterMinWords: 12,
    localOnlyMode: true,
    preserveClipboard: true,
    restoreClipboardDelay: 600,
    enablePersonalDictionary: true,
    enableGlobalDictionary: true,
    enableTextSnippets: true,
    offlineAIStatus: null,
    boostQuietVoices: true,
    noiseSuppression: true,
    onboarded: false,
    userProfile: {
      registered: false,
      name: '',
      email: '',
      plan: 'Base Plan'
    }
  }
});

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds a case-insensitive, whole-word matcher that works for any script. The
// ASCII-only \b breaks for Malayalam (the app's headline language), so we use
// unicode letter/number lookarounds instead, falling back to \b if the engine
// lacks unicode property escapes.
function wholeWordRegex(term) {
  const t = escapeRegExp(term);
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])${t}(?![\\p{L}\\p{N}])`, 'giu');
  } catch (_e) {
    return new RegExp(`\\b${t}\\b`, 'gi');
  }
}

// Applies user dictionary replacements, returning the new text and how many
// replacements were actually made (for the Insights "Fixes made" counter).
function applyDictionary(text) {
  const dict = store.get('dictionary');
  let out = text;
  let count = 0;
  for (const { from, to } of dict) {
    if (!from) continue;
    out = out.replace(wholeWordRegex(from), () => { count++; return to; });
  }
  return { text: out, count };
}

// Expands snippet triggers, returning the new text and the number of expansions.
function applySnippets(text) {
  const snippets = store.get('snippets');
  let out = text;
  let count = 0;
  for (const { trigger, expansion } of snippets) {
    if (!trigger) continue;
    out = out.replace(wholeWordRegex(trigger), () => { count++; return expansion; });
  }
  return { text: out, count };
}

function recordTranscription(rawText, finalText, meta = {}) {
  const history = store.get('history');
  const words = finalText.trim().split(/\s+/).filter(Boolean).length;
  history.unshift({
    id: Date.now().toString(36),
    text: finalText,
    rawText,
    timestamp: Date.now(),
    words,
    durationSec: meta.durationSec || 0
  });
  store.set('history', history.slice(0, 1000));

  // Merge new fields onto the stored stats, tolerating older saves that lack them.
  const stats = Object.assign(
    { totalWords: 0, lastActiveDate: null, streak: 0, longestStreak: 0,
      speakingSeconds: 0, wordsCorrected: 0, dictionaryFixes: 0 },
    store.get('stats')
  );
  const today = new Date().toDateString();
  if (stats.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    stats.streak = stats.lastActiveDate === yesterday ? stats.streak + 1 : 1;
    stats.lastActiveDate = today;
  }
  stats.totalWords += words;
  stats.longestStreak = Math.max(stats.longestStreak || 0, stats.streak);
  stats.speakingSeconds += Math.max(0, meta.durationSec || 0);
  stats.wordsCorrected += Math.max(0, meta.wordsCorrected || 0);
  stats.dictionaryFixes += Math.max(0, meta.dictionaryFixes || 0);
  store.set('stats', stats);

  // Tally which app the dictation was pasted into (macOS gives us the name).
  if (meta.appName) {
    const usage = store.get('appUsage') || {};
    const entry = usage[meta.appName] || { words: 0, count: 0 };
    entry.words += words;
    entry.count += 1;
    usage[meta.appName] = entry;
    store.set('appUsage', usage);
  }

  return { words, stats };
}

const { safeStorage } = require('electron');

function saveSecureToken(key, value) {
  if (!value) {
    store.delete(key);
    return;
  }
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      const encrypted = safeStorage.encryptString(value);
      store.set(key, encrypted.toString('base64'));
    } catch (e) {
      console.error(`Failed to encrypt token for key ${key}:`, e);
      store.set(key, value); // fallback to plaintext if encryption fails
    }
  } else {
    store.set(key, value);
  }
}

function getSecureToken(key) {
  const data = store.get(key);
  if (!data) return null;
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      const buf = Buffer.from(data, 'base64');
      return safeStorage.decryptString(buf);
    } catch (e) {
      console.warn(`Failed to decrypt token for key ${key}, returning raw value:`, e);
      return data;
    }
  }
  return data;
}

module.exports = { store, wholeWordRegex, applyDictionary, applySnippets, recordTranscription, saveSecureToken, getSecureToken };
