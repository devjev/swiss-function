import { useState } from "react";
import { AudioPlayer, type AudioPlayerProps } from "./AudioPlayer";
import { makeWavDataUri } from "./AudioPlayer.fixtures";

/**
 * CT mount wrapper. Function props can't cross the Playwright CT boundary, so
 * the harness owns the callbacks and mirrors every firing into `data-*`
 * attributes on a probe element the spec can read. The default source is a
 * generated in-browser WAV (deterministic, no asset); `wavSeconds` sizes it.
 */
export function AudioPlayerHarness({
  width = 480,
  wavSeconds = 12,
  src,
  ...props
}: Partial<AudioPlayerProps> & { width?: number; wavSeconds?: number }) {
  const [wav] = useState(() => src ?? makeWavDataUri(wavSeconds, 8000));
  const [plays, setPlays] = useState(0);
  const [pauses, setPauses] = useState(0);
  const [endeds, setEndeds] = useState(0);
  const [errors, setErrors] = useState(0);
  const [lastRate, setLastRate] = useState("");
  const [lastTime, setLastTime] = useState("");

  return (
    <div style={{ inlineSize: width }}>
      <AudioPlayer
        {...props}
        src={wav}
        onPlay={() => setPlays((n) => n + 1)}
        onPause={() => setPauses((n) => n + 1)}
        onEnded={() => setEndeds((n) => n + 1)}
        onError={() => setErrors((n) => n + 1)}
        onRateChange={(rate) => setLastRate(String(rate))}
        onTimeUpdate={(t) => setLastTime(t.toFixed(2))}
      />
      <div
        data-testid="mirror"
        data-plays={plays}
        data-pauses={pauses}
        data-endeds={endeds}
        data-errors={errors}
        data-last-rate={lastRate}
        data-last-time={lastTime}
      />
    </div>
  );
}
