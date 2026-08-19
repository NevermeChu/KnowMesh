import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateDocument } from './UpdateDocument';

const state = vi.hoisted(() => {
  const returning = vi.fn<() => Promise<unknown[]>>();
  const where = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const set = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const update = vi.fn<() => { set: typeof set }>(() => ({ set }));
  const authorizeDocument = vi.fn<() => Promise<unknown>>();
  const requireUser = vi.fn<() => Promise<{ id: string }>>();
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return {
    authorizeDocument,
    requireUser,
    returning,
    revalidatePath,
    set,
    update,
    where,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial next/cache mock isolates layout revalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates user identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({
  requireUser: state.requireUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial authorization mock isolates permissions check.
vi.mock('@/features/permissions/server/DocumentAuthorization', () => ({
  authorizeDocument: state.authorizeDocument,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent query builders isolate database update.
vi.mock('@/libs/DB', () => ({
  db: { update: state.update },
}));

describe(updateDocument, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireUser.mockResolvedValue({ id: 'user_1' });
    state.authorizeDocument.mockResolvedValue({
      document: { id: '10000000-0000-4000-8000-000000000001', projectId: 'project_1' },
    });
    state.returning.mockResolvedValue([{ id: '10000000-0000-4000-8000-000000000001' }]);
  });

  it('updates document content without revalidating workspace layout', async () => {
    await updateDocument({
      content: { content: [{ type: 'paragraph' }], type: 'doc' },
      documentId: '10000000-0000-4000-8000-000000000001',
    });

    expect(state.update).toHaveBeenCalledOnce();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it('updates document title and revalidates workspace layout cache', async () => {
    await updateDocument({
      documentId: '10000000-0000-4000-8000-000000000001',
      title: '新文档标题',
    });

    expect(state.update).toHaveBeenCalledOnce();
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });
});
