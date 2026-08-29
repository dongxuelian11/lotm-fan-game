# 《诡秘之主》同人游戏：Agent 接管与开发合同

`CONTRACT_REVISION=5 / STATUS=R1_INTEGRATED_AWAITING_PLAYER_ACCEPTANCE / PRODUCT_CODE=R1_INTEGRATED / USER_DESIGN_AUTHORITY=FINAL`

本文件是所有 Codex/agent 的强制入口。Windows 路径大小写不敏感，仓库只保留规范文件名 `AGENTS.md`，不要再创建重复的 `agents.md`。

当前任务目标是在 `D:\诡秘` 制作一款参考《汴京梦华》节奏、但以《诡秘之主》世界为背景的原创旁线同人单机游戏。用户拥有总设计权；当前主对话负责审查计划、冻结合同、Git/接线和发任务，独立设计 Grill 任务逐题采访并固化新决定，前端与后端两个开发任务只执行已下发轮次。

## 1. 自动压缩或接管后的恢复顺序

不得凭聊天摘要继续。按顺序完整读取：

1. `AGENTS.md`；
2. `PROJECT_STATE_LEDGER.md` 的头部、决定登记、`CURRENT_PROGRESS`、`FOUNDATION_AUDIT` 和 `NEXT_ACTION`；
3. `docs/MASTER_DEVELOPMENT_PLAN.md`；
4. `docs/ARCHITECTURE_CONTRACT.md`；
5. `docs/THREAD_HANDOFF_PROTOCOL.md`；
6. `docs/ROUND_LEDGER.md`；
7. 当前 `docs/rounds/*.md`；
8. 自己的 `docs/workstreams/*_STATUS.md`；
9. 当前任务涉及的玩法主题文档、原著审计和参考复用审计；
10. `git status`、当前分支、基线 SHA、HEAD 和精确差异。

深度链接只是导航快照，不是权威。聊天与仓库冲突时按：用户最新明确确认 > 台账 `LOCKED` 决定 > 当前轮合同 > 架构合同 > 主题文档 > 任务摘要。发现冲突必须停下并报告，不能静默选一个。

## 2. 当前锁定的产品边界

- 原作同期、受原著约束的原创旁线；玩家是原创普通人角色，不做官场模拟；
- 第一版玩家途径：占卜家、观众、猎人，从普通人开始，目标至序列7；
- 按周推进；四个固定主要行动为工作、学习、调查、休养；动态行动次数基准3，最低1，不结转；
- 工作按职业/产业规模获得非固定金钱；有黑市买卖和每三个月一次的拍卖会；生活系统从简，非凡体系是重点；
- 普通情景使用统一数值判定，不使用战斗转盘；核心能力为体质、感知、意志、知识（0—500）；状态为健康、精神、灵性，污染另行可见；
- 战斗按“次数盘 → 双方实时能力盘 → 双方都转完后的胜负盘”处理；胜负盘只判胜负，伤势/逃脱/俘虏/生死走因果与生存规则；生存失败即死亡，死亡结束并封存周目；
- 事件卡是一级内容系统：第一版目标90张独立卡 + 9条三阶段链（共117个定义）；一次只弹一张阻塞卡，其余进入最小待处理列表/纪事；处理列表事件不消耗行动点，但硬资源成本照常；
- RAG/小模型只在作者/构建期辅助生成待审文本变体；schema、规则、选项、难度、奖励、惩罚和后果由引擎决定；运行时确定性选择已审核文本；
- UI 是常驻周仪表盘 + 弹层/抽屉，战斗为周舞台上的全屏遮罩，视觉为克制的神秘学卷宗/工作台。
- 第一版捏人保持六步短流程：10个整合出身、12个当前职业、出身×职业三级兼容、恰好2个性格特质+1个真实缺陷、摘要页恰好1项背景过滤专精；贫民层与劳工层各两项核心原型已锁定，但其余6项、所有正式名称/数值和120组具体兼容矩阵仍待逐题确认。

具体公式、决定编号、撤回项和延期项只能从 `PROJECT_STATE_LEDGER.md` 与对应主题文档读取，不以本摘要替代。

## 3. 当前开发边界

- R0 已完成开源、Git、合同、任务注册和抗压缩状态；
- R1 已从同一公开基线完成前后端开发、主任务接线、完整类型/测试/构建与本机两进程 Electron smoke；当前等待用户实际审查，R2 未冻结或下发；
- 允许用占位能力/fixture 建立存档、随机流、事件和转盘底座；
- 不等待22条途径全部能力才开发底层；也不得借“底层开发”提前臆造真实能力、魔药、晋升、经济细数或原著事件内容；
- `READY_FOR_INTEGRATION` 只是候选；接线、自动门禁、玩家验收、打包和发布均为独立事实；
- 本地 Git 初始化不等于已创建 GitHub 公共仓库或已公开发布。

