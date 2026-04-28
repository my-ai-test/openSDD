---
name: sdd-implement-feature
description: This skill should be used when the user asks to "实现一个FD", "开发特性", "implement a feature", "完整实现某个功能域", "build FD end-to-end", or mentions implementing a Feature Domain (FD) through the full spec-to-code pipeline including AC design, API contract, code, and tests.
version: 1.0.0
user-invocable: true
argument-hint: "<FD编号> <FD名称>"
---

# /sdd-implement-feature — 实现特性（完整流程编排）

> **L2 Skill（Orchestrator）**：编排一个 Feature（FD）从规格到代码的完整实现流程。
> 内部依次调用 `/sdd-write-ac`（AC 生成）和 `/sdd-write-tests`（测试推导）。

---

## 输入

1. **FD 编号和名称**（如：FD-01 用户注册）
2. **业务描述**（1-3 句话说明此 FD 要解决什么）
3. **所属 BC**（如：BC-01 用户管理）
4. **相关 API 端点**（已知的，可在过程中补充）

---

## 执行铁律（顺序不可调换）

```
Step 1 → SDD 分析块          输出分析，不调用任何工具
Step 2 → 规格设计（invoke /sdd-write-ac）
Step 3 → API 契约设计        若有新端点，先完成 API_SPEC.md §9 契约
Step 4 → 编写实现代码         spec + API 契约完成后才能触碰代码
Step 5 → 推导测试（invoke /sdd-write-tests）
Step 6 → 运行测试             每个模块改完立即跑，不攒到最后
Step 7 → 自检表               确认 5 类文档门禁（条件触发）
```

---

## Step 1：SDD 分析块

**必须在第一个工具调用之前输出**，格式：

```markdown
## SDD 分析

**需求分类**: [新功能 / Bug修复 / 优化 / 样式调整]
**FD**: FD-{NN} {名称}
**影响 AC**: [现有AC编号 / 需新增AC]
**BACKLOG 检查**: [读取 SDD/BACKLOG.md，命中项列出 / 无命中]
**UJ/US/AC 影响检测**: 触发 [AC阶段 / 全三段 / 不触发]
  → 原因: [...]

### Spec 变更计划
- 修改 `SDD/01-specs/features/{FD编号}/spec.md`：新增 AC-xxx
- 修改 `SDD/01-specs/API_SPEC.md §9`：新增端点契约 API-xxx

### 实施步骤
- Step 2：调用 /sdd-write-ac 生成 AC，写入 spec.md
- Step 3：完成 API_SPEC.md §9 端点契约（有新端点时）
- Step 4-A：实现 Domain 层（聚合根方法）
- Step 4-B：实现 Application 层（AppService）
- Step 4-C：实现 Infrastructure 层（Repository + Mapper）
- Step 4-D：实现 Interface 层（Controller + DTO）
- Step 5：调用 /sdd-write-tests 推导测试
- Step 6：运行测试（每模块改完立即跑）
- Step 7：输出自检表
```

---

## Step 2：规格设计

调用 `/sdd-write-ac`，输入本 FD 的描述和相关 API 端点。

等待 `/sdd-write-ac` 完成后，将生成的 AC 写入：
`SDD/01-specs/features/{FD编号}-{name}/spec.md`

> **这是第一个工具调用**——spec 文件修改必须先于任何代码修改。

---

## Step 3：API 契约设计（新端点前置门禁）

**每个新端点，必须在编写 Controller 之前在 `API_SPEC.md §9` 中完成契约**：

```markdown
### API-{NNN}：{端点名称}

**方法 + 路径**：`POST /api/v1/{resource}`
**权限**：已登录用户 / 仅作者 / 管理员
**请求体**：
| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| name | string | ✅ | 1–200字符 |

**成功响应**：`201 Created`

    { "code": "0", "message": "success", "data": { ... } }

**错误码**：
| 错误码 | HTTP | 场景 |
|--------|------|------|
| errorcode.{appname}.{module}.notFound | 200 | 资源不存在 |
| errorcode.{appname}.{module}.forbidden | 200 | 权限不足 |
```

> 注：业务异常统一返回 HTTP 200，`code` 字段携带错误码（企业规范）

---

## Step 4：实现代码（DDD 四层顺序）

按以下顺序实现，每层完成后检查层级归属：

### 4-A：Domain 层

```typescript
// 聚合根命令方法（业务规则在此强制，非 AppService）
doSomething(userId: string): void {
  // 前置检查（不变量）
  // DomainException(moduleName, exceptionName, message)
  // → errorCode 自动组装为 errorcode.{appname}.{moduleName}.{exceptionName}
  if (this._status !== XxxStatus.VALID) {
    throw new DomainException('module', 'invalidStateTransition', '...');
  }
  // 状态变更
  this._status = XxxStatus.NEW;
  this._updatedAt = new Date();
  // 发布领域事件
  this.addDomainEvent(new XxxDoneEvent({ ... }));
}
```

