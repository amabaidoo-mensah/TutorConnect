import { test, expect } from "@playwright/test";

test("keyboard navigation exposes a skip link and visible main-page state", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();

  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.getByRole("button", { name: "Courses & resources" }).click();
  await expect(page.getByRole("button", { name: "Courses & resources" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#main-content")).toBeFocused();
});
