# Milestones

Baby tracking app built with Expo (SDK 54) and Supabase. Parents log daily activities, milestones, and memories through a conversational assistant and dedicated tabs.

## Features

- **Assistant (Chat)** — natural-language logging via Claude (nappy, feeds, sleep, milestones, memories) with photo support
- **Quick-log tooltips** — tap `+ Log` on the home screen for instant in-place logging without leaving the page
- **Home activity feed** — today's events with accurate sleep duration labels and edit/delete support
- **Memories** — chronological photo memories with tags
- **Journey** — unified timeline of milestones and memories with correct sleep duration display
- **Milestones** — editable milestone records with photos and share cards

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment — create `.env` with your Supabase project URL and anon key (see `.env.example` if present).

3. Run database migrations — apply migrations in `supabase/migrations/` in order (especially `003_memories_and_chat.sql` and `004_chat_media_storage.sql`) in the Supabase SQL editor (or via `supabase db push`).

4. Deploy the chat edge function

   ```bash
   npx supabase functions deploy chat
   npx supabase secrets set ANTHROPIC_API_KEY=your_key_here
   ```

5. Start the app

   ```bash
   npm run start
   ```

   Clear Metro cache:

   ```bash
   npm run start:clear
   ```

## Troubleshooting

### `TypeError: fetch failed` when starting Expo

Expo CLI tries to reach `https://api.expo.dev` on startup to validate package versions. On some networks (VPN, corporate proxy, firewall) that request fails — even though Metro and the app work fine locally.

**Fix (recommended):** add this to your `.env`:

```
EXPO_OFFLINE=1
```

Or run with the offline flag directly:

```powershell
npx expo start --offline -c
```

The npm scripts already use `--offline` by default (`npm run start`). Use `npm run start:online` only when you need Expo’s remote version checks.

**Also check:**

- Turn off VPN / corporate proxy temporarily
- Kill a stale Metro process holding port 8081: `Stop-Process -Name node -Force` (then restart)
- Test reachability: `curl https://api.expo.dev`


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

## Quick-log tooltips

Tapping `+ Log` on any activity card on the home screen opens a compact tooltip bubble directly below the button — no page navigation required.

| Activity | Options |
| --- | --- |
| **Nappy** | Wet / Dirty / Both — drag your finger across chips to select |
| **Meal** | Breast / Bottle / Solid / Snack — Breast & Bottle reveal an amount slider (0–500 ml, 10 ml steps) with a "No Amount" option |
| **Sleep** | Editable time pill; pre-filled to now. In wake-up mode shows separate Start and End time pills with live duration display |

## Editing and deleting events

Long-press or use the edit icon on any event in the home activity feed or journey timeline to open the `EditEventModal`. You can update the time, type-specific fields (nappy type, meal amount, sleep end time) or delete the event entirely.

## Project structure

```
app/                  Expo Router screens (tabs, memory, milestone)
components/
  chat/               Chat bubble, input bar, quick-log chips
  events/             EditEventModal (edit/delete any logged event)
  home/               QuickLogCard (tooltip), TodayFeed, SleepBox
  journey/            Timeline with sleep duration labels
  memories/           Memory card and grid
hooks/                React hooks (use-chat, use-memories, use-journey-timeline)
services/             Supabase data layer (events, media, memories)
supabase/
  functions/chat/     Claude edge function + intent parser
  migrations/         Database schema (001–004)
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
