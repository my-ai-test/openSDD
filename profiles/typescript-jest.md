# TypeScript / Jest 配置

仅在 `profiles` 包含 `typescript-jest` 时启用。先检查消费项目 package.json 和 Jest 版本，再设置 `testCommand`，不要假定某版 CLI 参数可用。

- examples/minimal/tests 是需要补充领域实现的演示，不是框架可执行测试。
- 使用完整接口 Mock 工厂与数据工厂，明确等待异步行为。
- NestJS、Prisma 示例仅适用于实际采用这些组件的项目。
- 框架自身使用 Node 内置测试，不限定消费项目测试框架。
