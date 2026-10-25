# V5 验证与问题记录

## 基线

- 初始提交：b197183；既有未跟踪文件：AGENTS.md、openSDD.rar。
- 本机 Node v24.11.0，Codex 0.163.0；Kimi/OpenCode 未在 PATH 中发现。
- 先前 Bash 执行受到 Windows signal pipe 权限限制；验证时重新检查，并区分环境限制与代码失败。

## 项目记录

| 项目 | 验证 | 结果 |
|---|---|---|
| 1 | 7 个 Skills 官方 quick_validate；模板 frontmatter 解析；失效引用/工具绑定扫描；UTF-8 检查 | 通过 |
| 2 | 14 个 Node 行为测试、CLI prepare/bind/close、Windows 中文/空格/大小写、symlink 边界 | 14/14 通过，无跳过 |
| 3 | 五种宿主协议与插件入口回放；20 个核心+适配测试 | 20/20 通过；非真实模型会话 |
| 4 | 16 个安装回归、晚期故障回滚；PowerShell 包装器中文空格路径安装/诊断/卸载 | 全部通过 |
| 5 | 实际子进程测试、Git base/head、历史采用率、编码可移植性 | 通过；CI 配置已生成，远端 Windows/Linux 作业尚未执行 |
| 6 | 统一回归、本仓库任务证据、包装器与配置语法 | 本地检查通过；主体提交 4d01277，提交范围验证通过 |

## 新发现问题

| ID | 复现/影响 | 修复 | 复验 |
|---|---|---|---|

| V5-001 | PowerShell 默认管道编码损坏中文，替换未生效 | 恢复原文，显式 UTF-8，重新修改 | 7 个 Skills 验证通过，新增文本无问号损坏 |
| V5-002 | profile 提示插入模板 YAML 内部 | 提示移到 frontmatter 后 | 全部规格模板 YAML 解析通过 |

| V5-003 | CRLF 补丁、Windows 大小写及内部 symlink 别名可能造成分类遗漏 | 规范化换行与大小写，拒绝 symlink 路径 | 增加行为回归，通过 |

| V5-004 | 卸载改变用户空 hooks 配置；首次安装后重复安装遗失 null 原始状态 | 保存精确原文和原始存在性；语义比较忽略空 hooks | 安装/重复安装/卸载回归通过 |
| V5-005 | 同一会话的新回执覆盖旧拒绝回执，doctor 无法观察完整闭环 | 回执按阶段、允许/拒绝、任务绑定分开 | doctor 闭环测试通过 |
| V5-006 | Node 子进程管道在当前沙箱返回 EPERM | 改用临时文件描述符捕获子进程输出 | 独立 Git/CLI 集成验证通过 |

| V5-007 | 故障注入时回滚尝试删除尚未创建文件，掩盖原始异常 | 回滚检查目标存在性 | 晚期故障完整恢复用户文件，通过 |
| V5-008 | 原有用户旅程 Skill 描述包含乱码 | 修正为“生成US”，文档检查检测替代字符 | 7 个 Skills 官方检查与仓库契约检查通过 |
| V5-009 | CRLF/LF 转换导致提交后的文本证据失效 | 有效 UTF-8 文本统一换行后散列 | 可移植摘要测试通过 |
| V5-010 | 相同证据再次 prepare 仍可沿用旧绑定 | 准备过程生成唯一代次，绑定校验代次 | 旧绑定拒绝、重新绑定允许，通过 |
| V5-011 | AC-0010 可被当成 AC-001 测试标识 | 最终验证使用完整 token 边界 | 前缀误匹配反例拒绝，通过 |
| V5-012 | 多项目 Kimi 全局受管区块重名 | 按项目路径生成区块标识 | 两项目独立安装/卸载，通过 |
| V5-013 | 修改过的注册在卸载后可能引用已删运行时；doctor 对缺失配置直接异常 | 卸载预检中止；doctor 返回明确诊断 | 注册修改、缺失配置与资源保留测试通过 |
| V5-014 | 悬空 symlink 不被 existsSync 检测 | 逐路径段使用 lstat 检查 | 悬空 junction 越界反例通过 |
| V5-015 | 最终 diff 检查发现 Skill 尾随空白 | 删除尾随空白 | git diff --check 通过 |
| V5-016 | 代理环境中 git add --all 无法创建 .git/index.lock，Permission denied；不存在遗留锁 | 用户在外部终端完成提交，未更改 ACL 或绕过权限 | 提交 4d01277，base/head 验证通过 |
| V5-017 | 记录未编辑时 git commit 返回 nothing to commit，被指南误报为提交失败 | 提交前检查暂存区，0 跳过、1 提交、其他状态报错 | 指南语法及只读分支检查通过；实际新增提交仍由用户执行 |

## 统一验证结果（2026-10-25）

- `node scripts/check-all.mjs`：最终 46/46 通过，0 失败、0 跳过；仓库契约检查通过。
- 本仓库 FD-PORTABLE 的 prepare → verify → validate：实际执行全量检查，21 个代码文件全部具有有效规格/测试证据，0 问题、0 例外。
- 七个 Skills 通过官方 quick_validate；13 个规格模板 frontmatter 和 CI YAML 解析通过。
- PowerShell 入口语法通过；在中文/空格临时目录完成真实安装、doctor、卸载，原配置保留。
- 双项目共用 Kimi 配置经 Python tomllib 解析：6 个合法注册，用户 model 设置保留。
- Git base/head、脏工作区隔离、测试子进程失败码和真实 Hook CLI 已纳入 46 项自动回归。
- 临时安装目录、下载包、测试输出位于忽略的 .tmp/；会话状态不提交。原有 AGENTS.md 原文保留，原有 openSDD.rar 已原样纳入主体提交并注明 V4 归档。
- 最后只读审查覆盖 62 个变更文件：文本编码检查未发现替代字符，常见明文密钥模式扫描无匹配，无临时目录或会话状态进入待提交文件列表。

## Git 收尾结果

主体提交：`4d01277207c6d4c4c4be188287307b6154a3c9df`（Add portable SDD runtime and multi-tool integrations）。检查时工作区干净，用户的第二次提交因没有记录改动而正常返回 nothing to commit；不是主体提交失败。

已实际执行 `node runtime/cli.mjs validate --project . --base b197183 --head HEAD`：返回 ok=true、status=passed，21 个代码文件、0 问题、0 例外，证据来自已提交 HEAD 而非工作区。

已更新本计划、验证记录与 GIT-COMMIT-INSTRUCTIONS.md，修正空提交误报。请执行指南第 5 步提交这三份文档，再重复提交范围验证；此记录不预先声称新的文档提交已完成。

## 宿主验证边界

协议测试不是已安装宿主的真实端到端测试。实际安装后的 Hooks 信任、宿主版本及事件是否触发，应运行 doctor 并按迁移指南完成 smoke。此次未调用模型、未修改本机工具全局配置；真实宿主 smoke 尚未执行。

本地再次尝试 Git Bash `bash -n install.sh`，Bash 在读取脚本前因 `couldn't create signal pipe, Win32 error 5` 退出。Shell 包装器已人工审查；Bash 语法执行仍待不受限环境，Linux CI 已配置该检查。远端 CI 未触发，不记作通过。这些环境检查不应与已通过的本地 Node/PowerShell/协议测试混淆。
