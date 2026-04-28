---
title: "{{PROJECT}} 数据模型规格"
type: spec
scope: data-model
version: "1.0"
status: "draft"
created: "{{YYYY-MM-DD}}"
constitution_ref: "SDD/00-constitution/CONSTITUTION.md v1.0"
ddd_spec_ref: "SDD/01-specs/DDD_SPEC.md v1.0"
---

# 数据模型规格

---

## 0. 企业规范合规

> 遵循企业 MySQL 规范（按需填写规范文档路径）

| 规范项 | 合规措施 |
|--------|---------|
| 表命名 | `{prefix}_{name}_t` 全小写+下划线 |
| 字段命名 | Prisma camelCase + `@map("snake_case")` DB 列名 |
| 主键 | `{name}Id VARCHAR(64)` UUID 类型，应用层生成 |
| 审计字段 | `createBy`, `createDate`, `lastUpdatedBy`, `lastUpdateDate`, `lastUpdateVersion` |
| 软删除 | `deleteFlag CHAR(1)` 默认 `'N'`，所有查询过滤 |
| 索引前缀 | 普通 `idx_`，唯一 `idx_uk_`，外键 `idx_fk_` |
| 企业规范文档 | 引用: {{企业数据库规范文档链接}} |

---

## 1. 实体清单

> **DDD 视角**：每个实体表对应一个聚合根或聚合内实体，由所属 BC 负责写操作。跨 BC 的读操作通过只读 API 查询，**禁止**共享底层表。

| 编号 | 表名 | 说明 | 所属 BC | 聚合根 |
|------|------|------|---------|--------|
| E-01 | `{{PREFIX}}_{{NAME1}}_T` | {{说明}} | BC-{{NN}} {{BC名称}} | `{{AggregateRoot}}` |
| E-02 | `{{PREFIX}}_{{NAME2}}_T` | {{说明}} | BC-{{NN}} {{BC名称}} | `{{AggregateRoot}}` |
| E-03 | `{{PREFIX}}_{{NAME3}}_T` | {{说明}} | BC-{{NN}} {{BC名称}} | `{{AggregateRoot}}` |

---

## 2. 实体定义

### E-01: {{PREFIX}}_{{NAME}}_T

> **所属 BC**: BC-{{NN}} {{BC名称}} | **聚合根**: `{{AggregateRoot}}`

{{一句话说明此表用途}}

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `{name}_id` | VARCHAR(64) PK | Y | UUID | 主键 |
| `{field_1}` | VARCHAR(128) | Y | — | {{说明}} |
| `{field_2}` | TEXT | N | — | {{说明}} |
| `status` | VARCHAR(20) | Y | `'{{默认状态}}'` | 枚举值见下方 |
| `create_by` | VARCHAR(64) | Y | — | 创建人用户 ID |
| `create_date` | TIMESTAMP | Y | `now()` | 创建时间（UTC） |
| `last_updated_by` | VARCHAR(64) | Y | — | 最后修改人 |
| `last_update_date` | TIMESTAMP | Y | `@updatedAt` | 最后修改时间（UTC） |
| `last_update_version` | INTEGER | Y | 1 | 乐观锁版本号 |
| `delete_flag` | CHAR(1) | Y | `'N'` | 软删除标记 |

**STATUS 枚举值**:

| 值 | 说明 | 可流转至 |
|----|------|---------|
| `{{STATUS_A}}` | {{说明}} | `{{STATUS_B}}` |
| `{{STATUS_B}}` | {{说明}} | `{{STATUS_C}}`, `{{STATUS_A}}` |
| `{{STATUS_C}}` | {{说明（终态）}} | 无（终态） |

**索引**:

| 索引名 | 类型 | 字段 | 说明 |
|--------|------|------|------|
| `idx_uk_{table}_{field}` | UNIQUE | `{字段}` | {{说明}} |
| `idx_{table}_status_df` | NORMAL | `status, delete_flag` | 状态+软删除过滤常用查询 |

**约束**:

| 约束编号 | 类型 | 规则 |
|---------|------|------|
| `C-{name}-001` | CHECK | `delete_flag IN ('Y', 'N')` |
| `C-{name}-002` | CHECK | `status IN ('{{STATUS_A}}', '{{STATUS_B}}', '{{STATUS_C}}')` |

**并发控制**:

| 场景 | 策略 | 实现 |
|------|------|------|
| 更新操作 | 乐观锁 | 更新时校验 `last_update_version`，不匹配业务异常返回 HTTP 200 + errorCode |
| {{其他场景}} | {{策略}} | {{实现方式}} |

> 若无需特殊并发控制，填写"无特殊要求，依赖数据库行级锁"。

---

### E-02: {{PREFIX}}_{{NAME2}}_T

> **所属 BC**: BC-{{NN}} {{BC名称}} | **聚合根**: `{{AggregateRoot}}`

{{同 E-01 格式，每个实体一个 E-XX 节}}

---

## 3. 枚举值统一定义

> 跨 BC 共享的枚举值在此统一定义，各 BC Spec 和 Feature Spec 直接引用，不重新定义。

### 3.1 {{枚举名}}（{{用途描述}}）

| 值 | 含义 | 适用实体 |
|----|------|---------|
| `{{VALUE_A}}` | {{含义}} | E-01, E-02 |
| `{{VALUE_B}}` | {{含义}} | E-01 |

---

## 4. 实体关系

```
{{PREFIX}}_{{NAME1}}_T  1 ──── N  {{PREFIX}}_{{NAME2}}_T   (一对多: 通过 {{NAME1}}_ID 外键)
{{PREFIX}}_{{NAME2}}_T  N ──── M  {{PREFIX}}_{{NAME3}}_T   (多对多: 通过中间表 {{PREFIX}}_{{NAME2}}_{{NAME3}}_T)
```

> **跨 BC 关系说明**: 不同 BC 的实体之间**禁止物理外键约束**。关联通过业务 ID（UUID）实现，一致性由领域事件保障。

---

## 5. 向量存储（如有 AI 功能）

> 若项目使用语义搜索或 AI 特性，在此说明向量存储方案。无 AI 功能的项目可删除本节。

| 字段 | 说明 |
|------|------|
| 存储方案 | {{pgvector / Pinecone / Weaviate 等}} |
| 向量维度 | {{N 维，如 1536（text-embedding-ada-002）}} |
| 关联实体 | {{对应的业务实体表}} |
| 所属 BC | BC-{{NN}} {{BC名称}} |
| 更新时机 | {{何时重新生成向量，如：内容更新后异步触发}} |

---

## 6. 数据保留策略

| 数据类型 | 保留期限 | 归档策略 |
|---------|---------|---------|
| 业务实体（IS_DELETED='Y'） | {{N}} 天后 | {{归档/物理删除}} |
| 操作日志 | {{N}} 个月 | {{归档策略}} |
| 审计记录 | {{N}} 年 | 永久保留/归档 |

---

### 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | {{YYYY-MM-DD}} | 初始版本 |
