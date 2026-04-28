---
title: "{{PROJECT}} DDD 实施规范"
type: ddd-spec
version: "1.0"
status: "draft"
created: "{{YYYY-MM-DD}}"
constitution_ref: "SDD/00-constitution/CONSTITUTION.md"
---

# DDD 实施规范（DDD_SPEC）

> **职责**: 本文件是 {{PROJECT}} 系统设计的架构宪章，定义限界上下文（BC）边界识别规则、聚合根设计规范、分层架构约束、BC 间通信规范、领域事件设计规则及架构适应性函数。
>
> 所有工程代码必须符合本规范，违反任何一项视为架构违规，必须在 PR 合并前修复。

---

## 1. 战略设计规范

### 1.1 子域分类规则

| 子域类型 | 判断标准 | 投资策略 | 示例 |
|---------|---------|---------|------|
| 核心域（Core Domain）| 平台差异化竞争优势，无可替代 | 最高投入，核心团队自研 | {{填写项目核心域}} |
| 支撑子域（Supporting）| 支撑核心域，有业务规则复杂度 | 精心设计，可适度复用 | {{填写支撑子域}} |
| 通用子域（Generic）| 行业通用，可采购 | 优先采购，ACL 隔离 | {{填写通用子域}} |

### 1.2 BC 边界识别四测试

在划定 BC 边界之前，用以下四个测试验证边界是否合理：

1. **通用语言测试**: 同一业务概念在不同场景下含义是否一致？含义不一致 → 需要拆分 BC
2. **聚合根测试**: 哪些数据对象需要在同一事务中保持一致？同事务 → 同一 BC
3. **写所有权测试**: 谁有权修改这个对象的状态？拥有写权 → 该对象属于该 BC
4. **团队边界测试**: 哪个团队对这块功能负完全责任？团队边界 ≈ BC 边界

### 1.3 本项目 BC 清单

| BC 编号 | 名称 | 子域类型 | 主要聚合根 | 负责团队 |
|--------|------|---------|---------|---------|
| BC-01 | {{BC名称}} | 核心域 | {{聚合根}} | {{团队}} |
| BC-02 | {{BC名称}} | 核心域 | {{聚合根}} | {{团队}} |
| BC-03 | {{BC名称}} | 支撑子域 | {{聚合根}} | {{团队}} |

### 1.4 Context Map

> BC 间关系模式说明

| 关系模式 | 含义 | 适用场景 |
|---------|------|---------|
| Conformist | 下游完全遵从上游模型，不做转换 | 两个 BC 紧密相关，模型自然一致 |
| Customer/Supplier | 上下游有 SLA 协议，下游可向上游提需求 | 有稳定 API 契约的服务依赖 |
| Open Host Service | 上游发布正式协议，多下游接入 | 平台级 API 提供方 |
| Anti-Corruption Layer | 下游翻译上游或外部系统的概念 | 集成第三方系统（IDaaS、ERP 等）|
| Publish/Subscribe | 生产者发布事件，消费者订阅 | 异步跨 BC 状态变更通知 |

```
{{在此绘制 Context Map，可使用 ASCII 图或表格}}

BC-01 [{{BC名称}}] --PubSub--> BC-02 [{{BC名称}}]
BC-01 [{{BC名称}}] --OHS--> BC-03 [{{BC名称}}]
BC-04 [{{BC名称}}] --ACL--> ExternalSystem
...
```

---

## 2. 战术设计规范

### 2.1 聚合规则（A-1 到 A-5）

**A-1: 聚合内保持强一致性，聚合间最终一致性**

```typescript
// ✅ 同一事务内修改同一聚合根的多个值对象
class Order {
  addItem(item: OrderItem): void {
    this.items.push(item);           // 同一聚合内
    this.totalAmount = this.calculateTotal(); // 不变量在聚合根内维护
  }
}

// ❌ 一个事务修改两个聚合根
// order.confirm() + inventory.reduce() — 禁止，应改为领域事件
```

**A-2: 聚合根是外部唯一访问入口**

```typescript
// ✅ 通过聚合根修改子实体
order.updateShippingAddress(newAddress);

// ❌ 直接操作子实体
order.shippingAddress.city = 'Beijing'; // 绕过聚合根不变量
```

**A-3: 跨聚合只持有 ID 引用，不持有对象引用**

```typescript
// ✅ 持有 ID
class ReviewTask {
  skillId: string;          // 只持有 Skill 的 ID
  versionId: string;
}

// ❌ 持有对象引用
class ReviewTask {
  skill: Skill;             // 禁止：跨聚合持有对象引用
}
```

**A-4: 聚合应尽量小**

- 一个聚合根 + 必须一致的子实体（通常 1-5 个）
- 如果子实体可以独立查询，考虑提取为独立聚合根
- 过大的聚合 = 过大的事务 = 性能瓶颈

