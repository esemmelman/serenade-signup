import { test, expect } from '@playwright/test';

const endpoint = '**/rest/v1/hanukkah_serenading_signups';

async function fillContact(page) {
  await page.getByLabel('First & last name').fill('Test Serenader');
  await page.getByLabel('Number of people').fill('3');
  await page.getByLabel('Cell phone number').fill('(555) 123-4567');
  await page.getByLabel('Email address').fill('serenader@example.com');
}

test('required contact fields, optional dates, confirmation, and another signup', async ({ page }) => {
  const received = [];
  await page.route(endpoint, route => {
    received.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Submit' }).click();
  expect(received).toHaveLength(0);
  await fillContact(page);
  await page.getByLabel('First & last name').fill('   ');
  await page.getByRole('button', { name: 'Submit' }).click();
  expect(received).toHaveLength(0);
  await page.getByLabel('First & last name').fill('Test Serenader');
  await page.getByLabel('Cell phone number').fill('abc123');
  await page.getByRole('button', { name: 'Submit' }).click();
  expect(received).toHaveLength(0);
  await page.getByLabel('Cell phone number').fill('(555) 123-4567');
  await page.getByLabel('Number of people').fill('0');
  await page.getByRole('button', { name: 'Submit' }).click();
  expect(received).toHaveLength(0);
  await page.getByLabel('Number of people').fill('3');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: "You're on the list!" })).toBeVisible();
  expect(received[0]).toMatchObject({ full_name: 'Test Serenader', people_count: 3, available_dates: [] });
  await expect(page.getByText('No dates selected')).toBeVisible();
  await page.getByRole('button', { name: 'Add another signup' }).click();
  await expect(page.getByLabel('First & last name')).toHaveValue('');
  await fillContact(page);
  await page.getByLabel('Saturday').check();
  await page.getByLabel('Tuesday').check();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: "You're on the list!" })).toBeVisible();
  expect(received[1].available_dates).toEqual(['2026-12-05', '2026-12-08']);
  expect(received[1].id).not.toBe(received[0].id);
});

test('lost responses preserve entries and retry the same request ID', async ({ page }) => {
  const received = [];
  await page.route(endpoint, async route => {
    received.push(route.request().postDataJSON());
    if (received.length === 1) return route.abort('failed');
    return route.fulfill({ status: 409, json: { code: '23505' } });
  });
  await page.goto('/');
  await fillContact(page);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('alert')).toContainText('try again');
  await expect(page.getByLabel('First & last name')).toHaveValue('Test Serenader');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: "You're on the list!" })).toBeVisible();
  expect(received[1]).toEqual(received[0]);
});

test('Android form fits the viewport and saves selected availability', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: 'Android Chrome' }));
  await page.route(endpoint, route => route.fulfill({ status: 201, body: '' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hanukkah Serenading' })).toBeVisible();
  await fillContact(page);
  await page.getByLabel('Sunday').check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/signup-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: "You're on the list!" })).toBeVisible();
  await expect(page.getByText('Sun, Dec 6')).toBeVisible();
});

test('desktop signup form', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/');
  await page.getByLabel('Saturday').check();
  await page.screenshot({ path: 'test-results/signup-desktop.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


for (const android of [false, true]) {
  test(`attendee list sorts names and displays selected nights (${android ? 'Android' : 'desktop'})`, async ({ page }) => {
    if (android) {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: 'Android Chrome' }));
    }
    const requests = [];
    await page.route('**/rest/v1/hanukkah_serenading_signups?**', route => {
      requests.push(new URL(route.request().url()));
      return route.fulfill({ json: [
        { full_name: 'Zoe Test', available_dates: [] },
        { full_name: 'alice Test', available_dates: ['2026-12-08', '2026-12-05'] },
        { full_name: 'Bob Test', available_dates: ['2026-12-06'] },
      ] });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Submit', exact: true })).toHaveText('Submit');
    if (android) {
      const lines = page.locator('.invitation-line');
      await expect(lines).toHaveText(['Yes, I want to', 'Hanukkah Serenading!']);
      for (const line of await lines.all()) {
        expect(await line.evaluate(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        })).toBe(1);
      }
    }
    await page.getByRole('link', { name: "See who's going" }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('tbody tr td:first-child')).toHaveText(['alice Test', 'Bob Test', 'Zoe Test']);
    await expect(dialog.locator('tbody tr').first().locator('td').last()).toContainText('Dec. 5');
    await expect(dialog.locator('tbody tr').first().locator('td').last()).toContainText('Fifth night');
    await expect(dialog.locator('tbody tr').last()).toContainText('Dates not selected');
    expect(requests[0].searchParams.get('select')).toBe('full_name,available_dates');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/attendees-${android ? 'android' : 'desktop'}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Close attendee list' }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('link', { name: "See who's going" }).click();
    await expect(dialog.locator('tbody tr')).toHaveCount(3);
    expect(requests).toHaveLength(2);
  });
}

test('attendee list recovers from a failed request and handles an empty list', async ({ page }) => {
  let calls = 0;
  await page.route('**/rest/v1/hanukkah_serenading_signups?**', route => {
    calls += 1;
    return calls === 1 ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: [] });
  });
  await page.goto('/');
  await page.getByRole('link', { name: "See who's going" }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Please try again');
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect(dialog.getByRole('status')).toHaveText('No signups yet.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
