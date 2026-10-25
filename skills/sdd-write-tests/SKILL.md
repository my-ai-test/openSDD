---
name: sdd-write-tests
description: This skill should be used when the user asks to "写测试", "生成测试用例", "write unit tests", "create tests from AC", "AC驱动测试", "推导测试", or mentions generating test cases driven by acceptance criteria (not implementation code), including AppService tests, aggregate tests, and mapper tests.
---

> 先读消费项目 `.sdd/config.json` 和框架 `rules/core.md`。FRAMEWORK_DIR、SPEC_DIR、代码路径与测试命令以配置为准；示例 SDD 路径按项目替换。DDD、TypeScript/Jest 和企业规范仅在对应 profile 启用时适用。调用入口见框架 `docs/hosts.md`。


# sdd-write-tests — 写测试用例（AC 驱动）

> **L1 Skill**：从验收标准（AC）推导单元测试，严格禁止从实现代码推导。
> 适用于 AppService、Domain Aggregate、Mapper、Controller 任意层的测试编写。

---

## 输入

调用此 Skill 时，请提供：

1. **spec.md 路径**（或直接粘贴 AC 内容）
2. **被测试的模块**（如：`SkillAppService`、`Skill` 聚合根、`SkillMapper`）
3. **技术栈**（如：NestJS + TypeScript + Jest）

---

## 黄金规则（在生成任何代码之前必须确认）

```
✅ 正确流程：
  1. 关闭/忽略实现代码文件
  2. 打开 spec.md，读 AC
  3. 识别 AC 类型（CRUD / 状态机 / 校验 / 权限 / 查询）
  4. 按六层模型展开测试场景
  5. 用业务语言写断言
  6. 最后才编写/查看实现代码（仅为了了解接口签名）

❌ 禁止流程：
  1. 先读实现代码
  2. 根据代码"验证"已有行为
  → 这样的测试在实现错误时也会通过，毫无价值
```

**自检问句**（写完每个测试后问自己）：
> "如果实现方式变了但业务结果不变，这个测试还能通过吗？"
> 不能通过 → 测试依赖了实现细节 → 需要重写

---

## 执行流程

### 阶段一：读 AC，识别类型

从 spec.md 读取所有 AC，按类型分组：

| AC 类型 | 识别特征 | 测试重点 |
|---------|---------|---------|
| CRUD 类 | 创建/读取/更新/删除操作 | 正常路径 + 边界 + not-found |
| 状态机类 | 含状态流转（PENDING→APPROVED）| 合法转换 + 非法转换 + 终态 |
| 输入校验类 | 包含 IF <无效输入> THEN 错误 | 恰好边界 + 超出边界 + null/空 |
| 权限控制类 | 角色决策表（developer/admin/guest）| 每个角色的 allow/deny |
| 查询/搜索类 | 列表、分页、过滤 | 空结果 + 分页边界 + 过滤组合 |

### 阶段二：六层展开

> 权威来源：`{FRAMEWORK_DIR}/standards/six-layer-model.md`（含覆盖要求矩阵与 AC 类型识别指南）

按 AC 类型选用对应层次（M=必须，O=推荐）：

```
L1 等价类   — 正常输入的代表值（valid data）
L2 边界值   — 恰好在边界的值（min/max/length=exactly N）
L3 决策表   — 多条件组合（角色×状态、角色×操作）
L4 状态转换 — 所有状态转换路径（含非法转换）
L5 组合测试 — 多参数组合（搜索词 × 过滤器 × 排序）
L6 错误猜测 — not-found、already-exists、concurrent、null input
```

### 阶段三：先固化场景，再编写测试

在实现前将 AC → 预期结果/边界场景写入任务 testPlan 文档。实现阶段按接口签名完善 fixture 与测试代码；断言仍以固化场景为准。

### 编写 Mock 工厂

每个被测模块必须有**完整接口 Mock 工厂函数**：

