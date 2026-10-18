import { expect, test } from "@playwright/test";

test("home page shows Course Memo landing", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "An assistant with course memory",
  );
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});
