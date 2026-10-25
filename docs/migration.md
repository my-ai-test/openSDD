# Migrating V4 to V5

## What changes

V4 distributed Claude-only instructions and used a project-wide .session-spec-touched marker. V5 keeps the seven workflows and templates, moves shared rules into rules/core.md, and uses task evidence plus isolated host/session bindings.

Old marker files no longer authorize writes. Mere specification edits never unlock code; prepare verifies referenced ACs and test design, then bind associates a task with the actual host session.

## Upgrade sequence

1. Save current project configuration in version control or a backup.
2. Run the V5 installer with an explicit project and host.
3. Inspect the integration block and configuration diff. Existing instructions remain in place; resolve contradictory V4 instructions in your project before activation. The installer only retires exactly recognized V4 Claude hook commands, preserving other hooks and the original config for uninstall.
4. Edit .sdd/config.json: actual code/spec directories, test patterns, profiles, executable test command. V4 SDD_* regex environment variables are not silently converted; use explicit directory lists.
5. Remove or reconcile old instructions requiring a first tool call to write, API_SPEC section 9, or the shared marker. For BC specs use L1-BC_SPEC.md. API contracts use their actual named section.
6. Create a task manifest and test design using docs/runtime.md, then complete the actual-host smoke in docs/hosts.md.
7. Run tests, verify, and validate. Commit project config and evidence; keep local state/absolute hook registration out of Git.

## Policy differences

- Read-only investigation precedes impact analysis; no fabricated BACKLOG checks.
- Existing correct ACs can support a Bug fix without a cosmetic spec change.
- Test scenarios are recorded before implementation; tests may later read signatures.
- DDD, Jest/NestJS/Prisma and enterprise conventions are opt-in profiles.
- Specs, code and tests are associated by task; one unrelated SDD file cannot unlock the project.
- Malformed recognized writes fail closed. Shell/MCP coverage is explicit audit or deny policy.
- Exception tasks remain visible; adoption metrics never count bypass as specification coverage.
- CI validates final changes, including specs committed earlier; it does not prove event chronology.

## Recovery

An interrupted install can leave .sdd/install.lock. Confirm no installer is running before removing that exact empty directory and retrying. Managed-file conflicts require reviewing and reconciling local changes; there is no force-overwrite switch. Retain the install manifest for ownership-aware uninstall.

If doctor shows configured but not observed, check the host version, project trust, plugin enablement and hook errors. Do not create synthetic receipts to claim activation. A script crash or unsupported host event may be handled fail-open by the host itself even when the adapter intends to deny; required CI checks remain the final gate.

The repository AGENTS.md generated earlier is preserved as requested. Current V5 development commands and structure are documented in README.md.
