const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LLMTextFormatter,
  FormatterProvider,
  NoCloudOfflineFormatterProvider,
  normalizeOptions,
  buildSystemPrompt
} = require('../src/llmTextFormatter');

class EchoProvider extends FormatterProvider {
  async format(inputText, options) {
    if (options.tone === 'developer_prompt') return `Goal: ${inputText}\n\nRequirements:\n- Keep technical terms precise.`;
    return inputText.replace(/\s+/g, ' ').trim();
  }
}

class FailingProvider extends FormatterProvider {
  async format() {
    throw new Error('network down');
  }
}

test('English speech is cleaned into readable English by the offline formatter', async () => {
  const formatter = new LLMTextFormatter(new NoCloudOfflineFormatterProvider());
  const output = await formatter.cleanupWithoutChangingMeaning('um i i need the release notes today');
  assert.equal(output, 'I need the release notes today.');
});

test('Malayalam/Manglish translation mode avoids common Manglish tokens in fallback output', async () => {
  const formatter = new LLMTextFormatter(new NoCloudOfflineFormatterProvider());
  const output = await formatter.translateMalayalamToEnglish('njan ente task pinne cheyyu');
  assert.equal(output, 'I my task then do.');
});

test('Mixed Malayalam-English speech can still be formatted for English output', async () => {
  const formatter = new LLMTextFormatter(new NoCloudOfflineFormatterProvider());
  const output = await formatter.formatTranscript('njan meeting notes update cheyyu', {
    outputMode: 'translate_to_english',
    noManglish: true
  });
  assert.equal(output, 'I meeting notes update do.');
});

test('Developer prompt tone asks providers for structured technical output', () => {
  const prompt = buildSystemPrompt(normalizeOptions({ tone: 'developer_prompt' }));
  assert.match(prompt, /structured, technically precise developer prompt/i);
  assert.match(prompt, /Never invent facts/i);
});

test('Formatter falls back to offline cleanup when the configured provider fails', async () => {
  const formatter = new LLMTextFormatter(new FailingProvider(), new NoCloudOfflineFormatterProvider());
  await assert.rejects(
    () => formatter.formatTranscript('uh please send this'),
    (err) => {
      assert.equal(err.message, 'network down');
      assert.equal(err.fallbackText, 'Please send this.');
      return true;
    }
  );
});

test('Target-app formatting passes app context through provider options', async () => {
  class TargetProvider extends FormatterProvider {
    async format(inputText, options) {
      return `${options.targetApp}: ${inputText}`;
    }
  }
  const formatter = new LLMTextFormatter(new TargetProvider());
  const output = await formatter.formatForTargetApp('hello team', 'Mail');
  assert.equal(output, 'Mail: hello team');
});

test('Offline-only mode can be represented by the no-cloud provider', async () => {
  const formatter = new LLMTextFormatter(new NoCloudOfflineFormatterProvider());
  const output = await formatter.formatTranscript('thanks for the update', { outputMode: 'transcribe' });
  assert.equal(output, 'Thanks for the update.');
});

test('Empty audio/transcript produces no formatted text', async () => {
  const formatter = new LLMTextFormatter(new EchoProvider());
  const output = await formatter.formatTranscript('');
  assert.equal(output, '');
});

test('Whisper hallucination token cleanup remains compatible before formatter input', async () => {
  const formatter = new LLMTextFormatter(new NoCloudOfflineFormatterProvider());
  const output = await formatter.formatTranscript('[BLANK_AUDIO]');
  assert.equal(output, '');
});
