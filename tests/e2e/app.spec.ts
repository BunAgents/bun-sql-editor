import { test, expect } from "@playwright/test";

const BASE = "http://localhost:1983";

test.describe("App shell", () => {
  test("loads the page and shows the editor", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("#editor")).toBeVisible();
    await expect(page.locator("#runBtn")).toBeVisible();
  });

  test("sidebar is visible by default", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("#sidebar")).toBeVisible();
  });

  test("can collapse and re-open the sidebar", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#sidebarCollapse");
    await expect(page.locator("#sidebar")).not.toBeVisible();
    await page.click("#sidebarShowBtn");
    await expect(page.locator("#sidebar")).toBeVisible();
  });
});

test.describe("Theme toggle", () => {
  test("dark theme is the default", async ({ page }) => {
    await page.goto(BASE);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("dark");
  });

  test("clicking theme button toggles to light", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#themeBtn");
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("light");
  });

  test("clicking theme button again returns to dark", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#themeBtn");
    await page.click("#themeBtn");
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("dark");
  });
});

test.describe("Tab management", () => {
  test("starts with at least one tab", async ({ page }) => {
    await page.goto(BASE);
    const tabs = page.locator(".tab");
    await expect(tabs.first()).toBeVisible();
  });

  test("can add a new tab", async ({ page }) => {
    await page.goto(BASE);
    const before = await page.locator(".tab").count();
    await page.click("#addTabBtn");
    const after = await page.locator(".tab").count();
    expect(after).toBe(before + 1);
  });

  test("can close a tab (when more than one exists)", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#addTabBtn");
    const before = await page.locator(".tab").count();
    await page.locator(".tab-close").first().click();
    const after = await page.locator(".tab").count();
    expect(after).toBe(before - 1);
  });

  test("cannot close the last remaining tab", async ({ page }) => {
    await page.goto(BASE);
    // Ensure only one tab exists
    while (await page.locator(".tab").count() > 1) {
      await page.locator(".tab-close").first().click();
    }
    await page.locator(".tab-close").first().click();
    await expect(page.locator(".tab")).toHaveCount(1);
  });
});

test.describe("Connection modal", () => {
  test("opens connection modal on + button click", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#newConnBtn");
    await expect(page.locator("#connModal")).toBeVisible();
  });

  test("closes modal on X button click", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#newConnBtn");
    await page.click("#connModalClose");
    await expect(page.locator("#connModal")).not.toBeVisible();
  });

  test("closes modal on backdrop click", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#newConnBtn");
    await page.mouse.click(10, 10);
    await expect(page.locator("#connModal")).not.toBeVisible();
  });

  test("switches to MongoDB mode hides port/credentials", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#newConnBtn");
    await page.selectOption("#mDbType", "mongodb");
    await expect(page.locator("#mPortField")).not.toBeVisible();
    await expect(page.locator("#mCredFields")).not.toBeVisible();
  });
});

test.describe("Editor", () => {
  test("Tab key inserts 2 spaces when autocomplete is hidden", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#editor");
    await page.keyboard.press("Tab");
    const value = await page.locator("#editor").inputValue();
    expect(value).toBe("  ");
  });

  test("Format button reformats SQL", async ({ page }) => {
    await page.goto(BASE);
    await page.fill("#editor", "select id,name from users where id=1");
    await page.click("#formatBtn");
    const value = await page.locator("#editor").inputValue();
    expect(value).toContain("SELECT");
    expect(value).toContain("FROM");
    expect(value).toContain("WHERE");
  });
});

test.describe("Query history", () => {
  test("history panel opens on button click", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#historyBtn");
    await expect(page.locator("#qhistPanel")).toBeVisible();
  });

  test("history panel closes on X click", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#historyBtn");
    await page.click("#qhistClose");
    await expect(page.locator("#qhistPanel")).not.toBeVisible();
  });
});

test.describe("Lock screen", () => {
  test("lock button shows lock screen", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#lockBtn");
    await expect(page.locator("#lockScreen")).toBeVisible();
  });

  test("lock screen shows setup hint when no PIN is set", async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.removeItem("bsql_lock_pin_hash"));
    await page.click("#lockBtn");
    await expect(page.locator("#lockSetupHint")).toBeVisible();
  });
});
