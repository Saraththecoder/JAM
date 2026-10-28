import { NextResponse } from 'next/server';
import checkedInAssetLinks from '../../../android/assetlinks.json';

export const dynamic = 'force-dynamic';

const DEFAULT_PACKAGE_NAME = 'com.aits.jam';
const FINGERPRINT_PATTERN = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/;

interface AssetLinkStatement {
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

const fallbackStatement = (checkedInAssetLinks as AssetLinkStatement[])[0];

/**
 * Digital Asset Links for the Android Trusted Web Activity.
 *
 * `ANDROID_PACKAGE_NAME` and `ANDROID_SHA256_CERT_FINGERPRINTS` override the
 * checked-in `android/assetlinks.json`. The checked-in fallback lets local APK
 * testing work before the Play App Signing certificate is available; add the
 * Play App Signing SHA-256 fingerprint after the first Play Console upload.
 */
export function GET() {
  const environmentFingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const useEnvironment = environmentFingerprints.length > 0;
  const packageName = useEnvironment
    ? process.env.ANDROID_PACKAGE_NAME?.trim() || DEFAULT_PACKAGE_NAME
    : fallbackStatement?.target.package_name || DEFAULT_PACKAGE_NAME;
  const fingerprints = useEnvironment
    ? environmentFingerprints
    : (fallbackStatement?.target.sha256_cert_fingerprints || []).map((value) =>
        value.trim().toUpperCase()
      );

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