```typescript
// ✅ 正确：满足完整接口，可选覆盖
function makeRepo(overrides: Partial<XxxRepositoryPort> = {}): jest.Mocked<XxxRepositoryPort> {
  return {
    findById: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    // ... 接口所有方法
    ...overrides,
  } as jest.Mocked<XxxRepositoryPort>;
}

// ✅ 正确：使用 reconstitute 创建领域对象（不用 new）
function makeDomainObj(overrides: Partial<{...}> = {}): XxxAggregate {
  return XxxAggregate.reconstitute({
    id: overrides.id ?? 'xxx-001',
    // ... 所有必填字段
  });
}

// ❌ 错误：as any 缺字段
const repo = { findById: jest.fn() } as any;
```

**事件总线 Mock（固定模式）**：
```typescript
function makeEventBus(): jest.Mocked<IEventBus> {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    publishAll: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IEventBus>;
}

// 检测领域事件的固定模式：
const events = (eventBus.publishAll as jest.Mock).mock.calls.flat(2);
expect(events.some(e => e instanceof XxxEvent)).toBe(true);
```

### 阶段四：错误码格式

> 权威来源：`{FRAMEWORK_DIR}/standards/error-code-format.md`（含格式定义、常用异常名称约定、HTTP 状态码规范）

验证错误码时使用完整 4 段格式：
```typescript
// ✅ 正确（4 段：errorcode.{appname}.{module}.{exception}）
// 替换 {appname}/{module} 为项目实际值，如 'errorcode.myapp.user.notFound'
expect((err as DomainException).errorCode).toBe('errorcode.{appname}.{module}.notFound');

// ❌ 错误（不完整，缺少前缀）
expect((err as DomainException).errorCode).toBe('notFound');
```

### 阶段五：测试文件结构

```typescript
/**
 * XxxAppService 单元测试
 * 测试来源：FD-{NN} spec AC-{xxx}
 * 推导方法：从 AC 展开六层模型，不参考 service 实现代码
 */

// ─── Mock 工厂 ────────────────────────────────────────────
function makeRepo(...) { ... }
function makeEventBus() { ... }
function makeXxx(...) { ... }    // 领域对象工厂
function makeDto(...) { ... }    // DTO 工厂

// ─── 测试套件 ──────────────────────────────────────────────
describe('XxxAppService', () => {
  let service: XxxAppService;
  let repo: jest.Mocked<XxxRepositoryPort>;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    repo = makeRepo();
    eventBus = makeEventBus();
    service = new XxxAppService(repo, eventBus);
  });

  // ────── AC-001: 功能描述 ──────
  describe('methodName() — AC-001', () => {
    it('正常路径：业务语言描述结果', async () => { ... });
    it('边界值：边界描述', async () => { ... });
    it('错误路径：条件 → 抛出 DomainException', async () => { ... });
  });
});
```

---

## 常见陷阱与修复

| 陷阱 | 错误代码 | 修复 |
|------|---------|------|
| 依赖 NestJS ValidationPipe | `expect(service.create({field:'短'})).rejects...` | DTO 长度校验在 HTTP 层，AppService 不执行；删除此测试或改在 e2e 测试 |
| 状态机前置条件缺失 | DRAFT 状态聚合根调用命令方法失败 | 检查业务前置条件（如必填字段已填/关联状态满足），在 factory 中预先满足 |
| 忘记 publishAll | 事件检测始终 false | 状态变更方法内确认调用了 `eventBus.publishAll(agg.pullDomainEvents())` |

---

## 输出

- 完整的 TypeScript 测试文件，路径与被测模块相同，扩展名 `.spec.ts`
- 执行 `<项目配置中的 testCommand>` 验证全部通过
- 输出通过率：`X passed, Y total`

---

## 与其他 Skills 的关系

- 本 Skill 消费 `sdd-write-ac` 的输出（AC 表）
- 通常由 `sdd-implement-feature` 在第 5 步调用
- 领域层测试（聚合根）可独立调用本 Skill，无需先加载并执行 `sdd-write-ac`
