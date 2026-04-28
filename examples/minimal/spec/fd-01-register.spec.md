---
fd-id: FD-01
fd-name: 用户注册
bc: BC-01 用户身份
status: approved
---

# FD-01 用户注册

## 功能概述

用户通过邮箱+密码完成账号注册，系统验证邮箱唯一性后创建用户账号并发送验证邮件。

## 用户故事

As a 访客用户,
I want to 用邮箱和密码注册账号,
So that 我可以访问平台功能.

As a 访客用户,
When 邮箱已被注册,
I want to 收到明确的错误提示,
So that 我知道需要换一个邮箱或找回密码.

## 验收标准（AC）

### AC-001：正常注册路径 — CRUD类（L1等价类）

WHEN 访客提交有效的邮箱（格式正确，未被注册）和密码（8–64字符）
THEN 系统创建状态为 PENDING_VERIFICATION 的用户账号
AND 返回 userId（UUID 格式）
AND 触发 UserRegisteredEvent，下游发送验证邮件

### AC-002：邮箱边界值 — 输入校验类（L2边界值）

IF 邮箱格式不符合 RFC 5322（如缺少 @ 符号）
THEN 系统返回错误，errorCode = `errorcode.myapp.user.invalidEmail`

IF 密码长度为 7 字符（边界-1）
THEN 系统返回错误，errorCode = `errorcode.myapp.user.passwordTooShort`

IF 密码长度恰好 8 字符（边界）
THEN 注册成功（同 AC-001）

| 场景 | 关键输入 | 预期输出 | 错误码 |
|------|---------|---------|--------|
| 邮箱无 @ | `userexample.com` | 200 + error | errorcode.myapp.user.invalidEmail |
| 密码 7字符 | `pass123` | 200 + error | errorcode.myapp.user.passwordTooShort |
| 密码 8字符 | `pass1234` | 201 + userId | — |
| 密码 64字符 | `a` × 64 | 201 + userId | — |
| 密码 65字符 | `a` × 65 | 200 + error | errorcode.myapp.user.passwordTooLong |

### AC-003：邮箱重复注册 — L6 错误猜测

WHEN 访客提交的邮箱已存在于系统中（deleteFlag='N'）
THEN 系统返回错误，errorCode = `errorcode.myapp.user.emailAlreadyExists`
AND HTTP 状态码为 200（业务异常规范）

### AC-004：注册后状态验证 — 状态机类（L4状态转换）

WHEN 注册成功后
THEN 用户状态为 PENDING_VERIFICATION（不能直接进入 ACTIVE）
AND 在邮件验证完成前，登录操作返回 errorCode = `errorcode.myapp.user.emailNotVerified`

## 业务规则（BR）

| BR-ID | 规则 | 来源 AC |
|-------|------|---------|
| BR-001 | 密码长度 8–64 字符 | AC-002 |
| BR-002 | 邮箱全局唯一（大小写不敏感）| AC-003 |
| BR-003 | 新注册用户必须完成邮件验证才能登录 | AC-004 |

## 端点覆盖矩阵

| 端点 | 方法 | AC 编号 | 覆盖层次 |
|------|------|---------|---------|
| /api/v1/users/register | POST | AC-001, AC-002, AC-003 | L1, L2, L6 |
| （邮件验证端点，FD-02 覆盖）| — | — | — |

> 所有端点均有对应 AC ✅，无 ❌
