# GitHub OAuth — How Connect & Import Works

> The /playground "Connect GitHub" + repo browser flow, end to end. Audience: anyone wiring deployment, debugging OAuth issues, or thinking about migrating off this design.

---

## TL;DR

- **Confide is registered with GitHub as a single OAuth App.** Its `Client ID` and `Client Secret` live on our server (`backend/.env`).
- **End users never deal with secrets.** A user just clicks **Connect GitHub** → bounces to github.com → approves → comes back with an authenticated session.
- **The user's GitHub access token never leaves the backend.** It sits in an in-memory session map. The browser only gets an opaque session id in a httpOnly cookie.
- **One Confide OAuth App per environment.** Localhost dev uses one app, production deployment uses a second app with a different callback URL.

---

## 1. Players & Where Each Piece Lives

```
┌─────────────────────┐    ┌─────────────────────────────┐    ┌────────────────────────┐
│ End user's browser  │    │ Confide backend (Fastify)   │    │ GitHub                 │
│                     │    │  - Client ID / Secret in    │    │  - OAuth app registry  │
│  - confide.sid      │    │    env (set once by us)     │    │  - /authorize page     │
│    cookie (opaque   │    │  - Session map in memory    │    │  - /access_token       │
│    session id)      │    │    keyed by sid             │    │  - /user, /user/repos  │
└─────────────────────┘    │  - User's access_token      │    └────────────────────────┘
                            │    held server-side         │
                            └─────────────────────────────┘
```

### What every party knows

| Party | Knows | Does not know |
|---|---|---|
| End user (browser) | Their own session id (in the `confide.sid` cookie) | The Client Secret, their own access token (it never leaves the server) |
| Confide backend | Client ID, Client Secret, every active user's access token (in-memory map) | The user's GitHub password |
| GitHub | The Client ID + Secret pair, who authorized whom, the access token it minted | Anything else Confide does with the token |

---

## 2. The OAuth Round Trip — Step by Step

### Endpoint map (lives in `backend/src/routes/auth.ts`)

| Method + Path | Purpose |
|---|---|
| `GET /v1/auth/github/start?returnTo=<frontend_url>` | Build a signed `state` string and redirect to GitHub's authorize page |
| `GET /v1/auth/github/callback?code=&state=` | Verify state, exchange `code` for an access token, mint a session, set cookie, redirect back to frontend |
| `GET /v1/auth/me` | Return the current session's user profile (401 if not signed in) |
| `POST /v1/auth/logout` | Revoke the session, clear the cookie |
| `GET /v1/github/repos?per_page=&sort=` | Use the stored access token to fetch the user's repos |

### Sequence

```
Browser                       Backend                       GitHub
   │                             │                             │
   │── click "Connect GitHub" ─▶│                             │
   │   GET /v1/auth/github/start │                             │
   │                             │  ┌─ build signed state      │
   │                             │  │   HMAC(nonce ‖ returnTo) │
   │                             │  └─ assemble authorize URL  │
   │                             │     w/ Client ID + scope    │
   │◀── 302 to github.com ───────│                             │
   │                                                            │
   │── GET github.com/login/oauth/authorize ─────────────────▶│
   │   ?client_id=Ov23li...&scope=read:user+public_repo        │
   │   &state=<signed>                                         │
   │                                                            │
   │◀── "Authorize Confide?" page ─────────────────────────────│
   │                                                            │
   │── click Allow ────────────────────────────────────────────▶│
   │                                                            │
   │◀── 302 back to backend with code + state ─────────────────│
   │                                                            │
   │── GET /v1/auth/github/callback                             │
   │   ?code=<one-time>&state=<echoed>                          │
   │                            │                               │
   │                            │── verify state HMAC           │
   │                            │   (reject if tampered)        │
   │                            │                               │
   │                            │── POST github.com/login/      │
   │                            │   oauth/access_token          │
   │                            │   { client_id, client_secret, │
   │                            │     code }                    │
   │                            │                       ───────▶│
   │                            │◀──── { access_token } ────────│
   │                            │                               │
   │                            │── GET api.github.com/user     │
   │                            │   Authorization: Bearer ...   │
   │                            │                       ───────▶│
   │                            │◀──── { id, login, avatar } ───│
   │                            │                               │
   │                            │── createSession({              │
   │                            │     accessToken,               │
   │                            │     user                       │
   │                            │   })                           │
   │                            │   → returns sid                │
   │                            │                                │
   │◀── 302 to ${returnTo}?auth=ok                              │
   │   Set-Cookie: confide.sid=<sid>;                           │
   │     HttpOnly; SameSite=Lax; Path=/                         │
   │                                                            │
   │── GET /v1/auth/me   (cookie travels with it)               │
   │                            │                               │
   │                            │── getSession(sid) → user      │
   │                            │                               │
   │◀── { authenticated: true, user }                            │
   │                                                            │
   │ render avatar + "GitHub connected" UI                       │
```

