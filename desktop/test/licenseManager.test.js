const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { LicenseManager, LICENSE_STORAGE_KEY } = require('../src/license/licenseManager');
const { FeatureFlag } = require('../src/license/featureFlag');

const DAY = 24 * 60 * 60 * 1000;

function keys() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: (key) => data[key],
    set: (key, value) => { data[key] = value; },
    delete: (key) => { delete data[key]; }
  };
}

function makeToken(privateKey, overrides = {}) {
  const now = overrides.now || Date.UTC(2026, 0, 1);
  const token = {
    userId: 'user_123',
    plan: 'pro',
    subscriptionStatus: 'active',
    expiryDate: new Date(now + 30 * DAY).toISOString(),
    graceUntil: new Date(now + 37 * DAY).toISOString(),
    allowedFeatures: [
      'basic_dictation',
      'clipboard_paste',
      'local_llm_formatter',
      'malayalam_to_english_premium',
      'whisper_small_model',
      'whisper_medium_model',
      'personal_dictionary',
      'text_snippets',
      'app_aware_formatting',
      'developer_prompt_mode',
      'email_mode',
      'advanced_clipboard_restore'
    ],
    allowedModels: ['small-q5_1', 'medium-q5_0', 'large-v3-q5_0', 'large-v3'],
    deviceId: 'device_1',
    issuedAt: new Date(now).toISOString(),
    ...overrides
  };
  delete token.now;
  return LicenseManager.signToken(token, privateKey);
}

function managerFixture(options = {}) {
  const { publicKey, privateKey } = keys();
  const store = memoryStore({ licenseDeviceId: 'device_1', dictionary: [{ from: 'helo', to: 'hello' }], snippets: [{ trigger: ';brb', expansion: 'be right back' }] });
  const secure = {};
  let now = Date.UTC(2026, 0, 1);
  let online = true;
  const provider = options.provider || {
    async activate() {
      return { licenseToken: makeToken(privateKey, { deviceId: 'device_1', now }) };
    },
    async refresh() {
      return { licenseToken: makeToken(privateKey, { deviceId: 'device_1', now }) };
    }
  };
  const manager = new LicenseManager({
    store,
    publicKey,
    provider,
    now: () => now,
    networkStatus: () => online,
    saveSecureToken: (key, value) => { if (value) secure[key] = value; else delete secure[key]; },
    getSecureToken: (key) => secure[key],
    refreshIntervalMs: 0
  });
  return {
    publicKey,
    privateKey,
    store,
    secure,
    manager,
    setNow: (value) => { now = value; },
    setOnline: (value) => { online = value; },
    token: (overrides) => makeToken(privateKey, { deviceId: 'device_1', now, ...overrides })
  };
}

test('first activation requires provider response and stores a signed local license token', async () => {
  const fx = managerFixture();
  const result = await fx.manager.activate({ loginToken: 'oauth-code' });
  assert.equal(result.ok, true);
  assert.equal(result.state.plan, 'pro');
  assert.equal(result.state.mode, 'paid');
  assert.ok(fx.secure[LICENSE_STORAGE_KEY]);
});

test('valid Pro license keeps premium features available offline', () => {
  const fx = managerFixture();
  fx.secure[LICENSE_STORAGE_KEY] = JSON.stringify(fx.token());
  fx.setOnline(false);
  fx.manager.initialize();
  const flags = new FeatureFlag(() => fx.manager.getState());
  assert.equal(fx.manager.getState().offline, true);
  assert.equal(flags.isEnabled('local_llm_formatter'), true);
  assert.equal(flags.canUseModel('medium-q5_0'), true);
});

test('Base license matches website middle tier entitlements', () => {
  const fx = managerFixture();
  fx.secure[LICENSE_STORAGE_KEY] = JSON.stringify(fx.token({
    plan: 'base',
    allowedFeatures: [],
    allowedModels: []
  }));
  fx.manager.initialize();
  const flags = new FeatureFlag(() => fx.manager.getState());
  assert.equal(fx.manager.getState().plan, 'base');
  assert.equal(flags.isEnabled('malayalam_to_english_premium'), true);
  assert.equal(flags.isEnabled('personal_dictionary'), true);
  assert.equal(flags.isEnabled('text_snippets'), true);
  assert.equal(flags.isEnabled('local_llm_formatter'), false);
  assert.equal(flags.canUseModel('small-q5_1'), true);
  assert.equal(flags.canUseModel('medium-q5_0'), false);
});

