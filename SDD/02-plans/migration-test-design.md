# FD-PORTABLE 验证设计

关联规格：SDD/01-specs/features/multi-tool-runtime/spec.md。

## AC 与用例映射

| AC | 验证文件 | 正例与反例 |
|---|---|---|
| AC-001 | tests/runtime.test.mjs | 只读、规格、测试允许；代码在准备/绑定前拒绝、后允许 |
| AC-002 | tests/runtime.test.mjs | 既有 AC 可用；空规格、无关规格、缺失 AC/测试设计/映射拒绝 |
| AC-003 | tests/runtime.test.mjs | 会话隔离、恢复；摘要变化、任务关闭、重复 prepare 后旧绑定拒绝 |
| AC-004 | tests/runtime.test.mjs | 绝对/相对/中文/空格/大小写/CRLF；删除、移动、混合补丁、越界、symlink |
| AC-005 | tests/adapters.test.mjs | 五种宿主协议同一拒绝→允许→摘要过期；失败/后置事件不解锁 |
| AC-006 | tests/install.test.mjs | 五宿主安装/重复安装/卸载；原文、空配置、用户更改、共用 Kimi 配置、冲突和故障回滚 |
| AC-007 | tests/validation.test.mjs | 实际测试进程的成功/失败；陈旧证据、遗漏文件、AC 前缀误匹配；临时 Git base/head 不受脏工作区影响 |
| AC-007 | tests/portability.test.mjs | 文本证据从 CRLF 转换为 LF 后摘要保持一致 |
| AC-008 | tests/validation.test.mjs | 无代码为 N/A；例外单列；根提交计数；共享分类 |
| AC-009 | tests/install.test.mjs | doctor 区分安装与观察回执；缺失/修改注册报错；未注册 Kimi 片段不得当成激活 |
| AC-010 | tests/helpers.mjs、tests/fixtures/hooks.json | 所有测试使用隔离临时项目；协议夹具注明来源与边界；CI 共用 check-all 命令 |

## 执行与证据

运行 `node scripts/check-all.mjs`。使用本仓库 `.sdd/tasks/FD-PORTABLE.json` 执行 prepare、verify 和 validate，验证完整迁移范围。最终代码定稿后重新执行 verify，提交后以初始提交 b197183 与 HEAD 进行验证。

此任务清单用于最终迁移验收，不能倒推此前改动的编辑时序。真实模型会话的启用和信任在 docs/hosts.md 的 smoke 清单中单独验收；协议回放不替代该步骤。
