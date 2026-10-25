import fs from 'node:fs';
import { localPath, classify, atomicJson, hash } from './project.mjs';
import { normalizeTool } from './operations.mjs';
import { boundTask, matchesScope } from './tasks.mjs';

export function evaluate(project, event) {
  try {
    const normalized = normalizeTool(event.tool, event.input);
    if (normalized.unknown) return { allow: project.config.unknownTools === 'audit', uncovered: true, reason: `Uncovered tool: ${event.tool}. Final change validation is required.` };
    const operations = normalized.operations.map(op => ({ ...op, ...localPath(project.root, op.path, event.cwd ?? project.root) }));
    const code = operations.filter(op => classify(project, op.relative) === 'code');
    if (!code.length) return { allow: true, reason: 'No protected code operation' };
    if (operations.some(op => classify(project, op.relative) === 'spec')) return { allow: false, reason: 'Separate specification changes from code patches, then prepare the task' };
    const task = boundTask(project, event.host, event.session);
    for (const op of code) if (!matchesScope(op.relative, task.codePaths)) return { allow: false, reason: `Outside task ${task.id} scope: ${op.relative}` };
    return { allow: true, task: task.id, exception: task.mode === 'exception', reason: 'Task evidence and scope verified' };
  } catch (error) {
    return { allow: false, reason: error.message };
  }
}

export function receipt(project, event, result) {
  const file = localPath(project.root, `.sdd/state/receipts/${hash(`${event.host}\0${event.session}\0${event.phase}\0${result.allow}\0${Boolean(result.task)}`)}.json`).absolute;
  atomicJson(file, { host: event.host, session: event.session, phase: event.phase, tool: event.tool, result, at: new Date().toISOString() });
}

export function onEvent(project, event) {
  let result;
  if (event.phase === 'before') result = evaluate(project, event);
  else result = { allow: true, reason: event.phase === 'start' ? `SDD session ${event.host}/${event.session}; prepare a task and bind this exact session before code edits.` : 'Observed; no task is automatically unlocked' };
  receipt(project, event, result);
  return result;
}
