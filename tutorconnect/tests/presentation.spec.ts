import { test, expect } from "@playwright/test";

test("presentation mode shows fictional tutor cards without payment actions and still allows real signup", async ({ page }) => {
  await page.goto("/?demo=1");

  await expect(page.getByRole("heading", { name: "Explore sample tutor profiles" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Presentation demo notice" })).toContainText("Profiles and programme entries are fictional.");
  await expect(page.getByText("Fictional demo profile · no charges")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Contact unlock disabled in demo" })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Create a real account" })).toBeVisible();

  await page.getByLabel("Course code or title").fill("CS101");
  await page.getByRole("button", { name: "Search tutors" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 fictional demo profile shown" })).toBeVisible();
  const tutorCard = page.locator(".tutor-card").filter({ hasText: "Tutor Ama" });
  await expect(tutorCard).toBeVisible();
  await expect(tutorCard.getByRole("heading", { name: "Tutor Ama" })).toBeVisible();
  await expect(tutorCard.getByRole("heading", { name: /Demo Tutor/ })).toHaveCount(0);
  await expect(tutorCard).toContainText("Courses: CS101");
  await expect(tutorCard.getByRole("link", { name: /CS50 Week 0/ })).toHaveAttribute("href", "https://youtu.be/2WtPyqwTLKM");
  await expect(tutorCard.getByRole("link", { name: /CS50P/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tutor Kofi" })).not.toBeVisible();

  await page.getByRole("button", { name: "Create a real account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to presentation demo" })).toBeVisible();
});

test("one tutor profile can show multiple subjects with resources matched to each", async ({ page }) => {
  await page.goto("/?demo=1");
  await page.getByLabel("Course code or title").fill("CS10");
  await page.getByRole("button", { name: "Search tutors" }).click();

  await expect(page.getByRole("status").filter({ hasText: "1 fictional demo profile shown" })).toBeVisible();
  const tutorCard = page.locator(".tutor-card").filter({ hasText: "Tutor Ama" });
  await expect(tutorCard).toHaveCount(1);
  await expect(tutorCard).toContainText("Courses: CS101, CS102");
  await expect(tutorCard.getByText("CS101 · Course resource")).toBeVisible();
  await expect(tutorCard.getByText("CS102 · Course resource")).toBeVisible();
  await expect(tutorCard.getByRole("link", { name: /CS50 Week 0/ })).toBeVisible();
  await expect(tutorCard.getByRole("link", { name: /CS50P/ })).toBeVisible();
});

test("presentation course and programme pages use clearly identified sample content", async ({ page }) => {
  await page.goto("/?demo=1");

  await page.getByRole("button", { name: "Courses & resources" }).click();
  await expect(page.getByRole("heading", { name: "Courses & learning resources" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Linear Algebra I (demo course)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business and Management", exact: true })).toBeVisible();
  await expect(page.getByText(/none are represented as UCC course records/i)).toBeVisible();

  await page.getByRole("button", { name: "UCC programmes" }).click();
  await expect(page.getByRole("heading", { name: "Example UCC programmes" })).toBeVisible();
  await expect(page.getByText("Example BSc Computer Science")).toBeVisible();
  await expect(page.getByText("Example only").first()).toBeVisible();
});

test("student demo can complete a simulated unlock and receive a receipt", async ({ page }) => {
  await page.goto("/?demo=1&role=student");
  await page.getByLabel("Course code or title").fill("CS101");
  await page.getByRole("button", { name: "Search tutors" }).click();

  await page.getByRole("button", { name: "Demo unlock contact · GHS 10" }).click();
  await expect(page.getByRole("dialog", { name: "Tutor contact unlock — Tutor Ama" })).toBeVisible();
  await expect(page.getByText("Successful (simulated)").first()).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Contact unlocked", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Email: tutor.demo@example.com" }).first()).toBeVisible();
});

test("tutor demo can activate a plan and purchase a resource publishing credit", async ({ page }) => {
  await page.goto("/?demo=1&role=tutor");
  await expect(page.getByRole("heading", { name: /Your teaching dashboard/ })).toBeVisible();

  await page.getByRole("button", { name: "Choose monthly" }).click();
  await expect(page.getByRole("dialog", { name: "Monthly tutor listing plan" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Pay GHS 50 for one resource" }).click();
  await expect(page.getByRole("dialog", { name: "Tutor resource publishing credit" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Unused publishing credits: 1/)).toBeVisible();

  await page.locator(".course-search input[name='course_query']").fill("BUS");
  await page.getByRole("button", { name: "Search catalogue" }).click();
  await expect(page.getByText("BUS204 · Business Management")).toBeVisible();
  await page.getByRole("button", { name: "Request approval" }).click();
  await expect(page.getByText("Demo course request sent for administrator approval.")).toBeVisible();
  await expect(page.locator(".list-item").filter({ hasText: "BUS204 · Business Management" })).toContainText("pending");

  await page.getByLabel("Approved course").selectOption("-2");
  await page.getByLabel("Resource type").selectOption("teaching_video");
  await page.getByLabel("Title", { exact: true }).fill("Demo teaching video");
  await page.getByLabel("Or external HTTPS link").fill("https://youtu.be/2WtPyqwTLKM");
  await page.getByRole("button", { name: "Publish resource" }).click();
  await expect(page.getByRole("link", { name: "Demo teaching video" })).toBeVisible();

  await page.goto("/?demo=1&role=student");
  await page.getByLabel("Course code or title").fill("CS101");
  await page.getByRole("button", { name: "Search tutors" }).click();
  await expect(page.getByRole("link", { name: "Demo teaching video" })).toBeVisible();
});
