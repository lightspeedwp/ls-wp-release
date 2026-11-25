'use strict';

/**
 * In-process tests for sub-skills/multi-package-release/scripts/validate-package-group.js.
 *
 * Loads the real GroupValidator class with require() so V8 coverage sees it. Covers config loading,
 * group resolution, group/package config validation, version extraction (plugin, theme, JSON),
 * semver and constraint checks, dependency validation, breaking change detection, git state checks
 * (against throwaway temp repos and a stubbed execGit), env-var option defaults and the report output.
 * Git fixtures and the real execGit calls run with an isolated git environment (see helpers/isolated-git.cjs),
 * and the three RELEASE_* switches are reset to their defaults for every test and restored afterwards.
 * The require.main CLI block cannot be reached in-process.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isolatedGitEnv, runGit } = require('./helpers/isolated-git.cjs');

const SCRIPT = path.join(__dirname, '..', 'sub-skills/multi-package-release/scripts/validate-package-group.js');
const GroupValidator = require(SCRIPT);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pkggroup-'));
let counter = 0;
let logSpy;

function tmpDir() {
  const dir = path.join(tmpRoot, `d${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Temporary HOME and empty template directory shared by every fixture repository in this file.
const gitHome = path.join(tmpRoot, 'git-home');
fs.mkdirSync(path.join(gitHome, 'empty-template'), { recursive: true });

function git(cwd, args) {
  return runGit(args, cwd, gitHome);
}

function makeRepo(branch, files) {
  const dir = tmpDir();
  git(dir, ['init', '-q', '-b', branch, `--template=${path.join(gitHome, 'empty-template')}`]);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

function writeConfig(config) {
  const file = path.join(tmpDir(), 'groups.json');
  fs.writeFileSync(file, typeof config === 'string' ? config : JSON.stringify(config));
  return file;
}

function validGroup(overrides = {}) {
  return {
    id: 'g1',
    name: 'Group One',
    versionStrategy: 'locked',
    releaseOrder: ['a', 'b'],
    packages: [
      { id: 'a', repo: 'o/a', type: 'plugin', versionFile: 'a.php', versionField: 'Version' },
      { id: 'b', repo: 'o/b', type: 'theme', versionFile: 'style.css', versionField: 'Version' }
    ],
    ...overrides
  };
}

function output() {
  return logSpy.mock.calls.map(c => c.join(' ')).join('\n');
}

// Release switches the script reads from the environment, with the defaults the tests assume.
const RELEASE_SWITCHES = ['RELEASE_VALIDATE_STRICT', 'RELEASE_VALIDATE_DEPS', 'RELEASE_CHECK_BREAKING'];

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  // Unset the switches so a configured developer shell cannot change the defaults under test.
  RELEASE_SWITCHES.forEach((name) => vi.stubEnv(name, undefined));
  // Drop the caller's git variables and use an isolated configuration for the real execGit calls.
  Object.keys(process.env).filter((name) => name.startsWith('GIT_')).forEach((name) => vi.stubEnv(name, undefined));
  Object.entries(isolatedGitEnv(gitHome)).forEach(([name, value]) => vi.stubEnv(name, value));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('constructor', () => {
  test('applies defaults', () => {
    const v = new GroupValidator();
    assert.strictEqual(v.configPath, '.lightspeed/release-groups.json');
    assert.strictEqual(v.groupId, undefined);
    assert.strictEqual(v.strict, false);
    assert.strictEqual(v.validateDeps, true);
    assert.strictEqual(v.checkBreaking, false);
    assert.deepStrictEqual([v.errors, v.warnings, v.info], [[], [], []]);
  });

  test('honours explicit options', () => {
    const v = new GroupValidator({
      configPath: 'x.json', groupId: 'g', strict: true, validateDeps: false, checkBreaking: true
    });
    assert.strictEqual(v.configPath, 'x.json');
    assert.strictEqual(v.groupId, 'g');
    assert.strictEqual(v.strict, true);
    assert.strictEqual(v.validateDeps, false);
    assert.strictEqual(v.checkBreaking, true);
  });

  test('reads environment toggles', () => {
    vi.stubEnv('RELEASE_VALIDATE_STRICT', 'true');
    vi.stubEnv('RELEASE_VALIDATE_DEPS', 'false');
    vi.stubEnv('RELEASE_CHECK_BREAKING', 'true');
    const v = new GroupValidator();
    assert.strictEqual(v.strict, true);
    assert.strictEqual(v.validateDeps, false);
    assert.strictEqual(v.checkBreaking, true);
  });
});

describe('loadConfig', () => {
  test('throws when the file is missing', () => {
    const v = new GroupValidator({ configPath: path.join(tmpRoot, 'nope.json') });
    assert.throws(() => v.loadConfig(), /Config file not found/);
  });

  test('throws on invalid JSON', () => {
    const v = new GroupValidator({ configPath: writeConfig('{not json') });
    assert.throws(() => v.loadConfig(), /Failed to parse config/);
  });

  test('throws when groups array is missing or wrong type', () => {
    for (const cfg of [{}, { groups: 'x' }]) {
      const v = new GroupValidator({ configPath: writeConfig(cfg) });
      assert.throws(() => v.loadConfig(), /Config must have "groups" array/);
    }
  });

  test('loads a valid config and records info', () => {
    const file = writeConfig({ groups: [validGroup()] });
    const v = new GroupValidator({ configPath: file });
    v.loadConfig();
    assert.strictEqual(v.config.groups.length, 1);
    assert.deepStrictEqual(v.info, [`Loaded config from ${file}`]);
  });
});

describe('resolveGroup', () => {
  test('auto-selects a single group', () => {
    const v = new GroupValidator();
    v.config = { groups: [validGroup()] };
    v.resolveGroup();
    assert.strictEqual(v.groupId, 'g1');
    assert.strictEqual(v.group.name, 'Group One');
    assert.ok(v.info.includes('Using single group: g1'));
  });

  test('requires --group when several groups exist', () => {
    const v = new GroupValidator();
    v.config = { groups: [validGroup(), validGroup({ id: 'g2' })] };
    assert.throws(() => v.resolveGroup(), /Must specify --group/);
  });

  test('finds a group by id', () => {
    const v = new GroupValidator({ groupId: 'g2' });
    v.config = { groups: [validGroup(), validGroup({ id: 'g2', name: 'Two' })] };
    v.resolveGroup();
    assert.strictEqual(v.group.name, 'Two');
  });

  test('throws for an unknown group id', () => {
    const v = new GroupValidator({ groupId: 'zzz' });
    v.config = { groups: [validGroup()] };
    assert.throws(() => v.resolveGroup(), /Group not found: zzz/);
  });
});

describe('validateGroupConfig', () => {
  function run(group) {
    const v = new GroupValidator();
    v.group = group;
    v.validateGroupConfig();
    return v;
  }

  test('accepts a valid group without errors or warnings', () => {
    const v = run(validGroup());
    assert.deepStrictEqual(v.errors, []);
    assert.deepStrictEqual(v.warnings, []);
  });

  test('requires id and stops', () => {
    assert.deepStrictEqual(run({ name: 'x' }).errors, ['Group must have "id"']);
  });

  test('requires name', () => {
    assert.ok(run(validGroup({ name: undefined })).errors.includes('Group must have "name"'));
  });

  test('requires packages array and stops', () => {
    for (const packages of [undefined, 'x']) {
      assert.deepStrictEqual(run(validGroup({ packages })).errors, ['Group must have "packages" array']);
    }
  });

  test('warns about single package groups', () => {
    const v = run(validGroup({ packages: [validGroup().packages[0]], releaseOrder: ['a'] }));
    assert.strictEqual(v.warnings.length, 1);
    assert.match(v.warnings[0], /only 1 package/);
  });

  test('rejects invalid versionStrategy', () => {
    const v = run(validGroup({ versionStrategy: 'weird' }));
    assert.match(v.errors[0], /Invalid versionStrategy: weird\. Must be: locked, independent/);
  });

  test('accepts the independent strategy', () => {
    assert.deepStrictEqual(run(validGroup({ versionStrategy: 'independent' })).errors, []);
  });

  test('requires releaseOrder array', () => {
    for (const releaseOrder of [undefined, 'a']) {
      assert.ok(run(validGroup({ releaseOrder })).errors.includes('Group must have "releaseOrder" array'));
    }
  });

  test('flags unknown and duplicate releaseOrder entries', () => {
    const unknown = run(validGroup({ releaseOrder: ['a', 'ghost'] }));
    assert.deepStrictEqual(unknown.errors, ['Unknown package in releaseOrder: ghost']);
    const dup = run(validGroup({ releaseOrder: ['a', 'a'] }));
    assert.deepStrictEqual(dup.errors, ['Duplicate package IDs in releaseOrder']);
  });
});

describe('validatePackageConfig', () => {
  function run(pkg) {
    const v = new GroupValidator();
    v.validatePackageConfig(pkg);
    return v.errors;
  }

  test('passes a complete package', () => {
    assert.deepStrictEqual(run(validGroup().packages[0]), []);
  });

  test('requires id and stops', () => {
    assert.deepStrictEqual(run({}), ['Package must have "id"']);
  });

  test('reports every missing field', () => {
    const errors = run({ id: 'p' });
    assert.strictEqual(errors.length, 4);
    assert.ok(errors.some(e => e.includes('missing "repo"')));
    assert.ok(errors.some(e => e.includes('invalid type "undefined". Must be: plugin, theme, library')));
    assert.ok(errors.some(e => e.includes('missing "versionFile"')));
    assert.ok(errors.some(e => e.includes('missing "versionField"')));
  });

  test('accepts library type', () => {
    assert.deepStrictEqual(run({ id: 'p', repo: 'r', type: 'library', versionFile: 'f', versionField: 'version' }), []);
  });
});

describe('extractVersion', () => {
  const v = new GroupValidator();

  test('reads plugin header versions', () => {
    const php = '<?php\n/**\n * Plugin Name: X\n * Version: 1.2.3\n */';
    assert.strictEqual(v.extractVersion(php, 'Version', 'plugin'), '1.2.3');
  });

  test('reads theme stylesheet versions', () => {
    assert.strictEqual(v.extractVersion('/*\nTheme Name: T\nVersion: 4.5.6\n*/', 'Version', 'theme'), '4.5.6');
  });

  test('reads JSON package versions', () => {
    const json = '{ "name": "x", "version": "2.0.0-beta.1" }';
    assert.strictEqual(v.extractVersion(json, 'version', 'library'), '2.0.0-beta.1');
  });

  test('falls through to JSON when the plugin header is absent', () => {
    assert.strictEqual(v.extractVersion('{"version": "3.0.0"}', 'version', 'plugin'), '3.0.0');
  });

  test('returns null when nothing matches', () => {
    assert.strictEqual(v.extractVersion('nothing here', 'Version', 'plugin'), null);
    assert.strictEqual(v.extractVersion('nothing here', 'Version', 'theme'), null);
    assert.strictEqual(v.extractVersion('{"name": "x"}', 'version', 'library'), null);
    assert.strictEqual(v.extractVersion('"version": 5', 'version', 'library'), null);
    assert.strictEqual(v.extractVersion('{"version": "1.0.0"}', 'other', 'library'), null);
  });
});

