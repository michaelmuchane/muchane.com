#!/usr/bin/env node
// Validates public/muchane-cloud/changelog.json against the changelog content
// model (DECISIONS.md "Changelog content model" + "Week-level dating"). Node
// built-ins only, zero deps. Exit 0 = pass; nonzero with per-failure lines.
//
// Run: node scripts/validate-changelog.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '..', 'public', 'muchane-cloud', 'changelog.json');

const failures = [];
function fail(msg) {
  failures.push(msg);
}

const raw = readFileSync(JSON_PATH, 'utf-8');

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('JSON parse failed: ' + e.message);
  process.exit(1);
}

// --- Top-level shape ---
const topKeys = Object.keys(data).sort();
if (topKeys.join(',') !== 'entries,pages') {
  fail('Top-level keys must be exactly ["entries","pages"], got: ' + topKeys.join(','));
}

const entries = data.entries || {};
const pages = data.pages || {};

// Every slug in every pages[*] list exists in entries; every entry's page key exists in pages.
for (const [pageKey, pageDef] of Object.entries(pages)) {
  for (const listName of Object.keys(pageDef)) {
    const list = pageDef[listName];
    if (!Array.isArray(list)) continue;
    for (const slug of list) {
      if (!entries[slug]) {
        fail(`pages["${pageKey}"].${listName} references unknown slug "${slug}"`);
      }
    }
  }
}
for (const [slug, entry] of Object.entries(entries)) {
  if (!pages[entry.page]) {
    fail(`entries["${slug}"].page "${entry.page}" is not a key in pages`);
  }
}

