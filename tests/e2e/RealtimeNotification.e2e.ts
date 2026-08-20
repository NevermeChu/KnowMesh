import { expect, test } from '@playwright/test';

test.describe('Real-time Notifications E2E', () => {
  test('rejects unauthenticated SSE connection with 401 Unauthorized', async ({ request }) => {
    const response = await request.get('/api/realtime/notifications');
    expect(response.status()).toBe(401);
  });
});
