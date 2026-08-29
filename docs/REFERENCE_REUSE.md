# 参考项目与复用矩阵

`STATUS=READ_ONLY_AUDIT / SOURCE=../REFERENCE_REUSE_AUDIT.md`

两个参考目录只读。本文件是接管时的快速矩阵，完整证据和路径以根目录审计报告为准。

## 《汴京梦华》

### 可直接复用

当前没有“无条件直接复用”的整模块。参考目录根目录缺少清晰的 LICENSE/NOTICE/COPYING，代码与素材来源边界不足；除非用户补充自己拥有代码或有效授权，否则不复制其表达性代码、文案和素材。

### 可改造复用

- 有限行动与自动时间推进：保留“做少量事后世界前进”的节奏，改为本项目按周推进。
- 特质、互斥条件、事件池、事件链、冷却和 pity：保留数据驱动思想，重写为带 schema、纯条件和能力/事件结果数据的内容系统。
- 事件调度的分层入口：主动行动池、微事件、被动周脉冲、权重/重复衰减和连环阶段校验可作为算法参考；事件卡定义、选项和后果必须在本项目重新建模。
- NPC 议程、目标选择、短期记忆衰减和重复惩罚：可作确定性背景模拟；高价值秘密和神秘学裁决不能直接照搬。
- 世界指标、阵营影响、信息可见度：改造成时代局势、教会/组织、地区风险、知识权限、污染和反占卜边界。

### 只能借鉴

- 双栏人物卷宗＋世界日志＋行动区的信息层次。
- “玩家行动后，世界同时演化”的反馈节奏。
- 事件链和生涯终局的结构感。
- “标题/情境/选项”居中弹出事件卡的阅读顺序；不复制其文案和脚本实现。

### 禁止迁入

宋代官阶、科举、职位、派系、国家事件、人物文案、官制地图、宋代视觉素材、全局脚本骨架、大型 `gameState`、localStorage 权威存档、事件对象中的可执行函数、动态 `innerHTML` 渲染、`Math.random()` 抽取实现、`.bak`/缓存/缺依赖测试产物。

参考项目实机证明了“两次行动 → 月份推进 → 世界演化 → 选择”的体验，但其 localStorage 自动存档曾停留在初始月份，不能把存档实现当作可靠底座。

## gmzz / Mist Chronicle

### 可直接抽取后轻量改名/适配

- MIT 代码许可机制（保留真实归属，不覆盖原作 IP）。
- Electron CSP、运行路径边界和来源 origin 哈希等小型通用工具。
- manifest/hash/source-register/验证器的格式和工具骨架；新项目必须换自己的内容来源。

### 适合改造复用

- Main/SQLite 权威存档、事务回执、exactly-once、重启恢复和 schema 迁移思路。
- `PREPARED → RUNNING → RESPONDED → VALIDATED → COMMITTED` 的 AI 回合状态机和 fail-closed 边界。
- Renderer 只显示公开投影，模型原文、prompt、RAG context 和秘密世界事件留在 Main。
- world kernel 的 actor/faction/project/location/event/knowledge 分层与受众投影。
- 分层记忆的事实/观察/知识授权/主体信念分离、受众过滤、幂等交付回执和有界检索；只抽取改造，不整包直接复制。
- RAG 建库、检索收据、泄漏评估、seed manifest、地图/资产来源和安装验证管线。
- D 盘运行路径、安装器和证据链流程；只能后期按真实本项目验证，不把同机 smoke 当干净机器证明。

### 只能借鉴

地图工作台、组织领导、自由文本拆任务卡和 gmzz 自己的产品节奏。它们不是本项目默认玩法。

### 禁止迁入

`private/` 原文、RAG 语料、generated seed、凭据、用户数据、SQLite 存档、dirty `dist`/打包产物、未验收地图/UI、旧 save schema/migration 历史，以及任何并行工作树内容。

### 分层记忆专项结论（2026-08-29）

gmzz `app/memory/**` 本身在当前脏工作树中无未提交修改，最近相关提交为 `7b11fbc691da304c6d1c3235a24bd2e881a5ae17`，根许可证为 MIT，因此法律上允许在保留许可证和归属的前提下复制、修改或重写代码。技术上不能把该目录零修改搬入：它的事件、信念、承诺、关系、计划、actor/faction audience、WorldKernel 派生与提示词均使用 gmzz 领域语义。

本项目采用 `ADAPT_REUSE`：借用世界事实与角色认知分离、观察/传播/调查授权知识、受众白名单投影、交付/呈现/回忆幂等回执、检索条数/字符预算和来源 ID 校验；按本项目的 `confirmed / rumor-or-inference / hidden`、角色知识、事件卡和 SQLite schema 重新建模。gmzz 的具体字段、提示词、NPC/组织/项目模型和 `private/` 数据不迁入。

## BMad Game Dev Studio（BMGD）

### 允许的选择性采用

- GDD Validate/Analyze：只生成遗漏、矛盾、范围漂移和可测量性报告。
- Implementation Readiness：只检查设计、UX、架构与任务拆分的一致性。
- 叙事、UX、事件卡、Epic/Story 模板：只作为结构参考，并等待对应设计或轮次合同先锁定。

### 不允许直接采用

- 不采用它的“GDD 是设计权威真值源”默认；本项目权威仍是用户与 `PROJECT_STATE_LEDGER.md`。
- 不让它 Create/Update/Finalize 本项目权威设计，不让 Quick Dev/生产工作流绕过 Grill、R1 玩家验收或 R2 冻结。
- 不把它的输出、lint 或格式测试当作已锁定设计、实现正确、玩家验收或发布证据。

本轮固定审计源为公开 `main=478cc09f2e2f9a1fc6d78b1eb7e19fe0323fc08e`；MIT 允许保留归属后复用模板和代码。隔离目录、输出标签和试用标准见 [BMGD 隔离试用合同](BMGD_ADOPTION_CONTRACT.md)。

## 总结

复用原则是：汴京梦华主要借鉴玩家反馈节奏和信息架构；gmzz 主要借鉴可靠性边界、持久化、公开投影和 RAG 管线；《诡秘之主》的角色、途径、序列、魔药、扮演、污染、组织、地点和文本全部重新建模。
