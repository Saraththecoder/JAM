import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { letterId, type, rejectionReason } = await request.json();

    if (!letterId || !type) {
      return NextResponse.json({ error: 'letterId and type are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Retrieve the letter details and all multi-stage relations in one select
    const { data: letter, error: letterError } = await adminClient
      .from('letters')
      .select(`
        id,
        student_id,
        mentor_id,
        hod_id,
        rejection_by,
        letter_types (name),
        student:student_id (full_name, roll_number),
        mentor:mentor_id (full_name),
        hod:hod_id (full_name),
        rejector:rejection_by (full_name)
      `)
      .eq('id', letterId)
      .single();

    if (letterError || !letter) {
      console.error('Notification error: letter not found', letterError);
      return NextResponse.json({ error: 'Letter request not found' }, { status: 404 });
    }

    const castLetter = letter as any;
    const origin = request.nextUrl.origin || 'http://localhost:3000';
    const letterTypeName = castLetter.letter_types?.name || 'Academic Letter';
    const studentName = castLetter.student?.full_name || 'Student';
    const studentRoll = castLetter.student?.roll_number || 'N/A';

    // 2. Route notification scenarios
    if (type === 'new_request') {
      // Stage 1: Notify the Class Mentor
      if (!castLetter.mentor_id) {
        return NextResponse.json({ error: 'Mentor ID not set on letter' }, { status: 400 });
      }

      const { data: mentorUser, error: authError } = await adminClient.auth.admin.getUserById(castLetter.mentor_id);
      if (authError || !mentorUser?.user?.email) {
        console.error('Could not fetch mentor email from Auth:', authError);
        return NextResponse.json({ error: 'Mentor email not found in auth' }, { status: 404 });
      }

      const emailResult = await sendEmail({
        to: mentorUser.user.email,
        subject: `New Request: ${letterTypeName} from ${studentName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #000000; border-radius: 12px; background-color: #ffffff; color: #000000;">
            <h2 style="font-family: Georgia, serif; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-top: 0;">JAM Recommendation Request</h2>
            <p>Dear <strong>${castLetter.mentor.full_name}</strong>,</p>
            <p>Student <strong>${studentName}</strong> (${studentRoll}) from the AI&ML department has submitted a <strong>${letterTypeName}</strong> for your review and recommendation.</p>
            <p>Please click the button below to review the request details, add inline feedback if required, and digitally approve or decline.</p>
            <div style="margin: 25px 0;">
              <a href="${origin}/faculty/review/${letterId}" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #000000; text-decoration: none; border: 2px solid #000000; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 2px 2px 0px 0px #000000;">Review & Recommend</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #000000; margin: 20px 0;" />
            <p style="font-size: 10px; font-family: monospace; color: #555555;">JAM Platform • AI&ML Department Letter Automation</p>
          </div>
        `,
      });

      return NextResponse.json({ success: emailResult.success, error: emailResult.error });

    } else if (type === 'mentor_approved') {
      // Stage 2: Mentor recommended, notify the HOD for final signature
      if (!castLetter.hod_id) {
        return NextResponse.json({ error: 'HOD ID not set on letter' }, { status: 400 });
      }

      const { data: hodUser, error: authError } = await adminClient.auth.admin.getUserById(castLetter.hod_id);
      if (authError || !hodUser?.user?.email) {
        console.error('Could not fetch HOD email from Auth:', authError);
        return NextResponse.json({ error: 'HOD email not found in auth' }, { status: 404 });
      }

      const emailResult = await sendEmail({
        to: hodUser.user.email,
        subject: `Final Approval: ${letterTypeName} (Student: ${studentName})`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #000000; border-radius: 12px; background-color: #ffffff; color: #000000;">
            <h2 style="font-family: Georgia, serif; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-top: 0;">JAM Final Signature Request</h2>
            <p>Dear <strong>${castLetter.hod.full_name}</strong>,</p>
            <p>A <strong>${letterTypeName}</strong> submitted by <strong>${studentName}</strong> (${studentRoll}) has been reviewed and **recommended** by Class Mentor <strong>${castLetter.mentor.full_name}</strong>.</p>
            <p>It is now awaiting your final approval and digital signature stamp.</p>
            <div style="margin: 25px 0;">
              <a href="${origin}/faculty/review/${letterId}" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #000000; text-decoration: none; border: 2px solid #000000; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 2px 2px 0px 0px #000000;">Review & Sign PDF</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #000000; margin: 20px 0;" />
            <p style="font-size: 10px; font-family: monospace; color: #555555;">JAM Platform • AI&ML Department Letter Automation</p>
          </div>
        `,
      });

      return NextResponse.json({ success: emailResult.success, error: emailResult.error });

    } else if (type === 'approval') {
      // Stage 3: HOD approved & PDF generated. Notify the student.
      const { data: studentUser, error: authError } = await adminClient.auth.admin.getUserById(castLetter.student_id);
      if (authError || !studentUser?.user?.email) {
        console.error('Could not fetch student email from Auth:', authError);
        return NextResponse.json({ error: 'Student email not found in auth' }, { status: 404 });
      }

      const emailResult = await sendEmail({
        to: studentUser.user.email,
        subject: `Approved & Signed: ${letterTypeName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #000000; border-radius: 12px; background-color: #ffffff; color: #000000;">
            <h2 style="font-family: Georgia, serif; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-top: 0;">Request Approved!</h2>
            <p>Dear <strong>${studentName}</strong>,</p>
            <p>Your letter request for <strong>${letterTypeName}</strong> has been approved and digitally signed by Class Mentor <strong>${castLetter.mentor.full_name}</strong> and HOD <strong>${castLetter.hod.full_name}</strong>.</p>
            <p>You can now download the signed, official PDF document containing security verification seals directly from your student panel.</p>
            <div style="margin: 25px 0;">
              <a href="${origin}/student/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #000000; text-decoration: none; border: 2px solid #000000; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 2px 2px 0px 0px #000000;">Download Document</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #000000; margin: 20px 0;" />
            <p style="font-size: 10px; font-family: monospace; color: #555555;">JAM Platform • AI&ML Department Letter Automation</p>
          </div>
        `,
      });

      return NextResponse.json({ success: emailResult.success, error: emailResult.error });

    } else if (type === 'rejection') {
      // Stage 4: Declined. Notify the student.
      const { data: studentUser, error: authError } = await adminClient.auth.admin.getUserById(castLetter.student_id);
      if (authError || !studentUser?.user?.email) {
        console.error('Could not fetch student email from Auth:', authError);
        return NextResponse.json({ error: 'Student email not found in auth' }, { status: 404 });
      }

      const rejectorName = castLetter.rejector?.full_name || 'Faculty Reviewer';

      const emailResult = await sendEmail({
        to: studentUser.user.email,
        subject: `Declined: ${letterTypeName} request`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #000000; border-radius: 12px; background-color: #ffffff; color: #000000;">
            <h2 style="font-family: Georgia, serif; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-top: 0;">Request Returned/Declined</h2>
            <p>Dear <strong>${studentName}</strong>,</p>
            <p>Your request for <strong>${letterTypeName}</strong> has been reviewed and declined by <strong>${rejectorName}</strong>.</p>
            <p style="background-color: #fcfcfc; border: 1.5px solid #000000; padding: 12px; font-style: italic; border-radius: 8px; box-shadow: 2px 2px 0px 0px #000000; margin: 15px 0;">
              "<strong>Feedback Reason:</strong> ${rejectionReason || 'No details provided'}"
            </p>
            <p>You can review this request details or submit a corrected letter form directly on your student dashboard.</p>
            <div style="margin: 25px 0;">
              <a href="${origin}/student/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #000000; text-decoration: none; border: 2px solid #000000; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 2px 2px 0px 0px #000000;">View Dashboard</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #000000; margin: 20px 0;" />
            <p style="font-size: 10px; font-family: monospace; color: #555555;">JAM Platform • AI&ML Department Letter Automation</p>
          </div>
        `,
      });

      return NextResponse.json({ success: emailResult.success, error: emailResult.error });
    }

    return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
  } catch (error: any) {
    console.error('Unexpected notify API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
