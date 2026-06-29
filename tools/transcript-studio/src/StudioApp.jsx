import {
  Copy,
  Download,
  Languages,
  Loader2,
  Pause,
  Play,
  Search,
  Upload,
  Wand2
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiJson } from "./api";

const WINDOW_OPTIONS = [5, 10, 20, 30];
const DEFAULT_URL = "https://www.youtube.com/watch?v=D792UT8G9zk";

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

function formatCueTime(ms = 0) {
  const totalMs = Math.max(0, Math.floor(Number(ms) || 0));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function shortTime(ms = 0) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function cleanForTraining(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/\?/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[,.]/g, "")
    .replace(/\s+([;:!])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEmbedSrc(videoId, seekCommand) {
  const params = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1"
  });
  if (typeof window !== "undefined") params.set("origin", window.location.origin);
  if (seekCommand) {
    params.set("autoplay", "1");
    params.set("start", String(Math.max(0, Math.floor(seekCommand.seconds || 0))));
    params.set("seek", String(seekCommand.nonce));
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function downloadContent(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StudioApp() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [videoId, setVideoId] = useState("");
  const [windowSeconds, setWindowSeconds] = useState(30);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [trainingClean, setTrainingClean] = useState(false);
  const [toast, setToast] = useState("");

  const [seekCommand, setSeekCommand] = useState(null);
  const [controlCommand, setControlCommand] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message) {
    setToast(message);
  }

  async function loadTranscript(seconds = windowSeconds, sourceUrl = url) {
    const id = parseVideoId(sourceUrl);
    if (!id) {
      showToast("Enter a valid YouTube URL");
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson("/api/youtube/english-transcript", {
        url: `https://www.youtube.com/watch?v=${id}`,
        seconds,
        target: "en"
      });
      setVideoId(id);
      setRows(data.transcript || []);
      setWindowSeconds(seconds);
      setActiveId(null);
      setIsPlaying(false);
      showToast(`Loaded ${data.transcript?.length || 0} boxes (${seconds}s windows)`);
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  function selectWindow(seconds) {
    if (loading) return;
    if (videoId) loadTranscript(seconds);
    else setWindowSeconds(seconds);
  }

  function togglePlay(item) {
    const seconds = Math.max(0, Number(item.start || 0) / 1000);
    if (activeId === item.start) {
      if (isPlaying) {
        setControlCommand({ action: "pause", nonce: Date.now() });
        setIsPlaying(false);
        showToast("Paused");
      } else {
        setControlCommand({ action: "resume", nonce: Date.now() });
        setIsPlaying(true);
        showToast("Resumed");
      }
      return;
    }
    setSeekCommand({ seconds, nonce: Date.now() });
    setActiveId(item.start);
    setIsPlaying(true);
    showToast(`Playing from ${shortTime(item.start)}`);
  }

  const query = search.trim().toLowerCase();
  const visibleRows = rows.filter(
    (item) =>
      !query ||
      item.text.toLowerCase().includes(query) ||
      cleanForTraining(item.text).includes(query) ||
      formatCueTime(item.start).includes(query)
  );

  function textForDisplay(item) {
    return trainingClean ? cleanForTraining(item.text) : item.text;
  }

  function boxNumberFor(item) {
    const position = rows.indexOf(item);
    return position >= 0 ? position + 1 : 0;
  }

  const activeText = visibleRows
    .map((item) =>
      trainingClean
        ? textForDisplay(item)
        : `${formatCueTime(item.start)} --> ${formatCueTime(item.end)}\n${textForDisplay(item)}`
    )
    .join(trainingClean ? "\n" : "\n\n");

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function buildMetadataCsv() {
    const out = [["file_name", "text", "start", "end"]];
    rows.forEach((item, index) => {
      const text = cleanForTraining(item.text);
      if (!text) return;
      out.push([
        `box_${String(index + 1).padStart(4, "0")}.wav`,
        text,
        formatCueTime(item.start),
        formatCueTime(item.end)
      ]);
    });
    return out.map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  async function copyText(text, message = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      showToast(message);
    }
  }

  return (
    <div className="studio-shell">
      <header className="studio-head">
        <h1>Transcript Studio</h1>
        <div className="studio-import">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste a YouTube URL"
            onKeyDown={(event) => event.key === "Enter" && loadTranscript()}
          />
          <button className="modal-primary" onClick={() => loadTranscript()} disabled={loading}>
            {loading ? <Loader2 className="spin" size={17} /> : <Upload size={17} />}
            <span>Load</span>
          </button>
        </div>
      </header>

      <div className="studio-video">
        {videoId ? (
          <VideoBox
            videoId={videoId}
            title="YouTube preview"
            seekCommand={seekCommand}
            controlCommand={controlCommand}
            onPlayStateChange={setIsPlaying}
          />
        ) : (
          <div className="studio-video-empty">
            <Play size={42} />
            <span>Load a YouTube URL to begin</span>
          </div>
        )}
      </div>

      <section className="transcript-panel">
        <div className="transcript-modebar">
          <div className="mode-tabs window-menu">
            {WINDOW_OPTIONS.map((seconds) => (
              <button
                key={seconds}
                className={windowSeconds === seconds ? "active" : ""}
                onClick={() => selectWindow(seconds)}
                disabled={loading}
              >
                <Languages size={16} />
                <span>{seconds}s</span>
              </button>
            ))}
          </div>
        </div>

        <div className="search-row">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transcript"
          />
          <button className="icon-button" onClick={() => copyText(activeText)} title="Copy all">
            <Copy size={17} />
          </button>
          <button
            className="icon-button"
            onClick={() => downloadContent(`transcript-${windowSeconds}s.txt`, activeText)}
            title="Download transcript"
          >
            <Download size={17} />
          </button>
          <button
            className={`soft-button mini-download ${trainingClean ? "active" : ""}`}
            onClick={() => setTrainingClean((value) => !value)}
            title="Clean text for model training"
          >
            <Wand2 size={14} />
            <span>Clean</span>
          </button>
          <button
            className="soft-button mini-download metadata-button"
            onClick={() => downloadContent("metadata.csv", buildMetadataCsv(), "text/csv;charset=utf-8")}
            disabled={!rows.length}
          >
            metadata.csv
          </button>
        </div>

        <div className="transcript-list">
          {!rows.length && (
            <article className="transcript-empty">
              <Languages size={24} />
              <strong>No transcript yet</strong>
              <span>Load a YouTube URL, then pick a 5s, 10s, 20s, or 30s window.</span>
            </article>
          )}
          {visibleRows.map((item) => {
            const number = boxNumberFor(item);
            const rowActive = activeId === item.start;
            return (
              <article className="transcript-row thirty-box" key={item.start} data-time={item.time}>
                <div className="row-lead">
                  <span className="box-number">{number}</span>
                  <button
                    className={`time-badge ${rowActive ? "is-active" : ""}`}
                    type="button"
                    onClick={() => togglePlay(item)}
                    title={rowActive && isPlaying ? `Pause at ${shortTime(item.start)}` : `Play from ${shortTime(item.start)}`}
                  >
                    {rowActive && isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    <span>{shortTime(item.start)}</span>
                  </button>
                </div>
                <p>
                  <small className="subtitle-range">
                    {formatCueTime(item.start)} {"-->"} {formatCueTime(item.end)}
                  </small>
                  {textForDisplay(item)}
                </p>
                <button
                  className="icon-button row-copy"
                  onClick={() => copyText(textForDisplay(item), "Box copied")}
                  title="Copy this box"
                >
                  <Copy size={17} />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function VideoBox({ videoId, title, seekCommand, controlCommand, onPlayStateChange }) {
  const playerRef = useRef(null);
  const embedSrc = buildEmbedSrc(videoId, seekCommand);

  function postCommand(func, args = []) {
    const target = playerRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }

  function registerListeners() {
    const target = playerRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(JSON.stringify({ event: "listening", id: videoId, channel: "widget" }), "*");
    postCommand("addEventListener", ["onStateChange"]);
  }

  useEffect(() => {
    function onMessage(event) {
      if (typeof event.data !== "string" || !event.origin.includes("youtube.com")) return;
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      const state =
        typeof payload?.info?.playerState === "number"
          ? payload.info.playerState
          : payload?.event === "onStateChange" && typeof payload.info === "number"
            ? payload.info
            : undefined;
      if (state === 1) onPlayStateChange?.(true);
      else if (state === 2 || state === 0) onPlayStateChange?.(false);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onPlayStateChange]);

  useEffect(() => {
    if (!seekCommand || !playerRef.current?.contentWindow) return undefined;
    const seconds = Math.max(0, Number(seekCommand.seconds) || 0);
    postCommand("seekTo", [seconds, true]);
    postCommand("playVideo");
    const timer = window.setTimeout(() => {
      registerListeners();
      postCommand("seekTo", [seconds, true]);
      postCommand("playVideo");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [seekCommand]);

  useEffect(() => {
    if (!controlCommand) return;
    if (controlCommand.action === "pause") postCommand("pauseVideo");
    else if (controlCommand.action === "resume") postCommand("playVideo");
  }, [controlCommand]);

  return (
    <div className="studio-video-frame">
      <iframe
        ref={playerRef}
        title={title}
        src={embedSrc}
        onLoad={registerListeners}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
