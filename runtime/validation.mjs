import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { classify, loadProject, localPath, readText } from './project.mjs';
import { loadTask, readyTask, matchesScope, snapshot, recordVerification, acToken } from './tasks.mjs';
import { runProcess, git, revision } from './process.mjs';

export function verify(project, id, runner = runProcess) {
  const task = readyTask(project, id);
  const command = project.config.testCommand;
  if (!command) throw new Error('Configure testCommand as {command, args} before verification');
  for (const entry of task.tests ?? []) readText(project, entry.path);
  const before = snapshot(project, task);
  const result = runner(command.command, command.args, { cwd: project.root });
  recordVerification(project, id, result, before);
  return { ok: result.exitCode === 0, task: id, command, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}

export function validateFiles(project, changed) {
  const files = [...new Set(changed.map(file => localPath(project.root, file).relative))];
  const code = files.filter(file => classify(project, file) === 'code');
  if (!code.length) return { ok: true, status: 'not-applicable', codeFiles: 0, checked: [], problems: [], exceptions: [] };
  const dir = localPath(project.root, '.sdd/tasks').absolute;
  const ids = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) : [];
  const tasks = [], problems = [], checked = [], exceptions = [];
  for (const id of ids) {
    try { tasks.push(loadTask(project, id)); } catch (error) { problems.push(`Invalid task ${id}: ${error.message}`); }
  }
  const cache = new Map();
  for (const file of code) {
    const candidates = tasks.filter(task => Array.isArray(task.codePaths) && matchesScope(file, task.codePaths));
    let accepted = null; const failures = [];
    for (const candidate of candidates) {
      let validation = cache.get(candidate.id);
      if (!validation) {
        try {
          const task = readyTask(project, candidate.id, { allowClosed: true });
          for (const entry of task.tests ?? []) {
            const text = readText(project, entry.path);
            for (const ac of entry.acs) if (!acToken(ac).test(text)) throw new Error(`Test file ${entry.path} does not identify ${ac}`);
          }
          if (task.verification?.exitCode !== 0 || task.verification.snapshot !== snapshot(project, task)) throw new Error('Missing, failed or stale test execution evidence');
          validation = { task };
        } catch (error) { validation = { error: error.message }; }
        cache.set(candidate.id, validation);
      }
      if (!validation.error) { accepted = validation.task; break; }
      failures.push(`${candidate.id}: ${validation.error}`);
    }
    if (!accepted) problems.push(`${file}: ${failures.join('; ') || 'No task covers this code path'}`);
    else {
      checked.push({ file, task: accepted.id });
      if (accepted.mode === 'exception') exceptions.push({ file, task: accepted.id, reason: accepted.reason });
    }
  }
  return { ok: problems.length === 0, status: problems.length ? 'failed' : 'passed', codeFiles: code.length, checked, problems, exceptions };
}

function changedFiles(root, base, head) {
  if (base) return git(root, ['diff', '--no-renames', '--name-only', '-z', base, head, '--']).stdout.split('\0').filter(Boolean);
  let tracked;
  try { const current = revision(root, 'HEAD'); tracked = git(root, ['diff', '--no-renames', '--name-only', '-z', current, '--']).stdout; }
  catch { tracked = git(root, ['diff', '--cached', '--name-only', '-z', '--']).stdout + git(root, ['diff', '--name-only', '-z', '--']).stdout; }
  return (tracked + git(root, ['ls-files', '--others', '--exclude-standard', '-z']).stdout).split('\0').filter(Boolean);
}

function revisionProject(root, commit) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'opensdd-revision-'));
  try {
    const entries = git(root, ['ls-tree', '-r', '-z', commit]).stdout.split('\0').filter(Boolean).map(entry => {
      const tab = entry.indexOf('\t'); const [mode, type, object] = entry.slice(0, tab).split(' ');
      return { mode, type, object, file: entry.slice(tab + 1) };
    }).filter(entry => entry.type === 'blob' && entry.mode !== '120000');
    if (entries.length) {
      const bytes = git(root, ['cat-file', '--batch'], entries.map(entry => entry.object).join('\n') + '\n').stdoutBytes;
      let offset = 0;
      for (const entry of entries) {
        const end = bytes.indexOf(10, offset);
        const header = bytes.subarray(offset, end).toString('utf8').split(' ');
        const size = Number(header[2]);
        if (header[0] !== entry.object || header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0) throw new Error('Invalid git blob response');
        const output = localPath(temporary, entry.file).absolute;
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, bytes.subarray(end + 1, end + 1 + size));
        offset = end + 1 + size + 1;
      }
    }
    return { project: loadProject(temporary), cleanup: () => fs.rmSync(temporary, { recursive: true, force: true }) };
  } catch (error) { fs.rmSync(temporary, { recursive: true, force: true }); throw error; }
}

export function validate(project, options = {}) {
  if (options.head && !options.base) throw new Error('--head requires --base');
  if (!options.base) return validateFiles(project, changedFiles(project.root));
  const base = revision(project.root, options.base), head = revision(project.root, options.head ?? 'HEAD');
  const common = git(project.root, ['merge-base', base, head]).stdout.trim();
  const changed = changedFiles(project.root, common, head);
  const materialized = revisionProject(project.root, head);
  try { return { ...validateFiles(materialized.project, changed), base: common, head, evidenceSource: 'head revision (working tree ignored)' }; }
  finally { materialized.cleanup(); }
}

export function summarizeHistory(project, commits, failBelow = 0) {
  let withSpec = 0, withoutSpec = 0, exceptions = 0, noCode = 0;
  for (const commit of commits) {
    if (!commit.files.some(file => classify(project, file) === 'code')) { noCode++; continue; }
    if (/\bbypass:/i.test(commit.subject)) { exceptions++; continue; }
    if (commit.files.some(file => classify(project, file) === 'spec')) withSpec++; else withoutSpec++;
  }
  const samples = withSpec + withoutSpec + exceptions;
  const percent = samples ? Math.floor(withSpec * 100 / samples) : null;
  return { ok: percent === null || percent >= failBelow, metric: 'Spec/code co-change adoption, not test coverage or proof of edit order', status: percent === null ? 'not-applicable' : 'measured', percent, withSpec, withoutSpec, exceptions, noCode, samples };
}

export function coverage(project, options = {}) {
  const count = Number(options.commits ?? 30), threshold = Number(options['fail-below'] ?? 0);
  if (!Number.isInteger(count) || count < 1 || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error('Invalid commits or fail-below value');
  const args = ['log', '--no-merges', '--format=%H%x00%s', `-n${count}`];
  if (options.since) args.push(`--since=${options.since}`);
  const commits = git(project.root, args).stdout.trim().split('\n').filter(Boolean).map(line => {
    const [id, subject] = line.split('\0');
    return { subject, files: git(project.root, ['diff-tree', '--root', '--no-commit-id', '--no-renames', '-r', '--name-only', '-z', id]).stdout.split('\0').filter(Boolean) };
  });
  return summarizeHistory(project, commits, threshold);
}
