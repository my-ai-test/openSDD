---
name: sdd-bc-design
description: This skill should be used when the user asks to "设计BC", "领域建模", "design a bounded context", "create BC spec", "聚合根设计", "划分BC边界", or mentions designing a Bounded Context with aggregates, domain events, invariants, value objects, and context mapping.
version: 1.0.0
user-invocable: true
argument-hint: "<BC编号> <BC名称>"
---

# /sdd-bc-design — BC 领域设计

> **L2 Skill**：为一个限界上下文（Bounded Context）完成完整的领域模型设计，
> 输出 BC spec、聚合根骨架、领域事件清单。

---

## 前置门禁

**调用此 Skill 前，必须确认 `{{SPEC_DIR}}/DDD_SPEC.md` 已就位**（默认：`SDD/01-specs/DDD_SPEC.md`）：
- 若存在 → 先 `Read DDD_SPEC.md §1.3 BC 清单` 和 `§2–§7 架构约束`，以此为设计约束
- 若不存在 → 停止，提示用户先完成 `/sdd-init-project Phase 2`（DDD 战略设计 + DDD_SPEC 创建）

## 输入

1. **BC 编号和名称**（如：BC-03 审核工作流）
2. **业务背景描述**（2-5 句话说明这个 BC 解决什么问题）
3. **已知的主要业务概念**（可选，草稿即可）
4. **与其他 BC 的已知交互**（可选）

---

## 执行流程

### 阶段一：战略设计——识别 BC 边界

**语言边界测试**（"同一词在不同上下文含义不同" → BC 边界存在）：
- 列出所有业务术语
- 检查是否同一术语在不同业务场景含义不同
- 含义不同 → 分属不同 BC

**变化频率分析**：
- 高变化频率 + 低耦合 → 独立 BC
- 核心业务 vs 支撑 vs 通用 → 确定 BC 类型

**输出**：BC 职责说明（一句话）、语言边界（统一语言词汇表草稿）

---

### 阶段二：战术设计——识别聚合根

**聚合根识别标准**：
1. 有生命周期（创建 → 变更 → 终止）
2. 有不变量需要强制执行（业务规则）
3. 是事务边界（一次操作只改一个聚合根）

**聚合根设计原则**：
```
✅ 业务规则在聚合根方法内强制执行（非 AppService 直接赋值）
✅ 一个事务只修改一个聚合根
✅ 通过 ID 引用其他聚合根（不直接持有对象）
✅ 聚合根内部状态私有（通过方法变更，get 暴露只读视图）

❌ AppService 直接操作聚合根字段
❌ 跨聚合根事务
❌ 聚合根直接持有另一 BC 的聚合根引用
```

**对每个聚合根输出**：
- 核心属性（身份标识 + 业务属性 + 状态）
- 命令方法（状态变更操作，含不变量检查）
- 工厂方法：`create()`（新建，生成 ID + 触发创建事件）+ `reconstitute()`（从持久化重建，不触发事件）
- 领域事件（每次状态变更触发的事件）

> 工厂方法命名约定（TypeScript 用 `static`，其他语言按惯例：Java 用静态工厂，Python 用 `@classmethod`，Go 用构造函数）

---

### 阶段三：识别值对象

**值对象识别标准**：
- 无唯一身份（相同值就是同一个）
- 不可变（创建后不修改，需变更则替换）
- 有内在不变量（如 Email 格式、SlugRule 正则）

> 以下代码为 **TypeScript / NestJS** 示例，其他技术栈参见：
> - Java/Spring：`sdd-framework/examples/java/`（待补充）
> - Python：`sdd-framework/examples/python/`（待补充）
> - Go：`sdd-framework/examples/go/`（待补充）

