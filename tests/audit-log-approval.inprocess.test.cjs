'use strict';

// In-process tests for sub-skills/release-approval-workflow/scripts/audit-log-approval.js.
// Loads the real AuditLogApproval class so V8 coverage counts it. Covers: constructor defaults, the five log*
// helpers, JSONL and index writing, checksums and HMAC signing (including the missing-key error), entry and
// trail verification (tamper and out-of-order detection), trail reading, markdown report, entry formatting,
// JSON/markdown/CSV export and CSV formula-injection escaping. Every audit directory is a temp dir.
// main() is not exported and only runs when the file is the entry point, so the CLI tests load it with
// Module._load(file, null, true) (the same call Node uses for the entry script) with argv and process.exit stubbed.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const Module = require('node:module');
const path = require('node:path');

const AuditLogApproval = require(path.join(__dirname, '..', 'sub-skills', 'release-approval-workflow', 'scripts',
  'audit-log-approval.js'));

const SCRIPT = path.join(__dirname, '..', 'sub-skills', 'release-approval-workflow', 'scripts',
  'audit-log-approval.js');
const tempDirs = [];
const ORIGINAL_KEY = process.env.AUDIT_SIGN_KEY;

function tempAuditDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-wp-release-auditlog-'));
  tempDirs.push(root);
  return path.join(root, 'audit');
}

function make(overrides = {}) {
  return new AuditLogApproval({
    auditDir: tempAuditDir(),
    version: '2.1.0',
    approvalId: 'APR-1',
    timestamp: '2026-11-01T10:00:00.000Z',
    ...overrides
  });
}

beforeEach(() => {
  process.env.AUDIT_SIGN_KEY = 'unit-test-key';
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_KEY === undefined) {
    delete process.env.AUDIT_SIGN_KEY;
  } else {
    process.env.AUDIT_SIGN_KEY = ORIGINAL_KEY;
  }
});