describe('isValidSemVer and isValidConstraint', () => {
  const v = new GroupValidator();

  test('isValidSemVer', () => {
    for (const ok of ['1.0.0', '10.20.30', '1.0.0-beta.1', '1.0.0+build.5', '1.0.0-rc.1+sha.5']) {
      assert.strictEqual(v.isValidSemVer(ok), true, ok);
    }
    for (const bad of ['1.0', '1', 'v1.0.0', '1.0.0.0', '', 'a.b.c']) {
      assert.strictEqual(v.isValidSemVer(bad), false, bad);
    }
  });

  test('isValidConstraint semver type', () => {
    for (const ok of ['^1.0.0', '~1.2', '>2.0', '1.0.0']) {
      assert.strictEqual(v.isValidConstraint(ok, 'semver'), true, ok);
    }
    // Known quirk: the prefix class matches one char only, so two-char operators like >= are rejected.
    assert.strictEqual(v.isValidConstraint('>=2.0', 'semver'), false);
    assert.strictEqual(v.isValidConstraint('latest', 'semver'), false);
  });

  test('isValidConstraint min type', () => {
    assert.strictEqual(v.isValidConstraint('6.4', 'min'), true);
    assert.strictEqual(v.isValidConstraint('6', 'min'), true);
    assert.strictEqual(v.isValidConstraint('abc', 'min'), false);
  });

  test('isValidConstraint rejects unknown types', () => {
    assert.strictEqual(v.isValidConstraint('1.0.0', 'other'), false);
    assert.strictEqual(v.isValidConstraint('1.0.0', undefined), false);
  });
});

