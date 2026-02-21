"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      if (data.session) {
        loadMessages(data.session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadMessages(newSession.user.id);
      } else {
        setMessages([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadMessages(userId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      setStatus("Failed to load messages.");
      return;
    }

    setMessages(data ?? []);
  }

  async function handleSignUp() {
    setAuthLoading(true);
    setStatus(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Check your email for a confirmation link (if enabled).");
    }

    setAuthLoading(false);
  }

  async function handleSignIn() {
    setAuthLoading(true);
    setStatus(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus(error.message);
    }

    setAuthLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleSend() {
    if (!input.trim()) return;

    setSending(true);
    setStatus(null);

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken || !data.session) {
      setStatus("You must be signed in.");
      setSending(false);
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message: userMessage.content }),
    });

    const json = await response.json();
    if (!response.ok) {
      setStatus(json?.error ?? "Chat request failed.");
      setSending(false);
      return;
    }

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: json.reply,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setSending(false);
  }

  return (
    <main>
      <h1>Chatbot Starter</h1>

      {!session ? (
        <section className="card">
          <div className="meta">Sign in or create an account.</div>
          <div className="row">
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
              />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={handleSignIn} disabled={authLoading}>
              Sign in
            </button>
            <button onClick={handleSignUp} disabled={authLoading}>
              Sign up
            </button>
          </div>
          {status && <div className="meta">{status}</div>}
        </section>
      ) : (
        <section className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="meta">Signed in as {session.user.email}</div>
            <button onClick={handleSignOut}>Sign out</button>
          </div>

          <div className="chat-list">
            {messages.length === 0 && (
              <div className="meta">No messages yet.</div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`bubble ${message.role === "user" ? "user" : ""}`}
              >
                <strong>{message.role}</strong>: {message.content}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Say something..."
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={handleSend} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
          {status && <div className="meta">{status}</div>}
        </section>
      )}
    </main>
  );
}
