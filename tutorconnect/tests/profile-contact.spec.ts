import { test, expect } from "@playwright/test";

const testAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.c2lnbmF0dXJl";

test("students can save private contact details and social links", async ({ page }) => {
  const student = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "student@example.com",
    email_confirmed_at: new Date().toISOString(),
  };
  let savedProfile: Record<string, unknown> | null = null;

  await page.route("**/auth/v1/token?grant_type=password", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    json: {
      access_token: testAccessToken,
      refresh_token: "test-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: student,
    },
  }));
  await page.route("**/rest/v1/profiles?*", (route) => {
    if (route.request().method() === "PATCH") {
      savedProfile = route.request().postDataJSON();
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({
      json: [{
        id: student.id,
        full_name: "Test Student",
        role: "student",
        bio: null,
        avatar_path: null,
        account_status: "active",
        phone: null,
        contact_email: null,
        whatsapp_url: null,
        instagram_url: null,
        facebook_url: null,
        linkedin_url: null,
        x_url: null,
        website_url: null,
      }],
    });
  });
  await page.route("**/rest/v1/payments?*", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await page.locator('input[name="e"]').fill(student.email);
  await page.locator('input[name="p"]').fill("TutorTest123!");
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await page.getByRole("button", { name: /My profile/ }).click();

  await expect(page.getByText("Only you and authorized administrators can view these details. They are not shown to tutors or other students.")).toBeVisible();
  await page.locator('input[name="contact_phone"]').fill("+233 24 555 0101");
  await page.locator('input[name="contact_email"]').fill("student-contact@example.com");
  await page.locator('input[name="whatsapp_url"]').fill("https://wa.me/233245550101");
  await page.locator('input[name="instagram_url"]').fill("https://instagram.com/student.example");
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect(page.getByRole("status")).toContainText("Profile saved.");
  expect(savedProfile).toMatchObject({
    phone: "+233 24 555 0101",
    contact_email: "student-contact@example.com",
    whatsapp_url: "https://wa.me/233245550101",
    instagram_url: "https://instagram.com/student.example",
  });
});

test("tutors can save social links alongside their paid-unlock contact details", async ({ page }) => {
  const tutor = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "tutor@example.com",
    email_confirmed_at: new Date().toISOString(),
  };
  const tutorProfile = {
    id: tutor.id,
    bio: "A tutor profile.",
    qualifications: "BSc",
    rate: 45,
    delivery: "Online",
    availability: "Weekdays",
    status: "approved",
    premium_until: null,
    views: 0,
  };
  let savedContact: Record<string, unknown> | null = null;

  await page.route("**/auth/v1/token?grant_type=password", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    json: {
      access_token: testAccessToken,
      refresh_token: "test-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: tutor,
    },
  }));
  await page.route("**/rest/v1/profiles?*", (route) => route.fulfill({
    json: [{
      id: tutor.id,
      full_name: "Test Tutor",
      role: "tutor",
      bio: null,
      avatar_path: null,
      account_status: "active",
      phone: null,
      contact_email: null,
      whatsapp_url: null,
      instagram_url: null,
      facebook_url: null,
      linkedin_url: null,
      x_url: null,
      website_url: null,
    }],
  }));
  await page.route("**/rest/v1/tutor_profiles?*", (route) => {
    if (route.request().method() === "PATCH") return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ json: [tutorProfile] });
  });
  await page.route("**/rest/v1/tutor_contacts?*", (route) => {
    if (route.request().method() === "POST") {
      savedContact = route.request().postDataJSON();
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ json: [{ tutor_id: tutor.id, phone: null, email: tutor.email }] });
  });
  await page.route("**/rest/v1/tutor_courses?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/reviews?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/tutor_resources?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/payments?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/rest/v1/rpc/tutor_dashboard_stats", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await page.locator('input[name="e"]').fill(tutor.email);
  await page.locator('input[name="p"]').fill("TutorTest123!");
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await expect(page.getByText("Students can see these details only after they unlock your tutor contact.")).toBeVisible();
  await page.locator('input[name="whatsapp_url"]').fill("https://wa.me/233245550202");
  await page.locator('input[name="linkedin_url"]').fill("https://linkedin.com/in/test-tutor");
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect(page.getByRole("status")).toContainText("Profile and contact details saved.");
  expect(savedContact).toMatchObject({
    tutor_id: tutor.id,
    whatsapp_url: "https://wa.me/233245550202",
    linkedin_url: "https://linkedin.com/in/test-tutor",
  });
});

test("a paid contact unlock shows the tutor's social links", async ({ page }) => {
  const student = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "student@example.com",
    email_confirmed_at: new Date().toISOString(),
  };
  const tutorId = "33333333-3333-4333-8333-333333333333";

  await page.route("**/auth/v1/token?grant_type=password", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    json: {
      access_token: testAccessToken,
      refresh_token: "test-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: student,
    },
  }));
  await page.route("**/rest/v1/profiles?*", (route) => route.fulfill({
    json: [{
      id: student.id,
      full_name: "Test Student",
      role: "student",
      bio: null,
      avatar_path: null,
      account_status: "active",
      phone: null,
      contact_email: null,
      whatsapp_url: null,
      instagram_url: null,
      facebook_url: null,
      linkedin_url: null,
      x_url: null,
      website_url: null,
    }],
  }));
  await page.route("**/rest/v1/payments?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/functions/v1/payments", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    json: { status: "paid", purpose: "contact", tutor_id: tutorId },
  }));
  await page.route("**/rest/v1/tutor_contacts?*", (route) => route.fulfill({
    json: [{
      tutor_id: tutorId,
      phone: "+233 24 555 0202",
      email: "tutor@example.com",
      whatsapp_url: "https://wa.me/233245550202",
      instagram_url: "https://instagram.com/test.tutor",
      facebook_url: null,
      linkedin_url: "https://linkedin.com/in/test-tutor",
      x_url: null,
      website_url: null,
    }],
  }));

  await page.goto("/?reference=paid-contact");
  await page.locator('input[name="e"]').fill(student.email);
  await page.locator('input[name="p"]').fill("TutorTest123!");
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  const unlockedContact = page.locator(".contact-box").filter({ hasText: "Payment confirmed — tutor contact unlocked" });
  await expect(unlockedContact).toBeVisible();
  await expect(unlockedContact.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/233245550202");
  await expect(unlockedContact.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/test.tutor");
  await expect(unlockedContact.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://linkedin.com/in/test-tutor");
});
