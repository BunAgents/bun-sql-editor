import { test, expect } from "@playwright/test";

test.describe("Server power menu", () => {
  test("power button is visible in sidebar footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#serverPowerBtn")).toBeVisible();
  });

  test("server dot is green (running) on load", async ({ page }) => {
    await page.goto("/");
    const dot = page.locator("#serverDot");
    await expect(dot).toBeVisible();
    // Should not have 'off' or 'busy' class
    await expect(dot).not.toHaveClass(/off/);
    await expect(dot).not.toHaveClass(/busy/);
  });

  test("popover is hidden by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#serverPopover")).toBeHidden();
  });

  test("clicking power button opens popover", async ({ page }) => {
    await page.goto("/");
    await page.click("#serverPowerBtn");
    await expect(page.locator("#serverPopover")).toBeVisible();
  });

  test("popover contains Restart and Stop buttons", async ({ page }) => {
    await page.goto("/");
    await page.click("#serverPowerBtn");
    await expect(page.locator("#popRestartBtn")).toBeVisible();
    await expect(page.locator("#popStopBtn")).toBeVisible();
  });

  test("clicking power button again closes popover", async ({ page }) => {
    await page.goto("/");
    await page.click("#serverPowerBtn");
    await page.click("#serverPowerBtn");
    await expect(page.locator("#serverPopover")).toBeHidden();
  });

  test("clicking outside popover closes it", async ({ page }) => {
    await page.goto("/");
    await page.click("#serverPowerBtn");
    await expect(page.locator("#serverPopover")).toBeVisible();
    await page.mouse.click(600, 300); // click away
    await expect(page.locator("#serverPopover")).toBeHidden();
  });

  test("restart button triggers restart and dot turns green again", async ({ page }) => {
    await page.goto("/");
    await page.click("#serverPowerBtn");
    await page.click("#popRestartBtn");
    // Dot turns busy (yellow)
    await expect(page.locator("#serverDot")).toHaveClass(/busy/, { timeout: 2000 });
    // After restart completes, dot turns green and popover closes
    await expect(page.locator("#serverPopover")).toBeHidden({ timeout: 10000 });
    await expect(page.locator("#serverDot")).not.toHaveClass(/off/);
    await expect(page.locator("#serverDot")).not.toHaveClass(/busy/);
  });
});

test.describe("Settings panel (server controls removed)", () => {
  test("settings panel does not contain server stop/restart buttons", async ({ page }) => {
    await page.goto("/");
    await page.click("#settingsBtn");
    await expect(page.locator("#settingsPanel")).toBeVisible();
    await expect(page.locator("#sRestartBtn")).toHaveCount(0);
    await expect(page.locator("#sStopBtn")).toHaveCount(0);
  });
});
