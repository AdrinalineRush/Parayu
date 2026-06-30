#!/usr/bin/env node
/**
 * Generates pixel-perfect DMG background images (1x and 2x) for Parayu.
 * Drop-frame positions match electron-builder's icon placement:
 *   App icon at (130, 270), Applications link at (410, 270), iconSize 128.
 * Canvas size: 540×540 (1x), 1080×1080 (2x).
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawBackground(scale) {
  const W = 540 * scale;
  const H = 540 * scale;
  const ctx = createCanvas(W, H).getContext('2d');
  const s = scale; // shorthand

  // ---- Background gradient ----
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow in center
  const glow = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.6);
  glow.addColorStop(0, 'rgba(99, 102, 241, 0.08)');
  glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---- Title "Parayu" ----
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${42 * s}px "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Parayu', W / 2, 120 * s);

  // ---- Subtitle ----
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = `${14 * s}px "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('Drag to Applications to install', W / 2, 165 * s);

  // ---- Drop frames ----
  const iconSize = 128 * s;
  const frameSize = 148 * s;
  const radius = 22 * s;
  const positions = [
    { x: 130 * s, y: 270 * s, label: null },        // App icon position
    { x: 410 * s, y: 270 * s, label: null }         // Applications position
  ];

  for (const pos of positions) {
    const fx = pos.x - frameSize / 2;
    const fy = pos.y - frameSize / 2;

    // Frame background (subtle glass effect)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(fx, fy, frameSize, frameSize, radius);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();

    // Dashed border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([6 * s, 4 * s]);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Arrow between frames ----
  const arrowY = 270 * s;
  const arrowStartX = (130 + 74 + 12) * s;  // right edge of left frame + gap
  const arrowEndX = (410 - 74 - 12) * s;    // left edge of right frame - gap
  const arrowMidX = (arrowStartX + arrowEndX) / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2 * s;
  ctx.setLineDash([]);

  // Curved arrow line
  ctx.beginPath();
  ctx.moveTo(arrowStartX, arrowY);
  ctx.quadraticCurveTo(arrowMidX, arrowY - 25 * s, arrowEndX, arrowY);
  ctx.stroke();

  // Arrowhead
  const headSize = 8 * s;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(arrowEndX, arrowY);
  ctx.lineTo(arrowEndX - headSize, arrowY - headSize * 0.6);
  ctx.lineTo(arrowEndX - headSize, arrowY + headSize * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---- Version text at bottom ----
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.font = `${10 * s}px "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Free, local, private voice dictation', W / 2, (H - 30 * s));

  return ctx.canvas;
}

// Generate both sizes
const outDir = path.join(__dirname, 'build');
fs.mkdirSync(outDir, { recursive: true });

const canvas1x = drawBackground(1);
fs.writeFileSync(path.join(outDir, 'dmg-background.png'), canvas1x.toBuffer('image/png'));
console.log('Created build/dmg-background.png (540x540)');

const canvas2x = drawBackground(2);
fs.writeFileSync(path.join(outDir, 'dmg-background@2x.png'), canvas2x.toBuffer('image/png'));
console.log('Created build/dmg-background@2x.png (1080x1080)');
