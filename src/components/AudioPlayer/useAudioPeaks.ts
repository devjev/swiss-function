import { useEffect, useState } from "react";
import { computePeaks } from "./AudioPlayer.math";

/** Decode resolution: enough buckets that any plausible column count (≤ 512)
 *  max-pools cleanly, small enough (8 KB) to hold per player. */
export const PEAK_BUCKETS = 2048;

export type PeaksStatus = "idle" | "loading" | "ready" | "error";

export interface PeaksState {
  status: PeaksStatus;
  /** `PEAK_BUCKETS` max-abs amplitudes, present once `status === "ready"`. */
  peaks: Float32Array | null;
}

/**
 * Fetch and decode `src` into a fixed-resolution peak profile for the
 * waveform. Decoding runs through an `OfflineAudioContext`, which needs no
 * user gesture (it renders nothing), so the waveform appears before the first
 * play. The decoded `AudioBuffer` is reduced to `PEAK_BUCKETS` floats and
 * dropped in the same tick: an hour of stereo PCM is hundreds of MB, the
 * profile is 8 KB. An in-flight fetch aborts on `src` change or unmount.
 *
 * `status === "error"` covers everything undecodable from here: network
 * failures, cross-origin sources without CORS headers, streams, unsupported
 * codecs. The component treats it as "fall back to bars".
 */
export function useAudioPeaks(
  src: string,
  crossOrigin: "anonymous" | "use-credentials" | undefined,
  enabled: boolean,
): PeaksState {
  const [state, setState] = useState<PeaksState>({ status: "idle", peaks: null });

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof OfflineAudioContext === "undefined") {
      setState({ status: "idle", peaks: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading", peaks: null });
    (async () => {
      const response = await fetch(src, {
        signal: controller.signal,
        credentials: crossOrigin === "use-credentials" ? "include" : "same-origin",
      });
      if (!response.ok) throw new Error(`AudioPlayer: fetching ${src} returned ${response.status}`);
      const bytes = await response.arrayBuffer();
      // Rate/channel arguments only shape the (unused) rendering graph; the
      // decode itself keeps the file's own sample rate.
      const decoder = new OfflineAudioContext(1, 1, 44100);
      const buffer = await decoder.decodeAudioData(bytes);
      const channels: Float32Array[] = [];
      for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
      const peaks = computePeaks(channels, PEAK_BUCKETS);
      if (!controller.signal.aborted) setState({ status: "ready", peaks });
    })().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (process.env.NODE_ENV !== "production") {
        console.warn(`AudioPlayer: could not decode ${src}; falling back to bars.`, error);
      }
      setState({ status: "error", peaks: null });
    });
    return () => controller.abort();
  }, [src, crossOrigin, enabled]);

  return state;
}
