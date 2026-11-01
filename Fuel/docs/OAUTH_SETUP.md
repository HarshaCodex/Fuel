# OAuth Setup (Google and Apple Sign-In)

The mobile apps sign users in with Google or Apple and send the resulting token to the backend:

| Endpoint | Token sent by the app | Env var listing the accepted audiences |
|----------|-----------------------|-----------------------------------------|
| `POST /api/auth/oauth/google` | Google **ID token** | `GOOGLE_CLIENT_IDS` |
| `POST /api/auth/oauth/apple` | Apple **identity token** | `APPLE_CLIENT_IDS` |

The backend verifies each token itself against the provider's public keys (no client secret
needed). One of the checks is the token's audience (`aud` claim): it must be one of **our** app
identifiers, otherwise a token issued to some other app could be used to sign in here. The two
env vars are those allow-lists. Each is a comma-separated list, and **if a list is empty every
sign-in with that provider returns 401**.

The values are identifiers, not secrets (they ship inside the app), but they differ per
environment, so they live in env vars rather than in source. Set them in `Fuel/backend/.env`
locally (see [LOCAL_SETUP.md](LOCAL_SETUP.md)) and in the deployment environment for production.

## `APPLE_CLIENT_IDS`

```dotenv
APPLE_CLIENT_IDS=<ios-bundle-id>,<services-id>
```

Apple sets `aud` to whichever identifier the app used to start Sign in with Apple:

| Where the user signs in | `aud` in the identity token | Where to find it |
|-------------------------|-----------------------------|------------------|
| iOS app (native Sign in with Apple) | The app's **bundle ID**, e.g. `com.lazybuff.fuel` | Apple Developer → Certificates, Identifiers & Profiles → Identifiers → App IDs. The App ID must have the *Sign in with Apple* capability enabled. |
| Android app or web (Apple's web flow) | The **Services ID**, e.g. `com.lazybuff.fuel.signin` | Same page → Identifiers → filter by *Services IDs*. Create one, enable Sign in with Apple, and register the web domain and return URL. |
| iOS via **Expo Go** during development | `host.exp.Exponent` (Expo Go's own bundle ID) | Add it to your **local** `.env` only, never in production: it would accept tokens issued to any app running inside Expo Go. |

Only list what the apps actually use. If there is no Android/web Apple sign-in yet, the bundle ID
alone is enough.

## `GOOGLE_CLIENT_IDS`

```dotenv
GOOGLE_CLIENT_IDS=<ios-client-id>,<android-client-id>,<web-client-id>
```

Client IDs come from Google Cloud Console → APIs & Services → Credentials (one OAuth client per
platform). The `aud` of a Google ID token is the client ID the app requested it *for*. With
`@react-native-google-signin` that is often the **web** client ID (passed as `webClientId`), even
on Android and iOS, so include it.

## Troubleshooting a 401

If sign-in returns `401 Invalid Apple identity token` / `Invalid Google ID token`, the backend log
says why (`... rejected: <reason>`). The common one after setting up a new app or environment:

```
Apple identity token rejected: audience is not one of our client ids
```

Find the `aud` the app actually sends and add it to the list. Decode the token **locally**. It
signs the user in, so don't paste it into an online decoder:

```bash
# Prints the token's claims (aud, iss, sub, email, exp)
python3 -c 'import sys,base64,json; p=sys.argv[1].split(".")[1]; print(json.dumps(json.loads(base64.urlsafe_b64decode(p+"="*(-len(p)%4))),indent=2))' '<token>'
```

Other reasons in the log: `unexpected issuer` (token from the wrong provider or a test token),
expired token (the app sent a stale one; get a fresh token on each sign-in), or `Unknown key id`
(a forged or test token; real ones always match the provider's published keys).

## Not needed yet: Apple client secret

Account deletion (#64) should also revoke the user's Apple tokens, which Apple requires for apps
offering Sign in with Apple. That call needs a client secret, signed with a **private key** created
under Apple Developer → Keys (with Sign in with Apple enabled), plus the **Key ID** and **Team ID**.
The `.p8` private key is a real secret: store it in the secret manager, never in the repo. It will
be documented here when #81 adds it.
