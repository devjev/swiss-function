import type { Story } from "@ladle/react";
import { useState } from "react";
import { Timeline } from "./Timeline";

const log = (_msg: string) => () => {};

export const MonthlyTicks: Story = () => (
  <div style={{ width: "min(50rem, 100%)" }}>
    <Timeline start={new Date("2026-01-01")} end={new Date("2026-12-31")}>
      <Timeline.Event date={new Date("2026-02-12")} onClick={log("alpha")}>
        Alpha
      </Timeline.Event>
      <Timeline.Event date={new Date("2026-04-22")} onClick={log("beta")}>
        Beta
      </Timeline.Event>
      <Timeline.Event date={new Date("2026-06-04")} onClick={log("rc")}>
        RC
      </Timeline.Event>
      <Timeline.Event date={new Date("2026-09-30")} onClick={log("v1")}>
        v1.0
      </Timeline.Event>
      <Timeline.Event date={new Date("2026-12-15")} onClick={log("v1-1")}>
        v1.1
      </Timeline.Event>
    </Timeline>
  </div>
);

export const Compact: Story = () => {
  const [value, setValue] = useState<Date>(new Date("2026-05-01"));
  return (
    <div style={{ width: "min(50rem, 100%)" }}>
      <Timeline
        compact
        start={new Date("2026-01-01")}
        end={new Date("2026-12-31")}
        value={value}
        onChange={setValue}
      >
        <Timeline.Event date={new Date("2026-02-12")}>Alpha</Timeline.Event>
        <Timeline.Event date={new Date("2026-04-22")}>Beta</Timeline.Event>
        <Timeline.Event date={new Date("2026-06-04")}>RC</Timeline.Event>
        <Timeline.Event date={new Date("2026-09-30")}>v1.0</Timeline.Event>
      </Timeline>
      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
        Labels are hidden until you hover an event — or scrub the playhead near one.
      </p>
    </div>
  );
};

export const DailyTicks: Story = () => (
  <div style={{ width: "min(50rem, 100%)" }}>
    <Timeline start={new Date("2026-06-01")} end={new Date("2026-06-08")}>
      <Timeline.Event date={new Date("2026-06-01")}>Branch cut</Timeline.Event>
      <Timeline.Event date={new Date("2026-06-03")}>Merged #147</Timeline.Event>
      <Timeline.Event date={new Date("2026-06-04")}>Deploy v1.2.0</Timeline.Event>
      <Timeline.Event date={new Date("2026-06-06")}>Hotfix</Timeline.Event>
    </Timeline>
  </div>
);

export const HourlyTicks: Story = () => (
  <div style={{ width: "min(50rem, 100%)" }}>
    <Timeline start={new Date("2026-06-04T08:00:00")} end={new Date("2026-06-04T18:00:00")}>
      <Timeline.Event date={new Date("2026-06-04T09:30:00")}>Stand-up</Timeline.Event>
      <Timeline.Event date={new Date("2026-06-04T11:00:00")}>Review</Timeline.Event>
      <Timeline.Event date={new Date("2026-06-04T14:00:00")}>Pairing</Timeline.Event>
      <Timeline.Event date={new Date("2026-06-04T16:30:00")}>Demo</Timeline.Event>
    </Timeline>
  </div>
);

/**
 * When several events fall close together, labels would normally collide.
 * Greedy lane assignment stacks them into distinct vertical lanes — each new
 * label takes the lowest free lane and the container grows to fit.
 */
export const StackedLanes: Story = () => (
  <div style={{ width: "min(50rem, 100%)" }}>
    <Timeline start={new Date(2026, 5, 1)} end={new Date(2026, 5, 14)}>
      <Timeline.Event date={new Date(2026, 5, 2)}>Branch cut</Timeline.Event>
      <Timeline.Event date={new Date(2026, 5, 3)}>Merged #147 documentation</Timeline.Event>
      <Timeline.Event date={new Date(2026, 5, 4)}>Deploy v1.2.0 to staging</Timeline.Event>
      <Timeline.Event date={new Date(2026, 5, 5)}>Hotfix for crash on iOS 18</Timeline.Event>
      <Timeline.Event date={new Date(2026, 5, 7)}>Release notes published</Timeline.Event>
      <Timeline.Event date={new Date(2026, 5, 10)}>Post-mortem meeting</Timeline.Event>
    </Timeline>
  </div>
);

export const MultiYear: Story = () => (
  <div style={{ width: "min(50rem, 100%)" }}>
    <Timeline start={new Date("2020-01-01")} end={new Date("2026-12-31")}>
      <Timeline.Event date={new Date("2020-06-15")}>Project start</Timeline.Event>
      <Timeline.Event date={new Date("2022-03-01")}>v1.0</Timeline.Event>
      <Timeline.Event date={new Date("2024-09-20")}>Rewrite</Timeline.Event>
      <Timeline.Event date={new Date("2026-06-04")}>Today</Timeline.Event>
    </Timeline>
  </div>
);

