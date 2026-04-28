---
title: "{{PROJECT}} 用户旅程规格"
type: user-journey-spec
version: "1.0"
status: "draft"
created: "{{YYYY-MM-DD}}"
product_spec_ref: "SDD/01-specs/PRODUCT_SPEC.md"
---

# 用户旅程规格（User Journey Spec）

> **职责**: 本文件定义跨 BC/FD 的完整用户旅程，以**多角色 Mermaid sequenceDiagram** 展示端到端路径。
>
> **职责边界（禁止越界）**:
> - ✅ 包含：完整的跨 BC/FD 序列图（参与者、消息、系统边界）
> - ✅ 包含：参与角色、关键 BC/FD、主路径和异常路径
> - ❌ 不包含：AC/BR（那是 Feature Spec 和 BC Spec 的职责）
> - ❌ 不包含：API 参数细节、数据库字段（那是 API_SPEC/DATA_SPEC 的职责）

---

## 用户旅程总览

| UJ 编号 | 旅程名称 | 主要角色 | 关键 BC/FD | 优先级 | 版本 |
|--------|---------|---------|-----------|--------|------|
| UJ-01 | {{旅程名称，如：发现并使用 Skill}} | {{角色列表}} | {{BC-01, BC-06}} | P0 | v1.0 |
| UJ-02 | {{旅程名称}} | {{角色}} | {{BC}} | P0 | v1.0 |

---

## UJ-01: {{旅程名称}}

**参与角色**: {{角色1}}、{{角色2}}
**关键 BC/FD**: {{BC-01 Skill服务、BC-06 搜索服务 / FD-01 Skill管理}}
**场景描述**: {{一句话描述这条旅程的业务目标}}

```mermaid
sequenceDiagram
    actor User as {{角色1}}
    actor Reviewer as {{角色2}}
    participant FE as 前端（Interface Layer）
    participant AS as {{AS-NN 应用服务名}}
    participant BC01 as BC-01 {{BC名称}}
    participant BC06 as BC-06 {{BC名称}}
    participant EventBus as 消息总线

    User->>FE: {{操作描述，如：搜索 Skill}}
    FE->>AS: {{调用应用服务，如：搜索请求}}
    AS->>BC06: {{查询，如：执行语义搜索}}
    BC06-->>AS: {{返回，如：搜索结果列表}}
    AS-->>FE: {{响应，如：Skill 列表}}
    FE-->>User: {{展示，如：展示搜索结果}}

    User->>FE: {{下一步操作，如：点击查看详情}}
    FE->>AS: {{调用，如：获取 Skill 详情}}
    AS->>BC01: {{查询，如：查询 Skill 聚合根}}
    BC01-->>AS: {{返回}}
    AS-->>FE: {{响应}}
    FE-->>User: {{展示}}
```

**主路径说明**: {{文字补充说明关键步骤或决策点}}

**异常路径**:
- {{异常情况1，如：Skill 已下架}} → {{系统响应}}
- {{异常情况2}} → {{响应}}

---

## UJ-02: {{旅程名称}}

**参与角色**: {{角色}}
**关键 BC/FD**: {{BC}}
**场景描述**: {{描述}}

```mermaid
sequenceDiagram
    actor Creator as {{创建者角色}}
    participant FE as 前端
    participant AS01 as AS-01 {{应用服务名}}
    participant BC01 as BC-01 Skill服务
    participant BC03 as BC-03 审核服务
    participant EventBus as 消息总线

    Creator->>FE: {{操作}}
    FE->>AS01: {{请求}}
    AS01->>BC01: {{命令}}
    BC01->>BC01: 执行聚合根方法（发出领域事件）
    BC01->>EventBus: 发布 {{EventName}}
    EventBus->>BC03: 消费事件，创建审核任务
    BC03-->>EventBus: 审核完成事件
    EventBus->>BC01: 消费审核结果，更新状态
    BC01-->>AS01: 状态已更新
    AS01-->>FE: {{响应}}
    FE-->>Creator: {{展示结果}}
```

---

## 角色×旅程覆盖矩阵

| 角色 | UJ-01 | UJ-02 | ... |
|------|-------|-------|-----|
| {{角色1}} | ✓ | ✓ | |
| {{角色2}} | | ✓ | |

---

## 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | {{YYYY-MM-DD}} | 初始版本 |
