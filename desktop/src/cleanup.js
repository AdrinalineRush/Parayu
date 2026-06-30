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

// Collapses adjacent multi-word repeated phrases (e.g. "yesterday we went to yesterday we went to the beach")
function removePhraseRepeats(text) {
  if (!text) return text;
  const originalWords = text.split(/\s+/);
  const cleanWords = originalWords.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  let words = [...originalWords];
  let clean = [...cleanWords];
  
  const maxL = Math.min(12, Math.floor(clean.length / 2));
  for (let L = maxL; L >= 2; L--) {
    let i = 0;
    while (i <= clean.length - 2 * L) {
      let match = true;
      for (let j = 0; j < L; j++) {
        if (clean[i + j] !== clean[i + L + j] || clean[i + j] === '') {
          match = false;
          break;
        }
      }
      if (match) {
        words.splice(i, L);
        clean.splice(i, L);
      } else {
        i++;
      }
    }
  }
  return words.join(' ');
}

// Detects self-corrections using markers like "I mean", "sorry", "no", "actually", "or rather"
// if the surrounding clauses contain overlapping words.
function removeSelfCorrections(text) {
  if (!text) return text;
  
  // Correction connectors preceded/followed by pause indicators (comma, period, ellipses, dash)
  const correctionRegex = /(\s*(?:[,.!?…—-]+\s*|\s+-\s+)(?:i mean|sorry|no|actually|or rather)(?:\s*[,.!?…—-]+\s*|\s+-\s+|\s+))/i;
  
  let out = text;
  let searchIdx = 0;
  
  while (true) {
    const remaining = out.substring(searchIdx);
    const match = correctionRegex.exec(remaining);
    if (!match) break;
    
    const idx = searchIdx + match.index;
    const matchLen = match[0].length;
    
    const partA = out.substring(0, idx);
    const partB = out.substring(idx + matchLen);
    
    const wordsA = partA.trim().split(/\s+/);
    const wordsB = partB.trim().split(/\s+/);
    
    const cleanA = wordsA.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const cleanB = wordsB.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    let handled = false;
    
    // Case 1: Suffix-Prefix overlap (e.g. "We went to the... sorry, we went to the store")
    const maxK = Math.min(cleanA.length, cleanB.length, 12);
    for (let k = maxK; k >= 2; k--) {
      let isOverlap = true;
      for (let j = 0; j < k; j++) {
        if (cleanA[cleanA.length - k + j] !== cleanB[j] || cleanB[j] === '') {
          isOverlap = false;
          break;
        }
      }
      if (isOverlap) {
        const truncatedA = wordsA.slice(0, wordsA.length - k).join(' ');
        out = (truncatedA ? truncatedA + ' ' : '') + partB;
        searchIdx = truncatedA ? truncatedA.length : 0;
        handled = true;
        break;
      }
    }
    
    if (handled) continue;
    
    // Case 2: Clause correction (e.g. "I want to go to the park, I mean, I want to go to the theater")
    const sentencesA = partA.split(/(?<=[.!?])\s+/);
    const lastSentenceA = sentencesA[sentencesA.length - 1] || '';
    const wordsLastA = lastSentenceA.trim().split(/\s+/);
    const cleanLastA = wordsLastA.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const sentencesB = partB.split(/(?<=[.!?])\s+/);
    const firstSentenceB = sentencesB[0] || '';
    const wordsFirstB = firstSentenceB.trim().split(/\s+/);
    const cleanFirstB = wordsFirstB.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    let commonWords = 0;
    const maxCommon = Math.min(cleanLastA.length, cleanFirstB.length);
    for (let j = 0; j < maxCommon; j++) {
      if (cleanLastA[j] === cleanFirstB[j] && cleanLastA[j] !== '') {
        commonWords++;
      } else {
        break;
      }
    }
    
    if (commonWords >= 3) {
      const remainingA = sentencesA.slice(0, sentencesA.length - 1).join('. ');
      out = (remainingA ? remainingA + ' ' : '') + partB;
      searchIdx = remainingA ? remainingA.length : 0;
    } else {
      searchIdx = idx + matchLen;
    }
  }
  
  return out;
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
  return /[.!?…][)"'?’”\]]?$/.test(text) ? text : text + '.';
}

// Tidies spacing around punctuation: no space before, single space after.
// Also collapses consecutive duplicate punctuation marks (e.g. ",," -> ",")
// and cleans up spacing/punctuation artifacts left behind by filler word removal.
function fixPunctuationSpacing(text) {
  return text
    .replace(/\s+([OP,.!?;:])/g, '$1') // Note: preserve any existing logic here
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/,+/g, ',')
    .replace(/\.+/g, '.')
    .replace(/;+/g, ';')
    .replace(/:+/g, ':')
    .replace(/,\s*([.!?])/g, '$1')
    // Add a space after punctuation, but not before a closing quote/bracket
    // (so `go."` stays intact instead of becoming `go. "`).
    .replace(/([,.!?;:])(?=[^\s)"'?’”\]])/g, '$1 ')
    .replace(/\s+/g, ' ')
    // Drop separators stranded at the start (e.g. a leading filler removed
    // from "um, I think…" would otherwise leave ", I think…").
    .replace(/^[\s,;:]+/, '')
    .trim();
}

function cleanup(text) {
  if (!text) return text;
  let out = normalizeWhitespace(text);
  out = removeSelfCorrections(out);
  out = removePhraseRepeats(out);
  out = removeRepeats(out);
  out = removeFillers(out);
  out = fixPunctuationSpacing(out);
  out = fixCapitalization(out);
  out = ensureTerminalPunctuation(out);
  return out;
}

module.exports = { cleanup };
