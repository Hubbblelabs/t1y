# Installing T1D Prajana Yandra on an Android phone

The study's own inclusion criteria requires the parent to have an Android
phone, so this is the primary distribution path — a directly-installable
APK, no Play Store account or review needed.

## 1. Build the release APK

```bash
source /Volumes/Crucial/diabetics/devtools-env.sh
cd /Volumes/Crucial/diabetics/app
flutter build apk --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk`.

This is signed with a real release keystore
(`/Volumes/Crucial/devtools/keystores/t1dpe-release.jks`, self-signed —
adequate for direct-install distribution; Play Store submission would use
Play App Signing instead, layered on top of this same upload key). **Keep
that keystore file and `android/key.properties` safe** — every future
release must be signed with the same key, or installing an update over an
existing install will fail with a signature mismatch. Neither file is in
git (see `android/.gitignore`); back the keystore up somewhere durable.

## 2. Get the APK onto the phone

Any of:
- **Cable**: connect the phone, `adb install build/app/outputs/flutter-apk/app-release.apk`
  (with `ANDROID_HOME` set per `devtools-env.sh`).
- **Cloud/email/messaging**: upload the `.apk` file itself (not a link to
  this repo) to Drive/Dropbox/WhatsApp/email and open it on the phone.
- **QR code / local web server**: serve the `build/app/outputs/flutter-apk/`
  directory and scan a QR code on the phone, if distributing to several
  testers at once.

## 3. Allow the install

Since this isn't from the Play Store, Android will block the install once
until permitted:

1. Tap the downloaded `.apk` file.
2. Android shows **"For your security, your phone is not allowed to install
   unknown apps from this source."** → tap **Settings**.
3. Enable **Allow from this source** for the app you used to open the file
   (Files, Chrome, WhatsApp, etc.).
4. Go back and tap the `.apk` again → **Install**.

This permission is per-source, not global — installing from a browser
doesn't also allow installs from a file manager, by design.

## 4. First launch

- **Point it at the real server.** The app defaults to `10.0.2.2:3000`,
  which only resolves inside an Android emulator on the same Mac. On a real
  phone: on the sign-in screen, tap **Change server address** and enter the
  deployed API's real URL (e.g. `https://your-domain.example.com`).
- **Sign in.** There's no self-service sign-up screen yet — an account must
  exist first, created via the admin console (`/admin/participants`) or the
  dev seed script. See the build plan's note on this: credential issuance
  for the study's 140 families was deferred to a follow-up.

## Updating to a new build

Rebuild with the same command and reinstall the same way — Android updates
in place as long as it's signed with the same keystore (step 1). If you ever
regenerate the keystore, every phone needs to uninstall the old app first.
