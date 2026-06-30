// Captures mic audio at 16kHz mono and encodes it as a WAV ArrayBuffer,
// which is the format src/whisper.js expects to decode.
class Recorder {
  constructor() {
    this.audioContext = null;
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.samples = [];
  }

  // onLevel receives a normalized 0..1 loudness value on every audio frame,
  // used to drive the live waveform in the overlay.
  async start(deviceId, onLevel, options = {}) {
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: options.noiseSuppression !== false,
      autoGainControl: options.autoGainControl !== false,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {})
    };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);
    this.samples = [];

    this.processor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      this.samples.push(new Float32Array(channelData));

      if (onLevel) {
        let sumSquares = 0;
        for (let i = 0; i < channelData.length; i++) sumSquares += channelData[i] * channelData[i];
        const rms = Math.sqrt(sumSquares / channelData.length);
        // Compress dynamic range using square root so quiet speech is highly visible
        const compressed = Math.sqrt(rms) * 3.5;
        onLevel(Math.min(1, compressed));
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  // Returns the recorded WAV, or null if recording never actually started
  // (e.g. mic permission was denied in start()). Always tears down whatever
  // resources do exist so a failed start can't leak a live mic/context.
  stop() {
    if (!this.audioContext) { this.cleanup(); return null; }
    if (this.processor) this.processor.disconnect();
    if (this.source) this.source.disconnect();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    const sampleRate = this.audioContext.sampleRate;
    this.audioContext.close();

    const total = this.samples.reduce((sum, arr) => sum + arr.length, 0);
    const flat = new Float32Array(total);
    let offset = 0;
    for (const arr of this.samples) {
      flat.set(arr, offset);
      offset += arr.length;
    }
    this.cleanup();
    return encodeWav(flat, sampleRate);
  }

  // Releases any partially-initialised resources and clears references, so the
  // Recorder instance is safe to reuse after a failed or completed session.
  cleanup() {
    try { if (this.processor) this.processor.disconnect(); } catch (_e) {}
    try { if (this.source) this.source.disconnect(); } catch (_e) {}
    try { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); } catch (_e) {}
    try { if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close(); } catch (_e) {}
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.audioContext = null;
    this.samples = [];
  }
}

function encodeWav(float32, sampleRate) {
  const buffer = new ArrayBuffer(44 + float32.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + float32.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, float32.length * 2, true);

  let offset = 44;
  for (let i = 0; i < float32.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
