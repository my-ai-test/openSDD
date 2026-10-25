---
name: sdd-init-project
description: This skill should be used when the user asks to "初始化SDD项目", "从零搭建新项目", "initialize a new SDD project", "start a project with SDD framework", "create project skeleton", or mentions starting a brand-new project from scratch using Spec-Driven Development methodology.
---

> 先读消费项目 `.sdd/config.json` 和框架 `rules/core.md`。FRAMEWORK_DIR、SPEC_DIR、代码路径与测试命令以配置为准；示例 SDD 路径按项目替换。DDD、TypeScript/Jest 和企业规范仅在对应 profile 启用时适用。调用入口见框架 `docs/hosts.md`。


# sdd-init-project — 初始化 SDD 项目

> **L3 Skill（顶层 Orchestrator）**：从零开始创建 SDD 项目的完整引导流程。
> 内部编排：环境准备 → 产品洞察 → DDD 设计 → 规格骨架 → 逐 BC/FD 实现。

---

## 输入

请提供以下信息（未提供则逐项追问）：

1. **项目名称**（中英文）
2. **技术栈**（如：NestJS 10 + Next.js 14 + MySQL 8 + Prisma 5）
3. **代码目录**（如：`apps/`、`src/`、`packages/`）
4. **规格目录**（如：`SDD/01-specs/`，不填默认此值）
5. **初步的产品功能描述**（1-2 段话，不需要完整）

---

## 整体蓝图

```
Phase 0：准备          框架安装 + 环境确认 + CONSTITUTION
Phase 1：产品洞察      角色识别 → 能力全景 → PRODUCT_SPEC + 高层 USER_JOURNEY_SPEC
Phase 2：DDD 战略设计  基于完整 FD 图 → BC 划分 → Context Map → DDD_SPEC
Phase 3：横截面规格    DATA / API / UI / SECURITY_SPEC
Phase 4：逐 BC 循环    BC spec → 聚合根骨架（调用 /sdd-bc-design）
Phase 5：逐 FD 循环    UJ/US/AC → 实现（调用 /sdd-implement-feature）
Phase 6：治理文件      BACKLOG + ADR + CHANGELOG
```

> **为什么是这个顺序？**  
> DDD BC 边界划分的核心问题是"同一概念在不同上下文是否含义不同"——这需要先知道系统全部能力。  
> Phase 1 先把所有角色、能力、FD 识别完整，Phase 2 才能做出有据可查的 BC 决策，而非凭空猜测。

---

## 迁入模式（已有项目）

| 起点状态 | 推荐入口 |
|---------|---------|
| 从零开始的新项目 | Phase 0 → Phase 1 → … 完整流程 |
| 已有代码 + 无规格 | Phase 1（补产品洞察）→ Phase 2（重识 BC）→ Phase 3–5 |
| 已有 BC 设计 + 无详细规格 | Phase 3（补横截面规格骨架）→ Phase 4–5 |
| 已有规格 + 逐 FD 实现 | 直接 Phase 5，单 FD 用 `sdd-implement-feature` |

---

## Phase 0：准备

### 0-A：确认框架安装

读取 `.sdd/config.json`，运行框架 `runtime/cli.mjs doctor --project <项目根>`。确认共享 Skills、规则入口和所选适配器已安装；静态检查与真实宿主激活状态分别报告。安装方法见框架 README 与 docs/hosts.md。

### 0-B：创建 SDD 目录骨架

```bash
mkdir -p SDD/01-specs/features
mkdir -p SDD/01-specs/bc
mkdir -p SDD/02-plans
mkdir -p SDD/03-decisions
```

### 0-C：创建根文档占位文件

```bash
touch SDD/01-specs/PRODUCT_SPEC.md
touch SDD/01-specs/DATA_SPEC.md
touch SDD/01-specs/API_SPEC.md
touch SDD/01-specs/UI_SPEC.md
touch SDD/01-specs/SECURITY_SPEC.md
touch SDD/01-specs/USER_JOURNEY_SPEC.md
touch SDD/01-specs/DOMAIN_EVENT_CATALOG.md
touch SDD/BACKLOG.md
```

> `DDD_SPEC.md` 不在此预置——它将在 Phase 2 以模板为骨架创建，待 BC 清单和 Context Map 确定后填充。

