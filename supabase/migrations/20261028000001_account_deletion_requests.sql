-- Play Store account-deletion requests.
--
-- Users can request deletion from /delete-account (inside the app or in a
-- browser). The request is scoped to the user's department so the HOD can
-- review and process it from the faculty dashboard. Service-role routes are the
-- only readers/writers; direct client access is intentionally revoked.

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT account_deletion_reason_length
    CHECK (reason IS NULL OR char_length(reason) <= 1000)
);

-- A user can have at most one open request. Historical rows are retained if a
-- request is cancelled or processed.
CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_one_pending_per_user
  ON public.account_deletion_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS account_deletion_department_queue
  ON public.account_deletion_requests (department_id, status, requested_at DESC);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_deletion_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_deletion_requests TO service_role;

COMMENT ON TABLE public.account_deletion_requests IS
  'Self-service account deletion requests reviewed by the department HOD.';

NOTIFY pgrst, 'reload schema';
