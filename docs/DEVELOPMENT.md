---
name: Development Guide
description: Setup and development guide for the release skill
version: 1.0.0
updated: 2026-10-30
---

# Development Guide

This document covers setup, development workflow, and validation for the LightSpeedWP Release Skill.

## Prerequisites

- Node.js 22.12+ (required by Vitest; for development tools)
- Git (for version control and hooks)
- Lefthook (installed automatically via npm)

## Setup

### 1. Install Dependencies

```bash
cd release
npm install
```

This installs:
- `lefthook` — Git hooks manager
- `markdownlint-cli` — Markdown linting
- `vitest` and `@vitest/coverage-v8` — test runner and coverage (kept on the same version)
- `semver` — used by the multi-package release helper scripts

`yamllint` is a Python tool and is **not** an npm package. Install it separately
(for example `pip install yamllint`). `npm run lint:yaml` and the YAML git hook
fail if it is missing, rather than skipping the check.

> `npm install` runs the `prepare` script, which runs `lefthook install` and
> writes git hooks into this checkout.

### 2. Install Git Hooks

Hooks are installed automatically by the `prepare` npm script:

```bash
npm install
# or manually:
lefthook install
```

This sets up:
- **pre-commit** — Lint and validate files before committing
- **pre-push** — Run tests and checks before pushing
- **commit-msg** — Validate commit message format
- **post-checkout** — Alert about dependency changes
- **post-merge** — Alert about dependency changes

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature develop
```

### 2. Make Changes

Edit markdown files, prompts, agent instructions, or skill definitions.

### 3. Validate Locally

Before committing, run validation:

```bash
npm run lint              # Run all linters
npm run validate:structure  # Check skill structure
npm run validate:links    # Check internal links
npm run docs:validate     # Run all documentation checks
npm test                  # Run the validator fixture tests
```

### 4. Commit Changes

Write a clear commit message following Conventional Commits format:

```bash
git add .
git commit -m "feat(release-qa): Add security validation gate"
```

**Commit message format:**
```
type(scope): description

[optional body]
[optional footer]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Formatting or whitespace
- `refactor` — Code reorganization
- `test` — Tests or test infrastructure
- `chore` — Build, dependencies, or tooling

**Examples:**
```
feat(release-agent): Add pre-release checklist generation
fix(github-release): Correct SVN package structure
docs(changelog): Add WordPress block examples
refactor(release-qa): Simplify version alignment check
```

The lefthook `commit-msg` hook will validate the format before allowing the commit.

### 5. Push Changes

```bash
git push origin feature/your-feature
```

The lefthook `pre-push` hook will run:
- Tests (`npm test`)
- Linters
- Documentation validation

If any check fails, fix the issues and retry:

```bash
npm run lint:fix  # Auto-fix markdown formatting
git add <the files you changed>
git commit -m "chore: Fix linting issues"
git push origin feature/your-feature
```

### 6. Create a Pull Request

Push to GitHub and create a PR from `feature/your-feature` to `develop`.

## Git Hooks

### pre-commit

**What it checks:**
- Markdown linting (`.md` files)
- JSON validation (`.json` files)
- YAML validation (`.yml` files)

**Skip pre-commit (not recommended):**
```bash
git commit --no-verify
```

### pre-push

**What it checks:**
- Tests pass
- Linters pass (markdown, JSON, YAML)
- Documentation files present

**Skip pre-push (not recommended):**
```bash
git push origin main --no-verify
```

### commit-msg

**What it checks:**
- Conventional Commits format
- Message has a type and description

**Valid examples:**
```
feat(release-qa): Add security validation gate
fix: Correct version alignment check
docs: Update README with examples
```

**Invalid examples:**
```
updated stuff          # Missing type
feat: :bug: Fix stuff  # Emoji in type
add feature            # Lowercase type
```

### post-checkout & post-merge

**What it does:**
- Alerts if `package-lock.json` or `composer.lock` changed
- Suggests running `npm install` or `composer install`

## Validation Scripts

### Check Linting

```bash
npm run lint              # Run all linters
npm run lint:markdown     # Markdown only
npm run lint:json         # JSON only
npm run lint:yaml         # YAML only
npm run lint:fix          # Auto-fix markdown
```

### Validate Structure

```bash
npm run validate:structure
# Checks for required files and directories
# Verifies key sections in SKILL.md and release-agent.md
```

### Validate Links

```bash
npm run validate:links
# Checks all internal and external markdown links
# Reports broken links
```

### Full Documentation Check

```bash
npm run docs:validate
# Runs all checks: lint + structure + links
```

## File Structure

Required files for the release skill:

```
release/
├── README.md                          # Quick start guide
├── SKILL.md                           # Skill specification
├── LICENSE                            # GPL-3.0 license
├── package.json                       # npm configuration
├── .lefthook.yml                      # Git hooks configuration
├── .markdownlint.json                 # Markdown linter config
├── agents/
│   └── release-agent.md               # Agent instructions
├── sub-skills/                        # 12 bundled sub-skills (core three shown)
│   ├── github-release/
│   │   └── SKILL.md
│   ├── release-qa/
│   │   └── SKILL.md
│   ├── release-handoff-generator/
│   │   └── SKILL.md
│   └── ...                            # each has its own SKILL.md
├── prompts/
│   ├── release.prompt.md
│   └── changelog.prompt.md
├── scripts/
│   ├── validate-json.js
│   ├── validate-skill-structure.js
│   └── validate-links.js
├── tests/                             # Validator fixture tests (Vitest)
└── docs/
    └── DEVELOPMENT.md                 # This file
```

## Editing Guidelines

### Markdown Files

- Use 2-space indentation for lists
- Use 120-character line limit (soft, breakable for content)
- Use consistent heading levels
- Include code examples where helpful
- Link to related files using relative paths

**Good example:**
```markdown
## Release Workflow

### Step 1: Validate

Run the validation phase:

\`\`\`bash
/release --dry-run
\`\`\`

This checks:
- Tests pass
- Changelog is valid
- Versions align

See [[release-qa]] for details.
```

### Skill Definitions

- Use YAML frontmatter for metadata
- Include version and update date
- Write clear Purpose and Features sections
- Provide workflow examples
- Include troubleshooting section
- Link to related skills

**Structure:**
```markdown
---
name: skill-name
description: One-line description
metadata:
  version: 1.0.0
  updated: 2026-10-30
---

# Skill Name

## Purpose

...

## Workflow

...

## Troubleshooting

...
```

### Scripts

- Write any new script in TypeScript.
- Do not add shell (`.sh`) scripts.
- Existing JavaScript scripts stay as they are. Converting them is a separate decision, not part of this rule.
- TypeScript tooling is not set up in this repository yet.

See [scripts/README.md](../scripts/README.md) for the existing scripts.

## Testing

This skill is documentation-based. `npm test` runs Vitest (`vitest run --coverage`) over
`tests/*.test.cjs`, which covers only the repository's own validators (JSON, links, skill
structure and the `lint:yaml` script) and three helper scripts against temporary fixtures.
It does not test the release workflow. Coverage is reported (text, `json-summary` and
`lcov` in `coverage/`) but no threshold is enforced yet. Most scripts run as subprocesses
in the tests, so the reported coverage is low.

Validation is done through:

1. **Linting** — Markdown, JSON, YAML syntax
2. **Structure checks** — Required files, sections and sub-skill frontmatter
3. **Link validation** — Relative file links resolve (external links and anchors are not checked)
4. **Validator tests** — `npm test`
5. **Manual testing** — Run `/release --dry-run` on a WordPress project

## Continuous Integration

When you push to GitHub, the repository runs:

1. Lint checks (via GitHub Actions, if configured)
2. Documentation validation
3. Automated tests (if any)

All checks must pass before merging to `main`.

## Releasing

To release a new version of the skill:

1. Update `version` in `package.json`
2. Update version in skill frontmatter files
3. Add release notes to `CHANGELOG.md` (if applicable)
4. Commit: `chore: Release v1.1.0`
5. Tag: `git tag -a v1.1.0 -m "Release v1.1.0"`
6. Push: `git push origin main --tags`

## Troubleshooting

### Lefthook won't run

```bash
# Reinstall hooks
lefthook install

# Check hook status
lefthook status
```

### Linting fails but I can't fix it

```bash
# Try auto-fix for markdown
npm run lint:fix

# Check which files are failing
npm run lint
```

### Commit message rejected

```bash
# Check format
# Should be: type(scope): description

# Valid examples:
# feat(release-qa): Add gate
# fix: Correct check
# docs: Update guide
```

### Validation succeeds locally but fails in CI

1. Check you're using the same Node.js version (18+)
2. Run `npm install` again to ensure dependencies are current
3. Check that all files are committed (`git status`)
4. Look for environment-specific issues (line endings, etc)

### I need to skip hooks

```bash
# Skip all hooks (not recommended)
git commit --no-verify
git push --no-verify

# Run specific validation manually
npm run lint
npm run validate:structure
npm run validate:links
```

## Getting Help

- **Lefthook docs:** https://github.com/evilmartians/lefthook
- **Markdownlint rules:** https://github.com/DavidAnson/markdownlint/blob/main/README.md
- **Conventional Commits:** https://www.conventionalcommits.org/
- **This project:** See README.md or SKILL.md

## Contributing

1. Read this guide
2. Follow the development workflow
3. Ensure all validation passes
4. Create a clear PR description
5. Request review from team

---

**Last updated:** 2026-10-30  
**Maintained by:** LightSpeedWP Release Team