// --- Banned strings anywhere in the raw JSON text ---
const bannedPatterns = [
  { re: /iapply/i, label: 'iapply' },
  { re: /NIIFTY/, label: 'NIIFTY' },
  { re: /\u2014/, label: 'em dash (U+2014)' },
  { re: /\u26A0/, label: 'warning symbol' },
  { re: /\[SEQ/, label: '[SEQ bracket text' },
];
for (const { re, label } of bannedPatterns) {
  if (re.test(raw)) fail(`Banned string found in raw JSON: ${label}`);
}

// Editorial-instruction leak detector (R1): builder-facing sentences must
// never appear inside a transcribed copy field.
const editorialLeakRe = /Promote to a full entry|compact card|OPS LOG|\[SEQ/;

const MONDAY = 1; // Date#getUTCDay() Monday = 1
const dayPrecisionRe = /\d{1,2},\s*\d{4}/;

function formatWeekOf(isoDate) {
  const d = new Date(isoDate + 'T00:00:00Z');
  const formatted = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `Week of ${formatted}`;
}

for (const [slug, entry] of Object.entries(entries)) {
  const p = `entries["${slug}"]`;

  if (entry.slug !== slug) fail(`${p}.slug ("${entry.slug}") does not match its own key`);

  for (const field of ['title', 'summary', 'date_display']) {
    if (typeof entry[field] !== 'string' || entry[field].length === 0) {
      fail(`${p}.${field} must be a non-empty string`);
    }
  }
  if (entry.week_start !== null && typeof entry.week_start !== 'string') {
    fail(`${p}.week_start must be a string or null`);
  }
  if (typeof entry.date_verified !== 'boolean') {
    fail(`${p}.date_verified must be a boolean`);
  }
  if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
    fail(`${p}.tags must be a non-empty string array`);
  }
  if (typeof entry.compact !== 'boolean') {
    fail(`${p}.compact must be a boolean`);
  }
  if (!Array.isArray(entry.shots)) {
    fail(`${p}.shots must be an array`);
  } else {
    entry.shots.forEach((shot, i) => {
      const sp = `${p}.shots[${i}]`;
      if (!shot || typeof shot !== 'object') {
        fail(`${sp} must be an object`);
        return;
      }
      const shotKeys = Object.keys(shot).sort();
      const expectedShotKeys = ['alt', 'caption', 'height', 'src', 'width'];
      if (shotKeys.join(',') !== expectedShotKeys.join(',')) {
        fail(`${sp} keys must be exactly ${expectedShotKeys.join(',')}, got: ${shotKeys.join(',')}`);
      }
      if (typeof shot.src !== 'string' || !shot.src.startsWith('/media/')) {
        fail(`${sp}.src must be a string starting with /media/`);
      }
      if (!Number.isInteger(shot.width) || shot.width <= 0) {
        fail(`${sp}.width must be a positive integer`);
      }
      if (!Number.isInteger(shot.height) || shot.height <= 0) {
        fail(`${sp}.height must be a positive integer`);
      }
      if (typeof shot.alt !== 'string' || !shot.alt) {
        fail(`${sp}.alt must be a non-empty string`);
      }
      if (typeof shot.caption !== 'string' || !shot.caption) {
        fail(`${sp}.caption must be a non-empty string`);
      }
    });
  }

  // Full vs. compact sections shape.
  if (entry.compact) {
    if (entry.sections !== null) {
      fail(`${p}.sections must be null for a compact entry`);
    }
  } else {
    const s = entry.sections;
    if (!s || typeof s !== 'object') {
      fail(`${p}.sections must be an object for a full entry`);
    } else {
      const sectionKeys = Object.keys(s).sort();
      const expected = ['implementation', 'iteration', 'problem', 'sequencing', 'solution'];
      if (sectionKeys.join(',') !== expected.join(',')) {
        fail(`${p}.sections keys must be exactly ${expected.join(',')}, got: ${sectionKeys.join(',')}`);
      }
      if (s.sequencing !== null && typeof s.sequencing !== 'string') {
        fail(`${p}.sections.sequencing must be a string or null`);
      }
      if (typeof s.problem !== 'string' || !s.problem) fail(`${p}.sections.problem must be a non-empty string`);
      if (typeof s.solution !== 'string' || !s.solution) fail(`${p}.sections.solution must be a non-empty string`);
      if (!Array.isArray(s.implementation) || s.implementation.length === 0) {
        fail(`${p}.sections.implementation must be a non-empty string array`);
      }
      if (typeof s.iteration !== 'string' || !s.iteration) fail(`${p}.sections.iteration must be a non-empty string`);

      // Editorial-instruction leak check across every string in sections.
      const stringsToCheck = [s.problem, s.solution, s.iteration, ...(Array.isArray(s.implementation) ? s.implementation : [])];
      for (const str of stringsToCheck) {
        if (typeof str === 'string' && editorialLeakRe.test(str)) {
          fail(`${p} contains an editorial-instruction leak: "${str.slice(0, 60)}..."`);
        }
      }
    }
  }
  if (editorialLeakRe.test(entry.title) || editorialLeakRe.test(entry.summary)) {
    fail(`${p} title/summary contains an editorial-instruction leak`);
  }

  // --- Date model ---
  if (entry.week_start !== null) {
    const d = new Date(entry.week_start + 'T00:00:00Z');
    if (isNaN(d.getTime())) {
      fail(`${p}.week_start "${entry.week_start}" does not parse as an ISO date`);
    } else {
      if (d.getUTCDay() !== MONDAY) {
        fail(`${p}.week_start "${entry.week_start}" is not a Monday`);
      }
      const expectedDisplay = formatWeekOf(entry.week_start);
      const actual = entry.date_display;
      if (actual !== expectedDisplay && !actual.startsWith(expectedDisplay + ' ')) {
        fail(`${p}.date_display "${actual}" does not match "${expectedDisplay}" (with optional suffix)`);
      }
    }
  } else {
    if (dayPrecisionRe.test(entry.date_display)) {
      fail(`${p}.date_display "${entry.date_display}" contains a day-precision date but week_start is null`);
    }
  }
}

if (failures.length > 0) {
  console.error(`changelog validation FAILED (${failures.length} issue(s)):`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}

console.log(`changelog validation passed: ${Object.keys(entries).length} entries, ${Object.keys(pages).length} pages.`);
process.exit(0);
