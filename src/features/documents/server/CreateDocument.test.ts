import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from './CreateDocument';

const state = vi.hoisted(() => {
  const document = {
    id: '01987654-3210-7000-8000-000000000002',
    projectId: '01987654-3210-7000-8000-000000000001',
    title: '无标题',
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();
  const getProjectAccess =
    vi.fn<(options: { projectId: string; userId: string }) => Promise<{ role: string } | null>>();
  const returning = vi.fn<() => Promise<(typeof document)[]>>();
  const values = vi.fn<(values: unknown) => { returning: typeof returning }>(() => ({ returning }));
  const insert = vi.fn<(table: unknown) => { values: typeof values }>(() => ({ values }));

  return { document, getProjectAccess, insert, protect, revalidatePath, returning, values };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock intentionally omits Clerk's unrelated exports.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates the database boundary.
vi.mock('@/libs/DB', () => ({
  db: { insert: state.insert },
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The partial runtime mock isolates cache invalidation.
vi.mock('next/cache', () => ({
  revalidatePath: state.revalidatePath,
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- The mock isolates resource authorization from action persistence.
vi.mock('./DocumentAccess', () => ({
  getProjectAccess: state.getProjectAccess,
}));

describe('document creation action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_1' });
    state.getProjectAccess.mockResolvedValue({ role: 'owner' });
    state.returning.mockResolvedValue([state.document]);
  });

  it('creates document in editable project', async () => {
    await expect(
      createDocument({ projectId: state.document.projectId, title: state.document.title }),
    ).resolves.toStrictEqual(state.document);

    expect(state.getProjectAccess).toHaveBeenCalledWith({
      projectId: state.document.projectId,
      userId: 'user_1',
    });
    expect(state.values).toHaveBeenCalledWith({
      createdById: 'user_1',
      projectId: state.document.projectId,
      title: '无标题',
    });
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects viewer creation', async () => {
    state.getProjectAccess.mockResolvedValueOnce({ role: 'viewer' });

    await expect(
      createDocument({ projectId: state.document.projectId, title: state.document.title }),
    ).rejects.toThrow('没有权限在该项目中创建文档');
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects inaccessible project', async () => {
    state.getProjectAccess.mockResolvedValueOnce(null);

    await expect(
      createDocument({ projectId: state.document.projectId, title: state.document.title }),
    ).rejects.toThrow('没有权限在该项目中创建文档');
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });
});