### 0-D：创建 CONSTITUTION.md

`CONSTITUTION.md` 是项目宪法，在技术栈明确后即可创建，无需等待产品设计完成：

```markdown
# {项目名} 宪法

## §1 技术栈声明
- 后端：{framework} {version}
- 前端：{framework} {version}
- 数据库：{db} {version}
- 消息队列：{mq}（如有）

## §2 核心架构决策
- 架构模式：DDD 分层架构（Interface → Application → Domain → Infrastructure）
- BC 数量：{待 Phase 2 回填}
- 认证方式：{auth}

## §3 命名规范
（参考企业规范，或填写项目约定）

## §4 变更记录
```

> CONSTITUTION.md 中 "BC 数量" 待 Phase 2 完成后回填。

---

## Phase 0 检查点

```markdown
## 进度检查点 — Phase 0 完成

✅ 已完成：框架安装确认 / SDD 目录骨架 / 占位文件 / CONSTITUTION.md
📋 下一步：Phase 1-A 角色识别
⚠️ 风险/阻塞：{如有}
```

---

## Phase 1：产品洞察

> **目标**：在做任何技术设计之前，先把"这个系统给谁用、能做什么"搞清楚。  
> 输出：完整的 FD 清单（PRODUCT_SPEC.md）+ 跨角色旅程概览（USER_JOURNEY_SPEC.md）。

### 1-A：角色识别

列出所有与系统交互的用户角色和外部系统，按核心度排序：

```markdown
## 角色清单
| 角色 | 类型（用户/系统/外部） | 核心诉求 | 使用频率 |
|------|---------------------|---------|---------|
| {角色A} | 用户 | ... | 高 |
| {角色B} | 用户 | ... | 中 |
| {外部系统X} | 系统 | ... | — |
```

### 1-B：能力全景（角色 × 能力矩阵）

对每个角色，枚举其需要的能力（动词短语）：

```markdown
## 能力矩阵
| 角色 | 能力 | 优先级 | 说明 |
|------|------|--------|------|
| {角色A} | 创建{资产} | P0 | ... |
| {角色A} | 搜索{资产} | P1 | ... |
| {角色B} | 审批{申请} | P0 | ... |
```

**能力识别问题**：
```
Q1: 每个角色的核心工作流是什么？（主路径能力）
Q2: 角色之间如何协作？（触发协作能力）
Q3: 出错或异常时谁来处理？（恢复能力）
Q4: 系统如何通知相关方？（通知类能力）
Q5: 谁来管理和治理？（管理类能力）
```

### 1-C：创建 PRODUCT_SPEC.md

- 先：`Read {FRAMEWORK_DIR}/templates/spec/L1-PRODUCT_SPEC.md`
- 再：创建 `{{SPEC_DIR}}/PRODUCT_SPEC.md`，基于能力矩阵输出：
  - FD 清单（每个能力群 → 一个 FD，附优先级 P0/P1/P2）
  - 里程碑规划
  - 产品范围声明（In Scope / Out of Scope）

> 此阶段 FD 描述粒度在"功能模块"级别（1 句话），详细 AC 在 Phase 5 逐 FD 时补充。

### 1-D：创建高层 USER_JOURNEY_SPEC.md

- 先：`Read {FRAMEWORK_DIR}/templates/spec/L1-USER_JOURNEY_SPEC.md`
- 再：为每个核心跨角色流程绘制高层旅程（不深入 AC，仅覆盖主路径节点）：

```markdown
## UJ-{NN}：{旅程名称}
**参与角色**：{角色A}、{角色B}
**关键 FD**：FD-{XX}、FD-{YY}
**触发条件**：...

​```mermaid
sequenceDiagram
  participant A as {角色A}
  participant B as {角色B}
  A->>B: ...
​```
```

> 高层 UJ 在此只覆盖跨 BC 的主干流程；每个 FD 内部的详细 UJ 在 Phase 5 实现时深化。

---

## Phase 1 检查点

```markdown
## 进度检查点 — Phase 1 完成

✅ 已完成：角色清单 / 能力矩阵 / PRODUCT_SPEC.md（FD清单）/ USER_JOURNEY_SPEC.md（高层）
📋 下一步：Phase 2-A DDD 战略问题分析
⚠️ 风险/阻塞：{如有}
```

