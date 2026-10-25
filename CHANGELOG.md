# Changelog

## V5 (2026-10-25)

### 新增
- 工具中立的核心规则与可选 DDD、TypeScript/Jest、企业 profiles。
- Node 共享运行时：任务/AC/测试设计证据、范围检查、独立会话绑定、验证摘要。
- Claude、Codex、Kimi Hooks 与 OpenCode V1/V2 插件适配器。
- 显式目标、配置合并、冲突预检、故障回滚与受管卸载；doctor 分开报告配置与观察结果。
- 独立 verify/validate、Git base/head 验证、历史采用率；Windows/Linux CI 和自动回归。

### 变更
- 保留七个 Skills，修正模板引用和测试顺序；先允许只读调查，再准备规格证据。
- 规格可提前存在；不再以任意规格写入或项目共享 marker 解锁业务代码。
- 移除默认强制 DDD/Jest/企业规范，项目路径和测试命令改为配置。
- 历史采用率中例外单列，无代码为 N/A；不将采用率称为测试覆盖率。
- 安装入口必须显式指定目标，旧 Claude 配置按可识别命令迁移。升级细节见 docs/migration.md。

### 验证边界
- 自动测试涵盖协议与本地集成；真实宿主启用、信任和模型会话仍需按 docs/hosts.md 检验。
- Shell/MCP 默认审计并显式报告覆盖缺口；严格模式拒绝未知工具，最终验证与 CI 仍必需。

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
