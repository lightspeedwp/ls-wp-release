# Test Case: Handle Multi-Package Failure

## Scenario
Handle gracefully when one package releases successfully but another fails mid-orchestration.

> **Note:** the `lspeed` command used in this test case is not included in this repository. Treat its commands
> and outputs as illustrative of the intended workflow, not as something you can run today.

---

## Test Case 1: Plugin Succeeds, Theme CI Fails

### Setup

**Configuration**:
```json
{
  "group": "blocks-and-theme",
  "packages": [
    {"repo": "my-blocks", "type": "plugin", "releaseOrder": 1},
    {"repo": "my-theme", "type": "theme", "releaseOrder": 2}
  ],
  "failureMode": "hold-release",
  "rollbackOnPartialFailure": false,
  "gracePeriodMs": 600000
}
```

**Failure Scenario**:
- Plugin v1.2.0 releases successfully ✓
- Theme v1.2.0 GitHub Actions CI fails (test timeout)
- Theme tag created but release workflow stuck

### Execution Log

**Step 1: Plugin Release (Success)**
```
[INFO] Releasing plugin v1.2.0...
[INFO] Version bumped: 1.1.0 → 1.2.0
[INFO] Changelog updated
[INFO] git commit: "Release my-blocks v1.2.0"
[INFO] git push: origin/main
[INFO] git tag: v1.2.0
[INFO] npm publish: @lspeed/blocks@1.2.0
[INFO] GitHub Release created
[PASS] Plugin release succeeded ✓
[WAIT] Waiting 2 minutes for npm edge caching...
```

**Step 2: Theme Release (Failure)**
```
[INFO] Releasing theme v1.2.0...
[INFO] Version bumped: 1.1.0 → 1.2.0
[INFO] Changelog updated
[INFO] git commit: "Release my-theme v1.2.0"
[INFO] git push: origin/main
[INFO] git tag: v1.2.0
[INFO] Triggering GitHub Actions...
[ERROR] GitHub Actions workflow failed ✗
[ERROR] Reason: Test suite timeout (tests hung for 15 minutes)
[ERROR] Workflow run: https://github.com/org/my-theme/actions/runs/12345
[ERROR] Recommendation: Fix tests or retry workflow
[HOLD] Release orchestration paused
```

### Command
```bash
lspeed release --group blocks-and-theme --status
```

### Expected Output
```
Multi-Package Release: blocks-and-theme
Status: PARTIAL FAILURE ⚠️

Release Progress:
├─ Plugin (my-blocks)
│  └─ v1.2.0: Released ✓
│     ├─ GitHub Release: ✓ Created
│     ├─ npm: ✓ Published
│     └─ git tag: ✓ v1.2.0
│
└─ Theme (my-theme)
   └─ v1.2.0: FAILED ✗
      ├─ git tag: ✓ Created
      ├─ GitHub Actions: ✗ Workflow timeout
      ├─ Release: ✗ Not created
      └─ Issue: https://github.com/org/my-theme/actions/runs/12345

Status Summary:
- Plugin released and published successfully
- Theme tag created but release workflow failed
- Multi-package release not finalized

Options Available:
1. Retry theme release (fix tests, re-run workflow)
2. Rollback plugin (unpublish from npm, delete tags)
3. Release plugin solo (mark theme as incompatible)
4. Wait for manual theme fix (hold multi-package release in draft)

Next Steps:
1. Fix failing theme tests (test timeout issue)
2. Retry workflow: lspeed release --group blocks-and-theme --retry-failed
3. Or rollback: lspeed release --group blocks-and-theme --rollback --all
```

### Acceptance Criteria
✓ Plugin release completes successfully  
✓ Theme release detected as failed  
✓ Status command shows partial failure state  
✓ Clear options provided for recovery  
✓ No automatic rollback (user chooses action)  

---

## Test Case 2: Retry Failed Theme Release

