# Two reusable services — discussion notes (not implemented)

1. **Email OTP for sign-up** — prove that whoever signs up controls the email.
2. **Video hosting on YouTube** — admins upload from the dashboard; families
   watch in the app; nobody ever sees or handles a YouTube link.

Nothing here is built. This is for deciding *whether*, *how*, and *in which
repository*. Provider limits and prices change — every number below marked
**(check)** must be confirmed on the provider’s page before we commit.

## Decisions made (supersede the recommendations below where they differ)

After discussion, the scale and the nature of the content change the answer.
**No separate repo, server or database for either service.** Both live inside
the existing API and database.

- **Email OTP — in-app.** A small service file, one table (hashed code, expiry,
  attempts) and two routes inside the current API; it uses the email helper
  already wired. Expected volume is about 500 emails in total, comfortably
  inside any free tier. The reusable-library and monorepo ideas in §1.6 and §2.7
  are dropped: nothing else needs them yet, and extracting later is easy if
  that changes.
- **Video — YouTube, 4–5 static videos, not bundled in the app** (so the app
  size does not grow). The content never changes and is not edited by
  coordinators.
  - With so few videos the **YouTube upload API (OAuth, quota, Google audit,
    stored refresh token — §2.3–2.4) is not worth it.** Simpler path: the owner
    uploads each video once in YouTube Studio as **Unlisted**, and an
    owner-only form in the dashboard stores its video id. Coordinators and
    families only ever see the title and a preview; the link is never shown.
    Nothing to deploy, nothing to audit.
  - The API returns the video id only to signed-in families; the app plays it
    with the embedded YouTube player. Unlisted means anyone who obtains the id
    can still watch — acceptable only because these are generic education
    videos (no children, no patient data).
- **Images — keep using Cloudinary**, as today.

Still open: who is allowed to add a video (owner only vs any admin), and
whether we have a domain for the OTP sender address (§1.4–1.5).

The sections below are kept as background and for the comparison tables.

---

## 0. Summary and recommendations

| Question | Recommendation |
|---|---|
| Email OTP: build it? | **Yes**, sign-up only, 6 digits, 10-minute life, via a free email provider. ~140 users means well under 1,000 emails in total. |
| Email OTP: separate repo? | Build it as a **small library with a thin HTTP wrapper**, in a shared repo — not a network microservice yet. See §1.5. |
| Video on YouTube: is “private” possible? | **No, not for this use.** A *Private* video can only be watched by people signed into Google accounts we explicitly invite. Families’ phones are not invited. It has to be **Unlisted** (anyone with the link). See §2.2 — this is the main thing to decide. |
| Video: YouTube vs what we already have | We already have Cloudinary wired up. For a handful of education videos and ~140 families it is probably **simpler and nicer** than YouTube. Keep YouTube as an optional adapter, behind the same interface. See §2.6. |
| Repos | One repo, **`platform-services`** (monorepo): `packages/otp`, `packages/video`, plus a Flutter package for the player. Split further only when a second project actually needs it. |

Decisions needed from you are collected in §3.

---

## 1. Email OTP for sign-up

### 1.1 What exists today (facts from the code)

- Sign-up creates the account as **PENDING**; a coordinator must approve it
  before the family can sign in (“yet to be updated by the admin”).
- Better Auth is configured with `requireEmailVerification: false`.
- A transactional-email helper already exists (Resend wiring in
  `lib/notifications/email`), with the verification-link email template unused.
- `GET /api/check-email` already reveals whether an email is registered (it has
  to, so the entry screen knows whether to ask for a password or start
  sign-up). So “don’t reveal existence” is **already not a property we have**;
  the OTP endpoints should not make it worse, but we should not pretend.
- The app signs up through a chat-style flow, then password.

Today anyone can sign up with `random@whatever.com`. The approval step catches
fakes only if the coordinator notices. OTP stops typos and made-up addresses
*before* they reach the coordinator’s queue.

### 1.2 Proposed flow (sign-up only)

