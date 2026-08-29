# 开发轮次账本

`ROUND_LEDGER_REVISION=3 / CURRENT_ROUND=R0 / STATUS=WORKSTREAM_ONBOARDING_AND_COMMIT_BLOCKED`

此文件记录可从仓库恢复的实际开发状态。设计决定仍以 `PROJECT_STATE_LEDGER.md` 为准。

## 任务注册

| 角色 | 任务/深度链接 | 模型 | 状态 | 当前授权 |
|---|---|---|---|---|
| 主任务 | 当前对话 | 当前模型 | `ACTIVE` | R0 治理、合同、Git、接线与发任务 |
| 前端 | `01a04d52-87f7-7c00-a047-7343867cb955` | `gpt-5.6-luna / max` | `ONBOARDING` | 只读核对合同，等待精确 R1 dispatch |
| 后端 | `01a04d52-95e5-72c0-91d8-ebf0cfe85315` | `gpt-5.6-luna / max` | `ONBOARDING` | 只读核对合同，等待精确 R1 dispatch |

“1.5x”不是任务 API 可锁定的模型参数；若 Codex 主机提供速度/服务档位，需在客户端设置。仓库只把可验证的 `model=luna`、`thinking=max` 和实际提交证据写入权威状态。

## R0 — 开源与治理基线

- `CONTRACT`: `docs/rounds/R0_GOVERNANCE_CONTRACT.md`
- `FRONTEND`: `NOT_STARTED / NO_PRODUCT_WRITE_AUTHORIZATION`
- `BACKEND`: `NOT_STARTED / NO_PRODUCT_WRITE_AUTHORIZATION`
- `INTEGRATION`: `NOT_APPLICABLE_GOVERNANCE_ONLY`
- `AUTOMATED_TEST`: `DOC_LINK_CHECK_PASSED_31_FILES_0_BROKEN`
- `PLAYER_ACCEPTANCE`: `AWAITING_REVIEW`
- `PACKAGE`: `NOT_RUN`
- `GIT`: `MAIN_INITIALIZED / INITIAL_COMMIT=BLOCKED_GIT_IDENTITY_NOT_CONFIGURED`
- `PUBLIC_REMOTE`: `NOT_CONFIGURED`
- `NEXT`: 收取两个任务的只读接管报告；用户提供或配置 Git 作者身份后提交基线并把任务移入独立 worktree，随后由主任务冻结 R1 合同和共享类型再同步下发开发。

## 轮次历史

| 轮次 | 合同 | 前端 | 后端 | 接线 | 玩家审查 | 备注 |
|---|---|---|---|---|---|---|
| R0 | v1 | N/A | N/A | N/A | `AWAITING_REVIEW` | 治理与仓库基线 |
