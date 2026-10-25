import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { DEFAULT_CONFIG, HOSTS, hash, readJson, localPath } from './project.mjs';

export const FRAMEWORK_ROOT = fileURLToPath(new URL('../', import.meta.url));
const BEGIN = '<!-- opensdd:begin -->';
const END = '<!-- opensdd:end -->';
const TOML_BEGIN = '# opensdd:begin';
const TOML_END = '# opensdd:end';
const json = value => JSON.stringify(value, null, 2) + '\n';

function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; }
function walk(dir) {
  return fs.readdirSync(dir).sort().flatMap(name => {
    const file = path.join(dir, name);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Cannot bundle symlink: ${file}`);
    return fs.statSync(file).isDirectory() ? walk(file) : [file];
  });
}

// These commands are interpreted by several shells. Refuse metacharacters
// whose quoting differs across cmd.exe, PowerShell and POSIX shells.
export function commandPath(value) {
  if (/["'`$%!\r\n\0]/.test(value)) throw new Error(`Path cannot be safely represented in all hook shells: ${value}`);
  return `"${value.replaceAll('\\', '/')}"`;
}

export function hookEntries(host, root) {
  const command = `${commandPath(process.execPath)} ${commandPath(path.join(root, '.sdd/framework/adapters/hooks.mjs'))} ${host} ${commandPath(root)}`;
  return Object.fromEntries(['SessionStart', 'PreToolUse', 'PostToolUse'].map(event => [event, [{ matcher: '.*', hooks: [{ type: 'command', command }] }]]));
}

function equal(a, b) { return isDeepStrictEqual(a, b); }
function equivalentConfig(a, b) {
  return equal(JSON.parse(mergeHooks(a, {}, {}, true)), JSON.parse(mergeHooks(b, {}, {}, true)));
}
export function mergeHooks(text, oldEntries, entries, remove = false) {
  const config = text === null ? {} : JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Hook configuration must be an object');
  config.hooks ??= {};
  if (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks)) throw new Error('Invalid hooks object');
  for (const [event, previous] of Object.entries(oldEntries ?? {})) {
    const list = config.hooks[event] ?? [];
    if (!Array.isArray(list)) throw new Error(`Invalid hook list: ${event}`);
    if (!remove && previous.some(entry => !list.some(item => equal(item, entry)))) throw new Error(`Managed hook changed: ${event}; review before upgrading`);
    config.hooks[event] = list.filter(item => !previous.some(entry => equal(item, entry)));
  }
  if (!remove) for (const [event, additions] of Object.entries(entries)) {
    const list = config.hooks[event] ?? [];
    if (!Array.isArray(list)) throw new Error(`Invalid hook list: ${event}`);
    for (const entry of additions) if (!list.some(item => equal(item, entry))) list.push(entry);
    config.hooks[event] = list;
  }
  for (const [event, list] of Object.entries(config.hooks)) if (Array.isArray(list) && !list.length) delete config.hooks[event];
  if (!Object.keys(config.hooks).length) delete config.hooks;
  return json(config);
}

export function managedBlock(text, body, markers = [BEGIN, END], oldBody) {
  const [begin, end] = markers;
  const original = text ?? '';
  const start = original.indexOf(begin), finish = original.indexOf(end);
  if ((start < 0) !== (finish < 0) || (start >= 0 && (finish < start || original.indexOf(begin, start + begin.length) >= 0 || original.indexOf(end, finish + end.length) >= 0))) throw new Error('Malformed/duplicate openSDD integration block');
  if (start >= 0 && oldBody === undefined) throw new Error('Unowned openSDD integration block');
  const previous = start >= 0 ? original.slice(start, finish + end.length) : null;
  if (oldBody !== undefined && previous !== oldBody) throw new Error('Managed integration block was modified');
  const replacement = body === null ? '' : `${begin}\n${body.trim()}\n${end}`;
  if (start >= 0) return { text: original.slice(0, start) + replacement + original.slice(finish + end.length), block: replacement };
  return { text: original + (original && !original.endsWith('\n') ? '\n' : '') + (original ? '\n' : '') + replacement + '\n', block: replacement };
}

