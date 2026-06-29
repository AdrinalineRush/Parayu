/**
 * Transcript Studio - minimal backend.
 *
 * Exposes a single endpoint used by the page:
 *   POST /api/youtube/english-transcript
 *     body: { url | videoId, seconds, target }
 *     ->   { ok, video, seconds, transcript: [{ time, start, end, sourceLang, sourceText, text }] }
 *
 * Requires Node 18+ (uses the built-in global fetch).
 */
const express = require("express");
const { YoutubeTranscript } = require("youtube-transcript");
const { join } = require("path");

const app = express();
const port = Number(process.env.PORT || 5173);

app.use(express.json({ limit: "2mb" }));

// Serve the built page (dist/) unless running purely as an API (SERVE_STATIC=0).
if (process.env.SERVE_STATIC !== "0") {
  app.use(express.static(join(__dirname, "dist")));
}

const translatedTranscriptCache = new Map();

function parseVideoId(value = "") {
  const trimmed = String(value).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "").slice(0, 11);
    const watchId = url.searchParams.get("v");
    if (watchId) return watchId.slice(0, 11);
    const match = url.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  } catch {
    return "";
  }
  return "";
}

function formatTime(ms = 0) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours ? `${String(hours).padStart(2, "0")}:${base}` : base;
}

function cleanText(text = "") {
  return String(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function detectLanguage(text = "") {
  if (/[ഀ-ൿ]/.test(text)) return "ml";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (/[஀-௿]/.test(text)) return "ta";
  if (/[ఀ-౿]/.test(text)) return "te";
  if (/[ಀ-೿]/.test(text)) return "kn";
  if (/[؀-ۿ]/.test(text)) return "ar";
  return "en";
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
    }
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function getOembed(videoId) {
  try {
    return await fetchJson(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`
      )}&format=json`
    );
  } catch {
    return {
      title: `YouTube video ${videoId}`,
      author_name: "YouTube",
      thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
  }
}

function groupTranscript(transcript = [], seconds = 30) {
  const windowMs = Math.max(1, Number(seconds) || 30) * 1000;
  const groups = new Map();
  transcript.forEach((item) => {
    const offset = Number(item.offset || 0);
    const start = Math.floor(offset / windowMs) * windowMs;
    const current = groups.get(start) || {
      time: formatTime(start),
      start,
      end: start + windowMs,
      sourceText: [],
      sourceLang: item.lang || "auto"
    };
    current.sourceText.push(item.text);
    groups.set(start, current);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    sourceText: cleanText(group.sourceText.join(" "))
  }));
}

function splitForTranslation(text = "", maxLength = 360) {
  const clean = cleanText(text);
  if (clean.length <= maxLength) return [clean].filter(Boolean);
  const words = clean.split(/\s+/);
  const chunks = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateShortText(text, target = "en", source = "auto") {
  const clean = cleanText(text).slice(0, 900);
  if (!clean) return "";
  const detectedSource = source === "auto" ? detectLanguage(clean) : source;
  if (detectedSource === target) return clean;
  try {
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      detectedSource
    )}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(clean)}`;
    const googleResponse = await fetch(googleUrl);
    if (googleResponse.ok) {
      const data = await googleResponse.json();
      const translated = data?.[0]?.map((part) => part?.[0] || "").join("");
      if (translated) return translated;
    }
  } catch {}
  const langPair = `${detectedSource}|${target}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=${encodeURIComponent(
    langPair
  )}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.responseData?.translatedText || clean;
  } catch {
    return clean;
  }
}

async function translateText(text, target = "en", source = "auto") {
  const chunks = splitForTranslation(text);
  if (chunks.length <= 1) return translateShortText(chunks[0] || "", target, source);
  const translated = new Array(chunks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const index = cursor;
      cursor += 1;
      translated[index] = await translateShortText(chunks[index], target, source);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, () => worker()));
  return translated.join(" ");
}

async function translateTranscriptWindows(transcript, target = "en", seconds = 30) {
  const groups = groupTranscript(transcript, seconds);
  const translated = new Array(groups.length);
  let cursor = 0;
  async function worker() {
    while (cursor < groups.length) {
      const index = cursor;
      cursor += 1;
      const group = groups[index];
      translated[index] = {
        time: group.time,
        start: group.start,
        end: group.end,
        sourceLang: group.sourceLang,
        sourceText: group.sourceText,
        text: await translateText(group.sourceText, target, group.sourceLang || "auto")
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, groups.length) }, () => worker()));
  return translated;
}

async function getTranscriptRows(urlOrId) {
  const videoId = parseVideoId(urlOrId);
  if (!videoId) throw Object.assign(new Error("Enter a valid YouTube video URL or ID."), { status: 400 });
  const metadata = await getOembed(videoId);
  let rows = [];
  try {
    rows = await YoutubeTranscript.fetchTranscript(videoId);
  } catch {
    throw Object.assign(new Error("This YouTube video has no captions available to transcribe."), { status: 422 });
  }
  const transcript = rows.map((row) => ({
    time: formatTime(row.offset),
    offset: row.offset,
    duration: row.duration,
    text: cleanText(row.text),
    lang: row.lang || ""
  }));
  return { videoId, metadata, transcript };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, windows: [5, 10, 20, 30] });
});

app.post("/api/youtube/english-transcript", async (req, res) => {
  try {
    const seconds = Number(req.body.seconds || 30);
    const target = req.body.target || "en";
    const { videoId, metadata, transcript } = await getTranscriptRows(req.body.url || req.body.videoId);
    const cacheKey = `${videoId}:${seconds}:${target}`;
    if (translatedTranscriptCache.has(cacheKey)) {
      res.json(translatedTranscriptCache.get(cacheKey));
      return;
    }
    const windows = await translateTranscriptWindows(transcript, target, seconds);
    const payload = {
      ok: true,
      video: {
        id: videoId,
        title: metadata.title,
        author: metadata.author_name || "YouTube",
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        language: transcript[0]?.lang || "auto"
      },
      seconds,
      transcript: windows
    };
    // Limit cache size to prevent memory leaks (Performance Risk #11)
    if (translatedTranscriptCache.size >= 200) {
      const oldestKey = translatedTranscriptCache.keys().next().value;
      if (oldestKey !== undefined) {
        translatedTranscriptCache.delete(oldestKey);
      }
    }
    translatedTranscriptCache.set(cacheKey, payload);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message || "Unexpected server error" });
  }
});

// SPA fallback so the page loads on any path.
if (process.env.SERVE_STATIC !== "0") {
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(__dirname, "dist", "index.html"));
  });
}

app.listen(port, "127.0.0.1", () => {
  console.log(`Transcript Studio running at http://127.0.0.1:${port}`);
});
