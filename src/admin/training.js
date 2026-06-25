// DEV-BUILD-ONLY training backend for the Admin Training Panel. Bundled solely
// by the dev build (electron-builder.dev.js); the public build excludes
// src/admin/** entirely, so none of this ships to users.
//
// Runs the local Python scripts (src/admin/training-scripts, deployed into
// <project>/scripts) against the training venv, streams their logs to the
// renderer, and performs the safe app-model file operations (backup / replace /
// restore). Everything is local: audio is never uploaded; only the base model
// weights are fetched once and cached under <project>/.hf-cache.
//
// Hard safety rules enforced here:
//   • Never train or overwrite a .bin via Python — training only writes a LoRA
//     adapter under output/.
//   • "Replace App Model" only ever writes ggml-small-q5_1.bin, always backs up
//     first, and refuses to touch ggml-small.en-q5_1.bin.

const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SCRIPT_NAMES = ['env_check.py', 'validate_dataset.py', 'test_transcribe.py', 'train_lora.py', 'export_model.py'];
const APP_MODEL_NAME = 'ggml-small-q5_1.bin';   // multilingual small — the only file we may replace
const EN_MODEL_NAME = 'ggml-small.en-q5_1.bin'; // English-only — never touch

function register({ ipcMain, app, dialog, shell, BrowserWindow }) {
  let current = null; // the single running child process, if any

  function defaultProjectDir() {
    return path.join(app.getPath('desktop'), 'parayu-whisper-training');
  }

  function resolveProject(opts) {
    return (opts && opts.projectDir) || defaultProjectDir();
  }

  // The app model dir is fixed to the production "parayu" userData location,
  // independent of dev/release app naming, so the panel manages the real file.
  function appModelDir() {
    return path.join(app.getPath('appData'), 'parayu', 'models');
  }
  function appModelPath() { return path.join(appModelDir(), APP_MODEL_NAME); }
  // Fixed backup location on the Desktop (independent of the training project).
  function backupsDir() { return path.join(app.getPath('home'), 'Desktop', 'parayu-model-backup'); }
  function canonicalBackupPath() { return path.join(backupsDir(), APP_MODEL_NAME); }

  // whisper.cpp tooling lives inside the training project so nothing global is touched.
  function toolsDir(project) { return path.join(project, 'tools'); }
  function whisperCppDir(project) { return path.join(toolsDir(project), 'whisper.cpp'); }
  function whisperPyDir(project) { return path.join(toolsDir(project), 'whisper'); } // openai/whisper (converter assets)
  function convertScriptPath(project) { return path.join(whisperCppDir(project), 'models', 'convert-h5-to-ggml.py'); }
  async function findQuantize(project) {
    const cands = [
      path.join(whisperCppDir(project), 'build', 'bin', 'quantize'),
      path.join(whisperCppDir(project), 'build', 'bin', 'whisper-quantize'),
      path.join(whisperCppDir(project), 'quantize')
    ];
    for (const c of cands) { if (await exists(c)) return c; }
    return null;
  }

  async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

  function pythonPath(projectDir) {
    const venv = path.join(projectDir, '.venv', 'bin', 'python');
    return fss.existsSync(venv) ? venv : 'python3';
  }

  // Deploy the bundled scripts into <project>/scripts so the venv python can run
  // them (and the developer can inspect them). Overwrites to stay in sync.
  async function deployScripts(projectDir) {
    const destDir = path.join(projectDir, 'scripts');
    await fs.mkdir(destDir, { recursive: true });
    for (const name of SCRIPT_NAMES) {
      const src = path.join(__dirname, 'training-scripts', name);
      try {
        const content = await fs.readFile(src, 'utf8');
        await fs.writeFile(path.join(destDir, name), content, 'utf8');
      } catch (e) {
        // If a bundled script can't be read, surface it rather than failing silently.
        throw new Error(`Could not deploy ${name}: ${e.message}`);
      }
    }
    return destDir;
  }

  function send(event, line) {
    if (event && event.sender && !event.sender.isDestroyed()) event.sender.send('train-log', line);
  }

  function sendProgress(event, percent, stage, details = {}) {
    if (event && event.sender && !event.sender.isDestroyed()) {
      event.sender.send('train-progress', Object.assign({ percent, stage }, details));
    }
  }

  // Spawn a deployed script with the venv python. Streams stdout/stderr to the
  // renderer line-by-line and resolves with { ok, code, result } where result is
  // parsed from the script's "__RESULT__ {json}" line if present.
  // Core streaming spawn. Streams stdout/stderr to the renderer (unless quiet),
  // parses a trailing "__RESULT__ {json}" line, and enforces one task at a time.
  function exec(event, cmd, args, { cwd, env, quiet = false, label } = {}) {
    return new Promise((resolve) => {
      if (current) { resolve({ ok: false, error: 'Another task is already running.' }); return; }
      if (!quiet) send(event, ('$ ' + (label || (cmd + ' ' + args.join(' ')))).trim());

      let child;
      try {
        child = spawn(cmd, args, { cwd, env: env || process.env });
      } catch (e) {
        if (!quiet) send(event, `Failed to start: ${e.message}`);
        resolve({ ok: false, error: e.message });
        return;
      }
      current = child;

      let result = null;
      const buf = { out: '', err: '' };
      const pump = (key, chunk) => {
        buf[key] += chunk.toString();
        let idx;
        while ((idx = buf[key].indexOf('\n')) >= 0) {
          let line = buf[key].slice(0, idx);
          buf[key] = buf[key].slice(idx + 1);
          if (line.endsWith('\r')) {
            line = line.slice(0, -1);
          }
          if (line.startsWith('__RESULT__ ')) {
            try { result = JSON.parse(line.slice('__RESULT__ '.length)); } catch (_) { /* ignore */ }
          } else if (line.startsWith('__PROGRESS__ ')) {
            try {
              const p = JSON.parse(line.slice('__PROGRESS__ '.length));
              if (event && event.sender && !event.sender.isDestroyed()) {
                event.sender.send('train-progress', p);
              }
            } catch (_) { /* ignore */ }
          } else if (!quiet) {
            send(event, line);
          }
        }
      };
      child.stdout.on('data', (c) => pump('out', c));
      child.stderr.on('data', (c) => pump('err', c));

      child.on('error', (e) => {
        if (!quiet) send(event, `Process error: ${e.message}`);
        current = null;
        resolve({ ok: false, error: e.message });
      });
      child.on('close', (code, signal) => {
        if (!quiet && buf.out.trim()) send(event, buf.out.trim());
        if (!quiet && buf.err.trim()) send(event, buf.err.trim());
        current = null;
        if (signal) { if (!quiet) send(event, `\n■ Stopped (${signal}).`); resolve({ ok: false, canceled: true, code: null }); return; }
        if (!quiet) send(event, `\n● Finished with exit code ${code}.`);
        resolve({ ok: code === 0, code, result });
      });
    });
  }

  // Run one of the deployed python scripts with the venv python.
  async function run(event, scriptName, args = [], projectDir, quiet = false) {
    if (current) return { ok: false, error: 'Another task is already running.' };
    try { await deployScripts(projectDir); } catch (e) { return { ok: false, error: e.message }; }
    const py = pythonPath(projectDir);
    const env = Object.assign({}, process.env, {
      PYTHONUNBUFFERED: '1',
      HF_HOME: path.join(projectDir, '.hf-cache'),
      HF_HUB_DISABLE_TELEMETRY: '1',
      TOKENIZERS_PARALLELISM: 'false'
    });
    return exec(event, py, [path.join(projectDir, 'scripts', scriptName), ...args], {
      cwd: projectDir, env, quiet, label: `${py} scripts/${scriptName} ${args.join(' ')}`.trim()
    });
  }

  // ─── Script-backed actions ─────────────────────────────────────────────────
  ipcMain.handle('train-validate', async (e, opts) => run(e, 'validate_dataset.py', [], resolveProject(opts)));

  ipcMain.handle('train-test-base', async (e, opts) => {
    const lang = (opts && opts.language) || 'en';
    const scope = (opts && opts.scope) || 'random3';
    const args = ['--language', lang];
    if (scope === 'first') {
      args.push('--first');
    } else if (scope === 'random3') {
      args.push('--random', '3');
    } else if (scope === 'random5') {
      args.push('--random', '5');
    } else if (scope === 'all') {
      args.push('--all');
    }
    return run(e, 'test_transcribe.py', args, resolveProject(opts));
  });

  ipcMain.handle('train-test-trained', async (e, opts) => {
    const project = resolveProject(opts);
    const lang = (opts && opts.language) || 'en';
    const scope = (opts && opts.scope) || 'random3';
    const merged = path.join(project, 'output', 'merged-model');
    const adapter = path.join(project, 'output', 'lora-adapter');
    const args = ['--language', lang];
    if (fss.existsSync(merged)) args.push('--model', merged);
    else args.push('--adapter', adapter);

    if (scope === 'first') {
      args.push('--first');
    } else if (scope === 'random3') {
      args.push('--random', '3');
    } else if (scope === 'random5') {
      args.push('--random', '5');
    } else if (scope === 'all') {
      args.push('--all');
    }
    return run(e, 'test_transcribe.py', args, project);
  });

  ipcMain.handle('train-start', async (e, opts) => {
    const args = [];
    if (opts && opts.language) args.push('--language', opts.language);
    if (opts && opts.epochs) args.push('--epochs', String(opts.epochs));
    return run(e, 'train_lora.py', args, resolveProject(opts));
  });

  ipcMain.handle('train-export', async (e, opts) => run(e, 'export_model.py', [], resolveProject(opts)));

  // ─── whisper.cpp tooling + HF→ggml conversion ──────────────────────────────
  ipcMain.handle('train-tools-status', async (_e, opts) => {
    const project = resolveProject(opts);
    const quantize = await findQuantize(project);
    return {
      whisperCppCloned: (await exists(path.join(whisperCppDir(project), '.git'))) || (await exists(convertScriptPath(project))),
      whisperPyCloned: await exists(path.join(whisperPyDir(project), 'whisper')),
      convertScript: await exists(convertScriptPath(project)),
      quantizeBuilt: !!quantize,
      quantizePath: quantize,
      mergedExists: await exists(path.join(project, 'output', 'merged-model')),
      convertedExists: await exists(path.join(project, 'output', APP_MODEL_NAME)),
      convertedPath: path.join(project, 'output', APP_MODEL_NAME)
    };
  });

  // Clone (only if missing) and build whisper.cpp inside <project>/tools. Also
  // clones openai/whisper for the assets the HF→ggml converter needs. Stops and
  // surfaces the exact error on any clone/build failure.
  ipcMain.handle('train-setup-tools', async (e, opts) => {
    const project = resolveProject(opts);
    sendProgress(e, 0, 'Checking tools folder');
    await fs.mkdir(toolsDir(project), { recursive: true });

    if ((await exists(path.join(whisperCppDir(project), '.git'))) || (await exists(convertScriptPath(project)))) {
      send(e, '● whisper.cpp already cloned — skipping.');
      sendProgress(e, 20, 'Cloning whisper.cpp');
    } else {
      send(e, '● Cloning whisper.cpp…');
      sendProgress(e, 20, 'Cloning whisper.cpp');
      const r = await exec(e, 'git', ['clone', '--depth', '1', 'https://github.com/ggerganov/whisper.cpp.git', whisperCppDir(project)], { cwd: toolsDir(project) });
      if (!r.ok) return { ok: false, error: 'whisper.cpp clone failed (see logs). Is git installed?' };
    }

    if (await exists(path.join(whisperPyDir(project), 'whisper'))) {
      send(e, '● openai/whisper already cloned — skipping.');
      sendProgress(e, 40, 'Cloning/opening converter tools');
    } else {
      send(e, '● Cloning openai/whisper (converter assets)…');
      sendProgress(e, 40, 'Cloning/opening converter tools');
      const r = await exec(e, 'git', ['clone', '--depth', '1', 'https://github.com/openai/whisper.git', whisperPyDir(project)], { cwd: toolsDir(project) });
      if (!r.ok) return { ok: false, error: 'openai/whisper clone failed (see logs).' };
    }

    let quantize = await findQuantize(project);
    if (quantize) {
      send(e, `● quantize already built: ${quantize}`);
      sendProgress(e, 60, 'Building quantize');
    } else {
      send(e, '● Building whisper.cpp (this can take a few minutes)…');
      sendProgress(e, 60, 'Building quantize');
      let built = false;
      const cfg = await exec(e, 'cmake', ['-B', 'build'], { cwd: whisperCppDir(project) });
      if (cfg.ok) {
        const b = await exec(e, 'cmake', ['--build', 'build', '--config', 'Release', '-j'], { cwd: whisperCppDir(project) });
        built = b.ok;
      } else {
        send(e, '● cmake unavailable — trying legacy make…');
        let m = await exec(e, 'make', ['-j', 'quantize'], { cwd: whisperCppDir(project) });
        if (!m.ok) m = await exec(e, 'make', ['-j'], { cwd: whisperCppDir(project) });
        built = m.ok;
      }
      quantize = await findQuantize(project);
      if (!quantize) {
        return {
          ok: false,
          error: built
            ? 'Build finished but no quantize binary was found (see logs).'
            : 'Could not build whisper.cpp. Install cmake first (brew install cmake), then retry — see logs for the exact error.'
        };
      }
    }

    sendProgress(e, 90, 'Verifying tools');
    send(e, '\n✓ whisper.cpp tools are ready.');
    sendProgress(e, 100, 'Complete');
    return { ok: true, quantize };
  });

  // Convert output/merged-model → output/ggml-small-q5_1.bin (f16 then q5_1).
  // Writes ONLY to output/ — never the installed app model.
  ipcMain.handle('train-convert-ggml', async (e, opts) => {
    const project = resolveProject(opts);
    const merged = path.join(project, 'output', 'merged-model');
    const outputDir = path.join(project, 'output');
    const finalOut = path.join(outputDir, APP_MODEL_NAME);

    sendProgress(e, 0, 'Checking merged model');
    if (!(await exists(merged))) return { ok: false, error: 'No merged model — run Export Model first.' };
    if (!(await exists(convertScriptPath(project)))) return { ok: false, error: 'whisper.cpp not set up — run Setup whisper.cpp Tools first.' };
    const quantize = await findQuantize(project);
    if (!quantize) return { ok: false, error: 'quantize not built — run Setup whisper.cpp Tools first.' };

    const py = pythonPath(project);
    const env = Object.assign({}, process.env, { PYTHONUNBUFFERED: '1', HF_HUB_DISABLE_TELEMETRY: '1' });

    const f16 = path.join(outputDir, 'ggml-model.bin');
    try { await fs.rm(f16, { force: true }); } catch (_) {}

    send(e, '● Converting merged HF model → ggml (f16)…');
    sendProgress(e, 25, 'Converting HF model to GGML f16');
    let r = await exec(e, py, [convertScriptPath(project), merged, whisperPyDir(project), outputDir], { cwd: project, env });
    if (!r.ok) return { ok: false, error: 'HF→ggml conversion failed (see logs).' };
    if (!(await exists(f16))) return { ok: false, error: 'Converter did not produce ggml-model.bin (see logs).' };

    send(e, '● Quantizing → q5_1…');
    sendProgress(e, 60, 'Quantizing to Q5_1');
    r = await exec(e, quantize, [f16, finalOut, 'q5_1'], { cwd: project });
    if (!r.ok) return { ok: false, error: 'Quantization failed (see logs).' };
    if (!(await exists(finalOut))) return { ok: false, error: 'Quantize did not produce the output .bin (see logs).' };

    sendProgress(e, 90, 'Verifying ggml-small-q5_1.bin');
    send(e, `\n✓ Created ${finalOut}\n  This is NOT installed yet — use "Replace App Model" to install it.`);
    sendProgress(e, 100, 'Complete');
    return { ok: true, output: finalOut };
  });

  ipcMain.handle('train-cancel', async () => {
    if (current) { try { current.kill('SIGTERM'); } catch (_) {} return { ok: true }; }
    return { ok: false, error: 'Nothing is running.' };
  });

  ipcMain.handle('train-status', async () => ({ running: !!current }));

  // ─── Environment status ────────────────────────────────────────────────────
  ipcMain.handle('train-env', async (e, opts) => {
    const project = resolveProject(opts);
    const venvDir = path.join(project, '.venv');
    const venvPython = path.join(venvDir, 'bin', 'python');
    const prod = appModelPath();

    let prodModel = null;
    if (await exists(prod)) {
      const st = await fs.stat(prod);
      prodModel = { size: st.size, mtime: st.mtimeMs };
    }
    const backup = canonicalBackupPath();

    const env = {
      home: app.getPath('home'),
      venvPath: venvDir,
      venvDetected: fss.existsSync(venvPython),
      pythonPath: pythonPath(project),
      baseModel: 'openai/whisper-small',
      datasetMetadata: path.join(project, 'data', 'metadata.csv'),
      datasetAudioDir: path.join(project, 'data', 'audio'),
      datasetExists: await exists(path.join(project, 'data', 'metadata.csv')),
      prodModelPath: prod,
      prodModel,
      backupPath: backup,
      backupExists: await exists(backup),
      probe: null,
      probeOk: false
    };

    // Quiet probe via python (doesn't spam the training log).
    const res = await run(e, 'env_check.py', [], project, true);
    env.probe = res && res.result ? res.result : null;
    env.probeOk = !!(res && res.ok);
    return env;
  });

  // ─── App-model file operations (Node, no Python) ───────────────────────────
  ipcMain.handle('train-model-info', async () => {
    const ap = appModelPath();
    let model = null;
    if (await exists(ap)) {
      const st = await fs.stat(ap);
      model = { path: ap, size: st.size, mtime: st.mtimeMs };
    }
    let backups = [];
    const bdir = backupsDir();
    if (await exists(bdir)) {
      const entries = await fs.readdir(bdir);
      for (const name of entries) {
        if (!name.endsWith('.bin')) continue;
        const full = path.join(bdir, name);
        const st = await fs.stat(full);
        backups.push({ name, path: full, size: st.size, mtime: st.mtimeMs });
      }
      backups.sort((a, b) => b.mtime - a.mtime);
    }
    return { model, backups, appModelName: APP_MODEL_NAME, backupsDir: bdir };
  });

  // Back up the current app model to ~/Desktop/parayu-model-backup/ggml-small-q5_1.bin.
  // An existing canonical backup is rotated to a timestamped name so history is
  // never silently lost.
  async function backupCurrentModel() {
    const ap = appModelPath();
    if (!(await exists(ap))) return { ok: false, error: `App model not found at ${ap}` };
    const bdir = backupsDir();
    await fs.mkdir(bdir, { recursive: true });
    const canonical = canonicalBackupPath();
    if (await exists(canonical)) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      await fs.rename(canonical, path.join(bdir, `ggml-small-q5_1.${ts}.bin`));
    }
    await fs.copyFile(ap, canonical);
    return { ok: true, path: canonical };
  }

  ipcMain.handle('train-backup-model', async () => backupCurrentModel());

  // Replace ONLY ggml-small-q5_1.bin. Always backs up first. Requires an explicit
  // confirmed flag (the renderer shows a strong confirm dialog). Never writes the
  // English-only model.
  ipcMain.handle('train-replace-model', async (_e, opts) => {
    if (!opts || !opts.confirmed) return { ok: false, error: 'Not confirmed.' };
    const project = resolveProject(opts);

    let source = opts.sourcePath;
    if (!source) {
      const candidate = path.join(project, 'output', APP_MODEL_NAME);
      if (await exists(candidate)) source = candidate;
    }
    if (!source) {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
      const res = await dialog.showOpenDialog(win, {
        title: 'Choose the new ggml-small-q5_1.bin',
        defaultPath: path.join(project, 'output'),
        properties: ['openFile'],
        filters: [{ name: 'GGML model', extensions: ['bin'] }]
      });
      if (res.canceled || !res.filePaths[0]) return { ok: false, error: 'No model selected.' };
      source = res.filePaths[0];
    }

    if (!(await exists(source))) return { ok: false, error: `Source not found: ${source}` };
    if (!source.toLowerCase().endsWith('.bin')) return { ok: false, error: 'Source must be a .bin model.' };
    // Belt-and-suspenders: never let the source or target be the English model.
    if (path.basename(source) === EN_MODEL_NAME) return { ok: false, error: 'Refusing to use the English-only model.' };

    const dest = appModelPath(); // always ggml-small-q5_1.bin; never the .en file

    // Stop safely: if we can't back up the current model first, don't replace it.
    const backup = await backupCurrentModel();
    if (!backup.ok) return { ok: false, error: `Aborted — backup failed: ${backup.error}` };

    try {
      await fs.mkdir(appModelDir(), { recursive: true });
      await fs.copyFile(source, dest);
    } catch (e) {
      return { ok: false, error: `Copy failed: ${e.message}`, backup: backup.path };
    }
    return { ok: true, replaced: dest, backup: backup.path };
  });

  ipcMain.handle('train-restore-backup', async (_e, opts) => {
    if (!opts || !opts.confirmed) return { ok: false, error: 'Not confirmed.' };
    let source = opts.backupPath;
    if (!source) {
      // Prefer the canonical backup; otherwise the most recent timestamped one.
      const canonical = canonicalBackupPath();
      if (await exists(canonical)) {
        source = canonical;
      } else {
        const bdir = backupsDir();
        if (await exists(bdir)) {
          const entries = (await fs.readdir(bdir)).filter((n) => n.endsWith('.bin'));
          let latest = null;
          for (const name of entries) {
            const full = path.join(bdir, name);
            const st = await fs.stat(full);
            if (!latest || st.mtimeMs > latest.mtime) latest = { path: full, mtime: st.mtimeMs };
          }
          if (latest) source = latest.path;
        }
      }
    }
    if (!source || !(await exists(source))) return { ok: false, error: 'No backup found to restore.' };

    const dest = appModelPath();
    try {
      await fs.mkdir(appModelDir(), { recursive: true });
      await fs.copyFile(source, dest);
    } catch (e) {
      return { ok: false, error: `Restore failed: ${e.message}` };
    }
    return { ok: true, restored: dest, from: source };
  });

  ipcMain.handle('train-open-output', async (_e, opts) => {
    const project = resolveProject(opts);
    const out = path.join(project, 'output');
    await fs.mkdir(out, { recursive: true });
    await shell.openPath(out);
    return { ok: true };
  });
}

module.exports = { register };
