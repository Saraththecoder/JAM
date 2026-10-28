import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getAppUrl,
  getAuth,
  getProfile,
  isApprovedFaculty,
  jsonError,
  logError,
  parseJson,
} from '@/lib/api';
import { letterActionLimiter } from '@/lib/rate-limit';
import { letterForwardSchema } from '@/lib/validation';
import { writeAuditLog } from '@/lib/audit';
import { notifyLetterEvent } from '@/lib/notifications';

interface ForwardLetter {
  id: string;
  status: string;
  mentor_id: string | null;
  student: { department_id: string | null } | null;
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
      return jsonError('Only approved faculty members can forward letters.', 403);
    }

    const parsed = await parseJson(request, letterForwardSchema);
    if (!parsed.ok) return parsed.response;

    const admin = createAdminClient();
    const { data: letterData, error: letterError } = await admin
      .from('letters')
      .select('id, status, mentor_id, student:student_id (department_id)')
      .eq('id', parsed.data.letterId)
      .single();

    if (letterError || !letterData) {
      return jsonError('Letter not found.', 404);
    }

    const letter = letterData as unknown as ForwardLetter;

    if (letter.status !== 'pending_mentor' || letter.mentor_id !== user.id) {
      return jsonError('This letter is not awaiting your recommendation.', 403);
    }

    if (!letter.student?.department_id) {
      return jsonError('The student department could not be resolved.', 400);
    }

    const { data: signer, error: signerError } = await admin
      .from('profiles')
      .select('esign_storage_path')
      .eq('id', user.id)
      .single();

    if (signerError) {
      logError('letters.forward.signer', signerError);
      return jsonError('Unable to verify your signature. Please try again.', 500);
    }

    if (!signer?.esign_storage_path) {
      return jsonError('Upload your digital signature before forwarding a letter.', 400);
    }

    const { data: hod, error: hodError } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'faculty')
      .eq('is_approved', true)
      .eq('is_hod', true)
      .eq('department_id', letter.student.department_id)
      .neq('id', user.id)
      .limit(1)
      .maybeSingle();

    if (hodError) {
      logError('letters.forward.findHod', hodError);
      return jsonError('Unable to resolve the department HOD.', 500);
    }

    if (!hod) {
      return jsonError('No approved HOD is configured for this department.', 400);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from('letters')
      .update({
        status: 'pending_hod',
        hod_id: hod.id,
        faculty_id: hod.id,
        mentor_signed_at: now,
      })
      .eq('id', letter.id)
      .eq('status', 'pending_mentor')
      .eq('mentor_id', user.id)
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      logError('letters.forward.update', updateError);
      return jsonError(
        'The letter changed while it was being forwarded. Refresh the page and try again.',
        409
      );
    }

    await writeAuditLog({
      letterId: letter.id,
      actorId: user.id,
      action: 'letter.forwarded',
      fromStatus: 'pending_mentor',
      toStatus: 'pending_hod',
      metadata: { hodId: hod.id },
    });

    const notification = await notifyLetterEvent({
      letterId: letter.id,
      type: 'mentor_approved',
      actorId: user.id,
      origin: getAppUrl(request),
    });

    if (!notification.success) {
      logError('letters.forward.notification', notification.error);
    }

    return NextResponse.json({
      success: true,
      hodId: hod.id,
      notificationSent: notification.success,
    });
  } catch (error) {
    logError('letters.forward', error);
    return jsonError('Unable to forward the letter. Please try again.', 500);
  }
}
