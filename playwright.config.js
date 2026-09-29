// Playwright harness for muchane.com. No package.json on purpose: run with
//   npx --package=@playwright/test playwright test
// This repo has no node_modules of its own, so the FIRST time this suite
// runs, symlink one at the repo root to whatever npx just installed, e.g.:
//   ln -s "$(dirname "$(dirname "$(npx --package=@playwright/test node -e \
//     'console.log(require.resolve(\"@playwright/test\"))')")")" node_modules
// (node_modules/ is already gitignored, so the symlink never ships.) With
// that symlink in place, tests/cursor-trail.spec.js's plain
// require('@playwright/test') resolves normally, and so does the
// `defineConfig` this file could otherwise use (a plain exported object
// behaves identically; defineConfig only adds TypeScript types).
module.exports = {
    testDir: 'tests',
    timeout: 30000,
    retries: 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:4173',
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
        colorScheme: 'dark',
    },
    webServer: {
        command: 'npx serve public -l 4173',
        url: 'http://localhost:4173/',
        reuseExistingServer: true,
        timeout: 30000,
    },
};
