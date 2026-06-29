const crypto = require('crypto');
const {
  PLAN_FREE,
  PLAN_BASE,
  PLAN_PRO,
  PLAN_ENTERPRISE,
  normalizePlan,
  defaultAllowedFeatures,
  defaultAllowedModels,
  freeState,
  stateFromLicense
} = require('./subscriptionState');

const LICENSE_STORAGE_KEY = 'licenseToken';
const DEVICE_ID_KEY = 'licenseDeviceId';
const DEFAULT_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

function base64UrlDecode(value) {
  return Buffer.from(String(value || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function payloadForSignature(token) {
  const copy = { ...token };
  delete copy.signature;
  return canonicalize(copy);
}

function readToken(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function serializeToken(token) {
  return JSON.stringify(token);
}

function defaultLicenseProvider() {
  const endpoint = process.env.PARAYU_LICENSE_ENDPOINT || '';
  return {
    async activate(payload) {
      if (!endpoint) throw new Error('License backend is not configured.');
      return requestJson(`${endpoint.replace(/\/$/, '')}/activate`, payload);
    },
    async refresh(payload) {
      if (!endpoint) throw new Error('License backend is not configured.');
      return requestJson(`${endpoint.replace(/\/$/, '')}/refresh`, payload);
    }
  };
}

async function requestJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`License server returned HTTP ${res.status}`);
  return res.json();
}

class LicenseManager {
  constructor(options = {}) {
    this.store = options.store;
    this.saveSecureToken = options.saveSecureToken;
    this.getSecureToken = options.getSecureToken;
    this.publicKey = options.publicKey || process.env.PARAYU_LICENSE_PUBLIC_KEY || '';
    this.provider = options.provider || defaultLicenseProvider();
    this.now = options.now || (() => Date.now());
    this.networkStatus = options.networkStatus || (() => true);
    this.refreshIntervalMs = options.refreshIntervalMs || DEFAULT_REFRESH_INTERVAL_MS;
    this.currentLicense = null;
    this.currentState = freeState(this.now());
    this.lastRefreshAttemptAt = 0;
    this.refreshInFlight = null;
    this.dictationActive = false;
    this.refreshQueued = false;
  }

  initialize() {
    this.loadLocalLicense();
    return this.getState();
  }

  getDeviceId() {
    if (!this.store) return crypto.randomUUID();
    const existing = this.store.get(DEVICE_ID_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    this.store.set(DEVICE_ID_KEY, next);
    return next;
  }

  loadLocalLicense() {
    const raw = this.getSecureToken ? this.getSecureToken(LICENSE_STORAGE_KEY) : null;
    const parsed = readToken(raw);
    if (!parsed) {
      this.currentLicense = null;
      this.currentState = freeState(this.now());
      return this.currentState;
    }
    const verified = this.verifyToken(parsed);
    if (!verified.ok) {
      this.currentLicense = null;
      this.currentState = freeState(this.now(), verified.error || 'invalid_license');
      return this.currentState;
    }
    this.currentLicense = verified.license;
    this.currentState = stateFromLicense(verified.license, { now: this.now(), offline: !this.networkStatus() });
    return this.currentState;
  }

  getState() {
    if (this.currentLicense) {
      this.currentState = stateFromLicense(this.currentLicense, { now: this.now(), offline: !this.networkStatus() });
    }
    return { ...this.currentState };
  }

  setDictationActive(active) {
    const wasActive = this.dictationActive;
    this.dictationActive = !!active;
    if (wasActive && !this.dictationActive && this.refreshQueued) {
      this.refreshQueued = false;
      this.refresh({ reason: 'deferred_after_dictation' }).catch(() => {});
    }
  }

  async activate(payload = {}) {
    const deviceId = this.getDeviceId();
    const response = await this.provider.activate({ ...payload, deviceId });
    const token = response && (response.licenseToken || response.token || response.license);
    return this.acceptToken(token, { source: 'activate' });
  }

  async refresh(options = {}) {
    if (this.dictationActive) {
      this.refreshQueued = true;
      return { ok: false, deferred: true, state: this.getState() };
    }
    if (this.refreshInFlight) return this.refreshInFlight;

    const force = !!options.force;
    const now = this.now();
    if (!force && this.lastRefreshAttemptAt && now - this.lastRefreshAttemptAt < this.refreshIntervalMs) {
      return { ok: true, skipped: true, state: this.getState() };
    }
    if (!this.networkStatus()) {
      this.lastRefreshAttemptAt = now;
      return { ok: false, offline: true, state: this.getState(), error: 'No internet connection.' };
    }

    this.lastRefreshAttemptAt = now;
    this.refreshInFlight = (async () => {
      try {
        const response = await this.provider.refresh({
          deviceId: this.getDeviceId(),
          userId: this.currentLicense && this.currentLicense.userId,
          currentToken: this.currentLicense
        });
        const token = response && (response.licenseToken || response.token || response.license);
        return this.acceptToken(token, { source: 'refresh' });
      } catch (err) {
        return { ok: false, error: err.message || String(err), state: this.getState() };
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  refreshIfDue() {
    const state = this.getState();
    if (!state.needsRefresh && this.now() - this.lastRefreshAttemptAt < this.refreshIntervalMs) {
      return Promise.resolve({ ok: true, skipped: true, state });
    }
    return this.refresh();
  }

  acceptToken(token, meta = {}) {
    const parsed = readToken(token);
    if (!parsed) return { ok: false, error: 'License token missing or invalid.', state: this.getState() };
    const verified = this.verifyToken(parsed);
    if (!verified.ok) return { ok: false, error: verified.error, state: this.getState() };
    if (verified.license.deviceId && verified.license.deviceId !== this.getDeviceId()) {
      return { ok: false, error: 'License token is for a different device.', state: this.getState() };
    }
    this.currentLicense = verified.license;
    this.currentState = stateFromLicense(verified.license, { now: this.now(), offline: !this.networkStatus() });
    if (this.saveSecureToken) this.saveSecureToken(LICENSE_STORAGE_KEY, serializeToken(verified.license));
    return { ok: true, source: meta.source || 'local', state: this.getState() };
  }

  verifyToken(token) {
    if (!token || typeof token !== 'object') return { ok: false, error: 'License token is not an object.' };
    const required = ['userId', 'plan', 'subscriptionStatus', 'expiryDate', 'graceUntil', 'allowedFeatures', 'allowedModels', 'deviceId', 'issuedAt', 'signature'];
    for (const key of required) {
      if (token[key] === undefined || token[key] === null) return { ok: false, error: `License token missing ${key}.` };
    }
    if (!this.publicKey) return { ok: false, error: 'License public key is not configured.' };

    const plan = normalizePlan(token.plan);
    const normalized = {
      ...token,
      plan,
      allowedFeatures: Array.isArray(token.allowedFeatures) ? token.allowedFeatures : defaultAllowedFeatures(plan),
      allowedModels: Array.isArray(token.allowedModels) ? token.allowedModels : defaultAllowedModels(plan)
    };

    const signature = String(normalized.signature || '');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payloadForSignature(normalized));
    verifier.end();
    let ok = false;
    try {
      ok = verifier.verify(this.publicKey, base64UrlDecode(signature));
    } catch (_) {
      ok = false;
    }
    if (!ok) return { ok: false, error: 'License signature is invalid.' };
    return { ok: true, license: normalized };
  }

  static signToken(payload, privateKey) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(payloadForSignature(payload));
    signer.end();
    return {
      ...payload,
      signature: signer.sign(privateKey).toString('base64url')
    };
  }
}

module.exports = {
  LICENSE_STORAGE_KEY,
  DEVICE_ID_KEY,
  LicenseManager,
  canonicalize,
  payloadForSignature,
  PLAN_FREE,
  PLAN_BASE,
  PLAN_PRO,
  PLAN_ENTERPRISE
};
