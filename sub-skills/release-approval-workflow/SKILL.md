---
name: release-approval-workflow
description: Multi-level review and approval gates before release execution. Enforces security, quality, and compliance reviews with role-based approvals, audit logging, and evidence collection for enterprise WordPress plugin and theme releases.
---

# Release Approval Workflow

**Name:** `release-approval-workflow`

**Description:** Multi-level review and approval gates before release execution. Enforces security, quality, and compliance reviews with role-based approvals, audit logging, and evidence collection for enterprise WordPress plugin and theme releases.

## When to Use

- **Enterprise/compliance workflows** requiring formal approval processes
- **High-stakes releases** with security and regulatory requirements
- **Multi-team coordination** (security, product, QA)
- **Audit trail requirements** for change management
- **Pre-release validation** before publishing to WordPress.org or production
- **Risk-sensitive projects** requiring emergency override procedures

## What It Does

The Release Approval Workflow provides comprehensive approval gates with multi-level reviews, automated security checks, manual sign-offs, and complete audit logging. It prevents release execution without required approvals and tracks the complete history of approval decisions.

### Core Capabilities

#### 1. **Approval Workflow Stages**

Defines three sequential approval gates:

- **Security Review Gate**: Automated SAST scanning, dependency checking, header validation
- **Product/QA Sign-Off Gate**: Feature validation, documentation review, test coverage
- **Compliance Gate**: WordPress standards, legal review, regulatory requirements (optional)

Each stage can be configured as:
- **Automatic**: Runs validation scripts, blocks on failure
- **Manual**: Requires human approval via comments and sign-off
- **Conditional**: Automatic approval if criteria met, manual if edge cases

#### 2. **Role-Based Approvals**

Define approval requirements per role:

```yaml
roles:
  security_lead:
    required: true
    gates: [security_review]
    responsibilities:
      - Run SAST and dependency scans
      - Review security headers
      - Validate SSL/TLS configuration
      - Check for vulnerabilities
  
  product_manager:
    required: false
    gates: [product_review]
    responsibilities:
      - Verify feature completeness
      - Confirm documentation accuracy
      - Validate release notes
      - Check changelog format
  
  qa_lead:
    required: true
    gates: [qa_review]
    responsibilities:
      - Verify test coverage
      - Validate test execution
      - Confirm known issues documented
      - Review regression testing
```

#### 3. **Security Review Gate**

Automated security validation:

- **SAST (Static Application Security Testing)**
  - Scans PHP code for vulnerabilities
  - Detects SQL injection, XSS, unsanitized inputs
  - Reports severity levels (critical, high, medium, low)

- **Dependency Scanning**
  - Validates Composer dependencies for vulnerabilities
  - Checks npm packages (if using build tools)
  - Verifies no abandoned dependencies
  - Confirms license compliance

- **Header Validation**
  - Checks security headers (X-Frame-Options, Content-Security-Policy)
  - Validates nonce implementation
  - Verifies capability checking
  - Confirms escaping on output functions

- **WordPress-Specific Checks**
  - Validates plugin header format
  - Checks for required fields (Plugin Name, Description, Version, Author)
  - Confirms proper sanitization/escaping
  - Verifies action/filter hook naming

#### 4. **Product/QA Sign-Off Gate**

Manual review checkpoints:

- **Feature Validation Checklist**
  - All features documented in README
  - Changelog entries for user-facing changes
  - Version number correct per SemVer
  - Author and contributor attribution

- **Documentation Review**
  - README.md completeness
  - Installation instructions clear
  - Usage examples included
  - Troubleshooting section (if needed)
  - Changelog format validated

- **Test Coverage**
  - Minimum 70% code coverage required (configurable)
  - Critical paths have integration tests
  - No failing tests
  - All edge cases covered

- **Known Issues**
  - All known limitations documented
  - Workarounds provided where applicable
  - Future work captured

#### 5. **Changelog Audit**

Validates changelog completeness and format:

```yaml
checks:
  - format: Keep a Changelog 1.1.0
  - has_unreleased: Block if Unreleased section exists
  - version_matches: Verify version in changelog matches plugin
  - entries_per_category: Confirm Added/Changed/Fixed/Removed entries
  - dates_correct: Validate release date format (YYYY-MM-DD)
  - backward_compatibility: Verify compatibility notes present
  - breaking_changes: Document all breaking changes clearly
  - wordpress_version: Confirm minimum WP version documented
  - php_version: Confirm minimum PHP version documented
```

