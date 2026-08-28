import { expect, test } from "@playwright/test";

test("home page shows Course Memo landing", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "AI-помічник з пам'яттю курсу",
  );
  await expect(page.getByText("Course Memo")).toBeVisible();
});