---

## Phase 2：DDD 战略设计

> **输入依赖**：Phase 1 的完整 FD 清单和能力矩阵。  
> **为什么必须在 Phase 1 之后？** BC 边界来自"概念在不同上下文含义不同"的洞察——没有完整的能力全景，无法识别真正的上下文边界。

### 2-A：DDD 战略分析

基于 PRODUCT_SPEC.md 中的 FD 清单，回答以下问题：

```
Q1: 哪些 FD 围绕同一个核心聚合的生命周期？（生命周期内聚 → 同一 BC）
Q2: 哪些概念在不同能力群中含义不同？（概念歧义 → BC 边界信号）
Q3: 哪些操作必须强一致性？（同一事务 → 同一聚合根 / 同一 BC）
Q4: 哪些能力可以异步解耦？（最终一致 → 跨 BC 通过事件）
Q5: 哪些是核心域？哪些是支撑域？哪些是通用域？（影响投入优先级）
```

### 2-B：输出 BC 清单和 Context Map

```markdown
## BC 清单
| BC 编号 | 名称 | 核心概念 | 所属域类型 | 依赖 BC |
|---------|------|---------|----------|--------|
| BC-01 | ... | ... | 核心域 | — |
| BC-02 | ... | ... | 支撑域 | BC-01 |

## Context Map
​```mermaid
graph LR
  BC01[BC-01 名称] -->|事件: XxxEvent| BC02[BC-02 名称]
  BC01 -->|查询| BC03[BC-03 名称]
​```
```

### 2-C：创建 DDD_SPEC.md（Phase 2 收尾，必须在 Phase 4 前完成）

**DDD_SPEC.md 是 BC 设计的架构宪章**，BC spec 的 9 节格式定义在此，所有 BC 设计必须遵从。

- 先：`Read {FRAMEWORK_DIR}/templates/spec/L1-DDD_SPEC.md`
- 再：创建 `{{SPEC_DIR}}/DDD_SPEC.md`，填充以下内容：
  - §1.3 BC 清单：将 2-B 输出的 BC 表格填入
  - §1.4 Context Map：将 2-B 输出的 Mermaid 图填入
  - §2–§7：架构约束节（来自模板，按项目技术栈微调即可，一般无需大改）

> DDD_SPEC.md 必须在 Phase 4（逐 BC 循环）启动前就位，否则 BC 设计无规可依。

同步回填 CONSTITUTION.md §2 中的 `{待 Phase 2 回填}` 字段。

---

## Phase 2 检查点

```markdown
## 进度检查点 — Phase 2 完成

✅ 已完成：BC 清单 / Context Map / DDD_SPEC.md / CONSTITUTION.md §2 BC 数量已回填
📋 下一步：Phase 3-1 DATA_SPEC.md
⚠️ 风险/阻塞：{如有}
```

---

## Phase 3：横截面规格

> **规则 0 前置门禁**：创建每个文件前必须先 Read 对应模板，以模板章节序号为骨架再填充内容。  
> PRODUCT_SPEC.md 已在 Phase 1 完成，DDD_SPEC.md 已在 Phase 2 完成，不在此列。

按以下顺序执行（每个文件两步：先 Read 模板，再创建并填充）：

1. **DATA_SPEC.md**
   - 先：`Read {FRAMEWORK_DIR}/templates/spec/L1-DATA_SPEC.md`
   - 再：填充已知聚合根对应的核心实体模型骨架（来自 Phase 2 的 BC 清单）

2. **API_SPEC.md**
   - 先：`Read {FRAMEWORK_DIR}/templates/spec/L1-API_SPEC.md`
   - 再：填充 全局约定与端点索引（详细契约在 Phase 5 逐 FD 实现时补充）

3. **UI_SPEC.md**
   - 先：`Read {FRAMEWORK_DIR}/templates/spec/L1-UI_SPEC.md`
   - 再：填充已知页面结构和交互骨架

4. **SECURITY_SPEC.md**
   - 先：`Read {FRAMEWORK_DIR}/templates/spec/L1-SECURITY_SPEC.md`
   - 再：填充认证方式和权限矩阵骨架

