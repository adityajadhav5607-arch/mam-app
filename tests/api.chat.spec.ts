import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

test("POST /api/chat uses real auth and returns persisted reply", async ({ request }) => {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const testEmail = required("TEST_USER_EMAIL");
  const testPassword = required("TEST_USER_PASSWORD");

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  expect(signInError?.message ?? null).toBeNull();

  const accessToken = signInData.session?.access_token;
  const userId = signInData.user?.id;
  expect(accessToken).toBeTruthy();
  expect(userId).toBeTruthy();

  const chatResponse = await request.post("/api/chat", {
    data: {
      message: `integration-check-${Date.now()}`,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  expect(chatResponse.status(), "Expected successful chat completion").toBe(200);

  const chatJson = (await chatResponse.json()) as { reply?: string };
  expect(typeof chatJson.reply).toBe("string");
  expect(chatJson.reply?.trim().length).toBeGreaterThan(0);

  const { data: storedMessages, error: selectError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(2);

  expect(selectError?.message ?? null).toBeNull();
  expect(storedMessages?.some((msg) => msg.role === "assistant")).toBeTruthy();
});
