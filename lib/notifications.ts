import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { sendPushNotification } from '@/lib/push';
import { escapeHtml, logError } from '@/lib/api';

export type NotificationType = 'new_request' | 'mentor_approved' | 'approval' | 'rejection';

interface NotificationLetter {
  id: string;
  student_id: string;
  mentor_id: string | null;
  hod_id: string | null;
  faculty_id: string | null;
  status: string;
  rejection_reason: string | null;
  rejection_by: string | null;
  letter_types: { name: string } | null;
  student: { full_name: string; roll_number: string } | null;
  mentor: { full_name: string } | null;
  hod: { full_name: string } | null;
}

interface NotifyOptions {
  letterId: string;
  type: NotificationType;
  actorId: string;
  origin: string;
}

interface NotifyResult {
  success: boolean;
  error?: string;
  pushCount?: number;
}

function actorCanTrigger(letter: NotificationLetter, type: NotificationType, actorId: string): boolean {
  switch (type) {
    case 'new_request':
      return letter.status === 'pending_mentor' && letter.student_id === actorId;
    case 'mentor_approved':
      return letter.status === 'pending_hod' && letter.mentor_id === actorId;
    case 'approval':
      return letter.status === 'approved' && (letter.mentor_id === actorId || letter.hod_id === actorId);
    case 'rejection':
      return (
        letter.status === 'rejected' &&
        (letter.mentor_id === actorId || letter.hod_id === actorId) &&
        letter.rejection_by === actorId
      );
    default:
      return false;
  }
}

function recipientFor(letter: NotificationLetter, type: NotificationType): string | null {
  if (type === 'new_request') return letter.mentor_id;
  if (type === 'mentor_approved') return letter.hod_id;
  return letter.student_id;
}

function safeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function emailFor(letter: NotificationLetter, type: NotificationType, origin: string) {
  const letterTypePlain = safeSubject(letter.letter_types?.name || 'Academic Letter');
  const studentNamePlain = safeSubject(letter.student?.full_name || 'Student');
  const letterType = escapeHtml(letterTypePlain);
  const studentName = escapeHtml(studentNamePlain);
  const studentRoll = escapeHtml(letter.student?.roll_number || 'N/A');
  const mentorName = escapeHtml(letter.mentor?.full_name || 'Class Mentor');
  const hodName = letter.hod?.full_name ? escapeHtml(letter.hod.full_name) : null;
  const reviewUrl = `${origin}/faculty/review/${letter.id}`;

  const shell = (title: string, body: string, cta: string, href: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #000000; border-radius: 12px; background-color: #ffffff; color: #000000;">
      <h2 style="font-family: Georgia, serif; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-top: 0;">${title}</h2>
      ${body}
      <div style="margin: 25px 0;">
        <a href="${escapeHtml(href)}" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #000000; text-decoration: none; border: 2px solid #000000; border-radius: 8px; font-weight: bold; font-size: 14px;">${cta}</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #000000; margin: 20px 0;" />
      <p style="font-size: 10px; font-family: monospace; color: #555555;">JAM Platform • Campus Letter Automation</p>
    </div>
  `;

  if (type === 'new_request') {
    return {
      subject: safeSubject(
        `New Request: ${letterTypePlain} from ${studentNamePlain}`
      ),
      html: shell(
        'JAM Recommendation Request',
        `<p>Dear <strong>${mentorName}</strong>,</p>
         <p>Student <strong>${studentName}</strong> (${studentRoll}) has submitted a <strong>${letterType}</strong> for your review and recommendation.</p>
         <p>Please review the request, add feedback if required, and digitally approve or decline.</p>`,
        'Review &amp; Recommend',
        reviewUrl
      ),
    };
  }

  if (type === 'mentor_approved') {
    return {
      subject: safeSubject(
        `Final Approval: ${letterTypePlain} (Student: ${studentNamePlain})`
      ),
      html: shell(
        'JAM Final Signature Request',
        `<p>Dear <strong>${hodName || 'Head of the Department'}</strong>,</p>
         <p>A <strong>${letterType}</strong> submitted by <strong>${studentName}</strong> (${studentRoll}) has been recommended by Class Mentor <strong>${mentorName}</strong>.</p>
         <p>It is now awaiting your final approval and digital signature.</p>`,
        'Review &amp; Sign PDF',
        reviewUrl
      ),
    };
  }

  if (type === 'approval') {
    const signedBy = hodName
      ? `Class Mentor <strong>${mentorName}</strong> and HOD <strong>${hodName}</strong>`
      : `Class Mentor <strong>${mentorName}</strong>`;

    return {
      subject: safeSubject(`Approved & Signed: ${letterTypePlain}`),
      html: shell(
        'Request Approved!',
        `<p>Dear <strong>${studentName}</strong>,</p>
         <p>Your letter request for <strong>${letterType}</strong> has been approved and digitally signed by ${signedBy}.</p>
         <p>You can now download the signed PDF from your student dashboard.</p>`,
        'Download Document',
        `${origin}/student/dashboard`
      ),
    };
  }

  return {
    subject: safeSubject(`Declined: ${letterTypePlain} request`),
    html: shell(
      'Request Returned/Declined',
      `<p>Dear <strong>${studentName}</strong>,</p>
         <p>Your request for <strong>${letterType}</strong> has been reviewed and declined.</p>
         <p style="background-color: #fcfcfc; border: 1.5px solid #000000; padding: 12px; font-style: italic; border-radius: 8px;">
           <strong>Feedback:</strong> ${escapeHtml(letter.rejection_reason || 'No details provided')}
         </p>
         <p>You can review the request and submit a corrected letter from your student dashboard.</p>`,
      'View Dashboard',
      `${origin}/student/dashboard`
    ),
  };
}

export async function notifyLetterEvent({
  letterId,
  type,
  actorId,
  origin,
}: NotifyOptions): Promise<NotifyResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('letters')
      .select(`
        id,
        student_id,
        mentor_id,
        hod_id,
        faculty_id,
        status,
        rejection_reason,
        rejection_by,
        letter_types (name),
        student:student_id (full_name, roll_number),
        mentor:mentor_id (full_name),
        hod:hod_id (full_name)
      `)
      .eq('id', letterId)
      .single();

    if (error || !data) {
      logError('notifyLetterEvent.fetchLetter', error);
      return { success: false, error: 'Letter not found.' };
    }

    const letter = data as unknown as NotificationLetter;

    if (!actorCanTrigger(letter, type, actorId)) {
      return { success: false, error: 'This notification is not valid for the current letter state.' };
    }

    const recipientId = recipientFor(letter, type);
    if (!recipientId) {
      return { success: false, error: 'Notification recipient is not assigned.' };
    }

    const { data: recipient, error: recipientError } = await admin.auth.admin.getUserById(recipientId);
    if (recipientError || !recipient.user?.email) {
      logError('notifyLetterEvent.recipient', recipientError);
      return { success: false, error: 'Notification recipient email is not available.' };
    }

    const content = emailFor(letter, type, origin);

    const pushPayload = {
      new_request: {
        title: 'New Recommendation Request',
        body: `${letter.student?.full_name || 'A student'} submitted a ${letter.letter_types?.name || 'letter'} for review.`,
        url: `/faculty/review/${letter.id}`,
      },
      mentor_approved: {
        title: 'Final Signature Requested',
        body: `${letter.student?.full_name || 'A student'}'s letter is awaiting your final signature.`,
        url: `/faculty/review/${letter.id}`,
      },
      approval: {
        title: 'Letter Approved & Signed',
        body: `Your ${letter.letter_types?.name || 'letter'} is approved and ready to download.`,
        url: '/student/dashboard',
      },
      rejection: {
        title: 'Letter Request Returned',
        body: `Your ${letter.letter_types?.name || 'letter'} was declined. Please check the feedback.`,
        url: '/student/dashboard',
      },
    }[type];

    const [emailResult, pushResult] = await Promise.all([
      sendEmail({
        to: recipient.user.email,
        subject: content.subject,
        html: content.html,
      }),
      sendPushNotification(recipientId, {
        ...pushPayload,
        tag: `letter-${letter.id}`,
      }),
    ]);

    if (!emailResult.success) {
      return { success: false, error: emailResult.error || 'Failed to send notification email.' };
    }

    return { success: true, pushCount: pushResult.count };
  } catch (error) {
    logError('notifyLetterEvent', error);
    return { success: false, error: 'Failed to send notification.' };
  }
}
