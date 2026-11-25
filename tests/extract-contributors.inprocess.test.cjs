'use strict';

// In-process tests for sub-skills/release-notes-generator/scripts/extract-contributors.js.
// child_process.execFileSync is replaced with a fake before the script is loaded (the script
// destructures it at load time), so no real git is invoked. Covers ref validation, git and PR
// contributor extraction, merging, username/email normalisation, every format style, JSON export
// and the CLI main() (argument parsing, limit, output formats, error exit codes).

const assert = require('node:assert');
const childProcess = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'sub-skills/release-notes-generator/scripts/extract-contributors.js');
const realExecFileSync = childProcess.execFileSync;

let gitHandler;
let calls;
let errorSpy;
let logSpy;

function fakeExecFileSync(cmd, args, opts) {
  calls.push({ cmd, args, opts });
  return gitHandler(cmd, args, opts);
}

function loadScript(asMain) {
  delete require.cache[require.resolve(SCRIPT)];
  if (!asMain) return require(SCRIPT);
  // require.main is read from process.mainModule when the module's require function is built;
  // point it at the script's own cache entry so the `require.main === module` guard is true.
  Object.defineProperty(process, 'mainModule', {
    configurable: true,
    get: () => require.cache[SCRIPT],
  });
  try {
    return require(SCRIPT);
  } finally {
    delete process.mainModule;
  }
}

// Route log by --merges flag so one handler can serve both git invocations.
function routeGit(logOutput, mergeOutput) {
  gitHandler = (cmd, args) => (args.includes('--merges') ? mergeOutput : logOutput);
}

beforeEach(() => {
  calls = [];
  gitHandler = () => '';
  childProcess.execFileSync = fakeExecFileSync;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  childProcess.execFileSync = realExecFileSync;
  vi.restoreAllMocks();
  delete require.cache[require.resolve(SCRIPT)];
});

describe('normalizers', () => {
  test('normalizeEmail lowercases, trims and tolerates empty input', () => {
    const { normalizeEmail } = loadScript();
    assert.strictEqual(normalizeEmail('  Alice@Example.COM '), 'alice@example.com');
    assert.strictEqual(normalizeEmail(''), '');
    assert.strictEqual(normalizeEmail(undefined), '');
    assert.strictEqual(normalizeEmail(null), '');
  });

  test('normalizeUsername strips spaces and illegal characters and caps at 39 chars', () => {
    const { normalizeUsername } = loadScript();
    assert.strictEqual(normalizeUsername('  Alice  Smith '), 'alicesmith');
    assert.strictEqual(normalizeUsername('Bob_O\'Neil!#'), 'bob_oneil');
    assert.strictEqual(normalizeUsername('a-b.c_d'), 'a-b.c_d');
    assert.strictEqual(normalizeUsername('x'.repeat(60)), 'x'.repeat(39));
  });

  test('extractGitHubUsername supports @mention, github.com URL and /user patterns', () => {
    const { extractGitHubUsername } = loadScript();
    assert.strictEqual(extractGitHubUsername('Fix bug thanks @Octo-Cat'), 'octo-cat');
    assert.strictEqual(extractGitHubUsername('See github.com/SomeUser for details'), 'someuser');
    assert.strictEqual(extractGitHubUsername('Merge from fork/dev-user #12'), 'dev-user');
    assert.strictEqual(extractGitHubUsername('Plain commit message'), null);
  });

  test('extractGitHubUsername falls through when a pattern matches but normalises to empty', () => {
    const { extractGitHubUsername } = loadScript();
    // First pattern requires at least one char, so a non-matching string yields null overall.
    assert.strictEqual(extractGitHubUsername('email me at @ nobody'), null);
  });
});

