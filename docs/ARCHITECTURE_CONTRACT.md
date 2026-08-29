# 架构与信任边界合同

`CONTRACT_REVISION=2 / STATUS=FROZEN_FOR_R1 / STACK=ELECTRON_REACT_TYPESCRIPT_VITE_SQLITE`

本文件是工程决定，不新增玩法规则。变更公共接口、依赖方向、权威状态或写集必须由主任务更新合同版本并通知两个工作流。

## 1. 运行时边界

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
- `domain/resolution/simulation` 不依赖 Electron、React、Vite 或 SQLite。

## 3. 公共合同原则

共享合同只包含玩家可发送的意图、玩家可看到的公开投影、错误码、schema/version 和回执；不把隐藏事件条件、NPC秘密、未揭露原著知识、内部权重来源或私有 RAG 证据送入 Renderer。

所有状态变更请求至少携带：

- `intentId`：客户端生成的幂等标识；
- `runId`：周目；
- `expectedRevision`：防止旧页面覆盖新状态；
- `contractVersion`：拒绝过期调用；
- 该意图自己的 schema 化 payload。

成功回执至少含 `intentId`、`runId`、`previousRevision`、`newRevision`、`stateChecksum` 和新的公开投影；重复 `intentId` 返回同一结果而不是再次生效。错误使用固定错误码，不把内部堆栈或秘密字段发送到 Renderer。

R1 的精确 API 名称和 TypeScript 类型已经由主任务冻结在 `src/shared/contracts.ts` 与 `docs/rounds/R1_DESKTOP_AUTHORITY_CONTRACT.md`；两个任务不能各自发明、复制或扩写一套共享类型。

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
- 单元测试、契约测试、Electron 集成、桌面 smoke、玩家验收和打包证据分开记录。
