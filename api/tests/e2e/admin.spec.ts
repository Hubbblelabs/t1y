// Playwright runs specs in worker processes that do not inherit the config's
// side-effect imports, so the seeded password has to be loaded here too.
import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

/**
 * The core administrator journey, plus the access-control boundaries.
 *
 * Requires a seeded development database. Credentials come from the seed's
 * `SEED_DEFAULT_PASSWORD`, which defaults to the value below.
 */

const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe!2024";

const ACCOUNTS = {
  admin: "admin@example.com",
  researcher: "researcher@example.com",
} as const;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/(dashboard|participants)/, { timeout: 30_000 });
}

test.describe("authentication", () => {
  test("redirects an anonymous visitor from a protected page to the login form", async ({
    page,
  }) => {
    await page.goto("/admin/participants");

    await expect(page).toHaveURL(/\/admin\/login/);
    // The original destination is preserved so login can return there.
    expect(page.url()).toContain("next=");
  });

  test("rejects an incorrect password without revealing whether the account exists", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(ACCOUNTS.admin);
    await page.getByLabel(/password/i).fill("definitely-not-the-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    const error = page.getByRole("alert");
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expect(error).not.toContainText(/no account|not found|unknown user/i);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("signs in and reaches the dashboard", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);

    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("signs out and can no longer reach a protected page", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);

    await page.getByRole("button", { name: /account menu|profile|signed in/i }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    await page.waitForURL(/\/admin\/login/, { timeout: 30_000 });

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("participant workflow", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
  });

  test("dashboard shows the platform overview", async ({ page }) => {
    await expect(page.getByText(/total participants/i)).toBeVisible();
    await expect(page.getByText(/adherence/i).first()).toBeVisible();
  });

  test("lists, searches and opens a participant", async ({ page }) => {
    await page.getByRole("link", { name: /participants/i }).first().click();
    await page.waitForURL(/\/admin\/participants/);

    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 20_000 });

    // Capture a participant code from the first row, then search for it.
    const firstCode = await page
      .getByRole("cell")
      .filter({ hasText: /^P\d{3,}$/ })
      .first()
      .innerText();

    await page.getByRole("searchbox").fill(firstCode);
    await page.waitForTimeout(1200); // debounce
    await expect(page.getByText(firstCode).first()).toBeVisible();

    await page.getByRole("link", { name: new RegExp(firstCode) }).first().click();
    await page.waitForURL(/\/admin\/participants\/[^/]+$/);

    await expect(page.getByText(firstCode).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /glucose/i })).toBeVisible();
  });

  test("participant detail exposes each health domain", async ({ page }) => {
    await page.goto("/admin/participants");
    await page.getByRole("table").waitFor({ timeout: 20_000 });
    await page.getByRole("link", { name: /^P\d{3,}/ }).first().click();
    await page.waitForURL(/\/admin\/participants\/[^/]+$/);

    for (const tab of [/glucose/i, /medication/i, /insulin/i, /exercise/i, /hba1c/i]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
  });

  test("filters do not break the table", async ({ page }) => {
    await page.goto("/admin/participants");
    await page.getByRole("table").waitFor({ timeout: 20_000 });

    await page.getByRole("searchbox").fill("zzz-no-such-participant-zzz");
    await page.waitForTimeout(1200);

    // An empty result must be an explained empty state, not a blank page.
    await expect(page.getByText(/no participants/i)).toBeVisible({ timeout: 15_000 });
  });

  test("reports page renders", async ({ page }) => {
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe("role boundaries", () => {
  test("a researcher cannot reach the administrators page", async ({ page }) => {
    await signIn(page, ACCOUNTS.researcher);

    await page.goto("/admin/admins");

    // Either forbidden, or redirected away — never the staff list itself.
    await expect(
      page.getByText(/not have permission|forbidden|access denied/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("a researcher does not see staff-only navigation", async ({ page }) => {
    await signIn(page, ACCOUNTS.researcher);

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /administrators/i })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /audit logs/i })).toHaveCount(0);
  });
});

test.describe("API access control", () => {
  test("an unauthenticated API call returns 401 JSON, not an HTML redirect", async ({
    request,
  }) => {
    const response = await request.get("/api/glucose");

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");

    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  test("an unauthenticated admin API call returns 401", async ({ request }) => {
    const response = await request.get("/api/admin/participants");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("responses carry the security headers", async ({ request }) => {
    const response = await request.get("/api/glucose");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["cache-control"]).toContain("no-store");
  });
});