describe('validatePackageVersions', () => {
  function run(pkg, files) {
    const dir = tmpDir();
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
    const v = new GroupValidator();
    v.validatePackageVersions({ ...pkg, path: dir });
    return v;
  }

  test('records the version for a valid file', () => {
    const v = run(validGroup().packages[0], { 'a.php': '/* Version: 1.2.3 */' });
    assert.deepStrictEqual(v.info, ['Package a: version 1.2.3']);
    assert.deepStrictEqual([v.errors, v.warnings], [[], []]);
  });

  test('errors when the version file is missing', () => {
    const v = run(validGroup().packages[0], {});
    assert.match(v.errors[0], /Package a: version file not found: .*a\.php/);
  });

  test('errors when the version cannot be extracted', () => {
    const v = run(validGroup().packages[0], { 'a.php': 'no version' });
    assert.deepStrictEqual(v.errors, ['Package a: could not extract version from a.php']);
  });

  test('warns about non-semver versions', () => {
    const v = run(validGroup().packages[0], { 'a.php': 'Version: 1.2' });
    assert.deepStrictEqual(v.warnings, ['Package a: version "1.2" is not valid semantic versioning']);
    assert.deepStrictEqual(v.info, ['Package a: version 1.2']);
  });

  test('reports read failures as errors', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'a.php')); // a directory: exists but cannot be read as a file
    const v = new GroupValidator();
    v.validatePackageVersions({ ...validGroup().packages[0], path: dir });
    assert.match(v.errors[0], /Package a: failed to read version: /);
  });

  test('defaults the package path to the current directory', () => {
    const v = new GroupValidator();
    v.validatePackageVersions({
      id: 'x', type: 'plugin', versionFile: 'definitely-missing-file.php', versionField: 'Version'
    });
    assert.ok(v.errors[0].includes(path.join('.', 'definitely-missing-file.php')));
  });
});

