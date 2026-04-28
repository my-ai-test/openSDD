---
title: "{{BC编号}}: {{BC名称}}"
type: bc-spec
bc_id: "{{BC-NN}}"
subdomain_type: "{{core | supporting | generic}}"
version: "1.0"
status: "draft"
created: "{{YYYY-MM-DD}}"
author: "{{作者}}"
team_owner: "{{负责团队}}"
aggregate_roots: ["{{聚合根1}}", "{{聚合根2}}"]
ddd_spec_ref: "SDD/01-specs/DDD_SPEC.md"
event_catalog_ref: "SDD/01-specs/DOMAIN_EVENT_CATALOG.md"
---

# {{BC编号}}: {{BC名称}}

> **子域类型**: {{核心域 / 支撑子域 / 通用子域}}
> **核心职责**: {{一句话描述此 BC 解决什么业务问题，覆盖什么"通用语言"范围}}
> **团队所有权**: {{负责团队名称}}

---

## 1. 通用语言（Ubiquitous Language）

> 本 BC 内所有术语的唯一权威定义。同一术语在不同 BC 中可能含义不同，以本表为准。

| 术语（中文）| 术语（英文）| 定义 |
|-----------|-----------|------|
| {{术语}} | {{Term}} | {{精确定义，1-2 句话}} |
| {{术语}} | {{Term}} | {{定义}} |

---

## 2. 聚合根详述

> 每个聚合根对应一个事务边界。不变量（Invariants）是系统必须始终维护的业务约束。

### 2.1 {{聚合根名称1}}

**核心职责**: {{一句话描述}}

**不变量（Invariants）**（必须在聚合根方法内强制执行）:

| 编号 | 不变量描述 | 违反时的错误码 |
|------|-----------|-------------|
| INV-001 | {{如：slug 全局唯一，不区分大小写}} | `errorcode.{ns}.{module}.slugExists` |
| INV-002 | {{如：ARCHIVED 是终态，不可转为其他状态}} | `errorcode.{ns}.{module}.invalidStateTransition` |

**状态机**（如适用）:

```
{{STATE_A}} --{{事件}}--> {{STATE_B}}
{{STATE_B}} --{{事件}}--> {{STATE_C}}
{{STATE_B}} --{{事件}}--> {{STATE_A}}（回滚）

终态: {{STATE_C}}（不可出）
```

**TypeScript 聚合根骨架**:

```typescript
export class {{AggregateRoot}} extends AggregateRoot {
  private constructor(
    private readonly {{id}}: string,
    private {{field}}: {{Type}},
    // ...
  ) { super(); }

  static create(props: Create{{AggregateRoot}}Props): {{AggregateRoot}} {
    // 验证创建时不变量
    const aggregate = new {{AggregateRoot}}(props.{{id}}, ...);
    aggregate.addDomainEvent(new {{AggregateRoot}}CreatedEvent({ {{id}}: aggregate.{{id}} }));
    return aggregate;
  }

  {{method}}(): void {
    // INV-001: 状态检查
    if (this.status !== {{ValidStatus}}) {
      throw new DomainException('errorcode.{ns}.{module}.invalidStateTransition');
    }
    this.status = {{NewStatus}};
    this.addDomainEvent(new {{AggregateRoot}}{{Method}}edEvent({ {{id}}: this.{{id}} }));
  }
}
```

### 2.2 {{聚合根名称2}}（如有）

{{同上格式}}

---

## 3. 实体和值对象

### 3.1 实体（隶属于聚合根，有生命周期）

| 实体 | 隶属聚合根 | 说明 |
|------|----------|------|
| `{{Entity}}` | `{{AggregateRoot}}` | {{一句话说明}} |

### 3.2 值对象（不可变，无 ID）

| 值对象 | 使用场景 | 说明 |
|-------|---------|------|
| `{{ValueObject}}` | `{{AggregateRoot}}` | {{如：Money = 金额 + 货币代码，内置加法逻辑}} |

---

## 4. 领域服务

> 领域服务是跨聚合根的无状态业务逻辑，**不可包含 IO 操作**。

| 服务名 | 职责 | 输入 | 输出 |
|--------|------|------|------|
| `{{DomainService}}` | {{如：计算两个聚合根的关联关系}} | {{参数}} | {{返回值}} |

```typescript
// 领域服务示例
export class {{DomainService}} {
  {{method}}({{params}}): {{ReturnType}} {
    // 纯计算逻辑，无 IO 依赖
  }
}
```

---

## 5. 此 BC 发出的领域事件

> 每个事件必须已在 `DOMAIN_EVENT_CATALOG.md` 注册。未注册事件不得在消息总线上发布。

| 事件 ID | 事件名称 | 触发条件 | 主要消费者 BC |
|--------|---------|---------|------------|
| EVT-{{NNN}} | `{{EventName}}` | {{何时触发，如：聚合根状态变更为 PUBLISHED}} | BC-{{NN}} {{名称}} |

---

## 6. 此 BC 消费的外部事件

| 事件 ID | 事件名称 | 来源 BC | 处理逻辑摘要 |
|--------|---------|---------|------------|
| EVT-{{NNN}} | `{{EventName}}` | BC-{{NN}} | {{消费后做什么，如：触发索引更新}} |

---

## 7. API 端点

> 此 BC 对外（Interface Layer）暴露的接口。详细规格见 `API_SPEC.md`。

| 方法 | 路径 | 说明 | 引用 |
|------|------|------|------|
| POST | `/api/v1/{{resource}}` | 创建{{聚合根}} | API_SPEC §{{N}} |
| GET | `/api/v1/{{resource}}/:id` | 查询{{聚合根}} | API_SPEC §{{N}} |
| PUT | `/api/v1/{{resource}}/:id/{{action}}` | 执行{{操作}} | API_SPEC §{{N}} |

---

## 8. 数据边界

> 此 BC 拥有（Owner）的数据库表。其他 BC 不可直接写这些表，只能通过此 BC 的 API 或事件。

| 表名 | 对应聚合根 | 引用 |
|------|----------|------|
| `{{PREFIX}}_{{NAME}}_T` | `{{AggregateRoot}}` | DATA_SPEC §3.{{N}} |

---

## 9. Context Map 上下游

> 显式声明此 BC 与其他 BC 的关系。

| 方向 | BC | 关系模式 | 说明 |
|------|----|---------|------|
| 上游 → 本 BC | BC-{{NN}} {{名称}} | {{Conformist / Customer-Supplier / OHS / ACL}} | {{如：消费其发出的 SkillPublished 事件}} |
| 本 BC → 下游 | BC-{{NN}} {{名称}} | {{PubSub / OHS / Conformist}} | {{如：发布 ReviewCompleted 事件，BC-01 消费}} |

**防腐层（ACL）说明**（如有外部系统依赖）:

| 外部系统 | ACL 职责 | 本 BC 内部概念 |
|---------|---------|-------------|
| {{如：IDaaS / OIDC}} | 将外部用户模型翻译为本 BC 的 User 聚合 | `User` 聚合根 |

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| 1.0 | {{YYYY-MM-DD}} | 初始版本 | {{作者}} |