## 4. Grill-me 与用户总设计权

会改变玩法、数值、内容规模、原著解释或系统边界的问题必须：

- 先调查参考、源码、原著审计与已锁定决定；
- 按主题分批，每题独立编号，提供互斥选项、推荐项、影响和代价；
- 说明本题锁定什么、不锁定什么；
- 用户未明确选择前保持 `PENDING/QUESTION_READY`；
- 回答后先更新 `PROJECT_STATE_LEDGER.md`，再同步所有主题 Markdown；
- 不重问已锁定机械决定；不把“之后再说”“不重要”改写成完成；
- 用户要求第一版简单时，技术底座可用 fixture 开工，内容细节推迟到真正依赖它的轮次。

发现空缺时使用 `DESIGN_GAP=<decision-id>:<why>`，不要自行补完。

## 5. 三方所有权与写集

### 主任务

独占：`src/shared/**`、`tests/integration/**`、根配置、依赖/锁文件、`.github/**`、许可证、总计划、架构/轮次合同、总账本、Git 集成和玩家审查。

### 设计 Grill 任务

串行独占当前设计批次：`PROJECT_STATE_LEDGER.md`、`docs/OPEN_DECISIONS.md`、`docs/DECISION_INDEX.md`、受影响主题设计文档和 `docs/workstreams/DESIGN_STATUS.md`。一次只问一个真正未决且会影响玩家体验的问题，必须提供2—3个互斥选项与推荐；可从源码/文档查明的事实先调查。用户回答后先更新总账本和对应主题 MD，再提交 `DECISION_RECEIPT`。不得修改产品代码、工程合同、根配置或开发工作流状态。

### 前端任务

默认可写：`src/renderer/**`、`tests/renderer/**`、`docs/workstreams/FRONTEND_STATUS.md`。不得自行修改共享合同、Main、领域规则、SQLite、根配置或总账本。

### 后端任务

默认可写：`src/main/**`、`src/domain/**`、`src/resolution/**`、`src/simulation/**`、`src/content/**`、`src/persistence/**`、`tests/backend/**`、`docs/workstreams/BACKEND_STATUS.md`。不得自行修改共享合同、Renderer、根配置或总账本。

当前轮合同可缩小写集。任何越界需求先提交：

`NEEDS_MASTER_CHANGE=<file>:<reason>:<required contract>`

所有任务都不是独自在仓库工作：不得回滚、覆盖、重排、批量格式化或删除他人改动，不使用破坏性 Git 命令，不自动合并。

## 6. 架构不变量

- Renderer 只接收公开投影并发送类型化意图，不直接访问 Node、文件系统、SQLite、私有知识库或模型；
- preload 只暴露窄 API，不暴露通用 IPC；Main 校验发送方、schema、合同版本和状态版本；
- Main/SQLite 是运行时权威；领域规则是无 Electron/React/DB 依赖的纯 TypeScript；
- 所有状态变化以单事务回执和重启恢复为证据；页面变化不证明已保存；
- 生产规则禁止直接 `Math.random()`，统一使用动作级可记录随机流；
- 事件/能力内容数据驱动，不能在配置中嵌任意函数或原始 HTML；特殊能力必须登记扩展处理器和测试；
- 不向 Renderer 泄露隐藏条件、NPC秘密、未揭露知识、私有 RAG 证据或内部堆栈。

详见 `docs/ARCHITECTURE_CONTRACT.md`。

## 7. 每轮开发、接线和审查

每轮固定执行：设计任务将新决定提交并由主任务合入 `main` → 主任务冻结合同与基线 → 前后端独立 worktree 开发 → 两边写状态/提交证据 → `READY_FOR_INTEGRATION` 后停止 → 主任务源码审查和接线 → 类型/单元/schema/契约/集成/build/桌面 smoke → 用户实际审查 → 下一轮。

聊天回答、深度链接摘要或设计任务未合入的分支都不是开发权威。每次决定合入后，主任务发送 `DESIGN_SYNC=<ledger revision>:<main sha>:<affected contracts>` 给两个开发任务；开发任务在实现依赖该决定的代码前必须确认基线包含该 SHA。

任务每完成一个原子切片，必须先更新自己的状态文件，包含轮次、合同、基线、HEAD、写集、测试、已知缺口和下一步。自动压缩后从该文件恢复，不重做已完成工作。

## 8. 参考项目和 IP/数据边界

