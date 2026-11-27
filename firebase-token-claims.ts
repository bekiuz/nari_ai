export type FirebaseTokenClaims = {
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  sub?: unknown;
  auth_time?: unknown;
};

/**
 * Validate the standard claims required on Firebase Authentication ID tokens.
 * Signature verification is performed separately by the caller.
 */
export function validateFirebaseTokenClaims(
  payload: FirebaseTokenClaims,
  projectId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!projectId || !Number.isSafeInteger(nowSeconds)) return false;

  if (payload.aud !== projectId) return false;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return false;

  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
    return false;
  }

  const { exp, iat, auth_time: authTime } = payload;
  if (
    typeof exp !== 'number' ||
    !Number.isSafeInteger(exp) ||
    typeof iat !== 'number' ||
    !Number.isSafeInteger(iat) ||
    typeof authTime !== 'number' ||
    !Number.isSafeInteger(authTime)
  ) {
    return false;
  }

  if (exp <= nowSeconds || iat > nowSeconds + 300 || authTime > nowSeconds + 300) {
    return false;
  }

  // Firebase ID tokens are short-lived (at most one hour).
  if (exp <= iat || exp - iat > 3600) return false;

  // Authentication must not occur after token issuance/expiry, allowing
  // a small clock-skew tolerance for distributed Google infrastructure.
  if (authTime > iat + 300 || authTime > exp) return false;

  return true;
}
