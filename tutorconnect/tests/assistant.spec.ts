import { test, expect, type Page } from "@playwright/test";

async function signInStudent(page: Page) {
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

  await page.goto("/");
  await page.locator('input[name="e"]').fill(user.email);
  await page.locator('input[name="p"]').fill("TutorTest123!");
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await page.getByRole("button", { name: "Open student assistant" }).click();
}

test("assistant exposes email, phone and WhatsApp support and requires sign-in for AI chat", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open student assistant" }).click();

  await expect(page.getByRole("region", { name: "TutorConnect student assistant" })).toBeVisible();
  await expect(page.getByText("Log in to chat with the AI assistant.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Email the administrators" })).toHaveAttribute(
    "href",
    "mailto:baidoomensahama@gmail.com",
  );
  await expect(page.getByRole("link", { name: "Call 0245664985" })).toHaveAttribute(
    "href",
    "tel:0245664985",
  );
  await expect(page.getByRole("link", { name: "Message us on WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/2332456698495",
  );
});

test("signed-in students can receive an AI answer", async ({ page }) => {
  await signInStudent(page);
  await page.route("**/functions/v1/student-assistant", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    json: { reply: "A fraction represents part of a whole." },
  }));

  await page.getByLabel("Your question").fill("What is a fraction?");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect(page.getByText("A fraction represents part of a whole.")).toBeVisible();
});

test("assistant shows server errors and lets the student retry", async ({ page }) => {
  let attempts = 0;
  await signInStudent(page);
  await page.route("**/functions/v1/student-assistant", (route) => {
    attempts += 1;
    return route.fulfill(attempts === 1
      ? {
        status: 429,
        contentType: "application/json",
        json: { error: "The Gemini free-tier limit is temporarily reached. Please try again later." },
      }
      : {
        status: 200,
        contentType: "application/json",
        json: { reply: "Try again in a moment." },
      });
  });

  await page.getByLabel("Your question").fill("Can you help me study?");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect(page.getByRole("alert")).toHaveText("The Gemini free-tier limit is temporarily reached. Please try again later.");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Try again in a moment.")).toBeVisible();
  expect(attempts).toBe(2);
});
