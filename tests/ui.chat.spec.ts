import { expect, test } from "@playwright/test";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

test("user can sign in, chat, refresh, and sign out", async ({ page }) => {
  const testEmail = required("TEST_USER_EMAIL");
  const testPassword = required("TEST_USER_PASSWORD");
  const uniqueMessage = `ui-check-${Date.now()}`;

  await page.goto("/");

  await page.getByLabel("Email").fill(testEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Signed in as", { exact: false })).toBeVisible();

  await page.getByLabel("Message").fill(uniqueMessage);

  const chatResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/chat") && response.request().method() === "POST"
  );

  await page.getByRole("button", { name: "Send" }).click();

  const chatResponse = await chatResponsePromise;
  expect(chatResponse.status()).toBe(200);

  const userMessageBubble = page
    .locator(".bubble.user")
    .filter({ hasText: uniqueMessage })
    .first();

  await expect(userMessageBubble).toBeVisible();
  await expect(
    page.locator(".bubble").filter({ hasText: "assistant:" }).last()
  ).toBeVisible();

  await page.reload();
  await expect(userMessageBubble).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Sign in or create an account.")).toBeVisible();
});
