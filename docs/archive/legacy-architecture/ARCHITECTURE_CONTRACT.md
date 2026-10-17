# 架构与信任边界合同

`CONTRACT_REVISION=5 / STATUS=FINAL_RUNTIME_FROZEN_BROWSER_FIRST_STAGING / STACK=ELECTRON_REACT_TYPESCRIPT_VITE_SQLITE / DEVELOPMENT_STAGING=BROWSER_FIRST / ARCHITECTURE_DIAGRAM=FROZEN_BASELINE`

本文件是工程决定，不新增玩法规则。变更公共接口、依赖方向、权威状态或写集必须由主任务更新合同版本并通知两个工作流。

## 0. 可视化架构基线与防漂移门禁

- 类型化架构源为 `docs/architecture/runtime.archify.json`，自包含交互图为 `docs/architecture/runtime-architecture.html`，校验回执为 `docs/architecture/runtime-architecture.receipt.json`；
- 当前基线使用 Archify `v2.16.0`，规格 SHA-256 为 `1392f8820aa2f8eb52e02feb62056f98b7be87a5c71f7604f60317ace2d4763f`，HTML SHA-256 为 `70ed7f30be2d6e0ef4ad6c5623b99babf898065017b26391139f3b8635b29e19`；
- 本合同是规范性文字权威，架构图是其受版本控制的可视化投影；二者与源码证据不一致时不得静默选一个，必须登记 `ARCHITECTURE_DRIFT` 并暂停相关施工；
- 每份新轮次合同必须记录 `ARCHITECTURE_BASELINE_SPEC_SHA256`、`ARCHITECTURE_CHANGE` 与 `ARCHITECTURE_STATUS`。图的 hash 未变化且本轮不改变拓扑时只记录 `ARCHITECTURE_CHANGE=NONE`，不要求重复生成；
- 新增/删除顶层运行时 Module、新跨 Module 依赖、Public Contract Seam 扩权、新 Adapter、运行时权威/事务路径或三方写集改变，必须先由主任务更新本合同与架构源，再通过 Archify `showcase` 校验、原子交付和真实浏览器检查，之后才能冻结施工轮；
- Module 内部纯重构、局部 JSX/CSS、测试 helper、文案和不改变拓扑的内容数据默认不触发重画；不确定时开发任务只提交 `NEEDS_MASTER_CHANGE=ARCHITECTURE:<change>:<required contract>`；
- Archify 只是用户级开发工具，不进入产品运行依赖，不拥有玩法、设计、接线、玩家验收或发布权威。完整维护协议见 `docs/architecture/README.md`。

## 1. 最终桌面运行时边界

```text
Renderer（不可信公开投影）
  -> 类型化玩家意图
Preload（窄 contextBridge）
  -> 版本化 IPC
Main（发送方/输入/状态版本校验）
  -> Domain / Resolution / Simulation / Content
  -> SQLite 单事务 + CommitReceipt
  -> PublicState 投影
  -> Renderer
```

- Renderer 不直接访问 Node、文件系统、SQLite、私有知识库或模型；
- preload 不暴露通用 `send/on`，每个 API 有固定名称、参数和返回类型；
- Main 是运行时编排和持久化入口，但领域规则保持纯 TypeScript；
- SQLite 保存权威状态、schema/version、动作回执和确定性随机游标；
- UI 动画、转盘显示和本地临时状态不得反写或替代权威结果；
- RAG/模型服务只能生成或检索受控文本候选，不能提交回合、决定概率或更改存档。

## 1.1 浏览器施工与审查边界

```text
Browser Renderer
  -> 与正式版相同的类型化玩家意图 / PublicState
开发态内存审查运行时
  -> 同一 Domain / Resolution / Simulation / Content
  -> 内存态回执与确定性随机流
  -> Browser Renderer
```