describe('getGitContributors', () => {
  test('aggregates commits per contributor, sorted by commit count', () => {
    const { getGitContributors } = loadScript();
    gitHandler = () => [
      'Alice Smith|Alice@Example.com|feat: one',
      'Bob Jones|bob@example.com|fix: two',
      'Alice Smith|alice@example.com|feat: three',
      '',
      'Bob Jones|bob@example.com|fix: four thanks @carol',
    ].join('\n');

    const result = getGitContributors('v1.0.0', 'v1.1.0');

    assert.deepStrictEqual(result.map(c => c.username), ['alicesmith', 'bobjones', 'carol']);
    assert.strictEqual(result[0].commits, 2);
    assert.strictEqual(result[0].email, 'alice@example.com');
    assert.strictEqual(result[0].name, 'Alice Smith');
    assert.deepStrictEqual(result[0].messages, ['feat: one', 'feat: three']);
    assert.strictEqual(result[2].name, 'Bob Jones');
    assert.strictEqual(result[2].commits, 1);
  });

  test('invokes git log with an argument array and the requested range', () => {
    const { getGitContributors } = loadScript();
    getGitContributors('v1.0.0', 'v1.1.0');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].cmd, 'git');
    assert.deepStrictEqual(calls[0].args, ['log', 'v1.0.0..v1.1.0', '--pretty=format:%an|%ae|%s', '--reverse']);
    assert.strictEqual(calls[0].opts.encoding, 'utf8');
    assert.strictEqual(calls[0].opts.cwd, process.cwd());
  });

  test('defaults toRef to HEAD', () => {
    const { getGitContributors } = loadScript();
    getGitContributors('v1.0.0');
    assert.strictEqual(calls[0].args[1], 'v1.0.0..HEAD');
  });

  test('returns an empty array for blank output', () => {
    const { getGitContributors } = loadScript();
    gitHandler = () => '  \n ';
    assert.deepStrictEqual(getGitContributors('a', 'b'), []);
  });

  test('skips whitespace-only and malformed lines', () => {
    const { getGitContributors } = loadScript();
    gitHandler = () => 'Alice|a@x.com|msg\n   \nno-pipes-here\nonly|two\nBob|b@x.com|msg2';
    const result = getGitContributors('a', 'b');
    assert.deepStrictEqual(result.map(c => c.username).sort(), ['alice', 'bob']);
  });

  test('rejects invalid refs without calling git', () => {
    const { getGitContributors } = loadScript();
    for (const bad of ['--output=x', 'a b', 'a;rm', '$(x)', '-x', '']) {
      assert.deepStrictEqual(getGitContributors(bad, 'HEAD'), [], `fromRef ${bad}`);
    }
    assert.deepStrictEqual(getGitContributors('v1', '--exec=x'), []);
    assert.deepStrictEqual(getGitContributors('v1', 'a b'), []);
    assert.deepStrictEqual(getGitContributors('v1', '-x'), []);
    assert.strictEqual(calls.length, 0);
    assert.ok(errorSpy.mock.calls.some(c => String(c[0]).includes('Invalid fromRef: --output=x')));
    assert.ok(errorSpy.mock.calls.some(c => String(c[0]).includes('Invalid toRef: --exec=x')));
  });

  test('returns an empty array and logs when git fails', () => {
    const { getGitContributors } = loadScript();
    gitHandler = () => { throw new Error('fatal: bad revision'); };
    assert.deepStrictEqual(getGitContributors('v1', 'v2'), []);
    assert.ok(errorSpy.mock.calls.some(
      c => String(c[0]).includes('Error getting git contributors: fatal: bad revision')
    ));
  });
});

describe('getPRContributors', () => {
  test('extracts PR authors and numbers from merge commits', () => {
    const { getPRContributors } = loadScript();
    gitHandler = () => [
      'Maintainer|m@example.com|Merge pull request #12 from alice/feature-a',
      'Maintainer|m@example.com|Merge pull request #15 from alice/feature-b',
      'Maintainer|m@example.com|Merge pull request #20 from bob/fix',
      'Maintainer|m@example.com|Merge branch main into develop',
      'Maintainer|m@example.com|Merge from carol/no-number',
      '',
      'malformed line',
    ].join('\n');

    const result = getPRContributors('v1', 'v2');

    assert.deepStrictEqual(result.map(c => c.username), ['alice', 'bob', 'carol']);
    assert.deepStrictEqual(result[0].prs, [12, 15]);
    assert.strictEqual(result[0].commits, 2);
    assert.strictEqual(result[0].email, null);
    assert.strictEqual(result[0].name, 'alice');
    assert.deepStrictEqual(result[0].merger, { name: 'Maintainer', email: 'm@example.com' });
    assert.deepStrictEqual(result[2].prs, []);
    assert.deepStrictEqual(calls[0].args, ['log', 'v1..v2', '--merges', '--pretty=format:%an|%ae|%s']);
  });

  test('returns an empty array for blank output and defaults toRef to HEAD', () => {
    const { getPRContributors } = loadScript();
    assert.deepStrictEqual(getPRContributors('v1'), []);
    assert.strictEqual(calls[0].args[1], 'v1..HEAD');
  });

  test('rejects invalid refs and handles git errors', () => {
    const { getPRContributors } = loadScript();
    assert.deepStrictEqual(getPRContributors('-bad', 'HEAD'), []);
    assert.deepStrictEqual(getPRContributors('bad ref', 'HEAD'), []);
    assert.deepStrictEqual(getPRContributors('v1', '-bad'), []);
    assert.deepStrictEqual(getPRContributors('v1', 'bad;ref'), []);
    assert.strictEqual(calls.length, 0);
    assert.ok(errorSpy.mock.calls.some(c => String(c[0]).includes('Invalid fromRef')));
    assert.ok(errorSpy.mock.calls.some(c => String(c[0]).includes('Invalid toRef')));

    gitHandler = () => { throw new Error('boom'); };
    assert.deepStrictEqual(getPRContributors('v1', 'v2'), []);
    assert.ok(errorSpy.mock.calls.some(c => String(c[0]).includes('Error getting PR contributors: boom')));
  });
});

