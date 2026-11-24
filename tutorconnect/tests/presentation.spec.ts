import { test, expect } from "@playwright/test";

test("presentation mode shows fictional tutor cards without payment actions and still allows real signup", async ({ page }) => {
  await page.goto("/?demo=1");

  await expect(page.getByRole("heading", { name: "Explore sample tutor profiles" })).toBeVisible();
  await expect(page.getByText("Fictional demo profile · no charges").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Contact unlock disabled in demo" })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Create a real account" })).toBeVisible();

  await page.getByLabel("Course code or title").fill("CS101");
  await page.getByRole("button", { name: "Search tutors" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 fictional demo profile shown" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo Tutor Ama" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo Tutor Kofi" })).not.toBeVisible();

  await page.getByRole("button", { name: "Create a real account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to presentation demo" })).toBeVisible();
});

test("presentation course and programme pages use clearly identified sample content", async ({ page }) => {
  await page.goto("/?demo=1");

  await page.getByRole("button", { name: "Courses & resources" }).click();
  await expect(page.getByRole("heading", { name: "Courses & learning resources" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Linear Algebra I (demo course)" })).toBeVisible();
  await expect(page.getByText(/not an official university catalogue/i)).toBeVisible();

  await page.getByRole("button", { name: "UCC programmes" }).click();
  await expect(page.getByRole("heading", { name: "Example UCC programmes" })).toBeVisible();
  await expect(page.getByText("Example BSc Computer Science")).toBeVisible();
  await expect(page.getByText("Example only").first()).toBeVisible();
});
