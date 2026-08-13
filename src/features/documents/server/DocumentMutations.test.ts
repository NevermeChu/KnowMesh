import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentContent } from '../Document';
import { createDocument } from './CreateDocument';
import { updateDocument } from './UpdateDocument';

const state = vi.hoisted(() => {
  const document = {
    id: '01987654-3210-7000-8000-000000000002',
    projectId: '01987654-3210-7000-8000-000000000001',
    title: '无标题',
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();
  const authorizeProject = vi.fn<() => Promise<{ project: { id: string } }>>();
  const authorizeDocument = vi.fn<() => Promise<{ document: { id: string; projectId: string } }>>();
  const createReturning = vi.fn<() => Promise<(typeof document)[]>>();
  const createValues = vi.fn<(values: unknown) => { returning: typeof createReturning }>(() => ({
    returning: createReturning,
  }));
  const insert = vi.fn<(table: unknown) => { values: typeof createValues }>(() => ({
    values: createValues,
  }));
  const updateReturning = vi.fn<() => Promise<{ id: string; updatedAt: Date }[]>>();
  const where = vi.fn<(condition: unknown) => { returning: typeof updateReturning }>(() => ({
    returning: updateReturning,
  }));
  const set = vi.fn<(values: unknown) => { where: typeof where }>(() => ({ where }));
  const update = vi.fn<(table: unknown) => { set: typeof set }>(() => ({ set }));

  return {
    authorizeDocument,
    authorizeProject,
    createReturning,
    createValues,
    document,
    insert,
    protect,
    revalidatePath,
    set,
    update,
    updateReturning,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates mutation behavior.
vi.mock('@/libs/DB', () => ({ db: { insert: state.insert, update: state.update } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization policy is tested independently.
vi.mock('@/features/permissions/server/ProjectAuthorization', () => ({
  authorizeProject: state.authorizeProject,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Authorization policy is tested independently.
vi.mock('@/features/permissions/server/DocumentAuthorization', () => ({
  authorizeDocument: state.authorizeDocument,
}));

describe('document mutation actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.authorizeProject.mockResolvedValue({ project: { id: state.document.projectId } });
    state.authorizeDocument.mockResolvedValue({
      document: { id: state.document.id, projectId: state.document.projectId },
    });
    state.createReturning.mockResolvedValue([state.document]);
    state.updateReturning.mockResolvedValue([{ id: state.document.id, updatedAt: new Date() }]);
  });

  it('creates document in editable project', async () => {
    await expect(
      createDocument({ projectId: state.document.projectId, title: state.document.title }),
    ).resolves.toStrictEqual(state.document);

    expect(state.createValues).toHaveBeenCalledWith({
      createdById: 'user_1',
      projectId: state.document.projectId,
      title: '无标题',
    });
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects unauthorized creation before persistence', async () => {
    state.authorizeProject.mockRejectedValueOnce(new Error('没有权限执行该操作'));

    await expect(
      createDocument({ projectId: state.document.projectId, title: state.document.title }),
    ).rejects.toThrow('没有权限执行该操作');
    expect(state.insert).not.toHaveBeenCalled();
  });

  it('updates document title and content', async () => {
    const content: DocumentContent = { content: [{ type: 'paragraph' }], type: 'doc' };

    await updateDocument({ content, documentId: state.document.id, title: '  产品方案  ' });

    expect(state.set).toHaveBeenCalledWith(
      expect.objectContaining({ content, title: '产品方案', updatedAt: expect.any(Date) }),
    );
  });

  it('rejects unauthorized update before persistence', async () => {
    state.authorizeDocument.mockRejectedValueOnce(new Error('没有权限执行该操作'));

    await expect(
      updateDocument({ documentId: state.document.id, title: '产品方案' }),
    ).rejects.toThrow('没有权限执行该操作');
    expect(state.update).not.toHaveBeenCalled();
  });
});
