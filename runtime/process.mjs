import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// File descriptors also work in Windows sandboxes that prohibit child pipes.
// Commands are executable + argv, never interpolated shell strings.
export function runProcess(command, args, { cwd, input, timeout = 120000, env = process.env } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'opensdd-process-'));
  const outFile = path.join(temp, 'stdout'), errFile = path.join(temp, 'stderr');
  const out = fs.openSync(outFile, 'w'), err = fs.openSync(errFile, 'w');
  let stdin;
  try {
    if (input !== undefined) { const file = path.join(temp, 'stdin'); fs.writeFileSync(file, input); stdin = fs.openSync(file, 'r'); }
    const result = spawnSync(command, args, { cwd, env, stdio: [stdin ?? 'ignore', out, err], timeout, windowsHide: true });
    if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
    if (result.signal || result.status === null) throw new Error(`${command} did not complete: ${result.signal ?? 'unknown status'}`);
    const stdoutBytes = fs.readFileSync(outFile);
    return { exitCode: result.status, stdout: stdoutBytes.toString('utf8'), stdoutBytes, stderr: fs.readFileSync(errFile, 'utf8') };
  } finally {
    fs.closeSync(out); fs.closeSync(err); if (stdin !== undefined) fs.closeSync(stdin);
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

export function git(root, args, input) {
  const result = runProcess('git', ['--literal-pathspecs', '-c', 'core.quotepath=false', ...args], { cwd: root, input });
  if (result.exitCode !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
  return result;
}

export function revision(root, ref) {
  return git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).stdout.trim();
}
