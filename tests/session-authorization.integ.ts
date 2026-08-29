import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { isSessionActive as isSessionActiveFunction } from '@/features/auth/server/SessionAuthorization';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let isSessionActive: typeof isSessionActiveFunction;

describe('session authorization', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
    await database.transaction(async (transaction) => {
      await transaction.query(`
        INSERT INTO "user" (id, name, email, email_verified)
        VALUES
          ('session_verified', 'Verified User', 'session_verified@example.com', true),
          ('session_other', 'Other User', 'session_other@example.com', true),
          ('session_unverified', 'Unverified User', 'session_unverified@example.com', false)
      `);
      await transaction.query(`
        INSERT INTO "session" (id, expires_at, token, user_id)
        VALUES
          ('active_session', now() + interval '1 day', 'active-token', 'session_verified'),
          ('expired_session', now() - interval '1 day', 'expired-token', 'session_verified'),
          ('unverified_session', now() + interval '1 day', 'unverified-token', 'session_unverified')
      `);
    });

    const testDb = drizzle(database, { schema });
    vi.doMock('@/libs/DB', () => ({ db: testDb }));
    ({ isSessionActive } = await import('@/features/auth/server/SessionAuthorization'));
  }, 30_000);

  afterAll(async () => {
    vi.doUnmock('@/libs/DB');
    await database.close();
  });

  it('accepts unexpired session for verified user', async () => {
    await expect(
      isSessionActive({ sessionId: 'active_session', userId: 'session_verified' }),
    ).resolves.toBe(true);
  });

  it('rejects expired session', async () => {
    await expect(
      isSessionActive({ sessionId: 'expired_session', userId: 'session_verified' }),
    ).resolves.toBe(false);
  });

  it('rejects session for unverified user', async () => {
    await expect(
      isSessionActive({ sessionId: 'unverified_session', userId: 'session_unverified' }),
    ).resolves.toBe(false);
  });

  it('rejects session and user mismatch', async () => {
    await expect(
      isSessionActive({ sessionId: 'active_session', userId: 'session_other' }),
    ).resolves.toBe(false);
  });
});