afterAll(() => tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe('constructor', () => {
  test('applies defaults and does not touch the filesystem', () => {
    const mkdir = vi.spyOn(fs, 'mkdirSync');
    const auditor = new AuditLogApproval();
    assert.strictEqual(auditor.auditDir, './.approval-audit');
    assert.strictEqual(auditor.version, null);
    assert.strictEqual(auditor.approvalId, null);
    assert.match(auditor.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.strictEqual(mkdir.mock.calls.length, 0);
  });

  test('honours explicit options', () => {
    const auditor = make({ auditDir: '/x/y', version: '9.9.9', approvalId: 'A', timestamp: 'T' });
    assert.strictEqual(auditor.auditDir, '/x/y');
    assert.strictEqual(auditor.version, '9.9.9');
    assert.strictEqual(auditor.approvalId, 'A');
    assert.strictEqual(auditor.timestamp, 'T');
  });
});

describe('logEvent', () => {
  test('builds a full entry, writes it as JSONL and updates the index', () => {
    const auditor = make();
    const entry = auditor.logEvent({
      type: 'approval', stage: 'qa', user: 'a@x.com', role: 'qa_lead', status: 'approved'
    });

    assert.match(entry.id, /^EVT-\d+-[a-z0-9]+$/);
    assert.strictEqual(entry.version, '2.1.0');
    assert.strictEqual(entry.approval_id, 'APR-1');
    assert.deepStrictEqual(entry.details, {});
    assert.deepStrictEqual(entry.evidence, []);
    assert.strictEqual(entry.comments, null);
    assert.match(entry.checksum, /^[0-9a-f]{64}$/);
    assert.match(entry.signature, /^[0-9a-f]{64}$/);
    assert.strictEqual(entry.previous_checksum, null);

    const file = path.join(auditor.auditDir, 'audit-2.1.0-APR-1.jsonl');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[1], '');
    assert.deepStrictEqual(JSON.parse(lines[0]), entry);

    const index = JSON.parse(fs.readFileSync(path.join(auditor.auditDir, '_index.json'), 'utf8'));
    assert.deepStrictEqual(index['2.1.0'], [
      { id: entry.id, timestamp: entry.timestamp, type: 'approval', stage: 'qa', user: 'a@x.com', status: 'approved' }
    ]);
    // The message uses event.version only, so it says "unknown" even though the entry took the instance version.
    assert.ok(console.log.mock.calls[0][0].includes('Event logged: approval for unknown'));
  });

  test('event fields override the instance version and approval id', () => {
    const auditor = make();
    const entry = auditor.logEvent({ type: 'comment', version: '3.0.0', approval_id: 'APR-9' });
    assert.strictEqual(entry.version, '3.0.0');
    assert.strictEqual(entry.approval_id, 'APR-9');
    assert.ok(fs.existsSync(path.join(auditor.auditDir, 'audit-3.0.0-APR-9.jsonl')));
  });

  test('without any version or approval id the file name uses unknown placeholders', () => {
    const auditor = make({ version: null, approvalId: null });
    const entry = auditor.logEvent({ type: 'comment' });
    assert.strictEqual(entry.version, null);
    assert.ok(fs.existsSync(path.join(auditor.auditDir, 'audit-null-unknown.jsonl')));
    assert.ok(console.log.mock.calls[0][0].includes('for unknown'));
  });

  test('appends successive events to the same file and index key', () => {
    const auditor = make();
    auditor.logEvent({ type: 'approval', stage: 'qa' });
    auditor.logEvent({ type: 'rejection', stage: 'security' });
    const lines = fs.readFileSync(path.join(auditor.auditDir, 'audit-2.1.0-APR-1.jsonl'), 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 2);
    const index = JSON.parse(fs.readFileSync(path.join(auditor.auditDir, '_index.json'), 'utf8'));
    assert.deepStrictEqual(index['2.1.0'].map((e) => e.type), ['approval', 'rejection']);
  });

  test('separate versions get separate index keys', () => {
    const auditor = make();
    auditor.logEvent({ type: 'approval', version: '1.0.0' });
    auditor.logEvent({ type: 'approval', version: '2.0.0' });
    const index = JSON.parse(fs.readFileSync(path.join(auditor.auditDir, '_index.json'), 'utf8'));
    assert.deepStrictEqual(Object.keys(index).sort(), ['1.0.0', '2.0.0']);
  });

  test('refuses to log without AUDIT_SIGN_KEY and writes nothing', () => {
    delete process.env.AUDIT_SIGN_KEY;
    const auditor = make();
    assert.throws(() => auditor.logEvent({ type: 'approval' }), /AUDIT_SIGN_KEY environment variable is required/);
    assert.ok(!fs.existsSync(auditor.auditDir));
  });
});

describe('log helpers', () => {
  test('logApproval records manual approvals with defaults', () => {
    const entry = make().logApproval({ stage: 'qa', user: 'u', role: 'r', reason: 'ok' });
    assert.strictEqual(entry.type, 'approval');
    assert.strictEqual(entry.status, 'approved');
    assert.deepStrictEqual(entry.details, {
      approval_reason: 'ok',
      approval_conditions: [],
      auto_approved: false,
      manual_review: true
    });
    assert.strictEqual(entry.comments, null);
  });

  test('logApproval records auto approvals, conditions, comments and evidence', () => {
    const entry = make().logApproval({
      stage: 'qa',
      auto_approved: true,
      conditions: ['c1'],
      comments: 'fine',
      evidence: ['e1'],
      version: '5.0.0',
      approval_id: 'APR-5'
    });
    assert.strictEqual(entry.details.auto_approved, true);
    assert.strictEqual(entry.details.manual_review, false);
    assert.strictEqual(entry.details.approval_reason, null);
    assert.deepStrictEqual(entry.details.approval_conditions, ['c1']);
    assert.strictEqual(entry.comments, 'fine');
    assert.deepStrictEqual(entry.evidence, ['e1']);
    assert.strictEqual(entry.version, '5.0.0');
    assert.strictEqual(entry.approval_id, 'APR-5');
  });

  test('logRejection records findings and remediation', () => {
    const entry = make().logRejection({
      stage: 'security',
      reason: 'vuln',
      findings: ['XSS'],
      remediation_steps: ['escape'],
      comments: 'no',
      evidence: ['scan.txt']
    });
    assert.strictEqual(entry.type, 'rejection');
    assert.strictEqual(entry.status, 'rejected');
    assert.deepStrictEqual(entry.details, {
      rejection_reason: 'vuln',
      findings: ['XSS'],
      remediation_steps: ['escape']
    });
    assert.strictEqual(entry.comments, 'no');
    assert.deepStrictEqual(entry.evidence, ['scan.txt']);
  });

  test('logRejection fills defaults', () => {
    const entry = make().logRejection({});
    assert.deepStrictEqual(entry.details, { rejection_reason: null, findings: [], remediation_steps: [] });
  });

  test('logOverride defaults to an emergency override with no stage', () => {
    const entry = make().logOverride({ user: 'cto', role: 'exec' });
    assert.strictEqual(entry.type, 'override');
    assert.strictEqual(entry.status, 'override');
    assert.strictEqual(entry.stage, null);
    assert.deepStrictEqual(entry.details, {
      override_type: 'emergency',
      business_justification: null,
      bypassed_stages: [],
      authorization_level: null,
      planned_audit_date: null
    });
  });

  test('logOverride keeps supplied override details', () => {
    const entry = make().logOverride({
      override_type: 'scheduled',
      justification: 'hotfix',
      bypassed_stages: ['qa'],
      authorization_level: 'L3',
      planned_audit_date: '2026-12-01',
      comments: 'c',
      evidence: ['e']
    });
    assert.strictEqual(entry.details.override_type, 'scheduled');
    assert.strictEqual(entry.details.business_justification, 'hotfix');
    assert.deepStrictEqual(entry.details.bypassed_stages, ['qa']);
    assert.strictEqual(entry.details.authorization_level, 'L3');
    assert.strictEqual(entry.details.planned_audit_date, '2026-12-01');
    assert.strictEqual(entry.comments, 'c');
  });

  test('logComment prefers options.comment, then options.comments, then null', () => {
    const auditor = make();
    const first = auditor.logComment({
      comment: 'one', comments: 'two', comment_type: 'concern', requires_response: true
    });
    assert.strictEqual(first.comments, 'one');
    assert.deepStrictEqual(first.details, { comment_type: 'concern', requires_response: true });
    assert.strictEqual(auditor.logComment({ comments: 'two' }).comments, 'two');
    const bare = auditor.logComment({});
    assert.strictEqual(bare.comments, null);
    assert.deepStrictEqual(bare.details, { comment_type: 'feedback', requires_response: false });
    assert.strictEqual(bare.status, 'comment');
  });
});

describe('checksum and signing', () => {
  const base = {
    timestamp: 't',
    type: 'approval',
    stage: 's',
    version: 'v',
    user: 'u',
    status: 'approved',
    details: { a: 1 },
    comments: 'c',
    evidence: ['e']
  };

  test('calculateChecksum is deterministic and sensitive to covered fields', () => {
    const auditor = make();
    const sum = auditor.calculateChecksum(base);
    assert.strictEqual(auditor.calculateChecksum({ ...base }), sum);
    assert.notStrictEqual(auditor.calculateChecksum({ ...base, status: 'rejected' }), sum);
    assert.notStrictEqual(auditor.calculateChecksum({ ...base, comments: 'x' }), sum);
    assert.notStrictEqual(auditor.calculateChecksum({ ...base, evidence: [] }), sum);
  });

  test('signEntry depends on the secret and on previous_checksum', () => {
    const auditor = make();
    const entry = { id: 'EVT-1', timestamp: 't', checksum: 'abc', previous_checksum: null };
    const sig = auditor.signEntry(entry);
    assert.match(sig, /^[0-9a-f]{64}$/);
    assert.strictEqual(auditor.signEntry({ ...entry, previous_checksum: undefined }), sig);
    assert.notStrictEqual(auditor.signEntry({ ...entry, previous_checksum: 'prev' }), sig);
    process.env.AUDIT_SIGN_KEY = 'other-key';
    assert.notStrictEqual(auditor.signEntry(entry), sig);
  });

  test('signEntry throws when the key is missing or empty', () => {
    const auditor = make();
    delete process.env.AUDIT_SIGN_KEY;
    assert.throws(() => auditor.signEntry({}), /AUDIT_SIGN_KEY/);
    process.env.AUDIT_SIGN_KEY = '';
    assert.throws(() => auditor.signEntry({}), /AUDIT_SIGN_KEY/);
  });

  test('generateId returns unique EVT identifiers', () => {
    const auditor = make();
    const ids = new Set(Array.from({ length: 20 }, () => auditor.generateId()));
    assert.strictEqual(ids.size, 20);
    ids.forEach((id) => assert.match(id, /^EVT-\d+-[a-z0-9]+$/));
  });
});

describe('verifyEntry', () => {
  test('accepts an untouched entry', () => {
    const auditor = make();
    const entry = auditor.logApproval({ stage: 'qa', user: 'u' });
    const result = auditor.verifyEntry(entry);
    assert.deepStrictEqual(result, {
      valid: true,
      checksum_valid: true,
      signature_valid: true,
      timestamp: entry.timestamp,
      checksum: entry.checksum
    });
  });

  test('flags a tampered status as a checksum mismatch', () => {
    const auditor = make();
    const entry = { ...auditor.logApproval({ stage: 'qa' }), status: 'rejected' };
    const result = auditor.verifyEntry(entry);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.checksum_valid, false);
  });

  test('flags a forged signature and a signature made with another key', () => {
    const auditor = make();
    const entry = auditor.logApproval({ stage: 'qa' });
    const forged = auditor.verifyEntry({ ...entry, signature: '0'.repeat(64) });
    assert.strictEqual(forged.valid, false);
    assert.strictEqual(forged.checksum_valid, true);
    assert.strictEqual(forged.signature_valid, false);

    process.env.AUDIT_SIGN_KEY = 'rotated-key';
    assert.strictEqual(auditor.verifyEntry(entry).signature_valid, false);
  });
});