test('Pro Lifetime license is represented as Pro with lifetime billing metadata', () => {
  const fx = managerFixture();
  fx.secure[LICENSE_STORAGE_KEY] = JSON.stringify(fx.token({
    plan: 'pro',
    billingCycle: 'lifetime',
    licenseType: 'lifetime',
    allowedFeatures: [],
    allowedModels: []
  }));
  fx.manager.initialize();
  const state = fx.manager.getState();
  assert.equal(state.plan, 'pro');
  assert.equal(state.planLabel, 'Pro Lifetime');
  assert.equal(state.billingCycle, 'lifetime');
  assert.equal(state.licenseType, 'lifetime');
});

test('expired license inside grace period remains Pro in grace mode', () => {
  const fx = managerFixture();
  const base = Date.UTC(2026, 0, 1);
  fx.secure[LICENSE_STORAGE_KEY] = JSON.stringify(fx.token({
    expiryDate: new Date(base - DAY).toISOString(),
    graceUntil: new Date(base + 3 * DAY).toISOString()
  }));
  fx.manager.initialize();
  assert.equal(fx.manager.getState().mode, 'grace');
  assert.equal(fx.manager.getState().inGracePeriod, true);
});

test('expired license beyond grace period downgrades to Free without deleting user data', () => {
  const fx = managerFixture();
  const base = Date.UTC(2026, 0, 1);
  fx.secure[LICENSE_STORAGE_KEY] = JSON.stringify(fx.token({
    expiryDate: new Date(base - 10 * DAY).toISOString(),
    graceUntil: new Date(base - DAY).toISOString()
  }));
  fx.manager.initialize();
  assert.equal(fx.manager.getState().plan, 'free');
  assert.equal(fx.manager.getState().reason, 'expired_beyond_grace');
  assert.deepEqual(fx.store.get('dictionary'), [{ from: 'helo', to: 'hello' }]);
  assert.deepEqual(fx.store.get('snippets'), [{ trigger: ';brb', expansion: 'be right back' }]);
});

test('feature gates deny Pro-only features in Free mode', () => {
  const fx = managerFixture();
  fx.manager.initialize();
  const flags = new FeatureFlag(() => fx.manager.getState());
  assert.equal(flags.isEnabled('local_llm_formatter'), false);
  assert.equal(flags.require('personal_dictionary').ok, false);
  assert.equal(flags.isEnabled('clipboard_paste'), true);
});

test('model access gates allow Free models and lock premium models', () => {
  const fx = managerFixture();
  fx.manager.initialize();
  const flags = new FeatureFlag(() => fx.manager.getState());
  assert.equal(flags.canUseModel('small-q5_1'), true);
  assert.equal(flags.canUseModel('medium-q5_0'), false);
});

test('license refresh failure preserves current state', async () => {
  const fx = managerFixture({
    provider: {
      async activate() { throw new Error('unused'); },
      async refresh() { throw new Error('server down'); }
    }
  });
  fx.secure[LICENSE_STORAGE_KEY] = JSON.stringify(fx.token());
  fx.manager.initialize();
  const result = await fx.manager.refresh({ force: true });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'server down');
  assert.equal(result.state.plan, 'pro');
});

test('no internet uses local grace/free state without blocking refresh', async () => {
  const fx = managerFixture();
  fx.secure[LICENSE_STORAGE_KEY] = JSON.stringify(fx.token());
  fx.manager.initialize();
  fx.setOnline(false);
  const result = await fx.manager.refresh({ force: true });
  assert.equal(result.ok, false);
  assert.equal(result.offline, true);
  assert.equal(result.state.plan, 'pro');
});

test('subscription restored after refresh returns from Free to Pro', async () => {
  const fx = managerFixture();
  const base = Date.UTC(2026, 0, 1);
  fx.secure[LICENSE_STORAGE_KEY] = JSON.stringify(fx.token({
    expiryDate: new Date(base - 10 * DAY).toISOString(),
    graceUntil: new Date(base - DAY).toISOString()
  }));
  fx.manager.initialize();
  assert.equal(fx.manager.getState().plan, 'free');
  const result = await fx.manager.refresh({ force: true });
  assert.equal(result.ok, true);
  assert.equal(result.state.plan, 'pro');
});

test('active dictation defers subscription refresh until dictation finishes', async () => {
  let refreshCount = 0;
  const fx = managerFixture({
    provider: {
      async activate() { throw new Error('unused'); },
      async refresh() {
        refreshCount += 1;
        return { licenseToken: fx.token() };
      }
    }
  });
  fx.manager.setDictationActive(true);
  const deferred = await fx.manager.refresh({ force: true });
  assert.equal(deferred.deferred, true);
  assert.equal(refreshCount, 0);
  fx.manager.setDictationActive(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshCount, 1);
});