#### 6. **Version Validation**

Ensures proper SemVer implementation:

- **Version Format**: Must follow MAJOR.MINOR.PATCH (e.g., 2.1.0)
- **No Conflicts**: Version doesn't already exist in repository
- **Increment Logic**: Major/Minor/Patch increments make sense
- **Consistency**: Version matches across:
  - plugin.php (Plugin Version header)
  - package.json (if applicable)
  - readme.txt (Stable tag)
  - CHANGELOG.md (latest release)

#### 7. **Approval Tracking**

Complete approval lifecycle:

- **Approval Record Structure**
  ```json
  {
    "release_version": "2.1.0",
    "approval_id": "APR-2024-001",
    "requested_at": "2024-01-15T10:30:00Z",
    "requested_by": "developer@example.com",
    "status": "approved",
    "stages": {
      "security_review": {
        "status": "approved",
        "approved_at": "2024-01-15T11:00:00Z",
        "approved_by": "security_lead@example.com",
        "evidence": ["SAST scan results", "dependency check passed"],
        "comments": "No critical vulnerabilities found"
      },
      "qa_review": {
        "status": "approved",
        "approved_at": "2024-01-15T14:30:00Z",
        "approved_by": "qa@example.com",
        "evidence": ["Test coverage 85%", "All tests passing"],
        "comments": "Ready for production release"
      }
    }
  }
  ```

- **Approval Timeline**: Track all approvals with timestamps
- **Approval Comments**: Capture feedback and concerns
- **Evidence Collection**: Attach test results, scan reports, documentation
- **Conditional Approval**: Set conditions for auto-approval

#### 8. **Audit Trail**

Complete change history:

- **Who approved**: User/role that approved
- **When approved**: Exact timestamp
- **What they approved**: Specific version/changes
- **Why approved**: Comments and justification
- **Evidence attached**: Links to test results, scan reports
- **Status changes**: Track approval progression
- **Override events**: Log any emergency overrides with justification

### Approval Workflow Stages

#### Stage 1: Security Review (Automatic + Manual)

```workflow
1. Trigger security scans
   ├─ SAST scan via static analysis tools
   ├─ Dependency audit via Composer/npm
   └─ Security header validation

2. Collect results
   ├─ Parse scan output
   ├─ Generate severity report
   └─ Block on critical/high findings

3. Escalate if needed
   ├─ Auto-approve if no findings
   ├─ Create approval request if low/medium findings
   └─ Block release on critical findings

4. Security lead reviews
   ├─ Review scan results
   ├─ Provide comments/feedback
   └─ Approve or request changes
```

#### Stage 2: Product/QA Review (Manual)

```workflow
1. Verify feature completeness
   ├─ Check changelog entries
   ├─ Validate version format
   └─ Confirm release notes

2. Validate documentation
   ├─ README completeness
   ├─ Installation clarity
   └─ Example usage accuracy

3. Test coverage review
   ├─ Check code coverage metrics
   ├─ Verify critical path tests
   └─ Confirm test pass rate

4. QA sign-off
   ├─ Approve feature set
   ├─ Approve documentation
   └─ Confirm test readiness
```

#### Stage 3: Compliance (Optional/Conditional)

```workflow
1. WordPress standards check
   ├─ Plugin header validation
   ├─ Text domain consistency
   └─ Escaping/sanitization audit

2. Legal/regulatory review
   ├─ License compliance
   ├─ GDPR considerations
   └─ Terms of service updates

3. Compliance approval
   ├─ Confirm standards met
   ├─ Document any exceptions
   └─ Approve for release
```

### Evidence Collection

Automatically capture and attach evidence:

- **Security Scan Results**
  - SAST scan report (JSON/XML)
  - Dependency audit log
  - Security header validation checklist

- **Test Results**
  - Test execution summary
  - Code coverage report
  - Performance benchmarks (if applicable)

- **Documentation Review**
  - README validation checklist
  - Changelog completeness report
  - Inline code documentation coverage

- **Manual Review Notes**
  - Approval comments
  - Reviewer feedback
  - Risk assessment scores

### Approval Feedback & Comments

Support detailed approval workflows:

