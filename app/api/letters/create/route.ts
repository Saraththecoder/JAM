import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getAppUrl,
  getAuth,
  getProfile,
  jsonError,
  logError,
  parseJson,
} from '@/lib/api';
import { createLetterLimiter } from '@/lib/rate-limit';
import { letterCreateSchema } from '@/lib/validation';
import { writeAuditLog } from '@/lib/audit';
import { notifyLetterEvent } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await createLetterLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many letter requests. Please wait a minute and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!profile || profile.role !== 'student' || !profile.is_approved) {
      return jsonError('Only approved students can submit letter requests.', 403);
    }

    if (!profile.department_id) {
      return jsonError('Your account is not assigned to a department.', 403);
    }

    const parsed = await parseJson(request, letterCreateSchema);
    if (!parsed.ok) return parsed.response;

    const { letterTypeId, mentorId, formData, generatedBody } = parsed.data;
    const admin = createAdminClient();

    const { data: letterType, error: typeError } = await admin
      .from('letter_types')
      .select('id, name')
      .eq('id', letterTypeId)
      .single();

    if (typeError || !letterType) {
      return jsonError('The selected letter type is not available.', 400);
    }

    const { data: mentor, error: mentorError } = await admin
      .from('profiles')
      .select('id, role, is_approved, is_hod, department_id')
      .eq('id', mentorId)
      .single();

    if (
      mentorError ||
      !mentor ||
      mentor.role !== 'faculty' ||
      !mentor.is_approved ||
      mentor.is_hod ||
      mentor.department_id !== profile.department_id
    ) {
      return jsonError('Select an approved faculty mentor (not the HOD) from your department.', 400);
    }

    if (mentor.id === profile.id) {
      return jsonError('You cannot assign yourself as the mentor.', 400);
    }

    const { data: created, error: insertError } = await admin
      .from('letters')
      .insert({
        student_id: user.id,
        faculty_id: mentor.id,
        mentor_id: mentor.id,
        hod_id: null,
        letter_type_id: letterType.id,
        form_data: formData,
        generated_body: generatedBody,
        status: 'pending_mentor',
      })
      .select('id')
      .single();

    if (insertError || !created) {
      logError('letters.create.insert', insertError);
      return jsonError('Unable to save the letter request. Please try again.', 500);
    }

    await writeAuditLog({
      letterId: created.id,
      actorId: user.id,
      action: 'letter.created',
      toStatus: 'pending_mentor',
      metadata: {
        letterType: letterType.name,
        mentorId: mentor.id,
      },
    });

    const notification = await notifyLetterEvent({
      letterId: created.id,
      type: 'new_request',
      actorId: user.id,
      origin: getAppUrl(request),
    });

    if (!notification.success) {
      logError('letters.create.notification', notification.error);
    }

    return NextResponse.json({
      success: true,
      letterId: created.id,
      notificationSent: notification.success,
    });
  } catch (error) {
    logError('letters.create', error);
    return jsonError('Unable to submit the letter request. Please try again.', 500);
  }
}
