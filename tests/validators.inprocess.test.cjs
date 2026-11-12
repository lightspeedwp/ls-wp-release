'use strict';

// In-process tests (visible to V8 coverage) for:
//   scripts/validate-json.js            - argv handling, skip/missing/invalid/valid paths, exit codes
//   scripts/validate-links.js           - success path on the real repo (read-only) plus a virtual
//                                         file system for broken / external / anchor link handling
//   scripts/validate-skill-structure.js - success path on the real repo (read-only) plus a virtual
//                                         file system for each failure branch
// The scripts run at require time and call process.exit, so process.exit is stubbed with a sentinel
// throw and console output is captured. Failure paths use fs spies that only intercept paths under a
// fake root inside the repo directory; every other path falls through to the real fs.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const tempDirs = [];
const originalArgv = process.argv.slice();

class ExitSignal extends Error {
  constructor(code) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

function scriptPath(name) {
  return path.join(REPO, 'scripts', name);
}

// Load the real script in-process; returns { code, out, err }.
function runScript(name, args = []) {
  const target = scriptPath(name);
  const out = [];
  const err = [];
  vi.spyOn(console, 'log').mockImplementation((...a) => out.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a) => err.push(a.join(' ')));
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitSignal(code);
  });
  process.argv = ['node', target, ...args];
  delete require.cache[require.resolve(target)];
  let code;
  try {
    require(target);
  } catch (e) {
    if (!(e instanceof ExitSignal)) {
      throw e;
    }
    code = e.code;
  } finally {
    delete require.cache[require.resolve(target)];
  }
  return { code, out: out.join('\n'), err: err.join('\n') };
}

// Virtual file system rooted at ROOT (a path inside the repo that does not exist on disk).
const ROOT = path.join(REPO, '__virtual_release_root__');

function installVfs(files, mapPath = (p) => p) {
  const fileMap = new Map();
  const dirMap = new Map([[ROOT, new Set()]]);
  Object.entries(files).forEach(([rel, content]) => {
    const abs = path.join(ROOT, rel);
    fileMap.set(abs, content);
    let child = abs;
    let parent = path.dirname(child);
    while (child !== ROOT) {
      if (!dirMap.has(parent)) {
        dirMap.set(parent, new Set());
      }
      dirMap.get(parent).add(path.basename(child));
      child = parent;
      parent = path.dirname(child);
    }
  });
  const isVirtual = (p) => p === ROOT || p.startsWith(ROOT + path.sep);
  const real = {
    existsSync: fs.existsSync,
    statSync: fs.statSync,
    readdirSync: fs.readdirSync,
    readFileSync: fs.readFileSync,
  };
  // Paths the scripts build from the real repo root are translated onto ROOT first.
  const tr = (p) => (typeof p === 'string' ? mapPath(p) : p);
  vi.spyOn(fs, 'existsSync').mockImplementation((orig) => {
    const p = tr(orig);
    if (typeof p !== 'string' || !isVirtual(p)) return real.existsSync(p);
    return fileMap.has(p) || dirMap.has(p);
  });
  vi.spyOn(fs, 'statSync').mockImplementation((orig, ...rest) => {
    const p = tr(orig);
    if (typeof p !== 'string' || !isVirtual(p)) return real.statSync(p, ...rest);
    if (fileMap.has(p)) {
      const size = Buffer.byteLength(fileMap.get(p));
      return { isFile: () => true, isDirectory: () => false, size };
    }
    if (dirMap.has(p)) {
      return { isFile: () => false, isDirectory: () => true, size: 0 };
    }
    throw new Error(`ENOENT: ${p}`);
  });
  vi.spyOn(fs, 'readdirSync').mockImplementation((orig, ...rest) => {
    const p = tr(orig);
    if (typeof p !== 'string' || !isVirtual(p)) return real.readdirSync(p, ...rest);
    return Array.from(dirMap.get(p) || []);
  });
  vi.spyOn(fs, 'readFileSync').mockImplementation((orig, ...rest) => {
    const p = tr(orig);
    if (typeof p !== 'string' || !isVirtual(p)) return real.readFileSync(p, ...rest);
    if (!fileMap.has(p)) throw new Error(`ENOENT: ${p}`);
    return fileMap.get(p);
  });
}

