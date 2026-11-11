'use strict';

// In-process tests for sub-skills/release-approval-workflow/scripts/generate-approval-report.js.
// Loads the real ApprovalReportGenerator class so coverage counts it. Covers constructor defaults,
// data loading, markdown/json/html rendering, every helper, output path safety and generate().
// process.cwd() is stubbed to a temp dir; all files live in os.tmpdir() and are removed afterwards.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'sub-skills/release-approval-workflow/scripts/generate-approval-report.js');
const ApprovalReportGenerator = require(SCRIPT);

const tmpDirs = [];

function tempDir() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ls-wp-release-apr-inproc-')));
  tmpDirs.push(dir);
  return dir;
}

function fullApproval() {
  return {
    release_version: '2.1.0',
    approval_id: 'APR-2026-001',
    status: 'approved',
    requested_at: '2026-11-01T00:00:00Z',
    requested_by: 'dev@example.com',
    completed_at: '2026-11-01T03:25:00Z',
    stages: {
      qa: {
        status: 'approved',
        approved_by: 'qa@example.com',
        approved_at: '2026-11-01T01:00:00Z',
        comments: 'Looks good',
        evidence: ['report <1>', 'log & "trace"'],
        checks: { unit: true, e2e: false, perf: 'skipped' },
      },
      security: { status: 'approved', approved_by: 'sec@example.com', approved_at: '2026-11-01T02:00:00Z' },
    },
    risk_assessment: { score: 42, level: 'medium', factors: ['big diff'], mitigations: ['staged rollout'] },
    emergency_override: {
      type: 'hotfix',
      authorized_by: 'cto@example.com',
      authorized_at: '2026-11-01T02:30:00Z',
      justification: 'prod down',
      bypassed_stages: ['security'],
      planned_audit: '2026-11-08',
    },
  };
}

let logSpy;
let errSpy;
let cwdSpy;
let cwd;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  cwd = tempDir();
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  tmpDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function writeData(dir, name, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data));
}

describe('constructor and loadApprovalData', () => {
  test('defaults and explicit options', () => {
    const d = new ApprovalReportGenerator();
    assert.strictEqual(d.version, null);
    assert.strictEqual(d.approvalId, null);
    assert.strictEqual(d.format, 'markdown');
    assert.strictEqual(d.outputFile, null);
    assert.strictEqual(d.dataDir, './.approval-data');
    const g = new ApprovalReportGenerator({
      version: '1', approvalId: 'A', format: 'json', outputFile: 'o', dataDir: 'd'
    });
    assert.deepStrictEqual(
      [g.version, g.approvalId, g.format, g.outputFile, g.dataDir],
      ['1', 'A', 'json', 'o', 'd']
    );
  });

  test('loads by version and by approval id (id wins)', () => {
    const dir = path.join(cwd, 'data');
    writeData(dir, 'approval-v2.1.0.json', { release_version: 'by-version' });
    writeData(dir, 'approval-APR-9.json', { release_version: 'by-id' });
    const loader = new ApprovalReportGenerator({ version: '2.1.0', dataDir: dir });
    assert.strictEqual(loader.loadApprovalData().release_version,
      'by-version');
    assert.strictEqual(
      new ApprovalReportGenerator({ version: '2.1.0', approvalId: 'APR-9', dataDir: dir }).loadApprovalData()
        .release_version,
      'by-id'
    );
  });

  test('throws when no selector, missing file, or invalid JSON', () => {
    const dir = path.join(cwd, 'data');
    assert.throws(() => new ApprovalReportGenerator({ dataDir: dir }).loadApprovalData(), /--version or --approval-id/);
    assert.throws(
      () => new ApprovalReportGenerator({ version: '9', dataDir: dir }).loadApprovalData(),
      /Approval data file not found/
    );
    writeData(dir, 'approval-v3.json', '{not json');
    assert.throws(() => new ApprovalReportGenerator({ version: '3', dataDir: dir }).loadApprovalData(), SyntaxError);
  });
});

