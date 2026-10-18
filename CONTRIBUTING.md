# Contributing

本项目使用 React、TypeScript、Vite 和 Electron/SQLite。请先阅读 README、docs/GAME_DESIGN.md 和与修改直接相关的设计、源码与测试。

- 每次修改聚焦一个可审查的问题，保留已有存档、随机重放及失败分支。重大玩法或内容方向先讨论。
- 领域规则保持纯 TypeScript；界面只显示公开投影、提交类型化意图；桌面持久化由 Main/SQLite 负责。
- 不提交小说全文、私人语料、用户存档、凭据、node_modules 或生成输出。测试输入通过 test-inputs 的清单和压缩包恢复。
- 使用独立分支提交，避免覆盖他人改动；不要强制推送或批量加入无关文件。

## 验证

安装锁定依赖后运行 `npm run typecheck:main`、`npm run typecheck:renderer`、`npm run build` 和修改相关的测试。完整测试前执行 `npm run fixtures:restore`，然后运行 `npm test -- --maxWorkers=1 --no-file-parallelism`。恢复脚本本身可用 `npm run test:fixture-restore` 验证。

提交说明应列出改动、实际执行的测试、失败或未验证项。自动测试、可见界面检查和 Windows 实机运行分别记录，不能互相替代。
