import { expect, test, viewAsCandidate } from "./support";

// Test IDs refer to the "Test cases" tab of the manual test script.

test("NAV-03 Settings is for admins only", async ({ page, as }) => {
  await as("p04");
  await page.goto("/settings");
  await expect(page.getByText("Only admins can manage groups and access.")).toBeVisible();
});

test("AGT-05 agent phone numbers are masked", async ({ page, as }) => {
  await as("p04");
  await page.goto("/agents");
  await expect(page.getByText("+234******0020")).toBeVisible();
  await expect(page.getByText("+2348000000020")).toHaveCount(0);
});

test("SEC-03 P08 sees Lagos agents of every group, nothing outside Lagos", async ({ page, as }) => {
  await as("p08");
  await page.goto("/agents");
  const table = page.getByRole("table");
  await expect(table.getByText("Tunde Agent")).toBeVisible();
  await expect(table.getByText("Zainab Obedient Agent")).toBeVisible();
  await expect(page.getByText("Fixture Agent F")).toHaveCount(0);
});

test("SEC-04 P09 (Kano) sees no Lagos agents", async ({ page, as }) => {
  await as("p09");
  await page.goto("/agents");
  await expect(page.getByText("Tunde Agent")).toHaveCount(0);
});

test("AGT-06 a candidate view has no bulk export", async ({ page, as, baseURL }) => {
  // Known gap: "Export CSV" shows on the Agents page for every view. Remove test.fail() once
  // candidate views hide it (PRD §8, ARCH §9).
  test.fail();
  await as("p01");
  await page.goto("/agents");
  await viewAsCandidate(page, baseURL as string, "p16");
  await page.reload();
  await expect(page.getByRole("table").getByText("Tunde Agent")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
});

test("NAV-02 pages fit a phone screen without sideways scrolling @phone", async ({ page, as }) => {
  await as("p04");
  for (const path of ["/coverage", "/candidates", "/agents", "/broadcasts/new"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
  }
});
