'use strict';

// Fixture tests for scripts/validate-skill-structure.js.
// The script is copied into a temporary skill tree and run from an unrelated
// working directory with an empty PATH.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'validate-skill-structure.js');
const CORE_SUB_SKILLS = ['github-release', 'release-qa', 'release-handoff-generator'];
const tempDirs = [];

function tempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function write(root, name, content) {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), content);
}

function subSkill(name) {
  return `---\nname: ${name}\ndescription: Fixture ${name}\n---\n\n# ${name}\n`;
}

// A complete, valid skill tree using the real sub-skills/ layout.
function makeValidProject() {
  const root = tempDir('ls-wp-release-structure-');
  write(root, 'scripts/validate-skill-structure.js', fs.readFileSync(SCRIPT, 'utf8'));
  write(root, 'README.md', '# Fixture\n');
  write(root, 'LICENSE', 'GPL-2.0\n');
  write(root, 'SKILL.md', '## Purpose\n\n## Supported Project Types\n\n### Phase 1: Validate\n\nQuality Gates\n');
  write(
    root,
    'agents/release-agent.md',
    '## Agent Role & Responsibilities\n\n### Prerequisites\n\n### Release Workflow\n\n## WordPress.org Compliance\n'
  );
  write(root, 'prompts/release.prompt.md', '# Release\n');
  write(root, 'prompts/changelog.prompt.md', '# Changelog\n');
  CORE_SUB_SKILLS.forEach((name) => write(root, `sub-skills/${name}/SKILL.md`, subSkill(name)));
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-skill-structure.js')], {
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

// process.on('exit') keeps this compatible with Node 18.0 (node:test after() needs 18.8).
process.on('exit', () => tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

test('a complete sub-skills/ tree is valid, from an unrelated working directory', () => {
  const result = run(makeValidProject());
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Skill structure is valid/);
});

test('a missing required core sub-skill fails', () => {
  const root = makeValidProject();
  fs.rmSync(path.join(root, 'sub-skills/release-qa'), { recursive: true });
  const result = run(root);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /sub-skills\/release-qa/);
});

test('the old skills/ layout is not accepted in place of sub-skills/', () => {
  const root = makeValidProject();
  fs.renameSync(path.join(root, 'sub-skills'), path.join(root, 'skills'));
  const result = run(root);
  assert.strictEqual(result.status, 1);
});

test('a sub-skill without frontmatter name fails', () => {
  const root = makeValidProject();
  write(root, 'sub-skills/extra-skill/SKILL.md', '# Extra Skill\n\n**Name:** `extra-skill`\n');
  const result = run(root);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /extra-skill/);
});

test('a sub-skill using skill_name instead of name fails', () => {
  const root = makeValidProject();
  write(root, 'sub-skills/extra-skill/SKILL.md', '---\nskill_name: extra-skill\n---\n\n# Extra\n');
  assert.strictEqual(run(root).status, 1);
});

test('an empty frontmatter name fails and does not borrow the next line', () => {
  const root = makeValidProject();
  write(root, 'sub-skills/extra-skill/SKILL.md', '---\nname:\ndescription: extra-skill\n---\n\n# Extra\n');
  const result = run(root);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /extra-skill\/SKILL\.md has no frontmatter/);
});

test('a quoted frontmatter name that matches its directory passes', () => {
  const root = makeValidProject();
  write(root, 'sub-skills/extra-skill/SKILL.md', '---\nname: "extra-skill"\n---\n\n# Extra\n');
  assert.strictEqual(run(root).status, 0);
});

test('a sub-skill whose name does not match its directory fails', () => {
  const root = makeValidProject();
  write(root, 'sub-skills/extra-skill/SKILL.md', subSkill('something-else'));
  assert.strictEqual(run(root).status, 1);
});

test('an optional extra sub-skill with correct frontmatter passes', () => {
  const root = makeValidProject();
  write(root, 'sub-skills/extra-skill/SKILL.md', subSkill('extra-skill'));
  assert.strictEqual(run(root).status, 0);
});

test('a ### Release Workflow heading in the agent file is accepted', () => {
  const result = run(makeValidProject());
  assert.doesNotMatch(result.stderr, /Release workflow/);
});

test('validation does not write to the project', () => {
  const root = makeValidProject();
  const before = snapshot(root);
  run(root);
  assert.deepStrictEqual(snapshot(root), before);
});
