# Activity timers (breastfeeding & sleep)

This document describes the client-side timer system for **breastfeeding** and **sleep** sessions: live elapsed display on the home card, Android sticky notifications, and iOS Live Activities with a native lock-screen chronometer.

## Overview

| Feature | Breastfeeding | Sleep |
| --- | --- | --- |
| Session model | Client-only until stop → then `logEvent` | `logEvent` on start; `updateEvent` with `sleepEnd` on wake |
| Metadata | `{ mealType: 'breast', durationMins?, breastSide?, amountMl? }` | `{ sleepEnd?: ISO string }` |
| Home badge | **Feeding** + elapsed | **Sleeping** + elapsed |
| iOS Lock Screen | `BreastfeedingActivity` Live Activity | `SleepingActivity` Live Activity |
| Android | Sticky notification, body refreshed ~30s | Same |
| Deep link | `milestones:///?open=meal` | `milestones:///?open=sleep` |

## Architecture

```
User → QuickLogCard / log modal / assistant
         ↓
    services/breast-feeding-timer.ts  OR  services/sleep-timer.ts
         ↓
    iOS: widgets/*Activity.tsx (expo-widgets + @expo/ui timerInterval)
    Android: expo-notifications (sticky ongoing)
         ↓
    logEvent / updateEvent (Supabase daily_events)
```

### Breastfeeding flow

1. User selects side and starts timer (or logs manually with duration/amount).
2. `store/breast-feeding-store` persists `{ childId, startedAt, side }`.
3. iOS presents Live Activity; Android shows sticky notification.
4. On stop → compute `durationMins`, call `onLog` → `logEvent` with `occurredAt = startedAt`.
5. Session cleared; Live Activity / notification dismissed.

### Sleep flow

1. User taps **Start sleep** → `logEvent` creates open sleep row (no `sleepEnd`).
2. `store/sleep-timer-store` persists `{ childId, eventId, startedAt }`.
3. Same indicator layer as breast (different widget / notification id).
4. On wake-up → `updateEvent` sets `sleepEnd`; `stopSleepTimer()` dismisses indicator.
5. Home feed reconciles open sleep from DB on refresh (`syncSleepTimerWithOpenEvent`).

### iOS chronometer technique

Live Activities use SwiftUI `Text(timerInterval:)` via `@expo/ui/swift-ui` — the system clock drives updates. **Do not** call `update()` every second; only pass `startedAtMs` as a prop.

## Key files

| Path | Purpose |
| --- | --- |
| `components/meals/BreastFeedControls.tsx` | Side chips, duration/ml toggle, slider, start/stop timer |
| `widgets/BreastfeedingActivity.tsx` | iOS Live Activity layout |
| `widgets/SleepingActivity.tsx` | iOS Live Activity layout |
| `services/breast-feeding-timer.ts` | Breast session lifecycle + Android sync |
| `services/breast-feeding-live-activity.ts` | iOS ActivityKit start/end/reconcile |
| `services/sleep-timer.ts` | Sleep indicator lifecycle |
| `services/sleep-live-activity.ts` | iOS sleep Live Activity |
| `store/breast-feeding-store.ts` | Persisted breast session (Zustand + AsyncStorage) |
| `store/sleep-timer-store.ts` | Persisted sleep timer state |
| `lib/meal-format.ts` | Display strings (`Breast · Left · 12m`) |
| `lib/session-elapsed.ts` | Shared elapsed formatting |
| `lib/chat-quick-log.ts` | Local quick-log chips; starts/stops sleep timer |

## Configuration

### app.json

- `NSSupportsLiveActivities: true` in iOS `infoPlist`
- `expo-widgets` plugin with `groupIdentifier: group.com.milestones.app`
- `expo-notifications` for Android (and iOS fallback)

### EAS

`eas.json` includes a `development` profile with `developmentClient: true` for testing Live Activities on device.

## Assistant / chat

- **Intent parser** (`supabase/functions/chat/intent-parser.ts`): patterns like `bf left 10m`, `breast right 15 min`
- **`log_meal` tool**: `duration_mins`, `breast_side` fields
- **Quick-log chips** (`lib/chat-quick-log.ts`): `Nap started` / `Woke up` start/stop sleep timer locally

## Testing checklist

### Breastfeeding

- [ ] Quick log: manual duration + side logs correctly
- [ ] Timer start/stop logs with correct `occurred_at` and duration
- [ ] Meal card shows **Feeding** + live elapsed during session
- [ ] iOS: Lock Screen chronometer ticks while backgrounded
- [ ] Android: sticky notification persists
- [ ] Tap Live Activity → meal quick-log opens
- [ ] Bottle flow unchanged (ml only)
- [ ] Edit modal loads/saves breast duration and side

### Sleep

- [ ] Start sleep → open DB row + indicator
- [ ] Wake up → `sleepEnd` set + indicator dismissed
- [ ] Sleep card shows **Sleeping** + live elapsed
- [ ] iOS Live Activity / Android notification
- [ ] Tap Live Activity → sleep quick-log opens
- [ ] Force-quit app → reopen → indicator restored from open sleep event
- [ ] Viewer role cannot log (existing `readOnly` on quick-log cards)

## Platform notes

- **Expo Go**: timers and Live Activities are **not** supported; use `eas build --profile development`.
- **Live Activities on developer.apple.com**: there is often no separate “Live Activities” toggle on the App ID; `NSSupportsLiveActivities` in the built app is what matters.
- **Web**: timer UI works; notifications and Live Activities are mobile-only.

## Out of scope (future)

- iOS lock-screen Stop button (App Intents)
- Per-side breast segment tracking mid-feed
- Server push updates for Live Activities (APNs)
