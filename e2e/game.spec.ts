import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Jouer en solo', exact: true })).toBeEnabled();
};
async function identify(page: Page, name: string) {
  await page.getByLabel('Votre pseudo').fill(name);
  await page.getByRole('dialog').locator('button[type=submit]').click();
}
test('lobby responsive, règles et clavier', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await mkdir('test-results/visual', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1200 : 1800 });
    await expect(page.getByRole('heading', { name: 'On se fait une partie ?' })).toBeVisible();
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      overflow: Array.from(document.querySelectorAll('*'))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.right > innerWidth + 1;
        })
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          right: e.getBoundingClientRect().right,
        })),
    }));
    expect(layout.scroll, JSON.stringify(layout)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/visual/lobby-${width}.png` });
  }
  await page.getByRole('button', { name: 'Les règles' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(errors).toEqual([]);
});
test('deux navigateurs rejoignent une table, jouent et récupèrent après rechargement', async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const host = await a.newPage(),
    guest = await b.newPage();
  await ready(host);
  await host.getByRole('button', { name: 'Créer une table', exact: true }).click();
  await identify(host, 'Gabin');
  await expect(
    host.getByRole('heading', { name: 'Gardez une place pour vos amis.' }),
  ).toBeVisible();
  const code = (await host.locator('.room-code button').innerText()).trim();
  await ready(guest);
  await guest.getByLabel('Code du salon').fill(code);
  await guest.getByRole('button', { name: 'Rejoindre', exact: true }).click();
  await identify(guest, 'Camille');
  await expect(host.locator('.waiting-player').filter({ hasText: 'Camille' })).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Lancer la partie' })).toHaveCount(0);
  await host.getByRole('button', { name: 'Lancer la partie' }).click();
  await expect(host.locator('.hand-cards button')).toHaveCount(26);
  await expect(guest.locator('.hand-cards button')).toHaveCount(26);
  const opener = (await host.getByRole('button', { name: 'D de cœur', exact: true }).count())
    ? host
    : guest;
  await opener.getByRole('button', { name: 'D de cœur', exact: true }).click();
  await opener.getByRole('button', { name: 'Jouer mes cartes' }).click();
  await expect(opener.locator('.hand-cards button')).toHaveCount(25);
  await guest.reload();
  await expect(guest.locator('.hand-heading strong')).toContainText('Camille');
  // A temporary bot can legitimately play during the reload. Verify the recovered
  // private hand agrees with the public server count rather than the old snapshot.
  const publicCount = Number(
    (await host.locator('.opponent').filter({ hasText: 'Camille' }).innerText()).match(
      /(\d+) cartes/,
    )![1],
  );
  await expect(guest.locator('.hand-cards button')).toHaveCount(publicCount);
  await host.screenshot({ path: 'test-results/visual/table-desktop.png', fullPage: true });
  await guest.setViewportSize({ width: 390, height: 844 });
  expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await guest.screenshot({ path: 'test-results/visual/table-mobile.png', fullPage: true });
  await a.close();
  await b.close();
});
test('solo complet, classement, échanges puis manche suivante', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Un bot de plus' }).click();
  await page.getByRole('button', { name: 'Jouer en solo', exact: true }).click();
  await identify(page, 'Louise');
  await expect(page.locator('.opponent')).toHaveCount(5);
  for (let step = 0; step < 600; step++) {
    if (await page.locator('.results-panel').isVisible()) break;
    if (await page.locator('.turn-pill.yourturn').isVisible()) {
      const cards = await page
        .locator('.hand-cards button')
        .evaluateAll((els) =>
          els.map((e, i) => ({
            index: i,
            rank: Number(e.getAttribute('data-rank')),
            suit: e.getAttribute('data-suit'),
          })),
        );
      const table = await page
        .locator('.felt-table')
        .evaluate((e) => ({
          rank: Number(e.getAttribute('data-rank')),
          format: Number(e.getAttribute('data-format')),
          equal: e.getAttribute('data-equal') === 'true',
        }));
      const hint = await page.locator('.hand-controls>p').innerText();
      let chosen: number[] = [];
      if (hint.includes('Dame de cœur'))
        chosen = cards.filter((c) => c.rank === 12 && c.suit === 'hearts').map((c) => c.index);
      else {
        const format = table.format || 1;
        for (const rank of [...new Set(cards.map((c) => c.rank))]) {
          const group = cards.filter((c) => c.rank === rank);
          if (
            group.length >= format &&
            (!table.format || (table.equal ? rank === table.rank : rank >= table.rank))
          ) {
            chosen = group.slice(0, format).map((c) => c.index);
            break;
          }
        }
      }
      if (chosen.length) {
        for (const i of chosen) await page.locator('.hand-cards button').nth(i).click();
        const play = page.getByRole('button', { name: /^(Jouer mes cartes|Couper le carré)$/ });
        if (await play.isEnabled()) await play.click();
        else await page.getByRole('button', { name: 'Effacer', exact: true }).click();
      } else await page.getByRole('button', { name: 'Passer', exact: true }).click();
    }
    await page.waitForTimeout(50);
  }
  await expect(page.locator('.results-panel')).toBeVisible();
  await expect(page.locator('.ranking-list>div')).toHaveCount(6);
  await page.screenshot({ path: 'test-results/visual/results.png', fullPage: true });
  await page.getByRole('button', { name: 'La revanche ?' }).click();
  await expect(page.locator('.table-toolbar')).toContainText('MANCHE 2');
  if (await page.getByRole('button', { name: 'Donner mes cartes' }).isVisible()) {
    const hint = await page.locator('.hand-controls>p').innerText();
    if (hint.includes('Choisissez')) {
      const count = hint.includes('2 cartes') ? 2 : 1;
      for (let i = 0; i < count; i++) await page.locator('.hand-cards button').nth(i).click();
      await page.getByRole('button', { name: 'Donner mes cartes' }).click();
    }
  }
  await expect(page.locator('.felt-table')).not.toHaveClass(/exchange/);
  expect(await page.locator('.error-banner').count()).toBe(0);
});
