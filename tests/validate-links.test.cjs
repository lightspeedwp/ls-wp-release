'use strict';

// Fixture tests for scripts/validate-links.js.
// The script is copied into a temporary project and run network-free from an
// unrelated working directory with an empty PATH.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'validate-links.js');
const tempDirs = [];

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeProject(files = {}) {
  const root = tempDir('ls-wp-release-links-');
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts', 'validate-links.js'));
  Object.entries(files).forEach(([name, content]) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  });
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-links.js')], {
    cwd: tempDir('ls-wp-release-cwd-'),
    env: { HOME: root, PATH: '' },
    encoding: 'utf8',
  });
}

// Lists every path and file content under dir, so any write or modification shows up.
function snapshot(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      const rel = path.relative(base, full);
      return entry.isDirectory() ? [`${rel}/`, ...snapshot(full, base)] : [`${rel}:${fs.readFileSync(full, 'utf8')}`];
    })
    .sort();
}

afterAll(() => tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test('relative links to existing files resolve', () => {
  const root = makeProject({
    'README.md': '[guide](docs/guide.md)',
    'docs/guide.md': '# Guide',
  });
  const result = run(root);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Broken links: 0/);
});

test('a link to a missing file fails', () => {
  const root = makeProject({ 'README.md': '[gone](docs/gone.md)' });
  const result = run(root);
  assert.strictEqual(result.status, 1);
  assert.match(result.stdout + result.stderr, /File not found/);
});

test('links resolve relative to the file that contains them', () => {
  const root = makeProject({
    'docs/guide.md': '[sibling](other.md)',
    'docs/other.md': '# Other',
  });
  assert.strictEqual(run(root).status, 0);
});

test('external links and anchors are reported as not checked, not as valid', () => {
  const root = makeProject({
    'README.md': '[site](https://example.invalid/page) [top](#top) [file](README.md#section)',
  });
  const result = run(root);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /External links not checked: 1/);
  assert.match(result.stdout, /Anchors not checked: 2/);
  assert.doesNotMatch(result.stdout, /All links are valid/);
  assert.match(result.stdout, /were not checked/);
});

test('an unreachable external link does not fail the run (network-free)', () => {
  const root = makeProject({ 'README.md': '[dead](https://example.invalid/never)' });
  assert.strictEqual(run(root).status, 0);
});

test('validation does not write to the project', () => {
  const root = makeProject({ 'README.md': '[guide](docs/guide.md)', 'docs/guide.md': '# Guide' });
  const before = snapshot(root);
  run(root);
  assert.deepStrictEqual(snapshot(root), before);
});
