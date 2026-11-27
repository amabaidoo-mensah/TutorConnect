import { test, expect } from "@playwright/test";

test("demo query parameters do not expose fictional accounts or payment flows", async ({ page }) => {
  await page.goto("/?demo=1&role=tutor");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator(".brand .brand-mark")).toHaveAttribute("src", "/tutorconnect-mark.svg");
  await expect(page.getByRole("link", { name: "Presentation demo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Courses & resources" })).toHaveCount(0);
  await expect(page.getByText(/presentation demo|fictional profile|simulated payment/i)).toHaveCount(0);
  await expect(page.locator(".tutor-card")).toHaveCount(0);
});

test("theme choice is available and persists across page reloads", async ({ page }) => {
  await page.goto("/");

  const themeToggle = page.getByRole("button", { name: "Switch to dark theme" });
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
