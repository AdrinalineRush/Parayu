const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawn } = require('child_process');

const STATUS = Object.freeze({
  BASIC_READY: 'Basic Offline Ready',
  NOT_INSTALLED: 'Private Offline AI Not Installed',
  DOWNLOADING: 'Downloading Offline AI Model',
  INSTALLING: 'Installing Local AI Engine',
  READY: 'Private Offline AI Ready',
  ERROR: 'Error / Retry'
});

const MODEL_UNCONFIGURED_MESSAGE = 'Private Offline AI model is not included in this build. Basic offline cleanup is still available.';

const MODEL_CATALOG = Object.freeze({
  fast_3b: {
    id: 'fast_3b',
    label: 'Fast Offline AI Model',
    sizeBytes: Number(process.env.PARAYU_OFFLINE_AI_FAST_BYTES || 1600 * 1024 * 1024),
    url: process.env.PARAYU_OFFLINE_AI_FAST_URL || '',
    sha256: process.env.PARAYU_OFFLINE_AI_FAST_SHA256 || ''
  },
  quality_7b: {
    id: 'quality_7b',
    label: 'Quality Offline AI Model',
    sizeBytes: Number(process.env.PARAYU_OFFLINE_AI_QUALITY_BYTES || 4200 * 1024 * 1024),
    url: process.env.PARAYU_OFFLINE_AI_QUALITY_URL || '',
    sha256: process.env.PARAYU_OFFLINE_AI_QUALITY_SHA256 || ''
  }
});

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

function defaultBaseDir(app) {
  if (app && typeof app.getPath === 'function') return path.join(app.getPath('userData'), 'offline-ai');
  return path.join(process.cwd(), '.parayu-offline-ai');
}

class ModelIntegrityVerifier {
  async sha256(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  async verify(filePath, expectedSha256) {
    if (!expectedSha256) return fs.existsSync(filePath);
    const actual = await this.sha256(filePath);
    return actual.toLowerCase() === expectedSha256.toLowerCase();
  }
}

class ModelDownloadManager {
  constructor({ baseDir, catalog = MODEL_CATALOG, verifier = new ModelIntegrityVerifier(), onProgress = () => {} } = {}) {
    this.baseDir = baseDir || defaultBaseDir();
    this.catalog = catalog;
    this.verifier = verifier;
    this.onProgress = onProgress;
  }

  modelInfo(modelId = 'fast_3b') {
    return this.catalog[modelId] || this.catalog.fast_3b;
  }

  modelPath(modelId = 'fast_3b') {
    return path.join(this.baseDir, `${this.modelInfo(modelId).id}.model`);
  }

  async isInstalled(modelId = 'fast_3b') {
    const info = this.modelInfo(modelId);
    const dest = this.modelPath(modelId);
    if (!fs.existsSync(dest)) return false;
    return this.verifier.verify(dest, info.sha256);
  }

  async download(modelId = 'fast_3b') {
    const info = this.modelInfo(modelId);
    if (!info.url) throw new Error(MODEL_UNCONFIGURED_MESSAGE);
    await fsp.mkdir(this.baseDir, { recursive: true });
    const dest = this.modelPath(modelId);
    const tmp = `${dest}.part`;
    await this.downloadFile(info.url, tmp, info.sizeBytes);
    if (!(await this.verifier.verify(tmp, info.sha256))) {
      await fsp.rm(tmp, { force: true });
      throw new Error('Offline AI model verification failed.');
    }
    await fsp.rename(tmp, dest);
    return dest;
  }

  downloadFile(url, dest, expectedBytes = 0, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const req = https.get(url, { headers: { 'User-Agent': 'Parayu' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close(() => fs.unlink(dest, () => {}));
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects while downloading Offline AI Model.'));
          return resolve(this.downloadFile(res.headers.location, dest, expectedBytes, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          file.close(() => fs.unlink(dest, () => {}));
          res.resume();
          return reject(new Error(`Offline AI model download failed (${res.statusCode}).`));
        }
        const total = Number(res.headers['content-length']) || expectedBytes || 0;
        let received = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          this.onProgress({ received, total, pct: total ? received / total : 0 });
        });
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      });
      req.setTimeout(30000, () => req.destroy(new Error('Offline AI model download timed out.')));
      req.on('error', (err) => {
        file.close(() => fs.unlink(dest, () => {}));
        reject(err);
      });
      file.on('error', reject);
    });
  }
}

class FormatterAvailabilityService {
  constructor({ downloadManager, store } = {}) {
    this.downloadManager = downloadManager;
    this.store = store;
  }

