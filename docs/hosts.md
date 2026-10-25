# Host adapters

Protocol references checked on 2026-10-25. No paid model calls are required by the framework tests.

| Host | Rule/skill entry | Guard registration |
|---|---|---|
| Claude Code | CLAUDE.md; .claude/skills | .claude/settings.json |
| Codex | AGENTS.md; .agents/skills | .codex/hooks.json |
| Kimi Code | AGENTS.md; .agents/skills | Explicit config.toml [[hooks]] or generated fragment |
| OpenCode V1 | AGENTS.md; .agents/skills | .opencode/plugins/opensdd.js |
| OpenCode V2 | AGENTS.md; .agents/skills | .opencode/plugins/opensdd/index.js |

## Installation

From the framework checkout, always supply an existing consumer directory:

```text
node runtime/cli.mjs install --project /path/to/project --host codex
node runtime/cli.mjs install --project /path/to/project --host claude
node runtime/cli.mjs install --project /path/to/project --host kimi --kimi-config /chosen/config.toml
node runtime/cli.mjs install --project /path/to/project --host opencode-v2
```

Bash: `bash install.sh /path/to/project codex`.
PowerShell: `.\install.ps1 -ProjectRoot C:\project -HostName codex`.

Kimi without `--kimi-config` creates `.sdd/kimi-hooks.toml` and explicitly reports pending configuration. Merge it into the selected Kimi config or rerun installation with that explicit target. It never silently edits the user's global file. The hook filters events to its configured project. A moved checkout must be reinstalled.

Installation copies the runtime/assets under `.sdd/framework`, installs the seven skills, and appends a marked instruction block while preserving existing prose. It merges only its own JSON hooks or TOML block. Conflicts in managed files stop the upgrade before writing. The installation manifest tracks ownership and original content. Keep it local for upgrades/uninstallation. Hooks contain machine-specific executable/project paths.

```text
node runtime/cli.mjs uninstall --project /path/to/project --host codex
```

Uninstallation removes owned, unchanged content and retains user-modified files. Edited hook registrations stop uninstall before deleting their referenced runtime; reconcile those entries first. Other installed hosts retain shared resources. Multiple projects can register separate marked blocks in the same Kimi config. OpenCode V1 and V2 adapters cannot coexist in the same project; uninstall the old version before installing the other.

## Invocation and protocol contracts

- Claude: use `/sdd-implement-feature`.
- Codex CLI/IDE: `$sdd-implement-feature` or `/skills`. Review/trust hooks using the host's hook UI; the installer never bypasses trust.
- Kimi: `/skill:sdd-implement-feature`. Avoid adding recursive skill levels to its three-level nesting limit.
- OpenCode: ask to load the named skill; configure a custom command separately if desired. V2 has no CLAUDE.md fallback.
- All hosts: skill text is a workflow, not a shell command or an automatic subagent instruction.

Claude/Codex/Kimi adapters consume stdin events with session_id/cwd. Codex apply_patch uses tool_input.command; all files in that patch are classified. OpenCode V1 uses tool.execute.before/after; V2 uses tool.hook execute.before/after and resolves the session's location, not the plugin instance's location. V2 field contracts were inspected in published @opencode/plugin and @opencode/schema 2.1.4. Tests use documented fixtures, not production-captured sessions. Unknown schema/tool variants are not advertised as covered.

## Real-host smoke checklist

Run `doctor --project PATH --host HOST` for static installation checks. Then, in a fresh actual host session:

1. Attempt a small edit to a configured code file without a task: expect denial.
2. Prepare a real task, bind the reported session ID, retry a scoped edit: expect allow.
3. Change the referenced spec, retry code: expect denial until prepare/bind.
4. Open a second session: expect its independent denial.
5. Run `doctor --project PATH --host HOST --require-active true`.

Doctor requires both deny and prepared-task allow receipts since installation for observed status. Local receipts are evidence of adapter invocation, not independent proof of host trust or semantic quality. Missing hosts, disabled plugins and untrusted hooks must remain explicitly pending. Static checks and fixture replay do not count as a real-host smoke.

## Official references

- [Claude hooks](https://code.claude.com/docs/en/hooks)
- [Codex hooks](https://learn.chatgpt.com/docs/hooks) and [skills](https://learn.chatgpt.com/docs/build-skills)
- [Kimi hooks](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html) and [skills](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html)
- [OpenCode V1 plugins](https://opencode.ai/docs/plugins/)
- [OpenCode V2 plugin migration](https://opencode.ai/v2/docs/build/plugins/migrate-v1) and [instructions](https://opencode.ai/v2/docs/instructions/)
