import path from 'node:path';
import { loadProject } from '../runtime/project.mjs';
import { onEvent } from '../runtime/guard.mjs';

// Structural Promise plugin definition: no runtime dependency on the SDK.
// Contract checked against @opencode/plugin and @opencode/schema 2.1.4.
export function createV2(root) {
  return {
    id: 'opensdd.spec-first',
    async setup(context) {
      async function run(event, phase) {
        if (typeof event.sessionID !== 'string' || !event.sessionID) throw new Error('openSDD: missing OpenCode V2 sessionID');
        const session = await context.session.get({ sessionID: event.sessionID });
        const cwd = session.location?.directory;
        if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) throw new Error('openSDD: unrecognized V2 session location');
        const relative = path.relative(path.resolve(root), cwd);
        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return;
        const result = onEvent(loadProject(root), { host: 'opencode-v2', session: event.sessionID, cwd, phase, tool: event.tool, input: event.input, success: event.status === 'completed' });
        if (!result.allow) throw new Error(`[openSDD session ${event.sessionID}] ${result.reason}`);
      }
      await context.tool.hook('execute.before', event => run(event, 'before'));
      await context.tool.hook('execute.after', event => run(event, event.status === 'error' ? 'failure' : 'after'));
    }
  };
}
