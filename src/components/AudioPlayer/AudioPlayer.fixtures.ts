/**
 * Deterministic audio fixtures for the AudioPlayer stories and CT specs: a
 * generated 16-bit PCM WAV as a data URI, so neither ships a binary asset and
 * every run decodes the exact same bytes.
 */

/** Deterministic white-ish noise in -1..1 (the classic sin-hash PRN). */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Build a mono 16-bit PCM WAV data URI: tones spread across the spectrum plus
 * a noise floor, under a slowly pumping envelope — so the decoded waveform has
 * visible dynamics and the live analyser bars light up across the panel, not
 * just the bass end. Fully deterministic in `seconds`/`sampleRate`.
 */
export function makeWavDataUri(seconds = 4, sampleRate = 22050): string {
  const count = Math.max(1, Math.floor(seconds * sampleRate));
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    // Beats every ~1.4s with a decaying tail, over a quiet floor.
    const envelope = 0.15 + 0.85 * Math.exp(-3 * (t % 1.4)) * Math.abs(Math.sin(t * 0.9 + 0.4));
    const tone =
      0.45 * Math.sin(2 * Math.PI * 220 * t) +
      0.25 * Math.sin(2 * Math.PI * 880 * t) +
      0.15 * Math.sin(2 * Math.PI * 2500 * (1 + 0.2 * Math.sin(t)) * t) +
      0.1 * Math.sin(2 * Math.PI * 6000 * t) +
      0.12 * noise(i);
    samples[i] = Math.round(Math.max(-1, Math.min(1, tone * envelope * 0.9)) * 32767);
  }

  const dataBytes = count * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);
  new Int16Array(buffer, 44).set(samples);

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}