- 浏览器入口只用于本地开发和玩家审查，不是可发布网页版本；刷新后允许重置，不能声称具备正式存档、跨重启恢复或安装证据；
- 审查运行时必须复用 `src/shared` 合同与同一套领域/内容实现，不能在 Renderer 组件中复制判定、经济、事件或战斗规则；
- 审查运行时只向组件返回 `PublicState`，即使开发包本身不构成最终安全证据，也不允许UI依赖隐藏字段；
- 不建立 `localStorage`、IndexedDB 或第二套 save schema 作为权威。正式持久化仍只有 Electron Main/SQLite；
- 精确适配器路径、写集和启动脚本由下一份浏览器施工轮合同冻结；未冻结前本条不授权改代码；
- 既有 Electron/preload/Main/SQLite 实现和 smoke 证据保留。玩家确认浏览器玩法后，正式桌面接线必须重新验证本节上方的最终运行时边界。

## 2. 建议目录与依赖

```text
src/renderer/**       前端工作流
src/main/**           后端工作流：Electron Main/preload
src/domain/**         后端工作流：纯领域状态和不变量
src/resolution/**     后端工作流：判定/转盘/后果
src/simulation/**     后端工作流：周脉冲/事件候选
src/content/**        后端工作流：schema/fixture/校验
src/persistence/**    后端工作流：SQLite/迁移/事务/回执
src/shared/**         主任务：公共投影、意图、错误码和版本
tests/renderer/**     前端工作流
tests/backend/**      后端工作流
tests/integration/**  主任务
```

允许的核心依赖：

- `renderer -> shared`；
- `main/persistence -> shared + domain + resolution + simulation + content`；
- `content -> domain`；
- `domain/resolution/simulation` 不依赖 Electron、React、Vite 或 SQLite；
- 浏览器审查适配器可以在开发构建中依赖 `shared + domain + resolution + simulation + content`，但不得进入正式 Electron 发布包；其精确目录归属由当前轮合同指定。

## 3. 公共合同原则

共享合同只包含玩家可发送的意图、玩家可看到的公开投影、错误码、schema/version 和回执；不把隐藏事件条件、NPC秘密、未揭露原著知识、内部权重来源或私有 RAG 证据送入 Renderer。

所有状态变更请求至少携带：

- `intentId`：客户端生成的幂等标识；
- `runId`：周目；
- `expectedRevision`：防止旧页面覆盖新状态；
- `contractVersion`：拒绝过期调用；
- 该意图自己的 schema 化 payload。

成功回执至少含 `intentId`、`runId`、`previousRevision`、`newRevision`、`stateChecksum` 和新的公开投影；重复 `intentId` 返回同一结果而不是再次生效。错误使用固定错误码，不把内部堆栈或秘密字段发送到 Renderer。

R2 的精确 API 名称和 TypeScript 类型已经由主任务冻结在 `src/shared/contracts.ts` 与 `docs/rounds/R2_CHARACTER_WEEK_CONTRACT.md`；浏览器审查运行时和 Electron bridge 都必须实现这一份合同，两个任务不能各自发明、复制或扩写一套共享类型。

## 4. 随机、事件与保存不变量

- 生产规则禁止直接调用 `Math.random()`；所有取样从动作级可记录随机流读取；
- 相同状态版本、内容版本、意图和随机回执必须可重放；
- 事件卡配置不能包含任意可执行函数或原始 HTML；
- 行动成本、事件选择、判定/战斗结果和新状态在声明的事务边界内提交；
- 保存成功以事务回执、重新读取和重启恢复为证据，不以页面显示为证据；
- 角色创建的必选项、互斥项和最小/最大选择均由领域层校验，UI 校验只是即时反馈。

## 5. 安全与交付基线

- `contextIsolation=true`、Renderer sandbox、窄 bridge、IPC sender 校验和 CSP 是默认要求；
- 依赖和 Electron/Node 版本必须锁定，SQLite 运行能力通过真实 Electron smoke 验证；
- 不在生产包中包含开发工具、私有 corpus、源存档、凭据或未声明远程代码；
- 单元测试、契约测试、浏览器实机审查、Electron 集成、SQLite 重启恢复、桌面 smoke、玩家验收和打包证据分开记录；浏览器通过不得升级后五项。
