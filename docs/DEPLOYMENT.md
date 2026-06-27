# Deploying Milestones to testers

Store builds for Android (Play Internal Testing) and iOS (TestFlight) use **EAS Build** with the `preview` profile in `eas.json`.

| Platform | Distribution | Tester install |
| --- | --- | --- |
| Android | Play Store internal track | Play Store link from Play Console |
| iOS | TestFlight | TestFlight app + invite email |

Both platforms share bundle identifiers with `app.json`:

- **iOS bundle ID:** `com.milestones.app`
- **Android package:** `com.milestones.app`

---

## Prerequisites

1. **Expo account** with access to project `Milestones` (`owner`: `tonkatrucka`).
2. **EAS CLI** — run via `npx` (no global install required):

   ```powershell
   npx eas-cli@latest login
   ```

3. **Supabase env vars on EAS** — store builds embed `EXPO_PUBLIC_*` at compile time. Without them the app shows “App configuration missing” on launch.

   ```powershell
   npm run setup:eas-secrets
   ```

   Verify on [expo.dev](https://expo.dev) → Project → **Environment variables** → `preview` and `production`.

4. **Apple Developer Program** ($99/year) for iOS TestFlight.
5. **Google Play Console** with an internal testing track for Android.

---

## Database migrations before testing

Apply all migrations through `017_transfer_child_ownership.sql` before testers use a new build:

```bash
npx supabase db push
npx supabase functions deploy chat insights research-refresh
```

Recent migrations add storage hardening, account deletion, and ownership transfer — see [README](../README.md#database-migrations).

---

## Build both platforms

From the project root on Windows (PowerShell):

```powershell
cd C:\Users\andre\Milestones
npx eas-cli@latest build --platform all --profile preview
```

Fire-and-forget (track on expo.dev):

```powershell
npx eas-cli@latest build --platform all --profile preview --no-wait
```

Single platform:

```powershell
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

---

## Android — Play Internal Testing

### Submit

```powershell
npx eas-cli@latest submit --platform android --profile preview --latest
```

`eas.json` routes preview submits to the **internal** track.

### Add testers

1. [Google Play Console](https://play.google.com/console) → your app → **Testing** → **Internal testing**.
2. Create a release with the uploaded build (if not auto-linked).
3. Add tester email addresses or share the opt-in link.

Testers install from the Play Store after accepting the invite.

---

## iOS — TestFlight

### One-time Apple setup

1. Register bundle ID `com.milestones.app` at [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. Create the app in [App Store Connect](https://appstoreconnect.apple.com/) using that bundle ID.
3. Create an **App Store Connect API key** at [App Store Connect → Integrations → API](https://appstoreconnect.apple.com/access/integrations/api) (Admin or App Manager). Download the `.p8` file once.

`app.json` sets `ITSAppUsesNonExemptEncryption: false` so standard HTTPS-only apps skip extra export-compliance prompts in many cases.

### Authenticate EAS without Apple SMS 2FA (recommended on Windows)

Apple SMS verification often fails from EAS CLI. Use an API key in the **same PowerShell session** as the build:

```powershell
$env:EXPO_ASC_API_KEY_PATH = "C:\Users\andre\.apple\AuthKey_XXXX.p8"
$env:EXPO_ASC_KEY_ID = "XXXX"
$env:EXPO_ASC_ISSUER_ID = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
$env:EXPO_APPLE_TEAM_ID = "XXXXXXXXXX"
$env:EXPO_APPLE_TEAM_TYPE = "INDIVIDUAL"   # or COMPANY_OR_ORGANIZATION

npx eas-cli@latest build --platform ios --profile preview
```

Find **Team ID** under Membership at [developer.apple.com/account](https://developer.apple.com/account/).

If SMS 2FA still blocks login, see [Expo’s Apple 2FA workaround](https://expo.fyi/apple-2fa-sms-issues-workaround.md).

### Submit to TestFlight

```powershell
npx eas-cli@latest submit --platform ios --profile preview --latest
```

Wait for the build to finish **Processing** in App Store Connect → **TestFlight** (typically 5–30 minutes).

### Add testers

**Internal testing** (fastest, up to 100 people, no beta review):

1. App Store Connect → **Users and Access** → invite tester.
2. **TestFlight** → **Internal Testing** → create group → attach build → add tester.

**External testing** (any email, first build needs Beta App Review):

1. **TestFlight** → **External Testing** → create group → attach build → add testers or public link.

### Tester steps on iPhone

1. Install **TestFlight** from the App Store.
2. Open the invite email → **Accept** → **Install**.
3. Open Milestones and sign in.

---

## Releasing updates

```powershell
# Re-set Apple API key vars if using a new PowerShell window
npx eas-cli@latest build --platform all --profile preview
npx eas-cli@latest submit --platform android --profile preview --latest
npx eas-cli@latest submit --platform ios --profile preview --latest
```

`autoIncrement: true` in `eas.json` bumps build numbers automatically.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `eas` not recognized | Use `npx eas-cli@latest`, not `eas` |
| “App configuration missing” | Run `npm run setup:eas-secrets`, rebuild, resubmit |
| No bundle ID in App Store Connect | Register `com.milestones.app` in Apple Developer portal first |
| Apple SMS 2FA error | Use App Store Connect API key env vars (above) |
| Build credentials fail | `npx eas-cli@latest credentials --platform ios` with API key vars set |
| Insights empty in production | Run research bootstrap workflow or migration `011` seed for dev |

---

## Production releases

Use the `production` profile instead of `preview`. Android submits to the production track; iOS follows the same TestFlight → App Store path with production env vars.

```powershell
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform android --profile production --latest
npx eas-cli@latest submit --platform ios --profile production --latest
```
