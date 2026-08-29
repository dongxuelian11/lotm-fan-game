# 主任务、前端任务与后端任务交接协议

`PROTOCOL_REVISION=1 / STATUS=ACTIVE`

## 1. 权威与任务拓扑

- 当前主任务：计划审查、设计 Grill、公共合同、根配置、Git、接线、测试汇总和用户验收；
- 前端任务：只实现当前轮前端写集；
- 后端任务：只实现当前轮后端写集；
- 深度链接是进入对应任务的导航，不是实时状态或设计权威；
- 自动压缩或接管后，必须从 `AGENTS.md -> PROJECT_STATE_LEDGER.md -> MASTER_DEVELOPMENT_PLAN.md -> ROUND_LEDGER.md -> 当前轮合同 -> 自己的状态文件` 恢复。

## 2. 默认精确写集

| 所有者 | 可写 | 不可自行修改 |
|---|---|---|
| 前端 | `src/renderer/**`、`tests/renderer/**`、`docs/workstreams/FRONTEND_STATUS.md` | `src/shared/**`、Main/领域/SQLite、根配置、总账本 |
| 后端 | `src/main/**`、`src/domain/**`、`src/resolution/**`、`src/simulation/**`、`src/content/**`、`src/persistence/**`、`tests/backend/**`、`docs/workstreams/BACKEND_STATUS.md` | `src/shared/**`、Renderer、根配置、总账本 |
| 主任务 | `src/shared/**`、`tests/integration/**`、根配置、`.github/**`、合同/账本/许可证 | 不覆盖两个任务未接线的在途改动 |

当前轮合同可以缩小写集，不能默认为扩大。任务不是独自在仓库工作：不得回滚、覆盖、重排或格式化他人的文件。

## 3. 状态机

工作流状态只能是：

`NOT_STARTED -> ONBOARDING -> IMPLEMENTING -> READY_FOR_INTEGRATION`

异常状态：`BLOCKED`、`CONTRACT_CONFLICT`、`SYNC_REQUIRED`。主任务接线后写 `INTEGRATED`；只有用户可使本轮进入 `PLAYER_ACCEPTED`。

出现以下情况立即停止越界实现并上报：

- `DESIGN_GAP=<decision-id>:<why it blocks>`
- `NEEDS_MASTER_CHANGE=<file>:<reason>:<required contract>`
- `CONTRACT_CONFLICT=<version>:<observed mismatch>`
- `SYNC_REQUIRED=<expected base>:<observed base>`

## 4. 每次原子任务的持久回执

```text
ROUND_ID=
WORKSTREAM=FRONTEND|BACKEND
CONTRACT_VERSION=
BASE_SHA=
HEAD_SHA=
WRITE_SET=
COMPLETED=
TESTS=
KNOWN_GAPS=
NEEDS_MASTER_CHANGE=NONE|...
PLAYER_ACCEPTANCE=NOT_RUN
STATUS=
NEXT_ACTION=
```

先把回执写入自己的状态文件并提交，再在任务中回复。聊天摘要缺失时，以文件和 Git 提交为准。

## 5. 主任务接线协议

主任务只有在两边均为 `READY_FOR_INTEGRATION` 时开始正常接线；若某轮合同声明可单边降级，必须在开工前写清。接线步骤：

1. 读取两个状态文件并验证实际提交头、差异和写集；
2. 重新检查共享合同和失败行为，不根据摘要猜测；
3. 按轮次合同声明顺序集成，解决冲突但不静默改玩法；
4. 运行类型、单元、schema、契约、集成、构建和桌面 smoke；
5. 写集成回执、剩余缺口和玩家审查材料；
6. 用户明确验收后更新台账，才可下发下一轮。

不自动合并，不用“代码存在”代替接线，不用自动测试代替玩家体验审查。
