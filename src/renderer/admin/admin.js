// DEV-BUILD-ONLY admin panel UI: the Parayu Dataset Studio. Loaded by app.js's
// maybeLoadAdmin() solely when state.flavor === 'dev'; the public build excludes
// this whole folder, so none of it ships to users.
//
// It prepares LOCAL Whisper fine-tuning data: record/import WAV clips (16 kHz,
// mono, 16-bit PCM), play them back, type exact transcripts, validate quality,
// and write data/metadata.csv — all on disk, nothing uploaded. The recorder is
// fully independent of the main app's dictation pipeline (its own getUserMedia /
// AudioContext), so using it never transcribes or pastes. While this page is the
// focused view, push-to-talk starts/stops the clip recorder (routed from main as
// 'trainer-toggle-recording'); dictation stays suppressed.
(function () {
  const api = window.trainerAPI;
  if (!api) return; // bridge missing -> not a dev build; bail silently.

  const TARGET_SAMPLE_RATE = 16000;
  const MAX_RECORD_SECONDS = 30;
  const MIN_RECORD_SECONDS = 5;

  // Module-scoped state survives Parayu's re-renders; the DOM is rebuilt each
  // time the view is shown, so element refs are re-grabbed in wire().
  const S = {
    projectDir: '',
    scan: null,
    rows: [],
    dirty: false,
    loaded: false,
    recorder: {
      isRecording: false,
      audioContext: null,
      source: null,
      processor: null,
      stream: null,
      chunks: [],
      inputSampleRate: 0,
      startedAt: 0,
      timerId: null,
      preview: null,
      previewUrl: null,
      meterLevel: 0
    }
  };

  let el = {};
  const root = () => document.querySelector('.ds-studio');

  // Training-panel state (survives re-renders) + a rolling log buffer that the
  // streamed 'train-log' lines append to.
  const T = { running: false, validationPassed: false, validation: null, lastTest: null, lastTestBase: null, lastTestTrained: null, testScope: 'random3', model: null, env: null, tools: null, trained: false };
  const MIN_TRAIN_CLIPS = 10;
  const logBuffer = [];
  let progressTimerId = null;
  let progressStartTimestamp = null;
  function appendLog(line) {
    logBuffer.push(line);
    if (logBuffer.length > 4000) logBuffer.shift();
    if (el.trainLog) {
      el.trainLog.textContent += (el.trainLog.textContent ? '\n' : '') + line;
      el.trainLog.scrollTop = el.trainLog.scrollHeight;
    }
  }
  if (api.onTrainLog) api.onTrainLog(appendLog);

  function onProgressUpdate(progress) {
    if (!el.progressBarFill || !el.progressPercent || !el.progressStage || !el.progressCard) return;
    const percent = Math.min(Math.max(Number(progress.percent) || 0, 0), 100);
    el.progressBarFill.style.width = `${percent}%`;
    el.progressPercent.textContent = `${percent}%`;
    let stageText = progress.stage || '';
    if (progress.step !== undefined && progress.total_steps !== undefined) {
      stageText = `${progress.stage || ''} · Step ${progress.step}/${progress.total_steps}`;
      if (progress.loss !== undefined) {
        stageText += ` · Loss ${progress.loss.toFixed ? progress.loss.toFixed(4) : progress.loss}`;
      }
      if (progress.eta_seconds !== undefined) {
        const etaFormatted = formatElapsedTime(progress.eta_seconds * 1000);
        stageText += ` · ETA: ${etaFormatted}`;
      }
    }
    el.progressStage.textContent = stageText;
  }
  if (api.onTrainProgress) api.onTrainProgress(onProgressUpdate);

  // ─── Formatting helpers ────────────────────────────────────────────────────
  function setIcon(name) {
    const s = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">${p}</svg>`;
    const icons = {
      globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
      keyboard: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
      mic: '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/>',
      ai: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
      book: '<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M19 17H6a2 2 0 0 0-2 2"/>',
      refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
      record: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
      chevron: '<polyline points="6 9 12 15 18 9"/>',
      bulb: '<path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 2z"/>',
      brain: '<path d="M9.5 3A3 3 0 0 0 7 7.5a3 3 0 0 0-1 5.8V16a3 3 0 0 0 3.5 3 2.5 2.5 0 0 0 5 0A3 3 0 0 0 18 16v-2.7a3 3 0 0 0-1-5.8A3 3 0 0 0 14.5 3a2.5 2.5 0 0 0-5 0z"/><path d="M12 3v18"/>',
      download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
      folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
      database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
      play: '<polygon points="5 3 19 12 5 21 5 3"/>',
      terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
      trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'
    };
    return icons[name] ? s(icons[name]) : '';
  }

  function setMessage(message, tone = 'muted') {
    if (!el.importMessage) return;
    el.importMessage.textContent = message;
    el.importMessage.dataset.tone = tone;
  }

  function computeSimilarity(str1, str2) {
    const norm = (s) => String(s || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();
    const n1 = norm(str1).split(' ').filter(Boolean);
    const n2 = norm(str2).split(' ').filter(Boolean);
    if (!n1.length && !n2.length) return 100;
    if (!n1.length || !n2.length) return 0;

    const track = Array(n2.length + 1).fill(null).map(() => Array(n1.length + 1).fill(null));
    for (let i = 0; i <= n1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= n2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= n2.length; j += 1) {
      for (let i = 1; i <= n1.length; i += 1) {
        const indicator = n1[i - 1] === n2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    const distance = track[n2.length][n1.length];
    const maxLen = Math.max(n1.length, n2.length);
    return Math.max(0, Math.round(((maxLen - distance) / maxLen) * 100));
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remaining}`;
  }

  function formatTimer(seconds) {
    const bounded = Math.max(0, seconds);
    const minutes = Math.floor(bounded / 60);
    const wholeSeconds = Math.floor(bounded % 60).toString().padStart(2, '0');
    const tenth = Math.floor((bounded % 1) * 10);
    return `${minutes}:${wholeSeconds}.${tenth}`;
  }

  function formatElapsedTime(ms) {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }

  function startProgress(actionName) {
    if (progressTimerId) clearInterval(progressTimerId);
    progressStartTimestamp = Date.now();
    if (el.progressCard) {
      el.progressCard.style.display = 'flex';
      el.progressCard.className = 'dt-progress-card';
    }
    if (el.progressAction) el.progressAction.textContent = actionName;
    if (el.progressPercent) el.progressPercent.textContent = '0%';
    if (el.progressBarFill) el.progressBarFill.style.width = '0%';
    if (el.progressStage) el.progressStage.textContent = 'Starting...';
    if (el.progressElapsed) el.progressElapsed.textContent = 'Elapsed: 00:00:00';
    if (el.progressCancel) el.progressCancel.style.display = 'inline-block';
    setLogExpanded(false);
    progressTimerId = setInterval(() => {
      if (!progressStartTimestamp) return;
      const elapsed = Date.now() - progressStartTimestamp;
      if (el.progressElapsed) el.progressElapsed.textContent = 'Elapsed: ' + formatElapsedTime(elapsed);
    }, 1000);
  }

  function endProgress(status, errorMsg = '') {
    if (progressTimerId) {
      clearInterval(progressTimerId);
      progressTimerId = null;
    }
    if (el.progressCancel) el.progressCancel.style.display = 'none';
    if (status === 'success') {
      if (el.progressBarFill) el.progressBarFill.style.width = '100%';
      if (el.progressPercent) el.progressPercent.textContent = '100%';
      if (el.progressStage) el.progressStage.textContent = 'Complete';
      if (el.progressCard) el.progressCard.classList.add('success');
    } else if (status === 'failed') {
      if (el.progressStage) el.progressStage.textContent = 'Failed: ' + (errorMsg || 'Unknown error');
      if (el.progressCard) el.progressCard.classList.add('failed');
    } else if (status === 'cancelled') {
      if (el.progressPercent) el.progressPercent.textContent = 'Cancelled';
      if (el.progressStage) el.progressStage.textContent = 'Cancelled';
      if (el.progressCard) el.progressCard.classList.add('cancelled');
    }
  }

  function setStatus(element, ready, label) {
    if (!element) return;
    element.classList.toggle('ready', ready);
    element.classList.toggle('waiting', !ready);
    element.querySelector('span:last-child').textContent = label;
  }

  function nextClipName() {
    const count = (S.scan?.audioFiles?.length || 0) + 1;
    return `clip_${String(count).padStart(4, '0')}.wav`;
  }

  function syncRowsWithAudioFiles() {
    if (!S.scan) return;
    const knownPaths = new Set(S.rows.map((row) => row.audio));
    S.scan.audioFiles.forEach((file) => {
      if (!knownPaths.has(file.relativePath)) {
        S.rows.push({ audio: file.relativePath, text: '' });
        knownPaths.add(file.relativePath);
        S.dirty = true;
      }
    });
  }

  // ─── In-place UI update (does NOT trigger Parayu's full render) ─────────────
  function updateUI() {
    if (!el.projectPath) return;
    el.projectPath.textContent = S.projectDir;

    if (!S.scan) {
      setStatus(el.metadataStatus, false, 'data/metadata.csv');
      setStatus(el.audioFolderStatus, false, 'data/audio');
      setStatus(el.audioCountStatus, false, '0 clips');
      return;
    }

    syncRowsWithAudioFiles();

    const validation = S.scan.validation;
    setStatus(el.metadataStatus, S.scan.metadataExists, 'data/metadata.csv');
    setStatus(el.audioFolderStatus, S.scan.audioDirExists, 'data/audio');
    setStatus(el.audioCountStatus, validation.totalClips > 0, `${validation.totalClips} clip${validation.totalClips === 1 ? '' : 's'}`);

    if (!S.recorder.isRecording && !S.recorder.preview) {
      el.recordFileName.value = el.recordFileName.value || nextClipName();
    }

    renderStats();
    renderValidation();
    renderMetadataRows();
    renderMetadataPreview();
  }

  function renderStats() {
    const validation = S.scan?.validation || {};
    el.totalClips.textContent = validation.totalClips || 0;
    el.totalDuration.textContent = formatDuration(validation.totalDurationSeconds || 0);
    el.missingTranscripts.textContent = validation.missingTranscripts?.length || 0;
  }

  function renderValidation() {
    const validation = S.scan?.validation;
    if (!validation) {
      el.validationList.innerHTML = '<li class="muted-row">Prepare the project to begin validation.</li>';
      return;
    }

    const items = [];
    if (validation.formatIssues.length > 0) {
      items.push(`${validation.formatIssues.length} file${validation.formatIssues.length === 1 ? '' : 's'} are not WAV 16 kHz mono 16-bit PCM.`);
      validation.formatIssues.slice(0, 3).forEach((issue) => items.push(`${issue.audio}: ${issue.warnings.join(', ')}`));
    }
    if (validation.tooLong.length > 0) {
      items.push(`${validation.tooLong.length} clip${validation.tooLong.length === 1 ? '' : 's'} exceed 30 seconds.`);
      validation.tooLong.slice(0, 3).forEach((audio) => items.push(`${audio}: longer than 30 seconds`));
    }
    if (validation.tooShort.length > 0) {
      items.push(`${validation.tooShort.length} clip${validation.tooShort.length === 1 ? '' : 's'} are shorter than 5 seconds.`);
    }
    if (validation.missingTranscripts.length > 0) {
      items.push(`${validation.missingTranscripts.length} clip${validation.missingTranscripts.length === 1 ? '' : 's'} need exact transcripts.`);
    }

    if (items.length === 0) {
      const clipsCount = validation.totalClips || 0;
      if (clipsCount === 0) {
        el.validationList.innerHTML = `<li class="success-row">Dataset is empty. Add ${MIN_TRAIN_CLIPS} valid clips to unlock LoRA training. Current: 0/${MIN_TRAIN_CLIPS}.</li>`;
      } else if (clipsCount < MIN_TRAIN_CLIPS) {
        const needed = MIN_TRAIN_CLIPS - clipsCount;
        el.validationList.innerHTML = `<li class="success-row">Dataset format is valid. Add ${needed} more valid clip${needed === 1 ? '' : 's'} to unlock LoRA training. Current: ${clipsCount}/${MIN_TRAIN_CLIPS}.</li>`;
      } else {
        el.validationList.innerHTML = '<li class="success-row">Ready for LoRA training.</li>';
      }
      return;
    }

    el.validationList.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      el.validationList.append(li);
    });
  }

  function describeFormat(file) {
    if (!file.isWav) return 'Not WAV';
    return `${file.sampleRate || '?'} Hz, ${file.channels || '?'} ch, ${file.bitsPerSample || '?'}-bit`;
  }

  function renderMetadataRows() {
    if (S.rows.length === 0) {
      el.metadataRows.innerHTML = '<tr><td colspan="4" class="empty-row">No clips yet.</td></tr>';
      return;
    }

    const fileMap = new Map((S.scan?.audioFiles || []).map((file) => [file.relativePath, file]));
    el.metadataRows.innerHTML = '';

    S.rows.forEach((row, index) => {
      const file = fileMap.get(row.audio);
      const tableRow = document.createElement('tr');

      const pathCell = document.createElement('td');
      pathCell.className = 'mono path-cell';
      pathCell.style.padding = '8px 12px';
      
      const pathText = document.createElement('div');
      pathText.textContent = row.audio;
      pathCell.append(pathText);

      if (file) {
        const metaText = document.createElement('div');
        metaText.style.fontSize = '9.5px';
        metaText.style.color = 'var(--muted)';
        metaText.style.marginTop = '2px';
        metaText.textContent = `${formatDuration(file.durationSeconds)} | ${formatBytes(file.size)}`;
        pathCell.append(metaText);
      }

      const transcriptCell = document.createElement('td');
      const input = document.createElement('input');
      input.className = 'transcript-input';
      input.value = row.text;
      input.placeholder = 'Exact transcript';
      input.addEventListener('input', () => {
        S.rows[index].text = input.value;
        S.dirty = true;
        renderMetadataPreview();
      });
      transcriptCell.append(input);

      const formatCell = document.createElement('td');
      formatCell.className = 'format-cell';
      formatCell.textContent = file ? describeFormat(file) : 'Missing';
      formatCell.dataset.ok = file?.isTrainingSafe ? 'true' : 'false';

      // Actions Column
      const actionsCell = document.createElement('td');
      actionsCell.style.textAlign = 'right';
      actionsCell.style.paddingRight = '16px';
      actionsCell.style.whiteSpace = 'nowrap';

      const btnContainer = document.createElement('div');
      btnContainer.style.display = 'inline-flex';
      btnContainer.style.gap = '6px';
      btnContainer.style.alignItems = 'center';
      btnContainer.style.justifyContent = 'flex-end';

      // 1. Play Button
      if (file) {
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'ds-action-btn play-btn';
        playBtn.title = 'Play audio clip';
        playBtn.innerHTML = setIcon('play');
        playBtn.addEventListener('click', async () => {
          try {
            const bytes = await api.readAudioFile(S.projectDir, row.audio);
            setPlayback(bytes);
            if (el.playback) {
              el.playback.play().catch(err => {
                console.error('Playback error:', err);
              });
            }
          } catch (error) {
            setMessage(`Failed to play clip: ${error.message}`, 'warning');
          }
        });
        btnContainer.append(playBtn);
      }

      // 2. Reveal in Finder Button
      if (file) {
        const revealBtn = document.createElement('button');
        revealBtn.type = 'button';
        revealBtn.className = 'ds-action-btn reveal-btn';
        revealBtn.title = 'Reveal file in Finder';
        revealBtn.innerHTML = setIcon('folder');
        revealBtn.addEventListener('click', () => {
          api.showInFolder(file.path);
        });
        btnContainer.append(revealBtn);
      }

      // 3. Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ds-action-btn delete-btn';
      deleteBtn.title = 'Delete clip';
      deleteBtn.innerHTML = setIcon('trash');
      deleteBtn.addEventListener('click', async () => {
        const confirmed = confirm(
          `Delete this clip permanently?\nThis will remove the WAV file and its metadata.csv row.`
        );
        if (!confirmed) return;

        try {
          const res = await api.deleteClip(S.projectDir, row.audio);
          if (res.success) {
            setMessage(`${row.audio.split('/').pop()} deleted and metadata updated.`, 'success');
            // Update state
            S.scan = res.state;
            S.rows = S.scan.metadataRows;
            S.dirty = false;
            updateUI();
            refreshEnv();
            // Re-run validation automatically
            doValidate();
          }
        } catch (error) {
          setMessage(`Deletion failed: ${error.message}`, 'warning');
          alert(`Deletion failed: ${error.message}`);
        }
      });
      btnContainer.append(deleteBtn);

      actionsCell.append(btnContainer);

      tableRow.append(pathCell, transcriptCell, formatCell, actionsCell);
      el.metadataRows.append(tableRow);
    });
  }

  function renderMetadataPreview() {
    const previewRows = S.rows.slice(0, 8);
    const lines = ['audio,text'];
    previewRows.forEach((row) => lines.push(`${row.audio},${escapeCsvPreview(row.text)}`));
    if (S.rows.length > previewRows.length) {
      const extra = S.rows.length - previewRows.length;
      lines.push(`... ${extra} more row${extra === 1 ? '' : 's'}`);
    }
    el.metadataPreview.textContent = lines.join('\n');
  }

  function escapeCsvPreview(value) {
    const text = String(value || '');
    return `"${text.replaceAll('"', '""')}"`;
  }

  // ─── Project data ──────────────────────────────────────────────────────────
  async function refreshProject() {
    try {
      S.scan = await api.scanProject(S.projectDir);
      S.rows = S.scan.metadataRows;
      S.dirty = false;
      updateUI();
      refreshEnv();
    } catch {
      S.scan = null;
      S.rows = [];
      updateUI();
    }
  }

  async function prepareProject() {
    S.scan = await api.ensureProject(S.projectDir);
    S.rows = S.scan.metadataRows;
    S.dirty = false;
    setMessage('Dataset folders are ready.', 'success');
    updateUI();
    refreshEnv();
  }

  async function importAudioFiles(filePaths) {
    if (!filePaths.length) return;
    const result = await api.importAudioFiles(S.projectDir, filePaths);
    S.scan = result.state;
    S.rows = S.scan.metadataRows;
    S.dirty = false;

    const importedCount = result.imported.length;
    const skippedCount = result.skipped.length;
    if (importedCount > 0 && skippedCount === 0) {
      setMessage(`Imported ${importedCount} WAV file${importedCount === 1 ? '' : 's'}.`, 'success');
    } else if (importedCount > 0) {
      setMessage(`Imported ${importedCount}; skipped ${skippedCount} non-WAV file${skippedCount === 1 ? '' : 's'}.`, 'warning');
    } else {
      setMessage('No WAV files were imported.', 'warning');
    }
    updateUI();
    refreshEnv();
  }

  async function saveMetadata() {
    S.scan = await api.saveMetadata(S.projectDir, S.rows);
    S.rows = S.scan.metadataRows;
    S.dirty = false;
    setMessage('data/metadata.csv saved.', 'success');
    updateUI();
    refreshEnv();
  }

  async function backupDataset() {
    if (S.dirty) await saveMetadata();
    const result = await api.backupDataset(S.projectDir);
    S.scan = result.state;
    setMessage(`Backup saved: ${result.path}`, 'success');
    updateUI();
    refreshEnv();
  }

  // ─── Recorder (independent of the main dictation pipeline) ──────────────────
  async function startRecording() {
    if (S.recorder.isRecording) return;
    try {
      await prepareProject();
      resetPreview();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      S.recorder.chunks = [];
      S.recorder.inputSampleRate = audioContext.sampleRate;
      S.recorder.startedAt = performance.now();
      S.recorder.isRecording = true;
      S.recorder.audioContext = audioContext;
      S.recorder.source = source;
      S.recorder.processor = processor;
      S.recorder.stream = stream;

      processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        const copy = new Float32Array(channel.length);
        copy.set(channel);
        S.recorder.chunks.push(copy);
        updateMeter(copy);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      if (el.startRec) el.startRec.disabled = true;
      if (el.stopRec) el.stopRec.disabled = false;
      if (el.saveRec) el.saveRec.disabled = true;
      if (el.discardRec) el.discardRec.disabled = true;
      if (el.recordStatus) el.recordStatus.textContent = 'Recording';
      if (el.recordMessage) el.recordMessage.textContent = 'Speak naturally. Recording will stop at 30 seconds.';
      if (el.startRec) el.startRec.classList.add('recording');

      S.recorder.timerId = setInterval(updateRecordingTimer, 100);
    } catch (error) {
      clearInterval(S.recorder.timerId);
      disconnectRecorder();
      S.recorder.isRecording = false;
      if (el.startRec) { el.startRec.disabled = false; el.startRec.classList.remove('recording'); }
      if (el.stopRec) el.stopRec.disabled = true;
      if (el.recordStatus) el.recordStatus.textContent = 'Microphone unavailable';
      if (el.recordMessage) el.recordMessage.textContent = 'Allow microphone access in macOS settings, then try again.';
      setMessage(`Recording could not start: ${error.message}`, 'warning');
    }
  }

  async function stopRecording() {
    if (!S.recorder.isRecording) return;

    S.recorder.isRecording = false;
    clearInterval(S.recorder.timerId);
    disconnectRecorder();

    const rawSamples = concatenateFloat32(S.recorder.chunks);
    const resampled = resampleLinear(rawSamples, S.recorder.inputSampleRate, TARGET_SAMPLE_RATE);
    const trimmed = trimEdgeSilence(resampled, TARGET_SAMPLE_RATE);
    const wavBuffer = encodeWav16(trimmed, TARGET_SAMPLE_RATE);
    const durationSeconds = trimmed.length / TARGET_SAMPLE_RATE;
    const bytes = new Uint8Array(wavBuffer);

    S.recorder.preview = { bytes, durationSeconds, size: bytes.byteLength };
    setPlayback(bytes);

    if (el.recordTimer) el.recordTimer.textContent = formatTimer(durationSeconds);
    if (el.recordStatus) el.recordStatus.textContent = 'Recording ready';
    if (el.recordMessage) el.recordMessage.textContent = recordingQualityMessage(durationSeconds, bytes.byteLength);
    if (el.startRec) { el.startRec.disabled = false; el.startRec.classList.remove('recording'); }
    if (el.stopRec) el.stopRec.disabled = true;
    if (el.saveRec) el.saveRec.disabled = false;
    if (el.discardRec) el.discardRec.disabled = false;
    if (el.recordingMeter) el.recordingMeter.style.width = '0%';
  }

  function disconnectRecorder() {
    S.recorder.processor?.disconnect();
    S.recorder.source?.disconnect();
    S.recorder.stream?.getTracks().forEach((track) => track.stop());
    S.recorder.audioContext?.close();
    S.recorder.processor = null;
    S.recorder.source = null;
    S.recorder.stream = null;
    S.recorder.audioContext = null;
  }

  function updateMeter(samples) {
    let peak = 0;
    for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i]));
    S.recorder.meterLevel = S.recorder.meterLevel * 0.72 + peak * 0.28;
    if (el.recordingMeter) el.recordingMeter.style.width = `${Math.min(100, Math.round(S.recorder.meterLevel * 130))}%`;
  }

  function updateRecordingTimer() {
    const elapsed = (performance.now() - S.recorder.startedAt) / 1000;
    if (el.recordTimer) el.recordTimer.textContent = formatTimer(elapsed);
    if (elapsed >= MAX_RECORD_SECONDS) stopRecording();
  }

  function concatenateFloat32(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Float32Array(length);
    let offset = 0;
    chunks.forEach((chunk) => { result.set(chunk, offset); offset += chunk.length; });
    return result;
  }

  function resampleLinear(samples, fromRate, toRate) {
    if (fromRate === toRate) return samples;
    const ratio = fromRate / toRate;
    const newLength = Math.round(samples.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i += 1) {
      const position = i * ratio;
      const left = Math.floor(position);
      const right = Math.min(left + 1, samples.length - 1);
      const fraction = position - left;
      result[i] = samples[left] * (1 - fraction) + samples[right] * fraction;
    }
    return result;
  }

  function trimEdgeSilence(samples, sampleRate) {
    if (samples.length === 0) return samples;
    let peak = 0;
    for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i]));

    const threshold = Math.max(0.006, Math.min(0.018, peak * 0.035));
    let start = 0;
    let end = samples.length - 1;
    while (start < samples.length && Math.abs(samples[start]) < threshold) start += 1;
    while (end > start && Math.abs(samples[end]) < threshold) end -= 1;
    if (start >= samples.length) return samples;

    const padding = Math.round(sampleRate * 0.22);
    const paddedStart = Math.max(0, start - padding);
    const paddedEnd = Math.min(samples.length, end + padding);
    const trimmedStartSeconds = paddedStart / sampleRate;
    const trimmedEndSeconds = (samples.length - paddedEnd) / sampleRate;
    if (trimmedStartSeconds < 0.35 && trimmedEndSeconds < 0.35) return samples;
    return samples.slice(paddedStart, paddedEnd);
  }

  function encodeWav16(samples, sampleRate) {
    const bytesPerSample = 2;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
    return buffer;
  }

  function writeAscii(view, offset, value) {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  }

  function recordingQualityMessage(durationSeconds, byteLength) {
    const size = formatBytes(byteLength);
    if (durationSeconds < MIN_RECORD_SECONDS) {
      return `Saved format is correct, but ${formatTimer(durationSeconds)} is shorter than ideal. Size: ${size}.`;
    }
    if (durationSeconds > MAX_RECORD_SECONDS) return `Clip is longer than ideal. Size: ${size}.`;
    return `Training-safe WAV ready. Duration ${formatTimer(durationSeconds)}, size ${size}.`;
  }

  // ─── Playback ──────────────────────────────────────────────────────────────
  function setPlayback(bytes) {
    clearPlayback();
    if (!el.playback || !el.playbackWrap) return;
    const blob = new Blob([bytes], { type: 'audio/wav' });
    S.recorder.previewUrl = URL.createObjectURL(blob);
    el.playback.src = S.recorder.previewUrl;
    el.playbackWrap.hidden = false;
  }

  function clearPlayback() {
    if (S.recorder.previewUrl) {
      URL.revokeObjectURL(S.recorder.previewUrl);
      S.recorder.previewUrl = null;
    }
    if (el.playback) { el.playback.pause(); el.playback.removeAttribute('src'); el.playback.load(); }
    if (el.playbackWrap) el.playbackWrap.hidden = true;
  }

  async function saveRecording() {
    const preview = S.recorder.preview;
    if (!preview) return;

    const fileName = (el.recordFileName.value || '').trim() || nextClipName();
    const transcript = (el.recordTranscript.value || '').trim();
    const result = await api.saveRecordedAudio(S.projectDir, {
      name: fileName,
      transcript,
      durationSeconds: preview.durationSeconds,
      audioBytes: Array.from(preview.bytes)
    });

    S.scan = result.state;
    S.rows = S.scan.metadataRows;
    S.dirty = false;
    setMessage(`Saved ${result.file.relativePath}.`, 'success');
    resetPreview();
    updateUI();
    refreshEnv();
  }

  function resetPreview() {
    S.recorder.preview = null;
    S.recorder.chunks = [];
    clearPlayback();
    if (el.saveRec) el.saveRec.disabled = true;
    if (el.discardRec) el.discardRec.disabled = true;
    if (el.recordTimer) el.recordTimer.textContent = '0:00.0';
    if (el.recordStatus) el.recordStatus.textContent = 'Ready to record';
    if (el.recordMessage) el.recordMessage.textContent = 'Use 5 to 30 seconds of clear speech.';
    if (el.recordFileName) el.recordFileName.value = nextClipName();
    if (el.recordTranscript) el.recordTranscript.value = '';
    if (el.recordingMeter) el.recordingMeter.style.width = '0%';
  }

  // ─── Training panel ────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function setTrainStatus(text) { if (el.trainStatus && text != null) el.trainStatus.textContent = text; }

  let logExpanded = false;
  function setLogExpanded(on) {
    logExpanded = on;
    if (el.trainLog) el.trainLog.classList.toggle('collapsed', !on);
    if (el.logExpandBtn) el.logExpandBtn.textContent = on ? 'Collapse' : 'Expand';
    if (on && el.trainLog) el.trainLog.scrollTop = el.trainLog.scrollHeight;
  }

  const tilde = (p) => {
    const home = (T.env && T.env.home) || '';
    return home && p && p.startsWith(home) ? '~' + p.slice(home.length) : p;
  };

  // state: true=ok(green), false=bad(red), 'warn'=amber, null=neutral
  function chip(text, state, title) {
    const cls = state === true ? 'ok' : state === false ? 'bad' : state === 'warn' ? 'warn' : 'neutral';
    const t = title ? ` title="${esc(title)}"` : '';
    return `<div class="dt-chip ${cls}"${t}><span class="dt-dot"></span><span class="dt-chip-text">${esc(text)}</span></div>`;
  }

  function detailRow(label, value, title) {
    const t = title ? ` title="${esc(title)}"` : '';
    return `<div class="dt-drow"${t}><span>${esc(label)}</span><code>${esc(value)}</code></div>`;
  }

  function renderEnv() {
    if (!el.env) return;
    const e = T.env;
    if (!e) { el.env.textContent = 'Environment unavailable.'; return; }
    const p = e.probe || {};
    const ds = p.dataset || {};
    const dur = ds.duration_sec || 0;
    const mins = Math.floor(dur / 60), secs = Math.round(dur % 60);
    const pkgs = ['torch', 'transformers', 'peft', 'datasets', 'librosa', 'soundfile'];
    const allPkgs = pkgs.every((n) => p[n]);
    const missing = pkgs.filter((n) => !p[n]);
    const clips = ds.clips != null ? ds.clips : null;

    const deviceStr = String(p.device || 'cpu').toLowerCase();
    const deviceLabel = deviceStr.includes('mps') ? 'MPS active' : deviceStr.includes('cuda') ? 'CUDA active' : 'CPU active';
    const deviceState = deviceStr.includes('mps') || deviceStr.includes('cuda') ? true : 'neutral';

    el.env.innerHTML = [
      chip(e.probe && p.python_version ? `Python ${p.python_version}` : (e.probe ? 'Python detected' : 'Python missing'), !!e.probe),
      chip(deviceLabel, deviceState),
      chip(p.torch && p.torch_version ? `Torch ${p.torch_version}` : 'Torch missing', !!p.torch),
      chip(clips == null || clips === 0 ? 'Dataset empty' : `Dataset ${clips} clip${clips === 1 ? '' : 's'}`, clips != null && clips >= 10 ? true : (clips > 0 ? 'warn' : false)),
      chip(e.prodModel ? 'Production model found' : 'Production model missing', !!e.prodModel, e.prodModelPath),
      chip(e.backupExists ? 'Backup found' : 'Backup missing', e.backupExists ? true : 'warn', e.backupPath)
    ].join('');

    if (el.envDetailRows) {
      el.envDetailRows.innerHTML = [
        detailRow('Training folder', tilde(S.projectDir), S.projectDir),
        detailRow('Virtual env', tilde(e.venvPath), e.venvPath),
        detailRow('Dataset file', tilde(e.datasetMetadata), e.datasetMetadata),
        detailRow('Output folder', tilde(S.projectDir + '/output'), S.projectDir + '/output'),
        detailRow('Production model', tilde(e.prodModelPath) + (e.prodModel ? ` · ${(e.prodModel.size / 1048576).toFixed(0)} MB` : ''), e.prodModelPath),
        detailRow('Backup folder', tilde(e.backupPath), e.backupPath),
        detailRow('Packages', pkgs.map((n) => `${n} ${p[n] ? '✓' : '✗'}`).join('   '), '')
      ].join('');
    }
  }

  async function refreshEnv() {
    try { T.env = await api.trainEnv({ projectDir: S.projectDir }); } catch (_) { T.env = null; }
    renderEnv();
    applyTrainGating();
  }

  function applyTrainGating() {
    updateStepperUI();
  }

  function updateStepperUI() {
    const v = T.validation;
    const t = T.tools;
    const clipsCount = S.scan?.validation?.totalClips || 0;
    const validationPassed = T.validationPassed;
    const enough = !!(validationPassed && clipsCount >= MIN_TRAIN_CLIPS);
    const isTrained = T.trained || !!(t && t.mergedExists);

    const chip1 = document.getElementById('ds-step1-status');
    const chip2 = document.getElementById('ds-step2-status');
    const chip3 = document.getElementById('ds-step3-status');
    const chip4 = document.getElementById('ds-step4-status');
    const chip5 = document.getElementById('ds-step5-status');
    const chip6 = document.getElementById('ds-step6-status');
    const helper3 = document.getElementById('ds-train-helper');

    function setChip(el, text, state) {
      if (!el) return;
      el.textContent = text;
      el.className = `dt-status-chip ${state}`;
    }

    // Step 1: Verification
    if (!v) {
      setChip(chip1, 'Missing', 'missing');
    } else if (!validationPassed) {
      setChip(chip1, 'Failed', 'failed');
    } else {
      setChip(chip1, 'Complete', 'complete');
    }

    // Step 2: Baseline Test
    if (T.lastTest && T.lastTest.which === 'Base model') {
      setChip(chip2, 'Complete', 'complete');
    } else {
      setChip(chip2, 'Ready', 'ready');
    }

    // Step 3: Training
    if (T.running) {
      setChip(chip3, 'Running', 'ready');
      if (helper3) helper3.textContent = '';
    } else if (!enough) {
      setChip(chip3, 'Locked', 'locked');
      if (helper3) {
        if (clipsCount < MIN_TRAIN_CLIPS) {
          helper3.innerHTML = `<span style="color: var(--accent); font-weight: 700;">Locked — need 10 valid clips. Current: ${clipsCount}/10.</span>`;
        } else if (!validationPassed) {
          helper3.innerHTML = '<span style="color: var(--accent); font-weight: 700;">Locked — run and pass dataset validation first.</span>';
        }
      }
    } else if (isTrained) {
      setChip(chip3, 'Complete', 'complete');
      if (helper3) helper3.textContent = '';
    } else {
      setChip(chip3, 'Ready', 'ready');
      if (helper3) helper3.textContent = '';
    }

    // Step 4: Evaluate Tuned Adapter
    if (!isTrained) {
      setChip(chip4, 'Locked', 'locked');
    } else if (T.lastTest && T.lastTest.which === 'Trained model') {
      setChip(chip4, 'Complete', 'complete');
    } else {
      setChip(chip4, 'Ready', 'ready');
    }

    // Step 5: Export & Merge
    if (!isTrained) {
      setChip(chip5, 'Locked', 'locked');
    } else if (t && t.mergedExists) {
      setChip(chip5, 'Complete', 'complete');
    } else {
      setChip(chip5, 'Ready', 'ready');
    }

    // Step 6: GGML Conversion
    if (!t || !t.mergedExists) {
      setChip(chip6, 'Locked', 'locked');
    } else if (t && t.convertedExists) {
      setChip(chip6, 'Complete', 'complete');
    } else {
      setChip(chip6, 'Ready', 'ready');
    }

    // Enable/disable buttons based on state
    if (el.trainStartBtn) {
      el.trainStartBtn.disabled = T.running || !enough;
    }
    if (el.testTrainedBtn) {
      el.testTrainedBtn.disabled = T.running || !isTrained;
    }
    if (el.exportBtn) {
      el.exportBtn.disabled = T.running || !isTrained;
    }
    if (el.setupToolsBtn) {
      el.setupToolsBtn.disabled = T.running || !t || !t.mergedExists;
    }
    if (el.convertBtn) {
      const ready = !!(t && t.mergedExists && t.quantizeBuilt);
      el.convertBtn.disabled = T.running || !ready;
    }
  }

  function setTrainRunning(on, statusText) {
    T.running = on;
    [el.validateBtn, el.testBaseBtn, el.testTrainedBtn, el.exportBtn, el.setupToolsBtn, el.convertBtn, el.backupBtnM, el.replaceBtn, el.restoreBtn]
      .forEach((b) => { if (b) b.disabled = on; });
    if (el.trainCancel) el.trainCancel.disabled = !on;
    applyTrainGating();
    setTrainStatus(statusText);
  }

  function renderTools() {
    if (!el.toolsStatus) return;
    const t = T.tools;
    if (!t) { el.toolsStatus.textContent = 'whisper.cpp status unknown.'; return; }
    el.toolsStatus.innerHTML = [
      chip('whisper.cpp', t.whisperCppCloned ? 'cloned' : 'not cloned', t.whisperCppCloned),
      chip('quantize', t.quantizeBuilt ? 'built' : 'not built', t.quantizeBuilt),
      chip('Merged model', t.mergedExists ? 'present (export done)' : 'missing — run Export', t.mergedExists),
      chip('Converted .bin', t.convertedExists ? tilde(t.convertedPath) : 'not created yet', t.convertedExists ? true : null)
    ].join('');
  }

  async function refreshTools() {
    try { T.tools = await api.trainToolsStatus({ projectDir: S.projectDir }); } catch (_) { T.tools = null; }
    renderTools();
    applyTrainGating();
  }

  function renderTestResultCard(containerEl, t, isTrainedModel) {
    if (!containerEl) return;
    if (!t) {
      containerEl.style.display = 'none';
      containerEl.innerHTML = '';
      return;
    }

    containerEl.style.display = 'flex';
    const title = isTrainedModel ? 'Trained Model Test Result' : 'Base Model Test Result';
    if (!t.ok) {
      containerEl.innerHTML = `
        <div style="font-size: 13px; font-weight: 800; color: var(--accent); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed var(--border); padding-bottom: 6px; margin-bottom: 8px; width: 100%;">
          <span>${title}</span>
          <span style="font-size: 10.5px; font-weight: normal; color: var(--muted);">${t.timestamp || ''}</span>
        </div>
        <div style="display: grid; gap: 8px; font-size: 11.5px; width: 100%;">
          <div>
            <span style="font-size: 9.5px; font-weight: 750; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 2px;">Status</span>
            <div style="font-size: 11px; font-weight: 700; color: var(--accent);">Test failed: ${esc(t.error || 'Unknown error')}</div>
          </div>
        </div>
      `;
      return;
    }

    const clips = t.clips || [];
    const rowsHtml = clips.map((clip) => {
      if (clip.error) {
        return `
          <tr style="border-bottom: 1px dashed var(--border);">
            <td style="padding: 6px; font-family: monospace; word-break: break-all;">${esc(clip.audio.split('/').pop())}</td>
            <td style="padding: 6px; color: var(--muted);">${esc(clip.expected)}</td>
            <td style="padding: 6px; color: var(--accent); font-weight: 600;" colspan="3">Error: ${esc(clip.error)}</td>
          </tr>
        `;
      }
      const sim = computeSimilarity(clip.expected, clip.output);
      let statusText = 'Good';
      let statusColor = 'var(--success)';
      if (sim < 50) {
        statusText = 'Worse than expected';
        statusColor = 'var(--accent)';
      } else if (sim < 90) {
        statusText = 'Needs improvement';
        statusColor = '#d97706';
      }
      return `
        <tr style="border-bottom: 1px dashed var(--border);">
          <td style="padding: 6px; font-family: monospace; word-break: break-all;">${esc(clip.audio.split('/').pop())}</td>
          <td style="padding: 6px; color: var(--muted);">${esc(clip.expected)}</td>
          <td style="padding: 6px; color: var(--text);">${esc(clip.output)}</td>
          <td style="padding: 6px; text-align: center; font-weight: 700;">${sim}%</td>
          <td style="padding: 6px; text-align: right; font-weight: 700; color: ${statusColor}; font-size: 10px;">${statusText}</td>
        </tr>
      `;
    }).join('');

    const validClips = clips.filter(c => !c.error);
    let avgSim = 0;
    if (validClips.length > 0) {
      const sum = validClips.reduce((acc, c) => acc + computeSimilarity(c.expected, c.output), 0);
      avgSim = Math.round(sum / validClips.length);
    }
    t.avgSimilarity = avgSim;

    let comparisonHtml = '';
    if (isTrainedModel && T.lastTestBase && T.lastTestBase.ok && T.lastTestBase.clips) {
      const baseAvg = T.lastTestBase.avgSimilarity || 0;
      const trainedAvg = avgSim;
      const diff = trainedAvg - baseAvg;
      let diffText = '';
      let diffColor = 'var(--muted)';
      if (diff > 0) {
        diffText = `Improvement: +${diff.toFixed(0)}%`;
        diffColor = 'var(--success)';
      } else if (diff < 0) {
        diffText = `Regression: ${diff.toFixed(0)}%`;
        diffColor = 'var(--accent)';
      } else {
        diffText = 'No change';
        diffColor = 'var(--muted)';
      }

      comparisonHtml = `
        <div style="margin-top: 10px; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--card); display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; width: 100%;">
          <div>
            <span style="color: var(--muted); font-weight: 600;">Comparison:</span>
            <span style="margin-left: 6px;">Base (${baseAvg}%) vs Trained (${trainedAvg}%)</span>
          </div>
          <strong style="color: ${diffColor}; font-size: 12.5px;">${diffText}</strong>
        </div>
      `;
    }

    containerEl.innerHTML = `
      <div style="font-size: 13px; font-weight: 800; color: var(--text); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed var(--border); padding-bottom: 6px; margin-bottom: 8px; width: 100%;">
        <span>${title}</span>
        <span style="font-size: 11px; font-weight: 800; color: var(--success);">Average Similarity: ${avgSim}%</span>
        <span style="font-size: 10.5px; font-weight: normal; color: var(--muted);">${t.timestamp || ''}</span>
      </div>
      <div style="overflow-x: auto; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); font-weight: 700; color: var(--ds-muted-strong);">
              <th style="padding: 6px; width: 20%;">Clip</th>
              <th style="padding: 6px; width: 30%;">Expected</th>
              <th style="padding: 6px; width: 30%;">Output</th>
              <th style="padding: 6px; text-align: center; width: 10%;">Similarity</th>
              <th style="padding: 6px; text-align: right; width: 10%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      ${comparisonHtml}
    `;
  }

  function renderTrainResults() {
    renderTestResultCard(el.step2Result, T.lastTestBase, false);
    renderTestResultCard(el.step4Result, T.lastTestTrained, true);
    if (!el.trainResults) return;
    let html = '';
    const v = T.validation;
    if (v) {
      const mins = Math.floor((v.total_duration_sec || 0) / 60);
      const secs = Math.round((v.total_duration_sec || 0) % 60);
      html += `<div class="ds-train-cards">
        <div class="metric-card"><span>Total clips</span><strong>${v.total_clips || 0}</strong></div>
        <div class="metric-card"><span>Duration</span><strong>${mins}:${String(secs).padStart(2, '0')}</strong></div>
        <div class="metric-card"><span>Missing files</span><strong>${(v.missing_files || []).length}</strong></div>
        <div class="metric-card"><span>Wrong format</span><strong>${(v.wrong_format || []).length}</strong></div>
        <div class="metric-card"><span>Missing transcripts</span><strong>${(v.missing_transcripts || []).length}</strong></div>
      </div>
      <p class="ds-train-verdict ${v.ok ? 'ok' : 'bad'}">${v.ok ? 'PASS — dataset is ready for training.' : 'FAIL — fix the issues above, then validate again.'}</p>`;
    }
    el.trainResults.innerHTML = html;
  }

  function renderModelInfo() {
    if (!el.modelInfo) return;
    const m = T.model;
    if (!m) { el.modelInfo.textContent = 'Model info unavailable.'; return; }
    let html = '';
    if (m.model) {
      const mb = (m.model.size / 1048576).toFixed(1);
      const when = new Date(m.model.mtime).toLocaleString();
      html += `<div class="ds-test-row"><span>Current</span><code>${esc(m.appModelName)} · ${mb} MB · ${esc(when)}</code></div>`;
    } else {
      html += `<div class="ds-test-row"><span>Current</span><code>not found</code></div>`;
    }
    html += `<div class="ds-test-row"><span>Backups</span><code>${(m.backups || []).length} in output/model-backups</code></div>`;
    el.modelInfo.innerHTML = html;
  }

  async function refreshModelInfo() {
    try { T.model = await api.modelInfo({ projectDir: S.projectDir }); } catch (_) { T.model = null; }
    renderModelInfo();
  }

  async function doValidate() {
    startProgress('Validating Dataset');
    setTrainRunning(true, 'Validating dataset…');
    const res = await api.trainValidate({ projectDir: S.projectDir });
    T.validation = res && res.result ? res.result : null;
    T.validationPassed = !!(T.validation && T.validation.ok);
    renderTrainResults();
    const v = T.validation;
    let msg;
    if (!res) {
      endProgress('failed', 'IPC call failed');
      msg = 'Validation failed — IPC error.';
    } else if (res.canceled) {
      endProgress('cancelled');
      msg = 'Validation cancelled.';
    } else if (!v || !v.ok) {
      endProgress('failed', 'Dataset validation did not pass');
      msg = 'Validation failed — fix the issues to enable training.';
    } else if ((v.total_clips || 0) < MIN_TRAIN_CLIPS) {
      endProgress('success');
      const needed = MIN_TRAIN_CLIPS - (v.total_clips || 0);
      msg = `Dataset format is valid. Add ${needed} more valid clip${needed === 1 ? '' : 's'} to unlock LoRA training. Current: ${v.total_clips || 0}/${MIN_TRAIN_CLIPS}.`;
    } else {
      endProgress('success');
      msg = `Ready for LoRA training.`;
    }
    setTrainRunning(false, msg);
  }

  async function doTestBase() {
    startProgress('Testing Base Model');
    setTrainRunning(true, 'Testing base model (first run downloads openai/whisper-small)…');
    const scope = T.testScope || 'random3';
    const res = await api.trainTestBase({ projectDir: S.projectDir, scope });
    
    const timestamp = new Date().toLocaleString();
    if (res && res.ok && res.result && res.result.clips) {
      T.lastTestBase = Object.assign({ which: 'Base model', ok: true, timestamp }, res.result);
      T.lastTest = Object.assign({ which: 'Base model' }, res.result);
      
      const validClips = res.result.clips.filter(c => !c.error);
      let avgSim = 0;
      if (validClips.length > 0) {
        const sum = validClips.reduce((acc, c) => acc + computeSimilarity(c.expected, c.output), 0);
        avgSim = Math.round(sum / validClips.length);
      }
      T.lastTestBase.avgSimilarity = avgSim;

      appendLog(`\n========================================`);
      appendLog(`Base Model Test Result (${timestamp})`);
      appendLog(`Scope:    ${scope}`);
      appendLog(`Avg Sim:  ${avgSim}% match`);
      res.result.clips.forEach((clip, i) => {
        appendLog(`--- Clip #${i+1}: ${clip.audio.split('/').pop()}`);
        appendLog(`Expected: ${clip.expected}`);
        if (clip.error) {
          appendLog(`Error:    ${clip.error}`);
        } else {
          appendLog(`Whisper:  ${clip.output}`);
          appendLog(`Sim:      ${computeSimilarity(clip.expected, clip.output)}%`);
        }
      });
      appendLog(`========================================\n`);
    } else {
      const err = res ? (res.error || 'Test script failed') : 'IPC call failed';
      T.lastTestBase = { which: 'Base model', ok: false, error: err, timestamp };
      appendLog(`\n========================================`);
      appendLog(`Base Model Test FAILED (${timestamp})`);
      appendLog(`Error:    ${err}`);
      appendLog(`========================================\n`);
    }
    renderTrainResults();

    let msg;
    if (!res) {
      endProgress('failed', 'IPC call failed');
      msg = 'Base model test failed — IPC error.';
    } else if (res.canceled) {
      endProgress('cancelled');
      msg = 'Base model test cancelled.';
    } else if (!res.ok) {
      endProgress('failed', res.error || 'Test script failed');
      msg = 'Base model test finished with error (see logs).';
    } else {
      endProgress('success');
      msg = 'Base model test done.';
    }
    setTrainRunning(false, msg);
  }

  async function doTrainStart() {
    if (!T.validationPassed) return;
    if (!window.confirm('Start LoRA training?\n\nThis can take a long time and use significant CPU/GPU memory. Keep the app open until it finishes.\n\nThis trains a LoRA adapter on openai/whisper-small. It does NOT modify your installed app model.')) return;
    startProgress('Training LoRA Model');
    setTrainRunning(true, 'Training… watch the logs below.');
    const res = await api.trainStart({ projectDir: S.projectDir });
    let msg;
    if (!res) {
      endProgress('failed', 'IPC call failed');
      msg = 'Training finished (IPC error).';
    } else if (res.canceled) {
      endProgress('cancelled');
      msg = 'Training cancelled.';
    } else if (!res.ok) {
      endProgress('failed', res.error || 'Training script failed');
      msg = 'Training finished (see logs).';
    } else {
      endProgress('success');
      msg = 'Training complete ✓ — adapter saved to output/lora-adapter.';
      T.trained = true;
    }
    setTrainRunning(false, msg);
  }

  async function doTestTrained() {
    startProgress('Testing Trained Model');
    setTrainRunning(true, 'Testing trained model…');
    const scope = T.testScope || 'random3';
    const res = await api.trainTestTrained({ projectDir: S.projectDir, scope });
    
    const timestamp = new Date().toLocaleString();
    if (res && res.ok && res.result && res.result.clips) {
      T.lastTestTrained = Object.assign({ which: 'Trained model', ok: true, timestamp }, res.result);
      T.lastTest = Object.assign({ which: 'Trained model' }, res.result);
      
      const validClips = res.result.clips.filter(c => !c.error);
      let avgSim = 0;
      if (validClips.length > 0) {
        const sum = validClips.reduce((acc, c) => acc + computeSimilarity(c.expected, c.output), 0);
        avgSim = Math.round(sum / validClips.length);
      }
      T.lastTestTrained.avgSimilarity = avgSim;

      appendLog(`\n========================================`);
      appendLog(`Trained Model Test Result (${timestamp})`);
      appendLog(`Scope:    ${scope}`);
      appendLog(`Avg Sim:  ${avgSim}% match`);
      
      if (T.lastTestBase && T.lastTestBase.ok) {
        const diff = avgSim - (T.lastTestBase.avgSimilarity || 0);
        const diffSign = diff > 0 ? `+${diff}` : `${diff}`;
        appendLog(`Compare:  Base (${T.lastTestBase.avgSimilarity}%) vs Trained (${avgSim}%) [Change: ${diffSign}%]`);
      }

      res.result.clips.forEach((clip, i) => {
        appendLog(`--- Clip #${i+1}: ${clip.audio.split('/').pop()}`);
        appendLog(`Expected: ${clip.expected}`);
        if (clip.error) {
          appendLog(`Error:    ${clip.error}`);
        } else {
          appendLog(`Whisper:  ${clip.output}`);
          appendLog(`Sim:      ${computeSimilarity(clip.expected, clip.output)}%`);
        }
      });
      appendLog(`========================================\n`);
    } else {
      const err = res ? (res.error || 'Test script failed') : 'IPC call failed';
      T.lastTestTrained = { which: 'Trained model', ok: false, error: err, timestamp };
      appendLog(`\n========================================`);
      appendLog(`Trained Model Test FAILED (${timestamp})`);
      appendLog(`Error:    ${err}`);
      appendLog(`========================================\n`);
    }
    renderTrainResults();

    let msg;
    if (!res) {
      endProgress('failed', 'IPC call failed');
      msg = 'Trained model test failed — IPC error.';
    } else if (res.canceled) {
      endProgress('cancelled');
      msg = 'Trained model test cancelled.';
    } else if (!res.ok) {
      endProgress('failed', res.error || 'Test script failed');
      msg = 'Trained model test finished with error (see logs).';
    } else {
      endProgress('success');
      msg = 'Trained model test done.';
    }
    setTrainRunning(false, msg);
  }

  async function doExport() {
    startProgress('Exporting Model');
    setTrainRunning(true, 'Exporting merged model…');
    const res = await api.trainExport({ projectDir: S.projectDir });
    await refreshTools();
    let msg;
    if (!res) {
      endProgress('failed', 'IPC call failed');
      msg = 'Export finished (IPC error).';
    } else if (res.canceled) {
      endProgress('cancelled');
      msg = 'Export cancelled.';
    } else if (!res.ok) {
      endProgress('failed', res.error || 'Export script failed');
      msg = 'Export finished (see logs).';
    } else {
      endProgress('success');
      msg = 'Exported merged HF model — you can now Convert to GGML.';
    }
    setTrainRunning(false, msg);
  }

  async function doSetupTools() {
    startProgress('Setting Up whisper.cpp Tools');
    setTrainRunning(true, 'Setting up whisper.cpp tools (clone + build)…');
    const res = await api.trainSetupTools({ projectDir: S.projectDir });
    await refreshTools();
    let msg;
    if (!res) {
      endProgress('failed', 'IPC call failed');
      msg = 'Setup failed (IPC error).';
    } else if (res.canceled) {
      endProgress('cancelled');
      msg = 'Setup cancelled.';
    } else if (!res.ok) {
      endProgress('failed', res.error || 'Setup build failed');
      msg = `Setup failed: ${res.error}`;
    } else {
      endProgress('success');
      msg = 'whisper.cpp tools ready ✓.';
    }
    setTrainRunning(false, msg);
  }

  async function doConvert() {
    startProgress('Converting to GGML / Q5_1');
    setTrainRunning(true, 'Converting to GGML / Q5_1…');
    const res = await api.trainConvertGgml({ projectDir: S.projectDir });
    await refreshTools();
    let msg;
    if (!res) {
      endProgress('failed', 'IPC call failed');
      msg = 'Convert failed (IPC error).';
    } else if (res.canceled) {
      endProgress('cancelled');
      msg = 'Convert cancelled.';
    } else if (!res.ok) {
      endProgress('failed', res.error || 'Convert script failed');
      msg = `Convert failed: ${res.error}`;
    } else {
      endProgress('success');
      msg = 'Created output/ggml-small-q5_1.bin ✓ — use Replace App Model to install.';
    }
    setTrainRunning(false, msg);
  }

  async function doCancel() {
    await api.trainCancel();
  }

  async function doBackup() {
    setTrainRunning(true, 'Backing up current model…');
    const res = await api.backupModel({ projectDir: S.projectDir });
    appendLog(res && res.ok ? `Backed up model → ${res.path}` : `Backup failed: ${res && res.error}`);
    await refreshModelInfo();
    setTrainRunning(false, res && res.ok ? 'Current model backed up.' : `Backup failed: ${res && res.error}`);
  }

  async function doReplace() {
    if (!window.confirm('Replace the app model (ggml-small-q5_1.bin)?\n\nThe current model is backed up first. If you don\'t choose a file, output/ggml-small-q5_1.bin is used. The English model is never touched.\n\nRestart Parayu afterward to load the new model.')) return;
    setTrainRunning(true, 'Replacing app model…');
    const res = await api.replaceModel({ projectDir: S.projectDir, confirmed: true });
    appendLog(res && res.ok ? `Replaced app model. Backup: ${res.backup || '(none)'}` : `Replace not done: ${res && res.error}`);
    await refreshModelInfo();
    setTrainRunning(false, res && res.ok ? 'App model replaced ✓ — restart Parayu to use it.' : `Replace not done: ${res && res.error}`);
  }

  async function doRestore() {
    if (!window.confirm('Restore the most recent model backup over the current app model?')) return;
    setTrainRunning(true, 'Restoring backup…');
    const res = await api.restoreBackup({ projectDir: S.projectDir, confirmed: true });
    appendLog(res && res.ok ? `Restored from ${res.from}` : `Restore failed: ${res && res.error}`);
    await refreshModelInfo();
    setTrainRunning(false, res && res.ok ? 'Backup restored ✓ — restart Parayu to use it.' : `Restore failed: ${res && res.error}`);
  }

  function wireTraining() {
    el.validateBtn.onclick = doValidate;
    el.testBaseBtn.onclick = doTestBase;
    el.trainStartBtn.onclick = doTrainStart;
    el.testTrainedBtn.onclick = doTestTrained;
    el.exportBtn.onclick = doExport;
    el.setupToolsBtn.onclick = doSetupTools;
    el.convertBtn.onclick = doConvert;
    el.trainCancel.onclick = doCancel;
    el.progressCancel.onclick = doCancel;
    el.backupBtnM.onclick = doBackup;
    el.replaceBtn.onclick = doReplace;
    el.restoreBtn.onclick = doRestore;
    el.openOutputBtn.onclick = () => api.openTrainingOutput({ projectDir: S.projectDir });
    el.clearLogBtn.onclick = () => { logBuffer.length = 0; if (el.trainLog) el.trainLog.textContent = ''; };
    el.envRefresh.onclick = refreshEnv;
    if (el.logExpandBtn) {
      el.logExpandBtn.onclick = () => setLogExpanded(!logExpanded);
    }
    if (el.copyLogBtn) {
      el.copyLogBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(logBuffer.join('\n'));
          const old = el.copyLogBtn.textContent;
          el.copyLogBtn.textContent = 'Copied!';
          setTimeout(() => { el.copyLogBtn.textContent = old; }, 1500);
        } catch (_) {}
      };
    }

    // Restore and bind the test scope selector
    const scopeEl = document.getElementById('ds-test-scope');
    if (scopeEl) {
      if (T.testScope) scopeEl.value = T.testScope;
      scopeEl.onchange = () => {
        T.testScope = scopeEl.value;
      };
    }

    // Restore panel state into the freshly-rendered DOM.
    if (el.trainLog) el.trainLog.textContent = logBuffer.join('\n');
    renderTrainResults();
    renderEnv();
    renderTools();
    setTrainRunning(T.running, T.running ? 'Task running…' : 'Idle.');
    refreshModelInfo();
    if (!T.running) { refreshEnv(); refreshTools(); }
  }

  // ─── HTML shell ────────────────────────────────────────────────────────────
  // ─── HTML shell ────────────────────────────────────────────────────────────
  function render() {
    return `
      <div class="ds-studio settings-page">
        <!-- Top bar / Settings style Header -->
        <div class="settings-head" style="margin-bottom: 18px;">
          <div>
            <h2 class="set-title" id="ds-headline">Parayu Whisper Training Console</h2>
            <p class="set-sub" style="display: flex; align-items: center; gap: 8px;">
              Prepare, validate, fine-tune, export, and install the multilingual Whisper Small model.
              <span class="ds-pill" style="padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,.05); color: var(--ds-muted-strong); font-size: 11px; font-weight: 800; border: 1px solid var(--ds-line);">dev build</span>
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="ds-ensure" type="button" class="btn-ghost" style="padding: 6px 12px; font-size: 12px;">Prepare Folders</button>
            <button id="ds-backup" type="button" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">Backup Dataset</button>
          </div>
        </div>

        <!-- Segmented Tab selector -->
        <div class="seg" style="margin-bottom: 12px;">
          <button id="ds-tab-dataset" type="button" class="seg-btn ${S.activeTab !== 'training' ? 'seg-active' : ''}">Dataset Studio</button>
          <button id="ds-tab-training" type="button" class="seg-btn ${S.activeTab === 'training' ? 'seg-active' : ''}">Model Training</button>
        </div>

        <!-- Tab 1: Dataset Studio -->
        <div id="ds-content-dataset" class="ds-studio-grid-1col" style="display: ${S.activeTab !== 'training' ? 'flex' : 'none'};">
          <!-- Row 1: Directory Setup & Health Summary -->
          <div class="ds-studio-grid-2col">
            <!-- Folder Setup Card -->
            <div class="set-card" style="padding: 12px 16px; border-radius: 14px; margin-bottom: 0; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('folder')}</span>
                  <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Training Directory</div>
                </div>
                <span class="ds-offline" style="font-size: 10.5px; color: var(--muted); font-weight: 500;">Local path</span>
              </div>
              <div style="display: flex; gap: 14px; align-items: stretch; margin-top: 2px;">
                <div style="flex: 1.3; min-width: 0; display: flex; flex-direction: column; gap: 8px;">
                  <p id="ds-projectPath" class="mono path-text" style="margin: 0; padding: 8px; font-size: 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--ds-soft); color: var(--ds-muted-strong); line-height: 1.4; word-break: break-all; min-height: 38px;"></p>
                  <div style="display: flex; gap: 8px;">
                    <button id="ds-choose" type="button" class="btn-soft" style="padding: 6px 10px; font-size: 11.5px;">Choose Folder</button>
                    <button id="ds-open" type="button" class="btn-ghost" style="padding: 6px 10px; font-size: 11.5px;">Open Folder</button>
                  </div>
                </div>
                <div style="width: 1px; background: var(--border); align-self: stretch; margin: 0 2px;"></div>
                <div style="flex: 0.7; display: flex; flex-direction: column; gap: 6px; justify-content: center; padding-left: 6px;">
                  <div class="status-item" id="ds-metadataStatus" style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ds-muted-strong);"><span class="status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: var(--ds-line-strong); display: inline-block;"></span><span>metadata.csv</span></div>
                  <div class="status-item" id="ds-audioFolderStatus" style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ds-muted-strong);"><span class="status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: var(--ds-line-strong); display: inline-block;"></span><span>audio/ folder</span></div>
                  <div class="status-item" id="ds-audioCountStatus" style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ds-muted-strong);"><span class="status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: var(--ds-line-strong); display: inline-block;"></span><span>0 clips</span></div>
                </div>
              </div>
            </div>

            <!-- Dataset Summary Card -->
            <div class="set-card" style="padding: 12px 16px; border-radius: 14px; margin-bottom: 0; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('activity')}</span>
                <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Dataset Summary</div>
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 4px; flex: 1; align-content: center;">
                <div style="text-align: center; border-right: 1px solid var(--border); padding: 4px 0;">
                  <span style="display: block; font-size: 10.5px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Total Clips</span>
                  <strong id="ds-totalClips" style="display: block; font-size: 24px; font-weight: 800; color: var(--text); margin-top: 4px;">0</strong>
                </div>
                <div style="text-align: center; border-right: 1px solid var(--border); padding: 4px 0;">
                  <span style="display: block; font-size: 10.5px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Duration</span>
                  <strong id="ds-totalDuration" style="display: block; font-size: 24px; font-weight: 800; color: var(--text); margin-top: 4px;">0:00</strong>
                </div>
                <div style="text-align: center; padding: 4px 0;">
                  <span style="display: block; font-size: 10.5px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Untranscribed</span>
                  <strong id="ds-missingTranscripts" style="display: block; font-size: 24px; font-weight: 800; color: var(--text); margin-top: 4px;">0</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Row 2: Recorder & Import WAV -->
          <div class="ds-studio-grid-2col">
            <!-- Audio Recorder Card -->
            <div class="set-card" style="padding: 12px 16px; border-radius: 14px; margin-bottom: 0; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('mic')}</span>
                  <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Clean Audio Recorder</div>
                </div>
                <div class="timer-pill" id="ds-recordTimer" style="font-family: monospace; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--ds-soft); border: 1px solid var(--ds-line); font-weight: 700; color: var(--ds-text);">0:00.0</div>
              </div>
              
              <div style="display: flex; gap: 16px; align-items: stretch; margin-top: 2px; flex: 1;">
                <div style="flex: 0.9; display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <button id="ds-startRec" type="button" class="record-button" style="width: 50px; height: 50px; display: grid; place-items: center; border: 1px solid var(--ds-line); border-radius: 50%; background: #fff5f7; box-shadow: inset 0 0 0 5px #fff, 0 6px 14px rgba(238,45,85,.1); flex-shrink: 0;" aria-label="Start recording">
                    <span style="width: 14px; height: 14px; border-radius: 50%; background: var(--ds-accent); transition: border-radius 0.12s ease;"></span>
                  </button>
                  <div style="min-width: 0;">
                    <h4 id="ds-recordStatus" style="font-size: 12.5px; font-weight: 700; margin: 0; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Ready to record</h4>
                    <p id="ds-recordMessage" style="font-size: 9.5px; margin: 1px 0 0; color: var(--muted); line-height: 1.1;">Push-to-talk active while focused.</p>
                    <div class="meter-track" style="height: 5px; background: var(--ds-soft); border-radius: 999px; overflow: hidden; margin-top: 4px; width: 90px;" aria-hidden="true">
                      <span id="ds-recordingMeter" style="display: block; width: 0%; height: 100%; background: linear-gradient(90deg, var(--ds-success), var(--ds-accent)); transition: width 0.09s linear; border-radius: inherit;"></span>
                    </div>
                  </div>
                </div>
                
                <div style="width: 1px; background: var(--border); align-self: stretch; margin: 0 2px;"></div>
                
                <div style="flex: 1.1; display: flex; flex-direction: column; gap: 6px; min-width: 0; justify-content: center;">
                  <div style="display: grid; grid-template-columns: 1fr; gap: 6px;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                      <input id="ds-recordFileName" class="text-input mono" style="height: 28px; padding: 0 8px; font-size: 11px; flex: 1; border: 1px solid var(--border); border-radius: 6px;" placeholder="clip_0001.wav" spellcheck="false">
                      <button id="ds-stopRec" type="button" class="btn-soft" style="height: 28px; padding: 0 8px; font-size: 11px;" disabled>Stop</button>
                    </div>
                    <textarea id="ds-recordTranscript" class="text-input transcript-area" style="padding: 4px 6px; font-size: 11px; border: 1px solid var(--border); border-radius: 6px; height: 38px; resize: none;" placeholder="Type exactly what you said in this recording..."></textarea>
                  </div>
                  
                  <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
                    <div class="ds-playback-wrap" id="ds-playbackWrap" style="margin: 0; display: flex; align-items: center; gap: 6px; flex: 1;" hidden>
                      <audio id="ds-playback" style="height: 26px; width: 100%;" controls preload="auto"></audio>
                    </div>
                    <div style="display: flex; gap: 6px; flex-shrink: 0;">
                      <button id="ds-saveRec" type="button" class="btn-primary" style="padding: 4px 10px; font-size: 11px;" disabled>Save</button>
                      <button id="ds-discardRec" type="button" class="btn-soft" style="padding: 4px 10px; font-size: 11px;" disabled>Discard</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Import WAV clips Card -->
            <div class="set-card" style="padding: 12px 16px; border-radius: 14px; margin-bottom: 0; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('download')}</span>
                <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Import WAV Clips</div>
              </div>
              <div style="display: flex; gap: 16px; align-items: stretch; margin-top: 2px; flex: 1;">
                <div style="flex: 1.2; min-width: 0; display: flex; flex-direction: column; gap: 6px; justify-content: center;">
                  <div class="drop-zone" id="ds-dropZone" style="border: 1px dashed var(--ds-line-strong); border-radius: 8px; padding: 10px; text-align: center; background: var(--ds-soft); transition: background 0.2s ease;">
                    <p style="font-size: 11px; font-weight: 700; margin: 0; color: var(--ds-text);">Drag & Drop WAV Clips Here</p>
                    <p style="font-size: 9px; color: var(--muted); margin: 2px 0 6px;">Non-WAV files are auto-skipped.</p>
                    <div style="display: flex; gap: 6px; justify-content: center;">
                      <button id="ds-chooseAudio" type="button" class="btn-soft" style="padding: 3px 6px; font-size: 10px;">Add Files</button>
                      <button id="ds-openAudio" type="button" class="btn-ghost" style="padding: 3px 6px; font-size: 10px;">Open Folder</button>
                    </div>
                  </div>
                  <p id="ds-importMessage" class="message-line" style="font-size: 9.5px; margin: 0; min-height: 12px; color: var(--muted);"></p>
                </div>
                
                <div style="width: 1px; background: var(--border); align-self: stretch; margin: 0 2px;"></div>
                
                <div style="flex: 0.8; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding-left: 6px;">
                  <span style="font-size: 9.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Required Format</span>
                  <div style="font-size: 10px; line-height: 1.35; color: var(--ds-muted-strong); font-family: monospace;">
                    • WAV format<br>
                    • 16 kHz mono<br>
                    • 16-bit PCM<br>
                    • 5-30s length
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Dataset Validation Card -->
          <div class="set-card" style="padding: 16px 20px; border-radius: 14px; margin-bottom: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('check')}</span>
                <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Dataset Validation</div>
              </div>
            </div>
            <ul class="validation-list" id="ds-validationList" style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;">
              <li class="muted-row" style="font-size: 12px; padding: 8px 12px; border-radius: 8px; background: var(--ds-soft); border: 1px solid var(--ds-line); color: var(--ds-muted); font-weight: 700;">Prepare the project to begin validation.</li>
            </ul>
          </div>

          <!-- Metadata table Card -->
          <div class="set-card" style="padding: 16px 20px; border-radius: 14px; margin-bottom: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('book')}</span>
                <div class="set-name" style="font-size: 13.5px; font-weight: 700;">Recorded Dataset Clips</div>
              </div>
              <button id="ds-saveMetadata" type="button" class="btn-soft" style="padding: 6px 12px; font-size: 11.5px;">Save metadata.csv</button>
            </div>
            <div class="table-wrap" style="border: 1px solid var(--border); border-radius: 10px; max-height: 240px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left;">
                <thead>
                  <tr style="background: var(--ds-soft); border-bottom: 1px solid var(--border); font-weight: 700; color: var(--ds-muted-strong);">
                    <th style="padding: 8px 12px; width: 28%;">Audio File</th>
                    <th style="padding: 8px 12px;">Transcript</th>
                    <th style="padding: 8px 12px; width: 15%;">Format</th>
                    <th style="padding: 8px 12px; width: 15%; text-align: right; padding-right: 16px;">Actions</th>
                  </tr>
                </thead>
                <tbody id="ds-metadataRows">
                  <tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--muted);">No clips recorded yet. Use the recorder or import WAV clips to build your dataset.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="set-card" style="padding: 16px 20px; border-radius: 14px; margin-bottom: 0;">
            <details class="dt-details" style="width: 100%; outline: none;">
              <summary style="font-size: 13.5px; font-weight: 800; color: var(--text); cursor: pointer; display: flex; align-items: center; gap: 8px; list-style: none; outline: none;">
                <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('keyboard')}</span>
                <span>metadata.csv Raw Preview</span>
                <span style="font-size: 11px; font-weight: normal; color: var(--muted); margin-left: auto;">Click to show raw CSV content</span>
              </summary>
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border);">
                <pre id="ds-metadataPreview" style="margin: 0; padding: 12px; border: 1px solid #2d2a27; border-radius: 8px; background: #110f0e; color: #e6e1da; font-size: 11.5px; font-family: monospace; white-space: pre-wrap; overflow-y: auto; max-height: 80px; word-break: break-all;">audio,text</pre>
              </div>
            </details>
          </div>
        </div>

        <!-- Tab 2: Model Training Dashboard -->
        <div id="ds-content-training" class="dt-dashboard" style="display: ${S.activeTab === 'training' ? 'grid' : 'none'};">
          <!-- Main Content Area -->
          <div class="dt-main">
            <!-- Status Card -->
            <div class="dt-status-card">
              <span class="status-dot-active"></span>
              <span class="status-text" id="ds-train-status">Idle.</span>
            </div>

            <!-- Progress Card -->
            <div id="ds-progress-card" class="dt-progress-card" style="display: none;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: var(--accent); display: flex; align-items: center; width: 16px; height: 16px;">${setIcon('activity')}</span>
                  <span id="ds-progress-action" style="font-size: 14px; font-weight: 800; letter-spacing: -0.01em;">Current Action</span>
                </div>
                <span id="ds-progress-percentage" style="font-size: 20px; font-weight: 800; color: var(--accent);">0%</span>
              </div>
              <div style="height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; margin-top: 4px;">
                <div id="ds-progress-bar-fill" style="width: 0%; height: 100%; background: var(--accent-grad); border-radius: inherit; transition: width 0.3s ease;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--muted); margin-top: 2px;">
                <span id="ds-progress-stage" style="font-weight: 600;">Starting...</span>
                <span id="ds-progress-elapsed" style="font-family: monospace;">Elapsed: 00:00:00</span>
              </div>
              <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
                <button id="ds-progress-cancel" type="button" class="btn-soft" style="padding: 6px 12px; font-size: 11.5px; border-color: var(--accent); color: var(--accent); background: var(--accent-soft);">Cancel</button>
              </div>
            </div>

            <!-- Training Pipeline Header -->
            <div style="display: flex; align-items: center; gap: 8px; margin: 18px 0 10px; padding-left: 4px;">
              <span style="color: var(--accent); display: flex; align-items: center; width: 16px; height: 16px;">${setIcon('settings')}</span>
              <div class="set-name" style="font-size: 14px; font-weight: 800; letter-spacing: -0.01em;">Training Pipeline</div>
            </div>

            <!-- Steps Cards -->
            <div style="display: flex; flex-direction: column;">
              <!-- Step 1 -->
              <div class="dt-step-card">
                <div class="dt-step-no">1</div>
                <div class="dt-step-info">
                  <div class="dt-step-name">Dataset Verification</div>
                  <div class="dt-step-desc">Validate dataset formats, tags, and minimum audio length constraints.</div>
                </div>
                <div id="ds-step1-status" class="dt-status-chip missing">Missing</div>
                <div class="dt-actions">
                  <button id="ds-validate" type="button" class="btn-primary" style="font-size: 12px; padding: 6px 12px;">Validate Dataset</button>
                  <button id="ds-open-audio" type="button" class="btn-soft" style="font-size: 12px; padding: 6px 12px;">Audio Folder</button>
                  <button id="ds-open-meta" type="button" class="btn-soft" style="font-size: 12px; padding: 6px 12px;">metadata.csv</button>
                </div>
              </div>

              <!-- Step 2 -->
              <div class="dt-step-card">
                <div class="dt-step-no">2</div>
                <div class="dt-step-info">
                  <div class="dt-step-name">Baseline Transcription Test</div>
                  <div class="dt-step-desc">Run transcription test on the un-tuned base model to establish performance metrics.</div>
                </div>
                <div id="ds-step2-status" class="dt-status-chip ready">Ready</div>
                <div class="dt-actions" style="align-items: center; gap: 12px;">
                  <button id="ds-testbase" type="button" class="btn-soft" style="font-size: 12px; padding: 6px 12px;">Test Base Model</button>
                  <div style="display: inline-flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase;">Scope:</span>
                    <select id="ds-test-scope" style="padding: 4px 8px; font-size: 11.5px; border-radius: 8px; border: 1px solid var(--border); outline: none; background: var(--card); color: var(--text); cursor: pointer; font-weight: 600;">
                      <option value="first">First clip</option>
                      <option value="random3" selected>Random 3 clips</option>
                      <option value="random5">Random 5 clips</option>
                      <option value="all">All clips</option>
                    </select>
                  </div>
                </div>
                <div id="ds-step2-result" style="grid-column: 1 / -1; display: none; margin-top: 14px; padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--ds-soft); flex-direction: column; gap: 8px;"></div>
              </div>

              <!-- Step 3 -->
              <div class="dt-step-card">
                <div class="dt-step-no">3</div>
                <div class="dt-step-info">
                  <div class="dt-step-name">LoRA Adapter Training</div>
                  <div class="dt-step-desc">Train a low-rank adapter on custom recordings without modifying core model weights.</div>
                  <div id="ds-train-helper" class="dt-step-helper" style="font-size: 11px; margin-top: 4px;"></div>
                </div>
                <div id="ds-step3-status" class="dt-status-chip locked">Locked</div>
                <div class="dt-actions">
                  <button id="ds-train-start" type="button" class="btn-primary" style="font-size: 12px; padding: 6px 12px;" disabled>Start LoRA Training</button>
                </div>
              </div>

              <!-- Step 4 -->
              <div class="dt-step-card">
                <div class="dt-step-no">4</div>
                <div class="dt-step-info">
                  <div class="dt-step-name">Evaluate Tuned Adapter</div>
                  <div class="dt-step-desc">Test transcription on the trained LoRA adapter and compare against baseline.</div>
                </div>
                <div id="ds-step4-status" class="dt-status-chip locked">Locked</div>
                <div class="dt-actions">
                  <button id="ds-testtrained" type="button" class="btn-soft" style="font-size: 12px; padding: 6px 12px;" disabled>Test Trained Model</button>
                </div>
                <div id="ds-step4-result" style="grid-column: 1 / -1; display: none; margin-top: 14px; padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--ds-soft); flex-direction: column; gap: 8px;"></div>
              </div>

              <!-- Step 5 -->
              <div class="dt-step-card">
                <div class="dt-step-no">5</div>
                <div class="dt-step-info">
                  <div class="dt-step-name">Export &amp; Merge Model</div>
                  <div class="dt-step-desc">Export and bake the trained LoRA adapter weights directly back into the Hugging Face model.</div>
                </div>
                <div id="ds-step5-status" class="dt-status-chip locked">Locked</div>
                <div class="dt-actions">
                  <button id="ds-export" type="button" class="btn-soft" style="font-size: 12px; padding: 6px 12px;" disabled>Export Model</button>
                </div>
              </div>

              <!-- Step 6 -->
              <div class="dt-step-card">
                <div class="dt-step-no">6</div>
                <div class="dt-step-info">
                  <div class="dt-step-name">Convert to GGML</div>
                  <div class="dt-step-desc">Quantize and build a high-performance ggml-small-q5_1.bin file for local app deployment.</div>
                </div>
                <div id="ds-step6-status" class="dt-status-chip locked">Locked</div>
                <div class="dt-actions">
                  <button id="ds-setup-tools" type="button" class="btn-soft" style="font-size: 12px; padding: 6px 12px;" disabled>Setup whisper.cpp Tools</button>
                  <button id="ds-convert" type="button" class="btn-soft" style="font-size: 12px; padding: 6px 12px;" disabled>Convert to GGML / Q5_1</button>
                </div>
              </div>
            </div>

            <!-- Training results view -->
            <div class="dt-results" id="ds-train-results"></div>

            <!-- Terminal Execution Logs -->
            <div class="dt-log-card" style="margin-top: 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">${setIcon('terminal')}</span>
                  <div class="set-name" style="font-size: 13px; font-weight: 700;">Live Execution Logs</div>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button id="ds-log-expand" type="button" class="btn-soft" style="padding: 4px 8px; font-size: 10.5px;">Expand</button>
                  <button id="ds-clear-log" type="button" class="btn-ghost" style="padding: 4px 8px; font-size: 10.5px;">Clear</button>
                  <button id="ds-copy-log" type="button" class="btn-ghost" style="padding: 4px 8px; font-size: 10.5px;">Copy Logs</button>
                  <button id="ds-open-output" type="button" class="btn-ghost" style="padding: 4px 8px; font-size: 10.5px;">Open Output Folder</button>
                </div>
              </div>
              <pre id="ds-train-log" class="dt-log collapsed"></pre>
            </div>
          </div>

          <!-- Sidebar Area -->
          <div class="dt-sidebar">
            <!-- Environment Readiness Card -->
            <div class="dt-sidebar-card">
              <div class="dt-block-head">
                <span class="dt-block-title">Environment Status</span>
                <button id="ds-env-refresh" type="button" class="dt-link" style="font-size: 11px; padding: 0;">Refresh</button>
              </div>
              <div class="dt-chips" id="ds-env">Checking environment…</div>
              <details class="dt-details" id="ds-env-details">
                <summary style="font-size: 11px; font-weight: 700; color: var(--muted); cursor: pointer;">Show environment variables</summary>
                <div class="dt-detail-rows" id="ds-env-detail-rows" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border);"></div>
              </details>
            </div>

            <!-- Model Install & Recovery Card -->
            <div class="dt-sidebar-card">
              <div class="dt-block-head">
                <span class="dt-block-title">App Model Management</span>
              </div>
              <p class="set-desc" style="font-size: 11px; margin: 0; color: var(--muted); line-height: 1.35;">Install your custom trained model into Parayu or backup/restore the current model.</p>
              <div class="dt-model" id="ds-model-info">Loading model info…</div>
              <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                <button id="ds-backup-model" type="button" class="btn-primary" style="width: 100%; justify-content: center; font-size: 11.5px; padding: 8px;">Backup Current Model</button>
                <button id="ds-replace" type="button" class="btn-danger" style="width: 100%; justify-content: center; font-size: 11.5px; padding: 8px;" disabled>Replace App Model…</button>
                <button id="ds-restore" type="button" class="btn-warning" style="width: 100%; justify-content: center; font-size: 11.5px; padding: 8px;">Restore Backup</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function grab() {
    el = {
      projectPath: document.getElementById('ds-projectPath'),
      metadataStatus: document.getElementById('ds-metadataStatus'),
      audioFolderStatus: document.getElementById('ds-audioFolderStatus'),
      audioCountStatus: document.getElementById('ds-audioCountStatus'),
      headline: document.getElementById('ds-headline'),
      ensureBtn: document.getElementById('ds-ensure'),
      chooseBtn: document.getElementById('ds-choose'),
      openBtn: document.getElementById('ds-open'),
      chooseAudioBtn: document.getElementById('ds-chooseAudio'),
      openAudioBtn: document.getElementById('ds-openAudio'),
      backupBtn: document.getElementById('ds-backup'),
      importMessage: document.getElementById('ds-importMessage'),
      dropZone: document.getElementById('ds-dropZone'),
      metadataRows: document.getElementById('ds-metadataRows'),
      metadataPreview: document.getElementById('ds-metadataPreview'),
      saveMetadataBtn: document.getElementById('ds-saveMetadata'),
      startRec: document.getElementById('ds-startRec'),
      stopRec: document.getElementById('ds-stopRec'),
      saveRec: document.getElementById('ds-saveRec'),
      discardRec: document.getElementById('ds-discardRec'),
      recordTimer: document.getElementById('ds-recordTimer'),
      recordStatus: document.getElementById('ds-recordStatus'),
      recordMessage: document.getElementById('ds-recordMessage'),
      recordingMeter: document.getElementById('ds-recordingMeter'),
      recordFileName: document.getElementById('ds-recordFileName'),
      recordTranscript: document.getElementById('ds-recordTranscript'),
      playback: document.getElementById('ds-playback'),
      playbackWrap: document.getElementById('ds-playbackWrap'),
      totalClips: document.getElementById('ds-totalClips'),
      totalDuration: document.getElementById('ds-totalDuration'),
      missingTranscripts: document.getElementById('ds-missingTranscripts'),
      validationList: document.getElementById('ds-validationList'),
      trainCancel: document.getElementById('ds-train-cancel'),
      badge: document.getElementById('ds-badge'),
      env: document.getElementById('ds-env'),
      envRefresh: document.getElementById('ds-env-refresh'),
      envDetailRows: document.getElementById('ds-env-detail-rows'),
      trainStatus: document.getElementById('ds-train-status'),
      validateBtn: document.getElementById('ds-validate'),
      openAudioBtnT: document.getElementById('ds-open-audio'),
      openMetaBtn: document.getElementById('ds-open-meta'),
      readiness: document.getElementById('ds-readiness'),
      testBaseBtn: document.getElementById('ds-testbase'),
      step2Result: document.getElementById('ds-step2-result'),
      trainStartBtn: document.getElementById('ds-train-start'),
      trainLock: document.getElementById('ds-train-lock'),
      testTrainedBtn: document.getElementById('ds-testtrained'),
      step4Result: document.getElementById('ds-step4-result'),
      exportBtn: document.getElementById('ds-export'),
      setupToolsBtn: document.getElementById('ds-setup-tools'),
      convertBtn: document.getElementById('ds-convert'),
      toolsStatus: document.getElementById('ds-tools-status'),
      trainResults: document.getElementById('ds-train-results'),
      trainLog: document.getElementById('ds-train-log'),
      logExpandBtn: document.getElementById('ds-log-expand'),
      copyLogBtn: document.getElementById('ds-copy-log'),
      openOutputBtn: document.getElementById('ds-open-output'),
      clearLogBtn: document.getElementById('ds-clear-log'),
      modelInfo: document.getElementById('ds-model-info'),
      backupBtnM: document.getElementById('ds-backup-model'),
      replaceBtn: document.getElementById('ds-replace'),
      restoreBtn: document.getElementById('ds-restore'),
      progressCard: document.getElementById('ds-progress-card'),
      progressAction: document.getElementById('ds-progress-action'),
      progressPercent: document.getElementById('ds-progress-percentage'),
      progressBarFill: document.getElementById('ds-progress-bar-fill'),
      progressStage: document.getElementById('ds-progress-stage'),
      progressElapsed: document.getElementById('ds-progress-elapsed'),
      progressCancel: document.getElementById('ds-progress-cancel')
    };
  }

  function wire() {
    grab();

    el.ensureBtn.onclick = prepareProject;
    el.chooseBtn.onclick = async () => {
      const folder = await api.chooseProjectFolder();
      if (!folder) return;
      S.projectDir = folder;
      await prepareProject();
    };
    el.openBtn.onclick = () => api.openPath(S.projectDir);
    el.openAudioBtn.onclick = async () => { await prepareProject(); api.openPath(S.scan.audioDir); };
    el.backupBtn.onclick = backupDataset;
    el.chooseAudioBtn.onclick = async () => {
      await prepareProject();
      const filePaths = await api.chooseAudioFiles();
      await importAudioFiles(filePaths);
    };
    el.saveMetadataBtn.onclick = saveMetadata;
    el.startRec.onclick = startRecording;
    el.stopRec.onclick = stopRecording;
    el.saveRec.onclick = saveRecording;
    el.discardRec.onclick = resetPreview;

    root().querySelectorAll('[data-copy]').forEach((button) => {
      button.onclick = async () => {
        await navigator.clipboard.writeText(button.dataset.copy);
        const original = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = original; }, 1200);
      };
    });

    el.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); el.dropZone.classList.add('dragging'); });
    el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('dragging'));
    el.dropZone.addEventListener('drop', async (event) => {
      event.preventDefault();
      el.dropZone.classList.remove('dragging');
      await prepareProject();
      const paths = Array.from(event.dataTransfer.files).map((file) => api.getPathForFile(file)).filter(Boolean);
      await importAudioFiles(paths);
    });

    // Tab switching event handlers
    const tabDataset = document.getElementById('ds-tab-dataset');
    const tabTraining = document.getElementById('ds-tab-training');
    const contentDataset = document.getElementById('ds-content-dataset');
    const contentTraining = document.getElementById('ds-content-training');
    if (tabDataset && tabTraining && contentDataset && contentTraining) {
      tabDataset.onclick = () => {
        S.activeTab = 'dataset';
        tabDataset.classList.add('seg-active');
        tabTraining.classList.remove('seg-active');
        contentDataset.style.display = 'flex';
        contentTraining.style.display = 'none';
      };
      tabTraining.onclick = () => {
        S.activeTab = 'training';
        tabTraining.classList.add('seg-active');
        tabDataset.classList.remove('seg-active');
        contentDataset.style.display = 'none';
        contentTraining.style.display = 'grid';
      };
    }

    wireTraining();

    // Push-to-talk hook: app.js calls this when main routes the hotkey here
    // (only while this page is the focused view).
    window.__parayuTrainerPTT = (shouldRecord) => {
      if (shouldRecord) startRecording();
      else stopRecording();
    };

    if (!S.loaded) {
      S.loaded = true;
      (async () => {
        try { S.projectDir = await api.getDefaultProject(); } catch (_) { /* keep */ }
        await refreshProject();
        resetPreview();
      })();
    } else {
      updateUI();
      resetPreview();
    }
  }

  // ─── Scoped styles (injected once; dev build only) ─────────────────────────
  function injectStyles() {
    let style = document.getElementById('ds-studio-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ds-studio-styles';
      document.head.appendChild(style);
    }
    style.textContent = `
.ds-studio {
  --ds-line: var(--border);
  --ds-line-strong: var(--border-hover);
  --ds-soft: #f6f4f0;
  --ds-surface: var(--card);
  --ds-text: var(--text);
  --ds-muted: var(--muted);
  --ds-muted-strong: #524e46;
  --ds-accent: var(--accent);
  --ds-accent-soft: var(--accent-soft);
  --ds-success: var(--success);
  --ds-success-soft: var(--success-soft);
  --ds-warning: #a05e00;
  --ds-warning-soft: rgba(160, 94, 0, 0.08);
}

.ds-studio-grid-1col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}
.ds-studio-grid-2col {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  width: 100%;
}
@media (max-width: 900px) {
  .ds-studio-grid-2col {
    grid-template-columns: 1fr;
  }
}

