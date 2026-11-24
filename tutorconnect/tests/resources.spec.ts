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

test("curated subject resources remain available when Supabase has no course records", async ({ page }) => {
  await page.route("**/rest/v1/institutions*", (route) => route.fulfill({
    json: [{ id: 11, name: "University of Cape Coast" }],
  }));
  await page.route("**/rest/v1/courses*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/course_learning_resources*", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await page.getByRole("button", { name: "Courses & resources" }).click();

  await expect(page.getByRole("heading", { name: "Free learning resources by subject" })).toBeVisible();
  await expect(page.getByRole("link", { name: /MIT 18.06 Linear Algebra lectures/ })).toHaveAttribute(
    "href",
    "https://www.youtube.com/playlist?list=PLE7DDD91010BC51F8",
  );
  await expect(page.getByRole("link", { name: /CS50 Week 0/ })).toHaveAttribute("href", "https://youtu.be/2WtPyqwTLKM");
  await expect(page.getByRole("link", { name: /OpenStax: Principles of Management/ })).toHaveAttribute(
    "href",
    "https://openstax.org/books/principles-management/pages/1-introduction",
  );
  await expect(page.getByRole("heading", { name: "No verified course resources yet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Linear Algebra I (demo course)" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Introduction to Computer Science (demo course)" })).not.toBeVisible();
});

test("curated resources can be filtered by subject", async ({ page }) => {
  await page.route("**/rest/v1/institutions*", (route) => route.fulfill({
    json: [{ id: 11, name: "University of Cape Coast" }],
  }));
  await page.route("**/rest/v1/courses*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/course_learning_resources*", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await page.getByRole("button", { name: "Courses & resources" }).click();
  await page.getByLabel("Search courses or subjects").fill("Business");

  await expect(page.getByRole("heading", { name: "Business and Management" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mathematics" })).not.toBeVisible();
});

test("live tutor search groups a tutor's courses and labels each linked resource by course", async ({ page }) => {
  const tutorId = "11111111-1111-4111-8111-111111111111";
  const user = { id: "22222222-2222-4222-8222-222222222222", email: "student@example.com" };
  await page.route("**/auth/v1/token?grant_type=password", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    json: {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user,
    },
  }));
  await page.route("**/rest/v1/profiles?*", (route) => route.fulfill({
    json: [{ id: user.id, full_name: "Test Student", role: "student", bio: null, avatar_path: null, account_status: "active" }],
  }));
  await page.route("**/rest/v1/payments?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/institutions*", (route) => route.fulfill({
    json: [{ id: 11, name: "University of Cape Coast" }],
  }));
  await page.route("**/rest/v1/academic_units*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/rpc/search_tutors_grouped*", (route) => route.fulfill({
    json: ["CS101", "CS102"].map((course_code) => ({
      id: tutorId,
      name: "Tutor with multiple courses",
      bio: "Teaches more than one course.",
      rate: 30,
      delivery: "Online",
      course_code,
      avg_rating: null,
      review_count: 0,
      featured: false,
      department_id: null,
      department: null,
      school: null,
      college: null,
      avatar_path: null,
    })),
  }));
  await page.route("**/rest/v1/tutor_resources*", (route) => route.fulfill({
    json: [
      {
        id: 1,
        tutor_id: tutorId,
        course_id: 21,
        resource_type: "teaching_video",
        title: "CS101 YouTube lesson",
        url: "https://youtu.be/lesson101",
        storage_path: null,
        resource_payment_id: null,
        description: null,
        created_at: "2026-01-01T00:00:00Z",
        courses: { code: "CS101" },
      },
      {
        id: 2,
        tutor_id: tutorId,
        course_id: 22,
        resource_type: "teaching_video",
        title: "CS102 YouTube lesson",
        url: "https://youtu.be/lesson102",
        storage_path: null,
        resource_payment_id: null,
        description: null,
        created_at: "2026-01-01T00:00:00Z",
        courses: { code: "CS102" },
      },
    ],
  }));

  await page.goto("/");
  await page.locator('input[name="e"]').fill(user.email);
  await page.locator('input[name="p"]').fill("TutorTest123!");
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Find tutors" })).toBeVisible();
  await page.getByRole("button", { name: "Find tutors" }).click();
  await expect(page.getByLabel("Institution")).toHaveValue("11");
  await page.getByLabel("Course code or title").fill("CS10");
  await page.getByRole("button", { name: "Search tutors" }).click();

  await expect(page.getByRole("status").filter({ hasText: "1 approved tutor found" })).toBeVisible();
  const tutorCard = page.locator(".tutor-card").filter({ hasText: "Tutor with multiple courses" });
  await expect(tutorCard).toHaveCount(1);
  await expect(tutorCard).toContainText("Courses: CS101, CS102");
  await expect(tutorCard.getByText("CS101 · Teaching preview")).toBeVisible();
  await expect(tutorCard.getByText("CS102 · Teaching preview")).toBeVisible();
  await expect(tutorCard.getByRole("link", { name: "CS101 · Teaching preview CS101 YouTube lesson" })).toHaveAttribute("href", "https://youtu.be/lesson101");
  await expect(tutorCard.getByRole("link", { name: "CS102 · Teaching preview CS102 YouTube lesson" })).toHaveAttribute("href", "https://youtu.be/lesson102");
});
