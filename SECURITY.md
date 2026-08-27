# JAM Security Policy & Architecture

This document describes the security protocols, configuration, and threat model protections implemented in the JAM (Just A Minute) Campus Letter Automation Platform.

---

## 🛡️ Active Defensive Headers

We enforce industry-standard security headers via Next.js middleware router configurations to prevent client-side script exploits:

| Header | Value / Configuration | Defensive Objective |
| :--- | :--- | :--- |
| **Content Security Policy (CSP)** | `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://openrouter.ai;` | Prevents Cross-Site Scripting (XSS) and blocks unauthorized script loading/connections. |
| **X-Frame-Options** | `DENY` | Prevents Clickjacking attacks by forbidding the app from being rendered inside an `iframe` on other domains. |
| **X-Content-Type-Options** | `nosniff` | Forces the browser to strictly follow declared MIME content types to prevent content sniffing exploits. |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Protects privacy by stripping referrer data when navigating to external resources. |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=()` | Deactivates client browser hardware APIs that are not required by the application. |

---

## 💾 Database Row-Level Security (RLS)

PostgreSQL Row-Level Security is active on all tables in Supabase:

* **Authenticated Tenant Partitioning:** A student can only view and mutate letter requests belonging to their own `auth.uid()`.
* **Reviewer Boundary:** A Class Mentor or HOD can only select letters where their `profile.id` matches the assigned `mentor_id` or `hod_id` of the letter record.
* **Public QR Verification Isolation:** The public verification route is governed by `Allow public read for approved letters`. This policy permits anonymous requests to select letter contents **only if the status matches `'approved'`**. Pending, draft, or declined letters will return `404 Not Found` to public requests.

---

## 🔑 Column-Level Security (CLS) for E-Signatures

To protect faculty signatures from theft or reuse by students:
* The `esign_storage_path` column in the `profiles` table is restricted via Postgres security rules.
* Client-side reads on this column are explicitly blocked:
  ```sql
  REVOKE SELECT (esign_storage_path) ON public.profiles FROM public, anon, authenticated;
  ```
* **Safe backend reads:** Select permissions on this column are granted exclusively to the database `service_role` (accessible only inside secure serverless API routes on Next.js server instances):
  ```sql
  GRANT SELECT (esign_storage_path) ON public.profiles TO service_role;
  ```

---

## 🔐 API Key Security (Bring Your Own Key)

The student AI letter generation feature uses a Bring Your Own Key (BYOK) model:
* **No Database Storage:** The student's OpenRouter API key is never written to the server's database or permanent records.
* **Volatile Session Storage:** The key is held in `sessionStorage` in the browser. It exists only inside the active tab's RAM and is permanently destroyed as soon as the tab is closed.
* **Encrypted Transit:** The key is sent to the `/api/generate-ai-body` endpoint over a secure, encrypted HTTPS/TLS channel.

---

## 📈 Rate Limiting

The application limits API spam to prevent Denial of Service (DoS) using a serverless in-memory rate-limiter:
* Governs heavy actions (AI generation, digital signature upload, account creation).
* Tracks client IP requests in sliding windows of 60 seconds.
