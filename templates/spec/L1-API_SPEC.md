---
title: "{{PROJECT}} API 接口规格"
type: spec
scope: api
version: "1.0"
status: "draft"
created: "{{YYYY-MM-DD}}"
constitution_ref: "SDD/00-constitution/CONSTITUTION.md v1.0"
data_spec_ref: "SDD/01-specs/DATA_SPEC.md v1.0"
ddd_spec_ref: "SDD/01-specs/DDD_SPEC.md v1.0"
---

# API 接口规格

> ⚡ **API 先行原则（Rule 10）**：本文件是 API 契约的唯一权威来源。  
> 任何端点的 Controller 代码**必须**在本文件中对应条目（§2 或专用契约节）完成并经确认后才能编写。  
> 仅将路径加入索引表不算完成契约——必须包含：方法+路径 / 权限 / 请求 Schema / 响应 Schema / 错误码。

---

## 1. 全局约定

### 1.1 基础路径

```
/api/v1
```

版本策略：URL 路径版本控制。不兼容变更升版本号（v1 → v2），兼容变更不升版。

### 1.2 统一响应格式

**成功响应**:
```json
{
  "code": "0",
  "message": "success",
  "data": { }
}
```

**分页成功响应**:
```json
{
  "code": "0",
  "message": "success",
  "data": {
    "list": [],
    "pageVO": {
      "curPage": 1,
      "pageSize": 20,
      "totalPages": 5,
      "totalRows": 100
    }
  }
}
```

**失败响应**:
```json
{
  "code": "errorcode.{{ns}}.{{module}}.{{exception}}",
  "message": "人类可读的错误描述",
  "data": null
}
```

### 1.3 HTTP 状态码规范

> **企业规范（可选）**：业务异常统一返回 HTTP 200 + `{code, message, data: null}`；仅系统级错误使用非 200 状态码。

| 状态码 | 含义 | 典型场景 |
|--------|------|---------|
| 200 | 成功 **或业务异常** | 成功返回 `code: "0"`；业务异常返回 `code: "errorcode...."` |
| 201 | 创建成功 | POST 成功创建资源 |
| 401 | 系统级：未认证 | Token 缺失或过期（系统级，非业务） |
| 429 | 系统级：请求过多 | 触发限流 |
| 500 | 系统级：服务器错误 | 未预期异常 |

**业务级错误（均返回 HTTP 200，通过 code 字段区分）**：

| 场景 | 错误码 |
|------|--------|
| 资源不存在 | `errorcode.{{ns}}.{{module}}.notFound` |
| 权限不足 | `errorcode.{{ns}}.{{module}}.forbidden` |
| 唯一性冲突 | `errorcode.{{ns}}.{{module}}.alreadyExists` |
| 状态机违规 | `errorcode.{{ns}}.{{module}}.invalidStateTransition` |
| 参数校验失败 | `errorcode.{{ns}}.common.validationError` |
| 配额超限 | `errorcode.{{ns}}.{{module}}.quotaExceeded` |

### 1.4 认证方式

| 方式 | 传输位置 | 格式 | 适用场景 |
|------|---------|------|---------|
| Session Cookie | Cookie | `session={JWT}` | Web 浏览器 |
| PAT | Authorization Header | `Bearer {{ns}}p_{hash}` | CLI / 脚本 |
| Agent Token | Authorization Header | `Bearer {{ns}}_{hash}` | AI Agent |

### 1.5 公共请求头

| Header | 必填 | 说明 |
|--------|------|------|
| `Content-Type` | Y（POST/PUT） | `application/json` |
| `Authorization` | 按接口要求 | Bearer Token |
| `x-trace-id` | N | 链路追踪 ID（建议传入） |
| `Idempotency-Key` | N | 幂等键（UUID），有副作用的 POST 接口建议传入，窗口期 24h |

### 1.6 分页参数规范

**请求**:

| 参数 | 类型 | 默认值 | 最大值 | 说明 |
|------|------|--------|--------|------|
| `curPage` | integer | 1 | — | 当前页（从 1 开始） |
| `pageSize` | integer | 20 | 100 | 每页条数 |

**响应（pageVO）**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `curPage` | integer | 当前页 |
| `pageSize` | integer | 每页条数 |
| `totalPages` | integer | 总页数 |
| `totalRows` | integer | 总条数 |

---

## 2. 端点定义

> **DDD 归属说明**：每个端点模块标注所属 BC，便于追溯领域边界。

### 2.1 {{模块名称}}（BC-{{NN}} {{BC名称}}）

#### 端点概览

