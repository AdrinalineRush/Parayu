// Developer build flavor. Run with: npm run dist:dev
//
// This produces "Parayu Dev.app" / "Parayu-dev-<version>.dmg" — identical to the
// public app EXCEPT it includes the admin panel (src/admin + src/renderer/admin),
// which the public `npm run dist` build physically excludes via package.json
// `build.files`. We clone the public config so the two never drift, then:
//   1. drop the admin exclusion globs (so admin code IS bundled here)
//   2. give it a distinct appId/name so it can sit alongside the public app
//   3. skip signing + notarization for fast local iteration
//
// To make a SIGNED/notarized dev build instead (e.g. to hand to a tester),
// delete the `mac.identity` and `afterSign` overrides below — it will then use
// the same signing setup as the public build.

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

// Distinct identity so the dev build installs next to the public app.
config.appId = 'com.parayu.app.dev';
config.productName = 'Parayu Dev';
config.artifactName = 'Parayu-dev-${version}.${ext}';
if (config.dmg) config.dmg.title = 'Parayu Dev';

// Fast local builds: no code-signing, no notarization. (See header to re-enable.)
config.afterSign = null;
config.mac = Object.assign({}, config.mac, { identity: null });

module.exports = config;
