# 设计决定索引

`STATUS=INDEX / AUTHORITY=../PROJECT_STATE_LEDGER.md`

完整决定内容不复制到这里；本表告诉接管 agent 应去哪里读。编号后的状态以台账实时值为准。

| 主题 | 决定范围 | 主题文档 |
|---|---|---|
| 产品目标、原作关系、玩家身份 | `D-001`、`D-002`、`D-003*` | [项目总览](PROJECT_OVERVIEW.md)、[角色与成长](CHARACTER_AND_PROGRESSION.md) |
| 第一版捏人 | `D-V1CC`、`D-V1CC1..6`、`D-003A*`、`D-003A4*`、`D-003A5*`、`D-003A6*` | [角色与成长](CHARACTER_AND_PROGRESSION.md)、`../V1_CHARACTER_CREATION_SPEC.md` |
| 核心数值、普通判定、污染 | `D-NUM*`、`D-NUM1S*`、`D-NUM2*`、`D-NUM3*`、`D-NUM4`、`D-NUM5*`、`D-NUM6`、`D-RESOURCEOVERDRAFT*`、`D-RESOURCECAP1`、`D-POLLUTIONEFFECT1..3` | [底层数值与判定](NUMERIC_SYSTEM.md) |
| 周循环、行动、恢复、经济 | `D-CORE*`、`D-ACTIONS*`、`D-WORK*`、`D-LEARN1`、`D-INVEST1`、`D-ACTING1`、`D-REST1`、`D-RECOVERYVALUES1..3`、`D-ACTIONBUDGET1..3`、`D-CITYTRAVEL*`、`D-ECON*`、`D-DEBT*`、`D-INDUSTRY*` | [核心循环与日常行动](CORE_LOOP.md) |
| 战斗转盘与胜负 | `D-V1COMBAT1`、`D-COMBAT1*`、`D-COMBAT2*`、`D-COMBAT3*`、`D-COMBAT4*`、`D-COMBAT5*`、`D-COMBAT6*` | [战斗与转盘](COMBAT_ROULETTE.md) |
| 归零、生存、死亡、结算 | `D-COMBAT6G1*`、`D-COMBAT6G2`、`D-ZERO*`、`D-PLAYERDEATH*`、`D-SETTLEMENT*`、`D-ENDING*` | [底层数值与判定](NUMERIC_SYSTEM.md)、[战斗与转盘](COMBAT_ROULETTE.md)、[角色与成长](CHARACTER_AND_PROGRESSION.md) |
| 能力记录、掌握度、效果 | `D-ABILITYSCHEMA*`、`D-ABILITYMASTERY*`、`D-ABILITYCONTENT1` | [能力系统与熟练度](ABILITY_SYSTEM.md) |
| 引擎、随机、普通能力判定 | `D-IMPLEMENTORDER1`、`D-ABILITYENGINE*`、`D-ABILITYRESOLUTION1`、`D-ABILITYEFFECTSCOPE1` | [能力系统与熟练度](ABILITY_SYSTEM.md)、[实现路线](IMPLEMENTATION_PLAN.md) |
| 原著、知识、AI、RAG | `D-LORE*`、`RAG_FEASIBILITY`、`D-SETTLEMENT2` | [原著、知识与 RAG 边界](CANON_RAG_BOUNDARIES.md)、`../LOTM_CANON_GAMEPLAY_AUDIT.md` |
| 参考项目复用 | `D-SETTLEMENTREF1`、`D-COMBATREF1`、`REUSE_CLASSIFICATION` | [参考项目与复用矩阵](REFERENCE_REUSE.md)、`../REFERENCE_REUSE_AUDIT.md` |
| UI 承载与视觉 | `D-UI1..3` | [UI 与实现方案](UI_IMPLEMENTATION_PLAN.md)、[未决问题](OPEN_DECISIONS.md) |
| 事件卡与内容生产 | `D-EVENT1..18` | [事件卡系统与内容生产](EVENT_CARD_SYSTEM.md)、[UI 与实现方案](UI_IMPLEMENTATION_PLAN.md)、[未决问题](OPEN_DECISIONS.md) |
| 文档与接管治理 | `D-DOCS1..2`、`D-GRILLMODE1`、`D-GRILLBATCH1..8`、`GRILL_PROTOCOL`、`RECOVERY_PROTOCOL` | `../AGENTS.md`、[文档入口](README.md) |
| 开源、工程底座与多任务开发 | `D-006A`、`D-TECH1`、`D-ORCH1..3` | [主开发计划](MASTER_DEVELOPMENT_PLAN.md)、[架构合同](ARCHITECTURE_CONTRACT.md)、[任务交接协议](THREAD_HANDOFF_PROTOCOL.md)、[开源与 Git](OPEN_SOURCE_AND_GIT.md) |

## 状态标记

- `LOCKED`：用户明确确认，可作为当前规则使用。
- `QUESTION_READY` / `IN_PROGRESS`：下一题或正在拆分，不能自行补完。
- `DEFERRED`：用户或范围决定暂缓，不是已解决。
- `SUPERSEDED` / `CANCELLED`：历史记录，禁止复活。
- `NOT_STARTED` / `NOT_RUN` / `PENDING`：工程或证据尚未完成，不能升级为完成。
