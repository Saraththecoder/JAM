import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getAppUrl,
  getAuth,
  getProfile,
  isApprovedFaculty,
  isHod,
  jsonError,
  logError,
  parseJson,
} from '@/lib/api';
import { letterActionLimiter } from '@/lib/rate-limit';
import { letterRejectSchema } from '@/lib/validation';
import { writeAuditLog } from '@/lib/audit';
import { notifyLetterEvent } from '@/lib/notifications';

interface RejectableLetter {
  id: string;
  status: string;
  mentor_id: string | null;
  hod_id: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await letterActionLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many letter actions. Please wait a minute and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!isApprovedFaculty(profile)) {
      return jsonError('Only approved faculty members can decline letters.', 403);
    }

    const parsed = await parseJson(request, letterRejectSchema);
    if (!parsed.ok) return parsed.response;

    const admin = createAdminClient();
    const { data: letterData, error: letterError } = await admin
      .from('letters')
      .select('id, status, mentor_id, hod_id')
      .eq('id', parsed.data.letterId)
      .single();

    if (letterError || !letterData) {
      return jsonError('Letter not found.', 404);
    }

    const letter = letterData as unknown as RejectableLetter;
    const isMentorRejecting =
      letter.status === 'pending_mentor' && letter.mentor_id === user.id;
    const isHodRejecting =
      letter.status === 'pending_hod' && letter.hod_id === user.id && isHod(profile);

    if (!isMentorRejecting && !isHodRejecting) {
      return jsonError('You do not have active review permission for this letter.', 403);
    }

    const expectedStatus = isMentorRejecting ? 'pending_mentor' : 'pending_hod';
    const { data: updated, error: updateError } = await admin
      .from('letters')
      .update({
        status: 'rejected',
        rejection_reason: parsed.data.reason,
        rejection_by: user.id,
      })
      .eq('id', letter.id)
      .eq('status', expectedStatus)
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      logError('letters.reject.update', updateError);
      return jsonError(
        'The letter changed while it was being declined. Refresh the page and try again.',
        409
      );
    }

    await writeAuditLog({
      letterId: letter.id,
      actorId: user.id,
      action: 'letter.rejected',
      fromStatus: expectedStatus,
      toStatus: 'rejected',
      metadata: { reason: parsed.data.reason, reviewerRole: isHodRejecting ? 'hod' : 'mentor' },
    });

    const notification = await notifyLetterEvent({
      letterId: letter.id,
      type: 'rejection',
      actorId: user.id,
      origin: getAppUrl(request),
    });

    if (!notification.success) {
      logError('letters.reject.notification', notification.error);
    }

    return NextResponse.json({
      success: true,
      notificationSent: notification.success,
    });
  } catch (error) {
    logError('letters.reject', error);
    return jsonError('Unable to decline the letter. Please try again.', 500);
  }
}
