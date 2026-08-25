import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPGlite, executeMigrations } from './helpers/PGliteMigrations';

let database: PGlite;

describe('notification realtime database delivery', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, [
      '0011_add-notifications.sql',
      '0017_late_dakota_north.sql',
      '0021_notification_realtime_delivery.sql',
      '0028_blushing_moonstone.sql',
    ]);
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

  it('delivers count signal after notification deletion', async () => {
    await database.query(`
      INSERT INTO notifications (recipient_user_id, type, title, body)
      VALUES ('user_deleted_notification', 'workspace_access_approved', '权限已通过', '待删除通知。')
    `);
    const signals: string[] = [];
    const unlisten = await database.listen('knowmesh_notifications', (payload) => {
      signals.push(payload);
    });

    await database.query(`
      DELETE FROM notifications
      WHERE recipient_user_id = 'user_deleted_notification'
    `);

    expect(JSON.parse(signals[0] ?? '')).toStrictEqual({
      kind: 'count',
      recipientUserId: 'user_deleted_notification',
    });
    await unlisten();
  });

  it('rejects duplicate workspace invitation notifications', async () => {
    await database.query(`
      INSERT INTO notifications (
        recipient_user_id,
        type,
        title,
        body,
        target_kind,
        target_id
      )
      VALUES (
        'user_invited_once',
        'workspace_invited',
        '收到工作区邀请',
        '邀请通知。',
        'workspace',
        '10000000-0000-4000-8000-000000000001'
      )
    `);

    await expect(
      database.query(`
        INSERT INTO notifications (
          recipient_user_id,
          type,
          title,
          body,
          target_kind,
          target_id
        )
        VALUES (
          'user_invited_once',
          'workspace_invited',
          '收到工作区邀请',
          '重复邀请通知。',
          'workspace',
          '10000000-0000-4000-8000-000000000001'
        )
      `),
    ).rejects.toThrow();
  });
});
