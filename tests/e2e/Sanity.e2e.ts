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
  });

  test.describe('Protected pages', () => {
    test('redirects unauthenticated users to sign in', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page).toHaveURL(/\/sign-in/u);
    });
  });
});