describe('readAuditTrail', () => {
  test('returns an empty list for a missing directory without creating it', () => {
    const auditor = make();
    assert.deepStrictEqual(auditor.readAuditTrail('2.1.0'), []);
    assert.ok(!fs.existsSync(auditor.auditDir));
  });

  test('returns an empty list when the directory has no matching files', () => {
    const auditor = make();
    auditor.logEvent({ type: 'approval', version: '1.0.0' });
    assert.deepStrictEqual(auditor.readAuditTrail('9.9.9'), []);
  });

  test('merges files for the version, sorts by timestamp and skips other versions and blank lines', () => {
    const auditor = make();
    const dir = auditor.auditDir;
    make({ auditDir: dir, timestamp: '2026-11-03T00:00:00.000Z' }).logEvent({ type: 'comment', approval_id: 'A' });
    make({ auditDir: dir, timestamp: '2026-11-01T00:00:00.000Z' }).logEvent({ type: 'approval', approval_id: 'B' });
    make({ auditDir: dir, timestamp: '2026-11-02T00:00:00.000Z' }).logEvent({ type: 'rejection', approval_id: 'B' });
    make({ auditDir: dir, version: '3.0.0' }).logEvent({ type: 'override' });
    fs.appendFileSync(path.join(dir, 'audit-2.1.0-B.jsonl'), '\n\n');

    const entries = auditor.readAuditTrail('2.1.0');
    assert.deepStrictEqual(entries.map((e) => e.type), ['approval', 'rejection', 'comment']);
    assert.ok(entries.every((e) => e.version === '2.1.0'));
  });

  test('throws on a corrupt JSONL line', () => {
    const auditor = make();
    auditor.logEvent({ type: 'approval' });
    fs.appendFileSync(path.join(auditor.auditDir, 'audit-2.1.0-APR-1.jsonl'), '{not json\n');
    assert.throws(() => auditor.readAuditTrail('2.1.0'), SyntaxError);
  });
});

