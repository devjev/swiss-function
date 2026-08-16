import type { Story } from "@ladle/react";
import { useRef } from "react";
import { Button } from "../Button";
import { AudioPlayer, type AudioPlayerApi, type AudioPlayerProps } from "./AudioPlayer";
import { makeWavDataUri } from "./AudioPlayer.fixtures";

// Generated once per module load: a deterministic in-memory WAV, so the
// stories need no audio asset and the drawn waveform is stable run to run.
const WAV = makeWavDataUri(8);

const column: React.CSSProperties = {
  display: "grid",
  gap: "var(--sf-unit)",
  maxWidth: "36rem",
};

export const Playground: Story<AudioPlayerProps> = (args) => <AudioPlayer {...args} />;
Playground.args = {
  src: WAV,
  visualization: "waveform",
  layout: "inline",
  size: "md",
  disabled: false,
  loop: false,
};
Playground.argTypes = {
  visualization: { options: ["waveform", "bars"], control: { type: "radio" } },
  layout: { options: ["inline", "panel"], control: { type: "radio" } },
  size: { options: ["sm", "md", "lg"], control: { type: "radio" } },
  disabled: { control: { type: "boolean" } },
  loop: { control: { type: "boolean" } },
};

export const Waveform: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} />
  </div>
);

// Live analyser bars: the mode for streams and very long files, where decoding
// the whole track for a waveform is off the table. The bars move only while
// playing; paused they hold the last frame.
export const Bars: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} visualization="bars" />
  </div>
);

// The deck reading: a taller wave display stacked over a control bar of
// raised buttons in one bordered chassis (the Windows 95 Sound Recorder
// posture, restated in tokens).
export const Panel: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} layout="panel" />
  </div>
);

export const PanelBars: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} layout="panel" visualization="bars" />
  </div>
);

export const PanelSizes: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} layout="panel" size="sm" />
    <AudioPlayer src={WAV} layout="panel" size="md" />
    <AudioPlayer src={WAV} layout="panel" size="lg" />
  </div>
);

export const Sizes: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} size="sm" />
    <AudioPlayer src={WAV} size="md" />
    <AudioPlayer src={WAV} size="lg" />
  </div>
);

export const Elevation: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} elevation={1} />
    <AudioPlayer src={WAV} elevation={3} />
  </div>
);

// An explicit colour overrides the primary accent, for a player that must
// match a data-series or brand colour.
export const CustomColor: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} color="var(--sf-color-success)" />
    <AudioPlayer src={WAV} color="#7c3aed" />
  </div>
);

export const NoRates: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} rates={[]} />
  </div>
);

export const Disabled: Story = () => (
  <div style={column}>
    <AudioPlayer src={WAV} disabled />
  </div>
);

// An undecodable source (garbage bytes here; a stream or a no-CORS cross-origin
// file in practice): the waveform request fails and the player falls back to
// bars on its own.
export const FallbackToBars: Story = () => (
  <div style={column}>
    <AudioPlayer src="data:audio/wav;base64,bm90LWF1ZGlv" />
  </div>
);

// The imperative surface: an external control pausing/steering the player, the
// escape hatch that replaces a controlled `playing` prop.
export const ImperativeApi: Story = () => {
  const api = useRef<AudioPlayerApi | null>(null);
  return (
    <div style={column}>
      <AudioPlayer src={WAV} apiRef={api} />
      <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 2)" }}>
        <Button size="sm" variant="secondary" onClick={() => api.current?.play()}>
          Play
        </Button>
        <Button size="sm" variant="secondary" onClick={() => api.current?.pause()}>
          Pause
        </Button>
        <Button size="sm" variant="secondary" onClick={() => api.current?.seek(6)}>
          Seek to 0:06
        </Button>
      </div>
    </div>
  );
};
