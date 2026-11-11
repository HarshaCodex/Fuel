# Fuel mobile app

Expo (React Native, TypeScript) app for Fuel, a macro and calorie tracker. Setup for the whole stack is in [`docs/LOCAL_SETUP.md`](../docs/LOCAL_SETUP.md).

## Screens and flows

Routes live in `app/` (Expo Router).

- Auth (`app/(auth)/`): sign in (email and password, Google, Apple), registration, email verification, forgot password and reset password.
- Onboarding (`app/onboarding.tsx`): body stats and goals for new accounts.
- Tabs (`app/(tabs)/`):
  - Today: calorie ring, macros, streak and the day's meals. `app/day.tsx` shows any past day.
  - History: chart, summary and a list of days.
  - Profile: edit profile, body stats and goals; sign out; delete account.
- Logging: Quick Log (`quick-log.tsx`), food search (`search.tsx`), food detail (`food-detail.tsx`), barcode scan (`scan.tsx`), manual entry (`manual-entry.tsx`) and My Foods (`my-foods.tsx`).

## Prerequisites

Node 22, npm, and the Expo Go app on a phone (iOS or Android).

## Setup

```sh
npm install
cp .env.example .env
```

## Environment variables

| Variable | Example | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8080` | Backend base URL. Every `EXPO_PUBLIC_` variable is bundled into the app and is public. Never put secrets here. On a physical phone use your computer's LAN address, not `localhost`. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | (empty) | Google web OAuth client ID. Required for Google sign-in; it is the ID token audience on both platforms and must be in the backend `GOOGLE_CLIENT_IDS`. Public identifier, not a secret. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | (empty) | Google iOS OAuth client ID. |
| `GOOGLE_IOS_URL_SCHEME` | (empty) | Reversed iOS client ID (`com.googleusercontent.apps.<id>`). Build time only, read by `app.config.ts`. Google sign-in needs a development build, not Expo Go. See `Fuel/docs/OAUTH_SETUP.md`. |

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server (scan the QR code with Expo Go) |
| `npm run ios` / `npm run android` | Start and open on a simulator or emulator |
| `npm run web` | Start the web build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm test` | Jest (`jest-expo`) with Testing Library |
| `npm run check` | Typecheck, lint and tests |
| `npm run screenshots` | Export the web build and write PNGs for the main screens and their empty and error states to `screenshots/`; it signs in through the UI against a mocked `/api/auth/login`. Run `npx playwright install chromium` once first. |

## Device tests (Maestro)

`maestro/` holds end-to-end flows that drive a real Android build on an emulator against a local backend with
seeded test data. Run them with `maestro test -e LAB_EMAIL=<email> -e LAB_PASSWORD=<password> maestro/` once the app
is installed and the backend is up. Most flows start by signing in as the seeded test user, so that account must
exist; the auth flows (register, forgot password, wrong password, sign out) start signed out and use their own
steps. `pull-to-refresh.yaml` also runs small host-side scripts from `maestro/scripts/` that call the backend
(default `http://localhost:8090`; override with `-e API_BASE_URL=<url>`) to add and remove a probe entry.

## Folder layout

- `app/` Expo Router routes. `(tabs)/` holds the bottom tabs; `(auth)/` holds sign-in, register, verify-email, forgot-password and reset-password. Other screens sit directly in `app/`.
- `src/theme/` design tokens (colors, type, space, radius, shadow, motion, sizing) from `docs/design/ui.md`.
- `src/components/` shared components, for example form controls, dialogs and the dashboard and history widgets.
- `src/lib/` helpers: `tokenStorage.ts`, `validation.ts` (form rules), `passwordRules.ts` (new-password rules), `authErrors.ts` (API error kinds, 429 text), `pendingEmail.ts` (in-memory email between auth screens), `useCooldown.ts` (resend countdown).
- `src/config.ts` reads the API base URL.
- `maestro/` Maestro device flows (see above).
- `scripts/` screenshot script and its mocked API fixtures for the screens it covers.
- `__tests__/app/` tests for the screens, mirroring `app/`. Never put test files in `app/`: Expo Router treats every file there as a route and bundles it into the phone app, where test code fails to build.

## Theme rule

Use tokens from `@/theme` only. Never write color, size or spacing literals in components.

## Stack decisions

- Navigation: Expo Router (file-based).
- Server state: TanStack Query v5.
- Local state: Zustand is chosen but not installed until something needs it.
- Tokens: `expo-secure-store` behind `src/lib/tokenStorage.ts` (in-memory on web, never localStorage).
- Tests and lint: `jest-expo`, `@testing-library/react-native`, ESLint 9 flat config.

## API client and session
`src/api/client.ts` sends the bearer token on every call except `/api/auth/*`, unwraps the `{ data }` envelope and throws typed
`ApiError` / `NetworkError`. A 401 triggers one shared token refresh and a single retry; if the refresh is rejected the session
ends and the app returns to the `(auth)` stack. A network failure during refresh keeps the user signed in. Tokens live only in
secure storage (memory on web). Read auth state with `useSession()` from `src/session/SessionProvider.tsx`.

## Testing limits

Jest and the web screenshots check logic, layout and colors only. They are not native. Check safe areas, gestures, back behavior and SecureStore on a device with Expo Go.
