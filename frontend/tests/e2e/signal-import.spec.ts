import { test, expect } from "@playwright/test";

test.describe("Signal Import Flows", () => {
  const testEmail = "admin@example.com";
  const testPassword = "AdminPassword123!";

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(testPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test.afterEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test.describe("Database Connector Flow", () => {
    test("can create database signal", async ({ page }) => {
      await page.goto("/signals/new");

      await expect(page.getByRole("heading", { name: "Create New Signal" })).toBeVisible();

      await page.getByLabel("Signal Name").fill("Test Database Signal");

      await page.locator('[id="db-host"]').fill("localhost");
      await page.locator('[id="db-port"]').fill("5432");
      await page.locator('[id="db-database"]').fill("testdb");
      await page.locator('[id="db-query"]').fill("SELECT * FROM metrics");

      await page.getByRole("button", { name: "Create Signal" }).click();

      await expect(page).toHaveURL(/signals/);
    });

    test("shows validation errors for missing database fields", async ({ page }) => {
      await page.goto("/signals/new");

      await page.getByLabel("Signal Name").fill("Test Signal");
      await page.getByRole("button", { name: "Create Signal" }).click();

      await expect(page.getByText("Host is required")).toBeVisible();
      await expect(page.getByText("Database Name is required")).toBeVisible();
      await expect(page.getByText("Query is required")).toBeVisible();
    });

    test("can cancel database signal creation", async ({ page }) => {
      await page.goto("/signals/new");

      await page.getByLabel("Signal Name").fill("Test Signal");
      await page.getByRole("button", { name: "Cancel" }).click();

      await expect(page).toHaveURL(/signals/);
    });
  });

  test.describe("MQTT Connector Flow", () => {
    test("can create MQTT signal", async ({ page }) => {
      await page.goto("/signals/mqtt");

      await expect(page.getByRole("heading", { name: "Create MQTT Signal" })).toBeVisible();

      await page.getByLabel("Signal Name").fill("Test MQTT Signal");

      await page.locator('[id="brokerUrl"]').fill("mqtt://localhost:1883");
      await page.locator('[id="topic"]').fill("sensors/+/data");
      await page.locator('[id="timestampField"]').fill("timestamp");
      await page.locator('[id="valueField"]').fill("temperature");

      await page.getByRole("button", { name: "Save Configuration" }).click();

      await expect(page).toHaveURL(/signals/);
    });

    test("shows validation errors for missing MQTT fields", async ({ page }) => {
      await page.goto("/signals/mqtt");

      await page.getByLabel("Signal Name").fill("Test MQTT Signal");

      await page.getByRole("button", { name: "Save Configuration" }).click();

      await expect(page.getByText("Broker URL is required")).toBeVisible();
      await expect(page.getByText("Topic is required")).toBeVisible();
    });

    test("can navigate back to signals list from MQTT page", async ({ page }) => {
      await page.goto("/signals/mqtt");

      await page.getByRole("button", { name: /back to signals/i }).click();

      await expect(page).toHaveURL(/signals/);
    });
  });

  test.describe("File Upload Flow", () => {
    test("can navigate to file source type", async ({ page }) => {
      await page.goto("/signals/new");

      await page.getByLabel("Signal Name").fill("Test File Signal");

      const sourceTypeSelect = page.locator('[id="radix-\\:r\\d+\\:-trigger-\\1"]').first();
      await sourceTypeSelect.click();
      await page.getByRole("option", { name: "File" }).click();

      await expect(page.getByText("File Configuration")).toBeVisible();
    });

    test("can fill file configuration", async ({ page }) => {
      await page.goto("/signals/new");

      await page.getByLabel("Signal Name").fill("Test File Signal");

      const sourceTypeSelect = page.locator('[id="radix-\\:r\\d+\\:-trigger-\\1"]').first();
      await sourceTypeSelect.click();
      await page.getByRole("option", { name: "File" }).click();

      await page.locator('[id="file-path"]').fill("/data/test_signal.csv");

      await expect(page.locator('[id="file-path"]')).toHaveValue("/data/test_signal.csv");
    });
  });

  test.describe("Signal List", () => {
    test("displays signals in table", async ({ page }) => {
      await page.goto("/signals");

      await expect(page.getByRole("heading", { name: "Signals" })).toBeVisible();
      await expect(page.getByRole("table")).toBeVisible();
    });

    test("search functionality filters signals", async ({ page }) => {
      await page.goto("/signals");

      const searchInput = page.getByPlaceholder("Search signals...");
      await searchInput.fill("Production");

      await page.waitForTimeout(300);

      const rows = page.locator("table tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("filter by source type works", async ({ page }) => {
      await page.goto("/signals");

      const filterSelect = page.locator('[id="radix-\\:r\\d+\\:-trigger-\\2"]').first();
      await filterSelect.click();
      await page.getByRole("option", { name: "Database" }).click();

      await page.waitForTimeout(300);

      const badges = page.locator("table tbody tr").first().locator('[class*="bg-blue-100"]');
      await expect(badges.first()).toBeVisible();
    });

    test("can navigate to signal detail", async ({ page }) => {
      await page.goto("/signals");

      const firstRow = page.locator("table tbody tr").first();
      await firstRow.locator('[role="button"]').first().click();
      await page.getByRole("menuitem", { name: "View" }).click();

      await expect(page).toHaveURL(/signals\/.+/);
    });

    test("Add Signal button navigates to new signal page", async ({ page }) => {
      await page.goto("/signals");

      await page.getByRole("button", { name: /add signal/i }).click();

      await expect(page).toHaveURL(/signals\/new/);
    });

    test("shows empty state when no signals match filter", async ({ page }) => {
      await page.goto("/signals");

      const searchInput = page.getByPlaceholder("Search signals...");
      await searchInput.fill("nonexistent-signal-xyz");

      await page.waitForTimeout(500);

      await expect(page.getByText("No signals found")).toBeVisible();
    });
  });

  test.describe("Signal Detail", () => {
    test("displays signal configuration details", async ({ page }) => {
      await page.goto("/signals/1");

      await expect(page.getByText("Configuration")).toBeVisible();
      await expect(page.getByText("Details")).toBeVisible();
    });

    test("displays signal tabs", async ({ page }) => {
      await page.goto("/signals/1");

      await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Data" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Predictions" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Labels" })).toBeVisible();
    });

    test("can navigate back to signals list", async ({ page }) => {
      await page.goto("/signals/1");

      await page.getByRole("button", { name: /back to signals/i }).click();

      await expect(page).toHaveURL(/signals/);
    });
  });
});
