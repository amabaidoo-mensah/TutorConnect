import { test, expect } from "@playwright/test";

test("keyboard navigation exposes a skip link and theme control", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();

  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  await expect(page.getByText("Connect a Supabase project to enable sign-in", { exact: false })).toHaveCount(0);
  await expect(page.getByText("The admin dashboard is available only", { exact: false })).toHaveCount(0);
});
