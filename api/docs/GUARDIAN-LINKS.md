# Guardian links

A parent who is away from their child (at school, say) can give a teacher or
relative a one-time link to record that day's readings.

## Flow

1. **App → Health → Share with a guardian** (behind the parent PIN). The parent
   picks how long the link works (30 min – 24 h). The server returns a link
   (`/g/<token>`) and a 6-digit code. The app shares them as *two separate
   messages*. Creating a new link cancels any earlier unused one.
2. The guardian opens the link. A pop-up asks for the code.
3. The page asks for their name and only what is still due today: the next
   enabled glucose check that has no reading yet, plus insulin / carbohydrates
   (with the 200-character food note) / exercise if turned on for the child.
4. Before saving, a second pop-up shows every number and asks them to check it.
5. Saving records the entries against the child (marked *Entered by* the
   guardian's name — shown in the app's recent entries and the admin Health data
   tables), **spends the link**, and creates a notification. The app shows a
   dialog the next time it opens, resumes or the Health tab is refreshed.

A link is also dead when it passes its expiry, when the parent cancels it, or
after 5 wrong codes (locked).

## Encryption

- **At rest:** the URL token is stored only as a SHA-256 hash; the code is
  AES-256-GCM encrypted (`SHARE_ENCRYPTION_KEY`, or derived from
  `BETTER_AUTH_SECRET`). The parent's app reads the code back from the server
  while the link is live.
- **On top of HTTPS:** the page never sends the code. It derives an AES key and
  an HMAC key from the code (PBKDF2, 100k iterations, per-link salt), proves it
  knows the code with an HMAC over a signed server nonce, and the form
  definition and the guardian's entries are AES-256-GCM encrypted under those
  keys. Wire format: `lib/guardian-crypto.ts` ↔
  `components/guardian/guardian-crypto-client.ts` (interop test:
  `tests/unit/guardian-protocol.test.ts`).
- Limit: 6 digits is ~20 bits, so the extra layer cannot stop an attacker who
  captured the whole exchange and brute-forces it offline. The attempt lockout,
  single use and short expiry are what protect against guessing.
- Health tables themselves stay plaintext (as before) so reports and exports
  keep working.

## Where things are

- Service: `lib/services/guardian-shares.ts`; crypto: `lib/guardian-crypto.ts`
- Parent API: `app/api/guardian-shares/**`; guardian API: `app/api/guardian/[token]/**`
- Page: `app/g/[token]/page.tsx`, `components/guardian/*`
- App: `screens/health/guardian_share_screen.dart`, `guardian_notice.dart`,
  `services/guardian_share_service.dart`
