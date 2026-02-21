import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Missing Supabase environment variables." },
      { status: 500 }
    );
  }

  if (!openRouterKey) {
    return NextResponse.json(
      { error: "Missing OpenRouter API key." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = authHeader.slice("Bearer ".length);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { message?: string };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("messages").insert([
    {
      user_id: user.id,
      role: "user",
      content: message,
    },
  ]);

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save user message." },
      { status: 500 }
    );
  }

  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(20);

  if (historyError) {
    return NextResponse.json(
      { error: "Failed to load chat history." },
      { status: 500 }
    );
  }

  const aiResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "X-Title": "mamedov-internship-app",
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages: history ?? [],
      }),
    }
  );

  const aiJson = await aiResponse.json();
  if (!aiResponse.ok) {
    return NextResponse.json(
      {
        error: "OpenRouter request failed.",
        details: aiJson,
      },
      { status: 500 }
    );
  }

  const reply = aiJson?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return NextResponse.json(
      { error: "No reply returned by OpenRouter." },
      { status: 500 }
    );
  }

  const { error: insertAssistantError } = await supabase
    .from("messages")
    .insert([
      {
        user_id: user.id,
        role: "assistant",
        content: reply,
      },
    ]);

  if (insertAssistantError) {
    return NextResponse.json(
      { error: "Failed to save assistant message." },
      { status: 500 }
    );
  }

  return NextResponse.json({ reply });
}
