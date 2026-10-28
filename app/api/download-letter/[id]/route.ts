import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuth, getClientIp, jsonError, logError } from '@/lib/api';
import { downloadLetterLimiter } from '@/lib/rate-limit';
import { uuidSchema } from '@/lib/validation';

interface DownloadableLetter {
  status: string;
  student_id: string;
  faculty_id: string | null;
  mentor_id: string | null;
  hod_id: string | null;
  pdf_storage_path: string | null;
  reference_number: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idCheck = uuidSchema.safeParse(id);
    if (!idCheck.success) {
      return jsonError('Invalid letter ID.', 400);
    }

    const limit = await downloadLetterLimiter.limit(getClientIp(request));
    if (!limit.success) {
      return jsonError('Too many download attempts. Please wait a minute and try again.', 429);
    }

    const admin = createAdminClient();
    const { data: letterData, error: letterError } = await admin
      .from('letters')
      .select('status, student_id, faculty_id, mentor_id, hod_id, pdf_storage_path, reference_number')
      .eq('id', idCheck.data)
      .single();

    if (letterError || !letterData) {
      return jsonError('Letter not found.', 404);
    }

    const letter = letterData as unknown as DownloadableLetter;
    const isApproved = letter.status === 'approved';

    if (!isApproved) {
      const { user } = await getAuth();
      const isParticipant = Boolean(
        user &&
          (user.id === letter.student_id ||
            user.id === letter.faculty_id ||
            user.id === letter.mentor_id ||
            user.id === letter.hod_id)
      );

      if (!isParticipant) {
        return jsonError('You do not have permission to download this letter.', 403);
      }
    }

    if (!letter.pdf_storage_path) {
      return jsonError('This letter has not been signed yet.', 409);
    }

    // Defence in depth: the only valid storage path is the server-generated one.
    if (letter.pdf_storage_path !== `${idCheck.data}.pdf`) {
      logError('download-letter.invalidPath', new Error('Unexpected PDF storage path.'));
      return jsonError('This letter document is unavailable.', 409);
    }

    const safeFilename = letter.reference_number
      ? `${letter.reference_number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`
      : 'letter.pdf';

    const { data: signedUrlData, error: signedUrlError } = await admin.storage
      .from('letters')
      .createSignedUrl(letter.pdf_storage_path, 60, { download: safeFilename });

    if (signedUrlError || !signedUrlData?.signedUrl) {
      logError('download-letter.signedUrl', signedUrlError);
      return jsonError('Unable to prepare the download. Please try again.', 500);
    }

    return NextResponse.json(
      { signedUrl: signedUrlData.signedUrl },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    logError('download-letter', error);
    return jsonError('Unable to download the letter. Please try again.', 500);
  }
}