.ds-test-row span { color:var(--ds-muted-strong); font-size:13px; font-weight:800; }
.ds-test-row code { font-family:"SFMono-Regular",Consolas,monospace; font-size:13px; color:var(--ds-text); overflow-wrap:anywhere; }
.ds-train-console-head { display:flex; align-items:center; justify-content:space-between; margin:18px 0 8px; }
.ds-train-mini { display:flex; gap:6px; }
.ds-train-log { height:240px; overflow:auto; padding:14px; border:1px solid var(--ds-line); border-radius:8px; background:#161412; color:#d7e7c8; font-size:12.5px; line-height:1.5; white-space:pre-wrap; word-break:break-word; }

.dt-progress-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
  box-shadow: var(--shadow-card);
  margin-bottom: 16px;
}
.dt-progress-card.success {
  border-color: #badbd3;
  background: var(--ds-success-soft);
}
.dt-progress-card.failed {
  border-color: var(--ds-accent);
  background: var(--ds-accent-soft);
}
.dt-progress-card.cancelled {
  border-color: var(--ds-line);
  background: var(--ds-soft);
}
.dt-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dt-progress-action {
  font-weight: 800;
  font-size: 15px;
  color: var(--ds-text);
}
.dt-progress-pct {
  font-weight: 800;
  font-size: 20px;
  color: var(--ds-accent);
  border: 1px solid var(--border); border-radius: 14px; background:var(--card); box-shadow:var(--shadow-card); padding: 16px 20px; margin-bottom: 0;
}
.ds-studio .record-button { display: grid; width: 96px; height: 96px; place-items: center; border: 1px solid var(--ds-line); border-radius: 50%; background: #fff5f7; box-shadow: inset 0 0 0 10px #fff, 0 16px 38px rgba(238,45,85,.16); }
.ds-studio .record-button span { width: 32px; height: 32px; border-radius: 50%; background: var(--ds-accent); transition: border-radius .12s ease; }
.ds-studio .record-button.recording span { border-radius: 8px; }
.ds-studio .recording-detail { min-width: 0; }
.ds-studio .recording-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.ds-studio .timer-pill { min-width: 82px; padding: 8px 12px; border: 1px solid var(--ds-line); border-radius: 999px; background: var(--ds-soft); font-weight: 800; text-align: center; }
.ds-studio .meter-track { height: 12px; overflow: hidden; border-radius: 999px; background: var(--ds-soft); }
.ds-studio .meter-track span { display: block; width: 0%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--ds-success), var(--ds-accent)); transition: width .09s linear; }
.ds-studio .format-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 18px; }
.ds-studio .format-row span { min-height: 28px; padding: 5px 10px; border-radius: 999px; background: var(--ds-soft); color: var(--ds-muted-strong); font-size: 13px; font-weight: 800; }
.ds-playback-wrap { display: grid; gap: 8px; margin: 0 0 18px; }
.ds-playback-wrap audio { width: 100%; height: 38px; }
.ds-studio .record-fields { display: grid; grid-template-columns: minmax(160px, 240px) minmax(240px, 1fr); gap: 14px; }
.ds-studio .field-block { display: grid; gap: 8px; }
.ds-studio .text-input, .ds-studio .transcript-input { width: 100%; min-width: 0; border: 1px solid var(--ds-line); border-radius: 8px; background: var(--ds-surface); color: var(--ds-text); }
.ds-studio .text-input { min-height: 44px; padding: 10px 12px; }
.ds-studio .transcript-area { resize: vertical; }
.ds-studio .record-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }

