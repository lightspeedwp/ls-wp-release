'use strict';

// Fixture tests for the sub-skill helper scripts: read-only use must not write,
// --output must stay inside the working directory, and git arguments must never
// reach a shell. Everything runs in temporary directories using Node's built-in runner.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { initFixtureRepo, runGit, withIsolatedGitEnv } = require('./helpers/isolated-git.cjs');

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

// process.on('exit') keeps this compatible with Node 18.0 (node:test after() needs 18.8).
process.on('exit', () => tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

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

test('approval report: an output symlink to an external file is refused and the target is unchanged', () => {
  const cwd = reportProject();
  const elsewhere = tempDir('ls-wp-release-elsewhere-');
  const external = path.join(elsewhere, 'precious.txt');
  fs.writeFileSync(external, 'keep me');
  fs.symlinkSync(external, path.join(cwd, 'link.json'));
  const result = node(REPORT, ['--version', '1.0.0', '--format', 'json', '--output', 'link.json'], cwd);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /must not be a symbolic link/);
  assert.strictEqual(fs.readFileSync(external, 'utf8'), 'keep me');
});

test('approval report: a dangling output symlink is refused and no external file is created', () => {
  const cwd = reportProject();
  const elsewhere = tempDir('ls-wp-release-elsewhere-');
  const missing = path.join(elsewhere, 'created-by-attack.txt');
  fs.symlinkSync(missing, path.join(cwd, 'dangling.json'));
  const result = node(REPORT, ['--version', '1.0.0', '--format', 'json', '--output', 'dangling.json'], cwd);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /must not be a symbolic link/);
  assert.ok(!fs.existsSync(missing), 'the report was written through the dangling link');
});

test('approval report: an output symlink to a file inside the working directory is also refused', () => {
  const cwd = reportProject();
  fs.writeFileSync(path.join(cwd, 'real.json'), 'original');
  fs.symlinkSync(path.join(cwd, 'real.json'), path.join(cwd, 'alias.json'));
  const result = node(REPORT, ['--version', '1.0.0', '--format', 'json', '--output', 'alias.json'], cwd);
  assert.strictEqual(result.status, 1);
  assert.strictEqual(fs.readFileSync(path.join(cwd, 'real.json'), 'utf8'), 'original');
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
  const home = tempDir('ls-wp-release-home-');
  initFixtureRepo(repo, home);

  withIsolatedGitEnv(home, () => {
    const GroupValidator = require(GROUP);
    const validator = new GroupValidator({});

    // The command substitution would create the marker file if a shell ran it.
    const marker = path.join(repo, 'PWNED');
    assert.throws(() => validator.execGit(['log', `--format=$(touch ${marker})`], repo), /Git command failed/);
    assert.ok(!fs.existsSync(marker), 'a shell executed part of the git arguments');

    // Normal use, including a working directory with a space, still works.
    const spaced = path.join(repo, 'dir with space');
    fs.mkdirSync(spaced);
    assert.strictEqual(validator.execGit(['rev-parse', '--is-inside-work-tree'], spaced).trim(), 'true');
  });
});

test('git fixtures ignore a hostile caller environment and never touch the caller repository', () => {
  const decoy = tempDir('ls-wp-release-decoy-');
  const decoyHome = tempDir('ls-wp-release-decoyhome-');
  const repo = tempDir('ls-wp-release-fixture-');
  const home = tempDir('ls-wp-release-home-');
  runGit(['init', '-q'], decoy, decoyHome);
  const before = snapshot(path.join(decoy, '.git'));
  const saved = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE };
  process.env.GIT_DIR = path.join(decoy, '.git');
  process.env.GIT_WORK_TREE = decoy;
  try {
    initFixtureRepo(repo, home);
    withIsolatedGitEnv(home, () => {
      const GroupValidator = require(GROUP);
      assert.strictEqual(new GroupValidator({}).execGit(['rev-parse', '--show-toplevel'], repo).trim(), repo);
    });
  } finally {
    Object.entries(saved).forEach(([name, value]) => {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    });
  }
  assert.ok(fs.existsSync(path.join(repo, '.git')), 'the fixture repository was not created in its own directory');
  assert.deepStrictEqual(snapshot(path.join(decoy, '.git')), before, 'the caller repository was modified');
});

test('package group: a failing git command still reports "Git command failed"', () => {
  const dir = tempDir('ls-wp-release-group-');
  const home = tempDir('ls-wp-release-home-');
  withIsolatedGitEnv(home, () => {
    const GroupValidator = require(GROUP);
    assert.throws(() => new GroupValidator({}).execGit(['status'], dir), /Git command failed: git status/);
  });
});
