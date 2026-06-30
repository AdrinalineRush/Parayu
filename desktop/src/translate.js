// Screenwriting's translation backend: a local, offline AI4Bharat IndicTrans2
// pipeline run via a dedicated Python venv (mirrors the venv pattern used by
// the Admin training panel in src/admin/training.js). No text ever leaves the
// machine and no cloud translation API is used.
//
// IPC surface (registered in main.js, available in every build — unlike the
// dev-only admin/training IPC):
//   translation-status  -> { ready, message }
//   setup-translation   -> { ok, error? }  (also streams 'translation-setup-progress')
//   translate-text      -> { translations: { en, ml, ta, kn, hi } }

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// torch / sentencepiece / IndicTransToolkit don't ship wheels for the very
// latest CPython yet (e.g. 3.13/3.14), which makes pip fall back to source
// builds that fail with no useful error. Prefer a known-compatible 3.10–3.12
// interpreter over whatever "python3" resolves to system-wide.
const BASE_PYTHON_CANDIDATES = [
  '/opt/homebrew/bin/python3.11',
  '/opt/homebrew/bin/python3.12',
  '/opt/homebrew/bin/python3.10',
  '/usr/local/bin/python3.11',
  '/usr/local/bin/python3.12',
  '/usr/local/bin/python3.10',
  'python3.11',
  'python3.12',
  'python3.10'
];

const HF_TOKEN_KEY = 'hfToken';
const TRANSLATION_REQUEST_TIMEOUT_MS = Number(process.env.PARAYU_TRANSLATION_TIMEOUT_MS || 60000);
const TRANSLATION_WORKER_READY_TIMEOUT_MS = Number(process.env.PARAYU_TRANSLATION_READY_TIMEOUT_MS || 30000);

