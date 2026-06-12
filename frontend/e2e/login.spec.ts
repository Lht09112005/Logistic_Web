import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
  });

  test("should display the login form correctly", async ({ page }) => {
    // Title
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();

    // Form fields
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();

    // Submit button
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();

    // Forgot password link
    await expect(page.getByText("Quên mật khẩu?")).toBeVisible();

    // Register link
    await expect(page.getByText("Đăng ký ngay")).toBeVisible();
  });

  test("should show 4 role quick-login buttons", async ({ page }) => {
    const roles = ["Quản trị viên", "Quản lý kho (HCM)", "Nhân viên", "Tài xế"];
    for (const role of roles) {
      await expect(page.getByText(role, { exact: false })).toBeVisible();
    }
  });

  test("should display role badges (ADMIN, MANAGER, STAFF, DRIVER)", async ({ page }) => {
    const badges = ["ADMIN", "MANAGER", "STAFF", "DRIVER"];
    for (const badge of badges) {
      await expect(page.getByText(badge, { exact: true }).first()).toBeVisible();
    }
  });

  test("should not submit form with invalid email", async ({ page }) => {
    const emailInput = page.locator("#login-email");
    const passwordInput = page.locator("#login-password");

    await emailInput.fill("not-an-email");
    await passwordInput.fill("123456");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    // Ensure form did not submit (still on login page)
    await expect(page).toHaveURL(/\/auth\/login$/);
    // Form fields should still contain the filled values
    await expect(emailInput).toHaveValue("not-an-email");
  });

  test("should show validation error for short password", async ({ page }) => {
    const emailInput = page.locator("#login-email");
    const passwordInput = page.locator("#login-password");

    await emailInput.fill("admin@logistiq.vn");
    await passwordInput.fill("12");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByText("Mật khẩu ít nhất 6 ký tự")).toBeVisible();
    // Ensure form did not submit (still on login page)
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test("should fill credentials when clicking a role button", async ({ page }) => {
    // Click the ADMIN role button (first role card)
    await page.getByText("Quản trị viên").first().click();

    // Email should be filled
    const emailInput = page.locator("#login-email");
    await expect(emailInput).toHaveValue("admin@logistiq.vn");

    // Password should be filled
    const passwordInput = page.locator("#login-password");
    await expect(passwordInput).toHaveValue("admin123");
  });

  test("should toggle password visibility", async ({ page }) => {
    const passwordInput = page.locator("#login-password");

    // Initially type should be "password"
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the toggle button (sibling of password input inside the .relative parent div)
    await page.locator("#login-password ~ button").click();

    // Type should switch to "text"
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click again to toggle back
    await page.locator("#login-password ~ button").click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("should link to forgot-password page", async ({ page }) => {
    await page.getByText("Quên mật khẩu?").click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
  });

  test("should link to register page", async ({ page }) => {
    await page.getByText("Đăng ký ngay").click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });
});
