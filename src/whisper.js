const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');
const { app } = require('electron');
const { store } = require('./store');

// Selectable "brains" — Whisper models published by the whisper.cpp project.
// Each runs fully offline once its file is on disk. `bytes` is the approximate
// download size; we use 85% of it as a sanity floor so a truncated download is
// detected and re-fetched. `id` is what gets persisted in the store.
const HF_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
const MODELS = [
  { id: 'tiny', label: 'Tiny', file: 'ggml-tiny.bin', bytes: 78 * 1024 * 1024,
    desc: 'Lightning fast, smallest download. Best for older or slower computers. Supports 99+ languages and translation.' },
  { id: 'base', label: 'Base', file: 'ggml-base.bin', bytes: 148 * 1024 * 1024,
    desc: 'Fast with solid everyday accuracy. A good pick for casual dictation. Supports 99+ languages and translation.' },
  { id: 'small-q5_1', label: 'Small', file: 'ggml-small-q5_1.bin', bytes: 190 * 1024 * 1024,
    desc: 'The sweet spot for most people: near top-tier accuracy and still quick. Recommended for translation.' },
  { id: 'medium-q5_0', label: 'Medium', file: 'ggml-medium-q5_0.bin', bytes: 539 * 1024 * 1024,
    desc: 'Highest accuracy. Best for accents, names, and complex speech. Slower and a bigger download.' }
];
const DEFAULT_MODEL_ID = 'small-q5_1';

function modelById(id) {
  return MODELS.find((m) => m.id === id) || MODELS.find((m) => m.id === DEFAULT_MODEL_ID);
}

function selectedModelId() {
  return modelById(store.get('selectedModel')).id;
}

let whisperPromise = null;
let loadedModelId = null; // which model the cached whisperPromise was built for
// CPU (whisper.cpp + Accelerate + threads) is actually faster than Metal for the
// short clips typical of dictation — Metal's per-run overhead only pays off on
// long audio — and it avoids shipping/locating the Metal shader lib in the
// packaged app. So default to CPU; GPU stays available behind this flag.
let useGpu = false;
let progressCb = () => {};

// main.js registers a callback here to surface download/load progress on the
// overlay, so the first run doesn't look frozen while the model downloads.
function setProgressCallback(cb) { progressCb = cb || (() => {}); }

function modelPath(model) {
  return path.join(app.getPath('userData'), 'models', model.file);
}

// True once the model file is fully present on disk (so it can run offline).
function isDownloaded(model) {
  const dest = modelPath(model);
  return fs.existsSync(dest) && fs.statSync(dest).size > model.bytes * 0.85;
}

// Aborts a download if no data arrives for this long, so a dead/stalled
// connection surfaces as a retryable error instead of an infinite spinner.
const DOWNLOAD_IDLE_TIMEOUT_MS = 30000;

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.part';
    let file = null;
    const req = https.get(url, { headers: { 'User-Agent': 'Parayu' } }, (res) => {
      // Follow HuggingFace's CDN redirects.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, dest, onProgress));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Model download failed (HTTP ${res.statusCode})`));
      }
      
      try {
        file = fs.createWriteStream(tmp);
        file.on('error', (err) => {
          if (file) {
            file.close(() => {
              fs.unlink(tmp, () => {});
            });
          }
          reject(err);
        });
      } catch (err) {
        return reject(err);
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      res.on('data', (chunk) => {
        received += chunk.length;
        if (total && onProgress) onProgress(received / total);
      });
      res.pipe(file);
      file.on('finish', () => {
        if (file) {
          file.close(() => {
            fs.rename(tmp, dest, (err) => (err ? reject(err) : resolve(dest)));
          });
        }
      });
    });
    req.setTimeout(DOWNLOAD_IDLE_TIMEOUT_MS, () => {
      req.destroy(new Error('Model download timed out — check your connection and try again.'));
    });
    req.on('error', (err) => {
      if (file) {
        file.close(() => {
          fs.unlink(tmp, () => {});
        });
      }
      reject(err);
    });
  });
}

