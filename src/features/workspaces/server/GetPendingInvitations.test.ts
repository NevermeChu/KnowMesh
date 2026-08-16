import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPendingInvitations } from './GetPendingInvitations';

vi.mock(import('server-only'), () => ({}));

const state = vi.hoisted(() => {
  const invitation = {
    expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    workspaceName: '团队空间',
  };
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const currentUser = vi.fn<() => Promise<unknown>>();
  const and = vi.fn<(...conditions: unknown[]) => unknown[]>((...conditions) => conditions);
  const desc = vi.fn<(column: unknown) => unknown>((column) => column);
  const eq = vi.fn<
    (column: unknown, value: unknown) => { column: unknown; operation: string; value: unknown }
  >((column, value) => ({ column, operation: 'eq', value }));
  const gt = vi.fn<(column: unknown, value: unknown) => unknown>((column) => column);
  const inArray = vi.fn<(column: unknown, values: unknown[]) => unknown>((column) => column);
  const isNull = vi.fn<(column: unknown) => unknown>((column) => column);
  const sql = vi.fn<(chunks: TemplateStringsArray, ...values: unknown[]) => unknown>((chunks) =>
    chunks.join(''),
  );
  const limit = vi.fn<(count: number) => Promise<(typeof invitation)[]>>(async () => {
    await Promise.resolve();
    return [invitation];
  });
  const orderBy = vi.fn<(column: unknown) => { limit: typeof limit }>(() => ({ limit }));
  const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
  const innerJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
    where,
  }));
  const from = vi.fn<(table: unknown) => { innerJoin: typeof innerJoin }>(() => ({ innerJoin }));
  const select = vi.fn<(selection: unknown) => { from: typeof from }>(() => ({ from }));

  return { and, currentUser, desc, eq, from, gt, inArray, isNull, protect, select, sql };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication and user lookup.
vi.mock('@clerk/nextjs/server', () => ({
  auth: { protect: state.protect },
  currentUser: state.currentUser,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Query operators are inspected as test values.
vi.mock('drizzle-orm', () => ({
  and: state.and,
  desc: state.desc,
  eq: state.eq,
  gt: state.gt,
  inArray: state.inArray,
  isNull: state.isNull,
  sql: state.sql,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates select behavior.
vi.mock('@/libs/DB', () => ({ db: { select: state.select } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Column markers make ownership assertions explicit.
vi.mock('@/models/Schema', () => ({
  workspaceInvitationsSchema: {
    acceptedById: 'workspace_invitations.acceptedById',
    createdAt: 'workspace_invitations.createdAt',
    email: 'workspace_invitations.email',
    expiresAt: 'workspace_invitations.expiresAt',
    revokedAt: 'workspace_invitations.revokedAt',
    workspaceId: 'workspace_invitations.workspaceId',
  },
  workspacesSchema: { id: 'workspaces.id', name: 'workspaces.name' },
}));

const createUser = (emails: { emailAddress: string; verified: boolean }[]) => ({
  emailAddresses: emails.map((entry, index) => ({
    emailAddress: entry.emailAddress,
    id: `email_${index}`,
    verification: entry.verified ? { status: 'verified' } : null,
  })),
});

describe(getPendingInvitations, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_reader' });
  });

  it('skips the database query without verified emails', async () => {
    state.currentUser.mockResolvedValue(createUser([{ emailAddress: 'a@b.c', verified: false }]));

    await expect(getPendingInvitations()).resolves.toStrictEqual([]);

    expect(state.from).not.toHaveBeenCalled();
  });

  it('queries invitations matching verified emails', async () => {
    state.currentUser.mockResolvedValue(
      createUser([
        { emailAddress: 'Reader@KnowMesh.dev', verified: true },
        { emailAddress: 'other@knowmesh.dev', verified: false },
      ]),
    );

    await expect(getPendingInvitations()).resolves.toHaveLength(1);

    expect(state.inArray).toHaveBeenCalledWith('lower()', ['reader@knowmesh.dev']);
  });
});
