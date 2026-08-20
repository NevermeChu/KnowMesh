import { describe, expect, it, vi } from 'vitest';
import type { db } from '@/libs/DB';
import { createNotification } from './CreateNotification';

vi.mock(import('server-only'), () => ({}));

type NotificationWriter = Pick<typeof db, 'insert'>;

describe(createNotification, () => {
  it('inserts notification without publishing before transaction commit', async () => {
    const fakeValues = vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
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
    expect(fakeValues).toHaveBeenCalledWith({
      actorUserId: 'actor-1',
      body: '张三 邀请你加入工作区。',
      recipientUserId: 'recipient-1',
      targetId: 'workspace-1',
      targetKind: 'workspace',
      title: '收到工作区邀请',
      type: 'workspace_invited',
    });
  });
});