**A-5: 业务不变量必须在聚合根方法内强制执行**

```typescript
// ✅ 不变量在聚合根方法内
class {{AggregateRoot}} {
  {{method}}(): void {
    if (this.status !== {{ExpectedStatus}}) {
      throw new DomainException('errorcode.{ns}.{module}.invalidStateTransition');
    }
    // 执行状态变更
    this.status = {{NewStatus}};
    this.addDomainEvent(new {{DomainEvent}}(this.id));
  }
}

// ❌ 贫血模型：Application Service 直接赋值（违反不变量保护）
entity.status = 'ACTIVE'; // 禁止
```

### 2.2 实体 vs 值对象判断

| 特征 | 实体（Entity）| 值对象（Value Object）|
|------|-------------|-------------------|
| 标识 | 有唯一 ID | 无 ID，由属性值定义 |
| 相等判断 | ID 相等 = 同一对象 | 所有属性相等 = 相等 |
| 可变性 | 可以随时间变化 | 不可变（替换而非修改）|
| 示例 | `Order`（有 orderId）| `Money`（金额+货币）|

### 2.3 领域服务 vs 应用服务判断

```
新逻辑包含业务判断（if/switch）？
  → 是：领域层（聚合根方法 or 领域服务）
  → 否：应用服务层

新逻辑跨越多个聚合根但有业务含义？
  → 是：领域服务（无状态，在 domain/ 下）
  → 否：应用服务（编排，在 application/ 下）

示例：
  PricingCalculator（根据规则计算订单价格）→ 领域服务（有业务规则）
  CheckoutUseCase（调用多个 BC 完成下单流程）→ 应用服务（用例编排）
```

### 2.4 领域事件设计规则（E-1 到 E-6）

**E-1: 命名格式** — `{SourceBC}.{AggregateRoot}{PastTenseVerb}`

```typescript
// ✅ 正例
SkillPublished      // Skill BC，Skill 聚合根，已发布
ReviewDecisionMade  // Review BC，ReviewTask 聚合根，决策已做出

// ❌ 反例
SkillPublishEvent   // 不用 Event 后缀
PublishSkill        // 不用祈使句
```

**E-2: 事件只描述已经发生的事实，不包含意图**

```typescript
// ✅ 已发生的事实
interface SkillPublishedPayload { skillId: string; publishedAt: string; ... }

// ❌ 包含意图（命令）
interface PublishSkillCommand { skillId: string; }
```

**E-3: payload 不可变，一旦发布不可修改** — schema 变更需新版本

**E-4: 每个事件包含 `eventId`（幂等键）和 `occurredAt`（ISO 8601 UTC）**

**E-5: 事件在聚合根方法内通过 `addDomainEvent()` 注册，由基础设施层负责发布**

```typescript
class Skill {
  publish(): void {
    // ... 执行发布逻辑
    this.addDomainEvent(new SkillPublishedEvent({ skillId: this.id, ... }));
  }
}
// Application Service 负责 repository.save() 后触发 event 发布
// Infrastructure 通过 Transactional Outbox 保证可靠发布
```

**E-6: 跨 BC 事件必须在 `DOMAIN_EVENT_CATALOG.md` 注册后才能发布**

---

## 3. 分层架构合规

### 3.1 四层架构强制依赖方向

```
Interface Layer → Application Service Layer → Domain Layer → Infrastructure Layer

禁止反向：
✗ Domain 不可 import Infrastructure 实现类（只可 import Port 接口）
✗ Application Service 不可包含 if (role === 'xxx') 等业务规则
✗ Interface Layer 不可直接操作 Repository
✗ Infrastructure 不可包含业务逻辑
```

### 3.2 各层允许/禁止清单

| 层级 | 允许 | 禁止 |
|------|------|------|
| Domain | 聚合根、实体、值对象、领域服务、端口接口（Port）、领域事件 | import 任何 Infrastructure 实现类、HTTP/DB 操作 |
| Application | 用例编排、DTO 转换、权限前置检查、Saga 补偿 | 业务规则（if/switch 逻辑）、直接 DB 操作 |
| Infrastructure | Repository 实现、消息发布、外部 API 调用、ACL 防腐层 | 业务规则、UI 逻辑 |
| Interface | Controller、Resolver、BFF、表单验证 | 业务规则、直接操作 Repository |

### 3.3 代码目录结构约定

```
src/
├── domain/
│   ├── {bc-name}/
│   │   ├── aggregates/        ← 聚合根类
│   │   ├── value-objects/     ← 值对象
│   │   ├── domain-services/   ← 领域服务
│   │   ├── events/            ← 领域事件定义
│   │   └── ports/             ← Repository 接口（Port）
├── application/
│   ├── {bc-name}/
│   │   ├── use-cases/         ← 应用服务（用例）
│   │   └── dtos/              ← DTO
├── infrastructure/
│   ├── persistence/           ← Repository 实现（Prisma/ORM）
│   ├── messaging/             ← 事件发布（BullMQ/RabbitMQ）
│   └── acl/                   ← 防腐层（外部系统适配器）
└── interfaces/
    ├── http/                  ← REST Controller
    └── graphql/               ← GraphQL Resolver
```

