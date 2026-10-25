// AC-006 AC-009: safe ownership, rollback and honest activation diagnostics.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixture } from './helpers.mjs';
import { install, uninstall, managedBlock, commandPath } from '../runtime/install.mjs';
import { doctor } from '../runtime/doctor.mjs';
import { loadProject, readJson } from '../runtime/project.mjs';
import { handleHook } from '../adapters/hooks.mjs';

test('two projects can share a Kimi config and uninstall independently', t => {
  const a = fixture(t), b = fixture(t);
  a.write('global.toml', '# shared config\nmodel = "test"\n');
  const target = path.join(a.root, 'global.toml');
  const first = { project: a.root, host: 'kimi', 'kimi-config': target };
  const second = { project: b.root, host: 'kimi', 'kimi-config': target };
  install(first); install(second); uninstall(first);
  assert.equal(doctor(loadProject(b.root), { host: 'kimi' }).ok, true);
  uninstall(second);
  assert.equal(fs.readFileSync(target, 'utf8').trim(), '# shared config\nmodel = "test"');
});

test('edited hook registrations cannot leave dangling commands after uninstall', t => {
  const f = fixture(t), options = { project: f.root, host: 'codex' };
  install(options);
  const hooks = readJson(path.join(f.root, '.codex/hooks.json'));
  hooks.hooks.PreToolUse[0].matcher = 'Write';
  f.write('.codex/hooks.json', JSON.stringify(hooks));
  assert.throws(() => uninstall(options), /reconcile/);
  assert.equal(fs.existsSync(path.join(f.root, '.sdd/framework/adapters/hooks.mjs')), true);
  assert.equal(doctor(loadProject(f.root), { host: 'codex' }).ok, false);
  fs.unlinkSync(path.join(f.root, '.codex/hooks.json'));
  assert.equal(doctor(loadProject(f.root), { host: 'codex' }).ok, false);
});

for (const host of ['claude', 'codex', 'kimi', 'opencode-v1', 'opencode-v2']) {
  test(`${host}: installation is idempotent, preserves user instructions/config and uninstalls cleanly`, t => {
    const f = fixture(t);
    f.write('AGENTS.md', '# User instructions\nDo not change these rules.\n');
    f.write('CLAUDE.md', '# Claude instructions\n');
    f.write('.gitignore', 'user-local/\n');
    f.write('.claude/settings.json', JSON.stringify({ permissions: { deny: ['Bash(rm:*)'] }, hooks: { PreToolUse: [{ matcher: 'Read', hooks: [{ type: 'command', command: 'user-hook' }] }] } }));
    f.write('.codex/hooks.json', JSON.stringify({ description: 'User hooks', hooks: {} }));
    f.write('.kimi-code/config.toml', '# user comment\nmodel = "test"\n\n[[hooks]]\nevent = "Stop"\ncommand = "echo user"\n');
    const original = Object.fromEntries(['AGENTS.md', 'CLAUDE.md', '.gitignore', '.claude/settings.json', '.codex/hooks.json', '.kimi-code/config.toml'].map(p => [p, fs.readFileSync(path.join(f.root, p), 'utf8')]));
    const options = { project: f.root, host, ...(host === 'kimi' ? { 'kimi-config': path.join(f.root, '.kimi-code/config.toml') } : {}) };
    install(options); const first = fs.readFileSync(path.join(f.root, host === 'claude' ? 'CLAUDE.md' : 'AGENTS.md'), 'utf8');
    install(options); assert.equal(fs.readFileSync(path.join(f.root, host === 'claude' ? 'CLAUDE.md' : 'AGENTS.md'), 'utf8'), first);
    assert.equal(doctor(loadProject(f.root), { host }).ok, true);
    assert.equal(doctor(loadProject(f.root), { host, 'require-active': 'true' }).ok, false);
    uninstall({ project: f.root, host });
    for (const [p, text] of Object.entries(original)) assert.equal(fs.readFileSync(path.join(f.root, p), 'utf8'), text, p);
    assert.equal(fs.existsSync(path.join(f.root, '.sdd/tasks/FD-001.json')), true);
  });
}

test('conflicting skill aborts before any hook/instruction changes', t => {
  const f = fixture(t); f.write('.agents/skills/sdd-write-ac/SKILL.md', 'my custom skill');
  assert.throws(() => install({ project: f.root, host: 'codex' }), /conflict/);
  assert.equal(fs.existsSync(path.join(f.root, '.codex/hooks.json')), false);
  assert.equal(fs.existsSync(path.join(f.root, '.sdd/framework/runtime/project.mjs')), false);
});

test('modified managed files are protected on upgrade and retained on uninstall', t => {
  const f = fixture(t); install({ project: f.root, host: 'codex' });
  const changed = '.agents/skills/sdd-write-ac/SKILL.md'; f.write(changed, 'user revised skill');
  assert.throws(() => install({ project: f.root, host: 'codex' }), /conflict/);
  assert.ok(uninstall({ project: f.root, host: 'codex' }).preserved.includes(changed));
  assert.equal(fs.readFileSync(path.join(f.root, changed), 'utf8'), 'user revised skill');
});

