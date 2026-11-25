---
name: release-handoff-generator
description: Generate comprehensive post-release documentation and handoff for WordPress block plugins and themes
metadata:
  version: 1.0.0
  updated: 2026-10-30
  author: LightSpeedWP Release Team
  tags:
    - handoff
    - documentation
    - release-notes
    - audit-trail
---

# Release Handoff Generator Skill

Generates comprehensive post-release documentation to support ongoing maintenance and knowledge transfer.

## Purpose

This sub-skill creates:

1. **Release Audit Log** — Timestamped record of release details
2. **Handoff Document** — Knowledge transfer for next maintainer
3. **Next-Cycle Plan** — Recommendations for development starting point
4. **Contributor Credits** — Recognition in release notes and changelog
5. **Follow-Up Issues** — Suggestions for post-release work
6. **Changelog Agent Handoff** — The four inputs the changelog agent (`ls-wp-changelog`) needs

## Outputs Generated

### 1. Release Audit Log

**File:** `.github/RELEASE_AUDIT_LOG.json`

Appends entry to log:

```json
{
  "releaseId": "rel_20261030_124500",
  "version": "1.2.4",
  "scope": "patch",
  "projectType": "plugin",
  "releasedBy": "ashley@lightspeedwp.agency",
  "releasedAt": "2026-10-30T16:54:00Z",
  "releaseProcess": {
    "dryRunDate": "2026-10-30T14:30:00Z",
    "dryRunDuration": "4m 15s",
    "executionDate": "2026-10-30T16:45:00Z",
    "executionDuration": "8m 32s",
    "totalTime": "12m 47s"
  },
  "gitDetails": {
    "baseBranch": "develop",
    "releaseBranch": "release/v1.2.4",
    "commitSha": "a1b2c3d4e5f6g7h8...",
    "tagSha": "tag-commit-sha-...",
    "prNumber": 42,
    "prMergedAt": "2026-10-30T16:50:00Z",
    "tagPushedAt": "2026-10-30T16:52:00Z"
  },
  "gitHubRelease": {
    "url": "https://github.com/lightspeedwp/plugin-name/releases/tag/v1.2.4",
    "published": true,
    "publishedAt": "2026-10-30T16:54:00Z",
    "preRelease": false
  },
  "changelog": {
    "section": "## [1.2.4] - 2026-10-30\n### Fixed\n- ...",
    "sectionLineCount": 8,
    "totalChangelogSize": 450
  },
  "contributors": {
    "count": 3,
    "list": [
      {
        "name": "John Doe",
        "login": "johndoe",
        "url": "https://github.com/johndoe",
        "prCount": 2
      },
      {
        "name": "Jane Smith",
        "login": "janesmith",
        "url": "https://github.com/janesmith",
        "prCount": 1
      },
      {
        "name": "Dev Team",
        "login": "devteam",
        "url": "https://github.com/lightspeedwp",
        "prCount": 1
      }
    ]
  },
  "qa": {
    "testsRun": 42,
    "testsPassed": 42,
    "codeCoverage": "82%",
    "lintErrors": 0,
    "securityIssues": 0,
    "riskScore": 0.15
  },
  "assets": {
    "created": [
      "plugin-name-v1.2.4.zip",
      "plugin-name-v1.2.4.zip.sha256",
      "wordpress-org-sync.tar.gz"
    ],
    "totalSize": "2.3 MB"
  },
  "wordpress": {
    "compliance": "PASS",
    "minWordPressVersion": "5.8",
    "maxTestedVersion": "6.4",
    "minPhpVersion": "7.4",
    "pluginSlug": "plugin-name"
  },
  "status": "success",
  "notes": "Patch release for critical bug fix in block rendering",
  "nextSteps": [
    "Monitor GitHub issues for reported problems",
    "Plan next release cycle",
    "Review and close resolved issues"
  ]
}
```

### 2. Handoff Document

**File:** `docs/HANDOFF_v1.2.4.md`

