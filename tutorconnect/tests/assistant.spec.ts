import { test, expect } from "@playwright/test";

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