- `D:\游戏\汴京梦华_Game——初步正式版\汴京梦华_Game` 与 `D:\gmzz` 永远只读；
- `D:\gmzz` 是并行脏工作树，绝不读取或触碰 `.qa-prodserver3.err.log`、`.qa-prodserver3.out.log`；
- 《汴京梦华》只借鉴节奏、屏幕结构和事件池原则；不复制其题材代码、文案、素材或不明许可内容；
- gmzz 只适配其窄 IPC、Main/SQLite 权威、回执/重放、公开投影、RAG 泄漏防线和来源验证原则；不复制私有 corpus、存档、生成数据、秘密或耦合领域实现；
- 公共仓库不得提交原著正文、私人知识库、凭据、用户数据、运行 DB、构建缓存或无来源素材；MIT 只覆盖原创代码/文档，见 `NOTICE`。

## 9. Git 与证据规则

- `main` 由主任务维护；设计分支使用 `work/design-grill-*`，前后端分支使用 `work/frontend-rNN-*`、`work/backend-rNN-*`；
- 每个任务从轮次登记的同一基线 SHA 开始，并在独立 worktree 工作；
- 原子提交、精确暂存；禁止 force-push、破坏性 reset、无边界 `git add -A` 和自动合并；
- 主任务验证实际提交头、差异和写集后才能集成；
- 未运行保持 `NOT_RUN`，不可用保持 `NOT_AVAILABLE`，未配置保持 `NOT_CONFIGURED`；
- 不用单元测试冒充桌面运行，不用当前机器 smoke 冒充干净机器安装，不用本地提交冒充公共 GitHub 发布。

## 10. 文档地图

| 文件 | 作用 |
|---|---|
| `PROJECT_STATE_LEDGER.md` | 唯一完整设计决定与总状态登记簿 |
| `docs/README.md` | 玩法主题文档入口 |
| `docs/MASTER_DEVELOPMENT_PLAN.md` | 分轮开发、接线和用户审查计划 |
| `docs/ARCHITECTURE_CONTRACT.md` | 运行时、依赖、公开投影与回执边界 |
| `docs/THREAD_HANDOFF_PROTOCOL.md` | 三任务写集、状态机、回执和接线流程 |
| `docs/ROUND_LEDGER.md` | 当前轮次、任务 ID、提交头和证据状态 |
| `docs/OPEN_SOURCE_AND_GIT.md` | 许可证、分支、worktree 和发布真值 |
| `docs/rounds/*.md` | 每轮精确合同 |
| `docs/workstreams/*_STATUS.md` | 前端/后端抗压缩接管状态 |
| `REFERENCE_REUSE_AUDIT.md` | 参考项目与 gmzz 的只读复用审计 |
| `LOTM_CANON_GAMEPLAY_AUDIT.md` | 原著事实、知识和 RAG 边界 |
| `V1_CHARACTER_CREATION_SPEC.md` | 第一版捏人锁定流程 |

## 11. 当前接管点

- 当前轮次：R1 桌面权威纵切；R0 已提交并公开发布；
- 产品代码：`R1_INTEGRATED / LOCAL_TWO_PROCESS_ELECTRON_SMOKE_PASSED / PLAYER_ACCEPTANCE_NOT_RUN / PACKAGE_NOT_RUN`；
- 前端任务：`01a04d7d-abe2-7732-9ac0-e4ff95397ca2`，候选 `72946759cf1c3b0309f85ddf29b26a5b67df7996` 已合入；后端任务：`01a04d7d-b97c-7311-8700-2f86c39f86c5`，候选 `e8ee23c60d4c0a52d476ad1203639db3c52a2ac4` 已合入；两者当前均为 hold，无后续轮写权限；
- 主任务接线/烟测提交为 `14d17c60eb910137a270c645993d374ab74f5231`；全量门禁为类型检查通过、6文件44项测试通过、完整构建通过、生产相对资源路径通过、两进程 Electron/SQLite 恢复通过；这不是安装包或干净机器证据；
- 设计 Grill 任务：`01a04d69-e530-7df1-b7e9-abc2d24803f1`，`gpt-5.6-sol / high`，分支 `work/design-grill-r2-foundation`；当前 ledger revision 255，`D-V1CC10` 已合入并完成 `DESIGN_SYNC`，当前只可继续 `D-V1CC11` 小市民层出身名册单题；
- 下一步：设计任务继续一次一题 Grill 并交主任务审查候选；主任务继续等待用户实际审查 R1 桌面壳。用户明确通过前保持 `PLAYER_ACCEPTANCE=NOT_RUN`，不得冻结或下发 R2；
- 真实魔药、晋升、能力和事件内容仍在相应轮次前继续 Grill，不阻塞 R1 技术壳。
