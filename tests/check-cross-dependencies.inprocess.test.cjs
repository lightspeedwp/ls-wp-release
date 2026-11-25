'use strict';

/**
 * In-process tests for sub-skills/multi-package-release/scripts/check-cross-dependencies.js.
 *
 * Covers the CrossDependencyChecker class: config loading, group resolution, package metadata
 * (package.json, composer.json, plugin and theme headers), declared and peer dependency
 * resolution, constraint validation, the compatibility matrix, breaking change detection and
 * the console report. The require.main CLI block cannot be reached in-process.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(
  __dirname, '..', 'sub-skills', 'multi-package-release', 'scripts', 'check-cross-dependencies.js'
);
const CrossDependencyChecker = require(SCRIPT);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-deps-'));
let counter = 0;
let logSpy;
let errSpy;

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

/** Build a fixture workspace and return its root and a helper to write the config. */
function makeWorkspace() {
  const root = path.join(tmpRoot, `ws-${++counter}`);
  fs.mkdirSync(root, { recursive: true });
  const p = (...parts) => path.join(root, ...parts);

  write(p('core', 'core.php'), [
    '<?php',
    '/**',
    ' * Plugin Name: Core',
    ' * Version: 2.1.0',
    ' * Requires at least: 6.4',
    ' * Requires PHP: 8.0',
    ' */'
  ].join('\n'));
  write(p('theme', 'style.css'), [
    '/*',
    'Theme Name: Theme',
    'Version: 1.0.0',
    'Requires at least: 6.3',
    'Requires PHP: 7.4',
    '*/'
  ].join('\n'));
  write(p('addon', 'addon.php'), '<?php\n/**\n * Version: 0.5.0\n */\n');

  const pkgs = [
    { id: 'core-plugin', repo: 'ls/core-plugin', type: 'plugin', path: p('core'), versionFile: 'core.php' },
    { id: 'ls-theme', repo: 'ls/theme', type: 'theme', path: p('theme'), versionFile: 'style.css' },
    { id: 'addon', repo: 'ls/addon', type: 'plugin', path: p('addon'), versionFile: 'addon.php' }
  ];
  const writeConfig = (groups) => {
    const file = p('release-groups.json');
    write(file, { groups });
    return file;
  };
  return { root, p, pkgs, writeConfig };
}

function makeChecker(ws, group, opts = {}) {
  const configPath = ws.writeConfig([{ id: 'g1', packages: ws.pkgs, ...group }]);
  return new CrossDependencyChecker({ configPath, ...opts });
}

function output() {
  return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
}

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('constructor', () => {
  test('applies defaults', () => {
    const c = new CrossDependencyChecker();
    assert.strictEqual(c.configPath, '.lightspeed/release-groups.json');
    assert.strictEqual(c.groupId, undefined);
    assert.strictEqual(c.showMatrix, false);
    assert.ok(c.packages instanceof Map);
    assert.deepStrictEqual(c.issues, []);
  });

  test('accepts explicit options', () => {
    const c = new CrossDependencyChecker({ configPath: 'x.json', groupId: 'g', matrix: true });
    assert.strictEqual(c.configPath, 'x.json');
    assert.strictEqual(c.groupId, 'g');
    assert.strictEqual(c.showMatrix, true);
  });
});

describe('loadConfig and resolveGroup', () => {
  test('missing config makes check() fail with a fatal error', () => {
    const c = new CrossDependencyChecker({ configPath: path.join(tmpRoot, 'nope.json') });
    assert.strictEqual(c.check(), false);
    assert.match(errSpy.mock.calls[0][0], /Fatal error: Config not found: .*nope\.json/);
  });

  test('invalid JSON config makes check() fail', () => {
    const file = path.join(tmpRoot, 'bad.json');
    write(file, '{not json');
    const c = new CrossDependencyChecker({ configPath: file });
    assert.strictEqual(c.check(), false);
    assert.match(errSpy.mock.calls[0][0], /^Fatal error:/);
  });

  test('single group is selected automatically', () => {
    const ws = makeWorkspace();
    const c = makeChecker(ws, {});
    c.loadConfig();
    c.resolveGroup();
    assert.strictEqual(c.groupId, 'g1');
    assert.strictEqual(c.group.id, 'g1');
  });

  test('multiple groups without --group is an error', () => {
    const ws = makeWorkspace();
    const configPath = ws.writeConfig([
      { id: 'a', packages: [] },
      { id: 'b', packages: [] }
    ]);
    const c = new CrossDependencyChecker({ configPath });
    assert.strictEqual(c.check(), false);
    assert.match(errSpy.mock.calls[0][0], /Must specify --group/);
  });

  test('selects the requested group among several', () => {
    const ws = makeWorkspace();
    const configPath = ws.writeConfig([
      { id: 'a', packages: [] },
      { id: 'b', packages: [] }
    ]);
    const c = new CrossDependencyChecker({ configPath, groupId: 'b' });
    c.loadConfig();
    c.resolveGroup();
    assert.strictEqual(c.group.id, 'b');
  });

  test('unknown group id is an error', () => {
    const ws = makeWorkspace();
    const c = makeChecker(ws, {}, { groupId: 'missing' });
    assert.strictEqual(c.check(), false);
    assert.match(errSpy.mock.calls[0][0], /Group not found: missing/);
  });
});