.ds-studio .validation-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.ds-studio .validation-list li { min-height: 36px; padding: 10px 12px; border: 1px solid #f0d9a7; border-radius: 8px; background: var(--ds-warning-soft); color: var(--ds-warning); font-weight: 700; }
.ds-studio .validation-list .success-row { border-color: #badbd3; background: var(--ds-success-soft); color: var(--ds-success); }
.ds-studio .validation-list .muted-row { border-color: var(--ds-line); background: var(--ds-soft); color: var(--ds-muted); }

.ds-studio .import-panel { display: grid; grid-template-columns: minmax(320px, 1.1fr) minmax(240px, .9fr); gap: 18px; padding: 18px; }
.ds-studio .drop-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; flex: 1; min-height: 120px; padding: 16px; border: 1px dashed var(--ds-line-strong); border-radius: 8px; background: var(--ds-soft); transition: background 0.2s ease; }
.ds-studio .drop-zone.dragging { border-color: var(--ds-accent); background: var(--ds-accent-soft); }
.ds-studio .message-line { min-height: 20px; color: var(--ds-muted); }
.ds-studio .message-line[data-tone="success"] { color: var(--ds-success); }
.ds-studio .message-line[data-tone="warning"] { color: var(--ds-warning); }
.ds-studio .format-card { padding: 20px; border: 1px solid var(--ds-line); border-radius: 8px; background: var(--ds-surface); }
.ds-studio pre { margin: 0; overflow: auto; color: var(--ds-muted-strong); line-height: 1.45; }

.ds-studio .table-wrap { overflow: auto; border: 1px solid var(--ds-line); border-radius: 8px; }
.ds-studio table { width: 100%; min-width: 720px; border-collapse: collapse; }
.ds-studio th, .ds-studio td { padding: 12px; border-bottom: 1px solid var(--ds-line); text-align: left; vertical-align: middle; }
.ds-studio th { background: var(--ds-soft); color: var(--ds-muted-strong); font-size: 13px; }
.ds-studio tr:last-child td { border-bottom: 0; }
.ds-studio .path-cell { width: 28%; color: var(--ds-muted-strong); overflow-wrap: anywhere; }
.ds-studio .transcript-input { min-height: 38px; padding: 0 10px; }
.ds-studio .format-cell { width: 160px; color: var(--ds-warning); font-size: 13px; font-weight: 800; }
.ds-studio .format-cell[data-ok="true"] { color: var(--ds-success); }
.ds-studio .file-meta { width: 140px; color: var(--ds-muted); }
.ds-studio .empty-row { height: 80px; color: var(--ds-muted); text-align: center; }
.ds-studio .ds-action-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer; transition: all 0.2s ease; padding: 0; }
.ds-studio .ds-action-btn:hover { background: var(--ds-soft); border-color: var(--border-hover); }
.ds-studio .ds-action-btn svg { width: 14px; height: 14px; }
.ds-studio .ds-action-btn.play-btn { color: var(--success); }
.ds-studio .ds-action-btn.play-btn:hover { background: var(--success-soft); border-color: rgba(31, 111, 99, 0.25); }
.ds-studio .ds-action-btn.reveal-btn { color: var(--text); }
.ds-studio .ds-action-btn.reveal-btn:hover { background: var(--ds-soft); border-color: var(--border-hover); }
.ds-studio .ds-action-btn.delete-btn { color: var(--accent); }
.ds-studio .ds-action-btn.delete-btn:hover { background: var(--accent-soft); border-color: rgba(224, 30, 65, 0.25); }
.ds-studio .metadata-preview { min-height: 120px; padding: 16px; border: 1px solid var(--ds-line); border-radius: 8px; background: #161412; color: #eee7dc; white-space: pre-wrap; }

.ds-env-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ds-env { display: grid; gap: 6px; padding: 14px; border: 1px solid var(--ds-line); border-radius: 8px; background: var(--ds-soft); margin-bottom: 16px; }
.ds-env-row { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 12px; align-items: baseline; }
.ds-env-row > span { color: var(--ds-muted-strong); font-size: 12.5px; font-weight: 800; }
.ds-env-val { font-family: "SFMono-Regular", Consolas, monospace; font-size: 12.5px; overflow-wrap: anywhere; }
.ds-env-val.ok { color: var(--ds-success); }
.ds-env-val.bad { color: var(--ds-accent); }
.ds-env-val.neutral { color: var(--ds-text); }
.ds-train-status { padding: 10px 12px; border: 1px solid var(--ds-line); border-radius: 8px; background: var(--ds-soft); color: var(--ds-muted-strong); font-size: 13px; font-weight: 700; margin-bottom: 14px; }
.ds-train-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.ds-train-warn { margin: 14px 0 4px; padding: 10px 12px; border: 1px solid #f0d9a7; border-radius: 8px; background: var(--ds-warning-soft); color: var(--ds-warning); font-size: 13px; font-weight: 700; }
.ds-train-subhead { margin: 20px 0 8px; font-size: 13px; font-weight: 800; color: var(--ds-muted-strong); }
.ds-tools { margin-bottom: 10px; }
.ds-train-hint { margin: 8px 0 0; color: var(--ds-muted); font-size: 12.5px; }
.ds-train-hint code { font-family: "SFMono-Regular", Consolas, monospace; color: var(--ds-text); }
.ds-train-results:not(:empty) { margin-top: 14px; display: grid; gap: 14px; }
.ds-train-cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.ds-train-cards .metric-card { min-height: 78px; padding: 12px; }
.ds-train-cards .metric-card strong { font-size: 24px; margin-top: 8px; }
.ds-train-verdict { margin: 0; padding: 10px 12px; border-radius: 8px; font-weight: 800; }
.ds-train-verdict.ok { background: var(--ds-success-soft); color: var(--ds-success); border: 1px solid #badbd3; }
.ds-train-verdict.bad { background: var(--ds-warning-soft); color: var(--ds-warning); border: 1px solid #f0d9a7; }
.ds-test-block, .ds-model-info { display: grid; gap: 8px; padding: 14px; border: 1px solid var(--ds-line); border-radius: 8px; background: var(--ds-soft); }
.ds-model-info { margin-bottom: 14px; }
.ds-test-row { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 12px; align-items: start; }
.ds-test-row span { color: var(--ds-muted-strong); font-size: 13px; font-weight: 800; }
.ds-test-row code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; color: var(--ds-text); overflow-wrap: anywhere; }
.ds-train-console-head { display: flex; align-items: center; justify-content: space-between; margin: 18px 0 8px; }
.ds-train-mini { display: flex; gap: 6px; }
.ds-train-log { height: 240px; overflow: auto; padding: 14px; border: 1px solid var(--ds-line); border-radius: 8px; background: #161412; color: #d7e7c8; font-size: 12.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }

/* ──────────────────────────────────────────
   PREMIUM DEVELOPER DASHBOARD LAYOUT & CSS
   ────────────────────────────────────────── */

/* Two Column Dashboard */
.dt-dashboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
  width: 100%;
}
@media (max-width: 1150px) {
  .dt-dashboard {
    grid-template-columns: 1fr;
  }
  .dt-sidebar {
    position: static;
  }
}

.dt-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.dt-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 14px;
}

/* Sidebar Cards */
.dt-sidebar-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dt-sidebar-card .dt-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
  margin-bottom: 2px;
}
.dt-sidebar-card .dt-block-title {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.01em;
}

/* Environment chips layout */
.dt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dt-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  background: #f6f4f0;
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  transition: all 0.2s ease;
}
.dt-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-hover);
}
.dt-chip.ok .dt-dot {
  background: var(--ds-success);
  box-shadow: 0 0 0 2px var(--ds-success-soft);
}
.dt-chip.bad .dt-dot {
  background: var(--ds-accent);
  box-shadow: 0 0 0 2px var(--ds-accent-soft);
}
.dt-chip.warn .dt-dot {
  background: var(--ds-warning);
  box-shadow: 0 0 0 2px var(--ds-warning-soft);
}
.dt-chip-text {
  color: var(--text);
  font-weight: 750;
}

