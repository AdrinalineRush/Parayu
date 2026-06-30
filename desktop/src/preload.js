const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('parayu', {
  onToggleRecording: (cb) => ipcRenderer.on('toggle-recording', (_e, recording) => cb(recording)),
  transcribeAudio: (wavArrayBuffer, isScreenwriting) => ipcRenderer.invoke('transcribe-audio', wavArrayBuffer, isScreenwriting),
  getState: () => ipcRenderer.invoke('get-state'),
  addDictionaryEntry: (entry) => ipcRenderer.invoke('add-dictionary-entry', entry),
  removeDictionaryEntry: (index) => ipcRenderer.invoke('remove-dictionary-entry', index),
  addSnippet: (entry) => ipcRenderer.invoke('add-snippet', entry),
  removeSnippet: (index) => ipcRenderer.invoke('remove-snippet', index),
  setHotkey: (hotkey) => ipcRenderer.invoke('set-hotkey', hotkey),
  setMicDevice: (deviceId) => ipcRenderer.invoke('set-mic-device', deviceId),
  setAiCleanup: (enabled) => ipcRenderer.invoke('set-ai-cleanup', enabled),
  setAiFormatterEnabled: (enabled) => ipcRenderer.invoke('set-ai-formatter-enabled', enabled),
  setCleanupMode: (mode) => ipcRenderer.invoke('set-cleanup-mode', mode),
  setAlwaysFormat: (enabled) => ipcRenderer.invoke('set-always-format', enabled),
  setFormatterProvider: (provider) => ipcRenderer.invoke('set-formatter-provider', provider),
  setFormatterOutputMode: (mode) => ipcRenderer.invoke('set-formatter-output-mode', mode),
  setFormatterTone: (tone) => ipcRenderer.invoke('set-formatter-tone', tone),
  setFormatterTimeout: (timeoutMs) => ipcRenderer.invoke('set-formatter-timeout', timeoutMs),
  setFormatterModel: (model) => ipcRenderer.invoke('set-formatter-model', model),
  setSkipLlmForShortDictations: (enabled) => ipcRenderer.invoke('set-skip-llm-for-short-dictations', enabled),
  setFormatterMinWords: (words) => ipcRenderer.invoke('set-formatter-min-words', words),
  setLocalOnlyMode: (enabled) => ipcRenderer.invoke('set-local-only-mode', enabled),
  setPreserveClipboard: (enabled) => ipcRenderer.invoke('set-preserve-clipboard', enabled),
  setRestoreClipboardDelay: (delay) => ipcRenderer.invoke('set-restore-clipboard-delay', delay),
  setEnablePersonalDictionary: (enabled) => ipcRenderer.invoke('set-enable-personal-dictionary', enabled),
  setEnableGlobalDictionary: (enabled) => ipcRenderer.invoke('set-enable-global-dictionary', enabled),
  setEnableTextSnippets: (enabled) => ipcRenderer.invoke('set-enable-text-snippets', enabled),
  setBoostQuietVoices: (enabled) => ipcRenderer.invoke('set-boost-quiet-voices', enabled),
  setNoiseSuppression: (enabled) => ipcRenderer.invoke('set-noise-suppression', enabled),
  setInputLanguage: (lang) => ipcRenderer.invoke('set-input-language', lang),
  setTranslateMalayalam: (enabled) => ipcRenderer.invoke('set-translate-malayalam', enabled),
  setDictationMode: (mode) => ipcRenderer.invoke('set-dictation-mode', mode),
  listModels: () => ipcRenderer.invoke('list-models'),
  downloadModel: (id) => ipcRenderer.invoke('download-model', id),
  selectModel: (id) => ipcRenderer.invoke('select-model', id),
  onModelDownloadProgress: (cb) => ipcRenderer.on('model-download-progress', (_e, p) => cb(p)),
  completeOnboarding: () => ipcRenderer.invoke('complete-onboarding'),
  resetOnboarding: () => ipcRenderer.invoke('reset-onboarding'),
  saveProfile: (profile) => ipcRenderer.invoke('save-profile', profile),
  checkAccessibility: (prompt) => ipcRenderer.invoke('check-accessibility', prompt),
  openAccessibilitySettings: () => ipcRenderer.invoke('open-accessibility-settings'),
  openPricingPage: () => ipcRenderer.invoke('open-pricing-page'),
  sendLevel: (level) => ipcRenderer.send('mic-level', level),
  notifyRecordingStopped: () => ipcRenderer.send('recording-stopped-from-ui'),
  onStopMicTest: (cb) => ipcRenderer.on('stop-mic-test', () => cb()),
  googleLogin: () => ipcRenderer.invoke('google-login'),
  googleLogout: () => ipcRenderer.invoke('google-logout'),
  devDemoLogin: (credentials) => ipcRenderer.invoke('dev-demo-login', credentials),
  refreshSubscription: () => ipcRenderer.invoke('subscription-refresh'),
  activateLicense: (payload) => ipcRenderer.invoke('license-activate', payload),
  onSubscriptionUpdated: (cb) => ipcRenderer.on('subscription-updated', (_e, status) => cb(status)),
  // Dev-only Dataset Studio push-to-talk: main routes the hotkey here when the
  // Studio page is focused; the renderer reports focus via setTrainerCaptureMode.
  onTrainerToggleRecording: (cb) => ipcRenderer.on('trainer-toggle-recording', (_e, recording) => cb(recording)),
  setTrainerCaptureMode: (on) => ipcRenderer.send('trainer-capture-mode', on),
  // Screenwriting — local, offline multi-language translation (IndicTrans2).
  translationStatus: () => ipcRenderer.invoke('translation-status'),
  setupTranslation: () => ipcRenderer.invoke('setup-translation'),
  cancelTranslationSetup: () => ipcRenderer.invoke('cancel-translation-setup'),
  translateText: (opts) => ipcRenderer.invoke('translate-text', opts),
  onTranslationSetupProgress: (cb) => ipcRenderer.on('translation-setup-progress', (_e, message) => cb(message)),
  saveScreenwritingTranscript: (text) => ipcRenderer.invoke('save-screenwriting-transcript', text),
  setHfToken: (token) => ipcRenderer.invoke('set-hf-token', token),
  getHfTokenStatus: () => ipcRenderer.invoke('get-hf-token-status'),
  offlineAIStatus: () => ipcRenderer.invoke('offline-ai-status'),
  downloadOfflineAIModel: (modelId) => ipcRenderer.invoke('download-offline-ai-model', modelId),
  onOfflineAIStatus: (cb) => ipcRenderer.on('offline-ai-status', (_e, status) => cb(status)),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

// Admin bridge — the renderer admin UI (src/renderer/admin/admin.js) is only
// loaded in the dev build, and these handlers only exist there, so in the public
// build these are inert stubs that never get called.
contextBridge.exposeInMainWorld('parayuAdmin', {
  getGlobalDict: () => ipcRenderer.invoke('admin-get-global-dict'),
  saveGlobalDict: (data) => ipcRenderer.invoke('admin-save-global-dict', data),
  signIn: (creds) => ipcRenderer.invoke('admin-sign-in', creds),
  signOut: () => ipcRenderer.invoke('admin-sign-out'),
  authStatus: () => ipcRenderer.invoke('admin-auth-status'),
  publish: (data) => ipcRenderer.invoke('admin-publish-supabase', data),
  getWebsite: () => ipcRenderer.invoke('admin-get-website'),
  openWebsite: (url) => ipcRenderer.invoke('admin-open-website', url)
});

// Dataset Studio bridge — local Whisper fine-tuning data prep. Powered by the
// dev-only trainer-* handlers (src/admin/datasetStudio.js); inert in the public
// build where those handlers don't exist and the admin UI never loads.
contextBridge.exposeInMainWorld('trainerAPI', {
  getDefaultProject: () => ipcRenderer.invoke('trainer-get-default-project'),
  chooseProjectFolder: () => ipcRenderer.invoke('trainer-choose-project-folder'),
  ensureProject: (projectDir) => ipcRenderer.invoke('trainer-ensure-project', projectDir),
  scanProject: (projectDir) => ipcRenderer.invoke('trainer-scan-project', projectDir),
  chooseAudioFiles: () => ipcRenderer.invoke('trainer-choose-audio-files'),
  importAudioFiles: (projectDir, filePaths) => ipcRenderer.invoke('trainer-import-audio-files', projectDir, filePaths),
  saveRecordedAudio: (projectDir, recording) => ipcRenderer.invoke('trainer-save-recorded-audio', projectDir, recording),
  saveMetadata: (projectDir, rows) => ipcRenderer.invoke('trainer-save-metadata', projectDir, rows),
  backupDataset: (projectDir) => ipcRenderer.invoke('trainer-backup-dataset', projectDir),
  openPath: (targetPath) => ipcRenderer.invoke('trainer-open-path', targetPath),
  showInFolder: (targetPath) => ipcRenderer.invoke('trainer-show-in-folder', targetPath),
  deleteClip: (projectDir, audioRelativePath) => ipcRenderer.invoke('trainer-delete-clip', projectDir, audioRelativePath),
  readAudioFile: (projectDir, audioRelativePath) => ipcRenderer.invoke('trainer-read-audio-file', projectDir, audioRelativePath),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // ── Dataset Studio guided workflow ──
  workflowImport: (projectDir) => ipcRenderer.invoke('trainer-workflow-import', projectDir),
  workflowImportYoutube: (projectDir, url) => ipcRenderer.invoke('trainer-workflow-import-youtube', projectDir, url),
  workflowExtractAudio: (projectDir, importedFile) => ipcRenderer.invoke('trainer-workflow-extract-audio', projectDir, importedFile),
  workflowSplitClips: (projectDir, extFile, opts) => ipcRenderer.invoke('trainer-workflow-split-clips', projectDir, extFile, opts),
  workflowSplitClipsAtTimes: (projectDir, extFile, windows) => ipcRenderer.invoke('trainer-workflow-split-clips-at-times', projectDir, extFile, windows),
  workflowGenerateDrafts: (projectDir) => ipcRenderer.invoke('trainer-workflow-generate-drafts', projectDir),
  groqCheck: (projectDir, clipRelativePath, apiKey) => ipcRenderer.invoke('trainer-groq-check', projectDir, clipRelativePath, apiKey),
  groqBatchCheck: (projectDir, apiKey, drafts) => ipcRenderer.invoke('trainer-groq-batch-check', projectDir, apiKey, drafts),
  workflowLoadDrafts: (projectDir) => ipcRenderer.invoke('trainer-workflow-load-drafts', projectDir),
  workflowSaveDrafts: (projectDir, drafts) => ipcRenderer.invoke('trainer-workflow-save-drafts', projectDir, drafts),
  workflowBuildDataset: (projectDir, drafts) => ipcRenderer.invoke('trainer-workflow-build-dataset', projectDir, drafts),
  workflowReadClipFile: (projectDir, relativePath) => ipcRenderer.invoke('trainer-workflow-read-clip-file', projectDir, relativePath),
  workflowGetState: (projectDir) => ipcRenderer.invoke('trainer-workflow-get-state', projectDir),
  workflowClear: (projectDir) => ipcRenderer.invoke('trainer-workflow-clear', projectDir),
  workflowYoutubeTranscript: (url, seconds) => ipcRenderer.invoke('trainer-workflow-youtube-transcript', url, seconds),
  
  onImportProgress: (cb) => {
    const listener = (_e, val) => cb(val);
    ipcRenderer.on('trainer-import-progress', listener);
    return () => ipcRenderer.removeListener('trainer-import-progress', listener);
  },
  onExtractProgress: (cb) => {
    const listener = (_e, val) => cb(val);
    ipcRenderer.on('trainer-extract-progress', listener);
    return () => ipcRenderer.removeListener('trainer-extract-progress', listener);
  },
  onSplitProgress: (cb) => {
    const listener = (_e, val) => cb(val);
    ipcRenderer.on('trainer-split-progress', listener);
    return () => ipcRenderer.removeListener('trainer-split-progress', listener);
  },
  onDraftProgress: (cb) => {
    const listener = (_e, val) => cb(val);
    ipcRenderer.on('trainer-draft-progress', listener);
    return () => ipcRenderer.removeListener('trainer-draft-progress', listener);
  },
  onBuildProgress: (cb) => {
    const listener = (_e, val) => cb(val);
    ipcRenderer.on('trainer-build-progress', listener);
    return () => ipcRenderer.removeListener('trainer-build-progress', listener);
  },

  // ── Admin Training Panel (dev-only; runs local scripts + model file ops) ──
  trainEnv: (opts) => ipcRenderer.invoke('train-env', opts),
  trainValidate: (opts) => ipcRenderer.invoke('train-validate', opts),
  trainTestBase: (opts) => ipcRenderer.invoke('train-test-base', opts),
  trainTestTrained: (opts) => ipcRenderer.invoke('train-test-trained', opts),
  trainStart: (opts) => ipcRenderer.invoke('train-start', opts),
  trainExport: (opts) => ipcRenderer.invoke('train-export', opts),
  trainResetPipeline: (opts) => ipcRenderer.invoke('train-reset-pipeline', opts),
  trainToolsStatus: (opts) => ipcRenderer.invoke('train-tools-status', opts),
  trainSetupTools: (opts) => ipcRenderer.invoke('train-setup-tools', opts),
  trainConvertGgml: (opts) => ipcRenderer.invoke('train-convert-ggml', opts),
  trainCancel: () => ipcRenderer.invoke('train-cancel'),
  trainStatus: () => ipcRenderer.invoke('train-status'),
  modelInfo: (opts) => ipcRenderer.invoke('train-model-info', opts),
  backupModel: (opts) => ipcRenderer.invoke('train-backup-model', opts),
  replaceModel: (opts) => ipcRenderer.invoke('train-replace-model', opts),
  restoreBackup: (opts) => ipcRenderer.invoke('train-restore-backup', opts),
  replaceLocalModel: (opts) => ipcRenderer.invoke('train-replace-local-model', opts),
  restoreLocalModel: (opts) => ipcRenderer.invoke('train-restore-local-model', opts),
  setReleaseModel: (opts) => ipcRenderer.invoke('train-set-release-model', opts),
  restoreReleaseModel: (opts) => ipcRenderer.invoke('train-restore-release-model', opts),
  getBackupHistory: (opts) => ipcRenderer.invoke('train-backup-history-get', opts),
  revealBackup: (filePath) => ipcRenderer.invoke('train-reveal-backup', filePath),
  openTrainingOutput: (opts) => ipcRenderer.invoke('train-open-output', opts),
  getRunsHistory: (opts) => ipcRenderer.invoke('train-runs-history-get', opts),
  saveRunsHistory: (opts, history) => ipcRenderer.invoke('train-runs-history-save', opts, history),
  saveManifest: (opts, manifest) => ipcRenderer.invoke('train-manifest-save', opts, manifest),
  onTrainLog: (cb) => ipcRenderer.on('train-log', (_e, line) => cb(line)),
  onTrainProgress: (cb) => ipcRenderer.on('train-progress', (_e, progress) => cb(progress))
});
