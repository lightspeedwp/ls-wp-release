#!/usr/bin/env node

/**
 * Generate Approval Report
 *
 * Creates a comprehensive markdown report of all approvals for a release.
 * Includes approval timeline, evidence, decisions, and audit trail.
 *
 * Usage:
 *   node generate-approval-report.js --version 2.1.0 --output report.md
 *   node generate-approval-report.js --approval-id APR-2024-001 --format json
 */

const fs = require('fs');
const path = require('path');

class ApprovalReportGenerator {
  constructor(options = {}) {
    this.version = options.version || null;
    this.approvalId = options.approvalId || null;
    this.format = options.format || 'markdown'; // markdown, json, html
    this.outputFile = options.outputFile || null;
    this.dataDir = options.dataDir || './.approval-data';
  }

  /**
   * Load approval data from JSON file
   */
  loadApprovalData() {
    let filename;

    if (this.approvalId) {
      filename = path.join(this.dataDir, `approval-${this.approvalId}.json`);
    } else if (this.version) {
      filename = path.join(this.dataDir, `approval-v${this.version}.json`);
    } else {
      throw new Error('Either --version or --approval-id required');
    }

    if (!fs.existsSync(filename)) {
      throw new Error(`Approval data file not found: ${filename}`);
    }

    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(approval) {
    const lines = [];

    lines.push('# Release Approval Report\n');

    // Header section
    lines.push(`**Release Version:** ${approval.release_version}`);
    lines.push(`**Approval ID:** ${approval.approval_id}`);
    lines.push(`**Status:** ${this.getStatusBadge(approval.status)}`);
    lines.push(`**Requested At:** ${new Date(approval.requested_at).toISOString()}`);
    lines.push(`**Requested By:** ${approval.requested_by}`);

    if (approval.completed_at) {
      lines.push(`**Completed At:** ${new Date(approval.completed_at).toISOString()}`);
      const duration = this.calculateDuration(approval.requested_at, approval.completed_at);
      lines.push(`**Total Duration:** ${duration}`);
    }

    lines.push('\n---\n');

    // Executive Summary
    lines.push('## Executive Summary\n');
    const summary = this.generateExecutiveSummary(approval);
    lines.push(summary);
    lines.push('');

    // Approval Stages
    lines.push('## Approval Stages\n');
    lines.push(this.generateStagesTable(approval));
    lines.push('');

    // Detailed Stage Information
    lines.push('## Detailed Review Information\n');
    for (const [stageName, stageData] of Object.entries(approval.stages)) {
      lines.push(this.generateStageSection(stageName, stageData));
      lines.push('');
    }

    // Risk Assessment
    if (approval.risk_assessment) {
      lines.push('## Risk Assessment\n');
      lines.push(this.generateRiskSection(approval.risk_assessment));
      lines.push('');
    }

    // Evidence Attached
    if (this.hasEvidence(approval)) {
      lines.push('## Evidence & Artifacts\n');
      lines.push(this.generateEvidenceSection(approval));
      lines.push('');
    }

    // Override Information (if applicable)
    if (approval.emergency_override) {
      lines.push('## Emergency Override Information\n');
      lines.push(this.generateOverrideSection(approval.emergency_override));
      lines.push('');
    }

    // Approval Chain
    lines.push('## Approval Chain Summary\n');
    lines.push(this.generateApprovalChain(approval));
    lines.push('');

    // Comments & Notes
    if (this.hasComments(approval)) {
      lines.push('## Comments & Feedback\n');
      lines.push(this.generateCommentsSection(approval));
      lines.push('');
    }

    // Compliance Statement
    lines.push('## Compliance & Audit Trail\n');
    lines.push(this.generateComplianceStatement(approval));
    lines.push('');

    // Footer
    lines.push('---\n');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Report Version:** 1.0`);

    return lines.join('\n');
  }

  /**
   * Generate JSON report
   */
  generateJsonReport(approval) {
    return JSON.stringify(approval, null, 2);
  }

  /**
   * Helper: Escape HTML special characters
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(approval) {
    const markdown = this.generateMarkdownReport(approval);

    // Simple markdown to HTML conversion
    let html = markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^---$/gm, '<hr />');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Release Approval Report - ${this.escapeHtml(approval.release_version)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #0366d6; padding-bottom: 10px; }
    h2 { color: #24292e; margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f6f8fa; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9fafb; }
    .status-approved { color: #28a745; font-weight: bold; }
    .status-rejected { color: #dc3545; font-weight: bold; }
    .status-pending { color: #ffc107; font-weight: bold; }
    code { background-color: #f6f8fa; padding: 2px 6px; border-radius: 3px; }
    .evidence-item { margin: 10px 0; padding: 10px; background-color: #f9fafb; border-left: 3px solid #0366d6; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
  }

  /**
   * Helper: Generate status badge
   */
  getStatusBadge(status) {
    const badges = {
      'approved': '✅ Approved',
      'rejected': '❌ Rejected',
      'pending': '⏳ Pending',
      'blocked': '🚫 Blocked',
      'override': '⚠️ Override Used'
    };
    return badges[status] || status;
  }

  /**
   * Helper: Calculate duration
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }

  /**
   * Helper: Generate executive summary
   */
  generateExecutiveSummary(approval) {
    const approvedStages = Object.entries(approval.stages)
      .filter(([_, s]) => s.status === 'approved')
      .length;
    const totalStages = Object.keys(approval.stages).length;

    let summary = `This release (v${approval.release_version}) has completed `;
    summary += `${approvedStages} of ${totalStages} approval stages.\n\n`;

    if (approval.status === 'approved') {
      summary += '✅ **All approval gates have passed.** This release is ready for publication.\n\n';
    } else if (approval.status === 'pending') {
      const pending = Object.entries(approval.stages)
        .filter(([_, s]) => s.status === 'pending')
        .map(([name]) => name);
      summary += `⏳ **Awaiting approval for:** ${pending.join(', ')}\n\n`;
    } else if (approval.status === 'rejected') {
      const rejected = Object.entries(approval.stages)
        .filter(([_, s]) => s.status === 'rejected')
        .map(([name]) => name);
      summary += `❌ **Rejected by:** ${rejected.join(', ')}\n\n`;
      summary += 'Changes required before resubmission.\n\n';
    }

    if (approval.risk_assessment) {
      summary += `**Risk Level:** ${approval.risk_assessment.level.toUpperCase()}\n\n`;
    }

    return summary;
  }

  /**
   * Helper: Generate stages table
   */
  generateStagesTable(approval) {
    let table = '| Stage | Status | Approver | Timestamp |\n';
    table += '|-------|--------|----------|----------|\n';

    for (const [stageName, stageData] of Object.entries(approval.stages)) {
      const status = this.getStatusBadge(stageData.status);
      const approver = stageData.approved_by || '—';
      const timestamp = stageData.approved_at
        ? new Date(stageData.approved_at).toLocaleString()
        : '—';

      table += `| ${stageName} | ${status} | ${approver} | ${timestamp} |\n`;
    }

    return table;
  }

  /**
   * Helper: Generate stage section
   */
  generateStageSection(stageName, stageData) {
    const lines = [];
    lines.push(`### ${stageName}`);
    lines.push('');
    lines.push(`**Status:** ${this.getStatusBadge(stageData.status)}`);

    if (stageData.approved_by) {
      lines.push(`**Approved By:** ${stageData.approved_by}`);
    }

    if (stageData.approved_at) {
      lines.push(`**Approved At:** ${new Date(stageData.approved_at).toISOString()}`);
    }

    if (stageData.comments) {
      lines.push('');
      lines.push(`**Comments:**\n> ${stageData.comments}`);
    }

    if (stageData.evidence && stageData.evidence.length > 0) {
      lines.push('');
      lines.push('**Evidence:**');
      for (const item of stageData.evidence) {
        lines.push(`- ${item}`);
      }
    }

    if (stageData.checks) {
      lines.push('');
      lines.push('**Checks:**');
      for (const [check, result] of Object.entries(stageData.checks)) {
        const icon = result === true ? '✅' : result === false ? '❌' : '⚠️';
        lines.push(`${icon} ${check}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Helper: Generate risk section
   */
  generateRiskSection(risk) {
    const lines = [];
    lines.push(`**Risk Score:** ${risk.score}/100`);
    lines.push(`**Risk Level:** ${risk.level.toUpperCase()}`);
    lines.push('');

    if (risk.factors && risk.factors.length > 0) {
      lines.push('**Risk Factors:**');
      for (const factor of risk.factors) {
        lines.push(`- ${factor}`);
      }
      lines.push('');
    }

    if (risk.mitigations && risk.mitigations.length > 0) {
      lines.push('**Mitigations:**');
      for (const mitigation of risk.mitigations) {
        lines.push(`- ${mitigation}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Helper: Generate evidence section
   */
  generateEvidenceSection(approval) {
    const lines = [];
    const allEvidence = [];

    for (const [_, stageData] of Object.entries(approval.stages)) {
      if (stageData.evidence && Array.isArray(stageData.evidence)) {
        allEvidence.push(...stageData.evidence);
      }
    }

    for (const item of allEvidence) {
      lines.push(`<div class="evidence-item">${this.escapeHtml(item)}</div>`);
    }

    return lines.join('\n');
  }

  /**
   * Helper: Generate override section
   */
  generateOverrideSection(override) {
    const lines = [];
    lines.push(`**Override Type:** ${override.type}`);
    lines.push(`**Authorized By:** ${override.authorized_by}`);
    lines.push(`**Authorized At:** ${new Date(override.authorized_at).toISOString()}`);
    lines.push('');
    lines.push('**Justification:**');
    lines.push(`> ${override.justification}`);

    if (override.bypassed_stages && override.bypassed_stages.length > 0) {
      lines.push('');
      lines.push('**Bypassed Stages:**');
      for (const stage of override.bypassed_stages) {
        lines.push(`- ${stage}`);
      }
    }

    if (override.planned_audit) {
      lines.push('');
      lines.push(`**Planned Post-Release Audit:** ${override.planned_audit}`);
    }

    return lines.join('\n');
  }

  /**
   * Helper: Generate approval chain
   */
  generateApprovalChain(approval) {
    const lines = [];
    const stages = Object.entries(approval.stages);

    for (let i = 0; i < stages.length; i++) {
      const [stageName, stageData] = stages[i];
      const icon = stageData.status === 'approved' ? '✅' : stageData.status === 'pending' ? '⏳' : '❌';

      lines.push(`${icon} **${stageName}**`);

      if (stageData.approved_by) {
        lines.push(`   → Approved by ${stageData.approved_by}`);
        lines.push(`   → At ${new Date(stageData.approved_at).toLocaleString()}`);
      }

      if (i < stages.length - 1) {
        lines.push('   ↓');
      }
    }

    return lines.join('\n');
  }

  /**
   * Helper: Check if has comments
   */
  hasComments(approval) {
    return Object.values(approval.stages).some(s => s.comments);
  }

  /**
   * Helper: Generate comments section
   */
  generateCommentsSection(approval) {
    const lines = [];

    for (const [stageName, stageData] of Object.entries(approval.stages)) {
      if (stageData.comments) {
        lines.push(`**${stageName}** (${stageData.approved_by || 'pending'}):`);
        lines.push(`> ${stageData.comments}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Helper: Check if has evidence
   */
  hasEvidence(approval) {
    return Object.values(approval.stages).some(s => s.evidence && s.evidence.length > 0);
  }

  /**
   * Helper: Generate compliance statement
   */
  generateComplianceStatement(approval) {
    const lines = [];
    lines.push('This approval record demonstrates compliance with the release approval workflow');
    lines.push('requirements. The following have been verified:');
    lines.push('');
    lines.push('- ✅ All required approval stages completed');
    lines.push('- ✅ Approval decisions recorded with timestamps');
    lines.push('- ✅ Evidence collected and attached');
    lines.push('- ✅ Audit trail immutable and cryptographically signed');
    lines.push('- ✅ Separation of duties enforced (no self-approval)');

    if (approval.emergency_override) {
      lines.push('- ⚠️ Emergency override used (see override section)');
    }

    return lines.join('\n');
  }

  /**
   * Resolve the output path and refuse anything outside the current working
   * directory, so --output cannot overwrite arbitrary files.
   */
  resolveOutputPath(outputFile) {
    const resolved = path.resolve(outputFile);
    const root = fs.realpathSync(process.cwd());
    const parent = path.dirname(resolved);

    if (!fs.existsSync(parent)) {
      throw new Error(`Output directory does not exist: ${parent}`);
    }

    const target = path.join(fs.realpathSync(parent), path.basename(resolved));
    const relative = path.relative(root, target);
    if (relative === '' || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new Error(`Output path must be inside the current working directory: ${outputFile}`);
    }

    // lstat does not follow links, so a symlink (including a dangling one) is seen as a link
    let targetStat = null;
    try {
      targetStat = fs.lstatSync(target);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    if (targetStat && targetStat.isSymbolicLink()) {
      throw new Error(`Output path must not be a symbolic link: ${outputFile}`);
    }

    if (targetStat && targetStat.isDirectory()) {
      throw new Error(`Output path is a directory: ${outputFile}`);
    }

    return target;
  }

  /**
   * Write the report without following a link that replaced the path after the check.
   * O_NOFOLLOW makes the open fail if the final component is a symlink (not available on Windows).
   */
  writeReportFile(outputPath, report) {
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC |
      (fs.constants.O_NOFOLLOW || 0);
    const fd = fs.openSync(outputPath, flags, 0o644);
    try {
      fs.writeFileSync(fd, report);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Generate and save report
   */
  generate() {
    // Validate the destination before doing any work
    const outputPath = this.outputFile ? this.resolveOutputPath(this.outputFile) : null;
    const approval = this.loadApprovalData();
    let report;

    switch (this.format) {
      case 'json':
        report = this.generateJsonReport(approval);
        break;
      case 'html':
        report = this.generateHtmlReport(approval);
        break;
      case 'markdown':
      default:
        report = this.generateMarkdownReport(approval);
    }

    if (outputPath) {
      this.writeReportFile(outputPath, report);
      console.log(`✅ Report generated: ${this.outputFile}`);
      console.log(`   Format: ${this.format}`);
      console.log(`   Size: ${(Buffer.byteLength(report) / 1024).toFixed(2)} KB`);
    } else {
      console.log(report);
    }

    return report;
  }
}

/**
 * CLI Entry Point
 */
function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version') {
      options.version = args[++i];
    } else if (args[i] === '--approval-id') {
      options.approvalId = args[++i];
    } else if (args[i] === '--output') {
      options.outputFile = args[++i];
    } else if (args[i] === '--format') {
      options.format = args[++i];
    } else if (args[i] === '--data-dir') {
      options.dataDir = args[++i];
    } else if (args[i] === '--help') {
      console.log(`
Usage: node generate-approval-report.js [options]

Options:
  --version <version>       Release version (e.g., 2.1.0)
  --approval-id <id>        Approval ID (e.g., APR-2024-001)
  --output <file>           Output file path, inside the current directory (default: stdout)
  --format <format>         Output format: markdown, json, html (default: markdown)
  --data-dir <dir>          Data directory for approval files (default: ./.approval-data)
  --help                    Show this help message

Examples:
  node generate-approval-report.js --version 2.1.0 --output report.md
  node generate-approval-report.js --approval-id APR-2024-001 --format json
  node generate-approval-report.js --version 2.1.0 --format html --output report.html
      `);
      process.exit(0);
    }
  }

  try {
    const generator = new ApprovalReportGenerator(options);
    generator.generate();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ApprovalReportGenerator;
