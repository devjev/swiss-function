import { expect, test } from "@playwright/experimental-ct-react";
import { AudioPlayerHarness } from "./AudioPlayer.harness";

// CT clicks are trusted user gestures, so real playback (and the autoplay
// policy) behaves as in production. Assertions favour element state over
// wall-clock progression to stay robust in headless environments.

test("renders the transport, readout, seek slider, and rate button", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness />);
  await expect(c.getByRole("group", { name: "Audio player" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(c.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await expect(c.getByRole("slider", { name: "Seek" })).toBeVisible();
  await expect(c.getByRole("button", { name: /Playback rate/ })).toHaveText("1×");
  await expect(c.getByText("0:00", { exact: false }).first()).toBeVisible();
});

test("waveform mode decodes and draws onto a sized canvas", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness />);
  const group = c.getByRole("group", { name: "Audio player" });
  await expect(group).toHaveAttribute("data-visualization", "waveform");
  const canvas = c.locator("canvas");
  await expect(canvas).toBeAttached();
  await expect
    .poll(async () => canvas.evaluate((el: HTMLCanvasElement) => el.width))
    .toBeGreaterThan(0);
});

test("play fires onPlay, advances time, and toggles to a pause button", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness />);
  await c.getByRole("button", { name: "Play", exact: true }).click();
  const mirror = c.getByTestId("mirror");
  await expect(mirror).toHaveAttribute("data-plays", "1");
  await expect(c.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect
    .poll(async () => Number(await mirror.getAttribute("data-last-time")))
    .toBeGreaterThan(0);
  await c.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(mirror).toHaveAttribute("data-pauses", "1");
  await expect(c.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

test("stop pauses, rewinds to 0:00, and restores the play button", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness />);
  await c.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () => Number(await c.getByTestId("mirror").getAttribute("data-last-time")))
    .toBeGreaterThan(0);
  await c.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(c.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(c.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "0");
});

test("the rate button cycles through rates and reports each change", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness rates={[1, 1.25, 2]} />);
  const rate = c.getByRole("button", { name: /Playback rate/ });
  const mirror = c.getByTestId("mirror");
  const before = (await rate.boundingBox())?.width;
  await rate.click();
  await expect(rate).toHaveText("1.25×");
  await expect(mirror).toHaveAttribute("data-last-rate", "1.25");
  // Width is reserved for the longest label: cycling must not shift the row.
  expect((await rate.boundingBox())?.width).toBe(before);
  await rate.click();
  await expect(rate).toHaveText("2×");
  await rate.click();
  await expect(rate).toHaveText("1×");
});

test("rates=[] hides the rate control", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness rates={[]} />);
  await expect(c.getByRole("button", { name: /Playback rate/ })).toHaveCount(0);
});

test("the seek slider carries the ARIA slider contract", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness />);
  const slider = c.getByRole("slider", { name: "Seek" });
  await expect(slider).toHaveAttribute("aria-valuemax", "12");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  await expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 0:12");
});

test("keyboard on the seek slider: arrows step 5s, Home/End jump, Space toggles", async ({
  mount,
}) => {
  const c = await mount(<AudioPlayerHarness />);
  const slider = c.getByRole("slider", { name: "Seek" });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "5");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "10");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "12"); // clamped to duration
  await slider.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuenow", "7");
  await slider.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "12");
  await slider.press("Home");
  await slider.press(" ");
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-plays", "1");
  await slider.press(" ");
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-pauses", "1");
});

test("pointer seek on the waveform lands proportionally", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness />);
  const slider = c.getByRole("slider", { name: "Seek" });
  await expect(slider).toHaveAttribute("aria-valuemax", "12");
  const box = await slider.boundingBox();
  if (!box) throw new Error("no slider box");
  await slider.click({ position: { x: box.width * 0.5, y: box.height / 2 } });
  const now = Number(await slider.getAttribute("aria-valuenow"));
  expect(Math.abs(now - 6)).toBeLessThanOrEqual(1);
});

test("an undecodable source falls back to bars", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness src="data:audio/wav;base64,bm90LWF1ZGlv" />);
  const group = c.getByRole("group", { name: "Audio player" });
  await expect(group).toHaveAttribute("data-visualization", "bars");
});

test("visualization='bars' skips decoding and marks the mode", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness visualization="bars" />);
  await expect(c.getByRole("group", { name: "Audio player" })).toHaveAttribute(
    "data-visualization",
    "bars",
  );
});

test("disabled disables the transport and removes the slider from the tab order", async ({
  mount,
}) => {
  const c = await mount(<AudioPlayerHarness disabled />);
  await expect(c.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await expect(c.getByRole("button", { name: "Stop", exact: true })).toBeDisabled();
  const slider = c.getByRole("slider", { name: "Seek" });
  await expect(slider).toHaveAttribute("aria-disabled", "true");
  await expect(slider).toHaveAttribute("tabindex", "-1");
});

test("layout='panel' re-grids the same parts into the deck", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness layout="panel" />);
  const group = c.getByRole("group", { name: "Audio player" });
  await expect(group).toHaveAttribute("data-layout", "panel");
  await expect(c.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(c.getByRole("slider", { name: "Seek" })).toBeVisible();
  // The wave display sits above the transport in the deck.
  const waveBox = await c.locator("canvas").boundingBox();
  const playBox = await c.getByRole("button", { name: "Play", exact: true }).boundingBox();
  if (!waveBox || !playBox) throw new Error("missing boxes");
  expect(waveBox.y + waveBox.height).toBeLessThanOrEqual(playBox.y + 1);
});

test("playbackRate is applied to the element", async ({ mount }) => {
  const c = await mount(<AudioPlayerHarness rates={[2]} />);
  const audioRate = await c.locator("audio").evaluate((el: HTMLAudioElement) => el.playbackRate);
  expect(audioRate).toBe(2);
});