describe('package metadata', () => {
  test('reads versions and plugin/theme header requirements', () => {
    const ws = makeWorkspace();
    const c = makeChecker(ws, {});
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();

    const core = c.packages.get('core-plugin');
    assert.strictEqual(core.version, '2.1.0');
    assert.strictEqual(core.capabilities.wordpress, '6.4');
    assert.strictEqual(core.capabilities.php, '8.0');

    const theme = c.packages.get('ls-theme');
    assert.strictEqual(theme.version, '1.0.0');
    assert.strictEqual(theme.capabilities.wordpress, '6.3');
    assert.strictEqual(theme.capabilities.php, '7.4');

    const addon = c.packages.get('addon');
    assert.strictEqual(addon.version, '0.5.0');
    assert.strictEqual(addon.capabilities.wordpress, null);
    assert.strictEqual(addon.capabilities.php, null);
  });

  test('reads package.json and merges composer.json require', () => {
    const ws = makeWorkspace();
    write(ws.p('core', 'package.json'), {
      peerDependencies: { react: '^18' },
      dependencies: { lodash: '^4' },
      keywords: ['blocks', 'seo']
    });
    write(ws.p('core', 'composer.json'), { require: { 'php-di/php-di': '^7' } });
    const c = makeChecker(ws, {});
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();

    const core = c.packages.get('core-plugin');
    assert.deepStrictEqual(core.peerDependencies, { react: '^18' });
    assert.deepStrictEqual(core.dependencies, { lodash: '^4', 'php-di/php-di': '^7' });
    assert.deepStrictEqual(core.features, ['blocks', 'seo']);
  });

  test('composer.json without require leaves dependencies untouched', () => {
    const ws = makeWorkspace();
    write(ws.p('core', 'package.json'), { dependencies: { lodash: '^4' } });
    write(ws.p('core', 'composer.json'), { name: 'x/y' });
    const c = makeChecker(ws, {});
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();
    assert.deepStrictEqual(c.packages.get('core-plugin').dependencies, { lodash: '^4' });
  });

  test('unparseable package.json and composer.json produce warnings', () => {
    const ws = makeWorkspace();
    write(ws.p('core', 'package.json'), '{oops');
    write(ws.p('theme', 'composer.json'), '{oops');
    const c = makeChecker(ws, {});
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();
    assert.deepStrictEqual(c.issues, [
      { level: 'warn', message: 'core-plugin: could not parse package.json' },
      { level: 'warn', message: 'ls-theme: could not parse composer.json' }
    ]);
  });

  test('missing version file yields null version and null headers', () => {
    const ws = makeWorkspace();
    ws.pkgs[0].versionFile = 'gone.php';
    ws.pkgs[1].versionFile = 'gone.css';
    const c = makeChecker(ws, {});
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();
    assert.strictEqual(c.packages.get('core-plugin').version, null);
    assert.strictEqual(c.packages.get('core-plugin').capabilities.wordpress, null);
    assert.strictEqual(c.packages.get('ls-theme').version, null);
    assert.strictEqual(c.packages.get('ls-theme').capabilities.php, null);
  });

  test('version file without a semver yields null', () => {
    const ws = makeWorkspace();
    write(ws.p('addon', 'addon.php'), '<?php // no version here');
    const c = makeChecker(ws, {});
    assert.strictEqual(c.readVersion(ws.pkgs[2]), null);
  });

  test('defaults path to the current directory when omitted', () => {
    const c = new CrossDependencyChecker();
    c.group = { packages: [{ id: 'root', repo: 'r', type: 'library', versionFile: 'package.json' }] };
    c.loadPackageMetadata();
    const meta = c.packages.get('root');
    assert.strictEqual(meta.path, '.');
    assert.ok(meta.version === null || /^\d+\.\d+\.\d+$/.test(meta.version));
  });
});

