import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getAuth,
  getProfile,
  isApprovedFaculty,
  jsonError,
  logError,
  parseJson,
} from '@/lib/api';
import { uploadSignatureLimiter } from '@/lib/rate-limit';
import { signatureUploadSchema } from '@/lib/validation';
import { writeAuditLog } from '@/lib/audit';

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await uploadSignatureLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many signature uploads. Please wait a minute and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!isApprovedFaculty(profile)) {
      return jsonError('Only approved faculty members can upload signatures.', 403);
    }

    const parsed = await parseJson(request, signatureUploadSchema, 4 * 1024 * 1024);
    if (!parsed.ok) return parsed.response;

    const { userId, fileBase64, fileType } = parsed.data;
    if (userId !== user.id) {
      return jsonError('You can only upload your own signature.', 403);
    }

    const base64Data = fileBase64.replace(/^data:image\/(?:png|jpeg|jpg);base64,/, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
      return jsonError('The signature image is not valid base64 data.', 400);
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_SIGNATURE_BYTES) {
      return jsonError('The signature image must be smaller than 2 MB.', 400);
    }

    const isPngFile = fileType === 'image/png';
    const validMagic = isPngFile ? isPng(buffer) : isJpeg(buffer);
    if (!validMagic) {
      return jsonError('The uploaded file does not match its declared image type.', 400);
    }

    const extension = isPngFile ? 'png' : 'jpg';
    const storagePath = `${userId}/esign.${extension}`;
    const admin = createAdminClient();

    const { data: currentProfile } = await admin
      .from('profiles')
      .select('esign_storage_path')
      .eq('id', user.id)
      .single();

    const previousPath = (currentProfile as { esign_storage_path?: string | null } | null)
      ?.esign_storage_path;

    const { error: uploadError } = await admin.storage.from('signatures').upload(storagePath, buffer, {
      contentType: fileType,
      upsert: true,
    });

    if (uploadError) {
      logError('upload-signature.storage', uploadError);
      return jsonError('Unable to upload the signature. Please try again.', 500);
    }

    const { data: updatedProfile, error: profileError } = await admin
      .from('profiles')
      .update({ esign_storage_path: storagePath })
      .eq('id', user.id)
      .select('id')
      .maybeSingle();

    if (profileError || !updatedProfile) {
      logError('upload-signature.profile', profileError);
      if (previousPath !== storagePath) {
        await admin.storage.from('signatures').remove([storagePath]);
      }
      return jsonError('Unable to save the signature reference. Please try again.', 500);
    }

    if (previousPath && previousPath !== storagePath && previousPath.startsWith(`${user.id}/`)) {
      const { error: removeError } = await admin.storage.from('signatures').remove([previousPath]);
      if (removeError) logError('upload-signature.removeOld', removeError);
    }

    await writeAuditLog({
      actorId: user.id,
      action: 'signature.updated',
      metadata: { storagePath, fileType },
    });

    return NextResponse.json({ success: true, path: storagePath });
  } catch (error) {
    logError('upload-signature', error);
    return jsonError('Unable to upload the signature. Please try again.', 500);
  }
}
