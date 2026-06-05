import { test, expect } from "@playwright/test";

// These assume the demo seed has been run (npm run db:seed).
test.describe("RotaWise smoke", () => {
  test("landing page renders the hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /workforce scheduling/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("owner can sign in and reach the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@acme.test");
    await page.getByLabel("Password").fill("Password123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/welcome/i)).toBeVisible();
  });

  test("unauthenticated users are redirected away from the dashboard", async ({ page }) => {
    await page.goto("/employees");
    await expect(page).toHaveURL(/\/login/);
  });
});
