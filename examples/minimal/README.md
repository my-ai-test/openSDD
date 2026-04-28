# SDD Minimal Example — FD-01 用户注册

这是一个完整的 SDD 最小示例，展示从 AC 到通过测试的完整输出形态。

**场景**：一个简单的用户注册功能（1 个 FD，4 条 AC，12 个测试用例）。

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `spec/fd-01-register.spec.md` | FD-01 完整规格文件（包含 AC、BR、端点覆盖矩阵）|
| `tests/user.aggregate.spec.ts` | Domain 层测试（来自 AC 的六层推导）|
| `tests/user-registration.app-service.spec.ts` | AppService 层测试 |

---

## SDD 执行过程回放

### Step 1：输出 SDD 分析块

```
## SDD 分析

**需求分类**: 新功能
**FD**: FD-01 用户注册
**影响 AC**: 需新增 AC-001 ~ AC-004
**Spec 变更计划**: 新建 spec/fd-01-register.spec.md

### 实施步骤
- Step 2：调用 /sdd-write-ac 生成 AC
- Step 3：完成 API_SPEC.md §9 端点契约 POST /api/v1/users/register
- Step 4-A：User 聚合根 register() 方法
- Step 4-B：UserRegistrationAppService
- Step 5：调用 /sdd-write-tests
- Step 6：运行测试
- Step 7：输出自检表
```

### Step 2：/sdd-write-ac 输出（→ spec.md）

查看：[spec/fd-01-register.spec.md](spec/fd-01-register.spec.md)

### Step 5：/sdd-write-tests 输出（→ *.spec.ts）

查看：
- [tests/user.aggregate.spec.ts](tests/user.aggregate.spec.ts)
- [tests/user-registration.app-service.spec.ts](tests/user-registration.app-service.spec.ts)

### Step 7：自检表

| 检查项 | 状态 | 说明 |
|--------|------|------|
| SDD 分析块 | ✅ | 回复开头已包含 |
| 首个 Edit → spec 文件 | ✅ | 首先新建 spec.md |
| 新端点在 Controller 前有 API_SPEC §9 契约 | ✅ | POST /api/v1/users/register 契约已完成 |
| AC 覆盖测试 | ✅ | AC-001~004 全部有对应测试 |
| 文档门禁（5 类）| ✅ | Feature Spec ✅，DATA_SPEC ✅，API_SPEC ✅，UI N/A，Security ✅ |
| AC 驱动测试 | ✅ | 从 spec.md 读 AC，未先看代码 |
| BACKLOG 更新 | ✅ | 无新欠账 |
| 静默跳过 | ✅ | 无 |

---

## 关键学习点

1. **AC 格式**：主句用 EARS（WHEN/THEN/IF），多场景用表格辅助
2. **测试推导**：每条 AC 对应一个 describe 块，六层展开生成 test case
3. **Mock 工厂**：`makeRepo()`、`makeEventBus()`、`makeUser()` 工厂函数满足完整接口
4. **错误码**：完整 4 段格式 `errorcode.{appname}.{module}.{exception}`
5. **文档门禁**：只有 DATA_SPEC/API_SPEC/Feature Spec 被触发；UI_SPEC 不涉及填 N/A
