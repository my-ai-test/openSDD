#!/usr/bin/env bash
# session-reset.sh
# SessionStart hook — clear the spec-touched marker so each new session
# requires a fresh spec edit before any code file can be touched.
#
# SDD Framework V4 — spec-first enforcement layer.
#
# Configuration:
#   SDD_PROJECT_ROOT — explicit project root (STRONGLY RECOMMENDED on Windows)

set -euo pipefail

PROJECT_ROOT="${SDD_PROJECT_ROOT:-$PWD}"
MARKER="$PROJECT_ROOT/.claude/.session-spec-touched"

if [ -f "$MARKER" ]; then
  rm -f "$MARKER"
  echo "[spec-first] session marker cleared: $MARKER" >&2
fi

exit 0
