import { test, expect } from '@playwright/test';

const endpoint = '**/rest/v1/hanukkah_serenading_signups';

async function fillContact(page) {
  await page.getByLabel('First & last name').fill('Test Serenader');
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
  await expect(page.locator('#name-reminder')).toHaveCount(0);
  await expect(page.getByText('Hosted by the Caring Community Committee', { exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: "You're on the list!" })).toBeVisible();
  expect(received[0]).toMatchObject({ full_name: 'Test Serenader', people_count: 1, available_dates: [] });
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
        { full_name: 'alice Test', available_dates: ['2026-12-08', '2026-12-05'], additional_names: ['Jamie Guest'] },
        { full_name: 'Bob Test', available_dates: ['2026-12-06'] },
      ] });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Submit', exact: true })).toHaveText('Submit');
    if (android) {
      const lines = page.locator('.invitation-line');
      await expect(lines).toHaveText(['Yes, I want to go Hanukkah', 'Serenading to fellow congregants!']);
      for (const line of await lines.all()) {
        expect(await line.evaluate(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        })).toBe(1);
      }
    }
    await page.getByRole('link', { name: "See Who's Going" }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.attendee-name')).toHaveText(['alice Test', 'Bob Test', 'Zoe Test']);
    await expect(dialog.locator('.attendee').first().locator('.attendee-nights>div')).toHaveText(['Dec. 5 — Second night of Hanukkah', 'Dec. 8 — Fifth night of Hanukkah']);
    await expect(dialog.locator('.attendee').first().locator('.attendee-guests')).toHaveText('With Jamie Guest');
    await expect(dialog.locator('.attendee').last()).toContainText('Dates not selected');
    expect(requests[0].searchParams.get('select')).toBe('full_name,available_dates,additional_names');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/attendees-${android ? 'android' : 'desktop'}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Close attendee list' }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('link', { name: "See Who's Going" }).click();
    await expect(dialog.locator('.attendee')).toHaveCount(3);
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
  await page.getByRole('link', { name: "See Who's Going" }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Please try again');
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect(dialog.getByRole('status')).toHaveText('No signups yet.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});


for (const android of [false, true]) {
  test(`additional names stay associated with the main signup (${android ? 'Android' : 'desktop'})`, async ({ page }) => {
    if (android) {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: 'Android Chrome' }));
    }
    const received = [];
    await page.route(endpoint, route => {
      received.push(route.request().postDataJSON());
      return received.length === 1 ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ status: 201, body: '' });
    });
    await page.goto('/');
    await fillContact(page);
    await page.getByLabel('I will be bringing others (Spouse, children, Friends)', { exact: true }).check();
    const dialog = page.getByRole('dialog', { name: 'Enter the other names here' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Additional person 1', { exact: true })).toBeFocused();
    await expect(dialog.locator('ol li')).toHaveCount(5);
    await expect(dialog).toContainText('These people will be associated with the main entry.');
    await dialog.getByLabel('Additional person 1', { exact: true }).fill('  Alex Guest  ');
    await dialog.getByLabel('Additional person 3', { exact: true }).fill('Taylor Guest');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/guests-${android ? 'android' : 'desktop'}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByLabel('First & last name')).toHaveValue('Test Serenader');
    await expect(page.locator('#guest-summary-names')).toHaveText('Alex Guest, Taylor Guest');
    await page.getByRole('button', { name: 'Edit names', exact: true }).click();
    await expect(dialog.getByLabel('Additional person 1', { exact: true })).toHaveValue('Alex Guest');
    await dialog.getByLabel('Additional person 1', { exact: true }).fill('Uncommitted change');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('#guest-summary-names')).toHaveText('Alex Guest, Taylor Guest');
    await page.getByLabel('Saturday').check();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('try again');
    await expect(page.locator('#guest-summary-names')).toHaveText('Alex Guest, Taylor Guest');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByRole('heading', { name: "You're on the list!" })).toBeVisible();
    expect(received[0]).toEqual(received[1]);
    expect(received[1]).toMatchObject({ full_name: 'Test Serenader', people_count: 3, additional_names: ['Alex Guest', 'Taylor Guest'], available_dates: ['2026-12-05'] });
    await expect(page.locator('#signup-summary')).toContainText('Alex Guest, Taylor Guest');
    await page.getByRole('button', { name: 'Add another signup', exact: true }).click();
    await expect(page.getByLabel('I will be bringing others (Spouse, children, Friends)', { exact: true })).not.toBeChecked();
    await expect(page.locator('#guest-summary')).toBeHidden();
  });
}

test('guest dialog requires one name when enabled and supports cancel, escape, and unchecking', async ({ page }) => {
  const received = [];
  await page.route(endpoint, route => {
    received.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/');
  const checkbox = page.getByLabel('I will be bringing others (Spouse, children, Friends)', { exact: true });
  const dialog = page.getByRole('dialog', { name: 'Enter the other names here' });
  await checkbox.check();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.keyboard.press('Escape');
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await dialog.getByLabel('Additional person 5', { exact: true }).fill('Last Line Guest');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await checkbox.uncheck();
  await expect(page.locator('#guest-summary')).toBeHidden();
  await fillContact(page);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('heading', { name: "You're on the list!" })).toBeVisible();
  expect(received[0]).toMatchObject({ people_count: 1, additional_names: [] });
});