// Downloads a model on demand, reporting 0..1 progress. Used both by the
// Brain Switch UI (explicit download) and lazily before the first transcription.
function downloadModel(id, onProgress) {
  const model = modelById(id);
  const dest = modelPath(model);
  if (isDownloaded(model)) return Promise.resolve(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  return downloadFile(HF_BASE + model.file, dest, onProgress);
}

function ensureModel() {
  const model = modelById(selectedModelId());
  if (isDownloaded(model)) return Promise.resolve(modelPath(model));
  // Surface the download on the overlay so the first run doesn't look frozen.
  return downloadModel(model.id, (pct) => progressCb({ phase: 'download', pct }));
}

async function loadWhisper() {
  const { Whisper } = require('smart-whisper');
  const id = selectedModelId();
  const model = await ensureModel();
  progressCb({ phase: 'loading' });
  const open = async (gpu) => {
    const w = new Whisper(model, { gpu });
    await w.load(); // force load now so a Metal init failure surfaces here
    return w;
  };
  try {
    const w = await open(useGpu);
    loadedModelId = id;
    return w;
  } catch (e) {
    // Metal unavailable (e.g. shader lib not found when packaged) — fall back to
    // CPU. whisper.cpp on CPU still uses Accelerate + threads, so it stays fast.
    if (useGpu) { useGpu = false; const w = await open(false); loadedModelId = id; return w; }
    throw e;
  }
}

function getWhisper() {
  // If the user switched brains since the model was loaded, drop the cached
  // instance so the next transcription loads the newly selected model.
  if (whisperPromise && loadedModelId && loadedModelId !== selectedModelId()) {
    whisperPromise = null;
  }
  if (!whisperPromise) {
    whisperPromise = loadWhisper().catch((e) => { whisperPromise = null; throw e; });
  }
  return whisperPromise;
}

// Catalog for the Brain Switch UI: each model plus whether it's on disk and
// which one is currently active.
function listModels() {
  const active = selectedModelId();
  return MODELS.map((m) => ({
    id: m.id, label: m.label, desc: m.desc, bytes: m.bytes,
    downloaded: isDownloaded(m), active: m.id === active
  }));
}

// Persists the active model. The actual reload happens lazily in getWhisper().
function setSelectedModel(id) {
  const model = modelById(id);
  store.set('selectedModel', model.id);
  return model.id;
}

// whisper.cpp is fastest when threads match the number of *performance* cores —
// spilling work onto Apple Silicon efficiency cores adds contention and can make
// it slower. We query the perf-core count once (hw.perflevel0 = P-cores) and
// cache it; on Intel/non-mac the sysctl is absent, so we fall back to the old
// "logical cores - 1, clamped" heuristic.
let cachedThreads = null;
function bestThreadCount() {
  if (cachedThreads) return cachedThreads;
  let n = 0;
  if (process.platform === 'darwin') {
    try {
      n = parseInt(execSync('sysctl -n hw.perflevel0.physicalcpu', { encoding: 'utf8' }).trim(), 10);
    } catch (_) { /* not Apple Silicon — fall through to heuristic */ }
  }
  if (!Number.isInteger(n) || n < 1) {
    n = Math.max(4, Math.min(8, os.cpus().length - 1));
  }
  cachedThreads = n;
  return n;
}

// Loads the model into memory ahead of the first dictation so it's instant.
// Only warms if the model is already on disk — never triggers a download at
// launch. Safe to call fire-and-forget; failures are swallowed (the real
// transcription path will surface any genuine error later).
function warmUp() {
  try {
    if (isDownloaded(modelById(selectedModelId()))) getWhisper().catch(() => {});
  } catch (_) { /* best-effort */ }
}

// Parses a 16-bit PCM mono WAV ArrayBuffer into a Float32Array in [-1, 1].
function wavBufferToFloat32(arrayBuffer) {
  const buf = Buffer.from(arrayBuffer);
  const dataChunkOffset = 44; // standard WAV header is 44 bytes; data follows
  const samples = (buf.length - dataChunkOffset) / 2;
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = buf.readInt16LE(dataChunkOffset + i * 2) / 32768;
  }
  return out;
}

// Whisper emits bracketed placeholder tokens for non-speech audio, e.g.
// [BLANK_AUDIO], (silence), [ Music ]. Strip them so silent or noise-only
// recordings produce no text at all.
function stripNonSpeechTokens(text) {
  return text
    .replace(/[\[(][^\])]*[\])]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Stock phrases Whisper hallucinates from silent / very short / noisy clips —
// subtitle and YouTube-outro boilerplate baked in during training. When there's
// no real speech the model reaches for one of these. We drop the result only
// when it is *entirely* one of these phrases, so legitimate speech that merely
// contains the words (e.g. someone actually saying "thank you") is preserved.
const HALLUCINATION_PHRASES = new Set([
  'thank you',
  'thank you very much',
  'thank you for watching',
  'thanks for watching',
  'thank you for watching this video',
  "thanks for watching, and i'll see you in the next video",
  'please subscribe',
  'subscribe to my channel',
  'like and subscribe',
  'see you next time',
  'see you in the next video',
  'hello',
  'bye',
  'bye bye',
  'you',
]);

