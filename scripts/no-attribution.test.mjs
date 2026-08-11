import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [
  'README.md',
  '.github/ISSUE_TEMPLATE/config.yml',
  'bootstrap.sh',
  'bootstrap.ps1',
  'install.sh',
  'install.ps1',
  'uninstall.sh',
  'apps/backend/src',
  'apps/frontend/index.html',
  'apps/frontend/src',
  'scripts/check-for-update.mjs',
];

async function sourceFiles(path) {
  const absolute = resolve(root, path);
  const entries = await readdir(absolute, { withFileTypes: true }).catch(() => null);
  if (!entries) return [absolute];
  const nested = await Promise.all(entries.map((entry) => sourceFiles(join(path, entry.name))));
  return nested.flat();
}

test('production, install, and user-facing files contain no broker or referral attribution', async () => {
  const paths = (await Promise.all(roots.map(sourceFiles))).flat()
    .filter((path) => !/\.(?:test|spec)\.[^.]+$/.test(path))
    .filter((path) => ['', '.html', '.js', '.mjs', '.md', '.ps1', '.sh', '.ts', '.tsx', '.yml'].includes(extname(path)));
  const forbidden = [
    ['Gate broker header', /X-Gate-Channel-Id|BROKER_CHANNEL_ID/],
    ['referral query parameter', /[?&](?:ref|referral|affiliate|invite|partner|campaign|utm_[a-z]+)=/i],
    ['upstream operational repository', /your-quantguy\/gate-crossex/i],
    ['product-prefixed external client reference', /(?:clientOrderId\s*=|\btext:)\s*`gct-/],
  ];
  const violations = [];
  for (const path of paths) {
    const content = await readFile(path, 'utf8');
    for (const [label, pattern] of forbidden) {
      if (pattern.test(content)) violations.push(`${path.slice(root.length + 1)}: ${label}`);
    }
  }
  assert.deepEqual(violations, []);
});