const KEEP_REAL = ['node_modules', 'coverage', 'tests', '.git'];

// Map REPO/<rel> (as built by the scripts from __dirname/..) onto ROOT/<rel>.
function repoToRoot(p) {
  if (p === REPO) return ROOT;
  if (!p.startsWith(REPO + path.sep) || p.startsWith(ROOT)) return p;
  const rel = path.relative(REPO, p);
  const top = rel.split(path.sep)[0];
  if (top === 'scripts' || KEEP_REAL.includes(top)) return p;
  return path.join(ROOT, rel);
}

function installRepoVfs(files) {
  installVfs(files, repoToRoot);
}

// Real repo, but hide dependency/coverage directories (their markdown is not ours to validate).
function hideRealJunkDirs() {
  const realReaddir = fs.readdirSync;
  vi.spyOn(fs, 'readdirSync').mockImplementation((p, ...rest) => {
    const res = realReaddir(p, ...rest);
    return p === REPO && Array.isArray(res) ? res.filter((e) => !KEEP_REAL.includes(e) || e === 'tests') : res;
  });
}

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  process.argv = originalArgv.slice();
});

afterAll(() => {
  tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('scripts/validate-json.js', () => {
  test('validates the default files on the real repo', () => {
    const res = runScript('validate-json.js');
    assert.strictEqual(res.code, 0);
    assert.match(res.out, /✅ \.markdownlint\.json/);
    assert.match(res.out, /✅ package\.json/);
    assert.match(res.out, /2 JSON file\(s\) valid/);
    assert.strictEqual(res.err, '');
  });

  test('accepts absolute paths to valid JSON files', () => {
    const dir = tempDir('validators-json-');
    const a = path.join(dir, 'a.json');
    const b = path.join(dir, 'b.json');
    fs.writeFileSync(a, '{"ok":true}');
    fs.writeFileSync(b, '[1,2,3]');
    const res = runScript('validate-json.js', [a, b]);
    assert.strictEqual(res.code, 0);
    assert.match(res.out, /1 ?JSON|2 JSON file\(s\) valid/);
    assert.ok(res.out.includes(a) && res.out.includes(b));
  });

  test('resolves relative paths against the repo root', () => {
    const res = runScript('validate-json.js', ['package.json']);
    assert.strictEqual(res.code, 0);
    assert.match(res.out, /1 JSON file\(s\) valid/);
  });

  test('fails with the parse error for invalid JSON', () => {
    const dir = tempDir('validators-json-');
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{"a": }');
    const res = runScript('validate-json.js', [bad]);
    assert.strictEqual(res.code, 1);
    assert.match(res.err, /Error: /);
    assert.match(res.err, /JSON validation failed/);
  });

  test('fails for a missing file', () => {
    const res = runScript('validate-json.js', ['definitely-missing-file.json']);
    assert.strictEqual(res.code, 1);
    assert.match(res.err, /File not found: definitely-missing-file\.json/);
    assert.match(res.err, /JSON validation failed/);
  });

  test('skips non-JSON files and exits 0 when nothing was validated', () => {
    const res = runScript('validate-json.js', ['README.md', 'notes.txt']);
    assert.strictEqual(res.code, 0);
    assert.match(res.out, /Skipped \(not a \.json file\): README\.md/);
    assert.match(res.out, /No JSON files were validated \(2 skipped\)/);
  });

  test('skipped files do not mask an invalid file', () => {
    const dir = tempDir('validators-json-');
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, 'not json');
    const res = runScript('validate-json.js', ['README.md', bad]);
    assert.strictEqual(res.code, 1);
    assert.match(res.out, /Skipped/);
  });
});

describe('scripts/validate-links.js', () => {
  test('scans the real repo (read-only) and the exit code matches the broken-link count', () => {
    hideRealJunkDirs();
    const res = runScript('validate-links.js');
    const broken = Number(/Broken links: (\d+)/.exec(res.out)[1]);
    assert.match(res.out, /Total links: \d+/);
    assert.match(res.out, /📄 README\.md/);
    assert.strictEqual(res.code, broken > 0 ? 1 : 0);
    assert.strictEqual((res.err.match(/Reason: File not found/g) || []).length, broken);
    assert.strictEqual(res.err.includes('Link validation failed'), broken > 0);
  });

  test('reports broken links, counts external and anchor links, skips dot dirs', () => {
    installRepoVfs({
      'README.md': [
        '[ok](docs/guide.md)',
        '[ok anchor](docs/guide.md#section)',
        '[missing](docs/nope.md)',
        '[ext](https://example.com/x#frag)',
        '[plain http](http://example.com)',
        '[self](#top)',
        '[empty path](#)',
      ].join('\n'),
      'docs/guide.md': 'no links here',
      'docs/other.md': '[back](../README.md)',
      '.hidden/secret.md': '[bad](gone.md)',
      'notes.txt': '[bad](gone.md)',
    });
    const res = runScript('validate-links.js');
    assert.strictEqual(res.code, 1);
    assert.match(res.out, /📄 README\.md/);
    assert.match(res.out, /📎 \[ok\]\(docs\/guide\.md\)/);
    assert.match(res.out, /🌐 \[ext\]/);
    assert.match(res.out, /⚓ \[self\]\(#top\)/);
    assert.match(res.err, /❌ \[missing\]\(docs\/nope\.md\)/);
    assert.match(res.err, /Reason: File not found: .*docs[\\/]nope\.md/);
    assert.match(res.err, /Link validation failed/);
    assert.match(res.out, /Total links: 8/);
    assert.match(res.out, /Broken links: 1/);
    assert.match(res.out, /External links not checked: 2/);
    // The anchor count includes the `#fragment` link on a file and the pure anchors
    assert.match(res.out, /Anchors not checked: 3/);
    // Files with no links are not listed and dot directories are skipped
    assert.doesNotMatch(res.out, /docs[\\/]guide\.md\n/);
    assert.doesNotMatch(res.out + res.err, /\.hidden/);
  });

  test('exits 0 when every link resolves', () => {
    installRepoVfs({
      'README.md': '[a](a.md) [b](sub/b.md#x)',
      'a.md': 'x',
      'sub/b.md': '[up](../a.md)',
    });
    const res = runScript('validate-links.js');
    assert.strictEqual(res.code, 0);
    assert.match(res.out, /Total links: 3/);
    assert.match(res.out, /Broken links: 0/);
    assert.match(res.out, /Anchors not checked: 1/);
  });
});

describe('scripts/validate-skill-structure.js', () => {
  const REQUIRED_FILES = [
    'README.md',
    'SKILL.md',
    'LICENSE',
    'agents/release-agent.md',
    'sub-skills/github-release/SKILL.md',
    'sub-skills/release-qa/SKILL.md',
    'sub-skills/release-handoff-generator/SKILL.md',
    'prompts/release.prompt.md',
    'prompts/changelog.prompt.md',
  ];

  const SKILL_BODY = [
    '## Purpose',
    '## Supported Project Types',
    '### Phase 1: Prep',
    'Quality Gates',
  ].join('\n');
  const AGENT_BODY = [
    '## Agent Role & Responsibilities',
    '### Prerequisites',
    '## Release Workflow',
    '## WordPress.org Compliance',
  ].join('\n');

  function validTree() {
    const files = {};
    REQUIRED_FILES.forEach((f) => {
      files[f] = 'content';
    });
    files['SKILL.md'] = SKILL_BODY;
    files['agents/release-agent.md'] = AGENT_BODY;
    ['github-release', 'release-qa', 'release-handoff-generator'].forEach((n) => {
      files[`sub-skills/${n}/SKILL.md`] = `---\nname: ${n}\n---\nbody`;
    });
    return files;
  }

  test('passes on the real repo (read-only)', () => {
    const res = runScript('validate-skill-structure.js');
    assert.strictEqual(res.code, 0);
    assert.match(res.out, /Skill structure is valid/);
    assert.match(res.out, /sub-skill directories found/);
    assert.strictEqual(res.err, '');
  });

  test('passes on a fully valid virtual tree, with quoted and CRLF names', () => {
    const files = validTree();
    files['sub-skills/release-qa/SKILL.md'] = '---\r\nname: "release-qa"\r\n---\r\nbody';
    files['sub-skills/github-release/SKILL.md'] = "---\nname: 'github-release'\n---\n";
    const res = runScript_virtual(files);
    assert.strictEqual(res.code, 0);
    assert.match(res.out, /✅ sub-skills\/release-qa/);
    assert.match(res.out, /3 sub-skill directories found/);
    assert.match(res.out, /\(\d+\.\d KB\)/);
  });

  test('reports every missing required directory and file', () => {
    const res = runScript_virtual({ 'unrelated.txt': 'x' });
    assert.strictEqual(res.code, 1);
    assert.match(res.err, /Missing directory: agents\//);
    assert.match(res.err, /Missing directory: sub-skills\/release-qa\//);
    assert.match(res.err, /Missing file: LICENSE/);
    assert.match(res.err, /Missing file: prompts\/changelog\.prompt\.md/);
    assert.match(res.err, /Skill structure validation failed/);
  });

  test('flags a directory where a file is expected', () => {
    const files = validTree();
    delete files.LICENSE;
    files['LICENSE/inner.txt'] = 'x';
    const res = runScript_virtual(files);
    assert.strictEqual(res.code, 1);
    assert.match(res.err, /Missing file: LICENSE/);
  });

  test('flags missing sections in SKILL.md and release-agent.md', () => {
    const files = validTree();
    files['SKILL.md'] = '# Title only';
    files['agents/release-agent.md'] = '# Agent only';
    const res = runScript_virtual(files);
    assert.strictEqual(res.code, 1);
    assert.match(res.err, /SKILL\.md missing "Main skill purpose"/);
    assert.match(res.err, /SKILL\.md missing "Supported project types"/);
    assert.match(res.err, /SKILL\.md missing "Pre-release workflow"/);
    assert.match(res.err, /SKILL\.md missing "Quality gates"/);
    assert.match(res.err, /release-agent\.md missing "Agent responsibilities"/);
    assert.match(res.err, /release-agent\.md missing "Prerequisites"/);
    assert.match(res.err, /release-agent\.md missing "Release workflow"/);
    assert.match(res.err, /release-agent\.md missing "WordPress compliance"/);
  });

  test('accepts a level-2 "Release Workflow" heading and case-insensitive quality gates', () => {
    const files = validTree();
    files['SKILL.md'] = SKILL_BODY.replace('Quality Gates', 'quality gates');
    files['agents/release-agent.md'] = AGENT_BODY.replace('## Release Workflow', '### Release Workflow');
    const res = runScript_virtual(files);
    assert.strictEqual(res.code, 0);
  });

  test('flags sub-skill frontmatter problems', () => {
    const files = validTree();
    files['sub-skills/github-release/SKILL.md'] = 'no frontmatter at all';
    files['sub-skills/release-qa/SKILL.md'] = '---\ndescription: x\n---\nbody';
    files['sub-skills/release-handoff-generator/SKILL.md'] = '---\nname: wrong-name\n---\nbody';
    files['sub-skills/extra-skill/notes.md'] = 'no SKILL.md here';
    files['sub-skills/stray-file.md'] = 'a file, not a directory';
    const res = runScript_virtual(files);
    assert.strictEqual(res.code, 1);
    assert.match(res.err, /sub-skills\/github-release\/SKILL\.md has no frontmatter `name:`/);
    assert.match(res.err, /sub-skills\/release-qa\/SKILL\.md has no frontmatter `name:`/);
    assert.match(res.err, /name "wrong-name" does not match its directory/);
    assert.match(res.err, /sub-skills\/extra-skill\/ has no SKILL\.md/);
    // Only directories are counted, not the stray file
    assert.match(res.out, /4 sub-skill directories found/);
  });

  test('an empty `name:` does not capture the following line', () => {
    const files = validTree();
    files['sub-skills/release-qa/SKILL.md'] = '---\nname:\ndescription: release-qa\n---\nbody';
    const res = runScript_virtual(files);
    assert.strictEqual(res.code, 1);
    assert.match(res.err, /sub-skills\/release-qa\/SKILL\.md has no frontmatter `name:`/);
  });

  test('skips content checks when SKILL.md and sub-skills are absent', () => {
    const res = runScript_virtual({ 'README.md': 'x' });
    assert.strictEqual(res.code, 1);
    assert.doesNotMatch(res.out, /Checking sub-skill frontmatter:[\s\S]*sub-skill directories found/);
    assert.doesNotMatch(res.out, /SKILL\.md contains/);
  });

  function runScript_virtual(files) {
    installRepoVfs(files);
    return runScript('validate-skill-structure.js');
  }
});
