import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getAppUrl,
  getAuth,
  getClientIp,
  getProfile,
  isApprovedFaculty,
  isHod,
  jsonError,
  logError,
  parseJson,
} from '@/lib/api';
import { approveLetterLimiter } from '@/lib/rate-limit';
import { approveLetterSchema } from '@/lib/validation';
import { generateLetterPdf, type LetterPdfData } from '@/lib/pdf-letter';
import { notifyLetterEvent } from '@/lib/notifications';
import { writeAuditLog } from '@/lib/audit';

type ApprovableLetter = LetterPdfData & {
  status: string;
  mentor_id: string | null;
  hod_id: string | null;
  mentor_signed_at: string | null;
  hod_signed_at: string | null;
  student: (NonNullable<LetterPdfData['student']> & { department_id: string | null }) | null;
};

function signatureExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await approveLetterLimiter.limit(user.id || getClientIp(request));
    if (!limit.success) {
      return jsonError('Too many approval attempts. Please wait a minute and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!isApprovedFaculty(profile)) {
      return jsonError('Only approved faculty members can approve letters.', 403);
    }

    const parsed = await parseJson(request, approveLetterSchema);
    if (!parsed.ok) return parsed.response;

    const { letterId } = parsed.data;
    const admin = createAdminClient();

    const { data: letterData, error: letterError } = await admin
      .from('letters')
      .select(`
        id,
        created_at,
        generated_body,
        status,
        mentor_id,
        hod_id,
        mentor_signed_at,
        hod_signed_at,
        letter_types (name),
        student:student_id (full_name, roll_number, department_id, departments (name)),
        mentor:mentor_id (full_name, designation, esign_storage_path),
        hod:hod_id (full_name, designation, esign_storage_path)
      `)
      .eq('id', letterId)
      .single();

    if (letterError || !letterData) {
      return jsonError('Letter not found.', 404);
    }

    const letter = letterData as unknown as ApprovableLetter;
    const isMentorApproving =
      letter.status === 'pending_mentor' && letter.mentor_id === user.id && !letter.hod_id;
    const isHodApproving =
      letter.status === 'pending_hod' && letter.hod_id === user.id && isHod(profile);

    if (!isMentorApproving && !isHodApproving) {
      return jsonError('You do not have active review permission for this approval step.', 403);
    }

    if (isMentorApproving) {
      const studentDepartmentId = letter.student?.department_id;
      if (!studentDepartmentId) {
        return jsonError('The student department could not be resolved.', 409);
      }

      const { data: configuredHod, error: hodError } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'faculty')
        .eq('is_approved', true)
        .eq('is_hod', true)
        .eq('department_id', studentDepartmentId)
        .neq('id', user.id)
        .limit(1)
        .maybeSingle();

      if (hodError) {
        logError('approve-letter.findHod', hodError);
        return jsonError('Unable to verify the department approval chain.', 500);
      }

      if (configuredHod) {
        return jsonError(
          'This department has an HOD. Forward the letter to the HOD for final approval.',
          409
        );
      }
    }

    const mentorSignaturePath = letter.mentor?.esign_storage_path;
    const hodSignaturePath = letter.hod?.esign_storage_path;

    if (isHodApproving && !letter.mentor_signed_at) {
      return jsonError('The mentor signature record is incomplete. Ask the mentor to forward the letter again.', 409);
    }

    if (!mentorSignaturePath) {
      return jsonError('The class mentor must upload a digital signature before approval.', 400);
    }

    if (isHodApproving && !hodSignaturePath) {
      return jsonError('The HOD must upload a digital signature before final approval.', 400);
    }

    const mentorExtension = signatureExtension(mentorSignaturePath);
    if (!['png', 'jpg', 'jpeg'].includes(mentorExtension)) {
      return jsonError('The mentor signature must be re-uploaded as a PNG or JPEG image.', 400);
    }

    if (isHodApproving && hodSignaturePath) {
      const hodExtension = signatureExtension(hodSignaturePath);
      if (!['png', 'jpg', 'jpeg'].includes(hodExtension)) {
        return jsonError('The HOD signature must be re-uploaded as a PNG or JPEG image.', 400);
      }
    }

    const { data: mentorBlob, error: mentorDownloadError } = await admin.storage
      .from('signatures')
      .download(mentorSignaturePath);

    if (mentorDownloadError || !mentorBlob) {
      logError('approve-letter.mentorSignature', mentorDownloadError);
      return jsonError('Could not read the mentor signature. Please re-upload it and try again.', 500);
    }

    if (mentorBlob.size > 2 * 1024 * 1024) {
      return jsonError('The mentor signature is too large. Please re-upload a smaller image.', 400);
    }

    let hodSignature: ArrayBuffer | null = null;
    if (isHodApproving && hodSignaturePath) {
      const { data: hodBlob, error: hodDownloadError } = await admin.storage
        .from('signatures')
        .download(hodSignaturePath);

      if (hodDownloadError || !hodBlob) {
        logError('approve-letter.hodSignature', hodDownloadError);
        return jsonError('Could not read the HOD signature. Please re-upload it and try again.', 500);
      }

      if (hodBlob.size > 2 * 1024 * 1024) {
        return jsonError('The HOD signature is too large. Please re-upload a smaller image.', 400);
      }

      hodSignature = await hodBlob.arrayBuffer();
    }

    const generated = await generateLetterPdf(letter, {
      origin: getAppUrl(request),
      mentorSignature: await mentorBlob.arrayBuffer(),
      hodSignature,
    });

    const pdfPath = `${letterId}.pdf`;
    const { error: uploadError } = await admin.storage.from('letters').upload(pdfPath, generated.bytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (uploadError) {
      logError('approve-letter.uploadPdf', uploadError);
      return jsonError('Failed to store the signed PDF. Please try again.', 500);
    }

    const now = new Date().toISOString();
    const expectedStatus = isMentorApproving ? 'pending_mentor' : 'pending_hod';

    const { data: updated, error: updateError } = await admin
      .from('letters')
      .update({
        status: 'approved',
        pdf_storage_path: pdfPath,
        reference_number: generated.referenceNumber,
        mentor_signed_at: letter.mentor_signed_at || now,
        hod_signed_at: isHodApproving ? now : null,
        pdf_hash: generated.hash,
      })
      .eq('id', letterId)
      .eq('status', expectedStatus)
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      logError('approve-letter.updateLetter', updateError);

      // Do not delete the PDF if another request already approved the letter:
      // both requests target the same deterministic storage path.
      const { data: current, error: currentError } = await admin
        .from('letters')
        .select('status')
        .eq('id', letterId)
        .maybeSingle();

      if (!currentError && current?.status !== 'approved') {
        const { error: cleanupError } = await admin.storage.from('letters').remove([pdfPath]);
        if (cleanupError) logError('approve-letter.cleanupPdf', cleanupError);
      }

      return jsonError(
        'The letter changed while it was being signed. Refresh the page and try again.',
        409
      );
    }

    await writeAuditLog({
      letterId,
      actorId: user.id,
      action: 'letter.approved',
      fromStatus: expectedStatus,
      toStatus: 'approved',
      metadata: {
        referenceNumber: generated.referenceNumber,
        pdfHash: generated.hash,
        approverRole: isHodApproving ? 'hod' : 'mentor',
      },
    });

    const notification = await notifyLetterEvent({
      letterId,
      type: 'approval',
      actorId: user.id,
      origin: getAppUrl(request),
    });

    if (!notification.success) {
      logError('approve-letter.notification', notification.error);
    }

    return NextResponse.json({
      success: true,
      pdfPath,
      referenceNumber: generated.referenceNumber,
      notificationSent: notification.success,
    });
  } catch (error) {
    logError('approve-letter', error);
    return jsonError('Unable to approve the letter. Please try again.', 500);
  }
}
