import { NextRequest, NextResponse } from 'next/server';
import { createClientServer, createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitCheck = rateLimit(ip, 10, 60 * 1000); // 10 uploads per minute
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before uploading your signature again.' },
        { status: 429 }
      );
    }

    const supabase = await createClientServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, fileBase64, fileType } = await request.json();

    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden: You can only upload your own signature.' }, { status: 403 });
    }

    if (!userId || !fileBase64 || !fileType) {
      return NextResponse.json(
        { error: 'userId, fileBase64, and fileType are required' },
        { status: 400 }
      );
    }

    // Clean up base64 string if it contains prefix
    const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Extract file extension
    let ext = 'png';
    if (fileType.includes('jpeg') || fileType.includes('jpg')) {
      ext = 'jpg';
    } else if (fileType.includes('svg')) {
      ext = 'svg';
    }

    const storagePath = `${userId}/esign.${ext}`;
    const adminClient = createAdminClient();

    // Verify user role is faculty
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile || profile.role !== 'faculty') {
      return NextResponse.json({ error: 'Forbidden: Only faculty can upload signatures.' }, { status: 403 });
    }

    // 1. Upload signature image to private storage bucket using admin client
    const { error: uploadError } = await adminClient.storage
      .from('signatures')
      .upload(storagePath, buffer, {
        contentType: fileType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Signature upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload e-signature: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 2. Update profiles table with the signature storage path
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ esign_storage_path: storagePath })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return NextResponse.json(
        { error: `Failed to update profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, path: storagePath });
  } catch (error: any) {
    console.error('Unexpected upload-signature error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
