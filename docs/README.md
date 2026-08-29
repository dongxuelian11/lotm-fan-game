# 设计文档入口

`STATUS=DESIGN_MIRROR / AUTHORITY=PROJECT_STATE_LEDGER.md`

这些文件把当前已经确认的设计按主题拆开，方便人和其他 agent 阅读。它们不是第二套规则：完整决定、用户确认、撤回/取代关系和下一题只在 `../PROJECT_STATE_LEDGER.md` 中登记。

## 推荐阅读路线

1. [项目总览](PROJECT_OVERVIEW.md)
2. [设计决定索引](DECISION_INDEX.md)
3. [核心循环与日常行动](CORE_LOOP.md)
4. [底层数值与判定](NUMERIC_SYSTEM.md)
5. [战斗与转盘](COMBAT_ROULETTE.md)
6. [能力系统与熟练度](ABILITY_SYSTEM.md)
7. [角色创建与成长](CHARACTER_AND_PROGRESSION.md)
8. [原著、知识与 RAG 边界](CANON_RAG_BOUNDARIES.md)
9. [参考项目复用](REFERENCE_REUSE.md)
10. [主开发计划](MASTER_DEVELOPMENT_PLAN.md)
11. [架构合同](ARCHITECTURE_CONTRACT.md)
12. [任务交接协议](THREAD_HANDOFF_PROTOCOL.md)
13. [开发轮次账本](ROUND_LEDGER.md)
14. [开源与 Git 治理](OPEN_SOURCE_AND_GIT.md)
15. [底层实现切片（旧 S0—S5 参考）](IMPLEMENTATION_PLAN.md)
16. [UI 与实现方案](UI_IMPLEMENTATION_PLAN.md)
17. [事件卡系统与内容生产](EVENT_CARD_SYSTEM.md)
18. [未决问题](OPEN_DECISIONS.md)

## 权威层级

1. 用户最新明确确认。
2. `PROJECT_STATE_LEDGER.md` 中的 `LOCKED` 决定。
3. `LOTM_CANON_GAMEPLAY_AUDIT.md` 的原著事实与约束。
4. `REFERENCE_REUSE_AUDIT.md` 的审计结论。
5. 本目录的主题摘要和候选方案。

发现冲突时，暂停实现，更新台账状态，再修正文档。不要把 `QUESTION_READY`、`PENDING`、`DEFERRED`、`SUPERSEDED` 或 `NOT_STARTED` 改写成完成状态。

## 当前状态

- 项目阶段：`R0_OPEN_SOURCE_GIT_ORCHESTRATION_ACTIVE`
- 代码实现：`GOVERNANCE_ONLY / PRODUCT_CODE_NOT_STARTED`
- 第一版玩家途径：占卜家、观众、猎人，普通人起步，目标至序列7。
- 当前底层设计批次：`D-GRILLBATCH8` 已收口；事件卡结构 `D-EVENT1..18` 与 UI `D-UI1..3` 已全部锁定。用户已授权 R0 开源/Git/任务治理，R1 产品代码须等主任务冻结精确合同。一次性物品、先手数值和后果公开层级仍后置，城市切换/地图已延期到后续版本。
- `V1_CHARACTER_CREATION_SPEC.md`、`LOTM_CANON_GAMEPLAY_AUDIT.md`、`REFERENCE_REUSE_AUDIT.md` 仍是根目录的配套权威资料，不在这里重复全文。

## 文档更新协议

每批用户确认后：

1. 先把决定、状态和影响写入 `PROJECT_STATE_LEDGER.md`；
2. 再把同一决定同步到所有受影响的主题文档；若无对应文件，先创建模板并登记映射；
3. 更新本目录中受影响的未决项或索引；
4. 用 `docs-guard` 检查数字、公式、链接、路径和状态是否真实；
5. 在最终回复中说明本批剩余未决项和下一批主题。
