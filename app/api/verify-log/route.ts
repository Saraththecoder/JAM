import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { letterId } = await request.json();

    if (!letterId) {
      return NextResponse.json({ error: 'letterId is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Extract client IP address safely from standard proxy headers
    let ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }
    
    // Hash IP address with SHA-256 to create a secure, uncrackable Node ID (e.g. Node #8F3D2A)
    const hash = createHash('sha256').update(ip).digest('hex');
    const nodeId = `Node #${hash.slice(0, 6).toUpperCase()}`;

    const userAgent = request.headers.get('user-agent') || 'Unknown Browser';

    // 1. Insert scan log
    const { error: insertError } = await adminClient
      .from('verification_scans')
      .insert({
        letter_id: letterId,
        ip_address: nodeId,
        user_agent: userAgent,
      });

    if (insertError) {
      console.error('Failed to log verification scan:', insertError);
    }

    // 2. Fetch total scan count
    const { count, error: countError } = await adminClient
      .from('verification_scans')
      .select('*', { count: 'exact', head: true })
      .eq('letter_id', letterId);

    if (countError) {
      console.error('Failed to count scans:', countError);
    }

    // 3. Fetch details of previous scans (limit to last 2, to find the second-to-last check)
    const { data: previousScans, error: fetchError } = await adminClient
      .from('verification_scans')
      .select('scanned_at, ip_address')
      .eq('letter_id', letterId)
      .order('scanned_at', { ascending: false })
      .limit(2);

    if (fetchError) {
      console.error('Failed to fetch previous scans:', fetchError);
    }

    const totalScans = count || 0;
    const lastScan = previousScans && previousScans.length > 1 ? previousScans[1] : null; // Previous scan (before current log)

    return NextResponse.json({
      success: true,
      totalScans,
      lastScan,
    });
  } catch (error: any) {
    console.error('Error in verify-log endpoint:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