describe('updateAuditIndex', () => {
  test('creates the index from scratch and adds to an existing one', () => {
    const auditor = make();
    fs.mkdirSync(auditor.auditDir, { recursive: true });
    const entry = {
      id: 'E1', timestamp: 't', type: 'approval', stage: 's', user: 'u', status: 'approved', version: 'v1'
    };
    auditor.updateAuditIndex(entry);
    auditor.updateAuditIndex({ ...entry, id: 'E2' });
    const index = JSON.parse(fs.readFileSync(path.join(auditor.auditDir, '_index.json'), 'utf8'));
    assert.deepStrictEqual(index.v1.map((e) => e.id), ['E1', 'E2']);
  });
});

describe('generateAuditReport', () => {
  test('reports when no trail exists', () => {
    assert.strictEqual(make().generateAuditReport('7.7.7'), 'No audit trail found for version 7.7.7');
  });

  test('renders summary, details, compliance and chain of custody for a valid trail', () => {
    const dir = tempAuditDir();
    make({ auditDir: dir, timestamp: '2026-11-01T00:00:00.000Z' })
      .logApproval({ stage: 'qa', user: 'a@x.com', role: 'qa_lead', comments: 'looks good', evidence: ['r.html'] });
    make({ auditDir: dir, timestamp: '2026-11-02T00:00:00.000Z' }).logRejection({ stage: 'security' });
    const report = make({ auditDir: dir }).generateAuditReport('2.1.0');

    assert.ok(report.startsWith('# Audit Trail Report - v2.1.0'));
    assert.ok(report.includes('**Total Events:** 2'));
    assert.ok(report.includes('**Date Range:** 2026-11-01T00:00:00.000Z to 2026-11-02T00:00:00.000Z'));
    assert.ok(report.includes('- approval: 1'));
    assert.ok(report.includes('- rejection: 1'));
    assert.ok(report.includes('## Detailed Events'));
    assert.ok(report.includes('✅ Integrity verified: 2/2 entries'));
    assert.ok(report.includes('Overall Status: ✅ Valid'));
    assert.ok(report.includes('✅ 1. APPROVAL - 2026-11-01T00:00:00.000Z'));
    assert.ok(report.includes('   User: a@x.com | Role: qa_lead'));
    assert.ok(report.includes('   Status: approved | Stage: qa'));
    assert.ok(report.includes('   Comments: looks good'));
    assert.ok(report.includes('   User: system | Role: N/A'));
    assert.ok(report.includes('✅ 2. REJECTION'));
  });

  test('marks tampered entries invalid and explains why', () => {
    const auditor = make();
    auditor.logApproval({ stage: 'qa', user: 'u' });
    const file = path.join(auditor.auditDir, 'audit-2.1.0-APR-1.jsonl');
    const tampered = JSON.parse(fs.readFileSync(file, 'utf8'));
    tampered.status = 'rejected';
    tampered.signature = 'f'.repeat(64);
    fs.writeFileSync(file, JSON.stringify(tampered) + '\n');

    const report = auditor.generateAuditReport('2.1.0');
    assert.ok(report.includes(`❌ Entry ${tampered.id} integrity check failed`));
    assert.ok(report.includes('   - Checksum mismatch'));
    assert.ok(report.includes('   - Signature invalid'));
    assert.ok(report.includes('✅ Integrity verified: 0/1 entries'));
    assert.ok(report.includes('Overall Status: ❌ Invalid'));
    assert.ok(report.includes('❌ 1. APPROVAL'));
  });

  test('reports only a signature failure when the checksum still matches', () => {
    const auditor = make();
    auditor.logApproval({ stage: 'qa' });
    const file = path.join(auditor.auditDir, 'audit-2.1.0-APR-1.jsonl');
    const entry = JSON.parse(fs.readFileSync(file, 'utf8'));
    entry.signature = '0'.repeat(64);
    fs.writeFileSync(file, JSON.stringify(entry) + '\n');
    const report = auditor.generateAuditReport('2.1.0');
    assert.ok(report.includes('   - Signature invalid'));
    assert.ok(!report.includes('Checksum mismatch'));
  });
});

