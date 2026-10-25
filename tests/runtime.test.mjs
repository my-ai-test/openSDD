// AC-001 AC-002 AC-003 AC-004: scope, evidence, lifecycle and path contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture } from './helpers.mjs';
import { evaluate, onEvent } from '../runtime/guard.mjs';
import { prepareTask, bindTask, readyTask, snapshot, recordVerification } from '../runtime/tasks.mjs';
import { parsePatch } from '../runtime/operations.mjs';
import { localPath, classify } from '../runtime/project.mjs';
import { main } from '../runtime/cli.mjs';

const event = (f, changes = {}) => ({ host: 'codex', session: 's1', phase: 'before', cwd: f.root, tool: 'Edit', input: { file_path: 'src/user.mjs' }, ...changes });

test('re-preparing identical evidence still requires a fresh session binding', t => {
  const f = fixture(t); f.ready();
  prepareTask(f.project, f.task.id);
  assert.equal(evaluate(f.project, event(f)).allow, false);
  bindTask(f.project, 'codex', 's1', f.task.id);
  assert.equal(evaluate(f.project, event(f)).allow, true);
});

test('read/spec/test allowed; code denied until scoped evidence is prepared and bound', t => {
  const f = fixture(t);
  assert.equal(evaluate(f.project, event(f)).allow, false);
  for (const file of ['SDD/01-specs/feature.md', 'tests/new.test.mjs', 'README.md']) assert.equal(evaluate(f.project, event(f, { input: { path: file } })).allow, true);
  f.ready(); assert.equal(evaluate(f.project, event(f)).allow, true);
  assert.equal(evaluate(f.project, event(f, { input: { path: 'src/other.mjs' } })).allow, false);
});

test('unrelated writes and failed post events never unlock code', t => {
  const f = fixture(t);
  onEvent(f.project, event(f, { phase: 'after', tool: 'Write', input: { path: 'SDD/BACKLOG.md' }, success: false }));
  assert.equal(evaluate(f.project, event(f)).allow, false);
});

test('missing AC, unrelated spec, empty spec, missing test design and unmapped AC reject preparation', t => {
  for (const mutate of [f => { f.task.specs[0].acs = ['AC-002']; }, f => { f.task.specs[0].path = 'SDD/BACKLOG.md'; f.write('SDD/BACKLOG.md', 'AC-001'); }, f => f.write('SDD/01-specs/feature.md', ' '), f => f.write('SDD/02-plans/test.md', 'no scenarios'), f => { f.task.tests = []; }]) {
    const f = fixture(t); mutate(f); f.save(); assert.throws(() => prepareTask(f.project, f.task.id));
  }
});

test('session/host isolation, resume preserves binding, spec edits invalidate existing bindings', t => {
  const f = fixture(t); f.ready();
  assert.equal(evaluate(f.project, event(f, { session: 's2' })).allow, false);
  assert.equal(evaluate(f.project, event(f, { host: 'claude' })).allow, false);
  onEvent(f.project, event(f, { phase: 'start' }));
  assert.equal(evaluate(f.project, event(f)).allow, true);
  f.write('SDD/01-specs/feature.md', '# AC-001\nChanged behavior');
  assert.equal(evaluate(f.project, event(f)).allow, false);
  prepareTask(f.project, f.task.id);
  assert.equal(evaluate(f.project, event(f)).allow, false);
  bindTask(f.project, 'codex', 's1', f.task.id);
  assert.equal(evaluate(f.project, event(f)).allow, true);
});

test('parallel independent session files do not reset one another', t => {
  const f = fixture(t); f.ready(); bindTask(f.project, 'codex', 's2', f.task.id);
  for (const session of ['s1', 's2']) { onEvent(f.project, event(f, { phase: 'start', session })); assert.equal(evaluate(f.project, event(f, { session })).allow, true); }
});

test('relative, absolute, backslash and Unicode/space paths are normalized; traversal rejected', t => {
  const f = fixture(t); f.task.codePaths = ['src/']; f.save(); f.ready();
  for (const p of ['src/user.mjs', path.join(f.root, 'src/user.mjs'), 'src\\user.mjs', 'src/中文 文件.mjs']) assert.equal(evaluate(f.project, event(f, { input: { path: p } })).allow, true);
  for (const p of ['../outside/src/x.mjs', 'src/../../escape.mjs']) assert.equal(evaluate(f.project, event(f, { input: { path: p } })).allow, false);
  assert.equal(classify(f.project, 'src/user.mjs'), 'code');
  assert.equal(localPath(f.root, 'user.mjs', path.join(f.root, 'src')).relative, 'src/user.mjs');
});

