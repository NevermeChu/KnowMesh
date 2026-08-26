import type { PGlite } from '@electric-sql/pglite';
import { makeSignature } from 'better-auth/crypto';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { getDocumentCollaborationIdentity as getCollaborationIdentityFunction } from '@/features/documents/collaboration/DocumentCollaborationAuthentication';
import type { auth as authInstance } from '@/libs/Auth';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

const CONTRACT_SECRET = 'contract-test-secret';
const CONTRACT_APP_URL = 'http://localhost:3000';

let database: PGlite;
let auth: typeof authInstance;
let getDocumentCollaborationIdentity: typeof getCollaborationIdentityFunction;

const verifiedUserId = 'user_contract_verified';
const unverifiedUserId = 'user_contract_unverified';
const sessionTokenByKind = {
  expired: 'contract-token-expired',
  revoked: 'contract-token-revoked',
  unverified: 'contract-token-unverified',
  valid: 'contract-token-valid',
} as const;

const buildSessionHeaders = async (token: string) => {
  const signedToken = `${token}.${await makeSignature(token, CONTRACT_SECRET)}`;
  return new Headers({ cookie: `better-auth.session_token=${signedToken}` });
};

const getMainSession = async (token: string) =>
  await auth.api.getSession({ headers: await buildSessionHeaders(token) });

beforeAll(async () => {
  database = createTestPGlite();
  await executeMigrations(database, migrationFiles);

  await database.transaction(async (transaction) => {
    await transaction.query(`
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES
        ('${verifiedUserId}', 'Contract Verified', 'contract_verified@example.com', true),
        ('${unverifiedUserId}', 'Contract Unverified', 'contract_unverified@example.com', false)
    `);
    for (const [kind, token] of Object.entries(sessionTokenByKind)) {
      if (kind === 'revoked') {
        continue;
      }
      const userId = kind === 'unverified' ? unverifiedUserId : verifiedUserId;
      const expiresAt =
        kind === 'expired' ? new Date(Date.now() - 60_000) : new Date(Date.now() + 3_600_000);
      await transaction.query(
        `
        INSERT INTO "session" (id, expires_at, token, user_id)
        VALUES ($1, $2, $3, $4)
      `,
        [`session-contract-${kind}`, expiresAt, token, userId],
      );
    }
  });

  const testDb = drizzle(database, { schema });
  vi.doMock('server-only', () => ({}));
  // The unit job runs without BETTER_AUTH_SECRET; a fixed test secret keeps Env validation self-contained.
  vi.doMock('@/libs/Env', () => ({
    Env: {
      BETTER_AUTH_SECRET: CONTRACT_SECRET,
      NODE_ENV: 'test',
      NEXT_PUBLIC_APP_URL: CONTRACT_APP_URL,
    },
  }));
  vi.doMock('@/libs/DB', () => ({ db: testDb }));

  ({ auth } = await import('@/libs/Auth'));
  ({ getDocumentCollaborationIdentity } =
    await import('@/features/documents/collaboration/DocumentCollaborationAuthentication'));
}, 30_000);

afterAll(async () => {
  vi.doUnmock('@/libs/DB');
  vi.doUnmock('@/libs/Env');
  vi.doUnmock('server-only');
  await database.close();
});

describe('better auth session contract', () => {
  it('resolves one consistent identity for a valid verified session on both ends', async () => {
    const token = sessionTokenByKind.valid;
    const mainSession = await getMainSession(token);
    const identity = await getDocumentCollaborationIdentity(await buildSessionHeaders(token));

    expect(mainSession?.session.id).toBe('session-contract-valid');
    expect(mainSession?.user.id).toBe(verifiedUserId);
    expect(identity).toStrictEqual({
      image: null,
      name: 'Contract Verified',
      sessionId: mainSession?.session.id,
      userId: verifiedUserId,
    });
  });

  it('rejects an expired session on both ends', async () => {
    const headers = await buildSessionHeaders(sessionTokenByKind.expired);

    expect(await getMainSession(sessionTokenByKind.expired)).toBeNull();
    expect(await getDocumentCollaborationIdentity(headers)).toBeNull();
  });

  it('rejects a revoked session on both ends', async () => {
    const headers = await buildSessionHeaders(sessionTokenByKind.revoked);

    expect(await getMainSession(sessionTokenByKind.revoked)).toBeNull();
    expect(await getDocumentCollaborationIdentity(headers)).toBeNull();
  });

  it('reads the unverified session on both ends while collaboration admits nobody', async () => {
    const token = sessionTokenByKind.unverified;
    const mainSession = await getMainSession(token);

    expect(mainSession?.user.id).toBe(unverifiedUserId);
    expect(mainSession?.user.emailVerified).toBe(false);
    expect(await getDocumentCollaborationIdentity(await buildSessionHeaders(token))).toBeNull();
  });
});