function register({ ipcMain, app, BrowserWindow, saveSecureToken, getSecureToken }) {
  const scriptsDir = __dirname.includes('app.asar')
    ? path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'translate')
    : path.join(__dirname, 'translate');
  const venvDir = path.join(app.getPath('userData'), 'translate-venv');
  const readyMarker = path.join(venvDir, '.ready');

  // ---- Self-contained build: auto-provision bundled resources on first launch ----
  // If the developer build shipped with a pre-built venv and HF model cache,
  // install them automatically so the user never sees a setup screen.
  const bundledVenvDir = path.join(process.resourcesPath, 'bundled-venv');
  const bundledHfCacheDir = path.join(process.resourcesPath, 'hf_cache');

  if (fs.existsSync(bundledVenvDir) && !fs.existsSync(venvDir)) {
    try {
      // Copy the bundled venv to the user data directory. The venv's internal
      // paths may reference the original machine, but Python re-resolves them
      // via the pyvenv.cfg home key at runtime.
      require('child_process').execSync(
        `cp -R "${bundledVenvDir}" "${venvDir}"`,
        { stdio: 'ignore', timeout: 60000 }
      );
      // Fix the pyvenv.cfg home to point to the local Python if it exists
      const cfgPath = path.join(venvDir, 'pyvenv.cfg');
      if (fs.existsSync(cfgPath)) {
        let cfg = fs.readFileSync(cfgPath, 'utf8');
        // Update home to a local Python that exists on this machine
        for (const candidate of BASE_PYTHON_CANDIDATES) {
          const dir = candidate.startsWith('/') ? path.dirname(candidate) : null;
          if (dir && fs.existsSync(candidate)) {
            cfg = cfg.replace(/^home\s*=\s*.*$/m, `home = ${dir}`);
            fs.writeFileSync(cfgPath, cfg, 'utf8');
            break;
          }
        }
      }
      // Mark as ready so the app skips the setup screen entirely
      fs.writeFileSync(readyMarker, `bundled: ${new Date().toISOString()}`);
      console.log('[Translate] Auto-provisioned bundled Python venv.');
    } catch (e) {
      console.error('[Translate] Failed to provision bundled venv:', e);
    }
  }

  function venvPython() {
    const bin = process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'python.exe')
      : path.join(venvDir, 'bin', 'python');
    return fs.existsSync(bin) ? bin : null;
  }

  function findBasePython() {
    for (const candidate of BASE_PYTHON_CANDIDATES) {
      if (candidate.startsWith('/')) {
        if (fs.existsSync(candidate)) return candidate;
      } else {
        try {
          require('child_process').execFileSync(candidate, ['--version'], { stdio: 'ignore' });
          return candidate;
        } catch (_e) { /* not on PATH */ }
      }
    }
    return 'python3'; // last resort — may be too new, setup will report a clear error
  }

  // A venv built against an incompatible Python (e.g. a prior run that fell
  // back to system Python 3.14) will never successfully install torch et al.
  // Detect that and force a clean rebuild instead of failing forever.
  function venvPythonIsCompatible(py) {
    try {
      const out = require('child_process').execFileSync(py, ['-c', 'import sys; print(sys.version_info[1])']).toString().trim();
      const minor = parseInt(out, 10);
      return minor >= 9 && minor <= 12;
    } catch (_e) {
      return false;
    }
  }

  function sendProgress(message) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('translation-setup-progress', message);
    }
  }

  function run(command, args, opts = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, opts);
      setupChild = child;
      let tail = []; // last lines of combined stdout+stderr, for error reporting
      let lastResult = null; // parsed payload from the last "__RESULT__ {...}" line, if any
      let cancelled = false;
      const pushTail = (text) => {
        for (const line of text.split('\n')) {
          if (line.startsWith('__PROGRESS__ ')) { sendProgress(line.slice('__PROGRESS__ '.length).trim()); continue; }
          if (line.startsWith('__RESULT__ ')) {
            try { lastResult = JSON.parse(line.slice('__RESULT__ '.length)); } catch (_e) { /* ignore */ }
            continue;
          }
          if (!line.trim()) continue;
          tail.push(line);
          if (tail.length > 40) tail.shift();
        }
      };
      child.stdout.on('data', (d) => pushTail(d.toString()));
      child.stderr.on('data', (d) => pushTail(d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (setupChild === child) setupChild = null;
        if (cancelled) return reject(new Error('Setup cancelled.'));
        if (code === 0) return resolve();
        if (lastResult && lastResult.error) return reject(new Error(lastResult.error));
        reject(new Error(tail.join('\n') || `${command} ${args.join(' ')} exited with code ${code}`));
      });
      child._markCancelled = () => { cancelled = true; };
    });
  }

  function hfEnv() {
    const env = { ...process.env };
    const token = getSecureToken ? getSecureToken(HF_TOKEN_KEY) : null;
    if (token) env.HF_TOKEN = token;
    // If the build shipped with a bundled HF model cache, point Hugging Face
    // libraries at it so they load models from disk without any network calls.
    if (fs.existsSync(bundledHfCacheDir)) {
      env.HF_HOME = bundledHfCacheDir;
      env.TRANSFORMERS_OFFLINE = '1';
      env.HF_HUB_OFFLINE = '1';
    }
    return env;
  }

  let setupChild = null; // the in-flight setup subprocess, if any — lets Cancel actually kill work

  // ---- Persistent translation worker ----
  // Spawned once and kept alive for the app's lifetime so IndicTrans2's models
  // are loaded into memory a single time, instead of being re-read from disk
  // (and re-initialized in torch) on every translated segment. Falls back to
  // respawning if the process dies.
  let worker = null; // { child, pending: Map<id, {resolve, reject}>, ready: Promise, nextId }

  function readLines(stream, onLine) {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.trim()) onLine(line);
      }
    });
  }

  function spawnWorker(py) {
    const child = spawn(py, [path.join(scriptsDir, 'translate_worker.py')], { env: hfEnv() });
    const pending = new Map();
    let resolveReady, rejectReady;
    const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });

    readLines(child.stdout, (line) => {
      if (line.trim() === '__WORKER_READY__') { resolveReady(); return; }
      try {
        const msg = JSON.parse(line);
        const entry = pending.get(msg.id);
        if (entry) {
          pending.delete(msg.id);
          if (msg.error) entry.reject(new Error(msg.error));
          else entry.resolve(msg.translations || {});
        }
      } catch (_e) { /* stray non-JSON output (library warnings etc.) — ignore */ }
    });
    child.stderr.on('data', () => { /* model-loading logs — not surfaced per call */ });
    child.on('error', (err) => { rejectReady(err); });
    child.on('close', () => {
      for (const entry of pending.values()) entry.reject(new Error('Translation worker exited unexpectedly.'));
      pending.clear();
      if (worker && worker.child === child) worker = null;
    });

    return { child, pending, ready, nextId: 1 };
  }

  function stopWorker(w) {
    if (!w || !w.child) return;
    try {
      w.child.kill();
    } catch (_e) {
      // Process may already be gone.
    }
    if (worker && worker.child === w.child) worker = null;
  }

  function withTimeout(promise, ms, message, onTimeout) {
    let timer = null;
    return new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        if (onTimeout) onTimeout();
        reject(new Error(message));
      }, ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function getWorker() {
    const py = venvPython();
    if (!py || !fs.existsSync(readyMarker)) return null;
    if (!worker) worker = spawnWorker(py);
    return worker;
  }

  function translateViaWorker(text, sourceLang, targetLangs) {
    const w = getWorker();
    if (!w) return Promise.resolve({});
    return withTimeout(
      w.ready,
      TRANSLATION_WORKER_READY_TIMEOUT_MS,
      'Translation worker did not become ready in time.',
      () => stopWorker(w)
    ).then(() => new Promise((resolve, reject) => {
      const id = w.nextId++;
      let timer = null;
      const finish = (fn, value) => {
        clearTimeout(timer);
        fn(value);
      };
      timer = setTimeout(() => {
        if (!w.pending.has(id)) return;
        w.pending.delete(id);
        stopWorker(w);
        reject(new Error(`Translation timed out after ${Math.round(TRANSLATION_REQUEST_TIMEOUT_MS / 1000)} seconds.`));
      }, TRANSLATION_REQUEST_TIMEOUT_MS);
      w.pending.set(id, {
        resolve: (value) => finish(resolve, value),
        reject: (err) => finish(reject, err)
      });
      try {
        w.child.stdin.write(JSON.stringify({ id, text, sourceLang, targetLangs }) + '\n');
      } catch (err) {
        w.pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    }));
  }

  ipcMain.handle('translation-status', () => {
    const ready = fs.existsSync(readyMarker);
    return {
      ready,
      message: ready
        ? 'Local translation models ready (offline, on-device).'
        : 'Translation models are not installed yet — set them up once (one-time download, runs fully offline afterwards).'
    };
  });

  ipcMain.handle('setup-translation', async () => {
    try {
      sendProgress('Creating local Python environment…');
      let existing = venvPython();
      if (existing && !venvPythonIsCompatible(existing)) {
        // A previous run built the venv against an incompatible Python
        // (e.g. the system default, which may be newer than what torch
        // supports). Rebuilding from scratch is the only way out.
        sendProgress('Rebuilding the local Python environment with a compatible Python version…');
        fs.rmSync(venvDir, { recursive: true, force: true });
        existing = null;
      }
      if (!existing) {
        await run(findBasePython(), ['-m', 'venv', venvDir]);
      }
      const py = venvPython();
      if (!py) throw new Error('Could not create the local Python environment.');

      sendProgress('Installing translation packages (this can take a few minutes)…');
      await run(py, ['-m', 'pip', 'install', '--upgrade', 'pip']);
      await run(py, ['-m', 'pip', 'install', '-r', path.join(scriptsDir, 'requirements.txt')]);

      const token = getSecureToken ? getSecureToken(HF_TOKEN_KEY) : null;
      if (!token) {
        throw new Error('IndicTrans2 models require a Hugging Face access token. Add one in Settings → Screenwriting translation.');
      }

      sendProgress('Downloading IndicTrans2 models…');
      await run(py, [path.join(scriptsDir, 'setup_env.py')], { env: hfEnv() });

      fs.writeFileSync(readyMarker, new Date().toISOString());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('translate-text', async (_event, { text, sourceLang, targetLangs }) => {
    try {
      const translations = await translateViaWorker(text, sourceLang, targetLangs);
      return { translations };
    } catch (err) {
      console.error('translate-text failed:', err);
      return { translations: {}, error: err.message || String(err) };
    }
  });

  ipcMain.handle('cancel-translation-setup', () => {
    if (setupChild) {
      if (setupChild._markCancelled) setupChild._markCancelled();
      setupChild.kill();
      setupChild = null;
    }
    return { ok: true };
  });

  ipcMain.handle('set-hf-token', (_event, token) => {
    if (saveSecureToken) saveSecureToken(HF_TOKEN_KEY, token);
    return { ok: true };
  });

  ipcMain.handle('get-hf-token-status', () => {
    const token = getSecureToken ? getSecureToken(HF_TOKEN_KEY) : null;
    return { hasToken: !!token };
  });
}

module.exports = { register };
