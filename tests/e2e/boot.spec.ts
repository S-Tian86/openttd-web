import { expect, test, type Page } from '@playwright/test';

/** Collects console errors, page errors and failed responses (CSP violations log as console errors). */
function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(`console: ${message.text()} (${message.location().url})`);
    }
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return problems;
}

test('boots the production build without errors under the CSP', async ({ page }) => {
  const problems = watchForProblems(page);

  await page.goto('./');

  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/boot.png' });
  expect(problems).toEqual([]);
});

test('the canvas follows a phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');

  const box = await page.locator('#game canvas').boundingBox();
  expect(box?.width).toBe(375);
  expect(box?.height).toBe(667);
});
