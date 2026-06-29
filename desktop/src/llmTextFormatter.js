const { cleanup } = require('./cleanup');
const {
  OllamaFormatterProvider,
  BundledLlamaCppFormatterProvider,
  MLXFormatterProvider
} = require('./offlineAI');

const OUTPUT_MODES = new Set(['transcribe', 'translate_to_english']);
const TONES = new Set(['natural', 'professional', 'casual', 'developer_prompt', 'short_reply']);

const DEFAULT_FORMATTER_OPTIONS = Object.freeze({
  outputMode: 'transcribe',
  tone: 'natural',
  targetApp: '',
  preserveNames: true,
  preserveNumbers: true,
  preserveDates: true,
  preserveLinks: true,
  noManglish: true,
  hallucinationSafe: true
});

class FormatterProvider {
  constructor(options = {}) {
    this.options = options;
  }

  async format(_inputText, _options) {
    throw new Error('Formatter provider must implement format().');
  }
}

function normalizeOptions(options = {}) {
  const outputMode = OUTPUT_MODES.has(options.outputMode) ? options.outputMode : DEFAULT_FORMATTER_OPTIONS.outputMode;
  const tone = TONES.has(options.tone) ? options.tone : DEFAULT_FORMATTER_OPTIONS.tone;
  return Object.assign({}, DEFAULT_FORMATTER_OPTIONS, options, { outputMode, tone });
}

