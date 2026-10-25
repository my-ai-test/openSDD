import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const problems = [];
const assert = (value, message) => { if (!value) problems.push(message); };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const skills = fs.readdirSync(path.join(root, 'skills'));
assert(skills.length === 7, 'Expected seven maintained workflows');
for (const name of skills) {
  const file = `skills/${name}/SKILL.md`, text = read(file);
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  assert(front, `Missing frontmatter: ${file}`);
  if (front) {
    assert(new RegExp(`^name: ${name}$`, 'm').test(front[1]), `Skill identity mismatch: ${file}`);
    assert(/^description: .+/m.test(front[1]), `Missing description: ${file}`);
    assert(!/^(user-invocable|argument-hint|version):/m.test(front[1]), `Host-specific frontmatter: ${file}`);
  }
  assert(text.includes('.sdd/config.json'), `Missing project context routing: ${file}`);
  assert(!/API_SPEC(?:\.md)? §9|DDD_SPEC(?:\.md)? §9|第一个工具调用|首个 Edit|\.claude\/|npx jest/.test(text), `Stale host/ordering contract: ${file}`);
  assert(!/\?{3,}|\uFFFD/.test(text), `Corrupted encoding: ${file}`);
  for (const match of text.matchAll(/\{FRAMEWORK_DIR\}\/([A-Za-z0-9_./-]+\.md)/g)) assert(fs.existsSync(path.join(root, match[1])), `Missing referenced asset: ${match[1]}`);
}
for (const file of ['rules/core.md', 'docs/runtime.md', 'docs/hosts.md', 'docs/migration.md', 'profiles/ddd.md', 'profiles/enterprise.md', 'profiles/typescript-jest.md']) assert(fs.existsSync(path.join(root, file)), `Missing shared resource: ${file}`);
for (const name of fs.readdirSync(path.join(root, 'templates/spec'))) {
  const text = read(`templates/spec/${name}`);
  if (text.startsWith('---')) {
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    assert(front && !/^>/m.test(front[1]), `Invalid template frontmatter: ${name}`);
  }
}
assert(read('templates/spec/L1-API_SPEC.md').includes('## 3. 已实现端点详细契约'), 'API contract anchor missing');
assert(read('rules/core.md').includes('L1-BC_SPEC.md'), 'BC workflow must use the dedicated template');
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`Repository contracts passed: ${skills.length} skills, templates, profiles and documentation.`);
