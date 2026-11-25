#!/usr/bin/env node

/**
 * Audit Log Approval
 *
 * Manages audit trail logging for release approvals.
 * Logs all approval events, decisions, and overrides.
 * Provides audit trail reporting and compliance verification.
 *
 * Usage:
 *   node audit-log-approval.js --log-event --version 2.1.0 --stage security_review --status approved
 *   node audit-log-approval.js --report --version 2.1.0
 *   node audit-log-approval.js --verify --audit-file approval-audit.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AuditLogApproval {
  constructor(options = {}) {
    this.auditDir = options.auditDir || './.approval-audit';
    this.version = options.version || null;
    this.approvalId = options.approvalId || null;
    this.timestamp = options.timestamp || new Date().toISOString();
    // The audit directory is created on the first write (see writeAuditLog),
    // so read-only commands (--report, --export, --verify) never touch the filesystem.
  }

  /**
   * Log an approval event
   */
  logEvent(event) {
    const logEntry = {
      id: this.generateId(),
      timestamp: this.timestamp,
      type: event.type, // 'approval', 'rejection', 'override', 'comment'
      stage: event.stage || null,
      version: event.version || this.version,
      approval_id: event.approval_id || this.approvalId,
      user: event.user || null,
      role: event.role || null,
      status: event.status || null,
      details: event.details || {},
      comments: event.comments || null,
      evidence: event.evidence || [],
      checksum: null, // Will be calculated
      previous_checksum: null, // For immutability chain
      signature: null // Will be calculated
    };

    // Calculate checksum for immutability
    logEntry.checksum = this.calculateChecksum(logEntry);

    // Sign the entry
    logEntry.signature = this.signEntry(logEntry);

    // Write to audit log
    this.writeAuditLog(logEntry);

    console.log(`✅ Event logged: ${event.type} for ${event.version || 'unknown'}`);

    return logEntry;
  }

  /**
   * Log approval decision
   */
  logApproval(options) {
    return this.logEvent({
      type: 'approval',
      stage: options.stage,
      version: options.version,
      approval_id: options.approval_id,
      user: options.user,
      role: options.role,
      status: 'approved',
      details: {
        approval_reason: options.reason || null,
        approval_conditions: options.conditions || [],
        auto_approved: options.auto_approved || false,
        manual_review: !options.auto_approved
      },
      comments: options.comments || null,
      evidence: options.evidence || []
    });
  }

  /**
   * Log rejection decision
   */
  logRejection(options) {
    return this.logEvent({
      type: 'rejection',
      stage: options.stage,
      version: options.version,
      approval_id: options.approval_id,
      user: options.user,
      role: options.role,
      status: 'rejected',
      details: {
        rejection_reason: options.reason || null,
        findings: options.findings || [],
        remediation_steps: options.remediation_steps || []
      },
      comments: options.comments || null,
      evidence: options.evidence || []
    });
  }

  /**
   * Log emergency override
   */
  logOverride(options) {
    return this.logEvent({
      type: 'override',
      stage: null,
      version: options.version,
      approval_id: options.approval_id,
      user: options.user,
      role: options.role,
      status: 'override',
      details: {
        override_type: options.override_type || 'emergency',
        business_justification: options.justification || null,
        bypassed_stages: options.bypassed_stages || [],
        authorization_level: options.authorization_level || null,
        planned_audit_date: options.planned_audit_date || null
      },
      comments: options.comments || null,
      evidence: options.evidence || []
    });
  }

  /**
   * Log approval comment
   */
  logComment(options) {
    return this.logEvent({
      type: 'comment',
      stage: options.stage,
      version: options.version,
      approval_id: options.approval_id,
      user: options.user,
      role: options.role,
      status: 'comment',
      details: {
        comment_type: options.comment_type || 'feedback', // feedback, question, concern
        requires_response: options.requires_response || false
      },
      comments: options.comment || options.comments || null,
      evidence: options.evidence || []
    });
  }

  /**
   * Write audit log entry to file
   */
  writeAuditLog(entry) {
    const filename = `audit-${entry.version}-${entry.approval_id || 'unknown'}.jsonl`;
    const filepath = path.join(this.auditDir, filename);

    // Create the audit directory only when something is actually being written
    fs.mkdirSync(this.auditDir, { recursive: true });

    // Append to JSONL file (JSON Lines format - one entry per line)
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(filepath, line);

    // Also maintain an index file
    this.updateAuditIndex(entry);
  }

  /**
   * Update audit index for quick lookups
   */
  updateAuditIndex(entry) {
    const indexFile = path.join(this.auditDir, '_index.json');
    let index = {};

    if (fs.existsSync(indexFile)) {
      index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    }

    const key = `${entry.version}`;
    if (!index[key]) {
      index[key] = [];
    }

    index[key].push({
      id: entry.id,
      timestamp: entry.timestamp,
      type: entry.type,
      stage: entry.stage,
      user: entry.user,
      status: entry.status
    });

    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
  }

  /**
   * Generate unique event ID
   */
  generateId() {
    return `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate checksum for immutability verification
   */
  calculateChecksum(entry) {
    const data = JSON.stringify({
      timestamp: entry.timestamp,
      type: entry.type,
      stage: entry.stage,
      version: entry.version,
      user: entry.user,
      status: entry.status,
      details: entry.details,
      comments: entry.comments,
      evidence: entry.evidence
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sign audit log entry (HMAC-SHA256)
   */
  signEntry(entry) {
    const secret = process.env.AUDIT_SIGN_KEY;
    if (!secret) {
      throw new Error('AUDIT_SIGN_KEY environment variable is required for signing');
    }

    const data = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      checksum: entry.checksum,
      previous_checksum: entry.previous_checksum || null
    });

    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify audit log entry integrity
   */
  verifyEntry(entry) {
    const expectedChecksum = this.calculateChecksum(entry);
    const checksumValid = entry.checksum === expectedChecksum;

    const expectedSignature = this.signEntry(entry);
    const signatureValid = entry.signature === expectedSignature;

    return {
      valid: checksumValid && signatureValid,
      checksum_valid: checksumValid,
      signature_valid: signatureValid,
      timestamp: entry.timestamp,
      checksum: entry.checksum
    };
  }

  /**
   * Read audit trail for a specific version
   */
  readAuditTrail(version) {
    const filename = `audit-${version}-*.jsonl`;
    const filepath = path.join(this.auditDir, filename.replace('*', ''));

    // No audit directory means no trail yet; reading must not create it
    if (!fs.existsSync(this.auditDir)) {
      return [];
    }

    // Find matching files
    const dir = fs.readdirSync(this.auditDir);
    const files = dir.filter(f => f.startsWith(`audit-${version}-`));

    const entries = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.auditDir, file), 'utf8');
      const lines = content.trim().split('\n');
      for (const line of lines) {
        if (line) {
          entries.push(JSON.parse(line));
        }
      }
    }

    // Sort by timestamp
    entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return entries;
  }

  /**
   * Generate audit trail report
   */
  generateAuditReport(version) {
    const entries = this.readAuditTrail(version);

    if (entries.length === 0) {
      return `No audit trail found for version ${version}`;
    }

    const lines = [];
    lines.push(`# Audit Trail Report - v${version}\n`);
    lines.push(`**Total Events:** ${entries.length}`);
    lines.push(`**Date Range:** ${entries[0].timestamp} to ${entries[entries.length - 1].timestamp}`);
    lines.push('');

    // Event summary
    const eventCounts = {};
    for (const entry of entries) {
      eventCounts[entry.type] = (eventCounts[entry.type] || 0) + 1;
    }

    lines.push('## Event Summary');
    for (const [type, count] of Object.entries(eventCounts)) {
      lines.push(`- ${type}: ${count}`);
    }
    lines.push('');

    // Detailed events
    lines.push('## Detailed Events\n');
    for (const entry of entries) {
      lines.push(this.formatAuditEntry(entry));
      lines.push('');
    }

    // Compliance verification
    lines.push('## Compliance Verification\n');
    let allValid = true;
    let validCount = 0;
    for (const entry of entries) {
      const verification = this.verifyEntry(entry);
      if (verification.valid) {
        validCount++;
      } else {
        allValid = false;
        lines.push(`❌ Entry ${entry.id} integrity check failed`);
        if (!verification.checksum_valid) {
          lines.push(`   - Checksum mismatch`);
        }
        if (!verification.signature_valid) {
          lines.push(`   - Signature invalid`);
        }
      }
    }

    lines.push(`✅ Integrity verified: ${validCount}/${entries.length} entries`);
    lines.push(`Overall Status: ${allValid ? '✅ Valid' : '❌ Invalid'}`);
    lines.push('');

    // Chain of custody
    lines.push('## Chain of Custody\n');
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const verification = this.verifyEntry(entry);
      const status = verification.valid ? '✅' : '❌';
      lines.push(`${status} ${i + 1}. ${entry.type.toUpperCase()} - ${entry.timestamp}`);
      lines.push(`   User: ${entry.user || 'system'} | Role: ${entry.role || 'N/A'}`);
      lines.push(`   Status: ${entry.status} | Stage: ${entry.stage || 'N/A'}`);
      if (entry.comments) {
        lines.push(`   Comments: ${entry.comments}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format audit entry for display
   */
  formatAuditEntry(entry) {
    const lines = [];
    lines.push(`**[${entry.timestamp}]** ${entry.type.toUpperCase()}`);
    lines.push(`- ID: ${entry.id}`);
    lines.push(`- User: ${entry.user || 'system'}`);
    lines.push(`- Role: ${entry.role || 'N/A'}`);
    lines.push(`- Stage: ${entry.stage || 'N/A'}`);
    lines.push(`- Status: ${entry.status}`);

    if (Object.keys(entry.details).length > 0) {
      lines.push('- Details:');
      for (const [key, value] of Object.entries(entry.details)) {
        if (Array.isArray(value)) {
          lines.push(`  - ${key}: ${value.join(', ')}`);
        } else if (typeof value === 'object') {
          lines.push(`  - ${key}: ${JSON.stringify(value)}`);
        } else {
          lines.push(`  - ${key}: ${value}`);
        }
      }
    }

    if (entry.comments) {
      lines.push(`- Comments: ${entry.comments}`);
    }

    if (entry.evidence && entry.evidence.length > 0) {
      lines.push('- Evidence:');
      for (const item of entry.evidence) {
        lines.push(`  - ${item}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export audit trail
   */
  exportAuditTrail(version, format = 'json') {
    const entries = this.readAuditTrail(version);

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else if (format === 'markdown') {
      return this.generateAuditReport(version);
    } else if (format === 'csv') {
      return this.convertToCSV(entries);
    }

    return entries;
  }

  /**
   * Convert audit entries to CSV
   */
  convertToCSV(entries) {
    const headers = ['ID', 'Timestamp', 'Type', 'Stage', 'User', 'Role', 'Status', 'Comments'];
    const rows = [headers.map(h => `"${h}"`).join(',')];

    const escapeCSVValue = (value) => {
      const str = String(value || '');
      // Escape quotes
      const escaped = str.replace(/"/g, '""');
      // Prefix cells that start with formula chars
      if (/^[=+\-@\t\r]/.test(escaped)) {
        return `"'${escaped}"`;
      }
      return `"${escaped}"`;
    };

    for (const entry of entries) {
      const row = [
        entry.id,
        entry.timestamp,
        entry.type,
        entry.stage || '',
        entry.user || '',
        entry.role || '',
        entry.status,
        entry.comments || ''
      ];
      rows.push(row.map(escapeCSVValue).join(','));
    }

    return rows.join('\n');
  }

  /**
   * Verify entire audit trail integrity
   */
  verifyAuditTrail(version) {
    const entries = this.readAuditTrail(version);
    const results = {
      total_entries: entries.length,
      valid_entries: 0,
      invalid_entries: 0,
      invalid_details: [],
      timestamp_sequence_valid: true,
      earliest: null,
      latest: null
    };

    // Verify each entry
    for (const entry of entries) {
      const verification = this.verifyEntry(entry);
      if (verification.valid) {
        results.valid_entries++;
      } else {
        results.invalid_entries++;
        results.invalid_details.push({
          id: entry.id,
          timestamp: entry.timestamp,
          checksum_valid: verification.checksum_valid,
          signature_valid: verification.signature_valid
        });
      }
    }

    // Verify timestamp sequence
    if (entries.length > 0) {
      results.earliest = entries[0].timestamp;
      results.latest = entries[entries.length - 1].timestamp;

      for (let i = 1; i < entries.length; i++) {
        if (new Date(entries[i].timestamp) < new Date(entries[i - 1].timestamp)) {
          results.timestamp_sequence_valid = false;
          break;
        }
      }
    }

    return results;
  }
}

/**
 * CLI Entry Point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Usage: node audit-log-approval.js [command] [options]

Commands:
  --log-event              Log an approval event
  --log-approval           Log an approval decision
  --log-rejection          Log a rejection decision
  --log-override           Log an emergency override
  --log-comment            Log an approval comment
  --report                 Generate audit trail report
  --export                 Export audit trail
  --verify                 Verify audit trail integrity
  --help                   Show this help message

Event Options:
  --version <version>      Release version (e.g., 2.1.0)
  --approval-id <id>       Approval ID (e.g., APR-2024-001)
  --stage <stage>          Stage name (e.g., security_review)
  --status <status>        Event status
  --user <user>            User email/ID
  --role <role>            User role (security_lead, qa_lead, etc.)
  --reason <reason>        Approval/rejection reason
  --comments <comments>    Comments or feedback
  --evidence <evidence>    Evidence items (comma-separated)

Examples:
  node audit-log-approval.js --log-approval \\
    --version 2.1.0 \\
    --approval-id APR-2024-001 \\
    --stage security_review \\
    --user security_lead@example.com \\
    --role security_lead \\
    --reason "No critical vulnerabilities found"

  node audit-log-approval.js --report --version 2.1.0

  node audit-log-approval.js --verify --version 2.1.0

  node audit-log-approval.js --export --version 2.1.0 --format csv
    `);
    process.exit(0);
  }

  const options = {
    auditDir: process.env.AUDIT_DIR || './.approval-audit'
  };

  let command = null;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--log-event':
      case '--log-approval':
      case '--log-rejection':
      case '--log-override':
      case '--log-comment':
      case '--report':
      case '--export':
      case '--verify':
        command = args[i].substring(2);
        break;
      case '--version':
        options.version = args[++i];
        break;
      case '--approval-id':
        options.approvalId = args[++i];
        break;
      case '--stage':
        options.stage = args[++i];
        break;
      case '--user':
        options.user = args[++i];
        break;
      case '--role':
        options.role = args[++i];
        break;
      case '--reason':
        options.reason = args[++i];
        break;
      case '--comments':
        options.comments = args[++i];
        break;
      case '--evidence':
        options.evidence = args[++i].split(',').map(e => e.trim());
        break;
      case '--format':
        options.format = args[++i];
        break;
      case '--audit-dir':
        options.auditDir = args[++i];
        break;
    }
  }

  try {
    const auditor = new AuditLogApproval(options);

    switch (command) {
      case 'log-event':
        auditor.logEvent(options);
        break;
      case 'log-approval':
        auditor.logApproval(options);
        break;
      case 'log-rejection':
        auditor.logRejection(options);
        break;
      case 'log-override':
        auditor.logOverride(options);
        break;
      case 'log-comment':
        auditor.logComment(options);
        break;
      case 'report':
        console.log(auditor.generateAuditReport(options.version));
        break;
      case 'export':
        const format = options.format || 'json';
        console.log(auditor.exportAuditTrail(options.version, format));
        break;
      case 'verify':
        const results = auditor.verifyAuditTrail(options.version);
        console.log(JSON.stringify(results, null, 2));
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AuditLogApproval;