**DDD 快速检查决策树**：
```
新代码包含业务判断（if/switch）？
  → 是：在 Domain Layer（聚合根方法 或 领域服务）
  → 否：可在 AppService 或 Infrastructure

新代码修改了另一 BC 的数据？
  → 是：通过 EventBus（异步），不直接调用
  → 否：允许同步查询

新代码有 I/O（DB/Redis/HTTP）？
  → 是：在 Infrastructure Layer，通过 Port 接口注入
  → 否：可在 Domain Layer
```

### 4-B：Application 层（AppService）

```typescript
async doSomething(id: string, dto: XxxDto, userId: string, role: string): Promise<XxxResponseDto> {
  // 1. 权限检查
  if (!ALLOWED_ROLES.has(role)) throw new DomainException('module', 'forbidden', '...');
  // 2. 加载聚合根
  const agg = await this.repo.findById(id);
  if (!agg) throw new DomainException('module', 'notFound', '...');
  // 3. 执行领域逻辑（委托给聚合根）
  agg.doSomething(userId);
  // 4. 持久化
  await this.repo.save(agg, userId);
  // 5. 发布事件（不要遗漏！）
  await this.eventBus.publishAll(agg.pullDomainEvents());
  // 6. 返回 DTO
  return XxxResponseDto.fromDomain(agg);
}
```

### 4-C：Infrastructure 层（Mapper）

```typescript
// DB → Domain：字段名映射 + null 防御
static toDomain(row: XxxDbRow): XxxAggregate {
  return XxxAggregate.reconstitute({
    id: row.xxxId,                    // DB: xxx_id → Domain: id
    authorUserId: row.createBy,       // 企业规范字段映射
    tags: row.tags ?? [],             // null 防御
    optimisticLockVersion: row.lastUpdateVersion,
    ...
  });
}

// Domain → DB：乐观锁递增 + 企业规范字段
static toPersistence(agg: XxxAggregate, updatedBy: string) {
  return {
    xxxId: agg.id,
    createBy: agg.authorUserId,
    lastUpdatedBy: updatedBy,
    lastUpdateDate: new Date(),
    lastUpdateVersion: agg.version + 1,   // 乐观锁递增
    deleteFlag: 'N',                        // 始终 'N'
    tags: agg.tags.length ? agg.tags : Prisma.JsonNull,  // Prisma 特有：空数组存 JsonNull；其他 ORM 按实际调整
    ...
  };
}
```

### 4-D：Interface 层（Controller）

```typescript
@Post()
async create(
  @Body() dto: CreateXxxDto,
  @CurrentUser() user: UserContext,
): Promise<ApiResponse<XxxResponseDto>> {
  const result = await this.appService.create(dto, user.id, user.role);
  return { code: '0', message: 'success', data: result };
}
```

---

## Step 5：调用 /sdd-write-tests

输入：刚刚完成的 spec.md 路径，被测模块清单。

对以下模块逐一生成测试：
- [ ] Domain 聚合根（状态机 + 不变量）
- [ ] AppService（完整 AC 覆盖）
- [ ] Mapper（toDomain + toPersistence 字段契约）

---

## Step 6：运行测试

```bash
# 每个模块改完立即运行，不攒到最后
npx jest --no-coverage --testPathPattern="<module-name>"
```

期望输出：`X passed, 0 failed`

---

## Step 7：自检表

```markdown
| 检查项 | 状态 | 说明 |
|--------|------|------|
| SDD 分析块 | ✅ | 回复开头已包含 |
| 首个 Edit → spec 文件 | ✅ | 首先修改了 spec.md |
| 新端点在 Controller 前有 API_SPEC §9 契约 | ✅/N/A | |
| AC 覆盖测试 | ✅ | 所有新增 AC 有对应测试 |
| 文档门禁（5 类）| ✅ | Feature Spec/DATA/API/UI/Security |
| AC 驱动测试（非实现驱动）| ✅ | 从 spec 读 AC，未先看代码 |
| EventBus.publishAll 调用 | ✅ | 无 TODO 残留 |
| 企业规范（Rule 11）| ✅/N/A | DB 字段/乐观锁/错误码格式 |
| BACKLOG 更新 | ✅ | 无新欠账 / 已登记 |
| 静默跳过检查 | ✅ | 无承诺未实施项 |
| DDD 合规（5 项）| ✅ | 层级/不变量/事务/事件/BC间依赖 |
| AC 端点覆盖矩阵无 ❌ | ✅ | |
```

有 ❌ 必须当场修复，不得输出"已完成"。

---

## 与其他 Skills 的关系

- **调用**：`/sdd-write-ac`（Step 2）、`/sdd-write-tests`（Step 5）
- **被调用**：由 `/sdd-init-project` 在 FD 循环（Phase 5）中调用
- **前置**：若需 UJ/US，先运行 `/sdd-generate-uj`
