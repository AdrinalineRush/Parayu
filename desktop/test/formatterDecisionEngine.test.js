const test = require('node:test');
const assert = require('node:assert/strict');

const { FormatterDecisionEngine } = require('../src/formatterDecisionEngine');
const { withTimeout } = require('../src/llmTextFormatter');

test('short clean dictations skip formatter by default', () => {
  const engine = new FormatterDecisionEngine();
  const decision = engine.shouldFormat('Send it today.', {
    cleanupMode: 'smart',
    formatterMinWords: 12,
    providerAvailable: true
  });
  assert.equal(decision.shouldFormat, false);
  assert.equal(decision.reason, 'short_dictation');
});

test('under 12 words skip unless Always Format is enabled', () => {
  const engine = new FormatterDecisionEngine();
  assert.equal(engine.shouldFormat('Please review the file.', {
    cleanupMode: 'smart',
    formatterMinWords: 3,
    providerAvailable: true
  }).shouldFormat, false);
  assert.equal(engine.shouldFormat('Please review the file.', {
    cleanupMode: 'smart',
    alwaysFormat: true,
    formatterMinWords: 12,
    providerAvailable: true
  }).shouldFormat, true);
});

test('Malayalam to English output mode uses formatter when possible', () => {
  const engine = new FormatterDecisionEngine();
  const decision = engine.shouldFormat('njan meeting notes update cheyyu today please', {
    cleanupMode: 'smart',
    outputMode: 'translate_to_english',
    formatterMinWords: 3,
    providerAvailable: true
  });
  assert.equal(decision.shouldFormat, true);
});

test('Fast Mode never runs formatter automatically', () => {
  const engine = new FormatterDecisionEngine();
  const decision = engine.shouldFormat('Please make this email professional and polished for the client.', {
    cleanupMode: 'fast',
    alwaysFormat: true,
    tone: 'professional',
    providerAvailable: true
  });
  assert.equal(decision.shouldFormat, false);
  assert.equal(decision.reason, 'fast_mode');
});

test('unavailable local formatter skips and preserves fast path', () => {
  const engine = new FormatterDecisionEngine();
  const decision = engine.shouldFormat('Please make this email professional and polished for the client.', {
    cleanupMode: 'smart',
    tone: 'professional',
    providerAvailable: false
  });
  assert.equal(decision.shouldFormat, false);
  assert.equal(decision.reason, 'formatter_unavailable');
});

test('professional/developer/long-note targets use formatter', () => {
  const engine = new FormatterDecisionEngine();
  assert.equal(engine.shouldFormat('Please write a careful reply to the customer about the renewal timeline.', {
    cleanupMode: 'smart',
    tone: 'professional',
    formatterMinWords: 3,
    providerAvailable: true
  }).shouldFormat, true);
  assert.equal(engine.shouldFormat('Build a login page with oauth callback error states.', {
    cleanupMode: 'smart',
    tone: 'developer_prompt',
    formatterMinWords: 3,
    providerAvailable: true
  }).shouldFormat, true);
});

test('formatter timeout rejects instead of waiting forever', async () => {
  await assert.rejects(
    () => withTimeout(new Promise((resolve) => setTimeout(() => resolve('late'), 50)), 5),
    /timed out/i
  );
});
