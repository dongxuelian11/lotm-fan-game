# 《诡秘之主》同人游戏参考项目审计与复用矩阵

> `AUDIT_REVISION=1`
> `AUDIT_DATE=2026-08-28 Asia/Shanghai`
> `IMPLEMENTATION_STATUS=NOT_STARTED`
> 结论只覆盖本次实际读取与实机验证的本地快照；两个参考目录全程只读。

## 1. 结论先行

新项目不应整体 fork 《汴京梦华》，也不应整体 fork gmzz。推荐在 `D:\诡秘` 建一个干净、模块化的新底座：

- 从《汴京梦华》吸收“个人成长 + 有限行动 + 月度世界自行演化 + NPC 记忆/议程 + 事件链”的玩法骨架。
- 从 gmzz 复用或改造“Electron 安全边界 + Main/SQLite 权威存档 + exactly-once AI 回合 + 公开信息投影 + RAG 泄漏防线 + 可追溯资产/地图”的工程能力。
- 《诡秘之主》的角色、途径、魔药、扮演法、失控、知识污染、组织、地点、年代、剧情与文字全部重新建模，不能把宋代官制数据机械换皮。
- 在用户确认首要玩家幻想、时间线、玩家身份、AI 边界、时间推进方式及发布范围前，不进入生产实现。

这是一条“玩法取神、基础设施择优、领域模型重建”的路线。

## 2. 路径与证据边界

### 2.1 实际审计路径

- 用户给出的路径：`D:\游戏\汴京梦华\_Game——初步正式版\汴京梦华\_Game`
- 该路径不存在。
- 本机唯一匹配并已实机启动的目录：`D:\游戏\汴京梦华_Game——初步正式版\汴京梦华_Game`
- gmzz：`D:\gmzz`
- 新项目工作区：`D:\诡秘`

若上述唯一匹配目录不是用户意图中的版本，必须停止沿用本报告并重新审计指定版本。

### 2.2 本轮验证层级

- `CONFIRMED_SOURCE`: 读取当前源码、文档、许可证/声明和目录结构。
- `CONFIRMED_STATIC`: 当前 36 个 JavaScript 文件全部通过 `node --check`。
- `CONFIRMED_LIVE`: 用真实浏览器完成建角、两次行动、月份推进、事件弹窗、1280×720 布局与 localStorage 检查。
- `NOT_RUN`: 《汴京梦华》的 Python 测试/模拟脚本依赖当前项目未声明的 `dukpy`，未安装、未运行。
- `DOC_REPORTED_ONLY`: gmzz 状态文档记录的测试数、构建和类型检查结果，本轮没有在大型脏工作树中重新执行。
- `PLAYER_ACCEPTANCE=NOT_RUN`: 新项目尚未开始；gmzz 当前状态也不能升级为已玩家验收。

## 3. 我对《汴京梦华》当前版本的理解

### 3.1 规模与结构

- 当前有效盘点约 52 个文件、4.77 MB、约 4.05 万行源码/内容。
- 主要是无模块化的浏览器全局脚本：`index.html` 按固定顺序加载 `data/*`、`state.js`、NPC、事件、UI、行动、世界、家庭、军事和 `engine.js`。
- 内容量：66 个特质、30 条链式事件、约 335 个常规事件；一次新局实际初始化 705 名 NPC、78 类职位。
- 最大内容/逻辑文件包括 `js/npc_ai_interactions.js`、多份 `data/events_*.js` 和 `js/engine.js`。

### 3.2 真正的核心循环

1. 玩家创建一名角色，选择出身/身份和互斥特质。
2. 每月获得 2 个行动点，用于学习、交际、科举、理事、上疏、产业、军务或家庭等行动。
3. 行动点耗尽后，月份自动推进。
4. 月度结算依次推进收入支出、产业、世界指标、家庭、军事、政治气候、属性衰减、NPC、事件和履历。
5. 世界同时自行演化，产生新闻、NPC 升降、派系变化、事件链和玩家抉择。
6. 玩家通过卷宗、日志筛选、百官名册和有限情报观察世界，再继续下一月。

实机验证中，两次“闭门苦读”后从庆历元年一月进入二月，恢复 2/2 行动点，世界生成大量百官演化记录，并弹出一项二选一事件。这证明该项目最强的体验不是官职数据本身，而是“我做两件事，整个世界也走了一步”。

### 3.3 NPC 所谓 AI

当前版本没有网络模型或生成式 AI。`js/npc_ai_engine.js` 的 AI 是本地效用决策：

