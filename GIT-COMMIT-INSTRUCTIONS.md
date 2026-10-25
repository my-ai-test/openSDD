# 手动提交 Git 操作指南

请在 **Codex 外部的 PowerShell 或 Windows Terminal** 中执行。此前失败是执行环境无法写入 `.git`，不是遗留锁文件，不需要删除 `index.lock`。

以下命令只做本地提交，不会推送远端。每个代码块按顺序执行；出现错误时先修复，不要继续下一步。

## 1. 进入仓库，检查待提交文件

```powershell
Set-Location 'D:\workspace\openSDD'
git status --short
```

## 2. 重新生成验证证据并检查全部变更

整段复制执行；任一步失败都会停止当前代码块。

```powershell
& {
    node runtime/cli.mjs prepare --project . --task FD-PORTABLE
    if ($LASTEXITCODE -ne 0) { throw '任务准备失败，请先修复' }

    node runtime/cli.mjs verify --project . --task FD-PORTABLE
    if ($LASTEXITCODE -ne 0) { throw '测试失败，请先修复' }

    node runtime/cli.mjs validate --project .
    if ($LASTEXITCODE -ne 0) { throw '变更验证失败，请先修复' }

    git diff --check
    if ($LASTEXITCODE -ne 0) { throw '差异格式检查失败，请先修复' }
}
```

预期：46 项测试通过，变更验证返回 `"ok": true`。

## 3. 暂存并审查提交内容

```powershell
& {
    git add --all
    if ($LASTEXITCODE -ne 0) { throw '暂存失败' }

    git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw '暂存差异检查失败' }

    git diff --cached --stat
    git diff --cached --name-only
}
```

此次会包含原有 `AGENTS.md`、`openSDD.rar` 和本指南。文件列表不应包含 `.tmp/`、`.sdd/state/` 等临时内容。

## 4. 创建提交，并验证实际提交内容

```powershell
& {
    git commit -m "Add portable SDD runtime and multi-tool integrations"
    if ($LASTEXITCODE -ne 0) { throw '提交失败' }

    node runtime/cli.mjs validate --project . --base b197183 --head HEAD
    if ($LASTEXITCODE -ne 0) { throw '提交后验证失败，请记录问题并修复' }

    git log -1 --oneline
    git status --short
}
```

预期：提交后验证返回 `"ok": true`，`git status --short` 没有输出，表示工作区干净。

## 5. 更新执行记录，再提交记录

成功后，将以下两份记录中的“Git 权限阻塞／尚未提交”更新为实际提交及验证结果：

- `SDD/02-plans/multi-tool-migration.md`
- `SDD/02-plans/migration-validation.md`

然后执行：

```powershell
& {
    git add -- SDD/02-plans/multi-tool-migration.md SDD/02-plans/migration-validation.md
    if ($LASTEXITCODE -ne 0) { throw '记录暂存失败' }

    git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw '记录格式检查失败' }

    git commit -m "Record successful migration commit verification"
    if ($LASTEXITCODE -ne 0) { throw '记录提交失败' }

    node runtime/cli.mjs validate --project . --base b197183 --head HEAD
    if ($LASTEXITCODE -ne 0) { throw '最终提交验证失败' }

    git status --short
    git log -2 --oneline
}
```

真实宿主、Linux CI、Bash 的待验证状态应保留，不能因 Git 提交成功改为通过。
