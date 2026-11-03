'use strict';

// Fixture tests for the sub-skill helper scripts: read-only use must not write,
// --output must stay inside the working directory, and git arguments must never
// reach a shell. Everything runs in temporary directories using Node's built-in runner.

const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const AUDIT = path.join(ROOT, 'sub-skills/release-approval-workflow/scripts/audit-log-approval.js');
const REPORT = path.join(ROOT, 'sub-skills/release-approval-workflow/scripts/generate-approval-report.js');
const GROUP = path.join(ROOT, 'sub-skills/multi-package-release/scripts/validate-package-group.js');
const tempDirs = [];

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  tempDirs.push(dir);
  return dir;
}

function node(script, args, cwd, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    env: { HOME: cwd, PATH: '', ...env },
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

after(() => tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

// --- audit-log-approval.js -------------------------------------------------

test('audit log: read-only commands do not create the audit directory', () => {
  ['--report', '--export', '--verify'].forEach((command) => {
    const cwd = tempDir('ls-wp-release-audit-');
    const result = node(AUDIT, [command, '--version', '1.0.0'], cwd, { AUDIT_SIGN_KEY: 'test-key' });
    assert.strictEqual(result.status, 0, `${command}: ${result.stderr}`);
    assert.deepStrictEqual(snapshot(cwd), [], `${command} wrote to the working directory`);
  });
});

test('audit log: a missing audit directory reports an empty trail', () => {
  const cwd = tempDir('ls-wp-release-audit-');
  const result = node(AUDIT, ['--report', '--version', '1.0.0'], cwd, { AUDIT_SIGN_KEY: 'test-key' });
  assert.match(result.stdout, /No audit trail found for version 1\.0\.0/);
});

test('audit log: logging an event still creates the directory and writes the entry', () => {
  const cwd = tempDir('ls-wp-release-audit-');
  const args = ['--log-approval', '--version', '1.0.0', '--approval-id', 'APR-1', '--stage', 'qa', '--user', 'a@example.com'];
  const result = node(AUDIT, args, cwd, { AUDIT_SIGN_KEY: 'test-key' });
  assert.strictEqual(result.status, 0, result.stderr);
  const file = path.join(cwd, '.approval-audit', 'audit-1.0.0-APR-1.jsonl');
  assert.ok(fs.existsSync(file), 'audit entry file was not written');
  assert.ok(fs.existsSync(path.join(cwd, '.approval-audit', '_index.json')), 'index was not written');
});

test('audit log: a logged trail can be read back and verified', () => {
  const cwd = tempDir('ls-wp-release-audit-');
  const env = { AUDIT_SIGN_KEY: 'test-key' };
  node(AUDIT, ['--log-approval', '--version', '1.0.0', '--approval-id', 'APR-1', '--stage', 'qa'], cwd, env);
  const result = node(AUDIT, ['--verify', '--version', '1.0.0'], cwd, env);
  assert.strictEqual(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.strictEqual(summary.total_entries, 1);
  assert.strictEqual(summary.valid_entries, 1);
});

// --- generate-approval-report.js -------------------------------------------

function reportProject() {
  const cwd = tempDir('ls-wp-release-report-');
  fs.mkdirSync(path.join(cwd, '.approval-data'));
  fs.writeFileSync(
    path.join(cwd, '.approval-data', 'approval-v1.0.0.json'),
    JSON.stringify({
      release_version: '1.0.0',
      approval_id: 'APR-1',
      status: 'approved',
      requested_at: '2026-11-01T00:00:00Z',
      requested_by: 'a@example.com',
      stages: { qa: { status: 'approved', approved_by: 'b@example.com', approved_at: '2026-11-01T01:00:00Z' } },
    })
  );
  return cwd;
}

test('approval report: --output inside the working directory is written', () => {
  const cwd = reportProject();
  const result = node(REPORT, ['--version', '1.0.0', '--format', 'json', '--output', 'report.json'], cwd);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(cwd, 'report.json'), 'utf8')).approval_id, 'APR-1');
});

test('approval report: --output outside the working directory is refused and nothing is written', () => {
  const cwd = reportProject();
  const elsewhere = tempDir('ls-wp-release-elsewhere-');
  [path.join(elsewhere, 'report.json'), '../escaped.json'].forEach((output) => {
    const result = node(REPORT, ['--version', '1.0.0', '--format', 'json', '--output', output], cwd);
    assert.strictEqual(result.status, 1, `${output} was accepted`);
    assert.match(result.stderr, /inside the current working directory/);
  });
  assert.deepStrictEqual(fs.readdirSync(elsewhere), []);
  assert.ok(!fs.existsSync(path.join(path.dirname(cwd), 'escaped.json')));
});

test('approval report: --output into a missing directory or onto a directory is refused', () => {
  const cwd = reportProject();
  fs.mkdirSync(path.join(cwd, 'out'));
  const missing = node(REPORT, ['--version', '1.0.0', '--output', 'nope/report.md'], cwd);
  assert.strictEqual(missing.status, 1);
  assert.match(missing.stderr, /does not exist/);
  const dir = node(REPORT, ['--version', '1.0.0', '--output', 'out'], cwd);
  assert.strictEqual(dir.status, 1);
  assert.match(dir.stderr, /is a directory/);
});

test('approval report: without --output the report goes to stdout and nothing is written', () => {
  const cwd = reportProject();
  const before = snapshot(cwd);
  const result = node(REPORT, ['--version', '1.0.0', '--format', 'json'], cwd);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(JSON.parse(result.stdout).approval_id, 'APR-1');
  assert.deepStrictEqual(snapshot(cwd), before);
});

// --- validate-package-group.js ---------------------------------------------

test('package group: git arguments are never interpreted by a shell', () => {
  const repo = tempDir('ls-wp-release-group-');
  const git = (args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  assert.strictEqual(git(['init', '-q']).status, 0, 'git is required for this test');
  git(['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'init']);

  const GroupValidator = require(GROUP);
  const validator = new GroupValidator({});

  // The command substitution would create the marker file if a shell ran it.
  const marker = path.join(repo, 'PWNED');
  try {
    validator.execGit(['log', `--format=$(touch ${marker})`], repo);
  } catch (err) {
    assert.match(err.message, /Git command failed/);
  }
  assert.ok(!fs.existsSync(marker), 'a shell executed part of the git arguments');

  // Normal use, including a working directory with a space, still works.
  const spaced = path.join(repo, 'dir with space');
  fs.mkdirSync(spaced);
  assert.strictEqual(validator.execGit(['rev-parse', '--is-inside-work-tree'], spaced).trim(), 'true');
});

test('package group: a failing git command still reports "Git command failed"', () => {
  const dir = tempDir('ls-wp-release-group-');
  const GroupValidator = require(GROUP);
  assert.throws(() => new GroupValidator({}).execGit(['status'], dir), /Git command failed: git status/);
});
