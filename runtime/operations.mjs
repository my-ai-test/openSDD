// Normalize documented host inputs; never treat an unreadable write as a read.
const FILE_TOOLS = new Set(['edit', 'write', 'multiedit', 'writefile', 'strreplacefile', 'deletefile', 'movefile']);
const READ_TOOLS = new Set(['read', 'readfile', 'grep', 'glob', 'list', 'ls', 'readmediafile', 'skill', 'updateskills', 'update_plan', 'todowrite', 'askuserquestion']);
export function parsePatch(patch) {
  if (typeof patch === 'string') patch = patch.replaceAll('\r\n', '\n');
  if (typeof patch !== 'string' || !patch.startsWith('*** Begin Patch\n') || !patch.trimEnd().endsWith('*** End Patch')) throw new Error('Unrecognized patch format');
  const operations = [];
  let active = null;
  for (const line of patch.replaceAll('\r\n', '\n').split('\n')) {
    const match = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (match) {
      active = { kind: { Add: 'create', Update: 'modify', Delete: 'delete' }[match[1]], path: match[2] };
      operations.push(active);
    } else if (line.startsWith('*** Move to: ')) {
      if (!active || active.kind !== 'modify') throw new Error('Invalid patch move');
      active.kind = 'delete';
      operations.push({ kind: 'create', path: line.slice(13) });
    }
  }
  if (!operations.length) throw new Error('Patch contains no file operations');
  return operations;
}

export function normalizeTool(tool, input) {
  const name = String(tool || '').toLowerCase();
  if (['apply_patch', 'applypatch', 'patch'].includes(name)) {
    return { operations: parsePatch(typeof input === 'string' ? input : input?.command ?? input?.patchText ?? input?.patch), unknown: false };
  }
  if (FILE_TOOLS.has(name)) {
    const inputs = Array.isArray(input?.edits) && !input.file_path && !input.filePath && !input.path ? input.edits : [input];
    if (!inputs.length) throw new Error('Write has no targets');
    const operations = inputs.flatMap(item => {
      const target = item?.file_path ?? item?.filePath ?? item?.path;
      if (typeof target !== 'string' || !target.trim()) throw new Error(`Missing path for ${tool}`);
      if (name === 'movefile') {
        const destination = item.destination ?? item.new_path ?? item.newPath;
        if (typeof destination !== 'string') throw new Error('Missing move destination');
        return [{ kind: 'delete', path: target }, { kind: 'create', path: destination }];
      }
      return [{ kind: name === 'deletefile' ? 'delete' : name.startsWith('write') ? 'create' : 'modify', path: target }];
    });
    return { operations, unknown: false };
  }
  return { operations: [], unknown: !READ_TOOLS.has(name) };
}
