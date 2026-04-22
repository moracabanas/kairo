import { test, expect } from "@playwright/test";

test.describe("User Management", () => {
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

  test("admin can view user list", async ({ page }) => {
    await page.goto("/settings/users");

    await expect(page.getByRole("heading", { name: "Team Members" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("admin can open invite user dialog", async ({ page }) => {
    await page.goto("/settings/users");

    await page.getByRole("button", { name: /invite user/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Email Address")).toBeVisible();
    await expect(page.getByLabel("Role")).toBeVisible();
  });

  test("admin can invite new user", async ({ page }) => {
    await page.goto("/settings/users");

    await page.getByRole("button", { name: /invite user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const inviteEmail = `newuser-${Date.now()}@example.com`;
    await page.getByLabel("Email Address").fill(inviteEmail);
    await page.getByLabel("Role").click();
    await page.getByRole("option", { name: "Analyst" }).click();

    await page.getByRole("button", { name: /send invite/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
  });

  test("admin can change user role", async ({ page }) => {
    await page.goto("/settings/users");

    const userRow = page.locator("table tbody tr").filter({ hasText: "analyst@example.com" });
    await userRow.getByRole("button", { name: "Change" }).click();

    await userRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "Admin" }).click();

    await page.waitForTimeout(1000);

    await expect(userRow.getByText("admin")).toBeVisible({ timeout: 10000 });
  });

  test("admin cannot remove themselves", async ({ page }) => {
    await page.goto("/settings/users");

    const currentUserRow = page.locator("table tbody tr").first();
    const removeButton = currentUserRow.getByRole("button", { name: /remove/i });

    await expect(removeButton).toHaveCount(0);
  });

  test("admin cannot remove the last admin", async ({ page }) => {
    await page.goto("/settings/users");

    const adminRows = page.locator("table tbody tr").filter({ hasText: "admin" });
    const adminCount = await adminRows.count();

    if (adminCount <= 1) {
      const firstAdminRow = adminRows.first();
      const removeButton = firstAdminRow.getByRole("button", { name: /remove/i });
      await expect(removeButton).toHaveCount(0);
    } else {
      const lastAdminRow = adminRows.last();
      const removeButton = lastAdminRow.getByRole("button", { name: /remove/i });
      await expect(removeButton).toHaveCount(0);
    }
  });

  test("admin can cancel invite dialog", async ({ page }) => {
    await page.goto("/settings/users");

    await page.getByRole("button", { name: /invite user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
  });

  test("non-admin cannot access user management page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("viewer@example.com");
    await page.getByLabel("Password").fill("ViewerPassword123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/settings/users");

    await expect(page.getByText(/access denied|unauthorized|forbidden/i)).toBeVisible({ timeout: 10000 });
  });
});
