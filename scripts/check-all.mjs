import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { runProcess } from '../runtime/process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const tests = fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.mjs')).map(name => `tests/${name}`);
for (const args of [['--test', '--test-isolation=none', ...tests], ['scripts/check-repository.mjs']]) {
  const result = runProcess(process.execPath, args, { cwd: root, timeout: 180000 });
  process.stdout.write(result.stdout); process.stderr.write(result.stderr);
  if (result.exitCode !== 0) { process.exitCode = result.exitCode; break; }
}