```markdown
# Release Handoff: v1.2.4

**Release Date:** 2026-10-30 16:54 UTC  
**Released By:** ashley@lightspeedwp.agency  
**Release Type:** Patch  
**Status:** ✅ Published

## Quick Summary

- **Version:** 1.2.4 (Patch)
- **Contributors:** 3 contributors, 4 PRs merged
- **Changes:** 8 commits, 245 lines changed
- **Test Coverage:** 82% (target: 70%)
- **Risk Score:** 0.15 (LOW RISK)

### What's New

#### Fixed
- Resolved block rendering issue in editor view (#38)
- Fixed incorrect breakpoint calculation on mobile devices (#39)

#### Added
- Documentation for custom hooks and filters
- Developer contribution guidelines

#### Changed
- Updated block registration pattern for better performance
- Improved error handling in API calls

### Release Artifacts

- **GitHub Release:** [v1.2.4](https://github.com/lightspeedwp/plugin-name/releases/tag/v1.2.4)
- **Changelog:** [CHANGELOG.md](../../CHANGELOG.md)
- **Download:** [plugin-name-v1.2.4.zip](https://github.com/lightspeedwp/plugin-name/releases/download/v1.2.4/plugin-name-v1.2.4.zip)
- **Signature:** [SHA256 Checksum](https://github.com/lightspeedwp/plugin-name/releases/download/v1.2.4/plugin-name-v1.2.4.zip.sha256)

## Release Timeline

| Step | Time | Duration | Status |
|------|------|----------|--------|
| Dry Run | 14:30 | 4m 15s | ✅ |
| Execution | 16:45 | 8m 32s | ✅ |
| PR Merged | 16:50 | - | ✅ |
| Tag Published | 16:52 | - | ✅ |
| Release Published | 16:54 | - | ✅ |

## Quality Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Tests | Pass | 42/42 ✅ | ✅ |
| Code Coverage | ≥70% | 82% | ✅ |
| Lint Errors | 0 | 0 | ✅ |
| Security Issues | 0 | 0 | ✅ |
| WordPress Compliance | Pass | ✅ | ✅ |

## Contributors

Thanks to these contributors:

- [@johndoe](https://github.com/johndoe) (2 PRs)
- [@janesmith](https://github.com/janesmith) (1 PR)
- [@devteam](https://github.com/lightspeedwp) (1 PR)

## What to Monitor

After this release, watch for:

1. **User Reports**
   - Check GitHub Issues for bug reports
   - Monitor WordPress.org plugin support forums
   - Follow LightSpeedWP Slack for customer feedback

2. **Integration Issues**
   - Test with popular themes and plugins
   - Verify WooCommerce integration (if applicable)
   - Check with page builders (Elementor, etc.)

3. **Performance**
   - Monitor server logs for errors
   - Check browser console for JS errors
   - Verify database queries are efficient

4. **WordPress.org**
   - SVN sync may take 24-48 hours
   - Monitor wordpress.org for pending review
   - Check for any guideline violations

## Known Issues / Limitations

None documented at release time. See [ISSUES](../../issues) for open items.

## Rollback Plan

If critical issues arise, rollback is possible:

```bash
# Delete tag and release
git tag -d v1.2.4
git push origin --delete v1.2.4
gh release delete v1.2.4

# Revert main to previous commit
git revert <COMMIT_SHA>
git push origin main

# Issue emergency patch when ready
/release --scope=patch --notes="Emergency rollback and fix"
```

## Next Steps for Maintainer

1. **Monitor GitHub Issues** (First 24 hours)
   - Review any new issues reported
   - Triage for patch/minor/major fixes
   - Assign to team members if needed

2. **Plan Next Release** (Within 1 week)
   - Review open issues and PRs
   - Discuss feature roadmap with team
   - Schedule next release if needed

3. **Documentation Updates** (Within 2 weeks)
   - Update README with any new features
   - Add/update API documentation
   - Review and update screenshots/gifs

4. **Community Engagement** (Ongoing)
   - Answer questions in support channels
   - Respond to issue comments promptly
   - Thank contributors publicly

## Key Contacts

| Role | Name | Contact |
|------|------|---------|
| Release Manager | Ashley | ashley@lightspeedwp.agency |
| Project Lead | [Team Lead] | [email] |
| Backup Maintainer | [Name] | [email] |

## Useful Commands

```bash
# View this release
gh release view v1.2.4

# View changelog
git log v1.2.3..v1.2.4 --oneline

# Compare with previous release
gh release view v1.2.3

# Check git tag details
git show v1.2.4

# Download release assets
gh release download v1.2.4

# Monitor develop/main sync
git branch -vv
```

## Additional Resources

- [Release Process](../../docs/RELEASE_PROCESS.md)
- [Versioning Guidelines](../../docs/VERSIONING.md)
- [Changelog Rules](../../docs/CHANGELOG_RULES.md)
- [WordPress Compliance](../../docs/RELEASE_WORDPRESS.md)
- [Troubleshooting](../../docs/RELEASE_TROUBLESHOOTING.md)

---

**Generated:** 2026-10-30 16:54:00 UTC  
**Release Agent Version:** 1.0.0  
**For questions, see:** [RELEASE_TROUBLESHOOTING.md](../../docs/RELEASE_TROUBLESHOOTING.md)
```

### 3. Next-Cycle Plan

**File:** `.github/NEXT_CYCLE_PLAN.md`

```markdown
# Next Development Cycle Plan

**Based on:** v1.2.4 Release  
**Start Date:** 2026-10-31  
**Planned For:** v1.3.0 (minor) or v1.2.5 (patch)

## Recommended Focus Areas

### High Priority (Backlog)

- [ ] Issue #40: Support for custom post types
- [ ] Issue #41: Performance optimization for large datasets
- [ ] Issue #42: Accessibility improvements (WCAG 2.1)

### Medium Priority

- [ ] PR #43: Internationalization improvements
- [ ] PR #44: Documentation enhancements
- [ ] Issue #45: API endpoint expansion

### Low Priority (Nice to Have)

- [ ] Issue #46: UI polish and animations
- [ ] Issue #47: Advanced configuration options
- [ ] Issue #48: Developer dashboard

## Development Workflow

1. **Branch from develop**
   ```bash
   git checkout -b feature/your-feature develop
   ```

2. **Update CHANGELOG.md as you work**
   - Add entries to `## [Unreleased]` section
   - Use existing categories or document new ones

