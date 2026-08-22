import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test.describe('Authentication form before hydration', () => {
  test('submits credentials with POST without exposing them in the URL', async ({ page }) => {
    const email = 'hydration-check@example.com';
    const password = 'not-a-real-password';
    await page.goto('/sign-in');
    await page.getByLabel('邮箱').fill(email);
    await page.locator('#password').fill(password);

    const requestPromise = page.waitForRequest(
      (request) => request.isNavigationRequest() && request.method() === 'POST',
    );
    await page.getByRole('button', { name: '登录' }).click();
    const request = await requestPromise;

    expect(request.url()).not.toContain(email);
    expect(request.url()).not.toContain(password);
    expect(page.url()).not.toContain(email);
    expect(page.url()).not.toContain(password);
  });
});
