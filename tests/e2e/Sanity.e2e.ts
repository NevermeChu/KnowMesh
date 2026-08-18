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

    test('accepts literal search metacharacters', async ({ page }) => {
      await page.goto('/');
      const searchInput = page.getByRole('textbox', { name: '搜索文档关键词' });

      await searchInput.fill('[');

      await expect(searchInput).toHaveValue('[');
      await expect(page.getByText('未找到与 “[” 相关的文档结果')).toBeVisible();
    });

    test('preserves native context menu', async ({ page }) => {
      await page.goto('/');

      const isPrevented = await page.evaluate(() => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(event);
        return event.defaultPrevented;
      });

      expect(isPrevented).toBeFalsy();
    });
  });

  test.describe('Protected pages', () => {
    test('redirects unauthenticated users to sign in', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page).toHaveURL(/\/sign-in/u);
    });
  });

  test.describe('Authentication pages', () => {
    test('displays the localized sign-in page', async ({ page }) => {
      await page.goto('/sign-in');

      await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
      const viewport = await page.evaluate(() => ({
        height: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        width: window.innerWidth,
      }));

      expect(viewport.scrollHeight).toBe(viewport.height);
      expect(viewport.scrollWidth).toBe(viewport.width);
    });

    test('displays the localized sign-up page', async ({ page }) => {
      await page.goto('/sign-up');

      await expect(page.getByRole('heading', { name: '创建账号' })).toBeVisible();
    });

    test('preserves invitation destination when opening sign up', async ({ page }) => {
      await page.goto('/sign-in?redirect_url=%2Finvitations%2Faccept%3Ftoken%3Dinvitation-token');

      await expect(page.getByRole('link', { name: '立即注册' })).toHaveAttribute(
        'href',
        '/sign-up?redirect_url=%2Finvitations%2Faccept%3Ftoken%3Dinvitation-token',
      );
    });
  });

  test.describe('Unsupported routes', () => {
    test('returns not found for a missing route', async ({ page }) => {
      const response = await page.goto('/missing');

      expect(response?.status()).toBe(404);
    });
  });
});