```typescript
// 值对象模板（TypeScript）
export class XxxValueObject {
  private constructor(private readonly _value: string) {}

  static from(raw: string): XxxValueObject {
    if (!isValid(raw)) {
      // DomainException(moduleName, exceptionName, message)
      // → errorCode 自动组装为 errorcode.{appname}.{moduleName}.{exceptionName}
      // appname 由项目 DomainException 基础类从应用配置读取
      throw new DomainException('module', 'invalidXxx', `Invalid: ${raw}`);
    }
    return new XxxValueObject(raw);
  }

  get value(): string { return this._value; }
  equals(other: XxxValueObject): boolean { return this._value === other._value; }
}
```

**其他语言等价实现要点**（语言无关）：
- 构造器私有，通过工厂方法创建（`from()` / `of()` / `create()`）
- 工厂方法内校验不变量，不合法则抛领域异常
- 提供值相等性比较（覆盖 `equals()`/`__eq__()`/`Equal()`）
- 不提供 setter，状态只读

---

### 阶段四：领域事件设计

**事件命名规范**：`{聚合根名}{动作过去式}Event`（如：`OrderSubmittedEvent`）

**事件触发时机**：聚合根命令方法执行成功后，在方法内部 `addDomainEvent()`

**跨 BC 通信规则**：
```
同 BC 内：聚合根方法直接调用 → 同步
跨 BC 写操作：必须通过领域事件（EventBus）→ 异步
跨 BC 读操作：允许通过 Port 接口查询 → 同步
```

**每个领域事件输出**：
```markdown
| 事件 ID | 事件名称 | 触发聚合根 | 触发时机 | 下游消费方 |
|---------|---------|----------|---------|----------|
| EVT-001 | {AggName}SubmittedEvent | {AggName} | submit() | BC-{NN} {名称} |
```

并在 `{{SPEC_DIR}}/DOMAIN_EVENT_CATALOG.md` 中注册（默认路径：`SDD/01-specs/DOMAIN_EVENT_CATALOG.md`）。

---

### 阶段五：BC Spec 文件生成

输出 `{{SPEC_DIR}}/bc/bc-{NN}-{domain}/spec.md`（默认：`SDD/01-specs/bc/bc-{NN}-{domain}/spec.md`），包含以下 9 个节：

```markdown
---
bc-id: BC-{NN}
bc-name: {中文名}
status: draft | review | approved
---

## 1. 职责声明（一句话）

## 2. 统一语言（Ubiquitous Language）

## 3. 聚合根清单

## 4. 值对象清单

## 5. 领域事件清单

## 6. 资源库 Port 接口

## 7. 与其他 BC 的关系（Context Map）

## 8. 业务规则（BR）

## 9. 不变量（Invariants）
```

---

### 阶段六：DDD 合规检查（5 项）

```markdown
| DDD 检查项 | 状态 | 说明 |
|-----------|------|------|
| 层级归属正确 | ✅/❌ | 业务规则在 Domain Layer |
| 聚合根不变量已在方法内强制 | ✅/❌ | 非 Service 直接赋值 |
| 事务边界 = 单聚合根 | ✅/❌ | 无跨聚合根事务 |
| 领域事件已注册 DOMAIN_EVENT_CATALOG | ✅/❌ | |
| BC 间依赖通过事件（写）或 Port（读）| ✅/❌ | 无直接跨 BC 调用 |
```

---

## 输出产物

1. `{{SPEC_DIR}}/bc/bc-{NN}-{domain}/spec.md` — BC 规格文件（默认：`SDD/01-specs/bc/bc-{NN}-{domain}/spec.md`）
2. `{CODE_DIRS}/domain/bc-{NN}-{domain}/` — 聚合根 + 值对象骨架代码（含 TODO 标注）；`CODE_DIRS` 对应 CLAUDE.md 中 `{{CODE_DIRS}}` 配置，如 `apps/api/src` 或 `src`
3. `{{SPEC_DIR}}/DOMAIN_EVENT_CATALOG.md` 新增条目（默认：`SDD/01-specs/DOMAIN_EVENT_CATALOG.md`）

---

## 与其他 Skills 的关系

- 通常在 `/sdd-init-project` 中调用（逐 BC 循环）
- 每个 BC 完成后，用 `/sdd-implement-feature` 逐一实现各 FD
