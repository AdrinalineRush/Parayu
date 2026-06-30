const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen, systemPreferences, shell, dialog } = require('electron');

// Never let a broken stdout/stderr pipe crash the app. When launched from a
// terminal whose output pipe stalls or closes, a console.log/error can throw
// EPIPE/EIO; without a listener Node turns that into a fatal uncaughtException.
// Swallow those specific stream errors so logging can never take the app down.
process.stdout.on('error', (err) => { if (err && (err.code === 'EPIPE' || err.code === 'EIO')) return; });
process.stderr.on('error', (err) => { if (err && (err.code === 'EPIPE' || err.code === 'EIO')) return; });

// Prepend Homebrew and common macOS bin paths to process.env.PATH so packaged GUI app can find system tools like ffmpeg
if (process.platform === 'darwin') {
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
  const currentPath = process.env.PATH || '';
  process.env.PATH = extraPaths.concat(currentPath.split(':')).filter(Boolean).join(':');
}

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { GOOGLE_CLIENT_ID } = require('./authConfig');
const { store, applyDictionary, applySnippets, recordTranscription, saveSecureToken, getSecureToken } = require('./store');
const globalDict = require('./globalDictionary');
const { applyGlobalDictionary, refreshGlobalDictionary } = globalDict;

// Dev/public build flavor: the admin module is bundled only by the dev build
// (electron-builder.dev.js). The public build physically excludes src/admin/**,
// so this require fails there and the admin panel stays completely off. The
// module's presence *is* the flavor — no runtime env var needed in the package.
let adminMain = null;
try { adminMain = require('./admin/adminMain'); } catch (_) { adminMain = null; }
const IS_DEV_BUILD = !!adminMain;
const DEV_DEMO_EMAIL = 'demo@parayu.dev';
const DEV_DEMO_PASSWORD = 'ParayuDev!2026';
const DEV_DEMO_PRIVATE_KEY = 'devDemoLicensePrivateKey';
const DEV_DEMO_PUBLIC_KEY = 'devDemoLicensePublicKey';

function ensureDevDemoLicenseKeys() {
  if (!IS_DEV_BUILD) return null;
  const existingPrivateKey = getSecureToken(DEV_DEMO_PRIVATE_KEY);
  const existingPublicKey = store.get(DEV_DEMO_PUBLIC_KEY);
  if (existingPrivateKey && existingPublicKey) {
    return { privateKey: existingPrivateKey, publicKey: existingPublicKey };
  }

  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  saveSecureToken(DEV_DEMO_PRIVATE_KEY, pair.privateKey);
  store.set(DEV_DEMO_PUBLIC_KEY, pair.publicKey);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}

const devDemoLicenseKeys = ensureDevDemoLicenseKeys();
const { transcribe, warmUp, setProgressCallback, setFeatureChecker, listModels, downloadModel, setSelectedModel, isActiveModelReady } = require('./whisper');
const { cleanup } = require('./cleanup');
const { pasteText, captureFocusedTarget } = require('./paste');
const { LLMTextFormatter, createFormatterProvider, NoCloudOfflineFormatterProvider } = require('./llmTextFormatter');
const { FormatterDecisionEngine } = require('./formatterDecisionEngine');
const { STATUS: OFFLINE_AI_STATUS, ModelDownloadManager, FormatterAvailabilityService } = require('./offlineAI');
const { registerPushToTalk, unregister: unregisterHook, stopHook } = require('./hotkey-hook');
const translateMain = require('./translate');
const { LicenseManager } = require('./license/licenseManager');
const { FeatureFlag } = require('./license/featureFlag');
const {
  PLAN_ENTERPRISE,
  SUBSCRIPTION_ACTIVE,
  defaultAllowedFeatures,
  defaultAllowedModels
} = require('./license/subscriptionState');

// Migrate or reset legacy/hardcoded user profiles on startup to guarantee starting in Guest mode.
const initialProfile = store.get('userProfile');
if (!initialProfile || !initialProfile.hasOwnProperty('registered') || initialProfile.email === 'arjun@example.com') {
  store.set('userProfile', {
    registered: false,
    name: '',
    email: '',
    plan: 'Base Plan'
  });
}


// uiohook can emit an async rejection when macOS Accessibility/Input-Monitoring
// isn't granted yet. Swallow it so push-to-talk degrades gracefully to toggle
// instead of surfacing an unhandled-rejection warning.
process.on('unhandledRejection', (reason) => {
  const msg = reason && reason.message ? reason.message : String(reason);
  if (/assistive devices|uiohook|accessibility/i.test(msg)) return;
  console.error('Unhandled rejection:', reason);
});

let mainWindow;
let overlayWindow;
let tray;
let isRecording = false;
let pasteTargetPromise = null; // resolves to the focused-app target captured at record start
let maxDurationTimeout = null;
const MAX_RECORDING_MS = 180000; // 3 minutes safety timeout
const licenseManager = new LicenseManager({
  store,
  saveSecureToken,
  getSecureToken,
  publicKey: devDemoLicenseKeys ? devDemoLicenseKeys.publicKey : process.env.PARAYU_LICENSE_PUBLIC_KEY
});
licenseManager.initialize();
const featureFlag = new FeatureFlag(() => licenseManager.getState());
setFeatureChecker((feature) => featureFlag.isEnabled(feature));

function hasFeature(feature) {
  return featureFlag.isEnabled(feature);
}

function subscriptionState() {
  return licenseManager.getState();
}

function allowedModelsList() {
  const models = listModels();
  return models.map((model) => ({
    ...model,
    locked: !featureFlag.canUseModel(model.id)
  }));
}

function ensureAllowedSelectedModel() {
  const current = store.get('selectedModel');
  if (!current || current === 'tiny' || current === 'small-q5_1') {
    const { isDownloaded, modelById } = require('./whisper');
    // If the PRO model is bundled/downloaded, default to it
    const proModel = modelById('large-v3');
    if (proModel && isDownloaded(proModel)) {
      setSelectedModel('large-v3');
      return 'large-v3';
    }
    // Otherwise, if the HIGH model is bundled/downloaded, default to it
    const highModel = modelById('large-v3-q5_0');
    if (highModel && isDownloaded(highModel)) {
      setSelectedModel('large-v3-q5_0');
      return 'large-v3-q5_0';
    }
  }

  const active = store.get('selectedModel') || 'small-q5_1';
  if (featureFlag.canUseModel(active)) return active;
  setSelectedModel('small-q5_1');
  return 'small-q5_1';
}

