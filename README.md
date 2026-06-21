# Milestones

Baby tracking app built with Expo (SDK 54) and Supabase. Parents log daily activities, milestones, and memories through a conversational assistant and dedicated tabs.

## Features

- **Assistant (Chat)** — natural-language logging via Claude (nappy, feeds, sleep, milestones, memories)
- **Memories** — chronological photo memories with tags
- **Journey** — unified timeline of milestones and memories
- **Milestones** — editable milestone records with photos and share cards

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment — create `.env` with your Supabase project URL and anon key (see `.env.example` if present).

3. Run database migrations — apply `supabase/migrations/003_memories_and_chat.sql` in the Supabase SQL editor (or via `supabase db push`).

4. Deploy the chat edge function

   ```bash
   npx supabase functions deploy chat
   npx supabase secrets set ANTHROPIC_API_KEY=your_key_here
   ```

5. Start the app

   ```bash
   npx expo start
   ```

## Chat assistant — cost optimisations

The assistant is designed to minimise Anthropic API usage:

| Optimisation | Behaviour |
| --- | --- |
| **3s debounce** | Rapid messages within 3 seconds are batched into one API call |
| **10-message context** | Only the last 10 messages are sent to Claude; UI loads full history by day |
| **Haiku / Sonnet routing** | Text-only → `claude-haiku-4-5`; messages with photos → `claude-sonnet-4-6` |
| **Intent parser** | Simple phrases (`"120ml"`, `"wet nappy"`, `"nap"`) bypass Claude entirely |
| **Activity tool shortcut** | Meal/nappy/sleep logs skip the second Claude turn; server returns confirmation |
| **Prompt caching** | System prompt and tool definitions are cached across requests |
| **Quick-log chips** | One-tap chips above the chat input for common activities |

## Project structure

```
app/                  Expo Router screens (tabs, memory, milestone)
components/           UI components (chat, journey, memories)
hooks/                React hooks (use-chat, use-memories, use-journey-timeline)
services/             Supabase data layer
supabase/
  functions/chat/     Claude edge function + intent parser
  migrations/         Database schema
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