function tomlBoundary(text) {
  // A fragment is appended only at a complete TOML lexical boundary. This
  // preserves comments/formatting; it is not a replacement TOML parser.
  let quote = null, multiline = false, brackets = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (quote === '"' && c === '\\') { i++; continue; }
      if (multiline && text.slice(i, i + 3) === quote.repeat(3)) { quote = null; multiline = false; i += 2; }
      else if (!multiline && c === quote) quote = null;
      else if (!multiline && c === '\n') throw new Error('Invalid TOML string');
    } else if (c === '#') { while (i < text.length && text[i] !== '\n') i++; }
    else if (c === '"' || c === "'") { quote = c; multiline = text.slice(i, i + 3) === c.repeat(3); if (multiline) i += 2; }
    else if (c === '[' || c === '{') brackets++;
    else if (c === ']' || c === '}') brackets--;
  }
  if (quote || brackets !== 0) throw new Error('Incomplete TOML configuration; cannot append hooks');
}

function transaction(changes) {
  const completed = [];
  try {
    for (const [file, content] of changes) {
      const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
      completed.push([file, before]);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (content === null) { if (before !== null) fs.unlinkSync(file); }
      else fs.writeFileSync(file, content);
    }
  } catch (error) {
    for (const [file, before] of completed.reverse()) {
      if (before === null) { if (fs.existsSync(file)) fs.unlinkSync(file); } else fs.writeFileSync(file, before);
    }
    throw error;
  }
}

function environment(options) {
  if (!options.project) throw new Error('An explicit --project is required for installation/uninstallation');
  const root = fs.realpathSync(path.resolve(options.project));
  if (!HOSTS.includes(options.host)) throw new Error(`--host must be one of ${HOSTS.join(', ')}`);
  const manifestFile = localPath(root, '.sdd/install-manifest.json').absolute;
  const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : { schemaVersion: 1, files: {}, hosts: {}, blocks: {} };
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported install manifest');
  return { root, host: options.host, manifestFile, manifest };
}