function ensureModelForInputLanguage() {
  return ensureAllowedSelectedModel();
}

function friendlyFeatureError(feature) {
  const names = {
    local_llm_formatter: 'AI formatter is a Pro feature.',
    malayalam_to_english_premium: 'Malayalam to clean English is a Pro feature.',
    personal_dictionary: 'Personal Dictionary is a Pro feature.',
    text_snippets: 'Text Snippets are a Pro feature.',
    app_aware_formatting: 'App-aware formatting is a Pro feature.',
    developer_prompt_mode: 'Developer Prompt mode is a Pro feature.',
    email_mode: 'Email mode is a Pro feature.',
    advanced_clipboard_restore: 'Advanced clipboard restore is a Pro feature.'
  };
  return `${names[feature] || 'This is a Pro feature.'} Refresh or upgrade your subscription to use it.`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 740,
    minWidth: 1100,
    minHeight: 680,
    title: 'Parayu',
    // Remove the grey title bar; keep the native traffic-light buttons and let
    // our own UI fill the full window height.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 18, y: 22 },
    backgroundColor: '#faf9f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setSize(1180, 740);
  mainWindow.center();

  // Keep the renderer (and its mic-capture JS) alive between sessions instead
  // of destroying it — dictation must keep working even with the window closed.
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Stop mic test in renderer when the main window is hidden
  mainWindow.on('hide', () => {
    sendToWindow(mainWindow, 'stop-mic-test');
  });

  // Returning to the app is the moment a user typically grants the OS the
  // Input-Monitoring/Accessibility permission push-to-talk needs, so retry the
  // global hook on focus — registration is cheap and idempotent.
  mainWindow.on('focus', () => {
    if (store.get('dictationMode') === 'pushToTalk') registerHotkey(store.get('hotkey'));
  });
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const overlayWidth = 260;
  const overlayHeight = 80;
  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: Math.round((width - overlayWidth) / 2),
    y: height - 130,
    frame: false,
    transparent: true,
    type: 'panel',
    hasShadow: false, // Prevents compositor shadow rendering glitches in fullscreen spaces
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.js') }
  });
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
}

function ensureOverlayWindow() {
  if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow();
}

function showMainWindow() {
  if (!app.isReady()) return;
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (process.platform === 'darwin' && app.dock) app.dock.show();
}

function createTray() {
  // tray-icon.png is an 18pt logo (white-on-transparent) with a 36px @2x sibling;
  // createFromPath picks up both reps automatically. We intentionally do NOT
  // mark it as a template image: template mode tints icons to the system's
  // muted menu-bar glyph colour, whereas leaving it off renders the logo's
  // actual full-bright-white pixels (brighter, as requested).
  const icon = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'tray-icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('Parayu');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Parayu', click: showMainWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  // Clicking the tray icon itself also reopens the window.
  tray.on('click', showMainWindow);
}

function sendToWindow(win, channel, payload) {
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, payload);
    return true;
  }
  return false;
}

// Dataset Studio (dev-only admin page) push-to-talk routing. When the renderer
// reports the Studio page is the focused view, the global hotkey drives the
// training-clip recorder instead of dictation — no overlay, no focus capture,
// no paste — so the main app is never interrupted. Fully inert in the public
// build, where the admin page doesn't exist and trainerCaptureMode never turns on.
let trainerCaptureMode = false;
let isTrainerRecording = false;

function startTrainerRecording() {
  if (!mainWindow || mainWindow.isDestroyed() || isTrainerRecording) return;
  isTrainerRecording = true;
  sendToWindow(mainWindow, 'trainer-toggle-recording', true);
}

function stopTrainerRecording() {
  if (!isTrainerRecording) return;
  isTrainerRecording = false;
  sendToWindow(mainWindow, 'trainer-toggle-recording', false);
}

function startRecording() {
  if (trainerCaptureMode) {
    if (mainWindow && mainWindow.isFocused()) {
      startTrainerRecording();
    }
    return;
  }
  if (!mainWindow || mainWindow.isDestroyed() || isRecording) return;
  isRecording = true;
  licenseManager.setDictationActive(true);

  // Automatically stop recording after the maximum duration limit (safety timeout)
  maxDurationTimeout = setTimeout(() => {
    if (isRecording) stopRecording();
  }, MAX_RECORDING_MS);

  // Capture whatever app is focused right now, before we send the IPC that may
  // bring our own window forward. Async so it never blocks the hotkey; the
  // result is awaited later at paste time.
  pasteTargetPromise = captureFocusedTarget();
  ensureOverlayWindow();
  sendToWindow(overlayWindow, 'overlay-state', 'listening');
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.showInactive();
  sendToWindow(mainWindow, 'toggle-recording', true);
}

function stopRecording() {
  if (isTrainerRecording) { stopTrainerRecording(); return; }
  if (trainerCaptureMode) return;
  if (!mainWindow || mainWindow.isDestroyed() || !isRecording) return;
  isRecording = false;
  licenseManager.setDictationActive(false);

  if (maxDurationTimeout) {
    clearTimeout(maxDurationTimeout);
    maxDurationTimeout = null;
  }

  sendToWindow(overlayWindow, 'overlay-state', 'transcribing');
  sendToWindow(mainWindow, 'toggle-recording', false);
}

function toggleRecording() {
  if (isRecording || isTrainerRecording) stopRecording();
  else startRecording();
}

