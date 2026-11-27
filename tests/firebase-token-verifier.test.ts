import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { verifyFirebaseIdToken } from '../firebase-token-verifier.ts';

test('verifies a signed Firebase ID token and rejects a tampered payload', async (t) => {
  const projectId = 'zuxrash-signature-test';
  const now = Math.floor(Date.now() / 1000);
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const certificate = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const originalFetch = globalThis.fetch;
  let certificateRequests = 0;

  globalThis.fetch = async () => {
    certificateRequests += 1;
    return new Response(JSON.stringify({ 'test-key': certificate }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    kid: 'test-key',
    typ: 'JWT',
  })).toString('base64url');
  const payload = {
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: 'test-user-123',
    email: 'test@example.com',
    iat: now,
    exp: now + 3600,
    auth_time: now - 30,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${header}.${encodedPayload}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  const validToken = `${signingInput}.${signature}`;

  assert.deepEqual(await verifyFirebaseIdToken(validToken, projectId), {
    uid: 'test-user-123',
    email: 'test@example.com',
  });
  assert.equal(certificateRequests, 1);

  const tamperedPayload = Buffer.from(JSON.stringify({
    ...payload,
    sub: 'different-user',
  })).toString('base64url');
  const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
  assert.equal(await verifyFirebaseIdToken(tamperedToken, projectId), null);

  const invalidAlgorithmHeader = Buffer.from(JSON.stringify({
    alg: 'none',
    kid: 'test-key',
  })).toString('base64url');
  assert.equal(
    await verifyFirebaseIdToken(`${invalidAlgorithmHeader}.${encodedPayload}.${signature}`, projectId),
    null,
  );
});
