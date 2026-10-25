import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readJson, localPath, hash } from './project.mjs';

export function doctor(project, options = {}) {
  const file = localPath(project.root, '.sdd/install-manifest.json').absolute;
  if (!fs.existsSync(file)) return { ok: false, error: 'No install manifest; run install for the desired host' };
  const manifest = readJson(file);
  const hosts = options.host ? [options.host] : Object.keys(manifest.hosts);
  const receiptsDir = localPath(project.root, '.sdd/state/receipts').absolute;
  const receipts = fs.existsSync(receiptsDir) ? fs.readdirSync(receiptsDir).filter(f => f.endsWith('.json')).map(f => readJson(path.join(receiptsDir, f))) : [];
  const results = hosts.map(host => {
    const registration = manifest.hosts[host];
    if (!registration) return { host, configured: false, observed: false, problems: ['Host not installed'] };
    const problems = [];
    if (!fs.existsSync(path.resolve(project.root, project.config.frameworkDir, 'rules/core.md'))) problems.push('frameworkDir does not resolve to core rules');
    for (const [relative, info] of Object.entries(manifest.files)) {
      if (!info.owners.includes(host) && !info.shared) continue;
      if (relative === '.sdd/config.json') continue; // Project configuration is intentionally editable.
      const full = localPath(project.root, relative).absolute;
      if (!fs.existsSync(full) || hash(fs.readFileSync(full)) !== info.hash) problems.push(`Missing/changed managed file: ${relative}`);
    }
    for (const [relative, info] of Object.entries(manifest.blocks)) if (info.owners.includes(host)) {
      const full = localPath(project.root, relative).absolute;
      if (!fs.existsSync(full) || !fs.readFileSync(full, 'utf8').includes(info.block)) problems.push(`Instruction/integration block missing: ${relative}`);
    }
    if (registration.type === 'fragment') problems.push('Kimi fragment not registered in an explicit config target');
    if (registration.type === 'json-hooks') {
      try {
        const actual = readJson(localPath(project.root, registration.file).absolute);
        for (const [event, entries] of Object.entries(registration.entries)) for (const entry of entries) {
          if (!Array.isArray(actual.hooks?.[event]) || !actual.hooks[event].some(item => isDeepStrictEqual(item, entry))) problems.push(`Hook registration missing: ${event}`);
        }
      } catch (error) { problems.push(`Cannot read hook registration: ${error.message}`); }
    }
    if (registration.type === 'toml-hooks' && (!fs.existsSync(registration.file) || !fs.readFileSync(registration.file, 'utf8').includes(registration.block))) problems.push('Kimi hook block missing');
    const recent = receipts.filter(r => r.host === host && r.at >= registration.installedAt);
    const observed = recent.some(r => r.phase === 'before' && r.result?.allow === false) && recent.some(r => r.phase === 'before' && r.result?.task && r.result?.allow === true);
    return { host, configured: problems.length === 0, observed, problems, note: observed ? 'Observed deny and prepared-task allow events since installation; receipts are local evidence, not an independent host trust attestation.' : 'Actual-host smoke pending: verify host version, enable/trust hooks, then exercise deny and allow.' };
  });
  return { ok: results.every(r => r.configured && (options['require-active'] !== 'true' || r.observed)), protocolSelfTest: 'Not run by doctor; framework fixture tests are separate from actual-host smoke.', hosts: results };
}