function compactText(text) {
  return String(text || '')
    .replace(/\[(?:BLANK_AUDIO|NO_SPEECH|SILENCE|MUSIC|APPLAUSE)\]/gi, '')
    .replace(/\((?:silence|music|applause)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCodeFence(text) {
  return compactText(text).replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function buildSystemPrompt(options) {
  const target = options.targetApp ? ` Target app: ${options.targetApp}.` : '';
  const mode = options.outputMode === 'translate_to_english'
    ? 'If the input is Malayalam, Manglish, or mixed Malayalam-English, produce clean natural English.'
    : 'Keep the language of the user unless translation to English is clearly requested.';
  const tone = {
    natural: 'Use a natural human tone.',
    professional: 'Use a polished professional tone.',
    casual: 'Use a casual but clear tone.',
    developer_prompt: 'Rewrite as a structured, technically precise developer prompt.',
    short_reply: 'Keep it brief and do not over-polish.'
  }[options.tone] || 'Use a natural human tone.';

  return [
    'You format speech-to-text dictation output.',
    mode,
    tone,
    target,
    'Never invent facts or add new meaning.',
    'Do not change names, numbers, dates, prices, links, filenames, model names, or technical terms unless obviously misrecognized.',
    'Fix grammar, punctuation, capitalization, spacing, and sentence structure.',
    'Remove filler words only when safe.',
    options.noManglish ? 'Do not output Manglish.' : '',
    'Return only the final formatted text.'
  ].filter(Boolean).join(' ');
}

function buildUserPrompt(inputText, options) {
  return [
    `Output mode: ${options.outputMode}`,
    `Tone: ${options.tone}`,
    options.targetApp ? `Target app: ${options.targetApp}` : '',
    '',
    'Transcript:',
    inputText
  ].filter((line) => line !== '').join('\n');
}

async function fetchJson(url, request = {}) {
  if (typeof fetch !== 'function') throw new Error('fetch is unavailable in this runtime.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs || 12000);
  try {
    const res = await fetch(url, Object.assign({}, request, { signal: controller.signal }));
    const bodyText = await res.text();
    if (!res.ok) throw new Error(`Formatter request failed (${res.status}): ${bodyText.slice(0, 240)}`);
    return bodyText ? JSON.parse(bodyText) : {};
  } finally {
    clearTimeout(timeout);
  }
}

function withTimeout(promise, timeoutMs, fallbackMessage = 'Formatter timed out.') {
  const ms = Math.max(1, parseInt(timeoutMs, 10) || 12000);
  let timeout;
  const timer = new Promise((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(fallbackMessage)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

class GeminiFormatterProvider extends FormatterProvider {
  async format(inputText, options) {
    const apiKey = this.options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Gemini API key is not configured.');
    const model = this.options.model || process.env.PARAYU_GEMINI_FORMATTER_MODEL || 'gemini-1.5-flash';
    const body = {
      contents: [{
        role: 'user',
        parts: [{ text: `${buildSystemPrompt(options)}\n\n${buildUserPrompt(inputText, options)}` }]
      }],
      generationConfig: { temperature: 0.2, topP: 0.8, maxOutputTokens: 1200 }
    };
    const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts.map((p) => p.text || '').join('');
    if (!text) throw new Error('Gemini returned no formatted text.');
    return stripCodeFence(text);
  }
}

class OpenAIFormatterProvider extends FormatterProvider {
  async format(inputText, options) {
    const apiKey = this.options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key is not configured.');
    const model = this.options.model || process.env.PARAYU_OPENAI_FORMATTER_MODEL || 'gpt-4.1-mini';
    const data = await fetchJson('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: buildSystemPrompt(options) },
          { role: 'user', content: buildUserPrompt(inputText, options) }
        ],
        temperature: 0.2,
        max_output_tokens: 1200
      })
    });
    const text = data.output_text || (data.output || []).flatMap((item) => item.content || [])
      .map((part) => part.text || '').join('');
    if (!text) throw new Error('OpenAI returned no formatted text.');
    return stripCodeFence(text);
  }
}

class NoCloudOfflineFormatterProvider extends FormatterProvider {
  async format(inputText, options) {
    let out = cleanup(inputText);
    if (options.outputMode === 'translate_to_english' || options.noManglish) {
      out = out
        .replace(/\bente\b/gi, 'my')
        .replace(/\bnjan\b/gi, 'I')
        .replace(/\bningal\b/gi, 'you')
        .replace(/\bpinne\b/gi, 'then')
        .replace(/\balle\b/gi, 'right')
        .replace(/\bcheyyu\b/gi, 'do')
        .replace(/\bok aanu\b/gi, 'okay');
      out = cleanup(out);
    }
    return out;
  }
}

function createFormatterProvider(providerName, providerOptions = {}) {
  switch (providerName) {
    case 'gemini':
      return new GeminiFormatterProvider(providerOptions);
    case 'openai':
      return new OpenAIFormatterProvider(providerOptions);
    case 'ollama_dev':
    case 'local_llama':
      return new OllamaFormatterProvider(Object.assign({}, providerOptions, { fetchJson }));
    case 'mlx':
      return new MLXFormatterProvider(providerOptions);
    case 'bundled_llamacpp':
    case 'private_offline':
      return new BundledLlamaCppFormatterProvider(providerOptions);
    case 'offline':
    default:
      return new NoCloudOfflineFormatterProvider(providerOptions);
  }
}

class LLMTextFormatter {
  constructor(provider, fallbackProvider = new NoCloudOfflineFormatterProvider()) {
    this.provider = provider || fallbackProvider;
    this.fallbackProvider = fallbackProvider;
  }

  async formatTranscript(inputText, options = {}) {
    const text = compactText(inputText);
    if (!text) return '';
    const opts = normalizeOptions(options);
    opts.systemPrompt = buildSystemPrompt(opts);
    opts.userPrompt = buildUserPrompt(text, opts);
    try {
      const run = this.provider.format(text, opts);
      return opts.timeoutMs ? await withTimeout(run, opts.timeoutMs) : await run;
    } catch (error) {
      const fallbackText = await this.fallbackProvider.format(text, opts);
      const err = new Error(error.message || String(error));
      err.fallbackText = fallbackText;
      throw err;
    }
  }

  formatForTargetApp(inputText, targetApp, options = {}) {
    return this.formatTranscript(inputText, Object.assign({}, options, { targetApp }));
  }

  translateMalayalamToEnglish(inputText, options = {}) {
    return this.formatTranscript(inputText, Object.assign({}, options, { outputMode: 'translate_to_english', noManglish: true }));
  }

  cleanupWithoutChangingMeaning(inputText, options = {}) {
    return this.formatTranscript(inputText, Object.assign({}, options, { hallucinationSafe: true }));
  }
}

module.exports = {
  DEFAULT_FORMATTER_OPTIONS,
  LLMTextFormatter,
  FormatterProvider,
  GeminiFormatterProvider,
  OpenAIFormatterProvider,
  OllamaFormatterProvider,
  BundledLlamaCppFormatterProvider,
  MLXFormatterProvider,
  NoCloudOfflineFormatterProvider,
  createFormatterProvider,
  normalizeOptions,
  withTimeout,
  buildSystemPrompt,
  buildUserPrompt
};
