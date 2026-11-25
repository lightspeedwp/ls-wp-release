'use strict';

/**
 * In-process tests for sub-skills/wordpress-org-auto-sync/scripts/svn-sync-validator.js.
 *
 * The script runs on require (CLI entry), so each test sets process.argv, stubs process.exit,
 * captures console output and requires a fresh copy. Covered: argument handling, plugin and theme
 * header validation, readme.txt checks, asset checks, exclusion scan, file structure, reporting
 * and the fatal-error path.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(
  __dirname, '..', 'sub-skills', 'wordpress-org-auto-sync', 'scripts', 'svn-sync-validator.js'
);

const tmpDirs = [];
const origArgv = process.argv;
let logSpy;
let errSpy;
let exitSpy;
let exitCodes;

function mkTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svn-validator-'));
  tmpDirs.push(dir);
  return dir;
}

function write(dir, rel, content = '') {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const PLUGIN_HEADER = (version = '1.2.3') => `<?php
/**
 * Plugin Name: Demo
 * Description: Demo plugin
 * Version: ${version}
 * Author: Me
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */
`;

const THEME_CSS = (version = '1.0.0') => `/*
Theme Name: Demo
Description: Demo theme
Version: ${version}
Author: Me
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
*/`;

const README = (stable = '1.2.3', extra = 'Contributors: me\n') => `=== Demo ===
${extra}Stable tag: ${stable}

== Description ==
x

== Installation ==
x

