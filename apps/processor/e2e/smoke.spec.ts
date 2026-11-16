import { expect, test } from '@playwright/test';

// Against the deployed copy (LIVE_URL, after each deploy): both pages start
// and do work.
test('the playground runs a task', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('li[data-task="task-1"]')).toHaveAttribute('data-state', 'running', {
    timeout: 15_000,
  });
});

test('the File processor processes files', async ({ page }) => {
  await page.goto('./files/');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId('rate')).not.toHaveText('0.0', { timeout: 15_000 });
});