### Command After Fix
After fixing the failing tests in theme repo:

```bash
lspeed release --group blocks-and-theme --retry-failed
```

### Expected Behavior

**Before Retry**:
```
Checking release state...
Previous state: Plugin released, Theme failed
Plugin version: 1.2.0 ✓
Theme version: 1.2.0 (tag exists but release failed)
```

**Retry Execution**:
```
[INFO] Retrying theme release...
[INFO] Theme version 1.2.0 already set
[INFO] Theme tag v1.2.0 already exists (skipping tag creation)
[INFO] Re-triggering GitHub Actions...
[INFO] Running workflow: .github/workflows/release.yml
[WAIT] Waiting for workflow to complete...
[INFO] Theme tests: PASS ✓
[INFO] Theme build: PASS ✓
[INFO] Theme artifacts generated
[PASS] Theme release workflow succeeded ✓
[INFO] GitHub Release created for v1.2.0

Retry completed successfully ✓

Multi-Package Release Status:
✓ Plugin: Released (v1.2.0)
✓ Theme: Released (v1.2.0)
✓ Creating unified release...
[INFO] GitHub Release created: blocks-and-theme-v1.2.0
[INFO] Links:
  - Plugin: https://github.com/org/my-blocks/releases/tag/v1.2.0
  - Theme: https://github.com/org/my-theme/releases/tag/v1.2.0
  - Unified: https://github.com/org/my-blocks/releases/tag/blocks-v1.2.0

Release orchestration complete ✓
```

### Acceptance Criteria
✓ Retry detects previous state  
✓ Skips already-completed steps  
✓ Re-runs only failed workflow  
✓ Finalizes multi-package release upon success  
✓ Creates unified release announcement  

---

## Test Case 3: Full Rollback Decision

### Scenario
Plugin released and published to npm, but user decides to rollback everything due to discovered incompatibility.

### Command
```bash
lspeed release --group blocks-and-theme --rollback --confirm
```

### Expected Output
```
Full Rollback: blocks-and-theme

WARNING: This will:
✗ Delete git tags: v1.2.0 (both repos)
✗ Unpublish npm: @lspeed/blocks@1.2.0
✗ Delete GitHub Releases (both packages)
✗ Revert version numbers to 1.1.0
✗ Is this irreversible in some systems

Proceeding with full rollback...

Step 1: Plugin Rollback
[INFO] Unpublishing npm: @lspeed/blocks@1.2.0
[INFO] npm unpublish response: success
[INFO] Deleting git tag: v1.2.0
[INFO] git push origin :refs/tags/v1.2.0
[INFO] Deleting GitHub Release
[INFO] API request: DELETE /repos/org/my-blocks/releases/{id}
[PASS] Plugin rollback complete ✓

Step 2: Theme Rollback
[INFO] Deleting git tag: v1.2.0
[INFO] git push origin :refs/tags/v1.2.0
[INFO] Deleting GitHub Release
[INFO] API request: DELETE /repos/org/my-theme/releases/{id}
[PASS] Theme rollback complete ✓

Step 3: Version Reset
[INFO] Resetting my-blocks.php to 1.1.0
[INFO] Resetting theme/style.css to 1.1.0
[INFO] git commit: "Rollback to v1.1.0 (v1.2.0 release reverted)"
[INFO] git push origin/main
[PASS] Versions reset ✓

Full Rollback Summary:
✓ npm package unpublished
✓ Git tags deleted
✓ GitHub Releases deleted
✓ Versions reset to 1.1.0
✓ Commit history recorded

Rollback complete. All systems back to pre-release state.

Recommendation: Address the incompatibility and prepare new release.
```

### Acceptance Criteria
✓ Confirms rollback impact before executing  
✓ Unpublishes from npm  
✓ Deletes all git tags  
✓ Removes GitHub Releases  
✓ Resets version numbers  
✓ Creates rollback commit for audit trail  
✓ Returns all systems to pre-release state  