describe('formatAuditEntry', () => {
  test('renders arrays, objects, scalars, comments and evidence', () => {
    const text = make().formatAuditEntry({
      id: 'EVT-1',
      timestamp: 'T1',
      type: 'override',
      user: 'cto',
      role: 'exec',
      stage: 'release',
      status: 'override',
      details: { list: ['a', 'b'], obj: { k: 1 }, plain: 'x', nothing: null },
      comments: 'urgent',
      evidence: ['one', 'two']
    });
    assert.ok(text.includes('**[T1]** OVERRIDE'));
    assert.ok(text.includes('- ID: EVT-1'));
    assert.ok(text.includes('- User: cto'));
    assert.ok(text.includes('- Role: exec'));
    assert.ok(text.includes('- Stage: release'));
    assert.ok(text.includes('  - list: a, b'));
    assert.ok(text.includes('  - obj: {"k":1}'));
    assert.ok(text.includes('  - plain: x'));
    assert.ok(text.includes('- Comments: urgent'));
    assert.ok(text.includes('- Evidence:\n  - one\n  - two'));
  });

  test('uses placeholders and omits empty sections', () => {
    const text = make().formatAuditEntry({
      id: 'EVT-2',
      timestamp: 'T2',
      type: 'comment',
      user: null,
      role: null,
      stage: null,
      status: 'comment',
      details: {},
      comments: null,
      evidence: []
    });
    assert.ok(text.includes('- User: system'));
    assert.ok(text.includes('- Role: N/A'));
    assert.ok(text.includes('- Stage: N/A'));
    assert.ok(!text.includes('Details'));
    assert.ok(!text.includes('Comments'));
    assert.ok(!text.includes('Evidence'));
  });

  test('tolerates a missing evidence field', () => {
    const text = make().formatAuditEntry({
      id: 'E', timestamp: 'T', type: 'approval', status: 's', details: {}
    });
    assert.ok(!text.includes('Evidence'));
  });
});

