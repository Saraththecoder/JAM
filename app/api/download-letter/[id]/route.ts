import { NextRequest, NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Letter ID is required' }, { status: 400 });
    }

    const supabase = await createClientServer();
    
    // 1. Get current logged-in user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Query the letter and verify the user is either the student or the faculty member
    const { data: letter, error: letterError } = await supabase
      .from('letters')
      .select('student_id, faculty_id, pdf_storage_path')
      .eq('id', id)
      .single();

    if (letterError || !letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    if (letter.student_id !== user.id && letter.faculty_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!letter.pdf_storage_path) {
      return NextResponse.json(
        { error: 'PDF file is not generated or signed yet.' },
        { status: 400 }
      );
    }

    // 3. Generate a signed read URL expiring in 60 seconds
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
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
