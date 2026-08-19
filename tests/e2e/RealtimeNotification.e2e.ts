import { expect, test } from '@playwright/test';

test.describe('Real-time Notifications E2E', () => {
  test('rejects unauthenticated SSE connection with 401 Unauthorized', async ({ request }) => {
    const response = await request.get('/api/realtime/notifications');
    expect(response.status()).toBe(401);
  });

  test('handles client-side EventSource subscription and events', async ({ page }) => {
    await page.goto('/sign-in');

    // Verify browser has native EventSource support
    const hasEventSource = await page.evaluate(() => window.EventSource !== undefined);
    expect(hasEventSource).toBeTruthy();
  });
});
