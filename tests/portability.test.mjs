// AC-007: portable evidence hashes across Git EOL normalization.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { snapshot, readyTask } from '../runtime/tasks.mjs';

test('text evidence survives CRLF to LF conversion', t => {
  const f = fixture(t, { testCommand: { command: process.execPath, args: ['-e', 'process.exit(0)'] } });
  f.write('src/user.mjs', 'export const version = 1;\r\n');
  f.write('SDD/01-specs/feature.md', '# AC-001\r\nBusiness behavior\r\n');
  f.ready(); const task = readyTask(f.project, f.task.id); const first = snapshot(f.project, task);
  f.write('src/user.mjs', 'export const version = 1;\n');
  f.write('SDD/01-specs/feature.md', '# AC-001\nBusiness behavior\n');
  assert.equal(snapshot(f.project, readyTask(f.project, f.task.id)), first);
});
