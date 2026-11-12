'use strict';

// In-process tests for the release-notes-generator scripts so V8 coverage can see them:
//   sub-skills/release-notes-generator/scripts/parse-changelog.js
//   sub-skills/release-notes-generator/scripts/format-release-notes.js
// Covers the exported functions (parse, normalise, items, issue links, every formatter)
// and the CLI main() functions, which are run in-process by loading each script as the
// main module with process.argv, process.exit and console stubbed.
// Changelogs are written to temp dirs only; nothing in the repository is touched.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const SCRIPTS = path.join(__dirname, '..', 'sub-skills', 'release-notes-generator', 'scripts');
const PARSE_PATH = path.join(SCRIPTS, 'parse-changelog.js');
const FORMAT_PATH = path.join(SCRIPTS, 'format-release-notes.js');

const parser = require(PARSE_PATH);
const formatter = require(FORMAT_PATH);

const tempDirs = [];

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-wp-release-notes-'));
  tempDirs.push(dir);
  return dir;
}

function writeChangelog(content, name = 'CHANGELOG.md') {
  const file = path.join(tempDir(), name);
  fs.writeFileSync(file, content);
  return file;
}

const SAMPLE = [
  '# Changelog',
  '',
  'Intro text that is ignored.',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '- Upcoming thing',
  '',
  '## [1.2.0] - 2026-03-04',
  '',
  '### Added',
  '- New `block` support (#12)',
  '* Star bullet with two refs #7 and #8',
  '  continuation line for star bullet',
  '',
  '### Changed',
  '+ Plus bullet',
  '',
  '### Fixed',
  '- Crash on save #99',
  '',
  '### Security',
  '- Escape output',
  '',
  '### Performance Improvements',
  '- Ignored because it is not a standard section',
  '',
  '## v1.1.0',
  '',
  '### Removed',
  '- Old API',
  '',
  '### Deprecated',
  '- Legacy hook',
  '',
  '## [1.0.0] - 2025-01-01',
  '',
  '### Added',
  '- Initial release',
  ''
].join('\n');

// Run a script as the main module (require.main === module) so its main() executes.
function runAsMain(scriptPath, args, { cwd } = {}) {
  const out = { logs: [], errors: [], exitCode: null };
  const origArgv = process.argv;
  const origExit = process.exit;
  const origLog = console.log;
  const origError = console.error;
  const origCompile = Module.prototype._compile;
  const origMain = process.mainModule;
  const origCwd = process.cwd();

  class ExitSignal extends Error {}

  process.argv = [process.execPath, scriptPath, ...args];
  process.exit = (code) => {
    if (out.exitCode === null) out.exitCode = code === undefined ? 0 : code;
    throw new ExitSignal('exit');
  };
  console.log = (...a) => out.logs.push(a.join(' '));
  console.error = (...a) => out.errors.push(a.join(' '));
  Module.prototype._compile = function (content, filename) {
    if (filename === scriptPath) process.mainModule = this;
    return origCompile.call(this, content, filename);
  };
  delete require.cache[require.resolve(scriptPath)];
  if (cwd) process.chdir(cwd);

  try {
    require(scriptPath);
  } catch (error) {
    if (!(error instanceof ExitSignal)) throw error;
  } finally {
    if (cwd) process.chdir(origCwd);
    Module.prototype._compile = origCompile;
    process.mainModule = origMain;
    process.argv = origArgv;
    process.exit = origExit;
    console.log = origLog;
    console.error = origError;
    delete require.cache[require.resolve(scriptPath)];
  }
  return out;
}

