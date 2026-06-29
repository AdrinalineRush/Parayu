const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const pasteSource = fs.readFileSync(path.join(root, 'src', 'paste.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'app.js'), 'utf8');
const globalDictionary = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'global-dictionary.json'), 'utf8'));

test('Known Manglish/global terms have a shipped Global Dictionary correction', () => {
  assert.ok(globalDictionary.entries.some((entry) => entry.from === 'parayu sample' && entry.to === 'Parayu'));
});

test('Personal Dictionary can be independently disabled or applied', () => {
  assert.match(mainSource, /enablePersonalDictionary/);
  assert.match(mainSource, /applyDictionary\(globPost\.text\)/);
});

test('Text Snippets can be independently disabled or expanded', () => {
  assert.match(mainSource, /enableTextSnippets/);
  assert.match(mainSource, /applySnippets\(dict\.text\)/);
});

test('Clipboard backup and restore are preserved by default', () => {
  assert.match(pasteSource, /clipboard\.readText\(\)/);
  assert.match(pasteSource, /clipboard\.write\(backup\)/);
  assert.match(pasteSource, /restoreClipboardDelay/);
});

test('Active window refocus is still attempted before paste', () => {
  assert.match(pasteSource, /tell application "\$\{safeName\}" to activate/);
  assert.match(pasteSource, /SetForegroundWindow/);
});

test('Low-volume audio surfaces a mic guidance message', () => {
  assert.match(mainSource, /Your voice is a little low\. Move closer to the mic\./);
});

test('Local-only mode keeps formatting local and avoids cloud providers', () => {
  assert.match(mainSource, /private_offline/);
  assert.match(mainSource, /PARAYU_ENABLE_OLLAMA_DEV/);
});

test('FormatterDecisionEngine gates the LLM formatter before formatting', () => {
  assert.match(mainSource, /formatterDecisionEngine\.shouldFormat/);
  assert.match(mainSource, /formatterDecision\.shouldFormat/);
  assert.match(mainSource, /formatterTimeoutMs/);
});

test('Public settings use Parayu offline AI terms instead of engine internals', () => {
  assert.match(rendererSource, /Private Offline AI/);
  assert.match(rendererSource, /Your voice and text stay on this device\./);
  assert.doesNotMatch(rendererSource, /Ollama|Local Llama|GGUF|localhost|llama\.cpp/);
});