3. **Regular testing**
   ```bash
   npm test
   npm run lint
   ```

4. **Create PR to develop when ready**
   - Include link to related issues
   - Add changelog entry description
   - Request review from team

5. **When ready for release**
   ```bash
   /release --scope=minor  # for new features
   # or
   /release --scope=patch  # for bug fixes only
   ```

## Milestone Planning

- **v1.2.5** (Patch): Bug fixes, security patches — Expected 2026-11-15
- **v1.3.0** (Minor): New features, enhancements — Expected 2026-12-15
- **v2.0.0** (Major): Breaking changes, major refactor — Planned for 2027

## Team Assignments

| Issue | Assignee | Estimate |
|-------|----------|----------|
| #40 | john@lightspeedwp.agency | 8h |
| #41 | jane@lightspeedwp.agency | 13h |
| #42 | design-team@lightspeedwp.agency | 5h |

## Review Checklist Before Next Release

- [ ] All assigned issues resolved
- [ ] CHANGELOG.md is up to date
- [ ] Tests pass and coverage meets target
- [ ] Documentation is current
- [ ] No regressions in existing features
- [ ] WordPress.org compliance maintained
```

### 4. Contributor Credits

**Added to GitHub Release:**

```markdown
## Credits

This release was made possible by contributions from:

- [@johndoe](https://github.com/johndoe) — Block rendering fix
- [@janesmith](https://github.com/janesmith) — Mobile breakpoint correction
- [@devteam](https://github.com/lightspeedwp) — Documentation

Thank you to all who reported issues, tested code, and provided feedback!
```

### 5. Follow-Up Issues

**File:** `.github/RELEASE_FOLLOWUP_ISSUES.json`

```json
{
  "releaseVersion": "1.2.4",
  "generatedAt": "2026-10-30T16:54:00Z",
  "suggestedFollowUpIssues": [
    {
      "title": "Test v1.2.4 with WooCommerce 8.0+",
      "body": "Verify compatibility with latest WooCommerce version",
      "labels": ["testing", "compatibility"],
      "milestone": "v1.3.0"
    },
    {
      "title": "Document new hooks introduced in v1.2.4",
      "body": "Add to API reference and developer docs",
      "labels": ["documentation", "api"],
      "milestone": "v1.3.0"
    },
    {
      "title": "Update screenshots for WordPress.org",
      "body": "Update plugin directory screenshots to reflect v1.2.4 UI",
      "labels": ["documentation", "wordpress-org"],
      "milestone": "v1.3.0"
    },
    {
      "title": "Performance benchmarking for v1.2.4",
      "body": "Run performance tests and document results",
      "labels": ["performance", "testing"],
      "milestone": "v1.3.0"
    }
  ]
}
```

### 6. Changelog Agent Handoff

**When:** only when the release is evidenced complete: the release PR is merged, the tag is pushed and the
GitHub Release is published. Do not infer completion.

**Contract:** the handoff to `ls-wp-changelog` carries four inputs.

```text
Changelog agent handoff (example values)
- version: 1.2.4
- release issue: the issue that tracked the release (ID or URL)
- PR list: links to the PRs included in the release
- changelog path: CHANGELOG.md
```

| Input | What it holds |
| ----- | ------------- |
| `version` | The released version, `X.Y.Z` |
| `releaseIssue` | The issue that tracked the release (issue ID or URL) |
| `prList` | The pull requests included in the release (links) |
| `changelogPath` | The changelog file that holds the `## [X.Y.Z]` section |

**Rules:**

- If an input is not known, write "unknown" and say why. Never invent an issue, a PR or a path.
- The handoff does not publish, tag or release anything.
- How the handoff is delivered is not defined here; this section defines only its four inputs.
- What the changelog agent does with it is defined in the `ls-wp-changelog` repository.

## Integration

This skill is called automatically after release publication:

```bash
/release --scope=patch  # Runs all skills including handoff-generator
```

It can also be called independently:

```bash
/release-handoff-generator --version=1.2.4 --verbose
```

## Customization

### Custom Handoff Template

Create `.github/handoff-template.md` to customize format:

```markdown
# Release Handoff: {{VERSION}}

**Released:** {{RELEASED_AT}}  
**By:** {{RELEASED_BY}}

## Summary
{{SUMMARY}}

## Changes
{{CHANGELOG_SECTION}}

## Contributors
{{CONTRIBUTORS_LIST}}

## Quality
{{QUALITY_METRICS}}

## Next Steps
{{NEXT_STEPS}}
```

### Custom Audit Log Fields

Add to `.github/audit-config.json`:

```json
{
  "auditLog": {
    "includeFields": [
      "releaseId",
      "version",
      "releasedBy",
      "releasedAt",
      "gitDetails",
      "qa",
      "status",
      "customField1"
    ],
    "customFields": {
      "customField1": "Value from environment or input"
    }
  }
}
```

## See Also

- [[release]] — main release orchestration skill
- [[release-qa]] — quality gates and validation
- [[github-release]] — tag and release publication