```
App                         API (otp service)                 Email provider
 │  enter email               │                                      │
 │ ─ POST /otp/send ────────► │ normalise email                      │
 │                            │ cooldown + daily caps OK?            │
 │                            │ code = 6 random digits               │
 │                            │ store HMAC(code), expiry, attempts=0 │
 │                            │ ── render template + send ─────────► │
 │ ◄── 202 {resendAfter} ──── │                                      │
 │  type the 6 digits         │                                      │
 │ ─ POST /otp/verify ──────► │ constant-time compare, attempts++    │
 │ ◄── {verifiedToken} ────── │ mark used; sign a token bound to the │
 │                            │ email, valid ~30 min, single use     │
 │  continue sign-up chat     │                                      │
 │ ─ POST sign-up {…token} ─► │ sign-up refuses without a valid token│
```

Why a **verified token** instead of “verified flag on the email”: sign-up can
then be a separate request that proves the email was verified *by this
client, recently*, and the token is spent when the account is created.

### 1.3 Rules (the part that makes it safe)

- 6 digits from a CSPRNG; store only an **HMAC** of it (keyed with a server
  secret) — never the code. Delete rows 24 h after expiry (existing
  maintenance cron).
- Valid **10 minutes**; **5 wrong tries** burns the code; a new send replaces
  the old one.
- **Resend cooldown 60 s**, max **5 sends per email per hour**, max
  **~20 sends per IP per hour**, plus a **global daily cap** (stay under the
  provider’s free limit and cap the cost of an attack).
- Same response for “sent” whether or not delivery later fails (no oracle on
  provider errors); constant-time compare; no code in logs, Sentry or analytics.
- Normalise before anything else: trim, lowercase, and decide about Gmail
  dots/`+tags` (recommended: treat `a+b@gmail.com` as a different address for
  verification but warn nothing — blocking plus-addressing annoys real users).
- Optional: block known disposable-email domains (a maintained list).
- The verified token binds email + purpose (`signup`) + expiry, signed with a
  server key, single-use.

### 1.4 The email

Bilingual (English + Tamil) in one message, because families switch
languages. Contents: the code in large type, “valid for 10 minutes”, “if you
didn’t ask for this, ignore it — nothing will happen”, no links (links are the
phishing pattern we want families *not* to get used to), a plain-text part
alongside the HTML. Subject carries the code’s purpose, not the code (lock-screen
previews).

Deliverability matters more than anything else here: the usual failure is “the
code never arrived” because it went to Spam. Fixes: send from a **domain we
own** with SPF + DKIM + DMARC; one stable From address; short, plain template.
**Without our own domain, free providers will send from their domain or
a Gmail address — workable at 140 users but more likely to land in Spam.**
Do we have a domain for the study?

### 1.5 Free providers for ~140 users **(check all limits)**

| Provider | Free allowance (approx.) | Notes |
|---|---|---|
| **Resend** | ~3,000/month, ~100/day | Already wired in the code; needs a verified domain to send to arbitrary recipients; clean API |
| **Brevo** | ~300/day | Can send without owning a domain (their sender), SMTP + API; fine fallback |
| **Gmail / Google Workspace SMTP** | ~500/day (personal) | Zero setup, app password; against provider ToS for “bulk” but trivial at this scale; From is a Gmail address |
| **Amazon SES** | Very cheap pay-as-you-go (free tier depends on where it runs) | Best long-term deliverability/price; sandbox must be exited; more setup |
| Mailgun / SendGrid | Free tiers have been reduced or withdrawn over time | Not recommended as the “free” choice |

At ~140 users, even 3 sends each is ~420 emails total — any of the first three
is enough. **Suggested:** Resend if we have a domain, Brevo if not — both behind
one `Mailer` interface so switching is a config change.

Alternatives to email OTP, for completeness:
- **SMS OTP** — costs money, and in India needs DLT registration; not worth it
  at this scale.
- **WhatsApp OTP** — business verification and per-message fees.
- **Better Auth’s own email-OTP plugin** — least code, lives inside this API;
  *not* reusable outside Better Auth. Worth checking before writing anything,
  because it may already do 80 % of §1.2–1.3.