- **Comment Types**
  - Approval: "Looks good, ready to ship"
  - Request Changes: "Fix SQL injection on line 42"
  - Question: "Is this backward compatible with 1.5.x?"
  - Risk Flag: "This changes the database schema"

- **Thread Resolution**
  - Track status of feedback
  - Require resolution before approval
  - Document decisions made

- **Notification System**
  - Notify when approval requested
  - Notify when changes requested
  - Notify when approved/rejected
  - Escalate if overdue (>24hrs)

### WordPress Compliance Verification

Validates WordPress-specific requirements:

```checklist
□ Plugin header format (Plugin Name, Description, Version, Author, etc.)
□ Text domain consistent with plugin slug
□ Actions/filters follow WordPress naming conventions
□ All global functions properly namespaced
□ Security: nonces on form submissions
□ Security: capabilities checked before actions
□ Escaping: All user input sanitized
□ Escaping: All output escaped with esc_* functions
□ Database: All queries use wpdb->prepare()
□ Database: Custom tables use $wpdb->prefix
□ Hooks: No conflicting hook names
□ Compatibility: Tested with minimum PHP/WP version
□ Accessibility: WCAG 2.1 AA compliance (admin UI)
□ Internationalization: Strings wrapped in __() / _e()
```

### Risk Scoring

Automated risk assessment:

```javascript
calculateRisk() {
  let riskScore = 0;
  
  // Database changes: high risk
  if (hasDatabaseMigrations) riskScore += 40;
  
  // Security changes: high risk if not reviewed
  if (securityChanges && !securityApproved) riskScore += 30;
  
  // API changes: medium risk
  if (publicAPIChanges) riskScore += 20;
  
  // New dependencies: medium risk
  if (newDependencies) riskScore += 15;
  
  // Documentation changes: low risk
  if (onlyDocsChanged) riskScore += 5;
  
  return {
    score: riskScore, // 0-100
    level: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
    requiresSecurityReview: riskScore >= 30,
    requiresQASignOff: riskScore >= 20,
    requiresEmergencyApproval: false
  };
}
```

### Emergency Override Procedure

For production hotfixes requiring immediate release:

```workflow
1. Initiate override request
   ├─ Provide business justification
   ├─ Identify emergency conditions
   └─ List bypassed approval gates

2. Notify approval chain
   ├─ Alert all required approvers
   ├─ Set 15-minute response timeout
   └─ Escalate if no response

3. Log override decision
   ├─ Record justification
   ├─ Document who authorized
   ├─ Timestamp override
   └─ Plan post-release review

4. Execute with caution
   ├─ Deploy with extra monitoring
   ├─ Have rollback plan ready
   ├─ Brief support team
   └─ Schedule post-incident review

5. Post-release audit
   ├─ Review what was bypassed
   ├─ Document learnings
   └─ Update process if needed
```

## Example Workflows

### Standard Release Workflow

For typical feature releases with standard approval gates:

```
developer$ release prepare --version 2.1.0
✓ Version bumped
✓ Changelog updated
✓ Commits ready

developer$ release request-approval
→ Approval request created: APR-2024-001
→ Status: Awaiting Security Review

security_lead$ release approve --id APR-2024-001 --stage security_review
→ Security Review Stage
  ✓ SAST scan: 0 findings
  ✓ Dependencies: All current
  ✓ Headers: All secure
→ Approved by: security_lead@example.com
→ Status: Awaiting QA Review

qa_lead$ release approve --id APR-2024-001 --stage qa_review
→ QA Review Stage
  ✓ Test coverage: 87%
  ✓ All tests passing
  ✓ Changelog validated
→ Approved by: qa@example.com
→ Status: Ready for Release

developer$ release publish --version 2.1.0
✓ All approvals verified
✓ Release published to WordPress.org
✓ Version tagged: v2.1.0
```

### Enterprise Workflow with Compliance Gate

For regulated environments requiring strict compliance:

```
developer$ release prepare --version 1.5.0 --mode enterprise
✓ Version bumped
✓ Changelog updated
✓ Commits ready

developer$ release request-approval --require-compliance
→ Approval request created: APR-2024-002
→ Stages required:
  1. Security Review (required)
  2. QA Review (required)
  3. Compliance Review (required)
→ Status: Awaiting Security Review

# [After all approvals...]

compliance_lead$ release approve --id APR-2024-002 --stage compliance_review
→ Compliance Review Stage
  ✓ WordPress header validation: PASS
  ✓ License check: MIT
  ✓ GDPR assessment: Compliant
  ✓ Data handling: Reviewed
→ Approved by: compliance_lead@example.com
→ Status: Ready for Release

developer$ release publish --version 1.5.0
✓ All approvals verified (including compliance)
✓ Approval audit trail exported
✓ Release published and documented
```

