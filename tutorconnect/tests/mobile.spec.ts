import { test, expect } from "@playwright/test";

test("mobile layout does not overflow horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Learn from someone who understands/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ask AI|Open student assistant/ })).toHaveCount(0);
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
