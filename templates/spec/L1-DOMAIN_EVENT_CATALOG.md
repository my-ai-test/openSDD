---
title: "{{PROJECT}} 领域事件目录"
type: domain-event-catalog
version: "1.0"
status: "draft"
created: "{{YYYY-MM-DD}}"
---

# 领域事件目录（Domain Event Catalog）

> **职责**: 本文件是所有跨 BC 领域事件的**唯一注册表**。
>
> **强制规则**（来自宪法 §8.5 + DDD_SPEC §2.4 E-6）:
> - 任何在消息总线上发布的领域事件**必须先在此注册**
> - 未注册的事件不得发布（CI Fitness Function 检测）
> - 事件 schema 的非兼容变更必须新增版本（不可破坏现有消费者）
>
> **变更规则**:
> - 新增事件：直接添加条目，更新版本号
> - 添加可选字段（兼容变更）：在当前版本 payload 中添加，注明 `@since: vX.Y`
> - 删除/重命名字段（非兼容变更）：必须新增事件版本（v1 → v2）

---

## 事件目录总览

| 事件 ID | 事件名称 | 生产者 BC | 主要消费者 BC | 当前版本 |
|--------|---------|---------|------------|--------|
| EVT-001 | {{EventName}} | BC-{{NN}} | BC-{{NN}}, BC-{{NN}} | v1 |
| EVT-002 | {{EventName}} | BC-{{NN}} | BC-{{NN}} | v1 |

---

## {{BC-NN}} {{BC名称}} → 发出的事件

### EVT-001: {{EventName}}

**触发条件**: {{何时触发，如：Skill 聚合根状态从 DRAFT 变更为 PENDING}}

```typescript
interface {{EventName}}Payload {
  eventId: string;           // UUID，幂等键
  eventVersion: 'v1';
  occurredAt: string;        // ISO 8601 UTC
  {{aggregateId}}: string;   // 聚合根 ID
  // {{...业务字段}}
}
```

**消费者行为**:

| 消费者 BC | 处理逻辑 | 幂等要求 |
|----------|---------|---------|
| BC-{{NN}} {{名称}} | {{消费后做什么}} | eventId 去重 |

---

### EVT-002: {{EventName}}

**触发条件**: {{何时触发}}

```typescript
interface {{EventName}}Payload {
  eventId: string;
  eventVersion: 'v1';
  occurredAt: string;
  {{aggregateId}}: string;
  // ...
}
```

**消费者行为**:

| 消费者 BC | 处理逻辑 | 幂等要求 |
|----------|---------|---------|
| BC-{{NN}} | {{处理逻辑}} | eventId 去重 |

---

## 事件传输规范

### 消息信封格式

所有事件通过消息总线传递时使用统一信封：

```typescript
interface EventEnvelope<T> {
  envelopeId: string;    // UUID，消息总线级别去重 ID
  eventType: string;     // 如 "Skill.SkillPublished"
  eventId: string;       // 业务级事件 ID（与 payload.eventId 一致）
  eventVersion: string;  // 如 "v1"
  sourceBC: string;      // 如 "BC-01"
  occurredAt: string;    // ISO 8601 UTC
  payload: T;
}
```

### 顺序保证

| 级别 | 保证 | 实现方式 |
|------|------|---------|
| 同一聚合根 | 严格有序 | 按 aggregateId 分区（Kafka）或单队列顺序消费（BullMQ）|
| 跨聚合根 | 不保证顺序 | 消费者检查 occurredAt + 状态机处理乱序 |
| 跨 BC | 最终一致 | 幂等消费 + 指数退避重试 |

### Schema 版本兼容规则

| 变更类型 | 处理方式 |
|---------|---------|
| 新增可选字段 | 向后兼容，直接添加，注明 `@since: vX.Y` |
| 删除字段 | **非兼容变更** → 必须新增事件版本（v1 → v2）|
| 字段类型变更 | **非兼容变更** → 必须新增事件版本 |
| 新增必填字段 | **非兼容变更** → 必须新增事件版本 |
| v1 废弃时机 | 所有消费者迁移至 v2 后，经过 ≥ 2 个发版周期，方可停止发布 v1 |

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | {{YYYY-MM-DD}} | 初始版本 |