### Emergency Hotfix with Override

For critical production issues:

```
developer$ release prepare --version 2.0.1 --mode hotfix
✓ Critical bug fixed
✓ Version bumped to 2.0.1

developer$ release request-emergency-override
→ Emergency Override initiated
→ Requesting authorization from: security_lead, qa_lead
→ Business justification: "Production outage affecting 1000+ sites"
→ Bypassing gates: QA Review, Compliance Review

security_lead$ release authorize-override --id APR-2024-003 \
  --reason "Critical data loss bug confirmed"
→ Override authorized by: security_lead@example.com
→ Gates bypassed: 2
→ Planned post-release review: scheduled

developer$ release publish --version 2.0.1 --override-authorized
✓ Emergency override authorized
✓ Release published with heightened monitoring
✓ Post-incident review scheduled for 2024-01-16
```

### Compliance-Heavy Release

For regulatory or security-focused releases:

```
developer$ release prepare --version 1.2.0 --compliance-focus
✓ Security headers added
✓ GDPR compliance verified
✓ Changelog includes compliance notes

developer$ release request-approval \
  --require-security \
  --require-qa \
  --require-compliance \
  --risk-level high
→ Multi-stage approval initiated
→ Risk level: HIGH
→ Estimated approval time: 2-3 days

# [Parallel approvals...]

# [After all stages approved...]

developer$ release publish --version 1.2.0 --export-audit-trail
✓ Audit trail exported
✓ Approval documentation saved
✓ Release published
✓ Regulatory documentation complete
```

## Integration Points

### Links to [[release]]

- Triggered by release main workflow after version bump
- Called before `release publish` execution
- Blocks release execution without approvals
- Exports approval data to release metadata

### Links to [[release-qa]]

- Shares QA test results and coverage data
- Pulls test evidence for approval documentation
- Integrates with test execution workflows
- Provides test coverage thresholds for auto-approval

### Links to [[changelog-management]]

- Validates changelog format and entries
- Confirms version consistency
- Integrates changelog validation in approval gates
- Exports changelog for approval evidence

### Links to GitHub/WordPress.org

- Tracks approval status in GitHub issue comments
- Exports approval report to release pull request
- Archives approval documentation with GitHub Releases
- Publishes approval metadata to release notes

## Configuration

### Approval Requirements Template

```yaml
# .github/approval-config.yml
approval:
  stages:
    - name: security_review
      type: automatic
      required: true
      timeout_hours: 24
      checks:
        - sast_scan
        - dependency_audit
        - security_headers
    
    - name: qa_review
      type: manual
      required: true
      timeout_hours: 48
      approvers:
        - role: qa_lead
          min_approvals: 1
        - role: senior_qa
          min_approvals: 0 # optional
      checks:
        - changelog_format
        - version_format
        - test_coverage: 70
    
    - name: compliance_review
      type: manual
      required: false # unless risk_level: high
      timeout_hours: 72
      approvers:
        - role: compliance_lead
          min_approvals: 1
      checks:
        - wordpress_standards
        - license_compliance
        - gdpr_assessment

  emergency_override:
    enabled: true
    requires_justification: true
    notification_grace_period_minutes: 15
    post_release_audit_required: true
    audit_delay_hours: 24
```

## Security Considerations

- **Audit Logging**: All approvals immutable and time-stamped
- **Role Validation**: Confirm approver has required role
- **Separation of Duties**: Developer cannot approve own release
- **Evidence Chain**: Maintain cryptographic hash of evidence
- **Approval Verification**: Always verify approval authenticity before publishing
- **Override Logging**: Emergency overrides require detailed justification and post-review

## References

See also:
- [[approval-roles.md]] - Define approval roles and responsibilities
- [[security-review-checklist.md]] - Security validation requirements
- [[compliance-requirements.md]] - Enterprise/regulatory approval needs
- [[release]] - Main release skill
- [[release-qa]] - Quality assurance validation
- [[changelog-management]] - Changelog format and validation