// Switches the hotkey between toggle mode (globalShortcut, fires on press)
// and push-to-talk mode (global hook, records while held).
function registerHotkey(hotkey) {
  globalShortcut.unregisterAll();
  unregisterHook();

  const isModifierOnly = !hotkey.includes('+') && ['Alt', 'Meta', 'Ctrl', 'Shift'].includes(hotkey);

  if (store.get('dictationMode') === 'pushToTalk') {
    const ok = registerPushToTalk(hotkey, startRecording, stopRecording);
    if (ok) return true;
    // The hook couldn't attach (permission pending). A bare modifier can never
    // be a globalShortcut accelerator, so don't attempt it — that only throws a
    // noisy conversion error. Stay "pending" until permission is granted and a
    // focus/permission event re-registers us.
    if (isModifierOnly) return false;
    // For a real combo, fall through to toggle registration below.
  }

  try {
    const ok = globalShortcut.register(hotkey, toggleRecording);
    if (!ok) {
      const fallback = store.get('hotkey');
      if (fallback !== hotkey) {
        try {
          globalShortcut.register(fallback, toggleRecording);
        } catch (_) {}
      }
    }
    return ok;
  } catch (err) {
    console.error(`Failed to register global shortcut for ${hotkey}:`, err);
    return false;
  }
}

// Surface model download / load progress on the overlay so the first run
// (which downloads ~190 MB) doesn't look frozen on "Transcribing".
setProgressCallback((p) => {
  let text;
  if (p.phase === 'download') text = `Downloading model… ${Math.round((p.pct || 0) * 100)}%`;
  else if (p.phase === 'loading') text = 'Loading model…';
  else text = 'Transcribing';
  sendToWindow(overlayWindow, 'overlay-status', text);
});

const wordCount = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
const formatterDecisionEngine = new FormatterDecisionEngine();
const offlineAIModelDownloads = new ModelDownloadManager({
  baseDir: path.join(app.getPath('userData'), 'offline-ai'),
  onProgress: (progress) => {
    const status = {
      state: OFFLINE_AI_STATUS.DOWNLOADING,
      privacy: 'Your voice and text stay on this device.',
      progress
    };
    store.set('offlineAIInstallState', OFFLINE_AI_STATUS.DOWNLOADING);
    store.set('offlineAIStatus', status);
    sendToWindow(mainWindow, 'offline-ai-status', status);
  }
});
const formatterAvailability = new FormatterAvailabilityService({
  downloadManager: offlineAIModelDownloads,
  store
});

function getFormatterOutputMode() {
  const inputLang = store.get('inputLanguage') || 'en';
  if (inputLang === 'en') {
    return 'transcribe';
  }
  const mode = store.get('formatterOutputMode') || 'transcribe';
  if (mode === 'translate_to_english') return mode;
  if (inputLang === 'ml' && store.get('translateMalayalam') !== false) return 'translate_to_english';
  return 'transcribe';
}

function getFormatterProviderName() {
  const localOnly = store.get('localOnlyMode') !== false;
  const selected = store.get('formatterProvider') || 'private_offline';
  if (process.env.PARAYU_ENABLE_OLLAMA_DEV === '1' && selected === 'ollama_dev') return 'ollama_dev';
  if ((selected === 'gemini' || selected === 'openai') && process.env.PARAYU_ENABLE_CLOUD_FORMATTERS !== '1') return 'private_offline';
  if (!localOnly) return selected;
  return ['private_offline', 'mlx', 'bundled_llamacpp'].includes(selected) ? selected : 'offline';
}

function makeFormatter() {
  const providerName = getFormatterProviderName();
  const provider = createFormatterProvider(providerName, {
    apiKey: getSecureToken(`${providerName}ApiKey`) || undefined,
    formatterModel: store.get('formatterModel') || 'fast_3b',
    modelId: store.get('formatterModel') || 'fast_3b',
    downloadManager: offlineAIModelDownloads
  });
  return new LLMTextFormatter(provider, new NoCloudOfflineFormatterProvider());
}

async function isFormatterProviderAvailable(formatter, timeoutMs = 350) {
  if (!formatter || !formatter.provider) return false;
  if (typeof formatter.provider.isAvailable !== 'function') return true;
  return formatter.provider.isAvailable(timeoutMs);
}

// Reads the sample rate from a 16-bit PCM mono WAV header (bytes 24–27) so the
// duration is correct even if the OS ignored our 16 kHz AudioContext request.
function wavSampleRate(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 44) return 16000;
  const rate = new DataView(arrayBuffer).getUint32(24, true);
  return rate >= 8000 && rate <= 192000 ? rate : 16000;
}

function wavAudioStats(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength <= 44) return { rms: 0, peak: 0, durationSec: 0, sampleRate: 16000 };
  const sampleRate = wavSampleRate(arrayBuffer);
  const view = new DataView(arrayBuffer);
  let sumSquares = 0;
  let peak = 0;
  let samples = 0;
  for (let offset = 44; offset + 1 < arrayBuffer.byteLength; offset += 2) {
    const v = view.getInt16(offset, true) / 32768;
    const abs = Math.abs(v);
    peak = Math.max(peak, abs);
    sumSquares += v * v;
    samples++;
  }
  return {
    rms: samples ? Math.sqrt(sumSquares / samples) : 0,
    peak,
    sampleRate,
    durationSec: samples / sampleRate
  };
}

