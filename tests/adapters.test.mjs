// AC-005: normalized lifecycle contracts for all five host adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture } from './helpers.mjs';
import { handleHook, hookOutput } from '../adapters/hooks.mjs';
import { createV1 } from '../adapters/opencode-v1.mjs';
import { createV2 } from '../adapters/opencode-v2.mjs';
const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/hooks.json', import.meta.url)));

for (const host of ['claude', 'codex', 'kimi']) {
  test(`${host}: real hook entry logic denies, allows scoped prepared task, rejects stale evidence`, t => {
    const f = fixture(t); const payload = { ...fixtures[host], cwd: f.root };
    assert.equal(hookOutput(payload, handleHook(host, f.root, payload)).exitCode, 2);
    f.ready(host); assert.equal(hookOutput(payload, handleHook(host, f.root, payload)).exitCode, 0);
    handleHook(host, f.root, { ...payload, hook_event_name: 'SessionStart', source: 'resume' });
    assert.equal(handleHook(host, f.root, payload).allow, true);
    f.write('SDD/01-specs/feature.md', 'AC-001 changed');
    assert.equal(handleHook(host, f.root, payload).allow, false);
  });
}

test('command hooks ignore unrelated project, reject missing identity and malformed writes', t => {
  const f = fixture(t); const other = fixture(t);
  assert.equal(handleHook('kimi', f.root, { ...fixtures.kimi, cwd: other.root }).skipped, true);
  assert.throws(() => handleHook('codex', f.root, { ...fixtures.codex, cwd: f.root, session_id: null }));
  assert.equal(handleHook('claude', f.root, { ...fixtures.claude, cwd: f.root, tool_input: {} }).allow, false);
});

test('OpenCode V1 exports working before/after guards; after never grants readiness', async t => {
  const f = fixture(t); const plugin = createV1({ directory: f.root }, f.root);
  const input = fixtures['opencode-v1']; const output = { args: { filePath: 'src/user.mjs' } };
  await plugin['tool.execute.after'](input, output);
  await assert.rejects(() => plugin['tool.execute.before'](input, output));
  f.ready('opencode-v1'); await plugin['tool.execute.before'](input, output);
  await assert.rejects(() => plugin['tool.execute.before']({ ...input, sessionID: 's2' }, output));
  f.write('SDD/01-specs/feature.md', 'AC-001 changed');
  await assert.rejects(() => plugin['tool.execute.before'](input, output));
});

test('OpenCode V2 uses session location (not plugin location) and handles failed tools', async t => {
  const f = fixture(t); const handlers = {};
  let location = f.root;
  await createV2(f.root).setup({ location: { directory: 'wrong-instance-location' }, session: { get: async () => ({ location: { directory: location } }) }, tool: { hook: async (name, fn) => { handlers[name] = fn; } } });
  const input = fixtures['opencode-v2'];
  await handlers['execute.after']({ ...input, status: 'error', error: { message: 'write failed' } });
  await assert.rejects(() => handlers['execute.before'](input));
  f.ready('opencode-v2'); await handlers['execute.before'](input);
  await assert.rejects(() => handlers['execute.before']({ ...input, sessionID: 's2' }));
  f.write('SDD/01-specs/feature.md', 'AC-001 changed');
  await assert.rejects(() => handlers['execute.before'](input));
  location = fixture(t).root; await handlers['execute.before'](input);
  location = null; await assert.rejects(() => handlers['execute.before'](input));
});
