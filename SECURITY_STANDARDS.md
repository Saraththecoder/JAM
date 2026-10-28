# JAM Application Security & Architectural Standards

This document establishes the mandatory security rules and engineering standards for all application features, API routes, and database migrations in this repository.

---

## 1. Secrets & Environment Isolation
- **No Hardcoded Credentials:** Never hardcode passwords, secret keys, service keys, or tokens in source files or git history.
- **Environment Scope:**
  - Client-accessible variables must begin with `NEXT_PUBLIC_`.
  - Secret keys (e.g. `SUPABASE_SERVICE_ROLE_KEY`) must **never** use the `NEXT_PUBLIC_` prefix and must only be evaluated inside server serverless functions / API routes.
- **Version Control Rules:** `.env` and `.env.local` must remain in `.gitignore`. Maintain `.env.example` as a clean, key-only template.

---

## 2. Row Level Security (RLS) & Column-Level Security (CLS)
- **RLS Mandatory:** PostgreSQL Row-Level Security must be enabled on every table created in Supabase.
- **No Anonymous Table Scrapes:** Never create policies granting blanket `SELECT TO anon` on user profiles or tables containing PII.
- **Public Page Scope:** For public verification endpoints (e.g. `/verify/[id]`), restrict anonymous access exclusively to a dedicated, metadata-only RPC function. Do not expose raw tables.
- **Column-Level Protection:** Sensitive columns (such as `esign_storage_path`) must be explicitly `REVOKE`'d from `public`, `anon`, and `authenticated`, and granted `TO service_role` only.

---

## 3. API Rate Limiting
- **Protection Required:** Every public endpoint, authentication route, file upload endpoint, AI generation handler, and administrative route must execute rate limiting before processing requests.
- **Distributed by default:** Use the named Upstash limiters in `lib/rate-limit.ts`. The in-memory fallback is for local development only and logs a warning in production.
- **Standard Limits:**
  - Standard API / downloads: 15–20 requests per minute per user or IP.
  - High-cost / admin actions (AI generation, user creation/deletion, signature upload): 10 requests per minute per user.
  - Bulk import: 3 requests per minute per HOD.

---

## 4. Error Sanitization & Defensive Logging
- **Sanitized Client Responses:** Never leak raw database error messages (`createError.message`), internal file paths, module tracebacks, or configuration details in HTTP JSON responses.
- **Server Logging:** Catch top-level exceptions and log full error objects to server logs (`console.error`), returning a generic response (`{ "error": "Internal Server Error" }`) with appropriate status codes (`500`, `401`, `403`, `429`).

---

## 5. Server-Side Authentication & RBAC
- **Independent Verification:** Never trust client-side role claims, localStorage, or UI state for access control.
- **Server Validation:** Every API route handling sensitive data or actions must call `supabase.auth.getUser()` and verify user roles directly against database profiles before executing operations.
- **Explicit HOD flag:** Use `profiles.is_hod` for HOD checks. Do not infer HOD privileges from a free-text designation at request time.
- **State checks:** Review actions must also match the caller to the specific letter assignment and the current status, not just the role.

---

## 6. Cloud Storage Security
- **Private Buckets:** Default all cloud storage buckets to `public = false`.
- **Signed Read URLs:** Serve stored files (e.g., generated PDFs, signature images) via short-lived signed URLs generated on the server using `createSignedUrl()`.
