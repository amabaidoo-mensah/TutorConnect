import { test, expect } from "@playwright/test";

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
  if (await page.getByText("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY", { exact: false }).count()) {
    test.skip(true, "Live tutor-resource coverage requires Supabase configuration.");
  }
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
