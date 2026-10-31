import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = process.env.SCREENSHOT_DIR;
const sample = (f: string) => path.join(process.cwd(), "sample", f);

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("failure path: a non-CSV questionnaire shows an error and creates nothing", async ({ page }) => {
  const auditRows = async () => {
    await page.goto("/audit");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    return page.locator("tbody tr").count();
  };
  const before = await auditRows();
  await page.goto("/assessments/new");
  await page.getByLabel("Supplier domain").fill("badupload.example");
  await page.getByLabel("Questionnaire (CSV)").setInputFiles({ name: "q.csv", mimeType: "text/csv", buffer: Buffer.from("this is not,a questionnaire\n") });
  await page.getByLabel("SOC 2 report (PDF)").setInputFiles({ name: "r.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") });
  await page.getByRole("button", { name: /start assessment/ }).click();
  await expect(page.getByText("Could not start the assessment")).toBeVisible();
  await expect(page).toHaveURL(/\/assessments\/new$/);
  expect(await auditRows()).toBe(before);
});

test("central journey: register to recorded decision", async ({ page }) => {
  test.setTimeout(180_000);

  // Register
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Supplier register" })).toBeVisible();
  expect(await page.locator("tbody tr").count()).toBeGreaterThanOrEqual(5);

  // New assessment
  await page.getByRole("button", { name: "new assessment" }).click();
  await expect(page.getByRole("heading", { name: "New assessment" })).toBeVisible();
  await page.getByLabel("Supplier domain").fill("tallyfern.co.uk");
  await page.getByLabel("Supplier name (optional)").fill("Tallyfern Ltd");
  await page.getByLabel("Questionnaire (CSV)").setInputFiles(sample("tallyfern-questionnaire.csv"));
  await page.getByLabel("SOC 2 report (PDF)").setInputFiles(sample("tallyfern-soc2.pdf"));
  await page.getByRole("button", { name: /start assessment/ }).click();
  await expect(page).toHaveURL(/\/assessments\/\d+$/, { timeout: 60_000 });
  const assessmentUrl = page.url();

  // Eight live checks
  const checksPanel = page.locator("section, div").filter({ hasText: /^Live checks/ }).last();
  for (const kind of ["dmarc", "spf", "tls", "hsts", "csp", "security_txt", "hibp", "kev"]) {
    await expect(page.getByText(kind, { exact: true }).first()).toBeVisible();
  }
  void checksPanel;

  // Review produces findings
  await expect(page.getByText(/\d+ contradictions, \d+ unsupported, \d+ need review/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: /^contradicts/ })).toBeVisible();

  // Filter to contradictions, select all on the page, bulk accept
  await page.getByRole("link", { name: /^contradicts/ }).click();
  await expect(page).toHaveURL(/filter=contradicts/);
  await page.getByRole("checkbox", { name: "Select all on this page" }).check();
  await page.getByRole("button", { name: "accept", exact: true }).click();
  await expect(page.getByText(/findings? accepted/).first()).toBeVisible();

  // Recommendation appears
  await expect(page.getByText(/Recommended:/)).toBeVisible({ timeout: 30_000 });

  // Draft follow-up, approve
  await page.getByRole("button", { name: "draft follow-up" }).click();
  const draft = page.getByRole("textbox", { name: "Follow-up email" });
  await expect(draft).not.toHaveValue("", { timeout: 60_000 });
  await expect(page.getByText(/written by /)).toBeVisible();
  await page.getByRole("button", { name: "approve", exact: true }).click();
  await expect(page.getByText(/not sent/)).toBeVisible();

  // Decision requires a reason
  await page.getByRole("combobox", { name: "Decision" }).click();
  await page.getByRole("option", { name: "reject" }).click();
  await page.getByRole("button", { name: "record decision" }).click();
  await expect(page.getByText("A reason is required.")).toBeVisible();
  await page.getByLabel("Reason (required)").fill("Controls were misrepresented in the questionnaire.");
  await page.getByRole("button", { name: "record decision" }).click();
  await expect(page.getByText(/Recorded/)).toBeVisible();

  // Register reflects it
  await page.goto("/");
  const row = page.getByRole("row").filter({ hasText: "tallyfern.co.uk" });
  await expect(row).toContainText(/rejected/i);

  // Audit log lists the actions
  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  const log = page.locator("tbody");
  await expect(log).toContainText("tallyfern.co.uk".slice(0, 0) + "Tallyfern");
  expect(await log.locator("tr").count()).toBeGreaterThanOrEqual(4);

  // Screenshots at both widths and themes, with the no-horizontal-scroll check
  const vendorHref = await (async () => {
    await page.goto("/");
    return page.getByRole("link", { name: "Tallyfern Ltd" }).first().getAttribute("href");
  })();
  const pages = [
    ["register", "/"],
    ["new-assessment", "/assessments/new"],
    ["assessment", new URL(assessmentUrl).pathname],
    ["vendor", vendorHref ?? "/"],
    ["audit", "/audit"],
  ] as const;
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  for (const width of [1280, 375]) {
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, href] of pages) {
        await page.goto(href);
        await setTheme(page, theme);
        await page.waitForLoadState("networkidle");
        await noHorizontalScroll(page);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-${width}-${theme}.png`), fullPage: true });
      }
    }
  }
});
