// Restores the macOS Metal GPU shader (ggml-metal.metal) for smart-whisper
// after a fresh `npm install`, which otherwise omits it (causing a silent
// fall back to CPU and slow transcription on macOS).
//
// macOS ONLY. On Windows/Linux this is a no-op — Metal is Apple-only, so those
// platforms use their own backends (CPU, or CUDA/Vulkan if compiled for it).
// Always exits 0 so it can never break `npm install` on any platform.
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') process.exit(0);

const src = path.join(__dirname, '..', 'vendor', 'ggml-metal.metal');
const destDir = path.join(__dirname, '..', 'node_modules', 'smart-whisper', 'build', 'Release');
const dest = path.join(destDir, 'ggml-metal.metal');

try {
  if (fs.existsSync(src) && fs.existsSync(destDir)) {
    fs.copyFileSync(src, dest);
    console.log('[copy-metal] Restored ggml-metal.metal for Metal GPU acceleration.');
  }
} catch (e) {
  console.warn('[copy-metal] skipped:', e.message);
}
process.exit(0);