== Changelog ==
x
`;

function makePlugin(opts = {}) {
  const dir = mkTmp();
  write(dir, 'demo.php', opts.header || PLUGIN_HEADER());
  if (opts.readme !== false) write(dir, 'readme.txt', opts.readme || README());
  if (opts.license !== false) write(dir, 'LICENSE', 'GPL');
  return dir;
}

function run(type, dir, extraArgs = []) {
  const args = ['node', SCRIPT];
  if (type !== undefined) args.push(`--type=${type}`);
  if (dir !== undefined) args.push(`--path=${dir}`);
  process.argv = args.concat(extraArgs);
  delete require.cache[require.resolve(SCRIPT)];
  require(SCRIPT);
  return {
    out: logSpy.mock.calls.map(c => c.join(' ')).join('\n'),
    err: errSpy.mock.calls.map(c => c.join(' ')).join('\n'),
    codes: exitCodes.slice()
  };
}

beforeEach(() => {
  exitCodes = [];
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  // Record the exit code without throwing so validate()'s try/catch is not triggered by the stub.
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(code => {
    exitCodes.push(code);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.argv = origArgv;
});

afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('CLI argument handling', () => {
  test('missing --type and --path prints usage and exits 1', () => {
    // Usage exit happens outside the try block, so make the stub throw to stop execution.
    exitSpy.mockImplementation(code => {
      exitCodes.push(code);
      throw new Error('EXIT');
    });
    assert.throws(() => run(undefined, undefined), /EXIT/);
    assert.deepStrictEqual(exitCodes, [1]);
    assert.match(errSpy.mock.calls[0][0], /Usage: node svn-sync-validator\.js/);
    assert.match(errSpy.mock.calls[1][0], /Example:/);
  });

  test('missing --path only also fails with usage', () => {
    exitSpy.mockImplementation(code => {
      exitCodes.push(code);
      throw new Error('EXIT');
    });
    assert.throws(() => run('plugin', undefined), /EXIT/);
    assert.deepStrictEqual(exitCodes, [1]);
  });

  test('unknown arguments are ignored', () => {
    const dir = makePlugin();
    const r = run('plugin', dir, ['--verbose', 'foo']);
    assert.deepStrictEqual(r.codes, [0]);
  });

  test('invalid type records an error and exits 1', () => {
    const dir = makePlugin();
    const r = run('bogus', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /Invalid type: bogus\. Use 'plugin' or 'theme'\./);
    assert.match(r.out, /Fix the errors above before syncing/);
  });
});

describe('plugin validation', () => {
  test('clean plugin passes with warnings about assets', () => {
    const dir = makePlugin();
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [0]);
    assert.match(r.out, /Validating plugin for WordPress\.org sync/);
    assert.match(r.out, /Plugin header found in demo\.php/);
    assert.match(r.out, /Version detected: 1\.2\.3/);
    assert.match(r.out, /readme\.txt is properly formatted/);
    assert.match(r.out, /License file present/);
    assert.match(r.out, /PASS - 0 errors, 1 warnings/);
    assert.match(r.out, /No assets directory found/);
    assert.match(r.out, /Ready for sync, but consider the warnings above/);
  });

  test('fully clean plugin reports ready with no warnings', () => {
    const dir = makePlugin();
    write(dir, 'assets/icon-128x128.png');
    write(dir, 'assets/banner-772x250.jpg');
    write(dir, 'assets/screenshot-1.png');
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [0]);
    assert.match(r.out, /Found 3 asset files/);
    assert.match(r.out, /Plugin icon\(s\) found: icon-128x128\.png/);
    assert.match(r.out, /Plugin banner found: banner-772x250\.jpg/);
    assert.match(r.out, /Screenshots found: 1 files/);
    assert.match(r.out, /0 errors, 0 warnings/);
    assert.match(r.out, /Ready for WordPress\.org sync!/);
  });

  test('plugin with no php files errors', () => {
    const dir = mkTmp();
    write(dir, 'readme.txt', README());
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /No PHP files found in plugin root/);
  });

  test('directory named *.php is not treated as plugin file', () => {
    const dir = mkTmp();
    write(dir, 'weird.php/inner.txt', 'x');
    const r = run('plugin', dir);
    assert.match(r.out, /No PHP files found in plugin root/);
  });

  test('php file without header errors', () => {
    const dir = mkTmp();
    write(dir, 'index.php', '<?php // silence');
    write(dir, 'readme.txt', README());
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /No valid plugin header found/);
  });

  test('header scan skips non-header php files and picks the main one', () => {
    const dir = mkTmp();
    write(dir, 'a-index.php', '<?php // nothing');
    write(dir, 'main.php', PLUGIN_HEADER('2.0.0'));
    write(dir, 'readme.txt', README('2.0.0'));
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [0]);
    assert.match(r.out, /Plugin header found in main\.php/);
  });

  test('missing required header fields are reported individually', () => {
    const dir = makePlugin({
      header: '<?php\n/* Plugin Name: Demo\n Version: 1.0.0 */'
    });
    write(dir, 'readme.txt', README('1.0.0'));
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    for (const f of ['Description', 'Author', 'License', 'License URI']) {
      assert.ok(r.out.includes(`Missing required header field: "${f}" in demo.php`), f);
    }
    assert.match(r.out, /License should be GPL or MIT/);
  });

  test('MIT license avoids the license warning', () => {
    const header = PLUGIN_HEADER().replace('GPL-2.0-or-later', 'MIT');
    const dir = makePlugin({ header });
    const r = run('plugin', dir);
    assert.doesNotMatch(r.out, /License should be GPL or MIT/);
  });

  test('invalid version format fails', () => {
    const dir = makePlugin({ header: PLUGIN_HEADER('1.0'), readme: README('1.0') });
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /Invalid version format: "1\.0"/);
  });

  test('prerelease versions are accepted', () => {
    const dir = makePlugin({ header: PLUGIN_HEADER('1.0.0-rc.1'), readme: README('1.0.0-rc.1') });
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [0]);
  });

  test('header with "Version:" but regex cannot capture still handled', () => {
    // "Version:" present at end of file with no newline content after still matches (empty string).
    const dir = mkTmp();
    write(dir, 'demo.php', '<?php\n// Plugin Name: X\n// Version:');
    write(dir, 'readme.txt', README());
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
  });

  test('nonexistent path triggers fatal error path', () => {
    const r = run('plugin', path.join(os.tmpdir(), 'svn-validator-does-not-exist-xyz'));
    assert.match(r.out, /Fatal error: ENOENT/);
    assert.ok(r.codes.includes(1));
  });

  test('plugin asset warnings when files are missing or misnamed', () => {
    const dir = makePlugin();
    write(dir, 'assets/random.png');
    const r = run('plugin', dir);
    assert.match(r.out, /Recommended: Add icon-128x128\.png or icon-256x256\.png/);
    assert.match(r.out, /Recommended: Add banner-772x250\.jpg/);
    assert.match(r.out, /Recommended: Add screenshots/);
  });

  test('assets directory with no images warns', () => {
    const dir = makePlugin();
    write(dir, 'assets/notes.txt', 'x');
    const r = run('plugin', dir);
    assert.match(r.out, /No image assets found in \/assets directory/);
  });
});

describe('readme.txt validation', () => {
  test('missing readme.txt errors twice (readme and structure)', () => {
    const dir = makePlugin({ readme: false });
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /Missing required file: readme\.txt/);
    assert.match(r.out, /Missing readme\.txt at root/);
  });

  test('missing sections, stable tag and contributors', () => {
    const dir = makePlugin({ readme: '=== Demo ===\nnothing here\n' });
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    for (const s of ['Description', 'Installation', 'Changelog']) {
      assert.ok(r.out.includes(`Missing required section in readme.txt: "== ${s} =="`), s);
    }
    assert.match(r.out, /Missing "Stable tag:" in readme\.txt/);
    assert.match(r.out, /Recommended: Add "Contributors:" field/);
  });

  test('stable tag mismatch is an error', () => {
    const dir = makePlugin({ readme: README('9.9.9') });
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /Version mismatch: header version is 1\.2\.3, stable tag is 9\.9\.9/);
  });

  test('stable tag is matched case-insensitively', () => {
    const dir = makePlugin({ readme: README('1.2.3').replace('Stable tag', 'STABLE TAG') });
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [0]);
  });
});

describe('theme validation', () => {
  function makeTheme(opts = {}) {
    const dir = mkTmp();
    if (opts.css !== false) write(dir, 'style.css', opts.css || THEME_CSS());
    write(dir, 'readme.txt', README('1.0.0'));
    write(dir, 'LICENSE.txt', 'GPL');
    if (opts.themeJson !== undefined) write(dir, 'theme.json', opts.themeJson);
    return dir;
  }

  test('valid theme with theme.json v2 passes', () => {
    const dir = makeTheme({ themeJson: '{"version": 2}' });
    const r = run('theme', dir);
    assert.deepStrictEqual(r.codes, [0]);
    assert.match(r.out, /Theme header found in style\.css/);
    assert.match(r.out, /theme\.json found/);
    assert.match(r.out, /License file present/);
    assert.doesNotMatch(r.out, /theme\.json version is/);
  });

  test('theme without theme.json warns', () => {
    const dir = makeTheme();
    const r = run('theme', dir);
    assert.deepStrictEqual(r.codes, [0]);
    assert.match(r.out, /Recommended: Add theme\.json/);
  });

  test('theme.json with wrong version warns', () => {
    const dir = makeTheme({ themeJson: '{"version": 3}' });
    const r = run('theme', dir);
    assert.match(r.out, /theme\.json version is 3, version 2 is recommended/);
  });

  test('invalid theme.json is an error', () => {
    const dir = makeTheme({ themeJson: '{nope' });
    const r = run('theme', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /Invalid JSON in theme\.json/);
  });

  test('missing style.css errors', () => {
    const dir = makeTheme({ css: false });
    const r = run('theme', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /Missing required file: style\.css/);
  });

  test('missing Theme Name errors', () => {
    const dir = makeTheme({ css: '/* Version: 1.0.0 */' });
    const r = run('theme', dir);
    assert.match(r.out, /Missing "Theme Name:" in style\.css/);
  });

  test('missing Version errors', () => {
    const dir = makeTheme({ css: '/* Theme Name: X */' });
    const r = run('theme', dir);
    assert.match(r.out, /Missing "Version:" in style\.css/);
  });

  test('invalid theme version errors', () => {
    const dir = makeTheme({ css: THEME_CSS('v1') });
    const r = run('theme', dir);
    assert.match(r.out, /Invalid version format: "v1"/);
  });

  test('missing theme header fields are listed', () => {
    const dir = makeTheme({ css: '/* Theme Name: X\nVersion: 1.0.0 */' });
    const r = run('theme', dir);
    assert.deepStrictEqual(r.codes, [1]);
    for (const f of ['Description', 'Author', 'License', 'License URI']) {
      assert.ok(r.out.includes(`Missing required header field: "${f}" in style.css`), f);
    }
  });

  test('theme assets: screenshot and banner found', () => {
    const dir = makeTheme();
    write(dir, 'assets/screenshot.png');
    write(dir, 'assets/banner-772x250.png');
    const r = run('theme', dir);
    assert.match(r.out, /Theme screenshot found: screenshot\.png/);
    assert.match(r.out, /Theme banner found: banner-772x250\.png/);
  });

  test('theme assets: missing screenshot warns', () => {
    const dir = makeTheme();
    write(dir, 'assets/other.jpg');
    const r = run('theme', dir);
    assert.match(r.out, /Recommended: Add screenshot\.png/);
    assert.doesNotMatch(r.out, /Theme banner found/);
  });
});

describe('exclusions and structure', () => {
  test('excluded files and nested dirs are flagged', () => {
    const dir = makePlugin();
    write(dir, 'node_modules/pkg/index.js');
    write(dir, 'composer.lock', '{}');
    write(dir, '.DS_Store');
    write(dir, '.github/workflow.yml');
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /Excluded file\/directory found: node_modules\/pkg\/index\.js/);
    assert.match(r.out, /Excluded file\/directory found: composer\.lock/);
    assert.match(r.out, /Excluded file\/directory found: \.DS_Store/);
    // Hidden directories are skipped by the walker, so .github contents are not reported.
    assert.doesNotMatch(r.out, /workflow\.yml/);
  });

  test('missing license warns, LICENSE.txt accepted', () => {
    const dir = makePlugin({ license: false });
    let r = run('plugin', dir);
    assert.match(r.out, /Recommended: Add LICENSE or LICENSE\.txt file/);
    write(dir, 'LICENSE.txt', 'GPL');
    r = run('plugin', dir);
    assert.match(r.out, /License file present/);
  });

  test('substring match flags innocent names containing a pattern', () => {
    // Documents current behaviour: "distribution.php" contains "dist" and is reported.
    const dir = makePlugin();
    write(dir, 'distribution.php', '<?php');
    const r = run('plugin', dir);
    assert.deepStrictEqual(r.codes, [1]);
    assert.match(r.out, /Excluded file\/directory found: distribution\.php/);
  });

  test('exclusion scan reports the number of files checked', () => {
    const dir = makePlugin();
    const r = run('plugin', dir);
    assert.match(r.out, /Checked 3 files against exclusion patterns/);
  });
});
