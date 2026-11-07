import { expect, test, viewAsCandidate } from "./support";

// Test IDs refer to the "Test cases" tab of the manual test script.

test("HOME-04 P04 sees Lagos coverage: 3 of 5, 2 extra agents", async ({ page, as }) => {
  await as("p04");
  await page.goto("/coverage");
  await expect(page.getByText("3 of 5 covered")).toBeVisible();
  await expect(page.getByText("Extra Agents", { exact: true })).toBeVisible();
});

test("HOME-03 P05 sees Ikeja coverage: 2 of 4", async ({ page, as }) => {
  await as("p05");
  await page.goto("/coverage");
  await expect(page.getByText("2 of 4 covered")).toBeVisible();
});

test("HOME-05 P01 sees national coverage: 5 of 8 @phone", async ({ page, as }) => {
  await as("p01");
  await page.goto("/coverage");
  await expect(page.getByText("5 of 8 covered")).toBeVisible();
});

test("CAND-06 P16's row shows +1 extra agent of their own", async ({ page, as }) => {
  await as("p04");
  await page.goto("/candidates");
  const row = page.getByRole("row").filter({ hasText: "Peju Reps" });
  await expect(row).toContainText("2 of 4 (50%)");
  await expect(row).toContainText("+1");
});

test("CAND-04 running mates sit under their principal", async ({ page, as }) => {
  await as("p01");
  await page.goto("/candidates");
  await expect(page.getByRole("row").filter({ hasText: "Lola Governor" })).toContainText(/\(Deputy\)/);
});

test("NAV-04 viewing as P16 limits coverage to Ikeja", async ({ page, as, baseURL }) => {
  await as("p01");
  await page.goto("/coverage");
  await viewAsCandidate(page, baseURL as string, "p16");
  await page.reload();
  await expect(page.getByText("2 of 4 covered")).toBeVisible();
  await page.goto("/candidates");
  await expect(page.getByText("Jide President")).toHaveCount(0);
  await expect(page.getByText("Lola Governor")).toHaveCount(0);
});
