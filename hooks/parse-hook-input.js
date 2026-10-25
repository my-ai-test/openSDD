#!/usr/bin/env node
// Legacy single-path helper. New adapters use structured operations directly.
import fs from 'node:fs';
import { normalizeTool } from '../runtime/operations.mjs';
try {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const result = normalizeTool(data.tool_name || 'Edit', data.tool_input || data);
  if (result.unknown || result.operations.length !== 1) throw new Error('Expected exactly one recognized file operation');
  process.stdout.write(result.operations[0].path);
} catch (error) {
  console.error('[openSDD] ' + error.message);
  process.exitCode = 2;
}
