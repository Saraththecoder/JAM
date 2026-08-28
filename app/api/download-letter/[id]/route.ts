import { NextRequest, NextResponse } from 'next/server';
import { createClientServer, createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Letter ID is required' }, { status: 400 });
    }

    // 1. Rate Limiting Check
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitCheck = rateLimit(ip, 20, 60 * 1000); // 20 downloads per minute
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before downloading again.' },
        { status: 429 }
      );
    }

    // 2. Defensive Environment Variables Check
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing in environment variables. Please check your dashboard settings.' },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient();

    // 3. Query the letter status and storage path using admin client (bypasses RLS)
    const { data: letter, error: letterError } = await adminClient
      .from('letters')
      .select('status, student_id, faculty_id, mentor_id, hod_id, pdf_storage_path, reference_number')
      .eq('id', id)
      .single();

    if (letterError || !letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    // 4. Check authorization: public allowed if approved, otherwise must be participant
    const isApproved = letter.status === 'approved';
    let isParticipant = false;

    if (!isApproved) {
      // Only invoke cookie-dependent createClientServer if not approved to prevent static context issues
      try {
        const supabase = await createClientServer();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          isParticipant = 
            user.id === letter.student_id || 
            user.id === letter.faculty_id || 
            user.id === letter.mentor_id || 
            user.id === letter.hod_id;
        }
      } catch (authError) {
        console.error('Failed to resolve dynamic server session:', authError);
      }
    }

    if (!isApproved && !isParticipant) {
      return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
    }

    if (!letter.pdf_storage_path) {
      return NextResponse.json(
        { error: 'PDF file is not generated or signed yet.' },
        { status: 400 }
      );
    }

    // 5. Generate signed read URL expiring in 60 seconds (forcing direct attachment download)
    const safeFilename = letter.reference_number
      ? `${letter.reference_number.replace(/\//g, '_')}.pdf`
      : 'letter.pdf';

    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from('letters')
      .createSignedUrl(letter.pdf_storage_path, 60, {
        download: safeFilename
      });

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error generating signed URL:', signedUrlError);
      return NextResponse.json(
        { error: 'Failed to generate download URL from storage.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: signedUrlData.signedUrl });
  } catch (error: any) {
    console.error('Unexpected download-letter error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
