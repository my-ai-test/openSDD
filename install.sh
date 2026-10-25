#!/usr/bin/env bash
set -euo pipefail
# Explicit consumer directory prevents accidental writes to the clone's parent.
if [ "$#" -lt 1 ]; then
  echo "Usage: bash install.sh PROJECT [claude|codex|kimi|opencode-v1|opencode-v2] [--kimi-config PATH]" >&2
  exit 1
fi
FRAMEWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_TARGET="$1"
HOST_TARGET="${2:-claude}"
if [ "$#" -ge 2 ]; then shift 2; else shift; fi
exec node "$FRAMEWORK_DIR/runtime/cli.mjs" install --project "$PROJECT_TARGET" --host "$HOST_TARGET" "$@"
