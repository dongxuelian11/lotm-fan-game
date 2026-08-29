# Contributing

本项目由用户把控总设计。工程贡献不能自行补完未锁定的玩法、原著事实、能力数值或内容规模。

## 开工前

1. 阅读 `AGENTS.md`、`PROJECT_STATE_LEDGER.md`、`docs/MASTER_DEVELOPMENT_PLAN.md`、当前 `docs/rounds/*.md` 和自己的工作流状态文件。
2. 确认本轮合同、依赖、精确写集和目标提交头；没有轮次合同就不开始生产实现。
3. 发现设计空缺时提交 `DESIGN_GAP=<decision>:<reason>`，不要猜测。
4. 需要修改主任务拥有的文件时提交 `NEEDS_MASTER_CHANGE=<file>:<reason>:<required contract>`。

## Git 规则

- `main` 由主任务维护；前端和后端在独立 worktree/分支开发。
- 分支名使用 `work/frontend-rNN-*` 或 `work/backend-rNN-*`。
- 禁止 force-push、破坏性 reset、覆盖或重排他人改动；禁止无边界的 `git add -A`。
- 每个提交只包含声明写集中的一项可审查工作，并在消息中带轮次号。
- 工作流到达 `READY_FOR_INTEGRATION` 后停止；主任务锁定提交头并负责接线。
- 不自动合并。自动测试、接线、玩家验收、打包和发布分别记录。

## 内容与知识库规则

- 不提交原著正文、私人 RAG 语料、用户数据、凭据或来源不明素材。
- 事件/能力数据必须有 schema、版本、来源状态、可见层和失败行为。
- 小模型只可在作者/构建期生成待审文本变体；运行时规则、数值、选项和后果由确定性引擎控制。
- 涉及具体途径能力、魔药、晋升或原著旁线内容时，先通过对应 Grill 决定与原著审查。

## 完成回执

每次交付至少报告：`ROUND_ID`、`CONTRACT_VERSION`、`HEAD`、`WRITE_SET`、`TESTS`、`KNOWN_GAPS`、`STATUS`。状态模板见 `docs/THREAD_HANDOFF_PROTOCOL.md`。