### The state string — why it's signed

```
state = `${nonce}:${returnTo}:${hmac_sha256(sessionSecret, nonce + ":" + returnTo)}`
```

- **`nonce`** — 16 random bytes per request, prevents replay across users.
- **`returnTo`** — where to bounce the browser after success; embedded so the callback handler knows where to send them.
- **HMAC** — signed with `SESSION_SECRET` so an attacker can't forge a callback by guessing a state.

If the HMAC doesn't verify, the callback returns 400 `Invalid or expired state` and no session is created.

### What "session" actually means here

In `backend/src/lib/session-store.ts`:

```ts
interface GithubSession {
  id: string;          // 64-char hex, lives in the cookie
  accessToken: string; // GitHub OAuth token — STAYS SERVER-SIDE
  user: { id, login, name, avatarUrl, htmlUrl };
  createdAt: number;
  expiresAt: number;   // +7d by default
}
```

The browser cookie holds **only the `id`**. Everything else lives in a Map keyed by that id. Sessions are dropped after 7 days or when `POST /v1/auth/logout` is hit.

Migration path to Postgres / Redis: the `createSession / getSession / revokeSession` surface is what the rest of the code calls — drop in a different backing store, no route changes.

---

## 3. Listing the User's Repos

`GET /v1/github/repos?per_page=50&sort=updated`

```
Browser            Backend                          GitHub
   │                  │                                │
   │── GET /v1/github/repos                            │
   │   cookie: confide.sid=<sid>                        │
   │                  │                                │
   │                  │── getSession(sid)              │
   │                  │   401 if missing/expired       │
   │                  │                                │
   │                  │── GET api.github.com/user/repos│
   │                  │   Authorization: Bearer <tok>  │
   │                  │                       ────────▶│
   │                  │◀──── [ ...repos ] ─────────────│
   │                  │                                │
   │                  │   map to GithubRepoSummary[]   │
   │                  │   (omit fields we don't show)  │
   │                  │                                │
   │◀── { count, repos } ─────────────────────────────  │
```

The mapped shape:

```ts
interface GithubRepoSummary {
  id, name, fullName, htmlUrl, cloneUrl,
  description, private, defaultBranch, language,
  updatedAt, stargazersCount
}
```

When the user clicks a row in the playground UI, we copy `htmlUrl` into the "Paste a GitHub repository URL…" field. Same Import button as a manual paste — no special-case code path for "selected from list".

---

## 4. Importing the Repo (→ Sandbox Spawn)

Once a URL is in the input and the user clicks **Import**:

```
Browser ──POST /v1/sandbox──▶ Backend
         { repoUrl }
                              │
                              │── validate (zod regex requires github.com URL)
                              │── createSandbox(repoUrl)
                              │   in-memory + JSONL log
                              │
       ◀── 201 SandboxSession ─┘
       polls GET /v1/sandbox/:id
```

Today the sandbox spawn is a mock — it just walks `queued → spawning → cloning → ready` over a few seconds. The real Phala / Azure Confidential VM spawn is the P1 milestone in `md/08-playground-design.md`. The wire is real; the VM behind it is not.

---

## 5. Configuration

### Backend env vars (`backend/.env`)

```
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=...
PUBLIC_BACKEND_URL=http://localhost:4000
PUBLIC_FRONTEND_URL=http://localhost:3000
SESSION_SECRET=<random 32+ hex>
```

Both `*_URL` values are public — they're used to build the callback URL we send to GitHub and the `returnTo` the browser ends up on.

If either `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` is empty, `/v1/auth/github/start` returns `HTTP 503 GitHub OAuth not configured`. That's the friendly stub.

### Frontend env var (`frontend/.env.local`)

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

Defaults to `http://localhost:4000` if absent. All API calls in `frontend/lib/api.ts` go through this base.

### Cookie shape

| Attribute | Value | Why |
|---|---|---|
| Name | `confide.sid` | Namespaced so we can add more later (`confide.csrf`, …) |
| Value | 64-char hex (`session.id`) | Opaque — server-side lookup |
| `HttpOnly` | true | Browser JS can't read it (XSS protection) |
| `SameSite` | `Lax` | Survives top-level OAuth redirects but blocks CSRF on cross-site POSTs |
| `Secure` | true in prod (auto when `PUBLIC_BACKEND_URL` starts with `https://`) | TLS-only in prod |
| `Path` | `/` | Sent with every backend request |
| `Max-Age` | 7 days | Matches `GithubSession.expiresAt` |

