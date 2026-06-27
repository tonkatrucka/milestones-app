# Milestones

Baby tracking app built with Expo (SDK 54) and Supabase. Parents log daily activities, milestones, and memories through a conversational assistant and dedicated tabs.

## Features

- **Assistant (Chat)** — natural-language logging via Claude (nappy, feeds, sleep, milestones, memories) with photo support
- **Quick-log tooltips** — tap `+ Log` on the home screen for instant in-place logging without leaving the page
- **Home activity feed** — today's events with accurate sleep duration labels and edit/delete support
- **Memories** — chronological photo memories with tags
- **Journey** — unified timeline of milestones and memories with correct sleep duration display
- **Milestones** — editable milestone records with photos and share cards
- **Insights** — daily AI observations (one Haiku call per child per day) plus research dot-points from a pre-generated bank with regional preference and novelty rotation

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment — create `.env` with your Supabase project URL and anon key (see `.env.example` if present).

3. Run database migrations — apply migrations in `supabase/migrations/` in order (through `017_transfer_child_ownership.sql`) in the Supabase SQL editor (or via `supabase db push`). See [Database migrations](#database-migrations) below.

4. Deploy edge functions

   ```bash
   npx supabase functions deploy chat insights research-refresh
   npx supabase secrets set ANTHROPIC_API_KEY=your_key_here
   # Optional cron auth for research-refresh:
   npx supabase secrets set CRON_SECRET=your_cron_secret
   ```

5. Bootstrap research bank — **one time only** (optional for production; dev seed has 12 bullets)

   **Automated (recommended):** GitHub → Actions → **Research one-time bootstrap** → Run workflow  
   (needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` repo secrets; ~2–4 hours)

   **Or locally once:**

   ```bash
   npx supabase functions deploy research-refresh
   npm run bootstrap:research -- --all
   ```

   After bootstrap completes, **ongoing maintenance is automatic** — weekly append and monthly hygiene run via GitHub Actions. You do not need to run the script again unless you reset the database.

6. Start the app

   ```bash
   npm run start
   ```

   Clear Metro cache:

   ```bash
   npm run start:clear
   ```

## Settings and team management

The **Settings** tab supports:

- **Child profile** — edit name, date of birth, and avatar
- **Team** — invite caregivers/viewers, change roles, remove members, revoke pending invites
- **Transfer ownership** — hand a child profile to another team member (owner only)
- **Delete child profile** — removes the child and associated data (owner only)
- **Delete account** — self-service removal of owned profiles, storage files, memberships, and auth user
- **Theme** — system / light / dark preference

Team invites use shareable deep links (`milestones://` / web fallback).

## Media and storage

Photos are stored in Supabase Storage with hardened access controls (migrations `014`–`015`):

| Bucket | Access | Notes |
| --- | --- | --- |
| `chat-media` | Private — signed URLs | Chat images; team members only |
| `milestone-media` | Public bucket, opaque paths | Memories, milestones, avatars |

The app stores `storage://bucket/path` references in the database and resolves signed URLs at display time (`lib/media-ref.ts`, `ResolvedImage`, `useResolvedMediaUrls`). Legacy public URLs still work for existing uploads.

Auth sessions use **expo-secure-store** (chunked on Android) via `lib/supabase-storage.ts`.

## Database migrations

| Migration | Purpose |
| --- | --- |
| `012_children_select_created_by` | Fix child visibility for creators during onboarding |
| `013_fix_child_members_insert` | Fix team member insert policies |
| `014_fix_storage_policies` | Restrict storage writes to owners/caregivers |
| `015_storage_opaque_paths_and_private_chat` | Private chat bucket; opaque milestone paths |
| `016_delete_my_account` | `delete_my_account()` RPC for self-service account removal |
| `017_transfer_child_ownership` | `transfer_child_ownership()` RPC for profile handoff |

After pulling schema changes:

```bash
npx supabase db push
```

## Deploying to testers (Android & iOS)

Store builds use EAS with the `preview` profile:

```powershell
npx eas-cli@latest build --platform all --profile preview
npx eas-cli@latest submit --platform android --profile preview --latest
npx eas-cli@latest submit --platform ios --profile preview --latest
```

Before the first store build, push Supabase credentials to EAS:

```powershell
npm run setup:eas-secrets
```

Full step-by-step instructions (Play Internal Testing, TestFlight, Apple API keys, troubleshooting): **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

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

## Insights tab

The Insights tab combines two sources:

| Source | Cost | Behaviour |
| --- | --- | --- |
| **Daily observation** | 1 Haiku call / child / calendar day | Cached in `child_insights`; stable for the rest of the day |
| **Research bullets** | 0 LLM on tab visit | 5–7 bullets/day from `research_bullets`, selected with novelty + regional tiebreak |

### Deploy & verify

```bash
npx supabase db push
npx supabase functions deploy insights research-refresh
npm run verify:insights      # fingerprint + JSON shape checks
npm run audit:research       # source URL allowlist audit
```

### Research bank maintenance

| When | What | How |
| --- | --- | --- |
| **Once** (production) | Fill ~1,050 research bullets | GitHub Actions → **Research one-time bootstrap** |
| **Weekly** (automatic) | Append new bullets to under-covered packs | `research-cron-weekly.yml` — Sunday 03:00 UTC |
| **Monthly** (automatic) | URL audit, stale review, replacements | `research-cron-hygiene.yml` — first Sunday 05:00 UTC |
| **Dev / testing** | Skip bootstrap | Migration `011` seeds 12 bullets — Insights tab works |

Manual scripts (`npm run bootstrap:research`) are for local debugging or if you prefer not to use GitHub Actions for the one-time fill.

GitHub Actions needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` repository secrets.

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
  children/           Child avatar picker/display
  events/             EditEventModal (edit/delete any logged event)
  home/               QuickLogCard (tooltip), TodayFeed, SleepBox
  journey/            Timeline with sleep duration labels
  media/              ResolvedImage (signed URL display)
  memories/           Memory card and grid
  settings/           TransferOwnershipModal
docs/                 DEPLOYMENT.md (store builds & TestFlight)
hooks/                React hooks (use-chat, use-insights, use-resolved-media-urls, …)
lib/                  media-ref, supabase-storage, sanitize-research-text, …
services/             Supabase data layer (events, media, account, invites, …)
supabase/
  functions/chat/     Claude edge function + intent parser
  functions/insights/ Daily observation cache + research selection
  functions/research-refresh/ Research bank bootstrap, append, hygiene
  migrations/         Database schema (001–017)
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
