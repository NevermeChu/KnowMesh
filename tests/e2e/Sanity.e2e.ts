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

    test('accepts literal search metacharacters', async ({ page }) => {
      await page.goto('/');
      const searchInput = page.getByRole('textbox', { name: '搜索文档关键词' });

      await searchInput.fill('[');

      await expect(searchInput).toHaveValue('[');
      await expect(page.getByText('未找到与 “[” 相关的文档结果')).toBeVisible();
    });
  });

  test.describe('Protected pages', () => {
    test('redirects unauthenticated users to sign in', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page).toHaveURL(/\/sign-in/u);
    });
  });

  test.describe('Authentication pages', () => {
    test('preserves invitation destination when opening sign up', async ({ page }) => {
      await page.goto('/sign-in?redirect_url=%2Finvitations%2Faccept%3Ftoken%3Dinvitation-token');

      await expect(page.getByRole('link', { name: '立即注册' })).toHaveAttribute(
        'href',
        '/sign-up?redirect_url=%2Finvitations%2Faccept%3Ftoken%3Dinvitation-token',
      );
    });
  });
});