describe('validatePackageRepository', () => {
  test('clean repo on main passes silently', () => {
    const dir = makeRepo('main', { 'a.php': 'x' });
    const v = new GroupValidator();
    v.validatePackageRepository({ id: 'a', path: dir });
    assert.deepStrictEqual([v.errors, v.warnings], [[], []]);
  });

  test('accepts develop and master branches', () => {
    for (const branch of ['develop', 'master']) {
      const dir = makeRepo(branch, { 'a.php': 'x' });
      const v = new GroupValidator();
      v.validatePackageRepository({ id: 'a', path: dir });
      assert.deepStrictEqual(v.warnings, [], branch);
    }
  });

  test('flags uncommitted changes, untracked files and unexpected branch', () => {
    const dir = makeRepo('feature/x', { 'a.php': 'x' });
    fs.writeFileSync(path.join(dir, 'a.php'), 'changed');
    fs.writeFileSync(path.join(dir, 'new.txt'), 'new');
    const v = new GroupValidator();
    v.validatePackageRepository({ id: 'a', path: dir });
    assert.deepStrictEqual(v.errors, ['Package a: uncommitted changes detected']);
    assert.ok(v.warnings.includes('Package a: untracked files present'));
    assert.ok(v.warnings.includes('Package a: on branch "feature/x" (expected develop/main/master)'));
  });

  test('warns when the directory is not a git repository', () => {
    const v = new GroupValidator();
    v.validatePackageRepository({ id: 'a', path: path.join(tmpRoot, 'does-not-exist') });
    assert.strictEqual(v.warnings.length, 1);
    assert.match(v.warnings[0], /Package a: could not check repository: Git command failed: git status --porcelain/);
  });
});

describe('ambient environment', () => {
  test('the release switches start unset and the defaults hold in every test', () => {
    RELEASE_SWITCHES.forEach((name) => assert.strictEqual(process.env[name], undefined, `${name} leaked in`));
    const v = new GroupValidator();
    assert.deepStrictEqual([v.strict, v.validateDeps, v.checkBreaking], [false, true, false]);
  });

  test('a hostile GIT_DIR and GIT_WORK_TREE never reach the fixtures or the caller repository', () => {
    const decoy = tmpDir();
    git(decoy, ['init', '-q', `--template=${path.join(gitHome, 'empty-template')}`]);
    const before = git(decoy, ['count-objects', '-v']) + git(decoy, ['for-each-ref']);
    vi.stubEnv('GIT_DIR', path.join(decoy, '.git'));
    vi.stubEnv('GIT_WORK_TREE', decoy);
    vi.stubEnv('GIT_INDEX_FILE', path.join(decoy, '.git', 'index'));
    const fixture = makeRepo('main', { 'a.php': 'x' });
    const after = git(decoy, ['count-objects', '-v']) + git(decoy, ['for-each-ref']);
    assert.strictEqual(after, before);
    assert.ok(fs.existsSync(path.join(fixture, '.git')));
    assert.strictEqual(git(fixture, ['rev-parse', '--show-toplevel']).trim(), fs.realpathSync(fixture));
  });
});