- 为 NPC 选择议程，再按关系、职位、派系和状态选择目标。
- 加入随机扰动、重复惩罚、脚本冷却和面向玩家的中断节流。
- NPC 记忆会随月份衰减，行为结果从预写交互库中派发。

这套机制适合承担低成本、可复现的“背景世界生命力”。它不能替代《诡秘之主》中需要语义判断、秘密知识和长因果链的高价值剧情裁决。

### 3.4 UI 与信息设计

- 桌面端是固定两栏：左侧人物卷宗，右侧世界日志/名册，下方是行动区。
- 1280×720 下页面本身无横向或纵向溢出，两栏内部独立滚动。
- 信息密度高但层级清楚：人物、能力、身份、世界风向、家庭、日志分类和行动入口都可快速定位。
- 低阶角色只看到世界趋势，高阶角色才看到精确数值；“能力决定可见知识”非常适合改造成序列、组织权限、神秘学知识与污染风险下的信息边界。

视觉语言、字体、色彩、官阶全景图和宋代文书表达都是题材特定内容，只能作为信息架构参考，不能作为新游戏美术底板。

### 3.5 存档、质量与架构问题

- 权威状态是一个大型全局 `gameState`，事件数据直接携带执行函数，内容与规则强耦合。
- 依赖 `index.html` 的脚本顺序和大量全局变量，难以测试、迁移和多人协作。
- 存档是三个 localStorage 槽位；日志会被裁至 500 条、人生轨迹裁至 300 条。
- 没有明确 schema 版本、事务、校验和、崩溃恢复或 exactly-once 保护。
- 实机发现：建角时写入的 `bianjing_save_1` 仍是庆历元年一月；页面已经推进到二月且属性、金钱和 NPC 世界均变化时，该存档没有同步更新。因此现有“自动存档”不能视为持续可靠存档。
- 月度结算一次向日志注入数百条百官变更，具有世界规模感，但造成明显信息爆炸；新游戏需要摘要、焦点、延迟展开和玩家相关性排序。
- 当前代码大量使用动态 HTML；如果未来接入模型输出，必须先做白名单结构化渲染，不能把模型文本直接放入 `innerHTML`。
- `package.json` 声称 `MIT`，但根目录没有 LICENSE/NOTICE/COPYING，作者字段为空。技术上可辨认的复用候选不等于已获得清晰法律授权。

## 4. 《汴京梦华》复用矩阵

| 分级 | 可处理对象 | 结论与条件 |
|---|---|---|
| `DIRECT_REUSE` | 无无条件整模块候选 | 缺少根许可证与来源证明。若用户确认自己拥有该版本代码或能补齐有效授权，才可直接抽取极小的题材无关工具；整库仍不建议 fork。 |
| `ADAPT_REUSE` | 有限行动点与自动时间推进 | 改造成周/日/阶段制；具体节奏必须由用户决定，不能默认“每月两次”。 |
| `ADAPT_REUSE` | 特质、互斥特质、条件权重、事件池、事件链、冷却/pity | 保留数据驱动思想，重写为带 schema、纯条件和明确效果命令的内容系统。 |
| `ADAPT_REUSE` | NPC 议程、目标选择、短期记忆衰减、重复惩罚 | 适合作为确定性背景模拟层；高价值人物和秘密裁决另接权威叙事/AI 层。 |
| `ADAPT_REUSE` | 世界指标均值回归、前线状态、阵营影响 | 重建为时代局势、教会/秘密组织、地区风险、灵界扰动和知识传播，不能照搬数值含义。 |
| `ADAPT_REUSE` | 基于身份/地位的信息可见度 | 改为序列、组织许可、调查证据、神秘学知识、污染和反占卜等多维可见性。 |
| `REFERENCE_ONLY` | 双栏卷宗 + 世界日志 + 行动区的信息层次 | 可以借鉴可读性与玩家观察世界的方式；新 UI 视觉和组件从零设计。 |
| `REFERENCE_ONLY` | “个人行动后，世界同时前进”的节奏 | 是最值得保留的体验原则，但时间尺度、行动内容和反馈密度由用户决策。 |
| `DO_NOT_REUSE` | 宋代官阶、职位、科举、派系、国家事件、人物文案 | 题材强耦合且与新游戏目标冲突。 |
| `DO_NOT_REUSE` | 两张官制/机构图、宋代视觉素材和不明来源素材 | 来源和授权不清，且视觉方向错误。 |
| `DO_NOT_REUSE` | 全局脚本骨架、大型 `gameState`、localStorage 权威存档 | 技术债会直接限制 AI、安全存档、内容工具和长期维护。 |
| `DO_NOT_REUSE` | `.bak`、缓存、缺依赖的旧测试产物 | 不是可信生产来源。 |

