# Running T1D Prajana Yandra on an iPhone

You have a paid Apple Developer Program account, so this uses **TestFlight**
— no cable needed once a build is uploaded, and it doesn't expire every 7
days like free provisioning does.

Everything up through step 4 is scriptable and has already been verified
working (`flutter build ios --simulator --debug` succeeds against this
project). Steps 5 onward require signing in with your Apple ID in Xcode and
App Store Connect — that's you, not me; I don't enter credentials on your
behalf.

## 1. Open the project in Xcode

```bash
source /Volumes/Crucial/diabetics/devtools-env.sh
cd /Volumes/Crucial/diabetics/app
open ios/Runner.xcworkspace
```

Always open the **`.xcworkspace`**, never `Runner.xcodeproj` — CocoaPods
integration depends on the workspace.

## 2. Select your Team

In Xcode: select the **Runner** project in the navigator → **Runner** target
→ **Signing & Capabilities** tab → set **Team** to your Apple Developer
account. Xcode will offer to fix signing automatically — let it.

The bundle identifier is already set to `com.mistaketech.t1dpe` (matching
Android's `applicationId`, so both platforms share one App Store Connect app
record).

## 3. Register the bundle ID (first time only)

If `com.mistaketech.t1dpe` isn't already registered to your account:
[developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list)
→ **+** → App IDs → App → enter `com.mistaketech.t1dpe`. Usually Xcode does
this automatically the first time you build with a Team selected — check
here only if Xcode reports a provisioning error.

## 4. Create the App Store Connect record (first time only)

[appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps**
→ **+** → **New App**:
- Platform: iOS
- Name: `T1D Prajana Yandra`
- Bundle ID: select `com.mistaketech.t1dpe`
- SKU: anything unique, e.g. `t1dpe-001`

## 5. Build the release archive

```bash
source /Volumes/Crucial/diabetics/devtools-env.sh
cd /Volumes/Crucial/diabetics/app
flutter build ipa
```

This produces `build/ios/ipa/t1dpe.ipa`. If it fails on a signing step,
open the workspace (step 1) and do **Product → Archive** from Xcode instead
— the Organizer window that opens afterward has a **Distribute App** button
that walks through the same upload.

## 6. Upload to App Store Connect

Either:
- In Xcode's **Organizer** (opens automatically after **Product → Archive**)
  → select the archive → **Distribute App** → **App Store Connect** →
  **Upload**, or
- **Apple's Transporter app** (free, Mac App Store) → drag in
  `build/ios/ipa/t1dpe.ipa`.

Processing takes 5–15 minutes; you'll get an email when it's ready.

## 7. Add testers in TestFlight

App Store Connect → your app → **TestFlight** tab → **Internal Testing** →
add yourself and anyone else via their Apple ID email (no separate signup
needed for internal testers, up to 100 people). Add a build to the group
once it finishes processing.

## 8. Install on the iPhone

On the iPhone: install **TestFlight** from the App Store, sign in with the
Apple ID you added as a tester, and the build appears automatically. Tap
**Install**.

## Before real participants use it

- **Point it at a real server.** The app defaults to `10.0.2.2:3000`
  (Android-emulator-only) — on first launch, tap **Change server address**
  on the sign-in screen and enter the deployed API's real HTTPS URL. Use
  HTTPS for anything beyond your own testing; ATS (App Transport Security)
  blocks plain HTTP by default outside local development.
- **Confirm accounts exist.** There's no self-service sign-up screen yet —
  see the build plan's note on admin-issued credentials. Testers need an
  account created via the admin console or `prisma/seed.ts` first.