function installUnlocked(options) {
  const { root, host, manifestFile, manifest } = environment(options);
  if (host.startsWith('opencode') && Object.keys(manifest.hosts).some(h => h.startsWith('opencode') && h !== host)) throw new Error('Uninstall the other OpenCode major-version adapter first');
  const changes = new Map();
  const pending = [];
  const put = (relative, content, shared = false) => {
    const file = localPath(root, relative).absolute;
    const current = read(file), previous = manifest.files[relative];
    if (current !== null && current !== content && (!previous || hash(current) !== previous.hash)) throw new Error(`File conflict; left unchanged: ${relative}`);
    changes.set(file, content);
    manifest.files[relative] = { hash: hash(content), shared, original: previous ? previous.original : current, owners: [...new Set([...(previous?.owners ?? []), host])] };
  };

  for (const dir of ['runtime', 'adapters', 'rules', 'profiles', 'standards', 'templates', 'skills', 'docs']) {
    const source = path.join(FRAMEWORK_ROOT, dir);
    if (!fs.existsSync(source)) continue;
    for (const file of walk(source)) put(`.sdd/framework/${path.relative(FRAMEWORK_ROOT, file).split(path.sep).join('/')}`, fs.readFileSync(file, 'utf8'), true);
  }
  const configPath = localPath(root, '.sdd/config.json').absolute;
  if (!fs.existsSync(configPath)) put('.sdd/config.json', json({ ...DEFAULT_CONFIG, frameworkDir: '.sdd/framework' }), true);
  for (const skill of fs.readdirSync(path.join(FRAMEWORK_ROOT, 'skills'))) {
    const source = path.join(FRAMEWORK_ROOT, 'skills', skill);
    const destination = host === 'claude' ? '.claude/skills' : '.agents/skills';
    for (const file of walk(source)) put(`${destination}/${skill}/${path.relative(source, file).split(path.sep).join('/')}`, fs.readFileSync(file, 'utf8'), host !== 'claude');
  }

  const instruction = host === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
  const instructionPath = localPath(root, instruction).absolute;
  const previousBlock = manifest.blocks[instruction];
  const body = 'Read .sdd/config.json, then read rules/core.md under its frameworkDir before development. Follow docs/runtime.md for task evidence/session binding and docs/hosts.md for the selected host. Read-only investigation is allowed before specification preparation.';
  const block = managedBlock(read(instructionPath), body, [BEGIN, END], previousBlock?.block);
  changes.set(instructionPath, block.text);
  manifest.blocks[instruction] = { block: block.block, original: previousBlock ? previousBlock.original : read(instructionPath), owners: [...new Set([...(previousBlock?.owners ?? []), host])] };
  const ignorePath = localPath(root, '.gitignore').absolute;
  const oldIgnore = manifest.blocks['.gitignore'];
  const ignore = managedBlock(read(ignorePath), '.sdd/state/\n.sdd/install-manifest.json\n.sdd/framework/\n.sdd/install.lock/\n.sdd/kimi-hooks.toml\n.claude/settings.json\n.codex/hooks.json', ['# opensdd:begin', '# opensdd:end'], oldIgnore?.block);
  changes.set(ignorePath, ignore.text);
  manifest.blocks['.gitignore'] = { block: ignore.block, original: oldIgnore ? oldIgnore.original : read(ignorePath), owners: [...new Set([...(oldIgnore?.owners ?? []), host])] };

  let registration;
  if (['claude', 'codex'].includes(host)) {
    const relative = host === 'claude' ? '.claude/settings.json' : '.codex/hooks.json';
    const file = localPath(root, relative).absolute;
    const entries = hookEntries(host, root);
    const current = read(file);
    let base = current;
    if (host === 'claude' && !manifest.hosts[host] && current !== null) {
      const parsed = JSON.parse(current.replace(/^\uFEFF/, ''));
      const legacy = ['session-reset.sh', 'spec-first-guard.sh', 'spec-touched-marker.sh'].map(name => `bash ${root.replaceAll('\\', '/')}/.claude/hooks/${name}`);
      for (const [event, groups] of Object.entries(parsed.hooks ?? {})) {
        if (!Array.isArray(groups)) throw new Error(`Invalid hook list: ${event}`);
        parsed.hooks[event] = groups.map(group => ({ ...group, hooks: group.hooks?.filter(hook => !legacy.includes(hook.command)) })).filter(group => !Array.isArray(group.hooks) || group.hooks.length);
      }
      base = json(parsed);
    }
    changes.set(file, mergeHooks(base, manifest.hosts[host]?.entries, entries));
    const old = manifest.hosts[host];
    registration = { type: 'json-hooks', file: relative, entries, original: old ? old.original : current, base: old ? old.base : base };
  } else if (host === 'kimi') {
    const entries = hookEntries(host, root);
    const body = Object.entries(entries).map(([event, groups]) => `[[hooks]]\nevent = ${JSON.stringify(event)}\nmatcher = ".*"\ncommand = ${JSON.stringify(groups[0].hooks[0].command)}\ntimeout = 10`).join('\n\n');
    if (options['kimi-config']) {
      const file = path.resolve(options['kimi-config']);
      const old = manifest.hosts[host];
      if (old?.file && old.file !== file) throw new Error('Uninstall Kimi before changing its configuration target');
      const current = read(file); tomlBoundary(current ?? '');
      const markers = old?.markers ?? [`# opensdd:${hash(root).slice(0, 16)}:begin`, `# opensdd:${hash(root).slice(0, 16)}:end`];
      const merged = managedBlock(current, body, markers, old?.block);
      changes.set(file, merged.text);
      registration = { type: 'toml-hooks', file, block: merged.block, markers, original: old ? old.original : current };
    } else {
      if (manifest.hosts[host]?.type === 'toml-hooks') throw new Error('Pass the existing --kimi-config target when upgrading Kimi');
      put('.sdd/kimi-hooks.toml', `${TOML_BEGIN}\n${body}\n${TOML_END}\n`);
      registration = { type: 'fragment', file: '.sdd/kimi-hooks.toml' };
      pending.push('Kimi: merge the generated fragment into the selected config.toml, or reinstall with explicit --kimi-config PATH');
    }
  } else {
    const isV1 = host === 'opencode-v1';
    const relative = isV1 ? '.opencode/plugins/opensdd.js' : '.opencode/plugins/opensdd/index.js';
    const prefix = isV1 ? '../..' : '../../..';
    const content = `import { fileURLToPath } from 'node:url';\nimport { ${isV1 ? 'createV1' : 'createV2'} } from '${prefix}/.sdd/framework/adapters/${host}.mjs';\nconst root = fileURLToPath(new URL('${prefix}/', import.meta.url));\n${isV1 ? 'export const OpenSDD = async context => createV1(context, root);' : 'export default createV2(root);'}\n`;
    put(relative, content); registration = { type: 'plugin', file: relative };
  }
  manifest.hosts[host] = { ...registration, installedAt: new Date().toISOString() };
  changes.set(manifestFile, json(manifest));
  transaction(changes);
  return { ok: true, host, project: root, files: changes.size, pending, activation: 'Run doctor and an actual host smoke test; generated configuration alone is not activation.' };
}

