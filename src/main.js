const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen, systemPreferences, shell, dialog } = require('electron');

// Never let a broken stdout/stderr pipe crash the app. When launched from a
// terminal whose output pipe stalls or closes, a console.log/error can throw
// EPIPE/EIO; without a listener Node turns that into a fatal uncaughtException.
// Swallow those specific stream errors so logging can never take the app down.
process.stdout.on('error', (err) => { if (err && (err.code === 'EPIPE' || err.code === 'EIO')) return; });
process.stderr.on('error', (err) => { if (err && (err.code === 'EPIPE' || err.code === 'EIO')) return; });

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
const { transcribe, warmUp, setProgressCallback, listModels, downloadModel, setSelectedModel, isActiveModelReady } = require('./whisper');
const { cleanup } = require('./cleanup');
const { pasteText, captureFocusedTarget } = require('./paste');
const { registerPushToTalk, unregister: unregisterHook, stopHook } = require('./hotkey-hook');

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 680,
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
  mainWindow.setSize(1100, 680);
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
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.js') }
  });
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
}

// Recreate the overlay if it was ever destroyed, so the recording indicator
// can't silently go missing for the rest of the session.
function ensureOverlayWindow() {
  if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow();
}

function showMainWindow() {
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

// Reads the sample rate from a 16-bit PCM mono WAV header (bytes 24–27) so the
// duration is correct even if the OS ignored our 16 kHz AudioContext request.
function wavSampleRate(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 44) return 16000;
  const rate = new DataView(arrayBuffer).getUint32(24, true);
  return rate >= 8000 && rate <= 192000 ? rate : 16000;
}

ipcMain.handle('transcribe-audio', async (_event, wavArrayBuffer) => {
  try {
    const rawText = await transcribe(wavArrayBuffer);
    if (!rawText) return { text: '', words: 0 };

    // Developer-curated global corrections. 'pre' entries (Malayalam-script
    // slang/normalization) run first, then 'post' entries fix the English
    // output. Each entry only matches its own script, so running both on the
    // same text is safe whether or not Whisper translated to English. (Whisper
    // performs ml->en translation internally, so 'pre' necessarily operates on
    // the transcription output, not on the raw audio.) Both run before the
    // user's personal dictionary so a user can still override a global fix.
    const globPre = applyGlobalDictionary(rawText, 'pre');
    const globPost = applyGlobalDictionary(globPre.text, 'post');
    const dict = applyDictionary(globPost.text);
    const snip = applySnippets(dict.text);
    let finalText = snip.text;
    const dictionaryFixes = globPre.count + globPost.count + dict.count + snip.count;

    // "Words corrected" = words removed by AI cleanup (fillers, stutters, repeats).
    let wordsCorrected = 0;
    if (store.get('aiCleanup')) {
      const beforeClean = finalText;
      finalText = cleanup(finalText);
      wordsCorrected = Math.max(0, wordCount(beforeClean) - wordCount(finalText));
    }

    // If cleanup/processing reduced the result to nothing (e.g. "um, uh"), don't
    // paste an empty string (which would clobber the clipboard) or log a blank
    // history entry — just report that nothing usable was heard.
    if (!finalText.trim()) return { text: '', words: 0 };

    // (bytes − 44-byte header) / 2 samples / actual sample rate.
    const sampleRate = wavSampleRate(wavArrayBuffer);
    const durationSec = Math.max(0, (wavArrayBuffer.byteLength - 44) / 2 / sampleRate);
    const pasteTarget = await (pasteTargetPromise || Promise.resolve(null));
    const appName = pasteTarget && pasteTarget.name ? pasteTarget.name : null;

    const pasteResult = await pasteText(finalText, pasteTarget, app.getName());
    const { words, stats } = recordTranscription(rawText, finalText,
      { durationSec, wordsCorrected, dictionaryFixes, appName });
    return { text: finalText, words, stats, pasteError: pasteResult.ok ? null : pasteResult.error };
  } catch (err) {
    console.error('TRANSCRIPTION EXCEPTION IN MAIN PROCESS:', err);
    return { text: '', words: 0, pasteError: `Transcription failed: ${err.message || err}` };
  } finally {
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
  onboarded: store.get('onboarded'),
  modelReady: isActiveModelReady(),
  userProfile: store.get('userProfile'),
  flavor: IS_DEV_BUILD ? 'dev' : 'public'
}));

// Admin IPC is registered only in the dev build (admin module present).
if (adminMain) {
  adminMain.register({ ipcMain, shell, store, saveSecureToken, getSecureToken, globalDict, app, dialog, BrowserWindow });
}

// Dev-only: the Dataset Studio page reports when it's the focused view so
// push-to-talk drives its clip recorder instead of dictation. In the public
// build the admin page never exists, so this is only ever sent `false`.
ipcMain.on('trainer-capture-mode', (_e, on) => { trainerCaptureMode = !!on; });

ipcMain.handle('save-profile', (_e, profile) => {
  store.set('userProfile', profile);
  return store.get('userProfile');
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

// --- Brain Switch: selectable Whisper models ---
ipcMain.handle('list-models', () => listModels());

ipcMain.handle('download-model', async (_e, id) => {
  const profile = store.get('userProfile') || { registered: false, plan: 'Base Plan' };
  const isProOrEnterprise = profile.registered && (profile.plan === 'Pro Plan' || profile.plan === 'Enterprise Plan');
  if (id === 'medium-q5_0' && !isProOrEnterprise) {
    return { ok: false, error: "Pro subscription required for Medium model.", models: listModels() };
  }
  try {
    await downloadModel(id, (pct) => {
      sendToWindow(mainWindow, 'model-download-progress', { id, pct });
    });
    return { ok: true, models: listModels() };
  } catch (err) {
    return { ok: false, error: err.message, models: listModels() };
  }
});

ipcMain.handle('select-model', (_e, id) => {
  const profile = store.get('userProfile') || { registered: false, plan: 'Base Plan' };
  const isProOrEnterprise = profile.registered && (profile.plan === 'Pro Plan' || profile.plan === 'Enterprise Plan');
  if (id === 'medium-q5_0' && !isProOrEnterprise) {
    id = 'small-q5_1';
  }
  setSelectedModel(id);
  return listModels();
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

ipcMain.handle('set-boost-quiet-voices', (_e, enabled) => {
  store.set('boostQuietVoices', !!enabled);
  return store.get('boostQuietVoices');
});

ipcMain.handle('set-noise-suppression', (_e, enabled) => {
  store.set('noiseSuppression', !!enabled);
  return store.get('noiseSuppression');
});

ipcMain.handle('set-input-language', (_e, lang) => {
  store.set('inputLanguage', lang);
  return store.get('inputLanguage');
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
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); stopHook(); });

// Clicking the Dock icon (macOS) reopens/refocuses the window.
app.on('activate', showMainWindow);

app.on('window-all-closed', () => {
  // Keep running in the tray, like the real product does.
});
