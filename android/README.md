# JAM Android app (Trusted Web Activity)

JAM is packaged for Android as a **Trusted Web Activity (TWA)**. The Android app
opens the deployed Next.js application full-screen and verifies domain ownership
through Digital Asset Links. This keeps one codebase and lets the Play Store app
use the existing web deployment.

The generated project is configured for the production host
`https://justaminuteaits.vercel.app` and package `com.aits.jam`. If you change the
host or package ID, update `android/twa-manifest.json` and run
`npx @bubblewrap/cli update --manifest .` from `android/`. If you change the
package ID, start from a fresh `bubblewrap init` instead of reusing the generated
Java package directory.

## Before you start

You need:

- A public HTTPS deployment of this repository, for example
  `https://justaminuteaits.vercel.app`.
- A Google Play Console developer account.
- Node.js 18+.
- JDK 17 (Bubblewrap requires JDK 17, not a newer JDK).
- Android SDK/build tools. Bubblewrap can install these on first run.
- A permanent Android package name. **It cannot be changed after the first Play
  Store upload.** This repository defaults to `com.aits.jam`.

## 1. Configure the web app

Set these in the production hosting environment, not only in `.env.local`:

```dotenv
NEXT_PUBLIC_APP_URL=https://justaminuteaits.vercel.app
ANDROID_PACKAGE_NAME=com.aits.jam
ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:CC:...
```

`NEXT_PUBLIC_APP_URL` is used for QR codes, email links, and origin checks.
`ANDROID_SHA256_CERT_FINGERPRINTS` is served at
`https://justaminuteaits.vercel.app/.well-known/assetlinks.json`.

The fingerprint list can contain multiple comma-separated values. Include:

1. The **Play App Signing** certificate SHA-256 fingerprint from Play Console.
2. The **upload key** SHA-256 fingerprint if you want to test a locally built
   APK before Play App Signing is active.

Get a keystore fingerprint with:

```powershell
keytool -list -v -keystore android\android-keystore -alias android
```

Copy the `SHA256:` value exactly, including colons, without the `SHA256:` prefix.

Verify the deployed file before building:

```powershell
Invoke-WebRequest https://justaminuteaits.vercel.app/.well-known/assetlinks.json
```

It must return `200` and JSON. A `503` means the fingerprints are malformed.

A checked-in fallback is in `android/assetlinks.json`; it currently contains the
upload-key fingerprint so a locally built APK can be tested before Play App
Signing is active. After the first Play Console upload, add the **Play App
Signing** SHA-256 fingerprint to that file (or to the environment variable) and
redeploy.

## 2. Generate or update the Android project

The included project is already configured for
`https://justaminuteaits.vercel.app`. If you change the host or package ID,
update `android/twa-manifest.json` and regenerate it:

```powershell
cd android
npx @bubblewrap/cli update --manifest .
```

If you prefer to start fresh, delete the generated project files (keep this
README and `.gitignore`) and run:

```powershell
npx @bubblewrap/cli init --manifest https://justaminuteaits.vercel.app/manifest.webmanifest --directory .
```

Bubblewrap will ask for the app name, launcher name, package ID, version, colors,
icons, and signing key. Use:

| Setting | Value |
| --- | --- |
| App name | `JAM — Just A Minute` |
| Launcher name | `JAM` |
| Package ID | `com.aits.jam` (or your permanent ID) |
| Start URL | `/` |
| Display | `standalone` |
| Theme color | `#eae7dc` |
| Background color | `#fbfaf7` |
| Icon | `https://justaminuteaits.vercel.app/icons/icon-512.png` |
| Maskable icon | `https://justaminuteaits.vercel.app/icons/icon-maskable-512.png` |
| Version code | `1` |
| Version name | `1.0.0` |

Accept Bubblewrap's offer to create a signing keystore, or point it at an
existing one. **Back up the keystore and both passwords.** Losing the upload key
can prevent future updates unless Play App Signing key reset is approved.

The generated `twa-manifest.json` is the source of truth for the Android
project. Keep it in version control. Do **not** commit the keystore or its
passwords.

## 3. Build the APK and App Bundle

```powershell
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = "your-keystore-password"
$env:BUBBLEWRAP_KEY_PASSWORD = "your-key-password"
npx @bubblewrap/cli build
```

Bubblewrap produces:

- `app-release-signed.apk` for local testing.
- `app-release-bundle.aab` for the Play Store upload.

If the build complains about the JDK, install Temurin JDK 17 and point
`JAVA_HOME` at it before running Bubblewrap.

## 4. Test the TWA

Install the APK on a device with Chrome:

```powershell
adb install -r app-release-signed.apk
```

Open the app. It should open without a browser address bar. If the address bar
remains, Digital Asset Links is not verified. Check:

```powershell
adb shell pm get-app-links com.aits.jam
```

Also verify:

- Login works.
- A student can submit a letter.
- A mentor can forward or approve it.
- An HOD can approve it.
- The QR verification page opens.
- The signed PDF downloads.
- Push notifications work if VAPID is configured.

TWA uses Chrome/Custom Tabs. Devices without a supported browser fall back to a
normal browser tab; that is expected.

## 5. Upload to Play Console

1. Create the app in Play Console with the same package name.
2. Upload `app-release-bundle.aab` to an internal testing track first.
3. Enrol in **Play App Signing**.
4. Copy the **App signing key certificate SHA-256** from Play Console into
   `ANDROID_SHA256_CERT_FINGERPRINTS`, then redeploy the web app.
5. Install the Play-signed build from the internal testing link and re-test.
6. Promote to closed/open testing, then production.

The Play-signed build has a different certificate from the upload key. The
Digital Asset Links file must include the Play App Signing fingerprint, not only
the upload key.

## 6. Version updates

Increment `appVersionCode` for every Play Store upload. Update the version name
at the same time:

```powershell
npx @bubblewrap/cli update --appVersionName 1.0.1
npx @bubblewrap/cli build
```

Do not reuse a version code.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Address bar is visible | `assetlinks.json` is missing, returns the wrong package name, or has the wrong SHA-256 fingerprint. Redeploy and reinstall the app. |
| `assetlinks.json` returns 503 | Set `ANDROID_SHA256_CERT_FINGERPRINTS` in the hosting provider. |
| `bubblewrap` asks for JDK 17 | Install Temurin 17 and set `JAVA_HOME`; newer JDKs are not supported. |
| App opens the browser | Chrome/Custom Tabs is unavailable, or TWA verification failed. |
| Push notifications do not work | Check VAPID keys, HTTPS, notification permission, and the service worker. |
| Play Console rejects the app | Complete the listing, data safety, content rating, privacy policy, and account-deletion requirements in `PLAY_STORE.md`. |

## Files that must not be committed

- `*.jks`, `*.keystore`, and any `android-keystore` directory.
- `app-release-signed.apk`, `app-release-bundle.aab`, and build outputs.
- Passwords, Play service-account JSON, and signing environment variables.
