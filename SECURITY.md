# JAM Security Policy & Architecture

This document describes the security controls implemented in the JAM campus
letter platform. It is written for maintainers and operators, not as a claim of
formal certification.

## 1. Trust boundaries

- The browser is untrusted. Client-side role checks, hidden UI, and local state
  are never used for authorization.
- Every sensitive route calls `supabase.auth.getUser()`, then loads the caller's
  profile with the service-role client and checks role, approval, department, and
  the specific letter assignment.
- The service-role key is server-only. It must never use a `NEXT_PUBLIC_` prefix
  and must never be sent to the browser.

## 2. Database authorization

- RLS is enabled on all application tables.
- `profiles` reads are limited to the caller's own profile and profiles in the
  caller's department. The department lookup uses a `SECURITY DEFINER` helper to
  avoid recursive RLS evaluation.
- Anonymous callers cannot read `profiles`, `letters`, or `push_subscriptions`
  directly. Public verification goes through `verify_letter(uuid)`, which returns
  only approved-letter metadata.
- Client `INSERT`, `UPDATE`, and `DELETE` privileges on `profiles`, `letters`,
  and `push_subscriptions` are revoked. Server routes use the service role.
- Table-level `SELECT` on `profiles` is revoked from `anon` and `authenticated`;
  authenticated users receive column grants only for non-sensitive UI fields.
  `esign_storage_path` is never granted to those roles; only the service role can
  read it.
- The `enforce_letter_write_rules` trigger rejects illegal status transitions and
  requires the right approval artifacts (mentor signature, HOD signature, PDF
  path, SHA-256 hash, rejection reason/reviewer).
- `letter_audit_log` is service-role only and records actor, action, transition,
  and metadata.

## 3. Account provisioning

- Public signup is disabled. The `handle_new_user` trigger rejects auth users
  unless the server set the service-role-only `app_metadata.provisioned_by =
  'admin'` marker. User-controlled `user_metadata` cannot satisfy this check.
- HODs create accounts through `/api/admin/create-user` or
  `/api/admin/bulk-create-users`. The server derives the student's department
  from the roll number and verifies it matches the HOD's department.
- The last approved HOD in a department cannot be deleted.
- HOD status is stored explicitly in `profiles.is_hod`; it is not inferred from
  free-text designations at request time.

## 4. Signatures and PDFs

- Signature files and signed PDFs live in private Supabase Storage buckets.
- Signature uploads accept only PNG/JPEG files, validate magic bytes, and cap the
  decoded size at 2 MB.
- PDFs are generated on the server from database records. The QR code is
  generated locally; no third-party QR service receives the verification URL.
- The SHA-256 hash of the generated PDF is stored in `letters.pdf_hash` and is
  displayed on the verification page so a downloaded file can be checked.
- PDF downloads use short-lived signed URLs. The download route checks approval
  status or participant membership first.

## 5. Notifications

- Email is sent with Resend. In development, a missing API key produces a logged
  mock; in production it returns a configuration error rather than silently
  dropping mail.
- Notification recipients and allowed notification types are derived from the
  current database state, not from the client. A client cannot ask the server to
  email an arbitrary address.
- User-controlled names and rejection reasons are HTML-escaped in email bodies
  and stripped of CR/LF in subjects.
- Push is disabled when VAPID keys are absent. Expired subscriptions are removed
  when the push service returns 404/410. Signing out clears the browser's push
  subscription so a shared device does not keep receiving the previous user's
  notifications.

## 6. Rate limiting and abuse controls

- Named Upstash limiters protect letter creation, approval, forwarding,
  rejection, downloads, AI generation, signature uploads, account creation,
  deletion, bulk import, notifications, and push subscriptions.
- When Upstash is not configured, a bounded in-memory fallback is used for local
  development. Production deployments should always configure Upstash; the
  health endpoint reports whether it is present.
- AI generation uses the student's own OpenRouter key, which is held only in the
  browser tab's session memory and forwarded to the server route. It is not
  stored in the database or logs.

## 7. HTTP and browser controls

- `next.config.ts` sets a CSP, HSTS (production), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, a strict referrer policy, a restrictive
  permissions policy, COOP, and CORP.
- The proxy rejects cross-site state-changing API requests when an `Origin`
  header is present and does not match the app origin.
- Private routes are marked `noindex`; public verification pages are isolated
  from the authenticated portals.

## 8. Error handling and logging

- API responses use generic messages. Raw database/provider errors are logged on
  the server with a context label and are not returned to clients.
- Request bodies, passwords, service-role keys, VAPID private keys, and
  OpenRouter keys are never logged.
- Health checks expose only boolean integration flags and database reachability.

## 9. Deployment checklist

1. Apply all migrations in order, including
   `20261028000000_production_hardening.sql`.
2. Confirm the intended department HOD has `profiles.is_hod = true`. The
   migration backfills it from designations containing "HOD" or "head"; set it
   manually if the existing designation uses a different spelling.
3. Set `NEXT_PUBLIC_APP_URL`, Supabase keys, `SUPABASE_SERVICE_ROLE_KEY`,
   Resend, VAPID, and Upstash values in the hosting provider.
4. Keep both Storage buckets private.
5. Confirm `/api/health` returns `ok` and the expected integration flags.
6. Verify that a new HOD can create a student account, a mentor can forward a
   letter, an HOD can approve it, and the QR verification page returns metadata.
7. For the Android TWA, set `ANDROID_PACKAGE_NAME` and
   `ANDROID_SHA256_CERT_FINGERPRINTS`, then confirm
   `/.well-known/assetlinks.json` returns the Play App Signing fingerprint.
8. Rotate any credential that was ever committed or shared in plain text.