describe('exportAuditTrail and convertToCSV', () => {
  function seeded() {
    const auditor = make();
    auditor.logApproval({ stage: 'qa', user: 'a@x.com', role: 'qa', comments: 'say "hi", ok' });
    return auditor;
  }

  test('json (default) returns pretty-printed entries', () => {
    const auditor = seeded();
    const parsed = JSON.parse(auditor.exportAuditTrail('2.1.0'));
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].type, 'approval');
    assert.strictEqual(auditor.exportAuditTrail('2.1.0', 'json'), JSON.stringify(parsed, null, 2));
  });

  test('json of a missing trail is an empty array', () => {
    assert.strictEqual(make().exportAuditTrail('0.0.0'), '[]');
  });

  test('markdown delegates to the report', () => {
    const auditor = seeded();
    assert.strictEqual(auditor.exportAuditTrail('2.1.0', 'markdown'), auditor.generateAuditReport('2.1.0'));
  });

  test('csv has a header row and escaped values', () => {
    const auditor = seeded();
    const [header, row, ...rest] = auditor.exportAuditTrail('2.1.0', 'csv').split('\n');
    assert.strictEqual(header, '"ID","Timestamp","Type","Stage","User","Role","Status","Comments"');
    assert.strictEqual(rest.length, 0);
    assert.ok(row.includes('"approval","qa","a@x.com","qa","approved","say ""hi"", ok"'));
  });

  test('unknown formats return the raw entry array', () => {
    const result = seeded().exportAuditTrail('2.1.0', 'yaml');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
  });

  test('csv neutralises spreadsheet formula prefixes', () => {
    const auditor = make();
    const entries = ['=SUM(A1)', '+1', '-1', '@cmd', '\tTAB', '\rCR'].map((value, i) => ({
      id: `E${i}`, timestamp: 't', type: 'comment', stage: null, user: value, role: null,
      status: 'comment', comments: null
    }));
    const lines = auditor.convertToCSV(entries).split('\n');
    assert.strictEqual(lines.length, 7);
    assert.ok(lines[1].includes(`"'=SUM(A1)"`));
    assert.ok(lines[2].includes(`"'+1"`));
    assert.ok(lines[3].includes(`"'-1"`));
    assert.ok(lines[4].includes(`"'@cmd"`));
    assert.ok(auditor.convertToCSV([entries[4]]).includes(`"'\tTAB"`));
    assert.ok(auditor.convertToCSV([entries[5]]).includes(`"'\rCR"`));
  });

  test('csv leaves safe values quoted without a prefix and empty values blank', () => {
    const csv = make().convertToCSV([{
      id: 'E', timestamp: 't', type: 'approval', stage: undefined, user: 'plain', role: null, status: 'approved'
    }]);
    assert.strictEqual(csv.split('\n')[1], '"E","t","approval","","plain","","approved",""');
  });

  test('csv of no entries is only the header', () => {
    assert.strictEqual(make().convertToCSV([]).split('\n').length, 1);
  });
});