.dt-model {
  font-size: 11px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #f6f4f0;
  border: 1px solid var(--border);
  font-family: monospace;
  color: var(--ds-muted-strong);
  line-height: 1.4;
  word-break: break-all;
}

/* Premium tab button overrides */
.ds-studio .seg-btn:not(.seg-active) {
  opacity: 0.65;
  font-weight: 600;
}
.ds-studio .seg-btn:not(.seg-active):hover {
  opacity: 0.95;
}
.ds-studio .seg-btn.seg-active {
  background: var(--card);
  color: var(--text);
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border);
  padding: 6px 13px;
}

/* Stepper Card layout */
.dt-step-card {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  grid-template-areas:
    "no info status"
    ". actions actions";
  align-items: start;
  gap: 12px 16px;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
  box-shadow: var(--shadow-card);
  margin-bottom: 12px;
  transition: all 0.2s ease;
}
.dt-step-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-0.5px);
}
.dt-step-no {
  grid-area: no;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--sidebar-bg);
  color: var(--text);
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.dt-step-info {
  grid-area: info;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dt-step-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}
.dt-step-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.35;
}
.dt-step-helper {
  margin-top: 4px;
  font-size: 11px;
}
.dt-status-chip {
  grid-area: status;
  align-self: start;
}
.dt-actions {
  grid-area: actions;
  display: flex;
  gap: 8px;
  justify-content: flex-start;
  flex-wrap: wrap;
}

