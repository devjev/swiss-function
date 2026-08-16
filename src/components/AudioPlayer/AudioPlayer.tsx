import type { CSSProperties, HTMLAttributes, KeyboardEvent, PointerEvent, RefObject } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useMeasuredPlot } from "../../lib/chart/useMeasuredPlot";
import { prepareCanvas } from "../../lib/chart3d/paint";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import { mergeRefs } from "../../lib/mergeRefs";
import { prefersReducedMotion } from "../../lib/prefersReducedMotion";
import { token } from "../../lib/token";
import { useThemeEpoch } from "../../lib/useThemeEpoch";
import type { BoxElevation } from "../Box";
import { Button } from "../Button";
import { Pause, Play, Stop } from "../Icon";
import { barCount, drawBars, drawWaveform, waveColumnCount } from "./AudioPlayer.draw";
import { barLevels, formatTime, rebucket } from "./AudioPlayer.math";
import styles from "./AudioPlayer.module.css";
import { useAnalyser } from "./useAnalyser";
import { useAudioPeaks } from "./useAudioPeaks";

/** How the wave panel is rendered. */
export type AudioPlayerVisualization = "waveform" | "bars";

/** Seconds moved per ArrowLeft/ArrowRight on the seek slider. */
const SEEK_STEP = 5;

/** Imperative playback controls, exposed through `apiRef` (the `WindowArray`
 *  precedent): the hook for "pause every other player" without a controlled
 *  playing prop. */
export interface AudioPlayerApi {
  play: () => void;
  pause: () => void;
  /** Pause and rewind to the start. */
  stop: () => void;
  /** Jump to a position in seconds (clamped to the track). */
  seek: (seconds: number) => void;
}

export interface AudioPlayerProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "color" | "onPlay" | "onPause" | "onEnded" | "onError" | "onTimeUpdate" | "onRateChange"
  > {
  /** Audio source URL (http(s), blob, or data). Changing it stops playback and
   *  reloads. */
  src: string;
  /** `"waveform"` (default) decodes the whole track once and draws its
   *  amplitude profile — the seekable, SoundCloud-style read. It needs the file
   *  to be fetchable and decodable (same-origin or CORS + `crossOrigin`);
   *  when it isn't (streams, unsupported codecs), the player falls back to
   *  `"bars"` with a dev warning. `"bars"` draws live analyser columns while
   *  playing and never fetches the file a second time — the mode for streams
   *  and very long files. */
  visualization?: AudioPlayerVisualization;
  /** `"inline"` (default): one dense row — transport, wave, readout, rate.
   *  `"panel"`: the deck reading (the Windows 95 Sound Recorder posture): a
   *  taller wave display stacked over a control bar of raised buttons, inside
   *  one bordered chassis. Same parts, re-gridded. */
  layout?: "inline" | "panel";
  /** Explicit accent (any CSS colour or `--sf-*` token). Played columns, the
   *  playhead, and the live bars use it. Default `--sf-color-primary`. */
  color?: string;
  /** Wave-panel height and transport density. Default `"md"`. */
  size?: "sm" | "md" | "lg";
  /** Wave-panel depth on the `--sf-elevation-N` scale (same as Box). Omitted =
   *  flat. */
  elevation?: BoxElevation;
  /** Playback-rate steps the rate button cycles through, starting at the first
   *  entry. An empty array hides the control. Default `[1, 1.5, 2, 0.5]`. */
  rates?: number[];
  /** Restart from the beginning when the track ends. Default `false`. */
  loop?: boolean;
  /** Try to start playback on mount. Best-effort: browsers block autoplay
   *  without a prior gesture, in which case the player stays paused. Default
   *  `false`. */
  autoPlay?: boolean;
  /** The `<audio>` element's preload hint. Default `"metadata"` (the waveform
   *  fetches the file separately anyway). */
  preload?: "none" | "metadata" | "auto";
  /** CORS mode for the `<audio>` element and the waveform fetch. Required for
   *  any visualization of cross-origin media (without it the waveform falls
   *  back to bars and the analyser reads silence; playback still works). */
  crossOrigin?: "anonymous" | "use-credentials";
  disabled?: boolean;
  /** Accessible name for the player group. Default `"Audio player"`. */
  "aria-label"?: string;
  /** Imperative playback controls. */
  apiRef?: RefObject<AudioPlayerApi | null>;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onRateChange?: (rate: number) => void;
  /** Media errors from the element, and rejected `play()` calls (autoplay
   *  blocked, unsupported source). */
  onError?: (error: MediaError | Error) => void;
}

