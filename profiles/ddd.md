# DDD 架构配置

仅在 `profiles` 包含 `ddd` 时启用。

- 读取 L1-DDD_SPEC.md 建立架构约束，以 L1-BC_SPEC.md 设计限界上下文。
- 区分 Interface、Application、Domain、Infrastructure，领域不变量由领域对象维护，I/O 经 Port/Adapter 隔离。
- 聚合/事务边界、跨 BC 事件、查询依赖和可靠性以项目 DDD_SPEC/ADR 为准，偏离模板需说明理由。
- 新事件同步 DOMAIN_EVENT_CATALOG；检查层级、不变量、事务边界、事件注册及 BC 依赖。
- 未采用 DDD 时跳过 BC/聚合专属步骤，保留 AC、规格和测试追踪。
