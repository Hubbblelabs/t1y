# T1D Prajana Yandra (T1DPE mApp)

Flutter mobile app — patient/parent-facing companion to the Next.js admin
console in [`../api`](../api). Built for the PhD study "Effectiveness of T1D
PRAJANA YANDRA Paediatric Enhancement mHealth App on Physical Well-being of
Children and Parental Satisfaction among children with type 1 diabetes
mellitus in selected Diabetic clinics at Coimbatore."

- **Package / bundle ID:** `com.mistaketech.t1dpe` (Android `applicationId` /
  iOS `PRODUCT_BUNDLE_IDENTIFIER` — identical on both platforms)
- **Display name:** T1D Prajana Yandra
- **Screens:** `lib/screens/` — `auth` (sign-in), `home` (4-tab shell: Home,
  Help Book, Calculations, Quizzes), `helpbook` (topic list + article
  detail), `calculations` (Rule of 15, IC/ISF — flag-gated), `quizzes` (list,
  take, result), `profile`.

**Run it:** [`docs/RUN-ON-ANDROID.md`](docs/RUN-ON-ANDROID.md) for a
sideloadable release APK, [`docs/RUN-ON-IPHONE.md`](docs/RUN-ON-IPHONE.md)
for TestFlight.

## Toolchain — everything lives on this SSD, not the internal disk

This repo lives on an external drive, and every SDK/cache used to build it is
kept there too, so a fresh checkout on another Mac (with Xcode + a JDK already
present) needs no reinstall beyond `source ../devtools-env.sh`.

```bash
source ../devtools-env.sh   # sets PATH, PUB_CACHE, ANDROID_HOME, GRADLE_USER_HOME, CP_HOME_DIR
flutter doctor -v           # should show Flutter, Android toolchain, and Xcode all ✓
```

| Tool | Location | Notes |
|---|---|---|
| Flutter SDK | `/Volumes/Crucial/devtools/flutter` | Private clone (stable channel) — the Homebrew-installed Flutter on this machine is owned by a different macOS user account and isn't writable by this one, so it isn't used. |
| Dart/Flutter package cache | `/Volumes/Crucial/devtools/pub-cache` | via `PUB_CACHE` |
| Android SDK (cmdline-tools, platform-tools, platforms 35/36, build-tools, NDK) | `/Volumes/Crucial/devtools/android-sdk` | via `ANDROID_HOME` |
| Gradle distribution + cache | `/Volumes/Crucial/devtools/gradle-home` | via `GRADLE_USER_HOME` |
| CocoaPods repo/cache | `/Volumes/Crucial/devtools/cocoapods-home` | via `CP_HOME_DIR` |
| Release keystore | `/Volumes/Crucial/devtools/keystores/t1dpe-release.jks` | Referenced by `android/key.properties` (git-ignored). Back this up — every future release build needs the same key. |
| Xcode | `/Volumes/Crucial/Applications/Xcode.app` | Already installed on this SSD — used as-is, no duplication. |

## Building

```bash
source ../devtools-env.sh

# Android — sideloadable release APK (see docs/RUN-ON-ANDROID.md)
flutter build apk --release

# iOS — TestFlight (see docs/RUN-ON-IPHONE.md)
flutter build ipa
open ios/Runner.xcworkspace   # to build/run/sign from Xcode directly

# iOS simulator (no signing needed) / debug builds
flutter build ios --simulator --debug
flutter build apk --debug
```

Always open `ios/Runner.xcworkspace`, never `Runner.xcodeproj` — CocoaPods
integration depends on the workspace.

## Architecture

No state-management or routing package (riverpod/go_router) — the app is
small enough that `Navigator.push` plus one `ChangeNotifier`
(`lib/providers/app_state.dart`, just the active locale) covers it.

- `lib/services/api_client.dart` — thin `http` wrapper: attaches the bearer
  token issued by Better Auth's `sign-in/email` (see
  `../api/lib/auth/auth.ts`) and unwraps the `{success, data}` /
  `{success:false, error}` envelope every backend route returns.
- `lib/services/content_service.dart` / `quiz_service.dart` /
  `flags_service.dart` — one per backend domain, each caching its last
  successful response in `shared_preferences` so the Help Book and flag
  checks still work with no network. Quiz submission still requires
  connectivity (posts to `/api/sync` immediately) — see "Known gaps" below.
- `lib/widgets/app_header.dart` — the `[EN|தமிழ்] [👤]` header used on every
  top-level screen (UX handoff §8–9): language switch is instant, no
  separate screen; Profile is reached from here, not the bottom nav.

## Known gaps vs. the full build plan

- **Offline quiz submission isn't queued.** The backend's `/api/sync`
  contract (idempotent, batchable, offline-tolerant) is fully built and
  tested — see `../api/lib/services/sync.ts` — but the app currently posts a
  quiz attempt immediately rather than queueing it in a local outbox
  (sqflite) for later flush. A quiz attempted offline will fail with an
  error rather than queueing silently. The wire format already carries a
  client-generated id, so adding the outbox later doesn't change the
  contract.
- **No custom fonts bundled.** The UX handoff specifies Poppins + a
  Tamil-capable fallback; the app currently uses the platform default
  (Roboto/San Francisco).
- **No self-service sign-up.** Accounts are created via the admin console or
  `prisma db seed` — see the backend's note on admin-issued credentials
  (deferred pending a decision on the study's enrolment flow).
