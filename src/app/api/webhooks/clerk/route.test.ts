import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const state = vi.hoisted(() => ({
  ensureUserWorkspace: vi.fn<(userId: string) => Promise<{ id: string }>>(),
  verifyWebhook: vi.fn<
    (
      request: NextRequest,
      options: { signingSecret: string },
    ) => Promise<{
      data: { id: string };
      type: string;
    }>
  >(),
}));

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial webhook mock isolates signature verification.
vi.mock('@clerk/nextjs/webhooks', () => ({ verifyWebhook: state.verifyWebhook }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial provisioning mock isolates database writes.
vi.mock('@/features/workspaces/server/EnsureUserWorkspace', () => ({
  ensureUserWorkspace: state.ensureUserWorkspace,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial environment mock provides only the route dependency.
vi.mock('@/libs/Env', () => ({
  Env: { CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_test' },
}));

describe(POST, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ensureUserWorkspace.mockResolvedValue({ id: 'workspace_1' });
  });

  it('creates personal workspace for user creation event', async () => {
    state.verifyWebhook.mockResolvedValue({ data: { id: 'user_1' }, type: 'user.created' });
    const request = new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(state.verifyWebhook).toHaveBeenCalledWith(request, { signingSecret: 'whsec_test' });
    expect(state.ensureUserWorkspace).toHaveBeenCalledWith('user_1');
  });

  it('rejects invalid webhook signature', async () => {
    state.verifyWebhook.mockRejectedValue(new Error('Invalid signature'));
    const request = new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(state.ensureUserWorkspace).not.toHaveBeenCalled();
  });

  it('requests retry when provisioning fails', async () => {
    state.verifyWebhook.mockResolvedValue({ data: { id: 'user_1' }, type: 'user.created' });
    state.ensureUserWorkspace.mockRejectedValue(new Error('Database unavailable'));
    const request = new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' });

    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
