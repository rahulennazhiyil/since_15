import { expect, test } from '@playwright/test';
import { startCamera, useFakeSegmenter, watchConsole } from './helpers';

test('custom filters: create, use in the booth, duplicate, delete, persist', async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await useFakeSegmenter(page);

  await page.goto('/filters');
  await expect(page.getByText('Nothing here yet')).toBeVisible();
  await page.click('a[href="/filters/new"]');
  await expect(page.locator('app-filter-editor-page .name input')).toBeVisible();

  const save = page.locator('app-filter-editor-page header button[appButton]');
  await expect(save).toBeDisabled();
  await page.fill('app-filter-editor-page .name input', 'Sunday Haze');
  await expect(save).toBeEnabled();

  const contrast = page.locator('app-slider', { hasText: 'Contrast' }).locator('input[type=range]');
  await contrast.fill('0.8');
  await expect(page.locator('app-slider', { hasText: 'Contrast' }).locator('output')).toHaveText('-20');

  await page.click('app-filter-editor-page app-segmented button:has-text("Effects")');
  await page.locator('app-slider', { hasText: 'Film grain' }).locator('input[type=range]').fill('0.3');
  await page.click('app-effects-panel [role=switch]');

  await page.click('app-filter-editor-page app-segmented button:has-text("Stickers")');
  await page.click('app-overlay-panel .tile[aria-label="Add ✨"]');
  await page.fill('app-overlay-panel input[type=text]', 'sunday');
  await page.click('app-overlay-panel form button[type=submit]');
  await expect(page.locator('app-overlay-canvas .hit')).toHaveCount(2);

  await page.click('button.use-camera');
  await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>('app-filter-preview video')?.videoWidth ?? 0) > 0);

  await save.click();
  await expect(page.locator('app-my-filters-page .item')).toHaveCount(1);
  await expect(page.locator('app-my-filters-page .item strong')).toHaveText('Sunday Haze');

  await page.goto('/booth');
  await startCamera(page);
  await page.click('app-filter-selector [appChip]:has-text("Mine")');
  await expect(page.locator('app-filter-selector .item[role=radio]')).toHaveText(['Sunday Haze']);
  await page.click('app-filter-selector .item[role=radio]:has-text("Sunday Haze")');
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>('app-camera-view video')!.style.filter)).toContain('contrast(0.8)');

  await page.goto('/filters');
  await page.click('a[aria-label="Duplicate"]');
  await expect(page.locator('app-filter-editor-page .name input')).toHaveValue('Sunday Haze copy');
  await save.click();
  await expect(page.locator('app-my-filters-page .item')).toHaveCount(2);
  await page.locator('button[aria-label="Delete"]').last().click();
  await page.click('dialog[open] button:has-text("Delete")');
  await expect(page.locator('app-my-filters-page .item')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('app-my-filters-page .item')).toHaveCount(1);

  expect(errors).toEqual([]);
});
