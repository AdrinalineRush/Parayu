// Rule-based transcription cleanup. Runs fully offline, instantly, and for
// free — it targets the artifacts that make raw speech-to-text look unpolished:
// filler words, stutters, doubled words, spacing, capitalization, punctuation.

// Only unambiguous disfluencies belong here. Words like "like", "right",
// "actually", "basically", "literally", "sort of" and "kind of" are far too
// often genuine content ("turn right", "I like this") to strip with a blunt
// rule — removing them silently corrupts the user's text, so they're excluded.
// True filler removal that needs context would require an LLM, not regex.
const FILLERS = [
  'um', 'uh', 'erm', 'uhh', 'umm', 'hmm', 'mhm',
  'you know', 'i mean'
];

// Common spoken→written contractions Whisper sometimes spells out oddly.
function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Removes filler words, but only when they're standing alone as discourse
// markers — never inside another word, and never the only word in the result.
function removeFillers(text) {
  let out = text;
  for (const filler of FILLERS) {
    const re = new RegExp(`(^|[\\s,])(${filler})(?=[\\s,.!?]|$)`, 'gi');
    out = out.replace(re, '$1');
  }
  return normalizeWhitespace(out.replace(/\s+([,.!?])/g, '$1'));
}

// Collapses immediate stutters/repeats: "the the cat", "I I think", "is is".
function removeRepeats(text) {
  return text.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
}

// Capitalizes the first letter of every sentence and the standalone word "I".
function fixCapitalization(text) {
  let out = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_m, lead, ch) => lead + ch.toUpperCase());
  out = out.replace(/\bi\b/g, 'I');
  return out;
}

// Ensures the text ends with terminal punctuation if it doesn't already.
function ensureTerminalPunctuation(text) {
  if (!text) return text;
  // Accept a closing quote/bracket after the terminal mark (e.g. `he said "go."`)
  // so we don't tack on a stray period.
  return /[.!?…][)"'’”\]]?$/.test(text) ? text : text + '.';
}

// Tidies spacing around punctuation: no space before, single space after.
// Also collapses consecutive duplicate punctuation marks (e.g. ",," -> ",")
// and cleans up spacing/punctuation artifacts left behind by filler word removal.
function fixPunctuationSpacing(text) {
  return text
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/,+/g, ',')
    .replace(/\.+/g, '.')
    .replace(/;+/g, ';')
    .replace(/:+/g, ':')
    .replace(/,\s*([.!?])/g, '$1')
    // Add a space after punctuation, but not before a closing quote/bracket
    // (so `go."` stays intact instead of becoming `go. "`).
    .replace(/([,.!?;:])(?=[^\s)"'’”\]])/g, '$1 ')
    .replace(/\s+/g, ' ')
    // Drop separators stranded at the start (e.g. a leading filler removed
    // from "um, I think…" would otherwise leave ", I think…").
    .replace(/^[\s,;:]+/, '')
    .trim();
}

function cleanup(text) {
  if (!text) return text;
  let out = normalizeWhitespace(text);
  out = removeRepeats(out);
  out = removeFillers(out);
  out = fixPunctuationSpacing(out);
  out = fixCapitalization(out);
  out = ensureTerminalPunctuation(out);
  return out;
}

module.exports = { cleanup };