---

## 4. BC 间通信规范

### 4.1 写操作：必须通过领域事件（异步，最终一致）

```typescript
// ✅ BC-01 Order 确认时，通过事件通知 BC-02 扣减库存
class Order {
  confirm(): void {
    this.status = OrderStatus.CONFIRMED;
    this.addDomainEvent(new OrderConfirmedEvent({ orderId: this.id }));
    // BC-02 监听此事件，自行扣减库存
  }
}

// ❌ BC-01 直接调用 BC-02 的写方法
inventoryService.deduct(item); // 禁止：跨 BC 直接写调用
```

### 4.2 读操作：允许同步查询（不引发状态变更）

```typescript
// ✅ BC-02 库存服务查询 BC-01 订单信息（只读）
const order = await orderQueryService.findById(orderId);
// 只是读取，不修改 Order 状态
```

### 4.3 事件可靠性要求

| 要求 | 规范 |
|------|------|
| 发布可靠性 | Transactional Outbox：事件先写 DB，再异步发布到总线 |
| 消费幂等 | 消费者以 `eventId` 为幂等键 |
| 重试策略 | 指数退避：1s → 5s → 30s → 5min → DLQ |
| DLQ 处理 | 进入死信队列触发告警，需人工介入 |

---

## 5. Architecture Fitness Functions（CI 守护）

以下检测必须在 CI Pipeline 中执行：

### 5.1 Domain 层依赖检测（madge）

```typescript
// ci/check-domain-deps.ts
import madge from 'madge';

const result = await madge('src/domain/');
const deps = result.obj();

// 检测 domain/ 是否包含对 infrastructure/ 的直接依赖
for (const [file, dependencies] of Object.entries(deps)) {
  for (const dep of dependencies) {
    if (dep.includes('infrastructure/')) {
      throw new Error(`架构违规: domain/${file} 不可直接依赖 infrastructure/`);
    }
  }
}
```

### 5.2 领域事件注册检测

```typescript
// ci/check-event-catalog.ts
// 读取 DOMAIN_EVENT_CATALOG.md 中的已注册事件列表
// 扫描 src/domain/**/events/*.ts 中实际定义的事件
// 如果代码中有未注册的事件 → 失败
```

### 5.3 聚合根测试纯度检测

```typescript
// ci/check-aggregate-tests.ts
// 扫描 src/domain/**/aggregates/**/*.test.ts
// 检测是否 import 了 infrastructure/ 下的任何模块
// 存在则告警（Domain 测试不应依赖 Infrastructure）
```

---

## 6. BC 演进规范

### 6.1 需要拆分 BC 的信号

| 信号 | 说明 |
|------|------|
| BC 有多个不相关的聚合根，互相不需要事务一致性 | 应拆分 |
| 不同团队对 BC 的同一部分有频繁冲突的修改 | 可能需要拆分 |
| BC 内出现了不同的"通用语言"（同词不同义）| 应拆分 |

### 6.2 BC 变更流程（5步）

1. **识别拆分点** — 哪些聚合根将独立成新 BC
2. **定义新 BC 边界** — 新 BC 的通用语言、聚合根、事件
3. **更新 Context Map** — 新 BC 与其他 BC 的关系
4. **创建新 BC Spec** — 按 `L1-BC_SPEC.md` 模板完整填写
5. **更新 DOMAIN_EVENT_CATALOG** — 新 BC 发出/消费的事件

---

## 7. 反模式清单

| 反模式 | 表现 | 修复方向 |
|--------|------|---------|
| 贫血领域模型 | 所有业务逻辑在 Service，聚合根只有 getter/setter | 将业务规则移入聚合根方法 |
| 巨型聚合 | 聚合根有 10+ 个子实体，事务耗时长 | 识别可独立的子实体，拆分为独立聚合根 |
| 跨 BC 共享数据库表 | 两个 BC 的代码都写同一张表 | 明确表所有权，跨 BC 只允许通过事件或查询 API |
| 领域事件当命令 | 事件名是 `ProcessOrder` 而非 `OrderProcessed` | 事件描述过去事实，不包含意图 |
| 应用服务含业务规则 | AppService 中有 `if (order.amount > limit) {...}` 等业务判断 | 将业务规则移入领域服务或聚合根方法 |
| 基础设施泄漏到领域 | Domain 类直接 `import { PrismaClient }` | 通过 Port 接口注入，实现在 Infrastructure |

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | {{YYYY-MM-DD}} | 初始版本，定义战略/战术/分层/通信/Fitness Functions 规范 |