describe('dependency resolution', () => {
  function loaded(ws, group) {
    const c = makeChecker(ws, group);
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();
    return c;
  }

  test('copies dependencies declared in config', () => {
    const ws = makeWorkspace();
    const dep = { from: 'addon', to: 'core-plugin', constraint: '^2.0.0' };
    const c = loaded(ws, { dependencies: [dep] });
    c.resolveDeclaredDependencies();
    assert.deepStrictEqual(c.dependencies, [dep]);
  });

  test('derives dependencies from npm peerDependencies', () => {
    const ws = makeWorkspace();
    write(ws.p('addon', 'package.json'), {
      peerDependencies: { '@ls/core-plugin': '^2.0.0', react: '^18.0.0' }
    });
    const c = loaded(ws, {});
    c.resolveDeclaredDependencies();
    assert.deepStrictEqual(c.dependencies, [{
      from: 'addon',
      to: 'core-plugin',
      type: 'peer',
      constraint: '^2.0.0',
      constraintType: 'semver',
      source: 'package.json'
    }]);
  });

  test('does not duplicate a peer dependency already declared in config', () => {
    const ws = makeWorkspace();
    write(ws.p('addon', 'package.json'), { peerDependencies: { '@ls/core-plugin': '^2.0.0' } });
    const declared = { from: 'addon', to: 'core-plugin', constraint: '>=2.0.0' };
    const c = loaded(ws, { dependencies: [declared] });
    c.resolveDeclaredDependencies();
    assert.deepStrictEqual(c.dependencies, [declared]);
  });

  test('findPackageByNpmName matches by id, repo and returns null otherwise', () => {
    const ws = makeWorkspace();
    const c = loaded(ws, {});
    assert.strictEqual(c.findPackageByNpmName('@ls/core-plugin'), 'core-plugin');
    assert.strictEqual(c.findPackageByNpmName('@scope/theme'), 'ls-theme');
    assert.strictEqual(c.findPackageByNpmName('addon'), 'addon');
    assert.strictEqual(c.findPackageByNpmName('unrelated-lib'), null);
  });
});

describe('validation', () => {
  function prepared(ws, group) {
    const c = makeChecker(ws, group);
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();
    c.resolveDeclaredDependencies();
    return c;
  }

  test('isSatisfied handles ranges, plain minimums and invalid input', () => {
    const c = new CrossDependencyChecker();
    assert.strictEqual(c.isSatisfied('2.1.0', '^2.0.0'), true);
    assert.strictEqual(c.isSatisfied('3.0.0', '^2.0.0'), false);
    assert.strictEqual(c.isSatisfied('1.2.3', '~1.2.0'), true);
    assert.strictEqual(c.isSatisfied('1.2.3', '>=1.3.0'), false);
    assert.strictEqual(c.isSatisfied('1.2.3', '<=1.2.3'), true);
    assert.strictEqual(c.isSatisfied('2.0.0', '1.5.0'), true);
    assert.strictEqual(c.isSatisfied('1.0.0', '1.5.0'), false);
    assert.strictEqual(c.isSatisfied('1.0.0', 'not-a-version'), false);
  });

  test('records info for satisfied and error for unsatisfied constraints', () => {
    const ws = makeWorkspace();
    const c = prepared(ws, {
      dependencies: [
        { from: 'addon', to: 'core-plugin', constraint: '^2.0.0' },
        { from: 'addon', to: 'ls-theme', constraint: '>=5.0.0' }
      ]
    });
    c.validateDependencies();
    assert.strictEqual(c.issues.length, 2);
    assert.strictEqual(c.issues[0].level, 'info');
    assert.match(c.issues[0].message, /addon requires core-plugin \^2\.0\.0 \(satisfied by v2\.1\.0\)/);
    assert.strictEqual(c.issues[1].level, 'error');
    assert.match(c.issues[1].message, /addon requires ls-theme >=5\.0\.0, but ls-theme is v1\.0\.0/);
  });

  test('reports unknown source and target packages', () => {
    const ws = makeWorkspace();
    const c = prepared(ws, {
      dependencies: [
        { from: 'ghost', to: 'core-plugin', constraint: '^1.0.0' },
        { from: 'addon', to: 'phantom', constraint: '^1.0.0' }
      ]
    });
    c.validateDependencies();
    assert.deepStrictEqual(c.issues, [
      { level: 'error', message: 'Unknown package: ghost' },
      { level: 'error', message: 'Unknown package: phantom' }
    ]);
  });

  test('target without a version produces no issue', () => {
    const ws = makeWorkspace();
    ws.pkgs[0].versionFile = 'gone.php';
    const c = prepared(ws, { dependencies: [{ from: 'addon', to: 'core-plugin', constraint: '^2.0.0' }] });
    c.validateDependencies();
    assert.deepStrictEqual(c.issues, []);
  });
});

