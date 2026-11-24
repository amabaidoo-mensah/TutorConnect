import { test, expect } from "@playwright/test";

test("mobile layout does not overflow horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Learn from someone who understands/ })).toBeVisible();
  const assistantButton = page.getByRole("button", { name: "Open student assistant" });
  await expect(assistantButton).toBeVisible();
  expect(await assistantButton.evaluate((element) => getComputedStyle(element).bottom)).toBe("78px");
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
