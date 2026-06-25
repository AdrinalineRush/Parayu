const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('parayu', {
  onToggleRecording: (cb) => ipcRenderer.on('toggle-recording', (_e, recording) => cb(recording)),
  transcribeAudio: (wavArrayBuffer) => ipcRenderer.invoke('transcribe-audio', wavArrayBuffer),
  getState: () => ipcRenderer.invoke('get-state'),
  addDictionaryEntry: (entry) => ipcRenderer.invoke('add-dictionary-entry', entry),
  removeDictionaryEntry: (index) => ipcRenderer.invoke('remove-dictionary-entry', index),
  addSnippet: (entry) => ipcRenderer.invoke('add-snippet', entry),
  removeSnippet: (index) => ipcRenderer.invoke('remove-snippet', index),
  setHotkey: (hotkey) => ipcRenderer.invoke('set-hotkey', hotkey),
  setMicDevice: (deviceId) => ipcRenderer.invoke('set-mic-device', deviceId),
  setAiCleanup: (enabled) => ipcRenderer.invoke('set-ai-cleanup', enabled),
  setBoostQuietVoices: (enabled) => ipcRenderer.invoke('set-boost-quiet-voices', enabled),
  setNoiseSuppression: (enabled) => ipcRenderer.invoke('set-noise-suppression', enabled),
  setInputLanguage: (lang) => ipcRenderer.invoke('set-input-language', lang),
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
  sendLevel: (level) => ipcRenderer.send('mic-level', level),
  notifyRecordingStopped: () => ipcRenderer.send('recording-stopped-from-ui'),
  onStopMicTest: (cb) => ipcRenderer.on('stop-mic-test', () => cb()),
  googleLogin: () => ipcRenderer.invoke('google-login'),
  googleLogout: () => ipcRenderer.invoke('google-logout'),
  // Dev-only Dataset Studio push-to-talk: main routes the hotkey here when the
  // Studio page is focused; the renderer reports focus via setTrainerCaptureMode.
  onTrainerToggleRecording: (cb) => ipcRenderer.on('trainer-toggle-recording', (_e, recording) => cb(recording)),
  setTrainerCaptureMode: (on) => ipcRenderer.send('trainer-capture-mode', on)
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

  // ── Admin Training Panel (dev-only; runs local scripts + model file ops) ──
  trainEnv: (opts) => ipcRenderer.invoke('train-env', opts),
  trainValidate: (opts) => ipcRenderer.invoke('train-validate', opts),
  trainTestBase: (opts) => ipcRenderer.invoke('train-test-base', opts),
  trainTestTrained: (opts) => ipcRenderer.invoke('train-test-trained', opts),
  trainStart: (opts) => ipcRenderer.invoke('train-start', opts),
  trainExport: (opts) => ipcRenderer.invoke('train-export', opts),
  trainToolsStatus: (opts) => ipcRenderer.invoke('train-tools-status', opts),
  trainSetupTools: (opts) => ipcRenderer.invoke('train-setup-tools', opts),
  trainConvertGgml: (opts) => ipcRenderer.invoke('train-convert-ggml', opts),
  trainCancel: () => ipcRenderer.invoke('train-cancel'),
  trainStatus: () => ipcRenderer.invoke('train-status'),
  modelInfo: (opts) => ipcRenderer.invoke('train-model-info', opts),
  backupModel: (opts) => ipcRenderer.invoke('train-backup-model', opts),
  replaceModel: (opts) => ipcRenderer.invoke('train-replace-model', opts),
  restoreBackup: (opts) => ipcRenderer.invoke('train-restore-backup', opts),
  openTrainingOutput: (opts) => ipcRenderer.invoke('train-open-output', opts),
  onTrainLog: (cb) => ipcRenderer.on('train-log', (_e, line) => cb(line)),
  onTrainProgress: (cb) => ipcRenderer.on('train-progress', (_e, progress) => cb(progress))
});
