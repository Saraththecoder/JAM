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
| Privacy policy | `https://justaminuteaits.vercel.app/privacy` |
| Website | `https://justaminuteaits.vercel.app` |
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
- Account-deletion requests and the optional reason supplied by the user.

State that data is encrypted in transit, is used for app functionality and
notifications, and is not sold. List Supabase, Resend, Upstash, and OpenRouter as
service providers where applicable. Do not declare “no data collected.”

### Account deletion

JAM provides a user-facing deletion request flow:

- Student and faculty dashboards link to `/delete-account`.
- The page is publicly reachable at
  `https://justaminuteaits.vercel.app/delete-account`; signing in is required so
  a request cannot be submitted for someone else's account.
- The request is stored in `account_deletion_requests` and appears in the HOD's
  **Department Database** tab.
- The HOD processes it by deleting the account, which removes the profile,
  signature, letter requests, and signed PDFs. Audit records may be retained for
  institutional accountability, as stated in the privacy notice.

The HOD must actually process requests. Do not claim instant self-service
deletion; the current flow is a reviewed request.

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

`https://justaminuteaits.vercel.app/privacy` must be publicly reachable without login and must
describe collection, use, sharing, retention, deletion, and contact details.
Update it if the Android app introduces any new data handling.

## Release process

1. Apply every file in `supabase/migrations/`, including
   `20261028000000_production_hardening.sql` and
   `20261028000001_account_deletion_requests.sql`, then verify `/api/health`
   returns `200` with `database: "ok"`.
2. Deploy the web app and verify `NEXT_PUBLIC_APP_URL`, `/privacy`,
   `/delete-account`, `/manifest.webmanifest`, and `/.well-known/assetlinks.json`.
3. Build the signed AAB using `android/README.md`.
4. Upload to **Internal testing** first.
5. Add the Play App Signing SHA-256 fingerprint to
   `ANDROID_SHA256_CERT_FINGERPRINTS` (or `android/assetlinks.json`) and redeploy.
6. Install the Play-signed build and verify there is no browser address bar.
7. Complete the store listing, app access, data safety, content rating, and
   account-deletion requirements.
8. Promote to closed testing, then production.

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
