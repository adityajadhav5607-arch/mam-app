import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;

const replyTool = {
  type: "function",
  function: {
    name: "final_response",
    description: "Return the assistant reply for the user.",
    parameters: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description: "The final assistant response to display to the user.",
        },
      },
      required: ["reply"],
      additionalProperties: false,
    },
  },
} as const;

type OpenRouterToolCall = {
  function?: {
    name?: string;
    arguments?: string;
  };
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: OpenRouterToolCall[];
    };
  }>;
};

function parseReplyFromToolCall(payload: OpenRouterResponse): string | null {
  const firstToolCall = payload.choices?.[0]?.message?.tool_calls?.[0];
  const name = firstToolCall?.function?.name;
  const argsText = firstToolCall?.function?.arguments;

  if (name !== "final_response" || !argsText) {
    return null;
  }

  try {
    const args = JSON.parse(argsText) as { reply?: unknown };
    if (typeof args.reply === "string" && args.reply.trim()) {
      return args.reply.trim();
    }
    return null;
  } catch {
    return null;
  }
}

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

  const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openRouterKey}`,
      "X-Title": "mamedov-internship-app",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        {
          role: "system",
          content:
            "Always call the final_response tool exactly once to answer the user.",
        },
        ...(history ?? []),
      ],
      tools: [replyTool],
      tool_choice: {
        type: "function",
        function: { name: "final_response" },
      },
    }),
  });

  const aiJson = (await aiResponse.json()) as OpenRouterResponse;
  if (!aiResponse.ok) {
    return NextResponse.json(
      {
        error: "OpenRouter request failed.",
        details: aiJson,
      },
      { status: 500 }
    );
  }

  const reply = parseReplyFromToolCall(aiJson);
  if (!reply) {
    return NextResponse.json(
      {
        error: "Model did not return a valid tool call reply.",
        details: aiJson,
      },
      { status: 500 }
    );
  }

  const { error: insertAssistantError } = await supabase.from("messages").insert([
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

  return NextResponse.json({ reply, tool_schema: replyTool });
}
