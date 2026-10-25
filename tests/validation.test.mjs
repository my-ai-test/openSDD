// AC-007 AC-008: executed tests, final Git ranges and adoption accounting.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture } from './helpers.mjs';
import { verify, validateFiles, validate, summarizeHistory, coverage } from '../runtime/validation.mjs';
import { git, runProcess } from '../runtime/process.mjs';
import { loadProject, atomicJson } from '../runtime/project.mjs';

function runnable(t) {
  const f = fixture(t, { testCommand: { command: process.execPath, args: ['tests/check.cjs'] } });
  f.write('tests/check.cjs', "// AC-001\nconst fs=require('node:fs');if(!fs.readFileSync('src/user.mjs','utf8').includes('version = 1'))process.exit(1);\n");
  f.task.tests[0].path = 'tests/check.cjs'; f.save(); f.ready(); return f;
}

test('final validator requires actual passing test evidence and detects stale code or missing tests', t => {
  const f = runnable(t);
  assert.equal(validateFiles(f.project, ['src/user.mjs']).ok, false);
  assert.equal(verify(f.project, f.task.id).ok, true);
  assert.equal(validateFiles(f.project, ['src/user.mjs']).ok, true);
  f.write('src/user.mjs', 'export const version = 2;');
  assert.equal(validateFiles(f.project, ['src/user.mjs']).ok, false);
  assert.equal(verify(f.project, f.task.id).ok, false);
  assert.equal(validateFiles(f.project, ['src/user.mjs']).ok, false);
});

test('validator checks every code file, allows earlier specs, and reports no-code as N/A', t => {
  const f = runnable(t); verify(f.project, f.task.id);
  assert.equal(validateFiles(f.project, ['src/user.mjs', 'src/uncovered.mjs']).ok, false);
  assert.equal(validateFiles(f.project, ['README.md', 'tests/check.cjs']).status, 'not-applicable');
  assert.equal(validateFiles(f.project, ['src/user.mjs']).ok, true);
});

test('missing AC identifiers in test artifacts fail final validation', t => {
  const f = runnable(t);
  for (const content of ['process.exit(0);', '// AC-0010 is a different criterion\nprocess.exit(0);']) {
    f.write('tests/check.cjs', content);
    verify(f.project, f.task.id);
    assert.equal(validateFiles(f.project, ['src/user.mjs']).ok, false);
  }
});

test('adoption metric separates bypass and N/A and shares file classification', t => {
  const f = fixture(t);
  assert.equal(summarizeHistory(f.project, [{ subject: 'docs', files: ['README.md'] }], 100).percent, null);
  const result = summarizeHistory(f.project, [
    { subject: 'feature', files: ['src/a.mjs', 'SDD/01-specs/a.md'] },
    { subject: 'bypass: format', files: ['src/b.mjs'] },
    { subject: 'code only', files: ['src/c.mjs'] },
    { subject: 'tests', files: ['src/a.spec.jsx'] }
  ], 80);
  assert.equal(result.percent, 33); assert.equal(result.exceptions, 1); assert.equal(result.noCode, 1); assert.equal(result.ok, false);
});

test('Git base/head validates committed evidence, ignores dirty working tree, includes root commit in adoption', t => {
  const f = runnable(t);
  git(f.root, ['init']); git(f.root, ['config', 'user.email', 'test@example.invalid']); git(f.root, ['config', 'user.name', 'SDD Test']);
  f.write('.gitignore', '.sdd/state/\n');
  git(f.root, ['add', '.']); git(f.root, ['commit', '-m', 'baseline']);
  const base = git(f.root, ['rev-parse', 'HEAD']).stdout.trim();
  f.write('src/user.mjs', 'export const version = 1; // implemented\n');
  verify(f.project, f.task.id);
  git(f.root, ['add', '.']); git(f.root, ['commit', '-m', 'implement existing AC']);
  f.write('src/user.mjs', 'broken dirty worktree');
  assert.equal(validate(f.project).ok, false);
  const committed = validate(f.project, { base, head: 'HEAD' });
  assert.equal(committed.ok, true, JSON.stringify(committed));
  assert.equal(coverage(f.project, { commits: '20' }).samples, 2);
  assert.throws(() => validate(f.project, { head: 'HEAD' }), /requires/);
});

test('CLI validation and hook runner return actual failure/success process exit codes', t => {
  const f = runnable(t);
  const cli = path.resolve('runtime/cli.mjs');
  const result = runProcess(process.execPath, [cli, 'verify', '--project', f.root, '--task', f.task.id]);
  assert.equal(result.exitCode, 0, result.stderr);
  const hook = path.resolve('adapters/hooks.mjs');
  const payload = { hook_event_name: 'PreToolUse', session_id: 'unbound', cwd: f.root, tool_name: 'Edit', tool_input: { file_path: 'src/user.mjs' } };
  assert.equal(runProcess(process.execPath, [hook, 'codex', f.root], { input: JSON.stringify(payload) }).exitCode, 2);
  payload.session_id = 's1';
  assert.equal(runProcess(process.execPath, [hook, 'codex', f.root], { input: JSON.stringify(payload) }).exitCode, 0);
  assert.equal(runProcess(process.execPath, [hook, 'codex', f.root], { input: '{bad' }).exitCode, 2);
});