### CORS

`@fastify/cors` is set with `credentials: true` and a fixed origin list (`CORS_ORIGIN`, comma-separated). The browser will only send cookies cross-origin if both the request uses `credentials: include` (it does, in `lib/api.ts`) and the response carries `Access-Control-Allow-Credentials: true` (it does).

---

## 6. Deploying — One App vs Two

GitHub OAuth Apps have **one** callback URL per app. Pick a strategy when you deploy:

### Option A — Two OAuth apps (recommended)

| App | Callback URL | Used by |
|---|---|---|
| `Confide` | `http://localhost:4000/v1/auth/github/callback` | Local dev |
| `Confide (prod)` | `https://<your-backend>/v1/auth/github/callback` | Vercel / Render / etc. |

Each app has its own Client ID + Secret. Put the local pair in `backend/.env`, put the prod pair in the deployed backend's env vars (Vercel project settings). Both work simultaneously — local dev and prod don't step on each other.

### Option B — One OAuth app, swap callback on deploy

Edit the existing app, change the callback URL to the prod one, save. From that moment, local login is broken until you swap it back. Don't do this if you're actively shipping.

---

## 7. Trust Model & Caveats

- **The backend's in-memory session map is not durable.** A restart loses everyone's session. Migrate to Redis / Postgres before there are paying users.
- **The `SESSION_SECRET` must be high-entropy and stable across restarts.** Rotate it only when you know you want to invalidate every active session (it'll break in-flight OAuth callbacks too).
- **Granted scopes today: `read:user public_repo`.** This means: read your basic profile, list your public repos. To clone private repos we'd need `repo` (a much broader scope). Keep the surface minimal until users actually need it.
- **Access tokens are never returned to the browser.** A compromised frontend can ask "am I logged in?" but cannot extract the token to impersonate the user against GitHub directly.
- **State HMAC + nonce blocks CSRF on the OAuth dance.** Without this an attacker could trick a logged-in user into binding their session to the attacker's GitHub account.
- **Cookie is HttpOnly + SameSite=Lax.** Reasonable defense vs XSS-token-theft and CSRF on backend writes. Tighten to `SameSite=Strict` once we stop bouncing through external auth providers.

---

## 8. Migration Path (when this is no longer enough)

| Issue | Fix |
|---|---|
| Need durable sessions across restarts | Swap `session-store.ts` Map for Redis or Postgres (same `createSession / getSession / revokeSession` surface) |
| Need higher GitHub rate limits | Migrate to a GitHub App (different OAuth flow, per-installation tokens, ~5,000 → ~15,000 RPH per installation) |
| Need private-repo clones | Add `repo` scope. Update the consent screen text in GitHub OAuth App settings so users see what they're approving |
| Need refresh tokens | GitHub OAuth Apps don't issue refresh tokens. GitHub Apps do (with 8-hour user tokens + refresh). Another reason to migrate eventually |
| Need multiple identity providers | Lift the session shape into a `Session` type that doesn't assume GitHub; add Google / NEAR wallet / email-magic-link providers alongside |

---

## 9. Where the Code Lives

```
backend/src/lib/github.ts            ← authorizeUrl, verifyState, exchangeCodeForToken, fetchUser, listUserRepos
backend/src/lib/session-store.ts     ← in-memory session Map + TTL
backend/src/routes/auth.ts           ← /v1/auth/github/start, /callback, /me, /logout
backend/src/routes/github.ts         ← /v1/github/repos (requires session)
backend/src/config.ts                ← env loader, hasGithubOAuth flag
backend/src/server.ts                ← registers @fastify/cookie + auth/github routes

frontend/lib/api.ts                  ← typed client with credentials: include
frontend/app/(workspace)/playground/page.tsx
                                     ← Connect / Disconnect buttons, repo list, Import flow
```

---

## 10. Quick Test Checklist

After setting `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` and restarting the backend:

```bash
# Should redirect (302) to github.com/login/oauth/authorize
curl -i "http://localhost:4000/v1/auth/github/start?returnTo=http://localhost:3000/playground" | head -3

# Before login — 401
curl -i http://localhost:4000/v1/auth/me

# After login (open the URL above in a browser, click Allow,
# come back with a confide.sid cookie set)
curl -i --cookie "confide.sid=<paste from devtools>" http://localhost:4000/v1/auth/me
curl -i --cookie "confide.sid=<paste>" http://localhost:4000/v1/github/repos?per_page=5
```

If the first call returns 503 instead of 302, the credentials aren't in `.env` (or `tsx watch` didn't pick them up — restart the backend).
