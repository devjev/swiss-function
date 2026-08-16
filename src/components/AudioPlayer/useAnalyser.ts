import { useEffect, useRef } from "react";

/** Analyser resolution: 128 frequency bins, plenty for ≤ 64 drawn bars. */
const FFT_SIZE = 256;
/** Analyser-side smoothing. This is signal conditioning (an FFT average), not
 *  UI easing: without it the bars flicker unreadably at 60 fps. */
const SMOOTHING = 0.6;

export interface AnalyserHandle {
  /** Attach the analyser graph to `el`, creating it on first call. MUST be
   *  called from inside a user-gesture handler: an `AudioContext` created (or
   *  resumed) outside one starts suspended and reads silence. */
  ensure: (el: HTMLMediaElement) => void;
  /** Fill and return the shared frequency buffer (0..255 per bin), or null
   *  before {@link ensure} has run. */
  read: () => Uint8Array | null;
}

/**
 * The live-bars audio graph: a lazily created `AudioContext` with
 * `MediaElementAudioSourceNode → AnalyserNode → destination`.
 *
 * `createMediaElementSource` is one-shot per element and permanently reroutes
 * the element's audio through the context, so the source node is memoized and
 * the graph always ends at `destination` (otherwise playback goes silent).
 * Nothing is created until `ensure` runs, so a waveform-only player never
 * touches the element's audio path. The context closes on unmount.
 */
export function useAnalyser(): AnalyserHandle {
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const handleRef = useRef<AnalyserHandle | null>(null);

  useEffect(
    () => () => {
      void contextRef.current?.close().catch(() => {});
      contextRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
    },
    [],
  );

  handleRef.current ??= {
    ensure: (el) => {
      if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
      if (contextRef.current == null) {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = SMOOTHING;
        contextRef.current = context;
        analyserRef.current = analyser;
        bufferRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
      const context = contextRef.current;
      const analyser = analyserRef.current;
      if (context == null || analyser == null) return;
      if (sourceRef.current == null) {
        try {
          const source = context.createMediaElementSource(el);
          source.connect(analyser);
          analyser.connect(context.destination);
          sourceRef.current = source;
        } catch {
          // The element is already sourced by another context; leave audio be.
        }
      }
      // Safari (and any context created outside this gesture) starts suspended.
      if (context.state === "suspended") void context.resume().catch(() => {});
    },
    read: () => {
      const analyser = analyserRef.current;
      const buffer = bufferRef.current;
      if (analyser == null || buffer == null) return null;
      analyser.getByteFrequencyData(buffer);
      return buffer;
    },
  };

  return handleRef.current;
}
