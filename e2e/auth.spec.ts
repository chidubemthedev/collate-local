import { expect, plantOtp, personaEmail, test } from "./support";

// Test IDs refer to the "Test cases" tab of the manual test script.

// A production server refuses the console code sender (lib/auth/sender.ts), so the tests that
// type a code into the login form run against `next dev` only (npm run test:e2e locally).
const formLogin = process.env.E2E_PRODUCTION === "true" ? test.skip : test;

test("ONB-01 there is no public sign-up", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("name@example.com")).toBeVisible();
  const signUp = /sign ?up|register|create (an )?account/i;
  await expect(page.getByRole("link", { name: signUp })).toHaveCount(0);
  await expect(page.getByRole("button", { name: signUp })).toHaveCount(0);

  for (const path of ["/signup", "/register"]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should not exist`).toBe(404);
  }
});

formLogin("ONB-03 P04 signs in with an email code and lands on their coverage", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("name@example.com").fill(personaEmail("p04"));
  await page.getByRole("button", { name: /send verification code/i }).click();
  await expect(page.getByLabel("Digit 1 of 6")).toBeVisible();

  // The real code went to the console sender; plant a newer one the test knows.
  await plantOtp("p04", "424242");
  for (const [index, digit] of [..."424242"].entries()) {
    await page.getByLabel(`Digit ${index + 1} of 6`).fill(digit);
  }
  await page.getByRole("button", { name: /verify & sign in/i }).click();

  await expect(page).toHaveURL(/\/coverage/);
  await expect(page.getByText("3 of 5 covered")).toBeVisible();
});

formLogin("ONB-05 a wrong code is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("name@example.com").fill(personaEmail("p05"));
  await page.getByRole("button", { name: /send verification code/i }).click();
  await plantOtp("p05", "111111");
  for (const [index, digit] of [..."999999"].entries()) {
    await page.getByLabel(`Digit ${index + 1} of 6`).fill(digit);
  }
  await page.getByRole("button", { name: /verify & sign in/i }).click();
  await expect(page).toHaveURL(/\/login/);
});

formLogin("ONB-13 the login form does not reveal whether an email is registered", async ({ page }) => {
  // Known gap: today an unknown email gets "This email is not registered…". Remove test.fail()
  // once unknown and known emails get the same answer (PRD §8).
  test.fail();
  await page.goto("/login");
  await page.getByPlaceholder("name@example.com").fill("nobody@fixture.collate.test");
  await page.getByRole("button", { name: /send verification code/i }).click();
  await expect(page.getByLabel("Digit 1 of 6")).toBeVisible();
});

test("ONB-15 after logging out, pages need a new login", async ({ page, as }) => {
  await as("p04");
  await page.goto("/agents");
  await expect(page.getByRole("table").getByText("Tunde Agent")).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/agents");
  await expect(page.getByText("Tunde Agent")).toHaveCount(0);
});
