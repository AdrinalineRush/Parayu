const PLAN_FREE = 'free';
const PLAN_BASE = 'base';
const PLAN_PRO = 'pro';
const PLAN_ENTERPRISE = 'enterprise';

const SUBSCRIPTION_ACTIVE = 'active';
const SUBSCRIPTION_EXPIRED = 'expired';
const SUBSCRIPTION_CANCELED = 'canceled';
const SUBSCRIPTION_TRIALING = 'trialing';

const FREE_FEATURES = new Set([
  'basic_dictation',
  'basic_offline_cleanup',
  'clipboard_paste',
  'whisper_base_model'
]);

const BASE_FEATURES = new Set([
  ...FREE_FEATURES,
  'malayalam_to_english_premium',
  'whisper_small_model',
  'personal_dictionary',
  'text_snippets'
]);

const PRO_FEATURES = new Set([
  ...BASE_FEATURES,
  'local_llm_formatter',
  'whisper_medium_model',
  'whisper_large_v3_model',
  'whisper_large_v3_unquantized_model',
  'app_aware_formatting',
  'developer_prompt_mode',
  'email_mode',
  'advanced_clipboard_restore',
  'premium_model_packs',
  'priority_updates'
]);

const ENTERPRISE_FEATURES = new Set([
  ...PRO_FEATURES,
  'team_dictionary',
  'multi_device_license',
  'shared_dictionary'
]);

const PLAN_FEATURES = {
  [PLAN_FREE]: FREE_FEATURES,
  [PLAN_BASE]: BASE_FEATURES,
  [PLAN_PRO]: PRO_FEATURES,
  [PLAN_ENTERPRISE]: ENTERPRISE_FEATURES
};

const MODEL_FEATURES = {
  base: 'whisper_base_model',
  'small-q5_1': 'whisper_small_model',
  'medium-q4_0': 'whisper_medium_model',
  'large-v3-q4_0': 'whisper_large_v3_model',
  'large-v3': 'whisper_large_v3_unquantized_model'
};

const PLAN_MODELS = {
  [PLAN_FREE]: ['base'],
  [PLAN_BASE]: ['base', 'small-q5_1'],
  [PLAN_PRO]: ['base', 'small-q5_1', 'medium-q4_0', 'large-v3-q4_0', 'large-v3'],
  [PLAN_ENTERPRISE]: ['base', 'small-q5_1', 'medium-q4_0', 'large-v3-q4_0', 'large-v3']
};

function normalizePlan(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === PLAN_BASE || p === 'base plan') return PLAN_BASE;
  if (p === PLAN_PRO || p === 'pro plan') return PLAN_PRO;
  if (p === 'pro lifetime' || p === 'lifetime') return PLAN_PRO;
  if (p === PLAN_ENTERPRISE || p === 'enterprise plan' || p === 'team' || p === 'team plan') return PLAN_ENTERPRISE;
  return PLAN_FREE;
}

function planLabel(plan) {
  const p = normalizePlan(plan);
  if (p === PLAN_BASE) return 'Base';
  if (p === PLAN_PRO) return 'Pro';
  if (p === PLAN_ENTERPRISE) return 'Enterprise';
  return 'Free';
}

function parseTime(value) {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}

function isoOrNull(value) {
  const t = parseTime(value);
  return t ? new Date(t).toISOString() : null;
}

function defaultAllowedFeatures(plan) {
  return Array.from(PLAN_FEATURES[normalizePlan(plan)] || FREE_FEATURES);
}

function defaultAllowedModels(plan) {
  return Array.from(PLAN_MODELS[normalizePlan(plan)] || PLAN_MODELS[PLAN_FREE]);
}

function freeState(now = Date.now(), reason = 'no_license') {
  return {
    userId: null,
    plan: PLAN_FREE,
    planLabel: planLabel(PLAN_FREE),
    subscriptionStatus: 'free',
    mode: 'free',
    expiryDate: null,
    graceUntil: null,
    inGracePeriod: false,
    offline: false,
    reason,
    allowedFeatures: defaultAllowedFeatures(PLAN_FREE),
    allowedModels: defaultAllowedModels(PLAN_FREE),
    lastCheckedAt: new Date(now).toISOString(),
    needsRefresh: false
  };
}

function stateFromLicense(license, opts = {}) {
  const now = opts.now || Date.now();
  if (!license || typeof license !== 'object') return freeState(now);

  const plan = normalizePlan(license.plan);
  const expiryMs = parseTime(license.expiryDate);
  const graceMs = parseTime(license.graceUntil);
  const status = String(license.subscriptionStatus || '').toLowerCase();
  const activeStatus = status === SUBSCRIPTION_ACTIVE || status === SUBSCRIPTION_TRIALING;
  const notExpired = expiryMs && expiryMs > now;
  const insideGrace = expiryMs && expiryMs <= now && graceMs && graceMs > now;
  const paidPlan = plan === PLAN_BASE || plan === PLAN_PRO || plan === PLAN_ENTERPRISE;
  const allowedFeatures = Array.isArray(license.allowedFeatures) && license.allowedFeatures.length
    ? license.allowedFeatures
    : defaultAllowedFeatures(plan);
  const allowedModels = Array.isArray(license.allowedModels) && license.allowedModels.length
    ? license.allowedModels
    : defaultAllowedModels(plan);

  if (paidPlan && activeStatus && (notExpired || insideGrace)) {
    return {
      userId: license.userId || null,
      plan,
      planLabel: license.billingCycle === 'lifetime' && plan === PLAN_PRO ? 'Pro Lifetime' : planLabel(plan),
      subscriptionStatus: status,
      mode: insideGrace ? 'grace' : 'paid',
      expiryDate: isoOrNull(license.expiryDate),
      graceUntil: isoOrNull(license.graceUntil),
      inGracePeriod: !!insideGrace,
      offline: !!opts.offline,
      reason: insideGrace ? 'inside_grace_period' : 'active',
      allowedFeatures,
      allowedModels,
      billingCycle: license.billingCycle || null,
      licenseType: license.licenseType || (license.billingCycle === 'lifetime' ? 'lifetime' : 'subscription'),
      deviceId: license.deviceId || null,
      issuedAt: isoOrNull(license.issuedAt),
      lastCheckedAt: new Date(now).toISOString(),
      needsRefresh: insideGrace || !notExpired
    };
  }

  return {
    ...freeState(now, expiryMs && expiryMs <= now ? 'expired_beyond_grace' : 'inactive_subscription'),
    userId: license.userId || null,
    subscriptionStatus: status || SUBSCRIPTION_EXPIRED,
    expiryDate: isoOrNull(license.expiryDate),
    graceUntil: isoOrNull(license.graceUntil),
    lastCheckedAt: new Date(now).toISOString(),
    needsRefresh: true
  };
}

module.exports = {
  PLAN_FREE,
  PLAN_BASE,
  PLAN_PRO,
  PLAN_ENTERPRISE,
  SUBSCRIPTION_ACTIVE,
  SUBSCRIPTION_EXPIRED,
  SUBSCRIPTION_CANCELED,
  SUBSCRIPTION_TRIALING,
  FREE_FEATURES,
  BASE_FEATURES,
  PRO_FEATURES,
  ENTERPRISE_FEATURES,
  MODEL_FEATURES,
  PLAN_MODELS,
  normalizePlan,
  planLabel,
  defaultAllowedFeatures,
  defaultAllowedModels,
  freeState,
  stateFromLicense
};
