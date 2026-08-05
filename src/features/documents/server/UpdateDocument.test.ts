import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentContent } from '../Document';
import { updateDocument } from './UpdateDocument';

const state = vi.hoisted(() => {
  const documentId = '01987654-3210-7000-8000-000000000002';
  const projectId = '01987654-3210-7000-8000-000000000001';
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const getDocumentAccess =
    vi.fn<
      (options: {
        documentId: string;
        userId: string;
      }) => Promise<{ projectId: string; role: string } | undefined>
    >();
  const returning = vi.fn<() => Promise<{ id: string; updatedAt: Date }[]>>();
  const where = vi.fn<(condition: unknown) => { returning: typeof returning }>(() => ({
    returning,
  }));
  const set = vi.fn<(values: unknown) => { where: typeof where }>(() => ({ where }));
  const update = vi.fn<(table: unknown) => { set: typeof set }>(() => ({ set }));

  return { documentId, getDocumentAccess, projectId, protect, returning, set, update };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { update: state.update },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The mock isolates resource authorization from action persistence.
vi.mock('./DocumentAccess', () => ({
  getDocumentAccess: state.getDocumentAccess,
}));

describe('document update action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.getDocumentAccess.mockResolvedValue({ projectId: state.projectId, role: 'editor' });
    state.returning.mockResolvedValue([{ id: state.documentId, updatedAt: new Date() }]);
  });

  it('updates title with document membership', async () => {
    await updateDocument({ documentId: state.documentId, title: '  产品方案  ' });

    expect(state.getDocumentAccess).toHaveBeenCalledWith({
      documentId: state.documentId,
      userId: 'user_1',
    });
    expect(state.set).toHaveBeenCalledWith(
      expect.objectContaining({ title: '产品方案', updatedAt: expect.any(Date) }),
    );
  });

  it('updates ProseMirror content', async () => {
    const content: DocumentContent = { content: [{ type: 'paragraph' }], type: 'doc' };

    await updateDocument({ content, documentId: state.documentId });

    expect(state.set).toHaveBeenCalledWith(
      expect.objectContaining({ content, updatedAt: expect.any(Date) }),
    );
  });

  it('rejects viewer update', async () => {
    state.getDocumentAccess.mockResolvedValueOnce({ projectId: state.projectId, role: 'viewer' });

    await expect(
      updateDocument({ documentId: state.documentId, title: '产品方案' }),
    ).rejects.toThrow('没有权限编辑该文档');
    expect(state.update).not.toHaveBeenCalled();
  });
});
