import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, hash, contentHash, readJson, localPath, relativeSetting, classify, readText, listFiles, HOSTS } from './project.mjs';

export function taskFile(project, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id)) throw new Error('Invalid task ID');
  return localPath(project.root, `.sdd/tasks/${id}.json`).absolute;
}

export function loadTask(project, id) {
  const task = readJson(taskFile(project, id));
  if (task.id !== id || task.schemaVersion !== 1) throw new Error('Task identity/version mismatch');
  return task;
}

function definition(task) {
  const { prepared, verification, status, ...rest } = task;
  return rest;
}
export const acToken = ac => new RegExp(`(?<![A-Za-z0-9_-])${ac}(?![A-Za-z0-9_-])`);

export function evidence(project, task) {
  if (!['existing-spec', 'spec-change', 'exception'].includes(task.mode)) throw new Error('Unknown task mode');
  if (!['open', 'closed'].includes(task.status)) throw new Error('Task status must be open or closed');
  if (!Array.isArray(task.codePaths) || !task.codePaths.length) throw new Error('Missing code scope');
  for (const scope of task.codePaths) {
    relativeSetting(scope);
    const file = localPath(project.root, scope).relative;
    if (classify(project, file.replace(/\/$/, '')) !== 'code') throw new Error(`Scope is not a code area: ${scope}`);
  }
  if (task.mode === 'exception') {
    if (typeof task.reason !== 'string' || task.reason.trim().length < 12) throw new Error('Exception requires a specific reason (12+ characters)');
    return { files: {}, digest: hash(JSON.stringify(definition(task))) };
  }
  if (task.mode === 'existing-spec' && (typeof task.reason !== 'string' || !task.reason.trim())) throw new Error('Explain why existing ACs are sufficient');
  if (!Array.isArray(task.specs) || !task.specs.length) throw new Error('Missing spec references');
  const files = {};
  const allAcs = new Set();
  for (const spec of task.specs) {
    const file = localPath(project.root, spec.path).relative;
    if (classify(project, file) !== 'spec' || !file.endsWith('.md')) throw new Error(`Not a specification: ${file}`);
    const text = readText(project, file);
    if (!Array.isArray(spec.acs) || !spec.acs.length) throw new Error('Missing AC identifiers');
    for (const ac of spec.acs) {
      if (!/^AC-[A-Za-z0-9_-]+$/.test(ac) || !acToken(ac).test(text)) throw new Error(`AC missing from specification: ${ac}`);
      if (allAcs.has(ac)) throw new Error(`Ambiguous AC identifier across specs: ${ac}; use globally qualified AC IDs`);
      allAcs.add(ac);
    }
    files[file] = contentHash(text);
  }
  const plan = readText(project, task.testPlan);
  for (const ac of allAcs) if (!acToken(ac).test(plan)) throw new Error(`Test plan does not cover ${ac}`);
  files[localPath(project.root, task.testPlan).relative] = contentHash(plan);
  if (!Array.isArray(task.tests) || !task.tests.length) throw new Error('Missing test mapping');
  const covered = new Set();
  for (const test of task.tests) {
    const file = localPath(project.root, test.path).relative;
    if (classify(project, file) !== 'test') throw new Error(`Not a test path: ${file}`);
    if (!Array.isArray(test.acs) || !test.acs.length) throw new Error(`Empty test AC mapping: ${file}`);
    for (const ac of test.acs) {
      if (!allAcs.has(ac)) throw new Error(`Test maps unknown AC: ${ac}`);
      covered.add(ac);
    }
  }
  for (const ac of allAcs) if (!covered.has(ac)) throw new Error(`No test mapping for ${ac}`);
  return { files, digest: hash(JSON.stringify({ definition: definition(task), files })) };
}

export function prepareTask(project, id) {
  const task = loadTask(project, id);
  if (task.status !== 'open') throw new Error('Cannot prepare closed task');
  task.prepared = { ...evidence(project, task), generation: randomUUID(), at: new Date().toISOString() };
  delete task.verification;
  atomicJson(taskFile(project, id), task);
  return task;
}

export function readyTask(project, id, { allowClosed = false } = {}) {
  const task = loadTask(project, id);
  if (!allowClosed && task.status !== 'open') throw new Error('Task is closed');
  const current = evidence(project, task);
  if (task.prepared?.digest !== current.digest) throw new Error('Task evidence changed or was not prepared; prepare and bind again');
  return task;
}

export function sessionFile(project, host, session) {
  if (!HOSTS.includes(host) || typeof session !== 'string' || !session.trim()) throw new Error('Missing/unsupported host or session identity');
  return localPath(project.root, `.sdd/state/sessions/${hash(`${host}\0${session}`)}.json`).absolute;
}

export function bindTask(project, host, session, id) {
  const task = readyTask(project, id);
  atomicJson(sessionFile(project, host, session), { host, session, task: id, digest: task.prepared.digest, generation: task.prepared.generation });
  return task;
}

export function boundTask(project, host, session) {
  const binding = readJson(sessionFile(project, host, session));
  if (binding.host !== host || binding.session !== session) throw new Error('Session identity mismatch');
  const task = readyTask(project, binding.task);
  if (binding.digest !== task.prepared.digest || !binding.generation || binding.generation !== task.prepared.generation) throw new Error('Task was re-prepared; bind this session again');
  return task;
}

export function matchesScope(file, scopes) {
  if (process.platform === 'win32') file = file.toLowerCase();
  return scopes.some(scope => {
    const directory = scope.endsWith('/') || scope.endsWith('\\');
    let normalized = relativeSetting(scope);
    if (process.platform === 'win32') normalized = normalized.toLowerCase();
    return directory ? file.startsWith(`${normalized}/`) : file === normalized;
  });
}

export function snapshot(project, task) {
  const files = new Set(task.codePaths.flatMap(p => listFiles(project, p)));
  for (const test of task.tests ?? []) files.add(localPath(project.root, test.path).relative);
  for (const file of Object.keys(task.prepared.files)) files.add(file);
  const contents = [...files].sort().map(file => {
    const absolute = localPath(project.root, file).absolute;
    return [file, fs.existsSync(absolute) && fs.statSync(absolute).isFile() ? contentHash(fs.readFileSync(absolute)) : 'deleted'];
  });
  return hash(JSON.stringify({ evidence: task.prepared.digest, contents, testCommand: project.config.testCommand }));
}

export function recordVerification(project, id, result, before) {
  const task = readyTask(project, id);
  const after = snapshot(project, task);
  if (before !== after) throw new Error('Source/evidence changed while tests ran; rerun verification');
  task.verification = { command: project.config.testCommand, exitCode: result.exitCode, snapshot: after, at: new Date().toISOString() };
  atomicJson(taskFile(project, id), task);
  return task;
}
