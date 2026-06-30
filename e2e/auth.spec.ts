import { test, expect } from "@playwright/test";
import { E2E_USER } from "./helpers/seed";

test.describe("Authentication", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("redirects unauthenticated users from sessions to login", async ({ page }) => {
    await page.goto("/sessions");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in with valid credentials and reaches sessions", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(E2E_USER.email);
    await page.getByLabel("Password").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/sessions/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Bingo Sessions" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("session persists after reload", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_USER.email);
    await page.getByLabel("Password").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Bingo Sessions" })).toBeVisible({
      timeout: 15000,
    });

    await page.reload();
    await expect(page).toHaveURL(/\/sessions/);
    await expect(page.getByRole("heading", { name: "Bingo Sessions" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@test.local");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login\?error=invalid/);
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("registers a new user and lands on sessions", async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}@test.local`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("New User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("testpassword123");
    await page.getByRole("button", { name: "Register" }).click();

    await expect(page).toHaveURL(/\/sessions/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Bingo Sessions" })).toBeVisible({
      timeout: 15000,
    });
  });
});
