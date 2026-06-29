const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  STATUS,
  MODEL_UNCONFIGURED_MESSAGE,
  formatBytes,
  ModelDownloadManager,
  ModelIntegrityVerifier,
  FormatterAvailabilityService,
  OllamaFormatterProvider,
  BundledLlamaCppFormatterProvider
} = require('../src/offlineAI');

test('Offline AI status exposes public labels and privacy message', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parayu-offline-ai-'));
  const manager = new ModelDownloadManager({ baseDir: tmp });
  const service = new FormatterAvailabilityService({ downloadManager: manager });
  const status = await service.status('fast_3b');
  assert.equal(status.state, STATUS.BASIC_READY);
  assert.equal(status.configured, false);
  assert.equal(status.canDownload, false);
  assert.equal(status.unavailableReason, MODEL_UNCONFIGURED_MESSAGE);
  assert.equal(status.privacy, 'Your voice and text stay on this device.');
  assert.match(status.sizeLabel, /GB|MB/);
});

test('Configured Offline AI model reports downloadable not-installed state', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parayu-offline-ai-'));
  const manager = new ModelDownloadManager({
    baseDir: tmp,
    catalog: {
      fast_3b: {
        id: 'fast_3b',
        label: 'Fast Offline AI Model',
        sizeBytes: 5,
        url: 'https://example.com/model.bin',
        sha256: ''
      }
    }
  });
  const service = new FormatterAvailabilityService({ downloadManager: manager });
  const status = await service.status('fast_3b');
  assert.equal(status.state, STATUS.NOT_INSTALLED);
  assert.equal(status.configured, true);
  assert.equal(status.canDownload, true);
});

test('Unconfigured Offline AI download fails with a product-safe message', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parayu-offline-ai-'));
  const manager = new ModelDownloadManager({ baseDir: tmp });
  await assert.rejects(
    () => manager.download('fast_3b'),
    new RegExp(MODEL_UNCONFIGURED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

test('ModelDownloadManager verifies an installed model file', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parayu-offline-ai-'));
  const verifier = new ModelIntegrityVerifier();
  const file = path.join(tmp, 'fast_3b.model');
  fs.writeFileSync(file, 'model');
  const sha256 = await verifier.sha256(file);
  const manager = new ModelDownloadManager({
    baseDir: tmp,
    catalog: { fast_3b: { id: 'fast_3b', label: 'Fast Offline AI Model', sizeBytes: 5, url: '', sha256 } }
  });
  assert.equal(await manager.isInstalled('fast_3b'), true);
});

test('Development adapter is disabled unless explicitly enabled', async () => {
  const prev = process.env.PARAYU_ENABLE_OLLAMA_DEV;
  delete process.env.PARAYU_ENABLE_OLLAMA_DEV;
  const provider = new OllamaFormatterProvider({ fetchJson: async () => ({}) });
  assert.equal(await provider.isAvailable(), false);
  process.env.PARAYU_ENABLE_OLLAMA_DEV = prev;
});

test('Bundled production provider requires managed model and engine', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parayu-offline-ai-'));
  const manager = new ModelDownloadManager({ baseDir: tmp });
  const provider = new BundledLlamaCppFormatterProvider({ downloadManager: manager, executablePath: '' });
  assert.equal(await provider.isAvailable(), false);
});

test('Download sizes are user-readable before download', () => {
  assert.equal(formatBytes(1600 * 1024 * 1024), '1.6 GB');
});
