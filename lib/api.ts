import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { ZodType } from 'zod';
import { createAdminClient, createClientServer } from '@/lib/supabase/server';
import { getConfiguredAppUrl } from '@/lib/app-url';

type ServerClient = Awaited<ReturnType<typeof createClientServer>>;

export interface AuthContext {
  user: User | null;
  supabase: ServerClient;
}

export interface ProfileSummary {
  id: string;
  role: 'student' | 'faculty';
  full_name: string;
  is_approved: boolean;
  is_hod: boolean;
  designation: string | null;
  department_id: string | null;
}

export async function getAuth(): Promise<AuthContext> {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}

export async function getProfile(userId: string): Promise<ProfileSummary | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('id, role, full_name, is_approved, is_hod, designation, department_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    logError('getProfile', error);
    return null;
  }

  return data as ProfileSummary;
}

export function isHod(profile: ProfileSummary | null): profile is ProfileSummary {
  return Boolean(profile && profile.role === 'faculty' && profile.is_approved && profile.is_hod);
}

export function isApprovedFaculty(profile: ProfileSummary | null): profile is ProfileSummary {
  return Boolean(profile && profile.role === 'faculty' && profile.is_approved);
}

export function getClientIp(request: NextRequest): string {
  // On Vercel x-real-ip is set by the platform. X-Forwarded-For is only used
  // as a fallback and the first hop is the best available approximation.
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  const firstHop = forwarded?.split(',')[0]?.trim();
  return firstHop || '127.0.0.1';
}

export function getAppUrl(request?: NextRequest): string {
  const configured = getConfiguredAppUrl();
  if (configured) return configured;
  if (request) return request.nextUrl.origin.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function parseJson<T>(
  request: NextRequest,
  schema: ZodType<T>,
  maxBytes = 1_000_000
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, response: jsonError('Request body is too large.', 413) };
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
      return { ok: false, response: jsonError('Request body is too large.', 413) };
    }
    body = JSON.parse(raw);
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body.', 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      response: jsonError(firstIssue?.message || 'Invalid request payload.', 400),
    };
  }

  return { ok: true, data: parsed.data };
}

export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    JSON.stringify({
      level: 'error',
      context,
      message,
      stack,
      timestamp: new Date().toISOString(),
    })
  );
}

export function logInfo(context: string, data: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      level: 'info',
      context,
      ...data,
      timestamp: new Date().toISOString(),
    })
  );
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
