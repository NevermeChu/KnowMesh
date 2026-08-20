import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const statementBreakpoint = '--> statement-breakpoint';
let database: PGlite;

async function executeMigration(fileName: string) {
  const sql = await readFile(resolve('migrations', fileName), 'utf-8');

  for (const statement of sql.split(statementBreakpoint)) {
    if (statement.trim()) {
      await database.exec(statement);
    }
  }
}

describe('notification realtime database delivery', () => {
  beforeAll(async () => {
    database = new PGlite();
    await executeMigration('0011_add-notifications.sql');
    await executeMigration('0021_notification_realtime_delivery.sql');
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('delivers notification signal after insert commits', async () => {
    const signals: string[] = [];
    const unlisten = await database.listen('knowmesh_notifications', (payload) => {
      signals.push(payload);
    });

    const result = await database.query<{ id: string }>(`
      INSERT INTO notifications (recipient_user_id, type, title, body)
      VALUES ('user_recipient', 'workspace_access_approved', '权限已通过', '你已获得权限。')
      RETURNING id
    `);
    expect(JSON.parse(signals[0] ?? '')).toStrictEqual({
      kind: 'new',
      notificationId: result.rows[0]?.id,
      recipientUserId: 'user_recipient',
    });
    await unlisten();
  });

  it('does not deliver notification signal after transaction rolls back', async () => {
    const signals: string[] = [];
    const unlisten = await database.listen('knowmesh_notifications', (payload) => {
      signals.push(payload);
    });

    await expect(
      database.transaction(async (transaction) => {
        await transaction.query(`
          INSERT INTO notifications (recipient_user_id, type, title, body)
          VALUES ('user_rollback', 'workspace_access_approved', '权限已通过', '不会提交。')
        `);
        throw new Error('ROLLBACK_TEST');
      }),
    ).rejects.toThrow('ROLLBACK_TEST');

    expect(signals).toHaveLength(0);
    const result = await database.query<{ value: number }>(`
      SELECT count(*)::int AS value
      FROM notifications
      WHERE recipient_user_id = 'user_rollback'
    `);
    expect(result.rows).toStrictEqual([{ value: 0 }]);
    await unlisten();
  });
});
