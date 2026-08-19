import { describe, expect, it, vi } from 'vitest';
import type { db } from '@/libs/DB';
import { createNotification } from './CreateNotification';
import { notificationBroadcaster } from './NotificationBroadcaster';

vi.mock(import('server-only'), () => ({}));

type NotificationWriter = Pick<typeof db, 'insert'>;

describe(createNotification, () => {
  it('inserts notification and broadcasts notification:new event to recipient', async () => {
    const publishSpy = vi.spyOn(notificationBroadcaster, 'publish');
    const mockCreatedAt = new Date('2026-08-19T10:00:00.000Z');

    const fakeReturning = vi
      .fn<() => Promise<{ createdAt: Date; id: string }[]>>()
      .mockResolvedValue([
        {
          createdAt: mockCreatedAt,
          id: 'notif-123',
        },
      ]);
    const fakeValues = vi.fn<() => { returning: typeof fakeReturning }>().mockReturnValue({
      returning: fakeReturning,
    });
    const fakeInsert = vi.fn<() => { values: typeof fakeValues }>().mockReturnValue({
      values: fakeValues,
    });

    const fakeDatabase: NotificationWriter = {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Mock insert satisfies Pick<typeof db, 'insert'> for testing.
      insert: fakeInsert as unknown as typeof db.insert,
    };

    await createNotification(fakeDatabase, {
      actorUserId: 'actor-1',
      body: '张三 邀请你加入工作区。',
      recipientUserId: 'recipient-1',
      target: { id: 'workspace-1', kind: 'workspace' },
      title: '收到工作区邀请',
      type: 'workspace_invited',
    });

    expect(fakeInsert).toHaveBeenCalledOnce();
    expect(publishSpy).toHaveBeenCalledWith('recipient-1', {
      payload: {
        notification: {
          body: '张三 邀请你加入工作区。',
          createdAt: mockCreatedAt.toISOString(),
          id: 'notif-123',
          readAt: null,
          targetId: 'workspace-1',
          targetKind: 'workspace',
          title: '收到工作区邀请',
          type: 'workspace_invited',
        },
      },
      type: 'notification:new',
    });

    publishSpy.mockRestore();
  });
});