describe('getAllContributors', () => {
  const LOG = 'Alice Smith|a@x.com|feat: one\nAlice Smith|a@x.com|feat: two\nBob|b@x.com|fix';
  const MERGES = [
    'M|m@x.com|Merge pull request #7 from alicesmith/feat',
    'M|m@x.com|Merge pull request #9 from dave/other',
    'M|m@x.com|Merge pull request #10 from dave/other2',
    'M|m@x.com|Merge pull request #11 from dave/other3',
  ].join('\n');

  test('merges PR data into git contributors and appends PR-only contributors', () => {
    const { getAllContributors } = loadScript();
    routeGit(LOG, MERGES);

    const result = getAllContributors('v1', 'v2');

    assert.deepStrictEqual(result.map(c => c.username), ['dave', 'alicesmith', 'bob']);
    const alice = result.find(c => c.username === 'alicesmith');
    assert.deepStrictEqual(alice.prs, [7]);
    assert.strictEqual(alice.commits, 2);
    const dave = result.find(c => c.username === 'dave');
    assert.strictEqual(dave.commits, 3);
    assert.deepStrictEqual(dave.prs, [9, 10, 11]);
    assert.ok(result.every(c => !('messages' in c)));
    assert.strictEqual(calls.length, 2);
  });

  test('keeps commit messages when includeMetadata is true', () => {
    const { getAllContributors } = loadScript();
    routeGit(LOG, MERGES);
    const result = getAllContributors('v1', 'v2', true);
    const alice = result.find(c => c.username === 'alicesmith');
    assert.deepStrictEqual(alice.messages, ['feat: one', 'feat: two']);
  });

  test('defaults toRef to HEAD and returns [] when both sources are empty', () => {
    const { getAllContributors } = loadScript();
    assert.deepStrictEqual(getAllContributors('v1'), []);
    assert.ok(calls.every(c => c.args[1] === 'v1..HEAD'));
  });
});

describe('formatContributors', () => {
  const people = (n) => Array.from({ length: n }, (_, i) => ({
    username: `user${i + 1}`, name: `User ${i + 1}`, commits: i + 1,
  }));

  test('returns the community message for an empty list in any format', () => {
    const { formatContributors } = loadScript();
    assert.strictEqual(formatContributors([]), 'Thanks to our community for this release!');
    assert.strictEqual(formatContributors([], 'names'), 'Thanks to our community for this release!');
  });

  test('mentions format handles one, two, three and more than ten contributors', () => {
    const { formatContributors } = loadScript();
    assert.strictEqual(formatContributors(people(1)), 'Thanks to @user1 for this release!');
    assert.strictEqual(formatContributors(people(2), 'mentions'), 'Thanks to @user1 and @user2 for this release!');
    assert.strictEqual(formatContributors(people(3)), 'Thanks to @user1, @user2, and @user3 for this release!');
    const many = formatContributors(people(12));
    assert.ok(many.includes('@user10 for this release!'));
    assert.ok(!many.includes('@user11'));
  });

  test('detailed format pluralises commit counts and caps at ten', () => {
    const { formatContributors } = loadScript();
    assert.strictEqual(formatContributors(people(1), 'detailed'), 'Thanks to @user1 (1 commit) for this release!');
    assert.strictEqual(
      formatContributors(people(3), 'detailed'),
      'Thanks to @user1 (1 commit), @user2 (2 commits), and @user3 (3 commits) for this release!'
    );
    assert.ok(!formatContributors(people(12), 'detailed').includes('@user11'));
  });

  test('names format lists names with a username fallback', () => {
    const { formatContributors } = loadScript();
    const out = formatContributors([{ username: 'a', name: 'Alice' }, { username: 'b' }], 'names');
    assert.strictEqual(out, '**Contributors:**\n- Alice\n- b');
    assert.strictEqual(formatContributors(people(12), 'names').split('\n').length, 11);
  });

  test('links format builds GitHub profile links', () => {
    const { formatContributors } = loadScript();
    assert.strictEqual(
      formatContributors(people(2), 'links'),
      '**Contributors:**\n- [@user1](https://github.com/user1)\n- [@user2](https://github.com/user2)'
    );
    assert.strictEqual(formatContributors(people(12), 'links').split('\n').length, 11);
  });

  test('unknown format returns an empty string', () => {
    const { formatContributors } = loadScript();
    assert.strictEqual(formatContributors(people(2), 'bogus'), '');
  });
});

