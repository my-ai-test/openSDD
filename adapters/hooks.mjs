import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadProject, HOSTS } from '../runtime/project.mjs';
import { onEvent } from '../runtime/guard.mjs';

const PHASES = { SessionStart: 'start', SessionEnd: 'end', PreToolUse: 'before', PostToolUse: 'after', PostToolUseFailure: 'failure' };
export function hookEvent(host, payload) {
  if (!['claude', 'codex', 'kimi'].includes(host)) throw new Error('Unsupported command-hook host');
  if (!payload || typeof payload !== 'object' || !PHASES[payload.hook_event_name]) throw new Error('Unsupported/missing hook event');
  if (typeof payload.session_id !== 'string' || !payload.session_id.trim() || typeof payload.cwd !== 'string' || !path.isAbsolute(payload.cwd)) throw new Error('Hook requires session_id and absolute cwd');
  const phase = PHASES[payload.hook_event_name];
  if (phase === 'before' && typeof payload.tool_name !== 'string') throw new Error('Missing tool_name');
  return { host, session: payload.session_id, cwd: payload.cwd, phase, tool: payload.tool_name, input: payload.tool_input, success: phase === 'after' };
}

export function handleHook(host, root, payload) {
  const event = hookEvent(host, payload);
  const resolved = path.resolve(root);
  const relative = path.relative(resolved, event.cwd);
  // Kimi hooks can be user-scoped. An explicitly targeted project must not
  // impose its policy on another project or worktree.
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return { allow: true, skipped: true, reason: 'Different project' };
  return onEvent(loadProject(resolved), event);
}

export function hookOutput(payload, result) {
  if (!result.allow) return { exitCode: 2, stdout: '', stderr: `[openSDD] ${result.reason}` };
  if (result.skipped) return { exitCode: 0, stdout: '', stderr: '' };
  if (payload.hook_event_name === 'SessionStart') return { exitCode: 0, stdout: result.reason, stderr: '' };
  if (result.uncovered) return { exitCode: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: payload.hook_event_name, additionalContext: `[openSDD audit] ${result.reason}` } }), stderr: '' };
  return { exitCode: 0, stdout: '', stderr: '' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [host, root] = process.argv.slice(2);
    if (!HOSTS.includes(host) || !root) throw new Error('Usage: node adapters/hooks.mjs HOST PROJECT_ROOT');
    const payload = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
    const output = hookOutput(payload, handleHook(host, root, payload));
    if (output.stdout) console.log(output.stdout);
    if (output.stderr) console.error(output.stderr);
    process.exitCode = output.exitCode;
  } catch (error) {
    console.error(`[openSDD] Hook protocol/configuration failure: ${error.message}`);
    process.exitCode = 2;
  }
}