---

## Test Case 4: Partial Rollback (Solo Release Decision)

### Scenario
Plugin released successfully. User decides theme isn't ready but wants to release plugin solo.

### Command
```bash
lspeed release --group blocks-and-theme --release-solo my-blocks --confirm
```

### Expected Output
```
Partial Release: Release plugin solo (theme on hold)

WARNING: This will:
✓ Keep plugin v1.2.0 released
✗ Hold theme v1.2.0 in draft state
⚠️ Create incompatibility between package versions

Proceeding...

Plugin Status: RELEASED ✓
├─ npm: @lspeed/blocks@1.2.0
├─ GitHub Release: ✓
└─ git tag: v1.2.0

Theme Status: ON HOLD
├─ git tag: v1.2.0 (created, pushed)
├─ GitHub Release: ✗ (not created)
└─ Status: Ready but not published

Multi-Package Release: DRAFT
├─ Body: "Plugin released solo. Theme pending."
└─ Status: Draft (not announced)

Document This Incompatibility:
1. Update plugin README: "Requires theme v1.2.0 or later"
2. Add warning to release notes: "Theme compatibility pending"
3. Consider bumping plugin to v1.2.1 with caution message

Options for Theme:
1. Fix issues and release: lspeed release --group blocks-and-theme --release-solo my-theme
2. Delete tag and abandon: git push origin :refs/tags/v1.2.0
3. Retry full release once both ready: lspeed release --group blocks-and-theme

Recommendation: Document clearly for users
```

### Acceptance Criteria
✓ Plugin fully released  
✓ Theme release workflow held  
✓ Multi-package release remains in draft  
✓ Clear documentation of incompatibility  
✓ Allows independent release of theme later  

---

## Test Case 5: Grace Period (Automatic Rollback Window)

### Setup
```json
{
  "gracePeriodMs": 600000,
  "failureMode": "hold-release"
}
```

Grace period: 10 minutes to verify no immediate issues.

### Timeline

```
T+0:00   Plugin released
T+0:02   Wait for npm caching
T+0:04   Theme released
T+0:05   Multi-package release created (in draft)
T+0:06   Announcement held
T+0:10:00 User reports: "Plugin breaks on WordPress 6.4!"

Action Needed: Rollback within grace period window
```

### Command (within grace period)
```bash
lspeed release --group blocks-and-theme --rollback --grace-period
```

### Expected Behavior
```
Grace Period Active (4 minutes remaining)

Rolling back within grace period...
[INFO] npm unpublish: @lspeed/blocks@1.2.0 (before CDN caching)
[INFO] Deleting tags and releases
[PASS] Rollback successful ✓

Release Impact:
✓ Plugin unpublished before npm CDN cacheing (safe)
✓ GitHub releases deleted (soft public impact)
✓ Most users unaffected (npm propagation ~10min)

Recommendation: If CDN has cached package:
1. Send urgent notice to users
2. Publish v1.2.1 with fix immediately
3. Mark v1.2.0 as deprecated
```

### Acceptance Criteria
✓ Grace period allows time to detect issues  
✓ Rollback within window unpublishes before CDN caching  
✓ Tracks rollback impact  
✓ Logs audit trail  

---

## Summary: Failure Handling Scenarios

| Scenario | Outcome | Action | Result |
|----------|---------|--------|--------|
| Plugin succeeds, theme CI fails | Partial | Retry or rollback | User choice |
| Retry succeeds | Success | Complete release | Full release |
| User requests rollback | Rollback | Unpublish all | Pre-release state |
| Solo release | Partial | Release plugin only | Known incompatibility |
| Grace period issue found | Rollback (safe) | Quick revert | Minimal user impact |

All scenarios should:
- ✓ Provide clear status
- ✓ Show available options
- ✓ Require explicit user confirmation
- ✓ Maintain audit trail
- ✓ Document incompatibilities clearly