> 此阶段只需完成框架和已知内容，FD 实现阶段持续补充。  
> `{FRAMEWORK_DIR}` 见 项目规则与 .sdd/config.json 项目上下文节中的 `{{FRAMEWORK_DIR}}` 值。

---

## Phase 3 检查点

```markdown
## 进度检查点 — Phase 3 完成

✅ 已完成：DATA_SPEC / API_SPEC / UI_SPEC / SECURITY_SPEC（骨架）
📋 下一步：Phase 4 逐 BC 循环，从 BC-01 开始
⚠️ 风险/阻塞：{如有}
```

---

## Phase 4：逐 BC 循环

对每个 BC，加载并执行 `sdd-bc-design`：

```
For each BC in BC清单:
  1. /sdd-bc-design BC-{NN} {名称}
  2. 确认 spec.md 生成 → {{SPEC_DIR}}/bc/bc-{NN}-{domain}/spec.md
  3. 确认聚合根骨架生成 → {CODE_DIRS}/domain/bc-{NN}-{domain}/
  4. 确认 DOMAIN_EVENT_CATALOG.md 已更新
```

**完成标准**：所有 BC 完成后，DOMAIN_EVENT_CATALOG.md 中应包含全部跨 BC 通信事件。

**Quality Gate（推荐）**：每个 BC 设计完成后，用 `sdd-review-spec` 检查 BC spec 质量（AC 格式 + 覆盖矩阵 + 企业规范合规）。所有 BC 通过后再进入 Phase 5。

---

## Phase 5：逐 FD 循环

按 PRODUCT_SPEC.md 中的优先级排序（P0 → P1 → P2），对每个 FD 执行：

```
For each FD in priority_order:
  1. /sdd-generate-uj FD-{NN} {名称}   # 若该 FD 涉及复杂多角色交互（补充详细 UJ/US）
  2. /sdd-implement-feature FD-{NN} {名称}
  3. 确认测试通过
  4. 完成验证；仅在用户授权时 git commit
```

> **与 Phase 1 UJ 的区别**：Phase 1 生成的是跨 BC 骨干 UJ（宏观视角）；Phase 5 的 `sdd-generate-uj` 生成该 FD 内部的详细 UJ，含 A/B/C/D 四类完整 alt 分支，作为 AC 设计的前置输入。

> **横截面文档持续更新**：每个 FD 实现完成后，`sdd-implement-feature` Step 7 自检表（文档门禁）会驱动 DATA_SPEC / API_SPEC / UI_SPEC / SECURITY_SPEC 同步更新——这是 Phase 3 骨架的持续填充机制。

**提交信息格式**：
```
TicketNo: {ticket-id}
Description: {项目名} FD-{NN} {FD名称}：{简要描述}
```

> `sdd-implement-feature` 内部已包含 AC 生成和测试推导流程；
> `sdd-generate-uj` 适用于涉及 ≥2 个角色跨 BC 协作的 FD。

---

## Phase 6：治理文件

### BACKLOG.md 格式

```markdown
| ID | 欠账描述 | 类型 | trigger | 优先级 | 状态 |
|----|---------|------|---------|--------|------|
| B-001 | ... | doc/code/test | module/keyword/scenario | P0-P3 | open |
```

### ADR 记录重要架构决策

每个重大技术决策 → `SDD/03-decisions/ADR-{NNN}-{title}.md`

建议在项目结束时补充的 ADR：
- 技术栈选型（为何选 X 而非 Y）
- BC 边界决策（分界点在哪、为何不合并）
- 异步通信策略（哪些事件、为何异步）

### CHANGELOG.md（可选）

记录按里程碑划分的功能发布历史。

---

## Phase 6 检查点

```markdown
## 进度检查点 — Phase 6 完成（项目启动阶段结束）

✅ 已完成：{列出所有产物}
📋 下一步：进入正常迭代（每个新 FD 使用 /sdd-implement-feature）
⚠️ 风险/阻塞：{如有}
```

---

## 与其他 Skills 的关系

- **调用**：`sdd-bc-design`（Phase 4）、`sdd-implement-feature`（Phase 5）、`sdd-generate-uj`（Phase 5 可选）
- 本 Skill 是调用链的顶点（L3），适合新项目启动或重大重构时使用
- 已有项目迁移：从 Phase 1 开始（补充角色/能力分析），或从 Phase 4 开始（已有 BC 设计）
