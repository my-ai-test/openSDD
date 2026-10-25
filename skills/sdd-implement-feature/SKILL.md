---
name: sdd-implement-feature
description: Implement a feature or repair a behavior through SDD acceptance criteria, contracts, test design, implementation, and verified evidence. Use for an identified FD or a concrete development task.
---

# 实现 SDD 特性

## 输入与上下文

确定 FD、业务描述、相关 AC 和代码模块。先读取 .sdd/config.json、框架 rules/core.md、相关规格与 BACKLOG；根据 profiles 判断 DDD/企业约定是否适用。已有上下文足够时继续。

## 执行顺序

1. **只读调查与分析**：确认接口、测试命令和范围，首次业务代码写入前说明需求分类、FD/AC、规格影响、验证计划。
2. **规格准备**：加载 sdd-write-ac，按模板更新变化的行为。已有 AC 正确的 Bug 修复记录无需改规格的理由。新 API 先在 API_SPEC 的“已实现端点详细契约”定义方法、路径、权限、请求/响应及错误。
3. **测试设计**：执行 sdd-write-tests 的场景设计阶段，从 AC 按六层模型固化场景，不以实现现状决定期望结果。
4. **准备与绑定**：按框架 docs/runtime.md 创建任务清单，列出规格/AC、代码范围、测试设计和测试文件映射；prepare 后绑定当前宿主会话。规格/设计变化后重新 prepare。
5. **实现与测试**：采用项目实际架构；ddd profile 按 Domain → Application → Infrastructure → Interface 实现并检查不变量、事务和事件。按项目 testCommand 验证，不假定 Jest/NestJS/Prisma。
6. **文档和最终验证**：按触发条件同步 Feature/Data/API/UI/Security，记录验证结果并运行独立验证器。失败则修复、重新记录证据并复验。

## 完成报告

报告 AC、变更文件、实际命令与结果、文档同步、未完成项。N/A 说明理由，未运行不得标通过。提交与发布按用户授权执行。

## 编排

复杂多角色流程先执行 sdd-generate-uj，规格完成后可顺序执行 sdd-review-spec。按技能名称加载内容，宿主不支持嵌套时由当前 Agent 顺序执行，调用语法见 docs/hosts.md。