- **Firebase Auth email link** — free, but brings a second identity system.

### 1.6 Where should the code live?

| Option | Pros | Cons |
|---|---|---|
| **A. Better Auth plugin inside this API** | Fastest; no new deploy | Not reusable; tied to one auth library |
| **B. Library (npm package) with `Store` and `Mailer` adapters**, used in-process | Reusable by any Node project; no extra server, latency or auth between services; easy to test | Each consuming app still deploys it; one language (TypeScript) |
| **C. Standalone microservice** (own repo, DB/Redis, REST + API keys) | Truly language-agnostic and isolated; email secrets in one place | Another thing to deploy, monitor, secure and pay for; a new failure point *in front of sign-up*; overkill for 140 users |

**Recommendation: B**, with a ~50-line optional HTTP wrapper (`POST /otp/send`,
`/otp/verify`) so it can be promoted to C later without rewriting. The adapters:
`OtpStore` (Postgres via Prisma / in-memory for tests), `Mailer` (Resend,
Brevo-SMTP, console), `Template` (bilingual React-email or plain HTML),
`RateLimiter`. Reusability comes from the interfaces, not from a network hop.

### 1.7 Edge cases and questions

1. **Households.** A parent’s email may own several children. Verify the
   **email once per household**, not per child — otherwise adding a second child
   triggers another OTP. Does adding a child need one? (Suggest: no, the parent
   is already signed in.)
2. **Existing accounts** — leave them alone; OTP is for new sign-ups only.
3. **Provider down / OTP never arrives** — show “resend” after 60 s and a
   fallback: “contact your coordinator”; coordinators can **manually mark an
   email verified** (audited) so a family isn’t locked out.
4. **Typo’d email** — the sign-up chat should let the family go back and fix it
   before sending (don’t burn a send).
5. **Admin-created and bulk-imported participants** are not self-signed-up;
   they skip OTP (they get a temporary password instead).
6. **Order with approval** — OTP first (proves the email), *then* the
   coordinator approves. The approval screen can then say “email verified”.
7. **Android autofill** — email has no SMS-retriever; support paste and a
   “open email app” button. Six separate boxes with auto-advance + paste is the
   pattern families know.
8. **Privacy** — the email address is personal data: don’t log it in provider
   dashboards beyond what’s necessary; retention of OTP rows is hours, not days.

### 1.8 Test outline (to be built with the service)

Unit: code format/entropy, HMAC verify, expiry boundaries (9:59 / 10:00),
attempt burn on the 5th wrong, resend cooldown, caps, normalisation, token
signature/expiry/single-use/wrong-email/wrong-purpose. Integration: send →
verify → sign-up happy path; sign-up with no/expired/reused token refused;
concurrent verify of the same code succeeds once; provider failure path.
Manual: Gmail/Yahoo/Outlook inbox-vs-spam, Tamil rendering in three mail
clients, dark mode, paste into the app.

Rough effort: library + wrapper + template + app screen + tests ≈ **3–4 working
days**, plus a day of DNS/provider setup.

---

## 2. Videos on YouTube

### 2.1 What we want

Admin picks a video file in the dashboard → it is stored on **our YouTube
channel** (not on our server) → the admin sees a normal preview, never a URL →
the app plays it using only the YouTube id the API returns.

### 2.2 The most important fact: “private” will not work

- **Private** — only invited Google accounts can watch. A parent’s phone
  cannot. **Not usable.**
- **Unlisted** — not in search or on the channel page, but **anyone with the
  link can watch**. This is what works for the app.
- **Public** — anyone, searchable.

So “private channel” in the sense of *secret from the world* isn’t available.
Unlisted is *obscure*, not *secret*: if someone shares the id, anyone can
watch. Therefore:

- **Only educational content that is fine to be seen by anyone with the link.**
- **Never upload identifiable children, patient data or anything consent-restricted.**
- Our admins not “seeing the link” is a UI choice, not a security control.

If that is acceptable, YouTube works. If it isn’t, use a host with signed,
expiring URLs (§2.6).

