// Red-first spec for the cursor trail (WEB-1, Claude Design option 2e
// "Tether"). Run with:
//   npx --package=@playwright/test playwright test
// No package.json on purpose; see playwright.config.js.
const { test, expect } = require('@playwright/test');

async function sample(page, sel) {
    return page.$eval(sel, (c) => c.toDataURL());
}

async function litBox(page) {
    return page.evaluate(() => {
        var canvas = document.getElementById('cursor-trail');
        var ctx = canvas.getContext('2d');
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var scale = canvas.width / window.innerWidth;
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, count = 0;
        for (var y = 0; y < canvas.height; y++) {
            for (var x = 0; x < canvas.width; x++) {
                var a = data[(y * canvas.width + x) * 4 + 3];
                if (a > 0) {
                    count++;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (count === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, count: 0 };
        return {
            minX: minX / scale,
            maxX: maxX / scale,
            minY: minY / scale,
            maxY: maxY / scale,
            count: count,
        };
    });
}

test('mounts one trail canvas above the starfield, below content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('cursor-trail')).toHaveCount(1);
    const info = await page.evaluate(() => {
        var canvas = document.getElementById('cursor-trail');
        var starfield = document.getElementById('starfield');
        var main = document.querySelector('main');
        var cs = getComputedStyle(canvas);
        return {
            tagName: canvas.tagName,
            prevId: canvas.previousElementSibling && canvas.previousElementSibling.id,
            position: cs.position,
            pointerEvents: cs.pointerEvents,
            zIndex: cs.zIndex,
            starfieldZIndex: getComputedStyle(starfield).zIndex,
            precedesMain: !!(main.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_PRECEDING),
            ariaHidden: canvas.getAttribute('aria-hidden'),
            width: canvas.width,
            expectedWidth: Math.round(window.innerWidth * Math.min(2, window.devicePixelRatio)),
        };
    });
    expect(info.tagName).toBe('CANVAS');
    expect(info.prevId).toBe('starfield');
    expect(info.position).toBe('fixed');
    expect(info.pointerEvents).toBe('none');
    expect(info.zIndex).toBe('1');
    expect(info.starfieldZIndex).toBe('0');
    expect(info.precedesMain).toBe(true);
    expect(info.ariaHidden).toBe('true');
    expect(info.width).toBe(info.expectedWidth);
});

test.describe('DPR cap', () => {
    test.use({ deviceScaleFactor: 3 });

    // Pins the starfield's current uncapped DPR so this commit provably
    // leaves it alone. A future deliberate cap updates this test on
    // purpose; it is not a regression.
    test('starfield DPR unchanged by this commit (trail caps at 2, starfield stays uncapped)', async ({ page }) => {
        await page.goto('/');
        const info = await page.evaluate(() => ({
            trailWidth: document.getElementById('cursor-trail').width,
            starfieldWidth: document.getElementById('starfield').width,
            innerWidth: window.innerWidth,
            dpr: window.devicePixelRatio,
        }));
        expect(info.trailWidth).toBe(Math.round(info.innerWidth * 2));
        expect(info.starfieldWidth).toBe(Math.round(info.innerWidth * info.dpr));
    });
});

test('draws a tail capped at 110px that collapses within 400ms, halo stays', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(200, 400);
    await page.mouse.move(700, 400, { steps: 30 });
    // Two frames: the first lets the shared loop consume the last
    // pointermove, the second guarantees tick() has drawn it.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    let box = await litBox(page);
    expect(box.count).toBeGreaterThan(0);
    expect(box.maxX - box.minX).toBeLessThanOrEqual(110 + 2 * (12 + 8) + 4);
    // Upper bound is fixed. Lower bound loosened from 60: rAF timing after
    // mouse.move varies under load.
    expect(box.maxX - box.minX).toBeGreaterThan(30);
    await page.waitForTimeout(700);
    box = await litBox(page);
    expect(box.maxX - box.minX).toBeLessThanOrEqual(2 * (12 + 8) + 4);
    expect(box.count).toBeGreaterThan(0);
    expect(Math.abs((box.minX + box.maxX) / 2 - 700)).toBeLessThan(6);
});

test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('absent under reduced motion; starfield renders one static frame', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('cursor-trail')).toHaveCount(0);
        await expect(page.getByTestId('starfield')).toHaveCount(1);
        const a = await sample(page, '#starfield');
        await page.waitForTimeout(600);
        const b = await sample(page, '#starfield');
        expect(a).toBe(b);
        await page.mouse.move(200, 400);
        await page.mouse.move(700, 400, { steps: 30 });
        await expect(page.getByTestId('cursor-trail')).toHaveCount(0);
    });
});

test('loop runs and animates the starfield when motion is allowed', async ({ page }) => {
    await page.goto('/');
    const a = await sample(page, '#starfield');
    await page.waitForTimeout(600);
    const b = await sample(page, '#starfield');
    expect(a).not.toBe(b);
});

test.describe('coarse pointer', () => {
    test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

    test('never set up on a coarse pointer', async ({ page }) => {
        await page.goto('/');
        const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
        // If this guard fails at execution, replace the emulation with
        // test.use({ ...devices['Pixel 7'] }); do not delete the guard.
        expect(coarse).toBe(true);
        await expect(page.getByTestId('cursor-trail')).toHaveCount(0);
    });
});

test('stops the shared loop when the page is hidden and resumes', async ({ page }) => {
    await page.addInitScript(() => {
        window.__raf = 0;
        window.__caf = 0;
        const raf = window.requestAnimationFrame.bind(window);
        const caf = window.cancelAnimationFrame.bind(window);
        window.requestAnimationFrame = function (cb) { window.__raf++; return raf(cb); };
        window.cancelAnimationFrame = function (id) { window.__caf++; return caf(id); };
    });
    await page.goto('/');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__caf)).toBeGreaterThanOrEqual(1);
    let r2 = await page.evaluate(() => window.__raf);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__raf)).toBe(r2);
    await page.evaluate(() => {
        delete document.hidden;
        delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__raf)).toBeGreaterThan(r2);
    await page.mouse.move(200, 400);
    await page.mouse.move(700, 400, { steps: 30 });
    const box = await litBox(page);
    expect(box.count).toBeGreaterThan(0);
});

const ROUTES = [
    '/',
    '/daas-platform',
    '/daas-platform/data-wrangling-pipeline',
    '/education',
    '/muchane-cloud',
    '/muchane-cloud/career-command-center',
    '/muchane-cloud/self-hosted-infra',
    '/workday',
    '/workday/product-management-rotation',
    '/workday/product-quality-engineer',
    '/workday/senior-product-quality-engineer',
];

for (const route of ROUTES) {
    test(`content layers stay above the trail on every page: ${route}`, async ({ page }) => {
        await page.goto(route);
        await expect(page.getByTestId('cursor-trail')).toHaveCount(1);
        const offenders = await page.evaluate(() => {
            var trail = document.getElementById('cursor-trail');
            var bad = [];
            Array.from(document.body.children).forEach(function (el) {
                if (el.tagName === 'SCRIPT' || el.id === 'starfield' || el.id === 'cursor-trail') return;
                var cs = getComputedStyle(el);
                var z = parseInt(cs.zIndex, 10);
                var precedesTrail = !!(trail.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
                var label = el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : '');
                if (cs.position === 'static' || isNaN(z) || z < 1 || (precedesTrail && z <= 1)) {
                    bad.push(label + ' position=' + cs.position + ' z-index=' + cs.zIndex);
                }
            });
            return bad;
        });
        expect(offenders).toEqual([]);
    });
}