/**
 * Video-timeline–style scrubber. Click anywhere on the track to set the
 * playhead; drag to scrub continuously. Event markers don't trigger the
 * scrub — their own onClick handler fires instead.
 */
export const Scrubbable: Story = () => {
  const start = new Date("2026-06-01");
  const end = new Date("2026-06-14");
  const [value, setValue] = useState<Date>(new Date("2026-06-04"));
  return (
    <div style={{ width: "min(50rem, 100%)" }}>
      <Timeline start={start} end={end} value={value} onChange={setValue}>
        <Timeline.Event date={new Date("2026-06-03")}>Merged #147</Timeline.Event>
        <Timeline.Event date={new Date("2026-06-06")}>Hotfix</Timeline.Event>
        <Timeline.Event date={new Date("2026-06-10")}>Post-mortem</Timeline.Event>
      </Timeline>
      <div
        style={{
          marginTop: "calc(var(--sf-unit) / 2)",
          fontFamily: "var(--sf-font-mono)",
          fontSize: "var(--sf-font-size-sm)",
          color: "var(--sf-color-fg)",
        }}
      >
        playhead: {value.toISOString()}
      </div>
    </div>
  );
};

/**
 * Range selection — two draggable handles with a band between them. Drag a
 * handle to move one bound, the band to pan the whole range, or click the track
 * to pull the nearest bound; arrow keys nudge a focused handle.
 */
export const RangeSelect: Story = () => {
  const [range, setRange] = useState<[Date, Date]>([
    new Date("2026-03-01"),
    new Date("2026-08-01"),
  ]);
  return (
    <div style={{ width: "min(50rem, 100%)" }}>
      <Timeline
        start={new Date("2026-01-01")}
        end={new Date("2026-12-31")}
        rangeValue={range}
        onRangeChange={setRange}
      >
        <Timeline.Event date={new Date("2026-04-22")}>Beta</Timeline.Event>
        <Timeline.Event date={new Date("2026-09-30")}>v1.0</Timeline.Event>
      </Timeline>
      <div
        style={{
          marginTop: "calc(var(--sf-unit) / 2)",
          fontFamily: "var(--sf-font-mono)",
          fontSize: "var(--sf-font-size-sm)",
        }}
      >
        {range[0].toISOString().slice(0, 10)} → {range[1].toISOString().slice(0, 10)}
      </div>
    </div>
  );
};

/**
 * Snap to events — the playhead jumps to the nearest event date as you scrub.
 */
export const SnapToEvents: Story = () => {
  const start = new Date("2026-06-01");
  const end = new Date("2026-06-14");
  const [value, setValue] = useState<Date>(new Date("2026-06-03"));
  return (
    <div style={{ width: "min(50rem, 100%)" }}>
      <Timeline start={start} end={end} value={value} onChange={setValue} snap="events">
        <Timeline.Event date={new Date("2026-06-03")}>Merged #147</Timeline.Event>
        <Timeline.Event date={new Date("2026-06-06")}>Hotfix</Timeline.Event>
        <Timeline.Event date={new Date("2026-06-10")}>Post-mortem</Timeline.Event>
      </Timeline>
      <div
        style={{
          marginTop: "calc(var(--sf-unit) / 2)",
          fontFamily: "var(--sf-font-mono)",
          fontSize: "var(--sf-font-size-sm)",
          color: "var(--sf-color-fg)",
        }}
      >
        playhead snaps to events: {value.toISOString()}
      </div>
    </div>
  );
};

/**
 * Snap to ticks — the playhead jumps to the nearest tick boundary (here daily).
 */
export const SnapToTicks: Story = () => {
  const start = new Date("2026-06-01");
  const end = new Date("2026-06-14");
  const [value, setValue] = useState<Date>(new Date("2026-06-04"));
  return (
    <div style={{ width: "min(50rem, 100%)" }}>
      <Timeline start={start} end={end} value={value} onChange={setValue} snap="ticks">
        <Timeline.Event date={new Date("2026-06-03")}>Merged #147</Timeline.Event>
        <Timeline.Event date={new Date("2026-06-06")}>Hotfix</Timeline.Event>
        <Timeline.Event date={new Date("2026-06-10")}>Post-mortem</Timeline.Event>
      </Timeline>
      <div
        style={{
          marginTop: "calc(var(--sf-unit) / 2)",
          fontFamily: "var(--sf-font-mono)",
          fontSize: "var(--sf-font-size-sm)",
          color: "var(--sf-color-fg)",
        }}
      >
        playhead snaps to day boundaries: {value.toISOString()}
      </div>
    </div>
  );
};
