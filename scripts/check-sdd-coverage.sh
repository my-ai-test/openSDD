#!/usr/bin/env bash
set -euo pipefail
FRAMEWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$FRAMEWORK_DIR/runtime/cli.mjs" coverage --project "$PWD" "$@"
