import { test, expect } from "@playwright/test";

test("login and signup modes expose the expected fields", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Log in to TutorConnect" })).toBeVisible();
  await expect(page.locator('input[name="e"]')).toHaveAttribute("type", "email");
  await expect(page.locator('input[name="p"]')).toHaveAttribute("minlength", "8");

  await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.locator('input[name="n"]')).toBeVisible();
  await expect(page.locator('select[name="r"]')).toBeVisible();

  await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Log in" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
});

test("signup with email confirmation enabled asks the user to confirm before logging in", async ({ page }) => {
  const uniqueEmail = `student-${Date.now()}@example.com`;
  const user = {
    id: "11111111-1111-1111-1111-111111111111",
    email: uniqueEmail,
  };

  await page.route("**/auth/v1/signup*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    json: { user: { ...user, email_confirmed_at: new Date().toISOString() }, session: null },
  }));
  let earlyLoginAttempted = false;
  await page.route("**/auth/v1/token?grant_type=password", (route) => {
    earlyLoginAttempted = true;
    return route.fulfill({
    status: 200,
    contentType: "application/json",
    json: {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user,
    },
    });
  });

  await page.goto("/");
  await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Sign up" }).click();
  await page.locator('input[name="n"]').fill("Test Student");
  await page.locator('input[name="e"]').fill(user.email);
  await page.locator('input[name="p"]').fill("TutorTest123!");
  await page.locator('form.stack-form button[name="up"]').click();

  await expect(page.getByText(/your account was created\. confirm your email using the link we sent/i)).toBeVisible();
  expect(earlyLoginAttempted).toBe(false);
  await expect(page.getByRole("heading", { name: "Log in to TutorConnect" })).toBeVisible();
});

test("login normalizes email casing", async ({ page }) => {
  let submittedEmail = "";
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    submittedEmail = route.request().postDataJSON().email;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      json: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" },
    });
  });

  await page.goto("/");
  await page.locator('input[name="e"]').fill("PERSON@EXAMPLE.COM");
  await page.locator('input[name="p"]').fill("WrongPassword123!");
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await expect(page.getByText(/email or password is incorrect/i)).toBeVisible();
  expect(submittedEmail).toBe("person@example.com");
});

test("a student receives a verification badge after a paid contact unlock is found", async ({ page }) => {
  const user = {
    id: "22222222-2222-2222-2222-222222222222",
    email: `verified-${Date.now()}@example.com`,
    email_confirmed_at: new Date().toISOString(),
  };
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
    json: [{ id: user.id, full_name: "Verified Student", role: "student", bio: null, avatar_path: null, account_status: "active" }],
  }));
  await page.route("**/rest/v1/payments?*", (route) => route.fulfill({
    json: [{ id: "paid-contact-payment" }],
  }));
  await page.route("**/rest/v1/institutions?*", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await page.locator('input[name="e"]').fill(user.email);
  await page.locator('input[name="p"]').fill("TutorTest123!");
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await expect(page.getByRole("img", { name: "TutorConnect verified member" }).first()).toBeVisible();
});

test("invalid credentials explain password recovery", async ({ page }) => {
  await page.route("**/auth/v1/token?grant_type=password", (route) => route.fulfill({
    status: 400,
    contentType: "application/json",
    json: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" },
  }));

  await page.goto("/");
  await page.locator('input[name="e"]').fill("person@example.com");
  await page.locator('input[name="p"]').fill("WrongPassword123!");
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await expect(page.getByText(/email or password is incorrect/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
});

test("duplicate signup moves the user to login guidance", async ({ page }) => {
  await page.route("**/auth/v1/signup*", (route) => route.fulfill({
    status: 400,
    contentType: "application/json",
    json: { code: "user_already_exists", msg: "User already registered" },
  }));

  await page.goto("/");
  await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Sign up" }).click();
  await page.locator('input[name="n"]').fill("Existing Student");
  await page.locator('input[name="e"]').fill("existing@example.com");
  await page.locator('input[name="p"]').fill("ExistingPassword123!");
  await page.locator('form.stack-form button[name="up"]').click();

  await expect(page.getByText(/email is already registered/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Log in to TutorConnect" })).toBeVisible();
});

test("login page explains that admin access is assigned", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/admin dashboard is available only to accounts assigned the admin role in supabase/i)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Account type" })).not.toBeVisible();
});
