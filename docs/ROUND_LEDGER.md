# 开发轮次账本

`ROUND_LEDGER_REVISION=6 / CURRENT_ROUND=R1 / STATUS=CONTRACT_FROZEN_PENDING_WORKTREE_DISPATCH`

此文件记录可从仓库恢复的实际开发状态。设计决定仍以 `PROJECT_STATE_LEDGER.md` 为准。

## 任务注册

| 角色 | 任务/深度链接 | 模型 | 状态 | 当前授权 |
|---|---|---|---|---|
| 主任务 | 当前对话 | 当前模型 | `ACTIVE` | R1 合同与共享类型已冻结；正在迁移 worktree、接线与发任务 |
| 设计 Grill | `01a04d69-e530-7df1-b7e9-abc2d24803f1` | `gpt-5.6-sol / high` | `D-V1CC4_INTEGRATED_CONTINUING` | 未决设计逐题 Grill、持久化并交主任务合入 |
| 前端 | `01a04d52-87f7-7c00-a047-7343867cb955` | `gpt-5.6-luna / max` | `ONBOARDING_READY` | 等待精确 R1 dispatch |
| 后端 | `01a04d52-95e5-72c0-91d8-ebf0cfe85315` | `gpt-5.6-luna / max` | `ONBOARDING_READY` | 等待精确 R1 dispatch |

“1.5x”不是任务 API 可锁定的模型参数；若 Codex 主机提供速度/服务档位，需在客户端设置。仓库只把可验证的 `model=luna`、`thinking=max` 和实际提交证据写入权威状态。

## R0 — 开源与治理基线

- `CONTRACT`: `docs/rounds/R0_GOVERNANCE_CONTRACT.md`
- `FRONTEND`: `NOT_STARTED / NO_PRODUCT_WRITE_AUTHORIZATION`
- `BACKEND`: `NOT_STARTED / NO_PRODUCT_WRITE_AUTHORIZATION`
- `INTEGRATION`: `NOT_APPLICABLE_GOVERNANCE_ONLY`
- `AUTOMATED_TEST`: `DOC_LINK_CHECK_PASSED_31_FILES_0_BROKEN`
- `PLAYER_ACCEPTANCE`: `PASSED_CONTINUE_AUTHORIZED_2026-08-29`
- `PACKAGE`: `NOT_RUN`
- `GIT`: `MAIN_COMMIT=e0a7677 / ORIGIN_MAIN_PUSHED`
- `PUBLIC_REMOTE`: `https://github.com/dongxuelian11/lotm-fan-game`
- `NEXT`: R1 合同与共享脚手架已冻结；主任务把前后端迁入独立 worktree，从同一 dispatch SHA 开工。

## R1 — 桌面权威纵切

- `CONTRACT`: `docs/rounds/R1_DESKTOP_AUTHORITY_CONTRACT.md` / `r1-v1`
- `ROOT_SCAFFOLD`: `8048ff1c69fdd540d5b9e7cdae16aec7e007ca21`
- `DESIGN_AUTHORITY`: `LEDGER_REVISION=247 / MAIN_SHA=4107945c276a1d6658bafe2bae49ca6b2b2d86e7`
- `SHARED_TYPES`: `src/shared/contracts.ts`
- `TYPECHECK`: `PASSED`
- `CONTRACT_TEST`: `PASSED_1_FILE_3_TESTS`
- `NPM_AUDIT`: `PASSED_0_VULNERABILITIES`
- `FRONTEND`: `ONBOARDING_READY / DISPATCH_PENDING`
- `BACKEND`: `ONBOARDING_READY / DISPATCH_PENDING`
- `INTEGRATION`: `NOT_STARTED`
- `DESKTOP_SMOKE`: `NOT_RUN`
- `PLAYER_ACCEPTANCE`: `NOT_RUN`
- `PACKAGE`: `NOT_RUN`
- `DESIGN_GAP_ROUTING`: `DIRECT_TO_DESIGN_GRILL`

## 轮次历史

| 轮次 | 合同 | 前端 | 后端 | 接线 | 玩家审查 | 备注 |
|---|---|---|---|---|---|---|
| R0 | v1 | N/A | N/A | N/A | `PASSED_CONTINUE_AUTHORIZED_2026-08-29` | 治理与仓库基线 |
| R1 | r1-v1 | `DISPATCH_PENDING` | `DISPATCH_PENDING` | `NOT_STARTED` | `NOT_RUN` | 桌面壳、窄桥接、SQLite回执与重启恢复 |