afterAll(() => {
  tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('parse-changelog exports', () => {
  test('extractIssueLinks returns numeric issue ids', () => {
    assert.deepStrictEqual(parser.extractIssueLinks('Fix #1 and #23, not issue'), [1, 23]);
    assert.deepStrictEqual(parser.extractIssueLinks('no refs here'), []);
  });

  test('parseItems handles bullet styles, continuations, code and issues', () => {
    const items = parser.parseItems(
      ['- First `code` #5', '* Second', '  more text', '+ Third', 'orphan'].join('\n')
    );
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].text, 'First `code` #5');
    assert.strictEqual(items[0].hasCode, true);
    assert.deepStrictEqual(items[0].issueLinks, [5]);
    assert.strictEqual(items[0].raw, '- First `code` #5');
    assert.strictEqual(items[1].text, 'Second more text');
    assert.strictEqual(items[2].text, 'Third orphan');
    assert.strictEqual(items[2].hasCode, false);
  });

  test('parseItems ignores text before the first bullet and empty content', () => {
    assert.deepStrictEqual(parser.parseItems(''), []);
    assert.deepStrictEqual(parser.parseItems('no bullets at all'), []);
  });

  test('formatOutput pretty prints JSON', () => {
    assert.strictEqual(parser.formatOutput({ a: 1 }), '{\n  "a": 1\n}');
  });

  test('normalizeChangelog strips v prefix, maps sections and skips metadata', () => {
    const result = parser.normalizeChangelog('v2.0.0', {
      _date: '2026-01-01',
      _raw_version: 'v2.0.0',
      'Added in this': '- One',
      Fixed: '- Two',
      Misc: '- Dropped'
    });
    assert.strictEqual(result.version, '2.0.0');
    assert.strictEqual(result.date, '2026-01-01');
    assert.deepStrictEqual(Object.keys(result.sections), ['Added', 'Fixed']);
    assert.strictEqual(result.sections.Added[0].text, 'One');
  });

  test('normalizeChangelog falls back to today when no date is present', () => {
    const result = parser.normalizeChangelog('1.0.0', { _date: null });
    assert.match(result.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepStrictEqual(result.sections, {});
  });
});

describe('parseChangelog', () => {
  test('returns the first listed version by default', () => {
    const result = parser.parseChangelog(writeChangelog(SAMPLE));
    assert.strictEqual(result.version, 'Unreleased');
    assert.deepStrictEqual(Object.keys(result.sections), ['Added']);
  });

  test('extracts a specific version with dated, categorised sections', () => {
    const result = parser.parseChangelog(writeChangelog(SAMPLE), '1.2.0');
    assert.strictEqual(result.version, '1.2.0');
    assert.strictEqual(result.date, '2026-03-04');
    assert.deepStrictEqual(Object.keys(result.sections), ['Added', 'Changed', 'Fixed', 'Security']);
    const added = result.sections.Added;
    assert.strictEqual(added.length, 2);
    assert.deepStrictEqual(added[0].issueLinks, [12]);
    assert.strictEqual(added[0].hasCode, true);
    assert.deepStrictEqual(added[1].issueLinks, [7, 8]);
    assert.strictEqual(added[1].text, 'Star bullet with two refs #7 and #8 continuation line for star bullet');
    assert.strictEqual(result.sections.Changed[0].text, 'Plus bullet');
    assert.deepStrictEqual(result.sections.Fixed[0].issueLinks, [99]);
  });

  test('handles an unbracketed v-prefixed header without a date', () => {
    const result = parser.parseChangelog(writeChangelog(SAMPLE), 'v1.1.0');
    assert.strictEqual(result.version, '1.1.0');
    assert.deepStrictEqual(Object.keys(result.sections), ['Removed', 'Deprecated']);
    assert.match(result.date, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('merges repeated version headers and keeps the last date', () => {
    const file = writeChangelog(
      ['## [3.0.0] - 2026-01-01', '### Added', '- A', '## [3.0.0] - 2026-02-02', '### Fixed', '- B'].join('\n')
    );
    const result = parser.parseChangelog(file, '3.0.0');
    assert.strictEqual(result.date, '2026-02-02');
    assert.deepStrictEqual(Object.keys(result.sections), ['Added', 'Fixed']);
  });

  test('ignores section headers that appear before any version', () => {
    const file = writeChangelog(['### Added', '- Stray', '## [1.0.0] - 2026-01-01', '### Added', '- Real'].join('\n'));
    const result = parser.parseChangelog(file);
    assert.strictEqual(result.version, '1.0.0');
    assert.strictEqual(result.sections.Added[0].text, 'Real');
  });

  test('exits with an error when the file is missing', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      assert.throws(() => parser.parseChangelog(path.join(os.tmpdir(), 'ls-nope', 'CHANGELOG.md')), /exit:1/);
      assert.match(err.mock.calls[0][0], /CHANGELOG\.md not found/);
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });

  test('exits with an error when the requested version is absent', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      assert.throws(() => parser.parseChangelog(writeChangelog(SAMPLE), '9.9.9'), /exit:1/);
      assert.match(err.mock.calls[0][0], /Version 9\.9\.9 not found/);
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });
});

describe('parse-changelog CLI main()', () => {
  test('prints JSON for a positional path and --version', () => {
    const file = writeChangelog(SAMPLE);
    const out = runAsMain(PARSE_PATH, [file, '--version', '1.2.0']);
    assert.strictEqual(out.exitCode, null);
    const parsed = JSON.parse(out.logs.join('\n'));
    assert.strictEqual(parsed.version, '1.2.0');
    assert.strictEqual(parsed.sections.Fixed[0].issueLinks[0], 99);
  });

  test('prints text format with --file and -v', () => {
    const file = writeChangelog(SAMPLE);
    const out = runAsMain(PARSE_PATH, ['--file', file, '-v', '1.2.0', '--format', 'text']);
    const text = out.logs.join('\n');
    assert.match(text, /Version: 1\.2\.0/);
    assert.match(text, /Date: 2026-03-04/);
    assert.match(text, /Added:/);
    assert.match(text, / {2}- Plus bullet/);
  });

  test('accepts -f and resolves relative paths against the cwd', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'CHANGES.md'), SAMPLE);
    const out = runAsMain(PARSE_PATH, ['-f', 'CHANGES.md'], { cwd: dir });
    assert.strictEqual(JSON.parse(out.logs.join('\n')).version, 'Unreleased');
  });

  test('defaults to CHANGELOG.md in the cwd', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), SAMPLE);
    const out = runAsMain(PARSE_PATH, [], { cwd: dir });
    assert.strictEqual(JSON.parse(out.logs.join('\n')).sections.Added[0].text, 'Upcoming thing');
  });

  test('unknown format prints nothing and does not fail', () => {
    const out = runAsMain(PARSE_PATH, [writeChangelog(SAMPLE), '--format', 'xml']);
    assert.deepStrictEqual(out.logs, []);
    assert.strictEqual(out.exitCode, null);
  });

  test('exits 1 when the changelog is missing', () => {
    const out = runAsMain(PARSE_PATH, [path.join(os.tmpdir(), 'ls-nope', 'CHANGELOG.md')]);
    assert.strictEqual(out.exitCode, 1);
    assert.ok(out.errors.some((line) => /not found/.test(line)));
  });
});

