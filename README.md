# 诡秘同人游戏（项目代号）

> `STATUS=DESIGN_AND_ENGINEERING_BASELINE / PLAYABLE_BUILD=NOT_AVAILABLE`

这是一个以《诡秘之主》世界为背景的非官方同人单机游戏项目。玩家从普通人开始，在按周推进的世界中工作、学习、调查和休养，逐步接触非凡体系；第一版计划开放占卜家、观众、猎人三条途径至序列7。

当前仓库首先公开原创代码、设计合同和开发记录。它还不是可玩的发行版，也不包含原著正文、私人知识库、来源不明素材或参考项目代码。

## 当前重点

- 常驻周仪表盘与事件卡驱动的个人生存/调查循环；
- 可重放的普通判定、战斗转盘和因果结算；
- Main/SQLite 权威状态、窄 preload 接口和 Renderer 公开投影；
- 工作/产业、黑市与每三个月一次的拍卖会；
- 构建期模板 + RAG/小模型辅助的受审事件文本，不让模型决定规则和数值；
- 每轮前后端并行、主任务接线、自动验证和玩家审查分离。

## 从哪里开始

参与开发前依次阅读：

1. [AGENTS.md](AGENTS.md)
2. [项目状态账本](PROJECT_STATE_LEDGER.md)
3. [主开发计划](docs/MASTER_DEVELOPMENT_PLAN.md)
4. [架构合同](docs/ARCHITECTURE_CONTRACT.md)
5. [任务交接协议](docs/THREAD_HANDOFF_PROTOCOL.md)
6. [当前轮次账本](docs/ROUND_LEDGER.md)

玩法主题文档索引见 [docs/README.md](docs/README.md)。

## 开源边界

原创软件代码以 [MIT License](LICENSE) 开源。题材、原著内容、素材与发行权不由该许可证授予，详见 [NOTICE](NOTICE)。公共远端、正式名称、素材许可和游戏发行状态必须按事实单独记录；本地初始化不等于已经发布到 GitHub。

## 开发状态词

- `READY_FOR_INTEGRATION`：某工作流已交付候选，不等于已合入或完成。
- `INTEGRATED`：主任务已经完成源码审查、接线和自动门禁。
- `PLAYER_ACCEPTANCE=PASSED`：只有用户实际看过本轮产品并明确通过后才能写入。
- `NOT_RUN` / `NOT_AVAILABLE` / `PENDING`：必须保留原义，不得用推测升级。
