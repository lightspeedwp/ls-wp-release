---
name: Release Ops Skills Review
description: Review of the lightspeed-release-ops plugin skills and how they were merged into this repository
version: 1.1.0
updated: 2026-11-05
---

# Release Ops Skills Review

This document reviews the six skills in the `lightspeed-release-ops` plugin and records how they were handled.
The approach was approved on 5 November 2026: **merge the pack's content into the existing sub-skills**, keep
linking the sub-skills from the root `SKILL.md`, and use the source pack's licence (GPL-3.0). No new sub-skill
folders were created.

## Summary

- The pack has six skills. Each `SKILL.md` is a stub: one heading, one sentence that repeats its description, and a
  footer. None has steps, inputs, outputs or checks. The orchestrator agent has no instructions either.
- Five of the six cover ground that existing sub-skills already cover in detail. The sixth (version bump planning)
  has no dedicated sub-skill, but its rules already live in the release prompt, the agent and `changelog-management`.
- Because the stubs only hold a description, merging means recording each description, with attribution, in the
  sub-skill it overlaps. This keeps both contents and says plainly what the existing skill does not cover.
- Importing the stubs as separate sub-skills would have added six files that restate the existing sub-skills with
  less detail, so that was not done.

## Source reviewed

| Item | Value |
| ---- | ----- |
| Repository | `lightspeedwp/.github` |
| Path | `plugins/lightspeed-release-ops` |
| Commit | `47aee0722033f65d4d9d57429b410b518646b817` |
| Contents | 6 skills, 1 orchestrator agent, plugin manifests for Claude, Codex, Gemini and Copilot |
| Versions | Pack `0.1.0`, skills `0.1.1`, orchestrator `v0.1.1` |
| Licence stated | `GPL-3.0` (pack README) |

Only `SKILL.md` content was in scope. The Codex, Gemini and Copilot manifests, the per-skill `agents/*.yaml` and
`metadata.yml` files, and the orchestrator agent were not used.

## What the source skills contain

| Skill | `SKILL.md` size | Body |
| ----- | --------------- | ---- |
| `lightspeed-release-readiness` | 441 bytes | Heading, one sentence, footer |
| `lightspeed-changelog-compliance` | 462 bytes | Heading, one sentence, footer |
| `lightspeed-release-notes-generator` | 460 bytes | Heading, one sentence, footer |
| `lightspeed-version-bump-planner` | 466 bytes | Heading, one sentence, footer |
| `lightspeed-release-rollout-checklist` | 470 bytes | Heading, one sentence, footer |
| `lightspeed-release-risk-assessment` | 434 bytes | Heading, one sentence, footer |

- The pack README is frontmatter plus a link to a `CONTRIBUTING.md` that is not in the pack. It states
  `stability: stable` for a `0.1.0` pack of stubs.
- The orchestrator agent has frontmatter and a footer, and no operational instructions.

## How each skill was handled

| Source skill | Overlaps | Result |
| ------------ | -------- | ------ |
| `lightspeed-release-readiness` | [release-qa](../sub-skills/release-qa/SKILL.md): seven quality gates, a pre-release checklist and a risk score | Merged: source note added to `release-qa` |
| `lightspeed-release-risk-assessment` | `release-qa` risk score and approval rules, and risk scoring in [release-approval-workflow](../sub-skills/release-approval-workflow/SKILL.md) | Merged: source note added to `release-qa` |
| `lightspeed-release-rollout-checklist` | `release-qa` pre-release checklist, the post-release checklist in [SKILL.md](../SKILL.md), and the rollback plan and monitoring sections of the handoff document that [release-handoff-generator](../sub-skills/release-handoff-generator/SKILL.md) produces | Merged: source note added to `release-qa` |
| `lightspeed-changelog-compliance` | [changelog-management](../sub-skills/changelog-management/SKILL.md): Keep a Changelog format, validation and versioning | Merged: source note added to `changelog-management` |
| `lightspeed-version-bump-planner` | No dedicated sub-skill. Scope rules are in the [release prompt](../prompts/release.prompt.md) and the [agent](../agents/release-agent.md), and `changelog-management` determines the version | Merged: source note added to `changelog-management` |
| `lightspeed-release-notes-generator` | [release-notes-generator](../sub-skills/release-notes-generator/SKILL.md): a full skill with references and scripts | Merged: source note added to `release-notes-generator` |

Each note quotes the stub's description, credits the source (repository, path, commit and licence), and states what
the existing sub-skill does not cover. No existing text was changed, and no skill name or frontmatter was changed.

## Concepts the source names that this repository does not cover

The stubs give no content for these, so they are recorded as gaps and not implemented:

- **semantic-release alignment** (in the changelog compliance description). The existing skills use Keep a Changelog
  and SemVer. The term `semantic-release` does not appear anywhere else in this repository.
- **Deployment safety, deployment controls and cutover** (in the readiness, rollout and risk descriptions). This
  repository covers publishing a release (tag, GitHub Release, WordPress.org). It does not cover deploying a site.
  The word "deploy" appears in only three sub-skills.
- **Mitigation recommendations** (in the risk assessment description). `release-qa` scores risk but does not
  recommend mitigations.

## Decisions

| Question | Decision |
| -------- | -------- |
| Import, merge or skip | Merge, so that neither the stubs' content nor the existing content is lost |
| Discovery | Keep linking the sub-skills from the root `SKILL.md`. No plugin packaging |
| Licence | Use the source pack's licence, GPL-3.0 |

## Still open

1. **Licence.** Resolved: the `LICENSE` file is the GNU GPL version 3, and `package.json` and `docs/DEVELOPMENT.md`
   now say `GPL-3.0` to match. The README's "internal toolkit" licence line is unchanged.
2. **Root identity.** The root `SKILL.md` frontmatter says `name: release`, while the repository is `ls-wp-release`.
   Whether that name collides with anything else has not been checked.
3. **Nested discovery.** The 3 November report that nested `sub-skills/` folders are not discovered has not been
   verified here. Linking from the root `SKILL.md` does not depend on it.
4. **Deployment scope.** Whether deployment safety belongs in this skill at all.
5. **Real content for the gaps.** Version bump planning, a rollout checklist, deployment safety, semantic-release
   alignment and mitigation advice would each be new work with its own spec. They are not covered by this change.

## What was and was not checked

- **Checked:** the six `SKILL.md` files, the orchestrator, the pack README, the Claude plugin manifest, one
  `metadata.yml` and one `agents/claude.yaml`, all at the commit above. The named sections of the existing
  sub-skills. A search of this repository for `semantic-release` and `deploy`, and of `release-qa` for `mitigat`.
- **Not checked:** how any host discovers or loads nested skills, whether the plugin installs, other revisions of the
  source pack, and licence compatibility in law. This is not legal advice.