test('multi-file patches cover moves/deletions and reject mixed spec/code or unscoped targets', t => {
  const f = fixture(t); f.ready();
  const check = command => evaluate(f.project, event(f, { tool: 'apply_patch', input: { command } }));
  assert.equal(check('*** Begin Patch\n*** Delete File: src/user.mjs\n*** End Patch').allow, true);
  assert.equal(check('*** Begin Patch\n*** Update File: src/user.mjs\n*** Move to: src/other.mjs\n*** End Patch').allow, false);
  assert.equal(check('*** Begin Patch\n*** Update File: SDD/01-specs/feature.md\n*** Update File: src/user.mjs\n*** End Patch').allow, false);
  assert.throws(() => parsePatch('malformed'));
  assert.equal(evaluate(f.project, event(f, { input: {} })).allow, false);
});

test('unknown tools are explicit audit gaps or denied in strict mode', t => {
  const f = fixture(t);
  assert.equal(evaluate(f.project, event(f, { tool: 'Bash', input: { command: 'echo hello' } })).uncovered, true);
  f.project.config.unknownTools = 'deny';
  assert.equal(evaluate(f.project, event(f, { tool: 'Bash' })).allow, false);
  assert.equal(evaluate(f.project, event(f, { tool: 'Read' })).allow, true);
});

test('task changes/closure and malformed state fail closed', t => {
  const f = fixture(t); f.ready();
  f.task.status = 'closed'; f.save(); assert.equal(evaluate(f.project, event(f)).allow, false);
  f.write('.sdd/tasks/FD-001.json', '{broken'); assert.equal(evaluate(f.project, event(f)).allow, false);
});

test('explicit exceptions require a reason and remain scoped', t => {
  const f = fixture(t); f.task.mode = 'exception'; f.task.reason = ''; f.save();
  assert.throws(() => prepareTask(f.project, f.task.id));
  f.task.reason = 'Formatting only; no behavior changes'; f.save(); f.ready();
  assert.equal(evaluate(f.project, event(f)).exception, true);
});

test('verification snapshots detect code edits and changes during execution', t => {
  const f = fixture(t); f.ready(); const task = readyTask(f.project, f.task.id); const before = snapshot(f.project, task);
  recordVerification(f.project, task.id, { exitCode: 0 }, before);
  f.write('src/user.mjs', 'changed'); assert.notEqual(snapshot(f.project, task), before);
  assert.throws(() => recordVerification(f.project, task.id, { exitCode: 0 }, before));
});

test('symlink escape cannot authorize outside project writes', t => {
  const f = fixture(t); const outside = fixture(t);
  try { fs.symlinkSync(outside.root, path.join(f.root, 'src/link'), 'junction'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('OS disallows test symlink'); return; } throw error; }
  assert.equal(evaluate(f.project, event(f, { input: { path: 'src/link/new.mjs' } })).allow, false);
  fs.symlinkSync(path.join(outside.root, 'missing'), path.join(f.root, 'src/dangling'), 'junction');
  assert.throws(() => localPath(f.root, 'src/dangling/new.mjs'), /Symlink/);
});

test('CLI prepares, binds, reports and closes without invalidating final evidence', async t => {
  const f = fixture(t);
  await main(['prepare', '--project', f.root, '--task', f.task.id]);
  await main(['bind', '--project', f.root, '--task', f.task.id, '--host', 'codex', '--session', 's1']);
  assert.equal(evaluate(f.project, event(f)).allow, true);
  await main(['close', '--project', f.root, '--task', f.task.id]);
  assert.equal(evaluate(f.project, event(f)).allow, false);
  assert.equal(readyTask(f.project, f.task.id, { allowClosed: true }).status, 'closed');
  await assert.rejects(() => main(['prepare', '--typo', 'x']));
});

test('CRLF patches and Windows casing preserve guard behavior', t => {
  const f = fixture(t); f.ready();
  assert.equal(parsePatch('*** Begin Patch\r\n*** Delete File: src/user.mjs\r\n*** End Patch')[0].kind, 'delete');
  if (process.platform === 'win32') {
    assert.equal(evaluate(f.project, event(f, { input: { path: 'SRC/USER.mjs' } })).allow, true);
    assert.equal(evaluate(f.project, event(f, { session: 'unbound', input: { path: 'SRC/USER.mjs' } })).allow, false);
  }
});
