import { expect, test } from "@playwright/test";

test("list pattern pages, filters, searches and sorts through the URL", async ({ page }) => {
  await page.goto("/kitchen-sink/list");
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await expect(page.getByText("findings 1–20 of 57")).toBeVisible();

  await page.getByRole("link", { name: "next ›" }).click();
  await expect(page.getByText("findings 21–40 of 57")).toBeVisible();

  await page.getByRole("link", { name: /^contradicts \d+$/ }).click();
  await expect(page).toHaveURL(/filter=contradicts/);
  await expect(page).not.toHaveURL(/page=/);
  for (const cell of await page.locator("tbody tr td:nth-child(4)").allInnerTexts()) expect(cell).toContain("contradicts");

  await page.getByRole("searchbox", { name: "Search" }).fill("MFA");
  await page.getByRole("button", { name: "search" }).click();
  for (const cell of await page.locator("tbody tr td:nth-child(3)").allInnerTexts()) expect(cell).toContain("MFA");

  await page.goto("/kitchen-sink/list?sort=confidence&dir=desc");
  await expect(page.getByRole("columnheader", { name: /Confidence/ })).toHaveAttribute("aria-sort", "descending");
  await expect(page.locator("tbody tr")).toHaveCount(20);
  const conf = (await page.locator("tbody tr td:nth-child(5)").allInnerTexts()).map(Number.parseFloat);
  expect(conf).toEqual([...conf].sort((a, b) => b - a));
});

test("keyboard moves, selects and clears rows", async ({ page }) => {
  await page.goto("/kitchen-sink/list");
  await page.locator("tbody tr").first().locator("td").nth(2).click();
  await expect(page.locator("tbody tr").first()).toHaveAttribute("data-focused");
  await page.keyboard.press("j");
  await expect(page.locator("tbody tr").nth(1)).toHaveAttribute("data-focused");
  await page.keyboard.press("x");
  await expect(page.getByRole("toolbar", { name: "Bulk actions" })).toContainText("1 selected");
  await page.getByRole("checkbox", { name: "Select all on this page" }).click();
  await expect(page.getByRole("toolbar", { name: "Bulk actions" })).toContainText("20 selected");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("toolbar", { name: "Bulk actions" })).toBeHidden();
});

test("list pattern fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/kitchen-sink/list");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
