# R1 桌面权威纵切合同

`ROUND_ID=R1 / CONTRACT_VERSION=r1-v1 / STATUS=FROZEN_FOR_DISPATCH / ROOT_SCAFFOLD_SHA=8048ff1c69fdd540d5b9e7cdae16aec7e007ca21 / DESIGN_AUTHORITY_SHA=4107945c276a1d6658bafe2bae49ca6b2b2d86e7`

## 1. 本轮结果

交付一个可启动的 Electron 桌面纵切：玩家能看到无存档起始页，创建一个明确标为工程 fixture 的普通人周目，进入第一周仪表盘；Main/SQLite 在单事务中保存，Renderer 只通过窄 bridge 获得公开投影；关闭并重启后能恢复同一周目。

R1 不实现真实捏人、周行动结算、事件抽取、经济、魔药、能力、判定或战斗。fixture 不是这些系统的默认设计。

## 2. 共享权威

唯一共享类型为 `src/shared/contracts.ts`，精确版本为：

- `CONTRACT_VERSION=r1-v1`；
- `RULE_VERSION=fixture-r1`；
- `CONTENT_VERSION=fixture-r1`；
- `STORAGE_SCHEMA_VERSION=1`。

技术 fixture 固定为：第1周、3次可用行动、现金0便士、四项核心能力均15、健康100/100、精神100/100、灵性15/15、污染0。它只用于接线和存档证据，不代表最终出身、职业、特质或经济开局。

bridge 只公开两个方法：

1. `getBootstrap()`：读取存储状态、周目摘要与当前公开状态；
2. `submitIntent(envelope)`：提交当前唯一 fixture 意图并返回统一 `CommitReceipt`。

前后端不得复制、扩写或本地改造这套类型。需要改变时提交 `NEEDS_MASTER_CHANGE=<file>:<reason>:<required contract>`。

## 3. 状态与回执不变量

- Main/SQLite 是权威；Renderer 显示不等于保存成功；
- 新建 fixture 的 `runId=null`、`expectedRevision=0`；成功后周目从 revision 0 变为 1；
- 同一个 `intentId` 与同一规范 envelope 重试，返回相同的提交身份、时间、revision、checksum 和公开状态，仅 `replayed` 从 `false` 变为 `true`，不发生第二次状态变化；
- 同一个 `intentId` 携带不同规范 payload，返回 `DUPLICATE_INTENT_CONFLICT`；
- 非当前 `expectedRevision` 返回 `REVISION_CONFLICT`；
- 回执和公开状态都携带相同的 `stateChecksum`；
- `stateChecksum` 是不含其自身字段的权威公开状态规范序列化结果之 SHA-256 小写十六进制值；对象键按字典序，数组保序，禁止依赖平台默认对象遍历或本地化格式；
- 金钱只用整数便士 `cashPence`，时间只用 ISO 8601 字符串，revision 只用非负安全整数；
- 关闭并重启 Electron 后，`getBootstrap()` 必须恢复相同 `runId`、revision、checksum 与公开状态；
- 错误只返回共享错误码与可公开消息，不返回 SQL、路径、堆栈、隐藏字段或内部异常文本。

## 4. 后端写集与验收

写集：`src/main/**`、`src/domain/**`、`src/resolution/**`、`src/simulation/**`、`src/content/**`、`src/persistence/**`、`tests/backend/**`、`docs/workstreams/BACKEND_STATUS.md`。

必须实现：

- 安全 BrowserWindow：`contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`；拒绝任意导航、新窗口和非预期 IPC sender；
- preload 使用 `contextBridge`，只暴露共享 `MysteryGameBridge`；
- 使用 Electron 内置 `node:sqlite`，数据库放在应用 `userData` 下；schema 版本、迁移、周目、幂等意图/回执持久化；
- fixture 领域创建保持确定性，不调用 `Math.random()`；checksum 使用稳定规范序列化；
- 后端测试覆盖首次建库、提交、完全相同重放、冲突重放、旧 revision、公开字段白名单和重新打开数据库恢复。

不得实现任何真实玩法意图或臆造数值公式。

## 5. 前端写集与验收

写集：`src/renderer/**`、`tests/renderer/**`、`docs/workstreams/FRONTEND_STATUS.md`。

必须实现：

- 1280×720 可用、可缩放的克制神秘学卷宗/工作台壳；深墨底、旧纸信息卡、琥珀/暗红强调；
- 启动加载、存储不可用、无周目、创建中、创建失败、活动周目六种明确状态；
- 无周目页只提供“创建 R1 工程周目”；名字经过前端即时校验，但 Main 再次校验；
- 活动页显示第一周、3 次可用行动、普通人、四项核心能力、健康/精神/灵性/污染、整数格式化金钱和最小纪事；
- 四个日常按钮、黑市、季度拍卖、事件/战斗入口只能作为明确的“后续轮次未开放”承载，不触发伪逻辑；
- UI 只依赖 `MysteryGameBridge`。测试使用同合同内存 mock，但生产路径不得静默回退到 mock。

不得在前端保存权威周目，也不得把 fixture 文案写成最终设定。

## 6. 主任务接线与自动门禁

两个工作流分别提交 `READY_FOR_INTEGRATION` 后，主任务才接线并验证：

1. 精确写集与基线；
2. `npm run typecheck`；
3. `npm run test`；
4. `npm run build`；
5. 真实 Electron 创建、相同 intent 重放、冲突/旧 revision 拒绝、关闭重启恢复；
6. Renderer 无 Node 全局、无隐藏字段、生产无 mock fallback；
7. 由用户实际审查界面后才把 `PLAYER_ACCEPTANCE` 从 `NOT_RUN` 更新。

## 7. 设计问题路由

R1 当前 `DESIGN_GAP=NONE`。开发时若出现会改变玩法、数值、文案口径、世界设定或内容范围的选择：

1. 不在开发任务或主任务临时拍板；
2. 提交 `DESIGN_GAP=<decision-id>:<why>:<blocked files>`；
3. 主任务把问题直接发送到独立设计 Grill 任务；
4. 设计任务一次一题 Grill 用户并更新对应 MD；
5. 决定提交、审计并合入 `main` 后，主任务发送 `DESIGN_SYNC=<ledger revision>:<main sha>:<affected contracts>`；
6. 只有受影响代码等待，其他 R1 工作继续。
