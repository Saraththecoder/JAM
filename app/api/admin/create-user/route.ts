import { NextRequest, NextResponse } from 'next/server';
import { createClientServer, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientServer();
    const adminClient = createAdminClient();

    // 1. Get current logged-in user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch profile and verify HOD status
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, designation, department_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isHod = profile.role === 'faculty' && (
      profile.designation?.toLowerCase().includes('hod') ||
      profile.designation?.toLowerCase().includes('head')
    );

    if (!isHod) {
      return NextResponse.json({ error: 'Only the Head of the Department (HOD) can manage department credentials.' }, { status: 403 });
    }

    // 3. Parse input variables
    const { role, full_name, roll_number, email, password, designation } = await request.json();

    if (!role || !full_name || !password) {
      return NextResponse.json({ error: 'Missing required fields (role, full_name, password)' }, { status: 400 });
    }

    let finalEmail = '';
    let userMetadata: any = {
      role,
      full_name,
      department_id: profile.department_id,
    };

    if (role === 'student') {
      if (!roll_number) {
        return NextResponse.json({ error: 'Student roll number is required' }, { status: 400 });
      }
      // Standardize email: roll_no@aits-tpt.edu.in
      finalEmail = `${roll_number.trim().toLowerCase()}@aits-tpt.edu.in`;
    } else if (role === 'faculty') {
      if (!email) {
        return NextResponse.json({ error: 'Faculty email address is required' }, { status: 400 });
      }
      finalEmail = email.trim().toLowerCase();
      userMetadata.designation = designation || 'Faculty';
    } else {
      return NextResponse.json({ error: 'Invalid user role' }, { status: 400 });
    }

    // 4. Create user in Supabase Auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: finalEmail,
      password: password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (createError || !newUser.user) {
      console.error('Admin createUser error:', createError);
      return NextResponse.json({ error: createError?.message || 'Failed to create auth user.' }, { status: 500 });
    }

    // 5. If role is faculty, update profile row to be approved immediately
    if (role === 'faculty') {
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', newUser.user.id);

      if (updateError) {
        console.error('Admin approve profile error:', updateError);
      }
    }

    return NextResponse.json({ success: true, user: newUser.user });
  } catch (error: any) {
    console.error('Unexpected admin create-user error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
