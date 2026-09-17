import { expect, test, type Page } from '@playwright/test';
import { createRoom, joinRoom, waitForDataChannel, watchConsole } from './helpers';

async function openActivity(page: Page, name: string, selector: string): Promise<void> {
  await page.click('button[aria-label="Activities"]');
  await page.locator('dialog[open] app-activity-host').waitFor();
  const back = page.locator('dialog[open] app-activity-host button[aria-label="All activities"]');
  if (await back.count()) await back.click();
  await page.click(`dialog[open] app-activity-host .tile:has-text("${name}")`);
  // Activities load lazily; wait for the component so messages are not sent into the void.
  await page.locator(selector).first().waitFor();
}

async function closeSheet(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

test('activities are shared live between the two people', async ({ page: host, context }) => {
  const errors: string[] = [];
  watchConsole(host, errors, 'host');
  const code = await createRoom(host);
  const guest = await joinRoom(context, code);
  watchConsole(guest, errors, 'guest');
  await waitForDataChannel(host);
  await waitForDataChannel(guest);

  // Same question card
  await openActivity(host, 'Question cards', 'app-question-cards');
  await openActivity(guest, 'Question cards', 'app-question-cards');
  const before = await host.locator('app-question-cards .eyebrow').innerText();
  await host.click('app-question-cards button:has-text("Next card")');
  await expect(host.locator('app-question-cards .eyebrow')).not.toHaveText(before);
  const after = await host.locator('app-question-cards .eyebrow').innerText();
  // innerText on both sides: the label is upper-cased by CSS.
  await expect.poll(() => guest.locator('app-question-cards .eyebrow').innerText()).toBe(after);
  await closeSheet(host);
  await closeSheet(guest);

  // This or that reveals when both picked
  await openActivity(host, 'This or that', 'app-two-choices .choice');
  await openActivity(guest, 'This or that', 'app-two-choices .choice');
  await host.click('app-two-choices .choice >> nth=0');
  await guest.click('app-two-choices .choice >> nth=1');
  await expect(host.locator('app-two-choices .status')).toContainText('Different');
  await expect(guest.locator('app-two-choices .status')).toContainText('Different');
  await closeSheet(host);
  await closeSheet(guest);

  // Notes arrive with the sender's name
  await openActivity(host, 'Message cards', 'app-message-cards textarea');
  await openActivity(guest, 'Message cards', 'app-message-cards textarea');
  await guest.fill('app-message-cards textarea', 'miss your face');
  await guest.click('app-message-cards button[type=submit]');
  await expect(host.locator('app-message-cards .note p')).toHaveText('miss your face');
  await expect(host.locator('app-message-cards .note .from')).toHaveText('Sam');
  await closeSheet(host);
  await closeSheet(guest);

  // Strokes render on both canvases
  await openActivity(host, 'Draw together', 'app-drawing canvas');
  await openActivity(guest, 'Draw together', 'app-drawing canvas');
  const box = (await host.locator('app-drawing canvas').boundingBox())!;
  await host.mouse.move(box.x + 40, box.y + 40);
  await host.mouse.down();
  await host.mouse.move(box.x + box.width - 40, box.y + box.height - 40, { steps: 12 });
  await host.mouse.up();
  const inked = (p: Page) =>
    p.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('app-drawing canvas')!;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
  await expect.poll(() => inked(guest)).toBeGreaterThan(0);
  expect(await inked(guest)).toBe(await inked(host));
  await closeSheet(host);
  await closeSheet(guest);

  // Bucket list merges and ticks sync
  await openActivity(host, 'Our bucket list', 'app-bucket-list input');
  await openActivity(guest, 'Our bucket list', 'app-bucket-list input');
  await host.fill('app-bucket-list input[type=text]', 'Watch a sunrise together');
  await host.click('app-bucket-list form button[type=submit]');
  await expect(guest.locator('app-bucket-list li')).toHaveCount(1);
  await guest.fill('app-bucket-list input[type=text]', 'Cook the same dish');
  await guest.click('app-bucket-list form button[type=submit]');
  await expect(host.locator('app-bucket-list li')).toHaveCount(2);
  await host.click('app-bucket-list li >> nth=0 >> .check');
  await expect(guest.locator('app-bucket-list li.done')).toHaveCount(1);
  await closeSheet(host);
  await closeSheet(guest);

  // Distance and countdown
  await openActivity(host, 'Distance', 'app-distance select');
  await openActivity(guest, 'Distance', 'app-distance select');
  await host.selectOption('app-distance select', 'London');
  await guest.selectOption('app-distance select', 'Paris');
  await expect(host.locator('app-distance .result')).toContainText('340 km apart');
  await closeSheet(host);
  await closeSheet(guest);

  await openActivity(host, 'Countdown', 'app-countdown-activity');
  await openActivity(guest, 'Countdown', 'app-countdown-activity');
  const future = new Date(Date.now() + 12 * 86_400_000);
  const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
  await host.fill('app-countdown-activity input[type=text]', 'Next visit');
  await host.fill('app-countdown-activity input[type=date]', iso);
  await host.click('app-countdown-activity button[type=submit]');
  await expect(guest.locator('app-countdown-activity .hero')).toContainText('Next visit');

  expect(errors).toEqual([]);
});

test('the activities page offers the solo ones', async ({ page }) => {
  await page.goto('/activities');
  await expect(page.locator('app-activity-host .tile strong')).toHaveText(['Question cards', 'Draw together', 'Our bucket list', 'Countdown', 'Distance']);
  await page.click('app-activity-host .tile:has-text("Our bucket list")');
  await page.fill('app-bucket-list input[type=text]', 'Visit Japan');
  await page.click('app-bucket-list form button[type=submit]');
  await expect(page.locator('app-bucket-list li .text')).toHaveText(['Visit Japan']);
  await page.reload();
  await page.click('app-activity-host .tile:has-text("Our bucket list")');
  await expect(page.locator('app-bucket-list li .text')).toHaveText(['Visit Japan']);
});
