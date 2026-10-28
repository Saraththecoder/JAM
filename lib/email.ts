import { Resend } from 'resend';
import { logError, logInfo } from '@/lib/api';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<EmailResult> {
  const resend = getResend();

  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      logError('sendEmail', new Error('RESEND_API_KEY is not configured.'));
      return { success: false, error: 'Email service is not configured.' };
    }

    logInfo('email.dev_mock', { to, subject });
    return { success: true, id: `dev-msg-${Date.now()}` };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'JAM <no-reply@aits-tpt.edu.in>',
      to,
      subject,
      html,
    });

    if (error) {
      logError('sendEmail.resend', error);
      return { success: false, error: 'Failed to send email.' };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    logError('sendEmail', error);
    return { success: false, error: 'Failed to send email.' };
  }
}