  async status(modelId = 'fast_3b') {
    const info = this.downloadManager.modelInfo(modelId);
    const installed = await this.downloadManager.isInstalled(modelId);
    const configured = !!info.url;
    const base = {
      installed,
      configured,
      canDownload: configured && !installed,
      model: info,
      sizeLabel: formatBytes(info.sizeBytes),
      privacy: 'Your voice and text stay on this device.'
    };
    if (!installed && !configured) {
      return Object.assign({}, base, {
        state: STATUS.BASIC_READY,
        unavailableReason: MODEL_UNCONFIGURED_MESSAGE
      });
    }
    const state = this.store && this.store.get('offlineAIInstallState');
    if (state === STATUS.DOWNLOADING || state === STATUS.INSTALLING || state === STATUS.ERROR) {
      return Object.assign({}, base, this.store.get('offlineAIStatus') || {}, { state });
    }
    return Object.assign({}, base, {
      state: installed ? STATUS.READY : STATUS.NOT_INSTALLED,
    });
  }
}

class LocalFormatterProvider {
  async isAvailable() { return false; }
  async format() { throw new Error('Local AI Engine is unavailable.'); }
}

class BundledLlamaCppFormatterProvider extends LocalFormatterProvider {
  constructor({ downloadManager, executablePath, modelId = 'fast_3b' } = {}) {
    super();
    this.downloadManager = downloadManager;
    this.executablePath = executablePath || process.env.PARAYU_LLAMA_CPP_FORMATTER;
    this.modelId = modelId;
  }

  async isAvailable() {
    return !!this.executablePath && fs.existsSync(this.executablePath) && await this.downloadManager.isInstalled(this.modelId);
  }

  async format(inputText, options) {
    if (!(await this.isAvailable())) throw new Error('Private Offline AI is not installed.');
    return runEngine(this.executablePath, [this.downloadManager.modelPath(this.modelId)], inputText, options);
  }
}

class MLXFormatterProvider extends LocalFormatterProvider {
  constructor({ downloadManager, executablePath, modelId = 'fast_3b' } = {}) {
    super();
    this.downloadManager = downloadManager;
    this.executablePath = executablePath || process.env.PARAYU_MLX_FORMATTER;
    this.modelId = modelId;
  }

  async isAvailable() {
    return process.platform === 'darwin' &&
      process.arch === 'arm64' &&
      !!this.executablePath &&
      fs.existsSync(this.executablePath) &&
      await this.downloadManager.isInstalled(this.modelId);
  }

  async format(inputText, options) {
    if (!(await this.isAvailable())) throw new Error('Private Offline AI is not installed.');
    return runEngine(this.executablePath, [this.downloadManager.modelPath(this.modelId)], inputText, options);
  }
}

class OllamaFormatterProvider extends LocalFormatterProvider {
  constructor({ fetchJson, endpoint, model } = {}) {
    super();
    this.fetchJson = fetchJson;
    this.endpoint = endpoint || process.env.PARAYU_OLLAMA_ENDPOINT || 'http://127.0.0.1:11434/api/generate';
    this.modelName = model || process.env.PARAYU_OLLAMA_MODEL || 'llama3.2:3b';
  }

  async isAvailable(timeoutMs = 350) {
    if (process.env.PARAYU_ENABLE_OLLAMA_DEV !== '1') return false;
    try {
      await this.fetchJson(this.endpoint.replace(/\/api\/generate\/?$/, '/api/tags'), { method: 'GET', timeoutMs });
      return true;
    } catch (_e) {
      return false;
    }
  }

  async format(inputText, options) {
    if (process.env.PARAYU_ENABLE_OLLAMA_DEV !== '1') throw new Error('Development formatter is disabled.');
    const prompt = `${options.systemPrompt}\n\n${options.userPrompt}`;
    const data = await this.fetchJson(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.modelName, prompt, stream: false, options: { temperature: 0.2 } })
    });
    return data.response || data.text || '';
  }
}

function runEngine(executablePath, args, inputText, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `Local AI Engine exited with code ${code}.`));
      resolve(stdout.trim());
    });
    child.stdin.end(JSON.stringify({ text: inputText, options }));
  });
}

module.exports = {
  STATUS,
  MODEL_CATALOG,
  MODEL_UNCONFIGURED_MESSAGE,
  formatBytes,
  ModelIntegrityVerifier,
  ModelDownloadManager,
  FormatterAvailabilityService,
  LocalFormatterProvider,
  OllamaFormatterProvider,
  BundledLlamaCppFormatterProvider,
  MLXFormatterProvider
};
