import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from '../app/.well-known/assetlinks.json/route';

const FINGERPRINT = Array.from({ length: 32 }, () => 'AA').join(':');

describe('Android asset links', () => {
  const originalPackage = process.env.ANDROID_PACKAGE_NAME;
  const originalFingerprints = process.env.ANDROID_SHA256_CERT_FINGERPRINTS;

  beforeEach(() => {
    delete process.env.ANDROID_PACKAGE_NAME;
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
  });

  afterEach(() => {
    if (originalPackage === undefined) delete process.env.ANDROID_PACKAGE_NAME;
    else process.env.ANDROID_PACKAGE_NAME = originalPackage;
    if (originalFingerprints === undefined) delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
    else process.env.ANDROID_SHA256_CERT_FINGERPRINTS = originalFingerprints;
  });

  it('returns a configuration error until fingerprints are set', async () => {
    const response = GET();
    expect(response.status).toBe(503);
  });

  it('returns a valid Digital Asset Links statement', async () => {
    process.env.ANDROID_PACKAGE_NAME = 'com.aits.jam';
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = FINGERPRINT.toLowerCase();

    const response = GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{
      relation: string[];
      target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
    }>;
    expect(body).toHaveLength(1);
    expect(body[0].relation).toContain('delegate_permission/common.handle_all_urls');
    expect(body[0].target.package_name).toBe('com.aits.jam');
    expect(body[0].target.sha256_cert_fingerprints).toEqual([FINGERPRINT]);
  });
});
