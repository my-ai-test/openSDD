# SDD 六层展开模型（标准参考）

> 本文件是单一权威来源。`sdd-write-ac.md`、`sdd-write-tests.md`、`CLAUDE.md.template` 均引用此标准，
> 维护时只需改此处。

---

## 模型定义

| 层 | 技术名称 | 说明 |
|----|---------|------|
| L1 | 等价类（Equivalence Partitioning）| 将输入空间分成等价区间，选代表值；正常路径的主要测试 |
| L2 | 边界值（Boundary Value Analysis）| 在区间边界取值（恰好/边界-1/边界+1）|
| L3 | 决策表（Decision Table）| 多条件组合（角色 × 状态、角色 × 操作）|
| L4 | 状态转换（State Transition）| 覆盖所有合法和非法状态转换路径 |
| L5 | 组合测试（Pairwise/Combinatorial）| 多参数的笛卡尔积子集（常用于搜索/过滤）|
| L6 | 错误猜测（Error Guessing）| 基于经验猜测易出错点：null/空/已存在/并发/越权 |

---

## 按 AC 类型的覆盖要求

M = 必须生成，O = 推荐生成，— = 通常不适用

| 层 | CRUD 类 | 状态机类 | 输入校验类 | 权限控制类 | 查询/搜索类 |
|----|---------|---------|----------|----------|-----------|
| L1 等价类 | **M** | **M** | **M** | **M** | **M** |
| L2 边界值 | **M** | O | **M** | **M** | O |
| L3 决策表 | O | **M** | — | **M** | — |
| L4 状态转换 | — | **M** | — | O | — |
| L5 组合测试 | O | O | — | O | **M** |
| L6 错误猜测 | **M** | **M** | **M** | **M** | **M** |

---

## AC 类型识别指南

| AC 类型 | 识别特征 | 典型关键词 |
|---------|---------|-----------|
| CRUD 类 | 创建/读取/更新/删除资源 | create, update, delete, fetch, list |
| 状态机类 | 对象有明确的状态流转 | status, PENDING→APPROVED, submit, approve, reject |
| 输入校验类 | 对用户输入有格式/长度/范围约束 | invalid, format, length, required |
| 权限控制类 | 不同角色有不同操作权限 | role, permission, forbidden, only admin |
| 查询/搜索类 | 列表、分页、过滤、排序 | list, search, filter, sort, page |

---

## 六层展开示例（AC-001：创建用户）

```
AC 类型：CRUD 类 + 输入校验类

L1 等价类：
  ✅ 有效邮箱 + 有效密码 → 创建成功

L2 边界值：
  ✅ 密码恰好 8 字符（min boundary）→ 成功
  ✅ 密码恰好 64 字符（max boundary）→ 成功
  ❌ 密码 7 字符（min-1）→ 失败
  ❌ 密码 65 字符（max+1）→ 失败

L6 错误猜测：
  ❌ 邮箱已存在 → emailAlreadyExists
  ❌ 邮箱格式无效 → invalidEmail
  ❌ 密码为 null → invalidPassword
```

---

## 引用此标准的文件

- `commands/sdd-write-ac.md` — Phase 2（按 AC 类型展开六层模型）
- `commands/sdd-write-tests.md` — Phase 2（六层展开）
- `commands/sdd-review-spec.md` — 检查 2（六层覆盖完整性）
- `templates/CLAUDE.md.template` — 规则 6（测试质量规则）
- `templates/CLAUDE.md.lite.template` — 规则 6
