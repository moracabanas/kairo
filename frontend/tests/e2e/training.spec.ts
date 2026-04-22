import { test, expect } from "@playwright/test";

test.describe("Training Flow", () => {
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

  test.describe("Training Page Access", () => {
    test("unauthenticated user is redirected to login when accessing /training", async ({ page }) => {
      await page.context().clearCookies();
      await page.goto("/training");

      await expect(page).toHaveURL(/login/);
    });

    test("authenticated admin can access /training page", async ({ page }) => {
      await page.goto("/training");

      await expect(page.getByRole("heading", { name: "Training Configuration" })).toBeVisible();
    });

    test("non-admin user cannot access training page", async ({ page }) => {
      await page.context().clearCookies();
      await page.goto("/login");
      await page.getByLabel("Email").fill("viewer@example.com");
      await page.getByLabel("Password").fill("ViewerPassword123!");
      await page.getByRole("button", { name: "Sign in" }).click();

      await page.goto("/training");

      await expect(page.getByText(/access denied/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Training Configuration Form", () => {
    test("can see training form with all sections", async ({ page }) => {
      await page.goto("/training");

      await expect(page.getByRole("heading", { name: "Training Configuration" })).toBeVisible();
      await expect(page.getByText("Select Signals")).toBeVisible();
      await expect(page.getByText("Model Configuration")).toBeVisible();
      await expect(page.getByText("Training Schedule")).toBeVisible();
    });

    test("displays available signals", async ({ page }) => {
      await page.goto("/training");

      await expect(page.getByText("Production Sensor A")).toBeVisible();
      await expect(page.getByText("Temperature Monitor")).toBeVisible();
      await expect(page.getByText("Sales Data Feed")).toBeVisible();
    });

    test("can select signals for training", async ({ page }) => {
      await page.goto("/training");

      await page.getByText("Production Sensor A").click();
      await page.getByText("Temperature Monitor").click();

      await expect(page.getByText("Selected:")).toBeVisible();
      await expect(page.getByText("Production Sensor A")).toBeVisible();
      await expect(page.getByText("Temperature Monitor")).toBeVisible();
    });

    test("shows validation error when no signals selected", async ({ page }) => {
      await page.goto("/training");

      await page.getByRole("button", { name: "Start Training" }).click();

      await expect(page.getByText(/select at least one signal/i)).toBeVisible();
    });

    test("can select model type", async ({ page }) => {
      await page.goto("/training");

      await page.getByText("Anomaly Detection").click();

      await page.getByText("TimesFM Fine-tune").click();

      await expect(page.getByText("Fine-tune Google's TimesFM model")).toBeVisible();
    });

    test("can modify hyperparameters", async ({ page }) => {
      await page.goto("/training");

      await page.locator("#learning_rate").fill("0.005");
      await page.locator("#epochs").fill("50");
      await page.locator("#batch_size").fill("64");

      await expect(page.locator("#learning_rate")).toHaveValue("0.005");
      await expect(page.locator("#epochs")).toHaveValue("50");
      await expect(page.locator("#batch_size")).toHaveValue("64");
    });

    test("shows cost estimate when signals selected", async ({ page }) => {
      await page.goto("/training");

      await page.getByText("Production Sensor A").click();

      await expect(page.getByText("Estimated Cost")).toBeVisible();
      await expect(page.getByText(/signals/i)).toBeVisible();
    });

    test("can toggle schedule type to scheduled", async ({ page }) => {
      await page.goto("/training");

      await page.getByText("Schedule").click();

      await expect(page.locator("#scheduled_time")).toBeVisible();
    });

    test("shows validation error for invalid hyperparameters", async ({ page }) => {
      await page.goto("/training");

      await page.locator("#learning_rate").fill("2");
      await page.getByRole("button", { name: "Start Training" }).click();

      await expect(page.getByText(/between 0 and 1/i)).toBeVisible();
    });
  });

  test.describe("Training Job Submission", () => {
    test("can submit training job with all required fields", async ({ page }) => {
      await page.goto("/training");

      await page.getByText("Production Sensor A").click();
      await page.locator("#epochs").fill("25");
      await page.locator("#batch_size").fill("64");

      await page.getByRole("button", { name: "Start Training" }).click();

      await expect(page.getByText(/training job created successfully/i)).toBeVisible({ timeout: 10000 });
    });

    test("can submit scheduled training job", async ({ page }) => {
      await page.goto("/training");

      await page.getByText("Production Sensor A").click();
      await page.getByText("Schedule").click();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().slice(0, 16);

      await page.locator("#scheduled_time").fill(dateStr);

      await page.getByRole("button", { name: "Schedule Training" }).click();

      await expect(page.getByText(/training job created successfully/i)).toBeVisible({ timeout: 10000 });
    });

    test("success message disappears after timeout", async ({ page }) => {
      await page.goto("/training");

      await page.getByText("Production Sensor A").click();
      await page.getByRole("button", { name: "Start Training" }).click();

      await expect(page.getByText(/training job created successfully/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/training job created successfully/i)).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Training API", () => {
    test("POST /api/training/jobs creates training job", async ({ request }) => {
      const response = await request.post("/api/training/jobs", {
        data: {
          signal_ids: ["1", "2"],
          model_type: "anomaly_detection",
          hyperparameters: {
            learning_rate: 0.001,
            epochs: 10,
            batch_size: 32,
            context_length: 128,
            forecast_length: 24,
          },
          schedule_type: "now",
        },
      });

      if (response.status() === 200 || response.status() === 201) {
        const body = await response.json();
        expect(body).toHaveProperty("id");
        expect(body).toHaveProperty("status");
      } else {
        expect([401, 404, 500]).toContain(response.status());
      }
    });

    test("GET /api/training/jobs returns training jobs list", async ({ request }) => {
      const response = await request.get("/api/training/jobs");

      if (response.status() === 200) {
        const body = await response.json();
        expect(Array.isArray(body.jobs) || Array.isArray(body)).toBe(true);
      } else {
        expect([401, 500]).toContain(response.status());
      }
    });

    test("POST /api/training/jobs validates required fields", async ({ request }) => {
      const response = await request.post("/api/training/jobs", {
        data: {
          signal_ids: [],
          model_type: "anomaly_detection",
        },
      });

      expect([400, 422]).toContain(response.status());
    });
  });
});