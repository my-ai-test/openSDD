#!/usr/bin/env bash
# spec-first-guard.sh
# PreToolUse hook for Edit/Write/MultiEdit — enforces SDD spec-first workflow.
#
# SDD Framework V4 — spec-first enforcement layer.
#
# Behavior:
#   - If the target file is under a code directory (apps/ src/ packages/),
#     check whether any SDD spec file has been touched in this session.
#   - If no spec has been touched: block (exit 2) with an instructive message.
#   - Test files and non-code files are always allowed.
#   - If project root cannot be located: fail open (exit 0) to avoid false blocks.
#
# V4 changes vs V3:
#   - SDD_SPEC_DIR_REGEX now accepts ANY file under SDD/ (not just 01-specs/)
#     to support projects that use different spec directory names.
#   - Added SDD_BYPASS_REASON env var for automated bypass with audit trail.
#   - Error message updated to reference V4 and Skills.
#
# Configuration (env vars, all optional):
#   SDD_CODE_DIRS_REGEX  — regex for code directories  (default: '/(apps|src|packages)/')
#   SDD_SPEC_DIR_REGEX   — regex for SDD spec dir      (default: '/SDD/')
#   SDD_TEST_FILE_REGEX  — regex for test files        (default: '\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs)$')
#   SDD_PROJECT_ROOT     — explicit project root       (STRONGLY RECOMMENDED on Windows)

set -euo pipefail

CODE_DIRS_REGEX="${SDD_CODE_DIRS_REGEX:-/(apps|src|packages)/}"
SPEC_DIR_REGEX="${SDD_SPEC_DIR_REGEX:-/SDD/}"
TEST_FILE_REGEX="${SDD_TEST_FILE_REGEX:-\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs)$}"

# Locate parse-hook-input.js (same directory as this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSE_HELPER="$SCRIPT_DIR/parse-hook-input.js"

# Read hook input from stdin
INPUT=$(cat)

# Extract target file path.
TARGET_FILE=""
if [ -f "$PARSE_HELPER" ] && command -v node &>/dev/null; then
  TARGET_FILE=$(echo "$INPUT" | node "$PARSE_HELPER" 2>/dev/null || true)
fi
if [ -z "$TARGET_FILE" ]; then
  TARGET_FILE=$(echo "$INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 \
    | sed 's/.*"file_path"\s*:\s*"\([^"]*\)".*/\1/' || true)
fi

# Empty target — allow
if [ -z "$TARGET_FILE" ]; then
  exit 0
fi

# Normalize path separators
TARGET_NORM="${TARGET_FILE//\\//}"

# Allow edits to non-code areas
if ! echo "$TARGET_NORM" | grep -qE "$CODE_DIRS_REGEX"; then
  exit 0
fi

# Allow test files
if echo "$TARGET_NORM" | grep -qE "$TEST_FILE_REGEX"; then
  exit 0
fi

# Resolve project root
if [ -n "${SDD_PROJECT_ROOT:-}" ]; then
  PROJECT_ROOT="$SDD_PROJECT_ROOT"
else
  DIR=$(dirname "$TARGET_NORM")
  PROJECT_ROOT=""
  while [ "$DIR" != "/" ] && [ "$DIR" != "." ] && [ -n "$DIR" ]; do
    if [ -d "$DIR/.claude" ]; then
      PROJECT_ROOT="$DIR"
      break
    fi
    PARENT=$(dirname "$DIR")
    if [ "$PARENT" = "$DIR" ]; then
      break
    fi
    DIR="$PARENT"
  done
fi

if [ -z "$PROJECT_ROOT" ]; then
  echo "[spec-first] WARNING: could not resolve project root; guard skipped." >&2
  exit 0
fi

SESSION_MARKER="$PROJECT_ROOT/.claude/.session-spec-touched"

if [ ! -f "$SESSION_MARKER" ]; then
  cat >&2 <<EOF
[SDD SPEC-FIRST VIOLATION]

You attempted to Edit/Write a code file:
  $TARGET_FILE

But no SDD spec file has been modified in this session yet.

Per SDD Spec-First Workflow (V4):
  Step 1: Output "## SDD 分析" block in your response (no tool calls yet)
  Step 2: Edit the relevant spec file FIRST (anywhere under SDD/)
  Step 3: Then edit code under /(apps|src|packages)/

  Or run: /sdd-implement-feature to be guided through the full workflow.

Valid spec locations (any of the following satisfies the guard):
  - SDD/01-specs/features/{NNN}-{domain}/spec.md
  - SDD/01-specs/bc/{bc-NN}-{domain}/spec.md
  - SDD/01-specs/DOMAIN_EVENT_CATALOG.md
  - SDD/01-specs/DATA_SPEC.md / API_SPEC.md / UI_SPEC.md / SECURITY_SPEC.md
  (Any file under SDD/ will satisfy the guard.)

To bypass for pure infrastructure / style change (leaves audit trail):
  echo "bypass: <your reason here>" > "$SESSION_MARKER"
  Then retry the code edit.

Note: Test files (*.spec.ts, *.test.ts, etc.) are always allowed without bypass.
EOF
  exit 2
fi

exit 0
