import { expect, type Page } from '@playwright/test';

export async function expectCookieAtViewportCorner(page: Page) {
  const viewport = page.viewportSize()!;
  const inset = viewport.width <= 576 ? 12 : 16;
  const button = page.getByRole('button', { name: 'Preferências de cookies' });
  await expect(button).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = (await button.boundingBox())!;
      return {
        right: Math.round(viewport.width - bounds.x - bounds.width),
        bottom: Math.round(viewport.height - bounds.y - bounds.height),
      };
    })
    .toEqual({ right: inset, bottom: inset });
}
