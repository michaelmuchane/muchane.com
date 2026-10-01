// Guard spec for the Muchane Cloud changelog pages. Red-first for the
// id collision between a changelog entry slug and the #cursor-trail canvas,
// which turned the entry card into a fixed sheet covering the page. Run with:
//   npx --package=@playwright/test playwright test tests/changelog-layout.spec.js
// No package.json on purpose; see playwright.config.js.
const { test, expect } = require('@playwright/test');

const CHANGELOG_ROUTES = [
    '/muchane-cloud',
    '/muchane-cloud/career-command-center',
    '/muchane-cloud/self-hosted-infra',
];

async function loadRendered(page, route) {
    await page.goto(route);
    await expect(page.getByTestId('cursor-trail')).toHaveCount(1);
    await expect(page.locator('[data-changelog] .entry').first()).toBeAttached();
}

for (const route of CHANGELOG_ROUTES) {
    test(`every id in the rendered document is unique: ${route}`, async ({ page }) => {
        await loadRendered(page, route);
        const dupes = await page.evaluate(() => {
            var seen = {};
            document.querySelectorAll('[id]').forEach(function (el) {
                if (!el.id) return;
                seen[el.id] = (seen[el.id] || 0) + 1;
            });
            return Object.keys(seen).filter(function (id) { return seen[id] > 1; })
                .map(function (id) { return id + ' x' + seen[id]; });
        });
        expect(dupes).toEqual([]);
    });

    test(`no opaque fixed non-canvas element covers more than 40% of the viewport: ${route}`, async ({ page }) => {
        await loadRendered(page, route);
        const offenders = await page.evaluate(() => {
            var vw = window.innerWidth, vh = window.innerHeight, area = vw * vh;
            var bad = [];
            document.querySelectorAll('body *').forEach(function (el) {
                if (el.tagName === 'CANVAS') return;
                var cs = getComputedStyle(el);
                if (cs.position !== 'fixed') return;
                if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
                var noColor = cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent';
                if (noColor && cs.backgroundImage === 'none') return;
                var r = el.getBoundingClientRect();
                var w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
                var h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
                var cover = (w * h) / area;
                if (cover > 0.4) {
                    var label = el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : '');
                    bad.push(label + ' covers ' + Math.round(cover * 100) + '% background=' + cs.backgroundColor);
                }
            });
            return bad;
        });
        expect(offenders).toEqual([]);
    });
}
