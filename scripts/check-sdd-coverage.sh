#!/usr/bin/env bash
# check-sdd-coverage.sh
# SDD Framework V4 — 规格-代码同步覆盖率检查
#
# 功能：扫描最近 N 次 git commit，检查"包含代码变更的 commit 是否同时包含 spec 变更"
# 用途：团队 Lead 查看 SDD 采用率；CI/CD 质量门禁
#
# 用法：
#   bash sdd-framework/scripts/check-sdd-coverage.sh
#   bash sdd-framework/scripts/check-sdd-coverage.sh --commits 20
#   bash sdd-framework/scripts/check-sdd-coverage.sh --since "2026-01-01"
#   bash sdd-framework/scripts/check-sdd-coverage.sh --fail-below 80
#
# 退出码：
#   0 = 覆盖率达标（或未设置阈值）
#   1 = 覆盖率低于 --fail-below 阈值

set -euo pipefail

# ── 参数解析 ──────────────────────────────────────────────────────────────────
COMMITS=30
SINCE=""
FAIL_BELOW=0
CODE_DIRS_REGEX="${SDD_CODE_DIRS_REGEX:-/(apps|src|packages)/}"
SPEC_DIR_REGEX="${SDD_SPEC_DIR_REGEX:-/SDD/}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --commits)   COMMITS="$2";    shift 2 ;;
    --since)     SINCE="$2";      shift 2 ;;
    --fail-below) FAIL_BELOW="$2"; shift 2 ;;
    *)           shift ;;
  esac
done

# ── 获取 commit 列表 ──────────────────────────────────────────────────────────
if [ -n "$SINCE" ]; then
  COMMIT_LIST=$(git log --since="$SINCE" --format="%H %s" --no-merges)
else
  COMMIT_LIST=$(git log -n "$COMMITS" --format="%H %s" --no-merges)
fi

total=0
code_only=0    # 有代码无 spec（违规）
spec_only=0    # 有 spec 无代码（纯文档提交，正常）
both=0         # 有代码也有 spec（合规）
no_code=0      # 无代码变更（配置/CI/文档，跳过）

declare -a violations=()
declare -a bypasses=()

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║      SDD Coverage Check — Spec-Code Sync         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

while IFS= read -r line; do
  [ -z "$line" ] && continue
  hash=$(echo "$line" | awk '{print $1}')
  subject=$(echo "$line" | cut -d' ' -f2-)

  # 获取此 commit 变更的文件列表
  files=$(git diff-tree --no-commit-id -r --name-only "$hash" 2>/dev/null || true)
  [ -z "$files" ] && continue

  has_code=0
  has_spec=0
  has_bypass=0

  while IFS= read -r f; do
    norm="/$f"
    # 检查 bypass 标记（commit message 含 "bypass:"）
    if echo "$subject" | grep -qi "bypass:"; then
      has_bypass=1
    fi
    # 检查是否是代码文件（非测试）
    if echo "$norm" | grep -qE "$CODE_DIRS_REGEX" && \
       ! echo "$norm" | grep -qE '\.(test|spec)\.(ts|tsx|js|py|go|rs)$'; then
      has_code=1
    fi
    # 检查是否是 spec 文件
    if echo "$norm" | grep -qE "$SPEC_DIR_REGEX"; then
      has_spec=1
    fi
  done <<< "$files"

  if [ "$has_code" = "0" ]; then
    ((no_code++)) || true
    continue
  fi

  ((total++)) || true

  if [ "$has_bypass" = "1" ]; then
    bypasses+=("  ⚠  ${hash:0:7} bypass: $subject")
    ((both++)) || true   # bypass 算合规（有审计）
  elif [ "$has_spec" = "1" ]; then
    ((both++)) || true
  else
    ((code_only++)) || true
    violations+=("  ❌  ${hash:0:7} $subject")
  fi
done <<< "$COMMIT_LIST"

# ── 计算覆盖率 ────────────────────────────────────────────────────────────────
if [ "$total" -gt 0 ]; then
  coverage=$(( (both * 100) / total ))
else
  coverage=100
fi

# ── 输出报告 ──────────────────────────────────────────────────────────────────
echo "扫描范围：${SINCE:-最近 ${COMMITS} 次} commit（排除 merge commit）"
echo ""
echo "统计结果："
echo "  总计代码变更 commit：$total"
echo "  ✅ 含 spec 同步（合规）：$both"
echo "  ❌ 缺少 spec 同步（违规）：$code_only"
echo "  ⚠  bypass 记录：${#bypasses[@]}"
echo "  ⬜ 纯非代码 commit（跳过）：$no_code"
echo ""
echo "SDD 覆盖率：${coverage}%"

if [ "$FAIL_BELOW" -gt 0 ]; then
  echo "阈值要求：>= ${FAIL_BELOW}%"
fi

echo ""

if [ ${#violations[@]} -gt 0 ]; then
  echo "违规 commit 清单（有代码变更但无 spec 同步）："
  for v in "${violations[@]}"; do echo "$v"; done
  echo ""
fi

if [ ${#bypasses[@]} -gt 0 ]; then
  echo "Bypass 记录（已审计，不计入违规）："
  for b in "${bypasses[@]}"; do echo "$b"; done
  echo ""
fi

# ── 退出码 ────────────────────────────────────────────────────────────────────
if [ "$FAIL_BELOW" -gt 0 ] && [ "$coverage" -lt "$FAIL_BELOW" ]; then
  echo "❌ 覆盖率 ${coverage}% 低于阈值 ${FAIL_BELOW}%，检查失败"
  exit 1
else
  echo "✅ 覆盖率检查通过"
  exit 0
fi
