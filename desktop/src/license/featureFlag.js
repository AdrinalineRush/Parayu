const { MODEL_FEATURES } = require('./subscriptionState');

class FeatureFlag {
  constructor(getState) {
    this.getState = getState;
  }

  state() {
    return this.getState();
  }

  isEnabled(feature) {
    const state = this.state();
    return !!state && Array.isArray(state.allowedFeatures) && state.allowedFeatures.includes(feature);
  }

  require(feature) {
    if (this.isEnabled(feature)) return { ok: true };
    return {
      ok: false,
      error: 'This feature requires an active subscription. Refresh or upgrade to use it.',
      feature
    };
  }

  canUseModel(modelId) {
    const state = this.state();
    if (!state || !Array.isArray(state.allowedModels)) return false;
    if (state.allowedModels.includes(modelId)) return true;
    const feature = MODEL_FEATURES[modelId];
    return feature ? this.isEnabled(feature) : false;
  }

  modelGate(modelId) {
    if (this.canUseModel(modelId)) return { ok: true };
    return {
      ok: false,
      error: 'This model requires an active paid plan.',
      modelId
    };
  }
}

module.exports = { FeatureFlag };