test('shared installation survives uninstalling one host; OpenCode versions cannot coexist', t => {
  const f = fixture(t); install({ project: f.root, host: 'claude' }); install({ project: f.root, host: 'codex' });
  uninstall({ project: f.root, host: 'claude' }); assert.equal(doctor(loadProject(f.root), { host: 'codex' }).ok, true);
  install({ project: f.root, host: 'opencode-v1' });
  assert.throws(() => install({ project: f.root, host: 'opencode-v2' }), /major-version/);
});

test('Kimi default produces a fragment and reports configuration pending', t => {
  const f = fixture(t); const result = install({ project: f.root, host: 'kimi' });
  assert.equal(result.pending.length, 1); assert.equal(doctor(loadProject(f.root), { host: 'kimi' }).ok, false);
});

test('installed OpenCode entrypoints load their bundled runtime', async t => {
  for (const host of ['opencode-v1', 'opencode-v2']) {
    const f = fixture(t); install({ project: f.root, host });
    const relative = readJson(path.join(f.root, '.sdd/install-manifest.json')).hosts[host].file;
    const entry = await import(pathToFileURL(path.join(f.root, relative)).href);
    if (host === 'opencode-v1') assert.equal(typeof (await entry.OpenSDD({ directory: f.root }))['tool.execute.before'], 'function');
    else assert.equal(typeof entry.default.setup, 'function');
  }
});

test('malformed integration blocks and unsafe shell paths fail clearly', () => {
  assert.throws(() => managedBlock('<!-- opensdd:begin -->broken', 'new'), /Malformed/);
  assert.throws(() => commandPath('C:/bad$path'), /safely/);
  assert.equal(commandPath('C:/中文 空格/project'), '"C:/中文 空格/project"');
});

test('fresh repeated install removes only newly created files on uninstall', t => {
  const f = fixture(t); const options = { project: f.root, host: 'codex' };
  install(options); install(options); uninstall(options);
  assert.equal(fs.existsSync(path.join(f.root, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(f.root, '.codex/hooks.json')), false);
  assert.equal(fs.existsSync(path.join(f.root, '.sdd/config.json')), true);
});

test('existing identical skill is retained, later user instruction additions survive uninstall', t => {
  const f = fixture(t);
  f.write('.agents/skills/sdd-write-ac/SKILL.md', fs.readFileSync(new URL('../skills/sdd-write-ac/SKILL.md', import.meta.url), 'utf8'));
  const options = { project: f.root, host: 'codex' }; install(options);
  fs.appendFileSync(path.join(f.root, 'AGENTS.md'), '\nUser added requirement\n');
  uninstall(options);
  assert.equal(fs.existsSync(path.join(f.root, '.agents/skills/sdd-write-ac/SKILL.md')), true);
  assert.match(fs.readFileSync(path.join(f.root, 'AGENTS.md'), 'utf8'), /User added requirement/);
});

test('doctor retains both deny and allow receipts and reports observed behavior', t => {
  const f = fixture(t); install({ project: f.root, host: 'codex' });
  const payload = { hook_event_name: 'PreToolUse', session_id: 's1', cwd: f.root, tool_name: 'Edit', tool_input: { file_path: 'src/user.mjs' } };
  handleHook('codex', f.root, payload); f.ready(); handleHook('codex', f.root, payload);
  assert.equal(doctor(loadProject(f.root), { host: 'codex', 'require-active': 'true' }).ok, true);
});

test('known V4 Claude hooks are migrated while unrelated hooks survive; uninstall restores original', t => {
  const f = fixture(t);
  const original = JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: `bash ${f.root.replaceAll('\\', '/')}/.claude/hooks/spec-first-guard.sh` }] }, { matcher: 'Read', hooks: [{ type: 'command', command: 'user-hook' }] }] } });
  f.write('.claude/settings.json', original);
  const options = { project: f.root, host: 'claude' }; install(options);
  const current = fs.readFileSync(path.join(f.root, '.claude/settings.json'), 'utf8');
  assert.doesNotMatch(current, /spec-first-guard.sh/); assert.match(current, /user-hook/);
  uninstall(options); assert.equal(fs.readFileSync(path.join(f.root, '.claude/settings.json'), 'utf8'), original);
});

test('installation rolls back earlier writes after a late write failure', t => {
  const f = fixture(t); f.write('AGENTS.md', '# Preserve me\n');
  const original = fs.writeFileSync;
  let injected = false;
  t.mock.method(fs, 'writeFileSync', function(file, ...args) {
    if (!injected && String(file).replaceAll('\\', '/').endsWith('/.codex/hooks.json')) { injected = true; throw new Error('Simulated disk failure'); }
    return original.call(fs, file, ...args);
  });
  assert.throws(() => install({ project: f.root, host: 'codex' }), /disk failure/);
  assert.equal(fs.readFileSync(path.join(f.root, 'AGENTS.md'), 'utf8'), '# Preserve me\n');
  assert.equal(fs.existsSync(path.join(f.root, '.sdd/framework/runtime/project.mjs')), false);
  assert.equal(fs.existsSync(path.join(f.root, '.sdd/install.lock')), false);
});
