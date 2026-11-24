import { test, expect } from "@playwright/test";

test("catalogue loads programmes or provides an actionable official fallback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "UCC programmes" }).click();

  await expect(page.getByRole("heading", { name: "Explore UCC programmes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Official UCC catalogue", exact: true })).toHaveAttribute("href", "https://admissions.ucc.edu.gh/catalogue");
  await expect(page.getByText("These are admissions programmes", { exact: false })).toBeVisible();

  const retry = page.getByRole("button", { name: "Try again" });
  const catalogueContent = page.getByText(/Showing \d+ of \d+ programmes|No programme records available|Could not load UCC programmes/);
  await expect(catalogueContent.first()).toBeVisible();
  if (await retry.isVisible()) await expect(retry).toBeEnabled();
});
