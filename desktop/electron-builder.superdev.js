// Super Developer build — fully self-contained, zero-download DMG.
//
// This produces "Parayu Super Dev.app" / "Parayu-superdev-<version>.dmg"
// It bundles EVERYTHING so the recipient needs zero internet:
//   - HIGH Whisper speech model (ggml-large-v3-q5_0.bin, 1 GB)
//   - IndicTrans2 translation models (HF cache, ~4 GB)
//   - Pre-built Python venv with torch/transformers (~942 MB)
//   - Admin panel, Metal GPU shader, all app code
//
// Usage: PARAYU_FLAVOR=dev ./node_modules/.bin/electron-builder --config electron-builder.superdev.js

const pkg = require('./package.json');
const fs = require('fs');
const path = require('path');

// Ensure Metal shader is in Release directory for packaging
try {
  const srcShader = path.join(__dirname, 'node_modules/smart-whisper/whisper.cpp/ggml/src/ggml-metal.metal');
  const destShader = path.join(__dirname, 'node_modules/smart-whisper/build/Release/ggml-metal.metal');
  if (fs.existsSync(srcShader) && !fs.existsSync(destShader)) {
    fs.mkdirSync(path.dirname(destShader), { recursive: true });
    fs.copyFileSync(srcShader, destShader);
    console.log('Auto-bundled ggml-metal.metal shader into build/Release for GPU support.');
  }
} catch (e) {
  console.error('Warning: Failed to copy Metal shader:', e);
}

// Deep clone so we never mutate the public config object.
const config = JSON.parse(JSON.stringify(pkg.build));

// Re-include the admin code that the public build excludes.
config.files = config.files.filter(
  (f) => f !== '!src/admin/**/*' && f !== '!src/renderer/admin/**/*'
);

// Distinct identity — sits alongside both public and dev builds.
config.appId = 'com.parayu.app.superdev';
config.productName = 'Parayu Super Dev';
config.artifactName = 'Parayu-superdev-${version}.${ext}';
if (config.dmg) config.dmg.title = 'Parayu Super Dev';

// No code-signing for fast local builds.
config.afterSign = null;
config.mac = Object.assign({}, config.mac, { identity: null });

// ---- Bundle everything for a fully self-contained, zero-download build ----
if (!config.extraResources) config.extraResources = [];
config.extraResources.push(
  {
    from: 'src/assets/hf_cache',
    to: 'hf_cache',
    filter: ['**/*']
  },
  {
    from: 'src/assets/bundled-venv',
    to: 'bundled-venv',
    filter: ['**/*']
  }
);

module.exports = config;
