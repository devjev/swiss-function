import { expect, test } from "@playwright/experimental-ct-react";
import { Button } from "./Button";

test("renders its label", async ({ mount }) => {
  const component = await mount(<Button>Save</Button>);
  await expect(component).toHaveText("Save");
});

test("fires click handler", async ({ mount }) => {
  let clicked = 0;
  const component = await mount(
    <Button
      onClick={() => {
        clicked += 1;
      }}
    >
      Save
    </Button>,
  );
  await component.click();
  expect(clicked).toBe(1);
});

test("respects disabled", async ({ mount }) => {
  const component = await mount(<Button disabled>Save</Button>);
  await expect(component).toBeDisabled();
  await expect(component).toHaveAttribute("data-disabled", "true");
});

test("applies variant class", async ({ mount }) => {
  const component = await mount(<Button variant="danger">Delete</Button>);
  const className = await component.getAttribute("class");
  expect(className).toMatch(/variantDanger/);
});
