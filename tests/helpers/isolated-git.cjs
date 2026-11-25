'use strict';

// Helpers that keep git fixtures away from the caller's repository, configuration and hooks.
// A caller can have GIT_DIR, GIT_WORK_TREE or GIT_INDEX_FILE set, global hooks or signing
// configured, or a template directory; none of that may reach a fixture repository.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GIT_TIMEOUT_MS = 15000;

// Every inherited variable that selects a repository or changes git behaviour is dropped.
function isGitVariable(name) {
  return name.startsWith('GIT_') || name === 'EMAIL';
}

// A controlled environment for one fixture. `home` is a temporary directory owned by the test.
function isolatedGitEnv(home) {
  const env = {
    PATH: process.env.PATH || '',
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.com',
    GIT_COMMITTER_NAME: 'fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.com',
  };
  return env;
}

// Options that turn off inherited hooks and signing for a single git call.
const SAFE_CONFIG = ['-c', `core.hooksPath=${os.devNull}`, '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false'];

// Run git in `cwd` with the isolated environment and fail loudly if it does not succeed.
function runGit(args, cwd, home) {
  const result = spawnSync('git', [...SAFE_CONFIG, ...args], {
    cwd,
    env: isolatedGitEnv(home),
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.error ? result.error.message : result.stderr}`);
  }
  return result.stdout;
}

// Create a repository with one empty commit, entirely inside `repo` and `home`.
function initFixtureRepo(repo, home) {
  const templateDir = fs.mkdtempSync(path.join(home, 'empty-template-'));
  runGit(['init', '-q', `--template=${templateDir}`], repo, home);
  runGit(['commit', '-q', '--allow-empty', '-m', 'init'], repo, home);
}

// Run `fn` with the caller's git variables removed and an isolated configuration, then restore them.
// Use this around in-process code that calls git with the inherited process.env.
function withIsolatedGitEnv(home, fn) {
  const saved = { ...process.env };
  Object.keys(process.env).filter(isGitVariable).forEach((name) => delete process.env[name]);
  Object.assign(process.env, isolatedGitEnv(home));
  try {
    return fn();
  } finally {
    Object.keys(process.env).forEach((name) => delete process.env[name]);
    Object.assign(process.env, saved);
  }
}

module.exports = { GIT_TIMEOUT_MS, isolatedGitEnv, runGit, initFixtureRepo, withIsolatedGitEnv };
