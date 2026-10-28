import { createAdminClient } from '@/lib/supabase/server';
import { logError } from '@/lib/api';

export type AuditAction =
  | 'letter.created'
  | 'letter.forwarded'
  | 'letter.approved'
  | 'letter.rejected'
  | 'user.created'
  | 'user.deleted'
  | 'signature.updated';

interface AuditEntry {
  letterId?: string;
  actorId: string;
  action: AuditAction;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('letter_audit_log').insert({
      letter_id: entry.letterId ?? null,
      actor_id: entry.actorId,
      action: entry.action,
      from_status: entry.fromStatus ?? null,
      to_status: entry.toStatus ?? null,
      metadata: entry.metadata ?? {},
    });

    if (error) logError('writeAuditLog', error);
  } catch (error) {
    logError('writeAuditLog', error);
  }
}
