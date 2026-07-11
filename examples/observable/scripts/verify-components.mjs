// Spike #52: drive the built components page in a real browser.
// Requires the site served (python3 -m http.server 8123 --directory dist)
// and Playwright + browsers from the repo root dev shell.
import {chromium} from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8123/components.html";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

await page.goto(url, {waitUntil: "networkidle"});

// Hooks: the click counter must increment.
const counter = page.getByRole("button", {name: /Clicked \d+ times/});
await counter.waitFor({timeout: 10_000});
await counter.click();
await counter.click();
const counterText = await counter.textContent();

// Portal: the DatePicker popup must open.
const dateInput = page.locator("input").nth(1);
await dateInput.click();
await page.waitForTimeout(400);
const popupVisible = await page
  .locator("[role=dialog], [data-sf-datepicker-popup], [role=grid]")
  .first()
  .isVisible()
  .catch(() => false);

// Ambient block: Framework's own React version.
const ambient = await page.locator("[data-testid=ambient-react]").textContent().catch(() => "MISSING");

// Styles: the primary button must have the sf primary background, not default.
const buttonBg = await counter.evaluate((el) => getComputedStyle(el).backgroundColor);
const sfPrimary = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--sf-color-primary").trim()
);

await page.screenshot({path: "screenshots/components.png", fullPage: true});
await browser.close();

console.log(JSON.stringify({counterText, popupVisible, ambient, buttonBg, sfPrimary, errors}, null, 2));