describe('verifyAuditTrail', () => {
  test('an empty trail yields zero counts and null range', () => {
    assert.deepStrictEqual(make().verifyAuditTrail('1.2.3'), {
      total_entries: 0,
      valid_entries: 0,
      invalid_entries: 0,
      invalid_details: [],
      timestamp_sequence_valid: true,
      earliest: null,
      latest: null
    });
  });

  test('a clean multi-entry trail is fully valid', () => {
    const dir = tempAuditDir();
    make({ auditDir: dir, timestamp: '2026-11-01T00:00:00.000Z' }).logApproval({ stage: 'qa' });
    make({ auditDir: dir, timestamp: '2026-11-05T00:00:00.000Z' }).logApproval({ stage: 'sec' });
    const results = make({ auditDir: dir }).verifyAuditTrail('2.1.0');
    assert.strictEqual(results.total_entries, 2);
    assert.strictEqual(results.valid_entries, 2);
    assert.strictEqual(results.invalid_entries, 0);
    assert.strictEqual(results.timestamp_sequence_valid, true);
    assert.strictEqual(results.earliest, '2026-11-01T00:00:00.000Z');
    assert.strictEqual(results.latest, '2026-11-05T00:00:00.000Z');
  });

  test('reports invalid entries with details', () => {
    const auditor = make();
    auditor.logApproval({ stage: 'qa' });
    auditor.logApproval({ stage: 'sec' });
    const file = path.join(auditor.auditDir, 'audit-2.1.0-APR-1.jsonl');
    const [first, second] = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    first.stage = 'tampered';
    fs.writeFileSync(file, [first, second].map((e) => JSON.stringify(e)).join('\n') + '\n');

    const results = auditor.verifyAuditTrail('2.1.0');
    assert.strictEqual(results.valid_entries, 1);
    assert.strictEqual(results.invalid_entries, 1);
    assert.deepStrictEqual(results.invalid_details, [{
      id: first.id,
      timestamp: first.timestamp,
      checksum_valid: false,
      signature_valid: true
    }]);
  });

  test('the sequence check never fails for a trail sorted by readAuditTrail', () => {
    const auditor = make();
    const dir = auditor.auditDir;
    make({ auditDir: dir, timestamp: '2026-11-09T00:00:00.000Z' }).logComment({});
    make({ auditDir: dir, timestamp: '2026-11-01T00:00:00.000Z', approvalId: 'Z' }).logComment({});
    assert.strictEqual(auditor.verifyAuditTrail('2.1.0').timestamp_sequence_valid, true);
  });

  test('flags a non-monotonic sequence when the trail is returned out of order', () => {
    const auditor = make();
    const entry = (ts) => ({ ...auditor.logEvent({ type: 'comment' }), timestamp: ts });
    const outOfOrder = [entry('2026-11-05T00:00:00.000Z'), entry('2026-11-01T00:00:00.000Z')];
    vi.spyOn(auditor, 'readAuditTrail').mockReturnValue(outOfOrder);
    const results = auditor.verifyAuditTrail('2.1.0');
    assert.strictEqual(results.timestamp_sequence_valid, false);
    assert.strictEqual(results.earliest, '2026-11-05T00:00:00.000Z');
    assert.strictEqual(results.latest, '2026-11-01T00:00:00.000Z');
  });
});

