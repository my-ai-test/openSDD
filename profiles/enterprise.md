# 企业约定配置

仅在 `profiles` 包含 `enterprise` 时启用，在项目规则中明确采用条目。

- 错误码采用 standards/error-code-format.md；业务错误 HTTP 200 是本 profile 约定，不是通用 SDD 要求。
- 审计字段可采用 createBy/createDate/lastUpdatedBy/lastUpdateDate/lastUpdateVersion/deleteFlag。
- 表名、映射、软删除、乐观锁及分页结构由项目 DATA_SPEC/API_SPEC 定义。
- 未启用时按项目自己的错误响应和数据约定评审。
