#!/usr/bin/env bash
set -euo pipefail
# V5 uses isolated session bindings; startup must not clear other sessions.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${SDD_PROJECT_ROOT:?Reinstall openSDD V5 or set SDD_PROJECT_ROOT}"
exec node "$SCRIPT_DIR/../adapters/hooks.mjs" "${SDD_HOST:-claude}" "$SDD_PROJECT_ROOT"
