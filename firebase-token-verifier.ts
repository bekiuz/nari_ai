import { createVerify } from 'node:crypto';
import {
  validateFirebaseTokenClaims,
  type FirebaseTokenClaims,
} from './firebase-token-claims.ts';

type FirebaseTokenHeader = {
  alg?: unknown;
  kid?: unknown;
};

type FirebaseTokenPayload = FirebaseTokenClaims & {
  email?: unknown;
};

type GoogleCertificateCache = {
  certificates: Record<string, string>;
  expiresAt: number;
};

let certificateCache: GoogleCertificateCache | null = null;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

async function getGoogleCertificates(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();

  if (!forceRefresh && certificateCache && certificateCache.expiresAt > now) {
    return certificateCache.certificates;
  }

  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  );
  if (!response.ok) {
    throw new Error(`Google certificate request failed with HTTP ${response.status}.`);
  }

  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Google returned an invalid certificate response.');
  }

  const certificates = body as Record<string, string>;
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAge ? Number(maxAge[1]) : 3600;

  certificateCache = {
    certificates,
    expiresAt: now + Math.max(60, Math.min(maxAgeSeconds, 86400)) * 1000,
  };

  return certificates;
}

/**
 * Verify a Firebase Authentication ID token using Google's rotating public
 * certificates, then validate the project-bound Firebase token claims.
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
): Promise<{ uid: string; email?: string } | null> {
  if (!token || token.length > 8192 || !projectId) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[2]) return null;

    const header = JSON.parse(decodeBase64Url(parts[0])) as FirebaseTokenHeader;
    const payload = JSON.parse(decodeBase64Url(parts[1])) as FirebaseTokenPayload;

    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
      return null;
    }

    if (!validateFirebaseTokenClaims(payload, projectId)) return null;

    let certificates = await getGoogleCertificates();
    let certificate = certificates[header.kid];

    if (!certificate) {
      certificates = await getGoogleCertificates(true);
      certificate = certificates[header.kid];
    }

    if (typeof certificate !== 'string' || !certificate) return null;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();

    const normalizedSignature = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const signature = Buffer.from(normalizedSignature, 'base64');
    if (!verifier.verify(certificate, signature)) return null;

    return {
      uid: payload.sub,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
    };
  } catch {
    return null;
  }
}