ipcMain.handle('transcribe-audio', async (_event, wavArrayBuffer, isScreenwriting) => {
  try {
    licenseManager.setDictationActive(true);
    ensureModelForInputLanguage();
    const audioStats = wavAudioStats(wavArrayBuffer);
    if (audioStats.durationSec > 0.5 && audioStats.rms > 0 && audioStats.rms < 0.0012) {
      sendToWindow(overlayWindow, 'overlay-state', 'error');
      return { text: '', words: 0, pasteError: 'Your voice is a little low. Move closer to the mic.' };
    }
    sendToWindow(overlayWindow, 'overlay-state', 'processing');
    const rawText = await transcribe(wavArrayBuffer, isScreenwriting ? { translate: false } : undefined);
    if (!rawText) return { text: '', words: 0 };

    // Developer-curated global corrections. 'pre' entries (Malayalam-script
    // slang/normalization) run first, then 'post' entries fix the English
    // output. Each entry only matches its own script, so running both on the
    // same text is safe whether or not Whisper translated to English. (Whisper
    // performs ml->en translation internally, so 'pre' necessarily operates on
    // the transcription output, not on the raw audio.) Both run before the
    // user's personal dictionary so a user can still override a global fix.
    sendToWindow(overlayWindow, 'overlay-state', 'cleaning');
    const globPre = store.get('enableGlobalDictionary') !== false
      ? applyGlobalDictionary(rawText, 'pre')
      : { text: rawText, count: 0 };
    const globPost = store.get('enableGlobalDictionary') !== false
      ? applyGlobalDictionary(globPre.text, 'post')
      : { text: globPre.text, count: 0 };
    const dict = store.get('enablePersonalDictionary') !== false && hasFeature('personal_dictionary')
      ? applyDictionary(globPost.text)
      : { text: globPost.text, count: 0 };
    const snip = store.get('enableTextSnippets') !== false && hasFeature('text_snippets')
      ? applySnippets(dict.text)
      : { text: dict.text, count: 0 };
    let finalText = snip.text;
    const dictionaryFixes = globPre.count + globPost.count + dict.count + snip.count;

    // "Words corrected" = words removed by AI cleanup (fillers, stutters, repeats).
    let wordsCorrected = 0;
    if (store.get('aiCleanup')) {
      const beforeClean = finalText;
      finalText = cleanup(finalText);
      wordsCorrected = Math.max(0, wordCount(beforeClean) - wordCount(finalText));
    }

    const pasteTarget = await (pasteTargetPromise || Promise.resolve(null));
    const appName = pasteTarget && pasteTarget.name ? pasteTarget.name : null;
    let formatterError = null;
    let formatterDecision = { shouldFormat: false, reason: 'disabled' };
    const formatterEnabled = store.get('aiFormatterEnabled') !== false &&
      store.get('cleanupMode') !== 'fast' &&
      hasFeature('local_llm_formatter');
    const formatter = formatterEnabled ? makeFormatter() : null;
    const providerAvailable = formatterEnabled
      ? await isFormatterProviderAvailable(formatter, Math.min(500, store.get('formatterTimeoutMs') || 2500))
      : false;
    formatterDecision = formatterDecisionEngine.shouldFormat(finalText, {
      cleanupMode: store.get('cleanupMode') || 'smart',
      alwaysFormat: store.get('alwaysFormat') === true,
      skipLlmForShortDictations: store.get('skipLlmForShortDictations') !== false,
      formatterMinWords: store.get('formatterMinWords') || 12,
      outputMode: getFormatterOutputMode(),
      tone: store.get('formatterTone') || 'natural',
      targetApp: appName,
      providerAvailable
    });

    if (formatterEnabled && formatterDecision.shouldFormat) {
      sendToWindow(overlayWindow, 'overlay-state', 'formatting');
      try {
        finalText = await formatter.formatForTargetApp(finalText, appName, {
          outputMode: getFormatterOutputMode(),
          tone: store.get('formatterTone') || 'natural',
          targetApp: appName,
          timeoutMs: store.get('formatterTimeoutMs') || 2500,
          preserveNames: true,
          preserveNumbers: true,
          preserveDates: true,
          preserveLinks: true,
          noManglish: true,
          hallucinationSafe: true
        });
      } catch (err) {
        formatterError = err.message || String(err);
        finalText = err.fallbackText || finalText;
        console.warn('LLM formatter failed; using offline cleaned text:', formatterError);
      }
    }

    // If cleanup/processing reduced the result to nothing (e.g. "um, uh"), don't
    // paste an empty string (which would clobber the clipboard) or log a blank
    // history entry — just report that nothing usable was heard.
    if (!finalText.trim()) return { text: '', words: 0 };

    // (bytes − 44-byte header) / 2 samples / actual sample rate.
    sendToWindow(overlayWindow, 'overlay-state', 'pasting');
    const pasteResult = await pasteText(finalText, pasteTarget, app.getName(), {
      preserveClipboard: store.get('preserveClipboard') !== false && hasFeature('advanced_clipboard_restore'),
      restoreClipboardDelay: store.get('restoreClipboardDelay')
    });
    const { words, stats } = recordTranscription(rawText, finalText,
      { durationSec: audioStats.durationSec, wordsCorrected, dictionaryFixes, appName,
        rms: audioStats.rms, peak: audioStats.peak });
    sendToWindow(overlayWindow, 'overlay-state', pasteResult.ok ? 'done' : 'error');
    const pasteError = pasteResult.ok ? null : `Paste failed; text copied to clipboard. ${pasteResult.error || ''}`.trim();
    return { text: finalText, words, stats, formatterError, formatterDecision, pasteError };
  } catch (err) {
    console.error('TRANSCRIPTION EXCEPTION IN MAIN PROCESS:', err);
    return { text: '', words: 0, pasteError: `Transcription failed: ${err.message || err}` };
  } finally {
    licenseManager.setDictationActive(false);
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      sendToWindow(overlayWindow, 'overlay-state', 'leaving');
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
      }, 250);
    }
  }
});

ipcMain.handle('get-state', () => ({
  history: store.get('history'),
  dictionary: store.get('dictionary'),
  snippets: store.get('snippets'),
  stats: store.get('stats'),
  appUsage: store.get('appUsage'),
  hotkey: store.get('hotkey'),
  micDeviceId: store.get('micDeviceId'),
  aiCleanup: store.get('aiCleanup'),
  boostQuietVoices: store.get('boostQuietVoices'),
  noiseSuppression: store.get('noiseSuppression'),
  dictationMode: store.get('dictationMode'),
  selectedModel: store.get('selectedModel'),
  inputLanguage: store.get('inputLanguage') || 'en',
  translateMalayalam: store.get('translateMalayalam') !== false,
  aiFormatterEnabled: store.get('aiFormatterEnabled') === true,
  cleanupMode: store.get('cleanupMode') || 'smart',
  alwaysFormat: store.get('alwaysFormat') === true,
  formatterProvider: store.get('formatterProvider') || 'private_offline',
  formatterOutputMode: store.get('formatterOutputMode') || 'transcribe',
  formatterTone: store.get('formatterTone') || 'natural',
  formatterTimeoutMs: store.get('formatterTimeoutMs') || 2500,
  formatterModel: store.get('formatterModel') || 'fast_3b',
  skipLlmForShortDictations: store.get('skipLlmForShortDictations') !== false,
  formatterMinWords: store.get('formatterMinWords') || 12,
  localOnlyMode: store.get('localOnlyMode') !== false,
  preserveClipboard: store.get('preserveClipboard') !== false,
  restoreClipboardDelay: store.get('restoreClipboardDelay') || 600,
  enablePersonalDictionary: store.get('enablePersonalDictionary') !== false,
  enableGlobalDictionary: store.get('enableGlobalDictionary') !== false,
  enableTextSnippets: store.get('enableTextSnippets') !== false,
  onboarded: store.get('onboarded'),
  modelReady: isActiveModelReady(),
  userProfile: store.get('userProfile'),
  subscription: subscriptionState(),
  featureFlags: subscriptionState().allowedFeatures || [],
  offlineAIStatus: store.get('offlineAIStatus') || null,
  flavor: IS_DEV_BUILD ? 'dev' : 'public'
}));

