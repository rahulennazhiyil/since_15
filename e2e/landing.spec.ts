import { expect, test } from '@playwright/test';
import { watchConsole } from './helpers';

test.describe('landing and shell', () => {
  test('renders at phone width without horizontal scroll and with a clean console', async ({ page }) => {
    const errors: string[] = [];
    watchConsole(page, errors);
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Miles apart');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page).toHaveTitle(/A Photo Booth for People Miles Apart/);
    expect(errors).toEqual([]);
  });

  test('theme choice persists and is applied before first paint', async ({ page }) => {
    await page.goto('/');
    await page.click('button[aria-label="Settings"]');
    await page.click('app-theme-picker button:has-text("Night")');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset['theme'])).toBe('night');
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Set by the inline bootstrap script, before the app even loads.
    expect(await page.evaluate(() => document.documentElement.dataset['theme'])).toBe('night');
  });

  test('inner pages set their own titles and the unknown route is friendly', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveTitle('Privacy · since060815');
    await page.goto('/nowhere');
    await expect(page.locator('app-not-found')).toBeVisible();
  });
});