### 2.3 Gotchas in the YouTube API **(check current policy)**

- Upload = `videos.insert` in **YouTube Data API v3**, via OAuth for the
  channel-owner account (scope `youtube.upload`).
- **Quota:** default 10,000 units/day; one upload costs ~1,600 → about **6
  uploads/day**. Fine for us.
- **Unverified API projects can only upload as Private** (locked) until the
  project passes Google’s **API compliance audit**. That would silently break
  the plan (videos upload but nobody can watch them). Budget for submitting the
  audit form and waiting — this is the biggest schedule risk.
- **OAuth consent screen in “Testing” mode expires refresh tokens after 7
  days**; it must be moved to “In production” (and the sensitive scope
  verified) for a server to keep uploading unattended.
- The server needs the channel’s **refresh token stored securely** (encrypted at
  rest) — a long-lived credential to our channel. Needs rotation/revocation
  plan and a named owner.
- **“Made for kids”** must be declared on each upload. Content aimed at parents
  → “not made for kids”; wrong choice can disable comments/features or breach
  policy.
- Processing is asynchronous: after upload the video isn’t playable for a
  while; we must poll `videos.list` (`processingDetails`, `status`) and show
  “Processing…” to the admin.
- Deleting is possible (`videos.delete`); **replacing a file is not** — a
  replace is a new upload with a new id.
- Titles/descriptions of unlisted videos are visible to anyone who has the link.

### 2.4 Uploading from the dashboard (the technical risk)

Our API runs on serverless (`vercel.json` is present): request bodies are
capped at a few MB, so **the video can’t pass through our server**. Options:

1. **Resumable upload straight from the admin’s browser to YouTube.** Our
   server uses the stored OAuth token to *start* a resumable session and hands
   the browser the one-time upload URL; the browser sends the file in chunks.
   Best fit; needs verification that the session is created with the right
   `Origin` so browser CORS is allowed.
2. **Two-hop:** browser → temporary object storage (R2/Cloudinary) → a worker
   uploads to YouTube. More moving parts, but works with any limit.
3. **A small always-on worker** (not serverless) that accepts the file and
   streams it on. Simple code, but a server to run.

The admin sees: pick file → progress bar → “Processing…” → a thumbnail and
player preview. After processing, we store only `youtubeVideoId`, title,
duration, thumbnail URL and status; the admin screens never show the URL.

### 2.5 Playing it in the app

- `video_player` (what the Help Book uses today) **cannot play a YouTube
  watch URL**. Extracting direct stream URLs with unofficial packages **violates
  YouTube’s terms** and breaks without warning — don’t.
- Supported way: the **IFrame embed** in a WebView
  (`youtube_player_iframe` / `youtube_player_flutter`), or open the YouTube app
  via `url_launcher` as a fallback.
- Trade-offs for families: needs internet and data (no offline caching), shows
  YouTube branding and controls, “watch on YouTube” links, suggested videos at
  the end (limit with `rel=0`, which restricts to our channel), and the embed
  only works if embedding is enabled on the video. Heavier on low-end phones than
  a plain video.
- “Only the link is passed”: the API returns `{ id, title, duration,
  thumbnailUrl, provider: "youtube", videoId }`; the app builds the embed. The
  Flutter widget takes a `VideoSource` so the app doesn’t care about the
  provider.

### 2.6 Alternatives — and what we already have

| Option | Cost (check) | Privacy | Playback in app | Notes |
|---|---|---|---|---|
| **YouTube unlisted** | Free | Anyone with link | WebView embed | API audit + OAuth hurdles; branding; no offline |
| **Cloudinary** (already configured: `CLOUDINARY_*`, `/api/admin/uploads`, `VideoPicker`) | Free tier is small but a handful of videos fits | Public URL (signed/private delivery possible on paid plans) | Plain MP4/HLS in `video_player`, can be cached | Zero new integration; watch the monthly bandwidth |
| **Cloudflare R2** (object storage) + plain MP4 | Storage cheap, **no egress fees** | Public bucket or signed URLs | `video_player` | Not set up yet (the repo uses Cloudinary today — see CLOUD-SETUP.md); no transcoding, so upload sane MP4s |
| **Bunny Stream** | A few dollars/month | Signed, expiring URLs, domain lock | HLS in `video_player` | Best “private + simple” paid option |
| **Cloudflare Stream / Mux** | Per minute stored/delivered | Signed URLs | HLS | Polished; costs scale with minutes |
| **Vimeo** | Paid for privacy controls | Good | WebView/SDK | More expensive than needed |

