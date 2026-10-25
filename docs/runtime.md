# Shared runtime and task evidence

Requires Node.js 22.15+ (CI uses Node 24) and Git for change/history validation. No npm dependencies are required. Commands below run at the **consumer project root** after installation.

## Configuration

Edit `.sdd/config.json`; paths are relative to the project containing it:

```json
{
  "schemaVersion": 1,
  "frameworkDir": ".sdd/framework",
  "codeDirs": ["src", "apps", "packages"],
  "specDirs": ["SDD/01-specs"],
  "testPatterns": ["(^|/)(tests?|__tests__)/", "\\.(test|spec)\\.[^/]+$"],
  "profiles": [],
  "testCommand": { "command": "node", "args": ["--test", "tests/user.test.mjs"] },
  "unknownTools": "audit"
}
```

Use `ddd`, `typescript-jest`, and/or `enterprise` profiles only when the project adopts them. `testCommand` is an executable and argument array, not a shell string. On Windows, prefer an executable such as `node` with the test runner's JS entrypoint; `.cmd` wrappers require an explicitly selected shell. Never put credentials in arguments.

## Task manifest

Create `.sdd/tasks/FD-001.json` and a substantive test design document before implementation:

```json
{
  "schemaVersion": 1,
  "id": "FD-001",
  "status": "open",
  "mode": "existing-spec",
  "reason": "The existing acceptance criteria are correct; repair the implementation.",
  "specs": [
    { "path": "SDD/01-specs/features/user/spec.md", "acs": ["AC-001"] }
  ],
  "codePaths": ["src/user.mjs"],
  "testPlan": "SDD/02-plans/FD-001-tests.md",
  "tests": [
    { "path": "tests/user.test.mjs", "acs": ["AC-001"] }
  ]
}
```

The specification must contain the identified AC; the test design must describe its cases and identify the AC. Test code must also identify the AC, for example in its test title. The runtime validates references, identifiers and hashes, not business correctness.

AC identifiers must be unique across the specifications in one task (use names such as `AC-FD01-001` when combining features). Every referenced specification needs at least one AC. Keep background architecture/API references in the test design when they do not define ACs. Snapshots cover declared code scopes, mapped test files and evidence; include helper/fixture files in the test mapping if changes to them must invalidate the proof.

A scope ending in `/` includes the directory's descendants; otherwise it is an exact file. Declare both old and new paths for a rename. Scope only the affected module. `spec-change` is for changed/new behavior; `existing-spec` requires a reason. An `exception` task requires a specific reason and bounded codePaths; it is reported separately and still requires successful testCommand evidence for final validation. Do not edit generated `prepared` or `verification` fields.

## Prepare, bind, implement, verify

```text
node .sdd/framework/runtime/cli.mjs prepare --project . --task FD-001
node .sdd/framework/runtime/cli.mjs bind --project . --task FD-001 --host codex --session SESSION_ID
node .sdd/framework/runtime/cli.mjs status --project . --task FD-001
node .sdd/framework/runtime/cli.mjs verify --project . --task FD-001
node .sdd/framework/runtime/cli.mjs validate --project .
node .sdd/framework/runtime/cli.mjs close --project . --task FD-001
```

Use the actual session ID supplied by the startup hook, plugin rejection, or host's session details. Every host/session gets its own binding. Resume preserves that binding but rechecks evidence on each protected write. A new/forked session or another tool must explicitly bind. Specification, test design or task-definition changes require prepare and bind again. Specification and code in the same patch are rejected.

`verify` executes the configured test command, records its actual exit status, and binds the result to a content snapshot. It rejects source changes occurring during execution. Any later source/test/evidence change makes that proof stale. Run verify again after repairs. Text hashes normalize LF/CRLF for Git/Windows portability; binary hashes do not.

`close` disables further code writes for the task; its evidence remains usable by final validation. The next task requires its own manifest and binding.

## Final change checks and CI

```text
node .sdd/framework/runtime/cli.mjs validate --project . --base origin/main --head HEAD
node .sdd/framework/runtime/cli.mjs coverage --project . --commits 30 --fail-below 80
```

Without a base, validate checks staged, unstaged and untracked non-ignored changes. With base/head, it uses the merge-base and **materializes the head revision's config, tasks and files**; a dirty working tree cannot repair bad committed evidence. Commit `.sdd/config.json`, task manifests, specifications, test design and tests. Do not commit `.sdd/state/` or the installation manifest. Tests must have run successfully before the task proof is committed. CI should rerun the project's tests as well as validating references/proofs; a committed result is not trusted execution attestation.

In consumer CI, install the framework from its pinned revision, then run the consumer tests and validate against the PR base. CI can also freshly verify the declared tasks and validate the working tree. A base/head check always reads committed proofs. Never claim the final diff proves spec-before-code timing.

Coverage is historical **co-change adoption**, not AC/test coverage: root commits count, merge commits do not; bypass commits are separate and do not increase compliance. No code samples gives N/A, not 100%.

## Guard limits

Recognized file tools and patches fail closed on malformed paths/protocols. Paths outside the configured project and symlink aliases are rejected. Tests/specs and non-code documents are editable before readiness.

`unknownTools: "audit"` allows unrecognized calls (including shell/MCP) with an explicit coverage-gap result. `"deny"` rejects them; prepare/bind/test commands then need a separate trusted terminal. The guard does not sandbox arbitrary processes or authenticate user-edited evidence. Final validation, CI and review remain necessary. Installing a hook does not grant trust or prove that its host invokes it.
