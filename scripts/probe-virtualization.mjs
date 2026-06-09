import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:61001/?story=prose--stress", { waitUntil: "networkidle" });

const totalHeight = await page.evaluate(() => {
  const scrollers = Array.from(document.querySelectorAll("div"))
    .filter((el) => getComputedStyle(el).overflowY === "auto")
    .filter((el) => el.scrollHeight > el.clientHeight);
  return scrollers.length > 0 ? scrollers[scrollers.length - 1].scrollHeight : 0;
});

const countAt = async (pct) => {
  await page.evaluate((p) => {
    const scrollers = Array.from(document.querySelectorAll("div"))
      .filter((el) => getComputedStyle(el).overflowY === "auto")
      .filter((el) => el.scrollHeight > el.clientHeight);
    if (scrollers.length > 0) {
      const s = scrollers[scrollers.length - 1];
      s.scrollTop = s.scrollHeight * p;
    }
  }, pct);
  await page.waitForTimeout(400);
  return page.locator("[data-block-id]").count();
};

console.log("total scrollHeight:", totalHeight, "px");
console.log("blocks @ top:", await countAt(0));
console.log("blocks @ 25%:", await countAt(0.25));
console.log("blocks @ 50%:", await countAt(0.5));
console.log("blocks @ 75%:", await countAt(0.75));
console.log("blocks @ 95%:", await countAt(0.95));

await browser.close();
