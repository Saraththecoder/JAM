import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, fileBase64, fileType } = await request.json();

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
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