function uninstallUnlocked(options) {
  const { root, host, manifestFile, manifest } = environment(options);
  const registration = manifest.hosts[host];
  if (!registration) throw new Error(`Host is not installed: ${host}`);
  const changes = new Map(), preserved = [];
  const remainingHosts = Object.keys(manifest.hosts).filter(h => h !== host);
  if (registration.type === 'json-hooks') {
    const file = localPath(root, registration.file).absolute;
    const current = read(file);
    if (current !== null) {
      const actual = JSON.parse(current.replace(/^\uFEFF/, ''));
      for (const [event, entries] of Object.entries(registration.entries)) {
        if (entries.some(entry => !(actual.hooks?.[event] ?? []).some(item => equal(item, entry)))) throw new Error(`Managed hook changed: ${event}; reconcile the registration before uninstalling`);
      }
      const cleaned = mergeHooks(current, registration.entries, {}, true);
      if (registration.original !== null && equivalentConfig(cleaned, registration.base ?? registration.original)) changes.set(file, registration.original);
      else if (registration.original === null && equal(JSON.parse(cleaned), {})) changes.set(file, null);
      else changes.set(file, cleaned);
    }
  } else if (registration.type === 'toml-hooks') {
    const current = read(registration.file);
    const cleaned = managedBlock(current, null, registration.markers ?? [TOML_BEGIN, TOML_END], registration.block).text;
    changes.set(registration.file, cleaned.trim() === (registration.original ?? '').trim() ? registration.original : cleaned);
  }
  for (const [relative, info] of Object.entries(manifest.blocks)) {
    info.owners = info.owners.filter(h => h !== host);
    if (info.owners.length) continue;
    const file = localPath(root, relative).absolute;
    try {
      const markers = relative === '.gitignore' ? ['# opensdd:begin', '# opensdd:end'] : [BEGIN, END];
      const cleaned = managedBlock(read(file), null, markers, info.block).text;
      changes.set(file, cleaned.trim() === (info.original ?? '').trim() ? info.original : cleaned);
    } catch { preserved.push(relative); }
    delete manifest.blocks[relative];
  }
  for (const [relative, info] of Object.entries(manifest.files)) {
    info.owners = info.owners.filter(h => h !== host);
    if (info.owners.length || (info.shared && remainingHosts.length)) continue;
    const file = localPath(root, relative).absolute, current = read(file);
    if (current !== null && hash(current) === info.hash) changes.set(file, info.original ?? null);
    else if (current !== null) preserved.push(relative);
    delete manifest.files[relative];
  }
  delete manifest.hosts[host];
  changes.set(manifestFile, remainingHosts.length ? json(manifest) : null);
  transaction(changes);
  return { ok: true, removed: host, preserved };
}

function locked(options, operation) {
  if (!options.project) throw new Error('An explicit --project is required');
  const root = fs.realpathSync(path.resolve(options.project));
  const lock = localPath(root, '.sdd/install.lock').absolute;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try { fs.mkdirSync(lock); } catch (error) { if (error.code === 'EEXIST') throw new Error('Another installation is running, or install.lock needs manual recovery'); throw error; }
  try { return operation(options); } finally { fs.rmdirSync(lock); }
}
export const install = options => locked(options, installUnlocked);
export const uninstall = options => locked(options, uninstallUnlocked);