describe('exportJSON', () => {
  test('serialises with two-space indentation', () => {
    const { exportJSON } = loadScript();
    const data = [{ username: 'a', commits: 1 }];
    assert.strictEqual(exportJSON(data), JSON.stringify(data, null, 2));
    assert.deepStrictEqual(JSON.parse(exportJSON(data)), data);
    assert.strictEqual(exportJSON([]), '[]');
  });
});

describe('CLI main', () => {
  const originalArgv = process.argv;
  let exitSpy;

  function run(args) {
    process.argv = ['node', SCRIPT, ...args];
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    loadScript(true);
  }

  afterEach(() => {
    process.argv = originalArgv;
  });

  const LOG = 'Alice|a@x.com|one\nAlice|a@x.com|two\nBob|b@x.com|three\nCarol|c@x.com|four';

  test('is not executed when the script is only required', () => {
    process.argv = ['node', SCRIPT, '--from', 'v1'];
    loadScript(false);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(logSpy.mock.calls.length, 0);
  });

  test('prints JSON by default using --from and --to', () => {
    routeGit(LOG, '');
    run(['--from', 'v1', '--to', 'v2']);
    assert.strictEqual(exitSpy.mock.calls.length, 0);
    assert.strictEqual(calls[0].args[1], 'v1..v2');
    const printed = JSON.parse(logSpy.mock.calls[0][0]);
    assert.deepStrictEqual(printed.map(c => c.username), ['alice', 'bob', 'carol']);
    assert.ok(printed.every(c => !('messages' in c)));
  });

  test('accepts short flags, a positional ref and --limit', () => {
    routeGit(LOG, '');
    run(['-f', 'v1', '-t', 'v3', '-l', '2']);
    assert.strictEqual(calls[0].args[1], 'v1..v3');
    assert.strictEqual(JSON.parse(logSpy.mock.calls[0][0]).length, 2);

    calls = [];
    logSpy.mockClear();
    run(['v9', '--limit', '1']);
    assert.strictEqual(calls[0].args[1], 'v9..HEAD');
    assert.strictEqual(JSON.parse(logSpy.mock.calls[0][0]).length, 1);
  });

  test('text format uses --output-format', () => {
    routeGit(LOG, '');
    run(['v1', '--format', 'text']);
    assert.strictEqual(logSpy.mock.calls[0][0], 'Thanks to @alice, @bob, and @carol for this release!');

    logSpy.mockClear();
    run(['v1', '--format', 'text', '--output-format', 'links', '--limit', '1']);
    assert.strictEqual(logSpy.mock.calls[0][0], '**Contributors:**\n- [@alice](https://github.com/alice)');
  });

  test('exits 1 when no starting reference is given', () => {
    run([]);
    assert.deepStrictEqual(exitSpy.mock.calls[0], [1]);
    assert.ok(errorSpy.mock.calls.some(c => String(c[0]).includes('No starting reference provided')));
    assert.strictEqual(calls.length, 0);
  });

  test('exits 1 for an unknown --format', () => {
    routeGit(LOG, '');
    run(['v1', '--format', 'xml']);
    assert.deepStrictEqual(exitSpy.mock.calls[0], [1]);
    assert.ok(errorSpy.mock.calls.some(c => String(c[0]).includes('Unknown format: xml')));
  });

  test('prints an empty JSON array when there are no contributors', () => {
    run(['v1']);
    assert.strictEqual(logSpy.mock.calls[0][0], '[]');
    assert.strictEqual(exitSpy.mock.calls.length, 0);
  });
});