/* Status Chips */
.dt-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  border: 1px solid transparent;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.dt-status-chip.ready {
  background: var(--success-soft);
  color: var(--success);
  border-color: rgba(31, 111, 99, 0.15);
}
.dt-status-chip.locked {
  background: var(--ds-soft);
  color: var(--muted);
  border-color: var(--border);
}
.dt-status-chip.complete {
  background: rgba(160, 43, 176, 0.08);
  color: var(--purple);
  border-color: rgba(160, 43, 176, 0.15);
}
.dt-status-chip.failed {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: rgba(224, 30, 65, 0.15);
}
.dt-status-chip.missing {
  background: var(--ds-warning-soft);
  color: var(--ds-warning);
  border-color: rgba(160, 94, 0, 0.15);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--text);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  opacity: 0.95;
  transform: translateY(-0.5px);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-danger:hover {
  opacity: 0.9;
  transform: translateY(-0.5px);
}
.btn-danger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.btn-warning {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #d97706;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-warning:hover {
  opacity: 0.9;
  transform: translateY(-0.5px);
}
.btn-warning:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.ds-studio .dt-link {
  background: transparent;
  color: var(--ds-accent);
  padding: 0;
  border: none;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0.85;
  transition: all 0.2s ease;
  transform: none !important;
}
.ds-studio .dt-link:hover {
  opacity: 1;
  text-decoration: underline;
  background: transparent !important;
}
.ds-studio .dt-link:active {
  transform: scale(0.98) !important;
}

