import { createAdminClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';
import { logError, type ProfileSummary } from '@/lib/api';
import {
  facultyEmailSchema,
  rollNumberSchema,
  type CreateUserInput,
} from '@/lib/validation';

export type ProvisionResult =
  | { success: true; user: { id: string; email: string } }
  | { success: false; error: string; status: number };

export async function provisionUser(
  input: CreateUserInput,
  hod: ProfileSummary
): Promise<ProvisionResult> {
  if (!hod.department_id) {
    return { success: false, error: 'Your account is not assigned to a department.', status: 403 };
  }

  const admin = createAdminClient();
  let finalEmail: string;
  let designation: string | null = null;
  let makeHod = false;

  if (input.role === 'student') {
    const roll = rollNumberSchema.safeParse(input.roll_number || '');
    if (!roll.success) {
      return { success: false, error: roll.error.issues[0]?.message || 'Invalid roll number.', status: 400 };
    }

    // The signup trigger derives the student's department from the roll
    // number. Verify that branch code belongs to the HOD's department before
    // creating the auth user.
    const branchCode = roll.data.substring(6, 8);
    const { data: mapping, error: mappingError } = await admin
      .from('department_codes')
      .select('department_id')
      .eq('branch_code', branchCode)
      .maybeSingle();

    if (mappingError) {
      logError('provisionUser.departmentMapping', mappingError);
      return { success: false, error: 'Unable to verify the student department.', status: 500 };
    }

    if (!mapping || mapping.department_id !== hod.department_id) {
      return {
        success: false,
        error: 'The roll number does not belong to your department.',
        status: 400,
      };
    }

    finalEmail = `${roll.data.toLowerCase()}@aits-tpt.edu.in`;
  } else {
    const email = facultyEmailSchema.safeParse(input.email || '');
    if (!email.success) {
      return { success: false, error: email.error.issues[0]?.message || 'Invalid faculty email.', status: 400 };
    }
    finalEmail = email.data;
    designation = input.designation?.trim() || 'Faculty';
    makeHod = input.is_hod === true;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: finalEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: input.role,
      full_name: input.full_name,
      department_id: hod.department_id,
      designation,
    },
    // app_metadata is writable only with the service-role key. The signup
    // trigger checks this marker, so an anon-key signUp cannot spoof it.
    app_metadata: {
      provisioned_by: 'admin',
    },
  });

  if (createError || !created.user) {
    logError('provisionUser.createUser', createError);
    const createErrorMessage = createError?.message?.toLowerCase() || '';
    const duplicate =
      createErrorMessage.includes('already') ||
      createErrorMessage.includes('duplicate') ||
      createErrorMessage.includes('unique');
    return {
      success: false,
      error: duplicate
        ? 'An account with this email or roll number already exists.'
        : 'Unable to create the account. Please verify the details and try again.',
      status: duplicate ? 409 : 500,
    };
  }

  if (input.role === 'faculty') {
    const { data: approvedProfile, error: profileError } = await admin
      .from('profiles')
      .update({ is_approved: true, is_hod: makeHod })
      .eq('id', created.user.id)
      .select('id')
      .maybeSingle();

    if (profileError || !approvedProfile) {
      logError('provisionUser.approveProfile', profileError);
      const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
      if (cleanupError) logError('provisionUser.cleanup', cleanupError);
      return {
        success: false,
        error: 'The account was created but could not be activated. Please try again.',
        status: 500,
      };
    }
  }

  await writeAuditLog({
    actorId: hod.id,
    action: 'user.created',
    metadata: {
      createdUserId: created.user.id,
      role: input.role,
      email: finalEmail,
    },
  });

  return {
    success: true,
    user: { id: created.user.id, email: created.user.email || finalEmail },
  };
}
