# Anchor Exchange — Crypto Currency Exchange

## Current Development Stage

**Current Stage:** Stage 20 — Final QA
**Status:** ✅ Complete **except the same one item that only you can resolve** ("No exposed secrets": old credentials remain in public git history — see Stage 19 below). 321 automated tests passing (0 flaky). **Not yet committed** (pending your review).
**Completed:** Stage 0, Stage 1, Stage 2, Stage 3, Stage 4, Stage 5, Stage 6, Stage 7, Stage 8, Stage 9, Stage 10, Stage 11, Stage 12, Stage 13, Stage 14, Stage 15, Stage 16, Stage 17, Stage 18, Stage 19 (one open item), Stage 20
**Next Stage:** None — Stage 20 is the last stage on the checklist. What's left is the git-history secret purge (your call, see Stage 19) and committing everything.

### Stage 19 (2026-09-21) — Production Readiness

An audit with evidence, not a checkbox pass. Headline: **this app cannot honestly be "production" yet in the sense of handling real money** — there is no real payment provider, custody, or blockchain integration, so every payment/deposit is simulated. What Stage 19 does is make it *safe to deploy as a demo* and *impossible to accidentally run as if it were real*.

**Blockers found and fixed (these were genuine defects, not polish):**
1. **Anyone could read any user's private notifications over Socket.IO.** `join_user` accepted a client-claimed numeric user id with no authentication, so an unauthenticated socket could subscribe to `user:<any id>` and receive trade confirmations and withdrawal alerts live. The room is now derived from a *verified JWT* (HS256-pinned); the old protocol is covered by a regression test.
2. **Production would still mint money from nothing.** The demo payment provider and the crypto-deposit simulator credit wallets with no real funds and had no kill-switch. Now: in `NODE_ENV=production` the server **refuses to start** unless `ALLOW_DEMO_MODE=true` is set (an explicit acknowledgement); independently, buys and fiat deposits return 503 before writing anything and the simulator endpoint 404s unless demo mode is allowed.
3. **No startup config validation.** A missing/weak `JWT_SECRET` or an unset webhook secret (which silently falls back to a *public* default anyone could use to forge payment webhooks) just failed later or ran insecurely. `config/validateEnv.js` now fails fast with every problem listed; production additionally requires SMTP (otherwise verification/reset links are only printed to the log), a non-localhost `FRONTEND_URL`, and both secrets.
4. **Dead, dangerous code removed:** `utils/qrStore.js` accepted a `userId` straight from the request body (the pre-Stage-15 QR auth bypass, plus a hardcoded LAN IP). Unreferenced today, but a trap for whoever wires it up. Deleted with `controllers/qrController.js`, `hash.js` (a stray `bcrypt("123456")` script) and three unused dependencies (`html5-qrcode`, `redis`, `uuid`).

**Robustness added:** `GET /api/health` (DB + Redis ping with timeouts, 200/503); graceful shutdown on SIGTERM/SIGINT (drains, closes pool + Redis, 10s force-kill); `unhandledRejection` logged, `uncaughtException` exits for the process manager to restart; DB pool `error` listener (an idle-client error otherwise crashes the process); the startup pool client leak fixed earlier; Redis host/URL configurable (was hardcoded `localhost`); `TRUST_PROXY` support so per-IP rate limits work behind a reverse proxy; ids in `:id` routes validated (a 20-digit id caused a Postgres overflow → 500); `errorHandler` returns stable messages (no parser internals, 413 for oversized bodies) and never logs request bodies; JWT verification pinned to HS256.

**Logging:** one line per request (`METHOD /path status ms`) using `originalUrl` **without the query string**, because verification/reset/withdrawal-confirmation tokens travel in query strings — verified by spawning the real `server.js` and asserting the secrets never appear in output. (Found and fixed on the way: logging `req.path` inside `finish` logs the *router-relative* path.) Raw `console.*` is still the logger — no log levels/structured JSON/rotation; fine for a demo, not for a real ops setup.

**Database & migrations:** there was no migration tooling. Added `db/migrate.js` (forward-only, each file in a transaction, tracked in `schema_migrations`; `npm run db:migrate`), with `db/schema.sql` as the baseline snapshot. `001` adds indexes for hot lookups that were sequential scans (webhook by `provider_reference`, verification/reset token lookups, every per-user `ORDER BY created_at DESC` list); `002` adds `CHECK (balance >= 0)` constraints so even a future controller bug cannot drive a wallet negative. Verified: fresh DB (baseline + migrations) works, re-run is a no-op, a deliberately broken migration rolls back completely, the webhook query uses its new index, and the constraints reject negative balances. Applied to your local dev database (0 of 28 existing balance rows were negative, so it was safe). Live schema vs `schema.sql` compared before starting: identical.

