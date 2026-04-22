import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";

  test.afterEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("email/password signup with confirmation", async ({ page }) => {
    await page.goto("/signup");

    await page.getByLabel("Email").fill(testEmail);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(testPassword);
    await page.getByLabel("Confirm Password").fill(testPassword);
    await page.getByLabel("terms").check();

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByText(/confirmation link/)).toBeVisible();
  });

  test("email/password login and redirect to dashboard", async ({ page }) => {
    const email = `login-${Date.now()}@example.com`;
    const password = "TestPassword123!";

    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByLabel("terms").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    await expect(page.getByLabel("Organization Name")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Organization Name").fill("Test Org");
    await page.getByRole("button", { name: "Create Organization" }).click();

    await page.waitForURL(/dashboard/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("protected route redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/login/);
  });

  test("signout redirects to login", async ({ page }) => {
    const email = `signout-${Date.now()}@example.com`;
    const password = "TestPassword123!";

    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByLabel("terms").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Organization Name").fill("Test Org");
    await page.getByRole("button", { name: "Create Organization" }).click();

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/login/);
  });

  test("invalid credentials are rejected", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("invalid@example.com");
    await page.getByLabel("Password").fill("wrongpassword");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid.*credentials/i)).toBeVisible({ timeout: 10000 });
  });

  test("password validation on signup", async ({ page }) => {
    await page.goto("/signup");

    await page.getByLabel("Email").fill("test@example.com");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("123");
    await page.getByLabel("Confirm Password").fill("123");

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });

  test("signup password mismatch validation", async ({ page }) => {
    await page.goto("/signup");

    await page.getByLabel("Email").fill("test@example.com");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("TestPassword123!");
    await page.getByLabel("Confirm Password").fill("DifferentPassword123!");
    await page.getByLabel("terms").check();

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("terms acceptance required on signup", async ({ page }) => {
    await page.goto("/signup");

    await page.getByLabel("Email").fill("test@example.com");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("TestPassword123!");
    await page.getByLabel("Confirm Password").fill("TestPassword123!");

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("You must accept the terms and conditions")).toBeVisible();
  });
});