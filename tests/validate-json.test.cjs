'use strict';

// Fixture tests for scripts/validate-json.js.
// Each case copies the script into a temporary project, runs it from an unrelated
// working directory with an empty PATH, and never touches the real repository.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'validate-json.js');
const tempDirs = [];

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeProject(files = {}) {
  const root = tempDir('ls-wp-release-json-');
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(root, 'scripts', 'validate-json.js'));
  Object.entries(files).forEach(([name, content]) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  });
  return root;
}

function run(root, args = []) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-json.js'), ...args], {
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

test('valid JSON passes', () => {
  const root = makeProject({ 'good.json': '{"a": 1}' });
  const result = run(root, ['good.json']);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /1 JSON file\(s\) valid/);
});

test('invalid JSON fails', () => {
  const root = makeProject({ 'bad.json': '{"a": ' });
  const result = run(root, ['bad.json']);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JSON validation failed/);
});

test('a missing required .json file fails and is not reported as valid', () => {
  const root = makeProject();
  const result = run(root, ['missing.json']);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /File not found: missing\.json/);
  assert.doesNotMatch(result.stdout, /JSON file\(s\) valid/);
});

test('one missing file among valid files still fails', () => {
  const root = makeProject({ 'good.json': '{}' });
  const result = run(root, ['good.json', 'missing.json']);
  assert.strictEqual(result.status, 1);
});

test('non-.json input is skipped and nothing is reported as valid', () => {
  const root = makeProject({ 'notes.txt': 'hello' });
  const result = run(root, ['notes.txt']);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /No JSON files were validated/);
  assert.doesNotMatch(result.stdout, /JSON file\(s\) valid/);
});

test('default files are validated when no arguments are given', () => {
  const root = makeProject({ '.markdownlint.json': '{}', 'package.json': '{}' });
  const result = run(root);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /2 JSON file\(s\) valid/);
});

test('missing default files fail', () => {
  const root = makeProject({ 'package.json': '{}' });
  const result = run(root);
  assert.strictEqual(result.status, 1);
});

test('relative paths resolve from the script root, including paths with spaces', () => {
  const root = makeProject({ 'sub dir/with space.json': '{"ok": true}' });
  const result = run(root, ['sub dir/with space.json']);
  assert.strictEqual(result.status, 0);
});

test('validation does not write to the project', () => {
  const root = makeProject({ 'good.json': '{}' });
  const before = snapshot(root);
  run(root, ['good.json']);
  assert.deepStrictEqual(snapshot(root), before);
});
