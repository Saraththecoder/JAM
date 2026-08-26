interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  // Mock email delivery by logging details to server console
  console.log('==================================================');
  console.log(`[EMAIL MOCK] Sending email to: ${to}`);
  console.log(`[EMAIL MOCK] Subject: ${subject}`);
  console.log(`[EMAIL MOCK] Content:\n${html.replace(/<[^>]*>/g, '')}`); // Strip simple HTML tags for clean log
  console.log('==================================================');

  return { success: true, id: `mock-msg-${Date.now()}`, error: undefined };
}