describe('compatibility matrix', () => {
  test('builds rows for declared pairs with satisfied flag and reason', () => {
    const ws = makeWorkspace();
    const c = makeChecker(ws, {
      dependencies: [
        { from: 'addon', to: 'core-plugin', constraint: '^2.0.0' },
        { from: 'addon', to: 'ls-theme', constraint: '^2.0.0' }
      ]
    });
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();
    c.resolveDeclaredDependencies();
    c.buildCompatibilityMatrix();
    assert.deepStrictEqual(c.matrix, [
      {
        from: 'addon', to: 'core-plugin', constraint: '^2.0.0', version: '2.1.0',
        satisfied: 'yes', reason: 'Version satisfies constraint'
      },
      {
        from: 'addon', to: 'ls-theme', constraint: '^2.0.0', version: '1.0.0',
        satisfied: 'no', reason: 'Version mismatch'
      }
    ]);
  });

  test('self dependencies and undeclared pairs are skipped; missing version is unsatisfied', () => {
    const ws = makeWorkspace();
    ws.pkgs[0].versionFile = 'gone.php';
    const c = makeChecker(ws, {
      dependencies: [
        { from: 'addon', to: 'addon', constraint: '^0.5.0' },
        { from: 'addon', to: 'core-plugin', constraint: '^2.0.0' }
      ]
    });
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();
    c.resolveDeclaredDependencies();
    c.buildCompatibilityMatrix();
    assert.strictEqual(c.matrix.length, 1);
    assert.strictEqual(c.matrix[0].to, 'core-plugin');
    assert.strictEqual(c.matrix[0].satisfied, 'no');
    assert.strictEqual(c.matrix[0].version, null);
  });
});

describe('breaking change detection', () => {
  function prepared(ws, group) {
    const c = makeChecker(ws, group);
    c.loadConfig();
    c.resolveGroup();
    c.loadPackageMetadata();
    c.resolveDeclaredDependencies();
    return c;
  }

  test('warns about breaking changes and lists dependents', () => {
    const ws = makeWorkspace();
    write(ws.p('core', 'CHANGELOG.md'), '## 2.1.0\n\n### Breaking\n- removed api\n');
    const c = prepared(ws, { dependencies: [{ from: 'addon', to: 'core-plugin', constraint: '^2.0.0' }] });
    c.detectBreakingChanges();
    assert.deepStrictEqual(c.issues, [
      { level: 'warn', message: 'core-plugin: changelog contains breaking changes in current version' },
      { level: 'warn', message: 'Breaking changes in core-plugin affect: addon' }
    ]);
  });

  test('BREAKING CHANGE marker without dependents only warns once', () => {
    const ws = makeWorkspace();
    write(ws.p('theme', 'CHANGELOG.md'), 'feat: x\n\nBREAKING   CHANGE: gone\n');
    const c = prepared(ws, {});
    c.detectBreakingChanges();
    assert.deepStrictEqual(c.issues, [
      { level: 'warn', message: 'ls-theme: changelog contains breaking changes in current version' }
    ]);
  });

  test('honours a custom changelog filename', () => {
    const ws = makeWorkspace();
    ws.pkgs[2].changelog = 'HISTORY.md';
    write(ws.p('addon', 'HISTORY.md'), '### Breaking\n');
    write(ws.p('addon', 'CHANGELOG.md'), 'clean\n');
    const c = prepared(ws, {});
    c.detectBreakingChanges();
    assert.strictEqual(c.issues.length, 1);
    assert.match(c.issues[0].message, /^addon:/);
  });

  test('clean or missing changelogs add no issues', () => {
    const ws = makeWorkspace();
    write(ws.p('core', 'CHANGELOG.md'), '## 2.1.0\n- fixed a thing\n');
    const c = prepared(ws, {});
    c.detectBreakingChanges();
    assert.deepStrictEqual(c.issues, []);
  });

  test('unreadable changelog is ignored', () => {
    const ws = makeWorkspace();
    fs.mkdirSync(ws.p('core', 'CHANGELOG.md'));
    const c = prepared(ws, {});
    assert.doesNotThrow(() => c.detectBreakingChanges());
    assert.deepStrictEqual(c.issues, []);
  });
});

