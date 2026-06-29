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

const SCRIPT_NAMES = ['env_check.py', 'validate_dataset.py', 'test_transcribe.py', 'train_lora.py', 'export_model.py', 'split_audio.py'];
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
  function appModelPath() {
    return path.join(appModelDir(), APP_MODEL_NAME);
  }
  function outputModelPath(project) {
    let latestFile = null;
    let maxVersion = 0;
    const dir = path.join(project, 'output');
    if (fss.existsSync(dir)) {
      fss.readdirSync(dir).forEach((f) => {
        const match = f.match(/^Parayu_ggml-small-q5_V(\d+)\.bin$/);
        if (match) {
          const ver = parseInt(match[1], 10);
          if (ver > maxVersion) {
            maxVersion = ver;
            latestFile = path.join(dir, f);
          }
        }
      });
    }
    return latestFile || path.join(dir, APP_MODEL_NAME);
  }
  // Fixed backup location on the Desktop (independent of the training project).
  function backupsDir() { return path.join(app.getPath('home'), 'Desktop', 'parayu-model-backup'); }
  function canonicalBackupPath() {
    const activePath = appModelPath();
    return path.join(backupsDir(), path.basename(activePath));
  }

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
  ipcMain.handle('train-validate', async (e, opts) => {
    const lang = (opts && opts.language) || 'ml';
    const task = (opts && opts.task) || 'translate';
    return run(e, 'validate_dataset.py', ['--language', lang, '--task', task], resolveProject(opts));
  });

  function getTimestampString() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  ipcMain.handle('train-test-base', async (e, opts) => {
    const lang = (opts && opts.language) || 'ml';
    const task = (opts && opts.task) || 'translate';
    const args = ['--language', lang, '--task', task];
    return run(e, 'test_transcribe.py', args, resolveProject(opts));
  });

  ipcMain.handle('train-test-trained', async (e, opts) => {
    const project = resolveProject(opts);
    const lang = (opts && opts.language) || 'ml';
    const task = (opts && opts.task) || 'translate';
    const merged = path.join(project, 'output', 'merged-model');
    const args = ['--language', lang, '--task', task];
    
    if (fss.existsSync(merged)) {
      args.push('--model', merged);
    } else {
      let adapter = opts && opts.adapterPath;
      if (!adapter) {
        const runsDir = path.join(project, 'output', 'runs');
        if (fss.existsSync(runsDir)) {
          const runDirs = fss.readdirSync(runsDir)
            .filter(name => name.startsWith('run_'))
            .map(name => ({ name, path: path.join(runsDir, name) }));
          if (runDirs.length > 0) {
            runDirs.sort((a, b) => b.name.localeCompare(a.name));
            const latestAdapter = path.join(runDirs[0].path, 'lora-adapter');
            if (fss.existsSync(latestAdapter)) {
              adapter = latestAdapter;
            }
          }
        }
      }
      if (!adapter) {
        adapter = path.join(project, 'output', 'lora-adapter');
      }
      args.push('--adapter', adapter);
    }
    return run(e, 'test_transcribe.py', args, project);
  });

  ipcMain.handle('train-start', async (e, opts) => {
    const project = resolveProject(opts);
    const args = [];
    const lang = (opts && opts.language) || 'ml';
    const task = (opts && opts.task) || 'translate';
    args.push('--language', lang, '--task', task);
    if (opts && opts.epochs) args.push('--epochs', String(opts.epochs));
    if (opts && opts.lr) args.push('--lr', String(opts.lr));
    if (opts && opts.batch) args.push('--batch', String(opts.batch));
    if (opts && opts.gradAccum) args.push('--grad-accum', String(opts.gradAccum));
    if (opts && opts.encoderLora) args.push('--encoder-lora');
    if (opts && opts.resume) args.push('--resume');

    // Resuming a crashed/interrupted run reuses its existing run folder
    // (and therefore its checkpoints) instead of starting a fresh one.
    const runName = (opts && opts.resume && opts.resumeRunName) ? opts.resumeRunName : 'run_' + getTimestampString();
    const runDir = path.join(project, 'output', 'runs', runName);
    const adapterPath = path.join(runDir, 'lora-adapter');
    args.push('--output', adapterPath);

    // Snapshot just the metadata (clip list + transcripts), not the audio
    // itself — with large datasets (hours of clips) copying every audio file
    // on every run would be slow and double disk usage for no benefit, since
    // the audio doesn't change between runs.
    const metaSrc = path.join(project, 'data', 'metadata.csv');
    if (await exists(metaSrc)) {
      try {
        await fs.mkdir(runDir, { recursive: true });
        await fs.copyFile(metaSrc, path.join(runDir, 'metadata.csv'));
      } catch (err) {
        send(e, `⚠ Metadata snapshot warning: ${err.message}`);
      }
    }

    const res = await run(e, 'train_lora.py', args, project);
    if (res && res.ok) {
      res.adapterPath = adapterPath;
      res.runName = runName;
    }
    return res;
  });

  ipcMain.handle('train-runs-history-get', async (_e, opts) => {
    const project = resolveProject(opts);
    const historyPath = path.join(project, 'output', 'runs_history.json');
    if (!(await exists(historyPath))) return [];
    try {
      const content = await fs.readFile(historyPath, 'utf8');
      return JSON.parse(content);
    } catch (_) {
      return [];
    }
  });

  ipcMain.handle('train-runs-history-save', async (_e, opts, history) => {
    const project = resolveProject(opts);
    const outputDir = path.join(project, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    const historyPath = path.join(outputDir, 'runs_history.json');
    try {
      await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('train-export', async (e, opts) => run(e, 'export_model.py', [], resolveProject(opts)));

  // Clears just the Training/Export/Convert artifacts (Steps 3/5/6) so their
  // badges go back to Locked/Ready, without touching the dataset (data/) or
  // anything in App Model Management / Dev App Model — those are genuinely
  // separate state and this never installs/uninstalls anything, it only
  // deletes intermediate output/ files. Past run history under output/runs
  // is left alone; this only clears the "current" artifacts the badges check.
  ipcMain.handle('train-reset-pipeline', async (_e, opts) => {
    const project = resolveProject(opts);
    const outputDir = path.join(project, 'output');
    const targets = [
      path.join(outputDir, 'lora-adapter'),
      path.join(outputDir, 'lora-checkpoints'),
      path.join(outputDir, 'lora-checkpoints-temp'),
      path.join(outputDir, 'merged-model'),
      path.join(outputDir, 'ggml-model.bin'),
      path.join(outputDir, 'ggml-small-q5_1.bin'),
      path.join(outputDir, 'model_manifest.json'),
      path.join(outputDir, 'runs_history.json')
    ];

    const removed = [];
    for (const target of targets) {
      if (await exists(target)) {
        await fs.rm(target, { recursive: true, force: true });
        removed.push(path.basename(target));
      }
    }

    // Versioned candidates from Convert to GGML (Parayu_ggml-small-q5_V1.bin, V2, ...).
    try {
      const entries = await fs.readdir(outputDir);
      for (const name of entries) {
        if (/^Parayu_ggml-small-q5_V\d+\.bin$/.test(name)) {
          await fs.rm(path.join(outputDir, name), { force: true });
          removed.push(name);
        }
      }
    } catch (_) { /* output dir may not exist yet */ }

    return { ok: true, removed };
  });

  // ─── whisper.cpp tooling + HF→ggml conversion ──────────────────────────────
  ipcMain.handle('train-tools-status', async (_e, opts) => {
    const project = resolveProject(opts);
    const quantize = await findQuantize(project);
    const outModel = outputModelPath(project);
    return {
      whisperCppCloned: (await exists(path.join(whisperCppDir(project), '.git'))) || (await exists(convertScriptPath(project))),
      whisperPyCloned: await exists(path.join(whisperPyDir(project), 'whisper')),
      convertScript: await exists(convertScriptPath(project)),
      quantizeBuilt: !!quantize,
      quantizePath: quantize,
      mergedExists: await exists(path.join(project, 'output', 'merged-model')),
      convertedExists: await exists(outModel),
      convertedPath: outModel
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

    let version = 1;
    const historyPath = path.join(project, 'output', 'runs_history.json');
    if (fss.existsSync(historyPath)) {
      try {
        const history = JSON.parse(fss.readFileSync(historyPath, 'utf8'));
        if (Array.isArray(history) && history.length > 0) {
          version = history.length;
        }
      } catch (_) {}
    }
    const currentModelName = `Parayu_ggml-small-q5_V${version}.bin`;
    const finalOut = path.join(outputDir, currentModelName);

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

    sendProgress(e, 90, `Verifying ${currentModelName}`);
    send(e, `\n✓ Created ${finalOut}\n  This is NOT installed yet — use "Replace App Model" to install it.`);
    
    // Create/update model_manifest.json
    try {
      const manifestPath = path.join(outputDir, 'model_manifest.json');
      const historyPath = path.join(outputDir, 'runs_history.json');
      let sourceRun = 'unknown';
      let trainedSim = null;
      let baseSim = null;
      if (fss.existsSync(historyPath)) {
        const history = JSON.parse(await fs.readFile(historyPath, 'utf8'));
        if (Array.isArray(history) && history.length > 0) {
          const latestRun = history[0];
          sourceRun = latestRun.name || 'unknown';
          trainedSim = latestRun.avgSimilarity;
        }
      }
      
      // Let's count clips in metadata.csv
      let clipCount = 0;
      const metaPath = path.join(project, 'data', 'metadata.csv');
      if (await exists(metaPath)) {
        const content = await fs.readFile(metaPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        clipCount = lines.length;
        if (lines[0] && lines[0].toLowerCase().includes('wav_filename')) {
          clipCount = Math.max(0, clipCount - 1);
        }
      }

      if (fss.existsSync(manifestPath)) {
        try {
          const oldManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
          if (oldManifest && oldManifest.base_average_similarity !== undefined) {
            baseSim = oldManifest.base_average_similarity;
          }
        } catch (_) {}
      }

      let improvement = null;
      if (trainedSim !== null && baseSim !== null) {
        improvement = trainedSim - baseSim;
      }

      const manifest = {
        candidate_model_path: finalOut,
        created_at: new Date().toISOString(),
        source_training_run: sourceRun,
        dataset_clip_count: clipCount,
        base_average_similarity: baseSim,
        trained_average_similarity: trainedSim,
        improvement: improvement !== null ? (improvement >= 0 ? `+${improvement}%` : `${improvement}%`) : null,
        notes: `Candidate V${version} model.`,
        model_label: `Candidate V${version}`
      };

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    } catch (err) {
      send(e, `[Warning] Failed to write model_manifest.json: ${err.message}`);
    }

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
  ipcMain.handle('train-manifest-save', async (_e, opts, manifest) => {
    const project = resolveProject(opts);
    const outputDir = path.join(project, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    const manifestPath = path.join(outputDir, 'model_manifest.json');
    try {
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('train-model-info', async (_e, opts) => {
    const project = resolveProject(opts);
    const outputDir = path.join(project, 'output');
    
    // 1. Current Local App Model
    const localPath = path.join(appModelDir(), 'ggml-small-q5_1.bin');
    let localModel = null;
    if (await exists(localPath)) {
      const st = await fs.stat(localPath);
      const versionLabel = await getModelVersion(appModelDir());
      localModel = {
        path: localPath,
        filename: 'ggml-small-q5_1.bin',
        size: st.size,
        mtime: st.mtimeMs,
        version: versionLabel || 'ORIGINAL',
        status: 'Active on this Mac'
      };
    }

    // 2. Newly Converted Model (Candidate)
    const manifestPath = path.join(outputDir, 'model_manifest.json');
    let manifest = null;
    if (await exists(manifestPath)) {
      try {
        const content = await fs.readFile(manifestPath, 'utf8');
        manifest = JSON.parse(content);
      } catch (_) {}
    }

    let candidatePath = manifest ? manifest.candidate_model_path : outputModelPath(project);
    let candidateModel = null;
    if (await exists(candidatePath)) {
      const st = await fs.stat(candidatePath);
      candidateModel = {
        path: candidatePath,
        filename: path.basename(candidatePath),
        size: st.size,
        mtime: st.mtimeMs,
        version: (manifest && manifest.model_label) || extractVersionLabel(path.basename(candidatePath)),
        sourceRun: manifest ? manifest.source_training_run : 'unknown',
        trainedAvgSimilarity: manifest ? manifest.trained_average_similarity : null,
        baseAvgSimilarity: manifest ? manifest.base_average_similarity : null,
        improvement: manifest ? manifest.improvement : null,
        clipCount: manifest ? manifest.dataset_clip_count : 0,
        status: 'Ready to replace local model'
      };
    }

    // 3. Previous Local Model
    let prevLocal = null;
    const ldir = localBackupsDir();
    if (await exists(ldir)) {
      const entries = (await fs.readdir(ldir)).filter((n) => n.endsWith('.bin'));
      let latest = null;
      for (const name of entries) {
        const full = path.join(ldir, name);
        const st = await fs.stat(full);
        if (!latest || st.mtimeMs > latest.mtime) {
          latest = { name, path: full, size: st.size, mtime: st.mtimeMs };
        }
      }
      if (latest) {
        prevLocal = {
          path: latest.path,
          filename: latest.name,
          size: latest.size,
          mtime: latest.mtime,
          status: 'Can restore if V2 is bad'
        };
      }
    }

    // 4. Release Default Model
    const releasePath = path.join(project, 'src', 'assets', 'models', 'ggml-small-q5_1.bin');
    let releaseModel = null;
    const rmodelsDir = path.dirname(releasePath);
    if (await exists(releasePath)) {
      const st = await fs.stat(releasePath);
      const versionLabel = await getModelVersion(rmodelsDir);
      releaseModel = {
        path: releasePath,
        filename: 'ggml-small-q5_1.bin',
        size: st.size,
        mtime: st.mtimeMs,
        version: versionLabel || 'ORIGINAL',
        status: 'Bundled default for next DMG build'
      };
    }

    // 5. Previous Release Model
    let prevRelease = null;
    const rdir = releaseBackupsDir();
    if (await exists(rdir)) {
      const entries = (await fs.readdir(rdir)).filter((n) => n.endsWith('.bin'));
      let latest = null;
      for (const name of entries) {
        const full = path.join(rdir, name);
        const st = await fs.stat(full);
        if (!latest || st.mtimeMs > latest.mtime) {
          latest = { name, path: full, size: st.size, mtime: st.mtimeMs };
        }
      }
      if (latest) {
        prevRelease = {
          path: latest.path,
          filename: latest.name,
          size: latest.size,
          mtime: latest.mtime,
          status: 'Can restore next DMG default'
        };
      }
    }

    return {
      localModel,
      candidateModel,
      prevLocal,
      releaseModel,
      prevRelease,
      backupsDir: backupsDir()
    };
  });

  function localBackupsDir() { return path.join(backupsDir(), 'local'); }
  function releaseBackupsDir() { return path.join(backupsDir(), 'release'); }

  async function getModelVersion(dir) {
    const metaPath = path.join(dir, 'active_version.json');
    try {
      if (await exists(metaPath)) {
        const content = await fs.readFile(metaPath, 'utf8');
        const data = JSON.parse(content);
        if (data && data.versionLabel) {
          return data.versionLabel;
        }
      }
    } catch (_) {}
    return 'ORIGINAL';
  }

  async function setModelVersion(dir, versionLabel) {
    const metaPath = path.join(dir, 'active_version.json');
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(metaPath, JSON.stringify({ versionLabel }), 'utf8');
    } catch (_) {}
  }

  function extractVersionLabel(filename) {
    // Check if it's a backup file being restored, e.g., ggml-small-q5_1_V2_20260625_183000.bin
    const backupMatch = filename.match(/_(V\d+|ORIGINAL)_\d{8}_\d{6}\.bin$/i);
    if (backupMatch) return backupMatch[1].toUpperCase();

    // Check standard version tag in trained output, e.g. Parayu_ggml-small-q5_V2.bin
    const match = filename.match(/_V(\d+)/i);
    if (match) return `V${match[1]}`;

    return 'V2'; // default fallback for newly trained if no match found
  }

  function isValidModelFileName(name) {
    const lower = name.toLowerCase();
    if (lower.includes('ggml-small.en') || lower.includes('small.en') || lower.includes('.en-q5_1')) {
      return false;
    }
    if (name === 'ggml-small-q5_1.bin' || name === 'ggml-small_q5_1.bin' || name === 'Parayu_ggml-small-q5_V1.bin') {
      return true;
    }
    if (/^Parayu_ggml-small-q5_V\d+\.bin$/.test(name)) {
      return true;
    }
    // Allow timestamped backups, with or without version/ORIGINAL prefix before the timestamp
    if (/^ggml-small[-_]q5_1_(?:V\d+|ORIGINAL|v[a-zA-Z0-9]+)?_?\d{8}_\d{6}\.bin$/i.test(name)) {
      return true;
    }
    if (/^Parayu_ggml-small-q5_V\d+_(?:V\d+|ORIGINAL|v[a-zA-Z0-9]+)?_?\d{8}_\d{6}\.bin$/i.test(name)) {
      return true;
    }
    return false;
  }

  async function validateModelFile(filePath) {
    if (!(await exists(filePath))) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const name = path.basename(filePath);
    if (!isValidModelFileName(name)) {
      throw new Error(`Invalid model filename: ${name}. En model is rejected.`);
    }
    const st = await fs.stat(filePath);
    if (st.size < 100 * 1024 * 1024) {
      throw new Error(`File size is too small (${(st.size / 1024 / 1024).toFixed(1)} MB). Must be at least 100 MB.`);
    }
  }

  async function backupModelFile(filePath, type) {
    if (!(await exists(filePath))) return null;
    const bdir = type === 'local' ? localBackupsDir() : releaseBackupsDir();
    await fs.mkdir(bdir, { recursive: true });
    
    // Read the version label from active_version.json in the same directory as the model file
    const dir = path.dirname(filePath);
    const versionLabel = await getModelVersion(dir);

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const base = path.basename(filePath, '.bin');
    const backupName = `${base}_${versionLabel}_${ts}.bin`;
    const dest = path.join(bdir, backupName);
    await fs.copyFile(filePath, dest);
    return dest;
  }

  // Back up the current app model to ~/Desktop/parayu-model-backup/.
  // An existing canonical backup is rotated to a timestamped name so history is
  // never silently lost.
  async function backupCurrentModel() {
    const ap = appModelPath();
    if (!(await exists(ap))) return { ok: true, path: null };
    const bdir = localBackupsDir();
    await fs.mkdir(bdir, { recursive: true });
    const canonical = path.join(bdir, path.basename(ap));
    if (await exists(canonical)) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const baseNoExt = path.basename(ap, '.bin');
      await fs.rename(canonical, path.join(bdir, `${baseNoExt}.${ts}.bin`));
    }
    await fs.copyFile(ap, canonical);
    return { ok: true, path: canonical };
  }

  ipcMain.handle('train-backup-model', async () => backupCurrentModel());

  // Legacy replacement (kept for backwards compatibility)
  ipcMain.handle('train-replace-model', async (_e, opts) => {
    if (!opts || !opts.confirmed) return { ok: false, error: 'Not confirmed.' };
    const project = resolveProject(opts);
    let source = opts.sourcePath;
    if (!source) {
      const candidate = outputModelPath(project);
      if (await exists(candidate)) source = candidate;
    }
    if (!source) return { ok: false, error: 'No model selected.' };
    const dest = path.join(appModelDir(), path.basename(source));
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

  // Legacy restore (kept for backwards compatibility)
  ipcMain.handle('train-restore-backup', async (_e, opts) => {
    if (!opts || !opts.confirmed) return { ok: false, error: 'Not confirmed.' };
    let source = opts.backupPath;
    if (!source) return { ok: false, error: 'No backup found.' };
    const dest = appModelPath();
    try {
      await fs.mkdir(appModelDir(), { recursive: true });
      await fs.copyFile(source, dest);
    } catch (e) {
      return { ok: false, error: `Restore failed: ${e.message}` };
    }
    return { ok: true, restored: dest, from: source };
  });

  // ─── New Rollback Handlers ───
  ipcMain.handle('train-replace-local-model', async (_e, opts) => {
    if (!opts || !opts.confirmed) return { ok: false, error: 'Not confirmed.' };
    const project = resolveProject(opts);

    let source = opts.sourcePath;
    if (!source) {
      const candidate = outputModelPath(project);
      if (await exists(candidate)) source = candidate;
    }
    if (!source) {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
      const res = await dialog.showOpenDialog(win, {
        title: 'Choose the model file to install',
        defaultPath: path.join(project, 'output'),
        properties: ['openFile'],
        filters: [{ name: 'GGML model', extensions: ['bin'] }]
      });
      if (res.canceled || !res.filePaths[0]) return { ok: false, error: 'No model selected.' };
      source = res.filePaths[0];
    }

    try {
      await validateModelFile(source);
    } catch (err) {
      return { ok: false, error: err.message };
    }

    const dest = path.join(appModelDir(), 'ggml-small-q5_1.bin');

    // Backup existing target model before overwriting
    let backupPath = null;
    if (await exists(dest)) {
      try {
        backupPath = await backupModelFile(dest, 'local');
      } catch (err) {
        return { ok: false, error: `Pre-backup failed: ${err.message}` };
      }
    }

    try {
      await fs.mkdir(appModelDir(), { recursive: true });
      await fs.copyFile(source, dest);

      // Store the version metadata
      const versionLabel = extractVersionLabel(path.basename(source));
      await setModelVersion(appModelDir(), versionLabel);
    } catch (err) {
      return { ok: false, error: `Copy to local failed: ${err.message}`, backup: backupPath };
    }
    return { ok: true, replaced: dest, backup: backupPath };
  });

  ipcMain.handle('train-restore-local-model', async (_e, opts) => {
    if (!opts || !opts.confirmed) return { ok: false, error: 'Not confirmed.' };
    let source = opts.backupPath;
    if (!source) {
      const bdir = localBackupsDir();
      if (await exists(bdir)) {
        const entries = (await fs.readdir(bdir)).filter((n) => n.endsWith('.bin'));
        let latest = null;
        for (const name of entries) {
          const full = path.join(bdir, name);
          const st = await fs.stat(full);
          if (!latest || st.mtimeMs > latest.mtime) {
            latest = { path: full, mtime: st.mtimeMs };
          }
        }
        if (latest) source = latest.path;
      }
    }

    if (!source) return { ok: false, error: 'No backup file found to restore.' };

    try {
      await validateModelFile(source);
    } catch (err) {
      return { ok: false, error: err.message };
    }

    const dest = path.join(appModelDir(), 'ggml-small-q5_1.bin');

    let preBackup = null;
    if (await exists(dest)) {
      try {
        preBackup = await backupModelFile(dest, 'local');
      } catch (_) {}
    }

    try {
      await fs.mkdir(appModelDir(), { recursive: true });
      await fs.copyFile(source, dest);

      // Store the restored version metadata
      const versionLabel = extractVersionLabel(path.basename(source));
      await setModelVersion(appModelDir(), versionLabel);
    } catch (err) {
      return { ok: false, error: `Restore failed: ${err.message}` };
    }
    return { ok: true, restored: dest, from: source, backup: preBackup };
  });

  ipcMain.handle('train-set-release-model', async (_e, opts) => {
    if (!opts || !opts.confirmed) return { ok: false, error: 'Not confirmed.' };
    const project = resolveProject(opts);

    let source = opts.sourcePath;
    if (!source) {
      const candidate = outputModelPath(project);
      if (await exists(candidate)) source = candidate;
    }
    if (!source) {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
      const res = await dialog.showOpenDialog(win, {
        title: 'Choose the model file to set as Release Default',
        defaultPath: path.join(project, 'output'),
        properties: ['openFile'],
        filters: [{ name: 'GGML model', extensions: ['bin'] }]
      });
      if (res.canceled || !res.filePaths[0]) return { ok: false, error: 'No model selected.' };
      source = res.filePaths[0];
    }

    try {
      await validateModelFile(source);
    } catch (err) {
      return { ok: false, error: err.message };
    }

    const destDir = path.join(project, 'src', 'assets', 'models');
    const dest = path.join(destDir, 'ggml-small-q5_1.bin');

    let backupPath = null;
    if (await exists(dest)) {
      try {
        backupPath = await backupModelFile(dest, 'release');
      } catch (err) {
        return { ok: false, error: `Pre-backup failed: ${err.message}` };
      }
    }

    try {
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(source, dest);

      // Store the version metadata in the release models dir
      const versionLabel = extractVersionLabel(path.basename(source));
      await setModelVersion(destDir, versionLabel);
    } catch (err) {
      return { ok: false, error: `Copy to release default failed: ${err.message}`, backup: backupPath };
    }
    return { ok: true, replaced: dest, backup: backupPath };
  });

  ipcMain.handle('train-restore-release-model', async (_e, opts) => {
    if (!opts || !opts.confirmed) return { ok: false, error: 'Not confirmed.' };
    const project = resolveProject(opts);
    let source = opts.backupPath;
    if (!source) {
      const bdir = releaseBackupsDir();
      if (await exists(bdir)) {
        const entries = (await fs.readdir(bdir)).filter((n) => n.endsWith('.bin'));
        let latest = null;
        for (const name of entries) {
          const full = path.join(bdir, name);
          const st = await fs.stat(full);
          if (!latest || st.mtimeMs > latest.mtime) {
            latest = { path: full, mtime: st.mtimeMs };
          }
        }
        if (latest) source = latest.path;
      }
    }

    if (!source) return { ok: false, error: 'No release backup found to restore.' };

    try {
      await validateModelFile(source);
    } catch (err) {
      return { ok: false, error: err.message };
    }

    const destDir = path.join(project, 'src', 'assets', 'models');
    const dest = path.join(destDir, 'ggml-small-q5_1.bin');

    let preBackup = null;
    if (await exists(dest)) {
      try {
        preBackup = await backupModelFile(dest, 'release');
      } catch (_) {}
    }

    try {
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(source, dest);

      // Store the restored version metadata
      const versionLabel = extractVersionLabel(path.basename(source));
      await setModelVersion(destDir, versionLabel);
    } catch (err) {
      return { ok: false, error: `Restore release default failed: ${err.message}` };
    }
    return { ok: true, restored: dest, from: source, backup: preBackup };
  });

  ipcMain.handle('train-backup-history-get', async () => {
    const backups = [];
    const scan = async (dir, type) => {
      if (!(await exists(dir))) return;
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.bin')) continue;
        const full = path.join(dir, file);
        const st = await fs.stat(full);
        backups.push({
          name: file,
          path: full,
          size: st.size,
          mtime: st.mtimeMs,
          type: type
        });
      }
    };

    await scan(localBackupsDir(), 'local');
    await scan(releaseBackupsDir(), 'release');

    backups.sort((a, b) => b.mtime - a.mtime);
    return backups;
  });

  ipcMain.handle('train-reveal-backup', async (_e, filePath) => {
    if (filePath && await exists(filePath)) {
      shell.showItemInFolder(filePath);
      return { ok: true };
    }
    return { ok: false, error: 'File does not exist.' };
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