describe('execGit', () => {
  test('returns trimmed-capable output from git', () => {
    const dir = makeRepo('main', { 'a.php': 'x' });
    const v = new GroupValidator();
    assert.strictEqual(v.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], dir).trim(), 'main');
  });

  test('wraps failures with the command text', () => {
    const v = new GroupValidator();
    assert.throws(() => v.execGit(['status'], path.join(tmpRoot, 'missing')), /Git command failed: git status/);
  });

  test('defaults cwd to the current directory', () => {
    const v = new GroupValidator();
    // Whether or not cwd is a repo, the call must either return a string or throw the wrapped error.
    try {
      assert.strictEqual(typeof v.execGit(['--version']), 'string');
    } catch (err) {
      assert.match(err.message, /Git command failed/);
    }
  });
});

describe('validatePackages', () => {
  test('returns immediately without packages', () => {
    const v = new GroupValidator();
    v.group = {};
    v.validatePackages();
    assert.deepStrictEqual(v.errors, []);
  });

  test('skips detailed checks after a config error when not strict', () => {
    const v = new GroupValidator();
    v.group = { packages: [{ id: 'a' }] };
    const versions = vi.spyOn(v, 'validatePackageVersions');
    v.validatePackages();
    assert.strictEqual(versions.mock.calls.length, 0);
    assert.strictEqual(v.errors.length, 4);
  });

  test('runs detailed checks in strict mode even after errors', () => {
    const v = new GroupValidator({ strict: true });
    v.group = { packages: [{ id: 'a', versionFile: 'f', versionField: 'Version' }] };
    const versions = vi.spyOn(v, 'validatePackageVersions').mockImplementation(() => {});
    const repo = vi.spyOn(v, 'validatePackageRepository').mockImplementation(() => {});
    v.validatePackages();
    assert.strictEqual(versions.mock.calls.length, 1);
    assert.strictEqual(repo.mock.calls.length, 1);
  });

  test('runs version and repository checks for valid packages', () => {
    const v = new GroupValidator();
    v.group = { packages: validGroup().packages };
    const versions = vi.spyOn(v, 'validatePackageVersions').mockImplementation(() => {});
    const repo = vi.spyOn(v, 'validatePackageRepository').mockImplementation(() => {});
    v.validatePackages();
    assert.strictEqual(versions.mock.calls.length, 2);
    assert.strictEqual(repo.mock.calls.length, 2);
  });
});

