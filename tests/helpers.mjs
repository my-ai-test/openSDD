// AC-010: isolated fixtures shared by all behavioral and integration checks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG, atomicJson, loadProject } from '../runtime/project.mjs';
import { prepareTask, bindTask } from '../runtime/tasks.mjs';

export function fixture(t, config = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opensdd-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  atomicJson(path.join(root, '.sdd/config.json'), { ...DEFAULT_CONFIG, frameworkDir: '.sdd/framework', ...config });
  write('SDD/01-specs/feature.md', '# Feature\n## AC-001\nWHEN a valid user registers THEN create an account.\n');
  write('SDD/02-plans/test.md', '# Test design\nAC-001 valid user succeeds; duplicate fails.');
  write('src/user.mjs', 'export const version = 1;\n');
  write('tests/user.test.mjs', '// AC-001\n');
  const task = { schemaVersion: 1, id: 'FD-001', mode: 'existing-spec', reason: 'Correct AC, repair implementation', status: 'open', specs: [{ path: 'SDD/01-specs/feature.md', acs: ['AC-001'] }], codePaths: ['src/user.mjs'], testPlan: 'SDD/02-plans/test.md', tests: [{ path: 'tests/user.test.mjs', acs: ['AC-001'] }] };
  atomicJson(path.join(root, '.sdd/tasks/FD-001.json'), task);
  const project = loadProject(root);
  return { root, write, task, project, save: () => atomicJson(path.join(root, '.sdd/tasks/FD-001.json'), task), ready: (host = 'codex', session = 's1') => { prepareTask(project, task.id); bindTask(project, host, session, task.id); } };
}