/* Terminal styled log console */
.dt-log-card {
  padding: 16px 20px;
  border-radius: 14px;
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}
.dt-log {
  height: 220px;
  overflow: auto;
  padding: 12px;
  border: 1px solid #2d2a27;
  border-radius: 8px;
  background: #110f0e;
  color: #e6e1da;
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "SFMono-Regular", Consolas, monospace;
}
.dt-log.collapsed {
  display: none;
}

/* Results & evaluation cards */
.ds-train-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}
.ds-train-cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 900px) {
  .ds-train-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
.ds-train-cards .metric-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ds-train-cards .metric-card span {
  font-size: 10.5px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.ds-train-cards .metric-card strong {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}
.ds-train-verdict {
  margin: 0;
  padding: 10px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 12.5px;
  border: 1px solid transparent;
}
.ds-train-verdict.ok {
  background: var(--ds-success-soft);
  color: var(--ds-success);
  border-color: rgba(31, 111, 99, 0.15);
}
.ds-train-verdict.bad {
  background: var(--ds-accent-soft);
  color: var(--ds-accent);
  border-color: rgba(224, 30, 65, 0.15);
}
.ds-test-block {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ds-test-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
  font-size: 12px;
  line-height: 1.4;
}
.ds-test-row span {
  font-weight: 750;
  color: var(--muted);
  text-transform: uppercase;
  font-size: 10.5px;
  letter-spacing: 0.05em;
}
.ds-test-row code {
  font-family: monospace;
  color: var(--text);
  overflow-wrap: anywhere;
  font-size: 12px;
}
`;
    document.head.appendChild(style);
  }

  // Inject the Admin nav item once (app.js rebinds its click each render).
  function injectNav() {
    const navItems = document.querySelector('.nav-items');
    if (!navItems || document.querySelector('[data-view="admin"]')) return;
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.view = 'admin';
    item.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>Admin';
    item.onclick = () => {
      if (typeof window.setView === 'function') {
        window.setView('admin');
      }
    };
    navItems.appendChild(item);
  }

  // Boot: register the pluggable view + nav. Data loads lazily on first wire().
  injectStyles();
  window.__parayuViews = window.__parayuViews || {};
  window.__parayuViews.admin = { render, wire };
  injectNav();
})();
