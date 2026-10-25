import { loadProject } from '../runtime/project.mjs';
import { onEvent } from '../runtime/guard.mjs';

export function createV1(context, root) {
  function run(input, output, phase) {
    if (typeof input.sessionID !== 'string' || !input.sessionID) throw new Error('openSDD: missing OpenCode V1 sessionID');
    const result = onEvent(loadProject(root), {
      host: 'opencode-v1', session: input.sessionID, phase,
      cwd: context.directory ?? root, tool: input.tool, input: output.args ?? input.args
    });
    if (!result.allow) throw new Error(`[openSDD session ${input.sessionID}] ${result.reason}`);
    return result;
  }
  return {
    'tool.execute.before': async (input, output) => run(input, output, 'before'),
    'tool.execute.after': async (input, output) => run(input, output, 'after')
  };
}

export const OpenSDD = async context => createV1(context, context.worktree || context.directory);