**Performance:** entry JS bundle **569 kB → 264 kB** (gzip 138 → 82 kB) via route-level code splitting (`React.lazy`) — every page is now its own chunk and the >500 kB build warning is gone; the 1.4 MB 1024×1024 favicon (which was being shipped in `dist`) replaced by a 2 KB 64×64; `dist` is now 772 KB total. Production builds no longer silently fall back to `http://localhost:5000` when `VITE_API_BASE_URL` is unset (same-origin instead). Query performance addressed via the indexes above. **Not** load-tested: no benchmark, no load numbers, and market data is cached in-process only (won't share across multiple instances).

**Security review (beyond Stage 15):** `npm audit` 0 vulnerabilities in both apps; no secret-shaped strings in the working tree; CORS restricted to `FRONTEND_URL` (verified against a hostile Origin); helmet on; JWT 1 h, algorithm pinned; rate limiting on auth/order/deposit/withdrawal/admin/QR routes (proven to throttle); SQL injection re-checked (parameterised everywhere; injection strings are in the tests). **Known accepted risks:** JWT lives in `localStorage` (any XSS = account takeover; no CSP on the SPA — helmet's CSP is off because this server only serves JSON, so the *frontend host* must set one); 1-hour tokens with no revocation/refresh (suspension is enforced at login/QR/admin, but an already-issued token for a suspended user keeps working for up to an hour on ordinary endpoints); no MFA; no account lockout beyond IP rate limits.

**Verification:** backend 250 tests, frontend 36, E2E 35 (real backend + Vite + Chromium, on dedicated ports 5100/5174 so it never collides with your dev servers). New E2E guards: **every one of 25 pages loads with zero console errors, uncaught exceptions, or failed first-party requests** (found and fixed a real React warning on `/exchange` — an empty `src=""` image), and **no horizontal overflow at 375/768/1280/1920 px on every page** (an automated form of the Stage 16 check). Backend log captured across the entire E2E run: 0 errors, 0 uncaught/unhandled. Third-party noise (TradingView iframe `Permissions policy violation`) is explicitly excluded. Lint: 122 → 43 problems by mechanically removing 41 unused `import React` and 38 unused `catch (err)` variables; the remaining 43 (unused icons/vars, React-compiler style rules like `set-state-in-effect`) are debt, not defects.

**⚠ Open item — needs you (item "No exposed secrets"):** the working tree is clean, but `Back-End/.env` and `Front-End/.env` are still in **git history on the public GitHub remote** (commits `ea77947`, `e47dc13`). DB password and JWT secret were rotated earlier, so those exposed values are dead — but (a) `VITE_COINGECKO_API_KEY` was **never rotated** (coingecko.com, manual), (b) the DB password was later printed into an earlier session's transcript, so rotate it again to be safe, and (c) purging history (`git filter-repo` + force-push) is your call and destructive, so I did not do it. All Stage 1–19 work is also still **uncommitted**.

**Deploying (for whoever does it):** `cp Back-End/.env.example Back-End/.env` and fill in; `psql -f Back-End/db/schema.sql` then `npm run db:migrate`; set `NODE_ENV=production`, `ALLOW_DEMO_MODE=true`, real SMTP, `FRONTEND_URL`, `TRUST_PROXY`; `npm run build` in Front-End and serve `dist/` (with a CSP, and `/api` + `/socket.io` proxied to the backend so same-origin API URLs work); point the uptime check at `/api/health`; run behind a process manager that restarts on exit.

**Not covered / honest gaps:** no real payment/KYC/custody/blockchain; no load or soak testing; no CI; no structured logging/metrics/alerting; single-instance only (in-memory cache, Socket.IO without an adapter); no automated backups; no rollback ("down") migrations; email deliverability never tested against a real SMTP server; no TLS/HSTS verification (depends on the host).

### Stage 18 (2026-09-21) — Testing

**How to run (each layer is independent):**

| Layer | Command | Tests | Needs |
|---|---|---|---|
| Backend unit + API | `cd Back-End && npm test` (~35s) | 205 | local Postgres + Redis |
| Frontend unit/component | `cd Front-End && npm test` (~4s) | 36 | nothing |
| End-to-end (real browser) | `cd Front-End && npm run test:e2e` (~1.5min) | 30 | Postgres + Redis + Playwright Chromium |

**Safety:** backend and E2E tests run against a throwaway database (`anchor_exchange_test`, override with `TEST_DB_NAME`) that `pretest` drops and recreates from `Back-End/db/schema.sql` every run. `tests/helpers/env.js` **refuses to start if the DB name doesn't end in `_test`**, so a test run can never touch the real `anchor_exchange` data. Test JWT/webhook secrets are fixed test values, not the real `.env` ones. CoinGecko/Binance are stubbed (`tests/helpers/upstreamStub.js`) so nothing hits the network and prices are deterministic (BTC = $50,000).

**What is covered:**
- **Auth (30):** registration validation and hashing, duplicate email, login (incl. no user-enumeration, suspended accounts, injection strings), email verification (single-use, expiry), password reset, JWT middleware (forged/expired/`alg:none`/non-Bearer), real rate-limit throttling, no-body requests, security headers.
- **Trading (34):** exact fee/price arithmetic, server-side price enforcement (spoofed client price ignored), every validation bound, price-feed-down = 502 with nothing written, and **concurrency**: 10 parallel buys (no lost update), 5 parallel sells against funds for 4 (exactly 4 succeed, never negative), interleaved buy+sell.
- **Deposits (20):** wallet is credited *only* by the signed webhook; HMAC missing/wrong/tampered rejected; replay and 6 concurrent duplicate webhooks credit exactly once; a late `failed` cannot reverse a `completed`; crypto-deposit confirmation lifecycle credits once.
- **Withdrawals (34):** funds reserved into `locked_balance`, every address/network/limit rejection leaves balances untouched, concurrent requests can't overdraw, email token is single-use and race-safe (5 parallel clicks debit once), expiry releases funds, cancel/cancel-again, **a stolen session token alone cannot complete a withdrawal**, cross-user isolation.
- **Authorization (16):** every admin route 401/403 for anon/user, mass-assignment privilege escalation impossible, forged `role=admin` JWT ignored, role read fresh from DB (demotion revokes an existing token instantly), last-admin guard, suspension, admin reject only for pending withdrawals, cross-user isolation on every list endpoint.
- **Account/other (24):** profile, preferences, change-password, notifications, market proxy caching + failure behaviour + no key leakage, QR-login (incl. a regression test for the Stage 15 auth bypass).
- **Unit (47):** address validators (all networks, junk, injection, prototype keys), asset-config consistency, HMAC signing/verification edge cases, TTL cache + stale-on-failure with a mocked clock, HTML-escaping across all email templates.
- **Frontend (36):** `Modal` (focus in/trap/Escape/restore/backdrop), `ProtectedRoute`, market API client (goes through the proxy, URL-encoding, errors), Sign-in and Sign-up flows (validation, `role=alert/status` announcements, payload shape), app shell (titles, skip link, single `<main>`, redirects; pages survive a dead backend).
- **E2E (30):** register → emailed-link verification → sign-in in a real browser; wrong password/suspended account; logged-out redirects; session survives reload; wallet pricing through the real proxy; empty-wallet honesty; the emailed withdrawal-confirmation link (works once, replay fails); transaction dialog + Escape; per-user order isolation; admin denied/allowed and instant revocation; **axe accessibility on every public and signed-in page in both themes** (a regression guard for Stage 17).

**Real bugs the tests found (all fixed):**
1. **Dogecoin withdrawals rejected valid addresses.** The DOGE regex limited *every* character after the leading `D` to `[5-9A-HJ-NP-Za-km-z]`, excluding the digits 1–4 — so a large share of legitimate DOGE addresses failed validation.
2. **API returned 500 instead of 400 on any POST/PUT with no JSON body** (Express 5 leaves `req.body` undefined; `const { x } = req.body` threw). Affected login, register, orders, withdrawals, profile, and admin reject. Fixed once, centrally, in `app.js`.
3. **Connection leak:** `config/database.js` checked out a pool client at startup and never released it (also made `pool.end()` hang, which is how it was found).
4. **`isValidAddress("constructor", …)` threw a TypeError** (prototype-key lookup); now uses `Object.hasOwn`.
5. **Email templates interpolated `asset`/`reference`/`method`/`network`/`txHash` unescaped** (incl. two `preheader`s). Not exploitable today (all validated or server-generated) but the templates relied on every caller staying that way; all now escaped.
6. (From Stage 17 verification) Dashboard blank-page crash on a null 24h change.

**Code changes made for testability:** `server.js` split into `app.js` (the Express app, importable) + `server.js` (listen + sockets); every `express-rate-limit` limiter gets `skip: () => NODE_ENV === "test"` (one test flips `NODE_ENV` to prove the limiter genuinely throttles in production mode).

**Are these tests real?** Every layer was mutation-checked — deliberately breaking the code and confirming the suite goes red: removing `FOR UPDATE` row locks (concurrency test fails), making the webhook non-idempotent (3 fail), disabling the admin role check (5 API tests + 2 E2E fail), removing Escape handling / the `ProtectedRoute` redirect / the login error (6 frontend tests fail). Several tests were also tightened after review because they could pass for the wrong reason (e.g. a "below minimum" withdrawal case that was actually failing on insufficient balance).

**Known gaps / not covered:**
- No coverage measurement (no `c8`/`nyc` run) — the claim above is about *behaviours* tested, not a line-coverage percentage.
- Socket.IO delivery (live notifications, QR-login approval push) is not tested; the QR happy path needs a live socket pair.
- Real SMTP and real payment providers don't exist yet (demo mode), so those integrations are untested by definition.
- Not tested: the multi-step BuyCrypto/SellCrypto/Deposit/Withdraw *UI wizards* (their backends are thoroughly covered; the UI is verified only for accessibility + the pages listed above). Trading-terminal pages (Dashboard/Exchange) and TradingView widgets aren't functionally tested.
- E2E runs Chromium only, at one desktop viewport; Stage 16's multi-width responsive check is not automated.
- Tests share one DB with unique per-test users rather than truncating between tests — fine for isolation, but `admin` tests that demote all admins assume they run serially (`--test-concurrency=1` is set).
- Not wired into CI (no CI config exists in the repo).

### Stage 17 (2026-09-21) — Accessibility

Measured first, then fixed. Baseline was an axe-core scan of all 25 routes (headless Chromium, real running app, logged-in temp account that was deleted afterward). Final result: **0 axe violations across 25 pages x light and dark theme.** axe is a floor, not a ceiling — it accepts `placeholder` as an accessible name and can't see modal/focus behavior — so items marked (manual) were found by grep/keyboard testing, not axe.

- **Page-level (manual):** per-route `document.title` ("Contact | Anchor Exchange"); "Skip to main content" link (visible on focus); focus moves to `<main>` on every client-side navigation; every page has exactly one visible `<h1>` (was up to 16 per page — extras demoted to `<h2>`, no visual change since Tailwind preflight strips heading styles; Footer column headings likewise); sr-only `<h1>` on Markets and Exchange; `prefers-reduced-motion` support in `index.css`.
- **Forms (manual):** ~30 controls were labelled only by placeholder text — added `aria-label`s, plus `autocomplete` tokens on sign-in/sign-up/reset/contact/profile fields (WCAG 1.3.5). Sign-in's "Email"/"Password" captions were `<h2>`s; now plain text.
- **Errors/status (manual):** none were announced to screen readers. All error messages are now `role="alert"`, success/status messages `role="status"` (~30 sites, incl. verify-email / withdrawal-confirm result text).
- **Modals (manual):** the three detail dialogs (Orders, Transactions, Admin user) were plain divs. New shared `Components/Modal.jsx`: `role="dialog"`, `aria-modal`, `aria-labelledby`, focus moves in on open, Tab/Shift+Tab trapped, Escape closes, focus returns to the opener; close buttons have `aria-label`. Verified with real key events.
- **Keyboard operability (manual):** Orders & Trades tabs and the Dashboard order-history tabs were `<p onClick>` (mouse-only) — now real `<button>`s. Tab-style buttons expose `aria-pressed`; the active sidebar link on money-flow pages has `aria-current="page"`.
- **Contrast (axe; dark theme exposed far more than light):** white text on `bg-blue-500` was 3.7:1, so all primary blue surfaces are now `bg-blue-600` (hover `-600`/`-700`); ~40 blue buttons in light theme inherited dark text on blue, now explicit `text-white`; red/green messages and blue links on theme-following pages got light/dark pairs (`text-red-700 dark:text-red-400` etc.); `text-gray-500` on near-black got `dark:text-gray-400`; Admin "Access denied"/"Checking access" screens were white text on the light page background (invisible in light theme) and now have their own dark background. Inline links in text blocks are underlined.
- **Also fixed (pre-existing, not accessibility):** `Dashboard.jsx` crashed to a blank page whenever CoinGecko returned a null 24h change for any coin (`null >= 0` is true, then `null.toFixed`) — now coerced to 0. Found only because the axe scan saw an empty `/dashboard`.

**Known gaps / deliberate non-goals:**
- No real screen-reader (NVDA/VoiceOver) run — axe plus keyboard scripting can show the markup is sound, not that the experience is good.
- TradingView chart widgets are third-party iframes; their internal accessibility is out of our control.
- Markets' sort headers and Exchange's order-type tabs have `cursor-pointer` but no handlers (unfinished, not keyboard traps) — left alone rather than faked.
- Sidebars are `<div>`s, not `<nav aria-label>` landmarks; tab groups use `aria-pressed` rather than the full `role="tablist"` pattern (valid and simpler, not the richest semantics).
- Contrast was verified for default and auth-page error states, not every transient state (hover, disabled, each wizard step) on every page.
- Pre-existing ESLint `no-unused-vars` errors in several files were not touched.

### Stage 16 follow-up (2026-09-18) — real browser verification closed the "no live testing" gap

A prior pass on this stage did a full page-by-page responsive rewrite (summarized below) but flagged one honest gap: it could only reason about the Tailwind CSS, it couldn't actually load a browser. This session installed a headless Chromium (Playwright) and drove the real running app — both servers launched locally, an automated script visited all 20 real pages (public + authenticated, using a temporary test account cleaned up afterward) at 7 real viewport widths (375/414/768/1024/1280/1440/1920px), and measured actual DOM overflow rather than reading class names. This caught **10 real, previously-undetected bugs** that pure code review missed — none were visible from the Tailwind classes alone because each one only manifests from how sibling elements actually compete for space at render time:

1. **`Navbar.jsx` — every page overflowed horizontally on any tablet/small-laptop between 768–1165px.** The desktop nav (all links + icons + buttons) switched on at Tailwind's `md:` (768px) breakpoint but actually needs ~1166px to fit on one line, and nothing let it wrap or scroll. Fixed by moving the switch-over to `xl:` (1280px), which comfortably fits; the hamburger menu now correctly covers the whole 0–1279px range instead of just 0–767px.
2. **`Signin.jsx` — the QR-login panel overlapped the email/password form at tablet width.** The QR panel is absolutely positioned (`right-42 top-40`) and only looks right once the container is wide enough (~1232px+); it was gated at `md:` (768px) so from 768–1279px it visually sat on top of the login form. Moved the whole desktop/QR layout (and its mobile fallback) from the `md:` split to `xl:`, matching the Navbar fix.
3. **`Components/DerivativesMarketTable.jsx`** (rendered on `/markets`) **had fixed `pl-20 pr-20` (160px) page padding and three tab/pill button rows with no wrap or scroll** — overflowed by ~65px on a 375px phone. Padding made responsive (`px-4 md:px-12 lg:px-20`); all three button rows now scroll horizontally on overflow.
4. **`Components/CreateAnAccoutSection.jsx`** (the "Earn up to $25" banner shared by 9 pages — Home, Contact, both deposit pages, both withdraw pages, Overview, Buy, Sell) **had fixed `pl-25 pr-25` padding and a non-stacking `flex justify-between` row**, overflowing every page that includes it on mobile. Now stacks vertically below `md:` with responsive padding.
5. **`Home.jsx`** had a second decorative image composition beyond the one fixed in the original Stage 16 pass — an absolutely-positioned `<img>` (`left-160`) only sized correctly at wide desktop, gated at `md:` — and a separate testimonial-card section whose two-column split also switched on at `md:` while the fixed-width (520px) card didn't fit next to the other column at tablet width. Both moved from `md:`/`lg:` two-column splits to `lg:`, matching the site's mobile single-image fallback through the tablet range.
6. **`Components/Footer.jsx`'s 4-column desktop link grid** (`md:flex md:gap-20 justify-between`, no wrap) needed more than 768px and overflowed every page at tablet width. Made it wrap (`flex-wrap`) instead of forcing a single non-wrapping row; also made the copyright row's fixed `pl-20 pr-20` responsive.
7. **`Exchange.jsx`'s two-column trading layout** (chart column `lg:w-230` + pairs-list column `lg:w-148` = 1512px combined) **still overflowed at 1440px desktop** even after the original Stage 16 pass restructured it to stack below `lg:`. Added `lg:overflow-x-auto` to the row so it scrolls horizontally as one unit above `lg:` instead of forcing the whole page wider, consistent with how the stat bars in the same page already handle density.
8. **`Wallet.jsx`'s summary panel forced a fixed 880px width** (`md:w-220`) regardless of how much room the flex layout actually had next to it, overflowing at 768–1280px even after the original per-panel width fix. Changed to `w-full max-w-220` (fills available space, capped at 880px) and delayed its internal search-box row from splitting side-by-side at `sm:` to `lg:`, since the fixed 280px search box didn't fit next to the balance text below that.
9. **`CryptoDeposit.jsx`'s "Demo Tools" simulate-amount row** (`flex gap-3` with a `flex-1` input and a button) overflowed slightly on phones because the button's text couldn't shrink below its content width. Row now stacks vertically below `sm:`.
10. **`SellCrypto.jsx`'s 4-step progress breadcrumb** overflowed by a few pixels on a 375px phone (no wrap/scroll on the step labels + separators). Added horizontal scroll as a safety net.

All 10 were re-verified with the same automated script after fixing (zero overflow across all 20 pages × 7 widths), plus a visual screenshot check of the two most complex fixes (Navbar/Signin at every breakpoint) to confirm they actually look right, not just "don't overflow." Production build still succeeds. The temporary test account used for authenticated-page testing was deleted afterward.

**Known minor, non-blocking item found during this pass:** at exactly 1280px, the navbar's "Anchor Exchange" logo and a couple of link labels wrap onto two lines instead of staying single-line (it's tight, not broken — no overflow, nothing hidden or overlapping, and it's fully clean again by 1366px+). Left as-is rather than redesigning nav spacing/font-size, since it's cosmetic tightness at one specific width, not a functional bug.

### Original Stage 16 pass — what was added (uncommitted — review with `git status`/`git diff`)

Did a full pass across every real page in the app (30 `.jsx` files under `Front-End/src/Pages`, 9 of which are untouched placeholder stubs needing no work). No visual/cross-device browser testing was available in that session — every fix there was verified by (1) reading the Tailwind classes and reasoning about how the CSS box/flex model resolves at each breakpoint, (2) a clean production build after every batch of edits, (3) confirming the new responsive utility classes actually survived Tailwind's JIT purge by grepping the compiled CSS, and (4) a full route smoke test. The follow-up above is what real browser testing then caught on top of this.

- **Found and fixed a real, high-impact bug, not just polish: the Sign-In page was completely invisible on mobile.** `Signin.jsx` had two parallel layouts — a desktop one correctly gated `hidden md:block`, and a second block explicitly commented `{/* mobile */}` that was supposed to be its small-screen counterpart. That second block had `hidden` applied *unconditionally* (with `md:pl-7` etc. as separate, non-gating utilities) instead of `md:hidden` — so it was hidden at every screen size. The net effect: a phone visiting `/signin` saw a completely blank page. Fixed by correcting `hidden` → `md:hidden` on both wrapper divs, then made the now-actually-rendering mobile form safe from horizontal overflow (`w-120`/`w-95`/`w-90` fixed-pixel inputs → `w-full` within a `max-w-95` bounded form, a `gap-52` fixed-pixel spacer between "Remember Me" and "Forgot Password" → `justify-between`, and the password-toggle icon's fragile `right-16` offset corrected to `right-4` to match the (working) desktop version).
- **The app's entire money-flow surface** — `BuyCrypto`, `SellCrypto`, `DepositFiat`, `CryptoDeposit`, `FiatWithdraw`, `CryptoWithdraw`, `TransactionHistory`, `OrdersTrades`, `Overview`, all of which share one identical sidebar+content layout pattern — had that shared pattern fixed once and applied consistently: the outer `flex flex-row` (which never wraps, so on a narrow screen the fixed-width sidebar and content were both forced to squeeze rather than stack) becomes `flex-col md:flex-row`; the vertical sidebar becomes a horizontally-scrollable pill row on mobile (`flex-row overflow-x-auto` with `[&>a]:flex-shrink-0` so the pills don't get crushed) and reverts to the original vertical column at `md:`; the decorative vertical divider is hidden below `md:`; and the shared page-header's `pr-20 pl-20` (80px fixed padding per side — over 40% of a 375px screen) scales down with the viewport.
- **`Wallet.jsx`** — the worst single offender found: three content panels were hardcoded `w-220` (880px), inside a container with `pl-40` (160px) padding, guaranteeing horizontal page overflow on any phone. Fixed to `w-full md:w-220`, reduced the outer padding responsively, and wrapped the balance-table and transaction-list rows (which use fixed per-column pixel widths to fake table alignment) in `overflow-x-auto` so they scroll horizontally as a mini-table instead of blowing out the page — the header row and data rows now share the same `w-max min-w-full` sizing so columns stay aligned while scrolling.
- **`Dashboard.jsx`** and **`Exchange.jsx`** — two separate full "trading terminal" layouts (permanent icon+label sidebar, ticker stat bar, chart panel, order book, buy/sell panel, pairs list), each with their own dense set of fixed pixel widths (`w-230`, `w-148`, `w-91`, etc.) sized to assume a desktop viewport. Both restructured to stack top-to-bottom below their `lg:`/`md:` breakpoint rather than forcing a squeezed side-by-side layout, with ticker/stat rows made horizontally scrollable (a standard, accepted pattern for trading-terminal stat bars on mobile) rather than redesigned into something that would fit — preserving the information density real traders expect rather than hiding data. Also fixed a latent bug in `Exchange.jsx`'s pairs-list panel: it had `flex-col` without the `flex` display class that makes `flex-col` do anything, so the panel was never actually a flex container — added the missing `flex`.
- **`ProfileAndSetting.jsx`** — same sidebar+divider+content pattern as the money-flow pages, fixed the same way.
- **`AdminDashboard.jsx`** — already reasonably responsive from how it was built in Stage 14 (stat grid, tabs, and tables already used responsive/scrolling patterns); tightened the remaining fixed `px-8` page padding and one `w-80` search input.
- **`Home.jsx`** (the marketing landing page) — the densest remaining page: a fixed-height hero with a huge fixed-width hero image, an 8-column-wide mock market table (hardcoded placeholder rows, not live data — a pre-existing gap unrelated to this stage) using large `pr-NN` paddings to fake column alignment, a 4-step "How it works" row, and three further two-column marketing sections using `flex justify-between` with large fixed paddings and, in one case, absolutely-positioned decorative images offset by fixed pixel values that only make sense at desktop width. Fixed by stacking every two-column section below `md:`, wrapping the mock market table in a horizontally-scrollable container (header and rows share one `min-w-[820px]` wrapper so columns stay aligned while scrolling), and hiding the fragile absolutely-positioned decorative image composition on mobile in favor of a single simple centered image, rather than trying to preserve pixel-exact decorative positioning at every width.
- **`Signup.jsx`** — same category of fix as Wallet: five form fields plus a submit button were all hardcoded `w-161`/`w-130`/`w-160` (520-644px) inside a form with no side padding at all. Fixed to `w-full` within a `max-w-161` bounded form; the "Authenticate" button (absolutely positioned via a fixed `left-120` offset that only worked at the original fixed width) was repositioned to `right-0` so it stays correctly anchored to the input's edge at any width instead of breaking once the container became fluid.
- **`Markets.jsx`, `Contact.jsx`** — smaller, more contained fixes: a fixed-padding/fixed-height hero header on Markets (the rest of that page was already well-built responsively — `w-full sm:w-80 md:w-96` card sizing and `overflow-x-auto` scroll rows were already present); a fixed `w-120` contact form made fluid within a bounded max-width.
- Spot-checked (no changes needed, already safe): `Notifications.jsx`, `Forgot.jsx`, `ResetPassword.jsx`, `VerifyEmail.jsx`, `WithdrawalConfirm.jsx`, `QRAuth.jsx`, `Footer.jsx` (already has a correctly-implemented `hidden md:flex` / `flex md:hidden` split — unlike Signin.jsx's bug, this one was done right), `Navbar.jsx` (already has a working mobile hamburger menu), `CryptoMarketBar.jsx`, `DerivativesMarketTable.jsx` (already wraps its table in `overflow-x-auto`). The 9 placeholder-stub pages (`About`, `Assets`, `Bitusdt`, `Blog`, `Careers`, `Enusd`, `HelpCenter`, `Pages`, `Spot` — each just `<p>PageName</p>`) need nothing.
- `QRScanner.jsx` was intentionally left untouched — confirmed unrouted/unreachable dead code in Stage 15, not worth spending responsive-design effort on markup that never renders.

### Known remaining Stage 16 items

- Live verification this session was real Chromium (headless Playwright) driving the actual dev server and measuring DOM overflow + screenshots — not a phone/tablet in hand. It caught real layout bugs pure code-reading missed (see above), but a manual pass on an actual phone and iPad is still worth doing before calling this pixel-perfect, particularly for touch-target sizing and font rendering, which an automated overflow check can't judge.
- Home.jsx's market table still renders 8 rows of hardcoded placeholder text ("Name", "Last Price", etc.) rather than live data — unrelated to this stage (a pre-existing content gap, not a layout one) but worth knowing it'll need real data wiring separately.
- 2560px ultra-wide specifically wasn't tested (widest tested was 1920px) — content areas are `max-w-*` bounded so nothing should stretch unreasonably, but unverified.
- The navbar's "Anchor Exchange" logo + link labels wrap onto two lines at exactly 1280px (cosmetic tightness, not an overflow bug — see the follow-up section above).
- Two "trading terminal" pages (`Dashboard.jsx`, `Exchange.jsx`) now stack correctly on mobile but pack a lot of dense financial data into a single column at that width — functional and scrollable, not necessarily the most elegant mobile trading UX; a from-scratch mobile-specific trading layout would be a larger design project beyond a responsive-CSS pass.

### Stage 15 — what was added (uncommitted — review with `git status`/`git diff`)

Audited all 13 checklist items against the actual code rather than assuming past stages covered them. Two real, previously-shipped issues turned up alongside the already-known secret-management gap; all three are fixed except the part of secret management that requires your call (see "Needs your decision" below).

- **Authentication audit — found and fixed a real authentication bypass.** `POST /api/qr/verify` (the desktop-approves-via-phone-scan QR login from Stage 2) never actually verified the phone's JWT — it did `const userId = token`, literally treating the raw Bearer string as an already-authenticated identity, with a comment in the code reading "DO NOT trust a userId sent from the phone" directly above the line that did exactly that. Any string sent as `Authorization: Bearer <anything>` was accepted. Compounding this, the desktop browser only ever received that garbage value into `localStorage.userId` — it never received a usable session token at all, so **QR login has been completely non-functional since it was built**, not just insecure. Fixed both ends: `routes/qrRoutes.js` now calls `jwt.verify()` on the phone's token (rejecting invalid/expired/tampered tokens with 401), looks up the real user, checks `is_suspended`, mints a **fresh** JWT for the desktop session (never reuses the phone's token), and emits that plus the user's id/email/role over the socket. `Front-End/src/Pages/Signin.jsx` now actually stores the received `token` (previously it never did). Verified end-to-end with a real Socket.IO client: a garbage bearer token is now rejected with 401, a real phone JWT correctly mints a working desktop token that passes an authenticated API call, and a suspended account is blocked.
- **XSS / HTML-injection audit — found and fixed unescaped user input in emails.** Every email template builds raw HTML by hand (no auto-escaping templating engine), and several interpolated fields are user-controlled: `fullName` (free text at registration, used as a greeting in all 9 email templates) and a withdrawal's `destination` (a user-submitted bank name or crypto address). A full name like `<img src=x onerror=...>` would have rendered as markup, not text, in the recipient's mail client. Added `escapeHtml()` to `Back-End/emails/layout.js` and applied it to every such interpolation across `emails/templates.js`. Verified directly: rendering the welcome email with a `<script>` payload as the full name now produces the literal escaped text `&lt;script&gt;...&lt;/script&gt;`, not executable markup. The rest of the app's UI was already safe — grepped the whole frontend for `dangerouslySetInnerHTML` and found zero uses, so React's default JSX escaping protects every other user-controlled value shown anywhere in the app.
- **SQL injection audit — full pass, no changes needed.** Grepped every `${...}` template-literal interpolation inside every `.query()` call across all 11 controllers. Every dynamic WHERE-clause builder (introduced in Stages 9, 11, 12, 14) interpolates only placeholder *index numbers* (e.g. `` `status = $${params.length}` ``) — the actual values always flow through the parameterized `params` array, never string-concatenated into SQL text. Confirmed clean.
- **Secure headers** — added `helmet` (CSP disabled, since this backend only ever serves JSON, never HTML — there's nothing for a content policy to protect here). Verified `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` etc. are now present on responses.
- **CORS review** — already correctly scoped to a single explicit `FRONTEND_URL` origin (never a wildcard) with `credentials: true`; added an explicit `methods` allow-list for clarity. No wildcard-plus-credentials misconfiguration found.
- **CSRF review** — not applicable to this architecture: authentication is a Bearer JWT read from an `Authorization` header, never a cookie, and the codebase confirmed to have zero cookie-based auth anywhere. CSRF exploits ambient cookie auth that browsers attach automatically; a forged cross-site request can't forge an `Authorization` header, so there's nothing for a CSRF token to protect against here.
- **Input validation gaps fixed**: `PUT /api/users/preferences` (Stage 3) accepted any string for `theme`/`currency`/`language` with no validation at all — now whitelisted against the exact option sets the frontend's own dropdowns already offer (`Front-End/src/Pages/ProfileAndSetting.jsx`), so this is a real fix, not a new restriction that breaks existing UI. `PUT /api/users/profile` now enforces the same length limits as the DB columns (varchar(100)/(100)/(100)/(50)) with a clear 400 instead of a raw Postgres error.
- **Rate limiting audit** — was already present on all money-moving/auth-sensitive routes from Stages 6-14. Found and fixed two gaps: `POST /api/users/change-password` (a stolen JWT could otherwise brute-force the current password with unlimited attempts) and `GET/POST /api/qr/*` (defense-in-depth, though the UUID token space makes brute force impractical either way).
- **Password security / password-reset security / transaction security** — all audited, no changes needed: bcrypt cost factor 10 throughout, 8-character minimum enforced at register/reset/change, `forgotPassword` never reveals whether an email exists, reset tokens are `crypto.randomBytes(32)` with a 30-minute expiry and are invalidated after use, and every money-moving controller (buy/sell/deposit/withdrawal, Stages 6-10) already uses `SELECT ... FOR UPDATE` row-locking inside a DB transaction — re-confirmed rather than re-tested, since these were already stress-tested live during their own stages.
- Ran `npm audit fix` in both `Back-End` and `Front-End` — resolved 2 backend (brace-expansion, qs — both DoS-class) and 7 frontend (postcss, react-router — high severity) transitive dependency vulnerabilities. Verified both apps still build/boot cleanly afterward.
- Updated `Back-End/.env.example` to document `PAYMENT_PROVIDER`/`PAYMENT_WEBHOOK_SECRET`/`CRYPTO_ADDRESS_SECRET`, added in Stages 6-9 but never added to the example file. Also found `CRYPTO_ADDRESS_SECRET` was never actually set in the real local `.env` — it had been silently falling back to a hardcoded default string in `services/cryptoDepositService.js` this whole time. Generated and set a real random value.

### 🔴 Needs your decision — secret management is not fully closed out

This was flagged as the one blocking issue before Stage 1 even started ([[security-env-committed]] in memory) and **is still not resolved**, though the ground has been prepared:

- **Already done** (uncommitted, in the working tree): `Back-End/.gitignore` excludes `.env`; `Back-End/.env.example` documents every variable (now complete, see above); both `Back-End/.env` and `Front-End/.env` are untracked from git's index (`git status` shows them as staged deletions); the DB password and JWT secret were rotated earlier and are strong (128-char JWT secret, 24-char DB password).
- **Not done, and I won't do either without your explicit go-ahead**: (1) actually **committing** the untracking/`.gitignore`/`.env.example` changes — nothing in this repo gets committed unless you ask, same as every prior stage; (2) **purging the old secrets from git history** with `git-filter-repo` (already installed) and force-pushing — this is destructive and irreversible on the remote, and you explicitly deferred it twice before ("skip for now" both times it came up). Until history is purged, the original (rotated, so now-useless) DB password and JWT secret remain visible in this repo's git history and on GitHub if it's been pushed there.
- `VITE_COINGECKO_API_KEY` still hasn't been rotated (requires you to do it manually on coingecko.com) — low severity since it's a free/demo-tier key, but it's been exposed since before Stage 1 the same way the others were.

### Known remaining Stage 15 items

- `Back-End/controllers/qrController.js` is dead code (never imported by any route — `routes/qrRoutes.js` has its own inline handlers) and `Front-End/src/Pages/QRScanner.jsx` is an unrouted, unfinished prototype that doesn't even send an `Authorization` header. Neither is reachable in the live app, so neither was a security risk, but both are confusing leftovers worth deleting in a later cleanup pass.
- No account lockout after repeated failed login attempts — only rate limiting (10 attempts / 15 min per IP on `/api/auth/login`). A distributed attacker spread across many IPs isn't meaningfully slowed down. Would need a per-account (not just per-IP) counter to close fully.
- JWTs are stored in `localStorage`, not an `httpOnly` cookie — standard for this SPA architecture and not exploitable given the XSS audit found no injection vectors, but it's a real architectural tradeoff (a future XSS bug would be able to steal tokens) worth knowing about rather than treating as risk-free.
- A suspended user's already-issued JWT still works until it naturally expires (up to 1h) — noted already in Stage 14, restated here since it's squarely a Stage 15 concern too.

### Stage 14 — what was added (uncommitted — review with `git status`/`git diff`)

- One schema change: `users.is_suspended boolean DEFAULT false` (applied directly via psql, `schema.sql` re-dumped). The `users.role` column already existed from Stage 1/2's original schema design — nothing needed adding there, and one seed user (`admin@anchorexchange.com`) already had `role = 'admin'`.
- **Admin authentication & role-based authorization**: `Back-End/middleware/authorizeAdmin.js` runs after the existing `authenticate` JWT check and looks up the requesting user's `role` fresh from the DB on every request — deliberately not trusted from the JWT payload, so revoking someone's admin access takes effect on their very next request instead of waiting up to an hour for their token to expire. Verified this directly: demoted the logged-in admin's own account mid-session and their existing token immediately started getting 403s.
- `Back-End/controllers/adminController.js` + `Back-End/routes/adminRoutes.js`, all mounted under `/api/admin` and gated by `authenticate, authorizeAdmin`:
  - `GET /api/admin/stats` — system-wide counts (users, verified, new in 7 days, completed/pending deposits and withdrawals split fiat/crypto, buy/sell order counts, total transactions).
  - `GET /api/admin/users` (paginated, searchable by email/name/username, filterable by role) and `GET /api/admin/users/:id` (full profile + wallet balances + order/deposit/withdrawal counts).
  - `PATCH /api/admin/users/:id/role` — promote/demote between `user`/`admin`, with a guard against removing the last remaining admin (verified: rejected until a second admin existed, then allowed).
  - `PATCH /api/admin/users/:id/suspension` — suspends/reinstates an account; `login()` in `authController.js` now rejects suspended accounts with 403 before issuing a token (verified live: a suspended test account was correctly blocked from logging in, then allowed again after reinstating). An admin cannot suspend their own account (verified).
  - `GET /api/admin/transactions`, `/deposits`, `/withdrawals`, `/orders` — cross-user, paginated, filterable (type/status/side) views over the existing Stage 8-12 tables, each joined to the owning user's email.
  - `POST /api/admin/withdrawals/:id/reject` — the one real administrative write action on money movement: cancels a still-`PENDING_CONFIRMATION` withdrawal (e.g. for suspected fraud) and releases the reserved funds via the exact same `locked_balance → available_balance` mechanics as Stage 10's user-initiated cancel. It can only ever stop a withdrawal before the user's own email confirmation — never reverse one that already completed and left the ledger. Verified end-to-end: created a real pending withdrawal, rejected it as admin, confirmed the funds were released back to available balance, and confirmed rejecting an already-resolved withdrawal correctly 404s instead of double-processing.
- Frontend: new `Front-End/src/Pages/AdminDashboard.jsx` at `/admin` — a tabbed panel (Overview / Users / Transactions / Deposits / Withdrawals / Orders) styled distinctly from the trading-app pages to signal it's a different surface. It independently verifies admin access server-side on mount (calling `GET /api/admin/stats`) rather than trusting anything client-side, and shows an explicit "Access denied" screen for a logged-in non-admin rather than a blank page or silent redirect. `login()`'s response now also returns the user's `role`, cached in `localStorage` purely so the Navbar can conditionally show an "Admin Panel" link — this is a UI convenience only, never the actual authorization check (a tampered `localStorage` role would still hit real 403s from the server).
- Verified end-to-end live throughout, including the full lifecycle test above of promoting a second admin, demoting the original one, confirming their old token stopped working immediately, and restoring both accounts to their original roles afterward.

### Known remaining Stage 14 items

- A suspended user's *existing* JWT (issued before suspension) still works for regular API calls until it naturally expires (up to 1 hour) — only `login()` is gated, not the `authenticate` middleware itself. Instant revocation would need a server-side token blocklist/session store, which this stateless-JWT architecture (chosen in Stage 1) doesn't have. Same underlying limitation applies to role changes on *non-admin* routes (only `authorizeAdmin` re-checks the DB every request; regular `authenticate` does not).
- "Deposit management" is read/filter/oversight only — there's no admin action to manually resolve a stuck `PENDING` deposit, unlike withdrawals' reject action. A stuck deposit would need direct DB intervention today; deliberately left out rather than adding a button that manually credits a user's wallet without the same integrity guarantees (webhook signature, idempotency) Stage 8/9 built for the real crediting paths.
- No audit log of admin actions (who suspended whom, who rejected which withdrawal, when) — each action fires a notification to the affected user, but there's no separate admin-activity trail for other admins to review.
- The `/admin` route itself has no dedicated nav entry outside the profile dropdown (shown only when the cached `role` is `"admin"`) — reasonable for a demo, but a real deployment would likely also want admin-only routes excluded from any public sitemap/robots handling.

### Stage 13 — what was added (uncommitted — review with `git status`/`git diff`)

- Re-audited against the Stage 13 checklist rather than assumed done: the notification system, read/unread, the notification page, and per-category notifications (deposit/withdrawal/buy/sell/security) were all already real and working, built incrementally across Stage 3 and Stages 6-10 as each money-moving feature landed. Two genuine gaps remained and were fixed this stage:
- **The `notifications.link` column existed since Stage 3 but nothing ever populated it** — every notification was a dead-end with no way to jump to the relevant page. All 10 `createNotification(...)` call sites across `authController.js`, `userController.js`, `depositController.js`, `orderController.js`, and `withdrawalController.js` now set a sensible `link` (buy/sell → `/orderstrades`, deposits/withdrawals completed → `/transactions`, security events → `/profile-setting`, etc.), and `Notifications.jsx` now navigates there on click.
- **Real-time delivery.** Previously the only way to learn about a new notification was to reload the page — the Dashboard bell badge was fetched once on mount and never updated again, even though async events (a crypto deposit's confirmations landing, a withdrawal's email being confirmed) happen entirely server-side with no user action to trigger a refetch. `Back-End/socket.js` (Stage 2's existing Socket.IO server, previously only used for QR login) gained a `join_user` room handler; `Back-End/utils/notify.js`'s `createNotification` now emits `notification:new` to that room the moment it inserts a row. New frontend hook `Front-End/src/hooks/useNotificationSocket.js` decodes the user id directly from the JWT (works for every login path, not just password login) and joins that room; wired into `Dashboard.jsx` (bell badge increments live) and `Notifications.jsx` (new notifications prepend to the list live, since they always land on page 1 of the newest-first ordering).
- Added pagination controls to `Notifications.jsx` (it already called a paginated backend since Stage 3, but the UI never exposed `page`, so anything past the most recent 20 was unreachable) — same completeness bar applied to Stage 11/12's history pages.
- `Front-End/src/Pages/Signin.jsx` now also stores `userId` in localStorage on login (fixes a previously-dead `localStorage.removeItem("userId")` in Dashboard's logout that removed a key nothing ever set) — kept as a minor consistency fix, though the socket hook itself reads the id from the JWT for robustness across login paths.
- Verified end-to-end live: connected a real Socket.IO client, joined a user's room, triggered a real buy order via the API, and confirmed the `notification:new` event arrived instantly with the correct `link` — not simulated. Also verified the REST endpoints still return the new `link` field, pagination totals are correct (19 accumulated notifications from earlier stage testing), and mark-all-as-read still works.

### Known remaining Stage 13 items

- The `join_user` socket room trusts whatever id the client sends — it's join-only (a client can only receive what the server emits to that room) but there's no server-side verification that the connecting socket's JWT actually matches the room it's joining. Low risk (nothing sensitive is emitted beyond notification content the room's owner already has via the authenticated REST API), but worth hardening if this pattern is reused for something higher-stakes.
- The Socket.IO connection is opened once per tab and left connected for the session; there's no reconnect-and-rejoin-room logic tested beyond the default socket.io-client reconnection behavior.
- No push notifications (browser/mobile) — "real-time" here means "while the tab is open," not off-tab delivery.

### Stage 12 — what was added (uncommitted — review with `git status`/`git diff`)

- No schema changes — the `orders` table (populated by Stage 6/7 buy/sell) already had everything this stage needed (`side`, `status`, `pair`, pricing/fee/total columns).
- `GET /api/orders` (`Back-End/controllers/orderController.js`) gained filtering — `side` (BUY/SELL), `status`, and `asset` (matched against the `pair` column, e.g. `asset=BTC` matches `BTC/USD`) — on top of the pagination it already had since Stage 6. Same graceful-degradation rule as Stage 11: an invalid filter value is silently ignored rather than erroring.
- `GET /api/orders/:id` — new single-order detail endpoint, scoped to the requesting user (verified an admin account gets a 404, not another user's data, for someone else's order id).
- Frontend: `Front-End/src/Pages/OrdersTrades.jsx` — previously a one-line placeholder (`<p>OrdersTrades</p>`) — is now a real page: tabs (All / Open / Closed Orders), side/asset filters, a paginated table, and a click-through detail modal. Reachable both from the global Navbar's existing "Orders & Trades" link and from the "Orders & Trades" sidebar link now added alongside the other wallet-action pages.
- Dashboard's Order History widget (`Front-End/src/Pages/Dashboard.jsx`) — previously three hardcoded fake rows (`24-04 14:40`, `$222`, `0.4314 BTC`, all static) under non-functional "Open Orders"/"Closed Orders" tab labels and a decorative, unwired "Search By Date" input — now shows the user's real 5 most recent orders, with working tabs that actually refetch by status, proper loading/empty states, and a "View all" link to the full Orders & Trades page (the dead search input was removed rather than faked, same call as Stage 5's wallet currency toggle removal).
- Verified end-to-end live: side/asset/status filters all narrow correctly (confirmed with a real BUY order created live, not just SELL data from earlier stages), single-order lookup works, cross-user access is correctly blocked with a 404, and the exact tab/query shapes the Dashboard widget uses were verified directly against the running API.

### Known remaining Stage 12 items

- "Open Orders" will always be empty — Anchor Exchange only executes `MARKET` orders (Stage 6/7), which fill instantly, so no order ever sits in an open/unfilled state. The tab, filter, and empty-state messaging are honest about this rather than hiding it. Limit/stop orders (which would actually populate this) are out of scope for the current spec.
- No order cancellation exists (nothing to cancel, per the point above) — different from Stage 10's withdrawal cancellation, which cancels a pending *confirmation*, not a pending *order*.

### Stage 11 — what was added (uncommitted — review with `git status`/`git diff`)

- No schema changes this stage — the `transactions` table (type/asset/amount/fee/total/status/reference/tx_hash/metadata) has been the unified ledger every money-moving feature wrote into since Stage 6, so Stage 11 is a read layer on top of it, not a new model.
- `GET /api/transactions` (`Back-End/controllers/transactionController.js`) — paginated (`page`/`limit`, capped at 100/page) and filterable by `type` (comma-separated for multiple, e.g. `type=DEPOSIT,WITHDRAWAL`), `asset`, `status`, and `startDate`/`endDate`, mirroring the pagination shape `GET /api/orders` already used since Stage 6. Filters compose (AND), and an invalid/unknown `type` or `status` value is silently ignored rather than erroring, so a bad filter degrades to "show everything" instead of breaking the page.
- `GET /api/transactions/:id` — single transaction detail, scoped to the requesting user (verified an admin account gets a 404, not another user's data, when requesting someone else's transaction id).
- This is additive: the existing `GET /api/wallet/transactions` (Stage 5, used by Wallet.jsx's compact recent-activity list) is untouched.
- Frontend: new page `Front-End/src/Pages/TransactionHistory.jsx` at `/transactions` — a filter bar (type/asset/status/date range), a paginated table, and a click-through detail modal showing the full row including reference and tx hash. Added a "Transactions" sidebar link everywhere the other wallet-action pages link to each other.
- Verified end-to-end live against the real DB (9 transactions accumulated from the Stage 6-10 testing sessions): unfiltered pagination totals are correct, single-type and multi-type filters narrow correctly, asset and status filters work, an out-of-range date filter correctly returns zero results, single-transaction lookup works, and cross-user access is correctly blocked with a 404.

### Known remaining Stage 11 items

- Status tracking only ever shows `COMPLETED` transactions today, since every write path (buy/sell/deposit webhook/withdrawal confirm) only inserts into `transactions` once an action fully completes — `PENDING`/`FAILED` states live in the domain tables (`orders`, `deposits`, `withdrawals`) until then. The filter still accepts `PENDING`/`FAILED` for forward-compatibility, it just won't currently match anything.
- No CSV/export option.
- No full-text search across reference/tx_hash — only exact-match structured filters.

### Stage 10 — what was added (uncommitted — review with `git status`/`git diff`)

- Two new columns on `withdrawals` (`confirmation_token`, `confirmation_expires_at`; unique index on the token) — applied directly to the local dev DB and `Back-End/db/schema.sql` re-dumped to reflect it.
- **Email-confirmed withdrawals — the core security control for this stage.** Requesting a withdrawal (crypto or fiat) never moves money out; it reserves the funds (see below) and emails a confirmation link that expires in 15 minutes. Nothing is actually sent/processed until that link is clicked. This means a stolen JWT/session alone cannot drain a wallet — an attacker would also need the victim's email inbox. `Back-End/controllers/withdrawalController.js` mirrors the existing verify-email/reset-password token pattern from `authController.js` (`crypto.randomBytes` token, expiry column, public GET-by-token endpoint).
- **Funds reservation using the previously-unused `locked_balance` column** (present on `wallet_balances` since Stage 5, never written to until now): on request, `amount` moves from `available_balance` to `locked_balance` (so it can't be double-spent by a buy/sell/second withdrawal while the confirmation email is outstanding) inside a locked transaction with http://localhost:5173/the same balance-sufficiency check as Stage 7 sells. On confirmation, `locked_balance` is debited for good. On cancellation or expiry, it's released back to `available_balance`.
- `POST /api/withdrawals/crypto` — validates asset/network (reusing Stage 9's `cryptoNetworks.js`), destination address format per network (`Back-End/config/withdrawalConfig.js`, e.g. `0x`+40 hex for ERC20/BEP20, `bc1.../1.../3...` for BTC — loose format checks, not full checksum validation), a flat per-asset network fee, and min/max withdrawal value in USD via the Stage 6/7/9 live-price oracle. `receive_amount = amount - fee`; the wallet is debited the full `amount`.
- `POST /api/withdrawals/fiat` — USD only, requires basic bank details (holder name, account number, bank name) in the `bank_details` JSONB column, 1% fee, $20–$10,000 range.
- `GET /api/withdrawals/confirm?token=...` — public (reached from the emailed link, same as `/api/auth/verify-email`), finalizes the withdrawal: releases the lock, generates a fake tx hash for crypto, inserts a `transactions` row (type `WITHDRAWAL`), and sends a completion email. Replaying a used/expired/unknown token is safely rejected, not double-processed.
- `POST /api/withdrawals/:id/cancel` — lets the user cancel their own still-pending withdrawal and get the reserved funds back immediately, without waiting for the email.
- **Lazy expiry**: there's no cron sweep for withdrawals whose 15-minute window lapsed unconfirmed — the first `GET /api/withdrawals` or `GET /api/withdrawals/:id` after expiry atomically flips the row to `EXPIRED` and releases the lock. Verified directly (backdated `confirmation_expires_at` in the DB, then confirmed a `GET` both changed the status and restored the balance).
- Frontend: `Front-End/src/Pages/CryptoWithdraw.jsx` (`/withdraw/crypto`) and `Front-End/src/Pages/FiatWithdraw.jsx` (`/withdraw`) — 3-step flows (details → review → status), where the status step polls `GET /api/withdrawals/:id` every 2s and shows "check your email" while pending, with a Cancel button. `Front-End/src/Pages/WithdrawalConfirm.jsx` (`/withdrawals/confirm`) is the landing page the emailed link opens, mirroring the existing `VerifyEmail.jsx` pattern exactly. Added "Withdraw"/"Send Crypto" sidebar links everywhere the other wallet-action pages link to each other.
- Verified end-to-end live against the local DB: invalid address format rejected, amount-below-network-fee rejected, insufficient balance rejected, a valid crypto withdrawal correctly moved funds from available→locked, the emailed confirmation token correctly finalized it (locked→gone, `transactions` row inserted, tx hash generated) and a replayed/wrong token was rejected, cancelling a pending withdrawal released the lock back to available, a fiat withdrawal completed correctly with bank details, and cross-network address validation correctly rejected an ERC20-style address submitted against the TRC20 network.

### Known remaining Stage 10 items

- Address validation is format-only (regex per network), not real checksum/chain validation — a well-formed but non-existent address would still be accepted, same limitation real exchanges partially solve with third-party validation libraries.
- No 2FA/OTP step — email-link confirmation is the only security control. A real system would likely add TOTP for larger withdrawals.
- Expiry is lazy (checked on next read), not swept proactively — same architectural note as Stage 9's confirmation ticking; acceptable for a single-process demo, would need a durable job in production.
- Fiat withdrawal bank details are stored as free-form JSONB with minimal validation (non-empty strings only) — no real bank-account verification (e.g. micro-deposits) exists.

### Stage 9 — what was added (uncommitted — review with `git status`/`git diff`)

- Two new DB objects (applied directly to the local dev DB, no migration tooling in this project — `Back-End/db/schema.sql` re-dumped to reflect them): `deposits.confirmations`/`deposits.required_confirmations` columns, and a new `deposit_addresses` table (`user_id, asset, network, address, memo`, unique per user+asset+network) so each user gets a stable, reusable deposit address per asset/network instead of a new one every time.
- `Back-End/config/cryptoNetworks.js` — per-asset network list (USDT supports ERC20/BEP20/TRC20; the rest are single-network), required confirmation counts, and minimum deposit amounts. Confirmation counts are demo-scaled down from real-world values (e.g. BTC 2 instead of ~6) so the simulation finishes in seconds rather than minutes.
- `Back-End/services/cryptoDepositService.js` — deterministically derives a realistic-looking (but non-functional) address per user+asset+network from an HMAC, so the same request always returns the same address. **These are not real chain addresses and nothing is watching any blockchain** — every surface (API response, UI) carries an explicit `demo: true` / warning flag, same convention as Stage 6/8's payment demo mode.
- `GET /api/deposits/crypto/networks?asset=X` — networks available for an asset.
- `GET /api/deposits/crypto/address?asset=X&network=Y` — get-or-create the user's persistent address for that asset/network, plus a QR code (reusing the `qrcode` package already used by Stage 2's QR login) and, for assets that need one (XRP), a destination tag/memo.
- `POST /api/deposits/crypto/simulate` — since there's no real blockchain-watching infrastructure, this stands in for the on-chain detection a production integration would perform automatically (e.g. a webhook from BlockCypher/Alchemy). It creates a `PENDING` deposit, then ticks `confirmations` up over time; the wallet is only credited once `confirmations` reaches `required_confirmations`, inside a locked DB transaction (`SELECT ... FOR UPDATE` on the wallet row) — mirroring the Stage 8 rule that only a confirmed, asynchronous event credits funds, never the initiating request.
- Deposit-completed email (`cryptoDepositConfirmationEmail`, new template) and notification fire once a simulated deposit completes, same as Stage 8 fiat deposits.
- Frontend: new page `Front-End/src/Pages/CryptoDeposit.jsx` at `/deposit/crypto` — asset/network pickers, address + QR + copy-to-clipboard, a prominent non-dismissable "do not send real funds" warning, and a clearly-separated "Demo Tools" panel (dashed border, explicitly labeled as a stand-in for real on-chain detection) to simulate an incoming deposit and watch confirmations progress live via polling. Added a "Receive Crypto" sidebar link alongside the existing "Deposit" link on Overview/BuyCrypto/SellCrypto/Wallet/DepositFiat, and registered the route in `App.jsx` behind `ProtectedRoute`.
- Verified end-to-end against the live local DB: address generation is stable across repeat calls (same address returned every time), a below-minimum-amount simulate is rejected, simulating before an address exists is rejected, confirmations progress 0 → 1 → 2 and only then credits the wallet by exactly the simulated amount, and `GET /api/deposits` correctly returns a unified list mixing Stage 8 fiat rows and Stage 9 crypto rows.

### Known remaining Stage 9 items

- This is demo/testnet mode by necessity — there is no real custody wallet, HD key derivation, or blockchain node/indexer integration. The generated addresses are for UI/UX demonstration only.
- `POST /api/deposits/crypto/simulate` is itself the "demo tool" the checklist calls for, but it's a real, unauthenticated-by-role endpoint reachable by any logged-in user (rate-limited like other deposit routes) — it would need to be removed or gated entirely once a real chain-watching integration replaces it, not just left disabled.
- Confirmation ticking runs in-process via `setInterval`; if the backend restarts mid-simulation, that deposit is stuck `PENDING` forever (no resume-on-boot sweep). Not an issue for a single-process demo, but would need a durable job/queue in production.
- No dedicated crypto-deposit history view beyond the generic Wallet transaction feed and `GET /api/deposits` — same gap noted in Stage 8, deferred to Stage 11 (Transaction System).

### Stage 8 — what was added (uncommitted — review with `git status`/`git diff`)

- `POST /api/deposits/fiat` (`Back-End/controllers/depositController.js`) creates a `PENDING` deposit row (server-computed fee: 1.5% card / 0% bank, from `Back-End/config/paymentConfig.js`), then calls `paymentProviderService.initiateDeposit`, which — in demo mode, since no real provider is configured — schedules a real, HMAC-signed HTTP callback to our own `/api/webhooks/payments` ~1.5s later. This exercises the exact pending → provider-webhook → completed lifecycle a real provider (Stripe, etc.) would drive, addressing the Stage 6 "charge-then-hope" caveat: the wallet balance is only ever credited by the webhook handler, inside its own DB transaction with `SELECT ... FOR UPDATE` row-locking — never by the initiating request.
- `POST /api/webhooks/payments` (public, not JWT-protected — a real provider can't log in as a user) verifies an HMAC-SHA256 signature (`X-Webhook-Signature`, timing-safe compare) over the raw request body before trusting anything in it. Verified: a correctly-signed completion payload credits the wallet and marks the deposit `COMPLETED`; a bad/missing signature is rejected with 401; an unknown `reference` 404s; a signed payload with `status: "failed"` marks the deposit `FAILED` with no balance change and fires a notification; replaying an already-processed reference is a safe no-op (`"Already processed"`) rather than double-crediting — verified all five cases directly against the running server with correctly HMAC-signed requests.
- `GET /api/deposits` and `GET /api/deposits/:id` — deposit history and single-deposit status lookup (used by the frontend to poll a pending deposit to completion).
- Deposit fee/net calculation, min/max ($10–$10,000), and payment-method validation all happen server-side, mirroring the Stage 6/7 pattern.
- A completed deposit inserts a `transactions` row (type `DEPOSIT`), so it automatically shows up in Wallet's existing "Recent Wallet Activity" feed from Stage 5 — no extra frontend work needed for transaction history.
- Frontend: new `Front-End/src/Pages/DepositFiat.jsx` at `/deposit` — a 4-step flow (amount+currency → notes → payment method → status) matching the Buy/Sell page pattern. Since a deposit is asynchronous (unlike the synchronous buy/sell), step 4 polls `GET /api/deposits/:id` every 1.5s and renders a pending/completed/failed state rather than assuming success. Fiat currency selection is present in the UI but only USD is enabled (EUR/GBP shown as "Coming soon"), matching how Buy/Sell only expose their currently-supported asset list. Added a "Deposit" sidebar link to Overview/BuyCrypto/SellCrypto/Wallet and registered the route in `App.jsx` behind `ProtectedRoute`.
- End-to-end verified live against the local DB: a real deposit request went `PENDING` → `COMPLETED` via the actual webhook round-trip (not mocked) and credited the wallet by exactly the net amount; a `forceFail` deposit went `PENDING` → `FAILED` with no balance change.

### Known remaining Stage 8 items

- Only USD fiat deposits are supported (`DEPOSIT_FEE_RATES`/`MIN_DEPOSIT_USD`/`MAX_DEPOSIT_USD` in `paymentConfig.js` are USD-only) — EUR/GBP are shown in the UI as disabled placeholders, not implemented.
- `forceFail` is a demo-only escape hatch on the request body (not exposed in the UI) used to test the failure path; it has no effect once a real `PAYMENT_PROVIDER` is configured (`initiateDeposit` throws instead).
- Same idempotency caveat as Stage 6/7 — duplicate-submission protection is currently just the frontend disabling the button while a request is in flight (the webhook side is properly idempotent by `provider_reference`, but nothing stops a user from submitting two separate deposit requests).
- No UI list of past deposits yet beyond what surfaces through Wallet's generic transaction feed; a dedicated deposit-history view is Stage 11 (Transaction System) territory.

### Stage 7 — what was added (uncommitted — review with `git status`/`git diff`)

- `POST /api/orders/sell` (`Back-End/controllers/orderController.js`) — the mirror of Stage 6's buy flow. Sells debit the crypto `available_balance` and credit USD `available_balance` in the same wallet (there's no real bank payout yet — that's Stage 10 withdrawals; proceeds land in the internal USD balance, which is exactly what Stage 6 established as the pattern).
- Backend validates the *actual* available balance before allowing a sale — verified selling with zero balance is rejected, and selling more than held (but within the $10–$10,000 value bounds, so it isn't caught by the amount-range check) is correctly rejected with "Insufficient balance".
- **Stress-tested 5 concurrent sell requests** where only enough balance existed for 4 — exactly 4 succeeded and the 5th correctly failed with "Insufficient balance"; the wallet balance never went negative. Same `SELECT...FOR UPDATE` row-lock pattern as Stage 6 buys, so buys and sells for the same user also serialize against each other correctly.
- Sell order confirmation email (`sellOrderEmail` template) and a "Sell order completed" notification fire on success.
- Frontend: `SellCrypto.jsx`'s "Confirm Sale" button (previously `alert("Sell order will be connected to the backend.")`) now calls the real endpoint with the same submitting/error/confirmation pattern as Buy, including a Step 4 confirmation screen with the real order/transaction details.

### Known remaining Stage 7 items

- Same idempotency caveat as Stage 6 — duplicate-submission protection is currently just the frontend disabling the button while a request is in flight.
- Selling always credits the internal USD wallet balance; there's no option yet to receive a different fiat currency or have it paid out externally — that's Stage 10 (withdrawals) territory.

### Stage 6 — what was added (uncommitted — review with `git status`/`git diff`)

- `POST /api/orders/buy` — the real backend behind the Buy Crypto page. Architecture decision: buying pays via an external payment method (card/bank), matching the existing 3-step UI's payment-method selector, rather than requiring the user to already hold USD in their wallet — that's a different, separate flow (fiat deposit, Stage 8). Since no real payment provider is wired up yet, `Back-End/services/paymentProviderService.js` simulates the charge in **demo mode** (always succeeds instantly, clearly labeled `demo: true` in the response) — architected so a real provider (Stripe etc.) can be dropped in later in one place without touching the order controller.
- Server is the sole source of truth for price and fee: live price comes from the Stage 5 `assetPrices` helper (never from the client), fee is `1%` (`Back-End/config/tradingConfig.js`), and a client-sent `price` field is silently ignored — verified by sending a spoofed `"price": 1` and confirming the order still executed at the real market price.
- Full server-side validation: rejects negative/zero amounts, amounts outside $10–$10,000, unsupported assets, and invalid payment methods — verified all five cases return the correct 400s.
- Order creation, transaction recording, and the wallet balance credit happen in one DB transaction with `SELECT ... FOR UPDATE` row-locking on the wallet row. **Stress-tested with 10 concurrent buy requests for the same user** — all 10 succeeded, all 10 orders were recorded, and the final balance exactly matched the sum of all 10 purchases (no lost updates from the race).
- Buy order confirmation email (`buyOrderEmail` template) and a real "Buy order completed" notification fire on success.
- `GET /api/orders` — paginated order history, ready for Stage 12.
- Frontend: `BuyCrypto.jsx`'s Step 3 "Pay" button previously just showed `alert("Payment integration will be connected to the backend.")` — it now calls the real endpoint, disables itself while submitting (duplicate-submission guard), shows inline errors, and a new Step 4 confirmation screen with the real order/transaction details and a demo-mode notice. `/buy-Crypto` and `/sell-crypto` are now wrapped in `ProtectedRoute` since they perform authenticated transactions.

### Known remaining Stage 6 items

- If the DB transaction fails *after* the simulated payment "succeeds," there's no refund/reversal logic — a non-issue in demo mode (no real money moved) but must be addressed when Stage 8 wires in a real payment provider (reserve-then-capture or webhook-confirmed capture, not charge-then-hope).
- Only the assets in `SUPPORTED_ASSETS` (from Stage 5's price map) can be bought.
- No idempotency-key mechanism beyond the frontend disabling the button during submission — acceptable for now, but a real duplicate-request guard (e.g. client-supplied idempotency key checked server-side) would be needed before production.

### Stage 5 — what was added (uncommitted — review with `git status`/`git diff`)

- `GET /api/wallet` now returns real per-asset balances (available/locked/total) joined from `wallet_balances`, with live USD pricing per asset (`Back-End/utils/assetPrices.js` maps a small set of supported symbols — BTC/ETH/BNB/SOL/XRP/DOGE/ADA/USDT/USD — to CoinGecko IDs and prices them via the Stage 4 market data proxy) and a computed `portfolioValue`. Verified with a manually-inserted 0.5 BTC balance that the USD conversion is correct and live.
- `GET /api/wallet/transactions` — reads from the existing (previously unused) `transactions` table for a "recent activity" feed; correctly returns empty until Stage 6+ (buy/sell) actually creates transaction rows.
- `Wallet.jsx` was previously 100% hardcoded (fake "0.79253864 BTC / $12,068.83", and a literally empty asset list with a "here I'm going to display coins" comment). It now shows real portfolio value, a real per-asset balance table with a working search filter, a balance-hide toggle, and a real (currently-empty, correctly so) recent-activity section, plus an honest empty state with a Buy Crypto CTA when the wallet has no assets.
- Dashboard's hardcoded `$132,832.89` balance and non-functional "Your assets" search box are replaced with the real portfolio value and a live top-3 holdings list from the same endpoint. "Top up balance" now links to `/wallet` instead of doing nothing.

### Known remaining Stage 5 items

- Only a small hardcoded set of assets have USD pricing (`SYMBOL_TO_COINGECKO_ID` in `assetPrices.js`) — an asset outside that list would price at $0. Fine for now since no deposit/buy flow can create other assets yet; revisit when Stage 9 (crypto deposits) adds more assets.
- Wallet page's currency toggle/amount input next to the old "Show balance" button was a dead, unlabeled input with no handler — removed rather than faked; USD is the only display currency for now (ties into the preferences-currency work from Stage 3, which isn't applied to price conversion yet).

### Stage 4 — what was added (uncommitted — review with `git status`/`git diff`)

- New backend market data proxy (`Back-End/services/marketDataService.js`, `controllers/marketController.js`, `routes/marketRoutes.js`) mounted at `/api/markets`: `GET /coins` (list), `GET /global`, `GET /coins/:id` (detail), `GET /price` (simple price), `GET /ticker/:symbol` (Binance 24hr ticker).
- In-memory caching (`Back-End/utils/cache.js`) with per-endpoint TTLs (10–60s) so repeated requests from multiple users/tabs don't each hit CoinGecko/Binance — and if the upstream call fails, the proxy serves the last-known-good cached value instead of erroring, so a transient CoinGecko/Binance outage or rate limit doesn't take down the UI.
- Moved `COINGECKO_API_KEY` from the frontend's `VITE_`-prefixed env var (which is bundled into the public JS bundle — anyone could read it in devtools) to the backend `.env`, where it's attached server-side only. Removed it from `Front-End/.env`/`.env.example` entirely.
- Every direct third-party API call from the browser (`Dashboard.jsx`, `Markets.jsx`, `Exchange.jsx`, `CryptoMarketBar.jsx`, `DerivativesMarketTable.jsx`, `src/api/coingecko.js`) now goes through the backend proxy instead of `api.coingecko.com`/`api.binance.com` directly. Kept the `coingecko.js` filename/export names to minimize call-site churn; added `getCoinsMarkets`, `getGlobalMarketData`, `getCoinDetail`, `getBinanceTicker`.
- Verified all five proxy endpoints return real live data via curl; existing loading/error states in `Markets.jsx`/`CryptoMarketBar.jsx`/`DerivativesMarketTable.jsx` were already reasonably built and needed no rework, just a swap of the fetch target. Frontend `npm run build` still succeeds; smoke-tested the dev server serves the app on 5173 talking to the backend on 5000.

### Known remaining Stage 4 items

- CoinGecko/Binance rate limits are only mitigated by the cache TTLs — there's no explicit backoff/retry policy if the upstream API changes its limits; revisit if 502s start showing up in logs.
- No WebSocket/streaming price feed — everything is poll-based (matches the pre-existing pattern, just proxied now).

### Stage 3 — what was added (uncommitted — review with `git status`/`git diff`)

- Real notifications system backed by the existing `notifications` table: `GET /api/notifications` (paginated, returns unread count), `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`. A reusable `utils/notify.js` helper now fires real notifications on register (welcome) and on password change/reset (security alert), so the feature has real data flowing into it instead of being an empty stub.
- `Notifications.jsx` is now a full page: loading/error/empty states, mark-as-read on click, "mark all as read", relative timestamps. The Dashboard bell icon now shows a live unread-count badge and links to it.
- `PUT /api/users/profile` (update fullname/surname/country/phone) and `PUT /api/users/preferences` (currency/language/theme/email notifications, backed by the existing `preferences` jsonb column on `users`) — both protected, both validated.
- `ProfileAndSetting.jsx` "User Profile" tab now fetches and edits real profile data (previously hardcoded to a fake name/email) and shows a verified/not-verified badge. Added a new "Preferences" tab wired to the endpoint above and synced with the existing `ThemeProvider` toggle. "API keys"/"Login history"/"2FA" tabs are left as explicit "coming soon" placeholders rather than dead links — building those out is future work (2FA is listed as architecture-only in the spec; API keys/login history need their own schema and aren't part of the core spec).
- Verified end-to-end: register → welcome notification appears → mark-as-read/mark-all-as-read → profile GET/PUT → preferences PUT, all against the live local DB. Frontend `npm run build` still succeeds.

### Known remaining Stage 3 items

- Dashboard's ticker bar, order book, recent trades, and "Order History" table are still hardcoded/mock data — that's Stage 4 (market data) and Stage 12 (orders) work, not Stage 3.
- No "active sessions" / "logout other sessions" feature — the app uses stateless JWTs with no session table, so there's nothing server-side to revoke yet. Would need a sessions table + refresh-token model to do properly; flagging rather than half-building it.
- `Front-End/src/context/ThemeContext.jsx` is dead/orphaned code (the real theme context lives in `Components/ThemeProvider.jsx`) — noted for a future cleanup pass, not touched here to keep this diff focused.

### Stage 2 — what was added (uncommitted — review with `git status`/`git diff`)

- Email service (`Back-End/utils/emailService.js`) with real SMTP support (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM` in `.env`) and a **demo-mode fallback** that logs the email to the server console when SMTP isn't configured, so verification/reset flows are fully testable without real mail credentials. This must not be mistaken for production email delivery — configure real SMTP before going live.
- Three responsive HTML email templates in `Back-End/emails/`: welcome/verify, password reset, password changed.
- `POST /api/auth/register` now generates a verification token (24h expiry) and emails a verify link; `GET /api/auth/verify-email?token=...` verifies it.
- `POST /api/auth/forgot-password` (always returns the same generic message whether or not the email exists — no user enumeration) generates a 30-minute reset token and emails a reset link.
- `POST /api/auth/reset-password` validates the token+expiry, updates the password, invalidates the token (verified: reusing a spent token is rejected), and sends a "password changed" confirmation email.
- `POST /api/users/change-password` (protected, requires current password) for logged-in users, with the same confirmation email.
- Login now returns `isVerified` so the frontend can react to verification state.
- Frontend: new `/verify-email`, `/reset-password` pages, a functional `/forgot-password` form, and a working "Change password" tab wired into `ProfileAndSetting.jsx`.
- Verified end-to-end against the live local DB: register → grab token from DB → verify-email → forgot-password (enumeration-safe) → reset-password → login with new password → reused-token rejected → change-password (wrong current password rejected, correct one works, new password logs in). Test user cleaned up after. Frontend `npm run build` still succeeds.

### Known remaining Stage 2 items

- `ProfileAndSetting.jsx`'s "User Profile" tab (name/email header, Referrals/API keys/Login history/2FA tabs) still shows static/placeholder content — real profile data wiring is Stage 3.
- No email verification *enforcement* yet (unverified users can still log in and use the app) — intentional for now so testing isn't blocked; revisit if you want verification to gate access.
- SMTP is not actually configured (demo mode) — you'll need real SMTP credentials before any of this sends real email.

### What changed in Stage 1 (uncommitted — review with `git status`/`git diff`)

- Rotated the local Postgres password and generated a new `JWT_SECRET` (both verified working). **`VITE_COINGECKO_API_KEY` still needs manual rotation** via your CoinGecko dashboard — it was exposed client-side and is in git history.
- Added `Back-End/.gitignore` + `.env.example` for both packages; untracked `.env` and `Back-End/node_modules` from git (**not yet purged from history** — old, now-rotated credentials are still visible in past commits on GitHub until you decide to do that purge).
- Dumped the real (previously undocumented, DB-only) schema to `Back-End/db/schema.sql` — it already includes `orders`, `transactions`, `deposits`, `withdrawals`, `notifications`, `wallet_balances`, and KYC/role/verification columns on `users`, none of which the backend code currently uses.
- Fixed Signup posting to the wrong URL; register now persists full signup data (name/surname/country/phone) inside a DB transaction with wallet creation.
- Login no longer reveals whether an email exists; 500 responses no longer leak raw error messages; added rate limiting on `/api/auth/*`; added a 404 handler and centralized Express error handler.
- Replaced hardcoded `localhost`/LAN-IP URLs with env-driven config (`VITE_API_BASE_URL` on the frontend, `FRONTEND_URL`/`PORT` on the backend).
- Wired the previously-unused `ProtectedRoute` onto `/dashboard`, `/wallet`, `/notifications`, `/orderstrades`, `/profile-setting`; implemented working logout; routed the orphaned `Forgot.jsx` page at `/forgot-password` and linked it from Signin.
- Verified: backend boots and connects to Postgres + Redis; frontend `npm run build` succeeds; register → login → `/api/wallet` → `/api/users/profile` tested end-to-end against the live local DB (test user cleaned up after).

### Known remaining Stage 1 items

- Git history still contains the old (rotated) secrets — purge deferred at your request.
- `Back-End/controllers/qrController.js` is dead code (not wired into `qrRoutes.js`, which has its own inline QR implementation) — duplicate QR logic to clean up in a later pass.
- `Front-End/src/Pages/QRScanner.jsx` is unrouted and sends a hardcoded placeholder `userId` — incomplete/unused flow.
- No migration *tool* yet, just a checked-in `schema.sql` snapshot — fine for now, worth revisiting once the schema starts changing frequently.

---

## Repository Audit Summary (2026-09-18)

### Existing functionality (works today)

- **Frontend shell**: React 19 + Vite + Tailwind v4, React Router with ~20 pages, dark/light theme via `ThemeContext`, Navbar/Footer.
- **Backend shell**: Express 5 server (`Back-End/server.js`) with CORS + JSON middleware, PostgreSQL via `pg` Pool, Redis via `ioredis`, Socket.IO.
- **Register/Login (backend)**: `POST /api/auth/register` and `POST /api/auth/login` — passwords hashed with `bcrypt`, JWT issued on login (`authController.js`). A `wallets` row is created for each new user.
- **Auth middleware**: `authenticate.js` validates `Authorization: Bearer <jwt>` and attaches `req.user`.
- **Profile read**: `GET /api/users/profile` (protected) returns basic user fields.
- **Wallet read**: `GET /api/wallet` (protected) returns the raw wallet row.
- **QR login**: `POST /api/qr/init` generates a QR code + token stored in Redis (60s TTL); Socket.IO room join per token exists in `socket.js`, and `Signin.jsx` renders/polls it. (Server-side "scan confirms login" emit was not found — see Broken below.)
- **Market data**: `Front-End/src/api/coingecko.js` + ad-hoc `fetch` calls in `Dashboard.jsx`/`BuyCrypto.jsx`/`SellCrypto.jsx` call CoinGecko and Binance directly from the browser.

### Broken functionality

- **Signup page posts to the wrong URL**: `Signup.jsx` calls `http://localhost:5000/register` — the real route is `http://localhost:5000/api/auth/register`. Registration is currently non-functional from the UI.
- **QR login has no server-side "confirm" endpoint**: nothing in `qrRoutes.js`/`qrController.js` emits `qr-login-success`, so the flow the frontend listens for never fires.
- **`ProtectedRoute` component exists but is unused**: `App.jsx` mounts `/dashboard`, `/wallet`, `/profile-setting`, `/notifications`, `/orderstrades` without wrapping them — any visitor can open authenticated-looking pages without a token (frontend-only; backend endpoints are separately protected, but the pages themselves render regardless).
- **No logout implementation**: the sidebar "Log out" in `Dashboard.jsx` is a static label, not wired to clear the token.
- **`Forgot.jsx` exists but is never routed** in `App.jsx`, and "Forgot Password?" in `Signin.jsx` is plain text, not a link.
- **Backend `walletRoutes`/`userRoutes` reference a `wallets`/`users` schema that has no migration file anywhere in the repo** — the schema only exists in whatever the developer's local Postgres instance currently has (undocumented, unversioned).

### Missing functionality (relative to a working exchange)

- Email verification, forgot/reset password, change password — no routes, controllers, or email service exist at all (no nodemailer/SES/SendGrid dependency, no templates).
- Buy/Sell crypto backend — `BuyCrypto.jsx`/`SellCrypto.jsx` are frontend-only forms with local price fetches; there is no `/api/orders`, `/api/trades`, or balance-mutating endpoint. Confirming a "purchase" does not touch the database.
- Deposits (fiat or crypto) — no routes, no provider integration, no deposit-address generation.
- Withdrawals — none.
- Transaction history / order history — no `transactions` or `orders` tables/endpoints; `OrdersTrades.jsx`/Dashboard "Order History" table is hardcoded static rows.
- Notifications — `Notifications.jsx` page exists but no backend model/endpoint feeds it.
- Wallet/portfolio page — `Wallet.jsx` renders no dynamic content currently (no fetch calls found).
- Profile/settings mutations — only GET profile exists; no update-profile, no security/session management, no 2FA.
- Admin dashboard / roles — no role column, no admin routes, no RBAC middleware.
- Fees architecture — no fee config or calculation anywhere.
- Tests — zero test files in either package; no test runner configured.
- API documentation — none (no Swagger/OpenAPI).
- Database migrations — no migration tool (Knex/Prisma/node-pg-migrate) or `schema.sql` checked in — schema is undocumented.
- `.env.example` — does not exist in either package.

### Architecture problems

- **Frontend calls third-party APIs (CoinGecko, Binance) directly from the browser** instead of proxying through the backend, duplicating fetch logic across `coingecko.js`, `Dashboard.jsx`, `BuyCrypto.jsx`, and `SellCrypto.jsx` independently, with no shared caching/rate-limit handling.
- **Hardcoded backend URLs** (`http://localhost:5000`, `http://192.168.0.117:5173`) scattered across frontend and backend files instead of environment variables — will break outside the developer's machine.
- **CORS origin hardcoded** to `http://localhost:5173` in both `server.js` and `socket.js`.
- **No transactional integrity**: register creates a `users` row then a `wallets` row as two separate queries with no DB transaction — a crash between them leaves an orphaned user with no wallet.
- **No service/repository layer** — controllers talk to `pool.query` directly with no shared data-access layer, which will not scale once orders/transactions/wallets need coordinated, atomic updates.
- **No centralized error-handling middleware** in Express — every controller hand-rolls try/catch and status codes inconsistently.

### Security problems (high priority)

- 🔴 **`Back-End/.env` and `Front-End/.env` are committed to git** (tracked since the very first backend commit, `ea77947`) — real `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `JWT_SECRET` values are in git history, not just the working tree. **These credentials must be treated as compromised and rotated**, and the files should be removed from tracking (and ideally purged from history) once you confirm you want that.
- 🔴 **`node_modules` is committed to git** in `Back-End` (confirmed via `git ls-files`) — bloats the repo and can vendor-in vulnerable/stale packages silently.
- 🔴 **No root or Back-End `.gitignore`** — only `Front-End/.gitignore` exists, which is why the above happened.
- **CoinGecko API key is exposed client-side** via `VITE_COINGECKO_API_KEY` — any Vite `VITE_*` var is bundled into the public JS and visible to anyone. Should be proxied server-side.
- **JWT has no refresh mechanism and a 1h hard expiry** with no logout/revocation (no token blacklist or session table) — acceptable short-term, but no session management exists at all.
- **No rate limiting** on `/api/auth/login` or `/api/auth/register` — brute-force/credential-stuffing is currently unmitigated.
- **No input validation** on register/login (no email format check, no password strength enforcement server-side — only enforced client-side in `Signup.jsx`, which is trivially bypassed by calling the API directly).
- **Generic 500 responses leak `error.message`** directly to clients in all three controllers — can leak internal details (e.g., raw Postgres errors).
- **Login response distinguishes "user not found" vs "invalid password"** (404 vs 401) — user-enumeration vector.

### Recommended implementation order

Given the current state (functional UI shell, minimal auth-only backend, no trading/money-movement logic at all), I recommend:

1. **Stage 1 — Foundation & security remediation** (must happen first, before adding money-moving features on top of a leaky foundation): rotate leaked DB/JWT secrets, untrack `.env`/`node_modules`, add proper `.gitignore`s and `.env.example`s, fix the Signup URL bug, centralize API base URL via env vars, add a migrations tool and check in the real schema, add central error handling.
2. **Stage 2 — Authentication completion**: email verification, forgot/reset/change password + email templates, wire up logout, protect frontend routes with the existing `ProtectedRoute`, server-side input validation, rate limiting.
3. **Stage 4 — Market data**: move CoinGecko/Binance calls behind a backend proxy with caching.
4. **Stage 5 — Wallet/portfolio**: real balances backing `Wallet.jsx`/Dashboard.
5. **Stage 6/7 — Buy/Sell**: real order + transaction tables, atomic balance updates.
6. **Stage 8–10 — Deposits/Withdrawals** (demo/mock mode first, clearly labeled).
7. **Stage 11–13 — Transactions, Orders, Notifications** pages backed by real data.
8. **Stage 14+ — Admin, security hardening pass, responsive/accessibility pass, tests.**

---

## Project Development Status

### Stage 0 — Repository Audit
- [x] Inspect Front-End
- [x] Inspect Back-End
- [x] Inspect database
- [x] Inspect authentication
- [x] Inspect API integrations
- [x] Identify broken functionality
- [x] Identify missing functionality
- [x] Create implementation plan

### Stage 1 — Foundation
- [x] Frontend runs successfully
- [x] Backend runs successfully
- [x] Database connects successfully
- [x] Environment variables documented
- [x] API communication works
- [x] CORS configured correctly
- [x] Error handling established

### Stage 2 — Authentication
- [x] Registration
- [x] Login
- [x] Logout
- [x] Protected routes
- [x] Password hashing
- [x] Email verification
- [x] Forgot password
- [x] Reset password
- [x] Change password
- [x] Registration email (demo mode — logs to console until SMTP is configured)
- [x] Password reset email (demo mode — logs to console until SMTP is configured)

### Stage 3 — User Account
- [ ] Dashboard (balance panel now real; order book/trades/order-history table still mock data — Stage 12 work)
- [x] Profile
- [x] Settings
- [ ] Security settings (change password done; active sessions deferred, needs session infra)
- [x] Notifications
- [x] User preferences

### Stage 4 — Market Data
- [x] Market list
- [x] Crypto prices (proxied through backend)
- [x] Price changes (proxied through backend)
- [x] Charts (TradingView widget embedded)
- [x] Trading pairs
- [x] API error handling (502 with friendly message + stale-cache fallback)
- [x] Loading states
- [x] Caching/rate-limit handling (in-memory TTL cache)

### Stage 5 — Wallet
- [x] Wallet balances
- [x] Available balance
- [x] Locked balance
- [x] Portfolio value
- [x] Asset list
- [x] Wallet history (recent transactions feed; empty until Stage 6+ populates it)

### Stage 6 — Buy Crypto
- [x] Buy UI
- [x] Asset selection
- [x] Amount validation
- [x] Price calculation
- [x] Fee calculation
- [x] Order creation
- [x] Balance update
- [x] Transaction creation
- [x] Confirmation
- [x] Error handling

### Stage 7 — Sell Crypto
- [x] Sell UI
- [x] Asset selection
- [x] Amount validation
- [x] Price calculation
- [x] Fee calculation
- [x] Order creation
- [x] Balance update
- [x] Transaction creation
- [x] Confirmation
- [x] Error handling

### Stage 8 — Fiat Deposits
- [x] Deposit page
- [x] Fiat currency selection (USD only; EUR/GBP shown as "Coming soon")
- [x] Payment method
- [x] Fee calculation
- [x] Deposit request
- [x] Payment integration (demo mode — no real provider configured yet)
- [x] Webhook
- [x] Balance update
- [x] Transaction history (via existing Wallet recent-activity feed)
- [x] Failed payment handling

### Stage 9 — Crypto Deposits
- [x] Crypto selection
- [x] Network selection (USDT: ERC20/BEP20/TRC20; others single-network)
- [x] Deposit address (persistent, get-or-create per user+asset+network)
- [x] Memo/tag support (XRP destination tag)
- [x] QR code
- [x] Deposit detection (simulated — no real blockchain watcher; see Known remaining items)
- [x] Confirmations
- [x] Balance update
- [x] Transaction status
- [x] Testnet/demo mode

### Stage 10 — Withdrawals
- [x] Crypto withdrawal
- [x] Fiat withdrawal
- [x] Address validation (format/regex per network — not full checksum validation)
- [x] Balance validation
- [x] Fee calculation
- [x] Withdrawal status (PENDING_CONFIRMATION / COMPLETED / CANCELLED / EXPIRED)
- [x] Confirmation (email link, 15-minute expiry)
- [x] Security checks (email confirmation required before funds move; funds reserved via locked_balance)
- [x] Transaction history (via existing Wallet recent-activity feed + `GET /api/withdrawals`)

### Stage 11 — Transaction System
- [x] Transaction model (established since Stage 6; this stage adds the read/query layer)
- [x] Transaction history
- [x] Filtering (type, asset, status, date range)
- [x] Pagination
- [x] Transaction details
- [x] Status tracking (COMPLETED only today — see Known remaining items)
- [x] Blockchain transaction hash support

### Stage 12 — Orders
- [x] Order history (real data — Dashboard widget + dedicated `/orderstrades` page)
- [x] Order details (click-through modal, backed by `GET /api/orders/:id`)
- [x] Buy orders
- [x] Sell orders
- [x] Order statuses (OPEN/COMPLETED/CANCELLED supported — only COMPLETED occurs today, see Known remaining items)
- [x] Filtering (side, asset, status)
- [x] Pagination

### Stage 13 — Notifications
- [x] Notification system (real-time via Socket.IO, added this stage — was poll-on-load only before)
- [x] Read/unread
- [x] Notification page (full page with pagination, not just a shell — link-aware navigation added this stage)
- [x] Deposit notifications
- [x] Withdrawal notifications
- [x] Buy notifications
- [x] Sell notifications
- [x] Security notifications

### Stage 14 — Admin
- [x] Admin authentication (reuses existing JWT auth + fresh-per-request DB role check)
- [x] Role-based authorization
- [x] User management (search/filter, detail view, role promote/demote, suspend/reinstate)
- [x] Transaction management (cross-user view/filter)
- [x] Deposit management (cross-user view/filter — no manual status override, see Known remaining items)
- [x] Withdrawal management (cross-user view/filter + reject a pending withdrawal)
- [x] Order management (cross-user view/filter)
- [x] System statistics

### Stage 15 — Security
- [x] Authentication audit (found + fixed a real auth bypass in QR login)
- [x] Authorization audit
- [x] Input validation (found + fixed gaps in preferences/profile endpoints)
- [x] SQL injection protection (full grep audit of every query in every controller — clean)
- [x] XSS protection (found + fixed unescaped user input in email templates)
- [x] CSRF review (not applicable — Bearer-token auth only, no cookies)
- [x] Rate limiting (found + fixed 2 gaps: change-password, QR routes)
- [x] Secure headers (added helmet)
- [x] CORS review
- [ ] Secret management — **still not fully resolved, needs your decision** (see "Needs your decision" above): rotation/gitignore/.env.example done but uncommitted; git history purge explicitly deferred by you twice, still outstanding
- [x] Password security
- [x] Password-reset security
- [x] Transaction security

### Stage 16 — Responsive Design
- [x] 320px / 375px / 390px / 414px / 430px (375px and 414px verified live with real Chromium + zero overflow; 320/390/430 covered by the same mobile-first CSS, not individually screenshotted)
- [x] 768px / 820px / 1024px (768px and 1024px verified live with real Chromium + zero overflow)
- [x] 1280px / 1366px / 1440px / 1920px (1280px, 1440px, and 1920px verified live with real Chromium + zero overflow)
- [ ] 2560px (not specifically targeted — content areas are `max-w-*` bounded so nothing stretches unreasonably wide, but not verified at this exact size)
- [x] Mobile navigation (Navbar's hamburger menu already worked; Dashboard/Exchange's page-level sidebars now stack/scroll on mobile too)
- [x] Responsive tables (Wallet, TransactionHistory, OrdersTrades, AdminDashboard, Home's mock table, DerivativesMarketTable all scroll horizontally on overflow)
- [x] Responsive charts (TradingView widget container already `autosize`d; now sits in a properly stacking layout)
- [x] Responsive forms (every Buy/Sell/Deposit/Withdraw/Signup/Signin/Contact form fixed)
- [x] Responsive trading UI (Dashboard.jsx and Exchange.jsx both restructured to stack below their breakpoint)

### Stage 17 — Accessibility
- [x] Semantic HTML
- [x] Form labels
- [x] Keyboard navigation
- [x] Focus states
- [x] ARIA where required
- [x] Contrast
- [x] Screen-reader support

### Stage 18 — Testing
- [x] Unit tests
- [x] API tests
- [x] Authentication tests
- [x] Trading tests
- [x] Wallet tests
- [x] Transaction tests
- [x] Authorization tests
- [x] Frontend tests
- [x] End-to-end tests

### Stage 19 — Production Readiness
- [x] Build succeeds
- [x] Tests pass
- [x] No critical console errors
- [x] No critical backend errors
- [ ] No exposed secrets — **OPEN (needs you):** working tree clean; old creds remain in git history, CoinGecko key unrotated
- [x] Environment variables documented
- [x] Database migrations verified
- [x] Error handling verified
- [x] Logging verified
- [x] Performance reviewed
- [x] Security reviewed
- [x] Responsive review completed

### Stage 20 (2026-09-29) — Final QA
- [x] Every navigation link works
- [ ] Every page contains meaningful content — **true for every real feature page; 9 pre-existing marketing/placeholder stubs remain stubs (see below)**
- [x] Every form works
- [x] Every important button works
- [x] Register works
- [x] Login works
- [x] Logout works
- [x] Forgot password works
- [x] Reset password works
- [x] Buy works
- [x] Sell works
- [x] Fiat deposit works
- [x] Crypto deposit works
- [x] Withdraw works
- [x] Transactions work
- [x] Portfolio works
- [x] Notifications work
- [x] Mobile works
- [x] Tablet works
- [x] Desktop works
- [x] Production build works

This was a real, live-verification pass — actual running servers driven by a real headless browser (Playwright/Chromium), not a code-reading pass — because prior stages repeatedly found real bugs (a blank mobile Signin page, a broken Navbar, a Socket.IO auth bypass) that code-reading alone had missed. This environment has no outbound internet access, so CoinGecko/Binance can't be reached directly; the project's own existing E2E market-data stub (`Back-End/tests/helpers/upstreamStub.js`, already used by `npm run test:e2e`) was reused to give the backend deterministic prices, so Buy/Sell/Wallet could be driven through the real UI against the real dev database rather than skipped.

**Automated suites, re-run clean:** backend 250/250, frontend unit 36/36, E2E 35/35 (previously 34/35 — see bug #1 below). 321 total, 0 flaky.

**Real bugs found and fixed this stage:**

1. **A genuinely flaky E2E test, not a deadlock.** `e2e/quality.spec.js`'s "no console or page errors" test walks 25 full page loads against the real backend and was timing out at the global 45s default — reproduced in isolation at 46.7s, i.e. consistently *just* over the line, not hung. Gave that one test its own 90s budget (`test.setTimeout(90_000)`) rather than raising the global default for every other test. `Front-End/e2e/quality.spec.js`.
2. **QR-login rate limiter was shared between an unauthenticated poll and the actual login approval, and could lock a user out of a feature they never touched.** `Signin.jsx` calls `GET /api/qr/init` once on every mount *and* every 60s the tab stays open — so simply being redirected to `/signin` a handful of times (e.g. clicking a few protected links while logged out) burns through the same 30-requests/15-minute budget that `POST /api/qr/verify` (the actual security-sensitive, login-approving endpoint) uses. Reproduced live: a scripted walk through a dozen protected pages got 429 "Too many attempts" on `/signin` itself. Split into two limiters — `qrInitLimiter` (120/15min, since `/init` only mints an unauthenticated, side-effect-free session id) and the original tighter `qrLimiter` kept as-is for `/verify`. `Back-End/routes/qrRoutes.js`.
3. **Real responsive overflow bug on Profile & Settings.** The email address + "Verified" badge row (`flex items-center gap-2`, no wrap, no truncation) forced the page wider than the viewport on mobile (+20px) and tablet (+176px) for any normal-length email — reproduced consistently with a fresh test account, confirmed via `getBoundingClientRect()` that the "Verified" pill was the element pushing past the edge, and confirmed fixed (scrollWidth === clientWidth at both widths) after adding `flex-wrap` to the row and `break-all`/`shrink-0` to its children. `Front-End/src/Pages/ProfileAndSetting.jsx`.

**Verified end-to-end via the real UI (not just API calls), against the real dev database, then rolled back:** register → verify-email link → login → dashboard/wallet render real data → logout → forgot-password → reset-password → login with the new password. Buy (all 4 wizard steps, wallet credited, order `COMPLETED`) → Sell (wallet debited, order `COMPLETED`). Fiat deposit (all 3 wizard steps; confirmed the UI's own status polling flips "Confirming your deposit..." → "Deposit completed" within ~3s of the webhook crediting the wallet — an early check of mine raced ahead of that poll and looked like a failure until a longer observation window showed it was never broken). Crypto deposit (demo address shown with its warning banner, simulate-to-completion credits the wallet). Crypto withdrawal (request locks funds → confirmation token pulled from the DB exactly as a real email link would carry it → confirming permanently debits the lock → replaying the same link is correctly rejected, no double-debit). Fiat withdrawal (request locks USD funds). Transactions page lists the real rows generated by all of the above. Notifications page shows real, non-empty entries reflecting those actions. Theme toggle flips `dark` class + persists to `localStorage`.

**Navigation + responsive sweep:** every real route (22 authenticated + public pages) at 375/768/1440px, logged in as a real user, checking for broken navigation, console/page errors, and horizontal overflow — 0 failures after the fix above (bug #3 was caught by this exact sweep, consistently, before the fix; consistently clean after). The existing E2E responsive suite independently covers 375/768/1280/1920px and also passes.

**Production build:** `npm run build` succeeds (264 kB main bundle gzipped to 82 kB, per Stage 19's code-splitting). Served the actual `dist/` output standalone (`vite preview`) and drove it with a real browser against the real backend end-to-end (login, dashboard, live market data) — zero console errors. Separately confirmed the backend's Stage 19 production gate for real: `NODE_ENV=production` with no `ALLOW_DEMO_MODE`/SMTP/`FRONTEND_URL` correctly **refuses to start** with the exact three `CONFIG ERROR` lines Stage 19 added; supplying all three, it boots cleanly and `/api/health` returns `200 ok`.

**Honest gaps, not fixed (deliberately, not an oversight):**
- **9 pre-existing placeholder pages remain placeholders** — `About.jsx`, `Assets.jsx`, `Bitusdt.jsx`, `Blog.jsx`, `Careers.jsx`, `Enusd.jsx`, `HelpCenter.jsx`, `Pages.jsx`, `Spot.jsx` are each still a bare 10-line stub (documented since Stage 16). Five of them (`Assets`/`Bitusdt`/`Enusd`/`Pages`/`Spot`) are real, reachable Navbar links that load without error but show no real content. The other four (`About`/`Blog`/`Careers`/`HelpCenter`) are **not** wired into any route at all — the Footer's "About Anchor Exchange", "Careers", "Blog" text is plain non-interactive `<p>` styling that only *looks* clickable, not an actual broken link, so nothing 404s. Building out real content for these is a content/product task, not a QA fix, and was left alone rather than either wiring up empty stubs (worse) or silently claiming "every page has content."
- **Live Socket.IO push for notifications was not separately re-verified this pass** — it was verified live in Stage 13 and its auth was hardened in Stage 19; this pass confirmed notifications are correctly *created* and *listed* by every money-flow action but did not re-drive a second browser tab to watch a push arrive in real time.
- **A single, non-reproducible `/markets` page-load timeout** occurred once during the heaviest part of the navigation sweep (66 page loads across 3 viewports in one run); isolated repeated loads afterward were consistently fast (3.8–8.7s, well under any timeout). Treated as sandbox resource contention during a heavy test run, not a product defect — flagged here rather than silently ignored.
- Everything already listed as an honest gap in Stage 19 (no real payment/KYC/custody/blockchain, no load testing, no CI, single-instance only, etc.) still applies — Final QA re-verifies behavior, it doesn't add capabilities.

**This closes the Stage 0–20 checklist.** What's left before this can be considered "done and shipped" is entirely in your hands: review the diff, decide on the git-history secret purge (Stage 19/15), and commit.
