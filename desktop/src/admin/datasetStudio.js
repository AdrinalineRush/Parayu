// DEV-BUILD-ONLY dataset studio backend. Bundled solely by the dev build
// (electron-builder.dev.js); the public build excludes src/admin/** entirely, so
// none of this ships to users.
//
// Ported from the standalone "Parayu Dataset Studio" Electron app. It prepares
// local Whisper fine-tuning data: records/imports WAV clips, edits exact
// transcripts, writes data/metadata.csv (audio,text), validates clip quality,
// and backs the dataset up under output/backups. Everything stays on disk —
// nothing is uploaded. All IPC channels are namespaced `trainer-*`.

const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');
const { transcribe } = require('../whisper');

const WAV_EXTENSION = '.wav';
const SCANNED_AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.opus']);
const METADATA_HEADERS = ['file', 'text'];

function register({ ipcMain, app, dialog, shell, BrowserWindow }) {
  // Force parentWindow to null so file dialogs open as robust standalone windows, avoiding macOS sheet hangs
  const parentWindow = () => null;

  function defaultProjectDir() {
    return path.join(app.getPath('desktop'), 'parayu-whisper-training');
  }

  function metadataPath(projectDir) { return path.join(projectDir, 'data', 'metadata.csv'); }
  function audioDir(projectDir) { return path.join(projectDir, 'data', 'audio'); }
  function dataDir(projectDir) { return path.join(projectDir, 'data'); }
  function outputDir(projectDir) { return path.join(projectDir, 'output'); }

  async function exists(filePath) {
    try { await fs.access(filePath); return true; } catch { return false; }
  }

  async function ensureProject(projectDir) {
    await fs.mkdir(dataDir(projectDir), { recursive: true });
    await fs.mkdir(audioDir(projectDir), { recursive: true });
    await fs.mkdir(outputDir(projectDir), { recursive: true });

    const csvPath = metadataPath(projectDir);
    if (!(await exists(csvPath))) {
      const legacyCsvPath = path.join(projectDir, 'metadata.csv');
      if (await exists(legacyCsvPath)) {
        const legacyText = await fs.readFile(legacyCsvPath, 'utf8');
        const legacyMetadata = parseCsv(legacyText);
        await fs.writeFile(csvPath, stringifyCsv(normalizeRows(legacyMetadata)), 'utf8');
      } else {
        await fs.writeFile(csvPath, `${METADATA_HEADERS.join(',')}\n`, 'utf8');
      }
    }

    return scanProject(projectDir);
  }

  async function scanProject(projectDir) {
    const csvPath = metadataPath(projectDir);
    const targetAudioDir = audioDir(projectDir);
    const targetOutputDir = outputDir(projectDir);
    const metadataExists = await exists(csvPath);
    const audioDirExists = await exists(targetAudioDir);
    const outputDirExists = await exists(targetOutputDir);

    const audioFiles = [];
    if (audioDirExists) {
      const entries = await fs.readdir(targetAudioDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const extension = path.extname(entry.name).toLowerCase();
        if (!SCANNED_AUDIO_EXTENSIONS.has(extension)) continue;

        const absolutePath = path.join(targetAudioDir, entry.name);
        const stats = await fs.stat(absolutePath);
        const audioInfo = await inspectAudioFile(absolutePath);
        audioFiles.push({
          name: entry.name,
          path: absolutePath,
          relativePath: toPosix(path.relative(projectDir, absolutePath)),
          size: stats.size,
          modifiedAt: stats.mtimeMs,
          extension,
          ...audioInfo
        });
      }
    }

    audioFiles.sort((a, b) => a.name.localeCompare(b.name));

    let metadata = { headers: METADATA_HEADERS, rows: [] };
    if (metadataExists) {
      const text = await fs.readFile(csvPath, 'utf8');
      metadata = parseCsv(text);
    }

    return {
      projectDir,
      audioDir: targetAudioDir,
      metadataPath: csvPath,
      metadataExists,
      audioDirExists,
      outputDir: targetOutputDir,
      outputDirExists,
      audioCount: audioFiles.length,
      audioFiles,
      metadataRows: normalizeRows(metadata),
      validation: validateDataset(audioFiles, normalizeRows(metadata))
    };
  }

  function normalizeRows(metadata) {
    const rows = Array.isArray(metadata.rows) ? metadata.rows : [];
    return rows.map((row) => {
      let rawAudio = row.audio || row.file || row.audio_path || row.file_name || row.path || '';
      if (rawAudio && !rawAudio.startsWith('data/')) {
        rawAudio = 'data/' + rawAudio;
      }
      return {
        audio: rawAudio,
        file: rawAudio,
        text: row.text || row.transcript || row.sentence || row.label || ''
      };
    });
  }

  async function inspectAudioFile(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension !== WAV_EXTENSION) {
      return {
        isWav: false, isTrainingSafe: false, formatWarnings: ['Not WAV'],
        durationSeconds: null, sampleRate: null, channels: null, bitsPerSample: null, audioFormat: null
      };
    }

    try {
      const buffer = await fs.readFile(filePath);
      return inspectWavBuffer(buffer);
    } catch (error) {
      return {
        isWav: false, isTrainingSafe: false, formatWarnings: [`Could not read file: ${error.message}`],
        durationSeconds: null, sampleRate: null, channels: null, bitsPerSample: null, audioFormat: null
      };
    }
  }

  function inspectWavBuffer(buffer) {
    const invalid = {
      isWav: false, isTrainingSafe: false, formatWarnings: ['Invalid WAV'],
      durationSeconds: null, sampleRate: null, channels: null, bitsPerSample: null, audioFormat: null
    };

    if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      return invalid;
    }

    let offset = 12;
    let fmt = null;
    let dataSize = 0;

    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkStart = offset + 8;

      if (chunkStart + chunkSize > buffer.length) break;

      if (chunkId === 'fmt ' && chunkSize >= 16) {
        fmt = {
          audioFormat: buffer.readUInt16LE(chunkStart),
          channels: buffer.readUInt16LE(chunkStart + 2),
          sampleRate: buffer.readUInt32LE(chunkStart + 4),
          byteRate: buffer.readUInt32LE(chunkStart + 8),
          bitsPerSample: buffer.readUInt16LE(chunkStart + 14)
        };
      }

      if (chunkId === 'data') dataSize = chunkSize;

      offset = chunkStart + chunkSize + (chunkSize % 2);
    }

    if (!fmt || !dataSize) return invalid;

    const formatWarnings = [];
    if (fmt.audioFormat !== 1) formatWarnings.push('Not PCM');
    if (fmt.sampleRate !== 16000) formatWarnings.push(`${fmt.sampleRate} Hz`);
    if (fmt.channels !== 1) formatWarnings.push(`${fmt.channels} channels`);
    if (fmt.bitsPerSample !== 16) formatWarnings.push(`${fmt.bitsPerSample}-bit`);

    return {
      isWav: true,
      isTrainingSafe: formatWarnings.length === 0,
      formatWarnings,
      durationSeconds: fmt.byteRate ? dataSize / fmt.byteRate : null,
      sampleRate: fmt.sampleRate,
      channels: fmt.channels,
      bitsPerSample: fmt.bitsPerSample,
      audioFormat: fmt.audioFormat
    };
  }

  function validateDataset(audioFiles, rows) {
    const rowMap = new Map();
    rows.forEach((row) => {
      let key = row.file || row.audio || '';
      if (key.startsWith('data/')) key = key.substring(5);
      rowMap.set(key, row);
    });

    const missingTranscripts = [];
    const tooLong = [];
    const tooShort = [];
    const formatIssues = [];
    let totalDurationSeconds = 0;

    audioFiles.forEach((file) => {
      let fileKey = file.relativePath;
      if (fileKey.startsWith('data/')) fileKey = fileKey.substring(5);

      const row = rowMap.get(fileKey);
      if (!row || !row.text.trim()) missingTranscripts.push(file.relativePath);

      if (Number.isFinite(file.durationSeconds)) {
        totalDurationSeconds += file.durationSeconds;
        if (file.durationSeconds > 30) tooLong.push(file.relativePath);
        if (file.durationSeconds > 0 && file.durationSeconds < 5) tooShort.push(file.relativePath);
      }

      if (!file.isTrainingSafe) formatIssues.push({ audio: file.relativePath, warnings: file.formatWarnings });
    });

    return { totalClips: audioFiles.length, totalDurationSeconds, missingTranscripts, tooLong, tooShort, formatIssues };
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') { cell += '"'; i += 1; }
        else if (char === '"') inQuotes = false;
        else cell += char;
        continue;
      }

      if (char === '"') inQuotes = true;
      else if (char === ',') { row.push(cell); cell = ''; }
      else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (char !== '\r') cell += char;
    }

    if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }

    const nonEmptyRows = rows.filter((line) => line.some((value) => value.trim() !== ''));
    const headers = nonEmptyRows.shift() || METADATA_HEADERS;
    return {
      headers,
      rows: nonEmptyRows.map((line) => {
        const item = {};
        headers.forEach((header, index) => { item[header] = line[index] || ''; });
        return item;
      })
    };
  }

  function cleanCsvPath(p) {
    if (!p) return '';
    let val = p.split(path.sep).join('/');
    if (val.startsWith('data/')) {
      val = val.substring(5);
    }
    return val;
  }

  function stringifyCsv(rows) {
    const output = [METADATA_HEADERS.join(',')];
    rows.forEach((row) => {
      output.push(METADATA_HEADERS.map((header) => {
        let val = '';
        if (header === 'file') {
          val = row.file || row.audio || '';
          val = cleanCsvPath(val);
        } else {
          val = row[header] || '';
        }
        return escapeCsv(val);
      }).join(','));
    });
    return `${output.join('\n')}\n`;
  }

  function escapeCsv(value) {
    const text = String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  }

  function toPosix(filePath) { return filePath.split(path.sep).join('/'); }

  async function uniqueDestination(targetDir, fileName) {
    const parsed = path.parse(fileName);
    let candidate = path.join(targetDir, fileName);
    let counter = 1;
    while (await exists(candidate)) {
      candidate = path.join(targetDir, `${parsed.name}-${counter}${parsed.ext}`);
      counter += 1;
    }
    return candidate;
  }

  function safeRecordingName(name) {
    const stem = String(name || 'recording')
      .trim().toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72);
    const finalStem = stem || 'recording';
    return finalStem.endsWith('.wav') ? finalStem : `${finalStem}.wav`;
  }

  function timestampForPath() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  async function addMetadataRow(projectDir, relativePath, transcript = '') {
    const state = await ensureProject(projectDir);
    const rows = state.metadataRows;
    const matchPath = relativePath.startsWith('data/') ? relativePath.substring(5) : relativePath;
    if (!rows.some((row) => {
      const rowFile = row.file || row.audio || '';
      const normRowFile = rowFile.startsWith('data/') ? rowFile.substring(5) : rowFile;
      return normRowFile === matchPath;
    })) {
      rows.push({ file: relativePath, audio: relativePath, text: transcript });
      await fs.writeFile(metadataPath(projectDir), stringifyCsv(rows), 'utf8');
    }
  }

  // ─── IPC ────────────────────────────────────────────────────────────────
  ipcMain.handle('trainer-get-default-project', async () => defaultProjectDir());

  ipcMain.handle('trainer-choose-project-folder', async () => {
    const result = await dialog.showOpenDialog(parentWindow(), {
      title: 'Choose training project folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('trainer-ensure-project', async (_e, projectDir) => ensureProject(projectDir));
  ipcMain.handle('trainer-scan-project', async (_e, projectDir) => scanProject(projectDir));

  ipcMain.handle('trainer-choose-audio-files', async () => {
    const result = await dialog.showOpenDialog(parentWindow(), {
      title: 'Choose audio files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Training WAV', extensions: ['wav'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle('trainer-import-audio-files', async (_e, projectDir, filePaths) => {
    const state = await ensureProject(projectDir);
    const targetDir = state.audioDir;
    const currentRows = state.metadataRows;
    const currentPaths = new Set(currentRows.map((row) => {
      const p = row.file || row.audio || '';
      return p.startsWith('data/') ? p.substring(5) : p;
    }));
    const imported = [];
    const skipped = [];

    for (const sourcePath of filePaths) {
      const extension = path.extname(sourcePath).toLowerCase();
      if (extension !== WAV_EXTENSION) {
        skipped.push({ sourcePath, reason: 'Use WAV for Whisper fine-tuning data' });
        continue;
      }

      const destination = await uniqueDestination(targetDir, path.basename(sourcePath));
      if (path.resolve(sourcePath) !== path.resolve(destination)) {
        await fs.copyFile(sourcePath, destination);
      }

      const filename = path.basename(destination);
      const rowPath = `audio/${filename}`;
      imported.push({ sourcePath, destination, relativePath: rowPath });

      if (!currentPaths.has(rowPath)) {
        currentRows.push({ file: rowPath, audio: rowPath, text: '' });
        currentPaths.add(rowPath);
      }
    }

    await fs.writeFile(metadataPath(projectDir), stringifyCsv(currentRows), 'utf8');
    const nextState = await scanProject(projectDir);
    return { imported, skipped, state: nextState };
  });

  ipcMain.handle('trainer-save-recorded-audio', async (_e, projectDir, recording) => {
    await ensureProject(projectDir);

    const targetDir = audioDir(projectDir);
    const destination = await uniqueDestination(targetDir, safeRecordingName(recording.name));
    const audioBytes = Buffer.from(recording.audioBytes);
    await fs.writeFile(destination, audioBytes);

    const filename = path.basename(destination);
    const rowPath = `audio/${filename}`;
    await addMetadataRow(projectDir, rowPath, recording.transcript || '');

    return {
      file: {
        path: destination,
        relativePath: rowPath,
        name: filename,
        size: audioBytes.length,
        durationSeconds: recording.durationSeconds
      },
      state: await scanProject(projectDir)
    };
  });

  ipcMain.handle('trainer-save-metadata', async (_e, projectDir, rows) => {
    await ensureProject(projectDir);
    await fs.writeFile(metadataPath(projectDir), stringifyCsv(rows), 'utf8');
    return scanProject(projectDir);
  });

  ipcMain.handle('trainer-open-path', async (_e, targetPath) => {
    if (!(await exists(targetPath))) return false;
    await shell.openPath(targetPath);
    return true;
  });

  ipcMain.handle('trainer-show-in-folder', async (_e, targetPath) => {
    if (fss.existsSync(targetPath)) { shell.showItemInFolder(targetPath); return true; }
    return false;
  });

  ipcMain.handle('trainer-backup-dataset', async (_e, projectDir) => {
    await ensureProject(projectDir);
    const backupRoot = path.join(outputDir(projectDir), 'backups');
    const destination = path.join(backupRoot, `dataset-${timestampForPath()}`);
    await fs.mkdir(destination, { recursive: true });
    await fs.cp(dataDir(projectDir), path.join(destination, 'data'), { recursive: true });
    return { path: destination, state: await scanProject(projectDir) };
  });

  ipcMain.handle('trainer-delete-clip', async (_e, projectDir, audioRelativePath) => {
    const resolvedProjectDir = path.resolve(projectDir);
    let targetFilePath = path.resolve(resolvedProjectDir, audioRelativePath);
    if (!fss.existsSync(targetFilePath)) {
      const altPath = path.resolve(resolvedProjectDir, 'data', audioRelativePath);
      if (fss.existsSync(altPath)) {
        targetFilePath = altPath;
      }
    }

    // Safety check: ensure file path is strictly inside the project folder
    if (!targetFilePath.startsWith(resolvedProjectDir + path.sep)) {
      throw new Error(`Access Denied: Path traversal detected or path outside project directory.`);
    }

    // Read and edit metadata.csv safely
    const csvPath = metadataPath(resolvedProjectDir);
    if (!(await exists(csvPath))) {
      throw new Error(`Metadata file not found: ${csvPath}`);
    }

    const text = await fs.readFile(csvPath, 'utf8');
    const metadata = parseCsv(text);
    const normalized = normalizeRows(metadata);

    const initialLength = normalized.length;
    const filteredRows = normalized.filter((row) => {
      const p = row.file || row.audio || '';
      const normP = p.startsWith('data/') ? p.substring(5) : p;
      const normRelative = audioRelativePath.startsWith('data/') ? audioRelativePath.substring(5) : audioRelativePath;
      return normP !== normRelative;
    });

    if (filteredRows.length === initialLength) {
      throw new Error(`Clip ${audioRelativePath} not found in metadata.csv.`);
    }

    // Update metadata safely using write-temp-then-rename flow
    const tempCsvPath = `${csvPath}.tmp-${Date.now()}`;
    try {
      await fs.writeFile(tempCsvPath, stringifyCsv(filteredRows), 'utf8');
      await fs.rename(tempCsvPath, csvPath);
    } catch (writeError) {
      try { await fs.unlink(tempCsvPath); } catch {}
      throw new Error(`Failed to update metadata: ${writeError.message}`);
    }

    // Now delete the audio file if it exists
    let fileDeleted = false;
    const fileExists = await exists(targetFilePath);
    if (fileExists) {
      try {
        await fs.unlink(targetFilePath);
        fileDeleted = true;
      } catch (unlinkError) {
        throw new Error(`Metadata updated, but failed to delete audio file: ${unlinkError.message}`);
      }
    }

    return {
      success: true,
      fileDeleted,
      fileExisted: fileExists,
      state: await scanProject(resolvedProjectDir)
    };
  });

  ipcMain.handle('trainer-read-audio-file', async (_e, projectDir, audioRelativePath) => {
    const resolvedProjectDir = path.resolve(projectDir);
    let targetFilePath = path.resolve(resolvedProjectDir, audioRelativePath);
    if (!fss.existsSync(targetFilePath)) {
      const altPath = path.resolve(resolvedProjectDir, 'data', audioRelativePath);
      if (fss.existsSync(altPath)) {
        targetFilePath = altPath;
      }
    }

    // Safety check: ensure file path is strictly inside the project folder
    if (!targetFilePath.startsWith(resolvedProjectDir + path.sep)) {
      throw new Error(`Access Denied: Path traversal detected or path outside project directory.`);
    }

    if (!(await exists(targetFilePath))) {
      throw new Error(`Audio file not found: ${targetFilePath}`);
    }

    const buffer = await fs.readFile(targetFilePath);
    return buffer;
  });

  // ─── Dataset Studio 7-Step Workflow IPC ───────────────────────────────────

  function pythonPath(projectDir) {
    const venv = path.join(projectDir, '.venv', 'bin', 'python');
    return fss.existsSync(venv) ? venv : 'python3';
  }

  // Electron apps launched from Finder/Dock (not a terminal) inherit a
  // minimal PATH that's missing Homebrew's bin dirs — `yt-dlp`/`ffmpeg` can be
  // installed and working in a terminal yet invisible to every exec() call
  // here unless we explicitly extend PATH with where Homebrew actually puts
  // binaries on both Apple Silicon and Intel Macs.
  function shellEnv() {
    const extra = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin'];
    const current = (process.env.PATH || '').split(':').filter(Boolean);
    const merged = [...new Set([...current, ...extra])].join(':');
    return { ...process.env, PATH: merged };
  }

  // Helper to check if a command is in system PATH. ffmpeg only accepts the
  // single-dash "-version" (and exits nonzero on "--version"); most other
  // CLIs (yt-dlp included) are the reverse — only "--version" works. A single
  // hardcoded flag silently fails the check for whichever tool doesn't match
  // it, so callers must pass the flag their tool actually supports.
  function isCommandAvailable(cmd, versionFlag = '-version') {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec(`${cmd} ${versionFlag}`, { env: shellEnv() }, (err) => {
        resolve(!err);
      });
    });
  }

  function compressToMp3(inputWavPath, outputMp3Path) {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${inputWavPath}" -codec:a libmp3lame -b:a 48k -ac 1 "${outputMp3Path}"`,
        { env: shellEnv() },
        (err, stdout, stderr) => {
          if (err) {
            reject(new Error(`Failed to compress audio to MP3: ${stderr || err.message}`));
            return;
          }
          resolve(outputMp3Path);
        }
      );
    });
  }

  // Helper to get media duration
  function getMediaDuration(filePath, isVideo) {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      if (isVideo) {
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { env: shellEnv() }, (err, stdout) => {
          if (err) {
            reject(new Error("Video extraction requires ffmpeg. Please install ffmpeg to continue."));
          } else {
            resolve(parseFloat(stdout.trim()) || 0);
          }
        });
      } else {
        // For audio, try ffprobe first, then native macOS afinfo
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { env: shellEnv() }, (err, stdout) => {
          if (!err && stdout.trim()) {
            resolve(parseFloat(stdout.trim()) || 0);
          } else {
            // afinfo fallback
            exec(`/usr/bin/afinfo "${filePath}"`, (err2, stdout2) => {
              if (!err2) {
                const match = stdout2.match(/Duration:\s*([\d.]+)\s*sec/);
                if (match) {
                  resolve(parseFloat(match[1]) || 0);
                  return;
                }
              }
              resolve(0); // fallback
            });
          }
        });
      }
    });
  }

  // Downloads audio straight from a YouTube URL into the same imports/ folder
  // the manual file picker uses, then hands off to the existing extract-audio
  // step unchanged — avoids needing testers to separately download and
  // re-import a video just to get it into the pipeline.
  ipcMain.handle('trainer-workflow-import-youtube', async (event, projectDir, url) => {
    const importsDir = path.join(projectDir, 'imports');
    await fs.mkdir(importsDir, { recursive: true });

    if (!(await isCommandAvailable('yt-dlp', '--version'))) {
      throw new Error('yt-dlp is not installed. Install it with "brew install yt-dlp" and try again.');
    }
    if (!(await isCommandAvailable('ffmpeg'))) {
      throw new Error('YouTube audio extraction requires ffmpeg. Please install ffmpeg to continue.');
    }

    const outTemplate = path.join(importsDir, '%(id)s.%(ext)s');
    const args = [
      '--no-playlist', '-f', 'bestaudio', '--extract-audio', '--audio-format', 'wav',
      // --newline forces one progress update per line instead of overwriting
      // a single line with carriage returns, so it can actually be parsed
      // from a Node stream instead of only ever seeing the final result.
      // --progress is the actual fix for "no progress shows at all": yt-dlp
      // detects it isn't attached to a real terminal (true for anything an
      // Electron main process spawns) and silently suppresses every
      // [download] line by default in that case — no parsing bug, it simply
      // never wrote them. This forces it to emit them regardless.
      '--newline', '--progress', '-o', outTemplate, '--print', 'after_move:filepath', url
    ];

    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const child = spawn('yt-dlp', args, { env: shellEnv() });
      let stdout = '';
      let stderr = '';
      let lastPct = -1;

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // Matching only the latest chunk misses most updates: Node delivers
        // child-process output in arbitrary byte chunks, not line-aligned, so
        // a "[download]  45.2%" line regularly gets split across two 'data'
        // events and the regex on just the new chunk fails silently. Search
        // the full accumulated buffer instead and take the last match.
        const matches = stdout.match(/\[download\]\s+([\d.]+)%/g);
        if (matches && matches.length) {
          const lastMatch = matches[matches.length - 1].match(/([\d.]+)%/);
          const pct = Math.round(parseFloat(lastMatch[1]));
          if (pct !== lastPct && !event.sender.isDestroyed()) {
            lastPct = pct;
            event.sender.send('trainer-import-progress', pct);
          }
        }
      });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp failed: ${stderr.trim() || 'exit code ' + code}`));
          return;
        }
        try {
          const lines = stdout.trim().split('\n').filter(Boolean);
          const destination = lines[lines.length - 1].trim();
          if (!destination || !fss.existsSync(destination)) {
            reject(new Error('yt-dlp did not report a downloaded file path.'));
            return;
          }
          const filename = path.basename(destination);
          const stats = await fs.stat(destination);
          let duration = 0;
          try { duration = await getMediaDuration(destination, false); } catch (_e) { /* best-effort */ }
          if (!event.sender.isDestroyed()) {
            event.sender.send('trainer-import-progress', 100);
          }
          resolve({
            filename,
            size: stats.size,
            duration,
            path: toPosix(path.relative(projectDir, destination)),
            absolutePath: destination,
            isVideo: false
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  });

  ipcMain.handle('trainer-workflow-import', async (_e, projectDir) => {
    console.log('[DatasetStudio Main] trainer-workflow-import called with projectDir:', projectDir);
    const importsDir = path.join(projectDir, 'imports');
    try {
      await fs.mkdir(importsDir, { recursive: true });
      console.log('[DatasetStudio Main] imports directory prepared:', importsDir);
    } catch (err) {
      console.error('[DatasetStudio Main] failed to create imports directory:', err);
      throw err;
    }

    console.log('[DatasetStudio Main] showing showOpenDialog...');
    try {
      const result = await dialog.showOpenDialog(parentWindow(), {
        title: 'Select Video or Audio File',
        properties: ['openFile'],
        filters: [
          { name: 'Media Files', extensions: ['mp4', 'mov', 'mkv', 'm4a', 'mp3', 'wav', 'aiff', 'caf'] },
          { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv'] },
          { name: 'Audio Files', extensions: ['m4a', 'mp3', 'wav', 'aiff', 'caf'] }
        ]
      });
      console.log('[DatasetStudio Main] showOpenDialog returned:', JSON.stringify(result));

      if (result.canceled || result.filePaths.length === 0) {
        console.log('[DatasetStudio Main] user cancelled selection.');
        return null;
      }

      const sourcePath = result.filePaths[0];
      const filename = path.basename(sourcePath);
      const destination = path.join(importsDir, filename);

      console.log(`[DatasetStudio Main] copying file from ${sourcePath} to ${destination}...`);
      await fs.copyFile(sourcePath, destination);
      console.log('[DatasetStudio Main] copy complete.');

      const stats = await fs.stat(destination);
      const extension = path.extname(filename).toLowerCase();
      const isVideo = ['.mp4', '.mov', '.mkv'].includes(extension);

      console.log(`[DatasetStudio Main] getting media duration for ${destination} (isVideo: ${isVideo})...`);
      let duration = 0;
      try {
        duration = await getMediaDuration(destination, isVideo);
        console.log('[DatasetStudio Main] duration obtained:', duration);
      } catch (e) {
        console.error('[DatasetStudio Main] failed to check media duration, deleting file...', e);
        try { await fs.unlink(destination); } catch {}
        throw e;
      }

      const returnObj = {
        filename,
        size: stats.size,
        duration,
        path: toPosix(path.relative(projectDir, destination)),
        absolutePath: destination,
        isVideo
      };
      console.log('[DatasetStudio Main] returning:', JSON.stringify(returnObj));
      return returnObj;
    } catch (err) {
      console.error('[DatasetStudio Main] exception in trainer-workflow-import:', err);
      throw err;
    }
  });

  ipcMain.handle('trainer-workflow-extract-audio', async (event, projectDir, relativeImportPath) => {
    const absoluteImportPath = path.resolve(projectDir, relativeImportPath);
    const rawAudioDir = path.join(projectDir, 'raw-audio');
    await fs.mkdir(rawAudioDir, { recursive: true });
    const outputWav = path.join(rawAudioDir, 'extracted.wav');

    // Safety checks
    if (!absoluteImportPath.startsWith(path.resolve(projectDir) + path.sep)) {
      throw new Error("Access Denied: Path traversal detected.");
    }

    const extension = path.extname(absoluteImportPath).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.mkv'].includes(extension);

    const ffmpegAvailable = await isCommandAvailable('ffmpeg');

    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      let pct = 0;
      const progressTimer = setInterval(() => {
        pct = Math.min(pct + Math.random() * 20, 95);
        if (!event.sender.isDestroyed()) {
          event.sender.send('trainer-extract-progress', Math.round(pct));
        }
      }, 150);

      const cleanup = (cb) => {
        clearInterval(progressTimer);
        if (!event.sender.isDestroyed()) {
          event.sender.send('trainer-extract-progress', 100);
        }
        cb();
      };

      if (isVideo) {
        if (!ffmpegAvailable) {
          cleanup(() => reject(new Error("Video extraction requires ffmpeg. Please install ffmpeg to continue.")));
          return;
        }

        // Run ffmpeg
        exec(`ffmpeg -y -i "${absoluteImportPath}" -ac 1 -ar 16000 -c:a pcm_s16le "${outputWav}"`, { env: shellEnv() }, (err, stdout, stderr) => {
          if (err) {
            cleanup(() => reject(new Error(`ffmpeg extraction failed: ${stderr || err.message}`)));
          } else {
            cleanup(() => resolve({ path: toPosix(path.relative(projectDir, outputWav)) }));
          }
        });
      } else {
        // Audio fallback
        if (ffmpegAvailable) {
          exec(`ffmpeg -y -i "${absoluteImportPath}" -ac 1 -ar 16000 -c:a pcm_s16le "${outputWav}"`, { env: shellEnv() }, (err) => {
            if (err) {
              // fallback to afconvert
              exec(`/usr/bin/afconvert -f WAVE -d LEI16@16000 -c 1 "${absoluteImportPath}" "${outputWav}"`, (err2) => {
                if (err2) {
                  cleanup(() => reject(new Error("Audio conversion failed: afconvert error.")));
                } else {
                  cleanup(() => resolve({ path: toPosix(path.relative(projectDir, outputWav)) }));
                }
              });
            } else {
              cleanup(() => resolve({ path: toPosix(path.relative(projectDir, outputWav)) }));
            }
          });
        } else {
          // Use afconvert directly
          exec(`/usr/bin/afconvert -f WAVE -d LEI16@16000 -c 1 "${absoluteImportPath}" "${outputWav}"`, (err) => {
            if (err) {
              cleanup(() => reject(new Error("Audio conversion failed: afconvert error.")));
            } else {
              cleanup(() => resolve({ path: toPosix(path.relative(projectDir, outputWav)) }));
            }
          });
        }
      }
    });
  });

  ipcMain.handle('trainer-workflow-split-clips', async (event, projectDir, relativeExtractedPath, opts) => {
    const absoluteExtractedPath = path.resolve(projectDir, relativeExtractedPath);
    const bulkClipsDir = path.join(projectDir, 'bulk-clips');
    await fs.mkdir(bulkClipsDir, { recursive: true });

    // Safety check
    if (!absoluteExtractedPath.startsWith(path.resolve(projectDir) + path.sep)) {
      throw new Error("Access Denied: Path traversal detected.");
    }

    const { clipLength = 20, skipSilence = false } = opts;
    const splitScriptPath = path.join(projectDir, 'scripts', 'split_audio.py');

    // Ensure scripts folder exists
    const scriptsDest = path.join(projectDir, 'scripts');
    await fs.mkdir(scriptsDest, { recursive: true });
    
    // Copy the split_audio.py to scripts folder
    const splitSrc = path.join(__dirname, 'training-scripts', 'split_audio.py');
    const content = await fs.readFile(splitSrc, 'utf8');
    await fs.writeFile(splitScriptPath, content, 'utf8');

    const python = pythonPath(projectDir);

    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const args = [
        splitScriptPath,
        '--input', absoluteExtractedPath,
        '--output-dir', bulkClipsDir,
        '--seconds', String(clipLength),
        '--threshold', '100'
      ];
      if (skipSilence) args.push('--skip-silence');

      const child = spawn(python, args);
      let outputText = '';
      // Splitting each raw chunk by '\n' independently both misses progress
      // lines that straddle a chunk boundary, and drops the newline when
      // reconstructing outputText (so non-progress lines could end up
      // concatenated together with no separator). Buffer until a full line
      // is available before acting on it.
      let lineBuffer = '';

      child.stdout.on('data', (data) => {
        lineBuffer += data.toString();
        let idx;
        while ((idx = lineBuffer.indexOf('\n')) !== -1) {
          const line = lineBuffer.slice(0, idx);
          lineBuffer = lineBuffer.slice(idx + 1);
          if (line.startsWith('__PROGRESS__')) {
            const pct = parseInt(line.replace('__PROGRESS__', '').trim(), 10) || 0;
            if (!event.sender.isDestroyed()) {
              event.sender.send('trainer-split-progress', pct);
            }
          } else if (line.trim()) {
            outputText += line + '\n';
          }
        }
      });

      child.stderr.on('data', (data) => {
        console.error(`split_audio.py stderr: ${data}`);
      });

      child.on('close', async (code) => {
        // Flush whatever's left in the buffer — the final JSON result line
        // often has no trailing newline, so it never gets moved into
        // outputText inside the 'data' handler above.
        if (lineBuffer.trim() && !lineBuffer.startsWith('__PROGRESS__')) {
          outputText += lineBuffer + '\n';
        }
        lineBuffer = '';

        if (code !== 0) {
          reject(new Error(`split_audio.py failed with code ${code}`));
          return;
        }

        try {
          const lines = outputText.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            if (!event.sender.isDestroyed()) {
              event.sender.send('trainer-split-progress', 100);
            }
            const draftsDir = path.join(projectDir, 'dataset-drafts');
            await fs.mkdir(draftsDir, { recursive: true });
            const timingsPath = path.join(draftsDir, 'clip-timings.json');
            await fs.writeFile(timingsPath, JSON.stringify(result.clips || [], null, 2), 'utf8');

            resolve({ success: true, count: result.count });
          }
        } catch (e) {
          reject(new Error(`Failed to parse split_audio.py output: ${e.message}`));
        }
      });
    });
  });

  // Cuts the extracted audio at the exact same timestamps as a set of
  // (already-grouped) transcript windows, instead of running split_audio.py's
  // independent silence-detection pass. The two cut at different signals
  // (audio RMS vs caption phrase boundaries) and can drift apart in count and
  // exact timing even when both individually avoid mid-word cuts — drift that
  // only shows up once a developer notices a clip/transcript pair is off by
  // one further into the dataset. Sharing one timeline (the captions, which
  // already carry verified phrase boundaries) removes the drift entirely.
  ipcMain.handle('trainer-workflow-split-clips-at-times', async (event, projectDir, relativeExtractedPath, windows) => {
    const absoluteExtractedPath = path.resolve(projectDir, relativeExtractedPath);
    if (!absoluteExtractedPath.startsWith(path.resolve(projectDir) + path.sep)) {
      throw new Error("Access Denied: Path traversal detected.");
    }
    const bulkClipsDir = path.join(projectDir, 'bulk-clips');
    await fs.mkdir(bulkClipsDir, { recursive: true });

    const existing = await fs.readdir(bulkClipsDir);
    await Promise.all(
      existing.filter((f) => /^clip_\d+\.wav$/.test(f)).map((f) => fs.unlink(path.join(bulkClipsDir, f)).catch(() => {}))
    );

    if (!(await isCommandAvailable('ffmpeg'))) {
      throw new Error('Splitting at exact timestamps requires ffmpeg.');
    }

    const { exec } = require('child_process');
    let count = 0;
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i] || {};
      const startSec = Math.max(0, Number(w.start || 0) / 1000);
      // Same 30s hard cap as split_audio.py — Whisper truncates past that anyway.
      const durSec = Math.min(30, Math.max(0.5, (Number(w.end || 0) - Number(w.start || 0)) / 1000));
      const outPath = path.join(bulkClipsDir, `clip_${String(i + 1).padStart(4, '0')}.wav`);

      await new Promise((resolve, reject) => {
        exec(
          `ffmpeg -y -ss ${startSec} -t ${durSec} -i "${absoluteExtractedPath}" -ac 1 -ar 16000 -c:a pcm_s16le "${outPath}"`,
          { env: shellEnv() },
          (err, stdout, stderr) => {
            if (err) {
              reject(new Error(`ffmpeg failed for clip ${i + 1}: ${stderr || err.message}`));
              return;
            }
            resolve();
          }
        );
      });

      count += 1;
      if (!event.sender.isDestroyed()) {
        event.sender.send('trainer-split-progress', Math.round((count / windows.length) * 100));
      }
    }

    const draftsDir = path.join(projectDir, 'dataset-drafts');
    await fs.mkdir(draftsDir, { recursive: true });
    const timingsPath = path.join(draftsDir, 'clip-timings.json');
    const clips = windows.map((w, i) => ({
      filename: `clip_${String(i + 1).padStart(4, '0')}.wav`,
      start: Math.max(0, Number(w.start || 0) / 1000),
      end: Math.max(0.5, Number(w.end || 0) / 1000)
    }));
    await fs.writeFile(timingsPath, JSON.stringify(clips, null, 2), 'utf8');

    return { success: true, count };
  });

  ipcMain.handle('trainer-workflow-generate-drafts', async (event, projectDir) => {
    const bulkClipsDir = path.join(projectDir, 'bulk-clips');
    const draftsDir = path.join(projectDir, 'dataset-drafts');
    await fs.mkdir(draftsDir, { recursive: true });
    const draftsPath = path.join(draftsDir, 'draft-transcripts.json');
    const timingsPath = path.join(draftsDir, 'clip-timings.json');

    // Read existing drafts to preserve accepted/rejected states
    let drafts = [];
    if (await exists(draftsPath)) {
      try {
        const content = await fs.readFile(draftsPath, 'utf8');
        drafts = JSON.parse(content);
      } catch (e) {
        drafts = [];
      }
    }

    const draftsMap = new Map(drafts.map(d => [d.clip_path, d]));

    // Read timings
    let timingsMap = new Map();
    if (await exists(timingsPath)) {
      try {
        const content = await fs.readFile(timingsPath, 'utf8');
        const timings = JSON.parse(content);
        for (const t of timings) {
          timingsMap.set(t.filename, t);
        }
      } catch (e) {}
    }

    const entries = await fs.readdir(bulkClipsDir, { withFileTypes: true });
    const wavFiles = entries
      .filter(entry => entry.isFile() && entry.name.startsWith('clip_') && entry.name.endsWith('.wav'))
      .map(entry => entry.name)
      .sort();

    const total = wavFiles.length;
    const finalDrafts = [];

    for (let i = 0; i < total; i++) {
      const filename = wavFiles[i];
      const relativeClipPath = `bulk-clips/${filename}`;
      const absoluteClipPath = path.join(bulkClipsDir, filename);

      if (!event.sender.isDestroyed()) {
        event.sender.send('trainer-draft-progress', { current: i + 1, total, clipName: filename });
      }

      // Check if we can reuse an existing draft
      const existing = draftsMap.get(relativeClipPath);
      if (existing) {
        const timing = timingsMap.get(filename);
        if (timing) {
          if (existing.start === undefined) existing.start = timing.start;
          if (existing.end === undefined) existing.end = timing.end;
        }
        finalDrafts.push(existing);
        continue;
      }

      // Real AI draft via the local production model is bypassed to load
      // empty textboxes instantly for Groq/YouTube-based workflows.
      try {
        const fileBuffer = await fs.readFile(absoluteClipPath);
        const wavInfo = inspectWavBuffer(fileBuffer);
        const duration = wavInfo.durationSeconds || 0;

        const timing = timingsMap.get(filename);
        const newDraft = {
          clip_path: relativeClipPath,
          draft_transcript: '',
          duration,
          status: 'pending',
          start: timing ? timing.start : 0,
          end: timing ? timing.end : duration
        };

        finalDrafts.push(newDraft);

        // Save immediately to preserve progress
        await fs.writeFile(draftsPath, JSON.stringify(finalDrafts, null, 2), 'utf8');
      } catch (e) {
        console.error(`Failed to prepare clip ${filename}:`, e);
        const timing = timingsMap.get(filename);
        finalDrafts.push({
          clip_path: relativeClipPath,
          draft_transcript: '',
          duration: 0,
          status: 'pending',
          start: timing ? timing.start : 0,
          end: timing ? timing.end : 0
        });
        await fs.writeFile(draftsPath, JSON.stringify(finalDrafts, null, 2), 'utf8');
      }
    }

    return finalDrafts;
  });

  // Third independent opinion on a clip, via Groq's free-tier hosted
  // whisper-large-v3 — a meaningfully stronger Whisper than the small model
  // being fine-tuned, and the /translations endpoint always outputs English
  // regardless of input language, matching the ml->en task here. Used to
  // sanity-check a clip's transcript against something other than YouTube's
  // captions or this project's own local model. Never auto-applied — the
  // caller decides whether to use it.
  ipcMain.handle('trainer-groq-check', async (_e, projectDir, clipRelativePath, apiKey) => {
    if (!apiKey) return { ok: false, error: 'No Groq API key provided.' };
    const absolutePath = path.resolve(projectDir, clipRelativePath);
    if (!absolutePath.startsWith(path.resolve(projectDir) + path.sep)) {
      return { ok: false, error: 'Access Denied: Path traversal detected.' };
    }
    if (!(await exists(absolutePath))) return { ok: false, error: 'Clip file not found.' };

    try {
      const fileBuffer = await fs.readFile(absolutePath);
      const form = new FormData();
      form.append('file', new Blob([fileBuffer], { type: 'audio/wav' }), path.basename(absolutePath));
      form.append('model', 'whisper-large-v3');

      const response = await fetch('https://api.groq.com/openai/v1/audio/translations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form
      });

      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, error: `Groq API error ${response.status}: ${errText.slice(0, 300)}` };
      }
      const data = await response.json();
      return { ok: true, text: (data.text || '').trim() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('trainer-groq-batch-check', async (_e, projectDir, apiKey, drafts) => {
    if (!apiKey) return { ok: false, error: 'No Groq API key provided.' };
    const extractedWav = path.join(projectDir, 'raw-audio', 'extracted.wav');
    if (!(await exists(extractedWav))) return { ok: false, error: 'extracted.wav not found.' };

    const tempMp3 = path.join(projectDir, 'raw-audio', 'extracted_groq_temp.mp3');
    let useTempFile = false;

    try {
      const stats = await fs.stat(extractedWav);
      let fileToUpload = extractedWav;
      let filenameToUpload = 'extracted.wav';
      let mimeType = 'audio/wav';

      if (await isCommandAvailable('ffmpeg')) {
        try {
          await compressToMp3(extractedWav, tempMp3);
          if (await exists(tempMp3)) {
            fileToUpload = tempMp3;
            filenameToUpload = 'extracted.mp3';
            mimeType = 'audio/mp3';
            useTempFile = true;
          }
        } catch (compressErr) {
          console.error('[Groq Batch] MP3 compression failed, falling back to WAV:', compressErr);
        }
      }

      if (!useTempFile && stats.size > 25 * 1024 * 1024) {
        return {
          ok: false,
          error: `extracted.wav exceeds Groq's 25MB limit (${(stats.size / (1024 * 1024)).toFixed(1)}MB) and ffmpeg is not available to compress it. Please install ffmpeg or crop the video.`
        };
      }

      const fileBuffer = await fs.readFile(fileToUpload);
      const form = new FormData();
      form.append('file', new Blob([fileBuffer], { type: mimeType }), filenameToUpload);
      form.append('model', 'whisper-large-v3');
      form.append('response_format', 'verbose_json');

      const response = await fetch('https://api.groq.com/openai/v1/audio/translations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form
      });

      if (useTempFile) {
        await fs.unlink(tempMp3).catch(() => {});
      }

      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, error: `Groq API error ${response.status}: ${errText.slice(0, 300)}` };
      }

      const data = await response.json();
      const segments = data.segments || [];

      // Map Groq segments to each draft clip based on overlap/midpoint alignment
      const results = {};
      for (const d of drafts) {
        const dStart = d.start !== undefined ? d.start : 0;
        const dEnd = d.end !== undefined ? d.end : (dStart + (d.duration || 0));

        const matched = [];
        for (const seg of segments) {
          const segStart = seg.start || 0;
          const segEnd = seg.end || 0;
          const segCenter = (segStart + segEnd) / 2;

          if (segCenter >= dStart && segCenter <= dEnd) {
            matched.push(seg.text);
          }
        }
        results[d.clip_path] = matched.join(' ').replace(/\s+/g, ' ').trim();
      }

      return { ok: true, results };
    } catch (err) {
      if (useTempFile) {
        await fs.unlink(tempMp3).catch(() => {});
      }
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('trainer-workflow-load-drafts', async (_e, projectDir) => {
    const draftsPath = path.join(projectDir, 'dataset-drafts', 'draft-transcripts.json');
    if (!(await exists(draftsPath))) return [];
    const content = await fs.readFile(draftsPath, 'utf8');
    const drafts = JSON.parse(content);

    // Backward compatibility: add start/end if missing
    const timingsPath = path.join(projectDir, 'dataset-drafts', 'clip-timings.json');
    if (await exists(timingsPath)) {
      try {
        const timingsContent = await fs.readFile(timingsPath, 'utf8');
        const timings = JSON.parse(timingsContent);
        const timingsMap = new Map(timings.map(t => [t.filename, t]));
        for (const d of drafts) {
          const filename = path.basename(d.clip_path);
          const timing = timingsMap.get(filename);
          if (timing) {
            if (d.start === undefined) d.start = timing.start;
            if (d.end === undefined) d.end = timing.end;
          }
        }
      } catch (e) {}
    }
    return drafts;
  });

  ipcMain.handle('trainer-workflow-save-drafts', async (_e, projectDir, drafts) => {
    const draftsPath = path.join(projectDir, 'dataset-drafts', 'draft-transcripts.json');
    await fs.writeFile(draftsPath, JSON.stringify(drafts, null, 2), 'utf8');
    return true;
  });

  ipcMain.handle('trainer-workflow-build-dataset', async (event, projectDir, drafts) => {
    const dataAudioDir = path.join(projectDir, 'data', 'audio');
    await fs.mkdir(dataAudioDir, { recursive: true });

    // Clean data/audio folder first
    const existing = await fs.readdir(dataAudioDir, { withFileTypes: true });
    for (const entry of existing) {
      if (entry.isFile()) {
        await fs.unlink(path.join(dataAudioDir, entry.name));
      }
    }

    const acceptedDrafts = drafts.filter(d => d.status === 'accepted');
    const total = acceptedDrafts.length;
    const csvRows = [];

    for (let i = 0; i < total; i++) {
      const draft = acceptedDrafts[i];
      const filename = path.basename(draft.clip_path);
      const sourceWav = path.join(projectDir, draft.clip_path);
      const destWav = path.join(dataAudioDir, filename);

      // Copy clip wav
      await fs.copyFile(sourceWav, destWav);

      // Create CSV rows with EXACTLY file,text headers and audio/clip_XXXX.wav paths
      csvRows.push({
        file: `audio/${filename}`,
        text: draft.draft_transcript
      });

      if (!event.sender.isDestroyed()) {
        event.sender.send('trainer-build-progress', { current: i + 1, total });
      }
    }

    // Write metadata.csv with EXACTLY file,text headers
    const csvContent = ['file,text'];
    for (const row of csvRows) {
      csvContent.push(`${escapeCsv(row.file)},${escapeCsv(row.text)}`);
    }
    const csvPath = path.join(projectDir, 'data', 'metadata.csv');
    await fs.writeFile(csvPath, csvContent.join('\n') + '\n', 'utf8');

    return { success: true, count: total };
  });

  ipcMain.handle('trainer-workflow-read-clip-file', async (_e, projectDir, audioRelativePath) => {
    const resolvedProjectDir = path.resolve(projectDir);
    let targetFilePath = path.resolve(resolvedProjectDir, audioRelativePath);
    if (!fss.existsSync(targetFilePath)) {
      const altPath = path.resolve(resolvedProjectDir, 'data', audioRelativePath);
      if (fss.existsSync(altPath)) {
        targetFilePath = altPath;
      }
    }

    // Safety check: ensure file path is strictly inside the project's folder
    if (!targetFilePath.startsWith(resolvedProjectDir + path.sep)) {
      throw new Error("Access Denied: Path traversal detected.");
    }

    // Ensure it's under bulk-clips or data/audio
    const bulkClipsDir = path.join(resolvedProjectDir, 'bulk-clips');
    const dataAudioDir = path.join(resolvedProjectDir, 'data', 'audio');
    if (!targetFilePath.startsWith(bulkClipsDir + path.sep) && !targetFilePath.startsWith(dataAudioDir + path.sep)) {
      throw new Error("Access Denied: File must be in bulk-clips or data/audio.");
    }

    if (!(await exists(targetFilePath))) {
      throw new Error(`Audio file not found: ${targetFilePath}`);
    }

    const buffer = await fs.readFile(targetFilePath);
    return buffer;
  });

  ipcMain.handle('trainer-workflow-get-state', async (_e, projectDir) => {
    console.log('[DatasetStudio Main] trainer-workflow-get-state scanning projectDir:', projectDir);
    const resolvedProjectDir = path.resolve(projectDir);
    const state = {
      imported: null,
      extracted: null,
      clipCount: 0,
      drafts: [],
      step: 1
    };

    try {
      // 1. Check imports directory
      const importsDir = path.join(resolvedProjectDir, 'imports');
      if (await exists(importsDir)) {
        const files = await fs.readdir(importsDir);
        const mediaFile = files.find(f => !f.startsWith('.'));
        if (mediaFile) {
          const filePath = path.join(importsDir, mediaFile);
          const stats = await fs.stat(filePath);
          const extension = path.extname(mediaFile).toLowerCase();
          const isVideo = ['.mp4', '.mov', '.mkv'].includes(extension);
          let duration = 0;
          try {
            duration = await getMediaDuration(filePath, isVideo);
          } catch (_) {}
          state.imported = {
            filename: mediaFile,
            size: stats.size,
            duration,
            path: toPosix(path.relative(resolvedProjectDir, filePath)),
            absolutePath: filePath,
            isVideo
          };
          state.step = 2; // imported, next step is extract
          console.log('[DatasetStudio Main] workflow state: detected import:', mediaFile);
        }
      }

      // 2. Check extracted WAV
      const extractedWav = path.join(resolvedProjectDir, 'raw-audio', 'extracted.wav');
      if (await exists(extractedWav)) {
        state.extracted = {
          path: 'raw-audio/extracted.wav'
        };
        state.step = 3; // extracted, next step is split
        console.log('[DatasetStudio Main] workflow state: detected extracted.wav');
      }

      // 3. Check bulk clips
      const bulkClipsDir = path.join(resolvedProjectDir, 'bulk-clips');
      if (await exists(bulkClipsDir)) {
        const files = await fs.readdir(bulkClipsDir);
        const clips = files.filter(f => f.endsWith('.wav') && !f.startsWith('.'));
        state.clipCount = clips.length;
        if (state.clipCount > 0) {
          state.step = 4; // split clips exist, next step is transcribe
          console.log('[DatasetStudio Main] workflow state: detected clip count:', state.clipCount);
        }
      }

      // 4. Check drafts
      const draftsPath = path.join(resolvedProjectDir, 'dataset-drafts', 'draft-transcripts.json');
      if (await exists(draftsPath)) {
        const content = await fs.readFile(draftsPath, 'utf8');
        state.drafts = JSON.parse(content);
        if (state.drafts.length > 0) {
          state.step = 5; // drafts exist, next step is review & correct
          console.log('[DatasetStudio Main] workflow state: detected drafts count:', state.drafts.length);
        }
      }
    } catch (err) {
      console.error('[DatasetStudio Main] failed to scan workflow state:', err);
    }

    return state;
  });

  ipcMain.handle('trainer-workflow-clear', async (_e, projectDir) => {
    console.log('[DatasetStudio Main] trainer-workflow-clear called for projectDir:', projectDir);
    const resolvedProjectDir = path.resolve(projectDir);
    
    // Delete drafts file
    const draftsPath = path.join(resolvedProjectDir, 'dataset-drafts', 'draft-transcripts.json');
    if (await exists(draftsPath)) {
      try {
        await fs.unlink(draftsPath);
        console.log('[DatasetStudio Main] deleted drafts file:', draftsPath);
      } catch (err) {
        console.error('[DatasetStudio Main] failed to delete drafts file:', err);
      }
    }
    
    // Delete raw audio file
    const rawAudio = path.join(resolvedProjectDir, 'raw-audio', 'extracted.wav');
    if (await exists(rawAudio)) {
      try {
        await fs.unlink(rawAudio);
        console.log('[DatasetStudio Main] deleted raw audio:', rawAudio);
      } catch (err) {
        console.error('[DatasetStudio Main] failed to delete raw audio:', err);
      }
    }

    // Delete bulk-clips folder
    const bulkClipsDir = path.join(resolvedProjectDir, 'bulk-clips');
    if (await exists(bulkClipsDir)) {
      try {
        await fs.rm(bulkClipsDir, { recursive: true, force: true });
        console.log('[DatasetStudio Main] deleted bulk-clips folder:', bulkClipsDir);
      } catch (err) {
        console.error('[DatasetStudio Main] failed to delete bulk-clips folder:', err);
      }
    }

    // Delete imports folder
    const importsDir = path.join(resolvedProjectDir, 'imports');
    if (await exists(importsDir)) {
      try {
        await fs.rm(importsDir, { recursive: true, force: true });
        console.log('[DatasetStudio Main] deleted imports folder:', importsDir);
      } catch (err) {
        console.error('[DatasetStudio Main] failed to delete imports folder:', err);
      }
    }

    return true;
  });

  // ─── Native YouTube Transcript Fetch & Translate logic ───
  function parseVideoId(value = '') {
    const trimmed = String(value).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed);
      if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '').slice(0, 11);
      const watchId = url.searchParams.get('v');
      if (watchId) return watchId.slice(0, 11);
      const match = url.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    } catch {
      return '';
    }
    return '';
  }

  function formatTime(ms = 0) {
    const total = Math.max(0, Math.floor(Number(ms) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const base = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return hours ? `${String(hours).padStart(2, '0')}:${base}` : base;
  }

  function cleanText(text = '') {
    return String(text)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectLanguage(text = '') {
    if (/[ഀ-ൿ]/.test(text)) return 'ml';
    if (/[ऀ-ॿ]/.test(text)) return 'hi';
    if (/[஀-௿]/.test(text)) return 'ta';
    if (/[ఀ-౿]/.test(text)) return 'te';
    if (/[ಀ-]/.test(text)) return 'kn';
    if (/[؀-ۿ]/.test(text)) return 'ar';
    return 'en';
  }

  function groupTranscript(transcript = [], seconds = 30) {
    // Bin on a fixed clock grid (floor(offset / windowMs)) instead of natural
    // phrase boundaries cuts a window mid-sentence whenever a caption straddles
    // the grid line, then pairs that half-sentence with an audio clip that was
    // independently snapped to a silence gap elsewhere — the two no longer
    // agree on where the cut is. Caption rows already mark real phrase
    // boundaries (no need for audio silence detection here), so we accumulate
    // rows sequentially and only close a window at a row boundary, once
    // they'd exceed the target window length — never splitting a row, and
    // never exceeding `seconds` regardless of how rows happen to fall.
    const windowMs = Math.max(1, Number(seconds) || 30) * 1000;
    const ordered = transcript
      .slice()
      .sort((a, b) => Number(a.offset || 0) - Number(b.offset || 0));

    const groups = [];
    let current = null;

    ordered.forEach((item) => {
      const offset = Number(item.offset || 0);
      const duration = Number(item.duration || 0);
      const rowEnd = offset + duration;

      if (current && (rowEnd - current.start) > windowMs && current.sourceText.length > 0) {
        groups.push(current);
        current = null;
      }
      if (!current) {
        current = {
          time: formatTime(offset),
          start: offset,
          end: rowEnd,
          sourceText: [],
          sourceLang: item.lang || 'auto'
        };
      }
      current.sourceText.push(item.text);
      current.end = rowEnd;
    });
    if (current) groups.push(current);

    return groups.map((group) => ({
      ...group,
      sourceText: cleanText(group.sourceText.join(' '))
    }));
  }

  function splitForTranslation(text = '', maxLength = 360) {
    const clean = cleanText(text);
    if (clean.length <= maxLength) return [clean].filter(Boolean);
    const words = clean.split(/\s+/);
    const chunks = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxLength && current) {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  async function translateShortText(text, target = 'en', source = 'auto') {
    const clean = cleanText(text).slice(0, 900);
    if (!clean) return '';
    const detectedSource = source === 'auto' ? detectLanguage(clean) : source;
    if (detectedSource === target) return clean;
    try {
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        detectedSource
      )}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(clean)}`;
      const googleResponse = await fetch(googleUrl, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
        }
      });
      if (googleResponse.ok) {
        const data = await googleResponse.json();
        const translated = data?.[0]?.map((part) => part?.[0] || '').join('');
        if (translated) return translated;
      }
    } catch (e) {
      console.error('Google translation failed:', e);
    }
    
    // MyMemory fallback
    const langPair = `${detectedSource}|${target}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=${encodeURIComponent(
      langPair
    )}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.responseData?.translatedText || clean;
    } catch {
      return clean;
    }
  }

  async function translateText(text, target = 'en', source = 'auto') {
    const chunks = splitForTranslation(text);
    if (chunks.length <= 1) return translateShortText(chunks[0] || '', target, source);
    const translated = new Array(chunks.length);
    let cursor = 0;
    async function worker() {
      while (cursor < chunks.length) {
        const index = cursor;
        cursor += 1;
        translated[index] = await translateShortText(chunks[index], target, source);
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, () => worker()));
    return translated.join(' ');
  }

  async function translateTranscriptWindows(transcript, target = 'en', seconds = 30) {
    const groups = groupTranscript(transcript, seconds);
    const translated = new Array(groups.length);
    let cursor = 0;
    async function worker() {
      while (cursor < groups.length) {
        const index = cursor;
        cursor += 1;
        const group = groups[index];
        translated[index] = {
          time: group.time,
          start: group.start,
          end: group.end,
          sourceLang: group.sourceLang,
          sourceText: group.sourceText,
          text: await translateText(group.sourceText, target, group.sourceLang || 'auto')
        };
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, groups.length) }, () => worker()));
    return translated;
  }

  function extractJson(html, key) {
    const idx = html.indexOf(key);
    if (idx === -1) return null;
    const startIdx = html.indexOf('{', idx);
    if (startIdx === -1) return null;
    
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < html.length; i++) {
      const char = html[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            return html.slice(startIdx, i + 1);
          }
        }
      }
    }
    return null;
  }

  async function fetchYoutubeTranscript(videoId) {
    const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
    const INNERTUBE_CLIENT_VERSION = '20.10.38';
    const INNERTUBE_CONTEXT = {
      client: {
        clientName: 'ANDROID',
        clientVersion: INNERTUBE_CLIENT_VERSION,
      },
    };
    const INNERTUBE_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;

    console.log(`[DatasetStudio Main] fetching player response from InnerTube for video ID: ${videoId}`);
    const response = await fetch(INNERTUBE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': INNERTUBE_USER_AGENT,
      },
      body: JSON.stringify({
        context: INNERTUBE_CONTEXT,
        videoId: videoId,
      }),
    });

    if (!response.ok) {
      throw new Error(`YouTube player request failed with HTTP status ${response.status}.`);
    }

    const data = await response.json();
    const captions = data?.captions?.playerCaptionsTracklistRenderer;
    if (!captions || !captions.captionTracks || captions.captionTracks.length === 0) {
      throw new Error('This video does not have any caption tracks.');
    }

    // Find Malayalam (ml) or fallback to first track
    let track = captions.captionTracks.find(t => t.languageCode === 'ml') || captions.captionTracks[0];
    
    // Explicitly set or overwrite the fmt parameter to json3 using URL object
    let jsonUrl = track.baseUrl;
    try {
      const urlObj = new URL(track.baseUrl);
      urlObj.searchParams.set('fmt', 'json3');
      jsonUrl = urlObj.toString();
    } catch (e) {
      jsonUrl = track.baseUrl + '&fmt=json3';
    }
    
    console.log(`[DatasetStudio Main] fetching captions JSON from: ${jsonUrl}`);
    const jsonResponse = await fetch(jsonUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
      }
    });
    
    if (!jsonResponse.ok) {
      throw new Error(`YouTube captions request failed with HTTP status ${jsonResponse.status}.`);
    }
    
    const responseText = await jsonResponse.text();
    const rows = [];
    
    // Decode HTML entities helper
    const decodeHtml = (str) => {
      return String(str || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#x27;/g, "'");
    };

    if (responseText.trim().startsWith('<')) {
      // Parse XML format (YouTube's default fmt fallback)
      const regex = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
      let match;
      while ((match = regex.exec(responseText)) !== null) {
        const startSecs = parseFloat(match[1]) || 0;
        const durSecs = parseFloat(match[2]) || 0;
        const rawText = match[3];
        const decodedText = decodeHtml(rawText);
        
        rows.push({
          time: formatTime(startSecs * 1000),
          offset: startSecs * 1000,
          duration: durSecs * 1000,
          text: cleanText(decodedText),
          lang: track.languageCode || ''
        });
      }
    } else {
      // Parse JSON (fmt=json3)
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Failed to parse YouTube transcript response (Invalid JSON/XML).');
      }
      
      if (data.events) {
        for (const event of data.events) {
          if (!event.segs || event.segs.length === 0) continue;
          const text = event.segs.map(s => s.utf8).join('').trim();
          if (!text) continue;
          
          rows.push({
            time: formatTime(event.tStartMs || 0),
            offset: event.tStartMs || 0,
            duration: event.dDurationMs || 0,
            text: cleanText(decodeHtml(text)),
            lang: track.languageCode || ''
          });
        }
      }
    }
    
    if (rows.length === 0) {
      throw new Error('Could not extract any caption text blocks. The video captions may be empty or failed to load.');
    }
    
    return { videoId, track, transcript: rows };
  }

  ipcMain.handle('trainer-workflow-youtube-transcript', async (_e, url, seconds) => {
    try {
      const id = parseVideoId(url);
      if (!id) throw new Error('Invalid YouTube URL or Video ID.');
      
      const { videoId, track, transcript } = await fetchYoutubeTranscript(id);
      const windows = await translateTranscriptWindows(transcript, 'en', seconds);
      
      return {
        ok: true,
        video: {
          id: videoId,
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
          language: track.languageCode || 'auto'
        },
        seconds,
        transcript: windows
      };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });
}

module.exports = { register };
