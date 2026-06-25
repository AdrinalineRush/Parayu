// Rasterizes build/dmg-bg.svg to a single high-res PNG using Electron's offscreen
// renderer (no extra deps), then build/make-dmg-bg.sh resizes it to the exact 1x
// (540) and 2x (1080) DMG background sizes with sips.
//   Run via: build/make-dmg-bg.sh
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();

const svg = fs.readFileSync(path.join(__dirname, 'dmg-bg.svg'), 'utf8');
const OUT = path.join(__dirname, 'dmg-bg.raw.png');
const LOGICAL = 1080; // on Retina this paints even larger; we downscale after

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: LOGICAL, height: LOGICAL, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, zoomFactor: 1 }
  });
  const html = `<!DOCTYPE html><html><head><style>
    html,body{margin:0;padding:0;width:${LOGICAL}px;height:${LOGICAL}px;overflow:hidden;background:#06080f}
    svg{display:block;width:${LOGICAL}px;height:${LOGICAL}px}
  </style></head><body>${svg}</body></html>`;

  let done = false;
  let lastGood = null;
  const finish = () => {
    if (done) return;
    done = true;
    win.destroy();
    if (lastGood) { fs.writeFileSync(OUT, lastGood); console.log('RAW_OK'); app.quit(); }
    else { console.error('no non-empty frame'); app.exit(1); }
  };
  win.webContents.on('paint', (_e, _dirty, image) => {
    if (done || image.isEmpty()) return;
    if (image.getSize().width < LOGICAL) return;
    lastGood = image.toPNG();
    setTimeout(finish, 500);
  });
  win.webContents.once('did-finish-load', () => {
    win.webContents.invalidate();
    setTimeout(() => win.webContents.invalidate(), 250);
  });
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  setTimeout(finish, 15000);
});
