import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  const adminEmail = "admin@example.com";
  const adminPassword = "AdminPassword123!";

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test.afterEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test.describe("Dashboard Page Access", () => {
    test("unauthenticated user is redirected to login when accessing /dashboard", async ({ page }) => {
      await page.context().clearCookies();
      await page.goto("/dashboard");

      await expect(page).toHaveURL(/login/);
    });

    test("authenticated user can access dashboard", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    });

    test("dashboard shows welcome message", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByText(/welcome/i)).toBeVisible();
    });
  });

  test.describe("Dashboard Components", () => {
    test("shows dashboard navigation buttons", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByRole("button", { name: /events/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    });

    test("shows event summary cards", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByText("Critical Events")).toBeVisible();
      await expect(page.getByText("Warning Events")).toBeVisible();
      await expect(page.getByText("Total Events")).toBeVisible();
      await expect(page.getByText("Active Signals")).toBeVisible();
    });

    test("shows recent events section", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByRole("heading", { name: /recent events/i })).toBeVisible();
    });

    test("shows recent signals section", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByRole("heading", { name: /recent signals/i })).toBeVisible();
    });

    test("shows recent training jobs section", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByRole("heading", { name: /recent training jobs/i })).toBeVisible();
    });
  });

  test.describe("Dashboard Navigation", () => {
    test("can navigate to events page from dashboard", async ({ page }) => {
      await page.goto("/dashboard");

      await page.getByRole("button", { name: /events/i }).click();

      await expect(page).toHaveURL(/events/);
    });

    test("can navigate to signals page from dashboard", async ({ page }) => {
      await page.goto("/dashboard");

      await page.getByRole("link", { name: /view all signals/i }).click();

      await expect(page).toHaveURL(/signals/);
    });

    test("can navigate to training page from dashboard", async ({ page }) => {
      await page.goto("/dashboard");

      await page.getByRole("link", { name: /view training page/i }).click();

      await expect(page).toHaveURL(/training/);
    });
  });

  test.describe("Dashboard Authentication", () => {
    test("sign out redirects to login", async ({ page }) => {
      await page.goto("/dashboard");

      await page.getByRole("button", { name: /sign out/i }).click();

      await expect(page).toHaveURL(/login/);
    });

    test("session persists on page refresh", async ({ page }) => {
      await page.goto("/dashboard");
      await page.reload();

      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    });
  });
});