import { NextRequest, NextResponse } from 'next/server';
import { createClientServer, createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitCheck = rateLimit(ip, 10, 60 * 1000);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before performing delete operations.' },
        { status: 429 }
      );
    }

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

    // 3. Parse target userId
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID to delete is required' }, { status: 400 });
    }

    // 4. Double check that the target user belongs to the HOD's department
    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('id, department_id, role')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (targetProfile.department_id !== profile.department_id) {
      return NextResponse.json({ error: 'Cannot delete users from outside your department.' }, { status: 403 });
    }

    if (targetProfile.id === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    // 5. Delete user from Supabase Auth (cascades to profile)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Admin deleteUser error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete user.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unexpected admin delete-user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
