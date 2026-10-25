# Repository Guidelines

## Project Structure & Module Organization

openSDD is a Spec-Driven Development framework installed into consumer projects, typically as a Git submodule.

- `skills/sdd-*/SKILL.md`: reusable development workflows.
- `hooks/`: Bash lifecycle hooks and the Node.js JSON-input parser.
- `templates/`: full/lite `CLAUDE.md` templates and `spec/L1-*`, `L2-*`, and `L3-*` specification templates.
- `standards/`: authoritative six-layer testing model and error-code conventions; keep related workflows and templates consistent with these documents.
- `scripts/`: Git-history coverage tooling.
- `examples/minimal/`: registration specification and illustrative TypeScript tests.
- `install.sh` and `install.ps1`: cross-platform installation entry points.

## Build, Test, and Development Commands

There is no application build, development server, or package-managed test command. Run checks from the repository root; Bash commands require Bash or Git Bash.

- `bash -n install.sh`: check installer syntax; repeat for changed `hooks/*.sh` and `scripts/*.sh` files.
- `node --check hooks/parse-hook-input.js`: check parser syntax.
- `bash install.sh /path/to/existing/sandbox`: install into an explicit disposable consumer directory.
- `.\install.ps1 -ProjectRoot C:\path\to\existing\sandbox`: exercise the PowerShell installer.
- `bash scripts/check-sdd-coverage.sh --commits 20`: report specification/code synchronization in recent commits. `--fail-below 80` enables an optional threshold; this is not test coverage.

Always provide an installation target during development: standalone clones otherwise target their parent directory.

## Coding Style & Naming Conventions

Match existing two-space indentation in scripts and TypeScript examples. Preserve Bash strict mode, PowerShell strict mode, and JavaScript single quotes and semicolons. Use kebab-case script names, `sdd-*` skill directories, uppercase `SKILL.md`, and existing `L1-*_SPEC.md` template patterns. Preserve `{{PLACEHOLDER}}` tokens. Follow `.gitattributes`: LF for shell, JavaScript, Markdown, and JSON; CRLF for PowerShell. No formatter or linter is configured.

## Testing Guidelines

The `*.spec.ts` examples use Jest-style assertions but reference unimplemented consumer code; they cannot run standalone. Derive examples from acceptance criteria, label cases with AC identifiers and six-layer categories, and retain factory-based fixtures. For hook changes, manually verify blocking before a specification edit, unlocking afterward, and session reset. For installer changes, check generated settings, copied resources, and preservation of existing `CLAUDE.md`.

## Commit & Pull Request Guidelines

History currently contains only `Initial release of openSDD framework`; no formal commit convention is established. Use concise, descriptive subjects. PRs should explain behavior changes, affected workflows, validation commands/results, and related issues when applicable. Update documentation and templates alongside behavior changes. Keep generated absolute-path settings and session markers out of commits.
