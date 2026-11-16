import { expect, test } from '@playwright/test';
import { BUILDS, inScope } from './scope';

// M3d task 1: each build loads and shows the header and the build switch,
// which keeps the page's settings.
for (const build of inScope(BUILDS)) {
  test(`${build}: shows the header and the build switch`, async ({ page }) => {
    await page.goto(`/${build}/?rate=2&seed=3`);
    await expect(page.locator('h1')).toHaveText('Plant 1');
    await expect(page.locator('.build')).toHaveAttribute('data-build', build);
    // The line under the header says what runs where, and what a block takes down.
    await expect(page.locator('.page > .description')).toContainText('A blocked widget stalls');
    // The kernel switch goes to the other side; the build group lists this
    // side's builds.
    const side = build === 'isoloop' ? ['isoloop'] : ['native', 'native-workers'];
    const kernel = page.getByRole('navigation', { name: 'Kernel' });
    await expect(kernel.locator('[aria-current="page"]')).toHaveText(
      build === 'isoloop' ? 'Isoloop' : 'Native',
    );
    await expect(
      kernel.locator(`a[href="../${build === 'isoloop' ? 'native' : 'isoloop'}/?rate=2&seed=3"]`),
    ).toHaveCount(1);
    const nav = page.getByRole('navigation', { name: 'Builds' });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await Promise.all(
      side
        .filter((b) => b !== build)
        .map((other) => expect(nav.locator(`a[href="../${other}/?rate=2&seed=3"]`)).toHaveCount(1)),
    );
    await expect(
      page.getByRole('navigation', { name: 'Vibration rate' }).locator('[aria-current]'),
    ).toHaveText('2 kHz');
    // Placement is an Isoloop setting.
    await expect(page.getByRole('navigation', { name: 'Placement' })).toHaveCount(
      build === 'isoloop' ? 1 : 0,
    );
  });
}

test('the build switch goes to the other build with the same settings', async ({ page }) => {
  await page.goto('/isoloop/?rate=5');
  await page.getByRole('navigation', { name: 'Kernel' }).getByText('Native').click();
  await expect(page).toHaveURL(/\/native\/\?rate=5$/);
  await page.getByRole('navigation', { name: 'Builds' }).getByText('React + workers').click();
  await expect(page).toHaveURL(/\/native-workers\/\?rate=5$/);
  await expect(page.locator('.build')).toHaveAttribute('data-build', 'native-workers');
});

test('the placement switch marks the current placement', async ({ page }) => {
  await page.goto('/isoloop/?placement=machine');
  await expect(
    page.getByRole('navigation', { name: 'Placement' }).locator('[aria-current]'),
  ).toHaveText('machine');
});
