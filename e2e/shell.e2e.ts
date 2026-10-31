import { expect, test } from "@playwright/test";

// UI check 4 and 5: usable at both widths, screenshots for the review report.
for (const width of [1280, 375]) {
  test(`kitchen sink renders at ${width}px without horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/kitchen-sink");
    await expect(page.getByRole("heading", { name: "Kitchen sink" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/kitchen-sink-${width}.png`, fullPage: true });
  });
}

test("dialog opens and closes", async ({ page }) => {
  await page.goto("/kitchen-sink");
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
