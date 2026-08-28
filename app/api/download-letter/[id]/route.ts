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

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitCheck = rateLimit(ip, 20, 60 * 1000); // 20 downloads per minute
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before downloading again.' },
        { status: 429 }
      );
    }

    const supabase = await createClientServer();
    const adminClient = createAdminClient();
    
    // 1. Get current logged-in user (optional)
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Query the letter using admin client to read status and storage path
    const { data: letter, error: letterError } = await adminClient
      .from('letters')
      .select('status, student_id, faculty_id, mentor_id, hod_id, pdf_storage_path')
      .eq('id', id)
      .single();

    if (letterError || !letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    // 3. Check authorization: public allowed if approved, otherwise must be student, mentor, HOD, or original recipient
    const isApproved = letter.status === 'approved';
    const isParticipant = user && (
      user.id === letter.student_id || 
      user.id === letter.faculty_id || 
      user.id === letter.mentor_id || 
      user.id === letter.hod_id
    );

    if (!isApproved && !isParticipant) {
      return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
    }

    if (!letter.pdf_storage_path) {
      return NextResponse.json(
        { error: 'PDF file is not generated or signed yet.' },
        { status: 400 }
      );
    }

    // 4. Generate a signed read URL expiring in 60 seconds using the admin client
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from('letters')
      .createSignedUrl(letter.pdf_storage_path, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error generating signed URL:', signedUrlError);
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
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

