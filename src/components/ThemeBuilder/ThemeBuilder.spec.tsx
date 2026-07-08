import { expect, test } from "@playwright/experimental-ct-react";
import { ThemeBuilder } from "./ThemeBuilder";

test("editing a colour writes it into the generated CSS", async ({ mount }) => {
  const el = await mount(<ThemeBuilder />);
  await el.getByLabel("Foreground", { exact: true }).fill("#123456");
  const output = el.getByLabel("Generated css");
  await expect(output).toContainText("--sf-color-fg: #123456;");
  await expect(output).toContainText(":root {");
});

test("dark-theme edits export under a [data-theme=dark] block", async ({ mount }) => {
  const el = await mount(<ThemeBuilder />);
  await el.getByRole("button", { name: "Dark" }).click();
  await el.getByLabel("Primary", { exact: true }).fill("#abcdef");
  const output = el.getByLabel("Generated css");
  await expect(output).toContainText('[data-theme="dark"] {');
  await expect(output).toContainText("--sf-color-primary: #abcdef;");
});

test("a theme-agnostic token exports to :root regardless of theme", async ({ mount }) => {
  const el = await mount(<ThemeBuilder defaultTheme="dark" />);
  // Agnostic tokens carry a "(all themes)" note in their label.
  await el.getByLabel("Base unit (all themes)").fill("2rem");
  const output = el.getByLabel("Generated css");
  await expect(output).toContainText(":root {");
  await expect(output).toContainText("--sf-unit: 2rem;");
  await expect(output).not.toContainText('[data-theme="dark"]');
});

test("JSON format and reset", async ({ mount }) => {
  const el = await mount(<ThemeBuilder />);
  await el.getByLabel("Foreground", { exact: true }).fill("#111111");
  await el.getByRole("button", { name: "JSON" }).click();
  await expect(el.getByLabel("Generated json")).toContainText('"--sf-color-fg": "#111111"');

  await el.getByRole("button", { name: "Reset" }).click();
  await expect(el.getByRole("button", { name: "Reset" })).toBeDisabled();
});
