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
const hand = (page: Page) => page.getByTestId('hand').locator('[data-card]');

/** Plays a legal move offered by the server (or passes). Gives up quietly if the state moves on. */
async function playOnce(page: Page): Promise<void> {
  const format = Number(await page.getByTestId('table').getAttribute('data-format')) || 1;
  const cards = await hand(page).evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute('data-card')!,
      rank: e.getAttribute('data-rank')!,
      ok: e.getAttribute('data-playable') === 'true',
    })),
  );
  const playable = cards.filter((c) => c.ok);
  const rank = playable.find(
    (c) => playable.filter((d) => d.rank === c.rank).length >= format,
  )?.rank;
  const chosen = rank ? playable.filter((c) => c.rank === rank).slice(0, format) : [];
  const play = page.getByRole('button', { name: /^(Jouer|Couper le carré)$/ });
  try {
    for (const card of chosen)
      await page.locator(`[data-testid=hand] [data-card="${card.id}"]`).click({ timeout: 2000 });
    if (chosen.length && (await play.isEnabled())) return await play.click({ timeout: 2000 });
    if (chosen.length) await page.getByRole('button', { name: 'Effacer' }).click({ timeout: 2000 });
    const pass = page.getByRole('button', { name: 'Passer', exact: true });
    if (await pass.isEnabled()) await pass.click({ timeout: 2000 });
  } catch {
    // The table changed under our feet (a bot cut, the trick cleared): try again next loop.
    const clear = page.getByRole('button', { name: 'Effacer' });
    if (await clear.isVisible()) await clear.click({ timeout: 2000 }).catch(() => undefined);
  }
}

test.beforeAll(async () => {
  await mkdir('test-results/visual', { recursive: true });
});

test('accueil responsive, règles et clavier', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('heading', { name: 'On se fait une partie ?' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: `test-results/visual/home-${width}.png`, fullPage: true });
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
  const a = await browser.newContext();
  const b = await browser.newContext();
  const host = await a.newPage();
  const guest = await b.newPage();
  await ready(host);
  await host.getByRole('button', { name: 'Créer une table', exact: true }).click();
  await identify(host, 'Gabin');
  await expect(
    host.getByRole('heading', { name: 'Gardez une place pour vos amis.' }),
  ).toBeVisible();
  const code = (await host.getByTestId('room-code').innerText()).trim();
  await ready(guest);
  await guest.getByLabel('Code du salon').fill(code);
  await guest.getByRole('button', { name: 'Rejoindre', exact: true }).click();
  await identify(guest, 'Camille');
  await expect(host.getByTestId('lobby-member').filter({ hasText: 'Camille' })).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Lancer la partie' })).toHaveCount(0);
  await host.screenshot({ path: 'test-results/visual/lobby.png', fullPage: true });
  await host.getByRole('button', { name: 'Lancer la partie' }).click();
  await expect(hand(host)).toHaveCount(26);
  await expect(hand(guest)).toHaveCount(26);
  await expect(host.getByTestId('table')).toHaveAttribute('data-phase', 'playing');

  const opener = (await host.getByRole('button', { name: 'D de cœur', exact: true }).count())
    ? host
    : guest;
  await opener.getByRole('button', { name: 'D de cœur', exact: true }).click();
  await opener.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(hand(opener)).toHaveCount(25);
  await host.screenshot({ path: 'test-results/visual/table-desktop.png', fullPage: true });

  await guest.reload();
  await expect(guest.getByTestId('self-name')).toHaveText('Camille');
  // A stand-in bot may play during the reload: compare with the public count the host sees.
  const seat = host.locator('[data-testid^=seat-]').filter({ hasText: 'Camille' });
  await expect
    .poll(async () => Number(await seat.getAttribute('data-cards')))
    .toBe(await hand(guest).count());
  await guest.setViewportSize({ width: 390, height: 844 });
  expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await guest.screenshot({ path: 'test-results/visual/table-mobile.png', fullPage: true });
  await a.close();
  await b.close();
});

test('solo complet, classement, échanges puis manche suivante', async ({ page }) => {
  // A whole round with card animations between every click.
  test.setTimeout(240_000);
  await ready(page);
  await page.getByRole('button', { name: 'Un bot de plus' }).click();
  await page.getByRole('button', { name: 'Jouer en solo', exact: true }).click();
  await identify(page, 'Louise');
  await expect(page.locator('[data-testid^=seat-]')).toHaveCount(5);
  const results = page.getByTestId('results');
  for (let step = 0; step < 800 && !(await results.isVisible()); step++) {
    const mine = await page
      .getByTestId('turn')
      .getAttribute('data-mine')
      .catch(() => null);
    if (mine === 'true') await playOnce(page);
    else await page.waitForTimeout(40);
  }
  await expect(results).toBeVisible();
  await expect(page.getByTestId('standing')).toHaveCount(6);
  await page.screenshot({ path: 'test-results/visual/results.png', fullPage: true });
  await page.getByRole('button', { name: 'La revanche ?' }).click();
  await expect(page.getByTestId('table')).toContainText('Manche 2');
  const give = page.getByRole('button', { name: 'Donner mes cartes' });
  if (await give.isVisible().catch(() => false)) {
    const needed = (await page.getByTestId('hint').innerText()).includes('2 cartes') ? 2 : 1;
    for (let i = 0; i < needed; i++) await hand(page).nth(i).click();
    await page.screenshot({ path: 'test-results/visual/exchange.png', fullPage: true });
    await give.click();
  }
  await expect(page.getByTestId('table')).toHaveAttribute('data-phase', 'playing');
  await expect(page.getByTestId('error')).toHaveCount(0);
});
