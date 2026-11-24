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

test("successful signup establishes a session instead of showing invalid credentials", async ({ page }) => {
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

  await page.goto("/");
  await page.getByRole("group", { name: "Account access" }).getByRole("button", { name: "Sign up" }).click();
  await page.locator('input[name="n"]').fill("Test Student");
  await page.locator('input[name="e"]').fill(user.email);
  await page.locator('input[name="p"]').fill("TutorTest123!");
  await page.locator('form.stack-form button[name="up"]').click();

  await expect(page.getByText("Account created. You are signed in and ready to continue.")).toBeVisible();
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
  await expect(page.getByText(/administrator access is assigned/i)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Account type" })).not.toBeVisible();
});
