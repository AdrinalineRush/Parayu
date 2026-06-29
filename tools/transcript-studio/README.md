# Transcript Studio

A single, self-contained page: a YouTube video on top, and below it the
translated transcript split into numbered **5s / 10s / 20s / 30s** boxes with:

- Sequential box numbers (1…N) that match the `metadata.csv` `.wav` rows
- Play / pause toggle per box (click a box to play it, click again to pause/resume)
- Search, copy-one, copy-all, download `.txt`
- **Clean** toggle — lowercase, no `?`, no commas/full-stops (model-training format)
- **metadata.csv** export (`file_name,text,start,end`)

Nothing else — no sidebar, summary, mind map, chat, etc.

## Requirements

- Node.js 18+ (the backend uses the built-in global `fetch`)

## Run it standalone

```bash
npm install

# Terminal 1 — API (translation endpoint) on :5174
npm run api

# Terminal 2 — dev page on :5173 (proxies /api -> :5174)
npm run dev
```

Open the dev URL it prints, paste a YouTube URL, click **Load**.

### Production (single process)

```bash
npm run local      # builds the page, then serves page + API on :5173
# open http://127.0.0.1:5173
```

## Files

```
index.html          # page entry
vite.config.js      # dev server + /api proxy
server.cjs          # minimal backend (one endpoint)
src/
  main.jsx          # React mount
  StudioApp.jsx     # the entire page + all UI logic
  api.js            # tiny fetch helper
  styles.css        # styles
```

## Wiring into your own software

The page calls exactly **one** backend endpoint. Implement it in your stack
(or reuse `server.cjs` as-is) and point the frontend at it.

### `POST /api/youtube/english-transcript`

Request:

```json
{ "url": "https://www.youtube.com/watch?v=VIDEO_ID", "seconds": 30, "target": "en" }
```

- `url` — YouTube URL or 11-char video id
- `seconds` — window size: `5`, `10`, `20`, or `30`
- `target` — translation target language (default `"en"`)

Response:

```json
{
  "ok": true,
  "video": { "id": "...", "title": "...", "author": "...", "sourceUrl": "...", "language": "ml" },
  "seconds": 30,
  "transcript": [
    {
      "time": "00:00",
      "start": 0,
      "end": 30000,
      "sourceLang": "ml",
      "sourceText": "<original-language text for the window>",
      "text": "<translated English text for the window>"
    }
  ]
}
```

`start` / `end` are milliseconds. The frontend derives the box number from the
array order, builds the `--> ` range from `start`/`end`, and applies the Clean
transform on the client.

### Notes for integration

- If your app already has its own video id / transcript source, you only need to
  return the `transcript` array in the shape above — the page does the rest.
- The frontend is plain Vite + React; `npm run build` outputs static files in
  `dist/` you can host anywhere, as long as `/api/youtube/english-transcript`
  is reachable from the page (same origin, or set up a proxy/CORS).
- Translation here uses Google's public endpoint with a MyMemory fallback. Swap
  `translateShortText` in `server.cjs` for your own translation provider if you
  need guaranteed quota.
```
