# 开源与 Git 治理

`POLICY_REVISION=2 / LOCAL_REPOSITORY=INITIALIZED_MAIN_NO_COMMIT / PUBLIC_REMOTE=NOT_CONFIGURED / PUBLICATION=NOT_PUBLISHED`

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
- 可选 `integration/rNN`：高风险轮次由主任务临时使用；
- 任何任务不得从不明工作树状态开始，基线 SHA 必须写入轮次合同。

## 提交与集成

- 原子提交，消息建议 `rNN(frontend): ...`、`rNN(backend): ...`、`rNN(integration): ...`；
- 只暂存精确文件，不使用无边界 `git add -A`；
- 禁止 force-push、破坏性 reset、重写他人历史或自动合并；
- 主任务锁定两个候选提交头，做源码审查和全量门禁后再集成；
- GitHub PR、远端 push、tag、release 都属于独立外部状态，未实际完成时不得声称已开源发布。

## 当前事实

本地仓库已在 `main` 初始化，`core.autocrlf=false`、`core.safecrlf=warn`。当前没有 Git 作者名/邮箱，因此初始提交为 `BLOCKED_GIT_IDENTITY_NOT_CONFIGURED`；主任务不会伪造用户身份。公共仓库名称、远端和发布授权也未提供，保持 `NOT_CONFIGURED/NOT_PUBLISHED`。
