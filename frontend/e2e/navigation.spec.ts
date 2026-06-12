import { test, expect } from "@playwright/test";

test.describe("Navigation & Static Pages", () => {
  test("should redirect root / to /auth/login", async ({ page }) => {
    test.slow();
    await page.goto("/");
    await page.waitForURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  });

  test("should display custom 404 page for unknown routes", async ({ page }) => {
    await page.goto("/some-non-existent-page-xyz");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("Trang không tìm thấy")).toBeVisible();
  });

  test('404 page should have "Quay lại" and "Về trang chủ" buttons', async ({ page }) => {
    await page.goto("/nonexistent-route");
    // 404 buttons — use role selectors for uniqueness
    await expect(page.getByRole("link", { name: /Quay lại/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Về trang chủ/i })).toBeVisible();
  });

  test('should navigate from 404 back to login via "Quay lại"', async ({ page }) => {
    await page.goto("/broken-page");
    await page.getByText("Quay lại").click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("should display the offline page", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByText("Mất kết nối mạng")).toBeVisible();
    await expect(page.getByText("Thử lại")).toBeVisible();
    await expect(page.getByText("Về bảng điều khiển")).toBeVisible();
  });

  test("should display the register page", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.getByRole("heading", { name: "Tạo tài khoản" })).toBeVisible();
  });

  test("should display the forgot-password page", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(page.getByText("Quên mật khẩu")).toBeVisible();
  });
});
