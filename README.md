# Chatbot Starter (Supabase + OpenRouter)

Minimal chat app with:
- Supabase auth (email/password)
- Supabase database for chat history
- OpenRouter API for responses
- Next.js App Router

## 1) Environment variables

Create `.env.local` (already stubbed) and fill:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENROUTER_API_KEY=
```

## 2) Supabase setup

1. Create a new Supabase project.
2. Go to **Authentication ? Providers** and enable **Email**.
3. Create the `messages` table and policies using the SQL below.

### SQL

```
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

```
npm run dev
```

Open `http://localhost:3000`.

## Notes

- If email confirmation is enabled in Supabase, you will need to confirm the email before sign-in works.
- The OpenRouter model is set to `openrouter/auto` for convenience. You can change it in `src/app/api/chat/route.ts`.