const CHANGELOG = {
  version: '1.2.0',
  date: '2026-03-04',
  sections: {
    Added: [
      { text: 'Feature #12 and again #12', raw: '- Feature', issueLinks: [12], hasCode: false },
      { text: 'Plain feature', raw: '- Plain feature', issueLinks: [], hasCode: false }
    ],
    Fixed: [{ text: 'Bug fix', raw: '- Bug fix', issueLinks: [], hasCode: false }],
    Deprecated: [],
    Custom: [{ text: 'No emoji section', raw: '- x', issueLinks: [], hasCode: false }]
  }
};

describe('formatGitHubRelease', () => {
  test('renders header, emoji, linked issues and skips empty sections', () => {
    const md = formatter.formatGitHubRelease(CHANGELOG);
    assert.match(md, /^## 1\.2\.0 - 2026-03-04\n/);
    assert.match(
      md,
      /### Added\n- ✨ Feature \[#12\]\(https:\/\/github\.com\/example\/repo\/issues\/12\) and again \[#12\]/
    );
    assert.match(md, /- 🐛 Bug fix/);
    assert.ok(!md.includes('### Deprecated'));
    assert.match(md, /### Custom\n- No emoji section/);
    assert.ok(!md.includes('**Contributors:**'));
    assert.ok(!md.includes('Full Changelog'));
    assert.match(md, /---\n/);
  });

  test('honours emoji sets, unknown set fallback and includeIssueLinks=false', () => {
    const minimal = formatter.formatGitHubRelease(CHANGELOG, { emojiSet: 'minimal', includeIssueLinks: false });
    assert.match(minimal, /- → Feature #12 and again #12/);
    const tech = formatter.formatGitHubRelease(CHANGELOG, { emojiSet: 'tech' });
    assert.match(tech, /- ⚙️ Plain feature/);
    const fallback = formatter.formatGitHubRelease(CHANGELOG, { emojiSet: 'nope' });
    assert.match(fallback, /- ✨ Plain feature/);
  });

  test('adds contributors (objects and strings, capped at 10) and compare link', () => {
    const contributors = [{ username: 'alice' }, 'bob'];
    for (let i = 0; i < 12; i++) contributors.push(`user${i}`);
    const md = formatter.formatGitHubRelease(CHANGELOG, {
      contributors,
      previousVersion: '1.1.0',
      repositoryUrl: 'https://github.com/org/proj'
    });
    assert.match(md, /\*\*Contributors:\*\* Thanks to @alice, @bob, @user0/);
    assert.ok(md.includes('@user7'));
    assert.ok(!md.includes('@user8'));
    assert.match(
      md,
      new RegExp('\\*\\*Full Changelog:\\*\\* \\[1\\.1\\.0\\.\\.\\.1\\.2\\.0\\]'
        + '\\(https://github\\.com/org/proj/compare/1\\.1\\.0\\.\\.\\.1\\.2\\.0\\)')
    );
    assert.ok(md.includes('https://github.com/org/proj/issues/12'));
  });
});

describe('formatEmailNewsletter', () => {
  test('renders html with highlights, mapped section titles and links', () => {
    const html = formatter.formatEmailNewsletter(CHANGELOG, {
      projectName: 'MyPlugin',
      teamName: 'Team X',
      releaseUrl: 'https://r.example',
      downloadUrl: 'https://d.example'
    });
    assert.match(html, /<html>/);
    assert.match(html, /MyPlugin 1\.2\.0 Released!/);
    assert.match(html, /featuring new features, bug fixes!/);
    assert.match(html, /<h2>✨ What's New<\/h2>/);
    assert.match(html, /<h2>🔧 Bug Fixes<\/h2>/);
    assert.match(html, /<h2>Custom<\/h2>/);
    assert.ok(!html.includes('Deprecated'));
    assert.match(html, /<li>Plain feature<\/li>/);
    assert.match(html, /href="https:\/\/r\.example"/);
    assert.match(html, /href="https:\/\/d\.example"/);
    assert.match(html, /The Team X Team/);
  });

  test('uses defaults and can strip the html wrapper', () => {
    const wrapped = formatter.formatEmailNewsletter(CHANGELOG);
    assert.match(wrapped, /Plugin 1\.2\.0 Released!/);
    assert.match(wrapped, /LightSpeedWP Team/);
    assert.match(wrapped, /href="#"/);
    const bare = formatter.formatEmailNewsletter(CHANGELOG, { includeHTMLWrapper: false });
    assert.ok(!bare.includes('<html'));
    assert.ok(!bare.includes('</html>'));
    assert.ok(!bare.includes('<head'));
    assert.match(bare, /<body>/);
  });

  test('highlights cover Changed and Security sections', () => {
    const html = formatter.formatEmailNewsletter({
      version: '2.0.0',
      date: '2026-01-01',
      sections: {
        Changed: [{ text: 'c', issueLinks: [] }],
        Security: [{ text: 's', issueLinks: [] }]
      }
    });
    assert.match(html, /featuring improvements, security updates!/);
    assert.match(html, /<h2>📊 Improvements<\/h2>/);
    assert.match(html, /<h2>🔒 Security Updates<\/h2>/);
  });
});

describe('formatSlackAnnouncement', () => {
  test('renders emojis, bullets and links', () => {
    const text = formatter.formatSlackAnnouncement(CHANGELOG, {
      projectName: 'Proj',
      releaseUrl: 'https://r.example',
      downloadUrl: 'https://d.example'
    });
    assert.match(text, /^:rocket: \*1\.2\.0 Released!\* Proj/);
    assert.match(text, /:sparkles: \*Added\*\n• Feature #12 and again #12\n• Plain feature/);
    assert.match(text, /:bug: \*Fixed\*/);
    assert.match(text, /:point_right: \*Custom\*/);
    assert.ok(!text.includes('Deprecated'));
    assert.match(text, /Check it out: <https:\/\/r\.example>/);
    assert.match(text, /<https:\/\/d\.example\|Download 1\.2\.0 →>/);
    assert.match(text, /React with :tada:/);
  });

  test('truncates sections beyond maxItemsPerSection', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ text: `item ${i}`, issueLinks: [] }));
    const text = formatter.formatSlackAnnouncement({ version: '1.0.0', date: 'd', sections: { Added: items } });
    assert.ok(text.includes('• item 4'));
    assert.ok(!text.includes('• item 5'));
    assert.ok(text.includes('• ... and 3 more'));
    const custom = formatter.formatSlackAnnouncement(
      { version: '1.0.0', date: 'd', sections: { Added: items } },
      { maxItemsPerSection: 8 }
    );
    assert.ok(!custom.includes('and 0 more'));
    assert.ok(!custom.includes('more'));
  });
});

describe('formatBlogPost', () => {
  test('renders frontmatter, sections and footer', () => {
    const post = formatter.formatBlogPost(CHANGELOG, {
      projectName: 'Proj',
      author: 'Ann',
      releaseUrl: 'https://r.example',
      contributorsUrl: 'https://c.example'
    });
    assert.match(
      post,
      /^---\ntitle: "Proj 1\.2\.0 Released"\ndate: 2026-03-04\nauthor: "Ann"\nslug: "release-1\.2\.0"/
    );
    assert.match(post, /tags: \["v1\.2\.0", "release", "announcement"\]/);
    assert.match(post, /# Proj 1\.2\.0 Released/);
    assert.match(post, /\*\*2026-03-04\*\* \| By Ann \| 2 min read/);
    assert.match(post, /## What's New\?/);
    assert.match(post, /## What's Fixed\?/);
    assert.ok(!post.includes('Deprecated'));
    assert.match(post, /\[GitHub releases page\]\(https:\/\/r\.example\)/);
    assert.match(post, /\[Thanks to our contributors →\]\(https:\/\/c\.example\)/);
  });

  test('uses defaults and explicit title/slug, and scales read time', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ text: `i${i}`, issueLinks: [] }));
    const post = formatter.formatBlogPost(
      { version: '3.0.0-RC1', date: '2026-05-05', sections: { Added: items } },
      { title: 'Custom Title', slug: 'my-slug' }
    );
    assert.match(post, /title: "Custom Title"/);
    assert.match(post, /slug: "my-slug"/);
    assert.match(post, /author: "LightSpeedWP Team"/);
    assert.match(post, /4 min read/);
    const def = formatter.formatBlogPost({ version: '3.0.0-RC1', date: 'd', sections: {} });
    assert.match(def, /slug: "release-3\.0\.0-rc1"/);
    assert.match(def, /title: "Plugin 3\.0\.0-RC1 Released"/);
    assert.match(def, /2 min read/);
  });
});