const sizeClass: Record<NonNullable<AudioPlayerProps["size"]>, string | undefined> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/** `1.5` → `1.5×` with no trailing zeros; the mono rate-button label. */
function formatRate(rate: number): string {
  return `${rate}×`;
}

/**
 * A self-contained audio player: play / pause / stop transport, a quantized
 * wave visualization (a decoded full-track waveform that doubles as the seek
 * slider, or live analyser bars), a monospace time readout, and a cycling
 * playback-rate button. The component owns a hidden `<audio>` element; wire
 * the callbacks (or `apiRef`) to integrate. Renders a `<div role="group">`.
 */
export const AudioPlayer = forwardRef<HTMLDivElement, AudioPlayerProps>(function AudioPlayer(
  {
    src,
    visualization = "waveform",
    layout = "inline",
    color,
    size = "md",
    elevation,
    rates = [1, 1.5, 2, 0.5],
    loop = false,
    autoPlay = false,
    preload = "metadata",
    crossOrigin,
    disabled = false,
    "aria-label": ariaLabel = "Audio player",
    apiRef,
    onPlay,
    onPause,
    onEnded,
    onTimeUpdate,
    onRateChange,
    onError,
    className,
    style,
    ...rest
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { ref: waveRef, plotRef: wavePlotRef, size: waveSize } = useMeasuredPlot();

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(Number.NaN);
  const [currentTime, setCurrentTime] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const wantsWaveform = visualization === "waveform";
  const peaksState = useAudioPeaks(src, crossOrigin, wantsWaveform);
  const effectiveVis: AudioPlayerVisualization =
    wantsWaveform && peaksState.status !== "error" ? "waveform" : "bars";

  const analyser = useAnalyser();
  const themeEpoch = useThemeEpoch(rootRef);

  const rate = rates.length > 0 ? (rates[rateIndex % rates.length] ?? 1) : 1;

  // While scrubbing (or between a keyboard seek and the element catching up),
  // the pending target drives the playhead so the wave follows the hand; the
  // element's own currentTime takes over once it reports the seek.
  const pendingSeekRef = useRef<number | null>(null);
  const seekRafRef = useRef<number | null>(null);
  const hoverFractionRef = useRef<number | null>(null);
  const lastLevelsRef = useRef<Float32Array | null>(null);
  const visibleRef = useRef(true);

  // --- Drawing (imperative; effects and the rAF loop call drawRef) ----------

  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const { width, height } = waveSize;
    if (!canvas || !root || width <= 0 || height <= 0) return;
    const ctx = prepareCanvas(canvas, width, height);
    if (!ctx) return;
    const accent = token("--audio-accent", "#1f6feb", root);
    if (effectiveVis === "waveform") {
      const columns = waveColumnCount(width);
      const data = peaksState.peaks
        ? rebucket(peaksState.peaks, columns)
        : new Float32Array(columns);
      const el = audioRef.current;
      const total = el && Number.isFinite(el.duration) ? el.duration : Number.NaN;
      const at = pendingSeekRef.current ?? el?.currentTime ?? 0;
      const played = Number.isFinite(total) && total > 0 ? Math.min(1, at / total) : 0;
      drawWaveform(ctx, width, height, data, played, hoverFractionRef.current, {
        accent,
        rest: token("--audio-wave", "#d0d7de", root),
        hover: token("--sf-color-fg-subtle", "#4b5563", root),
      });
    } else {
      const bars = barCount(width);
      const freq = playing ? analyser.read() : null;
      const levels = freq
        ? barLevels(freq, bars)
        : (lastLevelsRef.current ?? new Float32Array(bars));
      if (freq) lastLevelsRef.current = levels;
      drawBars(
        ctx,
        width,
        height,
        levels.length === bars ? levels : new Float32Array(bars),
        accent,
      );
    }
  };

  // Repaint on layout / data / theme / mode changes (rest state included).
  // biome-ignore lint/correctness/useExhaustiveDependencies: drawRef reads them all; the deps list is the repaint trigger set
  useEffect(() => {
    drawRef.current();
  }, [waveSize, peaksState, themeEpoch, effectiveVis, color, currentTime, duration]);

  // The motion loop: while playing, advance the playhead (waveform) or the
  // live bars every frame. Offscreen the draw is skipped (the browser already
  // stops rAF in hidden tabs; the observer covers scrolled-away players).
  // Reduced motion: the playhead is content and still moves, but only at the
  // element's own ~4 Hz timeupdate cadence (wired below); bars get a single
  // "signal present" frame shortly after play starts.
  useEffect(() => {
    if (!playing) return;
    if (prefersReducedMotion()) {
      if (effectiveVis === "bars") {
        const timer = window.setTimeout(() => drawRef.current(), 100);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    let raf = 0;
    const tick = () => {
      if (visibleRef.current) drawRef.current();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, effectiveVis]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry?.isIntersecting ?? true;
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = rate;
  }, [rate]);

  // --- Transport -------------------------------------------------------------

  const play = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    // The analyser graph must be created inside the user gesture that starts
    // playback, or the context stays suspended and reads silence.
    if (effectiveVis === "bars") analyser.ensure(el);
    el.play().catch((error: unknown) => {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    });
  }, [effectiveVis, analyser, onError]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const target = Math.max(0, Math.min(el.duration, seconds));
    el.currentTime = target;
    setCurrentTime(target);
    drawRef.current();
  }, []);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    pendingSeekRef.current = null;
    setCurrentTime(0);
    drawRef.current();
  }, []);

  useImperativeHandle(apiRef, () => ({ play, pause, stop, seek }), [play, pause, stop, seek]);

  const cycleRate = () => {
    if (rates.length === 0) return;
    const next = (rateIndex + 1) % rates.length;
    setRateIndex(next);
    onRateChange?.(rates[next] ?? 1);
  };

  // --- Seek slider (Timeline's pointer-capture scrub) ------------------------

  const fractionFromClientX = (clientX: number): number | null => {
    const el = wavePlotRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  // Push the pending scrub target into the element (rapid per-move seeks can
  // stutter some codecs, so moves batch to one seek per frame via commitSeek).
  // The pending value survives the write: it keeps driving the drawn playhead
  // until the scrub ends, so the wave never snaps back mid-drag.
  const applyPendingSeek = () => {
    const target = pendingSeekRef.current;
    const audio = audioRef.current;
    if (target == null || !audio) return;
    audio.currentTime = target;
    setCurrentTime(target);
  };

  // Seeks commit live but at most once per frame: the pending fraction drives
  // the drawn playhead immediately, the element follows on the next rAF.
  const commitSeek = (fraction: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    pendingSeekRef.current = fraction * el.duration;
    drawRef.current();
    if (seekRafRef.current != null) return;
    seekRafRef.current = requestAnimationFrame(() => {
      seekRafRef.current = null;
      applyPendingSeek();
    });
  };

  const seekable = !disabled && effectiveVis === "waveform" && Number.isFinite(duration);

  const handleSeekPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!seekable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    const fraction = fractionFromClientX(e.clientX);
    if (fraction != null) commitSeek(fraction);
  };
  const handleSeekPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const fraction = fractionFromClientX(e.clientX);
    if (fraction == null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      if (seekable) commitSeek(fraction);
      return;
    }
    hoverFractionRef.current = seekable ? fraction : null;
    drawRef.current();
  };
  const handleSeekPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    setScrubbing(false);
    // Land the final position now — a quick click's rAF may not have fired yet.
    applyPendingSeek();
    pendingSeekRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const handleSeekPointerLeave = () => {
    hoverFractionRef.current = null;
    drawRef.current();
  };

  const handleSeekKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const el = audioRef.current;
    if (!el) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        seek(el.currentTime - SEEK_STEP);
        break;
      case "ArrowRight":
        e.preventDefault();
        seek(el.currentTime + SEEK_STEP);
        break;
      case "Home":
        e.preventDefault();
        seek(0);
        break;
      case "End":
        e.preventDefault();
        if (Number.isFinite(el.duration)) seek(el.duration);
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        if (playing) pause();
        else play();
        break;
    }
  };

  // --- Render ----------------------------------------------------------------

  const rootStyle = { ...style, "--audio-accent": color } as CSSProperties;
  const buttonSize = size === "lg" ? "md" : "sm";
  // The deck's control bar wants raised, chunky buttons; the inline strip
  // stays quiet with ghosts.
  const transportVariant = layout === "panel" ? "secondary" : "ghost";
  // Widest rate label in ch (mono, so ch is exact) + breathing room for the
  // button's own padding not covered by `tight`.
  const rateChars = rates.reduce((max, r) => Math.max(max, formatRate(r).length), 0) + 2;
  const timeText = formatTime(currentTime, duration);
  const totalText = formatTime(duration);

  return (
    // biome-ignore lint/a11y/useSemanticElements: "group" labelled by its aria-label fits a transport row; <fieldset> imposes form semantics (ButtonGroup's rationale)
    <div
      {...rest}
      ref={mergeRefs(ref, rootRef)}
      role="group"
      aria-label={ariaLabel}
      data-visualization={effectiveVis}
      data-layout={layout === "panel" ? "panel" : undefined}
      data-disabled={disabled || undefined}
      data-scrubbing={scrubbing || undefined}
      className={cx(styles.root, sizeClass[size], className)}
      style={rootStyle}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: the player is the audio UI; captions are the consumer's content concern */}
      <audio
        ref={audioRef}
        src={src}
        preload={preload}
        loop={loop}
        autoPlay={autoPlay}
        crossOrigin={crossOrigin}
        className={styles.audio}
        onPlay={() => {
          setPlaying(true);
          onPlay?.();
        }}
        onPause={() => {
          setPlaying(false);
          onPause?.();
        }}
        onEnded={() => onEnded?.()}
        onDurationChange={() => setDuration(audioRef.current?.duration ?? Number.NaN)}
        onTimeUpdate={() => {
          const el = audioRef.current;
          if (!el) return;
          setCurrentTime(el.currentTime);
          onTimeUpdate?.(el.currentTime, el.duration);
        }}
        onError={() => {
          const error = audioRef.current?.error;
          if (error) onError?.(error);
        }}
      />
      <Button
        variant={transportVariant}
        size={buttonSize}
        tight
        disabled={disabled}
        aria-label={playing ? "Pause" : "Play"}
        className={styles.playButton}
        onClick={() => (playing ? pause() : play())}
      >
        {playing ? <Glyph slot="pause" fallback={Pause} /> : <Glyph slot="play" fallback={Play} />}
      </Button>
      <Button
        variant={transportVariant}
        size={buttonSize}
        tight
        disabled={disabled}
        aria-label="Stop"
        className={styles.stopButton}
        onClick={stop}
      >
        <Glyph slot="stop" fallback={Stop} />
      </Button>
      <div ref={waveRef} className={styles.wave} data-elevation={elevation}>
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative wave canvas, no focusable content */}
        <canvas ref={canvasRef} aria-hidden="true" className={styles.canvas} />
        <div
          role="slider"
          aria-label="Seek"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={Number.isFinite(duration) ? Math.round(duration) : 0}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${timeText} of ${totalText}`}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          className={styles.seek}
          data-seekable={seekable || undefined}
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          onPointerLeave={handleSeekPointerLeave}
          onKeyDown={handleSeekKeyDown}
        />
      </div>
      <span className={styles.time}>
        {timeText}
        <span className={styles.timeSeparator}> / </span>
        {totalText}
      </span>
      {rates.length > 0 && (
        // Secondary, not ghost: a bare mono label reads as a readout, not a
        // control. Width is reserved for the longest label in `rates`, so
        // cycling 1× → 1.25× never shifts the row.
        <Button
          variant="secondary"
          size={buttonSize}
          tight
          disabled={disabled}
          aria-label={`Playback rate: ${formatRate(rate)}`}
          className={styles.rate}
          style={{ minInlineSize: `${rateChars}ch` }}
          onClick={cycleRate}
        >
          {formatRate(rate)}
        </Button>
      )}
    </div>
  );
});
