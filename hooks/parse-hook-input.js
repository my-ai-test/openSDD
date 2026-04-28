#!/usr/bin/env node
// parse-hook-input.js
// Reads Claude Code hook JSON from stdin, extracts file_path, prints to stdout.
//
// Handles both input formats:
//   - PreToolUse / PostToolUse:  { tool_input: { file_path: "..." } }
//   - Flat (legacy):             { file_path: "..." }
//
// Why Node.js instead of shell regex:
//   JSON.parse() is locale-safe and correctly handles UTF-8 paths (including
//   non-ASCII characters such as Chinese, Japanese, Korean) without relying on
//   the shell's grep/sed implementation or locale settings.
//
// Usage: echo "$HOOK_INPUT" | node parse-hook-input.js
// Output: file_path string (empty if absent or on parse error)
'use strict';

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const obj = JSON.parse(data);
    const fp = (obj.tool_input || obj).file_path || '';
    if (fp) process.stdout.write(fp);
  } catch (_) {
    // silent fail — caller treats empty output as "no file_path found"
  }
});