function isHallucination(text) {
  const norm = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return HALLUCINATION_PHRASES.has(norm);
}

async function transcribe(wavArrayBuffer) {
  const audio = wavBufferToFloat32(wavArrayBuffer);
  
  if (store.get('boostQuietVoices')) {
    let maxVal = 0;
    for (let i = 0; i < audio.length; i++) {
      const absVal = Math.abs(audio[i]);
      if (absVal > maxVal) maxVal = absVal;
    }
    if (maxVal > 0.01 && maxVal < 0.8) {
      const gain = 0.8 / maxVal;
      for (let i = 0; i < audio.length; i++) {
        audio[i] *= gain;
      }
      console.log(`[Audio Boost] Normalized quiet audio with peak ${maxVal.toFixed(4)} using gain factor ${gain.toFixed(2)}`);
    }
  }

  const inputLanguage = store.get('inputLanguage') || 'en';

  // An instant tap can produce a header-only (or near-empty) WAV. Skip it
  // rather than handing Whisper a zero-length buffer that can error or
  // hallucinate text from nothing. Malayalam gets a higher floor: its decoding
  // profile below is more expensive and sub-0.4s clips there are pure noise.
  const minSamples = inputLanguage === 'ml' ? 6400 : 1600; // ~0.4s vs ~0.1s @16kHz
  if (audio.length < minSamples) return '';

  const n_threads = bestThreadCount();
  // no_context: don't carry decoder state between segments — faster, with
  // negligible quality loss for short dictation clips.
  const params = { language: inputLanguage, n_threads, no_context: true, suppress_non_speech_tokens: true };

  // Malayalam-tuned decoding profile (English stays on the fast greedy path so
  // dictation remains instant). The small model is weakest in Malayalam, so we
  // spend a little more compute to claw back accuracy and — just as important —
  // make the output deterministic, which is what lets the downstream global
  // dictionary patches land on stable text run after run.
  if (inputLanguage === 'ml') {
    Object.assign(params, {
      // Beam search explores several candidate decodings and keeps the best
      // instead of greedily committing token-by-token: meaningfully better
      // translation/transcription, at the cost of some speed.
      beam_size: 5,
      best_of: 5,
      // temperature 0 with no fallback increment = fully deterministic decoding:
      // the same audio yields the same text every run.
      temperature: 0,
      temperature_inc: 0,
      // Tighten the "is this actually speech?" gates so silent/noisy clips that
      // would otherwise surface as "Thank you for watching"-style hallucinations
      // get dropped instead.
      no_speech_thold: 0.6,
      logprob_thold: -0.7,
      entropy_thold: 2.2,
    });
  }

  // Gate Malayalam translation by Pro/Enterprise subscription plan. Whisper does
  // the baseline Malayalam->English translation (covering everything); the
  // developer-curated global dictionary then PATCHES specific phrases/slang/names
  // Whisper gets wrong. The dictionary augments translation — it never replaces
  // it — so untrained speech still comes out as English.
  const profile = store.get('userProfile') || { registered: false, plan: 'Base Plan' };
  const isProOrEnterprise = profile.registered && (profile.plan === 'Pro Plan' || profile.plan === 'Enterprise Plan');
  if (inputLanguage === 'ml' && isProOrEnterprise) {
    params.translate = true;
  }

  let whisper = await getWhisper();
  let task;
  try {
    progressCb({ phase: 'transcribe' });
    task = await whisper.transcribe(audio, params);
  } catch (e) {
    // A GPU runtime failure can show up here on the first real inference —
    // rebuild on CPU once and retry before giving up.
    if (useGpu) {
      useGpu = false;
      whisperPromise = null;
      whisper = await getWhisper();
      task = await whisper.transcribe(audio, params);
    } else {
      throw e;
    }
  }
  const segments = await task.result;
  const text = segments.map((s) => s.text).join('').trim();
  const cleaned = stripNonSpeechTokens(text);
  // Final guard: if the whole result is a known stock hallucination, emit
  // nothing rather than pasting "Thank you for watching" into the user's doc.
  if (isHallucination(cleaned)) return '';
  return cleaned;
}

// True when the active model is on disk and can transcribe offline right now.
function isActiveModelReady() {
  return isDownloaded(modelById(selectedModelId()));
}

module.exports = { transcribe, warmUp, setProgressCallback, listModels, downloadModel, setSelectedModel, isActiveModelReady };
