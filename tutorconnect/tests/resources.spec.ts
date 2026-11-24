import { test, expect } from "@playwright/test";

test("course resource library shows source-labelled materials without tutor profiles", async ({ page }) => {
  await page.route("**/rest/v1/institutions*", (route) => route.fulfill({
    json: [{ id: 11, name: "University of Cape Coast" }],
  }));
  await page.route("**/rest/v1/courses*", (route) => route.fulfill({
    json: [{
      id: 42,
      institution_id: 11,
      code: "CS101",
      title: "Introduction to Computing",
      academic_unit_id: null,
      source_url: "https://example.edu/course-outline",
    }],
  }));
  await page.route("**/rest/v1/course_learning_resources*", (route) => route.fulfill({
    json: [{
      id: 7,
      course_id: 42,
      resource_type: "video",
      title: "Sample lecture",
      url: "https://www.youtube.com/watch?v=example",
      source_name: "Open learning provider",
      description: "Independent learning material.",
      license_name: null,
      license_url: null,
    }],
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Courses & resources" }).click();

  await expect(page.getByRole("heading", { name: "Courses & learning resources" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Introduction to Computing" })).toBeVisible();
  const resourceLink = page.getByRole("link", { name: /Sample lecture/ });
  await expect(resourceLink).toHaveAttribute("href", "https://www.youtube.com/watch?v=example");
  await expect(resourceLink).toHaveAttribute("rel", "noreferrer");
});

test("resource library does not show hard-coded examples when Supabase has no course resources", async ({ page }) => {
  await page.route("**/rest/v1/institutions*", (route) => route.fulfill({
    json: [{ id: 11, name: "University of Cape Coast" }],
  }));
  await page.route("**/rest/v1/courses*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/course_learning_resources*", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await page.getByRole("button", { name: "Courses & resources" }).click();

  await expect(page.getByRole("heading", { name: "No verified course resources yet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "MIT 18.06 Linear Algebra" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Harvard CS50" })).not.toBeVisible();
});
