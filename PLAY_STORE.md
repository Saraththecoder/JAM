# Play Store publishing checklist

This is the submission checklist for the JAM Trusted Web Activity. The Android
build steps are in [`android/README.md`](android/README.md).

## App identity

| Field | Suggested value |
| --- | --- |
| App name | `JAM — Just A Minute` |
| Package name | `com.aits.jam` |
| Category | Education |
| Contact email | `admin@aits-tpt.edu.in` |
| Privacy policy | `https://YOUR_DOMAIN/privacy` |
| Website | `https://YOUR_DOMAIN` |
| Ads | No |
| In-app purchases | No |

The package name is permanent after the first upload.

## Store listing copy

**Short description (80 characters max):**

> Campus letters, digitally signed and verified in minutes.

**Full description:**

> JAM — Just A Minute is the campus letter platform for AITS Tirupati.
>
> Students submit a letter request, choose a department mentor, and track the
> approval status from their dashboard. Mentors review and sign requests before
> forwarding them to the department HOD. The HOD gives the final approval and
> the platform generates a signed PDF with a QR verification link.
>
> Key features:
>
> • Submit and track campus letter requests
> • Mentor and HOD approval workflow
> • Digital signatures and signed PDF downloads
> • QR-based public document verification
> • Department-scoped student and faculty accounts
> • Push and email status notifications
>
> Accounts are provisioned by the department HOD. Public signup is disabled.
>
> JAM is intended for AITS students and faculty. The app requires an account
> issued by your department.

## Required Play Console declarations

### App access

The app requires login. In **App access**, provide:

- A working student test account.
- A working mentor/faculty test account.
- A working HOD test account.
- Step-by-step instructions for reaching the review, approval, and verification
  screens.
- A note that public signup is disabled and accounts are provisioned by an HOD.

Keep the test accounts active until review completes.

### Data safety

Declare the data the app actually handles:

- Name, email address, roll number/student ID, department, and designation.
- Letter request content and approval/rejection decisions.
- Digital signature images uploaded by faculty.
- Signed PDFs and document verification metadata.
- Authentication identifiers and push subscription endpoints.

State that data is encrypted in transit, is used for app functionality and
notifications, and is not sold. List Supabase, Resend, Upstash, and OpenRouter as
service providers where applicable. Do not declare “no data collected.”

### Account deletion

Google Play requires apps with account creation/login to provide an in-app
account-deletion option and a web deletion link. JAM currently allows an HOD to
delete accounts from the faculty dashboard, but that is not a user-facing
self-service flow.

Before submitting, choose one of these:

1. **Preferred:** Add a “Delete my account” flow in the app that creates a
   deletion request for the HOD and exposes the same request at a public URL.
   Document the retention policy for signed letters and audit records.
2. Add a clear in-app deletion-request action that emails the department office,
   plus a public web page with the same action. Make sure requests are actually
   processed within the stated timeframe.

Do not claim that users can delete their own accounts unless that flow exists.

### Content rating

Complete the questionnaire for an education/productivity app. The app has no
ads, gambling, mature content, or public user-to-user posting. Letters are
private to the student and assigned reviewers; approved-letter metadata is
public through an unguessable verification link.

### Target audience

Select the college/adult audience appropriate for AITS. Do not select an
under-13 audience unless the institution has the required parental-consent and
Families policy controls in place.

### Permissions

The TWA itself only needs internet access. Notifications are requested at
runtime through the browser. Do not add camera, location, contacts, or storage
permissions unless a future native feature actually needs them.

### Privacy policy

`https://YOUR_DOMAIN/privacy` must be publicly reachable without login and must
describe collection, use, sharing, retention, deletion, and contact details.
Update it if the Android app introduces any new data handling.

## Release process

1. Deploy the web app and verify `NEXT_PUBLIC_APP_URL`, `/privacy`,
   `/manifest.webmanifest`, and `/.well-known/assetlinks.json`.
2. Build the signed AAB using `android/README.md`.
3. Upload to **Internal testing** first.
4. Add the Play App Signing SHA-256 fingerprint to
   `ANDROID_SHA256_CERT_FINGERPRINTS` and redeploy.
5. Install the Play-signed build and verify there is no browser address bar.
6. Complete the store listing, app access, data safety, content rating, and
   account-deletion requirements.
7. Promote to closed testing, then production.

## Common rejection reasons

- Address bar visible in the TWA: asset links missing or fingerprint mismatch.
- Login-required app without test credentials.
- Missing or unreachable privacy policy.
- Missing in-app account deletion option.
- Data safety form contradicts the privacy policy.
- App is only a website wrapper with no clear app value; the TWA must load the
  real JAM application and pass Digital Asset Links.
- Broken core flow during review: deploy the database migrations and verify the
  student → mentor → HOD → PDF → QR flow before submitting.