## 5. 我对 gmzz 当前版本的理解

### 5.1 当前真相

- `D:\gmzz` 是 Electron + React/Next/vinext + TypeScript + SQLite 的桌面同人游戏工程。
- 根目录有完整 MIT `LICENSE`，并有 `NOTICE` 将代码许可与《诡秘之主》IP、原文、私有知识库和发行权分开说明。
- 当前 `main` 是大型脏工作树，只能作为只读来源；不能把未提交状态、构建产物或本机数据直接复制进新项目。
- 当前权威计划为 `PLAN_REVISION=6`，回合合同为 `CONTRACT_REVISION=3`。
- 状态文档报告后端合同/持久化测试、类型检查和构建已有较强证据，但同时明确 `PLAYER_ACCEPTANCE=NOT_RUN`、真实模型 `NOT_RUN`，且旧入口切换和主线接线仍有缺口。
- 当前地图方向正处于独立设计/验收边界；gmzz 的“地图优先、组织经营、自由文本任务卡”是 gmzz 自己的产品决定，不是本项目的默认答案。

### 5.2 最有价值的工程能力

gmzz 的核心价值不是把它当前游戏外壳搬过来，而是把下面这些可靠性边界抽出来：

- Renderer 只负责编辑意图和显示公开状态；Main/SQLite 拥有请求、模型原文、校验、提交和重放权威。
- AI 回合状态机：`PREPARED → RUNNING → RESPONDED → VALIDATED → COMMITTED`，失败则停在原回合。
- 原始模型响应先持久化并记录 SHA-256，再验证；IPC 丢失或重启时重放，不能重复调用并二次结算。
- 单个 SQLite 事务提交世界、资源、回合和下一回合摘要；重复 commit 返回同一 receipt。
- `publicTurnSnapshot` 是跨 IPC 白名单，模型原文、proposal、prompt、RAG context 和秘密世界事件不进入 Renderer。
- 世界内核区分 actor、faction、project、location、event、knowledge 和受众投影，适合改造成《诡秘之主》的“谁知道什么”。
- 私有 RAG、泄漏评估、来源/哈希/manifest、地图离线包与安装证据链形成了可审计内容管线。

### 5.3 gmzz 复用矩阵

| 分级 | 当前候选 | 结论与条件 |
|---|---|---|
| `DIRECT_REUSE` | `LICENSE` 的 MIT 代码许可机制 | 新项目可采用 MIT，并保留必要归属；`NOTICE` 只能按本项目真实发布范围重新写。 |
| `DIRECT_REUSE` | `electron/content-security-policy.cjs` | 小而通用，可复制后按新资源需求收紧/测试。 |
| `DIRECT_REUSE` | `electron/runtime-paths.cjs` | D 盘/用户数据路径与边界校验通用；需把 GMZZ 环境变量、目录名和错误码改成新项目名称。严格说属于“直接复制后轻量改名”。 |
| `DIRECT_REUSE` | `electron/persistence-origin.cjs` | 稳定 origin 哈希逻辑通用，可连同测试抽取。 |
| `DIRECT_REUSE` | manifest/hash/source-register/验证器的通用骨架 | 只复用工具和格式；地图事实、标签、几何与来源声明不随代码自动获得授权。 |
| `ADAPT_REUSE` | `electron/ai-settings.cjs`、`electron/inference-gateway.cjs` | 保留 Main 持有凭据、能力探测、primary/backup 和 OpenAI-compatible 边界；重写产品配置与模型职责。 |
| `ADAPT_REUSE` | `electron/persistence-provenance.cjs` | 保存来源、可重放性和证据分类有价值，需换成本项目 schema。 |
| `ADAPT_REUSE` | `electron/persistence-sqlite.cjs` | exactly-once、attempt、response、proposal、receipt、重启恢复非常有价值；文件约 151 KB 且强耦合，必须拆分，不能整块移植。 |
| `ADAPT_REUSE` | `shared/turn-resolution-contract.cjs` 与 `app/turn-loop/*` | 沿用状态机和 fail-closed 原则，重写领域 envelope、资源腿、效果与错误码。 |
| `ADAPT_REUSE` | `app/world-kernel.ts`、audience projection、knowledge 边界 | 可作为新世界内核的参考实现；先由用户锁定玩家身份、时间尺度和秘密规则，再建新类型。 |
| `ADAPT_REUSE` | RAG 建库、检索收据、泄漏评估、seed manifest | 管线可用，语料不可用；新语料必须有单独权利来源和发行策略。 |
| `ADAPT_REUSE` | `app/memory/**` 分层记忆与 WorldKernel 受众投影 | MIT 允许复用，但不能整包零修改搬入；抽取事实/观察/知识授权/信念分离、受众过滤、幂等回执、有界检索与来源追溯，按本项目知识三层和 schema 重建。 |
| `ADAPT_REUSE` | Atlas 生成/校验/哈希/来源登记与离线加载 | 仅在用户选择地图型产品后启用；所有实际几何目前应视为近似表达，不能冒充官方坐标。 |
| `ADAPT_REUSE` | 安装器、D 盘运行路径、来源/seed/证据验证脚本 | 适合后期交付，不能把“同机可运行”写成独立干净机器证明。 |
| `REFERENCE_ONLY` | 地图工作台、组织领导、自由文本拆任务卡 | 这是可选产品路线；只有用户选择组织/地图主幻想才进入新项目。 |
| `REFERENCE_ONLY` | 决策账本、冻结合同、分层验收和逐题 Grill-me | 作为项目治理方式直接采用，不代表继承 gmzz 的产品决定。 |
| `DO_NOT_REUSE` | `private/` 原文、RAG 语料、generated seed、用户数据、SQLite 存档、凭据 | 许可、隐私和环境边界均不允许。 |
| `DO_NOT_REUSE` | `app/game-model.ts` 整体、旧 save schema/migration 历史 | 领域和历史包袱过重，新项目不需要继承 v15–v22 迁移债务。 |
| `DO_NOT_REUSE` | 当前未验收地图/UI、dirty `dist`/打包产物和其他并行改动 | 不是稳定产品基线；不得把 `READY_FOR_INTEGRATION` 写成已完成。 |
| `DO_NOT_REUSE` | 官方/社区图片及仅供参考的地理资产 | 代码 MIT 不覆盖第三方内容或原作 IP。 |

