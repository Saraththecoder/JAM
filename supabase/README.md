# Supabase migrations

The application expects every migration in `supabase/migrations/` to be applied
in filename order. Two migrations are currently required for the production
hardening and Play Store release:

1. `20261028000000_production_hardening.sql` — audit log, HOD flag, RLS/grants,
   state-transition safeguards, indexes, and the verification RPC.
2. `20261028000001_account_deletion_requests.sql` — the self-service deletion
   request queue used by `/delete-account` and the HOD dashboard.

## Option A — Supabase SQL Editor

1. Open the project in the Supabase dashboard.
2. Go to **SQL Editor**.
3. Paste the contents of `20261028000000_production_hardening.sql` and run it.
4. Paste the contents of `20261028000001_account_deletion_requests.sql` and run
   it.
5. Open `/api/health` on the deployment. It must return `200` with
   `"database":"ok"`.

## Option B — Supabase CLI

```powershell
npx supabase login
npx supabase link --project-ref gszfgooqfjcirgtweucg
npx supabase db push
```

`db push` prompts for the database password. Keep that password out of git and
out of shell history where possible.

## Verify

```powershell
curl.exe https://justaminuteaits.vercel.app/api/health
```

The expected healthy response is:

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "emailConfigured": false,
    "pushConfigured": true,
    "rateLimitConfigured": true,
    "appUrlConfigured": true
  }
}
```

`emailConfigured` becomes `true` after `RESEND_API_KEY` and `EMAIL_FROM` are
configured in Vercel. It does not affect the overall health status.