describe('EMOJI_SETS', () => {
  test('exposes the three named sets with the same keys', () => {
    assert.deepStrictEqual(Object.keys(formatter.EMOJI_SETS), ['standard', 'tech', 'minimal']);
    const keys = Object.keys(formatter.EMOJI_SETS.standard);
    Object.values(formatter.EMOJI_SETS).forEach((set) => assert.deepStrictEqual(Object.keys(set), keys));
  });
});

describe('format-release-notes CLI main()', () => {
  const json = JSON.stringify(CHANGELOG);

  test('defaults to github format', () => {
    const out = runAsMain(FORMAT_PATH, ['--changelog', json]);
    assert.strictEqual(out.exitCode, null);
    assert.match(out.logs[0], /^## 1\.2\.0 - 2026-03-04/);
  });

  test('github format honours --repository and generic --options', () => {
    const out = runAsMain(FORMAT_PATH, [
      '--changelog', json, '-f', 'github', '--repository', 'https://github.com/o/r', '--previousVersion', '1.0.0'
    ]);
    assert.ok(out.logs[0].includes('https://github.com/o/r/issues/12'));
    assert.ok(out.logs[0].includes('compare/1.0.0...1.2.0'));
  });

  test('email, slack and blog formats with --project-name', () => {
    const email = runAsMain(FORMAT_PATH, ['--changelog', json, '--format', 'email', '--project-name', 'Acme']);
    assert.match(email.logs[0], /Acme 1\.2\.0 Released!/);
    const slack = runAsMain(FORMAT_PATH, ['--changelog', json, '--format', 'slack', '--project-name', 'Acme']);
    assert.match(slack.logs[0], /Released!\* Acme/);
    const blog = runAsMain(FORMAT_PATH, ['--changelog', json, '--format', 'blog', '--project-name', 'Acme']);
    assert.match(blog.logs[0], /title: "Acme 1\.2\.0 Released"/);
  });

  test('fails with exit 1 when no changelog is provided', () => {
    const out = runAsMain(FORMAT_PATH, ['--format', 'github']);
    assert.strictEqual(out.exitCode, 1);
    assert.ok(out.errors.some((line) => line.includes('No changelog JSON provided')));
  });

  test('fails with exit 1 on an unknown format', () => {
    const out = runAsMain(FORMAT_PATH, ['--changelog', json, '--format', 'pdf']);
    assert.strictEqual(out.exitCode, 1);
    assert.ok(out.errors.some((line) => line.includes('Unknown format: pdf')));
  });

  test('fails with exit 1 on invalid JSON', () => {
    const out = runAsMain(FORMAT_PATH, ['--changelog', '{not json']);
    assert.strictEqual(out.exitCode, 1);
    assert.ok(out.errors.some((line) => line.startsWith('Error:')));
  });
});
