#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadProject, findProject, atomicJson } from './project.mjs';
import { prepareTask, bindTask, loadTask, taskFile } from './tasks.mjs';

export function parseArgs(args) {
  const command = args.shift() ?? 'help';
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error(`Expected --option value: ${args[i]}`);
    const key = args[i].slice(2);
    if (key in options) throw new Error(`Duplicate option: ${key}`);
    options[key] = args[i + 1];
  }
  return { command, options };
}

export async function main(args = process.argv.slice(2)) {
  const { command, options } = parseArgs([...args]);
  const allowed = {
    help: [], prepare: ['project', 'task'], bind: ['project', 'task', 'host', 'session'],
    status: ['project', 'task'], close: ['project', 'task'],
    verify: ['project', 'task'], validate: ['project', 'base', 'head'],
    doctor: ['project', 'host', 'require-active'],
    install: ['project', 'host', 'kimi-config'], uninstall: ['project', 'host'],
    coverage: ['project', 'commits', 'since', 'fail-below']
  };
  if (!allowed[command]) throw new Error(`Unknown command: ${command}`);
  for (const key of Object.keys(options)) if (!allowed[command].includes(key)) throw new Error(`Unknown option for ${command}: ${key}`);
  if (command === 'help') return { usage: 'node runtime/cli.mjs <install|uninstall|doctor|prepare|bind|status|close|verify|validate|coverage> --project PATH [options]', guide: 'docs/runtime.md' };
  if (['install', 'uninstall'].includes(command)) {
    const installer = await import('./install.mjs');
    return installer[command](options);
  }
  const root = options.project ?? findProject(process.cwd());
  if (!root) throw new Error('No .sdd/config.json found; pass --project explicitly');
  const project = loadProject(root);
  if (command === 'prepare') return prepareTask(project, options.task);
  if (command === 'bind') return { task: bindTask(project, options.host, options.session, options.task).id, host: options.host, session: options.session };
  if (command === 'status') return loadTask(project, options.task);
  if (command === 'close') {
    const task = loadTask(project, options.task); task.status = 'closed'; atomicJson(taskFile(project, task.id), task); return { closed: task.id };
  }
  if (command === 'doctor') return (await import('./doctor.mjs')).doctor(project, options);
  const validation = await import('./validation.mjs');
  if (command === 'verify') return validation.verify(project, options.task);
  if (command === 'validate') return validation.validate(project, options);
  if (command === 'coverage') return validation.coverage(project, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await main();
    console.log(JSON.stringify(result, null, 2));
    if (result.ok === false) process.exitCode = 1;
  } catch (error) {
    console.error(`[openSDD] ${error.message}`);
    process.exitCode = 1;
  }
}
