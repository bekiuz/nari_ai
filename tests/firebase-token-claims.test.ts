import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFirebaseTokenClaims } from '../firebase-token-claims.ts';

const now = 1_800_000_000;
const projectId = 'zuxrash-test-project';

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: 'test-user-123',
    iat: now,
    exp: now + 3600,
    auth_time: now - 60,
    ...overrides,
  };
}

test('accepts a valid Firebase ID token claim set', () => {
  assert.equal(validateFirebaseTokenClaims(validClaims(), projectId, now), true);
});

test('rejects a missing authentication time', () => {
  const claims = validClaims();
  delete (claims as Record<string, unknown>).auth_time;
  assert.equal(validateFirebaseTokenClaims(claims, projectId, now), false);
});

test('rejects the wrong audience or issuer', () => {
  assert.equal(validateFirebaseTokenClaims(validClaims({ aud: 'other-project' }), projectId, now), false);
  assert.equal(validateFirebaseTokenClaims(validClaims({ iss: 'https://example.com' }), projectId, now), false);
});

test('rejects expired tokens and future-issued tokens', () => {
  assert.equal(validateFirebaseTokenClaims(validClaims({ exp: now }), projectId, now), false);
  assert.equal(validateFirebaseTokenClaims(validClaims({ iat: now + 301, exp: now + 3600 }), projectId, now), false);
});

test('rejects malformed subjects and non-integer timestamps', () => {
  assert.equal(validateFirebaseTokenClaims(validClaims({ sub: '' }), projectId, now), false);
  assert.equal(validateFirebaseTokenClaims(validClaims({ exp: String(now + 3600) }), projectId, now), false);
});

test('rejects token lifetimes longer than one hour', () => {
  assert.equal(validateFirebaseTokenClaims(validClaims({ exp: now + 3601 }), projectId, now), false);
});

test('rejects authentication timestamps after issuance or expiry', () => {
  assert.equal(
    validateFirebaseTokenClaims(validClaims({ iat: now - 600, auth_time: now - 200 }), projectId, now),
    false,
  );
  assert.equal(
    validateFirebaseTokenClaims(validClaims({ exp: now + 100, auth_time: now + 101 }), projectId, now),
    false,
  );
});
