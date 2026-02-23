# Chatbot Starter (Supabase + OpenRouter)

Minimal chat app with:
- Supabase auth (email/password)
- Supabase database for chat history
- OpenRouter API for responses (tool-call enforced)
- Next.js App Router

## 1) Environment variables

Create `.env.local` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENROUTER_API_KEY=
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
TEST_BASE_URL=http://127.0.0.1:3000
```

## 2) Supabase setup

1. Create a new Supabase project.
2. Go to `Authentication -> Providers` and enable `Email`.
3. Create the `messages` table and policies using the SQL below.

### SQL

```sql
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can read their own messages"
  on public.messages
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own messages"
  on public.messages
  for insert
  with check (auth.uid() = user_id);
```

## 3) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## 4) OpenRouter tool schema (enforced)

`src/app/api/chat/route.ts` forces a tool call with this schema:

```json
{
  "type": "function",
  "function": {
    "name": "final_response",
    "description": "Return the assistant reply for the user.",
    "parameters": {
      "type": "object",
      "properties": {
        "reply": {
          "type": "string",
          "description": "The final assistant response to display to the user."
        }
      },
      "required": ["reply"],
      "additionalProperties": false
    }
  }
}
```

## 5) Integration tests (real calls)

Install browsers once:

```bash
npx playwright install
```

Run tests:

```bash
npm run test:integration
```

These tests execute:
- real Supabase sign-in
- real `/api/chat` API call
- real UI login/chat/refresh/logout flow

## 6) Codex skills

Custom skills created in `C:/Users/adity/.codex/skills/`:
- `chatbot-bootstrap`
- `chatbot-integration-tests`

Restart Codex to load newly added skills.