describe('validateDependencies and validateDependency', () => {
  function run(group, dep) {
    const v = new GroupValidator();
    v.group = group;
    v.validateDependency(dep);
    return v;
  }

  test('notes when no dependencies are configured', () => {
    for (const dependencies of [undefined, []]) {
      const v = new GroupValidator();
      v.group = validGroup({ dependencies });
      v.validateDependencies();
      assert.deepStrictEqual(v.info, ['No cross-package dependencies configured']);
    }
  });

  test('validates each configured dependency', () => {
    const v = new GroupValidator();
    v.group = validGroup({
      dependencies: [{ from: 'b', to: 'a', constraint: '^1.0', constraintType: 'semver' }, { from: 'a' }]
    });
    v.validateDependencies();
    assert.deepStrictEqual(v.errors, ['Invalid dependency: missing from/to']);
  });

  test('rejects missing from/to', () => {
    assert.deepStrictEqual(run(validGroup(), { from: 'a' }).errors, ['Invalid dependency: missing from/to']);
    assert.deepStrictEqual(run(validGroup(), { to: 'a' }).errors, ['Invalid dependency: missing from/to']);
  });

  test('rejects self dependency', () => {
    assert.deepStrictEqual(run(validGroup(), { from: 'a', to: 'a' }).errors,
      ['Circular dependency: a depends on itself']);
  });

  test('rejects unknown from package', () => {
    const v = run(validGroup(), { from: 'ghost', to: 'a', constraint: '1.0', constraintType: 'min' });
    assert.deepStrictEqual(v.errors, ['Dependency references unknown package: ghost']);
  });

  test('rejects unknown to package', () => {
    const v = run(validGroup(), { from: 'a', to: 'ghost', constraint: '1.0', constraintType: 'min' });
    assert.deepStrictEqual(v.errors, ['Dependency references unknown package: ghost']);
  });

  test('allows wordpress as a dependency target', () => {
    const v = run(validGroup(), { from: 'a', to: 'wordpress', constraint: '6.4', constraintType: 'min' });
    assert.deepStrictEqual([v.errors, v.warnings], [[], []]);
  });

  test('validates constraint format', () => {
    const v = run(validGroup(), { from: 'b', to: 'a', constraint: 'latest', constraintType: 'semver' });
    assert.deepStrictEqual(v.errors, ['Invalid constraint for b->a: "latest"']);
  });

  test('warns when a dependent releases before its dependency', () => {
    const v = run(validGroup(), { from: 'a', to: 'b', constraint: '^1.0', constraintType: 'semver' });
    assert.deepStrictEqual(v.errors, []);
    assert.strictEqual(v.warnings.length, 1);
    assert.match(v.warnings[0], /a depends on b, but a releases before b/);
  });

  test('no ordering warning when the dependency releases first', () => {
    const v = run(validGroup(), { from: 'b', to: 'a', constraint: '^1.0', constraintType: 'semver' });
    assert.deepStrictEqual([v.errors, v.warnings], [[], []]);
  });
});

describe('detectBreakingChanges', () => {
  function run(packages, files, pkgOverrides = {}) {
    const dir = tmpDir();
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
    const v = new GroupValidator();
    v.group = { packages: packages.map(p => ({ ...p, path: dir, ...pkgOverrides })) };
    v.detectBreakingChanges();
    return v;
  }

  test('warns when the changelog is missing', () => {
    const v = run([{ id: 'a' }], {});
    assert.match(v.warnings[0], /Package a: changelog not found at .*CHANGELOG\.md/);
  });

  test('ignores changelogs without breaking markers', () => {
    const v = run([{ id: 'a' }], { 'CHANGELOG.md': '## 1.0.0\n### Added\n- thing\n' });
    assert.deepStrictEqual([v.info, v.warnings], [[], []]);
  });

  test('extracts bullets from a Breaking section and stops at the next heading', () => {
    const md = '## 2.0.0\n### Breaking\n- removed api\n  - nested\n- renamed hook\n### Added\n- new thing\n';
    const v = run([{ id: 'a' }], { 'CHANGELOG.md': md });
    assert.deepStrictEqual(v.info, ['Package a: contains breaking changes']);
    assert.strictEqual(v.warnings.length, 1);
    assert.ok(v.warnings[0].includes('- removed api'));
    assert.ok(v.warnings[0].includes('- renamed hook'));
    assert.ok(!v.warnings[0].includes('new thing'));
  });

  test('handles BREAKING CHANGE markers and custom changelog names', () => {
    const v = run([{ id: 'a' }], { 'HISTORY.md': 'BREAKING CHANGE\n- gone\n' }, { changelog: 'HISTORY.md' });
    assert.ok(v.warnings[0].includes('- gone'));
  });

  test('records info only when the marker has no bullets', () => {
    const v = run([{ id: 'a' }], { 'CHANGELOG.md': '### Breaking\nnothing listed\n' });
    assert.deepStrictEqual(v.info, ['Package a: contains breaking changes']);
    assert.deepStrictEqual(v.warnings, []);
  });

  test('warns when the changelog cannot be read', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'CHANGELOG.md'));
    const v = new GroupValidator();
    v.group = { packages: [{ id: 'a', path: dir }] };
    v.detectBreakingChanges();
    assert.match(v.warnings[0], /Package a: could not read changelog: /);
  });
});

