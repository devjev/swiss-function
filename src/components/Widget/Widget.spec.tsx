import { expect, test } from "@playwright/experimental-ct-react";
import { Widget } from "./Widget";
import { ParamsDemo } from "./Widget.harness";

test("one param edits inline in the header and reports the full values map", async ({
  mount,
  page,
}) => {
  const c = await mount(<ParamsDemo count={1} />);
  await expect(c.getByTestId("values")).toHaveText("ccy=CHF");
  // No settings key: the one param is inline.
  await expect(c.getByRole("button", { name: "Parameters" })).toHaveCount(0);
  await c.getByRole("combobox").click();
  await page.getByRole("option", { name: "USD" }).click();
  await expect(c.getByTestId("values")).toHaveText("ccy=USD");
  await expect(c.getByTestId("changed")).toHaveText("ccy");
});

test("two params still edit inline; a third folds them all behind the settings key", async ({
  mount,
}) => {
  const two = await mount(<ParamsDemo count={2} />);
  await expect(two.getByRole("combobox")).toHaveCount(1);
  await expect(two.getByRole("textbox", { name: "Note" })).toBeVisible();
  await expect(two.getByRole("button", { name: "Parameters" })).toHaveCount(0);
  await two.unmount();
  const three = await mount(<ParamsDemo count={3} />);
  await expect(three.getByRole("combobox")).toHaveCount(0);
  await expect(three.getByRole("button", { name: "Parameters" })).toBeVisible();
  // The header summarises the values.
  await expect(three.locator("[data-summary]")).toHaveText("CHF \u00b7 on");
});

test("the settings dialog is a table of the params, applied at once, or cancelled", async ({
  mount,
  page,
}) => {
  const c = await mount(<ParamsDemo count={4} />);
  await c.getByRole("button", { name: "Parameters" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("rowheader")).toHaveText([
    "Currency",
    "Note",
    "Net of fees",
    "Limit",
  ]);
  await dialog.getByRole("textbox", { name: "Note" }).fill("hello");
  await dialog.getByRole("switch").click();
  // Nothing reported until Apply.
  await expect(c.getByTestId("changed")).toHaveText("");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toBeHidden();
  await expect(c.getByTestId("values")).toHaveText("ccy=CHF;note=hello;net=off;limit=5 %");
  await expect(c.getByTestId("changed")).toHaveText("note,net");
  // Cancel discards a draft.
  await c.getByRole("button", { name: "Parameters" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Note" }).fill("discarded");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(c.getByTestId("values")).toHaveText("ccy=CHF;note=hello;net=off;limit=5 %");
});

test("inlineParams raises the inline threshold", async ({ mount }) => {
  const c = await mount(<ParamsDemo count={3} inlineParams={3} />);
  await expect(c.getByRole("button", { name: "Parameters" })).toHaveCount(0);
  await expect(c.getByRole("switch")).toBeVisible();
});

test("loading runs a bar under the header; error replaces the body", async ({ mount }) => {
  const c = await mount(
    <div style={{ inlineSize: 320, display: "grid", gap: 8 }}>
      <Widget title="Loading" loading>
        <span>body</span>
      </Widget>
      <Widget title="Failed" error="Query timed out">
        <span>hidden body</span>
      </Widget>
    </div>,
  );
  await expect(c.getByRole("progressbar", { name: "Loading" })).toBeVisible();
  await expect(c.getByRole("alert")).toHaveText("Query timed out");
  await expect(c.getByText("hidden body")).toHaveCount(0);
  await expect(c.getByText("body")).toBeVisible();
});
