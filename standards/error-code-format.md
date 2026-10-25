# SDD 错误码格式标准（单一权威来源）

> 企业错误码、HTTP 200 业务错误和审计字段示例仅在 enterprise profile 启用时适用；其他项目采用自身约定。

> 本文件定义错误码的格式规范。所有 Skills 和 CLAUDE.md 模板均引用此标准。

---

## 格式定义

```
errorcode.{appname}.{module}.{exception}
```

**4 个点分节**，含义：

| 节 | 说明 | 示例 |
|----|------|------|
| `errorcode` | 固定前缀，标识这是业务错误码 | `errorcode` |
| `{appname}` | 应用标识（小写字母，项目决定）| `shop`、`myapp`、`oms` |
| `{module}` | 模块/领域名（小写字母+下划线）| `skill`、`user`、`order` |
| `{exception}` | 异常类型（lowerCamelCase）| `notFound`、`forbidden`、`emailAlreadyExists` |

---

## 正确示例

```typescript
'errorcode.shop.product.notFound'       // 商品不存在
'errorcode.shop.product.forbidden'      // 无权限操作
'errorcode.shop.product.slugExists'     // Slug 重复
'errorcode.myapp.user.emailAlreadyExists'
'errorcode.oms.order.invalidStateTransition'
```

## 错误示例

```typescript
// ❌ 错误：缺少 errorcode 前缀
'skill.notFound'

// ❌ 错误：只有异常名（短格式）
'notFound'

// ❌ 错误：段数过多（5段）
'errorcode.shop.api.product.notFound'

// ❌ 错误：使用 HTTP 状态码作为业务错误码（企业规范：业务异常统一 HTTP 200）
throw new HttpException('Not Found', 404)
```

---

## HTTP 状态码规范（配合错误码使用）

| 场景 | HTTP 状态 | 返回格式 |
|------|----------|---------|
| 业务异常（资源不存在、权限不足、状态机违规等）| **200** | `{code: 'errorcode.xxx', message: '...', data: null}` |
| Token 无效/过期（系统级认证失败）| **401** | `{code: 'errorcode.xxx.auth.tokenExpired', message: '...', data: null}` |
| 未捕获服务器异常 | **500** | `{code: 'errorcode.xxx.system.internalError', message: '...', data: null}` |

---

## 常用异常名称约定（lowerCamelCase）

| 异常名 | 含义 |
|--------|------|
| `notFound` | 资源不存在 |
| `forbidden` | 权限不足 |
| `alreadyExists` | 资源已存在（唯一性冲突）|
| `invalidInput` | 输入格式无效 |
| `invalidStateTransition` | 状态机非法转换 |
| `tokenExpired` | Token 已过期 |
| `duplicatePendingRequest` | 重复提交未处理请求 |

---

## 引用此标准的文件

- `commands/sdd-write-ac.md` — Phase 3（EARS 格式，错误 AC 含错误码）
- `commands/sdd-write-tests.md` — Phase 4（错误码格式验证）
- `commands/sdd-review-spec.md` — 检查 4（错误码规范）
- `templates/CLAUDE.md.template` — 规则 11（§11.2 API 错误处理）
