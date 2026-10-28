import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_PACKAGE_NAME = 'com.aits.jam';
const FINGERPRINT_PATTERN = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/;

/**
 * Digital Asset Links for the Android Trusted Web Activity.
 *
 * Set ANDROID_PACKAGE_NAME and ANDROID_SHA256_CERT_FINGERPRINTS in the hosting
 * provider. Include the Play App Signing certificate fingerprint after the
 * first upload, and the upload-key fingerprint when testing a locally built APK.
 */
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || DEFAULT_PACKAGE_NAME;
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (fingerprints.length === 0 || fingerprints.some((value) => !FINGERPRINT_PATTERN.test(value))) {
    return NextResponse.json(
      { error: 'Android signing certificate fingerprints are not configured.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'application/json',
      },
    }
  );
}
