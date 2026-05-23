import { test, expect } from "@playwright/test";

test.describe("create + contribute smoke", () => {
  test("landing renders and CTA routes to /create", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: /create/i }).first().click();
    await expect(page).toHaveURL(/\/create$/);
  });

  test("create form shows both jar types", async ({ page }) => {
    await page.goto("/create");
    await expect(page.getByText(/flexible/i).first()).toBeVisible();
    await expect(page.getByText(/time[- ]locked/i).first()).toBeVisible();
  });
});
