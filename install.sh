#!/usr/bin/env bash
# SDD Framework V4 — install.sh
#
# Usage:
#   bash sdd-framework/install.sh              # auto-detect project root
#   bash sdd-framework/install.sh /path/to/project
#   SDD_CODE_DIRS_REGEX='/(src|lib)/' bash sdd-framework/install.sh
#
# What it does:
#   1. Copies skills/<name>/SKILL.md  → .claude/skills/<name>/SKILL.md
#   2. Copies hooks/*                 → .claude/hooks/
#   3. Generates .claude/settings.json with absolute hook paths
#   4. Generates CLAUDE.md from template   (skipped if already exists)
#
# Environment overrides (optional):
#   SDD_CODE_DIRS_REGEX   default: /(apps|src|packages)/
#   SDD_SPEC_DIR_REGEX    default: /SDD/
#   SDD_SKIP_SYMLINK=1    always copy instead of symlink (useful on Windows)

set -euo pipefail

# ── Locate framework dir (this file's real location, not a symlink) ──────────
SCRIPT_PATH="${BASH_SOURCE[0]}"
if command -v readlink &>/dev/null && readlink -f "$SCRIPT_PATH" &>/dev/null; then
  SCRIPT_PATH=$(readlink -f "$SCRIPT_PATH")
fi
FRAMEWORK_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

# ── Resolve project root ──────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  PROJECT_ROOT="$(cd "$1" && pwd)"
else
  # When added as submodule, superproject root is one level up
  SUPER=$(git -C "$FRAMEWORK_DIR" rev-parse --show-superproject-working-tree 2>/dev/null || true)
  if [ -n "$SUPER" ]; then
    PROJECT_ROOT="$SUPER"
  else
    # Standalone clone — parent directory is the project
    PROJECT_ROOT="$(dirname "$FRAMEWORK_DIR")"
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║        SDD Framework V4 — Installer              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  Framework : $FRAMEWORK_DIR"
echo "  Project   : $PROJECT_ROOT"
echo ""

# ── Create target directories ─────────────────────────────────────────────────
mkdir -p "$PROJECT_ROOT/.claude/skills"
mkdir -p "$PROJECT_ROOT/.claude/hooks"

# ── Install Skills ────────────────────────────────────────────────────────────
echo "▸ Installing Skills → .claude/skills/"

# Determine whether to symlink or copy skill directories
USE_SYMLINK=1
if [ "${SDD_SKIP_SYMLINK:-0}" = "1" ]; then
  USE_SYMLINK=0
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  # On Windows Git Bash, test if symlinks work (requires Developer Mode)
  _TEST_SRC="$FRAMEWORK_DIR/skills/sdd-write-ac"
  _TEST_DST="$PROJECT_ROOT/.claude/skills/.symlink-test"
  if ln -sf "$_TEST_SRC" "$_TEST_DST" 2>/dev/null; then
    rm -f "$_TEST_DST"
  else
    USE_SYMLINK=0
  fi
fi

for skill_dir in "$FRAMEWORK_DIR/skills/"/*/; do
  skill_name=$(basename "$skill_dir")
  dst="$PROJECT_ROOT/.claude/skills/$skill_name"
  if [ "$USE_SYMLINK" = "1" ]; then
    ln -sfn "$skill_dir" "$dst"
    echo "    ✓ $skill_name/ (symlinked — auto-updates with submodule)"
  else
    mkdir -p "$dst"
    cp -f "$skill_dir/SKILL.md" "$dst/SKILL.md"
    echo "    ✓ $skill_name/SKILL.md (copied — re-run install after submodule update)"
  fi
done

# ── Install Hooks ─────────────────────────────────────────────────────────────
echo ""
echo "▸ Installing Hooks → .claude/hooks/"

for hook_file in session-reset.sh spec-first-guard.sh spec-touched-marker.sh parse-hook-input.js; do
  src="$FRAMEWORK_DIR/hooks/$hook_file"
  dst="$PROJECT_ROOT/.claude/hooks/$hook_file"
  cp -f "$src" "$dst"
  [[ "$hook_file" == *.sh ]] && chmod +x "$dst"
  echo "    ✓ $hook_file"
done

# ── Generate settings.json ────────────────────────────────────────────────────
echo ""
echo "▸ Generating .claude/settings.json"

HOOKS_DIR="$PROJECT_ROOT/.claude/hooks"
CODE_DIRS_REGEX="${SDD_CODE_DIRS_REGEX:-/(apps|src|packages)/}"
SPEC_DIR_REGEX="${SDD_SPEC_DIR_REGEX:-/SDD/}"

cat > "$PROJECT_ROOT/.claude/settings.json" <<SETTINGS_EOF
{
  "env": {
    "SDD_PROJECT_ROOT": "$PROJECT_ROOT",
    "SDD_CODE_DIRS_REGEX": "$CODE_DIRS_REGEX",
    "SDD_SPEC_DIR_REGEX": "$SPEC_DIR_REGEX"
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash $HOOKS_DIR/session-reset.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash $HOOKS_DIR/spec-first-guard.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash $HOOKS_DIR/spec-touched-marker.sh"
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF

echo "    ✓ .claude/settings.json (with absolute paths for $PROJECT_ROOT)"

# ── Generate CLAUDE.md ────────────────────────────────────────────────────────
echo ""
CLAUDE_MD="$PROJECT_ROOT/CLAUDE.md"
TEMPLATE="$FRAMEWORK_DIR/templates/CLAUDE.md.template"

if [ -f "$CLAUDE_MD" ]; then
  echo "▸ CLAUDE.md already exists — skipped"
  echo "    ⚠  To reset: rm CLAUDE.md && bash sdd-framework/install.sh"
else
  # Replace {{FRAMEWORK_DIR}} in template with actual path
  sed "s|{{FRAMEWORK_DIR}}|$FRAMEWORK_DIR|g" "$TEMPLATE" > "$CLAUDE_MD"
  echo "▸ CLAUDE.md generated from template"
  echo "    ✓ Fill in remaining {{PLACEHOLDER}} values before first use"
fi

# ── .gitignore advice ─────────────────────────────────────────────────────────
GITIGNORE="$PROJECT_ROOT/.gitignore"
NEEDS_GITIGNORE=0
if [ -f "$GITIGNORE" ]; then
  grep -q "\.session-spec-touched" "$GITIGNORE" || NEEDS_GITIGNORE=1
else
  NEEDS_GITIGNORE=1
fi

if [ "$NEEDS_GITIGNORE" = "1" ]; then
  echo ""
  echo "▸ Add to .gitignore (not yet present):"
  echo "    .claude/.session-spec-touched"
  echo "    .claude/settings.json"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo "  Installation complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit CLAUDE.md — fill in {{PROJECT_NAME}}, {{TECH_STACK}}, etc."
if [ "$NEEDS_GITIGNORE" = "1" ]; then
echo "  2. Add the .gitignore entries shown above"
echo "  3. Start a new Claude Code session to activate hooks"
echo "  4. Run /sdd-init-project or /sdd-implement-feature"
else
echo "  2. Start a new Claude Code session to activate hooks"
echo "  3. Run /sdd-init-project or /sdd-implement-feature"
fi
echo ""
echo "  To update after submodule upgrade:"
echo "    git submodule update --remote sdd-framework"
echo "    bash sdd-framework/install.sh"
echo "══════════════════════════════════════════════════"
