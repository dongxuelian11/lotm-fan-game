# 开源与 Git 治理

`POLICY_REVISION=3 / LOCAL_REPOSITORY=COMMITTED / PUBLIC_REMOTE=CONFIGURED / PUBLICATION=PUBLISHED`

## 开源边界

- 原创代码和原创工程文档使用根目录 MIT License；
- MIT 许可证不授权《诡秘之主》题材、原著内容、插图或其他第三方材料；
- 公共仓库不得包含原著正文、私人 RAG corpus、凭据、用户存档、运行数据库、生成缓存或来源不明素材；
- 参考项目仅作只读研究，不把其代码、文案、素材或构建产物迁入；
- 正式游戏名称、发行方式、素材包和公开构建必须另做权利/来源审查。

## 分支和 worktree

- `main`：主任务维护的已接线基线；
- `work/frontend-rNN-<slice>`：前端任务独立 worktree；
- `work/backend-rNN-<slice>`：后端任务独立 worktree；
- `work/design-grill-<topic>`：历史设计候选 worktree；最新流程下 Grill 任务对仓库只读，不再从该分支提交；
- 可选 `integration/rNN`：高风险轮次由主任务临时使用；
- 任何任务不得从不明工作树状态开始，基线 SHA 必须写入轮次合同。

## 提交与集成

- 原子提交，消息建议 `rNN(frontend): ...`、`rNN(backend): ...`、`rNN(integration): ...`；
- 只暂存精确文件，不使用无边界 `git add -A`；
- 禁止 force-push、破坏性 reset、重写他人历史或自动合并；
- 主任务锁定两个候选提交头，做源码审查和全量门禁后再集成；
- GitHub PR、远端 push、tag、release 都属于独立外部状态，未实际完成时不得声称已开源发布。

## 当前事实

GitHub 插件和 CLI 已由用户授权账户 `dongxuelian11`。本仓库使用该授权资料中的 `E1aina <2806418887@qq.com>` 作为仓库本地提交身份；不修改全局 Git。初始提交为 `e0a7677`，公开远端为 `https://github.com/dongxuelian11/lotm-fan-game`，`main` 已推送并跟踪 `origin/main`。