describe('CLI main()', () => {
  // Runs the real script as the entry point in-process and returns what it printed and how it exited.
  function runCli(args, env = {}) {
    const savedArgv = process.argv;
    const savedEnv = { AUDIT_DIR: process.env.AUDIT_DIR };
    const out = [];
    const err = [];
    console.log.mockImplementation((...a) => out.push(a.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...a) => err.push(a.join(' ')));
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`EXIT:${code}`);
    });
    process.argv = ['node', SCRIPT, ...args];
    // A caller's AUDIT_DIR must not leak into a run that does not set it.
    delete process.env.AUDIT_DIR;
    Object.assign(process.env, env);
    let code = 0;
    try {
      delete require.cache[SCRIPT];
      Module._load(SCRIPT, null, true);
    } catch (error) {
      const match = /^EXIT:(\d+)$/.exec(error.message);
      if (!match) {
        throw error;
      }
      code = Number(match[1]);
    } finally {
      process.argv = savedArgv;
      Object.keys(savedEnv).forEach((key) => {
        if (savedEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = savedEnv[key];
        }
      });
      delete require.cache[SCRIPT];
    }
    return { code, out: out.join('\n'), err: err.join('\n') };
  }

  test('no arguments and --help print usage and exit 0', () => {
    for (const args of [[], ['--help']]) {
      const result = runCli(args);
      assert.strictEqual(result.code, 0);
      assert.match(result.out, /Usage: node audit-log-approval\.js/);
      assert.match(result.out, /--log-override/);
    }
  });

  test('an unknown command exits 1', () => {
    const result = runCli(['--version', '1.0.0', '--audit-dir', tempAuditDir()]);
    assert.strictEqual(result.code, 1);
    assert.match(result.err, /Unknown command: null/);
  });

  test('every log command writes an entry parsed from its flags', () => {
    const dir = tempAuditDir();
    const base = ['--version', '4.0.0', '--approval-id', 'APR-4', '--stage', 'qa', '--user', 'u@x.com',
      '--role', 'qa_lead', '--audit-dir', dir];
    const commands = ['--log-event', '--log-approval', '--log-rejection', '--log-override', '--log-comment'];
    for (const command of commands) {
      const args = [command, ...base, '--reason', 'because', '--comments', 'note', '--evidence', 'a.txt, b.txt'];
      assert.strictEqual(runCli(args).code, 0, command);
    }
    const entries = make({ auditDir: dir }).readAuditTrail('4.0.0');
    assert.strictEqual(entries.length, 5);
    // --log-event passes the CLI options as the event, which has no type field, so that entry has no type.
    assert.deepStrictEqual(entries.map((e) => e.type).filter(Boolean).sort(),
      ['approval', 'comment', 'override', 'rejection']);
    assert.strictEqual(entries.filter((e) => !e.type).length, 1);
    const approval = entries.find((e) => e.type === 'approval');
    assert.strictEqual(approval.user, 'u@x.com');
    assert.strictEqual(approval.role, 'qa_lead');
    assert.strictEqual(approval.approval_id, 'APR-4');
    assert.strictEqual(approval.details.approval_reason, 'because');
    assert.strictEqual(approval.comments, 'note');
    assert.deepStrictEqual(approval.evidence, ['a.txt', 'b.txt']);
  });

  test('AUDIT_DIR selects the audit directory and --audit-dir overrides it', () => {
    const fromEnv = tempAuditDir();
    const fromFlag = tempAuditDir();
    assert.strictEqual(runCli(['--log-approval', '--version', '1.0.0'], { AUDIT_DIR: fromEnv }).code, 0);
    assert.ok(fs.existsSync(path.join(fromEnv, 'audit-1.0.0-unknown.jsonl')));
    const args = ['--log-approval', '--version', '1.0.0', '--audit-dir', fromFlag];
    assert.strictEqual(runCli(args, { AUDIT_DIR: fromEnv }).code, 0);
    assert.ok(fs.existsSync(path.join(fromFlag, 'audit-1.0.0-unknown.jsonl')));
  });

  test('--report, --export (json, csv, markdown) and --verify read the logged trail', () => {
    const dir = tempAuditDir();
    runCli(['--log-approval', '--version', '6.0.0', '--approval-id', 'A', '--stage', 'qa', '--user', 'u',
      '--audit-dir', dir]);

    const report = runCli(['--report', '--version', '6.0.0', '--audit-dir', dir]);
    assert.strictEqual(report.code, 0);
    assert.match(report.out, /# Audit Trail Report - v6\.0\.0/);

    const json = runCli(['--export', '--version', '6.0.0', '--audit-dir', dir]);
    assert.strictEqual(JSON.parse(json.out).length, 1);

    const csv = runCli(['--export', '--version', '6.0.0', '--format', 'csv', '--audit-dir', dir]);
    assert.ok(csv.out.startsWith('"ID","Timestamp"'));

    const md = runCli(['--export', '--format', 'markdown', '--version', '6.0.0', '--audit-dir', dir]);
    assert.match(md.out, /Chain of Custody/);

    const verify = runCli(['--verify', '--version', '6.0.0', '--audit-dir', dir]);
    assert.strictEqual(JSON.parse(verify.out).valid_entries, 1);
  });

  test('a missing signing key is reported as an error and exits 1', () => {
    delete process.env.AUDIT_SIGN_KEY;
    const dir = tempAuditDir();
    const result = runCli(['--log-approval', '--version', '1.0.0', '--audit-dir', dir]);
    assert.strictEqual(result.code, 1);
    assert.match(result.err, /Error: AUDIT_SIGN_KEY environment variable is required/);
    assert.ok(!fs.existsSync(dir));
  });

  test('read-only commands never create the audit directory', () => {
    const dir = tempAuditDir();
    for (const command of ['--report', '--export', '--verify']) {
      assert.strictEqual(runCli([command, '--version', '1.0.0', '--audit-dir', dir]).code, 0);
    }
    assert.ok(!fs.existsSync(dir));
  });
});
