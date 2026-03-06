import { expect, test } from '@playwright/test';

test.describe('Simulate Trip Page', () => {
  test('renders operator controls', async ({ page }) => {
    await page.goto('/simulate-trip');

    await expect(page.getByRole('heading', { name: 'Simulate Client Trip Request' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Random Cars In Bulk' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Request + Auto Assign Closest Idle Car' })).toBeVisible();
  });

  test('adds random vehicles in bulk', async ({ page }) => {
    await page.route('**/api/vehicles/bulk-random', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, added: 12, vehicleIds: ['VEH-100'] }),
      });
    });

    await page.goto('/simulate-trip');
    await page.locator('input[type="number"]').first().fill('12');
    await page.getByRole('button', { name: 'Add Random Cars In Bulk' }).click();

    await expect(page.getByText('12 random cars added to fleet.')).toBeVisible();
  });

  test('creates customer trip and shows auto-assignment feedback', async ({ page }) => {
    await page.route('**/api/trips/generate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          autoAssigned: true,
          vehicleId: 'VEH-007',
          trip: { tripId: 'TRIP-1' },
        }),
      });
    });

    await page.goto('/simulate-trip');
    await page.locator('select').nth(0).selectOption('Bellagio Hotel');
    await page.locator('select').nth(1).selectOption('Wynn Las Vegas');
    await page.getByRole('button', { name: 'Create Request + Auto Assign Closest Idle Car' }).click();

    await expect(page.getByText('Trip created. Closest idle vehicle VEH-007 auto-assigned.')).toBeVisible();
  });
});
