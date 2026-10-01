// Red-first spec for resume-link attribution (public/attribution.js). Run with:
//   npx --package=@playwright/test playwright test tests/attribution.spec.js
// No package.json on purpose; see playwright.config.js. A tagged resume link
// lands on any page with ?r=<code>. The script must strip r from the URL on
// every load and, for a valid code with no GPC/DNT opt-out, send exactly one
// same-origin POST /r/<code>/engaged on the first trusted pointerdown, scroll
// or keydown. Negative tests also assert the strip, so they are red before the
// script exists rather than vacuously green.
const { test, expect } = require('@playwright/test');

const CODE = 'abcdefgh'; // matches ^[a-hjkmnp-z2-9]{8}$
const SETTLE = 300;

async function armBeaconCapture(page) {
    const hits = [];
    await page.route('**/r/*/engaged', (route) => {
        const req = route.request();
        hits.push({ method: req.method(), url: req.url(), body: req.postData() });
        route.fulfill({ status: 204, body: '' });
    });
    return hits;
}

function search(page) {
    return page.evaluate(() => location.search);
}

// Positive assertions poll: wheel-to-request latency varies 200-3000 ms under
// parallel load, so a fixed sleep flakes. Negative assertions keep SETTLE.
async function expectOne(hits) {
    await expect.poll(() => hits.length, { timeout: 5000 }).toBe(1);
}

test('strips r and keeps other params and hash byte-exact', async ({ page }) => {
    await armBeaconCapture(page);
    await page.goto('/');
    const before = await page.evaluate(() => history.length);
    await page.goto(`/?a=1&r=${CODE}&b=x%20y#frag`);
    expect(await page.evaluate(() => location.search + location.hash)).toBe('?a=1&b=x%20y#frag');
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    expect(await page.evaluate(() => history.state && history.state.via)).toBe('load');
});

test('strips bare r', async ({ page }) => {
    await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    expect(await search(page)).toBe('');
    expect(await page.evaluate(() => location.href.endsWith('/'))).toBe(true);
});

test('pointerdown sends exactly one beacon', async ({ page }) => {
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.mouse.click(640, 400);
    await expectOne(hits);
    expect(hits[0].method).toBe('POST');
    expect(hits[0].url.endsWith(`/r/${CODE}/engaged`)).toBe(true);
    expect(hits[0].body === null || hits[0].body === '').toBe(true);
    await page.mouse.wheel(0, 300);
    await page.keyboard.press('ArrowDown');
    await page.mouse.click(640, 400);
    await page.waitForTimeout(SETTLE);
    expect(hits).toHaveLength(1);
});

test('scroll sends exactly one beacon', async ({ page }) => {
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 400);
    await expectOne(hits);
    expect(hits[0].method).toBe('POST');
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(SETTLE);
    expect(hits).toHaveLength(1);
});

test('keydown sends exactly one beacon', async ({ page }) => {
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.keyboard.press('Tab');
    await expectOne(hits);
    expect(hits[0].method).toBe('POST');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(SETTLE);
    expect(hits).toHaveLength(1);
});

test('no interaction, no beacon', async ({ page }) => {
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.waitForTimeout(500);
    expect(hits).toHaveLength(0);
    expect(await search(page)).toBe('');
});

test('globalPrivacyControl true: stripped, no beacon', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
    });
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.mouse.click(640, 400);
    await page.waitForTimeout(SETTLE);
    expect(hits).toHaveLength(0);
    expect(await search(page)).toBe('');
});

test('doNotTrack "1": stripped, no beacon', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
    });
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.mouse.click(640, 400);
    await page.waitForTimeout(SETTLE);
    expect(hits).toHaveLength(0);
    expect(await search(page)).toBe('');
});

test('invalid codes: stripped, no beacon', async ({ page }) => {
    const hits = await armBeaconCapture(page);
    const bad = ['ABCDEFGH', 'abcdefg', 'abcdefghj', 'abcdefgi', 'abcdefgl', 'abcdefgo', 'abcdefg0', 'abcdefg1'];
    for (const code of bad) {
        await page.goto(`/?r=${code}&k=v`);
        await page.mouse.click(640, 400);
        await page.waitForTimeout(200);
        expect(await search(page), code).toBe('?k=v');
    }
    expect(hits).toHaveLength(0);
});

test('sendBeacon false falls back to fetch keepalive POST', async ({ page }) => {
    await page.addInitScript(() => {
        navigator.sendBeacon = () => false;
    });
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.mouse.click(640, 400);
    await expectOne(hits);
    expect(hits[0].method).toBe('POST');
    expect(await search(page)).toBe('');
});

test('leaves no cookies or storage', async ({ page }) => {
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.mouse.click(640, 400);
    await expectOne(hits);
    expect(await page.evaluate(() => [document.cookie, localStorage.length, sessionStorage.length])).toEqual(['', 0, 0]);
});

test('synthetic events do not count', async ({ page }) => {
    const hits = await armBeaconCapture(page);
    await page.goto(`/?r=${CODE}`);
    await page.evaluate(() => {
        window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        window.dispatchEvent(new PointerEvent('pointerdown'));
    });
    await page.waitForTimeout(SETTLE);
    expect(hits).toHaveLength(0);
    expect(await search(page)).toBe('');
    await page.mouse.click(640, 400);
    await expectOne(hits);
});

test('tagged deep link lands on its own page', async ({ page }) => {
    const hits = await armBeaconCapture(page);
    await page.goto(`/workday/product-quality-engineer?r=${CODE}`);
    expect(await page.evaluate(() => location.pathname)).toBe('/workday/product-quality-engineer');
    expect(await search(page)).toBe('');
    expect(await page.evaluate(() => history.state && history.state.via)).toBe('load');
    await page.keyboard.press('Tab');
    await expectOne(hits);
    expect(hits[0].url.endsWith(`/r/${CODE}/engaged`)).toBe(true);
});
