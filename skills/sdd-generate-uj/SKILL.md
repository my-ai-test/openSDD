---
name: sdd-generate-uj
description: This skill should be used when the user asks to "生成用户旅程", "写UJ", "生成US", "generate user journeys", "create user stories", "写UJ和US", "生成用户故事", or mentions generating User Journey (UJ) diagrams and User Story (US) content for USER_JOURNEY_SPEC.md or a feature spec file.
---

> 先读消费项目 `.sdd/config.json` 和框架 `rules/core.md`。FRAMEWORK_DIR、SPEC_DIR、代码路径与测试命令以配置为准；示例 SDD 路径按项目替换。DDD、TypeScript/Jest 和企业规范仅在对应 profile 启用时适用。调用入口见框架 `docs/hosts.md`。


# sdd-generate-uj — 生成用户旅程与用户故事

> **工具 Skill**：系统化生成 User Journey（UJ）和 User Story（US），
> 输出结构化的 `USER_JOURNEY_SPEC.md` 内容和 FD spec 的用户故事节。

---

## 调用时机

本 Skill 在两个阶段被调用，产出范围不同：

| 阶段 | 调用方 | 范围 | 深度 |
|------|--------|------|------|
| **项目初始化 Phase 1-D** | `sdd-init-project` | 全项目高层跨 BC 骨干 UJ | A/D 类为主，主路径节点，无需详细 alt 分支 |
| **FD 实现 Phase 5 前** | `sdd-implement-feature` 前置 / 用户手动 | 单个 FD 的详细 UJ | A/B/C/D 四类完整展开，含 alt 分支，作为 AC 前置输入 |

> 同一 UJ 不需要生成两次。Phase 1 生成后，Phase 5 只补充 Phase 1 未覆盖的 FD 内部细节。

---

## 输入

1. **FD 编号和名称**（或"全项目 UJ 生成"）
2. **参与角色清单**（如：user、reviewer、approver、admin、guest）
3. **业务流程描述**（已知的主要步骤，草稿即可）

---

## 执行流程

### 阶段一：锚定用户活动脊梁节点

从业务描述中提取**活动节点**（动词短语），形成活动序列：

```
创建 → 提交 → 审核 → 发布 → 下架 → 归档
注册 → 申请 → 审批 → 授权
搜索 → 发现 → 安装 → 使用 → 评价
```

每个节点对应一个或多个 UJ。

### 阶段二：角色 × 活动矩阵

```markdown
| 活动节点 | {角色A} | {角色B} | {角色C} | {角色D} | guest |
|---------|---------|---------|---------|---------|-------|
| 创建资源 | ✅ 主路径 | ❌ | ❌ | ✅ | ❌ |
| 提交审核 | ✅ 主路径 | ❌ | ❌ | ❌ | ❌ |
| 审核资源 | ❌ | ✅ 主路径 | ✅ 主路径 | ❌ | ❌ |
```

> 将 `{角色A/B/C/D}` 和 `创建/提交/审核资源` 替换为项目实际角色和活动节点。

矩阵中每个 ✅ 单元格 = 至少一个 UJ。

### 阶段三：按四类 UJ 模式生成

**UJ 命名规范**：`UJ-{BC编号}-{NN}-{类型}`

| 格式 | 说明 | 示例 |
|------|------|------|
| `UJ-{BC编号}-{NN}-A/B/C/D` | 标准格式：BC 编号（01/02…）+ 序号 + 类型字母 | `UJ-01-01-A`（BC-01 第1个主路径 UJ）|
| `UJ-{BC缩写}-{NN}-A/B/C/D` | 可读格式：BC 英文缩写 + 序号 + 类型字母（可选）| `UJ-ORD-01-A`（Order BC 第1个 UJ）|

> **选哪种**：项目统一选定一种，在 项目规则与 .sdd/config.json 或 USER_JOURNEY_SPEC.md 开头声明。
> 同一项目内不允许混用两种格式。

---

**A 类：主路径（Happy Path）**
```
ID:    UJ-{BC编号}-{NN}-A
Title: {角色} {动作} {对象}（主路径）
参与角色: {角色列表}
前置条件: {系统状态}
主路径步骤: 1. ... 2. ... 3. ...
alt 分支: {至少1个，如：权限不足/资源不存在}
关键 FD: {FD-NN, FD-MM}
```

