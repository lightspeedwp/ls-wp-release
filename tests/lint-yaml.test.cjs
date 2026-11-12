'use strict';

// Behaviour tests for the `lint:yaml` npm script in package.json.
// The script string is run directly with `sh -c` against a mock `yamllint`
// on an otherwise empty PATH, so no real yamllint, npm install or network is needed.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LINT_YAML = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).scripts['lint:yaml'];
const tempDirs = [];

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// PATH contains only a symlink to `find`, so a real yamllint on the host can never leak in.
function resolveTool(name) {
  const found = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, `${name} is required to run this test`);
  return found;
}

// mock: undefined = yamllint absent, otherwise the body of a mock yamllint script
function run({ mock, yamlFiles = ['.lefthook.yml'] }) {
  const project = tempDir('ls-wp-release-yaml-');
  const bin = tempDir('ls-wp-release-bin-');
  fs.symlinkSync(resolveTool('find'), path.join(bin, 'find'));
  yamlFiles.forEach((name) => {
    fs.mkdirSync(path.dirname(path.join(project, name)), { recursive: true });
    fs.writeFileSync(path.join(project, name), 'key: value\n');
  });
  if (mock !== undefined) {
    const mockPath = path.join(bin, 'yamllint');
    fs.writeFileSync(mockPath, `#!/bin/sh\n${mock}\n`);
    fs.chmodSync(mockPath, 0o755);
  }
  return spawnSync('/bin/sh', ['-c', LINT_YAML], {
    cwd: project,
    env: { HOME: project, PATH: bin },
    encoding: 'utf8',
  });
}

// process.on('exit') keeps this compatible with Node 18.0 (node:test after() needs 18.8).
process.on('exit', () => tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test('missing yamllint fails and says YAML lint was not run', () => {
  const result = run({ mock: undefined });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /yamllint is not installed/);
  assert.match(result.stderr, /NOT run/);
});

test('yamllint success passes', () => {
  assert.strictEqual(run({ mock: 'exit 0' }).status, 0);
});

test('yamllint failure keeps its exit code and diagnostic', () => {
  const result = run({ mock: 'echo "mock-yamllint: syntax error on line 3" >&2; exit 1' });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /mock-yamllint: syntax error on line 3/);
});

test('yamllint receives the YAML files that exist', () => {
  const result = run({ mock: 'echo "args: $*"; exit 0', yamlFiles: ['.lefthook.yml', '.github/workflows/ci.yml'] });
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /\.lefthook\.yml/);
  assert.match(result.stdout, /\.github\/workflows\/ci\.yml/);
});

test('zero YAML files is reported as nothing linted, not as a pass', () => {
  const result = run({ mock: 'exit 0', yamlFiles: [] });
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /nothing was linted/);
});

// ---- The real pre-commit `yaml-lint` hook command from .lefthook.yml ----
// The hook runs through `sh`, which is dash on many Linux systems, so it must stay POSIX.
// The command is extracted from the file and run against a mock `yamllint` on an empty PATH.

function readHookCommand() {
  const lines = fs.readFileSync(path.join(__dirname, '..', '.lefthook.yml'), 'utf8').split('\n');
  const start = lines.findIndex((line) => /^ {4}yaml-lint:/.test(line));
  assert.ok(start >= 0, 'yaml-lint hook not found in .lefthook.yml');
  const runAt = lines.findIndex((line, i) => i > start && /^ {6}run: \|/.test(line));
  assert.ok(runAt > start, 'yaml-lint run block not found');
  const body = [];
  for (let i = runAt + 1; i < lines.length && /^ {8}/.test(lines[i]); i += 1) {
    body.push(lines[i].slice(8));
  }
  return body.join('\n').replace('{staged_files}', 'sample.yml');
}

// dash is used when the host has it; otherwise /bin/sh. The static check below covers bash-only syntax.
function posixShell() {
  const dash = spawnSync('sh', ['-c', 'command -v dash'], { encoding: 'utf8' }).stdout.trim();
  return dash || '/bin/sh';
}

function runHook(mock) {
  const project = tempDir('ls-wp-release-hook-');
  const bin = tempDir('ls-wp-release-hookbin-');
  if (mock !== undefined) {
    const mockPath = path.join(bin, 'yamllint');
    fs.writeFileSync(mockPath, `#!/bin/sh\n${mock}\n`);
    fs.chmodSync(mockPath, 0o755);
  }
  return spawnSync(posixShell(), ['-c', readHookCommand()], {
    cwd: project,
    env: { HOME: project, PATH: bin },
    encoding: 'utf8',
  });
}

test('yaml-lint hook command uses no bash-only redirection', () => {
  assert.doesNotMatch(readHookCommand(), /&>/);
});

test('yaml-lint hook runs yamllint when it is installed', () => {
  const result = runHook('echo "mock-yamllint ran with: $*"; exit 0');
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /mock-yamllint ran with: sample\.yml/);
  assert.doesNotMatch(result.stdout + result.stderr, /not installed/);
});

test('yaml-lint hook blocks the commit when yamllint is missing', () => {
  const result = runHook(undefined);
  assert.strictEqual(result.status, 1);
  assert.match(result.stdout, /yamllint is not installed/);
});

test('yaml-lint hook keeps the yamllint failure status and output', () => {
  const result = runHook('echo "mock-yamllint: bad indentation" >&2; exit 1');
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /mock-yamllint: bad indentation/);
  assert.doesNotMatch(result.stdout, /not installed/);
});
