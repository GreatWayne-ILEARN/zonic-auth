# ZonicMe Central Login (`auth.zonicme.com.ng`) — single sign-on across separate domains

This is the one place users sign in. Because the apps live on different domains
(myyanga.com, myafriart.com, adspot.ng, …) they can't share a login cookie — so
each app redirects here, and this page returns the session. One account, every app.

```
zonicme-auth/         the central login app (deploy to auth.zonicme.com.ng)
  src/                 login UI + silent-SSO forward + Google/email/OTP
client/zonicme-sso.ts  the ~40-line client each app drops in
```

## How it works
1. An app calls `loginViaCentral()` → browser goes to
   `https://auth.zonicme.com.ng/?redirect=<app-callback-url>`.
2. If the user is already signed in here, this page **forwards immediately** (silent SSO).
   Otherwise it shows Google / email+password / one-time-code.
3. On success it returns the user to `<app-callback-url>` with the session tokens in
   the URL **fragment** (`#zm_at=…&zm_rt=…`) — fragments never reach servers or logs.
4. The app's `adoptSessionFromUrl()` reads the fragment, calls
   `supabase.auth.setSession(...)`, and strips the tokens from the URL.

Because every app points at the **same** Supabase project, that session is valid everywhere.

## Deploy the central app
```bash
cd zonicme-auth
npm install && npm run build      # static dist/ — host on Amplify / S3+CloudFront / Vercel
```
Point `auth.zonicme.com.ng` (a CNAME you control on zonicme.com.ng) at the host.

Env (`.env`):
```
VITE_SUPABASE_URL=…                # the ONE ZonicMe project
VITE_SUPABASE_ANON_KEY=…
VITE_ALLOWED_REDIRECTS=https://myyanga.com,https://myafriart.com,https://adspot.ng,https://owanbe.app,https://notifyme.ng,https://www.zonicme.com.ng
```
`VITE_ALLOWED_REDIRECTS` is the security guard — only these origins can receive a
session, so the page can't be abused as an open redirect. (Unlisted return links are
refused; you'll see a note on the page.)

In Supabase → Authentication:
- Providers: enable **Google** (OAuth client id/secret) and **Phone** (e.g. Twilio) for phone OTP. Email OTP is on by default.
- URL Configuration → Redirect URLs: add `https://auth.zonicme.com.ng` (for the Google round-trip).

## Wire each app (one-time, ~3 lines)
1. Copy `client/zonicme-sso.ts` into the app.
2. Set the app's env: `VITE_ZONICME_AUTH_URL=https://auth.zonicme.com.ng` plus the same
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as the central app.
3. On app start: `await adoptSessionFromUrl(supabase)`.
4. Sign-in button: `loginViaCentral()`.

MyYanga is already wired this way: when `VITE_ZONICME_AUTH_URL` is set, its Login/Sign-up
and every `requireAuth` gate redirect to the central page; on return the session is adopted
automatically. With the env unset it falls back to its in-app modal for local dev.

## What only you can do
Create `auth.zonicme.com.ng` DNS, set the env in your hosting, and enable the Google/Phone
providers in your Supabase project. The code and exact steps are complete; those actions
happen in your accounts.

