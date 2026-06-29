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
    language: 'ml',
    task: 'translate',
    trainEpochs: 12,
    trainGradAccum: 2,
    groqApiKey: (() => { try { return localStorage.getItem('parayu-admin-groq-key') || ''; } catch (_) { return ''; } })(),
    groqChecks: {}, // clip_path -> { loading, text, error }
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
    },
    // Bulk Media Workflow state (7-step guided workflow for long video/audio)
    wf: {
      step: 1,          // current workflow step (1-6)
      imported: null,    // { filename, size, duration, path, isVideo }
      extracted: null,   // { path }
      clipCount: 0,
      drafts: [],        // [ { clip_path, draft_transcript, duration, status } ]
      busy: false,
      clipLength: 20,    // default clip duration in seconds
      importUrl: '',     // YouTube URL pasted into Step 1
      importingUrl: false, // true while the yt-dlp download is in progress
      builtCount: 0,     // clips written by the last successful Build Dataset
      playingClipIdx: -1, // index of currently playing clip in review
      groqBatchLoading: false
    },
    // Transcript Studio state (natively integrated)
    ts: {
      url: 'https://www.youtube.com/watch?v=D792UT8G9zk',
      videoId: '',
      windowSeconds: 30,
      rows: [],
      loading: false,
      search: '',
      trainingClean: false,
      activeId: null,
      isPlaying: false
    }
  };

  let el = {};
  const root = () => document.querySelector('.ds-studio');

  // Training-panel state (survives re-renders) + a rolling log buffer that the
  // streamed 'train-log' lines append to.
  const T = { running: false, validationPassed: false, validation: null, lastTest: null, lastTestBase: null, lastTestTrained: null, model: null, env: null, tools: null, trained: false };
  const MIN_TRAIN_CLIPS = 10;
  const logBuffer = [];
  let progressTimerId = null;
  let progressStartTimestamp = null;
  let activeWfClipUrl = null;
  let activeTrainTestUrl = null;
  let trainTestPlayingKey = null; // e.g. "base-3" or "trained-7", or null when nothing is playing
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
      trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
      search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
      copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
      languages: '<path d="M5 8h10M4 14h12M9 5v3M12 11a5 5 0 0 1-5 5M12 17c0-2-3-4-5-4M2 22l6-6M13 22l6-6"/>',
      wand: '<path d="m15 4-2 2L6 13l2 2 7-7 2-2zM19 9l1.5-1.5L22 9l-1.5 1.5L19 9zM5 3v2M3 5h2"/>',
      upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'
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
    setLogExpanded(true);
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

    // Mirrors a step's own badge onto its trigger button — the badge sits in
    // the corner of the card and is easy to miss; turning the button itself
    // green on success puts the same signal exactly where attention already
    // is right after clicking it.
    function setButtonDone(btn, done) {
      if (!btn) return;
      btn.classList.toggle('btn-step-done', !!done);
    }

    // Step 1: Verification
    if (T.runningTask === 'validate') {
      setChip(chip1, 'Running', 'ready');
    } else if (!v) {
      setChip(chip1, 'Missing', 'missing');
    } else if (!validationPassed) {
      setChip(chip1, 'Failed', 'failed');
    } else {
      setChip(chip1, 'Complete', 'complete');
    }
    setButtonDone(el.validateBtn, v && validationPassed);

    // Step 2: Baseline Test
    if (T.runningTask === 'test-base') {
      setChip(chip2, 'Running', 'ready');
    } else if (T.lastTest && T.lastTest.which === 'Base model') {
      setChip(chip2, 'Complete', 'complete');
    } else {
      setChip(chip2, 'Ready', 'ready');
    }
    setButtonDone(el.testBaseBtn, T.lastTest && T.lastTest.which === 'Base model');

    // Step 3: Training
    if (T.runningTask === 'train') {
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
    setButtonDone(el.trainStartBtn, isTrained);

    // Step 4: Evaluate Tuned Adapter
    if (T.runningTask === 'test-trained') {
      setChip(chip4, 'Running', 'ready');
    } else if (!isTrained) {
      setChip(chip4, 'Locked', 'locked');
    } else if (T.lastTest && T.lastTest.which === 'Trained model') {
      setChip(chip4, 'Complete', 'complete');
    } else {
      setChip(chip4, 'Ready', 'ready');
    }
    setButtonDone(el.testTrainedBtn, T.lastTest && T.lastTest.which === 'Trained model');

    // Step 5: Export & Merge
    if (T.runningTask === 'export') {
      setChip(chip5, 'Running', 'ready');
    } else if (!isTrained) {
      setChip(chip5, 'Locked', 'locked');
    } else if (t && t.mergedExists) {
      setChip(chip5, 'Complete', 'complete');
    } else {
      setChip(chip5, 'Ready', 'ready');
    }
    setButtonDone(el.exportBtn, t && t.mergedExists);

    // Step 6: GGML Conversion
    if (T.runningTask === 'convert' || T.runningTask === 'setup-tools') {
      setChip(chip6, 'Running', 'ready');
    } else if (!t || !t.mergedExists) {
      setChip(chip6, 'Locked', 'locked');
    } else if (t && t.convertedExists) {
      setChip(chip6, 'Complete', 'complete');
    } else {
      setChip(chip6, 'Ready', 'ready');
    }
    setButtonDone(el.setupToolsBtn, t && t.whisperCppCloned && t.quantizeBuilt);
    setButtonDone(el.convertBtn, t && t.convertedExists);

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
      // Setup is only tool preparation (clone + build whisper.cpp) — it never
      // touches the dataset, trained model, or production app model. Allow it
      // anytime the environment has been probed, independent of Export/merge.
      el.setupToolsBtn.disabled = T.running || !T.env;
    }
    if (el.convertBtn) {
      const ready = !!(t && t.mergedExists && t.quantizeBuilt);
      el.convertBtn.disabled = T.running || !ready;
    }
  }

  function setTrainRunning(on, statusText, taskName) {
    T.running = on;
    // Which specific step is running, not just "is anything running" — a
    // single shared boolean made every step's badge that checked it show
    // "Running" simultaneously regardless of which one actually triggered it
    // (e.g. Step 3's Training badge lit up while Step 2's Base Model Test was
    // the thing actually executing). Each step's badge now checks its own
    // task name against this instead.
    T.runningTask = on ? (taskName || null) : null;
    [el.validateBtn, el.testBaseBtn, el.testTrainedBtn, el.exportBtn, el.setupToolsBtn, el.convertBtn, el.backupBtnM, el.replaceBtn, el.restoreBtn,
      document.getElementById('ds-install-dev-model'), document.getElementById('ds-revert-dev-model'), document.getElementById('ds-reset-pipeline')]
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

    const which = isTrainedModel ? 'trained' : 'base';
    const clips = t.clips || [];
    const rowsHtml = clips.map((clip, idx) => {
      const playKey = which + '-' + idx;
      const isPlaying = trainTestPlayingKey === playKey;
      const playBtn = `<button type="button" class="train-play-clip" data-which="${which}" data-idx="${idx}" title="${isPlaying ? 'Pause' : 'Play'} ${esc(clip.audio.split('/').pop())}" style="width: 26px; height: 26px; border-radius: 999px; border: 1px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; font-size: 10px; display: inline-flex; align-items: center; justify-content: center;">${isPlaying ? '⏸' : '▶'}</button>`;

      if (clip.error) {
        return `
          <tr style="border-bottom: 1px dashed var(--border);">
            <td style="padding: 6px; text-align: center;">${playBtn}</td>
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
          <td style="padding: 6px; text-align: center;">${playBtn}</td>
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
              <th style="padding: 6px; text-align: center; width: 6%;">Play</th>
              <th style="padding: 6px; width: 18%;">Clip</th>
              <th style="padding: 6px; width: 28%;">Expected</th>
              <th style="padding: 6px; width: 28%;">Output</th>
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

    containerEl.querySelectorAll('.train-play-clip').forEach((btn) => {
      btn.addEventListener('click', () => {
        playTrainTestClip(btn.dataset.which, parseInt(btn.dataset.idx, 10));
      });
    });
  }

  async function playTrainTestClip(which, idx) {
    const t = which === 'trained' ? T.lastTestTrained : T.lastTestBase;
    const clip = t && t.clips && t.clips[idx];
    if (!clip || clip.error) return;

    const player = document.getElementById('train-test-player');
    if (!player) return;

    const key = which + '-' + idx;
    if (trainTestPlayingKey === key && !player.paused) {
      player.pause();
      trainTestPlayingKey = null;
      renderTrainResults();
      return;
    }

    try {
      const bytes = await api.readAudioFile(S.projectDir, clip.audio);
      if (activeTrainTestUrl) {
        URL.revokeObjectURL(activeTrainTestUrl);
        activeTrainTestUrl = null;
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      activeTrainTestUrl = URL.createObjectURL(blob);
      player.src = activeTrainTestUrl;
      player.onended = () => {
        trainTestPlayingKey = null;
        renderTrainResults();
      };
      await player.play();
      trainTestPlayingKey = key;
      renderTrainResults();
    } catch (err) {
      alert('Failed to play clip: ' + err.message);
    }
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
        <div class="metric-card"><span>Script mismatches</span><strong>${(v.script_mismatch || []).length}</strong></div>
      </div>
      ${(v.script_mismatch || []).length > 0 ? `<p style="color: var(--danger, #c0392b); font-size: 12px; margin: 6px 0;">Some transcripts don't match the expected output script for the selected Language &amp; Task above. Whisper's language flag controls OUTPUT script (transcribe) or forces English (translate) — fix the mismatched clips or the Language &amp; Task selector before training.</p>` : ''}
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
    setTrainRunning(true, 'Validating dataset…', 'validate');
    const res = await api.trainValidate({ projectDir: S.projectDir, language: S.language, task: S.task });
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
    setTrainRunning(true, 'Testing base model (first run downloads openai/whisper-small)…', 'test-base');
    const res = await api.trainTestBase({ projectDir: S.projectDir, language: S.language, task: S.task });
    
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
    setTrainRunning(true, 'Training… watch the logs below.', 'train');
    const res = await api.trainStart({
      projectDir: S.projectDir,
      language: S.language,
      task: S.task,
      epochs: S.trainEpochs,
      gradAccum: S.trainGradAccum
    });
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
    setTrainRunning(true, 'Testing trained model…', 'test-trained');
    const res = await api.trainTestTrained({ projectDir: S.projectDir, language: S.language, task: S.task });
    
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
    setTrainRunning(true, 'Exporting merged model…', 'export');
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
    setTrainRunning(true, 'Setting up whisper.cpp tools (clone + build)…', 'setup-tools');
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
    setTrainRunning(true, 'Converting to GGML / Q5_1…', 'convert');
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

  // Clears Steps 3/5/6's artifacts (adapter, merged model, converted .bin) so
  // their badges/buttons go back to Locked/Ready — separate from "Reset
  // Workflow" (Bulk Media Workflow only) and from App Model Management /
  // Dev App Model (neither of which this touches).
  async function doResetPipeline() {
    if (!window.confirm('Reset the Training Pipeline?\n\nThis deletes the trained LoRA adapter, the merged model, and the converted .bin from output/ — Steps 3, 5, and 6 go back to Locked/Ready.\n\nYour dataset (data/) and any installed app model are NOT touched.')) return;
    setTrainRunning(true, 'Resetting training pipeline…', 'reset-pipeline');
    const res = await api.trainResetPipeline({ projectDir: S.projectDir });
    appendLog(res && res.ok ? `Reset training pipeline — removed: ${(res.removed || []).join(', ') || '(nothing to remove)'}` : `Reset failed: ${res && res.error}`);
    T.trained = false;
    T.lastTestTrained = null;
    // T.lastTest is shared between Step 2 and Step 4's "Complete" check —
    // only clear it if it's currently pointing at a trained-model result, so
    // a base-model test result (unaffected by this reset) isn't wiped too.
    if (T.lastTest && T.lastTest.which === 'Trained model') T.lastTest = null;
    await refreshTools();
    setTrainRunning(false, res && res.ok ? 'Training pipeline reset ✓' : `Reset failed: ${res && res.error}`);
  }

  async function doCancel() {
    await api.trainCancel();
  }

  async function doBackup() {
    setTrainRunning(true, 'Backing up current model…', 'backup');
    const res = await api.backupModel({ projectDir: S.projectDir });
    appendLog(res && res.ok ? `Backed up model → ${res.path}` : `Backup failed: ${res && res.error}`);
    await refreshModelInfo();
    setTrainRunning(false, res && res.ok ? 'Current model backed up.' : `Backup failed: ${res && res.error}`);
  }

  async function doReplace() {
    if (!window.confirm('Replace the app model (ggml-small-q5_1.bin)?\n\nThe current model is backed up first. If you don\'t choose a file, output/ggml-small-q5_1.bin is used. The English model is never touched.\n\nRestart Parayu afterward to load the new model.')) return;
    setTrainRunning(true, 'Replacing app model…', 'replace');
    const res = await api.replaceModel({ projectDir: S.projectDir, confirmed: true });
    appendLog(res && res.ok ? `Replaced app model. Backup: ${res.backup || '(none)'}` : `Replace not done: ${res && res.error}`);
    await refreshModelInfo();
    setTrainRunning(false, res && res.ok ? 'App model replaced ✓ — restart Parayu to use it.' : `Replace not done: ${res && res.error}`);
  }

  async function doRestore() {
    if (!window.confirm('Restore the most recent model backup over the current app model?')) return;
    setTrainRunning(true, 'Restoring backup…', 'restore');
    const res = await api.restoreBackup({ projectDir: S.projectDir, confirmed: true });
    appendLog(res && res.ok ? `Restored from ${res.from}` : `Restore failed: ${res && res.error}`);
    await refreshModelInfo();
    setTrainRunning(false, res && res.ok ? 'Backup restored ✓ — restart Parayu to use it.' : `Restore failed: ${res && res.error}`);
  }

  // Installs the latest converted candidate into src/assets/models/ — the
  // file this dev build actually loads at runtime, distinct from the
  // App Model Management buttons above (which target the packaged-app's
  // model location and never touch this file).
  async function doInstallDevModel() {
    setTrainRunning(true, 'Installing new model into dev app…', 'install-dev-model');
    const res = await api.setReleaseModel({ projectDir: S.projectDir, confirmed: true });
    appendLog(res && res.ok
      ? `Installed dev app model ← ${res.replaced}${res.backup ? ' (backup: ' + res.backup + ')' : ''}`
      : `Install failed: ${res && res.error}`);
    await refreshModelInfo();
    setTrainRunning(false, res && res.ok ? 'Dev app model installed ✓ — restart Parayu to use it.' : `Install failed: ${res && res.error}`);
  }

  async function doRevertDevModel() {
    setTrainRunning(true, 'Reverting dev app model to backup…', 'revert-dev-model');
    const res = await api.restoreReleaseModel({ projectDir: S.projectDir, confirmed: true });
    appendLog(res && res.ok ? `Reverted dev app model ← ${res.from}` : `Revert failed: ${res && res.error}`);
    await refreshModelInfo();
    setTrainRunning(false, res && res.ok ? 'Dev app model reverted ✓ — restart Parayu to use it.' : `Revert failed: ${res && res.error}`);
  }

  // Generic hold-to-confirm: the action only fires if the button is held
  // continuously for durationMs — releasing early (pointerup/leave) cancels
  // with no effect. Used for actions that write to the file the dev build
  // actually loads, where a single accidental click should never be enough.
  function wireHoldToConfirm(btn, durationMs, onConfirm) {
    if (!btn) return;
    let timer = null;
    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      btn.classList.remove('holding');
    };
    const start = (ev) => {
      ev.preventDefault();
      if (btn.disabled || timer) return;
      btn.classList.add('holding');
      timer = setTimeout(() => {
        timer = null;
        btn.classList.remove('holding');
        onConfirm();
      }, durationMs);
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('pointercancel', cancel);
  }

  function wireTraining() {
    if (el.validateBtn) el.validateBtn.onclick = doValidate;
    if (el.langTaskSelect) {
      el.langTaskSelect.value = `${S.language}:${S.task}`;
      el.langTaskSelect.onchange = () => {
        const [lang, task] = el.langTaskSelect.value.split(':');
        S.language = lang;
        S.task = task;
      };
    }
    const epochsInput = document.getElementById('ds-train-epochs');
    if (epochsInput) {
      epochsInput.oninput = () => {
        const v = parseFloat(epochsInput.value);
        if (v > 0) S.trainEpochs = v;
      };
    }
    const gradAccumInput = document.getElementById('ds-train-gradaccum');
    if (gradAccumInput) {
      gradAccumInput.oninput = () => {
        const v = parseInt(gradAccumInput.value, 10);
        if (v > 0) S.trainGradAccum = v;
      };
    }
    if (el.testBaseBtn) el.testBaseBtn.onclick = doTestBase;
    if (el.trainStartBtn) el.trainStartBtn.onclick = doTrainStart;
    if (el.testTrainedBtn) el.testTrainedBtn.onclick = doTestTrained;
    if (el.exportBtn) el.exportBtn.onclick = doExport;
    if (el.setupToolsBtn) el.setupToolsBtn.onclick = doSetupTools;
    if (el.convertBtn) el.convertBtn.onclick = doConvert;
    const resetPipelineBtn = document.getElementById('ds-reset-pipeline');
    if (resetPipelineBtn) resetPipelineBtn.onclick = doResetPipeline;
    if (el.trainCancel) el.trainCancel.onclick = doCancel;
    if (el.progressCancel) el.progressCancel.onclick = doCancel;
    if (el.backupBtnM) el.backupBtnM.onclick = doBackup;
    if (el.replaceBtn) el.replaceBtn.onclick = doReplace;
    if (el.restoreBtn) el.restoreBtn.onclick = doRestore;
    wireHoldToConfirm(document.getElementById('ds-install-dev-model'), 5000, doInstallDevModel);
    wireHoldToConfirm(document.getElementById('ds-revert-dev-model'), 5000, doRevertDevModel);
    if (el.openOutputBtn) el.openOutputBtn.onclick = () => api.openTrainingOutput({ projectDir: S.projectDir });
    if (el.clearLogBtn) el.clearLogBtn.onclick = () => { logBuffer.length = 0; if (el.trainLog) el.trainLog.textContent = ''; };
    if (el.envRefresh) el.envRefresh.onclick = refreshEnv;
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

    // Restore panel state into the freshly-rendered DOM.
    if (el.trainLog) {
      el.trainLog.textContent = logBuffer.join('\n');
      if (logExpanded) {
        el.trainLog.scrollTop = el.trainLog.scrollHeight;
      }
    }
    renderTrainResults();
    renderEnv();
    renderTools();
    setTrainRunning(T.running, T.running ? 'Task running…' : 'Idle.');
    refreshModelInfo();
    if (!T.running) { refreshEnv(); refreshTools(); }
  }

  // ─── Bulk Media Workflow HTML helpers ────────────────────────────────────────
  function wfRenderStepsBar() {
    const steps = [
      { n: 1, label: 'Import' },
      { n: 2, label: 'Extract' },
      { n: 3, label: 'Split' },
      { n: 4, label: 'Review' },
      { n: 5, label: 'Build' }
    ];
    return steps.map(function(s, i) {
      var done = S.wf.step > s.n;
      var active = S.wf.step === s.n;
      var bg = done ? 'var(--ds-success)' : active ? 'var(--accent)' : 'var(--ds-line)';
      var textColor = done || active ? '#fff' : 'var(--muted)';
      var labelColor = done ? 'var(--ds-success)' : active ? 'var(--accent)' : 'var(--muted)';
      var connector = i < steps.length - 1
        ? '<div style="position: absolute; top: 10px; left: calc(50% + 13px); width: calc(100% - 26px); height: 2px; background: ' + (done ? 'var(--ds-success)' : 'var(--ds-line)') + '; z-index: 0;"></div>'
        : '';
      return '<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative;">'
        + '<div style="width: 22px; height: 22px; border-radius: 50%; background: ' + bg + '; display: grid; place-items: center; font-size: 10px; font-weight: 800; color: ' + textColor + '; z-index: 1; transition: all 0.25s ease;">' + (done ? '✓' : s.n) + '</div>'
        + '<span style="font-size: 9px; font-weight: 700; color: ' + labelColor + '; text-transform: uppercase; letter-spacing: 0.04em;">' + s.label + '</span>'
        + connector
        + '</div>';
    }).join('');
  }

  function wfRenderReviewList() {
    if (S.wf.drafts.length === 0) {
      return '<p style="text-align: center; color: var(--muted); font-size: 11px; padding: 20px;">No drafts to review.</p>';
    }
    return S.wf.drafts.map(function(d, i) {
      var statusColor = d.status === 'accepted' ? 'var(--ds-success)' : d.status === 'rejected' ? 'var(--accent)' : 'var(--ds-warning)';
      var statusBg = d.status === 'accepted' ? 'var(--ds-success-soft)' : d.status === 'rejected' ? 'var(--accent-soft)' : 'var(--ds-warning-soft)';
      var clipName = d.clip_path.split('/').pop();
      var acceptedStyle = d.status === 'accepted' ? ' background: var(--ds-success-soft);' : '';
      var rejectedStyle = d.status === 'rejected' ? ' background: var(--accent-soft);' : '';
      var safeText = (d.draft_transcript || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return '<div class="wf-review-item" style="padding: 14px 16px; border: 1px solid var(--ds-line); border-radius: 10px; background: var(--card); display: flex; gap: 12px; align-items: flex-start;" data-wf-idx="' + i + '">'
        + '<div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 32px;">'
        + '<span style="font-size: 9px; font-weight: 800; color: var(--muted);">#' + (i + 1) + '</span>'
        + '<button class="wf-play-clip" data-wf-clip="' + i + '" type="button" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--ds-line); background: var(--ds-soft); display: grid; place-items: center; cursor: pointer; padding: 0;" title="Play clip">'
        + '<span style="width: 10px; height: 10px; color: var(--accent); display: flex;">' + setIcon('play') + '</span>'
        + '</button>'
        + '</div>'
        + '<div style="flex: 1; min-width: 0;">'
        + '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">'
        + '<span class="mono" style="font-size: 9.5px; color: var(--muted);">' + clipName + '</span>'
        + '<span style="font-size: 9px; color: var(--muted);">' + formatDuration(d.duration || 0) + '</span>'
        + '<span style="font-size: 9px; padding: 1px 6px; border-radius: 999px; background: ' + statusBg + '; color: ' + statusColor + '; font-weight: 700; text-transform: uppercase;">' + d.status + '</span>'
        + '</div>'
        + '<textarea class="wf-draft-text text-input" data-wf-text="' + i + '" style="width: 100%; padding: 8px 10px; font-size: 11.5px; line-height: 1.5; border: 1px solid var(--border); border-radius: 6px; min-height: 72px; resize: vertical; font-family: inherit;" placeholder="Correct the English text...">' + safeText + '</textarea>'
        + '</div>'
        + '<div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">'
        + '<button class="wf-accept-clip btn-soft" data-wf-accept="' + i + '" type="button" style="padding: 2px 8px; font-size: 9.5px; font-weight: 700; color: var(--ds-success); border-color: var(--ds-success);' + acceptedStyle + '">✓</button>'
        + '<button class="wf-reject-clip btn-soft" data-wf-reject="' + i + '" type="button" style="padding: 2px 8px; font-size: 9.5px; font-weight: 700; color: var(--accent); border-color: var(--accent);' + rejectedStyle + '">✗</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // Renders transcript window #i and clip draft #i as a single combined row
  // (both halves side-by-side inside one element) instead of two
  // independently-scrolling columns. Two separate lists drift apart visually
  // the moment row heights differ between sides (longer caption text vs.
  // shorter draft text, etc.) — a shared scroll position doesn't help once
  // cumulative per-row heights diverge. Locking both halves into one row
  // makes that drift structurally impossible: the row's height is just
  // max(left height, right height), so #13 left is always beside #13 right.
  function wfRenderAlignedRows() {
    var formatCueTime = function(ms) {
      var totalMs = Math.max(0, Math.floor(Number(ms) || 0));
      var hours = Math.floor(totalMs / 3600000);
      var minutes = Math.floor((totalMs % 3600000) / 60000);
      var seconds = Math.floor((totalMs % 60000) / 1000);
      var millis = totalMs % 1000;
      return (hours < 10 ? '0' + hours : hours) + ':'
        + (minutes < 10 ? '0' + minutes : minutes) + ':'
        + (seconds < 10 ? '0' + seconds : seconds) + ','
        + (millis < 100 ? (millis < 10 ? '00' + millis : '0' + millis) : millis);
    };
    var cleanTextFn = function(txt) {
      return String(txt || '')
        .toLowerCase()
        .replace(/\?/g, "")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/[,.]/g, "")
        .replace(/\s+([;:!])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
    };
    var shortTime = function(ms) {
      var total = Math.max(0, Math.floor(Number(ms) / 1000));
      var minutes = Math.floor(total / 60);
      var seconds = total % 60;
      return (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds);
    };

    var query = (S.ts.search || '').trim().toLowerCase();
    var total = Math.max(S.ts.rows.length, S.wf.drafts.length);
    var rowsHtml = '';

    for (var i = 0; i < total; i++) {
      var item = S.ts.rows[i];
      var d = S.wf.drafts[i];

      if (query) {
        var matches = false;
        if (item) {
          var text = item.text || '';
          var clean = cleanTextFn(text);
          var timeStr = formatCueTime(item.start);
          matches = text.toLowerCase().includes(query) || clean.includes(query) || timeStr.includes(query);
        }
        if (!matches && d) {
          matches = (d.draft_transcript || '').toLowerCase().includes(query);
        }
        if (!matches) continue;
      }

      var leftHtml;
      if (item) {
        var textDisplay = S.ts.trainingClean ? cleanTextFn(item.text) : item.text;
        var rowActive = S.ts.activeId === item.start;
        var rowActiveBtnClass = rowActive && S.ts.isPlaying ? 'active' : '';
        leftHtml = '<div class="ts-row" style="display: grid; grid-template-columns: 88px minmax(0, 1fr) 32px; gap: 12px;" data-start="' + item.start + '">'
          + '<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">'
          + '<span class="ts-box-num" style="min-width: 20px; height: 16px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--text); color: var(--card); font-weight: 800; font-size: 9px;">#' + (i + 1) + '</span>'
          + '<button type="button" class="ts-row-play-btn ' + rowActiveBtnClass + '" data-start="' + item.start + '" style="width: 70px; height: 22px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: 1px solid var(--border); border-radius: 999px; color: var(--text); background: var(--card); font-weight: 700; font-size: 10px; cursor: pointer;">'
          + '<span style="width: 9px; height: 9px; color: var(--accent);">' + setIcon(rowActive && S.ts.isPlaying ? 'pause' : 'play') + '</span>'
          + '<span>' + shortTime(item.start) + '</span>'
          + '</button>'
          + '</div>'
          + '<div style="display: flex; flex-direction: column; gap: 6px;">'
          + '<span class="ts-subtitle-range" style="display: block; color: var(--muted); font-size: 9px; font-weight: 700;">' + formatCueTime(item.start) + ' --&gt; ' + formatCueTime(item.end) + '</span>'
          + '<p style="margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--text);">' + textDisplay + '</p>'
          + '</div>'
          + '<div style="display: flex; flex-direction: column; gap: 4px; align-self: start;">'
          + '<button type="button" class="ts-row-copy-btn btn-ghost" data-text="' + textDisplay.replace(/"/g, '&quot;') + '" style="padding: 4px 6px; height: 26px;" title="Copy this box to clipboard">'
          + '<span style="width: 13px; height: 13px;">' + setIcon('copy') + '</span>'
          + '</button>'
          + '<button type="button" class="ts-row-to-right-btn btn-ghost" data-row-index="' + i + '" style="padding: 4px 6px; height: 26px; font-weight: 800; font-size: 13px; color: var(--ds-success); border-color: var(--ds-success);" title="Copy this box to the matching Correct English Text box on the right">'
          + '<span>&rarr;</span>'
          + '</button>'
          + '</div>'
          + '</div>';
      } else {
        leftHtml = '<div style="padding: 14px 16px; border: 1px dashed var(--border); border-radius: 10px; color: var(--muted); font-size: 10.5px; display: flex; align-items: center; justify-content: center; min-height: 60px;">No transcript window #' + (i + 1) + '</div>';
      }

      var rightHtml;
      if (d) {
        var statusColor = d.status === 'accepted' ? 'var(--ds-success)' : d.status === 'rejected' ? 'var(--accent)' : 'var(--ds-warning)';
        var statusBg = d.status === 'accepted' ? 'var(--ds-success-soft)' : d.status === 'rejected' ? 'var(--accent-soft)' : 'var(--ds-warning-soft)';
        var clipName = d.clip_path.split('/').pop();
        var acceptedStyle = d.status === 'accepted' ? ' background: var(--ds-success-soft);' : '';
        var rejectedStyle = d.status === 'rejected' ? ' background: var(--accent-soft);' : '';
        var safeText = (d.draft_transcript || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        rightHtml = '<div class="wf-review-item" style="display: flex; gap: 12px; align-items: flex-start;" data-wf-idx="' + i + '">'
          + '<div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 32px;">'
          + '<span style="font-size: 9px; font-weight: 800; color: var(--muted);">#' + (i + 1) + '</span>'
          + '<button class="wf-play-clip" data-wf-clip="' + i + '" type="button" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--ds-line); background: var(--ds-soft); display: grid; place-items: center; cursor: pointer; padding: 0;" title="Play clip">'
          + '<span style="width: 10px; height: 10px; color: var(--accent); display: flex;">' + setIcon('play') + '</span>'
          + '</button>'
          + '</div>'
          + '<div style="flex: 1; min-width: 0;">'
          + '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">'
          + '<span class="mono" style="font-size: 9.5px; color: var(--muted);">' + clipName + '</span>'
          + '<span style="font-size: 9px; color: var(--muted);">' + formatDuration(d.duration || 0) + '</span>'
          + '<span style="font-size: 9px; padding: 1px 6px; border-radius: 999px; background: ' + statusBg + '; color: ' + statusColor + '; font-weight: 700; text-transform: uppercase;">' + d.status + '</span>'
          + '</div>'
          + '<textarea class="wf-draft-text text-input" data-wf-text="' + i + '" style="width: 100%; padding: 8px 10px; font-size: 11.5px; line-height: 1.5; border: 1px solid var(--border); border-radius: 6px; min-height: 72px; resize: vertical; font-family: inherit;" placeholder="Correct the English text...">' + safeText + '</textarea>'
          + (function() {
              var gc = S.groqChecks[d.clip_path];
              var btn = '<button class="wf-groq-check" data-wf-groq="' + i + '" type="button" style="margin-top: 6px; padding: 3px 8px; font-size: 9.5px; font-weight: 700; border: 1px solid var(--border); border-radius: 6px; background: var(--ds-soft); color: var(--text); cursor: pointer;"' + (gc && gc.loading ? ' disabled' : '') + '>' + (gc && gc.loading ? 'Checking…' : '\u{1F916} Check with Groq') + '</button>';
              var resultHtml = '';
              if (gc && gc.error) {
                resultHtml = '<div style="margin-top: 4px; font-size: 10px; color: var(--accent);">Groq: ' + gc.error.replace(/</g, '&lt;') + '</div>';
              } else if (gc && gc.text !== undefined && !gc.loading) {
                resultHtml = '<div style="margin-top: 4px; padding: 6px 8px; border-radius: 6px; background: var(--ds-soft); border: 1px dashed var(--border); font-size: 10.5px; color: var(--text); line-height: 1.4; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">'
                  + '<div style="flex: 1;"><strong style="color: var(--muted); font-weight: 700;">Groq says:</strong> ' + (gc.text || '(empty)').replace(/</g, '&lt;') + '</div>'
                  + '<button class="wf-groq-apply btn-soft" data-wf-apply="' + i + '" type="button" style="padding: 1px 6px; font-size: 9.5px; font-weight: 700; color: var(--ds-success); border-color: var(--ds-success); background: var(--card); cursor: pointer; flex-shrink: 0;">Apply</button>'
                  + '</div>';
              }
              return btn + resultHtml;
            })()
          + '</div>'
          + '<div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">'
          + '<button class="wf-accept-clip btn-soft" data-wf-accept="' + i + '" type="button" style="padding: 2px 8px; font-size: 9.5px; font-weight: 700; color: var(--ds-success); border-color: var(--ds-success);' + acceptedStyle + '">✓</button>'
          + '<button class="wf-reject-clip btn-soft" data-wf-reject="' + i + '" type="button" style="padding: 2px 8px; font-size: 9.5px; font-weight: 700; color: var(--accent); border-color: var(--accent);' + rejectedStyle + '">✗</button>'
          + '</div>'
          + '</div>';
      } else {
        rightHtml = '<div style="padding: 14px 16px; border: 1px dashed var(--border); border-radius: 10px; color: var(--muted); font-size: 10.5px; display: flex; align-items: center; justify-content: center; min-height: 60px;">No clip box #' + (i + 1) + '</div>';
      }

      rowsHtml += '<div style="display: flex; gap: 20px; align-items: stretch; padding: 14px 16px; border: 1px solid var(--ds-line); border-radius: 10px; background: var(--card);">'
        + '<div style="flex: 1.1; min-width: 0;">' + leftHtml + '</div>'
        + '<div style="flex: 0.9; min-width: 0; border-left: 1px dashed var(--border); padding-left: 20px;">' + rightHtml + '</div>'
        + '</div>';
    }

    if (!rowsHtml) {
      return '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 11px;">No rows to show.</div>';
    }
    return rowsHtml;
  }

  // ─── Transcript Studio Helpers ───
  function postPlayerCommand(iframe, func, args) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), '*');
    } catch (e) {
      console.error('Failed to post command to player:', e);
    }
  }

  async function tsCopyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      alert(message || 'Copied!');
    } catch (e) {
      var area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      alert(message || 'Copied!');
    }
  }

  function tsDownloadContent(filename, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }

  function tsBuildMetadataCsv() {
    var cleanTextFn = function(txt) {
      return String(txt || '')
        .toLowerCase()
        .replace(/\?/g, "")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/[,.]/g, "")
        .replace(/\s+([;:!])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
    };
    var formatCueTime = function(ms) {
      var totalMs = Math.max(0, Math.floor(Number(ms) || 0));
      var hours = Math.floor(totalMs / 3600000);
      var minutes = Math.floor((totalMs % 3600000) / 60000);
      var seconds = Math.floor((totalMs % 60000) / 1000);
      var millis = totalMs % 1000;
      return (hours < 10 ? '0' + hours : hours) + ':'
        + (minutes < 10 ? '0' + minutes : minutes) + ':'
        + (seconds < 10 ? '0' + seconds : seconds) + ','
        + (millis < 100 ? (millis < 10 ? '00' + millis : '0' + millis) : millis);
    };

    var csvEscape = function(val) {
      return '"' + String(val ?? '').replace(/"/g, '""') + '"';
    };

    var out = [['file_name', 'text', 'start', 'end']];
    S.ts.rows.forEach(function(item, index) {
      var text = cleanTextFn(item.text);
      if (!text) return;
      var fileIdx = String(index + 1);
      while (fileIdx.length < 4) fileIdx = '0' + fileIdx;
      out.push([
        'box_' + fileIdx + '.wav',
        text,
        formatCueTime(item.start),
        formatCueTime(item.end)
      ]);
    });

    return out.map(function(row) {
      return row.map(csvEscape).join(',');
    }).join('\n');
  }

  async function tsLoadTranscript(seconds, sourceUrl) {
    if (S.ts.loading) return;
    var targetUrl = sourceUrl !== undefined ? sourceUrl : S.ts.url;
    var targetSec = seconds !== undefined ? seconds : S.ts.windowSeconds;
    
    var id = S.ts.url.trim();
    // parse video id
    var parseVideoIdFn = function(val) {
      var trimmed = String(val).trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
      try {
        var url = new URL(trimmed);
        if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '').slice(0, 11);
        var watchId = url.searchParams.get('v');
        if (watchId) return watchId.slice(0, 11);
        var match = url.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
      } catch (e) {}
      return '';
    };

    var vid = parseVideoIdFn(targetUrl);
    if (!vid) {
      alert('Enter a valid YouTube URL');
      return;
    }
    
    S.ts.loading = true;
    S.ts.activeId = null;
    S.ts.isPlaying = false;
    wfReRender();
    
    try {
      var result = await api.workflowYoutubeTranscript(targetUrl, targetSec);
      if (result && result.ok) {
        S.ts.videoId = result.video.id;
        S.ts.rows = result.transcript || [];
        S.ts.windowSeconds = targetSec;
        S.ts.url = targetUrl;
        console.log('[TranscriptStudio] Loaded ' + S.ts.rows.length + ' boxes');
      } else {
        alert('Failed to load transcript: ' + (result.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Failed to fetch transcript: ' + e.message);
    } finally {
      S.ts.loading = false;
      wfReRender();
    }
  }

  function tsTogglePlay(startMs) {
    var startSeconds = Math.max(0, startMs / 1000);
    var playerIframe = document.getElementById('ts-player');
    
    if (S.ts.activeId === startMs) {
      if (S.ts.isPlaying) {
        postPlayerCommand(playerIframe, 'pauseVideo');
        S.ts.isPlaying = false;
      } else {
        postPlayerCommand(playerIframe, 'playVideo');
        S.ts.isPlaying = true;
      }
    } else {
      S.ts.activeId = startMs;
      S.ts.isPlaying = true;
      
      postPlayerCommand(playerIframe, 'seekTo', [startSeconds, true]);
      postPlayerCommand(playerIframe, 'playVideo');
      
      setTimeout(function() {
        var iframe = document.getElementById('ts-player');
        postPlayerCommand(iframe, 'seekTo', [startSeconds, true]);
        postPlayerCommand(iframe, 'playVideo');
      }, 500);
    }
    wfReRender();
  }

  function tsRenderStudio(part, noScroll) {
    var videoHtml = '';
    if (S.ts.videoId) {
      var params = new URLSearchParams({
        enablejsapi: '1',
        rel: '0',
        modestbranding: '1',
        playsinline: '1'
      });
      // No `origin` param: the app loads via loadFile() (file:// origin), not
      // a real https domain. YouTube's IFrame API validates postMessage
      // commands (playVideo/seekTo) against whatever origin is declared here —
      // a mismatched fake origin makes it silently ignore every command, so
      // the player loads but the row "play" buttons do nothing. Omitting it
      // is YouTube's own documented fallback for pages with no real origin.
      if (S.ts.activeId !== null) {
        params.set('autoplay', '1');
        params.set('start', String(Math.max(0, Math.floor(S.ts.activeId / 1000))));
      }
      var embedSrc = 'https://www.youtube.com/embed/' + S.ts.videoId + '?' + params.toString();
      videoHtml = '<div class="ts-video-box" style="position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 10px; overflow: hidden; background: #000; border: 1px solid var(--border);">'
        + '<iframe id="ts-player" title="YouTube preview" src="' + embedSrc + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"></iframe>'
        + '</div>';
    } else {
      videoHtml = '<div class="ts-video-empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 180px; color: var(--muted); background: var(--ds-soft); border: 1px dashed var(--border); border-radius: 10px; font-size: 12px;">'
        + '<span style="width: 28px; height: 28px; color: var(--muted);">' + setIcon('play') + '</span>'
        + '<span>Load a YouTube URL to begin</span>'
        + '</div>';
    }

    // Window length is fixed at 30s — Whisper's encoder truncates anything
    // longer regardless, so the 5/10/20s picker only offered options that
    // were strictly worse, while crowding the toolbar enough to wrap onto a
    // second line in narrower layouts (e.g. inside the Step 4 review panel).
    var tabsHtml = '';

    var cleanActiveClass = S.ts.trainingClean ? 'active' : '';
    var actionButtons = '<div class="ts-search-row" style="display: flex; gap: 6px; align-items: center; margin-top: 8px;">'
      + '<span style="width: 14px; height: 14px; color: var(--muted); display: flex; flex-shrink: 0;">' + setIcon('search') + '</span>'
      + '<input id="ts-search-input" value="' + S.ts.search + '" placeholder="Search transcript" style="flex: 1; min-width: 0; height: 28px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 11.5px;" />'
      + '<button id="ts-btn-auto-fill" class="btn-soft" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: var(--ds-success); border-color: var(--ds-success); white-space: nowrap;" title="Copy all to right translation boxes">'
      + '<span>Copy All to Right ➔</span>'
      + '</button>'
      + '<button id="ts-btn-clean" class="btn-ghost ' + cleanActiveClass + '" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" title="Clean text for model training">'
      + '<span style="width: 13px; height: 13px;">' + setIcon('wand') + '</span>'
      + '<span>Clean</span>'
      + '</button>'
      + '</div>';

    var listHtml = '';
    var query = S.ts.search.trim().toLowerCase();
    var cleanTextFn = function(txt) {
      return String(txt || '')
        .toLowerCase()
        .replace(/\?/g, "")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/[,.]/g, "")
        .replace(/\s+([;:!])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
    };
    var formatCueTime = function(ms) {
      var totalMs = Math.max(0, Math.floor(Number(ms) || 0));
      var hours = Math.floor(totalMs / 3600000);
      var minutes = Math.floor((totalMs % 3600000) / 60000);
      var seconds = Math.floor((totalMs % 60000) / 1000);
      var millis = totalMs % 1000;
      return (hours < 10 ? '0' + hours : hours) + ':'
        + (minutes < 10 ? '0' + minutes : minutes) + ':'
        + (seconds < 10 ? '0' + seconds : seconds) + ','
        + (millis < 100 ? (millis < 10 ? '00' + millis : '0' + millis) : millis);
    };
    var shortTime = function(ms) {
      var total = Math.max(0, Math.floor(Number(ms) / 1000));
      var minutes = Math.floor(total / 60);
      var seconds = total % 60;
      return (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds);
    };

    var filtered = S.ts.rows.filter(function(item) {
      var text = item.text || '';
      var clean = cleanTextFn(text);
      var timeStr = formatCueTime(item.start);
      return !query || text.toLowerCase().includes(query) || clean.includes(query) || timeStr.includes(query);
    });

    if (filtered.length === 0) {
      listHtml = '<div class="ts-empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; border-radius: 8px; color: var(--muted); text-align: center; background: var(--ds-soft); border: 1px dashed var(--border); font-size: 11px; margin-top: 10px;">'
        + '<span style="width: 20px; height: 20px; color: var(--muted);">' + setIcon('globe') + '</span>'
        + '<strong>No transcript yet</strong>'
        + '<span>Load a YouTube URL, then pick a 5s, 10s, 20s, or 30s window.</span>'
        + '</div>';
    } else {
      var listStyle = noScroll
        ? 'margin-top: 10px; display: flex; flex-direction: column; gap: 14px;'
        : 'flex: 1; min-height: 250px; max-height: 380px; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 14px; padding-right: 4px;';
      listHtml = '<div class="ts-list" style="' + listStyle + '">';
      filtered.forEach(function(item) {
        var idx = S.ts.rows.indexOf(item) + 1;
        var rowActive = S.ts.activeId === item.start;
        var rowActiveBtnClass = rowActive && S.ts.isPlaying ? 'active' : '';
        var textDisplay = S.ts.trainingClean ? cleanTextFn(item.text) : item.text;
        
        listHtml += '<div class="ts-row" style="display: grid; grid-template-columns: 88px minmax(0, 1fr) 32px; gap: 12px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); transition: all 0.15s ease;" data-start="' + item.start + '">'
          + '<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">'
          + '<span class="ts-box-num" style="min-width: 20px; height: 16px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--text); color: var(--card); font-weight: 800; font-size: 9px;">#' + idx + '</span>'
          + '<button type="button" class="ts-row-play-btn ' + rowActiveBtnClass + '" data-start="' + item.start + '" style="width: 70px; height: 22px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: 1px solid var(--border); border-radius: 999px; color: var(--text); background: var(--card); font-weight: 700; font-size: 10px; cursor: pointer;">'
          + '<span style="width: 9px; height: 9px; color: var(--accent);">' + setIcon(rowActive && S.ts.isPlaying ? 'pause' : 'play') + '</span>'
          + '<span>' + shortTime(item.start) + '</span>'
          + '</button>'
          + '</div>'
          + '<div style="display: flex; flex-direction: column; gap: 6px;">'
          + '<span class="ts-subtitle-range" style="display: block; color: var(--muted); font-size: 9px; font-weight: 700;">' + formatCueTime(item.start) + ' --&gt; ' + formatCueTime(item.end) + '</span>'
          + '<p style="margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--text);">' + textDisplay + '</p>'
          + '</div>'
          + '<div style="display: flex; flex-direction: column; gap: 4px; align-self: start;">'
          + '<button type="button" class="ts-row-copy-btn btn-ghost" data-text="' + textDisplay.replace(/"/g, '&quot;') + '" style="padding: 4px 6px; height: 26px;" title="Copy this box to clipboard">'
          + '<span style="width: 13px; height: 13px;">' + setIcon('copy') + '</span>'
          + '</button>'
          + '<button type="button" class="ts-row-to-right-btn btn-ghost" data-row-index="' + (idx - 1) + '" style="padding: 4px 6px; height: 26px; font-weight: 800; font-size: 13px; color: var(--ds-success); border-color: var(--ds-success);" title="Copy this box to the matching Correct English Text box on the right">'
          + '<span>&rarr;</span>'
          + '</button>'
          + '</div>'
          + '</div>';
      });
      listHtml += '</div>';
    }

    if (part === 'video') return videoHtml;
    if (part === 'tabs') return tabsHtml;
    if (part === 'actions') return actionButtons;
    if (part === 'list') return listHtml;

    var loadDis = S.ts.loading ? 'disabled' : '';

    return '<div class="ts-panel" style="display: flex; flex-direction: column; gap: 10px; height: 100%; width: 100%;">'
      + '<style>'
      + '  .ts-tab-btn { padding: 4px 8px; font-size: 11px; border: 1px solid var(--border); border-radius: 4px; background: var(--card); color: var(--muted); cursor: pointer; font-weight: 600; transition: all 0.15s ease; }'
      + '  .ts-tab-btn.active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }'
      + '  .ts-row-play-btn.active { color: #fff !important; background: var(--accent) !important; border-color: var(--accent) !important; }'
      + '  .ts-btn-clean.active { background: var(--accent-soft) !important; color: var(--accent) !important; border-color: var(--accent) !important; }'
      + '</style>'
      + '<div class="ts-import" style="display: flex; gap: 6px; align-items: center;">'
      + '<input id="ts-url-input" value="' + S.ts.url + '" placeholder="Paste a YouTube URL" style="flex: 1; min-width: 0; height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 11.5px;" />'
      + '<button id="ts-btn-load" type="button" class="btn-primary" style="padding: 6px 14px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" ' + loadDis + '>'
      + (S.ts.loading ? '<span>Loading...</span>' : '<span>Load</span>')
      + '</button>'
      + '</div>'
      + videoHtml
      + actionButtons
      + listHtml
      + '</div>';
  }

  function wfRenderWorkflow() {
    var importInfo = '';
    if (S.wf.imported) {
      importInfo = '<div style="margin-top: 10px; padding: 10px; border: 1px solid var(--ds-line); border-radius: 8px; background: var(--card); display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">'
        + '<div><span style="font-size: 9px; color: var(--muted); font-weight: 700; text-transform: uppercase;">File</span><br><span style="font-size: 11px; font-weight: 700; color: var(--text); word-break: break-all;">' + S.wf.imported.filename + '</span></div>'
        + '<div><span style="font-size: 9px; color: var(--muted); font-weight: 700; text-transform: uppercase;">Type</span><br><span style="font-size: 11px; font-weight: 700; color: var(--text);">' + (S.wf.imported.isVideo ? 'Video' : 'Audio') + '</span></div>'
        + '<div><span style="font-size: 9px; color: var(--muted); font-weight: 700; text-transform: uppercase;">Size</span><br><span style="font-size: 11px; font-weight: 700; color: var(--text);">' + formatBytes(S.wf.imported.size) + '</span></div>'
        + '<div><span style="font-size: 9px; color: var(--muted); font-weight: 700; text-transform: uppercase;">Duration</span><br><span style="font-size: 11px; font-weight: 700; color: var(--text);">' + formatDuration(S.wf.imported.duration) + '</span></div>'
        + '</div>'
        + '<div style="display: flex; justify-content: flex-end; margin-top: 8px;">'
        + '<button id="wf-step1-next" type="button" class="btn-primary" style="padding: 5px 14px; font-size: 11px;">Next → Extract Audio</button>'
        + '</div>';
    }

    var extractNav = '';
    if (S.wf.extracted) {
      extractNav = '<div style="display: flex; justify-content: flex-end; margin-top: 8px; gap: 8px;">'
        + '<button id="wf-step2-back" type="button" class="btn-ghost" style="padding: 5px 14px; font-size: 11px;">← Back</button>'
        + '<button id="wf-step2-next" type="button" class="btn-primary" style="padding: 5px 14px; font-size: 11px;">Next → Split Clips</button>'
        + '</div>';
    }

    var clipOpts = [10, 15, 20, 25, 30].map(function(v) {
      return '<option value="' + v + '"' + (S.wf.clipLength === v ? ' selected' : '') + '>' + v + 's</option>';
    }).join('');

    var splitNav = '';
    if (S.wf.clipCount > 0) {
      splitNav = '<div style="display: flex; justify-content: flex-end; margin-top: 8px; gap: 8px;">'
        + '<button id="wf-step3-back" type="button" class="btn-ghost" style="padding: 5px 14px; font-size: 11px;">← Back</button>'
        + '<button id="wf-step3-next" type="button" class="btn-primary" style="padding: 5px 14px; font-size: 11px;">Next → Generate Transcripts</button>'
        + '</div>';
    }

    var genNav = '';
    if (S.wf.drafts.length > 0) {
      genNav = '<div style="display: flex; justify-content: flex-end; margin-top: 8px; gap: 8px;">'
        + '<button id="wf-step4-back" type="button" class="btn-ghost" style="padding: 5px 14px; font-size: 11px;">← Back</button>'
        + '<button id="wf-step4-next" type="button" class="btn-primary" style="padding: 5px 14px; font-size: 11px;">Next → Review &amp; Correct</button>'
        + '</div>';
    }

    var acceptCount = S.wf.drafts.filter(function(d) { return d.status === 'accepted'; }).length;
    var pendingCount = S.wf.drafts.filter(function(d) { return d.status === 'pending'; }).length;
    var rejectedCount = S.wf.drafts.filter(function(d) { return d.status === 'rejected'; }).length;

    var reviewNav = '';
    if (S.wf.drafts.length > 0) {
      reviewNav = '<div style="display: flex; justify-content: flex-end; margin-top: 10px; gap: 8px;">'
        + '<button id="wf-step5-back" type="button" class="btn-ghost" style="padding: 5px 14px; font-size: 11px;">← Back</button>'
        + '<button id="wf-step5-next" type="button" class="btn-primary" style="padding: 5px 14px; font-size: 11px;"' + (acceptCount === 0 ? ' disabled' : '') + '>Next → Build Dataset (' + acceptCount + ' accepted)</button>'
        + '</div>';
    }

    var dis = S.wf.busy ? ' disabled' : '';

    return '<div class="set-card wf-card" style="padding: 16px 20px; border-radius: 14px; margin-bottom: 0;">'
      // Header
      + '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">'
      + '<div style="display: flex; align-items: center; gap: 8px;">'
      + '<span style="color: var(--accent); display: flex; align-items: center; width: 15px; height: 15px;">' + setIcon('download') + '</span>'
      + '<div class="set-name" style="font-size: 13.5px; font-weight: 700;">Bulk Media Workflow</div>'
      + '<span style="font-size: 10px; padding: 2px 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 700; border: 1px solid rgba(238,45,85,.12);">Malayalam → English</span>'
      + '</div>'
      + '<button id="wf-reset" type="button" class="btn-ghost" style="padding: 4px 10px; font-size: 10.5px;">Reset Workflow</button>'
      + '</div>'
      + '<p style="font-size: 10.5px; color: var(--muted); margin: 0 0 14px; line-height: 1.45;">Import long Malayalam video/audio → extract audio → split into clips → auto-transcribe to English → review &amp; correct → build training dataset.</p>'
      // Steps bar
      + '<div class="wf-steps-bar" style="display: flex; gap: 0; margin-bottom: 18px; position: relative;">' + wfRenderStepsBar() + '</div>'
      // Step 1
      + '<div id="wf-step-1" style="display: ' + (S.wf.step === 1 ? 'block' : 'none') + ';">'
      + '<div style="padding: 14px; border: 1px solid var(--ds-line); border-radius: 10px; background: var(--ds-soft);">'
      + '<h4 style="font-size: 12.5px; font-weight: 800; margin: 0 0 6px; color: var(--text);">Step 1: Import Video or Audio</h4>'
      + '<p style="font-size: 10.5px; color: var(--muted); margin: 0 0 10px; line-height: 1.4;">Select a long Malayalam video or audio file to start the workflow. Supported formats: mp4, mov, mkv, m4a, mp3, wav.</p>'
      + '<div style="display: flex; gap: 8px; align-items: center;">'
      + '<button id="wf-import-btn" type="button" class="btn-primary' + (S.wf.imported ? ' btn-step-done' : '') + '" style="padding: 6px 14px; font-size: 11.5px;"' + dis + '>Select File</button>'
      + '<span id="wf-import-status" style="font-size: 10.5px; color: var(--muted); font-weight: 600;">' + (S.wf.imported ? '✓ ' + S.wf.imported.filename : 'No file selected') + '</span>'
      + '</div>'
      + '<div style="display: flex; gap: 8px; align-items: center; margin-top: 10px;">'
      + '<input id="wf-import-url" type="text" placeholder="Or paste a YouTube URL" value="' + (S.wf.importUrl || '') + '" style="flex: 1; min-width: 0; height: 30px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 11.5px;"' + dis + ' />'
      + '<button id="wf-import-url-btn" type="button" class="btn-soft' + (S.wf.imported ? ' btn-step-done' : '') + '" style="padding: 6px 14px; font-size: 11.5px;"' + dis + '>Import from URL</button>'
      + '</div>'
      + '<div id="wf-import-url-progress" style="display: ' + (S.wf.importingUrl ? 'block' : 'none') + '; margin-top: 8px;"><div style="height: 6px; background: var(--ds-line); border-radius: 999px; overflow: hidden;"><div id="wf-import-url-bar" style="width: 0%; height: 100%; background: var(--accent-grad); border-radius: inherit; transition: width 0.15s linear;"></div></div><span id="wf-import-url-pct" style="font-size: 10px; color: var(--muted); margin-top: 4px; display: block;"></span></div>'
      + importInfo
      + '</div></div>'
      // Step 2
      + '<div id="wf-step-2" style="display: ' + (S.wf.step === 2 ? 'block' : 'none') + ';">'
      + '<div style="padding: 14px; border: 1px solid var(--ds-line); border-radius: 10px; background: var(--ds-soft);">'
      + '<h4 style="font-size: 12.5px; font-weight: 800; margin: 0 0 6px; color: var(--text);">Step 2: Extract Audio</h4>'
      + '<p style="font-size: 10.5px; color: var(--muted); margin: 0 0 10px; line-height: 1.4;">Convert the imported file to 16 kHz mono WAV. Uses ffmpeg for video, afconvert for audio-only files.</p>'
      + '<div style="display: flex; gap: 8px; align-items: center;">'
      + '<button id="wf-extract-btn" type="button" class="btn-primary' + (S.wf.extracted ? ' btn-step-done' : '') + '" style="padding: 6px 14px; font-size: 11.5px;"' + dis + '>Extract Audio</button>'
      + '<span id="wf-extract-status" style="font-size: 10.5px; color: var(--muted); font-weight: 600;">' + (S.wf.extracted ? '✓ Extracted: ' + S.wf.extracted.path : 'Waiting...') + '</span>'
      + '</div>'
      + '<div id="wf-extract-progress" style="display: none; margin-top: 8px;"><div style="height: 6px; background: var(--ds-line); border-radius: 999px; overflow: hidden;"><div id="wf-extract-bar" style="width: 0%; height: 100%; background: var(--accent-grad); border-radius: inherit; transition: width 0.15s linear;"></div></div></div>'
      + '<div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--ds-line);">'
      + '<h5 style="font-size: 11.5px; font-weight: 800; margin: 0 0 4px; color: var(--text);">Optional: Load matching YouTube transcript</h5>'
      + '<p style="font-size: 10px; color: var(--muted); margin: 0 0 8px; line-height: 1.4;">If this video is also on YouTube, load its captions now — Split Clips (next step) will then cut audio at the exact same timestamps as the caption windows, instead of splitting independently and risking a clip/transcript mismatch later.</p>'
      + '<div style="display: flex; gap: 8px; align-items: center;">'
      + '<input id="wf-step2-ts-url" type="text" value="' + (S.ts.url || '') + '" placeholder="Paste a YouTube URL" style="flex: 1; min-width: 0; height: 30px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 11.5px;" />'
      + '<button id="wf-step2-ts-load-btn" type="button" class="btn-soft" style="padding: 6px 14px; font-size: 11.5px;"' + (S.ts.loading ? ' disabled' : '') + '>' + (S.ts.loading ? 'Loading...' : 'Load Transcript') + '</button>'
      + '</div>'
      + '<span style="font-size: 10.5px; color: var(--muted); font-weight: 600; display: inline-block; margin-top: 6px;">' + (S.ts.rows.length > 0 ? '✓ ' + S.ts.rows.length + ' caption window(s) loaded' : 'No transcript loaded yet') + '</span>'
      + '</div>'
      + extractNav
      + '</div></div>'
      // Step 3
      + '<div id="wf-step-3" style="display: ' + (S.wf.step === 3 ? 'block' : 'none') + ';">'
      + '<div style="padding: 14px; border: 1px solid var(--ds-line); border-radius: 10px; background: var(--ds-soft);">'
      + '<h4 style="font-size: 12.5px; font-weight: 800; margin: 0 0 6px; color: var(--text);">Step 3: Split into Clips</h4>'
      + '<p style="font-size: 10.5px; color: var(--muted); margin: 0 0 10px; line-height: 1.4;">Split extracted audio into short WAV clips for transcription. Adjust clip length if needed.</p>'
      + '<div style="display: flex; gap: 12px; align-items: center; margin-bottom: 10px;">'
      + '<label style="font-size: 11px; font-weight: 700; color: var(--text);">Clip Length:</label>'
      + '<select id="wf-clip-length" style="padding: 4px 8px; font-size: 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--card);">' + clipOpts + '</select>'
      + '</div>'
      + '<div style="display: flex; gap: 8px; align-items: center;">'
      + '<button id="wf-split-btn" type="button" class="btn-primary' + (S.wf.clipCount > 0 ? ' btn-step-done' : '') + '" style="padding: 6px 14px; font-size: 11.5px;"' + dis + '>Split Clips</button>'
      + '<span id="wf-split-status" style="font-size: 10.5px; color: var(--muted); font-weight: 600;">' + (S.wf.clipCount > 0 ? '✓ ' + S.wf.clipCount + ' clips created' : 'Waiting...') + '</span>'
      + '</div>'
      + '<div id="wf-split-progress" style="display: none; margin-top: 8px;"><div style="height: 6px; background: var(--ds-line); border-radius: 999px; overflow: hidden;"><div id="wf-split-bar" style="width: 0%; height: 100%; background: var(--accent-grad); border-radius: inherit; transition: width 0.15s linear;"></div></div></div>'
      + splitNav
      + '</div></div>'
      // Step 4: Review & Correct with side-by-side Transcript Studio (Photoshop mockup aligned layout)
      + '<div id="wf-step-4" style="display: ' + (S.wf.step === 4 ? 'block' : 'none') + ';">'
      + '<style>'
      + '  .ts-tab-btn { padding: 4px 8px; font-size: 11px; border: 1px solid var(--border); border-radius: 4px; background: var(--card); color: var(--muted); cursor: pointer; font-weight: 600; transition: all 0.15s ease; }'
      + '  .ts-tab-btn.active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }'
      + '  .ts-row-play-btn.active { color: #fff !important; background: var(--accent) !important; border-color: var(--accent) !important; }'
      + '  .ts-btn-clean.active { background: var(--accent-soft) !important; color: var(--accent) !important; border-color: var(--accent) !important; }'
      + '</style>'
      + '<div style="display: flex; flex-direction: column; height: 85vh; min-height: 760px; gap: 12px;">'
      // Top Area (Fixed): URL Input & Video Player (Centered)
      + '<div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; background: var(--card); border: 1px solid var(--ds-line); border-radius: 12px; padding: 14px;">'
      + '  <div style="width: 100%; max-width: 600px; display: flex; gap: 8px; align-items: center;">'
      + '    <input id="ts-url-input" value="' + S.ts.url + '" placeholder="Paste a YouTube URL" style="flex: 1; min-width: 0; height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 11.5px;" />'
      + '    <button id="ts-btn-load" type="button" class="btn-primary" style="padding: 6px 14px; font-size: 11.5px; height: 32px; display: inline-flex; align-items: center;" ' + (S.ts.loading ? 'disabled' : '') + '>'
      + (S.ts.loading ? 'Loading...' : 'Load')
      + '    </button>'
      + '  </div>'
      + '  <div style="width: 100%; max-width: 600px;">'
      + tsRenderStudio('video')
      + '  </div>'
      + '</div>'
      // Bottom Area (Scrolling): Sticky Headers + Combined Scrolling Columns
      + '<div style="flex: 1; display: flex; flex-direction: column; border: 1px solid var(--ds-line); border-radius: 12px; background: var(--card); padding: 14px; overflow: hidden;">'
      // Sticky headers row
      + '<div style="flex-shrink: 0; display: flex; gap: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--ds-line); margin-bottom: 8px;">'
      // Left Column Header
      + '<div style="flex: 1.1; display: flex; flex-direction: column; gap: 6px; min-width: 0;">'
      + '  <div style="display: flex; align-items: center; justify-content: space-between;">'
      + '    <span style="font-size: 12.5px; font-weight: 800; color: var(--text);">YouTube Transcript</span>'
      + '  </div>'
      + tsRenderStudio('actions')
      + '</div>'
      // Right Column Header
      + '<div style="flex: 0.9; display: flex; flex-direction: column; gap: 6px; min-width: 0; border-left: 1px dashed var(--border); padding-left: 20px;">'
      + '  <div style="display: flex; align-items: center; justify-content: space-between;">'
      + '    <span style="font-size: 12.5px; font-weight: 800; color: var(--text);">Step 4: Review &amp; Correct English Text</span>'
      + (S.wf.drafts.length > 0 
        ? '<div style="display: flex; gap: 6px;">'
          + '<button id="wf-accept-all" type="button" class="btn-soft" style="padding: 3px 8px; font-size: 10px;">Accept All</button>'
          + '<button id="wf-save-drafts" type="button" class="btn-soft" style="padding: 3px 8px; font-size: 10px;">Save Progress</button>'
        + '</div>'
        : ''
      )
      + '  </div>'
      + '  <div style="display: flex; align-items: center; gap: 10px; height: 28px;">'
      + (S.wf.drafts.length > 0
        ? '<span style="font-size: 10.5px; font-weight: 700; color: var(--ds-success);">Accepted: <span id="wf-accepted-count">' + acceptCount + '</span></span>'
          + '<span style="font-size: 10.5px; font-weight: 700; color: var(--accent);">Pending: <span id="wf-pending-count">' + pendingCount + '</span></span>'
          + '<span style="font-size: 10.5px; font-weight: 700; color: var(--muted);">Rejected: <span id="wf-rejected-count">' + rejectedCount + '</span></span>'
        : '<span style="font-size: 10.5px; color: var(--muted);">Drafts not prepared yet</span>'
      )
      + '  </div>'
      + '</div>'
      + '</div>' // Header row end
      // Optional third-opinion check (Groq's free whisper-large-v3) — never
      // auto-applied, just a per-row reference to cross-check against.
      + '<div style="display: flex; align-items: center; gap: 6px; padding: 8px 0; border-bottom: 1px dashed var(--ds-line); margin-bottom: 4px;">'
      + '<span style="font-size: 10px; color: var(--muted); font-weight: 700; white-space: nowrap;">Groq API key (optional, free):</span>'
      + '<input id="wf-groq-key" type="password" value="' + (S.groqApiKey || '') + '" placeholder="gsk_..." style="flex: 1; min-width: 0; height: 26px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); font-size: 10.5px;" />'
      + (S.wf.drafts.length > 0
        ? '<button id="wf-groq-batch-btn" type="button" class="btn-soft" style="height: 26px; padding: 0 10px; font-size: 10px; font-weight: 700; border-color: var(--accent); color: var(--accent); white-space: nowrap; margin-left: 6px;"' + (S.wf.busy ? ' disabled' : '') + '>'
          + (S.wf.groqBatchLoading ? 'Checking batch...' : '🤖 Batch Check with Groq (1 API Call)')
          + '</button>'
          + (Object.values(S.groqChecks).some(gc => gc && gc.text !== undefined && !gc.loading)
            ? '<button id="wf-groq-apply-all-btn" type="button" class="btn-soft" style="height: 26px; padding: 0 10px; font-size: 10px; font-weight: 700; border-color: var(--ds-success); color: var(--ds-success); white-space: nowrap; margin-left: 6px;">Apply All Groq Results</button>'
            : ''
          )
        : ''
      )
      + '</div>'
      // Single combined scroll area — one row per transcript/clip pair, both
      // halves sharing one element, so they can't drift apart while scrolling.
      + '<div id="wf-review-scroller" style="flex: 1; overflow-y: auto; padding-right: 4px;">'
      + (S.wf.drafts.length === 0
        ? '<div style="padding: 20px; border: 1px dashed var(--border); border-radius: 8px; background: var(--card); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 250px;">'
          + '<span style="font-size: 11px; color: var(--muted); text-align: center;">You have ' + S.wf.clipCount + ' split clips. Click the button below to initialize the review list with empty text boxes. You can then use YouTube transcripts or the Groq API helper to fill them.</span>'
          + '<button id="wf-generate-btn" type="button" class="btn-primary" style="padding: 6px 14px; font-size: 11.5px;" style="margin-top: 8px;" ' + dis + '>Initialize Review List</button>'
          + '<div id="wf-generate-progress" style="display: none; width: 100%; margin-top: 8px;"><div style="height: 6px; background: var(--ds-line); border-radius: 999px; overflow: hidden;"><div id="wf-generate-bar" style="width: 0%; height: 100%; background: var(--accent-grad); border-radius: inherit; transition: width 0.15s linear;"></div></div><span id="wf-generate-detail" style="font-size: 10px; color: var(--muted); margin-top: 4px; display: block;"></span></div>'
          + '</div>'
        : '<div class="wf-review-list" id="wf-review-list" style="display: flex; flex-direction: column; gap: 14px; width: 100%;">' + wfRenderAlignedRows() + '</div>'
          + '<audio id="wf-clip-player" style="display: none;"></audio>'
      )
      + '</div>' // Combined scroll area end
      // Footer controls area
      + '<div style="flex-shrink: 0; display: flex; justify-content: flex-end; margin-top: 12px; gap: 8px; border-top: 1px dashed var(--border); padding-top: 12px;">'
      + '  <button id="wf-step4-back" type="button" class="btn-ghost" style="padding: 5px 14px; font-size: 11px;">← Back</button>'
      + '  <button id="wf-step4-next" type="button" class="btn-primary" style="padding: 5px 14px; font-size: 11px;"' + (acceptCount === 0 || S.wf.drafts.length === 0 ? ' disabled' : '') + '>Next → Build Dataset (' + acceptCount + ' accepted)</button>'
      + '</div>'
      + '</div>' // Bottom area end
      + '</div>' // Height wrapper end
      + '</div>' // main step-4 end
      // Step 5: Build Training Dataset
      + '<div id="wf-step-5" style="display: ' + (S.wf.step === 5 ? 'block' : 'none') + ';">'
      + '<div style="padding: 14px; border: 1px solid var(--ds-line); border-radius: 10px; background: var(--ds-soft);">'
      + '<h4 style="font-size: 12.5px; font-weight: 800; margin: 0 0 6px; color: var(--text);">Step 5: Build Training Dataset</h4>'
      + '<p style="font-size: 10.5px; color: var(--muted); margin: 0 0 10px; line-height: 1.4;">Copy accepted clips into <code>data/audio/</code> and generate <code>metadata.csv</code> with exact <code>file,text</code> format.</p>'
      + '<div style="display: flex; gap: 8px; align-items: center;">'
      + '<button id="wf-build-btn" type="button" class="btn-primary' + (S.wf.builtCount > 0 ? ' btn-step-done' : '') + '" style="padding: 6px 14px; font-size: 11.5px;"' + dis + '>Build Dataset</button>'
      + '<span id="wf-build-status" style="font-size: 10.5px; color: var(--muted); font-weight: 600;">Ready to build (' + acceptCount + ' accepted clips)</span>'
      + '</div>'
      + '<div id="wf-build-progress" style="display: none; margin-top: 8px;"><div style="height: 6px; background: var(--ds-line); border-radius: 999px; overflow: hidden;"><div id="wf-build-bar" style="width: 0%; height: 100%; background: var(--accent-grad); border-radius: inherit; transition: width 0.15s linear;"></div></div></div>'
      + '<div style="display: flex; margin-top: 8px; gap: 8px;">'
      + '<button id="wf-step5-back" type="button" class="btn-ghost" style="padding: 5px 14px; font-size: 11px;">← Back</button>'
      + '</div>'
      + '</div></div>'
      + '</div>';
  }

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
              <div style="display: flex; gap: 8px;">
                <button id="ds-cleanMetadata" type="button" class="btn-soft" style="padding: 6px 12px; font-size: 11.5px; border-color: var(--accent); color: var(--accent);">Clean Transcripts</button>
                <button id="ds-saveMetadata" type="button" class="btn-soft" style="padding: 6px 12px; font-size: 11.5px;">Save metadata.csv</button>
              </div>
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

          <!-- ═══════ Bulk Media Workflow ═══════ -->
          ${wfRenderWorkflow()}

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
            <div style="font-size: 13.5px; font-weight: 600; color: var(--text); margin-bottom: 12px; margin-left: 4px; display: flex; align-items: center; gap: 8px;">
              <span id="ds-train-status">Idle.</span>
            </div>

            <!-- Progress Card -->
            <div id="ds-progress-card" class="dt-progress-card" style="display: none; position: sticky; top: 14px; z-index: 100; background: var(--card, #ffffff);">
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
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 18px 0 10px; padding-left: 4px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--accent); display: flex; align-items: center; width: 16px; height: 16px;">${setIcon('settings')}</span>
                <div class="set-name" style="font-size: 14px; font-weight: 800; letter-spacing: -0.01em;">Training Pipeline</div>
              </div>
              <button id="ds-reset-pipeline" type="button" class="btn-ghost" style="padding: 5px 12px; font-size: 11px;" title="Deletes the trained adapter, merged model, and converted .bin — leaves your dataset and App Model Management untouched">Reset Training Pipeline</button>
            </div>

            <!-- Language / Task config — applies to every step below. Get this wrong and every
                 metric in this pipeline is meaningless (whisper's language tag controls OUTPUT
                 script, and task controls transcribe-vs-translate-to-English). -->
            <div class="dt-step-card" style="border-color: var(--accent);">
              <div class="dt-step-info">
                <div class="dt-step-name">Language &amp; Task</div>
                <div class="dt-step-desc">Must match your dataset's actual audio language and transcript script. Wrong setting silently produces low-similarity scores that look like a training bug.</div>
              </div>
              <div class="dt-actions">
                <select id="ds-lang-task" style="padding: 6px 10px; font-size: 12px; border-radius: 8px; border: 1px solid var(--border); outline: none; background: var(--card); color: var(--text); cursor: pointer; font-weight: 700;">
                  <option value="ml:translate" selected>Malayalam audio &rarr; English text (translate)</option>
                  <option value="ml:transcribe">Malayalam audio &rarr; Malayalam script (transcribe)</option>
                  <option value="en:transcribe">English audio &rarr; English text (transcribe)</option>
                </select>
              </div>
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
                  <span style="font-size: 10.5px; color: var(--muted);">Tests every clip in the dataset.</span>
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
                <div class="dt-actions" style="align-items: center; gap: 12px; flex-wrap: wrap;">
                  <button id="ds-train-start" type="button" class="btn-primary" style="font-size: 12px; padding: 6px 12px;" disabled>Start LoRA Training</button>
                  <div style="display: inline-flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase;">Epochs:</span>
                    <input id="ds-train-epochs" type="number" min="1" step="1" value="${S.trainEpochs || 12}" style="width: 56px; padding: 4px 6px; font-size: 11.5px; border-radius: 8px; border: 1px solid var(--border); background: var(--card); color: var(--text);" />
                  </div>
                  <div style="display: inline-flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase;">Grad accum:</span>
                    <input id="ds-train-gradaccum" type="number" min="1" step="1" value="${S.trainGradAccum || 2}" style="width: 56px; padding: 4px 6px; font-size: 11.5px; border-radius: 8px; border: 1px solid var(--border); background: var(--card); color: var(--text);" />
                  </div>
                  <span style="font-size: 10px; color: var(--muted);">More clips → can afford fewer epochs and higher grad accum; few clips → more epochs, lower grad accum (else too few weight updates happen at all).</span>
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
              <audio id="train-test-player" style="display: none;"></audio>

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
                  <button id="ds-log-expand" type="button" class="btn-soft" style="padding: 4px 8px; font-size: 10.5px;">${logExpanded ? 'Collapse' : 'Expand'}</button>
                  <button id="ds-clear-log" type="button" class="btn-ghost" style="padding: 4px 8px; font-size: 10.5px;">Clear</button>
                  <button id="ds-copy-log" type="button" class="btn-ghost" style="padding: 4px 8px; font-size: 10.5px;">Copy Logs</button>
                  <button id="ds-open-output" type="button" class="btn-ghost" style="padding: 4px 8px; font-size: 10.5px;">Open Output Folder</button>
                </div>
              </div>
              <pre id="ds-train-log" class="dt-log ${logExpanded ? '' : 'collapsed'}"></pre>
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

            <!-- Dev App Model: the file this dev build actually loads at runtime
                 (src/assets/models/) — separate from App Model Management above,
                 which only manages the packaged-app's model location. Hold-to-
                 confirm since releasing early cancels, instead of a click you
                 could fire by accident the way Convert to GGML was. -->
            <div class="dt-sidebar-card">
              <div class="dt-block-head">
                <span class="dt-block-title">Dev App Model (this build)</span>
              </div>
              <p class="set-desc" style="font-size: 11px; margin: 0; color: var(--muted); line-height: 1.35;">Installs the latest converted candidate directly into <code>src/assets/models/</code> — the file this dev build actually loads for live dictation. Hold a button for 5s to confirm; release early to cancel.</p>
              <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 8px;">
                <button id="ds-install-dev-model" type="button" class="btn-hold-confirm">
                  <span class="btn-hold-fill"></span>
                  <span class="btn-hold-label">Hold 5s — Install New Model</span>
                </button>
                <button id="ds-revert-dev-model" type="button" class="btn-hold-confirm">
                  <span class="btn-hold-fill"></span>
                  <span class="btn-hold-label">Hold 5s — Revert to Backup</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Bulk Media Workflow Logic ──────────────────────────────────────────────
  // Re-renders the entire view to reflect workflow state changes.
  function wfReRender() {
    const r = root();
    if (r) {
      r.outerHTML = render();
      grab();
      wire();
    }
  }

  async function wfAutoResume() {
    if (!S.projectDir) return;
    try {
      const state = await api.workflowGetState(S.projectDir);
      if (state && (state.imported || state.drafts.length > 0)) {
        S.wf.imported = state.imported;
        S.wf.extracted = state.extracted;
        S.wf.clipCount = state.clipCount;
        S.wf.drafts = state.drafts;
        S.wf.step = state.step;
        if (S.wf.step === 4 || S.wf.step === 5) {
          S.wf.step = 4;
        }
        wfReRender();
        console.log('[DatasetStudio] Auto-resumed workflow state:', JSON.stringify(S.wf));
      }
    } catch (err) {
      console.error('[DatasetStudio] failed to auto-resume workflow:', err);
    }
  }

  async function wfReset() {
    if (S.projectDir) {
      try { await api.workflowClear(S.projectDir); } catch (_) {}
    }
    S.wf = { step: 1, imported: null, extracted: null, clipCount: 0, drafts: [], busy: false, clipLength: 20, importUrl: '', importingUrl: false, builtCount: 0, playingClipIdx: -1, groqBatchLoading: false };
    wfReRender();
  }

  async function wfImport() {
    console.log('[DatasetStudio] wfImport clicked. Current state:', JSON.stringify(S.wf));
    if (S.wf.busy) {
      console.warn('[DatasetStudio] wfImport ignored because S.wf.busy is true.');
      return;
    }
    // Auto-initialize project directory if not set
    if (!S.projectDir) {
      console.log('[DatasetStudio] projectDir is empty, fetching default...');
      try {
        S.projectDir = await api.getDefaultProject();
        console.log('[DatasetStudio] default projectDir resolved:', S.projectDir);
      } catch (err) {
        console.error('[DatasetStudio] failed to get default projectDir:', err);
      }
    }
    if (!S.projectDir) {
      console.error('[DatasetStudio] S.projectDir is still empty, alerting user.');
      alert('Please set a Training Directory first using the "Choose Folder" button above.');
      return;
    }
    // Ensure project folders exist
    console.log('[DatasetStudio] ensuring project directory exists...');
    try {
      await api.ensureProject(S.projectDir);
      console.log('[DatasetStudio] project directory verified/created successfully.');
    } catch (err) {
      console.error('[DatasetStudio] error during ensureProject:', err);
    }
    console.log('[DatasetStudio] setting busy = true, invoking workflowImport...');
    S.wf.busy = true;
    try {
      const result = await api.workflowImport(S.projectDir);
      console.log('[DatasetStudio] workflowImport result:', result);
      if (!result) {
        console.log('[DatasetStudio] import cancelled by user.');
        S.wf.busy = false;
        return;
      }
      S.wf.imported = result;
      S.wf.busy = false;
      console.log('[DatasetStudio] import successful, re-rendering...');
      wfReRender();
    } catch (err) {
      console.error('[DatasetStudio] workflowImport failed:', err);
      S.wf.busy = false;
      alert('Import failed: ' + err.message);
    }
  }

  async function wfImportUrl() {
    if (S.wf.busy) return;
    const input = document.getElementById('wf-import-url');
    const url = (input ? input.value : S.wf.importUrl || '').trim();
    if (!url) {
      alert('Paste a YouTube URL first.');
      return;
    }
    S.wf.importUrl = url;
    if (!S.projectDir) {
      try { S.projectDir = await api.getDefaultProject(); } catch (_err) { /* fall through to the check below */ }
    }
    if (!S.projectDir) {
      alert('Please set a Training Directory first using the "Choose Folder" button above.');
      return;
    }
    try { await api.ensureProject(S.projectDir); } catch (_err) { /* best-effort */ }

    const statusEl = document.getElementById('wf-import-status');
    if (statusEl) statusEl.textContent = 'Downloading from YouTube…';
    S.wf.busy = true;
    S.wf.importingUrl = true;
    wfReRender();
    try {
      const result = await api.workflowImportYoutube(S.projectDir, url);
      S.wf.imported = result;
      S.wf.busy = false;
      S.wf.importingUrl = false;
      wfReRender();
    } catch (err) {
      S.wf.busy = false;
      S.wf.importingUrl = false;
      alert('YouTube import failed: ' + err.message);
      wfReRender();
    }
  }

  async function wfExtract() {
    if (S.wf.busy || !S.wf.imported) return;
    S.wf.busy = true;
    const progressEl = document.getElementById('wf-extract-progress');
    const barEl = document.getElementById('wf-extract-bar');
    const statusEl = document.getElementById('wf-extract-status');
    if (progressEl) progressEl.style.display = 'block';
    if (statusEl) statusEl.textContent = 'Extracting...';
    try {
      const result = await api.workflowExtractAudio(S.projectDir, S.wf.imported.path);
      S.wf.extracted = result;
      S.wf.busy = false;
      wfReRender();
    } catch (err) {
      S.wf.busy = false;
      if (statusEl) statusEl.textContent = 'Failed: ' + err.message;
      if (progressEl) progressEl.style.display = 'none';
      alert('Extract failed: ' + err.message);
    }
  }

  async function wfSplit() {
    if (S.wf.busy || !S.wf.extracted) return;
    S.wf.busy = true;
    const progressEl = document.getElementById('wf-split-progress');
    const barEl = document.getElementById('wf-split-bar');
    const statusEl = document.getElementById('wf-split-status');
    if (progressEl) progressEl.style.display = 'block';
    if (statusEl) statusEl.textContent = 'Splitting clips...';
    try {
      // If a YouTube transcript is already loaded for this video, cut audio
      // at the exact same timestamps as its caption windows instead of
      // re-detecting boundaries independently from the audio — the two would
      // otherwise drift apart in count/timing despite both avoiding mid-word
      // cuts, since they'd be guessing boundaries from different signals.
      const result = (S.ts.rows && S.ts.rows.length > 0)
        ? await api.workflowSplitClipsAtTimes(S.projectDir, S.wf.extracted.path,
            S.ts.rows.map((r) => ({ start: r.start, end: r.end })))
        : await api.workflowSplitClips(S.projectDir, S.wf.extracted.path, {
            clipLength: S.wf.clipLength,
            skipSilence: false
          });
      S.wf.clipCount = result.count || 0;
      S.wf.busy = false;
      wfReRender();
    } catch (err) {
      S.wf.busy = false;
      if (statusEl) statusEl.textContent = 'Failed: ' + err.message;
      if (progressEl) progressEl.style.display = 'none';
      alert('Split failed: ' + err.message);
    }
  }

  async function wfGenerateDrafts() {
    if (S.wf.busy) return;
    S.wf.busy = true;
    const progressEl = document.getElementById('wf-generate-progress');
    const barEl = document.getElementById('wf-generate-bar');
    const detailEl = document.getElementById('wf-generate-detail');
    const statusEl = document.getElementById('wf-generate-status');
    if (progressEl) progressEl.style.display = 'block';
    if (statusEl) statusEl.textContent = 'Initializing clips...';
    try {
      const drafts = await api.workflowGenerateDrafts(S.projectDir);
      S.wf.drafts = drafts;
      S.wf.busy = false;
      wfReRender();
    } catch (err) {
      S.wf.busy = false;
      if (statusEl) statusEl.textContent = 'Failed: ' + err.message;
      if (progressEl) progressEl.style.display = 'none';
      alert('Review list initialization failed: ' + err.message);
    }
  }

  function wfUpdateReviewCounts() {
    const ac = document.getElementById('wf-accepted-count');
    const pc = document.getElementById('wf-pending-count');
    const rc = document.getElementById('wf-rejected-count');
    if (ac) ac.textContent = S.wf.drafts.filter(d => d.status === 'accepted').length;
    if (pc) pc.textContent = S.wf.drafts.filter(d => d.status === 'pending').length;
    if (rc) rc.textContent = S.wf.drafts.filter(d => d.status === 'rejected').length;
  }

  async function wfPlayClip(index) {
    console.log('[DatasetStudio] wfPlayClip called for index:', index);
    const draft = S.wf.drafts[index];
    if (!draft) {
      console.warn('[DatasetStudio] no draft found at index:', index);
      return;
    }
    console.log('[DatasetStudio] playing clip_path:', draft.clip_path);
    const player = document.getElementById('wf-clip-player');
    if (!player) {
      console.error('[DatasetStudio] wf-clip-player audio element not found in DOM!');
      alert('Error: Audio player element not found.');
      return;
    }
    try {
      console.log('[DatasetStudio] reading clip file from backend...');
      const bytes = await api.workflowReadClipFile(S.projectDir, draft.clip_path);
      if (!bytes) {
        console.warn('[DatasetStudio] no bytes returned for clip:', draft.clip_path);
        alert('Error: Audio file is empty.');
        return;
      }
      console.log('[DatasetStudio] read success, bytes length:', bytes.length || bytes.byteLength);

      // Clean up previous object URL if any to avoid memory leak
      if (activeWfClipUrl) {
        console.log('[DatasetStudio] revoking old Blob URL:', activeWfClipUrl);
        URL.revokeObjectURL(activeWfClipUrl);
        activeWfClipUrl = null;
      }

      const blob = new Blob([bytes], { type: 'audio/wav' });
      activeWfClipUrl = URL.createObjectURL(blob);
      console.log('[DatasetStudio] created new Blob URL:', activeWfClipUrl);
      player.src = activeWfClipUrl;

      console.log('[DatasetStudio] calling player.play()...');
      await player.play();
      console.log('[DatasetStudio] playback started successfully.');
      S.wf.playingClipIdx = index;
    } catch (err) {
      console.error('[DatasetStudio] Failed to play clip:', err);
      alert('Failed to play clip: ' + err.message);
    }
  }

  async function wfSaveDrafts() {
    if (!S.projectDir || S.wf.drafts.length === 0) return;
    try {
      await api.workflowSaveDrafts(S.projectDir, S.wf.drafts);
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }

  async function wfBuildDataset() {
    if (S.wf.busy) return;
    const accepted = S.wf.drafts.filter(d => d.status === 'accepted');
    if (accepted.length === 0) { alert('No accepted clips. Accept at least one clip.'); return; }

    S.wf.busy = true;
    const progressEl = document.getElementById('wf-build-progress');
    const statusEl = document.getElementById('wf-build-status');
    if (progressEl) progressEl.style.display = 'block';
    if (statusEl) statusEl.textContent = 'Building dataset...';
    try {
      // Save drafts first to preserve text corrections
      await api.workflowSaveDrafts(S.projectDir, S.wf.drafts);
      const result = await api.workflowBuildDataset(S.projectDir, S.wf.drafts);
      S.wf.busy = false;
      S.wf.builtCount = result.count || 0;
      if (statusEl) statusEl.textContent = '✓ Dataset built! ' + result.count + ' clips in data/audio/';
      if (progressEl) {
        const barEl = document.getElementById('wf-build-bar');
        if (barEl) barEl.style.width = '100%';
      }
      // Refresh the main project view to update the metadata table
      await refreshProject();
      alert('Dataset built successfully with ' + result.count + ' accepted clips!');
    } catch (err) {
      S.wf.busy = false;
      if (statusEl) statusEl.textContent = 'Failed: ' + err.message;
      alert('Build failed: ' + err.message);
    }
  }

  // Wire all Bulk Media Workflow event listeners
  function wireWorkflow() {
    // IPC progress listeners
    if (api.onImportProgress) {
      api.onImportProgress((pct) => {
        const bar = document.getElementById('wf-import-url-bar');
        const label = document.getElementById('wf-import-url-pct');
        if (bar) bar.style.width = pct + '%';
        if (label) label.textContent = pct + '%';
      });
    }
    if (api.onExtractProgress) {
      api.onExtractProgress((pct) => {
        const bar = document.getElementById('wf-extract-bar');
        if (bar) bar.style.width = pct + '%';
      });
    }
    if (api.onSplitProgress) {
      api.onSplitProgress((pct) => {
        const bar = document.getElementById('wf-split-bar');
        if (bar) bar.style.width = pct + '%';
      });
    }
    if (api.onDraftProgress) {
      api.onDraftProgress((data) => {
        const bar = document.getElementById('wf-generate-bar');
        const detail = document.getElementById('wf-generate-detail');
        if (bar && data.total > 0) bar.style.width = Math.round((data.current / data.total) * 100) + '%';
        if (detail) detail.textContent = `Transcribing ${data.current} of ${data.total}: ${data.clipName || ''}`;
      });
    }
    if (api.onBuildProgress) {
      api.onBuildProgress((data) => {
        const bar = document.getElementById('wf-build-bar');
        if (bar && data.total > 0) bar.style.width = Math.round((data.current / data.total) * 100) + '%';
      });
    }

    const resetBtn = document.getElementById('wf-reset');
    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (confirm('Reset the entire workflow? This will permanently delete the draft transcripts, splits, and imported file from disk for this project.')) {
          await wfReset();
        }
      };
    }

    // Step 1: Import
    const importBtn = document.getElementById('wf-import-btn');
    if (importBtn) importBtn.onclick = wfImport;
    const importUrlBtn = document.getElementById('wf-import-url-btn');
    if (importUrlBtn) importUrlBtn.onclick = wfImportUrl;
    const importUrlInput = document.getElementById('wf-import-url');
    if (importUrlInput) {
      importUrlInput.oninput = () => { S.wf.importUrl = importUrlInput.value; };
      importUrlInput.onkeydown = (ev) => { if (ev.key === 'Enter') wfImportUrl(); };
    }
    const step1Next = document.getElementById('wf-step1-next');
    if (step1Next) step1Next.onclick = () => { S.wf.step = 2; wfReRender(); };

    // Step 2: Extract
    const extractBtn = document.getElementById('wf-extract-btn');
    if (extractBtn) extractBtn.onclick = wfExtract;
    const step2Back = document.getElementById('wf-step2-back');
    if (step2Back) step2Back.onclick = () => { S.wf.step = 1; wfReRender(); };
    const step2Next = document.getElementById('wf-step2-next');
    if (step2Next) step2Next.onclick = () => { S.wf.step = 3; wfReRender(); };

    // Step 2: optional YouTube transcript loader — loading it here, before
    // Split Clips runs, guarantees the timestamp-locked split path is used
    // instead of needing the user to remember to visit Transcript Studio first.
    const step2TsUrlInput = document.getElementById('wf-step2-ts-url');
    if (step2TsUrlInput) step2TsUrlInput.oninput = () => { S.ts.url = step2TsUrlInput.value; };
    const step2TsLoadBtn = document.getElementById('wf-step2-ts-load-btn');
    if (step2TsLoadBtn) {
      step2TsLoadBtn.onclick = () => {
        const url = step2TsUrlInput ? step2TsUrlInput.value.trim() : S.ts.url;
        if (!url) { alert('Paste a YouTube URL first.'); return; }
        tsLoadTranscript(undefined, url);
      };
    }

    // Step 3: Split
    const clipLenEl = document.getElementById('wf-clip-length');
    if (clipLenEl) clipLenEl.onchange = () => { S.wf.clipLength = parseInt(clipLenEl.value, 10) || 20; };
    const splitBtn = document.getElementById('wf-split-btn');
    if (splitBtn) splitBtn.onclick = wfSplit;
    const step3Back = document.getElementById('wf-step3-back');
    if (step3Back) step3Back.onclick = () => { S.wf.step = 2; wfReRender(); };
    const step3Next = document.getElementById('wf-step3-next');
    if (step3Next) step3Next.onclick = () => { S.wf.step = 4; wfReRender(); };

    // Step 4: Generate Drafts
    const generateBtn = document.getElementById('wf-generate-btn');
    if (generateBtn) generateBtn.onclick = wfGenerateDrafts;
    const step4Back = document.getElementById('wf-step4-back');
    if (step4Back) step4Back.onclick = () => { S.wf.step = 3; wfReRender(); };
    const step4Next = document.getElementById('wf-step4-next');
    if (step4Next) step4Next.onclick = () => { S.wf.step = 5; wfReRender(); };

    // Step 5: Review & Correct
    const reviewList = document.getElementById('wf-review-list');
    if (reviewList) {
      // Play clip buttons
      reviewList.querySelectorAll('.wf-play-clip').forEach(btn => {
        btn.onclick = () => wfPlayClip(parseInt(btn.dataset.wfClip, 10));
      });
      // Accept buttons
      reviewList.querySelectorAll('.wf-accept-clip').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.wfAccept, 10);
          // Save text changes first
          const textEl = reviewList.querySelector(`[data-wf-text="${idx}"]`);
          if (textEl) S.wf.drafts[idx].draft_transcript = textEl.value;
          S.wf.drafts[idx].status = S.wf.drafts[idx].status === 'accepted' ? 'pending' : 'accepted';
          wfUpdateReviewCounts();
          wfReRender();
        };
      });
      // Reject buttons
      reviewList.querySelectorAll('.wf-reject-clip').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.wfReject, 10);
          const textEl = reviewList.querySelector(`[data-wf-text="${idx}"]`);
          if (textEl) S.wf.drafts[idx].draft_transcript = textEl.value;
          S.wf.drafts[idx].status = S.wf.drafts[idx].status === 'rejected' ? 'pending' : 'rejected';
          wfUpdateReviewCounts();
          wfReRender();
        };
      });
      // Groq third-opinion check buttons
      reviewList.querySelectorAll('.wf-groq-check').forEach(btn => {
        btn.onclick = async () => {
          const idx = parseInt(btn.dataset.wfGroq, 10);
          const draft = S.wf.drafts[idx];
          if (!draft) return;
          if (!S.groqApiKey) {
            alert('Paste a Groq API key above first (free, from console.groq.com).');
            return;
          }
          S.groqChecks[draft.clip_path] = { loading: true };
          wfReRender();
          const res = await api.groqCheck(S.projectDir, draft.clip_path, S.groqApiKey);
          S.groqChecks[draft.clip_path] = res && res.ok
            ? { loading: false, text: res.text }
            : { loading: false, error: (res && res.error) || 'Request failed' };
          wfReRender();
        };
      });
      // Groq apply buttons
      reviewList.querySelectorAll('.wf-groq-apply').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.wfApply, 10);
          const draft = S.wf.drafts[idx];
          if (!draft) return;
          const gc = S.groqChecks[draft.clip_path];
          if (gc && gc.text !== undefined) {
            draft.draft_transcript = gc.text;
            wfReRender();
          }
        };
      });
      // Text change handlers — save transcript edits to state on blur
      reviewList.querySelectorAll('.wf-draft-text').forEach(ta => {
        ta.onblur = () => {
          const idx = parseInt(ta.dataset.wfText, 10);
          S.wf.drafts[idx].draft_transcript = ta.value;
        };
      });
    }
    const groqKeyInput = document.getElementById('wf-groq-key');
    if (groqKeyInput) {
      groqKeyInput.oninput = () => {
        S.groqApiKey = groqKeyInput.value;
        try { localStorage.setItem('parayu-admin-groq-key', S.groqApiKey); } catch (_) { /* best-effort */ }
      };
    }
    const groqBatchBtn = document.getElementById('wf-groq-batch-btn');
    if (groqBatchBtn) {
      groqBatchBtn.onclick = async () => {
        if (!S.groqApiKey) {
          alert('Paste a Groq API key above first (free, from console.groq.com).');
          return;
        }
        if (S.wf.busy) return;

        // Save any pending text changes first
        const listEl = document.getElementById('wf-review-list');
        if (listEl) {
          listEl.querySelectorAll('.wf-draft-text').forEach(ta => {
            const idx = parseInt(ta.dataset.wfText, 10);
            S.wf.drafts[idx].draft_transcript = ta.value;
          });
        }

        S.wf.busy = true;
        S.wf.groqBatchLoading = true;
        wfReRender();

        try {
          // Send all drafts with their start/end timing info
          const draftsMetadata = S.wf.drafts.map(d => ({
            clip_path: d.clip_path,
            duration: d.duration,
            start: d.start,
            end: d.end
          }));

          const res = await api.groqBatchCheck(S.projectDir, S.groqApiKey, draftsMetadata);
          S.wf.busy = false;
          S.wf.groqBatchLoading = false;

          if (res && res.ok) {
            for (const clipPath of Object.keys(res.results)) {
              S.groqChecks[clipPath] = { loading: false, text: res.results[clipPath] };
            }
          } else {
            alert('Groq batch check failed: ' + ((res && res.error) || 'Unknown error'));
          }
        } catch (err) {
          S.wf.busy = false;
          S.wf.groqBatchLoading = false;
          alert('Groq batch check failed: ' + err.message);
        }
        wfReRender();
      };
    }
    const groqApplyAllBtn = document.getElementById('wf-groq-apply-all-btn');
    if (groqApplyAllBtn) {
      groqApplyAllBtn.onclick = () => {
        S.wf.drafts.forEach(draft => {
          const gc = S.groqChecks[draft.clip_path];
          if (gc && gc.text !== undefined) {
            draft.draft_transcript = gc.text;
          }
        });
        wfReRender();
      };
    }
    // Accept All
    const acceptAllBtn = document.getElementById('wf-accept-all');
    if (acceptAllBtn) acceptAllBtn.onclick = () => {
      // Save any pending text changes first
      const reviewList = document.getElementById('wf-review-list');
      if (reviewList) {
        reviewList.querySelectorAll('.wf-draft-text').forEach(ta => {
          const idx = parseInt(ta.dataset.wfText, 10);
          S.wf.drafts[idx].draft_transcript = ta.value;
        });
      }
      S.wf.drafts.forEach(d => { if (d.status !== 'rejected') d.status = 'accepted'; });
      wfReRender();
    };
    // Save Drafts
    const saveDraftsBtn = document.getElementById('wf-save-drafts');
    if (saveDraftsBtn) saveDraftsBtn.onclick = async () => {
      // Capture latest text changes
      const rl = document.getElementById('wf-review-list');
      if (rl) {
        rl.querySelectorAll('.wf-draft-text').forEach(ta => {
          const idx = parseInt(ta.dataset.wfText, 10);
          S.wf.drafts[idx].draft_transcript = ta.value;
        });
      }
      await wfSaveDrafts();
      alert('Progress saved!');
    };
    const step5Back = document.getElementById('wf-step5-back');
    if (step5Back) step5Back.onclick = () => { S.wf.step = 4; wfReRender(); };

    // Step 5: Build
    const buildBtn = document.getElementById('wf-build-btn');
    if (buildBtn) buildBtn.onclick = () => {
      wfBuildDataset();
    };

    // ── Transcript Studio events ──
    const tsUrlInput = document.getElementById('ts-url-input');
    if (tsUrlInput) {
      tsUrlInput.onkeydown = (event) => {
        if (event.key === 'Enter') {
          tsLoadTranscript();
        }
      };
      tsUrlInput.onchange = () => {
        S.ts.url = tsUrlInput.value;
      };
    }
    const tsBtnLoad = document.getElementById('ts-btn-load');
    if (tsBtnLoad) tsBtnLoad.onclick = () => tsLoadTranscript();

    // Tab buttons for seconds windows
    document.querySelectorAll('.ts-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const sec = parseInt(btn.dataset.sec, 10);
        tsLoadTranscript(sec);
      };
    });

    // Search input (filtered in DOM to preserve focus)
    const tsSearchInput = document.getElementById('ts-search-input');
    if (tsSearchInput) {
      tsSearchInput.oninput = () => {
        S.ts.search = tsSearchInput.value;
        const query = tsSearchInput.value.trim().toLowerCase();
        const cleanTextFn = (txt) => String(txt || '').toLowerCase().replace(/\?/g, "").replace(/\s+([,.;:!?])/g, "$1").replace(/[,.]/g, "").replace(/\s+([;:!])/g, "$1").replace(/\s+/g, " ").trim();
        
        document.querySelectorAll('.ts-row').forEach(row => {
          const textEl = row.querySelector('p');
          const text = textEl ? textEl.textContent : '';
          const cleanText = cleanTextFn(text);
          const rangeEl = row.querySelector('.ts-subtitle-range');
          const range = rangeEl ? rangeEl.textContent : '';
          
          if (!query || text.toLowerCase().includes(query) || cleanText.includes(query) || range.includes(query)) {
            row.style.display = 'grid';
          } else {
            row.style.display = 'none';
          }
        });
      };
    }

    // Copy all
    const tsBtnCopyAll = document.getElementById('ts-btn-copy-all');
    if (tsBtnCopyAll) {
      tsBtnCopyAll.onclick = () => {
        const cleanTextFn = (txt) => String(txt || '').toLowerCase().replace(/\?/g, "").replace(/\s+([,.;:!?])/g, "$1").replace(/[,.]/g, "").replace(/\s+([;:!])/g, "$1").replace(/\s+/g, " ").trim();
        const activeText = S.ts.rows.map(item => {
          return S.ts.trainingClean ? cleanTextFn(item.text) : `${item.time} --> ${item.time}\n${item.text}`;
        }).join(S.ts.trainingClean ? '\n' : '\n\n');
        tsCopyText(activeText, 'Copied all boxes to clipboard');
      };
    }

    // Auto-fill left to right copy button
    const tsBtnAutoFill = document.getElementById('ts-btn-auto-fill');
    if (tsBtnAutoFill) {
      tsBtnAutoFill.onclick = () => {
        if (S.ts.rows.length === 0) {
          alert('No YouTube transcript rows to copy.');
          return;
        }
        if (S.wf.drafts.length === 0) {
          alert('Please click "Prepare Drafts" first.');
          return;
        }
        // Pairing is purely positional (row[i] -> draft[i]) — if the two
        // lists aren't the same length, every clip past the shorter list's
        // end (and potentially earlier, if the two were split independently
        // rather than at locked timestamps) gets the wrong transcript text
        // with no visible sign anything is wrong. A silent min()-truncated
        // copy already caused exactly that bug once; refuse instead.
        if (S.ts.rows.length !== S.wf.drafts.length) {
          alert(
            `Cannot copy: ${S.ts.rows.length} transcript window(s) vs ${S.wf.drafts.length} audio clip(s) — counts don't match.\n\n` +
            'Copying anyway would pair some clips with the wrong transcript text. ' +
            'Go back to Step 3 and re-run "Split Clips" now that this transcript is loaded, ' +
            'so the audio is cut at the exact same timestamps as these caption windows, then try again.'
          );
          return;
        }
        const cleanTextFn = (txt) => String(txt || '').toLowerCase().replace(/\?/g, "").replace(/\s+([,.;:!?])/g, "$1").replace(/[,.]/g, "").replace(/\s+([;:!])/g, "$1").replace(/\s+/g, " ").trim();
        let copied = 0;
        for (let i = 0; i < S.ts.rows.length; i++) {
          const text = S.ts.trainingClean ? cleanTextFn(S.ts.rows[i].text) : S.ts.rows[i].text;
          S.wf.drafts[i].draft_transcript = text;
          copied++;
        }
        wfReRender();
        alert(`Successfully copied ${copied} transcripts to review boxes!`);
      };
    }

    // Download text transcript
    const tsBtnDownload = document.getElementById('ts-btn-download');
    if (tsBtnDownload) {
      tsBtnDownload.onclick = () => {
        const cleanTextFn = (txt) => String(txt || '').toLowerCase().replace(/\?/g, "").replace(/\s+([,.;:!?])/g, "$1").replace(/[,.]/g, "").replace(/\s+([;:!])/g, "$1").replace(/\s+/g, " ").trim();
        const activeText = S.ts.rows.map(item => {
          return S.ts.trainingClean ? cleanTextFn(item.text) : `${item.time} --> ${item.time}\n${item.text}`;
        }).join(S.ts.trainingClean ? '\n' : '\n\n');
        tsDownloadContent(`transcript-${S.ts.windowSeconds}s.txt`, activeText, 'text/plain');
      };
    }

    // Clean text toggle button
    const tsBtnClean = document.getElementById('ts-btn-clean');
    if (tsBtnClean) {
      tsBtnClean.onclick = () => {
        S.ts.trainingClean = !S.ts.trainingClean;
        wfReRender();
      };
    }

    // Download metadata.csv button
    const tsBtnMetadata = document.getElementById('ts-btn-metadata');
    if (tsBtnMetadata) {
      tsBtnMetadata.onclick = () => {
        const csvContent = tsBuildMetadataCsv();
        tsDownloadContent('metadata.csv', csvContent, 'text/csv;charset=utf-8');
      };
    }

    // Play buttons on each row
    document.querySelectorAll('.ts-row-play-btn').forEach(btn => {
      btn.onclick = () => {
        const start = parseInt(btn.dataset.start, 10);
        tsTogglePlay(start);
      };
    });

    // Copy button on each row
    document.querySelectorAll('.ts-row-copy-btn').forEach(btn => {
      btn.onclick = () => {
        const text = btn.dataset.text;
        tsCopyText(text, 'Box copied to clipboard');
      };
    });

    // Copy this single row directly into its matching draft box on the right
    document.querySelectorAll('.ts-row-to-right-btn').forEach(btn => {
      btn.onclick = () => {
        const rowIndex = parseInt(btn.dataset.rowIndex, 10);
        const row = S.ts.rows[rowIndex];
        if (!row) return;
        if (!S.wf.drafts[rowIndex]) {
          alert(`No matching clip box on the right for transcript window #${rowIndex + 1} (only ${S.wf.drafts.length} clip box(es) exist). Re-run "Split Clips" after loading this transcript so the counts line up.`);
          return;
        }
        const cleanTextFn = (txt) => String(txt || '').toLowerCase().replace(/\?/g, "").replace(/\s+([,.;:!?])/g, "$1").replace(/[,.]/g, "").replace(/\s+([;:!])/g, "$1").replace(/\s+/g, " ").trim();
        S.wf.drafts[rowIndex].draft_transcript = S.ts.trainingClean ? cleanTextFn(row.text) : row.text;
        wfReRender();
      };
    });
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
      cleanMetadataBtn: document.getElementById('ds-cleanMetadata'),
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
      langTaskSelect: document.getElementById('ds-lang-task'),
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

    if (el.ensureBtn) el.ensureBtn.onclick = prepareProject;
    if (el.chooseBtn) {
      el.chooseBtn.onclick = async () => {
        const folder = await api.chooseProjectFolder();
        if (!folder) return;
        S.projectDir = folder;
        await prepareProject();
        await wfAutoResume();
      };
    }
    if (el.openBtn) el.openBtn.onclick = () => api.openPath(S.projectDir);
    if (el.openAudioBtn) el.openAudioBtn.onclick = async () => { await prepareProject(); api.openPath(S.scan.audioDir); };
    if (el.backupBtn) el.backupBtn.onclick = backupDataset;
    if (el.chooseAudioBtn) {
      el.chooseAudioBtn.onclick = async () => {
        await prepareProject();
        const filePaths = await api.chooseAudioFiles();
        await importAudioFiles(filePaths);
      };
    }
    if (el.cleanMetadataBtn) {
      el.cleanMetadataBtn.onclick = () => {
        if (S.rows.length === 0) {
          alert('No transcripts to clean.');
          return;
        }
        let count = 0;
        S.rows.forEach((row) => {
          const oldText = row.text;
          let text = (oldText || '').toLowerCase();
          // Remove punctuation: periods, commas, question marks, exclamation marks, etc.
          text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
          // Replace multiple spaces with a single space, and trim
          text = text.replace(/\s+/g, ' ').trim();
          if (text !== oldText) {
            row.text = text;
            count++;
          }
        });
        S.dirty = true;
        renderMetadataRows();
        renderMetadataPreview();
        alert(`Cleaned ${count} transcripts. Please click 'Save metadata.csv' to write changes to disk.`);
      };
    }
    if (el.saveMetadataBtn) el.saveMetadataBtn.onclick = saveMetadata;
    if (el.startRec) el.startRec.onclick = startRecording;
    if (el.stopRec) el.stopRec.onclick = stopRecording;
    if (el.saveRec) el.saveRec.onclick = saveRecording;
    if (el.discardRec) el.discardRec.onclick = resetPreview;

    root().querySelectorAll('[data-copy]').forEach((button) => {
      button.onclick = async () => {
        await navigator.clipboard.writeText(button.dataset.copy);
        const original = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = original; }, 1200);
      };
    });

    if (el.dropZone) {
      el.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); el.dropZone.classList.add('dragging'); });
      el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('dragging'));
      el.dropZone.addEventListener('drop', async (event) => {
        event.preventDefault();
        el.dropZone.classList.remove('dragging');
        await prepareProject();
        const paths = Array.from(event.dataTransfer.files).map((file) => api.getPathForFile(file)).filter(Boolean);
        await importAudioFiles(paths);
      });
    }

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
    wireWorkflow();

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
        await wfAutoResume();
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
.ds-studio.settings-page {
  overflow: visible !important;
}
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
  background: var(--card, #ffffff) !important;
  box-shadow: var(--shadow-card);
  margin-bottom: 16px;
  position: sticky;
  top: 14px;
  z-index: 100;
}
.dt-progress-card.success {
  border-color: #badbd3;
  background: #f2faf8 !important;
}
.dt-progress-card.failed {
  border-color: var(--ds-accent);
  background: #fef3f4 !important;
}
.dt-progress-card.cancelled {
  border-color: var(--ds-line);
  background: var(--ds-soft) !important;
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
  align-self: stretch;
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
/* Mirrors the step's own "Complete" badge directly onto its trigger button —
   the corner badge is easy to miss right after clicking, the button itself is not. */
.btn-step-done {
  background: var(--ds-success-soft) !important;
  color: var(--ds-success) !important;
  border-color: var(--ds-success) !important;
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
.btn-hold-confirm {
  position: relative;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--ds-soft);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.btn-hold-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-hold-fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 0%;
  background: var(--accent-grad);
  z-index: 0;
  transition: width 0.15s ease;
}
.btn-hold-confirm.holding .btn-hold-fill {
  width: 100%;
  transition: width 5s linear;
}
.btn-hold-label {
  position: relative;
  z-index: 1;
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
