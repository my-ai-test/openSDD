# openSDD V5

跨 Claude Code、Codex、Kimi Code、OpenCode 的 Spec-Driven Development 执行框架。

共享规则与 7 个 Skills 定义开发流程；Node 运行时检查任务规格、AC、测试设计和代码范围；宿主适配器拦截受支持的写入；独立验证器检查最终变更和测试证据。

## 结构

| 目录 | 内容 |
|---|---|
| skills/ | 初始化、特性实现、BC 设计、AC、测试、用户旅程、规格审查 |
| rules/、profiles/ | 通用规则与可选 DDD、TypeScript/Jest、企业约定 |
| templates/spec/、standards/ | 13 个规格模板、六层测试模型、错误码参考 |
| runtime/ | 配置、路径、任务证据、守卫、安装、诊断、验证 |
| adapters/ | Claude/Codex/Kimi Hooks，OpenCode V1/V2 插件 |
| tests/ | Node 行为测试、协议样本、安装与真实子进程/Git 集成 |
| examples/minimal/ | 注册功能规格与示例测试（需要消费项目实现） |
| SDD/ | 本次框架改造的规格、执行计划与验证记录 |

## 安装到业务项目

要求 Node.js 22.15+，Git 变更检查需要 Git。无需 npm install。可继续通过 Git submodule 固定框架版本。

```text
node runtime/cli.mjs install --project /path/to/existing/project --host codex
```

host 可选 claude、codex、kimi、opencode-v1、opencode-v2。必须显式指定目标，避免写入克隆目录的父目录。

Windows：

```powershell
.\install.ps1 -ProjectRoot C:\workspace\my-project -HostName codex
```

Bash：

```bash
bash install.sh /path/to/project codex
```

安装后编辑业务项目 .sdd/config.json，指定实际目录和测试命令。Kimi 全局配置需显式 --kimi-config；未指定时只生成待合并片段。已有 AGENTS.md/CLAUDE.md 保留原文并附加受管区块，其他 Hooks 不被覆盖。

## 使用流程

1. 读取规则与相关规格，完成只读调查和影响分析。
2. 修改需要变化的规格，或关联正确的已有 AC。
3. 固化测试设计，创建任务清单。
4. prepare 任务并 bind 当前宿主会话。
5. 实现与测试，verify 记录实际结果，validate 检查最终变更。

完整命令与 JSON 示例：[运行时指南](docs/runtime.md)。
各工具接入、调用与真实宿主检查：[宿主指南](docs/hosts.md)。
旧版升级：[V4 → V5](docs/migration.md)。

## 框架开发与验证

```text
node scripts/check-all.mjs
node --test --test-isolation=none tests/runtime.test.mjs
node scripts/check-repository.mjs
```

全部测试无网络/模型依赖，在隔离临时项目中测试，不修改本机工具配置。Git 集成测试创建临时仓库。GitHub Actions 配置 Windows/Linux 双平台运行；本地执行记录见 [验证日志](SDD/02-plans/migration-validation.md)。

规则入口的内容可跨工具共享，执行器协议仍须匹配宿主版本。doctor 区分静态配置和已观察事件；协议回放不能证明真实宿主已激活。默认 audit 模式不拦截任意 Shell/MCP 写入，因此最终验证与 CI 不可省略。

原有 openSDD.rar 是 V4 历史归档，不是 V5 安装来源；以 Git 中的源码为准。