// Admin IPC is registered only in the dev build (admin module present).
if (adminMain) {
  adminMain.register({ ipcMain, shell, store, saveSecureToken, getSecureToken, globalDict, app, dialog, BrowserWindow });
}

// Screenwriting's local translation backend — available in every build.
translateMain.register({ ipcMain, app, BrowserWindow, saveSecureToken, getSecureToken });

ipcMain.handle('save-screenwriting-transcript', async (_event, text) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Screenwriting transcript',
    defaultPath: 'screenwriting-transcript.txt',
    filters: [{ name: 'Text', extensions: ['txt'] }]
  });
  if (canceled || !filePath) return { ok: false };
  await require('fs/promises').writeFile(filePath, text, 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('open-external', (_e, url) => {
  const { shell } = require('electron');
  shell.openExternal(url);
});

ipcMain.handle('offline-ai-status', async () => {
  const modelId = store.get('formatterModel') || 'fast_3b';
  const status = await formatterAvailability.status(modelId);
  if (status.configured === false && status.state === OFFLINE_AI_STATUS.BASIC_READY) {
    store.delete('offlineAIInstallState');
  }
  store.set('offlineAIStatus', status);
  return status;
});

ipcMain.handle('download-offline-ai-model', async (_event, modelId) => {
  const nextModel = modelId === 'quality_7b' ? 'quality_7b' : 'fast_3b';
  const info = offlineAIModelDownloads.modelInfo(nextModel);
  try {
    store.set('formatterModel', nextModel);
    if (!info.url) {
      const status = await formatterAvailability.status(nextModel);
      store.delete('offlineAIInstallState');
      store.set('offlineAIStatus', status);
      sendToWindow(mainWindow, 'offline-ai-status', status);
      return { ok: false, status, error: status.unavailableReason || 'Private Offline AI model is not included in this build.' };
    }
    store.set('offlineAIInstallState', OFFLINE_AI_STATUS.DOWNLOADING);
    store.set('offlineAIStatus', {
      state: OFFLINE_AI_STATUS.DOWNLOADING,
      model: info,
      sizeLabel: require('./offlineAI').formatBytes(info.sizeBytes),
      privacy: 'Your voice and text stay on this device.'
    });
    await offlineAIModelDownloads.download(nextModel);
    store.set('offlineAIInstallState', OFFLINE_AI_STATUS.INSTALLING);
    const installing = {
      state: OFFLINE_AI_STATUS.INSTALLING,
      model: info,
      privacy: 'Your voice and text stay on this device.'
    };
    store.set('offlineAIStatus', installing);
    sendToWindow(mainWindow, 'offline-ai-status', installing);
    const ready = await formatterAvailability.status(nextModel);
    store.delete('offlineAIInstallState');
    store.set('offlineAIStatus', ready);
    sendToWindow(mainWindow, 'offline-ai-status', ready);
    return { ok: true, status: ready };
  } catch (err) {
    const status = {
      state: OFFLINE_AI_STATUS.ERROR,
      error: err.message || String(err),
      model: info,
      privacy: 'Your voice and text stay on this device.'
    };
    store.set('offlineAIInstallState', OFFLINE_AI_STATUS.ERROR);
    store.set('offlineAIStatus', status);
    sendToWindow(mainWindow, 'offline-ai-status', status);
    return { ok: false, status, error: status.error };
  }
});

// Dev-only: the Dataset Studio page reports when it's the focused view so
// push-to-talk drives its clip recorder instead of dictation. In the public
// build the admin page never exists, so this is only ever sent `false`.
ipcMain.on('trainer-capture-mode', (_e, on) => { trainerCaptureMode = !!on; });

ipcMain.handle('save-profile', (_e, profile) => {
  store.set('userProfile', profile);
  return store.get('userProfile');
});

ipcMain.handle('dev-demo-login', async (_e, credentials = {}) => {
  if (!IS_DEV_BUILD || !devDemoLicenseKeys) {
    return { ok: false, error: 'Dev demo login is only available in the Dev build.' };
  }

  const email = String(credentials.email || '').trim().toLowerCase();
  const password = String(credentials.password || '');
  if (email !== DEV_DEMO_EMAIL || password !== DEV_DEMO_PASSWORD) {
    return { ok: false, error: 'Invalid Dev demo credentials.' };
  }

  const now = Date.now();
  const token = LicenseManager.signToken({
    userId: 'dev-demo-full-access',
    plan: PLAN_ENTERPRISE,
    subscriptionStatus: SUBSCRIPTION_ACTIVE,
    expiryDate: new Date(now + 3650 * 24 * 60 * 60 * 1000).toISOString(),
    graceUntil: new Date(now + 3650 * 24 * 60 * 60 * 1000 + 30 * 24 * 60 * 60 * 1000).toISOString(),
    allowedFeatures: defaultAllowedFeatures(PLAN_ENTERPRISE),
    allowedModels: defaultAllowedModels(PLAN_ENTERPRISE),
    deviceId: licenseManager.getDeviceId(),
    issuedAt: new Date(now).toISOString(),
    billingCycle: 'lifetime',
    licenseType: 'dev_demo'
  }, devDemoLicenseKeys.privateKey);

  const result = licenseManager.acceptToken(token, { source: 'dev_demo' });
  if (!result.ok) return result;

  const profile = {
    registered: true,
    name: 'Dev Demo',
    email: DEV_DEMO_EMAIL,
    plan: 'Enterprise Plan'
  };
  store.set('userProfile', profile);
  ensureAllowedSelectedModel();
  sendToWindow(mainWindow, 'subscription-updated', subscriptionState());
  return { ok: true, profile, state: subscriptionState() };
});

// --- Google OAuth 2.0 Integration ---
// GOOGLE_CLIENT_ID comes from ./authConfig (env override supported). It is empty
// until configured, in which case sign-in fails loudly instead of silently
// using a broken placeholder.

ipcMain.handle('google-login', async () => {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID in src/authConfig.js (or the GOOGLE_CLIENT_ID env var).'));
      return;
    }

    // PKCE: a per-attempt secret proves to Google that the same client that
    // started the flow is the one redeeming the code, so an intercepted auth
    // code on the loopback redirect is useless on its own.
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    let server;
    const timeout = setTimeout(() => {
      if (server) {
        server.close();
        reject(new Error('Google authentication timed out.'));
      }
    }, 300000); // 5 minutes timeout

    server = http.createServer(async (req, res) => {
      const urlParams = new URL(req.url, 'http://localhost');
      const code = urlParams.searchParams.get('code');
      const error = urlParams.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication failed</h1><p>' + error + '</p>');
        clearTimeout(timeout);
        server.close();
        reject(new Error(`Google login failed: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #333;">
              <div style="text-align: center; padding: 32px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <h1 style="color: #4caf50; margin-bottom: 8px;">Success!</h1>
                <p style="font-size: 16px; margin-bottom: 24px;">You have successfully signed into Parayu.</p>
                <p style="color: #666; font-size: 14px;">You can safely close this browser tab now.</p>
              </div>
            </body>
          </html>
        `);
        clearTimeout(timeout);
        const port = server.address().port;
        server.close();

        try {
          // Exchange code for tokens
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code: code,
              client_id: GOOGLE_CLIENT_ID,
              redirect_uri: `http://127.0.0.1:${port}`,
              grant_type: 'authorization_code',
              code_verifier: codeVerifier
            })
          });

          if (!tokenRes.ok) {
            const tokenErr = await tokenRes.text();
            throw new Error(`Failed to exchange code: ${tokenErr}`);
          }

          const tokens = await tokenRes.json();
          if (tokens.refresh_token) {
            saveSecureToken('googleRefreshToken', tokens.refresh_token);
          }

          // Fetch user profile info
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
          });

          if (!profileRes.ok) {
            throw new Error('Failed to fetch Google profile info.');
          }

          const userInfo = await profileRes.json();
          const profile = {
            registered: true,
            name: userInfo.name || userInfo.email.split('@')[0],
            email: userInfo.email,
            // Signing in does NOT grant a paid plan. Pro/Enterprise must be
            // verified against the backend (not built yet); until then every
            // account is Base so paid features stay gated.
            plan: 'Base Plan'
          };
          
          store.set('userProfile', profile);
          resolve(profile);
        } catch (e) {
          reject(e);
        }
      } else {
        res.writeHead(400);
        res.end('Invalid request.');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=openid%20profile%20email&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256`;

      shell.openExternal(authUrl);
    });
  });
});

ipcMain.handle('google-logout', () => {
  saveSecureToken('googleRefreshToken', null);
  store.set('userProfile', {
    registered: false,
    name: '',
    email: '',
    plan: 'Base Plan'
  });
  return store.get('userProfile');
});

async function refreshGoogleSession() {
  if (!GOOGLE_CLIENT_ID) return;
  const refreshToken = getSecureToken('googleRefreshToken');
  if (!refreshToken) return;
  
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenRes.ok) {
      console.warn('Google refresh token invalid or expired. Logging out.');
      store.set('userProfile', { registered: false, name: '', email: '', plan: 'Base Plan' });
      saveSecureToken('googleRefreshToken', null);
      return;
    }

    const tokens = await tokenRes.json();
    if (tokens.refresh_token) {
      saveSecureToken('googleRefreshToken', tokens.refresh_token);
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (profileRes.ok) {
      const userInfo = await profileRes.json();
      store.set('userProfile', {
        registered: true,
        name: userInfo.name || userInfo.email.split('@')[0],
        email: userInfo.email,
        // Keep the restored session on Base — entitlement is decided by the
        // backend, never by the mere presence of a Google session.
        plan: 'Base Plan'
      });
    }
  } catch (e) {
    console.error('Failed to auto-refresh Google token on startup:', e);
  }
}

ipcMain.handle('subscription-refresh', async () => {
  const result = await licenseManager.refresh({ force: true, reason: 'manual' });
  ensureAllowedSelectedModel();
  return { ...result, state: subscriptionState() };
});

ipcMain.handle('license-activate', async (_e, payload) => {
  const result = await licenseManager.activate(payload || {});
  ensureAllowedSelectedModel();
  return { ...result, state: subscriptionState() };
});

// --- Brain Switch: selectable Whisper models ---
ipcMain.handle('list-models', () => allowedModelsList());

let downloadingModelId = null;
let activeDownloadPromise = null;

ipcMain.handle('download-model', async (_e, id) => {
  const gate = featureFlag.modelGate(id);
  if (!gate.ok) {
    return { ok: false, error: gate.error, models: allowedModelsList() };
  }
  if (downloadingModelId) {
    if (downloadingModelId === id) {
      return activeDownloadPromise;
    }
    return { ok: false, error: 'Another model download is already in progress.', models: allowedModelsList() };
  }

  downloadingModelId = id;
  activeDownloadPromise = (async () => {
    try {
      await downloadModel(id, (pct) => {
        sendToWindow(mainWindow, 'model-download-progress', { id, pct });
      });
      return { ok: true, models: allowedModelsList() };
    } catch (err) {
      return { ok: false, error: err.message, models: allowedModelsList() };
    } finally {
      downloadingModelId = null;
      activeDownloadPromise = null;
    }
  })();

  return activeDownloadPromise;
});

ipcMain.handle('select-model', (_e, id) => {
  if (!featureFlag.canUseModel(id)) {
    id = 'base';
  }
  setSelectedModel(id);
  return allowedModelsList();
});

ipcMain.handle('complete-onboarding', () => {
  store.set('onboarded', true);
  return true;
});

ipcMain.handle('reset-onboarding', () => {
  store.set('onboarded', false);
  return true;
});

// Checks macOS Accessibility trust (needed to paste into other apps). Passing
// prompt=true surfaces the system dialog to add Parayu to the allow-list.
ipcMain.handle('check-accessibility', (_e, prompt) => {
  if (process.platform !== 'darwin') return true;
  const trusted = systemPreferences.isTrustedAccessibilityClient(!!prompt);
  // If trust was just granted, (re)register so a push-to-talk hook that failed
  // to attach earlier (no permission yet) now binds — no app restart needed.
  if (trusted) registerHotkey(store.get('hotkey'));
  return trusted;
});

ipcMain.handle('open-accessibility-settings', () => {
  if (process.platform === 'darwin') {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  }
  return true;
});

ipcMain.handle('open-pricing-page', () => {
  shell.openExternal('https://www.parayu.online/pricing');
  return true;
});

ipcMain.handle('set-dictation-mode', (_e, mode) => {
  const next = mode === 'pushToTalk' ? 'pushToTalk' : 'toggle';
  store.set('dictationMode', next);

  // A modifier-only hotkey (e.g. "Alt") only works for push-to-talk. If we're
  // switching back to toggle, restore a normal default so a hotkey still works.
  const hotkey = store.get('hotkey');
  const isModifierOnly = !hotkey.includes('+') && ['Alt', 'Meta', 'Ctrl', 'Shift'].includes(hotkey);
  if (next === 'toggle' && isModifierOnly) {
    const def = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space';
    store.set('hotkey', def);
  }

  registerHotkey(store.get('hotkey'));
  return next;
});

ipcMain.handle('set-mic-device', (_e, deviceId) => {
  store.set('micDeviceId', deviceId);
  return deviceId;
});

ipcMain.handle('set-ai-cleanup', (_e, enabled) => {
  store.set('aiCleanup', !!enabled);
  return store.get('aiCleanup');
});

ipcMain.handle('set-ai-formatter-enabled', (_e, enabled) => {
  if (enabled && !hasFeature('local_llm_formatter')) {
    store.set('aiFormatterEnabled', false);
    return false;
  }
  store.set('aiFormatterEnabled', !!enabled);
  return store.get('aiFormatterEnabled');
});

ipcMain.handle('set-cleanup-mode', (_e, mode) => {
  const next = ['fast', 'smart', 'premium'].includes(mode) ? mode : 'smart';
  store.set('cleanupMode', next);
  if (next === 'fast') {
    store.set('aiFormatterEnabled', false);
  } else if (hasFeature('local_llm_formatter')) {
    store.set('aiFormatterEnabled', true);
  }
  if (next === 'premium') {
    store.set('formatterModel', 'quality_7b');
    if (featureFlag.canUseModel('medium-q5_0')) setSelectedModel('medium-q5_0');
  } else if (next === 'smart' && store.get('formatterModel') !== 'quality_7b') {
    store.set('formatterModel', 'fast_3b');
  }
  return store.get('cleanupMode');
});

ipcMain.handle('set-always-format', (_e, enabled) => {
  store.set('alwaysFormat', !!enabled);
  return store.get('alwaysFormat');
});

ipcMain.handle('set-formatter-provider', (_e, provider) => {
  const allowed = new Set(['offline', 'private_offline', 'mlx', 'bundled_llamacpp']);
  if (process.env.PARAYU_ENABLE_OLLAMA_DEV === '1') allowed.add('ollama_dev');
  if (process.env.PARAYU_ENABLE_CLOUD_FORMATTERS === '1') {
    allowed.add('gemini');
    allowed.add('openai');
  }
  store.set('formatterProvider', allowed.has(provider) ? provider : 'private_offline');
  return store.get('formatterProvider');
});

ipcMain.handle('set-formatter-output-mode', (_e, mode) => {
  if (mode === 'translate_to_english' && !hasFeature('malayalam_to_english_premium')) {
    store.set('formatterOutputMode', 'transcribe');
    return store.get('formatterOutputMode');
  }
  store.set('formatterOutputMode', mode === 'translate_to_english' ? 'translate_to_english' : 'transcribe');
  return store.get('formatterOutputMode');
});

ipcMain.handle('set-formatter-tone', (_e, tone) => {
  const allowed = new Set(['natural', 'professional', 'casual', 'developer_prompt', 'short_reply']);
  if (tone === 'developer_prompt' && !hasFeature('developer_prompt_mode')) {
    store.set('formatterTone', 'natural');
    return store.get('formatterTone');
  }
  store.set('formatterTone', allowed.has(tone) ? tone : 'natural');
  return store.get('formatterTone');
});

ipcMain.handle('set-formatter-timeout', (_e, timeoutMs) => {
  const n = Math.max(500, Math.min(15000, parseInt(timeoutMs, 10) || 2500));
  store.set('formatterTimeoutMs', n);
  return store.get('formatterTimeoutMs');
});

ipcMain.handle('set-formatter-model', (_e, model) => {
  store.set('formatterModel', model === 'quality_7b' ? 'quality_7b' : 'fast_3b');
  return store.get('formatterModel');
});

ipcMain.handle('set-skip-llm-for-short-dictations', (_e, enabled) => {
  store.set('skipLlmForShortDictations', !!enabled);
  return store.get('skipLlmForShortDictations');
});

ipcMain.handle('set-formatter-min-words', (_e, words) => {
  const n = Math.max(1, Math.min(100, parseInt(words, 10) || 12));
  store.set('formatterMinWords', n);
  return store.get('formatterMinWords');
});

ipcMain.handle('set-local-only-mode', (_e, enabled) => {
  store.set('localOnlyMode', !!enabled);
  return store.get('localOnlyMode');
});

ipcMain.handle('set-preserve-clipboard', (_e, enabled) => {
  if (enabled && !hasFeature('advanced_clipboard_restore')) {
    store.set('preserveClipboard', false);
    return store.get('preserveClipboard');
  }
  store.set('preserveClipboard', !!enabled);
  return store.get('preserveClipboard');
});

ipcMain.handle('set-restore-clipboard-delay', (_e, delay) => {
  const n = Math.max(0, Math.min(5000, parseInt(delay, 10) || 600));
  store.set('restoreClipboardDelay', n);
  return store.get('restoreClipboardDelay');
});

ipcMain.handle('set-enable-personal-dictionary', (_e, enabled) => {
  if (enabled && !hasFeature('personal_dictionary')) {
    store.set('enablePersonalDictionary', false);
    return store.get('enablePersonalDictionary');
  }
  store.set('enablePersonalDictionary', !!enabled);
  return store.get('enablePersonalDictionary');
});

ipcMain.handle('set-enable-global-dictionary', (_e, enabled) => {
  store.set('enableGlobalDictionary', !!enabled);
  return store.get('enableGlobalDictionary');
});

ipcMain.handle('set-enable-text-snippets', (_e, enabled) => {
  if (enabled && !hasFeature('text_snippets')) {
    store.set('enableTextSnippets', false);
    return store.get('enableTextSnippets');
  }
  store.set('enableTextSnippets', !!enabled);
  return store.get('enableTextSnippets');
});

ipcMain.handle('set-boost-quiet-voices', (_e, enabled) => {
  store.set('boostQuietVoices', !!enabled);
  return store.get('boostQuietVoices');
});

ipcMain.handle('set-noise-suppression', (_e, enabled) => {
  store.set('noiseSuppression', !!enabled);
  return store.get('noiseSuppression');
});

ipcMain.handle('set-input-language', (_e, lang) => {
  if (lang === 'ml' && !hasFeature('malayalam_to_english_premium')) {
    store.set('inputLanguage', 'en');
    return store.get('inputLanguage');
  }
  store.set('inputLanguage', lang);
  ensureModelForInputLanguage();
  return store.get('inputLanguage');
});

ipcMain.handle('set-translate-malayalam', (_e, enabled) => {
  if (enabled && !hasFeature('malayalam_to_english_premium')) {
    store.set('translateMalayalam', false);
    return store.get('translateMalayalam');
  }
  store.set('translateMalayalam', !!enabled);
  return store.get('translateMalayalam');
});

ipcMain.handle('add-dictionary-entry', (_e, entry) => {
  const dict = store.get('dictionary');
  dict.push(entry);
  store.set('dictionary', dict);
  return dict;
});

ipcMain.handle('remove-dictionary-entry', (_e, index) => {
  const dict = store.get('dictionary');
  dict.splice(index, 1);
  store.set('dictionary', dict);
  return dict;
});

ipcMain.handle('add-snippet', (_e, entry) => {
  const snippets = store.get('snippets');
  snippets.push(entry);
  store.set('snippets', snippets);
  return snippets;
});

ipcMain.handle('remove-snippet', (_e, index) => {
  const snippets = store.get('snippets');
  snippets.splice(index, 1);
  store.set('snippets', snippets);
  return snippets;
});

ipcMain.handle('set-hotkey', (_e, hotkey) => {
  const isModifierOnly = !hotkey.includes('+') && ['Alt', 'Meta', 'Ctrl', 'Shift'].includes(hotkey);
  const ok = registerHotkey(hotkey);
  // Save when registration succeeds, or when it's a hold-to-talk modifier
  // (which may only fail because Accessibility permission is still pending).
  if (ok || isModifierOnly) store.set('hotkey', hotkey);
  // pending = saved but not actually live yet (a modifier hotkey awaiting the
  // Accessibility/Input-Monitoring grant). The UI uses this to set expectations.
  return { ok: ok || isModifierOnly, pending: !ok && isModifierOnly, hotkey: store.get('hotkey') };
});

ipcMain.on('recording-stopped-from-ui', () => {
  isRecording = false;

  if (maxDurationTimeout) {
    clearTimeout(maxDurationTimeout);
    maxDurationTimeout = null;
  }

  // The renderer aborted (e.g. mic permission denied), so the overlay would
  // otherwise be stuck on "Listening" — hide it.
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    sendToWindow(overlayWindow, 'overlay-state', 'leaving');
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
    }, 250);
  }
});

ipcMain.on('mic-level', (_e, level) => {
  sendToWindow(overlayWindow, 'overlay-level', level);
});

app.whenReady().then(async () => {
  const { session } = require('electron');
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  
  // Set user agent for renderer process navigator.userAgent and all requests
  session.defaultSession.setUserAgent(userAgent);
  
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [
      '*://*.youtube.com/*',
      '*://*.youtube-nocookie.com/*',
      '*://*.googlevideo.com/*',
      '*://*.ytimg.com/*',
      '*://*.ggpht.com/*',
      '*://*.doubleclick.net/*',
      '*://*.google.com/*',
      '*://*.googleapis.com/*'
    ] },
    (details, callback) => {
      if (details.url.includes('accounts.google.com')) {
        return callback({ cancel: false });
      }
      
      const headers = details.requestHeaders || {};
      let referer = details.referrer || '';
      
      // Normalize and remove duplicate keys case-insensitively
      for (const key of Object.keys(headers)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'referer') {
          referer = headers[key];
          delete headers[key];
        } else if (lowerKey === 'origin') {
          delete headers[key];
        } else if (lowerKey === 'user-agent') {
          delete headers[key];
        } else if (lowerKey.startsWith('sec-ch-ua')) {
          delete headers[key];
        }
      }
      
      if (!referer || referer.startsWith('file://')) {
        headers['referer'] = 'https://parayu.com/';
        headers['origin'] = 'https://parayu.com';
      } else {
        headers['referer'] = referer;
      }
      
      headers['user-agent'] = userAgent;
      
      callback({ cancel: false, requestHeaders: headers });
    }
  );

  createWindow();
  createOverlayWindow();
  createTray();
  registerHotkey(store.get('hotkey'));
  // Warm the model in the background (only if already downloaded) so the first
  // dictation is instant instead of paying the load cost on first use.
  warmUp();
  // Pull the latest developer-curated global dictionary in the background.
  // No-op until REMOTE_URL is set; never blocks or breaks launch on failure.
  refreshGlobalDictionary();
  // Refresh Google authentication session if a refresh token is present
  await refreshGoogleSession();
  licenseManager.refreshIfDue().then(() => {
    ensureAllowedSelectedModel();
    sendToWindow(mainWindow, 'subscription-updated', subscriptionState());
  }).catch(() => {});
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); stopHook(); });

// Clicking the Dock icon (macOS) reopens/refocuses the window.
app.on('activate', showMainWindow);

app.on('window-all-closed', () => {
  // Keep running in the tray, like the real product does.
});
