# Google Login Native Checklist

Scope:
- Native app only (`iOS` / `Android`)
- Browser/web is explicitly out of scope for now

Current implementation references:
- OAuth provider config: `www/js/_r34lp0w3r_.js:433`
- Google OAuth params: `www/js/_r34lp0w3r_.js:441`
- Browser open: `www/js/_r34lp0w3r_.js:459`
- Callback parser: `www/js/_r34lp0w3r_.js:361`
- Deep link listener: `www/js/_r34lp0w3r_.js:2651`
- Android deep link: `android/app/src/main/AndroidManifest.xml:29`
- iOS deep link scheme: `ios/App/App/Info.plist:24`
- Login screen gating for browser/app: `www/js/pages/login.js:348`

## 1. Preconditions

Before testing, verify:

1. Google OAuth client still exists and is active.
2. Redirect URI is exactly:
   - `https://api.curso-ingles.com/auth/google/callback`
3. The backend callback still redirects to:
   - `app://callback?...`
   and includes:
   - `loginData=...`
   or `error=...`
4. Native build includes deep link scheme `app`.

If any of those fail, frontend testing is secondary.

## 2. Expected Flow

Expected native sequence:

1. User taps `Login with Google`.
2. App opens system browser with Google OAuth URL.
3. User completes Google auth.
4. Backend receives Google callback.
5. Backend redirects to `app://callback?...`.
6. Capacitor `App.addListener('appUrlOpen', ...)` receives that URL.
7. App closes Browser.
8. `procesarLoginDesdeCallback()` parses `loginData`.
9. `window.setUser(user)` persists the session.
10. Modal closes and UI reflects logged user.

## 3. Test Matrix

Run all of these:

1. Android, Google account already present on device.
2. Android, choose a different Google account.
3. Android, cancel login from Google screen.
4. iPhone/iPad, Safari flow with already known Google account.
5. iPhone/iPad, choose a different account.
6. iPhone/iPad, cancel login.

For each case, verify:
- browser opens
- callback returns to app
- modal closes
- header avatar/name update
- `window.user` survives app relaunch

## 4. Logs To Watch

During native validation, these logs matter:

1. On tap:
   - `>#C02#> loginSocial: Abriendo navegador. url:`

2. On callback:
   - `>#C02#> Plugin App (loginSocial): 📥 appUrlOpen ACTIVADO con URL:`
   - `window.loginCallbackFromBrowser(info.url)`
   - `>#C02#> loginSocial: procesarLoginDesdeCallback: >>> LOGIN OK.`

3. On failure:
   - `Error recibido en callback`
   - `missing_login_data`
   - `invalid_login_data`
   - `missing_user`

## 5. Fast Failure Diagnosis

Use this mapping:

### A. Browser does not open

Likely causes:
- `Capacitor.Plugins.Browser` unavailable
- runtime issue in native build

Look at:
- `www/js/pages/login.js:355`
- `www/js/_r34lp0w3r_.js:481`

### B. Google page opens but app never comes back

Likely causes:
- backend callback not redirecting to `app://callback`
- deep link not configured in native app
- Google Console / backend callback mismatch

Look at:
- `android/app/src/main/AndroidManifest.xml:29`
- `ios/App/App/Info.plist:24`
- backend callback implementation on `api.curso-ingles.com`

### C. App comes back, but no login happens

Likely causes:
- callback URL lacks `loginData`
- malformed JSON in `loginData`
- backend returns unexpected payload

Look at:
- `www/js/_r34lp0w3r_.js:374`
- `www/js/_r34lp0w3r_.js:379`
- `www/js/_r34lp0w3r_.js:387`

### D. Login succeeds but modal stays open or user not persisted

Likely causes:
- `window.setUser(user)` not executed
- invalid user payload
- modal close path blocked

Look at:
- `www/js/_r34lp0w3r_.js:400`
- `www/js/pages/login.js:197`
- `www/js/pages/login.js:289`

## 6. Concrete Backend Checks

Ask backend to confirm:

1. `GET /auth/google/callback` still works in production.
2. After Google auth, it redirects to:
   - `app://callback?...`
3. `loginData.user` contains at least:
   - `id`
   - `email` or `name`
   - `token` if required by current app flows
4. `avatar_file_name` and/or `image` are still present when available.

If backend can provide one real callback URL sample, validation gets much faster.

## 7. Device-Level Validation

Recommended test sequence:

1. Install fresh build.
2. Clear any previous app session.
3. Tap `Login with Google`.
4. Choose account.
5. Confirm app returns.
6. Kill app fully.
7. Reopen app.
8. Confirm user session is still there.

Repeat after:
- logout
- switching Google account
- cancelling and retrying

## 8. Non-Goals

Not part of this validation:

1. Web Google login.
2. Facebook login.
3. Apple login.
4. UI redesign of login modal.

Those should be tested separately.

## 9. Recommendation

Do not start changing frontend code before the first end-to-end native run.

The current code already covers:
- OAuth URL build
- system browser open
- deep-link callback capture
- callback parsing
- user persistence

So the highest-probability failure is integration/configuration, not missing UI logic.
