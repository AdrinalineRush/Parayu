const { uIOhook, UiohookKey } = require('uiohook-napi');

// Maps the "main" (non-modifier) part of an Electron accelerator to a
// uiohook keycode, so we can detect both key-down and key-up globally —
// which globalShortcut cannot do, and which push-to-talk requires.
function mainKeyToCode(key) {
  if (UiohookKey[key] !== undefined) return UiohookKey[key];
  if (/^[A-Z]$/.test(key)) return UiohookKey[key];
  if (/^[0-9]$/.test(key)) return UiohookKey[key];
  const aliases = {
    Space: UiohookKey.Space, Esc: UiohookKey.Escape, Return: UiohookKey.Enter,
    Tab: UiohookKey.Tab, Up: UiohookKey.ArrowUp, Down: UiohookKey.ArrowDown,
    Left: UiohookKey.ArrowLeft, Right: UiohookKey.ArrowRight
  };
  return aliases[key];
}

// Keycodes for held-modifier ("hold Option") push-to-talk triggers. uiohook
// reports left/right variants, so we accept either side of each modifier.
const MODIFIER_CODES = {
  Alt: [UiohookKey.Alt, UiohookKey.AltRight],
  Meta: [UiohookKey.Meta, UiohookKey.MetaRight],
  Ctrl: [UiohookKey.Ctrl, UiohookKey.CtrlRight],
  Shift: [UiohookKey.Shift, UiohookKey.ShiftRight]
};

// Parses an accelerator into required modifiers + main keycode. A modifier-only
// accelerator (e.g. "Alt") becomes a held-key trigger that produces no text.
function parseAccelerator(accelerator) {
  const parts = accelerator.split('+');
  const mods = { meta: false, ctrl: false, alt: false, shift: false };
  let mainKey = null;
  const modNames = [];
  for (const p of parts) {
    if (p === 'Command' || p === 'Cmd' || p === 'Super' || p === 'Meta') { mods.meta = true; modNames.push('Meta'); }
    else if (p === 'Control' || p === 'Ctrl') { mods.ctrl = true; modNames.push('Ctrl'); }
    else if (p === 'Alt' || p === 'Option') { mods.alt = true; modNames.push('Alt'); }
    else if (p === 'Shift') { mods.shift = true; modNames.push('Shift'); }
    else mainKey = p;
  }

  if (!mainKey && modNames.length === 1) {
    // Modifier-only: hold this modifier to talk, no text leaks into the app.
    return { mods: { meta: false, ctrl: false, alt: false, shift: false }, codes: MODIFIER_CODES[modNames[0]] };
  }
  return { mods, codes: [mainKeyToCode(mainKey)] };
}

let started = false;
let current = null; // { code, mods, onDown, onUp, held }

function modifiersSatisfied(e, mods) {
  return (!mods.meta || e.metaKey) &&
         (!mods.ctrl || e.ctrlKey) &&
         (!mods.alt || e.altKey) &&
         (!mods.shift || e.shiftKey);
}

// Register event listeners once at the module level to prevent memory leaks when start() is retried
uIOhook.on('keydown', (e) => {
  if (!current) return;
  if (current.codes.includes(e.keycode) && !current.held && modifiersSatisfied(e, current.mods)) {
    current.held = true;
    current.onDown();
  }
});

uIOhook.on('keyup', (e) => {
  if (!current) return;
  if (current.held && current.codes.includes(e.keycode)) {
    current.held = false;
    current.onUp();
  }
});

// Registers a push-to-talk hotkey: onDown fires when the full combo is first
// pressed, onUp when the main key is released.
function registerPushToTalk(accelerator, onDown, onUp) {
  const { mods, codes } = parseAccelerator(accelerator);
  const validCodes = (codes || []).filter((c) => c !== undefined && c !== null);
  if (validCodes.length === 0) return false;

  current = { codes: validCodes, mods, onDown, onUp, held: false };

  if (!started) {
    try {
      uIOhook.start();
      started = true;
    } catch (_e) {
      // macOS Accessibility/Input-Monitoring not granted yet — let the caller
      // fall back to toggle mode rather than crashing.
      current = null;
      return false;
    }
  }
  return true;
}

function unregister() {
  current = null;
}

function stopHook() {
  if (started) {
    try { uIOhook.stop(); } catch (_e) {}
    started = false;
  }
}

module.exports = { registerPushToTalk, unregister, stopHook };
