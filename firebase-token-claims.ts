export type FirebaseTokenClaims = {
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  sub?: unknown;
  auth_time?: unknown;
};

export type ValidFirebaseTokenClaims = FirebaseTokenClaims & {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  auth_time: number;
};

/**
 * Validate the standard claims required on Firebase Authentication ID tokens.
 * The caller must still verify the JWT signature against Google's public keys.
 */
export function validateFirebaseTokenClaims(
  payload: FirebaseTokenClaims,
  projectId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): payload is ValidFirebaseTokenClaims {
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

  if (exp <= iat || exp - iat > 3600) return false;
  if (authTime > iat + 300 || authTime > exp) return false;

  return true;
}
