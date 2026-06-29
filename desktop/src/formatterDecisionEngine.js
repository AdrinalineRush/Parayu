const CLEANUP_MODES = new Set(['fast', 'smart', 'premium']);
const TARGET_FORMAT_TONES = new Set(['professional', 'developer_prompt']);

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeDecisionOptions(options = {}) {
  const cleanupMode = CLEANUP_MODES.has(options.cleanupMode) ? options.cleanupMode : 'smart';
  const formatterMinWords = Math.max(1, parseInt(options.formatterMinWords, 10) || 12);
  return Object.assign({
    cleanupMode,
    alwaysFormat: false,
    skipLlmForShortDictations: true,
    formatterMinWords,
    outputMode: 'transcribe',
    tone: 'natural',
    targetApp: '',
    providerAvailable: true
  }, options, { cleanupMode, formatterMinWords });
}

function hasRoughEdges(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (/\b(um|uh|erm|umm|uhh|you know|i mean)\b/i.test(t)) return true;
  if (/\b(\w+)\s+\1\b/i.test(t)) return true;
  if (/[,;:]\s*$/.test(t)) return true;
  if (t.length > 90 && !/[.!?]$/.test(t.trim())) return true;
  return false;
}

function isLongNote(text) {
  return wordCount(text) >= 80 || String(text || '').length >= 520;
}

function targetModeNeedsFormatter(options, text) {
  if (options.outputMode === 'translate_to_english') return true;
  if (TARGET_FORMAT_TONES.has(options.tone)) return true;
  if (isLongNote(text)) return true;
  const app = String(options.targetApp || '').toLowerCase();
  if (/\b(mail|outlook|gmail|spark|superhuman|hey)\b/.test(app) && wordCount(text) >= options.formatterMinWords) return true;
  return false;
}

class FormatterDecisionEngine {
  shouldFormat(inputText, options = {}) {
    const opts = normalizeDecisionOptions(options);
    const words = wordCount(inputText);

    if (!String(inputText || '').trim()) return { shouldFormat: false, reason: 'empty' };
    if (opts.cleanupMode === 'fast') return { shouldFormat: false, reason: 'fast_mode' };
    if (!opts.providerAvailable) return { shouldFormat: false, reason: 'formatter_unavailable' };

    if (opts.alwaysFormat) return { shouldFormat: true, reason: 'always_format' };
    if (targetModeNeedsFormatter(opts, inputText)) return { shouldFormat: true, reason: 'target_or_mode' };
    if (opts.skipLlmForShortDictations && words < opts.formatterMinWords) {
      return { shouldFormat: false, reason: 'short_dictation' };
    }
    if (words < 12 && !opts.alwaysFormat) return { shouldFormat: false, reason: 'under_12_words' };
    if (opts.cleanupMode === 'premium' && (words >= opts.formatterMinWords || hasRoughEdges(inputText))) {
      return { shouldFormat: true, reason: 'premium_mode' };
    }
    if (opts.cleanupMode === 'smart' && hasRoughEdges(inputText) && words >= opts.formatterMinWords) {
      return { shouldFormat: true, reason: 'rough_edges' };
    }
    return { shouldFormat: false, reason: 'clean_enough' };
  }
}

module.exports = {
  FormatterDecisionEngine,
  normalizeDecisionOptions,
  wordCount,
  hasRoughEdges,
  targetModeNeedsFormatter
};
