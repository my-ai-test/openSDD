#!/usr/bin/env bash
set -euo pipefail
# Compatibility entry; V5 installation registers the Node hook directly.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${SDD_PROJECT_ROOT:?Reinstall openSDD V5 or set SDD_PROJECT_ROOT}"
exec node "$SCRIPT_DIR/../adapters/hooks.mjs" "${SDD_HOST:-claude}" "$SDD_PROJECT_ROOT"
