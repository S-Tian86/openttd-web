import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('borrows £10,000 and repays everything', async ({ page, isMobile }) => {
  await page.getByRole('button', { name: 'Finances' }).click();
  const dialog = page.getByRole('dialog', { name: 'Finances' });
  await dialog.getByRole('button', { name: 'Borrow £10,000' }).click();
  await expect(page.getByLabel('Money')).toHaveText('£110,000');
  await expect(dialog).toContainText('Loan: £110,000');
  const repay = dialog.getByRole('button', { name: 'Repay £10,000' });
  if (isMobile) {
    const box = (await repay.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(700); // long press = all (R25)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await repay.click({ modifiers: ['Control'] });
  }
  await expect(dialog).toContainText('Loan: £0');
  await expect(page.getByLabel('Money')).toHaveText('£0');
});