| 方法 | 路径 | 说明 | 认证 | 角色 |
|------|------|------|------|------|
| GET | `/api/v1/{{resource}}` | 列表查询 | Session/PAT | 全角色 |
| POST | `/api/v1/{{resource}}` | 创建 | Session/PAT | {{允许角色}} |
| GET | `/api/v1/{{resource}}/:id` | 详情查询 | Session/PAT | 全角色 |
| PUT | `/api/v1/{{resource}}/:id` | 更新 | Session/PAT | owner / ADMIN |
| DELETE | `/api/v1/{{resource}}/:id` | 删除（软删除） | Session/PAT | owner / ADMIN |

---

#### POST /api/v1/{{resource}}

**请求体**:

| 字段 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|---------|------|
| `{{field1}}` | string | Y | 3~64 字符，格式 `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/` | {{说明}} |
| `{{field2}}` | string | Y | 1~128 字符 | {{说明}} |
| `{{field3}}` | string | N | max 2000 字符 | {{说明，可选}} |

**响应体 (data)**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `{{id}}` | string | 创建的资源 ID |
| `{{field1}}` | string | {{说明}} |
| `createdAt` | string | ISO 8601 时间戳 |

**错误码**:

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `errorcode.{{ns}}.{{module}}.slugExists` | 409 | 标识符已存在 |
| `errorcode.{{ns}}.{{module}}.invalidInput` | 400 | 输入格式错误 |

**幂等性**:

| 字段 | 说明 |
|------|------|
| 是否幂等 | {{是 / 否}} |
| 幂等机制 | {{无 / Idempotency-Key Header（24h窗口）/ 数据库唯一约束}} |
| 重复请求行为 | {{返回相同结果 / 返回 409 / 返回最新状态}} |

> 有副作用的 POST（创建、状态变更）应明确声明幂等性策略。

---

#### GET /api/v1/{{resource}}

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `curPage` | integer | N | 1 | 当前页 |
| `pageSize` | integer | N | 20 | 每页条数 |
| `{{filterField}}` | string | N | — | {{筛选条件说明}} |
| `{{sortField}}` | string | N | `createdAt` | 排序字段 |
| `{{sortOrder}}` | string | N | `desc` | 排序方向（asc/desc） |

---

#### GET /api/v1/{{resource}}/:id

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 资源 ID（UUID） |

**错误码**:

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `errorcode.{{ns}}.{{module}}.notFound` | 404 | 资源不存在 |

---

### 2.2 {{下一个模块}}（BC-{{NN}} {{BC名称}}）

{{同上格式}}

---

## 3. 已实现端点详细契约

> **本节是 Rule 10 的落脚点**：所有已上线端点的完整契约必须在此留档。  
> 每个端点按以下格式记录，缺少任何必填项均视为契约未完成。

### API-001 {{操作描述}}（BC-{{NN}}）

| 项目 | 内容 |
|------|------|
| 方法 + 路径 | `{{METHOD}} /api/v1/{{resource}}` |
| 权限 | {{已登录用户 / 仅资源所有者 / 管理员}} |
| 前置条件 | {{无 / 状态限制等}} |

**请求体**

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `{{field}}` | string | Y | 1–200字符 | {{说明}} |

**成功响应** `{{201/200}} {{Created/OK}}`

```json
{
  "code": "0",
  "message": "success",
  "data": {
    "{{id}}": "string",
    "{{field}}": "{{type}}"
  }
}
```

**错误码**

| 错误码 | HTTP | 场景 |
|--------|------|------|
| `errorcode.{{ns}}.{{module}}.notFound` | 404 | 资源不存在 |
| `errorcode.{{ns}}.{{module}}.forbidden` | 403 | 无操作权限 |
| `errorcode.{{ns}}.common.validationError` | 422 | 字段校验失败 |

---

### API-002 {{...}}

{{同上格式，每个已实现端点一个条目}}

---

## 4. 错误码总表

| 错误码 | HTTP 状态 | 触发场景 |
|--------|----------|---------|
| `errorcode.{{ns}}.common.unauthorized` | 401 | 未认证或 Token 无效 |
| `errorcode.{{ns}}.common.forbidden` | 403 | 权限不足 |
| `errorcode.{{ns}}.common.notFound` | 404 | 资源通用不存在 |
| `errorcode.{{ns}}.common.internalError` | 500 | 未预期服务器错误 |
| `errorcode.{{ns}}.{{module}}.slugExists` | 409 | 标识符冲突 |

---

### 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | {{YYYY-MM-DD}} | 初始版本 |