### 5.4 分层记忆专项源码审计（2026-08-29）

- `app/memory/types.ts` 定义事件、主体信念、承诺、关系原因、计划、受众状态和交付回执；`BeliefTruth`、`Secrecy`、`learnedFrom` 可以表达真假、不确定、传闻与信息来源。
- `deriveMemoryFromWorldState` 不把全知世界事件直接变成玩家知识；它从具体 observation、knowledge grant 与 holder 派生主体信念，并记录 witness/communication/investigation/propagation 来源。
- `permissions.ts`、`buildAutonomousMemoryProjection` 和 `projectWorldForAudience` 按 world/player/actor/faction 受众过滤；未知主体、未授权记忆引用和越权知识在真实调用链中 fail closed。
- 检索器设置场景引用数和字符预算，并记录候选、选中、拒绝和来源事件；回执区分 delivered/presented/recalled 并按受众幂等。
- 该模块并非独立 npm 包，字段仍依赖 gmzz 的 actor/faction/project、WorldKernel、周回合、运行限制与提示词。当前 gmzz 还有大量并行脏改动，尤其调用侧 world runtime/kernel 正在变化；因此结论是 `LICENSE_DIRECT_REUSE_ALLOWED / TECHNICAL_DIRECT_REUSE_AS_IS=NO / ADAPT_REUSE=YES`。

## 6. 推荐的新项目边界（尚未锁定）

推荐建立以下独立层，而不是先复制页面：

1. `domain`: 角色、身份、途径/序列、组织、地点、知识、污染、关系、事件与世界时间的纯领域模型。
2. `simulation`: 可确定性重放的背景 NPC 议程、世界脉冲、事件候选和权重系统。
3. `narrative-ai`: 只处理必须理解语义的角色判断、任务分解和文学表现；输出必须走结构化合同与验证。
4. `persistence`: Main/SQLite 权威存档、事务回执、重启恢复、schema 迁移和来源校验。
5. `projection`: 按玩家身份/知识/污染/组织权限生成可见状态，秘密不跨边界。
6. `content`: 带 schema、来源、版本和测试的事件/人物/地点内容包，和执行代码分开。
7. `ui`: 等首要玩家幻想确定后再选择卷宗、地图、案件板或混合工作台。

这是技术建议，不是已确认设计。第一项产品决定仍由用户作出。

## 7. 已发现的待决设计顺序

一次只提出一题，回答后写回 `PROJECT_STATE_LEDGER.md`：

- `D-001`: 首要玩家幻想 / 首个可玩纵切。
- `D-002`: 与原作的关系和时间线。
- `D-003`: 玩家身份与可选成长边界。
- `D-004`: 时间推进与行动经济。
- `D-005`: AI 必需、可选和完全禁止的职责。
- `D-006`: 免费公开、私下试玩或其他发布范围。

未回答项保持 `PENDING`。