describe('check() and reportResults()', () => {
  test('full successful run returns true and prints the report', () => {
    const ws = makeWorkspace();
    const c = makeChecker(ws, {
      dependencies: [{ from: 'addon', to: 'core-plugin', constraint: '^2.0.0' }]
    });
    assert.strictEqual(c.check(), true);
    const out = output();
    assert.match(out, /Cross-Dependency Analysis: g1/);
    assert.match(out, /core-plugin:/);
    assert.match(out, /- Version: 2\.1\.0/);
    assert.match(out, /- WordPress: 6\.4\+/);
    assert.match(out, /- PHP: 8\.0\+/);
    assert.match(out, /addon → core-plugin \(\^2\.0\.0\)/);
    assert.match(out, /Info:/);
    assert.match(out, /Summary: 0 errors, 0 warnings, 1 info/);
    assert.match(out, /All cross-package dependencies validated!/);
    assert.doesNotMatch(out, /Compatibility Matrix/);
    assert.strictEqual(errSpy.mock.calls.length, 0);
  });

  test('errors and warnings are reported and check() returns false', () => {
    const ws = makeWorkspace();
    write(ws.p('theme', 'CHANGELOG.md'), 'BREAKING CHANGE: x\n');
    const c = makeChecker(ws, {
      dependencies: [{ from: 'addon', to: 'ls-theme', constraint: '^9.0.0' }]
    });
    assert.strictEqual(c.check(), false);
    const out = output();
    assert.match(out, /Errors:/);
    assert.match(out, /addon requires ls-theme \^9\.0\.0, but ls-theme is v1\.0\.0/);
    assert.match(out, /Warnings:/);
    assert.match(out, /Breaking changes in ls-theme affect: addon/);
    assert.match(out, /Summary: 1 errors, 2 warnings, 0 info/);
    assert.doesNotMatch(out, /All cross-package dependencies validated!/);
  });

  test('prints the compatibility matrix when requested', () => {
    const ws = makeWorkspace();
    ws.pkgs[0].versionFile = 'gone.php';
    const c = makeChecker(ws, {
      dependencies: [
        { from: 'addon', to: 'core-plugin', constraint: '^2.0.0' },
        { from: 'core-plugin', to: 'ls-theme', constraint: '^1.0.0' }
      ]
    }, { matrix: true });
    assert.strictEqual(c.check(), true);
    const out = output();
    assert.match(out, /Compatibility Matrix/);
    assert.match(out, /From\s+To\s+Constraint\s+Version\s+Satisfied\s+Notes/);
    assert.match(out, /addon\s+core-plugin\s+\^2\.0\.0\s+unknown\s+no\s+Version mismatch/);
    assert.match(out, /core-plugin\s+ls-theme\s+\^1\.0\.0\s+1\.0\.0\s+yes\s+Version satisfies constraint/);
    assert.match(out, /Version: unknown/);
  });

  test('matrix flag with no matrix rows prints no matrix section', () => {
    const ws = makeWorkspace();
    const c = makeChecker(ws, {}, { matrix: true });
    assert.strictEqual(c.check(), true);
    assert.doesNotMatch(output(), /Compatibility Matrix/);
    assert.doesNotMatch(output(), /Dependencies:/);
  });

  test('discovers dependencies from package.json peerDependencies end to end', () => {
    const ws = makeWorkspace();
    write(ws.p('addon', 'package.json'), { peerDependencies: { '@ls/core-plugin': '^3.0.0' } });
    const c = makeChecker(ws, {}, { groupId: 'g1', matrix: true });
    assert.strictEqual(c.check(), false);
    assert.match(output(), /addon → core-plugin \(\^3\.0\.0\)/);
    assert.match(output(), /but core-plugin is v2\.1\.0/);
  });
});
