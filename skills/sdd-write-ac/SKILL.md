---
name: sdd-write-ac
description: This skill should be used when the user asks to "写验收标准", "生成AC", "write acceptance criteria", "create AC for a feature", "补充spec的AC节", or mentions generating testable acceptance criteria (AC) for a Feature Domain spec file using the EARS format and six-layer model.
version: 1.0.0
user-invocable: true
argument-hint: "<FD编号> <FD名称>"
---

# /sdd-write-ac — 写验收标准（AC 生成）

> **L1 Skill**：将特性描述展开为完整的、可测试的验收标准（Acceptance Criteria）。
> 适用于新建 FD spec 或补充已有 spec 中的 AC 节。

---

## 输入

调用此 Skill 时，请提供以下信息（若未提供，逐项追问）：

1. **FD 编号和名称**（如：FD-03 商品搜索）
2. **用户故事**（或功能点描述，可以是草稿）
3. **相关 API 端点**（如已知，格式：`POST /api/v1/skills`）
4. **已有 spec.md 路径**（如需补充已有文件）

---

## 执行流程

### 阶段一：功能点枚举（双路来源）

从两个来源提取功能点，取并集：

**来源 A：用户故事动词短语**
- 扫描所有 US，提取动词短语（创建、查询、更新、删除、提交、审批、撤销…）
- 每个动词短语 = 一个潜在功能点

**来源 B：API 端点表**
- 每个端点 = 至少一个 AC
- 填写端点覆盖矩阵（见下方）

### 阶段二：按 AC 类型展开六层模型

> 权威来源：`sdd-framework/standards/six-layer-model.md`（含 AC 类型识别指南与展开示例）

识别每个功能点的 AC 类型，按对应层次展开：

| 层 | CRUD 类 | 状态机类 | 输入校验类 | 权限控制类 | 搜索/查询类 |
|----|---------|---------|----------|----------|-----------|
| L1 等价类 | M | M | M | M | M |
| L2 边界值 | M | O | M | M | O |
| L3 决策表 | O | M | — | M | — |
| L4 状态转换 | — | M | — | O | — |
| L5 组合测试 | O | O | — | O | M |
| L6 错误猜测 | M | M | M | M | M |

> M=必须生成，O=推荐生成，—=通常不适用

### 阶段三：EARS 格式写作

每条 AC 使用以下格式之一：

```
# 功能触发场景（WHEN）
WHEN <前置条件>，<触发动作>
THEN <系统/用户可观测的结果>
AND <附加可观测结果>（如有）

# 持续约束（WHILE）
WHILE <状态持续>
THE SYSTEM SHALL <约束行为>

# 不期望行为（IF）
IF <异常/边界条件>
THEN <错误响应>（含错误码格式：errorcode.{appname}.{module}.{exception}）
```

**禁止写法**：
- ❌ "系统应该正确处理" — 不可观测
- ❌ "验证逻辑正确" — 内部实现细节
- ❌ "性能满足要求" — 无具体数值

### 阶段四：填写端点覆盖矩阵

```markdown
| 端点 | 方法 | AC 编号 | 覆盖层次 |
|------|------|---------|---------|
| /api/v1/xxx | POST | AC-001, AC-002 | L1,L2,L6 |
| /api/v1/xxx/:id | GET | AC-003 | L1,L6 |
```

> 矩阵中出现 ❌（端点无对应 AC）= 不完整，必须当场补充 AC

### 阶段五：AC 质量自检（10 项）

输出以下检查表，每项填 ✅ 或 ❌：

```markdown
| 检查项 | 结果 |
|--------|------|
| 1. 每个 US 动词短语都有对应 AC | |
| 2. 每个 API 端点至少有 1 条 AC | |
| 3. 所有 AC 使用 EARS 格式 | |
| 4. AC 描述可观测结果（非内部行为）| |
| 5. 状态机 AC 包含非法转换场景 | |
| 6. 权限 AC 有决策表（角色×操作）| |
| 7. 输入校验 AC 有边界值（恰好/超出）| |
| 8. 所有错误 AC 含错误码格式 | |
| 9. 端点覆盖矩阵无 ❌ | |
| 10. BR（业务规则）已提取为独立条目 | |
```

有 ❌ 的项必须立即补充，不得关闭任务。

---

## 输出格式

将生成的 AC 写入 spec.md 的"验收标准"节。**主体使用 EARS 格式**，多场景时用表格展开。

```markdown
## 验收标准（AC）

### AC-001：[功能点名称] — [AC 类型：CRUD/状态机/校验/权限/查询]

WHEN [用户/系统] [执行何种操作，前置条件成立]
THEN 系统 [可观测的结果，含 HTTP 状态或返回字段]
AND [附加可观测结果，如有]

IF [异常/边界条件]
THEN 系统返回错误，errorCode = `errorcode.{appname}.{module}.{exception}`

> 多场景时用表格枚举（辅助，不替代 EARS 主句）：
>
> | 场景 | 关键输入 | 预期输出 | 错误码 |
> |------|---------|---------|--------|
> | 正常路径 | 有效数据 | 201 + DTO | — |
> | 边界值 | 恰好 N 字符 | 201 + DTO | — |
> | 超出范围 | N+1 字符 | 200 + error | errorcode.{appname}.{module}.invalidInput |
> | 资源不存在 | 无效 id | 200 + error | errorcode.{appname}.{module}.notFound |
```

**格式规则**：
- EARS 主句描述**业务意图**（不可缺少）
- 场景表描述**测试枚举**（辅助 `/sdd-write-tests` 生成测试，可选）
- 错误 AC 中错误码必须用完整格式，不得只写 `notFound`

---

## 与其他 Skills 的关系

- 本 Skill 的输出是 `/sdd-write-tests` 的输入
- 通常由 `/sdd-implement-feature` 在第 2 步自动调用
- 若需先生成 UJ/US，先运行 `/sdd-generate-uj`
