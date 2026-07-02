// Chat: keystroke→paint with a 200-message markdown transcript mounted;
// send→message-appears; p95 frame during a scripted 40-chunk stream.
import { measureInteraction, p95, startFrameSampler, stopFrameSampler } from "../runner.mjs";

export const scenarios = [
  {
    name: "chat-transcript-200",
    story: "perf--chat--perf-transcript",
    ready: "[data-perf-ready]",
    async run({ page, frame }) {
      const metrics = {};
      const input = frame.getByRole("textbox").first();
      await input.click();

      // Keystroke → paint. With 200 markdown messages mounted this is the
      // "does typing re-parse the transcript" metric.
      metrics.keystrokeMs = await measureInteraction(frame, () => page.keyboard.type("x"));

      // Send → user message appears.
      metrics.sendMs = await measureInteraction(frame, () => page.keyboard.press("Enter"));
      await page.waitForTimeout(100);

      // Streaming: click the story's stream trigger and sample ~3.5s of frames
      // (40 chunks × 80ms).
      const stream = await frame.$("[data-perf-stream]");
      if (stream) {
        await startFrameSampler(frame);
        await stream.click();
        await page.waitForTimeout(3500);
        const deltas = await stopFrameSampler(frame);
        metrics.p95StreamFrameMs = p95(deltas);
      }
      return metrics;
    },
  },
];
