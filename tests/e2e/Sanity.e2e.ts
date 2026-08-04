import { expect, test } from '@playwright/test';

test.describe('Sanity', () => {
  test.describe('Public pages', () => {
    test('displays the current homepage', async ({ page }) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', {
          name: /让知识有序/u,
        }),
      ).toBeVisible();
      await expect(page.getByText('为团队打造的知识工作空间')).toBeVisible();
      await expect(page.getByRole('link', { name: '开始使用' })).toHaveAttribute(
        'href',
        '/sign-in',
      );
    });

    test('publishes the homepage in the sitemap', async ({ baseURL, request }) => {
      const response = await request.get('/sitemap.xml');
      const sitemap = await response.text();

      expect(response.ok()).toBeTruthy();
      expect(sitemap).toContain(`<loc>${baseURL}</loc>`);
      expect(sitemap).not.toContain('/counter');
      expect(sitemap).not.toContain('/sign-in');
    });
  });

  test.describe('Protected pages', () => {
    test('redirects unauthenticated users to sign in', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page).toHaveURL(/\/sign-in/u);
    });
  });

  test.describe('Authentication pages', () => {
    test('displays the English sign-in page', async ({ page }) => {
      await page.goto('/sign-in');

      await expect(page.getByText('Email address')).toBeVisible();
    });

    test('displays the English sign-up page', async ({ page }) => {
      await page.goto('/sign-up');

      await expect(page.getByText('Create your account')).toBeVisible();
    });
  });

  test.describe('Unsupported routes', () => {
    test('returns not found for a missing route', async ({ page }) => {
      const response = await page.goto('/missing');

      expect(response?.status()).toBe(404);
    });
  });
});
