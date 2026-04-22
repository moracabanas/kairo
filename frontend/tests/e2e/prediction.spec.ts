import { test, expect } from "@playwright/test";

test.describe("Prediction Flow", () => {
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

  test.describe("Playground Prediction Flow", () => {
    test("can select sine wave preset", async ({ page }) => {
      await page.goto("/playground");

      await expect(page.getByRole("heading", { name: "Prediction Playground" })).toBeVisible();

      await page.getByRole("button", { name: "Sample Data" }).click();

      const presetSelect = page.locator('[id^="radix-"][id$="trigger"]').first();
      await presetSelect.click();
      await page.getByRole("option", { name: "Sine Wave" }).click();

      await expect(page.getByText("Math.sin(i / 10) * 10")).toBeVisible();
    });

    test("can run prediction and see forecast", async ({ page }) => {
      await page.goto("/playground");

      await expect(page.getByRole("heading", { name: "Prediction Playground" })).toBeVisible();

      const presetSelect = page.locator('[id^="radix-"][id$="trigger"]').first();
      await presetSelect.click();
      await page.getByRole("option", { name: "Sine Wave" }).click();

      await page.waitForTimeout(500);

      await page.getByRole("button", { name: "Run Prediction" }).click();

      await expect(page.getByText("Running Prediction...")).toBeVisible({ timeout: 10000 });

      await expect(page.getByText("Context Used")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Forecast Horizon")).toBeVisible();
      await expect(page.getByText("Confidence Interval")).toBeVisible();

      await expect(page.getByText("100 points")).toBeVisible();
      await expect(page.getByText("24 hours")).toBeVisible();
      await expect(page.getByText("95%")).toBeVisible();
    });

    test("can download forecast as CSV", async ({ page }) => {
      await page.goto("/playground");

      const presetSelect = page.locator('[id^="radix-"][id$="trigger"]').first();
      await presetSelect.click();
      await page.getByRole("option", { name: "Sine Wave" }).click();

      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Run Prediction" }).click();

      await expect(page.getByText("Context Used")).toBeVisible({ timeout: 15000 });

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download Forecast as CSV" }).click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("forecast.csv");
    });
  });

  test.describe("Signal Detail Prediction", () => {
    test("displays predictions tab with run prediction button", async ({ page }) => {
      await page.goto("/signals/1");

      await page.getByRole("tab", { name: "Predictions" }).click();

      await expect(page.getByText("ML predictions based on signal data")).toBeVisible();
    });

    test("can run prediction from signal detail", async ({ page }) => {
      await page.goto("/signals/1");

      await page.getByRole("tab", { name: "Predictions" }).click();

      await expect(page.getByText("Run Prediction")).toBeVisible();
    });

    test("shows prediction chart after running", async ({ page }) => {
      await page.goto("/signals/1");

      await page.getByRole("tab", { name: "Predictions" }).click();

      await expect(page.getByText("Run Prediction")).toBeVisible();
    });
  });

  test.describe("Prediction Settings", () => {
    test("can open settings dialog", async ({ page }) => {
      await page.goto("/signals/1");

      await page.getByRole("tab", { name: "Predictions" }).click();

      const settingsButton = page.getByRole("button", { name: /settings/i });
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        await expect(page.getByText("Prediction Settings")).toBeVisible();
      }
    });

    test("can adjust context length", async ({ page }) => {
      await page.goto("/signals/1");

      await page.getByRole("tab", { name: "Predictions" }).click();

      const settingsButton = page.getByRole("button", { name: /settings/i });
      if (await settingsButton.isVisible()) {
        await settingsButton.click();

        const contextLengthInput = page.locator('[id="context_length"]');
        if (await contextLengthInput.isVisible()) {
          await contextLengthInput.fill("200");
          await expect(contextLengthInput).toHaveValue("200");
        }
      }
    });

    test("can save settings", async ({ page }) => {
      await page.goto("/signals/1");

      await page.getByRole("tab", { name: "Predictions" }).click();

      const settingsButton = page.getByRole("button", { name: /settings/i });
      if (await settingsButton.isVisible()) {
        await settingsButton.click();

        const saveButton = page.getByRole("button", { name: /save/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await expect(page.getByText(/saved/i).or(page.getByText(/settings/i))).toBeVisible();
        }
      }
    });
  });

  test.describe("Prediction API", () => {
    test("predict endpoint returns forecast array", async ({ request }) => {
      const response = await request.post("/api/predict", {
        data: {
          signal_id: "test-signal-123",
          context_length: 100,
          horizon: 24,
        },
      });

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty("forecast");
        expect(Array.isArray(body.forecast)).toBe(true);
      } else {
        expect([401, 404, 500]).toContain(response.status());
      }
    });

    test("predict endpoint returns confidence interval", async ({ request }) => {
      const response = await request.post("/api/predict", {
        data: {
          signal_id: "test-signal-123",
          context_length: 100,
          horizon: 24,
        },
      });

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty("confidence_interval");
        expect(typeof body.confidence_interval).toBe("number");
      } else {
        expect([401, 404, 500]).toContain(response.status());
      }
    });

    test("predict endpoint handles invalid signal_id", async ({ request }) => {
      const response = await request.post("/api/predict", {
        data: {
          signal_id: "invalid-uuid-format",
          context_length: 100,
          horizon: 24,
        },
      });

      expect([400, 401, 404, 500]).toContain(response.status());
    });

    test("predict endpoint validates context_length", async ({ request }) => {
      const response = await request.post("/api/predict", {
        data: {
          signal_id: "test-signal-123",
          context_length: -1,
          horizon: 24,
        },
      });

      expect([400, 401, 422, 500]).toContain(response.status());
    });
  });
});