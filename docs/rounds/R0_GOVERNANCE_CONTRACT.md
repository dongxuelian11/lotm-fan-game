# R0 治理合同

`ROUND_ID=R0 / CONTRACT_VERSION=R0-v1 / OWNER=MASTER / STATUS=IN_PROGRESS`

## 目标

在任何产品代码并行开发前，建立可公开、可追踪、可被其他 agent 安全接管的本地仓库基线。

## 主任务写集

根目录治理文件、`.github/**`、`docs/**`、`PROJECT_STATE_LEDGER.md`、Git 元数据。R0 不授权前端或后端任务写产品代码。

## 必须交付

- MIT 代码许可证与独立 NOTICE；
- README、贡献、安全、Git/分支和 PR 规则；
- 主计划、架构合同、交接协议、轮次账本和两个工作流状态；
- 本地 `main` 仓库基线与真实 Git 状态；
- 两个 Luna Max 独立任务的 ID/链接写回账本；
- R1 的开发授权仍需主任务另行冻结和 dispatch。

## 验收

- 文档内部链接存在且状态词一致；
- Git 工作树和提交状态如实记录；
- 公共远端未实际建立时保持 `NOT_CONFIGURED/NOT_PUBLISHED`；
- 两个子任务没有在共享合同未冻结前自行写代码；
- 用户审查并决定是否进入 R1。
