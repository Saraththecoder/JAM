import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuth, getProfile, isHod, jsonError, logError, parseJson } from '@/lib/api';
import { deleteUserLimiter } from '@/lib/rate-limit';
import { deleteUserSchema } from '@/lib/validation';
import { writeAuditLog } from '@/lib/audit';

interface TargetProfile {
  id: string;
  role: 'student' | 'faculty';
  department_id: string | null;
  is_hod: boolean;
  esign_storage_path: string | null;
}

interface TargetLetter {
  id: string;
  pdf_storage_path: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await deleteUserLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many delete requests. Please wait a minute and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!isHod(profile)) {
      return jsonError('Only an approved HOD can manage department accounts.', 403);
    }

    const parsed = await parseJson(request, deleteUserSchema);
    if (!parsed.ok) return parsed.response;

    const targetId = parsed.data.userId;
    if (targetId === user.id) {
      return jsonError('You cannot delete your own account.', 400);
    }

    const admin = createAdminClient();
    const { data: targetData, error: targetError } = await admin
      .from('profiles')
      .select('id, role, department_id, is_hod, esign_storage_path')
      .eq('id', targetId)
      .single();

    if (targetError || !targetData) {
      return jsonError('User profile not found.', 404);
    }

    const target = targetData as unknown as TargetProfile;
    if (target.department_id !== profile.department_id) {
      return jsonError('You cannot delete users from outside your department.', 403);
    }

    if (target.is_hod) {
      const { count, error: countError } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('department_id', target.department_id)
        .eq('is_hod', true)
        .eq('is_approved', true)
        .neq('id', target.id);

      if (countError) {
        logError('admin.delete-user.countHods', countError);
        return jsonError('Unable to verify the department HOD coverage.', 500);
      }

      if ((count ?? 0) === 0) {
        return jsonError(
          'This is the last approved HOD in the department. Assign another HOD before deleting this account.',
          400
        );
      }
    }

    const letterPdfs: string[] = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data: targetLetters, error: lettersError } = await admin
        .from('letters')
        .select('id, pdf_storage_path')
        .or(`student_id.eq.${target.id},faculty_id.eq.${target.id}`)
        .order('id')
        .range(from, from + pageSize - 1);

      if (lettersError) {
        logError('admin.delete-user.letters', lettersError);
        break;
      }

      const page = (targetLetters as TargetLetter[] | null) ?? [];
      letterPdfs.push(
        ...page
          .map((letter) => letter.pdf_storage_path)
          .filter((value): value is string => Boolean(value))
      );

      if (page.length < pageSize) break;
      from += pageSize;
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(target.id);
    if (deleteError) {
      logError('admin.delete-user.auth', deleteError);
      return jsonError('Unable to delete the account. Please try again.', 500);
    }

    // Storage cleanup happens after the account is gone. A failed cleanup
    // leaves an orphaned private object rather than deleting a live user's
    // documents before the account deletion succeeds.
    for (let index = 0; index < letterPdfs.length; index += 100) {
      const { error: removeLettersError } = await admin.storage
        .from('letters')
        .remove(letterPdfs.slice(index, index + 100));
      if (removeLettersError) logError('admin.delete-user.removeLetters', removeLettersError);
    }

    if (target.esign_storage_path?.startsWith(`${target.id}/`)) {
      const { error: removeSignatureError } = await admin.storage
        .from('signatures')
        .remove([target.esign_storage_path]);
      if (removeSignatureError) logError('admin.delete-user.removeSignature', removeSignatureError);
    }

    await writeAuditLog({
      actorId: user.id,
      action: 'user.deleted',
      metadata: {
        targetUserId: target.id,
        targetRole: target.role,
        targetWasHod: target.is_hod,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('admin.delete-user', error);
    return jsonError('Unable to delete the account. Please try again.', 500);
  }
}
