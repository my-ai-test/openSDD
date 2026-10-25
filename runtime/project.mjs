import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const HOSTS = ['claude', 'codex', 'kimi', 'opencode-v1', 'opencode-v2'];
export const DEFAULT_CONFIG = {
  schemaVersion: 1,
  frameworkDir: 'sdd-framework',
  codeDirs: ['src', 'apps', 'packages'],
  specDirs: ['SDD/01-specs'],
  testPatterns: ['(^|/)(tests?|__tests__)/', '\\.(test|spec)\\.[^/]+$', '(^|/)test_[^/]+\\.py$', '_test\\.go$'],
  profiles: [],
  testCommand: null,
  unknownTools: 'audit'
};

export const hash = value => createHash('sha256').update(value).digest('hex');
// Git normalizes text EOLs. Evidence must survive Windows checkout and CI.
export function contentHash(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  const text = bytes.toString('utf8');
  return hash(!bytes.includes(0) && Buffer.from(text, 'utf8').equals(bytes) ? text.replaceAll('\r\n', '\n') : bytes);
}
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function localPath(root, value, cwd = root) {
  if (typeof value !== 'string' || !value.trim() || /[\0\r\n]/.test(value)) throw new Error('Invalid file path');
  const clean = value.replaceAll('\\', '/');
  if (process.platform !== 'win32' && /^[A-Za-z]:/.test(clean)) throw new Error('Foreign Windows absolute path');
  const absolute = path.resolve(cwd, clean);
  const canonicalRoot = fs.realpathSync(root);
  if (!contained(root, absolute)) throw new Error(`Path outside project: ${value}`);
  let existing = absolute;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(`Cannot resolve path: ${value}`);
    existing = parent;
  }
  if (!contained(canonicalRoot, fs.realpathSync(existing))) throw new Error(`Symlink outside project: ${value}`);
  let segment = root;
  for (const part of path.relative(root, absolute).split(path.sep).filter(Boolean)) {
    segment = path.join(segment, part);
    let info;
    try { info = fs.lstatSync(segment); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (info?.isSymbolicLink()) throw new Error(`Symlink paths are not supported: ${value}`);
  }
  return { absolute, relative: path.relative(root, absolute).split(path.sep).join('/') };
}

export function relativeSetting(value) {
  if (typeof value !== 'string' || !value || value === '.' || /[\0\r\n]/.test(value) || path.isAbsolute(value) || /^[A-Za-z]:/.test(value)) throw new Error('Expected a project-relative path');
  const normalized = path.posix.normalize(value.replaceAll('\\', '/')).replace(/\/$/, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized === '.') throw new Error('Invalid relative path');
  return normalized;
}

export function findProject(cwd) {
  let current = path.resolve(cwd);
  while (true) {
    if (fs.existsSync(path.join(current, '.sdd/config.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function loadProject(root) {
  root = fs.realpathSync(path.resolve(root));
  const raw = readJson(path.join(root, '.sdd/config.json'));
  if (raw.schemaVersion !== 1) throw new Error('Unsupported SDD configuration version');
  const config = { ...DEFAULT_CONFIG, ...raw };
  for (const key of ['codeDirs', 'specDirs']) {
    if (!Array.isArray(config[key]) || !config[key].length) throw new Error(`Empty ${key}`);
    config[key] = config[key].map(relativeSetting);
    for (const value of config[key]) localPath(root, value);
  }
  if (!['audit', 'deny'].includes(config.unknownTools)) throw new Error('unknownTools must be audit or deny');
  if (!Array.isArray(config.profiles) || config.profiles.some(p => !['ddd', 'enterprise', 'typescript-jest'].includes(p))) throw new Error('Unknown profile');
  if (!Array.isArray(config.testPatterns) || config.testPatterns.some(p => typeof p !== 'string')) throw new Error('Invalid testPatterns');
  const testRegexes = config.testPatterns.map(p => new RegExp(p, process.platform === 'win32' ? 'i' : ''));
  if (typeof config.frameworkDir !== 'string' || !config.frameworkDir.trim()) throw new Error('Missing frameworkDir');
  if (config.testCommand !== null && (!config.testCommand || typeof config.testCommand.command !== 'string' || !config.testCommand.command.trim() || !Array.isArray(config.testCommand.args) || config.testCommand.args.some(a => typeof a !== 'string'))) throw new Error('testCommand must be {command, args} or null');
  return { root, config, testRegexes };
}

export const under = (file, dir) => {
  if (process.platform === 'win32') { file = file.toLowerCase(); dir = dir.toLowerCase(); }
  return file === dir || file.startsWith(`${dir}/`);
};
export function classify(project, file) {
  if (project.config.specDirs.some(dir => under(file, dir))) return 'spec';
  if (project.testRegexes.some(re => re.test(file))) return 'test';
  if (project.config.codeDirs.some(dir => under(file, dir))) return 'code';
  return 'other';
}

export function readText(project, file) {
  const { absolute } = localPath(project.root, file);
  const text = fs.readFileSync(absolute, 'utf8');
  if (!text.trim()) throw new Error(`Empty evidence file: ${file}`);
  return text;
}

export function listFiles(project, scope) {
  const { absolute, relative } = localPath(project.root, scope);
  if (!fs.existsSync(absolute)) return [relative];
  if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`Symlink scope is not supported: ${scope}`);
  if (!fs.statSync(absolute).isDirectory()) return [relative];
  return fs.readdirSync(absolute).sort().flatMap(name => {
    if (['.git', '.sdd', 'node_modules'].includes(name)) return [];
    return listFiles(project, `${relative}/${name}`);
  });
}
