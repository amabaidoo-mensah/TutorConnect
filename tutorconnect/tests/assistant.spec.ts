import { test, expect } from "@playwright/test";

test("AI assistant is removed while administrator contact links remain available", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Ask AI|Open student assistant/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "baidoomensahama@gmail.com" })).toHaveAttribute(
    "href",
    "mailto:baidoomensahama@gmail.com",
  );
  await expect(page.getByRole("link", { name: "0245664985" })).toHaveAttribute(
    "href",
    "tel:0245664985",
  );
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/2332456698495",
  );
});
