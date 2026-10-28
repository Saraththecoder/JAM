# JAM — Just A Minute

Campus letter automation for AITS Tirupati. Students submit a letter request, a
class mentor recommends it, and the department HOD gives the final signature.
The platform produces a signed PDF with a QR verification link and a SHA-256
checksum.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (Auth, Postgres, private Storage buckets)
- Resend for transactional email
- Web Push (VAPID) for browser notifications
- Upstash Redis for distributed rate limiting
- `pdf-lib` + `qrcode` for server-side PDF generation

## Roles

| Role | Capabilities |
| --- | --- |
| Student | Create requests, edit the drafted body, download own letters |
| Faculty mentor | Review, decline, recommend, upload a signature |
| HOD | Final approval, account provisioning/deletion, department directory |
| Public verifier | Open `/verify/[id]` or scan the QR code; sees metadata only |

Public signup is disabled. Accounts are created by an approved HOD through the
faculty dashboard, which calls the service-role provisioning route.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the Supabase project values.
3. Apply the SQL migrations in `supabase/migrations/` in filename order. The
   final hardening migration is required before running this version of the
   application.
4. Start the development server:
   ```bash
   npm run dev
   ```

The app expects the `signatures` and `letters` Storage buckets to be private.
They are created by the initial migration.

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Serve the production build
npm run lint     # ESLint
npm run typecheck
npm run test     # Vitest unit tests
```

## Security model (short version)

- All sensitive writes go through server routes that call `auth.getUser()`,
  load the caller's profile with the service role, and check role/department.
- Client `INSERT`/`UPDATE`/`DELETE` privileges on `profiles` and `letters` are
  revoked. The same applies to `push_subscriptions`.
- A database trigger enforces legal letter transitions and requires signatures,
  PDF hashes, rejection reasons, and the correct reviewer.
- The public verification RPC returns only metadata; the letter body stays in
  the signed PDF.
- Storage buckets are private. PDFs are downloaded through short-lived signed
  URLs. Signature files are read only by the server for PDF generation.
- Verification URLs and email links use `NEXT_PUBLIC_APP_URL` when configured.
- Rate limits use Upstash in production. Without Upstash, a bounded process-local
  fallback is used and a warning is logged.

See [SECURITY.md](SECURITY.md) for the full policy.

## Verification flow

1. Student submits a request to a mentor in their department.
2. Mentor either declines or forwards to the department HOD. Forwarding records
   `mentor_signed_at`. If the department has no approved HOD, the mentor may
   approve directly; the server and database both enforce that fallback.
3. HOD reviews the letter and approves it. The server downloads both signature
   images, renders the PDF, uploads it to the private `letters` bucket, stores
   the SHA-256 hash and reference number, and sends notifications.
4. The QR code points to `/verify/[letter-id]`. The public RPC returns metadata
   and the PDF hash so a verifier can compare a downloaded file.

## Android / Play Store

The web app is packaged for Android as a Trusted Web Activity (TWA), so the
Play Store app loads the deployed Next.js application instead of duplicating the
UI. A generated Android project is included under `android/` and configured for
`https://justaminuteaits.vercel.app`.
See [`android/README.md`](android/README.md) for the Bubblewrap build and
signing steps, and [`PLAY_STORE.md`](PLAY_STORE.md) for the submission checklist.

Set `NEXT_PUBLIC_APP_URL`, `ANDROID_PACKAGE_NAME`, and
`ANDROID_SHA256_CERT_FINGERPRINTS` in the production environment. The latter is
served from `/.well-known/assetlinks.json`; without it Android shows a browser
address bar instead of opening the app full-screen.

## Operational notes

- Set `NEXT_PUBLIC_APP_URL` in production. It is used for QR codes, email links,
  and same-origin request checks. On Vercel the app falls back to
  `VERCEL_PROJECT_PRODUCTION_URL` when the explicit variable is absent.
- Set `RESEND_API_KEY`, `EMAIL_FROM`, and VAPID keys to enable email and push.
- Set Upstash credentials for reliable rate limiting across serverless instances.
- Account deletion requests are submitted from `/delete-account` and reviewed by
  the department HOD in the **Department Database** tab.
- `GET /api/health` reports database reachability and which optional integrations
  are configured. It never returns secret values.
- Rotate the Supabase service-role key and VAPID private key if they are ever
  exposed. Do not commit `.env.local`.
