# DIC Performance Dashboard — login backend

This is the backend half of the dashboard's login: a small set of serverless
functions that email a one-time 6-digit code to a visitor, and only let them
into the dashboard if that code is correct and their email ends in one of
your three approved domains (`@consultant.mcit.gov.qa`, `@mcit.gov.qa`,
`@ibtechar.com`). Unlike a simple "type your email and we believe you" gate,
this actually proves the person owns that inbox, since only they receive the
code.

The dashboard HTML file (`DIC_Performance_Dashboard_v21.html`) already has
the login screen and the client-side calls to these functions built in — you
just need to deploy this folder alongside it. Built and documented here for
**Netlify**.

## Folder layout

```
netlify.toml                          <- tells Netlify where the site and functions live
site/
  index.html                          <- the dashboard itself (renamed, placed here by you)
netlify/
  functions/
    request-otp.js    <- validate domain, email a 6-digit code
    verify-otp.js      <- check the code, issue a session cookie
    session.js          <- "is this visitor currently logged in?"
    logout.js           <- clear the session cookie
lib/
  auth.js           <- domain allow-list, code hashing, session tokens, cookies
  store.js          <- where codes are held between request-otp and verify-otp
  mail.js           <- how the code email actually gets sent
  httpResponse.js   <- tiny shared helper for the function files above
package.json
.env.example
```

The dashboard's own code calls `/api/request-otp`, `/api/verify-otp`,
`/api/session`, and `/api/logout` — a redirect rule in `netlify.toml` quietly
forwards those to where Netlify actually runs the functions
(`/.netlify/functions/...`), so nothing inside the dashboard file needs to
change.

Only the `site` folder is published as public static content. Keeping `lib/`
and `netlify/functions/` outside of it means your backend source (allow-list,
rate-limit numbers, hashing logic) isn't sitting alongside the dashboard as a
downloadable file — a small extra safeguard, on top of the fact that the
actual secret (`AUTH_SECRET`) never lives in a file at all.

## Deploying to Netlify

1. Create the `site` folder shown above if it doesn't already exist, and put
   `DIC_Performance_Dashboard_v21.html` inside it, renamed to `index.html`.
   Renaming it this way means it loads automatically the moment someone
   visits your site, with no extra address needed.
2. Push this whole folder (including `netlify.toml`, `site/`, `netlify/`,
   `lib/`, and `package.json`) to a GitHub repository.
3. In the Netlify dashboard, click "Add new site" → "Import an existing
   project," connect GitHub, and choose that repository. Netlify reads
   `netlify.toml` automatically, so the publish directory, functions
   directory, and `/api/*` redirect are already configured — leave the
   build command blank and do not click Deploy yet.
4. Under Site configuration → Environment variables, add at minimum
   `AUTH_SECRET` (see `.env.example` for how to generate one) and
   `NODE_ENV=production`. Add your mail-provider and storage variables once
   you've picked those (see below) — until then, codes are simply logged to
   the function's runtime logs (Netlify dashboard → your site → Logs →
   Functions), which is fine for testing the flow yourself before real email
   is wired up, but is not something to leave in place for real users.
5. Click Deploy. Netlify installs `jsonwebtoken` from `package.json`, bundles
   the four function files, and publishes the `site` folder. Your dashboard
   is now live at the Netlify-assigned URL (or your own domain, once you
   attach one under Site configuration → Domain management).

## If you're deploying to Vercel instead

The logic in `lib/` is framework-agnostic and works unchanged. Only the
function files need reshaping into Vercel's convention:

- Move each file from `netlify/functions/foo.js` to `api/foo.js`, and change
  its relative `require('../../lib/...')` paths to `require('../lib/...')`.
- Vercel functions receive `(req, res)` and call `res.status().json()`
  instead of returning a `{ statusCode, headers, body }` object — the
  request-reading and response-sending lines at the top and bottom of each
  handler are the only parts that change, never the logic in between.
- Remove `netlify.toml`; the `/api/*` path already matches Vercel's default
  convention, so no redirect rule is needed there.
- Ask me for the converted versions if you'd like them done for you.

## Required setup before this is real (not just a demo)

Two files are deliberately left in a "works, but not production-grade"
placeholder state, each with the real options documented and ready to
uncomment inside the file itself:

1. **`lib/mail.js`** — right now, a requested code is only printed to the
   server-side function logs, not actually emailed. Pick one: Resend,
   SendGrid, or plain SMTP (e.g. an MCIT mail server, or a Gmail/Outlook app
   password) — uncomment that block in the file, comment out the
   placeholder at the top, and fill in the matching environment variables
   from `.env.example`.
2. **`lib/store.js`** — codes are held in memory by default. That's fine for
   local testing, but serverless functions can run on more than one
   instance in production, and an in-memory value written by one instance
   isn't visible to another — so a code could occasionally "not be found"
   by the request that verifies it. Swap in the included Upstash Redis
   implementation (a free-tier REST-based Redis made for exactly this) by
   uncommenting that block and adding two environment variables from your
   Upstash dashboard. If you already run a database for something else,
   pointing this at a small table there instead works too.

Nothing else needs to change to wire either of these in — every other file
only calls the four functions each of these modules exports.

## Changing the allowed domains

Edit the `ALLOWED_DOMAINS` array at the top of `lib/auth.js`. Matching is
exact and case-insensitive on the part after `@` — a request from
`user@sub.mcit.gov.qa` would NOT match `mcit.gov.qa` unless you add that
subdomain explicitly.

## Testing locally

With the Netlify CLI installed (`npm i -g netlify-cli`), run `netlify dev`
from inside this folder — it serves the `site` folder and the
`netlify/functions/*` functions together, matching production behaviour and
honoring the `/api/*` redirect. Since email isn't wired up yet by default,
watch the terminal output after clicking "Send code" — the 6-digit code is
printed there.

## A note on what this login does and doesn't protect against

This proves the person entering a code owns an inbox at one of your three
domains — that's real verification, not a client-side-only check someone
could bypass by typing a fake address. It does not, by itself, add
encryption-at-rest for the dashboard's underlying data, audit logging of who
viewed what, or protection against someone who's already logged in sharing
their session. If MCIT needs any of those for this data, that's a separate
conversation worth having before this goes in front of real users.
