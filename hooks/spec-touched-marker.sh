#!/usr/bin/env bash
# spec-touched-marker.sh
# PostToolUse hook — when a spec file is successfully edited, write a marker
# so subsequent code edits in the same session are allowed.
#
# SDD Framework V4 — spec-first enforcement layer.
#
# Configuration (env vars, all optional):
#   SDD_SPEC_DIR_REGEX   — regex for SDD spec dir  (default: '/SDD/')
#   SDD_PROJECT_ROOT     — explicit project root   (STRONGLY RECOMMENDED on Windows)

set -euo pipefail

SPEC_DIR_REGEX="${SDD_SPEC_DIR_REGEX:-/SDD/}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSE_HELPER="$SCRIPT_DIR/parse-hook-input.js"

INPUT=$(cat)

TARGET_FILE=""
if [ -f "$PARSE_HELPER" ] && command -v node &>/dev/null; then
  TARGET_FILE=$(echo "$INPUT" | node "$PARSE_HELPER" 2>/dev/null || true)
fi
if [ -z "$TARGET_FILE" ]; then
  TARGET_FILE=$(echo "$INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 \
    | sed 's/.*"file_path"\s*:\s*"\([^"]*\)".*/\1/' || true)
fi

if [ -z "$TARGET_FILE" ]; then
  exit 0
fi

TARGET_NORM="${TARGET_FILE//\\//}"

if ! echo "$TARGET_NORM" | grep -qE "$SPEC_DIR_REGEX"; then
  exit 0
fi

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
  echo "[spec-first] WARNING: could not resolve project root; marker not written." >&2
  exit 0
fi

mkdir -p "$PROJECT_ROOT/.claude"
MARKER="$PROJECT_ROOT/.claude/.session-spec-touched"
echo "spec-touched: $TARGET_FILE @ $(date '+%Y-%m-%d %H:%M:%S')" > "$MARKER"
echo "[spec-first] marker written: $MARKER" >&2

exit 0