describe('reportResults', () => {
  test('prints a passing report', () => {
    const v = new GroupValidator();
    v.groupId = 'g1';
    v.info.push('hello');
    v.reportResults();
    const out = output();
    assert.match(out, /Validation Report: g1/);
    assert.match(out, /Info:/);
    assert.match(out, /hello/);
    assert.match(out, /All validations passed!/);
    assert.match(out, /Summary: 0 errors, 0 warnings/);
  });

  test('prints warnings and errors and suppresses the success line', () => {
    const v = new GroupValidator();
    v.warnings.push('careful');
    v.errors.push('broken');
    v.reportResults();
    const out = output();
    assert.match(out, /Warnings:/);
    assert.match(out, /careful/);
    assert.match(out, /Errors:/);
    assert.match(out, /broken/);
    assert.doesNotMatch(out, /All validations passed/);
    assert.match(out, /Summary: 1 errors, 1 warnings/);
  });

  test('strict mode treats warnings as failures in the report', () => {
    const strict = new GroupValidator({ strict: true });
    strict.warnings.push('w');
    strict.reportResults();
    assert.doesNotMatch(output(), /All validations passed/);

    logSpy.mockClear();
    const lax = new GroupValidator();
    lax.warnings.push('w');
    lax.reportResults();
    assert.match(output(), /All validations passed/);
  });
});

describe('validate (end to end)', () => {
  function setup(group, { branch = 'main', dirty = false } = {}) {
    const dirA = makeRepo(branch, { 'a.php': '<?php\n/* Version: 1.0.0 */' });
    const dirB = makeRepo(branch, { 'style.css': '/*\nVersion: 2.0.0\n*/', 'CHANGELOG.md': '### Breaking\n- x\n' });
    if (dirty) fs.writeFileSync(path.join(dirA, 'a.php'), 'dirty');
    const g = group || validGroup();
    g.packages[0].path = dirA;
    g.packages[1].path = dirB;
    return writeConfig({ groups: [g] });
  }

  test('passes for a healthy group', () => {
    const v = new GroupValidator({ configPath: setup() });
    assert.strictEqual(v.validate(), true);
    assert.deepStrictEqual(v.errors, []);
    assert.ok(v.info.includes('Package a: version 1.0.0'));
    assert.ok(v.info.includes('Package b: version 2.0.0'));
    assert.ok(v.info.includes('No cross-package dependencies configured'));
    assert.match(output(), /All validations passed!/);
  });

  test('fails for a dirty repository', () => {
    const v = new GroupValidator({ configPath: setup(null, { dirty: true }) });
    assert.strictEqual(v.validate(), false);
    assert.ok(v.errors.includes('Package a: uncommitted changes detected'));
  });

  test('skips dependency validation when disabled and runs breaking detection when enabled', () => {
    const group = validGroup({ dependencies: [{ from: 'a' }] });
    const v = new GroupValidator({ configPath: setup(group), validateDeps: false, checkBreaking: true });
    assert.strictEqual(v.validate(), true);
    assert.ok(!v.errors.some(e => e.includes('missing from/to')));
    assert.ok(v.info.includes('Package b: contains breaking changes'));
    assert.ok(v.warnings.some(w => w.startsWith('Package a: changelog not found')));
  });

  test('runs dependency validation by default', () => {
    const group = validGroup({ dependencies: [{ from: 'a' }] });
    const v = new GroupValidator({ configPath: setup(group) });
    assert.strictEqual(v.validate(), false);
    assert.ok(v.errors.includes('Invalid dependency: missing from/to'));
  });

  test('turns thrown errors into a fatal error result', () => {
    const v = new GroupValidator({ configPath: path.join(tmpRoot, 'absent.json') });
    assert.strictEqual(v.validate(), false);
    assert.match(v.errors[0], /^Fatal error: Config file not found/);
    assert.match(output(), /Fatal error/);
  });

  test('reports group selection errors as fatal', () => {
    const file = writeConfig({ groups: [validGroup(), validGroup({ id: 'g2' })] });
    const v = new GroupValidator({ configPath: file });
    assert.strictEqual(v.validate(), false);
    assert.match(v.errors[0], /Fatal error: Must specify --group/);
  });

  test('strict mode still validates but returns based on errors only', () => {
    const v = new GroupValidator({ configPath: setup(null, { branch: 'topic' }), strict: true });
    assert.strictEqual(v.validate(), true);
    assert.ok(v.warnings.some(w => w.includes('on branch "topic"')));
    assert.doesNotMatch(output(), /All validations passed/);
  });
});