**B 类：失败与恢复（Failure & Recovery）**
```
ID:    UJ-{BC编号}-{NN}-B
Title: {失败场景}（失败恢复）
触发事件: {错误/异常发生}
恢复路径: {系统如何响应，用户如何处理}
alt 分支: {恢复成功 / 恢复失败 → 人工介入}
```

**C 类：通知驱动（Notification-Driven）**
```
ID:    UJ-{BC编号}-{NN}-C
Title: 通知 {触发条件}（通知驱动）
触发方: {事件来源 BC}
接收方: {通知对象角色}
通知内容: {关键信息}
用户后续行动: {点击通知后的路径}
```

**D 类：治理与管理（Governance）**
```
ID:    UJ-{BC编号}-{NN}-D
Title: {管理员} 管理 {资源}（治理管理）
管理操作: {列表}
合规要求: {审计/权限约束}
```

### 阶段四：生成 Mermaid 序列图

每个 UJ 必须有 sequenceDiagram：

```markdown
​```mermaid
sequenceDiagram
  participant U as User
  participant S as System
  participant R as ReviewService

  U->>S: 提交{资源}
  S-->>U: 返回 resourceId

  U->>S: 触发审核
  S->>R: 触发 ResourceSubmittedEvent

  alt 审核通过
    R-->>U: 通知：{资源}已发布
  else 审核驳回
    R-->>U: 通知：附驳回原因
    U->>S: 修改后重新提交
  end
​```
```

### 阶段五：UJ 完备性检查（8 项）

```markdown
| 检查项 | 结果 |
|--------|------|
| 1. 每个活动脊梁节点都有至少一个 UJ | |
| 2. 每个 UJ 含 ≥1 个 alt/else 分支 | |
| 3. A/B/C/D 四类 UJ 都有覆盖 | |
| 4. 每个 UJ 有 Mermaid sequenceDiagram | |
| 5. UJ 使用 BC 命名（非 FD 命名）| |
| 6. 所有参与角色在至少一个 UJ 中出现 | |
| 7. UJ 不包含 AC/BR 细节（仅宏观流程）| |
| 8. 关键 FD 与 UJ 双向链接 | |
```

有 ❌ 立即补充，不得跳过。

---

### 阶段六：从 UJ 提取用户故事（US）

**US 来源规则**：从 UJ 的每个步骤提取，不从功能点推导。

**四类 US 模板**：

```markdown
# US-M（主路径）
As a {角色},
I want to {操作},
So that {商业价值}.

# US-F（失败路径）
As a {角色},
When {错误发生},
I want to {获得错误提示/恢复能力},
So that {可以继续/知道下一步}.

# US-N（通知驱动）
As a {角色},
When {事件触发},
I want to be notified about {内容},
So that {可以采取行动}.

# US-G（治理管理）
As a {管理角色},
I want to {管理操作},
So that {合规/监管目的}.
```

**INVEST 自检**（每个 US 回答）：
- Independent（独立，不依赖其他 US 实现）→ Y/N
- Negotiable（可协商范围）→ Y/N
- Valuable（有业务价值）→ Y/N
- Estimable（可估算工作量）→ Y/N
- Small（足够小，一个 Sprint 可完成）→ Y/N
- Testable（可测试，有 AC）→ Y/N

### 阶段七：US 完备性检查（7 项）

```markdown
| 检查项 | 结果 |
|--------|------|
| 1. 每个 UJ 主路径步骤都有对应 US | |
| 2. 有失败场景 UJ → 有 B 类 US | |
| 3. 有通知场景 → 有 C 类 US | |
| 4. 所有 US 通过 INVEST 检验 | |
| 5. US 不包含实现细节（不提 API 路径）| |
| 6. US 与 UJ 双向链接（US 注明来源 UJ）| |
| 7. 驳回/拒绝场景有专属 US | |
```

---

## 输出产物

1. **`USER_JOURNEY_SPEC.md`**：所有 UJ（含 Mermaid 图）
2. **`SDD/01-specs/features/{FD编号}/spec.md` 的"用户故事"节**：所有 US + INVEST 检验

---

## 与其他 Skills 的关系

- 本 Skill 输出是 `sdd-write-ac` 的前置输入（US → AC）
- 可在 `sdd-implement-feature` Step 1 之前调用（需要 UJ/US 时先行生成）；也可由 `sdd-init-project` Phase 4 驱动
- 也可独立调用，用于产品规划阶段的 UJ 梳理