Honest read: with ~140 families and a few short videos, **bandwidth is not the
problem YouTube solves**. YouTube’s real advantage is free adaptive streaming at
any scale; its costs are the audit/OAuth friction, the WebView experience and
the loose privacy. **If privacy or UX matter, stay on Cloudinary/R2 now; if the
library grows to hours of video, add YouTube (or Bunny) as another adapter.**

### 2.6.1 One interface, several providers

Define once:

```
VideoProvider
  startUpload(meta)  → { uploadUrl | session, assetId }
  getStatus(assetId) → { state: processing|ready|failed, playback: {…}, thumbnail, durationSec }
  remove(assetId)
  playbackFor(assetId, viewer) → { kind: "mp4" | "hls" | "youtube", url | videoId }
```

Adapters: `youtube`, `cloudinary`, `r2`. The dashboard and the app only know
`VideoSource`. That is what makes it reusable and lets us start with
whichever is easiest and change later without touching screens.

### 2.7 Repo structure: separate repository or not?

Same logic as the OTP service. Recommended **monorepo `platform-services`**:

```
packages/otp            # store/mailer/template adapters + http wrapper
packages/video          # providers (youtube, cloudinary, r2) + http wrapper
packages/video-admin-ui # React <VideoUploader/> <VideoPreview/> (dashboard)
packages/video-player   # Flutter package: VideoSource → player widget
```

- Consumed by this project as **versioned packages** (private npm / git
  dependency), not by copy-paste.
- Each package has its own tests and a README with the adapter contract.
- Promote to a **deployed service** only if (a) a second project needs it, or
  (b) we want credentials (YouTube refresh token, mail keys) out of the main API.
  Credential isolation is the strongest argument for a separate deployed
  service in the video case — the YouTube refresh token is the most sensitive
  secret we’d hold.

### 2.8 Test outline (to be built with the service)

Unit: provider contract tests run against every adapter; state mapping
(processing/ready/failed); quota and error mapping (quota exceeded, token
revoked, audit-locked-to-private detection); id extraction. Integration:
resumable-upload session start with a stubbed Google; polling until ready;
delete. Manual: real upload of a 50 MB and a 500 MB file from a slow
connection, resume after dropping the network, playback on a low-end Android on
mobile data, video with embedding disabled, Tamil title, video deleted on
YouTube but still referenced by the app (graceful “unavailable”).

Rough effort: YouTube adapter + dashboard uploader + Flutter player + tests ≈
**5–7 working days**, **plus an unknown wait for Google’s API audit**. The
Cloudinary adapter behind the same interface is ≈ **1–2 days** because most of
it exists.

---

## 3. Decisions needed

1. **OTP:** go with the library-first approach (B) in a shared repo? Do we own a
   domain for the sender address (decides Resend vs Brevo)?
2. **OTP:** one verification per household email (recommended) — agreed?
3. **OTP:** coordinator manual “mark email verified” escape hatch — agreed?
4. **Video:** is **Unlisted** acceptable (anyone with the id can watch), and is
   it understood that “private” can’t work for family phones?
5. **Video:** are we willing to run Google’s API audit and wait for it, or start
   with Cloudinary/R2 behind the same interface and add YouTube later?
6. **Video:** any content that must never be viewable by non-families (consent
   videos, children’s faces)? If yes → not YouTube.
7. **Repos:** one `platform-services` monorepo to start, split later — agreed?
8. Who owns the YouTube channel and its Google account (recovery email, 2FA)?
