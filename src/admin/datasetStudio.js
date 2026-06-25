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

const WAV_EXTENSION = '.wav';
const SCANNED_AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.opus']);
const METADATA_HEADERS = ['audio', 'text'];

function register({ ipcMain, app, dialog, shell, BrowserWindow }) {
  const parentWindow = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;

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
    return rows.map((row) => ({
      audio: row.audio || row.audio_path || row.file || row.file_name || row.path || '',
      text: row.text || row.transcript || row.sentence || row.label || ''
    }));
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
    const rowMap = new Map(rows.map((row) => [row.audio, row]));
    const missingTranscripts = [];
    const tooLong = [];
    const tooShort = [];
    const formatIssues = [];
    let totalDurationSeconds = 0;

    audioFiles.forEach((file) => {
      const row = rowMap.get(file.relativePath);
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

  function stringifyCsv(rows) {
    const output = [METADATA_HEADERS.join(',')];
    rows.forEach((row) => {
      output.push(METADATA_HEADERS.map((header) => escapeCsv(row[header] || '')).join(','));
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
    if (!rows.some((row) => row.audio === relativePath)) {
      rows.push({ audio: relativePath, text: transcript });
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
    const currentPaths = new Set(currentRows.map((row) => row.audio));
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

      const relativePath = toPosix(path.relative(projectDir, destination));
      imported.push({ sourcePath, destination, relativePath });

      if (!currentPaths.has(relativePath)) {
        currentRows.push({ audio: relativePath, text: '' });
        currentPaths.add(relativePath);
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

    const relativePath = toPosix(path.relative(projectDir, destination));
    await addMetadataRow(projectDir, relativePath, recording.transcript || '');

    return {
      file: {
        path: destination,
        relativePath,
        name: path.basename(destination),
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
    const resolvedAudioDir = path.resolve(resolvedProjectDir, 'data', 'audio');
    const targetFilePath = path.resolve(resolvedProjectDir, audioRelativePath);

    // Safety check: ensure file path is strictly inside the project's data/audio folder
    if (!targetFilePath.startsWith(resolvedAudioDir + path.sep)) {
      throw new Error(`Access Denied: Path traversal detected or path outside audio directory.`);
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
    const filteredRows = normalized.filter((row) => row.audio !== audioRelativePath);

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
    const resolvedAudioDir = path.resolve(resolvedProjectDir, 'data', 'audio');
    const targetFilePath = path.resolve(resolvedProjectDir, audioRelativePath);

    // Safety check: ensure file path is strictly inside the project's data/audio folder
    if (!targetFilePath.startsWith(resolvedAudioDir + path.sep)) {
      throw new Error(`Access Denied: Path traversal detected or path outside audio directory.`);
    }

    if (!(await exists(targetFilePath))) {
      throw new Error(`Audio file not found: ${targetFilePath}`);
    }

    const buffer = await fs.readFile(targetFilePath);
    return buffer;
  });
}

module.exports = { register };
