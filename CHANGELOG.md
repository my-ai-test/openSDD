# Changelog

## V4 (2026-04-27)

### 新增
- **7 个 Claude Code Skills**（`/sdd-*` 斜杠命令）
  - L3: `/sdd-init-project`
  - L2: `/sdd-implement-feature`、`/sdd-bc-design`
  - L1: `/sdd-write-ac`、`/sdd-write-tests`
  - 工具: `/sdd-generate-uj`、`/sdd-review-spec`
- **`install.sh` / `install.ps1`** — 一键安装器，支持 symlink 或 copy 模式
- **`templates/CLAUDE.md.template`** — 含 `{{FRAMEWORK_DIR}}` 自动填充

### 变更（vs V3）
- `SDD_SPEC_DIR_REGEX` 默认值从 `/SDD/01-specs/` 放宽为 `/SDD/`，支持自定义规格目录命名
- 错误提示更新，指引用户使用 `/sdd-implement-feature` Skill
- `settings.json.template` 新增 `env` 节，支持项目级环境变量覆盖
- 所有 hook 脚本改用 `BASH_SOURCE` 自定位（兼容 Windows Git Bash）

### 包含内容
- `commands/` — 7 个 Skill 定义文件
- `hooks/` — 3 个 guard 脚本 + `parse-hook-input.js`
- `templates/spec/` — 13 个规格文件模板（从 V3 继承）
- `templates/CLAUDE.md.template` — 项目 CLAUDE.md 模板

---

## V3 (2025-Q4)

- 完整 SDD 方法论文档（G1–G9 指南）
- 5 个 Hooks（含 parse-hook-input.js）
- 13 个规格文件模板
- CLAUDE.md（项目专用，非模板）

---

## V2 (2025-Q3)

- 初始 SDD 框架：强制响应模板、文档门禁、BACKLOG 唤醒
- 基础 Hooks：spec-first-guard、session-reset