describe('helpers', () => {
  const g = new ApprovalReportGenerator();

  test('getStatusBadge maps known statuses and passes unknown through', () => {
    assert.match(g.getStatusBadge('approved'), /Approved/);
    assert.match(g.getStatusBadge('rejected'), /Rejected/);
    assert.match(g.getStatusBadge('pending'), /Pending/);
    assert.match(g.getStatusBadge('blocked'), /Blocked/);
    assert.match(g.getStatusBadge('override'), /Override Used/);
    assert.strictEqual(g.getStatusBadge('weird'), 'weird');
  });

  test('calculateDuration formats hours and minutes', () => {
    assert.strictEqual(g.calculateDuration('2026-11-01T00:00:00Z', '2026-11-01T03:25:00Z'), '3h 25m');
    assert.strictEqual(g.calculateDuration('2026-11-01T00:00:00Z', '2026-11-01T00:45:30Z'), '45m');
  });

  test('escapeHtml escapes all special characters and coerces to string', () => {
    assert.strictEqual(g.escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    assert.strictEqual(g.escapeHtml(12), '12');
  });

  test('hasComments and hasEvidence detect presence and absence', () => {
    const empty = { stages: { a: { status: 'pending' }, b: { status: 'pending', evidence: [] } } };
    assert.strictEqual(g.hasComments(empty), false);
    assert.strictEqual(g.hasEvidence(empty), false);
    assert.strictEqual(g.hasComments(fullApproval()), true);
    assert.strictEqual(g.hasEvidence(fullApproval()), true);
  });

  test('generateExecutiveSummary covers approved, pending, rejected and other statuses', () => {
    const a = fullApproval();
    const approved = g.generateExecutiveSummary(a);
    assert.match(approved, /v2\.1\.0\) has completed 2 of 2 approval stages/);
    assert.match(approved, /All approval gates have passed/);
    assert.match(approved, /\*\*Risk Level:\*\* MEDIUM/);

    const pending = g.generateExecutiveSummary({
      release_version: '1',
      status: 'pending',
      stages: { qa: { status: 'approved' }, sec: { status: 'pending' }, ops: { status: 'pending' } },
    });
    assert.match(pending, /1 of 3/);
    assert.match(pending, /Awaiting approval for:\*\* sec, ops/);
    assert.ok(!pending.includes('Risk Level'));

    const rejected = g.generateExecutiveSummary({
      release_version: '1',
      status: 'rejected',
      stages: { qa: { status: 'rejected' }, sec: { status: 'approved' } },
    });
    assert.match(rejected, /Rejected by:\*\* qa/);
    assert.match(rejected, /Changes required before resubmission/);

    const other = g.generateExecutiveSummary({ release_version: '1', status: 'blocked', stages: {} });
    assert.strictEqual(other, 'This release (v1) has completed 0 of 0 approval stages.\n\n');
  });

  test('generateStagesTable renders approvers and timestamps or dashes', () => {
    const table = g.generateStagesTable({
      stages: {
        qa: { status: 'approved', approved_by: 'qa@example.com', approved_at: '2026-11-01T01:00:00Z' },
        ops: { status: 'pending' },
      },
    });
    const rows = table.split('\n');
    assert.strictEqual(rows[0], '| Stage | Status | Approver | Timestamp |');
    assert.match(rows[2], /^\| qa \| .*Approved \| qa@example\.com \| .+ \|$/);
    assert.match(rows[3], /^\| ops \| .*Pending \| — \| — \|$/);
  });

  test('generateStageSection renders optional parts and check icons', () => {
    const full = g.generateStageSection('qa', fullApproval().stages.qa);
    assert.match(full, /^### qa/);
    assert.match(full, /\*\*Approved By:\*\* qa@example\.com/);
    assert.match(full, /\*\*Approved At:\*\* 2026-11-01T01:00:00\.000Z/);
    assert.match(full, /> Looks good/);
    assert.match(full, /- report <1>/);
    assert.match(full, /✅ unit/);
    assert.match(full, /❌ e2e/);
    assert.match(full, /⚠️ perf/);

    const bare = g.generateStageSection('ops', { status: 'pending', evidence: [] });
    assert.strictEqual(bare, '### ops\n\n**Status:** ⏳ Pending');
  });

  test('generateRiskSection renders factors and mitigations only when present', () => {
    const full = g.generateRiskSection(fullApproval().risk_assessment);
    assert.match(full, /\*\*Risk Score:\*\* 42\/100/);
    assert.match(full, /\*\*Risk Level:\*\* MEDIUM/);
    assert.match(full, /Risk Factors:\*\*\n- big diff/);
    assert.match(full, /Mitigations:\*\*\n- staged rollout/);
    const bare = g.generateRiskSection({ score: 1, level: 'low', factors: [], mitigations: [] });
    assert.ok(!bare.includes('Risk Factors') && !bare.includes('Mitigations'));
    const none = g.generateRiskSection({ score: 1, level: 'low' });
    assert.ok(!none.includes('Mitigations'));
  });

  test('generateEvidenceSection escapes evidence and skips stages without arrays', () => {
    const out = g.generateEvidenceSection({
      stages: { a: { evidence: ['<b>x</b>'] }, b: {}, c: { evidence: 'not-an-array' } },
    });
    assert.strictEqual(out, '<div class="evidence-item">&lt;b&gt;x&lt;/b&gt;</div>');
  });

  test('generateOverrideSection renders with and without optional fields', () => {
    const full = g.generateOverrideSection(fullApproval().emergency_override);
    assert.match(full, /\*\*Override Type:\*\* hotfix/);
    assert.match(full, /Authorized By:\*\* cto@example\.com/);
    assert.match(full, /> prod down/);
    assert.match(full, /Bypassed Stages:\*\*\n- security/);
    assert.match(full, /Planned Post-Release Audit:\*\* 2026-11-08/);
    const bare = g.generateOverrideSection({
      type: 't', authorized_by: 'x', authorized_at: '2026-11-01T00:00:00Z', justification: 'j', bypassed_stages: [],
    });
    assert.ok(!bare.includes('Bypassed') && !bare.includes('Planned'));
  });

  test('generateApprovalChain uses status icons and arrows between stages only', () => {
    const chain = g.generateApprovalChain({
      stages: {
        a: { status: 'approved', approved_by: 'x@example.com', approved_at: '2026-11-01T00:00:00Z' },
        b: { status: 'pending' },
        c: { status: 'rejected' },
      },
    });
    const lines = chain.split('\n');
    assert.strictEqual(lines[0], '✅ **a**');
    assert.strictEqual(lines[1], '   → Approved by x@example.com');
    assert.match(lines[2], /^ {3}→ At /);
    assert.strictEqual(lines[3], '   ↓');
    assert.strictEqual(lines[4], '⏳ **b**');
    assert.strictEqual(lines[6], '❌ **c**');
    assert.strictEqual(lines.filter((l) => l === '   ↓').length, 2);
  });

  test('generateCommentsSection lists commenting stages, pending when no approver', () => {
    const out = g.generateCommentsSection({
      stages: {
        a: { comments: 'ok', approved_by: 'x@example.com' },
        b: { comments: 'wait' },
        c: {},
      },
    });
    assert.match(out, /\*\*a\*\* \(x@example\.com\):\n> ok/);
    assert.match(out, /\*\*b\*\* \(pending\):\n> wait/);
    assert.ok(!out.includes('**c**'));
  });

  test('generateComplianceStatement mentions override only when used', () => {
    assert.ok(!g.generateComplianceStatement({}).includes('Emergency override'));
    assert.match(g.generateComplianceStatement({ emergency_override: {} }), /Emergency override used/);
  });
});

describe('report generation', () => {
  const g = new ApprovalReportGenerator();

  test('markdown report includes every section for a full approval', () => {
    const md = g.generateMarkdownReport(fullApproval());
    [
      '# Release Approval Report', '**Release Version:** 2.1.0', '**Approval ID:** APR-2026-001',
      '**Requested By:** dev@example.com', '**Completed At:** 2026-11-01T03:25:00.000Z', '**Total Duration:** 3h 25m',
      '## Executive Summary', '## Approval Stages', '## Detailed Review Information', '## Risk Assessment',
      '## Evidence & Artifacts', '## Emergency Override Information', '## Approval Chain Summary',
      '## Comments & Feedback', '## Compliance & Audit Trail', '**Report Version:** 1.0',
    ].forEach((s) => assert.ok(md.includes(s), `missing: ${s}`));
    assert.match(md, /\*\*Generated:\*\* \d{4}-\d{2}-\d{2}T/);
  });

  test('markdown report omits optional sections for a minimal approval', () => {
    const md = g.generateMarkdownReport({
      release_version: '1.0.0',
      approval_id: 'A',
      status: 'pending',
      requested_at: '2026-11-01T00:00:00Z',
      requested_by: 'x',
      stages: { qa: { status: 'pending' } },
    });
    ['Completed At', 'Total Duration', '## Risk Assessment', '## Evidence', '## Emergency Override', '## Comments']
      .forEach((s) => assert.ok(!md.includes(s), `unexpected: ${s}`));
    assert.ok(md.includes('## Approval Chain Summary'));
  });

  test('json report round-trips the approval', () => {
    const a = fullApproval();
    assert.deepStrictEqual(JSON.parse(g.generateJsonReport(a)), a);
    assert.ok(g.generateJsonReport(a).includes('\n  "approval_id"'));
  });

  test('html report converts markdown and escapes the title', () => {
    const a = fullApproval();
    a.release_version = '<2>';
    const html = g.generateHtmlReport(a);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<title>Release Approval Report - &lt;2&gt;</title>'));
    assert.ok(html.includes('<h1>Release Approval Report</h1>'));
    assert.ok(html.includes('<h2>Executive Summary</h2>'));
    assert.ok(html.includes('<strong>Approval ID:</strong>'));
    assert.ok(html.includes('<li>big diff</li>'));
    assert.ok(html.trim().endsWith('</html>'));
  });
});

describe('resolveOutputPath', () => {
  const g = new ApprovalReportGenerator();

  test('accepts files in the cwd and in subdirectories', () => {
    fs.mkdirSync(path.join(cwd, 'sub'));
    assert.strictEqual(g.resolveOutputPath('r.md'), path.join(cwd, 'r.md'));
    assert.strictEqual(g.resolveOutputPath('sub/r.md'), path.join(cwd, 'sub', 'r.md'));
  });

  test('rejects outside paths, the cwd itself, missing parents and directories', () => {
    const other = tempDir();
    assert.throws(() => g.resolveOutputPath(path.join(other, 'r.md')), /inside the current working directory/);
    assert.throws(() => g.resolveOutputPath('../r.md'), /inside the current working directory/);
    assert.throws(() => g.resolveOutputPath('.'), /inside the current working directory/);
    assert.throws(() => g.resolveOutputPath('missing/r.md'), /Output directory does not exist/);
    fs.mkdirSync(path.join(cwd, 'out'));
    assert.throws(() => g.resolveOutputPath('out'), /is a directory/);
  });

  test('rejects a symlinked parent that escapes the cwd', () => {
    const other = tempDir();
    fs.symlinkSync(other, path.join(cwd, 'link'));
    assert.throws(() => g.resolveOutputPath('link/r.md'), /inside the current working directory/);
  });
});

describe('generate', () => {
  function setup() {
    const dir = path.join(cwd, '.approval-data');
    writeData(dir, 'approval-v2.1.0.json', fullApproval());
    return dir;
  }

  test('writes markdown by default and logs a summary', () => {
    const dir = setup();
    const report = new ApprovalReportGenerator({ version: '2.1.0', dataDir: dir, outputFile: 'out.md' }).generate();
    assert.strictEqual(fs.readFileSync(path.join(cwd, 'out.md'), 'utf8'), report);
    assert.ok(report.startsWith('# Release Approval Report'));
    const logged = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    assert.match(logged, /Report generated: out\.md/);
    assert.match(logged, /Format: markdown/);
    assert.match(logged, /Size: \d+\.\d{2} KB/);
  });

  test('writes json and html formats', () => {
    const dir = setup();
    new ApprovalReportGenerator({ version: '2.1.0', dataDir: dir, format: 'json', outputFile: 'o.json' }).generate();
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(cwd, 'o.json'), 'utf8')).approval_id, 'APR-2026-001');
    new ApprovalReportGenerator({ version: '2.1.0', dataDir: dir, format: 'html', outputFile: 'o.html' }).generate();
    assert.ok(fs.readFileSync(path.join(cwd, 'o.html'), 'utf8').startsWith('<!DOCTYPE html>'));
  });

  test('unknown format falls back to markdown', () => {
    const dir = setup();
    const report = new ApprovalReportGenerator({ version: '2.1.0', dataDir: dir, format: 'xml' }).generate();
    assert.ok(report.startsWith('# Release Approval Report'));
  });

  test('prints to stdout without --output and writes nothing', () => {
    const dir = setup();
    const before = fs.readdirSync(cwd);
    const report = new ApprovalReportGenerator({ version: '2.1.0', dataDir: dir, format: 'json' }).generate();
    assert.deepStrictEqual(logSpy.mock.calls, [[report]]);
    assert.deepStrictEqual(fs.readdirSync(cwd), before);
  });

  test('validates the output path before loading data', () => {
    const other = tempDir();
    const g = new ApprovalReportGenerator({ version: 'none', dataDir: cwd, outputFile: path.join(other, 'x.md') });
    assert.throws(() => g.generate(), /inside the current working directory/);
    assert.deepStrictEqual(fs.readdirSync(other), []);
  });

  test('propagates load errors and leaves no output file', () => {
    const g = new ApprovalReportGenerator({ version: 'none', dataDir: cwd, outputFile: 'x.md' });
    assert.throws(() => g.generate(), /Approval data file not found/);
    assert.ok(!fs.existsSync(path.join(cwd, 'x.md')));
    assert.ok(cwdSpy.mock.calls.length > 0);
    assert.strictEqual(errSpy.mock.calls.length, 0);
  });
});
