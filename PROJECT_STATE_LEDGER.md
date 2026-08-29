# 《诡秘之主》同人游戏项目状态账本

> 唯一用途：防止 Codex 自动压缩、跨轮次续接或多人并行时丢失任务目标、设计决定、证据状态与下一步。
> 本文件不是游戏设定本身；未由用户明确确认的设计一律保持 `PENDING`。

## LEDGER

- `LEDGER_REVISION`: 252
- `PROJECT_STATUS`: `R1_FRONTEND_BACKEND_IN_PROGRESS_AND_DESIGN_GRILL_ACTIVE`
- `IMPLEMENTATION_STATUS`: `R0_PUBLISHED / R1_DISPATCHED / INTEGRATION_NOT_STARTED`
- `USER_DESIGN_AUTHORITY`: `FINAL`
- `LAST_UPDATED`: 2026-08-29 Asia/Shanghai

## TASK_GOAL

在 `D:\诡秘` 创建一个以《诡秘之主》世界为题材的同人游戏。产品形态可参考《汴京梦华》，但不做官场题材；同时审查 `D:\gmzz`，选择真正适合的新项目能力。先完整理解参考项目，再由用户逐项把控总设计，最后才进入受控实现。

当前强制设计顺序：先完整锁定底层数值系统、通用判定与各类算法；再锁定统一的能力量化结构；最后逐条设计并量化标准22途径序列9—0的所有能力。不得在底层规则未稳定时批量制作能力数据。

## NON_NEGOTIABLES

1. 用户拥有总设计最终决定权；Codex 负责调查、提出方案、揭示代价与执行，不擅自锁定重大设计。
2. 对真正影响产品方向的问题采用 Grill-me：按主题分批列出独立编号的问题；每题提供互斥选项、推荐项与影响，用户可一次回答一批。
3. 能从代码、文档、运行结果或许可证查出的事实，先调查，不反问用户。
4. 两个参考项目当前均为只读来源，不修改、不清理、不回滚：
   - `D:\游戏\汴京梦华_Game——初步正式版\汴京梦华_Game`
   - `D:\gmzz`
5. `D:\gmzz` 当前是大型脏工作树；不得回滚、覆盖或重排他人的改动，不读取或触碰 `.qa-prodserver3.err.log`、`.qa-prodserver3.out.log`。
6. “代码可复用”和“题材/IP/素材可复用”分开判断。没有许可证或授权证据时，不把复制权推定为已获得。
7. 自动测试、集成完成、玩家验收、打包与发布分别记录，不互相冒充。
8. 用户要求每一项设计决定都进行细致 Grill-me；不得用过度简化的三句选项替代设计审查。
9. 用户同时要求回答不要过长；“细致”通过把复合问题拆成更多小决策实现，每轮保持紧凑。
10. 所有序列能力最终必须落到统一、可计算、可测试的量化结构；若能力暴露底层规则缺陷，必须显式重新开启相应设计决定，不能静默为单个能力开后门。

## GRILL_PROTOCOL

从 `D-003B` 起，每一道设计题必须遵守：

1. 按主题分批处理独立决策；批内每题必须有独立编号，复合问题仍拆成带编号的子决策，用户可逐题或整批回答。
2. 提问前先调查能够从参考项目、原作规则资料、现有账本或代码中确定的事实，不把调查工作推给用户。
3. 每个选项用紧凑文字说明最关键的玩家体验、系统影响与风险；需要更多深度时继续拆下一题，不在单轮堆成小论文。
4. 明确给出 Codex 推荐项及推荐理由，也要诚实说明推荐项的代价。
5. 明确“这道题会锁定什么”和“这道题暂不锁定什么”，防止一次回答被扩张解释。
6. 只有用户的明确选择可以把状态改为 `LOCKED`；追问、异议或要求补充细节不等于选择。
7. 用户回答含糊或自相矛盾时，先复述冲突并继续问当前题，不自行补完。
8. 每批回答后，先把每道已确认的决定写入本账本，再进入依赖它们的下一批；未回答项保持 `PENDING` / `QUESTION_READY`。
9. 优先询问会改变玩家体验、核心循环、内容规模或系统边界的决定；字段分类、列表组织、控件形式和点数微调默认后置。用户判定“不重要”的细节立即标记为 `DEFERRED`，不得继续消耗当前 Grill 轮次。

## SOURCE_TRUTH

### 当前工作区

- `D:\诡秘`: 已形成设计文档集并进入 R0 开源/Git/多任务治理；产品代码仍为 `NOT_STARTED`。
- 本地 Git 已在 `main` 初始化，但作者名/邮箱均未配置，初始提交保持 `BLOCKED_GIT_IDENTITY_NOT_CONFIGURED`；公共 GitHub 远端与公开发布保持 `NOT_CONFIGURED/NOT_PUBLISHED`，不得用本地文件或暂存区冒充已提交/公开仓库。
- 规范 agent 入口是根目录 `AGENTS.md`；Windows 不再创建重复的大小写变体 `agents.md`。

### 《汴京梦华》参考项目

- 用户原始路径多了一层 `\汴京梦华`；只读探测确认实际目录为：
  `D:\游戏\汴京梦华_Game——初步正式版\汴京梦华_Game`
- 已完成当前快照的源码、素材、许可证和实机运行链路审计；详见 `REFERENCE_REUSE_AUDIT.md`。
- 当前版本为全局浏览器脚本架构；静态检查 36/36 JavaScript 语法通过。
- 实际新局为 705 名 NPC、66 个特质、30 条链式事件、约 335 个常规事件。
- 参考项目的实际捏人是单个短面板：姓名/籍贯、一个身世门第、界面标示限选2—4项的禀赋与性情；所选身世/特质直接修正初始属性。
- 参考实现虽然声明 `minPersonalityTraits=2`，但确认逻辑只实际限制最多4项，没有执行最少2项校验；新项目只借鉴短流程，不复制这个校验缺口。
- 实机确认“两次行动 → 月份推进 → 世界演化 → 玩家抉择”成立。
- 实机确认页面推进到二月后，`bianjing_save_1` 仍停留在一月初始状态；现有 localStorage 方案不可直接继承。
- 根目录无 LICENSE/NOTICE/COPYING；仅 `package.json` 声称 MIT，直接复制权保持 `PENDING_PROVENANCE_CONFIRMATION`。

### gmzz / Mist Chronicle

- 路径：`D:\gmzz`
- Git 分支：`main`
- 当前存在大量 tracked/untracked 并行改动；审计必须只读。
- 根目录有完整 MIT `LICENSE` 和单独 IP/内容边界 `NOTICE`。
- 当前权威文档为 `PLAN_REVISION=6`、`CONTRACT_REVISION=3`。
- 已完成实时源码与权威文档的只读候选审计：世界权威、Main/SQLite 持久化、AI 回合状态机、玩家公开投影、RAG 隐私边界、CSP、运行路径、地图/资产来源验证、Electron 交付。
- gmzz 状态文档仍明确 `PLAYER_ACCEPTANCE=NOT_RUN`、真实模型 `NOT_RUN`，并存在主线接线/旧入口切换缺口；不得宣称产品完成。
- `private/` 语料、generated seed、凭据、用户数据、SQLite 存档和 dirty 构建产物禁止进入新项目。

## REUSE_CLASSIFICATION

- `DIRECT_REUSE`: 许可证、依赖和架构边界允许，且不携带原题材规则/素材，可在保留必要归属后复制。
- `ADAPT_REUSE`: 核心机制有价值，但必须解耦、改名、迁移技术栈或重写领域模型。
- `REFERENCE_ONLY`: 只能借鉴交互、节奏、信息架构或设计原则，不复制表达性代码/文案/素材。
- `DO_NOT_REUSE`: 许可不明、第三方素材、强耦合题材数据、秘密/凭据或质量风险使其不应进入新项目。

## DECISION_REGISTER

- `D-001`: 游戏首要玩家幻想 / 首个可玩纵切 — `LOCKED=A_PERSONAL_BEYONDER_SURVIVAL_GROWTH`
- `D-002`: 与《诡秘之主》原作关系及时间线 — `LOCKED=A_CANON_ERA_PARALLEL_STORY`
- `D-003A`: 玩家角色身份形式 — `LOCKED=A_FULLY_CUSTOM_ORIGINAL_CHARACTER`
- `D-003B`: 初始非凡状态 — `LOCKED=A_ALL_START_ORDINARY`
- `D-003C1`: 首个可玩版本的玩家途径数量 — `LOCKED=A_THREE_FULL_PLAYER_PATHWAYS`
- `D-003C1A`: 首版具体三条玩家途径 — `LOCKED=A_SEER_SPECTATOR_HUNTER`
- `D-003C1A1`: 占卜家途径是否占用首版三个名额 — `LOCKED=B_SEER_IN_LAUNCH_ROSTER`
- `D-003C1A2`: 占卜家之外的另外两条首发途径 — `LOCKED=A_SPECTATOR_AND_HUNTER`
- `D-003A1`: 开局捏人的总体生成方式 — `LOCKED=B_FULL_MANUAL_SELECTION`
- `D-003A2`: 基础身份字段集合 — `LOCKED=A_STANDARD_IDENTITY_FIELDS`
- `D-003A2A`: 性别字段的玩法影响 — `LOCKED=A_SOCIAL_EFFECTS_NO_BASE_STAT_MODIFIERS`
- `D-003A2B`: 年龄范围与年龄影响 — `LOCKED=A_18_TO_45_MODERATE_AGE_DIFFERENCES`
- `D-003A2C`: 国籍、地区与出生地范围 — `LOCKED=A_SINGLE_COUNTRY_MULTIPLE_DOMESTIC_BIRTHPLACES`
- `D-003A2C1`: 首版开放的具体国家 — `LOCKED=A_LOEN_FIRST_OTHER_CANON_NATIONS_LATER`
- `D-003A2D`: 外貌与头像生成方式 — `LOCKED=A_STRUCTURED_FIELDS_PLUS_TAGGED_PRESET_PORTRAITS`
- `D-003A2D1`: 外貌信息填写方式 — `LOCKED=A_STRUCTURED_APPEARANCE_FIELDS`
- `D-003A2D2`: 默认头像产生方式 — `LOCKED=A_TAGGED_PRESET_PORTRAIT_LIBRARY`
- `D-003A3`: 家庭、阶层与成长经历 — `PARTIALLY_LOCKED_FINE_DETAILS_DEFERRED`
- `D-003A3A`: 出身阶层的玩法影响强度 — `LOCKED=A_STRONG_BUT_MUTABLE_CLASS_EFFECTS`
- `D-003A3B`: 家庭出身的组装方式 — `LOCKED=A_LAYERED_MANUAL_ORIGIN_COMPOSITION`
- `D-003A3C`: 社会阶层的划分粒度 — `LOCKED=A_FIVE_CLASS_TIERS`
- `D-003A3D`: 标准新游戏能否选择贵族出身 — `LOCKED=A_NOBLE_ORIGIN_STANDARD_SELECTABLE`
- `D-003A3E`: 五层社会阶层的划分依据 — `LOCKED=A_COMPOSITE_SOCIAL_STATUS`
- `D-003A3F`: 鲁恩五层阶层的正式分组 — `LOCKED=A_SOCIAL_ECOLOGY_CLASS_GROUPS`
- `D-003A3G`: 家庭营生与社会阶层的组合约束 — `LOCKED=A_SOFT_CONSTRAINTS_WITH_CONTEXT_AND_COST`
- `D-003A3H`: 家庭营生的记录单位 — `LOCKED=A_HOUSEHOLD_PRIMARY_PLUS_OPTIONAL_SECONDARY`
- `D-003A3I`: 家庭营生选项的组织结构 — `DEFERRED_LOW_PRIORITY_BY_USER`
- `D-003A4`: 普通职业、教育与技能 — `SUFFICIENT_FOR_CURRENT_CHARACTER_CREATION_DETAILS_DEFERRED`
- `D-003A4A`: 普通职业是否构成长期玩法线 — `LOCKED=B_PERSISTENT_IDENTITY_GATEWAY_NO_FULL_CAREER_TREE`
- `D-003A4B`: 初始普通技能的来源 — `LOCKED=A_BACKGROUND_BASE_PLUS_FREE_SPECIALIZATION`
- `D-003A5`: 属性、性格特质与缺陷 — `SUFFICIENT_FOR_CURRENT_CHARACTER_CREATION_DETAILS_DEFERRED`
- `D-003A5A`: 初始基础属性的分配方式 — `LOCKED=A_BASELINE_PLUS_LIMITED_ALLOCATION_AND_BACKGROUND_MODIFIERS`
- `D-003A5B`: 捏人是否必须选择角色缺陷 — `LOCKED=A_ONE_REAL_FLAW_NO_BONUS_POINTS`
- `D-003A5C`: 性格特质对玩家自主选择的约束强度 — `LOCKED=A_INFLUENCE_WITHOUT_FORCED_ORDINARY_ACTIONS`
- `D-003A6`: 初始关系、资源与秘密 — `IN_PROGRESS_SPLIT`
- `D-003A6A`: 开局社会关系的嵌入程度 — `DEFERRED_FROM_V1_MANUAL_CONFIGURATION`
- `D-V1CC`: 第一版捏人复杂度 — `LOCKED=REFERENCE_LIKE_COMPACT_FIRST_VERSION`
- `D-V1CC1`: 第一版背景选择结构 — `LOCKED=B_ORIGIN_PLUS_CURRENT_PROFESSION`
- `D-V1CC2`: 第一版是否显示手动属性加点 — `LOCKED=A_AUTO_DERIVED_NO_POINT_BUY_UI`
- `D-V1CC3`: 第一版捏人最终短流程 — `LOCKED=A_ADAPTED_COMPACT_FLOW`
- `D-V1CC4`: 第一版捏人的性格特质选择数量 — `LOCKED=A_EXACTLY_TWO_TRAITS_PLUS_ONE_FLAW`
- `D-V1CC5`: 第一版自由专精在短流程中的位置与数量 — `LOCKED=A_ONE_BACKGROUND_FILTERED_FREE_SPECIALIZATION_IN_SUMMARY`
- `D-V1CC6`: 第一版整合出身池规模与五层覆盖 — `LOCKED=B_TEN_INTEGRATED_ORIGINS_TWO_PER_TIER`
- `D-V1CC7`: 第一版当前职业池规模 — `LOCKED=B_TWELVE_CURRENT_PROFESSIONS`
- `D-V1CC8`: 第一版出身与当前职业的组合限制 — `LOCKED=B_THREE_STATE_ORIGIN_PROFESSION_COMPATIBILITY`
- `D-003C2`: 第一份魔药的选择/获得机制 — `DEFERRED_UNTIL_CORE_GAMEPLAY_LOCKED`
- `D-003C2A`: 第一份魔药的玩家选择权呈现方式 — `DEFERRED_UNTIL_CORE_GAMEPLAY_LOCKED`
- `D-003C3`: 晋升上限、转途径与高序列边界 — `IN_PROGRESS_SPLIT`
- `D-003C3A`: 第一版三条途径的晋升上限 — `LOCKED=A_V1_THROUGH_SEQUENCE_SEVEN`
- `D-CORE`: 第一版基本玩法闭环 — `IN_PROGRESS_SPLIT`
- `D-CORE1`: 第一版主交互骨架 — `LOCKED=A_PANEL_LIFE_SIMULATION`
- `D-CORE2`: 主动行动与世界推进的基本节拍 — `LOCKED=C_DYNAMIC_MAJOR_ACTION_BUNDLE`
- `D-CORE3`: 世界推进周期单位 — `LOCKED=A_WEEKLY_WORLD_PULSE`
- `D-CORE4`: 普通职业与每周主动行动的关系 — `LOCKED=A_WORK_CONSUMES_ONE_MAJOR_ACTION`
- `D-CORE5`: 行动用尽后的世界脉冲确认边界 — `LOCKED=AUTO_PULSE_AFTER_LAST_ACTION`
- `D-V1COMBAT1`: 第一版战斗复杂度范围 — `LOCKED=A_MINIMAL_TWO_CORE_QUESTIONS`
- `D-COMBAT1`: 第一版战斗的核心结算结构 — `LOCKED=DUAL_STAGE_ROULETTE_CONTEST`
- `D-COMBAT1A`: 战斗结果转盘的输出范围 — `LOCKED=A_WIN_LOSS_ONLY`
- `D-COMBAT1B`: 胜负确定后的伤势、生死、逃脱与俘虏如何结算 — `LOCKED=A_CONTEXTUAL_CAUSAL_CONSEQUENCE_WHEEL`
- `D-COMBAT1C`: 一场战斗是否允许败后再战或多轮重开 — `LOCKED=A_NEW_EVENT_REQUIRED_TO_REENGAGE`
- `D-COMBAT1D`: 战斗胜负转盘按每轮还是整场结算 — `LOCKED=A_EACH_ROUND_AFTER_BOTH_ABILITY_WHEELS`
- `D-COMBAT1E`: 后果转盘向玩家公开到什么程度 — `DEFERRED_V1_MVP_SCOPE`
- `D-COMBAT2`: 每轮双方能力转盘的转动次数如何产生 — `LOCKED=A_CHARACTER_DERIVED_NONUNIFORM_ACTION_COUNT_WHEEL`
- `D-COMBAT2A`: 第一版出招次数是否以7次为硬上限 — `CANCELLED_INVALID_FIXED_RANGE_ASSUMPTION`
- `D-COMBAT2B`: 人物能力与效果如何换算为次数盘分布 — `LOCKED=A_BESPOKE_SOURCE_WEIGHT_COMPOSITION`
- `D-COMBAT2C`: 次数盘多个来源如何组合与归一化 — `LOCKED=A_ADD_ALL_SOURCE_WEIGHTS_THEN_NORMALIZE`
- `D-COMBAT2D`: 次数盘是否允许0次及最低行动保底 — `LOCKED=A_DEFAULT_MINIMUM_ONE_NO_ZERO_NORMAL`
- `D-COMBAT3`: 战斗能力转盘是否按实时面板动态适配 — `LOCKED=A_REAL_TIME_PANEL_ADAPTIVE_WHEEL`
- `D-COMBAT3A`: 同一回合内能力转盘何时重新生成 — `LOCKED=B_ROUND_START_SNAPSHOT`
- `D-COMBAT3B`: 同一回合多次转动能否重复命中同一项目 — `LOCKED=A_REPEAT_ALLOWED_PER_ENTRY_POLICY`
- `D-COMBAT3C`: 能力转盘自动收录哪些技能、封印物、道具与装备 — `LOCKED=A_ALL_CURRENTLY_USABLE_ACCESSIBLE_AUTO_INCLUDED`
- `D-COMBAT3D`: 回合快照中的项目临时失效如何处理 — `LOCKED=A_KEEP_SECTOR_PREDECLARED_NOOP_OR_REPLACEMENT`
- `D-COMBAT3E`: 快照内一次性物品耗尽后的处理 — `DEFERRED_V1_MVP_SCOPE`
- `D-COMBAT4`: 能力转盘各项目占比由什么构成 — `LOCKED=BASE_WEIGHT_PLUS_MASTERY_AND_CURRENT_MODIFIERS`
- `D-COMBAT4A`: 技能与能力的掌握程度采用何种记录尺度 — `LOCKED=A_0_TO_500_CONTINUOUS_WITH_LABELS`
- `D-COMBAT4B`: 能力转盘概率向玩家公开到什么程度 — `LOCKED=B_FULL_EXACT_DISCLOSURE_BOTH_SIDES`
- `D-COMBAT4C`: 能力盘多个来源权重如何叠加与归一化 — `LOCKED=A_BASE_TIMES_MASTERY_CURVE_PLUS_CURRENT_EFFECTS`
- `D-COMBAT4D`: 能力盘未知情况区的概率来源 — `LOCKED=A_PLUS_B_HYBRID_UNKNOWN_WEIGHT`
- `D-COMBAT5`: 双方能力转动结束后如何生成最终胜负盘 — `LOCKED=A_PLUS_C_PANEL_BASE_AND_RELATIVE_NORMALIZATION`
- `D-COMBAT5A`: 基础战势读取哪些实时面板因素 — `LOCKED=SIMPLIFIED_SEQUENCE_CORE_STATUS_INITIATIVE_ONLY`
- `D-COMBAT5B`: 基础战势四类因素的主次关系 — `LOCKED=A_SEQUENCE_TIER_CORE_WITHIN_TIER_STATUS_INITIATIVE_TEMPORARY`
- `D-COMBAT5C`: 四项核心能力如何聚合为档内战势 — `LOCKED=B_PATHWAY_SPECIFIC_CORE_WEIGHTS`
- `D-COMBAT5D`: 尚未进入途径的普通人采用何种核心能力权重 — `LOCKED=A_EQUAL_25_PERCENT_EACH`
- `D-COMBAT5E`: 进入途径后核心能力权重是否随序列变化 — `LOCKED=B_EACH_SEQUENCE_INDEPENDENT_WEIGHTS`
- `D-COMBAT5F`: 同一途径同一序列的核心能力权重是否允许玩家差异 — `LOCKED=A_FIXED_FOR_ALL_CHARACTERS`
- `D-COMBAT5G`: 序列核心能力权重采用何种数值精度 — `LOCKED=A_FIVE_PERCENT_INCREMENTS`
- `D-COMBAT5H`: 序列9占卜家的四项核心能力权重 — `LOCKED=A_10_40_20_30`
- `D-COMBAT5I`: 序列8小丑的四项核心能力权重 — `LOCKED=A_40_35_15_10`
- `D-COMBAT5J`: 序列7魔术师的四项核心能力权重 — `LOCKED=A_20_30_15_35`
- `D-COMBAT5K`: 序列9观众的四项核心能力权重 — `LOCKED=A_5_45_20_30`
- `D-COMBAT5L`: 序列8读心者的四项核心能力权重 — `LOCKED=A_5_40_30_25`
- `D-COMBAT5M`: 序列7心理医生的四项核心能力权重 — `LOCKED=A_5_25_40_30`
- `D-COMBAT5N`: 序列9猎人的四项核心能力权重 — `LOCKED=A_40_30_10_20`
- `D-COMBAT5O`: 序列8挑衅者的四项核心能力权重 — `LOCKED=A_35_30_25_10`
- `D-COMBAT5P`: 序列7纵火家的四项核心能力权重 — `LOCKED=A_30_25_30_15`
- `D-COMBAT5Q`: 能力命中后的胜势贡献如何合并 — `LOCKED=A_SUM_SIGNED_DELTAS_PER_HIT`
- `D-COMBAT5R`: 先手进入最终战势的具体方式 — `DEFERRED_V1_MVP_SCOPE`
- `D-COMBAT6`: 序列档位与加权核心能力如何合成基础战势 — `LOCKED=A_FIXED_TIER_BASE_PLUS_CAPPED_CORE_MODIFIER`
- `D-COMBAT6A`: 序列基础值采用全途径共用档位还是途径独立档位 — `LOCKED=A_GLOBAL_HANDCRAFTED_BASE_PER_SEQUENCE_RANK`
- `D-COMBAT6B`: 首版普通人及序列9至7的基础战势值 — `LOCKED=A_100_200_300_450`
- `D-COMBAT6C`: 加权核心能力如何转为有上限的档内修正 — `LOCKED=A_DIRECT_ADD_CAPPED_AT_20_PERCENT_OF_TIER_BASE`
- `D-COMBAT6D`: 健康精神灵性等状态如何进入基础战势 — `LOCKED=A_INDEPENDENT_BANDS_STACKED_WITH_TOTAL_CAP`
- `D-COMBAT6E`: 健康精神灵性状态档位阈值与扣减幅度 — `LOCKED=A_0_5_10_20_TOTAL_CAP_40`
- `D-COMBAT6F`: 状态百分比扣减作用于哪一部分基础战势 — `LOCKED=A_APPLY_TO_TIER_BASE_PLUS_CORE_BONUS`
- `D-COMBAT6H`: 低序列越级战胜高序列的底层边界 — `LOCKED=A_RARE_ROULETTE_UPSET_REQUIRES_SPECIAL_CONDITIONS_STRONG_POSITION_SUPPRESSION`
- `D-COMBAT6I`: 位格压制进入最终胜负转盘的算法 — `LOCKED=C_SEQUENCE_BASE_AND_ACTUAL_EFFECTS_ONLY_NO_EXTRA_CAP_OR_MULTIPLIER`
- `D-COMBAT6J`: 现有序列基础战势差是否足以体现明显压制 — `LOCKED=C_KEEP_100_200_300_450_ABILITY_EFFECTS_CREATE_FURTHER_SUPPRESSION`
- `D-COMBAT6K`: 逐序列能力设计后的跨序列对战校准方式 — `LOCKED=A_BATCH_SIMULATION_PLUS_CANON_MANUAL_REVIEW`
- `D-COMBAT6G1`: 健康归零在战斗中的规则 — `LOCKED=HEALTH_ZERO_SURVIVAL_WHEEL_SUCCESS_CONTINUES_FAILURE_DIES`
- `D-COMBAT6G1A`: 健康归零生存转盘的概率输入 — `LOCKED=A_DYNAMIC_SEQUENCE_PHYSIQUE_INJURY_SURVIVAL_EFFECTS`
- `D-COMBAT6G1B`: 健康归零生存转盘采用哪套概率公式 — `LOCKED=A_REUSE_GENERAL_50_PLUS_2_DIFF_CLAMP_5_95`
- `D-COMBAT6G1C`: 普通人至序列7的生存位阶加成 — `LOCKED=A_0_5_10_15`
- `D-COMBAT6G1D`: 健康归零伤势难度档与具体数值 — `LOCKED=A_15_25_35_45`
- `D-COMBAT6G1E`: 生存转盘成功后的继续战斗状态 — `LOCKED=A_HEALTH_TO_1_WITH_DYING_STATUS_NO_DUPLICATE_GENERIC_PENALTY`
- `D-COMBAT6G1F`: 同场战斗重复健康归零的生存判定 — `LOCKED=A_REPEAT_WHEEL_PLUS_10_DIFFICULTY_PER_PRIOR_SUCCESS_FLOOR_5`
- `D-COMBAT6G1G`: 生存转盘失败的角色结果 — `LOCKED=FAILURE_IS_DEATH`
- `D-COMBAT6G1H`: NPC死亡后已独立生效的持续效果如何处理 — `DEFERRED_NPC_ONLY`
- `D-PLAYERDEATH1`: 玩家角色死亡是否结束当前游戏 — `LOCKED=PLAYER_DEATH_IMMEDIATELY_ENDS_CURRENT_RUN`
- `D-PLAYERDEATH1A`: 玩家死亡后的存档可否继续或回档 — `LOCKED=A_PERMANENT_READ_ONLY_ARCHIVE_NO_ROLLBACK`
- `D-SETTLEMENTREF1`: 《汴京梦华》死亡终局结算实现审计 — `DONE_REFERENCE_ONLY`
- `D-SETTLEMENT1`: 本项目终局结算是否设置统一总分 — `LOCKED=A_MULTIDIMENSIONAL_DOSSIER_NO_TOTAL_SCORE`
- `D-SETTLEMENT2`: 终局事实评价与叙事文本的生成权威 — `LOCKED=A_DETERMINISTIC_FACTS_AND_TITLES_AI_RAG_PROSE_ONLY`
- `D-ENDING1`: 除玩家死亡外是否存在其他正式终局 — `LOCKED=A_DEATH_OR_EXPLICIT_ENDING_NO_FIXED_WEEK_CAP`
- `D-ENDING1A`: 非死亡终局条件满足后是否由玩家确认结束 — `LOCKED=A_UNLOCK_ENDING_CHOICE_PLAYER_MAY_END_OR_CONTINUE`
- `D-SETTLEMENT3`: 终局生涯卷宗的记录范围 — `LOCKED=A_SIX_CORE_SUMMARY_SECTIONS`
- `D-COMBAT6G2`: 精神归零的基础规则 — `LOCKED=CAUSE_SPECIFIC_NO_UNIVERSAL_MENTAL_ZERO_WHEEL`
- `D-RESOLUTIONBOUNDARY`: 转盘与普通判定的适用边界 — `LOCKED=ROULETTES_COMBAT_ONLY_NONCOMBAT_USES_CHECKS`
- `D-ZERO1`: 可使资源归零的来源是否必须声明归零后果 — `LOCKED=A_EXPLICIT_ON_ZERO_REQUIRED_VALIDATION_FAILS_IF_MISSING`
- `D-ZERO2`: `onZero` 判定采用几档结果 — `LOCKED=A_REUSE_UNIFIED_FOUR_TIERS`
- `D-ZERO3`: `onZero` 判定难度由何处定义 — `LOCKED=A_SOURCE_OWNS_DIFFICULTY_RULE`
- `D-ZERO4`: 同一来源同时清空多项资源如何结算 — `LOCKED=A_SINGLE_SOURCE_COMBINED_ON_ZERO`
- `D-RECOVERY1`: 健康、精神、灵性的恢复如何进入基础玩法 — `LOCKED=DAILY_ACTION_EMBEDDED_RESOURCE_EFFECTS`
- `D-RECOVERY2`: 日常按钮在执行前显示多少资源影响 — `LOCKED=A_QUALITATIVE_PREVIEW_EXACT_POST_RESULT`
- `D-ACTIONS1`: 日常行动按钮采用固定、动态还是混合结构 — `LOCKED=A_FIXED_CORE_PLUS_CONTEXTUAL_ACTIONS`
- `D-ACTIONS2`: 第一版固定核心按钮的最小清单 — `LOCKED=FOUR_CORE_WORK_LEARN_INVEST_REST`
- `D-WORK1`: 工作行动的基础功能与收入来源 — `LOCKED=CURRENCY_INCOME_NONFIXED_SCALES_WITH_INDUSTRY`
- `D-LEARN1`: 学习行动的基础功能 — `LOCKED=EXTRAORDINARY_KNOWLEDGE_AND_KNOWLEDGE_GROWTH`
- `D-INVEST1`: 调查行动的基础功能 — `LOCKED=PRIMARY_STORY_DRIVER_CAN_TRIGGER_CHECKS_AND_COMBAT`
- `D-ACTING1`: 日常行动与扮演进度的关系 — `LOCKED=CONTEXTUAL_TRIGGER_INVESTIGATION_HIGHER`
- `D-REST1`: 休养所恢复的“体质”对应哪项现有数值 — `LOCKED=B_HEALTH_MENTAL_SPIRITUALITY_NOT_PHYSIQUE`
- `D-INDUSTRY1`: 玩家产业规模如何量化 — `LOCKED=A_INDEPENDENT_ASSET_TYPE_AND_SCALE_1_TO_5`
- `D-ECON0`: 经济系统与金钱的整体重要性 — `LOCKED=CENTRAL_GAMEPLAY_RESOURCE_ORIGINAL_ECONOMY_ANCHORED`
- `D-ECONREF1`: 《诡秘之主》鲁恩经济与非凡商品价格基准 — `READ_ONLY_AUDITED_WORKING_BASELINE`
- `D-ECON1`: 鲁恩货币的内部存储与界面显示方式 — `LOCKED=A_INTEGER_PENCE_INTERNAL_COMPOSITE_DISPLAY`
- `D-ECON2`: 玩家基础生活开销的结算方式 — `LOCKED=A_WEEKLY_LIFESTYLE_TIER_AUTO_SETTLEMENT`
- `D-ECON3`: 初版生活档位数量 — `LOCKED=C_FIVE_TIERS`
- `D-ECON4`: 每周生活费包含的日常项目 — `LOCKED=A_CORE_DAILY_BUNDLE`
- `D-ECON5`: 生活费是否随所在城市变化 — `LOCKED=A_BASE_COST_TIMES_LOCATION_INDEX`
- `D-ECON6`: 五档生活水平的初版每周费用 — `LOCKED=A_ORIGINAL_SCALE_BACKLUND_BASE_TABLE`
- `D-ECON7`: 生活档位除费用外的玩法影响 — `LOCKED=A_EVENT_DRIVEN_RECOVERY_RISK_SOCIAL_ACCESS_NO_DIRECT_POWER`
- `D-ECONEVENT1`: 经济与生活后果必须事件化 — `LOCKED=EVENTS_NOT_STATUS_LABELS`
- `D-ECON8`: 周结算资金不足时的处理 — `LOCKED=A_CONTEXTUAL_FINANCIAL_CRISIS_EVENT`
- `D-ECON9`: 玩家主动改变生活档位的方式 — `LOCKED=A_EVENT_RELOCATION_SETUP_COST_NEXT_WEEK`
- `D-DEBT1`: 借款是否建立正式债务记录 — `LOCKED=B_AGGREGATE_TOTAL_AND_FIXED_WEEKLY_PAYMENT`
- `D-DEBT2`: 每周固定还款的执行方式 — `LOCKED=A_AUTO_DEDUCT_NO_NEGATIVE_DEFAULT_EVENT`
- `D-DEBT3`: 简化债务的利息与费用方式 — `LOCKED=ONE_TIME_FEE_NO_ROLLING_INTEREST_BY_SCOPE_DIRECTIVE`
- `D-ECONSCOPE1`: 生活与债务系统的产品优先级 — `LOCKED=LIGHTWEIGHT_SUPPORT_NOT_PRIMARY_LIFE_SIM`
- `D-WORK2`: 职业工资与产业收入如何进入工作行动 — `LOCKED=A_COMBINED_ALL_SOURCES_ONCE_PER_WEEK_WITH_EVENTS`
- `D-WORK3`: 工作收入波动的产生方式 — `LOCKED=B_FIXED_ROUTINE_FORMULA_NO_RANDOM_VARIANCE`
- `D-INDUSTRY2`: 产业固定收益公式采用净收益还是毛利减成本 — `LOCKED=B_DIRECT_FIXED_NET_BY_TYPE_AND_SCALE`
- `D-INDUSTRY3`: 产业1—5级净收益成长曲线 — `LOCKED=A_SHARED_1_2_4_7_11_MULTIPLIERS`
- `D-INDUSTRY4`: 玩家持有的产业以具体资产还是抽象类别呈现 — `LOCKED=A_CONCRETE_NAMED_ASSETS_FROM_REUSABLE_TEMPLATES`
- `D-INDUSTRY5`: 玩家获得产业的主要方式 — `LOCKED=A_CONDITIONAL_ACQUISITION_EVENTS`
- `D-INDUSTRY6`: 产业规模升级方式 — `LOCKED=B_DIRECT_PAID_INSTANT_UPGRADE`
- `D-EXTRAORDINARYPRIORITY1`: 后续设计重心 — `LOCKED=BEYONDER_SYSTEM_PRIMARY_SUPPORT_SYSTEMS_STOP_AT_MVP`
- `D-ABILITYSCHEMA1`: 一项原著能力及其多种用法如何拆分记录 — `LOCKED=B_SINGLE_FLAT_ABILITY_RECORD_TEXTUAL_USES`
- `D-ABILITYSCHEMA2`: 同一能力如何承载普通判定与战斗参数 — `LOCKED=A_SHARED_IDENTITY_MASTERY_SEPARATE_CHECK_AND_COMBAT_BLOCKS`
- `D-ABILITYSCHEMA3`: 非凡能力资源消耗的统一表示 — `LOCKED=A_PER_ABILITY_EXPLICIT_NONE_SPIRITUALITY_OR_SPECIAL_COST`
- `D-ABILITYSCHEMA4`: 能力默认目标范围如何表达 — `LOCKED=A_EXPLICIT_TARGET_SELECTOR_DEFAULT_SINGLE_TARGET`
- `D-ABILITYSCHEMA5`: 能力效果的持续与叠加如何表达 — `LOCKED=A_IMMEDIATE_DEFAULT_EXPLICIT_DURATION_STACK_POLICY`
- `D-ABILITYMASTERY1`: 0—500掌握度影响能力的哪些部分 — `LOCKED=A_RELIABILITY_CHECKS_COMBAT_WEIGHT_SEQUENCE_POWER_CEILING`
- `D-ABILITYMASTERY2`: 晋升新获得能力的初始掌握度 — `LOCKED=C_ALL_NEW_ABILITIES_START_ZERO`
- `D-ABILITYMASTERY3`: 0掌握度能力能否使用 — `LOCKED=A_ACTIVE_CRUDE_USE_PASSIVE_BASE_EFFECT`
- `D-ABILITYMASTERY4`: 能力掌握度的成长来源 — `LOCKED=MULTI_SOURCE_LEARNING_USE_COMBAT_HIGH_GAIN`
- `D-ABILITYMASTERY5`: 学习与战斗增长作用于哪些能力 — `LOCKED=C_RANDOM_ABILITY_ALLOCATION`
- `D-ABILITYMASTERY6`: 随机分配熟练度时的候选能力池 — `LOCKED=C_ALL_KNOWN_BEYONDER_ABILITIES_AND_ORDINARY_SKILLS`
- `D-ABILITYMASTERY7`: 随机候选池中各能力的抽取权重 — `LOCKED=A_LOW_MASTERY_HIGHER_WEIGHT`
- `D-ABILITYMASTERY8`: 低掌握度倾斜的具体随机权重公式 — `LOCKED=A_FIVE_BAND_5_4_3_2_1_ZERO_AT_500`
- `D-ABILITYMASTERY9`: 学习、调查与战斗生成的熟练度数值 — `LOCKED=A_FIXED_5_8_25_PER_SOURCE`
- `D-ABILITYMASTERY10`: 同一周熟练度收益次数限制 — `LOCKED=A_EVERY_VALID_SOURCE_NO_WEEKLY_CAP_REPEAT_FARMING_INELIGIBLE`
- `D-ABILITYMASTERY11`: 熟练度收益超过500时的溢出处理 — `LOCKED=A_CAP_AT_500_DISCARD_OVERFLOW`
- `D-ABILITYMASTERY12`: 熟练度参与普通判定的基础结构 — `SUPERSEDED_BY_D-ABILITYMASTERY13_NO_UNIVERSAL_NUMERIC_BONUS`
- `D-ABILITYMASTERY13`: 熟练度换算为普通判定加成的强度 — `LOCKED=NO_UNIVERSAL_PERCENTAGE_OR_EFFECTIVE_VALUE_BONUS`
- `D-ABILITYMASTERY14`: 无通用成功率加成后熟练度如何影响能力 — `LOCKED=A_PER_ABILITY_CUSTOM_EFFECTS_WITH_POSITION_CAP`
- `D-ABILITYMASTERY15`: 熟练度效果使用统一阶段还是自定义阈值 — `LOCKED=A_COMMON_100_200_300_400_500_MILESTONES_CUSTOM_EFFECTS`
- `D-ABILITYCONTENT1`: 每项非凡能力必须逐项设计实际效果 — `LOCKED=INDIVIDUAL_EFFECT_DESIGN_REQUIRED`
- `D-STARTCITY1`: 首版标准开局城市 — `LOCKED=B_BACKLUND`
- `D-ECONHOUSE1`: 生活费按个人还是家庭口径结算 — `LOCKED=B_PLAYER_ONLY_FAMILY_SEPARATE`
- `D-VISIT1`: 拜访行动的具体玩法职责 — `LOCKED=C_NO_VISIT_BUTTON_SOCIAL_VIA_EVENTS`
- `D-CITYTRAVEL1`: 拜访按钮替代项 — `DEFERRED_V1_NO_CITY_MAP`
- `D-CITYTRAVEL2`: 城市切换按钮的行动消耗、时间与目的地范围 — `DEFERRED_V1_NO_CITY_MAP`
- `D-MARKET1`: 黑市的基础交易能力 — `LOCKED=PLAYER_LIST_BUY_AND_SELL`
- `D-AUCTION1`: 黑市拍卖会周期与核心内容 — `LOCKED=EVERY_THREE_MONTHS_RARE_ITEMS`
- `D-DESIGNORDER`: 底层数值判定算法完成后再量化所有序列全部能力 — `LOCKED=NUMERIC_KERNEL_THEN_ABILITY_SCHEMA_THEN_ALL_22_PATHWAYS_SEQUENCE_9_TO_0`
- `D-IMPLEMENTORDER1`: 底层系统与全序列数值内容的制作顺序 — `LOCKED=FOUNDATION_ENGINE_FIRST_SEQUENCE_DATA_INCREMENTALLY_AFTERWARD`
- `D-ABILITYENGINE1`: 底层引擎与逐能力专属逻辑的边界 — `LOCKED=C_DATA_DRIVEN_CORE_WITH_CONTROLLED_SPECIAL_HANDLERS`
- `D-ABILITYENGINE2`: 特殊能力扩展处理器能否绕过公共结算 — `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `D-ABILITYENGINE3`: 特殊处理器的随机性与随机数来源 — `LOCKED=A_ENGINE_PROVIDED_REPLAYABLE_RNG_LOGGED_DRAWS`
- `D-ABILITYENGINE4`: 特殊处理器随机调用的顺序与重放规则 — `LOCKED=A_ACTION_SCOPED_DETERMINISTIC_RNG_FIXED_ORDER`
- `D-ABILITYRESOLUTION1`: 普通能力是否另设效果事务，还是直接走统一数值判定 — `LOCKED=A_UNIFIED_GENERAL_CHECK_NO_SEPARATE_EFFECT_TRANSACTION`
- `D-ABILITYEFFECT1`: 一次能力结算可产生的公共效果结构 — `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `D-ABILITYEFFECT2`: 公共效果列表中单项效果失败时的处理 — `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `D-ABILITYEFFECT3`: 能力级前置、目标合法性与资源成本的预检时机 — `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `D-ABILITYEFFECT4`: 预检通过后资源成本的实际提交时机 — `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `D-ABILITYEFFECTSCOPE1`: 公共效果基础规则适用于普通能力判定还是战斗转盘 — `LOCKED=A_NORMAL_RESOLUTION_ONLY_COMBAT_ROULETTE_SEPARATE`
- `D-DOCS1`: 设计文档分类、权威顺序与其他 agent 接管方式 — `DONE_DOCUMENTATION`
- `D-DOCS2`: 后续每道 Grill 决定是否必须同步到对应主题 Markdown — `LOCKED=A_EVERY_GRILL_DECISION_SYNCED_TO_THEME_DOC`
- `D-GRILLMODE1`: 未决设计的提问组织方式 — `LOCKED=A_THEME_BATCH_WITH_INDEPENDENT_NUMBERED_ITEMS`
- `D-GRILLBATCH1`: 第一批普通判定、资源与周循环问题 — `DONE_BATCH_FOLLOWUPS_PENDING`
- `D-GRILLBATCH2`: 第二批资源透支、污染、动态行动与城市切换 — `DONE_BATCH_FOLLOWUPS_PENDING`
- `D-RESOURCEOVERDRAFT1`: 资源负值的下限、归零触发与战势读取 — `LOCKED=A_SOURCE_DECLARED_OVERDRAFT_FLOOR`
- `D-RESOURCEOVERDRAFT2`: 资源穿过归零线后的重复触发与战势读取 — `LOCKED=A_SINGLE_CROSSING_ONZERO_ZERO_FOR_BATTLE`
- `D-RECOVERYVALUES1`: 休养恢复健康、精神、灵性的数值方式 — `LOCKED=C_DYNAMIC_REST_RECOVERY`
- `D-POLLUTIONEFFECT1`: 可见污染值对行动和后果的作用 — `LOCKED=A_THRESHOLD_EVENT_EFFECTS`
- `D-ACTIONBUDGET1`: 动态每周行动力的基准与修正来源 — `LOCKED=B_BASE_3_PLUS_MODIFIERS`
- `D-ACTIONBUDGET2`: 动态行动力修正的合并与边界 — `LOCKED=A_INTEGER_ADD_MIN1_CONTENT_MAX`
- `D-ACTIONBUDGET3`: 行动力跨周结转与额外行动 — `LOCKED=A_NO_CARRYOVER_WEEKLY_EXTRA_ONLY`
- `D-RECOVERYVALUES2`: 动态休养恢复的输入优先级与边界 — `LOCKED=A_REST_TABLE_STATE_MODIFIER_EVENT_OVERRIDE`
- `D-POLLUTIONEFFECT2`: 污染阈值带与事件数据边界 — `LOCKED=A_FOUR_POLLUTION_BANDS`
- `D-RESOURCEOVERDRAFT3`: 透支下限的数据字段表达 — `LOCKED=A_ABSOLUTE_OVERDRAFT_FLOOR_FIELD`
- `D-RESOURCECAP1`: 资源恢复超过上限时的溢出处理 — `LOCKED=A_CLAMP_AND_DISCARD_OVERFLOW`
- `D-RECOVERYVALUES3`: 负值资源的休养回补顺序 — `LOCKED=A_RECOVER_TO_ZERO_THEN_POSITIVE`
- `D-POLLUTIONEFFECT3`: 污染阈值事件的触发时机 — `LOCKED=A_CHECK_ON_ENTERING_BAND`
- `D-GRILLBATCH3`: 第三批资源、恢复、污染与行动力具体边界 — `DONE_BATCH_FOLLOWUPS_PENDING`
- `D-GRILLBATCH4`: 第四批资源余量、周脉冲与重战边界 — `DONE_BATCH_FOLLOWUPS_PENDING`
- `D-GRILLBATCH5`: 第五批战斗转盘组合、快照与胜负时机 — `DONE_BATCH`
- `D-GRILLBATCH6`: 第六批战斗贡献、次数保底、消耗、先手与后果公开 — `DONE_BATCH`
- `D-GRILLBATCH7`: 第七批普通判定修正与能力目标范围 — `DONE_BATCH`
- `D-GRILLBATCH8`: 第八批普通后果结构与能力效果生命周期 — `DONE_BATCH`
- `D-UI1`: 周舞台外壳采用单一仪表盘还是多页面 — `LOCKED=A_PERSISTENT_WEEKLY_DASHBOARD`
- `D-UI2`: 战斗承载在周舞台遮罩还是独立页面 — `LOCKED=A_DASHBOARD_OVERLAY`
- `D-UI3`: 第一版视觉方向 — `LOCKED=A_OCCULT_DOSSIER_WORKBENCH`
- `D-EVENT1`: 第一版事件卡内容规模 — `LOCKED=B_90_STANDALONE_9_CHAINS`
- `D-EVENT2`: 周事件弹出密度 — `LOCKED=A_ONE_BLOCKING_CARD_PLUS_DEFERRED_NONBLOCKING`
- `D-EVENT3`: 事件卡默认选项数量 — `LOCKED=A_TWO_DEFAULT_THREE_ONLY_DECLARED_EXCEPTION`
- `D-EVENT4`: 日常行动与事件卡的结算先后 — `LOCKED=A_COMMIT_ACTION_COST_THEN_BLOCKING_CARD`
- `D-EVENT5`: 哪些日常行动可以生成阻塞式事件卡 — `LOCKED=A_ALL_CORE_ACTIONS_ELIGIBLE`
- `D-EVENT6`: 阻塞式事件卡能否暂存/跳过 — `LOCKED=A_MUST_RESOLVE_NOW_NONBLOCKING_CAN_DEFER`
- `D-EVENT7`: 非阻塞事件的保留与展示方式 — `LOCKED=A_MINIMAL_PENDING_EVENT_LIST`
- `D-EVENT8`: 待处理事件的处理成本 — `LOCKED=USER_NO_ACTION_POINT_COST`
- `D-EVENT9`: 待处理事件的到期 — `LOCKED=A_EXPLICIT_EXPIRY_WEEK`
- `D-EVENT11`: 事件卡与原著大事件的关系 — `LOCKED=A_CANON_CONSTRAINED_ORIGINAL_SIDE_STORY`
- `D-EVENT12`: 事件触发与候选池抽取 — `LOCKED=A_CONTEXT_WEIGHTED_DETERMINISTIC_DRAW`
- `D-EVENT13`: 首版独立事件卡类别配比 — `LOCKED=A_BALANCED_30_15_20_15_10`
- `D-EVENT14`: 单张事件卡的解析层级 — `LOCKED=A_ONE_PRIMARY_RESOLUTION`
- `D-EVENT15`: 事件卡风险与难度的信息公开 — `LOCKED=B_EXACT_DIFFICULTY_PROBABILITY_MAIN_CONSEQUENCES`
- `D-EVENT16`: 事件重复、冷却与多样性 — `LOCKED=A_COOLDOWN_DIVERSITY_PITY`
- `D-EVENT17`: 连环案阶段衔接方式 — `LOCKED=A_DECLARED_CONDITIONAL_NEXT_STAGE`
- `D-EVENT18`: 事件卡与死亡判定的边界 — `LOCKED=A_EXISTING_DEATH_RULES_ONLY`
- `D-EVENT10`: 模板、RAG 与小模型的职责/生成时机 — `LOCKED=A_BUILD_TIME_APPROVED_VARIANTS`
- `D-COMBATREF1`: B站“咒术转盘特别篇”宿傩对战机制审计 — `DONE_REFERENCE_ONLY`
- `D-004`: 回合、日程或实时推进方式 — `PARTIALLY_LOCKED_WEEKLY_DYNAMIC_ACTION_BUNDLE`
- `D-NUM`: 第一版基础数值模型 — `IN_PROGRESS_SIMPLIFIED_BY_USER`
- `D-NUM1`: 基础数值是否分层 — `CANCELLED_OVERCOMPLEX_BY_USER`
- `D-NUM1S`: 第一版可见核心数值规模 — `LOCKED=A_FOUR_CORE_THREE_STATUS`
- `D-NUM1S1`: 是否存在统一的交际数值 — `LOCKED=A_NO_UNIFIED_SOCIAL_STAT`
- `D-NUM1S2`: 第一版核心能力的最小集合 — `LOCKED=A_PHYSIQUE_PERCEPTION_WILL_KNOWLEDGE`
- `D-NUM1S2A`: 知识是否为数值型核心能力 — `LOCKED=A_INCLUDE_NUMERIC_KNOWLEDGE`
- `D-NUM1S2B`: 知识加入后的其余核心能力集合 — `LOCKED=A_PHYSIQUE_PERCEPTION_WILL`
- `D-NUM1S3`: 灵性是否进入基础数值 — `LOCKED=A_INCLUDE_SPIRITUALITY_RESOURCE`
- `D-NUM1S3A`: 灵性的数值定位与普通人阶段呈现 — `LOCKED=A_VISIBLE_CURRENT_MAX_FROM_ORDINARY_START`
- `D-NUM2`: 核心能力数值刻度 — `LOCKED=CUSTOM_ZERO_TO_FIVE_HUNDRED`
- `D-NUM2A`: 普通人的核心能力基准点 — `LOCKED=CUSTOM_ORDINARY_TEN_TO_TWENTY`
- `D-NUM2B`: 0—500刻度是否覆盖序列0 — `LOCKED=A_SEQUENCE_ONE_CAP_SEQUENCE_ZERO_OUTSIDE_SCALE`
- `D-NUM2C`: 序列晋升对四项核心能力的影响方式 — `LOCKED=A_PATHWAY_DIRECTED_CORE_GROWTH`
- `D-NUM2D`: 九个非神序列的数值增长曲线 — `LOCKED=A_SEGMENTED_MACRO_ENVELOPE`
- `D-NUM2D1`: 每条途径每个序列是否单独设计成长 — `LOCKED=A_CANON_GUIDED_BESPOKE_SEQUENCE_GROWTH`
- `D-NUM3`: 健康、精神与灵性的数值刻度 — `LOCKED=A_HEALTH_MENTAL_100_SPIRITUALITY_500_SIGNED_CURRENT`
- `D-NUM3A`: 普通人开局的基础数值模板 — `LOCKED=A_BASE_FIFTEEN_DERIVED_TEN_TO_TWENTY`
- `D-NUM4`: 普通人训练能否突破20 — `LOCKED=A_ORDINARY_SOFT_CAP_20_EXCEPTIONAL_25`
- `D-NUM5`: 基础检定怎样把能力值转成成功率 — `LOCKED=A_VISIBLE_DIFFERENCE_BASED_PROBABILITY`
- `D-NUM5A`: 能力差值换算成功率的幅度 — `LOCKED=A_TWO_PERCENTAGE_POINTS_PER_DIFFERENCE`
- `D-NUM5B`: 可检定行动的成功率上下限 — `LOCKED=A_FIVE_TO_NINETY_FIVE_CONTESTABLE_CAP`
- `D-NUM5C`: 基础检定的通用结果层级 — `LOCKED=C_FOUR_OUTCOME_TIERS`
- `D-NUM5D`: 大成功与大失败的触发方式 — `LOCKED=A_FIXED_EXTREME_D100_FACES`
- `D-NUM5E`: 解决质量与实际后果是否分离 — `LOCKED=A_DUAL_AXIS_SINGLE_CHECK_CAUSAL_CONSEQUENCES`
- `D-NUM5F`: 普通判定的数值修正如何合并 — `LOCKED=A_ADD_SIGNED_INTEGER_MODIFIERS_NO_GLOBAL_MULTIPLIERS`
- `D-NUM5G`: 普通判定的后果最小数据结构 — `LOCKED=A_ORDERED_EXPLICIT_CONSEQUENCE_ITEMS`
- `D-NUM6`: 污染是否作为独立状态以及如何向玩家呈现 — `LOCKED=B_VISIBLE_POLLUTION_0_TO_100`
- `D-LORE1`: 原作背景与克苏鲁式结果语义审计 — `DONE_BASELINE_AUDIT_REQUIRES_PRIMARY_TEXT_FOR_EXACT_CANON`
- `D-005`: 单机、联网与 AI 依赖边界 — `PENDING_PRODUCT_SCOPE / ENGINEERING_BASELINE_LOCAL_DESKTOP`
- `D-006`: 商用、免费公开或仅私人试玩范围 — `PARTIALLY_LOCKED_CODE_OPEN_SOURCE_GAME_DISTRIBUTION_PENDING`
- `D-006A`: 开源代码许可证与题材内容边界 — `LOCKED=MIT_CODE_AND_ORIGINAL_DOCS / THIRD_PARTY_IP_SEPARATE_NOTICE`
- `D-TECH1`: 第一版工程底座 — `ENGINEERING_BASELINE=ELECTRON_REACT_TYPESCRIPT_VITE_MAIN_SQLITE`
- `D-ORCH1`: 开发任务拓扑 — `LOCKED=MASTER_REVIEW_DISPATCH_PLUS_DESIGN_GRILL_FRONTEND_BACKEND_TASKS`
- `D-ORCH2`: 每轮完成门禁 — `LOCKED=BOTH_WORKSTREAMS_THEN_MASTER_WIRING_AND_USER_REVIEW`
- `D-ORCH3`: 自动压缩恢复权威 — `LOCKED=REPOSITORY_LEDGER_CONTRACT_STATUS_AND_GIT_HEADS / DEEP_LINKS_NAVIGATION_ONLY`
- `D-ORCH4`: 新设计决定的传播门禁 — `LOCKED=GRILL_ANSWER_TO_LEDGER_AND_TOPIC_DOCS_TO_COMMIT_TO_MASTER_INTEGRATION_TO_DESIGN_SYNC`
- `D-GITHUB1`: 公共开源仓库 — `LOCKED=PUBLIC_GITHUB_DONGXUELIAN11_LOTM_FAN_GAME`
- `D-RAG1`: 是否采用 gmzz RAG 边界与本地小模型检索 — `FEASIBLE_PENDING_MODEL_AND_CORPUS_DECISIONS`
- `D-PATH-BODY1`: 序列晋升造成的性别/身体变化 — `DEFERRED_TO_PATHWAY_DESIGN`

## LOCKED_DESIGN

### D-001 首要玩家幻想

- `DECISION`: `A_PERSONAL_BEYONDER_SURVIVAL_GROWTH`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 首个可玩纵切以一名玩家角色的个人生存与非凡成长为中心。
- 核心体验候选包括调查神秘、获得/消化魔药、维护身份与关系，以及在持续演化的世界中承担选择后果。
- 组织经营可以成为中后期或从属系统，但不能取代个人角色作为第一主视角。
- 案件可以承载成长过程，但不能把第一版收窄为纯章节制案件游戏。
- 下列内容尚未由本决定锁定：具体年代、是否与原作主角同期、玩家初始身份、初始序列、可选途径、时间推进、AI 使用方式和发布范围。

### D-002 原作关系与时间线

- `DECISION`: `A_CANON_ERA_PARALLEL_STORY`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 游戏采用原作同期旁线：玩家生活在克莱恩所在时代，原作重大事件会作为世界时间线的一部分影响环境。
- 玩家角色不是克莱恩，也不取代原作主角的中心位置。
- 原作人物可以在合理条件下与玩家产生交集，但不能把“重演原作主线”作为个人成长玩法的替代品。
- 首个版本不以大幅改写原作中心结局为主要承诺；玩家仍应能在旁线人物、组织、地点和事件中产生真实的局部后果。
- 本决定尚未锁定开局具体日期、城市、与原作人物的接触频率，以及重大原作事件能否在极端条件下发生有限偏移。

### D-003A 玩家角色身份形式

- `DECISION`: `A_FULLY_CUSTOM_ORIGINAL_CHARACTER`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 玩家控制完全自建的原创角色，而不是固定主角、预设角色或原作人物。
- 角色创建至少允许玩家定义姓名、性别、出身、普通职业和性格特质；第一版性格特质数量已由 `D-V1CC4` 锁定为2个并另选1个真实缺陷，具体选项、效果与其余限制仍待后续决定。
- 自建角色必须嵌入原作同期世界，并通过合法身份、关系、知识与行为后果保持世界可信度，不能成为没有社会来历的万能化身。
- 首个可玩版本仍围绕一名主角色展开，不因自建功能扩张为多主角并行叙事。
- 本决定尚未锁定角色开局是否为非凡者、首发开放途径、是否允许转途径，以及外貌/年龄/国籍的可选边界。

### D-003B 初始非凡状态

- `DECISION`: `A_ALL_START_ORDINARY`
- `CONFIRMED_BY_USER`: 2026-08-28，用户在细致 Grill-me 后回复 `a`。
- 所有标准新游戏角色都从普通人开始；角色创建时不能直接获得序列9能力。
- 第一份魔药必须通过世界内可信渠道取得，例如调查、组织接触、黑市、交易、人际关系或危险事件，不能凭空发放。
- 接受哪一份魔药是角色人生的重要选择；玩家可以拒绝或延后当前机会，拒绝不等于坏档或立即结束游戏。
- 普通职业、社会身份、金钱、人脉、知识和性格在成为非凡者后仍需持续产生作用，不能退化为一次性教程标签。
- 标准首局必须保留普通人与神秘世界之间的信息差、脆弱性和接触门槛。
- 本决定尚未锁定普通人阶段长度、第一份魔药的候选方式、首发途径数量、二周目快速开局或跳过机制。

### D-003C1 首个可玩版本的玩家途径数量

- `DECISION`: `A_THREE_FULL_PLAYER_PATHWAYS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户在细致 Grill-me 后回复 `a`。
- 首个完整可玩版本只把3条途径标记为玩家可进入、可长期成长的完整途径。
- 全部22条途径仍存在于世界、组织、NPC、敌人、遗物和事件中；其存在不等于对玩家开放。
- “完整支持”至少包含可信入门、序列能力、调查/社交/生存差异、扮演与消化、失控反馈、晋升资源、NPC反应、专属事件、存档和测试。
- 不允许把只有名称、数值加成或少量共用事件分支的途径计入3条完成额度。
- 底层领域模型、存档schema、AI合同和内容接口必须按未来可扩展到22条设计，不能把首发3条硬编码为永久上限。
- 本决定尚未锁定具体是哪3条、第一份魔药如何在它们之间出现、首版晋升上限、转途径规则和后续扩展顺序。

### D-003A1 捏人总体生成方式

- `DECISION`: `B_FULL_MANUAL_SELECTION`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `B`。
- 开局人物的身份、背景、属性和特质采用玩家手动点选，不使用生命经历自动生成作为权威来源。
- 系统仍必须校验互斥、点数预算和世界合理性，不能允许彼此矛盾或无代价的最优组合。
- 可以提供随机填充、推荐模板或重置按钮作为便利功能，但它们不能替代玩家最终确认。
- 本决定尚未锁定具体字段、点数制、属性数量、特质数量、背景互斥和随机功能。

### D-003A2 基础身份字段集合

- `DECISION`: `A_STANDARD_IDENTITY_FIELDS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 捏人基础身份包含：姓名、性别、年龄、国籍/地区、出生地、外貌或头像。
- 家庭、阶层、成长经历、普通职业、教育、属性、性格、关系、资源和秘密仍在后续独立设计，不塞入基础身份页。
- 本决定只锁定字段存在，不锁定各字段的可选值、玩法影响和输入控件。

### D-003A2A 性别字段的玩法影响

- `DECISION`: `A_SOCIAL_EFFECTS_NO_BASE_STAT_MODIFIERS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `A`，并补充部分序列之后会造成变性。
- 性别影响称谓、婚恋、NPC态度和符合时代背景的社会/职业阻力，但不直接修改力量、智力、健康等基础属性。
- 不设置基于性别的先天数值最优解；相关社会差异必须通过可解释的角色、组织与制度反应表现。
- 部分途径/序列造成的性别或身体变化保留为独立后续设计，不在捏人阶段提前锁定触发序列、可逆性、身份文件或关系反馈。

### D-003A2B 年龄范围与年龄影响

- `DECISION`: `A_18_TO_45_MODERATE_AGE_DIFFERENCES`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 标准新游戏的开局年龄范围为18—45岁，不提供未成年角色或更高年龄的标准捏人选项。
- 年龄产生适度而非纯表现性的差异：年轻角色倾向于更充足的体力与成长时间；年长角色倾向于更成熟的初始技能、人脉或资源。
- 年龄收益必须形成可比较的不同开局，不设置公认的绝对最优年龄，也不能让单一年龄同时占有成长与初始积累两端优势。
- 本决定尚未锁定逐岁公式、年龄分段、具体点数、自然衰老速度、游戏时间跨度、寿命与高序列影响；这些需要结合属性、经历和时间推进系统另行设计。

### D-003A2C 国籍、地区与出生地范围

- `DECISION`: `A_SINGLE_COUNTRY_MULTIPLE_DOMESTIC_BIRTHPLACES`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 首个可玩版本的标准捏人只开放一个国家/国籍范围，但允许玩家选择该国内不同地区作为出生地。
- 其他国家及其人物仍存在于世界中；“首版不可作为玩家出生国选择”不等于从世界设定中删除。
- 数据结构必须允许未来增加其他国籍和出生地，不能把首版单一国家写成永久硬编码上限。
- 本决定尚未锁定具体国家、地区清单、出生地粒度、开局城市、语言/方言、地域玩法影响、外来人口背景或后续扩展顺序。

### D-003A2C1 首版开放的具体国家

- `DECISION`: `A_LOEN_FIRST_OTHER_CANON_NATIONS_LATER`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `A`，并明确“其他国家后续更新”。
- 首个可玩版本的标准玩家国籍与出生地范围锁定为鲁恩王国。
- 因蒂斯、弗萨克、费内波特等其他原作国家保留为后续内容扩展方向；这不构成具体版本、顺序或日期承诺。
- 国籍、出生地、阶层、货币、称谓与法律等领域数据必须支持未来按国家扩展，不能把鲁恩规则冒充为全世界通用规则。
- 本决定尚未锁定鲁恩境内出生地清单、开局城市、开局日期、移民/混合国籍背景或其他国家的开放顺序。

### D-003A2D1 外貌信息填写方式

- `DECISION`: `A_STRUCTURED_APPEARANCE_FIELDS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户在补全互斥选项后回复 `a`。
- 玩家通过结构化选项定义角色外貌，而不是只选择整套模板或只提交一段自由文字。
- 结构化外貌至少围绕发色、瞳色、体型、五官与显著特征等类别设计，使存档、头像匹配和后续系统能够稳定读取。
- 本决定只锁定外貌数据的主要填写方式；不自动锁定头像来源、画风、AI生成、可上传图片、外貌数值效果、NPC辨认、伪装或通缉规则。
- 各类别的精确字段、可选值、互斥关系、时代/地域限制以及是否附加自由描述仍为 `PENDING`。

### D-003A2D2 默认头像产生方式

- `DECISION`: `A_TAGGED_PRESET_PORTRAIT_LIBRARY`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `A`。
- 默认头像来自一套策划和美术预先制作的整幅头像库；每张头像带有可检索的结构化外貌标签。
- 捏人界面依据玩家已选外貌字段筛选兼容头像，再由玩家从候选中确认；默认流程不依赖实时图像生成模型。
- 存档必须记录稳定的头像资源ID，确保离线加载和跨次打开时仍显示同一张头像。
- 进入项目的头像素材必须有可核验的来源与许可清单，不能从参考项目或网络图片中无条件搬用。
- 本决定尚未锁定具体画风、头像库规模、服装变化、年龄/伤疤/序列变化后的头像更新、玩家上传、自定义MOD、NPC头像方案或未来AI生成选项。

### D-003A3A 出身阶层的玩法影响强度

- `DECISION`: `A_STRONG_BUT_MUTABLE_CLASS_EFFECTS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `A`。
- 出身阶层对开局产生强烈、持续可感知的差异，至少涉及初始金钱、教育机会、职业门槛、人脉、社会态度及家庭义务。
- 出身阶层不是终身不可改变的身份锁；玩家可以在世界内经历阶层上升、维持或衰落，其关系和后果也必须随之更新。
- 高阶层不能只获得单向数值优势而没有义务、声誉压力或关系约束；低阶层也不能被设计成无法成长的惩罚难度。
- 本决定尚未锁定具体阶层清单、各阶层初始数值、改变阶层的渠道、家庭结构、成长经历、点数成本或开局国家。

### D-003A3B 家庭出身的组装方式

- `DECISION`: `A_LAYERED_MANUAL_ORIGIN_COMPOSITION`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `A`。
- 家庭出身不采用一键整套背景包，也不允许玩家直接从零点买所有结果；玩家依次手动选择社会阶层、家庭营生和当前家境。
- 三层选择共同生成初始资源、关系、机会与义务，并由系统校验时代背景、互斥条件及组合合理性。
- 三层必须保留各自独立的存档字段，后续事件可以分别改变阶层、家庭营生或家境，不能只保存成一段不可计算的背景文案。
- 本决定尚未锁定每层的具体选项、选择顺序、点数成本、家庭成员、成长事件或各组合的数值效果。

### D-003A3C 社会阶层的划分粒度

- `DECISION`: `A_FIVE_CLASS_TIERS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `A`。
- 首个可玩版本把玩家出身划分为五个主要社会阶层；家庭营生和当前家境负责表达同一阶层内部差异，不继续把每种职业拆成独立阶层。
- 五层结构需要让玩家清楚理解社会位置、通行门槛和典型压力，同时仍允许阶层升降和跨层关系。
- 存档应保存稳定的阶层层级标识与随国家变化的显示名称，避免未来增加国家时把鲁恩式称谓写死为通用世界规则。
- 本决定尚未锁定五层的正式名称、各层资源与义务、阶层升降阈值、特殊贵族规则或具体开局国家。

### D-003A3D 标准新游戏能否选择贵族出身

- `DECISION`: `A_NOBLE_ORIGIN_STANDARD_SELECTABLE`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 贵族出身属于标准新游戏可选项，不要求先通关或通过局外解锁。
- 贵族角色仍按已锁定规则从普通人开始，不能因家世自动获得魔药、序列能力或不受限制的神秘学知识。
- 财富、教育和关系优势必须对应家族义务、声誉压力、婚姻/继承约束或更高关注度，不能成为无代价的简单模式。
- 本决定尚未锁定角色本人是否持有爵位、可选爵位范围、继承顺位、领地、家族规模、点数成本或具体初始优势与压力。

### D-003A3E 五层社会阶层的划分依据

- `DECISION`: `A_COMPOSITE_SOCIAL_STATUS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 社会阶层由财富、家庭营生/职业、教育、社会承认和法律特权综合定义，不能由单一金钱数值直接替代。
- 系统必须能够表达富裕但尚未被上流社会接纳的商人，以及拥有头衔或家名但当前家境衰败的人物。
- “社会阶层”“当前家境”和“现金/资产”保持为不同字段：它们相关但不互相覆盖，事件可以分别改变。
- 本决定尚未锁定五层正式名称、综合判断阈值、阶层升降算法、各因素权重或贵族内部细分。

### D-003A3F 鲁恩五层阶层的正式分组

- `DECISION`: `A_SOCIAL_ECOLOGY_CLASS_GROUPS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 首版鲁恩捏人采用五层社会生态分组：贫民阶层、劳工阶层、小市民阶层、中上阶层、上流阶层。
- 贵族身份归入上流阶层的特殊身份/子类型，不额外增加第六层；上流阶层也可以容纳获得充分社会承认的非贵族精英。
- 存档使用稳定层级ID，中文分组名称用于鲁恩首版显示；未来其他国家可以替换本地化称谓而不改变通用层级结构。
- 本决定尚未锁定每层具体资源、职业白名单、点数成本、贵族子类型、阶层变化阈值或NPC反应强度。

### D-003A3G 家庭营生与社会阶层的组合约束

- `DECISION`: `A_SOFT_CONSTRAINTS_WITH_CONTEXT_AND_COST`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 家庭营生与社会阶层之间采用软约束：常见组合可直接选择，少见但世界内可成立的组合仍可选择。
- 少见组合必须生成或要求选择明确的背景解释，并附带相应代价、义务或当前家境变化，不能成为规避阶层成本的免费漏洞。
- 组合校验应区分“常见”“少见但成立”和“逻辑矛盾”，同时向玩家解释原因，不能静默改写玩家选择。
- 本决定尚未锁定具体家庭营生分类、少见组合清单、代价形式、解释模板、点数系统或绝对禁止项。

### D-003A3H 家庭营生的记录单位

- `DECISION`: `A_HOUSEHOLD_PRIMARY_PLUS_OPTIONAL_SECONDARY`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 捏人记录整个家庭的主要营生，并允许玩家再选择一项次要收入来源；不把单一父亲、母亲或监护人的职业冒充为全部家境。
- 主要营生承担家庭的核心经济与社会身份，次要收入用于表达副业、租金、兼职或小规模资产收益。
- 家庭成员后续仍可拥有各自职业、失业、退休或转业状态；这些个人状态不应覆盖家庭层面的营生记录。
- 本决定尚未锁定次要收入是否必选、营生分类、具体收入、关联NPC、家庭成员数量或多收入来源在事件中的权重。

## RAG_FEASIBILITY

- `CONCLUSION`: 可以改造复用 gmzz RAG，并可部署本地小模型辅助知识检索。
- 适合复用：切片/索引格式、别名与实体扩展、词法检索、知识/剧透权限预过滤、`RetrievalReceipt`、Electron utility worker IPC、知识包 manifest/hash/原子安装、检索与泄漏评估。
- 禁止复用：`D:\gmzz\private`、现有生成索引、授权 seed、用户数据及原作原文语料；新项目必须建立自己的合法语料与来源清单。
- 当前 gmzz 正式 Electron worker 调用 `JsHybridRetriever.searchSync()`，运行 trace 固定 `vectorCandidates=0` / `lexical-only`。
- `app/rag/vector-retriever.ts` 与 OpenAI-compatible `/embeddings` provider 已存在，`rag:ingest` 也能生成文档向量，但当前正式产品调用图没有实例化该 provider。
- 推荐新项目采用：确定性词法检索 + 本地 embedding 小模型向量召回 + 可选小型 reranker；叙事/世界裁决模型与检索模型分离。
- 小模型只负责把查询/切片编码或重排候选，不拥有世界状态提交权，也不能绕过玩家知识、剧透、来源和可见性过滤。
- 模型选择、运行框架、硬件预算、语料来源、是否完全离线仍为 `PENDING`；用户本次询问不视为已经授权下载或部署模型。
- `CURRENT_CORPUS_CHECK_2026-08-29`: 本机 `D:\gmzz\private\rag\sources.manifest.json` 当前只启用项目文档与一个实际为空壳的旧设定汇编；原著小说、API与社区Wiki来源均为 `enabled:false`，现有380个切片无法可靠回答工资、房租和非凡商品价格。可复用RAG技术结构，但当前索引内容不得冒充原著经济证据。

## PATHWAY_ROSTER_RESEARCH

- 原作官方百科确认地球范围常见22条神之途径，每条从序列9到序列0；官方资料同时明确占卜家/愚者是同一条途径的不同称呼。
- 官方故事导览明确克莱恩加入值夜者后选择占卜家途径，因此“占卜家首发会显著提高与原作主角路线重叠”是基于官方事实作出的产品设计推断。
- 首版三条途径的比较轴锁定为：低序列玩法差异、鲁恩可信入门渠道、普通职业/关系系统的联动、内容与测试成本、与原作中心人物和事件的重叠风险。
- 此前建议不让占卜家占用首版名额：它需要占卜、灵视、戏法、无面人、秘偶等持续扩张的专属系统，也最容易把旁线原创角色拉回克莱恩复刻；用户了解该代价后明确选择首发。
- 核对来源：`https://lomworld.com/handbook/en?categoryId=3`、`https://shop.lomworld.com/blogs/lomworld/lord-of-mysteries-beginning-explained`。

### D-003C1A1 占卜家进入首发名单

- `DECISION`: `B_SEER_IN_LAUNCH_ROSTER`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `b`。
- 占卜家占用首版3条完整玩家途径中的1个名额，并接受与原作主角路线重叠较高及专属系统成本较高的代价。
- 玩家仍从普通人开始；捏人阶段不直接选择占卜家或任何魔药，必须在世界内获得第一份魔药。
- 玩家的配方、材料、魔药和组织接触链必须服务于原创旁线，不复刻克莱恩的选择过程，也不继承其独有机缘或优势。
- 占卜家必须达到与另外两条首发途径相同的完整度和后续待定晋升上限，不能作为只有少量专属事件的名义首发途径。
- 本决定尚未锁定另外两条首发途径、占卜家具体获取渠道、晋升上限、与克莱恩互动频率或具体剧情。

### D-003C1A2 另外两条首发途径

- `DECISION`: `A_SPECTATOR_AND_HUNTER`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 首版3条完整玩家途径正式锁定为：占卜家、观众、猎人。
- 三条途径的首版差异轴为：占卜家的神秘调查与诡术、观众的人物观察与社会心理、猎人的追踪与直接冲突。
- 三条途径必须达到相同的产品完成标准和后续待定晋升上限；不能用共用数值模板冒充途径特色。
- 其他19条途径继续存在于世界、组织、NPC、敌人、遗物和事件中，但不计为首版玩家可长期成长途径。
- 本决定尚未锁定三条途径的第一份魔药渠道、配方与材料、晋升上限、转途径规则、能力细节或专属剧情。

## USER_PRIORITY_CORRECTION

- `CONFIRMED_BY_USER`: 2026-08-28，用户针对家庭营生选项结构等连续细分问题明确表示“这些都不重要”。
- 当前解释范围：家庭营生的领域层级、长列表/两级列表、具体分类、控件和点数微调后置；不撤销用户此前明确锁定的阶层、家庭营生和软约束方向。
- 后续捏人 Grill 必须优先问会显著改变开局体验和长期玩法的决定，不再连续追问实现层面的分类学。

## BASIC_GAMEPLAY_PRIORITY_CORRECTION

- `CONFIRMED_BY_USER`: 2026-08-28，用户明确指出“我们得先设计游戏的基本玩法才能继续设计”。
- `D-003C2` 第一份魔药机制立即暂停；此前提出的世界机会制、目标导向制、未知赌博制均未被用户选择，不得推定答案。
- 当前设计顺序改为：先锁定主交互骨架，再逐项确定行动内容、时间与行动经济、结果结算、世界/NPC推进、核心资源与失败反馈；达到可描述完整一轮玩法后才恢复魔药设计。
- 《汴京梦华》已确认的参考骨架是“有限行动后世界同时前进一步”；只能作为选项依据，不能未经用户确认直接移植每月2点行动或具体界面。

## CORE_GAMEPLAY_REFERENCE_DEEP_DIVE

- `READ_ONLY_VERIFIED`: 2026-08-28 再次下钻参考项目的 `index.html`、`js/actions.js`、`js/engine.js`、`js/events_core.js`、`js/ui.js` 与 `js/ui_court.js`。
- 参考项目以左侧人物/世界卷宗、右侧分类日志与底部主动行动按钮构成常驻面板；查看日志、名册和打开子面板不耗行动，真正改变状态的主动行为通常消耗行动点。
- 每月固定2个行动点；前置条件失败通常不扣点，行动点耗尽后自动月结，依次处理经济、产业、世界、家庭、军事、政治、属性、NPC与事件，再恢复行动点。
- 月结事件作为世界对玩家的“反应/打断”，其抉择不另扣主动行动点；日志按世界、派系、个人等类别提供世界反馈。
- 最值得适配的是“玩家做少量重要行动，世界同步前进一步”，不是宋代行动名、每月2点的具体数值或扁平按钮列表。
- 参考实现存在因果顺序缺陷：多数行动先调用 `spendAction()`，最后一点会在当前行动效果写入前立即执行月结。新项目必须采用“校验意图 → 完整结算当前行动 → 持久化 → 世界脉冲 → 展示反馈”的顺序。
- 参考项目月结可一次产生大量NPC日志；新项目必须优先呈现玩家相关变化、异常征兆和可行动线索，其余世界变化折叠为摘要。
- `READ_ONLY_RECHECKED`: 2026-08-29，用户要求再次检查日常按钮中的恢复方式。`index.html:186-198` 把苦读、交际、理事、上疏、家庭等作为常驻行动；`js/actions.js:10-44` 的苦读在提升经学时顺带恢复健康，`js/actions.js:296-311` 的理事则可能因过劳损失健康；`js/family.js:503-590` 的家庭行动按具体互动增减健康。
- 参考项目说明恢复应成为有生活含义的行动副效果，而不是独立的“回血页面”；但其苦读代码注释写基础恢复2—4，实际表达式却得到10—12，证明具体数字与散落的直接赋值不能照搬。
- `READ_ONLY_RECHECKED`: 2026-08-29，`js/assets.js:5-31,118-149` 将产业保存为各类型持有数量，并以“数量 × 类型固定月收益”直接结算；工作行动并未读取产业经营状态。新项目只能借鉴“产业是长期资产、按周期结算”的方向，不能照搬固定收益表。

## NUMERIC_SYSTEM_PRIORITY_CORRECTION

- `CONFIRMED_BY_USER`: 2026-08-28，用户要求先设计基础数值，并指出它是后续玩法决定的关键依赖。
- `D-CORE4` 普通职业的行动占位暂停；每周行动数、检定、行动收益与职业压力均等待基础数值模型达到可用边界后再继续。
- 参考项目将可成长能力 `learning/stewardship/intrigue`、外部社会评价 `prestige`、动态生命状态 `health` 和职业进度 `merit` 混放在 `attributes` 中；初始多为15/健康100，成长上限为200或300，并通过软上限与月度衰减抑制膨胀。
- 可借鉴：面板直接反馈、所有数值有合法边界、成长边际递减、状态变化可追溯。
- 不直接借鉴：把能力、资源、社会评价和进度混为同类；让普通重复行动永久增加宽泛基础能力；让不同含义的数值共享一套未经解释的刻度。
- 当前先锁定数值层次，再依次锁定基础属性集合、刻度与常人基线、动态资源、技能结构、检定公式、成长速度和非凡序列覆盖规则。
- `SCOPE_CORRECTION`: 用户随后明确要求“要简单设计，不要设计这么复杂”；上述四层方案没有被选择，不能视为锁定设计。
- 第一版改用参考项目式的少量常驻数值：只保留直接参与主要行动判断的核心能力与少量状态值；技能、身份、特质和序列能力优先使用标签或简短等级，不建立大量并列数值栏。
- 当前先决定核心能力数量与名称，再决定一套统一短刻度；不在第一版继续拆分复杂资源层和多套成长公式。
- `SOCIAL_STAT_CHALLENGE`: 用户追问“交际为什么会量化成数值”；此前4项方案未被选择，`交际` 不得被推定为基础属性。
- 原建议量化交际是为了给说服、欺骗、礼仪等场景提供统一修正，但它会把身份、关系、具体技能、性格与对方立场压缩成万能数值，并可能让观众途径形成单属性优势。
- 当前先单独确认是否彻底取消统一交际值；未确认前，不用“魅力”改名后偷偷保留同一机制。

### D-NUM1S1 取消统一交际数值

- `DECISION`: `A_NO_UNIFIED_SOCIAL_STAT`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 第一版不设置“交际”“魅力”或同义的统一基础数值。
- 社交结果由人物身份、双方关系、性格/缺陷、具体技能标签、已掌握信息、目标立场和当前情境共同判断。
- 观众途径提供的是明确能力与信息优势，不能转换成对所有人物、所有场景都有效的万能社交加值。
- 本决定尚未锁定具体社交技能标签、关系刻度、判定公式或其余核心能力。

### D-NUM1S2A 加入知识数值

- `DECISION`: `A_INCLUDE_NUMERIC_KNOWLEDGE`
- `CONFIRMED_BY_USER`: 2026-08-28，用户明确指出“知识要加入，这个是可以量化的”。
- `知识` 加入第一版可见核心数值，表达角色通过教育、阅读、研究与经历积累的总体知识水平，并参与学习、理解、研究和信息分析。
- 知识数值不能让玩家凭空知道未接触的配方、真名、仪式或秘密；具体敏感事实仍需存在明确的已获得知识记录。
- 社交继续不设统一数值；拥有相关知识可以在特定社交情境中提供信息优势，但不能替代关系、身份、技能与目标立场。
- 本决定尚未锁定知识刻度、增长速度、知识分类、检定公式或除知识之外的核心能力集合。

### D-NUM1S3 灵性必须进入基础数值

- `REQUIREMENT_FROM_USER`: 2026-08-29，用户指出当前候选仍有遗漏，并明确举出“灵性”。
- `READ_ONLY_RESEARCH`: 官方百科的途径能力资料明确出现灵性增强及能力消耗灵性；官方途径资料同时确认魔药、序列、扮演与失控风险是独立的成长/代价概念。
- `LOCKED_BOUNDARY`: 第一版必须有可计算的灵性，不得将其遗漏或用知识值替代。
- `DECISION`: `A_VISIBLE_CURRENT_MAX_FROM_ORDINARY_START`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 灵性采用“当前值/上限”的可恢复资源形式，从普通人阶段即显示并拥有较低基础上限；成为非凡者后由途径与序列提高上限与用途。
- 精神表示当前心理稳定，灵性表示施展神秘能力与仪式可调用的力量；两者耗尽的后果不同，不建议合并。
- 为保持简单，暂拟最小完整面板：核心能力若干（知识已锁定）＋健康/精神/灵性三项状态；成为非凡者后再显示序列与魔药消化度。金钱、关系、身份和具体知识记录存在，但不冒充核心能力。
- 第一版暂不增加独立体力、幸运、魅力或全局声望属性；污染和失控可先作为状态/风险结果，是否增加常驻数值后置。
- 核对来源：`https://lomworld.com/handbook/en?categoryId=62&overviewId=61&sequenceId=313`、`https://www.taptap.cn/app/281223?os=pc`。

### D-NUM1S2B 第一版完整常驻数值集合

- `DECISION`: `A_PHYSIQUE_PERCEPTION_WILL_KNOWLEDGE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 第一版4项核心能力正式锁定为：体魄、感知、意志、知识。
- 第一版3项当前状态正式锁定为：健康、精神、灵性；灵性使用当前值/上限，健康与精神的精确表现仍待刻度设计。
- 不增加统一交际/魅力、灵巧、幸运、全局声望或体力基础属性；相关差异由身份、关系、特质、技能标签、序列能力和具体情境表达。
- 序列与魔药消化度在成为非凡者后显示，属于成长进度，不计入4项核心能力或3项当前状态。
- 本决定尚未锁定数值刻度、普通人基线、成长速度、检定公式、状态阈值或序列提升幅度。

### D-NUM2 核心能力0—500刻度

- `DECISION`: `CUSTOM_ZERO_TO_FIVE_HUNDRED`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求“100太少了，500吧”。
- 体魄、感知、意志、知识统一采用0—500整数刻度；该数值表示能力强度，不直接等于成功率百分比。
- 第一版基础规则将500视为核心能力合法上限；超常效果仍可通过技能、序列能力、条件优势和结果规则表达，不要求所有力量差异都继续堆高裸属性。
- 本决定尚未锁定普通人平均值、开局波动范围、训练增长、序列加成、检定换算或是否存在临时突破上限。

### D-NUM2A 普通人10—20基准

- `DECISION`: `CUSTOM_ORDINARY_TEN_TO_TWENTY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确提出“10到20，有9个序列呢”。
- 普通人的单项核心能力通常落在10—20；具体平均值、天赋极端值和专家训练上限仍待后续细化。
- 该低基准的目的，是让0—500刻度为序列9至序列1的九次非凡层级变化保留清晰空间，而不是让普通人占据量表中段。
- 用户本句尚不能自动确定序列0是否也纳入500以内；该端点必须单独确认。
- 本决定尚未锁定各序列区间、线性或加速增长、各途径对四项能力的不同强化，以及普通训练能否超过20。

### D-NUM2B 序列1为500端点

- `DECISION`: `A_SEQUENCE_ONE_CAP_SEQUENCE_ZERO_OUTSIDE_SCALE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 0—500核心能力刻度覆盖普通人与序列9至序列1；500是序列1范围的数值极限锚点。
- 序列0属于真神层次，不继续作为普通属性刻度上的下一个数值档位；其权柄、神性和存在层级使用专门规则表达。
- 序列0仍存在于世界模型与原作边界中；本决定不等于确认玩家首版或长期版本一定能够晋升序列0。
- 本决定尚未锁定各序列区间、是否允许属性达到对应区间上沿、途径差异或首版实际开放到哪一序列。

### D-NUM2C 途径定向强化核心能力

- `DECISION`: `A_PATHWAY_DIRECTED_CORE_GROWTH`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每次序列晋升只提高与该途径、该序列能力变化相符的核心能力和状态上限，并同时获得具体非凡能力；不让体魄、感知、意志、知识自动整齐上涨。
- 占卜家、观众、猎人必须拥有不同的强化配置，同序列数字不等于四项裸属性完全相同。
- 序列层级提供强度边界和比较锚点，但专属能力、准备、情境克制与信息优势仍可决定结果，不能只比较总属性和。
- 本决定尚未锁定各途径具体强化项、每次增量、临时加成、状态上限或九个序列的区间。

### D-NUM2D 分段宏观边界与逐序列独立设计

- `DECISION`: `A_SEGMENTED_MACRO_ENVELOPE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`，同时强调原著中每个序列的成长曲线并不相同。
- 序列9至5整体属于较低强度区间，序列4进入半神层次后出现宏观质变，序列3至1继续扩大；这只作为全局安全边界，不是统一加成公式。
- `BESPOKE_RULE`: 占卜家、观众、猎人的每个序列都必须依据原著中该次魔药带来的具体身体、感知、精神、知识、灵性与能力变化单独设计，禁止套用“每升一级固定加X”的共用模板。
- 原著给出定性变化但没有精确游戏数值时，数值映射属于游戏改编，必须与原作事实分开记录，不能伪称原著明确数值。
- 每个可玩序列包至少记录：受影响的核心能力、健康/精神/灵性上限变化、专属能力、能力消耗、扮演与消化入口、失控/污染风险及检定影响。
- 本决定尚未锁定第一版做到哪一序列、任何具体序列的数值或转途径规则。

### D-003C3A 第一版晋升至序列7

- `DECISION`: `A_V1_THROUGH_SEQUENCE_SEVEN`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 第一版占卜家、观众、猎人均从序列9完整支持至序列7；连同普通人阶段，每条途径包含取得首瓶魔药与两次后续晋升。
- 第一版必须制作9个独立序列包：三条途径各自的序列9、序列8、序列7；每个包都遵守逐途径、逐序列考据与独立数值设计规则。
- 序列6及以上仍存在于世界、NPC、组织和原作规则中，但不计为第一版玩家可持续晋升内容。
- 本决定尚未锁定序列7之后的更新顺序、转途径、具体晋升难度、魔药材料、扮演进度或9个序列包的精确数值。

### D-NUM3 三项状态刻度

- `DECISION`: `A_HEALTH_MENTAL_100_SPIRITUALITY_500_SIGNED_CURRENT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`；同批 `Q1` 进一步确认资源允许进入负值透支。
- 健康与精神的常态上限为100，灵性的常态上限按当前人物为0—500；三项当前值都允许在明确来源作用下低于0，负值表示透支，不抬高上限。
- 0仍是归零触发线：来源声明的 `onZero` 按既有 `D-ZERO1..4` 规则处理；负值下限由来源绝对 `overdraftFloor` 字段声明，首次穿过0只触发一次，战斗读取负值按0处理（由 `D-RESOURCEOVERDRAFT1..3` 锁定）。
- 灵性使用当前值/上限，普通人也拥有较低灵性上限；途径、序列与特定能力可以定向提高其上限和消耗方式。
- 体魄与意志负责影响伤害承受、精神抵抗、恢复与检定，不通过把健康或精神上限无限抬高来重复表达同一能力。
- 本决定尚未锁定普通人开局值、恢复速度、受伤/精神阈值、灵性透支的具体来源字段、死亡或失控规则。

### D-NUM3A 普通人开局模板

- `DECISION`: `A_BASE_FIFTEEN_DERIVED_TEN_TO_TWENTY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 体魄、感知、意志、知识的普通人开局统一基准为15，再由出身、职业、年龄、特质与缺陷确定性修正，正常结果限制在10—20。
- 无伤病或特殊精神缺陷时，健康与精神以100开局；已选缺陷或明确背景后果可以改变当前值或相关恢复规则，但不能被随机暗改。
- 普通人灵性默认15/15，并由同一捏人输入在10—20上限范围内确定性修正；开局当前灵性默认充满。
- 本决定尚未锁定普通人训练上限、每次成长幅度、检定公式、伤病具体修正或序列9的提升值。

### D-NUM4 普通人软上限20、极少数可到25

- `DECISION`: `A_ORDINARY_SOFT_CAP_20_EXCEPTIONAL_25`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 普通训练通常只能把单项核心能力提高到20；20是普通人的软上限，不是所有人物都能自然练满的常态值。
- 只有具备明确相关天赋并经历长期专业训练的极少数普通人，才可把对应能力提高到21—25；普通手段不能超过25。
- 非凡途径、封印物、仪式或其他超自然效果不受普通人上限约束，但必须按各自规则结算，不能伪装成普通训练。
- 达到原始能力上限后，角色仍可通过技能、专精、工具、情报与准备继续成长，避免所有进步都挤进四项裸能力。
- 本决定尚未锁定训练速度、突破条件、能力衰退、临时增减或检定公式。

### D-NUM5 公开的差值概率检定

- `DECISION`: `A_VISIBLE_DIFFERENCE_BASED_PROBABILITY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 对确有不确定性且后果重要的行动，系统以“有效能力”对比“行动难度”，把差值换算成成功率并随机判定；普通可评估情境向玩家显示成功率。
- 有效能力由一项适用核心能力，加上具体技能、工具、准备、情报、状态与情境修正组成；不得重新引入统一“交际”属性。
- 无风险的日常事项可以直接成功，客观不可能的行为不得靠最低概率碰运气；只有可争取但不确定的行动进入检定。
- `REFERENCE_FINDING`: 《汴京梦华》同时存在固定概率、属性加随机区间、属性总和门槛等分散写法；新项目只借鉴随机风险感，必须使用一套集中、可测试的基础检定规则。
- 本决定尚未锁定每点差值对应多少概率、概率上下限、是否显示精确值或估计范围、暴击/大失败、对抗检定及位阶压制。

### D-NUM5A 每点差值改变2个百分点

- `DECISION`: `A_TWO_PERCENTAGE_POINTS_PER_DIFFERENCE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 未处理概率上下限前，基础公式为：`原始成功率 = 50% + 2% ×（有效能力－行动难度）`；能力与难度使用同一0—500刻度。
- 有效能力等于适用核心能力加已生效的技能、工具、准备、情报、状态和情境修正；所有修正先合并，再与难度比较。
- 能力与难度相等时成功率为50%；高5点为60%，高10点为70%，低5点为40%，低10点为30%。
- 该幅度让普通人10—20的差异可感知，又避免单个属性点造成过大的概率跳变；序列差距很大时是否直接成功、禁止检定或受概率上限约束仍待后续决定。
- 本决定尚未锁定概率上下限、难度标尺、技能/情境修正幅度、精确显示方式或特殊结果。

### D-NUM5B 可检定行动采用5%—95%上下限

- `DECISION`: `A_FIVE_TO_NINETY_FIVE_CONTESTABLE_CAP`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 只有通过行动可行性与权限校验、确实进入概率检定的行动，才将原始成功率限制为最低5%、最高95%。
- 最终基础成功率公式为：`clamp(5%, 95%, 50% + 2% ×（有效能力－行动难度）)`。
- 日常确定事项应直接成功；客观不可能、超自然免疫、权柄阻断或角色完全不具备前置条件的行动应禁止检定，不能利用5%下限强行成功。
- 当优势已大到不再构成真实悬念时，系统也可在检定前判为自动成功，而不是强迫玩家承受5%失败。
- 本决定尚未锁定基础结果档位、暴击/大失败、对抗检定、隐蔽因素显示或随机种子规则。

### D-NUM5C 四档通用检定结果

- `DECISION`: `C_FOUR_OUTCOME_TIERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `c`。
- 所有进入基础概率检定的行动统一归类为：大成功、成功、失败、大失败四档，而不是只使用二元成败。
- `USER_CORRECTION`: 2026-08-29，用户明确否定“大成功必然是额外收益、大失败必然是额外代价”。四档首先描述行动解决过程的极端程度与戏剧性，不等同于玩家长期处境的正负价值判断。
- 极端成功可能同时打开危险后果，极端失败也可能意外避开更深层风险；具体边界必须先依据《诡秘之主》的知识危险、污染、失控、命运、位阶和神秘学规则完成背景审计，不能继续套用传统数值游戏模板。
- 具体事件仍可依据内容定制四档后果，但不得把同一次检定同时解释成互相冲突的结果层级。
- 该选择会增加事件内容与测试量，作为用户明确选择的戏剧性成本保留；第一版不因此自动扩张核心能力数量。
- 本决定已锁定四档存在；其价值语义、默认效果、能否通过资源改判、重掷或事件缺省处理仍未锁定。大成功/大失败阈值由后续 `D-NUM5D` 锁定。

### D-NUM5D 固定极端骰面

- `DECISION`: `A_FIXED_EXTREME_D100_FACES`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每次基础检定生成1—100的整数：1—5为大成功，96—100为大失败；6—95再与最终成功率比较，落在成功率以内为普通成功，否则为普通失败。
- 因最终成功率已限制在5%—95%，极端骰面与成败不会冲突：5%成功率下仅有大成功能成功，95%成功率下仅有大失败会失败。
- 大成功与大失败各占所有实际检定的固定5%，不会因能力提高而扩大或缩小；能力、技能和准备改变的是中间普通成功/失败区间。
- 本决定尚未锁定四档默认效果、随机种子、重掷/改判、隐藏掷骰或多人对抗规则。

### D-NUM5E 双轴单检定与因果后果

- `DECISION`: `A_DUAL_AXIS_SINGLE_CHECK_CAUSAL_CONSEQUENCES`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 一次基础检定只掷一次d100；骰子只确定行动的解决质量 `resolutionTier`：大成功、成功、失败或大失败。
- 实际后果不由结果档位直接翻译成“收益/代价”，而是以 `consequences[]` 独立结算；其来源包括行动意图、目标、世界真实状态、神秘学联系、位阶/权柄、物品副作用、隐藏状态和既有条件。
- 同一次行动允许出现混合后果，例如行动完成但暴露、行动失败却避开更深污染；系统不把这些后果压成单一“净好/净坏”分数。
- 不为制造混乱而追加一个通用“危险骰”；只有因果上确属后续阶段的事件，才可触发另一次目标明确的独立检定。
- 普通行动应保持可理解的稳定因果；神秘学反转必须有世界内来源，并能在后续通过线索、知识或复盘追溯，不能用随机猎奇替代克苏鲁式未知。
- 本决定尚未锁定 `consequences[]` 的字段、玩家可见层、污染模型、事件模板、资源改判或重掷规则。

### D-NUM5F 普通判定的数值修正如何合并

- `DECISION`: `LOCKED=A_ADD_SIGNED_INTEGER_MODIFIERS_NO_GLOBAL_MULTIPLIERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择按推荐方案处理。
- 统一普通判定中的已声明数值修正全部按有符号整数直接相加，再与难度比较；不在通用公式中引入百分比乘区、阶段倍率或来源类别择优。
- 掌握度仍不提供通用百分比或有效能力值加成；能力专属的非数值控制、风险、消耗、持续或高级用法按能力数据独立处理。
- 该决定只锁定普通判定的公共算术，不填写具体事件的修正值、难度或能力效果。

### D-NUM5G 普通判定的后果最小数据结构

- `DECISION`: `LOCKED=A_ORDERED_EXPLICIT_CONSEQUENCE_ITEMS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求按推荐方案处理，并强调不要复杂化。
- 普通判定返回一个有序的 `consequences[]`；每项只保留可复现所需的最小信息：目标、变更类型、可选数值/标识、适用条件和来源说明。
- 事件数据决定这些后果是否改变状态、知识、线索或事件；引擎按顺序应用，不另建公共效果事务，也不让 AI 临时解释并写入状态。
- 具体事件文本、数值、玩家可见层级和后果模板留给内容设计；缺少必要字段的后果项必须校验失败。

### D-NUM6 可见0—100污染主值

- `DECISION`: `B_VISIBLE_POLLUTION_0_TO_100`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `Q3B`，并说明具体设计之后再做。
- 污染是独立于精神状态的单一主数值，范围0—100，玩家面板始终可见；不再把“部分隐藏阶段”作为第一版呈现方式。
- 后台仍可保存污染来源、性质、施加事件和追溯信息，供因果结算与事件内容使用；这些元数据不改变玩家始终可见的主值。
- 污染可以损伤精神、健康或灵性并改变行动后果，但“精神下降”只是可能后果之一，不等于污染本身。
- 污染以阈值触发来源明确的事件、症状和后果为主，不把每1点污染自动换算为全局判定、战斗或行动力修正；公共阈值带固定为0—24、25—49、50—74、75—100，事件只在进入新带时检查（`D-POLLUTIONEFFECT1..3`）。

### D-CORE1 第一版主交互骨架

- `DECISION`: `A_PANEL_LIFE_SIMULATION`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`，并要求仔细参考给定项目。
- 第一版以面板式人生模拟为主，不制作可自由行走的地图角色控制层。
- 玩家通过人物、地点、关系、线索、行动和世界反馈等面板理解状态并提交行动；关键调查可由多阶段事件、目标选择和抉择表现。
- 采用《汴京梦华》低操作负担、个人行动与世界演化并行的体验原则，但界面视觉、行动内容、数据模型与结算代码全部重做。
- 本决定尚未锁定行动点模式、时间单位、每轮行动数、事件抉择是否耗时、战斗方式或具体面板布局。

### D-CORE2 动态行动束与世界脉冲

- `DECISION`: `C_DYNAMIC_MAJOR_ACTION_BUNDLE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户在 `Q4` 选择 `c`，并补充有些序列能力（例如秘偶）可以提高行动力；该结果取代此前“固定数量”表述。
- 每个世界周期先根据基础行动力和明确修正计算本周主动行动机会；修正来源可以包括职业、状态、生活档位、序列能力、秘偶和其他已生效效果，角色之间的可用次数可以不同。
- 玩家完成本周可用的重要行动后，世界统一推进一次，而不是每次点击或查看信息都推动时间。
- 每个被接受的主动行动必须先完成条件校验、目标选择、结果结算与持久化；最后一个行动完整提交之后，才允许执行世界脉冲。
- 查看人物、关系、地点、线索、日志、行囊和帮助信息不消耗主动行动；哪些互动属于免费反应仍需后续逐项锁定。
- 动态行动力以每周基准3次开始，再由职业、状态、生活档位、序列能力、秘偶和其他明确效果按整数规则修正；所有来源相加，最低1次，未用不结转，额外行动仅限当周（`D-ACTIONBUDGET2..3`）。普通工作占用行动的边界由 `D-CORE4` 锁定。

### D-CORE3 按周推进世界

- `DECISION`: `A_WEEKLY_WORLD_PULSE`
- `CONFIRMED_BY_USER`: 2026-08-28，用户明确补充“按周推而不是按月”。
- 世界脉冲的基础周期为一周；动态主动行动束完成后进入下一周，并结算NPC议程、关系变化、经济义务、事件推进与可见世界反馈。
- 月、季、年仍可作为工资账期、房租、重大仪式、组织计划和时代事件的聚合节点，但不替代每周基础回合。
- 本决定尚未锁定每周具体行动数、周内日期细分、跨周行动、月末额外结算或时间暂停规则。

### D-CORE4 工作占用一个主要行动

- `DECISION`: `A_WORK_CONSUMES_ONE_MAJOR_ACTION`
- `CONFIRMED_BY_USER`: 2026-08-29，`Q5` 选择 `a`。
- 工作每次占用本周动态行动束中的1次主要行动；点击工作后进入职业与产业收入结算，不另设独立工作时段。
- 工作收入仍遵守 `D-WORK1..3` 与产业规则；同一来源每周不能因重复点击工作重复领取。
- 加班、临时委托、事故和经营机会只能由具体工作事件另行产生，不改变“工作占用1次主要行动”的底层边界。

### D-COMBAT1 双阶段大转盘对抗

- `DECISION`: `DUAL_STAGE_ROULETTE_CONTEST`
- `CONFIRMED_BY_USER`: 2026-08-29，用户主动提出大转盘战斗结构。
- 触发战斗后，玩家与敌人各自建立一个能力转盘；双方遵循同一基础流程，而非只让玩家随机、敌人固定出招。
- 转盘收纳当前可在战斗中生效的技能、封印物、道具与装备。能力和技能自身数值决定基础占比；每个命中的技能项目提供一定的胜率贡献，并可触发自己的特殊效果。
- 转盘保留小概率“未知情况”区；未知结果的来源边界（仅明确因果来源、固定小比例底噪或混合方案）由 `D-COMBAT4D` 最终锁定，不能在该批次收口前擅自选定。
- 每轮先确定双方各自转动次数；双方完成能力转盘后，汇总命中项目带来的胜率贡献和特殊效果，再据此生成战斗结果转盘的分布。
- 这是两个职责不同的转盘：能力转盘决定本轮调用了什么，战斗结果转盘依据双方结算后的胜率与状态决定结果；不得直接把基础属性换算成自动胜负。
- 本决定的本轮生成时机已由 `D-COMBAT1D` 锁定为双方能力盘全部转完后；基础战势字段、负权重与双方均为0的处理、概率上下限、权柄/免疫的先行判定或各部分数值量级仍以对应条目为准。

### D-COMBAT1A 战斗结果转盘只判定胜负

- `DECISION`: `A_WIN_LOSS_ONLY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确纠正“结果只判定胜负，不判定生死”。
- 战斗结果转盘只有对抗双方的“胜利/失败”分区；团队战按阵营判定，不能把死亡、存活、重伤、逃脱、俘虏或失控直接写进这一转盘。
- 胜负只确认谁取得本次战斗控制权，不自动等于杀死对方，也不自动抹除败者继续存活、逃走、被救或付出其他代价的可能。
- 伤势、生死、逃脱、俘虏、污染与战利品属于胜负之后的因果后果层，必须另行结算。

### D-COMBAT1B 因果化动态后果转盘

- `DECISION`: `A_CONTEXTUAL_CAUSAL_CONSEQUENCE_WHEEL`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 胜负确定后，系统根据胜者意图、命中的决定性技能、双方当前健康/精神/灵性、位阶与权柄、战场环境、逃生路线、外部救援、污染和封印物副作用，生成本次战斗专属的后果候选与占比。
- 后果转盘只能放入当前因果条件下确实可能发生的结果；死亡、逃脱、俘虏或被救均不作为每场必备的通用格子。
- 若世界状态已经唯一确定后果，则直接结算，不为追求随机感强行转盘；只有两个及以上合理后果仍不确定时才显示并转动动态后果盘。
- 后果盘不得推翻已经判定的胜负，但可以决定胜负之后的伤势、控制程度、撤离、救援、战利品、暴露、污染或其他连锁后果。
- 本决定尚未锁定后果盘对玩家公开多少权重、复合后果如何显示、胜者意图的输入方式以及死亡的最低触发条件。

### D-COMBAT1C 战斗失败后的重战入口

- `DECISION`: `LOCKED=A_NEW_EVENT_REQUIRED_TO_REENGAGE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求第四批全部按照推荐方案。
- 战斗失败只结束当前遭遇，不在同一行动内自动重开；再次交战必须由新的事件或满足新的明确条件重新建立。
- 该规则不禁止后续追击、复仇或重新调查，但每次新交战都必须有新的因果入口与新的战斗记录，不能通过循环按钮刷战斗。

### D-COMBAT1D 战斗胜负转盘的结算时机

- `DECISION`: `LOCKED=A_EACH_ROUND_AFTER_BOTH_ABILITY_WHEELS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确补充“双方次数轮完了才进入胜负盘”。
- 每轮先分别确定双方出招次数；双方再按各自次数把本轮能力盘全部转完。只有双方本轮能力盘都完成后，才生成并转动本轮胜负盘。
- 本决定不把胜负盘推迟到整场战斗结束，也不改变胜负后的因果后果层。

### D-COMBAT1E 后果转盘向玩家公开到什么程度

- `DECISION`: `DEFERRED_V1_MVP_SCOPE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择第一版最小战斗范围 `A`。
- 第一版不制作后果转盘的独立公开层级；后果仍按已锁定的因果规则结算，结算页直接展示最终结果。
- 候选后果公开、概率展示和秘密原因的分层规则留到后续版本重新 Grill。

### D-COMBAT2 动态出招次数盘

- `DECISION`: `A_CHARACTER_DERIVED_NONUNIFORM_ACTION_COUNT_WHEEL`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`，随后连续修正：不是固定1—3次，4—7也可出现；概率不相同；转盘分布应按照玩家能力生成。
- 每轮开始时，双方分别生成并转动自己的出招次数盘；双方所得次数可以不同，随后各自按该次数转动能力转盘。
- 系统不预设通用于所有角色的1—3或1—7范围，也不把7视作首版硬/软上限；某个角色当前能出现哪些次数及其各自权重，由该角色的能力与身上效果生成。4、5、6、7只是用户举出的可出现例子，不是固定边界。
- 次数盘采用非均匀分布：每个次数拥有独立权重，绝不能把当前可出现的次数平均分块；在没有相应能力或效果支撑时，高次数应比低次数更稀有。
- 次数仍由转盘抽取，而不是由某项数值直接给出固定答案；同一角色在状态不变时也可能抽到不同次数。
- 每个提高高次数概率的来源必须可追溯，界面应说明主要修正来源，避免用隐藏加权制造无依据的结果。
- 本决定尚未锁定能力与效果的换算规则、是否存在技术安全边界、减至0次的控制效果或多人战的次数盘结构。

### D-COMBAT2B 专属来源权重组合

- `DECISION`: `A_BESPOKE_SOURCE_WEIGHT_COMPOSITION`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复“对”，确认推荐方案。
- 每项会影响出招次数的序列能力、普通技能、装备、封印物和状态，都拥有自己的候选次数与权重修改规则；系统组合这些来源生成当前次数盘。
- 不先压缩成统一“战斗力”，也不让四项核心能力套用一条通用公式；不同途径、不同序列和不同效果可以使用完全不同的成长曲线与权重结构。
- 每个权重来源必须保留身份与解释，以便界面展示主要影响、存档复现和数值测试。
- 多个来源先按次数逐项相加、再统一归一化的顺序已由 `D-COMBAT2C` 锁定；各来源的具体权重、冲突内容、保底权重和减至0次的控制效果仍需后续内容题声明。

### D-COMBAT2C 次数盘多个来源的组合与归一化

- `DECISION`: `LOCKED=A_ADD_ALL_SOURCE_WEIGHTS_THEN_NORMALIZE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q1A`。
- 序列能力、秘偶、状态、职业及其他已声明来源先分别提供次数权重，再按次数逐项相加，最后统一归一化为本角色本轮的次数盘分布。
- 来源身份与贡献保留在盘面说明和可复现日志中；本决定不填写任何具体角色的权重数值，也不改变各来源自身的成长曲线。

### D-COMBAT2D 次数盘是否允许0次及最低行动保底

- `DECISION`: `LOCKED=A_DEFAULT_MINIMUM_ONE_NO_ZERO_NORMAL`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q2A`。
- 正常可行动角色的次数盘最低值为1，不设置无理由的0次扇区；每次进入战斗回合都至少获得一次能力转动机会。
- 昏迷、封锁、退出战斗或其他明确的失能条件不伪装成普通0次结果，而是在次数盘前按独立条件处理；失能规则必须由来源声明。
- 后续若需要让特殊能力直接产生0次权重，必须重新开启本决定或登记更高优先级的例外，不得由内容静默绕过最低值。

### D-COMBAT3 实时面板自适应能力转盘

- `DECISION`: `A_REAL_TIME_PANEL_ADAPTIVE_WHEEL`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求“战斗回合的能力转盘也是根据玩家实时面板适配的”。
- 玩家与敌人的能力转盘均从各自当前实时面板生成，不使用角色创建时快照、固定职业模板或对所有角色相同的静态技能盘。
- 当前可用的序列能力、普通技能、装备与携带道具、封印物、健康/精神/灵性、伤势、污染、增益、减益、资源限制和战场条件，都可以改变项目是否进入转盘、项目占比、胜率贡献或特殊效果。
- 敌方也必须依据自己的真实面板生成转盘；玩家能看到多少敌方项目与权重，仍受角色知识、观察和神秘学遮蔽限制。
- 同一回合常规转动不在每次转动前重算，已由 `D-COMBAT3A` 锁定；不可用项目的临时失效处理已由 `D-COMBAT3D` 锁定，子转盘例外、可触及边界和快照审计展示仍后置。

### D-COMBAT3A 回合开始快照

- `DECISION`: `B_ROUND_START_SNAPSHOT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 每回合在第一次能力转动前读取双方实时面板，各自生成一次能力转盘快照；该回合剩余的常规能力转动全部使用这一快照。
- 回合中产生的资源消耗、伤势、增益、减益、污染和装备状态仍立即写入真实面板，但不重排本回合剩余常规转动的格子与占比；下一回合开始时统一反映。
- 该规则避免同一回合内转盘不断跳动，也使玩家能够理解本回合已经展示的概率分布。
- 快照项目临时失效时保留原扇区并执行预声明无效/替代结果，已由 `D-COMBAT3D` 锁定；明确技能触发的子转盘/追加转动例外、一回合结束的精确定义仍后置。

### D-COMBAT3B 重复命中与项目专属规则

- `DECISION`: `A_REPEAT_ALLOWED_PER_ENTRY_POLICY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 同一回合的多次能力转动可以重复命中同一技能、封印物、道具或装备效果；回合快照不会因为首次命中就自动移除该项目。
- 每个项目独立声明重复命中规则，包括胜率贡献能否重复、特殊效果是叠加、刷新、每回合仅触发一次、消耗充能还是产生额外代价。
- 若项目的特殊效果不可重复，后续再次命中时的处理也必须写在该项目规则中，不能依赖一个隐藏的全局默认答案。
- 本决定尚未锁定项目规则字段、重复命中的界面提示、一次性物品在快照内耗尽后的处理或叠加数值上限。

### D-COMBAT3C 自动收录当前可用且可触及的项目

- `DECISION`: `A_ALL_CURRENTLY_USABLE_ACCESSIBLE_AUTO_INCLUDED`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 回合快照自动收录角色当前可用的全部技能与能力，以及当前携带、装备或能够立即取用的道具、装备和封印物；玩家不在战斗开始时删技能或手工组牌。
- 存放在别处、未携带、已遗失、被封锁或客观无法触及的物品不进入本回合能力转盘。
- 玩家通过平时训练、携带选择、装备、封印物管理和战前准备间接塑造转盘，而不是直接拖动格子或填写概率。
- 本决定尚未锁定被动能力是否显示独立格子、远程操控物的“可触及”边界、临时借用品或队友共享物品的收录规则。

### D-COMBAT3D 回合快照中的项目临时失效

- `DECISION`: `LOCKED=A_KEEP_SECTOR_PREDECLARED_NOOP_OR_REPLACEMENT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q2A`。
- 回合开始快照后，项目因资源、距离或状态临时不可用时，原扇区和本回合概率保持不变；命中该扇区时执行项目预先声明的无效结果或替代结果。
- 不按实时面板重排剩余概率，也不把临时失效自动视为一次未声明的失败；替代结果必须在内容数据中可校验。

### D-COMBAT3E 快照内一次性物品耗尽后的处理

- `DECISION`: `DEFERRED_V1_MVP_SCOPE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择第一版最小战斗范围 `A`。
- 第一版不制作一次性物品的独立重排/消耗分支；若纳入快照，先沿用 `D-COMBAT3D` 的原扇区预声明无效/替代结果。
- 物品耗尽后的专属动画、重排、充能和共享物品规则留到后续版本重新 Grill。

### D-COMBAT4 基础权重、掌握程度与当前修正共同决定占比

- `DECISION`: `BASE_WEIGHT_PLUS_MASTERY_AND_CURRENT_MODIFIERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户补充“可以按照权重和掌握程度分配比例”。
- 每个入盘项目具有内容定义的基础权重；角色对该技能/能力的掌握程度，以及回合快照中的状态、装备、环境与其他明确效果，共同形成该项目的有效权重。
- 所有有效权重完成规则结算后再归一化为能力转盘的可视占比；占比不是技能数量的平均分配，也不能由玩家直接填写。
- 不同序列能力可以拥有不同的掌握—权重曲线，封印物与道具也可以使用专属的熟悉度、控制度、充能或风险规则，不能强套一条统一成长公式。
- 掌握度尺度、基础权重与当前效果的组合顺序已由 `D-COMBAT4A`、`D-COMBAT4C` 锁定；文字档位、最小可见扇区、权重为0的显示方式、小数精度与回放日志展示仍后置。

### D-COMBAT4A 0—500连续掌握度与文字档位

- `DECISION`: `A_0_TO_500_CONTINUOUS_WITH_LABELS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每项技能与可训练能力独立记录0—500的整数掌握度；文字档位由数值派生，用于快速阅读，但不替代底层连续数值。
- 掌握度不等于体魄、感知、意志、知识等核心能力，也不等于非凡序列位阶；它描述角色对具体能力的运用熟练程度。
- 同样的掌握度在不同技能上可以映射为不同的转盘权重、胜率贡献或特殊效果强度，以保留不同途径和序列的专属成长曲线。
- 本决定尚未锁定文字档位数量与阈值、掌握度提升方式、普通人/各序列训练上限、退化规则，以及封印物熟悉度是否复用同一尺度。

### D-COMBAT4B 双方转盘完全公开

- `DECISION`: `B_FULL_EXACT_DISCLOSURE_BOTH_SIDES`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 玩家与敌方的能力转盘都显示完整项目、精确百分比和主要权重来源，包括基础权重、掌握程度及当前效果造成的修正。
- 该公开属于战斗系统的玩家层信息，不自动写入角色的世界内知识、调查结论或RAG可用事实；角色不能仅凭玩家看见机械标签就获得原本未知的神秘学知识。
- “未知情况”扇区显示精确出现概率，但命中前仍以未知标签呈现，不提前揭示会发生的具体事件。
- 本决定尚未锁定小数精度、权重来源展开层级、转盘拥挤时的聚合方式或回放日志展示。

### D-COMBAT4C 能力盘多个来源权重叠加与归一化

- `DECISION`: `LOCKED=A_BASE_TIMES_MASTERY_CURVE_PLUS_CURRENT_EFFECTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q4A`。
- 每个能力项目先用基础权重乘该项目自己的掌握度曲线，再叠加当前状态、装备、环境或其他明确效果修正，最后统一归一化为能力盘占比。
- 具体掌握度曲线和效果数值仍由能力数据逐项设计；本决定只锁定合并顺序，不建立跨能力通用成功率加成。

### D-COMBAT4D 能力盘未知情况区的概率来源

- `DECISION`: `LOCKED=A_PLUS_B_HYBRID_UNKNOWN_WEIGHT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q5M`。
- 每场战斗的能力盘都保留一个固定的小比例未知区底噪；若战场、污染、封印物副作用或其他明确因果来源提供额外权重，则在底噪之上叠加，最后统一归一化。
- 本决定只锁定“固定底噪＋因果来源追加”的结构；固定底噪具体数值、各来源追加量和未知结果内容仍由后续数据题声明，并必须进入可复现日志。

### D-COMBAT5 基础战势加技能胜势后相对归一化

- `DECISION`: `A_PLUS_C_PANEL_BASE_AND_RELATIVE_NORMALIZATION`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复“c，还有也要a”，明确要求组合A与C。
- 每回合双方先从各自实时面板与当前对抗关系获得基础战势权重；这不是固定50/50起点。
- 本轮能力转盘每次命中的项目再增加己方胜势、削减对方胜势或执行自己的特殊效果，形成双方最终有效胜势。
- 最终胜负盘按相对权重归一化：`己方胜率 = 己方有效胜势 /（己方有效胜势 + 对方有效胜势）`；敌方同理，两块合计100%。
- 该结构允许强者带着基础优势进入战斗，也允许连续命中、克制、封印物或特殊效果扭转胜负盘。
- 本决定尚未锁定基础战势包含哪些字段、负权重与双方均为0的处理、概率上下限、权柄/免疫的先行判定或各部分数值量级。

### D-COMBAT5A 简化基础战势输入

- `DECISION`: `SIMPLIFIED_SEQUENCE_CORE_STATUS_INITIATIVE_ONLY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求“不用太复杂，就序列/位格、核心能力、状态、先手就行了”。
- 基础战势只读取四类输入：序列/位格、体魄/感知/意志/知识四项核心能力、当前状态、先手情况。
- 当前状态包括健康、精神、灵性、伤势、污染以及已生效的增益/减益；同一具体状态不得同时在基础战势与技能胜势中重复计入，除非内容规则明确声明两个不同作用。
- 技能掌握度、装备、封印物和道具不进入基础战势，它们只通过能力转盘、技能胜势和特殊效果发挥作用。
- 地形、关系、社会身份和其他情境不进入通用基础战势公式；它们仍可作为技能可用条件、特殊效果或后果因果来源。
- 本决定尚未锁定四类输入的主次、四项核心能力如何聚合、状态修正尺度或先手价值。

### D-COMBAT5B 序列主导的基础战势层级

- `DECISION`: `A_SEQUENCE_TIER_CORE_WITHIN_TIER_STATUS_INITIATIVE_TEMPORARY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列/位格决定基础战势档位与主要量级，是基础战势的主导因素。
- 体魄、感知、意志、知识四项核心能力用于区分同档或相邻档位内的强弱，通常不能单靠数值跨越明显的位阶差距。
- 当前状态和先手只提供本场或本回合的临时修正，不永久改变角色的基础档位。
- 权柄压制、免疫和能力成立条件应先于通用战势权重结算，不能被普通数值平均掉。
- 本决定尚未锁定各序列档位的具体数值、相邻档位倍率、四项核心能力聚合方式，以及状态与先手的修正量级。

### D-COMBAT5C 途径专属核心能力权重

- `DECISION`: `B_PATHWAY_SPECIFIC_CORE_WEIGHTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 档内核心战势由体魄、感知、意志、知识加权求和，不采用四项简单平均，也不只取最高两项。
- 不同途径拥有不同的核心能力权重结构，以表现其战斗方式和优势领域；四项权重合计100%。
- 该加权值只参与基础档内战势；具体技能、掌握度、装备、封印物和道具仍通过能力转盘结算，避免重复计算。
- 本决定尚未锁定普通人的权重、权重是否随序列变化，以及三条首发途径的具体比例。

### D-COMBAT5D 普通人核心能力等权

- `DECISION`: `A_EQUAL_25_PERCENT_EACH`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 尚未进入任何途径的普通人，体魄、感知、意志、知识各占档内核心战势的25%。
- 普通人的职业、训练和个人专长不改变这组基础权重；它们通过实际属性、技能掌握度与能力转盘表现，避免再增加职业权重表。
- 角色进入途径后，改用对应途径的专属核心能力权重。
- 本决定尚未锁定途径权重是否随序列变化，以及三条首发途径的具体比例。

### D-COMBAT5E 每个序列独立设计核心能力权重

- `DECISION`: `B_EACH_SEQUENCE_INDEPENDENT_WEIGHTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 每条途径的每个序列都单独定义体魄、感知、意志、知识四项核心能力权重，四项合计100%。
- 不使用“整条途径固定一套权重”，也不以途径基础权重加统一幅度自动推导；每个序列都可依据其原著定位与实际能力结构形成不同侧重。
- 原始核心能力成长曲线与此处的战势聚合权重仍是两个概念：前者决定角色拥有多少数值，后者决定这些数值在该序列的基础战势中如何发挥。
- 本决定尚未锁定同一序列是否对所有角色使用固定权重、玩家能否改变权重，以及各序列的具体比例。

### D-COMBAT5F 同序列固定核心能力权重

- `DECISION`: `A_FIXED_FOR_ALL_CHARACTERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 同一途径、同一序列的体魄、感知、意志、知识权重对所有角色固定，不因玩家选择、职业或当前最高属性而变化。
- 同序列角色之间的差异由实际核心能力数值、技能掌握度、可用能力、装备封印物及当前状态体现。
- 固定权重属于序列规则数据，晋升后整体切换为新序列的权重配置。
- 本决定尚未锁定权重的数值精度和各序列的具体比例。

### D-COMBAT5G 核心能力权重使用5%刻度

- `DECISION`: `A_FIVE_PERCENT_INCREMENTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每个序列的体魄、感知、意志、知识权重只能以5%为变化单位，四项总和必须为100%。
- 不使用任意整数或小数百分比，避免无意义微调；也不限制为10%档，以保留足够的序列差异。
- 本规则约束权重配置精度，不限制实际核心能力数值仍使用0—500整数。
- 本决定尚未锁定任何具体序列的四项权重。

### D-COMBAT5H 序列9占卜家核心能力权重

- `DECISION`: `A_10_40_20_30`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列9占卜家的固定权重为：体魄10%、感知40%、意志20%、知识30%。
- 该配置以感知为主、知识为次，反映灵视、直觉、占卜与仪式倾向；较低体魄权重体现其直接战斗强化有限。
- 权重只决定四项核心能力如何聚合为档内基础战势，不直接决定技能转盘项目或胜势效果。

### D-COMBAT5I 序列8小丑核心能力权重

- `DECISION`: `A_40_35_15_10`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列8小丑的固定权重为：体魄40%、感知35%、意志15%、知识10%。
- 该配置以身体控制、平衡和敏捷为主，以危险预感为次；保留意志与知识的较低贡献，但不把占卜与具体能力重复算入基础权重。
- 权重随晋升整体切换，不要求从序列9占卜家的比例线性增长或平滑过渡。

### D-COMBAT5J 序列7魔术师核心能力权重

- `DECISION`: `A_20_30_15_35`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列7魔术师的固定权重为：体魄20%、感知30%、意志15%、知识35%。
- 该配置以诡术知识与准备为主、临场感知为次，并保留小丑阶段带来的身体基础；具体替身、转伤、幻术与逃生仍由能力转盘表现。
- 至此首版占卜家途径序列9—7的核心能力权重已逐项锁定。

### D-COMBAT5K 序列9观众核心能力权重

- `DECISION`: `A_5_45_20_30`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列9观众的固定权重为：体魄5%、感知45%、意志20%、知识30%。
- 该配置以观察和细节感知为主，以分析、记忆及心理知识为次；体魄贡献极低，符合其缺少直接战斗强化的定位。
- 情绪、体态和行为识别的具体信息收益仍由能力与场景规则处理，不把本权重当作通用交际数值。

### D-COMBAT5L 序列8读心者核心能力权重

- `DECISION`: `A_5_40_30_25`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列8读心者的固定权重为：体魄5%、感知40%、意志30%、知识25%。
- 该配置仍以读取表层思维和灵性表征所需的感知为主，同时提高意志贡献，以体现承载、分辨和驾驭精神信息的需求。
- 读取到何种信息、目标能否察觉及由此引发的后果仍由具体能力规则处理，不能由基础权重直接替代。

### D-COMBAT5M 序列7心理医生核心能力权重

- `DECISION`: `A_5_25_40_30`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列7心理医生的固定权重为：体魄5%、感知25%、意志40%、知识30%。
- 该配置以施加和维持心智影响所需的意志为主，以心理知识和控制精度为次；观察能力仍有贡献，但不再是唯一主导。
- 安抚、暗示、敬畏或狂乱等具体作用仍由能力转盘与目标抗性规则结算，基础权重不能被当作通用交际或自动精神控制。
- 至此首版观众途径序列9—7的核心能力权重已逐项锁定。

### D-COMBAT5N 序列9猎人核心能力权重

- `DECISION`: `A_40_30_10_20`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列9猎人的固定权重为：体魄40%、感知30%、意志10%、知识20%。
- 该配置以体魄为主，以追踪、危险感官和环境判断为次，并保留陷阱、爆炸物及生存知识的明确贡献。
- 追踪、布置陷阱和使用爆炸物的具体收益仍由技能掌握度、条件与能力转盘结算，不由基础权重自动成功。

### D-COMBAT5O 序列8挑衅者核心能力权重

- `DECISION`: `A_35_30_25_10`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列8挑衅者的固定权重为：体魄35%、感知30%、意志25%、知识10%。
- 该配置保留猎人的身体与感官优势，同时提高意志贡献，以体现识别目标情绪弱点并持续施压的战斗方式。
- 挑衅是否成立、目标如何反应及是否诱发错误决策仍由具体能力、目标状态和转盘效果决定；本权重不是交际值。

### D-COMBAT5P 序列7纵火家核心能力权重

- `DECISION`: `A_30_25_30_15`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 序列7纵火家的固定权重为：体魄30%、感知25%、意志30%、知识15%。
- 该配置让体魄与火焰操控所需的意志并重，同时保留危险感知和战术知识；灵性增长由独立的灵性当前值/上限处理，不挤入四项权重。
- 具体火焰创造、操控、范围与代价仍由能力转盘和灵性消耗规则结算。
- 至此首版猎人途径序列9—7，以及首发三途径共九个序列的核心能力权重已逐项锁定。

### D-COMBAT5Q 能力命中后的胜势贡献如何合并

- `DECISION`: `LOCKED=A_SUM_SIGNED_DELTAS_PER_HIT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q1A`。
- 每次有效能力命中都返回一个有方向的胜势增量；同一方本轮的全部命中增量逐项相加，再与基础战势、状态和其他已声明战斗因素合并，生成最终胜负盘输入。
- 命中的特殊效果独立结算，可以改变后续真实面板或下一回合，但不能把已经产生的贡献静默替换成“只取最强”或“只保留最后一次”。
- 各技能的具体增量、负向贡献、重复命中规则和特殊效果仍由后续能力内容逐项填写；本决定只锁定汇总方式。

### D-COMBAT5R 先手进入最终战势的具体方式

- `DECISION`: `DEFERRED_V1_MVP_SCOPE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择第一版最小战斗范围 `A`。
- 第一版保留先手字段和流程顺序，但不制作独立的数值平衡题；未声明先手修正时按0处理，后续版本再决定其是否影响胜势或次数。

### D-COMBAT6 固定序列基础值加有限核心修正

- `DECISION`: `A_FIXED_TIER_BASE_PLUS_CAPPED_CORE_MODIFIER`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 基础战势先读取当前序列/位格对应的固定基础值，再加上由该序列四项权重计算出的核心能力修正。
- 核心能力修正必须有明确上限，确保它主要区分同档强弱，通常不能单靠堆属性跨越明显位阶差距。
- 不采用“序列倍率直接乘核心能力”，也不采用“只要序列更高就完全忽略属性”的绝对比较。
- 技能、掌握度、道具、装备和封印物仍在能力转盘阶段另外改变胜势与效果，因此不计入此基础值或核心修正。
- 本决定尚未锁定序列基础值是全途径共用还是途径独立、具体档位数值，以及核心修正公式与上限。

### D-COMBAT6A 全途径共用的手工序列基础值

- `DECISION`: `A_GLOBAL_HANDCRAFTED_BASE_PER_SEQUENCE_RANK`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 同一序列等级在所有途径间共用一个基础战势值；例如所有序列8先读取相同的序列8基础值。
- 每个序列等级的基础值独立手工设定，不要求套用统一等差或等比公式，因此相邻晋升差距可以非线性。
- 不同途径与具体序列的战斗风格和强弱差异继续由核心能力权重、实际数值、能力转盘及特殊效果体现，避免在基础值中重复计算。
- 本决定尚未锁定首版普通人、序列9、序列8、序列7的具体基础值。

### D-COMBAT6B 首版序列基础战势值

- `DECISION`: `A_100_200_300_450`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 首版固定基础战势值为：普通人100、序列9为200、序列8为300、序列7为450。
- 在尚未加入核心能力、状态、先手和能力转盘修正时，序列9对普通人的基础占比约为66.7%，序列8对序列9、序列7对序列8均约为60%。
- 这些数字是内部胜势权重，不是体魄、感知、意志、知识或灵性的数值上限。
- 本决定尚未锁定核心能力修正公式、上限、状态修正和先手价值。

### D-COMBAT6C 加权核心能力直接加算且封顶20%

- `DECISION`: `A_DIRECT_ADD_CAPPED_AT_20_PERCENT_OF_TIER_BASE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 先按当前序列的固定四项权重计算加权核心能力值：`C = 体魄×w体魄 + 感知×w感知 + 意志×w意志 + 知识×w知识`。
- 核心能力修正为：`CoreBonus = min(C, TierBase×20%)`；不以序列平均值为中心倒扣，较弱角色只是获得较少加成。
- 状态与先手加入前的基础战势为：`TierBase + CoreBonus`。
- 首版封顶分别为：普通人+20、序列9为+40、序列8为+60、序列7为+90。
- 即使核心数值超过封顶，它仍可影响非战斗检定、技能条件或能力转盘；只是不会继续扩大通用基础战势。
- 本决定尚未锁定状态修正、先手价值及最终取整规则。

### D-COMBAT6D 三项主要状态分别分档并封顶叠加

- `DECISION`: `A_INDEPENDENT_BANDS_STACKED_WITH_TOTAL_CAP`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 健康、精神、灵性各自依据当前值占上限的比例进入简单状态档，并分别产生基础战势扣减。
- 三项扣减允许叠加，但存在统一总扣减上限，避免多项低值把基础战势直接压成零或负数。
- 明确伤势、污染及增益/减益效果只有在自己的规则声明额外修正时才另计一次；同一原因不得同时通过数值下降和标签重复扣减。
- 数值降至0时可能触发昏迷、失控、灵性枯竭或能力不可用等专门规则，不应仅用普通百分比扣减替代。
- 本决定尚未锁定各档阈值、单项扣减幅度、总扣减上限和0值专门规则。

### D-COMBAT6E 状态四档扣减与40%总上限

- `DECISION`: `A_0_5_10_20_TOTAL_CAP_40`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 健康、精神、灵性分别按当前值占各自上限的比例取档：76%—100%不扣；51%—75%扣5%；26%—50%扣10%；1%—25%扣20%。
- 三项百分比相加形成总状态扣减，最高为40%；超过40%的部分不再增加通用基础战势扣减。
- 灵性以当前值除以当前上限计算比例；健康与精神首版上限均为100。
- 0值不进入1%—25%普通档，而是交给健康归零、精神归零、灵性归零各自的专门规则。
- 本决定尚未锁定状态百分比作用于完整的“序列基础值＋核心加成”还是仅作用于其中一部分，也未锁定0值规则。

### D-COMBAT6F 状态扣减作用于完整前状态战势

- `DECISION`: `A_APPLY_TO_TIER_BASE_PLUS_CORE_BONUS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 状态扣减作用于完整的“序列基础值＋核心能力加成”：`StateAdjustedWeight = (TierBase + CoreBonus) × (1 - TotalStatePenalty)`。
- 不保留一块不受伤势影响的核心加成，也不使用跨序列相同的固定点数扣减。
- 先手与能力转盘尚未进入此公式；它们的结算位置和数值仍待后续锁定。

### D-COMBAT6H 允许依靠特殊条件和转盘运气越级取胜

- `DECISION`: `A_RARE_ROULETTE_UPSET_REQUIRES_SPECIAL_CONDITIONS_STRONG_POSITION_SUPPRESSION`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`，并补充越级也看转盘运气、高位格压制必须很明显。
- 高序列不自动获胜，最终仍由胜负转盘抽取，因此在满足规则的情况下保留极小概率爆冷。
- 低序列若要形成合理的越级胜机，必须依靠针对性准备、强力封印物、明确克制、环境优势或高序列目标的严重负面状态等实际来源。
- 熟练度只能改善当前序列能力的掌握，不能单独成为突破位格压制的来源；普通状态下的高位格压制必须在最终胜负转盘上清晰可见。
- 位格压制采用概率上限、战势倍率还是仅依靠档位基础值表现，下一步确认。

### D-COMBAT6I 位格压制不使用额外胜率上限或衰减倍率

- `DECISION`: `C_SEQUENCE_BASE_AND_ACTUAL_EFFECTS_ONLY_NO_EXTRA_CAP_OR_MULTIPLIER`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `c`。
- 最终胜负转盘不额外设置“低位方最高胜率”，也不因序列差再乘一层统一衰减系数。
- 高位格压制只通过序列基础战势值，以及双方能力、封印物、状态、先手等已经实际结算出的效果自然体现；最终仍按双方有效战势比例生成胜负盘。
- 因此序列基础战势值必须自身承担主要位格差距。现有序列9／8／7基础值200／300／450在无其他修正时，会让序列9对序列8约有40%裸胜率、对序列7约有31%裸胜率，是否足够体现“压制明显”必须重新确认。

### D-COMBAT6J 保留现有基础战势并由具体能力形成进一步压制

- `DECISION`: `C_KEEP_100_200_300_450_ABILITY_EFFECTS_CREATE_FURTHER_SUPPRESSION`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `c`。
- 保留普通人、序列9、序列8、序列7的基础战势100、200、300、450，不通过再次放大基础值来强化位格压制。
- 基础战势只提供位阶底盘；高序列相对低序列的进一步优势，必须来自其实际拥有的能力效果、能力转盘项目、效果组合和当前面板，而非隐藏修正。
- 因此后续逐能力设计完成后必须检查整套序列能力是否真实拉开对战表现；校准采用模拟目标、人工判断还是不设统一门槛，下一步确认。

### D-COMBAT6K 每套序列能力完成后进行模拟与原著双重校准

- `DECISION`: `A_BATCH_SIMULATION_PLUS_CANON_MANUAL_REVIEW`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每完成一套可结算的序列能力数据，必须运行批量转盘对战模拟，检查同序列、相邻序列和跨两级序列的实际胜率分布。
- 模拟结果只提供数值证据，不能单独决定设计；还须人工检查能力互动、克制关系、适用情境和结果是否符合原著表现。
- 校准发现压制不足时，优先调整真实能力效果与转盘参数，不新增隐藏位格倍率或胜率上限；任何底层规则变更仍须重新 Grill 用户。

### D-IMPLEMENTORDER1 先完成底层系统再分批添加序列数值内容

- `DECISION`: `FOUNDATION_ENGINE_FIRST_SEQUENCE_DATA_INCREMENTALLY_AFTERWARD`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求先把底层制作好，再添加数值，因为设计全序列需要大量时间。
- 不以标准22途径序列9—0全部能力设计完成作为底层系统开工条件；先实现并验证通用数值、判定、效果、转盘、持久化与内容装载能力。
- 序列能力及具体数值在底层稳定后分批设计、录入、校准；最终设计覆盖目标不变，但首版可按已锁定范围逐步形成可玩内容。
- 底层不得硬编码某一条途径的专属数值，以免后续添加全序列时被迫重写公共系统。

### D-ABILITYENGINE1 数据驱动为主并为特殊能力保留受控扩展处理器

- `DECISION`: `C_DATA_DRIVEN_CORE_WITH_CONTROLLED_SPECIAL_HANDLERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `c`。
- 普通能力效果、消耗、条件、目标、持续时间、状态、熟练度节点、转盘权重和胜势修正优先使用统一数据结构表达。
- 只有通用效果结构无法忠实表达的特殊能力，才允许绑定明确登记的扩展处理器；不得为了录入方便把普通能力全部改写为专属代码。
- 扩展处理器必须与能力记录一一关联、可测试、可追踪版本，并继续接受内容校验和对战模拟。
- 特殊处理器不作为普通能力的额外效果事务；若后续仍需要，接口和边界必须随具体能力主题另行登记，不得绕过统一判定或直接写入存档。

### D-ABILITYENGINE2 特殊处理器通过公共效果出口（历史提案）

- `DECISION`: `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `SUPERSEDED_BY_USER`: 2026-08-29，用户指出普通能力使用数值判定即可，不需要另设公共效果事务；旧的“公共效果出口”只保留为历史提案，不得实现。
- 若未来确有无法数据化的特殊能力，再单独提出其最小接口；本条不预设公共效果列表、预检、回滚或统一成本提交。

### D-ABILITYENGINE3 特殊处理器使用引擎统一可复现随机源

- `DECISION`: `A_ENGINE_PROVIDED_REPLAYABLE_RNG_LOGGED_DRAWS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 特殊处理器不得自行调用系统时间、设备随机数或未登记的第三方随机源；所有随机结果必须由底层统一随机服务提供。
- 每次抽取记录所属行动、能力版本、随机流标识、抽取顺序和结果，确保同一存档可以重放、审计和复盘。
- 统一随机源只保证结果可复现，不改变能力本身的概率分布；转盘、熟练度分配和特殊处理器都必须遵守各自已登记的权重。
- 多个处理器连续调用时的随机流隔离、调用顺序和重放规则已由 `D-ABILITYENGINE4` 锁定。

### D-ABILITYENGINE4 每个行动使用独立随机流并固定取数顺序

- `DECISION`: `A_ACTION_SCOPED_DETERMINISTIC_RNG_FIXED_ORDER`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每个行动、战斗回合或独立结算单元生成自己的随机流；随机流种子由存档、周次、行动ID和结算版本等权威输入确定。
- 同一结算内所有转盘与特殊处理器按预先定义的固定顺序取数；新增界面展示、日志字段或非结算读取不得消耗随机数。
- 结果日志保存随机流标识、取数序号和结果，使同一行动可以独立重放，不受其他行动或打开顺序影响。
- 普通能力不再定义多效果列表结构；未来特殊处理器仍须遵守可复现随机规则，但具体接口另行登记。

### D-ABILITYRESOLUTION1 普通能力直接使用统一数值判定

- `DECISION`: `A_UNIFIED_GENERAL_CHECK_NO_SEPARATE_EFFECT_TRANSACTION`
- `CONFIRMED_BY_USER`: 2026-08-29，用户指出普通能力使用数值判定即可，不需要另设一套效果事务、预检、回滚或扣费引擎；该简化方案取代此前 `D-ABILITYEFFECT1..4` 的过度设计。
- 非战斗普通能力直接使用已锁定的统一数值判定与四档结果；能力差异通过能力数据声明的适用条件、判定参数和结果后果体现，不再先设计通用公共效果事务。
- 能力的资源消耗、状态变化、线索和事件后果属于该能力/事件的结果数据，后续逐项设计时再填写；不要求先建立“公共效果列表”，也不新增统一预检、部分回滚或成本锁定规则。
- 战斗能力仍完全走 `D-COMBAT*` 转盘流程；战斗转盘的胜势和特殊效果不被普通数值判定取代。

### D-ABILITYEFFECT1 一次能力结算输出有序公共效果列表

- `DECISION`: `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `SUPERSEDED_BY_USER`: 2026-08-29，用户要求普通能力直接使用数值判定，取消独立公共效果事务设计；原“有序效果列表”只保留为历史提案，不得实现。

### D-ABILITYEFFECTSCOPE1 公共效果基础规则只处理普通能力判定

- `DECISION`: `A_NORMAL_RESOLUTION_ONLY_COMBAT_ROULETTE_SEPARATE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户指出此前把普通能力判定与战斗转盘混在了一起，并明确战斗转盘已有独立流程。
- 该决定保留“普通判定与战斗转盘分层”的边界，但不再启用 `D-ABILITYEFFECT1..4` 的独立事务设计；普通能力统一回到 `D-ABILITYRESOLUTION1`。
- 战斗转盘继续使用已锁定的次数盘 → 能力盘 → 最终胜负盘 → 胜负后因果后果流程。
- 战斗中的能力胜势、特殊效果、物品/封印物和资源处理若需新增规则，必须作为 `D-COMBAT*` 单独 Grill，不能由普通能力判定规则暗中补完。

### D-ABILITYEFFECT2 公共效果列表的单项条件失败只跳过该项

- `DECISION`: `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `SUPERSEDED_BY_USER`: 2026-08-29，用户认为普通能力直接走数值判定，不需要公共效果列表的逐项失败事务。

### D-ABILITYEFFECT3 能力级预检与资源成本原子边界

- `DECISION`: `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `SUPERSEDED_BY_USER`: 2026-08-29，用户明确不另设普通能力效果事务；统一数值判定直接处理可行性与结果。

### D-ABILITYEFFECT4 预检通过后资源成本的实际提交时机

- `DECISION`: `SUPERSEDED_BY_D-ABILITYRESOLUTION1`
- `SUPERSEDED_BY_USER`: 2026-08-29，用户认为该成本提交问题属于过度设计；普通能力的成本和后果随具体能力/事件数据处理，暂不建立通用事务规则。

### D-DOCS1 设计按主题分档并由 AGENTS.md 规定接管协议

- `DECISION`: `DONE_DOCUMENTATION`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求把全部设计固化到项目文件，按 Markdown 分类，并提供 `AGENTS.md` 供其他 agent 直接接管。
- `PROJECT_STATE_LEDGER.md` 是唯一的设计决策权威，保存完整决定编号、确认状态、证据边界、当前进度和下一题；任何分类文档与其冲突时，以台账为准并修正文档。
- `AGENTS.md` 是其他 agent 的入口合同，规定读取顺序、权威层级、Grill-me、写入台账、参考项目只读、未决项不得臆补和验证边界。
- `docs/` 按主题拆分可读文档：项目总览、核心循环、数值判定、战斗转盘、能力系统、角色与成长、原著/RAG、参考复用、实现路线、未决问题；每份文档都标注状态与对应台账编号。
- 文档只记录当前已确认设计；未决、延期、被取代和仅研究事实必须保留原状态，不得写成已实现或已锁定。
- 已创建根目录 `AGENTS.md` 与 `docs/` 下的总览、决定索引、核心循环、数值判定、战斗转盘、能力系统、角色成长、原著/RAG、参考复用、实现路线和未决问题文档。
- 已完成文档门禁：主题文档内部链接检查通过（`INTERNAL_LINKS=PASS`），关键状态、数字和公式与当前台账逐项抽查一致。

### D-DOCS2 每道后续 Grill 决定必须同步写入对应主题 Markdown

- `DECISION`: `A_EVERY_GRILL_DECISION_SYNCED_TO_THEME_DOC`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求“之后 Grill 的设计都要归到对应的设计 md 文件里”。
- 从本决定起，每道新的 Grill 题在用户确认后，必须先更新 `PROJECT_STATE_LEDGER.md`，再把同一决定同步到对应主题 Markdown；若跨主题，所有受影响文档都要同步。
- 主题文档只能是台账的可读镜像，不能单独提出或锁定新规则；没有对应主题文件时，先创建模板并登记映射，再继续设计。
- 最终回复不得把尚未完成这次同步的决定称为已归档、已封板或可实现。

### D-GRILLMODE1 未决设计按主题分批提问

- `DECISION`: `A_THEME_BATCH_WITH_INDEPENDENT_NUMBERED_ITEMS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求“把未决定的设计分批统一问我”。
- 后续把相互独立的未决问题按主题组成有限批次；批内每题拥有独立编号、互斥选项、推荐项和影响，用户可一次回答多个编号。
- 批内存在依赖关系时必须显式标注；未回答项保持 `PENDING` / `QUESTION_READY`，不能从同批其他答案推断。
- 用户回答一批后，逐题写入台账并同步各自主题 Markdown，再生成下一批；不再为了形式把同一主题拆成连续的单选追问。

### D-GRILLBATCH1 第一批普通判定、资源与周循环问题

- `DECISION`: `DONE_BATCH_FOLLOWUPS_PENDING`
- `SCOPE`: 本批处理普通判定、资源生命周期和周循环；不修改战斗转盘流程，也不进入具体序列能力内容。
- `CONFIRMED_BY_USER`: 2026-08-29，用户一次确认 `Q1B Q2B Q3B Q4C Q5A Q6C`，并补充“序列能力（例如秘偶）可提高行动力；拜访按钮换成可切换城市的按钮”。
- `Q1_RESOURCE_ZERO_CLAMP`: `LOCKED=B_ALLOW_RESOURCE_OVERDRAFT`。健康、精神、灵性在明确来源作用下可以低于0，按资源透支继续结算；负值下限、归零线重复触发与战势读取进入 `D-RESOURCEOVERDRAFT1`。
- `Q2_MENTAL_RECOVERY`: `LOCKED=B_REST_RECOVERS_ALL_THREE`。休养可同时恢复健康、精神和灵性；每项具体恢复量与派生方式进入 `D-RECOVERYVALUES1`。
- `Q3_POLLUTION_STAGE`: `LOCKED=B_VISIBLE_POLLUTION_0_TO_100`。第一版使用玩家始终可见的0—100污染主值；阈值、事件和具体影响进入 `D-POLLUTIONEFFECT1`。
- `Q4_WEEKLY_ACTION_COUNT`: `LOCKED=C_DYNAMIC_ACTION_BUDGET_WITH_ABILITY_MODIFIERS`。每周行动机会动态计算，除职业、状态和生活档位外，序列能力、秘偶等明确效果也可提高或降低行动力；基础值和公式进入 `D-ACTIONBUDGET1`。
- `Q5_WORK_SLOT`: `LOCKED=A_WORK_CONSUMES_ONE_MAJOR_ACTION`。工作占用1次主要行动，并在该行动结算职业工资与产业收益。
- `Q6_VISIT_ROLE`: `LOCKED=C_NO_VISIT_BUTTON_SOCIAL_VIA_EVENTS`。不设拜访按钮；社交通过调查、事件和其他情境行动发生。城市切换曾作为候选替代项，但用户随后明确第一版暂不做新地图，因此不进入第一版固定按钮。
- `BATCH_RESULT`: 本批6项已写入对应数值与核心循环规则；所有具体阈值、公式、城市目的地与事件内容保持后续批次待定。

### D-GRILLBATCH2 第二批资源透支、污染、动态行动与城市切换

- `DECISION`: `DONE_BATCH_FOLLOWUPS_PENDING`
- `SCOPE`: 本批细化上一批已经锁定的资源负值、三项恢复、可见污染和动态行动力；城市切换因第一版不做新地图而延期，不进入当前实现。
- `CONFIRMED_BY_USER`: 2026-08-29，用户一次确认 `Q1A Q2A Q3C Q4A Q5B`，并明确 `Q6` 的城市切换属于新地图，第一版可以不做。
- `BATCH_RESULT`: 资源透支采用来源声明下限；首次穿过0只触发一次 `onZero`，负值进入战斗按0读取（特殊能力可声明例外）；休养只有一个按钮且同时恢复健康、精神、灵性，恢复量动态读取序列、生活档位、当前状态和事件；污染以阈值事件/症状/后果为主；每周行动力基准为3再加修正；第一版不设置城市切换/地图按钮。

### D-RESOURCEOVERDRAFT1 资源负值的下限

- `DECISION`: `LOCKED=A_SOURCE_DECLARED_OVERDRAFT_FLOOR`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q1A`。
- 每个具体伤害、污染、反噬、封印物或事件来源必须声明本次最多透支量与来源下限；没有声明的来源不能把资源继续压低。具体字段进入能力/事件数据校验，不在公共系统猜测。
- 该来源下限只约束本次来源结算，不改变健康/精神100或灵性500的常态上限。

### D-RESOURCEOVERDRAFT2 归零线后的重复触发与战势读取

- `DECISION`: `LOCKED=A_SINGLE_CROSSING_ONZERO_ZERO_FOR_BATTLE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q2A`。
- 同一资源从正数穿过0时，按来源触发一次 `onZero`；之后继续变负只更新当前值，不因每次扣减重复触发同一归零规则。
- 战斗状态分档和战势比例读取负值时按0处理；某项特殊能力若确实需要读取负值，必须在自身数据中显式声明例外，不能由系统默认放开。

### D-RECOVERYVALUES1 休养三项恢复的数值方式

- `DECISION`: `LOCKED=C_DYNAMIC_REST_RECOVERY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q3C`，并补充“只有一个休养按钮，一个按钮能恢复三个状态”。
- 第一版只有一个固定“休养”按钮；一次执行同时结算健康、精神、灵性三项恢复。
- 三项实际恢复量动态读取序列/位格、生活档位、当前状态和事件；合并顺序已锁定为基础表→当前状态修正→事件覆盖/追加。恢复超过上限直接封顶并丢弃溢出；负值资源先回到0，剩余恢复量才进入正值区间（`D-RESOURCECAP1`、`D-RECOVERYVALUES3`）。

### D-POLLUTIONEFFECT1 可见污染值的作用

- `DECISION`: `LOCKED=A_THRESHOLD_EVENT_EFFECTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q4A`。
- 污染主值主要在明确阈值触发来源明确的事件、症状和后果；不把每1点污染自动换算成全局判定、战斗或行动力百分比。
- 公共阈值带已锁定为0—24、25—49、50—74、75—100；事件触发时机、净化和来源例外进入 `D-POLLUTIONEFFECT3` 及后续事件数据。

### D-ACTIONBUDGET1 动态每周行动力的基准与修正

- `DECISION`: `LOCKED=B_BASE_3_PLUS_MODIFIERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q5B`。
- 每周行动机会从基准3次开始，再叠加或扣除明确来源的整数修正；所有来源相加，最低1次，未用行动不结转，额外行动仅限当周（`D-ACTIONBUDGET2..3`）。

### D-CITYTRAVEL2 城市切换按钮的行动与时间规则

- `DECISION`: `DEFERRED_V1_NO_CITY_MAP`
- `CONFIRMED_BY_USER`: 2026-08-29，用户说明城市切换属于新地图，第一版可以不做。
- 第一版不实现城市切换按钮、地图切换、旅行费用或抵达时间规则；保留该决定编号，后续地图版本重新开启 Grill 时再设计，不能在第一版实现中自行补完。

### D-ACTIONBUDGET2 动态行动力修正的合并与边界

- `DECISION`: `LOCKED=A_INTEGER_ADD_MIN1_CONTENT_MAX`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q4A`。
- 基准3次之上的所有明确来源按整数加减合并；计算结果最低为1次，最高值由内容/版本声明，不设公共百分比乘算。
- 来源必须可追溯到职业、状态、生活档位、序列能力、秘偶或其他已生效效果；具体能力仍需逐项声明其整数修正。

### D-RECOVERYVALUES2 动态休养恢复的输入优先级与边界

- `DECISION`: `LOCKED=A_REST_TABLE_STATE_MODIFIER_EVENT_OVERRIDE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q2A`。
- 单一休养按钮先按序列/位格与生活档位查三项基础恢复表，再应用当前状态修正；明确事件可以最后覆盖或追加，并必须记录来源。
- 该决定只锁定合并顺序，不填写具体序列恢复量，也不允许事件无来源地临时生成数值。

### D-POLLUTIONEFFECT2 污染阈值带与事件数据边界

- `DECISION`: `LOCKED=A_FOUR_POLLUTION_BANDS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q3A`。
- 公共污染阈值带固定为四档：0—24、25—49、50—74、75—100。
- 阈值事件触发时读取污染来源和当前世界条件；触发时机已由 `D-POLLUTIONEFFECT3` 锁定为进入新阈值带时检查一次，离开不反向触发，周脉冲不重复刷同一进入事件。

### D-RESOURCEOVERDRAFT3 透支下限的数据字段表达

- `DECISION`: `LOCKED=A_ABSOLUTE_OVERDRAFT_FLOOR_FIELD`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q1A`。
- 每个可能使资源低于0的来源数据必须提供明确绝对 `overdraftFloor`；公共引擎按该字段封顶并把字段写入结算日志。
- 字段缺失、类型错误或低于系统允许存储范围时，内容校验失败；引擎不能用严重度或AI临时推导替代。

### D-ACTIONBUDGET3 行动力跨周结转与额外行动

- `DECISION`: `LOCKED=A_NO_CARRYOVER_WEEKLY_EXTRA_ONLY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q5A`。
- 本周未使用的行动机会在周脉冲后清零，不结转到下一周。
- 额外行动只能由明确效果产生，并且只在产生它的本周有效；不能把额外行动变成永久行动力上限。

### D-GRILLBATCH3 第三批资源、恢复、污染与行动力具体边界

- `DECISION`: `DONE_BATCH_FOLLOWUPS_PENDING`
- `CONFIRMED_BY_USER`: 2026-08-29，用户一次确认 `Q1A Q2A Q3A Q4A Q5A`。
- `BATCH_RESULT`: 透支使用绝对来源字段；休养按基础表→当前状态修正→事件覆盖/追加；污染使用四档公共阈值；行动力按整数加减、最低1次；未用行动不结转，额外行动限当周。城市切换仍为第一版延期。

### D-GRILLBATCH3_REPLY

- `REPLY_FORMAT`: `Q1A Q2A Q3A Q4A Q5A`；可只回答已确定项。

### D-RESOURCECAP1 资源恢复超过上限时的溢出处理

- `DECISION`: `LOCKED=A_CLAMP_AND_DISCARD_OVERFLOW`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求“按照推荐”。
- 健康、精神、灵性任何恢复结算都直接封顶到各自当前上限；超过上限的部分丢弃，不形成隐藏护持值。

### D-RECOVERYVALUES3 负值资源的休养回补顺序

- `DECISION`: `LOCKED=A_RECOVER_TO_ZERO_THEN_POSITIVE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求“按照推荐”。
- 休养面对负值资源时，恢复量先用于把该资源拉回0；只有剩余恢复量才进入0以上的正常值区间，不修改来源声明的透支下限。

### D-POLLUTIONEFFECT3 污染阈值事件的触发时机

- `DECISION`: `LOCKED=A_CHECK_ON_ENTERING_BAND`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求“按照推荐”。
- 污染从当前阈值带进入更高或更低的新阈值带时检查一次阈值事件；离开阈值带不自动反向触发，周脉冲也不重复刷同一进入事件。

### D-CORE5 行动用尽后的世界脉冲确认边界

- `DECISION`: `LOCKED=AUTO_PULSE_AFTER_LAST_ACTION`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求“按照推荐”。
- 最后一次主动行动完成条件校验、结果结算和持久化后，自动执行世界脉冲，再展示周结算摘要；不增加额外确认按钮，也不改变既定结算顺序。

### D-V1COMBAT1 第一版战斗复杂度范围

- `DECISION`: `LOCKED=A_MINIMAL_TWO_CORE_QUESTIONS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `A`。
- 第一版在 `D-GRILLBATCH6` 已确认两项：能力命中后的胜势贡献合并（`D-COMBAT5Q`）和次数盘最低次数（`D-COMBAT2D`）。
- 后果公开层级（`D-COMBAT1E`）、一次性物品耗尽（`D-COMBAT3E`）和先手具体数值（`D-COMBAT5R`）标记为 `DEFERRED_V1_MVP_SCOPE`，不阻塞第一版核心双转盘引擎。
- 该范围决定只限制第一版内容和界面复杂度，不撤销已锁定的双阶段战斗、回合快照、未知区混合来源、胜负盘和生存规则；后续可重新开启对应题目。

### D-GRILLBATCH4 第四批资源余量、周脉冲与重战边界

- `DECISION`: `DONE_BATCH_FOLLOWUPS_PENDING`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求本批全部按照推荐方案。
- `BATCH_RESULT`: 恢复超过上限直接封顶并丢弃溢出；负值休养先回到0再进入正值；污染只在进入新阈值带时检查一次；最后一次主动行动持久化后自动推进世界脉冲；战斗失败结束本次遭遇，必须由新事件/条件重新建立交战。城市切换/地图继续延期。

### D-GRILLBATCH4_REPLY

- `REPLY_FORMAT`: `Q1A Q2A Q3A Q4A Q5A`；可只回答已确定项。

### D-GRILLBATCH5 第五批战斗转盘组合、快照与胜负时机

- `DECISION`: `DONE_BATCH`
- `CONFIRMED_BY_USER`: 2026-08-29，用户确认 Q1A、Q2A、Q3“双方按次数把本轮能力盘转完后才进入胜负盘”、Q4A、Q5M。
- `BATCH_RESULT`: 次数盘多来源先相加后归一化；快照临时失效保留原扇区并执行预声明无效/替代结果；双方本轮能力盘都转完后才判本轮胜负；能力盘按基础权重×掌握度曲线再加当前效果后归一化；未知区采用固定小底噪并允许明确因果来源追加。

### D-GRILLBATCH6 第六批战斗贡献、次数保底、消耗、先手与后果公开

- `DECISION`: `DONE_BATCH`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择第一版最小战斗范围 `A`。
- `BATCH_RESULT`: `D-COMBAT5Q=LOCKED=A_SUM_SIGNED_DELTAS_PER_HIT`；`D-COMBAT2D=LOCKED=A_DEFAULT_MINIMUM_ONE_NO_ZERO_NORMAL`。一次性物品耗尽、先手具体数值和后果公开层级均按 `D-V1COMBAT1` 延期到后续版本。

### D-GRILLBATCH7 第七批普通判定修正与能力目标范围

- `DECISION`: `DONE_BATCH`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求两项均按推荐方案处理。
- `BATCH_RESULT`: `D-NUM5F=LOCKED=A_ADD_SIGNED_INTEGER_MODIFIERS_NO_GLOBAL_MULTIPLIERS`；`D-ABILITYSCHEMA4=LOCKED=A_EXPLICIT_TARGET_SELECTOR_DEFAULT_SINGLE_TARGET`。

### D-GRILLBATCH8 第八批普通后果结构与能力效果生命周期

- `DECISION`: `DONE_BATCH`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求两项均按推荐方案处理，并强调不要复杂化。
- `BATCH_RESULT`: `D-NUM5G=LOCKED=A_ORDERED_EXPLICIT_CONSEQUENCE_ITEMS`；`D-ABILITYSCHEMA5=LOCKED=A_IMMEDIATE_DEFAULT_EXPLICIT_DURATION_STACK_POLICY`。两项均采用最小可复现字段，不建立独立公共效果事务。

### D-DESIGNORDER 数值内核先于全序列能力量化

- `DECISION`: `NUMERIC_KERNEL_THEN_ABILITY_SCHEMA_THEN_ALL_22_PATHWAYS_SEQUENCE_9_TO_0`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求先规定游戏底层数值系统、判定和各种算法，再把所有序列的所有能力对应设计并量化。
- 阶段一：锁定属性、资源、成长、非战斗判定、战斗转盘、状态、先手、效果、抗性、消耗、持续时间、叠加、概率与取整等数值内核。
- 阶段二：建立所有能力共用的量化数据结构、效果词汇表、目标选择、条件、消耗、胜势影响、持续/叠加及未知效果边界。
- 阶段三：按该结构逐条设计标准22途径序列9—0的全部能力，并进行跨途径对标和平衡验证；首版实现范围仍可单独分期，但最终设计覆盖目标不缩减。
- 能力量化如发现底层规则不足，必须将相关底层决定显式改回待定并由用户重新确认，禁止以隐形特例绕过统一算法。
- `RECONFIRMED_BY_USER_2026-08-29`: 用户明确要求“先把底层问题问完”；当前继续完成能力结构、掌握度、资源、效果、叠加、魔药、消化、晋升与失控等底层规则，在这些规则封板前不进入具体途径能力表。

### D-COMBAT6G1 健康归零触发生存转盘

- `DECISION`: `HEALTH_ZERO_SURVIVAL_WHEEL_SUCCESS_CONTINUES_FAILURE_DIES`
- `CONFIRMED_BY_USER`: 2026-08-29，用户先选择健康归零触发生存转盘，随后明确纠正“生存失败就死了”；最新纠正覆盖此前“不判定死亡”的解释。
- 健康降至0时不直接死亡；立即触发独立的生存转盘。成功则按后续规则继续战斗，失败则角色死亡。
- 生存转盘属于健康归零后的独立致死判定，不属于最终胜负盘；最终胜负盘仍然只判定战斗胜者与败者，不在自己的扇区中加入死亡结果。
- 已明确生效的替身、复苏、免死或救援效果可以在生存转盘前、转盘中或转盘后介入，但其介入时点必须由具体效果规则声明。
- 本决定尚未锁定死亡后已独立生效效果的存续、尸体/复活规则或玩家角色死亡后的游戏流程。

### D-COMBAT6G1A 生存转盘读取实时生存因素

- `DECISION`: `A_DYNAMIC_SEQUENCE_PHYSIQUE_INJURY_SURVIVAL_EFFECTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 健康归零生存转盘的概率必须动态读取四类因素：序列/位格、当前体魄、导致归零的伤势严重度、已明确生效的保命/复苏/替身等效果。
- 不采用全角色固定50%，也不只读取体魄；同一角色因伤势来源和当时效果不同，可以获得不同的继续战斗概率。
- 只有明确作用于生存转盘的效果可以修正该概率；普通装备或能力不能因为“看起来有帮助”而被系统临时计入。
- 本决定尚未锁定四类因素如何合成概率、上下限、转盘成功状态和失败状态。

### D-COMBAT6G1B 生存转盘复用通用能力对难度公式

- `DECISION`: `A_REUSE_GENERAL_50_PLUS_2_DIFF_CLAMP_5_95`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 生存转盘概率为：`P(继续战斗) = clamp(5%, 95%, 50% + 2% × (EffectiveSurvival - InjuryDifficulty))`。
- `EffectiveSurvival` 由体魄、序列/位格生存加成和明确保命效果组成；`InjuryDifficulty` 由导致健康归零的伤势规则给出。
- 结算可视化为“继续战斗/死亡”两块转盘，但底层仍只进行一次随机抽取，不额外判定大成功或大失败。
- 本决定复用已有通用差值概率尺度，不再建立一套生存专用百分比算法。
- 本决定尚未锁定序列生存加成、伤势难度档、效果修正范围、成功/失败状态和重复归零规则。

### D-COMBAT6G1C 首版生存位阶加成

- `DECISION`: `A_0_5_10_15`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 首版生存判定的位阶加成为：普通人+0、序列9为+5、序列8为+10、序列7为+15。
- 在通用差值公式中，每增加5点等价于继续战斗概率提高10个百分点，因此相邻序列仅获得适度优势，不替代体魄、伤势难度或保命效果。
- 同序列的所有途径共用该位阶加成；途径差异来自实际体魄和明确的序列能力效果。
- 本决定尚未锁定伤势难度档、保命效果修正范围及生存成功/失败后的状态。

### D-COMBAT6G1D 生存判定四档伤势难度

- `DECISION`: `A_15_25_35_45`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 导致健康归零的伤势按主要致零原因分为四档：累积崩溃难度15、重创25、致命伤35、毁灭性伤势45。
- 同一次归零只选择一个主伤势难度，不把同一伤势拆成多项重复叠加；其他并发伤势可以通过明确效果修正或战后果系统保留。
- 以体魄15、普通人位阶加成0且无保命效果为例，对累积崩溃的继续战斗概率为50%，对重创30%，对致命伤10%，对毁灭性伤势触及5%下限。
- 本决定尚未锁定各类伤害映射到哪一伤势档、保命效果修正范围、成功/失败状态和重复归零规则。

### D-COMBAT6G1E 生存成功后以1点健康濒死坚持

- `DECISION`: `A_HEALTH_TO_1_WITH_DYING_STATUS_NO_DUPLICATE_GENERIC_PENALTY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 生存转盘成功后，角色健康设为1，并获得持续到当前战斗结束的“濒死”状态，可以继续正常进入后续行动与胜负结算。
- 健康1点按1%—25%档产生健康项-20%状态扣减；“濒死”标签本身不再重复扣除通用基础战势。
- “濒死”仍可作为技能条件、治疗限制、敌方处决条件或战后果因果来源，但具体效果必须明确声明。
- 本决定尚未锁定同场战斗再次健康归零时的生存概率变化，以及生存失败后的结算。

### D-COMBAT6G1F 重复归零提高生存难度

- `DECISION`: `A_REPEAT_WHEEL_PLUS_10_DIFFICULTY_PER_PRIOR_SUCCESS_FLOOR_5`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 濒死角色在同一场战斗中再次健康归零时，仍触发生存转盘，不因“第二次归零”直接判定无法继续。
- 同场每有一次成功的健康归零生存判定，后续生存判定的伤势难度额外+10；在通用差值公式中等价于封顶前继续概率降低20个百分点。
- 生存概率仍遵守5%—95%上下限，因此即使多次归零仍保留5%最低继续机会，但不会按第一次的原概率无限续命。
- 只有规则明确声明“重置濒死次数”或“忽略累积难度”的效果才能清除此战斗内累积值。
- 本决定尚未锁定生存失败死亡后已独立生效效果及最终胜负盘如何处理。

### D-COMBAT6G1G 生存转盘失败即死亡

- `DECISION`: `FAILURE_IS_DEATH`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确纠正“生存失败就死了”。
- 健康归零生存转盘失败时，角色立即进入死亡状态，不使用“倒地但存活”“昏迷”或仅清零个人战势作为默认结果。
- 这项死亡判定不改变最终胜负盘只含胜负两类结果的规则；若死亡者是玩家角色，则依照 `D-PLAYERDEATH1` 立即结束当前游戏，不再继续本场胜负结算。
- NPC死亡后是否保留已独立生效的火焰、陷阱、诅咒等效果后置到 `D-COMBAT6G1H`；它不影响玩家死亡即结束游戏的规则。

### D-PLAYERDEATH1 玩家死亡立即结束当前游戏

- `DECISION`: `PLAYER_DEATH_IMMEDIATELY_ENDS_CURRENT_RUN`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确纠正“死亡了就游戏结束了”。
- 玩家角色一旦进入死亡状态，当前游戏流程立即结束；不允许以死后持续效果、最终胜负盘或后续周结算继续操控该角色。
- 生存转盘失败是玩家死亡的一种来源；其他未来能力或事件只有在规则明确产生“死亡”时才触发同一终局。
- 本决定不自动规定NPC死亡会结束游戏，也不锁定死亡存档是否可回档、是否保留终局记录或新周目继承。

### D-PLAYERDEATH1A 死亡周目只读封存且不可回档

- `DECISION`: `A_PERMANENT_READ_ONLY_ARCHIVE_NO_ROLLBACK`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`，并要求参考《汴京梦华》在一局结束后提供结算。
- 玩家死亡后，当前周目所有可继续游玩的存档状态转为终局只读档案；不得加载死亡前手动存档、自动回到周初或继续操控死亡角色。
- 终局档案不删除，供玩家查看本局结算、生涯轨迹与关键记录；开始游戏必须创建新角色和新周目。
- 本决定尚未锁定终局档案字段、总分、评价、继承内容、档案数量上限或删除方式。

### D-SETTLEMENTREF1 《汴京梦华》死亡终局结算审计

- `SOURCE_FILES`: `D:\游戏\汴京梦华_Game——初步正式版\汴京梦华_Game\js\engine.js`、`js\life_history.js`，2026-08-29只读核验。
- `triggerDeath` 使用防重复标记，记录死亡原因和年龄，生成谥号与动态列传，清空行动按钮后打开墓志铭弹窗；不是只显示一句“游戏结束”。
- 墓志铭展示身份/姓名、死因、享年、谥号、生平密档、终老家财、产业、作品和多项行为统计，并组合动态列传、盖棺定论与编年实录。
- `LifeHistory` 将关键经历以“年月|标签|短文本”记录，最多300条，现场生成统计摘要与时间线；它没有建立一个统一总分来替代多维人生记录。
- “重入轮回”会清除自动存档并返回开局，但代码提示1—3号手动存档不会删除；本项目不能照搬这一点，因为用户已锁定死亡周目不可回档，只能保留只读终局档案。
- 可借鉴的是“终局快照＋多维统计＋规则生成评价＋关键经历时间线＋新周目入口”的结构；不复制其官场字段、墓志铭文案、视觉素材或未经确认可复用的源码。

### D-SETTLEMENT1 无统一总分的多维生涯卷宗

- `DECISION`: `A_MULTIDIMENSIONAL_DOSSIER_NO_TOTAL_SCORE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 终局结算不将整段人生压缩成一个总分或S/A/B/C等级，而是展示多维“非凡者生涯卷宗＋结局称号/评语＋关键人生时间线”。
- 不同玩法路线可在各自维度留下可比较记录，但不以单一价值函数判断哪种人生更高分。
- 本决定尚未锁定卷宗字段、结局称号规则、时间线筛选、AI参与边界或新周目继承。

### D-SETTLEMENT2 确定性结算权威与AI润色边界

- `DECISION`: `A_DETERMINISTIC_FACTS_AND_TITLES_AI_RAG_PROSE_ONLY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 终局事实、统计、死亡原因、结局条件和结局称号全部由本地确定性规则及只读周目档案生成，AI没有裁决权。
- 小模型与RAG仅可读取经过筛选的真实终局档案和知识库，将其润色为生涯传记；不得新增未发生事件、改变死因、伪造关系或覆盖规则称号。
- AI不可用、超时或输出验证失败时，必须使用本地确定性模板完成结算，终局页面不能依赖模型在线成功。
- AI生成文本与其输入快照、模型/提示版本及验证结果需可追溯，但具体数据结构后置到能力与RAG基础设施设计阶段。
- 本决定尚未锁定卷宗字段、称号组合、非死亡终局、新周目继承或AI文本长度风格。

### D-ENDING1 死亡或明确终局条件结束且无固定周数上限

- `DECISION`: `A_DEATH_OR_EXPLICIT_ENDING_NO_FIXED_WEEK_CAP`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 一局可以因玩家死亡结束，也可以因满足明确、可审计的非死亡终局条件而进入同一套终局结算。
- 不设置固定周数或强制倒计时；只要没有死亡且未选择/触发终局，周推进可以继续。
- 每个非死亡终局必须有确定性条件和唯一触发记录，AI不得自行宣布玩家达成终局。
- 本决定尚未锁定终局条件满足后是否强制结束、具体终局类型、隐藏条件或终局是否允许继续沙盒。

### D-ENDING1A 非死亡终局由玩家确认

- `DECISION`: `A_UNLOCK_ENDING_CHOICE_PLAYER_MAY_END_OR_CONTINUE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 满足非死亡终局条件时，只解锁并展示一次可审计的“终局抉择”，不自动强制结束周目。
- 玩家可以确认接受该终局并进入结算，也可以拒绝并继续按周推进；死亡终局不提供继续选项。
- 本决定尚未锁定拒绝后的终局入口是否持续保留、条件失效规则或具体终局内容。

### D-SETTLEMENT3 六类核心终局摘要

- `DECISION`: `A_SIX_CORE_SUMMARY_SECTIONS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 终局生涯卷宗固定包含六类摘要：终局事实；身份与最高序列；能力成长；组织与关键关系；资产、道具与封印物；重大事件时间线、结局称号及传记。
- 页面不展示统一总分，也不默认倾倒整局原始行动日志；每类摘要只读取终局快照和经过规则筛选的关键记录。
- 详细字段、重大事件筛选算法、称号条件和档案存储结构在数值内核完成后继续设计。

### D-RESOLUTIONBOUNDARY 转盘仅用于战斗，正常情况使用判定

- `DECISION`: `ROULETTES_COMBAT_ONLY_NONCOMBAT_USES_CHECKS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确纠正“只要战斗系统用转盘，正常情况走的是判定”。
- 行动次数盘、能力盘、胜负盘和战斗内明确子转盘只存在于战斗系统。
- 日常行动、探索、仪式、调查、交涉、资源归零等非战斗情境使用已经锁定的单次判定体系，不以转盘包装或另造随机算法。
- 同一能力在战斗与非战斗中可以有不同的结算入口，但必须共享其权威数值、条件、消耗和效果定义，不能形成两套互相矛盾的能力。
- 健康归零“生存转盘”仅适用于战斗内健康归零；非战斗健康归零必须依据具体来源执行相应判定与后果。

### D-COMBAT6G2 精神归零按具体原因结算

- `DECISION`: `CAUSE_SPECIFIC_NO_UNIVERSAL_MENTAL_ZERO_WHEEL`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确纠正“看是什么清空”。
- 精神降至0没有一个跨所有来源通用的“精神崩溃/失控转盘”；恐惧、污染、催眠、能力反噬、长期压力等来源可以要求不同属性、难度和后果。
- 非战斗来源必须使用普通判定；战斗来源只能通过战斗系统中已声明的效果或子转盘结算。
- “普通人崩溃、非凡者失控”等结果只能在具体来源或统一归零后果词条中明确触发，不能仅因精神数值为0而由系统猜测。
- 本决定尚未锁定具体来源的归零结果档位、难度与后果内容。

### D-ZERO1 资源归零来源必须显式声明后果

- `DECISION`: `A_EXPLICIT_ON_ZERO_REQUIRED_VALIDATION_FAILS_IF_MISSING`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 任何可能把健康、精神或灵性降至0或继续推入负值的能力、事件、道具、状态或持续效果，都必须显式声明对应的 `onZero` 规则及允许的透支范围。
- `onZero` 至少必须声明发生情境（战斗/非战斗）、是否判定、判定属性与难度（若有）、各结果对应后果，以及资源恢复值或终止状态；字段结构稍后统一量化。
- `onZero` 缺失或声明不完整时，内容校验直接失败，该内容不得载入游戏；运行时不得猜测默认后果，也不得交给AI临时决定。
- 战斗中的 `onZero` 可以引用战斗转盘或已声明的战斗子转盘；非战斗中的 `onZero` 必须引用普通判定体系。
- 本决定尚未锁定多项资源同时归零的优先级与嵌套判定规则。

### D-ZERO2 `onZero` 判定统一复用四档结果

- `DECISION`: `A_REUSE_UNIFIED_FOUR_TIERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 凡 `onZero` 声明要求进行概率判定，结果统一使用大成功、成功、失败、大失败四档，不另设二档归零判定或允许来源自创结果档数。
- 四档继续描述解决过程的极端程度与戏剧性，不预设大成功必然有利、大失败必然有害；具体后果仍由清空资源的具体来源逐档声明。
- 不需要概率判定的确定性 `onZero` 可以直接声明结果，不为形式统一而强制掷骰。
- 本决定尚未锁定同一来源同时清空多项资源时的结算方式。

### D-ZERO3 具体清空来源拥有归零难度规则

- `DECISION`: `A_SOURCE_OWNS_DIFFICULTY_RULE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每个需要判定的 `onZero` 都由导致资源归零的具体来源显式声明 `difficultyRule`，不按健康、精神、灵性设置跨来源统一难度。
- `difficultyRule` 可以是同一0—500刻度上的固定整数，也可以是读取已声明权威字段的确定性公式，例如效果强度、施加者位阶或已生效层数；最终必须得到可复现的整数难度。
- 系统不得只按本次资源损失量自动猜测难度，也不得让AI在运行时生成难度。
- 内容校验必须验证公式引用字段存在、结果可计算且处于合法刻度；具体允许引用的字段白名单随效果量化结构统一设计。
- 本决定尚未锁定不同来源在同一行动内分别造成资源归零时的效果队列顺序。

### D-ZERO4 同一来源同时清空多项资源只进行一次联合结算

- `DECISION`: `A_SINGLE_SOURCE_COMBINED_ON_ZERO`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 同一个能力、事件、道具、状态或持续效果在同一次结算中使两项或三项资源同时归零时，该来源必须声明一个联合 `onZero`。
- 联合 `onZero` 最多进行一次概率判定，并由同一四档结果统一映射所有归零资源的后果；不得为每项资源重复掷骰、重复触发同一来源。
- 来源具备多资源归零能力却缺少联合规则时，内容校验失败，不允许载入。
- 若联合结果包含玩家死亡，立即结束游戏；其他尚未结算的归零后果只进入终局事实记录，不再改变已结束的周目。
- 本决定尚未锁定多个不同来源在同一行动中依次归零时的队列优先级；该边界留到统一效果结算顺序设计。

### D-RECOVERY1 资源恢复嵌入日常行动按钮

- `DECISION`: `DAILY_ACTION_EMBEDDED_RESOURCE_EFFECTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确纠正“这些的恢复都得设计在日常的按钮里顺便做了恢复”，并要求查看参考。
- 第一版不设脱离生活内容的统一恢复页面，也不采用每周无条件回满或三项资源统一百分比恢复。
- 健康、精神、灵性的基础恢复进入具有对应生活含义的日常行动副效果；用户已锁定休养可以同时恢复三项，其他按钮是否恢复某项资源仍按其具体职责确认。
- 并非每个按钮都必须恢复资源：具体行动可以恢复、消耗或不改变某项资源，必须符合行动内容与当周情境。
- 状态、道具、能力和事件仍可提供有明确来源的周期恢复或即时恢复，但不得伪装成无来源的系统自然回血。
- 每个日常按钮最终必须从统一行动定义读取资源效果、条件与日志，不允许像参考实现一样让注释、界面文案和实际代码数值互相矛盾。
- 本决定尚未锁定玩家在点击按钮前能看到资源变化的精确程度，也未锁定第一版日常按钮清单与各按钮恢复数值。

### D-RECOVERY2 点击前显示趋势，结算后显示准确变化

- `DECISION`: `A_QUALITATIVE_PREVIEW_EXACT_POST_RESULT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 日常行动按钮在执行前显示角色能够合理预期的资源变化趋势，例如“精神↑”“灵性可能↓”“健康风险”，不预先展开所有随机数值与概率。
- 已知且必付的固定成本仍须显示精确值，避免玩家在信息不完整的情况下误提交；随机幅度、判定分支与未知副作用只显示角色当前能识别的部分。
- 行动完整结算后，日志必须逐项显示健康、精神、灵性的准确变化量、来源和最终值；隐蔽效果只有在角色实际察觉后才进入可见日志。
- 趋势提示必须由同一行动效果定义自动生成，不能另写一套可能与实际结算不一致的按钮文案。
- 本决定尚未锁定日常按钮采用全部固定、全部动态，还是少量固定核心加情境按钮的结构。

### D-ACTIONS1 固定核心按钮加情境按钮

- `DECISION`: `A_FIXED_CORE_PLUS_CONTEXTUAL_ACTIONS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 日常行动区保留少量稳定的核心按钮，使玩家每周始终有可理解、可规划的生活行动入口。
- 序列能力、身份、职业、组织、地点、线索、人物关系、状态和事件可以追加情境按钮；情境条件消失后对应按钮退出，不挤占固定核心按钮的语义。
- 固定核心按钮负责通用生活循环，情境按钮负责《诡秘之主》世界中的特殊机会与风险；不能把所有非凡内容永久堆成一排灰色按钮，也不能让整个行动区每周完全变样。
- 按钮来源、解锁条件、资源趋势和消耗都必须由统一行动定义生成；查看档案、日志和已知信息仍不属于消耗行动的按钮。
- 第一版固定核心按钮的数量、名称和职责已由 `D-ACTIONS2` 锁定；情境按钮仍按条件动态出现。

### D-ACTIONS2 第一版日常行动职责与固定按钮

- `DECISION`: `FOUR_CORE_WORK_LEARN_INVEST_REST`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确城市切换属于新地图，第一版可以不做。
- 第一版固定核心按钮为：工作、学习、调查、休养；每周可用行动次数由 `D-CORE2` 的动态行动力决定，不等于按钮数量。
- 工作用于获得货币；学习用于获得非凡知识并增长知识属性；调查是推动剧情的主要手段，并可在内部触发普通判定与战斗；休养同时承担健康、精神、灵性恢复。
- 城市切换、地图切换和旅行流程不属于第一版按钮；未来地图版本另行开启 `D-CITYTRAVEL*` Grill。
- 拜访不再是独立固定按钮，社交通过调查、事件和其他情境行动发生；如果未来出现特定人物拜访，应作为情境按钮或事件入口，而不是复活固定拜访按钮。
- 非凡能力、组织任务、线索分支、仪式和其他特殊内容继续通过情境按钮进入，不需要变成永久固定按钮。

### D-VISIT1 不设独立拜访按钮

- `DECISION`: `C_NO_VISIT_BUTTON_SOCIAL_VIA_EVENTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择 `Q6C`。
- 第一版不保留固定“拜访”行动；人物关系与社交通过调查目标、事件选项、组织入口和满足条件后出现的情境按钮实现。
- 该决定只取消固定按钮，不禁止玩家拜访具体人物；具体拜访必须由事件条件、关系、地点、时间和目的驱动，并产生可追踪后果。

### D-CITYTRAVEL1 用城市切换按钮替代拜访按钮

- `DECISION`: `DEFERRED_V1_NO_CITY_MAP`
- `CONFIRMED_BY_USER`: 2026-08-29，用户说明城市切换会切换到新的地图，第一版可以不做。
- 城市切换不作为第一版第五个固定核心按钮；第一版只保留工作、学习、调查、休养四个固定按钮。
- 未来重新开启地图版本时，才设计目的地、旅行准备、费用、路程、抵达时间和事件；其他国家仍遵守“后续更新”的范围决定。

### D-WORK1 工作收入不是固定数值，并随产业规模变化

- `DECISION`: `CURRENCY_INCOME_NONFIXED_SCALES_WITH_INDUSTRY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确指出工作是获取货币的方式，收入不应为固定数量，而取决于玩家的产业规模。
- 工作行动的收入必须读取玩家当前产业规模及其有效状态，不能给所有角色发放相同固定货币。
- 产业构成、规模刻度、经营成本、波动、职业收入是否另算和最终收入公式仍未锁定。

### D-LEARN1 学习非凡知识并增长知识属性

- `DECISION`: `EXTRAORDINARY_KNOWLEDGE_AND_KNOWLEDGE_GROWTH`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确指定学习行动用于学习非凡知识并增加知识属性。
- 学习必须产生具体已获得的非凡知识记录；知识属性增长不能替代配方、仪式、真名、历史秘密等具体知识条目。
- 学习材料来源、判定难度、每次知识成长量、污染风险和重复学习规则仍未锁定。

### D-INVEST1 调查是剧情主推进入口

- `DECISION`: `PRIMARY_STORY_DRIVER_CAN_TRIGGER_CHECKS_AND_COMBAT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确指定调查是推动剧情的主要手段，情境判定与战斗都可以在调查中触发。
- 调查按钮负责选择当前可调查目标并推进线索或剧情阶段；调查内部的普通不确定行动使用通用判定，实际进入战斗时才切换战斗转盘。
- 调查不能保证每次都推进主线；具体结果仍由线索、能力、条件、判定和世界状态决定。

### D-ACTING1 日常行动可触发扮演进度，调查权重更高

- `DECISION`: `CONTEXTUAL_TRIGGER_INVESTIGATION_HIGHER`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确指出这些日常行动都能触发扮演进度，但调查给予的扮演进度更高。
- 扮演进度必须由行动内容是否符合当前魔药的扮演原则触发，不因点击按钮名称而无条件增长。
- 在同等契合度和风险条件下，调查类行动的扮演进度基础收益高于其他日常行动；具体公式、上限与各序列差异尚未锁定。

### D-REST1 休养恢复三项当前状态，不恢复核心体魄

- `DECISION`: `B_HEALTH_MENTAL_SPIRITUALITY_NOT_PHYSIQUE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户在 `Q2` 选择 `b`。
- 用户所说休养恢复“体质”，在权威数值中解释为恢复当前健康、精神和灵性三项状态。
- 休养不会直接提高或修复0—500的核心体魄属性，也不新增一项独立体力资源。
- 第一版只有一个“休养”按钮，一次执行同时恢复健康、精神和灵性；不是三个独立恢复按钮。
- 三项恢复量按序列/位格与生活档位查基础表，再应用当前状态修正，最后由明确事件覆盖或追加并记录来源（`D-RECOVERYVALUES1..2`）；具体表值和负值回补仍后置。

### D-INDUSTRY1 每项产业独立记录类型与1—5级规模

- `DECISION`: `A_INDEPENDENT_ASSET_TYPE_AND_SCALE_1_TO_5`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每项玩家产业都是独立资产记录，至少包含产业类型与1—5级规模；玩家可以同时拥有多项不同或同类产业。
- 工作行动汇总当前仍有效经营的各项产业规模计算收入，不把全部产业压成一个全局规模值，也不只按持有数量直接发固定收益。
- 规模等级只表示经营体量，不直接等同于净利润；产业基础产出、经营状态、成本、风险、升级费用与工作收益公式仍需逐项锁定。

### D-ECON0 金钱是贯穿日常与非凡成长的核心资源

- `DECISION`: `CENTRAL_GAMEPLAY_RESOURCE_ORIGINAL_ECONOMY_ANCHORED`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求设计好经济系统，并强调金钱很有用、必须注意原著。
- 金钱必须同时服务普通生活与非凡成长：居住、食物、交通、衣物、学习、治疗、情报、关系维护、贿赂、产业经营、仪式耗材、武器、非凡材料、配方、神奇物品、黑市和拍卖会都可以形成有来源的收支。
- 经济压力不能只在前期存在，也不能靠产业后自动失效；高收入阶段应对应更高的身份成本、经营成本、隐秘活动成本和稀缺非凡商品需求。
- 金钱不是万能通行证：稀缺物品还受渠道、知识、身份、风险、卖方意愿与真假影响，有钱不保证能够买到。

### D-ECONREF1 鲁恩经济与非凡商品的原著工作基准

- `READ_ONLY_AUDITED`: 2026-08-29。官方IP站确认作品与世界范围；授权周边信息与社区逐章索引共同确认鲁恩换算为1金镑=20苏勒、1苏勒=12便士，即1金镑=240便士。
- 社区逐章价格表显示普通经济主要以周为节拍：底层劳动者周收入为数苏勒，普通工人约1镑，高级文员约1镑10苏勒，政府雇员或新值夜者文职约3镑，正式值夜者约6镑；住房从东区廉价床位/单间的便士与数苏勒，到联排住宅每周约12—16苏勒不等。
- 同一逐章索引显示非凡商品跨越多个数量级：序列9配方约200—230镑、主材料常为每件150—200镑、特性约300—400镑；序列7主材料常为每件500—700镑，相关神奇物品约1500—3500镑。具体物品会因稀缺性、负面效果、真假与交易急迫度显著偏离。
- 上述价格表是带章节脚注的社区二手索引，足以建立初版比例但不升级为最终原著逐字证据；每个进入正式平衡表的具体价格仍须由合法原著语料RAG或用户提供的原文位置进行精确复核。
- `ORIGINAL_ANCHOR_RECHECK_2026-08-29`: 第一卷第三十章对应资料给出廷根莫雷蒂家旧居每周5苏勒6便士，新联排住宅为12苏勒另3便士家具费；一家三口搬家后的生活核算与单人房租不能混为同一口径。
- `ORIGINAL_ANCHOR_RECHECK_2026-08-29`: 贝克兰德乔伍德区相关章节明确把每周房租、食物、水煤气木炭与交通的最低合计描述为2镑5苏勒，周薪3镑仅勉强维持；这说明城市、居住区和身份体面要求会显著改变同一档生活成本。
- `ORIGINAL_ANCHOR_RECHECK_2026-08-29`: 更高阶层住房从每周约3镑的花园住宅跨到年租1260镑的豪宅，奢华生活不能只按普通生活费做很小的线性加成。

### D-ECON1 货币底层统一存储为便士整数

- `DECISION`: `A_INTEGER_PENCE_INTERNAL_COMPOSITE_DISPLAY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 所有收入、支出、报价、资产现金与结算均使用非浮点的便士整数；1苏勒固定等于12便士，1金镑固定等于240便士。
- 界面根据金额自动组合显示金镑、苏勒与便士，避免小数金镑破坏原著货币表现，同时确保食物、房租等小额支出和非凡物品大额交易都能精确计算。
- 存档与算法只保留一个权威金额字段；显示换算不是第二套余额，禁止三种面额分别记账造成不一致。

### D-ECON2 基础生活开销按生活档位每周自动结算

- `DECISION`: `A_WEEKLY_LIFESTYLE_TIER_AUTO_SETTLEMENT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 玩家持有一个当前生活档位；每周推进时自动扣除该档位对应的基础生活开销，避免每周重复手动购买住房、食物与基本交通。
- 玩家可以主动调整生活档位；档位的具体数量、费用、包含项目、效果与资金不足后果继续逐项 Grill，当前不得擅自补全。
- 特殊剧情消费、非凡活动、额外治疗、情报、社交与购买物品不包含在基础生活费内，仍须单独支付。

### D-ECON3 初版采用五档生活水平

- `DECISION`: `C_FIVE_TIERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `c`。
- 初版生活水平固定为五档：赤贫、贫困、普通、体面、奢华。
- 五档的确切每周费用、包含项目、增益、惩罚、切换条件以及付不起费用时的处理继续逐项 Grill；当前只锁定数量与名称。

### D-ECON4 生活费打包必要日常开销

- `DECISION`: `A_CORE_DAILY_BUNDLE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每周生活费统一包含当前档位对应的住房、基础饮食、衣物维护与普通市内交通，不再对这些常规项目重复扣费。
- 医疗、额外社交宴饮、长途旅行、情报、贿赂、产业经营、剧情性消费和全部非凡消费不属于生活费，必须单独结算。
- 具体周费用、档位效果以及临时高档消费能否不改变长期档位继续逐项确认。

### D-ECON5 生活费采用五档基础费用乘地区消费系数

- `DECISION`: `A_BASE_COST_TIMES_LOCATION_INDEX`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每个生活档位拥有一项以便士表示的鲁恩基础周费用；玩家实际周费用由基础周费用乘所在城市／城区的消费系数得出，并最终取整为便士。
- 城市与城区配置保存消费系数，使廷根、贝克兰德及其不同城区能表现原著中的生活成本差异；不得把全鲁恩压成同一价格。
- 初版不为每座城市复制一整套五档表；明显不适合统一系数表达的特殊住宅、旅馆、庄园及剧情消费仍作为独立价格处理。

### D-STARTCITY1 首版标准开局城市为贝克兰德

- `DECISION`: `B_BACKLUND`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 首版标准新游戏从鲁恩首都贝克兰德开始；首套职业收入、生活成本、城区系数、黑市、调查与社会身份内容以贝克兰德为主要落地环境。
- 本决定只锁定开局城市，不删除廷根等其他鲁恩地区，也不保证首版同时提供另一套完整开局；后续旅行范围另行设计。
- 贝克兰德内容量更大，后续设计必须通过城区与系统化事件复用控制初版范围，不能因为选定首都就默认承诺整座城市的全部原著地点和组织。

### D-ECONHOUSE1 生活档位只结算玩家个人

- `DECISION`: `B_PLAYER_ONLY_FAMILY_SEPARATE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 五档生活水平的基础周费用只代表玩家本人维持当前住房、饮食、衣物与普通市内交通的开销，不按家庭人数自动倍增。
- 赡养家人、定期寄钱、共同租住、家庭债务和突发开支作为独立义务或事件结算；它们不得被生活档位暗中重复扣除。
- 玩家与家人共同生活时，具体住房优惠或共同负担只能由明确背景／状态修正表示，不能默认把全家的原著开销误算成主角个人生活费。

### D-ECON6 贝克兰德基准城区五档个人周生活费

- `DECISION`: `A_ORIGINAL_SCALE_BACKLUND_BASE_TABLE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 在消费系数1.0的贝克兰德基准城区，个人每周生活费固定为：赤贫2苏勒6便士（30便士）、贫困10苏勒（120便士）、普通1镑5苏勒（300便士）、体面2镑10苏勒（600便士）、奢华25镑（6000便士）。
- 实际扣款为该便士基价乘玩家所在城市／城区消费系数后取整到便士；特殊住宅、旅馆、庄园与剧情合同仍可使用独立价格。
- 价格阶梯刻意保留原著的非线性跨度：东区生存、廉价个人居住、普通生活、乔伍德式体面生活与高档豪宅生活不可压成近似等差数列。
- 本表是以原著明确价格锚点建立的初版平衡基线，后续测试可提出调整，但任何调整必须保留对应锚点、理由与账本修订记录。

### D-ECON7 生活档位通过事件影响恢复、普通风险与身份场景

- `DECISION`: `A_EVENT_DRIVEN_RECOVERY_RISK_SOCIAL_ACCESS_NO_DIRECT_POWER`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- `REFINED_BY_USER`: 2026-08-29，用户明确指出这些内容之后都必须制作成事件，不能只标记一个“身份可信度”。
- 生活档位可以影响休养行动的健康与当前灵性恢复效率，并改变普通疾病、卫生和治安类事件的触发权重。
- 住房、衣着和生活状况必须通过房东、邻居、雇主、店员、守卫、社交邀请、疾病、盗窃、盘查等具体事件及NPC反应被玩家感知；不得以单一“身份可信度”标签、静态提示或纯数值门槛代替这些内容。
- 底层条件和权重可以引用住所、衣着、职业、关系、已知身份与生活档位，但它们只负责选择／修正事件，不新增可刷取的“交际”属性，也不能成为玩家看到的全部结果。
- 生活档位不直接增加体魄、感知、意志、知识、位格、核心能力权重、战斗胜率或序列能力强度；高消费不是购买直接战斗力。
- 每一档的具体恢复倍率、风险权重与准入清单后续进入数值表逐项校准，当前只锁定作用域。

### D-ECONEVENT1 经济与生活系统采用事件优先表现

- `DECISION`: `EVENTS_NOT_STATUS_LABELS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求“之后都是要做事件的，不是标记个身份可信度就行的”。
- 生活降档、付不起房租、债务、失业、产业波动、黑市交易后果、消费带来的身份变化以及普通生活风险，都必须拥有可触发的事件内容；事件可以包含选择、判定、资源变化、NPC反应、后续标记与延迟结果。
- 状态、标签、权重和数值只作为事件系统的后台输入、条件或持久结果，不能被当成已完成的玩家体验。
- 初版允许多个事件复用同一数据化模板，但必须呈现与具体人物、地点、原因和后果匹配的文本及选项，不能只弹出“可信度+1”“生活风险-10%”。

### D-ECON8 资金不足触发情境化财务危机事件

- `DECISION`: `A_CONTEXTUAL_FINANCIAL_CRISIS_EVENT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 周结算无法支付当前生活费时，不允许静默透支、后台自动负债或无提示自动降档；必须触发财务危机事件。
- 事件可提供协商房租、典当／出售物品、借款、向关系人物求助、降低生活档位等路径，但每个选项必须由当前房东／债权人、关系、物品、渠道、住所和身份条件决定是否出现。
- 每条选择必须产生明确即时结算及可追踪后续：例如欠款期限、物品失去、关系变化、搬迁、债权人追索或新的调查／委托；不能把选择压成无后续的金钱加减。
- 若所有可行方案均失败，进入更严重的失去住所、饥饿、疾病、违法或求生事件链；最终生存判定失败仍可死亡并结束本局，但不得因一次余额不足直接无事件地判死。

### D-ECON9 生活档位通过搬迁与置办事件改变

- `DECISION`: `A_EVENT_RELOCATION_SETUP_COST_NEXT_WEEK`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 玩家主动升降生活档位时必须触发与当前城市、城区、房东、住所和身份匹配的找房、退租、搬迁及置办事件，不能在面板免费即时切换。
- 切换可以产生押金、预付租金、违约金、家具／衣物置办、搬运及关系后果等一次性成本；实际可用选项和价格由事件条件给出。
- 新生活档位从下一周生活费结算起生效；搬迁事件当周产生的即时收益与损失单独结算，不重复收取整周新档费用。
- 押金比例、退还条件和违约规则后续进入住房／合同数值表，不在本决定中擅自固定为统一倍数。

### D-DEBT1 首版只记录债务总额与固定周还款

- `DECISION`: `B_AGGREGATE_TOTAL_AND_FIXED_WEEKLY_PAYMENT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 首版经济账本只维护权威的债务总额（便士整数）与每周固定应还额，不为每笔借款分别建立债权人、抵押物、期限和利率合同对象。
- 借款来源、催款人、求助关系和违约后果仍由事件历史及后续事件表达；单一债务数值不得取代玩家可见的催款、协商和追索内容。
- 新增借款、额外费用与已还款分别增减同一个债务总额；债务不得低于零，清偿后每周应还额归零。
- 利息／费用如何进入总额、每周扣款顺序及余额不足后果尚未锁定，继续逐项确认。

### D-DEBT2 每周自动还款且余额不得为负

- `DECISION`: `A_AUTO_DEDUCT_NO_NEGATIVE_DEFAULT_EVENT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 周结算自动尝试从玩家现金扣除每周固定应还额，实际扣款不得超过剩余债务总额；清偿后债务与周应还额同时归零。
- 现金不足时禁止把余额扣成负数，也不静默跳过；必须触发符合当前债务事件背景的催款、延期、协商或违约后续事件。
- 违约事件可以改变债务总额、固定周还额或其他状态，但必须显示原因与后果，不能只在后台修改数字。
- 债务与生活费等周义务的结算顺序仍需单独锁定，避免用代码顺序暗中决定玩家先还债还是先生活。

### D-DEBT3 借款费用一次性计入且不滚动计息

- `DECISION`: `ONE_TIME_FEE_NO_ROLLING_INTEREST_BY_SCOPE_DIRECTIVE`
- `RESOLVED_BY_USER_SCOPE_DIRECTIVE`: 2026-08-29，用户要求“这块简单设计就可以，主要的目标不是生活”。
- 为保持单一债务总额模型，借款事件在发生时把本金与明确的一次性费用加入债务总额；之后不再按周滚动计息或计算复利。
- 熟人借款、正规借款与高风险借款可以由事件给出不同的一次性费用和后果，但首版不建立多债权人利率账本。
- 逾期新增费用只能由明确违约事件一次性写入并向玩家说明，不能后台无限滚息。

### D-ECONSCOPE1 生活与债务只是轻量支撑系统

- `DECISION`: `LIGHTWEIGHT_SUPPORT_NOT_PRIMARY_LIFE_SIM`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确指出生活部分只需简单设计，游戏主要目标不是生活模拟。
- 生活费、搬迁和债务保留必要的金钱压力与事件接口，但不继续扩展逐项饮食、家庭人头账、复杂合同、复利和日常琐事模拟。
- 经济设计的主要投入转向工作／产业收入、调查准备、非凡知识与材料、黑市、拍卖会、神奇物品及由这些交易产生的剧情事件。
- 已锁定的“经济后果必须事件化”仍然有效；轻量化表示减少规则数量与内容深度，不是用纯标签替代事件。

### D-WORK2 工作同时结算职业与全部有效产业收入

- `DECISION`: `A_COMBINED_ALL_SOURCES_ONCE_PER_WEEK_WITH_EVENTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 一次工作行动同时结算当前职业的基础工资与玩家全部有效产业的规模收益；没有产业的玩家仍可通过当前职业获得合理收入。
- 每个职业／产业收入源每周最多结算一次，重复点击工作不能重复领取已经结算的来源；额外加班、临时委托或特殊经营机会只能由明确事件另行产生。
- 工作行动必须生成与职业、产业类型、规模、状态、城区和世界局势相符的事件或事件摘要，最终收入与后果在事件结算后一次写入。
- 产业停业、被查封、失去控制或未满足经营条件时不得作为有效来源；具体有效性条件和收益公式继续设计。

### D-WORK3 常规工作收入采用固定公式

- `DECISION`: `B_FIXED_ROUTINE_FORMULA_NO_RANDOM_VARIANCE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 当前职业工资与有效产业的常规收益只按已公布公式结算，不增加无背景的随机百分比，也不由随机工作事件改变本周基础金额。
- 具体剧情、委托、事故或经营事件可以独立产生明确的额外收入、损失或状态变化，但必须作为单独事件结算，不能伪装成常规收入公式的暗中波动。
- 工作界面应在结算前显示可预期的固定收入构成，结算后分别列出职业工资、各产业收益及独立事件收支。

### D-INDUSTRY2 产业直接按类型与规模读取固定净收益

- `DECISION`: `B_DIRECT_FIXED_NET_BY_TYPE_AND_SCALE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 每项有效产业的常规周收益直接按产业类型与1—5级规模读取固定净收益，不在首版账面上拆分毛收入、人工、租金与日常经营成本。
- 固定净收益为确定性便士整数；工作结算直接汇总各产业净收益，界面逐项列出来源。
- 事故、查封、扩建、特殊采购、保护费等非常规收支仍由具体事件单独结算，不得悄悄改写固定净收益表。
- 1—5级是共用成长曲线还是由每个产业类型独立配置，继续确认。

### D-INDUSTRY3 产业规模共用中度非线性收益曲线

- `DECISION`: `A_SHARED_1_2_4_7_11_MULTIPLIERS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每种产业先定义一级固定净周收益；规模1—5级分别使用倍率1、2、4、7、11，固定周净收益为一级净收益乘对应倍率。
- 所有计算均使用便士整数，不做随机浮动；倍率表是权威共用配置，不能在各产业代码中散落复制。
- 不同产业仍可通过一级收益、取得／升级成本、进入条件、关联地点和事件内容形成差异；共用曲线不意味着产业只是换名。

### D-INDUSTRY4 产业是具体命名资产

- `DECISION`: `A_CONCRETE_NAMED_ASSETS_FROM_REUSABLE_TEMPLATES`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 玩家持有的每项产业必须保存具体名称、所在城市／城区、产业类型、1—5级规模、固定净收益基数、经营状态及关联事件／人物入口，不能只显示“商业产业3级”。
- 初版使用少量产业模板生成或配置具体资产；模板负责数据结构与通用事件骨架，具体实例必须有符合地点和背景的名称、人物及文本。
- 同一模板可以生成多项不同资产，但资产具有独立状态与事件历史；一项资产出事不能错误影响所有同模板产业。
- 本决定不要求首版一次制作大量完全独立产业，具体首发模板清单后置。

### D-INDUSTRY5 产业通过有条件的取得事件获得

- `DECISION`: `A_CONDITIONAL_ACQUISITION_EVENTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 购买、投资、继承、合作和剧情奖励都可以成为产业来源，但必须通过与具体卖方、合作者、遗产、组织或任务相连的事件完成，不能只在通用菜单按按钮生成资产。
- 可用选项由资金、身份、关系、知识、渠道、地点和前置事件决定；价格由产业类型、规模、城区、经营状态和交易背景给出，不设所有产业通用固定售价。
- 取得事件必须明确玩家最终得到的具体产业实例及其名称、地点、类型、规模、状态和关联人物；未完成交割前不得提前产生周收益。
- 调查、鉴定与谈判可以揭示骗局、隐患或附加义务，但具体判定及后果作为事件内容设计，不在后台随机扣钱。

### D-INDUSTRY6 产业在面板直接付费即时升级

- `DECISION`: `B_DIRECT_PAID_INSTANT_UPGRADE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`，并要求此处不要过度设计。
- 玩家可以在产业面板支付明确升级费用，将具体产业即时提升一级；常规升级不强制插入扩建、招募、许可或并购事件链。
- 产业仍逐级从1升至5，不允许一次付费跳过中间等级；升级后按新的1、2、4、7、11倍率参与下一次尚未结算的工作收益。
- 剧情仍可造成停业、降级、查封或特殊升级机会，但这些是独立事件，不是常规升级的强制流程。
- 各级升级费用需要在产业基础收益和游戏节奏确定后统一配平；当前不继续细分产业经营。

### D-EXTRAORDINARYPRIORITY1 非凡体系是主要设计目标

- `DECISION`: `BEYONDER_SYSTEM_PRIMARY_SUPPORT_SYSTEMS_STOP_AT_MVP`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确指出产业部分不要过度设计，主要设计目标是非凡体系。
- 生活、债务、职业和产业在已有闭环基础上停止继续细分；只有当非凡成长、调查、黑市／拍卖或事件实现暴露必要依赖时才重新开启。
- 后续优先顺序恢复为：统一非凡能力量化结构 → 魔药取得／消化／晋升／失控 → 首发占卜家、观众、猎人序列9—7逐能力量化 → 再扩展其他途径。
- 黑市、拍卖、金钱与产业继续服务配方、材料、神奇物品、情报和调查，不得反过来抢占主要设计篇幅。

### D-ABILITYSCHEMA1 每项原著能力只保留一个扁平权威记录

- `DECISION`: `B_SINGLE_FLAT_ABILITY_RECORD_TEXTUAL_USES`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `b`。
- 一项原著命名能力只建立一个权威能力记录和一个玩家界面条目；其多种运用方式写在该能力的说明与能力专属规则中，不建立能力族、子模式或多个独立技能。
- 同一能力的所有用法共享该能力的0—500掌握度；不得为某种用法暗建第二掌握度或在界面伪装成另一项技能。
- 通用资源消耗、可用条件、判定和战斗参数原则上挂在这一条能力记录上；确有不同用法差异时只能由该能力的专属解析规则处理，并必须有明确测试，不能形成不可追踪的散落特例。
- 此选择优先保持界面和学习结构简洁，但意味着不能独立训练、装备或升级同一能力下的单个用法；若后续原著能力无法可靠表达，必须显式重新开启本决定。

### D-ABILITYSCHEMA2 同一能力分别保存普通判定与战斗参数

- `DECISION`: `A_SHARED_IDENTITY_MASTERY_SEPARATE_CHECK_AND_COMBAT_BLOCKS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每项能力仍是一条扁平权威记录并共享名称、途径、获得序列、说明和0—500掌握度，但在同一记录内分别保存普通情境判定参数与战斗转盘参数。
- 普通判定参数只负责调查、学习、仪式、观察、追踪、社会或其他非战斗情境；战斗参数只负责能力转盘权重、命中后的胜势贡献与特殊效果。
- 两个参数区块可以引用同一掌握度但不得互相冒充：非战斗表现强不自动等于高战斗胜势，战斗能力强也不自动获得所有调查用途。
- 某能力确实不适用于其中一类场景时必须明确标记不适用，不得为填满表格而虚构原著没有的用途。

### D-ABILITYSCHEMA3 每项能力独立声明资源消耗

- `DECISION`: `A_PER_ABILITY_EXPLICIT_NONE_SPIRITUALITY_OR_SPECIAL_COST`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每项能力在同一权威记录中显式声明消耗类型：无消耗、固定灵性消耗或能力专属代价；不按序列给全部能力套统一费用。
- 被动强化、感官变化或不需主动支付资源的能力可以明确为零消耗；主动能力的固定灵性成本在玩家确认使用前显示。
- 专属代价必须明确其资源、状态、物品、时间或事件后果，并由专属规则结算；“未知代价”只能隐藏具体后果，不能省略后台权威定义。
- 资源不足时默认不可执行能力；是否允许灵性透支及透支后果仍由后续独立规则确认，不能由单个能力擅自绕过。

### D-ABILITYSCHEMA4 能力默认目标范围如何表达

- `DECISION`: `LOCKED=A_EXPLICIT_TARGET_SELECTOR_DEFAULT_SINGLE_TARGET`
- `CONFIRMED_BY_USER`: 2026-08-29，用户选择按推荐方案处理。
- 每项能力记录都保存显式目标选择器；未声明特殊范围时默认单一目标。
- 多目标、区域、链式、自己、友军、物件或环境目标必须由能力数据明确声明，不能由事件或 AI 临时猜测；具体目标名单和范围数值留给逐项能力设计。

### D-ABILITYSCHEMA5 能力效果的持续与叠加如何表达

- `DECISION`: `LOCKED=A_IMMEDIATE_DEFAULT_EXPLICIT_DURATION_STACK_POLICY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户要求按推荐方案处理，并强调不要复杂化。
- 能力效果默认即时生效；只有持续效果才填写持续条件/时长与叠加策略（叠加、刷新、替换或拒绝）。
- 持续效果缺少必要生命周期字段时内容校验失败；不建立全局复杂效果事务，普通能力仍直接走统一数值判定，战斗仍走独立转盘。
- 具体能力的持续数值、叠加上限和特殊例外后置到逐项能力设计。

### D-ABILITYMASTERY1 掌握度提升控制与可靠性但不突破序列上限

- `DECISION`: `A_RELIABILITY_CHECKS_COMBAT_WEIGHT_SEQUENCE_POWER_CEILING`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 0—500掌握度可以提高能力在普通情境判定中的有效表现、使用可靠性及战斗能力转盘的权重／稳定性，并可按该能力规则解锁更熟练的原著允许运用。
- 掌握度不统一增加威力、范围、持续时间或降低灵性消耗；这些变化只有原著定位与该能力专属曲线明确允许时才可配置。
- 能力的本质、最大威力、作用层级和可影响目标边界由当前序列／位格及能力定义决定；练满低序列能力不能越过高序列的质变。
- 普通判定和战斗参数可以使用不同的掌握度换算曲线，但必须在能力记录中明确、可测试，不能临场编造。

### D-ABILITYMASTERY2 所有新能力从0掌握度开始

- `DECISION`: `C_ALL_NEW_ABILITIES_START_ZERO`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `c`。
- 每次晋升后新获得的所有能力统一以0／500掌握度写入角色，不按原著本能知识、能力难度或序列分别给予非零起点。
- 原有能力若在后续序列得到强化，是否保留原掌握度、增加新能力记录或改变上限仍需独立确认；本决定只约束首次获得的新能力。
- 0掌握度是否允许使用、使用时的可靠性和能力解锁条件尚未锁定，必须在开始设计具体能力前明确。

### D-ABILITYMASTERY3 0掌握度允许粗糙使用且被动基础效果立即生效

- `DECISION`: `A_ACTIVE_CRUDE_USE_PASSIVE_BASE_EFFECT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 0掌握度的主动能力在获得后即可尝试使用，但处于该能力允许的最低可靠性与最低战斗转盘权重，高阶／精细运用尚未解锁。
- 魔药直接造成的被动身体、感官或本能变化从晋升完成时按该序列基础效果生效；掌握度衡量玩家对其控制、利用和组合运用的水平，而不是决定身体变化是否存在。
- 同一扁平能力记录可以用掌握度门槛说明更熟练的用法，但不得因此创建独立子技能或第二掌握度。
- 0掌握度不是“正常熟练使用”，也不是完全锁死；具体最低可靠性、最低权重和运用门槛由统一曲线及能力专属数据后续量化。

### D-ABILITYMASTERY4 掌握度通过学习、实际运用与战斗多来源成长

- `DECISION`: `MULTI_SOURCE_LEARNING_USE_COMBAT_HIGH_GAIN`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求多种成长方式，并指出学习除增加知识外也可增加熟练度，战斗应大幅提升熟练度。
- 学习行动可以同时产生非凡知识成长与能力掌握度成长；两项变化分别记录，知识属性不等于掌握度。
- 调查、仪式或其他非战斗情境中真实运用能力可以增加对应掌握度；纯文本声称“练习”不能绕过行动和事件结算。
- 战斗是高强度成长来源，其生成的熟练度收益应明显高于常规学习和低风险运用；具体增长目标按后续已锁定的全技能随机池抽取，因此允许未在本场使用的能力或普通技能获得该笔成长。
- 扮演进度与魔药消化继续作为独立成长轴，不自动按比例转换为能力掌握度；具体增长对象、数值和单周限制继续确认。

### D-ABILITYMASTERY5 熟练度收益随机分配给能力

- `DECISION`: `C_RANDOM_ABILITY_ALLOCATION`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `c`。
- 学习、调查或战斗结算产生能力掌握度收益时，不由玩家直接指定目标，也不让当前全部能力同步增长；系统从后续锁定的候选池中随机选定一项能力获得该笔成长。
- 每笔成长必须在结果中显示被选中的能力与增加值，随机结果写入存档／事件日志，禁止重新打开界面反复抽取。
- 被动能力是否进入候选池、战斗中未实际使用的能力是否可被抽中，以及随机权重是否等概率，继续独立确认。

### D-ABILITYMASTERY6 随机池包含全部已知非凡能力与普通技能

- `DECISION`: `C_ALL_KNOWN_BEYONDER_ABILITIES_AND_ORDINARY_SKILLS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `c`。
- 每笔学习、调查或战斗产生的熟练度收益，从角色当前全部已知非凡能力与全部普通技能构成的统一候选池中随机选择一项获得，不要求目标与本次行动主题或实际使用内容相关。
- 被动能力、未在本场使用的能力及普通技能都可以被抽中；尚未获得／未知的能力不得提前进入候选池。
- 本决定覆盖此前“战斗只奖励实际使用能力”的建议性限制；战斗只决定生成较大的熟练度收益包，不决定该收益最终落在哪项技能。
- 候选项采用等概率、偏向低掌握度还是偏向高掌握度，继续确认；抽取必须持久化且不可重抽。

### D-ABILITYMASTERY7 随机抽取偏向低掌握度技能

- `DECISION`: `A_LOW_MASTERY_HIGHER_WEIGHT`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 全技能候选池不是等概率；掌握度越低，获得下一笔随机熟练度成长的抽取权重越高，接近500的技能权重越低。
- 权重只影响本次成长落点，不改变成长数值，也不直接改变普通判定或战斗能力权重。
- 已到500的技能不得继续吸收熟练度；具体采用分档权重、线性反比还是其他简单公式继续确认。

### D-ABILITYMASTERY8 熟练度随机池使用五档抽取权重

- `DECISION`: `A_FIVE_BAND_5_4_3_2_1_ZERO_AT_500`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 候选技能按当前掌握度分档赋权：0—99权重5，100—199权重4，200—299权重3，300—399权重2，400—499权重1，500权重0并退出候选池。
- 抽取概率为该技能权重除以当前候选池全部权重总和；普通技能和非凡能力使用同一权重规则。
- 权重只在生成并持久化该笔熟练度收益时计算一次；结果确定后，即使其他技能数值变化也不得追溯重抽。

### D-ABILITYMASTERY9 学习、调查与战斗使用固定熟练度收益包

- `DECISION`: `A_FIXED_5_8_25_PER_SOURCE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 完成一次有效学习行动生成5点熟练度收益包；调查／非战斗情境中发生一次有效能力运用结算生成8点；完成一场有效战斗生成25点。
- 每个收益包独立按已锁定的全技能候选池与5/4/3/2/1权重随机选择一项技能，整包加到该技能，不在多项技能间拆分。
- 战斗无论回合数、能力触发次数和最终胜负，每场最多生成一次25点收益包，避免故意拖长战斗刷取；大成功或大失败不自动改变熟练度数值。
- 增长后掌握度最高为500；接近上限时超出部分如何处理、同周可以生成多少收益包继续确认。
- `gmzz` 当前公开经营数值是组织级抽象单位，不对应个人周薪、房租与非凡商品的原著价格，不能直接迁入本项目。
- 本决定尚未锁定游戏内部货币存储单位、生活成本结算、产业收入公式、通胀/波动、黑市定价和拍卖机制。

### D-ABILITYMASTERY10 同周每个有效来源都可生成熟练度收益

- `DECISION`: `A_EVERY_VALID_SOURCE_NO_WEEKLY_CAP_REPEAT_FARMING_INELIGIBLE`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 同一周不设置熟练度收益包总数硬上限；每次完成有效学习行动、调查／非战斗能力运用结算或有效战斗，都按5／8／25规则生成独立收益包。
- 学习行动只要真实消耗本周主要行动并完成结算即可有效；调查或战斗若是重复触发同一低风险内容、无新代价／威胁／信息的刷取行为，则标记为不生成熟练度。
- 每笔收益分别持久化抽取目标，不能把多笔收益合并后只抽一次，也不能靠回档或重复打开重抽。
- 接近500时超出上限的点数如何处理继续确认。

### D-ABILITYMASTERY11 熟练度达到500后溢出点数直接作废

- `DECISION`: `A_CAP_AT_500_DISCARD_OVERFLOW`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 单项技能熟练度上限固定为500；收益包结算后若超过500，只把该技能提升至500，超出部分直接作废。
- 溢出点数不转移给其他技能，也不使整笔收益重新抽取，避免一笔收益触发连续随机与额外成长。
- 例如熟练度490获得25点时，最终为500，剩余15点作废。
- 下一步确认熟练度与四项基础属性如何共同形成普通判定值，再确定具体换算曲线。

### D-ABILITYMASTERY12 普通判定由相关基础属性加熟练度加成构成

- `DECISION`: `A_BASE_ATTRIBUTE_PLUS_MASTERY_BONUS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 涉及普通技能或非凡能力的情境判定，先选定该行为对应的相关基础属性，再由该项技能熟练度提供额外加成。
- 熟练度不替代基础属性，也不与基础属性取较高值；同一技能由不同运用方式触发时，可以由事件指定不同的相关基础属性。
- 最终有效能力值继续接入已锁定的通用判定公式；熟练度加成的具体换算强度下一步确认。
- `SUPERSEDED`: 用户随后指出通用数值加成会转化为成功率并削弱序列差距；本节的“熟练度数值加到基础属性”部分不再生效，以 `D-ABILITYMASTERY13` 为准。

### D-ABILITYCONTENT1 每项非凡能力必须逐项设计实际效果

- `DECISION`: `INDIVIDUAL_EFFECT_DESIGN_REQUIRED`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确强调每个技能之后都要单独设计效果，属于后续主要工程。
- 底层数值、判定与熟练度规则只提供公共骨架，不得据此批量生成同质化能力，也不得把熟练度加成当作能力实际效果。
- 后续必须按序列逐项建立能力记录，分别确定普通情境效果、战斗转盘效果、消耗、限制、特殊规则以及随熟练度或更高序列发生的变化。
- 各序列成长曲线和能力表现允许不同；具体能力设计必须逐项经过用户确认后才能锁定。

### D-ABILITYMASTERY13 熟练度不提供通用成功率或有效能力值加成

- `DECISION`: `NO_UNIVERSAL_PERCENTAGE_OR_EFFECTIVE_VALUE_BONUS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确否定熟练度直接增加百分比，指出这会让序列9不合理地威胁高序列。
- 作废“每若干熟练度统一增加成功率”以及“把熟练度统一换算后加到基础属性”的方案。
- 序列／位格继续决定能力强度上限和跨序列对抗基础；低序列不能仅靠把熟练度练满就抹平高序列的位格差距。
- 熟练度仍须体现掌握程度，但改为怎样影响能力效果、稳定性或战斗技能转盘，下一步确认。

### D-ABILITYMASTERY14 熟练度逐项改变能力掌握效果但不能跨越位格

- `DECISION`: `A_PER_ABILITY_CUSTOM_EFFECTS_WITH_POSITION_CAP`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 每项能力必须单独定义熟练度成长效果，可改变灵性消耗、控制精度、持续时间、作用范围、负面风险或高级用法；不设置跨能力通用的成功率加成。
- 并非每项能力都必须同时改变上述全部维度，应只选择符合原著表现和该能力用途的项目。
- 序列／位格始终规定效果强度与可对抗目标的硬上限；满熟练度只表示充分掌握当前能力，不能把低序列能力提升成高序列能力。
- 战斗技能转盘仍可按已锁定规则受掌握度影响，但最终胜负还必须受序列／位格、核心能力、状态与先手共同约束。
- 下一步确认逐项效果是否共享统一的熟练度阶段阈值。

### D-ABILITYMASTERY15 所有能力共用五个熟练度成长节点

- `DECISION`: `A_COMMON_100_200_300_400_500_MILESTONES_CUSTOM_EFFECTS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户回复 `a`。
- 所有普通技能与非凡能力统一在熟练度100、200、300、400、500设置成长节点，便于玩家理解、界面展示和内容校验。
- 统一的只有节点位置；每项能力在各节点提升什么、是否出现质变、改变哪个使用维度，仍须按能力逐项设计。
- 500节点只代表当前能力的圆满掌握，不自动提升序列、位格或能力本质。
- 后续能力内容表必须明确填写五个节点的效果；若某节点不产生新机制，也要声明该节点强化的既有效果，不能留空后临场生成。

### D-MARKET1 黑市支持上架、购买与出售物品

- `DECISION`: `PLAYER_LIST_BUY_AND_SELL`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求加入黑市，允许玩家上架并买卖物品。
- 黑市作为独立交易入口，至少支持查看商品、购买、把玩家物品挂牌出售和成交结算。
- 交易对象由NPC模拟还是需要其他来源、挂牌时长、手续费、价格形成、赃物与风险、是否消耗每周行动仍未锁定。

### D-AUCTION1 每三个月举行一次珍稀物品拍卖会

- `DECISION`: `EVERY_THREE_MONTHS_RARE_ITEMS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户明确要求每3个月举行一次拍卖会，并出现珍稀物品。
- 拍卖周期按游戏内月份计算，每三个月开启一次；拍卖品池必须包含普通黑市不稳定出现的珍稀物品。
- 拍卖竞价方式、NPC竞争、起拍价、保证金、流拍、赝品与风险规则尚未锁定。

### D-COMBATREF1 “咒术转盘特别篇”宿傩对战参考审计

- `SOURCE`: https://www.bilibili.com/video/BV1Ki876qEKm/
- `TITLE`: 《咒术转盘特别篇：麻辣教师五条的完美人生！》；2026-08-29实际查看约09:07—11:52的宿傩对战段落。
- 可借鉴流程：先抽出招次数；双方分别抽取能力；命中技能增加己方胜率、降低敌方胜率或触发条件效果；条件效果可以开启小型子转盘；汇总后生成只有双方胜负两块的胜率转盘。
- 可借鉴状态性：重复出招、技能组合、复活/再战修正和意外事件能够持续改变后续概率，而不是每个转盘彼此失忆。
- 必须改造：视频在胜负后另用伤势、生死和意外转盘制造连续戏剧；本项目明确不得把这些内容塞进胜负转盘，并须结合《诡秘之主》的位阶、污染、封印物代价、逃生和救援条件重新设计。
- 只能借鉴机制，不复制视频中的《咒术回战》技能名称、具体胜率数字、轮盘视觉、文案、素材或事件内容。

## V1_CHARACTER_CREATION_SCOPE_CORRECTION

- `DECISION`: `REFERENCE_LIKE_COMPACT_FIRST_VERSION`
- `CONFIRMED_BY_USER`: 2026-08-28，用户明确要求“第一版不要太复杂，先参考我给你的参考”。
- 第一版捏人以《汴京梦华》的单页/短流程为复杂度参照，不把家庭营生、关系网、资源、秘密和所有背景子字段逐项暴露给玩家配置。
- 参考的是“少量关键选择立即进入游戏”的体验，不复制其全局脚本、属性耦合、`innerHTML` 拼接或缺失的最少特质校验。
- 先前锁定的阶层、职业、属性、性格和缺陷方向仍作为底层数据与后续扩展规则；第一版可以由少量出身/特质选择自动派生，不要求全部成为独立控件。
- 开局关系网可以由出身和世界种子自动生成，`D-003A6A` 的手动配置问题从第一版移除；具体自动生成规则后置。
- 第一版最终显示字段、出身是否合并职业、特质数量和确认页仍为 `PENDING`。

### D-V1CC1 第一版背景选择结构

- `DECISION`: `B_ORIGIN_PLUS_CURRENT_PROFESSION`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `b`。
- 第一版捏人只提供一个整合“出身”选择和一个独立“当前职业”选择。
- 出身负责派生阶层、家庭基线和初始社会环境；当前职业独立保留，因为它会持续提供收入、身份、人脉、义务和玩法入口。
- 家庭营生、当前家境、关系网、资源与秘密不作为第一版逐项手动控件，可以由出身、职业和世界种子生成。
- 本决定尚未锁定出身/职业清单、组合数量、具体派生值或界面布局。

### D-V1CC2 第一版是否显示手动属性加点

- `DECISION`: `A_AUTO_DERIVED_NO_POINT_BUY_UI`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 第一版捏人不显示手动属性加点或点数购买界面；初始属性和背景基础技能由出身、当前职业、年龄及所选特质确定性派生，自由专精则按 `D-V1CC5` 在摘要页另选1项。
- 确认角色前应显示简短结果摘要，让玩家知道选择带来的能力倾向，而不是隐藏关键后果。
- 存档需记录派生输入与规则版本，确保同一选择可重现，并支持未来规则迁移。
- `D-003A5A` 的“统一基线＋有限自由分配”保留为长期设计方向；本决定仅锁定第一版不向玩家暴露自由加点步骤。
- 本决定尚未锁定属性名称、派生公式、摘要样式或以后何时开放手动分配。

### D-V1CC3 第一版捏人最终短流程

- `DECISION`: `A_ADAPTED_COMPACT_FLOW`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 第一版依次完成：基础身份（姓名、性别、18—45岁年龄、鲁恩境内出生地、预设头像）→一个出身→一个当前职业→恰好2个性格特质＋一个强制缺陷→自动派生属性/技能摘要→确认开局。
- 鲁恩国籍固定，不增加无意义的单选控件；预设头像自带结构化外貌标签，第一版不要求玩家逐项编辑发色、五官等细节。
- 玩家手动确认所有关键身份选择；属性、背景基础技能、初始关系和资源由已选输入确定性派生，并在摘要页按 `D-V1CC5` 补选1项自由专精；第一版不增加点数购买、家庭营生、关系网或秘密配置页。
- 确认页必须展示主要能力倾向与关键后果，不能让玩家在不知情的情况下进入游戏。
- 本决定完成第一版捏人方向封板；具体出身/职业/特质/缺陷清单、派生公式和美术资产属于后续内容与实现任务；性格特质与缺陷的选择数量由后续 `D-V1CC4` 单独锁定。

### D-V1CC4 第一版固定选择两个性格特质

- `DECISION`: `A_EXACTLY_TWO_TRAITS_PLUS_ONE_FLAW`
- `CONFIRMED_BY_USER`: 2026-08-29，用户针对当前单题回复 `a`。
- 第一版捏人的人格步骤必须恰好选择2个互不重复、通过组合校验的性格特质；此前已经锁定的1个真实缺陷另行选择，不计入这2个特质。
- 领域层和界面层都必须执行相同的精确数量校验：少于2个或多于2个均不能确认角色，不能继承参考项目只限制上限、没有执行最少数量校验的缺口。
- 该数量在保持短流程的同时提供两条可组合的人格倾向；不扩张为3个以上特质，也不把缺陷当作第三个正向特质。
- 本决定只锁定选择数量及最小/最大校验；具体特质与缺陷清单、效果、互斥关系、派生公式、文案和美术仍保持待定。

### D-V1CC5 自动摘要页选择一项背景过滤的普通技能专精

- `DECISION`: `A_ONE_BACKGROUND_FILTERED_FREE_SPECIALIZATION_IN_SUMMARY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户针对当前单题回复 `a`。
- 第一版在自动摘要页展示出身、当前职业、年龄、特质与缺陷派生出的属性和基础技能，并要求玩家再选择恰好1项普通技能专精；该选择属于摘要页内的最后一项输入，不新增第七个捏人步骤。
- 专精候选必须按已经选择的背景和世界内前置条件过滤，排除明显不可能或与角色经历冲突的项目，同时保留可信的跨背景兴趣、业余训练或个人长处选项。
- 未选择或选择多于1项时不能确认角色；选择后摘要必须即时展示它带来的可见倾向，存档把专精ID与派生规则版本一并记录以保证可重现。
- 本决定只锁定第一版专精数量、所在步骤与背景过滤边界；具体技能清单、候选池大小、初始等级、数值效果、训练速度、检定公式和界面美术仍保持待定。

### D-V1CC6 第一版提供十个整合出身并均匀覆盖五层阶层

- `DECISION`: `B_TEN_INTEGRATED_ORIGINS_TWO_PER_TIER`
- `CONFIRMED_BY_USER`: 2026-08-29，用户针对当前单题回复 `b`。
- 第一版标准新游戏提供恰好10个整合出身，已锁定的贫民、劳工、小市民、中上、上流五层社会阶层各有2个出身；玩家仍只选择其中1个，不恢复三层逐项手动组装界面。
- 同层的两个出身必须在家庭基线、社会环境、机会、义务或初始关系入口上形成可理解差异，不能只是同一模板改名；上流阶层的两项至少分别覆盖可选贵族出身和获得充分社会承认的非贵族精英。
- 10个出身都必须进入派生、职业兼容、冲突解释、存档重放和内容验证矩阵；除已由 `D-003A3D` 锁定为标准新游戏可选的贵族出身外，本题不新增其他局外解锁规则。
- 本决定只锁定出身总数、每层覆盖数量与上流层最低身份覆盖；具体出身名称、家庭营生、当前家境、派生数值、关系、事件入口、职业兼容表、文案和美术仍保持待定。

### D-V1CC7 第一版提供十二个当前职业

- `DECISION`: `B_TWELVE_CURRENT_PROFESSIONS`
- `CONFIRMED_BY_USER`: 2026-08-29，用户针对当前单题原样回复 `b`。
- 第一版标准新游戏提供恰好12个当前职业，玩家仍只选择其中1个；职业与已经锁定的10个整合出身保持独立输入，不把职业重新并入出身卡。
- 12个职业必须形成可理解的长期身份差异，并进入收入、背景技能、义务、机会、出身兼容与冲突解释、存档重放和内容验证矩阵；不能只用名称或工资不同冒充独立职业。
- 本决定只锁定第一版职业池总数；具体职业名称、阶层或出身兼容表、教育与准入门槛、收入数值、技能效果、时间义务、专属事件、失业、离职和转职规则仍保持待定。

### D-V1CC8 出身与当前职业采用直接、条件、禁止三级兼容

- `DECISION`: `B_THREE_STATE_ORIGIN_PROFESSION_COMPATIBILITY`
- `CONFIRMED_BY_USER`: 2026-08-29，用户针对当前单题原样回复 `b`。
- 第一版把10个出身与12个当前职业形成的每一组组合精确标记为三种互斥状态之一：`DIRECT`（直接可选）、`CONDITIONAL`（附带解释与代价后可选）或 `FORBIDDEN`（绝对禁止）。
- `CONDITIONAL` 组合必须在确认前向玩家展示可信的背景解释和明确的开局代价、义务或家境变化，玩家接受后才能选择；不能把少见组合变成无代价漏洞，也不能把代价隐藏到开局后才突然追缴。
- `FORBIDDEN` 组合不能确认角色，并必须显示不泄露未来秘密的世界内理由；`DIRECT` 组合不需要额外背景补丁，但仍承受该职业和出身各自正常的义务与后果。
- 本决定只锁定兼容状态模型及捏人时的玩家可见行为；具体120组状态、解释模板、代价形式与数值、职业名称、工资、技能、事件、失业和转职规则仍保持待定。

## LOCKED_PROFESSION_DESIGN

### D-003A4A 普通职业是否构成长期玩法线

- `DECISION`: `B_PERSISTENT_IDENTITY_GATEWAY_NO_FULL_CAREER_TREE`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `b`。
- 普通职业是持续有效的社会身份入口：它影响收入、技能使用场景、人脉、时间义务、可进入地点和专属机会。
- 成为非凡者后，职业身份及其关系和义务仍然存在；玩家也可以失业、离职或转职。
- 首版不要求为每个普通职业制作完整的升职树和独立职业生涯模拟，避免普通职业系统取代个人非凡成长的主循环。
- 本决定尚未锁定职业清单、收入数值、排班、转职规则、教育要求、具体技能或专属事件数量。

### D-003A4B 初始普通技能的来源

- `DECISION`: `A_BACKGROUND_BASE_PLUS_FREE_SPECIALIZATION`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 家庭/成长背景、教育和普通职业共同赋予一组与角色经历一致的基础技能。
- 在背景技能之外，玩家拥有有限的自由专精空间，用于塑造跨背景兴趣、业余训练或个人长处。
- 自由专精不能抹除技能前置、世界合理性或背景代价，也不能让单一最优技能组合覆盖所有开局身份。
- 第一版自由专精的数量和流程位置已由 `D-V1CC5` 锁定为自动摘要页内恰好1项；技能清单、候选池大小、技能等级、上限、教育字段、训练速度或具体检定公式仍按用户优先级要求后置。

## LOCKED_ATTRIBUTE_AND_TRAIT_DESIGN

### D-003A5A 初始基础属性的分配方式

- `DECISION`: `A_BASELINE_PLUS_LIMITED_ALLOCATION_AND_BACKGROUND_MODIFIERS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 所有标准新角色从一个保证基本可玩的统一属性基线出发，避免因捏人失误生成无法参与核心玩法的角色。
- 玩家获得有限的自由分配空间，用于明确塑造能力倾向；年龄、背景和特质再提供透明且受控的修正。
- 背景修正不能叠加成压倒性的最优路线，也不能完全抵消玩家的自由分配选择。
- 本决定尚未锁定属性名称、数量、点数、上下限、检定公式、成长速度或序列晋升对属性的改造。

### D-003A5B 捏人是否必须选择角色缺陷

- `DECISION`: `A_ONE_REAL_FLAW_NO_BONUS_POINTS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 每名标准新角色必须选择一个核心缺陷；缺陷必须在长期行动、关系或事件中造成真实后果，不能只是无感文案标签。
- 选择缺陷不会额外获得基础属性点或通用加点预算，避免玩家把最容易规避的缺陷当作刷点工具。
- 缺陷可以产生专属叙事、应对方式或情境性机会，但这些不是无条件数值补偿。
- 本决定尚未锁定缺陷清单、严重度、能否治疗/克服/恶化、与疾病的关系或后续非凡污染是否占用同一槽位。

### D-003A5C 性格特质对玩家自主选择的约束强度

- `DECISION`: `A_INFLUENCE_WITHOUT_FORCED_ORDINARY_ACTIONS`
- `CONFIRMED_BY_USER`: 2026-08-28，用户回复 `a`。
- 性格特质影响检定、心理或关系代价、NPC反应和可见选项，使同一行动对不同角色具有不同成本与后果。
- 普通状态下，性格特质不能直接禁止玩家选择或自动替玩家执行行动；玩家可以违背既有性格，但需要承受可解释的内在或社会后果。
- 超自然控制、严重精神异常、失控或污染造成的强制行为属于后续独立规则，不由本决定提前否定。
- 本决定尚未锁定特质清单、数量、强度、变化方式、相互冲突或具体检定修正。

## OPEN_DESIGN_QUESTIONS

### D-UI1 周舞台外壳

- `STATUS`: `LOCKED`
- `A（已选）`: 一个永久周仪表盘；调查、判定、战斗和结算用居中弹层或右侧抽屉，保留周次上下文，开发量最低。
- `B`: 标题、卷宗、调查、战斗、结算各自独立页面；层次清楚，但页面切换多、状态恢复和上下文成本高。
- 本题只锁定界面承载方式，不锁定具体颜色、字体、动画或能力数值。

### D-UI2 战斗承载面

- `STATUS`: `LOCKED`
- `A（已选）`: 在当前周仪表盘上打开全屏遮罩式战斗面板；保留进入战斗的调查背景，返回路径短。
- `B`: 独立战斗页面；沉浸感更强，但需要额外保存/恢复周舞台和导航状态。
- 本题只锁定战斗所在的 UI 表面，不改变已锁定的次数盘、能力盘、胜负盘和生存盘顺序。

### D-UI3 视觉方向

- `STATUS`: `LOCKED`
- `A（已选）`: 克制的“神秘学卷宗/工作台”——深墨色底、旧纸色信息卡、琥珀/暗红状态强调，细线和印记感；不复制任何参考项目视觉。
- `B`: 偏明亮的纸张/档案馆；阅读压力较低，但危险和夜间神秘感较弱。
- `C`: 中性工具界面；最快实现和测试，但题材辨识度最低。
- 本题只锁定整体视觉气质，不锁定色值、字体、插画来源或动画时长。

`D-UI1=A`、`D-UI2=A`、`D-UI3=A` 已全部锁定；UI 承载与视觉方向批次封板，但生产实现仍须用户明确授权。

### D-EVENT1 第一版事件卡规模 — `LOCKED`

- `STATUS`: `LOCKED`
- `A`: 60 张独立事件卡 + 6 条三阶段连环案；最快可玩，但重复压力最高。
- `B（已选）`: 90 张独立事件卡 + 9 条三阶段连环案（27 张阶段卡，合计117张定义）；普通、经济、调查、途径和风险覆盖与工程量较平衡。
- `C`: 120 张独立事件卡 + 12 条三阶段连环案；重复压力最低，但第一版内容周期明显变长。
- 本题只锁定首版内容容量，不锁定具体文案、原著事件、价格或能力数值。

### D-EVENT2 周事件弹出密度 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 一次行动/周脉冲最多一张阻塞式选择卡，其余事件进入 `D-EVENT7` 已锁定的最小待处理事件列表或纪事；选择有重量，状态恢复简单。
- `B`: 同一行动允许连续弹出多张卡；戏剧密度更高，但更容易打断行动节奏并增加恢复/重放复杂度。
- `C`: 只有调查、连环案和阈值事件弹卡；界面最清爽，但工作、学习、黑市结果的反馈会变薄。
- 本题只锁定弹出节奏，不改变四个固定按钮、经济规则或战斗转盘。

### D-EVENT3 事件卡默认选项数量

- `STATUS`: `LOCKED`
- `A（已选）`: 标准卡固定2项；连环/阈值卡只有在定义中声明例外时可有3项。
- `B`: 每张卡由作者在2—4项间自由决定；表现空间大，但内容平衡、测试和 UI 高度更复杂。
- `C`: 所有卡固定3项；结构统一，但首版内容量和无意义选项风险最高。
- 本题只锁定选项结构，不锁定具体选项文案或结果。

### D-EVENT4 日常行动与事件卡的结算先后

- `STATUS`: `LOCKED`
- `A（已选）`: 玩家确认日常行动后，先提交固定行动成本，再弹出该行动的阻塞事件卡；不能靠返回撤销成本。
- `B`: 先弹卡，选项决定是否/如何扣行动成本；选择感强，但取消、重复提交和重放边界更复杂。
- `C`: 行动先自动结算，事件卡只做被动事后通知；最简单，但玩家不能用卡片改变行动结果。
- 本题只锁定行动提交与卡片选择的顺序，不改变 `D-EVENT2` 的“一次最多一张阻塞卡”。

### D-EVENT5 哪些日常行动可以生成阻塞式事件卡

- `STATUS`: `LOCKED`
- `A（已选）`: 四个固定行动都可以在满足条件时生成一张阻塞卡；工作/学习/休养通常是短卡，调查/市场卡可进入判定、战斗或交易。
- `B`: 只有调查、黑市/拍卖和阈值结果生成阻塞卡；工作、学习、休养只显示结果面板。
- `C`: 每次固定行动都必须生成一张选择卡；反馈统一，但会显著增加打断和内容量。
- 本题只锁定四个固定按钮的事件覆盖范围，不改变每次最多一张的密度。

### D-EVENT6 阻塞式事件卡能否暂存/跳过

- `STATUS`: `LOCKED`
- `A（已选）`: 阻塞卡必须当场作答；非阻塞事件可以延后，具体保留方式已由 `D-EVENT7` 锁定为最小待处理事件列表（正式名称待定）。崩溃、死亡或条件失效时由引擎写明 `EXPIRED/CANCELLED` 原因。
- `B`: 允许玩家把阻塞卡延后一周；自由度更高，但会产生待处理堆积和连环案顺序问题。
- `C`: 允许直接跳过并执行定义好的默认后果；实现简单，但玩家可能用跳过规避风险。
- 本题只锁定卡片是否必须回应，不改变已提交的行动成本。

### D-EVENT7 非阻塞事件的保留与展示方式

- `STATUS`: `LOCKED`
- `A（已选）`: 只做一个最小“待处理事件列表”，放在周摘要/纪事抽屉中；显示标题、来源、到期周和“阅读/处理”，不增加行动次数，也不是第五个按钮。
- `B`: 不保留待处理列表；非阻塞事件只写入只读纪事摘要，不能之后处理。
- `C`: 做完整事件收件箱，支持筛选、排序、批量处理和手动挑选待办；信息最全，但会变成第二套任务系统。
- 本题只决定是否保留非阻塞事件及其 UI 容器，不改变 `D-EVENT6` 的“阻塞卡必须当场回答”。

本题已锁定为 A；“收件箱”只作为历史俗称，正式实现名称可另行确定。

### D-EVENT8 待处理事件的处理成本 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（用户已选）`: 从待处理列表阅读或处理事件不消耗周行动点，也不增加行动次数或返还原行动成本；本决定只锁定行动点不扣除，事件自身声明的金钱、物品、灵性或其他硬成本不因本题自动免除。
- `B`: 处理使用一个现有主要行动；这是此前的推荐方案，未被用户选择。
- `C`: 列表只可阅读，不能之后处理；规则最简单，但 `D-EVENT7` 的“处理”入口会失去作用。
- 本题只决定待处理列表如何进入结算，不改变阻塞卡必须当场回答，也不改变四个固定行动按钮。

### D-EVENT9 待处理事件的到期 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 每个可延期事件带 `expiresWeek`；到期时按定义执行显式到期后果或写入 `EXPIRED`，连环案必须声明继续、终止或转入新卡。
- `B`: 默认永不到期，只有连环案或内容作者另行声明才结束；自由度高，但待处理列表可能无限堆积。
- `C`: 延后一周后自动归档，不再允许处理且不产生额外后果；实现简单，但会削弱事件的时间压力。
- 本题只决定非阻塞事件的时间边界，不改变阻塞卡密度或普通判定/战斗算法。

### D-EVENT11 事件卡与原著大事件的关系 — `LOCKED`

- `STATUS`: `LOCKED`
- `DECISION`: `A_CANON_CONSTRAINED_ORIGINAL_SIDE_STORY`
- 事件卡以原创地方事件、人物和旁线调查为主；原著大事件只作为时间线/世界脉冲影响环境。
- 只有时间、地点、身份和知识都合理时，玩家才与原著人物或事件产生有限交集；不改写原作主线。
- 本题只锁定原著使用边界，不锁定具体人物、章节、城市或事件文案。

### D-EVENT10 模板、RAG 与小模型的职责/生成时机 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 作者/构建期用 RAG 找原著锚点，小模型只生成受模板约束的叙事变体；通过 schema、来源、剧透、实体和禁写项校验后人工确认并缓存。运行时只从已审核变体中按确定性随机流选择；规则字段、奖励、惩罚、难度和后果永远由模板/引擎决定。无模型时使用固定文本。
- `B`: 每次运行时都用模板 + RAG 即时生成文本；变化更多，但延迟、重放、模型版本漂移和错误回退明显更复杂。
- `C`: 让模型直接生成完整事件卡（含选项、奖励、惩罚和难度），再由引擎尽量校验；作者工作最少，但原著事实和规则越权风险最高，不建议。
- 本题只锁定模型边界与生成时机，不锁定具体模型、量化参数或事件文案；具体模板字段和变体风格仍可继续按内容批次设计。

### D-EVENT12 事件触发与候选池抽取 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 先按来源优先级筛选，再叠加行动/状态/知识修正、冷却、多样性和保底，使用确定性随机流加权抽取。
- `B`: 按周次和行动写死事件脚本；可控但重复度高、分支扩展成本大。
- `C`: 所有符合条件的卡等概率抽取；简单但因果关联和内容权重较弱。
- 本题只锁定候选池抽取原则，不锁定每张卡的具体权重。

### D-EVENT13 首版独立事件卡类别配比 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 普通生活/职业/关系30张；经济/产业/债务/黑市15张；调查/线索20张；途径相关15张；污染/危险/战斗入口10张，另有9条三阶段连环案。
- `B`: 普通20张；经济10张；调查35张；途径20张；风险5张，另有9条三阶段连环案。
- `C`: 不设类别配额，按作者完成度动态填充；自由但容易造成首版内容失衡。
- 本题只锁定内容生产配比，不锁定具体卡片名单。

### D-EVENT14 单张事件卡的解析层级 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 每个选项只有一个主要解析入口：`NONE/CHECK/COMBAT/TRADE`；需要多步过程时转入明确的后续卡。
- `B`: 一张卡内允许连续多次判定、战斗和交易；表现复杂，但状态与重放成本高。
- `C`: 事件卡只做确定性选择，不在卡内触发普通判定、战斗或交易；最简单但玩法反馈变薄。
- 本题只锁定单卡解析复杂度，不锁定具体判定公式。

### D-EVENT15 事件卡风险与难度的信息公开 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（推荐）`: 显示已知硬成本、所需能力/物品和定性风险；具体难度、概率与隐藏后果由知识/调查逐步揭示，结算后完整展示。
- `B（已选）`: 选项前直接显示精确难度、当前概率和主要可预见后果；需要进入实时战斗才能生成的胜率在战斗界面精确显示。
- `C`: 连硬成本和风险都尽量隐藏；神秘感强，但容易被视为不公平。
- 本题只锁定玩法信息公开，不得借概率或后果预览泄露角色尚未知晓的原著秘密、幕后身份或隐藏事实。

### D-EVENT16 事件重复、冷却与多样性 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 每张卡有冷却；同组卡有多样性衰减，连续低价值重复时有保底换池；同一实例不会重复生成。
- `B`: 同一周目同一张卡只出现一次；重复最少，但内容消耗快、制作量压力大。
- `C`: 不设硬冷却，只降低已见卡权重；最自由，但可能连续撞到同类事件。
- 本题只锁定重复控制原则，不锁定冷却周数。

### D-EVENT17 连环案阶段衔接方式 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 每阶段根据玩家选择和条件声明下一阶段、安排周次和中断/终止路线；最多三阶段，不允许未登记的无限链。
- `B`: 只要完成当前阶段就固定进入下一阶段，按预设周次推进；稳定但选择影响较弱。
- `C`: 当前阶段结束后由玩家手动挑选下一阶段；自由度高，但会把连环案变成任务菜单。
- 本题只锁定阶段衔接规则，不锁定9条连环案的剧情。

### D-EVENT18 事件卡与死亡判定的边界 — `LOCKED`

- `STATUS`: `LOCKED`
- `A（已选）`: 事件卡只能制造危险、资源归零或进入战斗/生存判定；死亡必须由既有死亡规则结算，不能由文案直接宣告。
- `B`: 允许特定事件选项直接写入死亡；戏剧冲击强，但容易绕过统一生存与因果规则。
- `C`: 事件卡永远不能造成致命后果；安全但会削弱风险感。
- 本题只锁定死亡入口，不锁定具体危险事件的后果数值。

## CURRENT_PROGRESS

1. `DONE`: 确认工作区、参考目录实际路径、gmzz 大型脏工作树状态。
2. `DONE`: 审计《汴京梦华》的入口、核心循环、数据、UI、存档、NPC AI、素材与许可。
3. `DONE`: 审计 gmzz 当前权威文档、许可证、世界/回合/AI/持久化/RAG/地图/交付关键边界。
4. `DONE`: 输出 `REFERENCE_REUSE_AUDIT.md` 逐模块复用矩阵与新项目建议底座。
5. `DONE`: `D-001` 已由用户锁定为个人非凡者生存成长，并已写入 `LOCKED_DESIGN`。
6. `DONE`: `D-002` 已由用户锁定为原作同期旁线，并已写入 `LOCKED_DESIGN`。
7. `DONE`: `D-003A` 已由用户锁定为完全自建原创角色，并已写入 `LOCKED_DESIGN`。
8. `DONE`: `D-003B` 已由用户锁定为所有角色从普通人开始，并已写入 `LOCKED_DESIGN`。
9. `DONE`: `D-003C1` 已由用户锁定为首版3条完整玩家途径，并已写入 `LOCKED_DESIGN`。
10. `DONE`: 用户要求优先完成的第一版捏人已封板，`D-003C1A` 具体三条途径也已锁定；其后 `D-003C2` 又因基本玩法尚未锁定而暂停。
11. `DONE`: `D-003A1` 已由用户锁定为完全手动点选，并已写入 `LOCKED_DESIGN`。
12. `DONE_READ_ONLY`: 核对 gmzz RAG 实际调用链，确认可改造但当前正式 worker 仍为 lexical-only。
13. `DONE`: `D-003A2` 已由用户锁定为标准基础身份字段集合，并已写入 `LOCKED_DESIGN`。
14. `DONE`: `D-003A2A` 已由用户锁定为影响社会互动但不修改基础属性；序列变性规则已单独挂起。
15. `DONE`: `D-003A2B` 已由用户锁定为18—45岁且年龄产生适度差异，并已写入 `LOCKED_DESIGN`。
16. `DONE`: `D-003A2C` 已由用户锁定为首版单一国家、国内多出生地，并已写入 `LOCKED_DESIGN`。
17. `DONE`: `D-003A2D1` 已由用户锁定为结构化外貌选项，并已写入 `LOCKED_DESIGN`。
18. `DONE`: `D-003A2D2` 已由用户锁定为带外貌标签的整幅预设头像库；`D-003A2D` 基础方案完成。
19. `DONE`: `D-003A3A` 已由用户锁定为强影响但可改变的出身阶层，并已写入 `LOCKED_DESIGN`。
20. `DONE`: `D-003A3B` 已由用户锁定为三层结构化手动选择，并已写入 `LOCKED_DESIGN`。
21. `DONE`: `D-003A3C` 已由用户锁定为五层社会阶层，并已写入 `LOCKED_DESIGN`。
22. `DONE`: `D-003A2C1` 已由用户锁定为首版鲁恩、其他原作国家后续更新，并已写入 `LOCKED_DESIGN`。
23. `DONE`: `D-003A3D` 已由用户锁定为贵族出身在标准新游戏中可选，并已写入 `LOCKED_DESIGN`。
24. `DONE`: `D-003A3E` 已由用户锁定为综合社会地位划分，并已写入 `LOCKED_DESIGN`。
25. `DONE`: `D-003A3F` 已由用户锁定为五层社会生态分组，并已写入 `LOCKED_DESIGN`。
26. `DONE`: `D-003A3G` 已由用户锁定为带背景与代价的软约束，并已写入 `LOCKED_DESIGN`。
27. `DONE`: `D-003A3H` 已由用户锁定为家庭主要营生加可选次要收入，并已写入 `LOCKED_DESIGN`。
28. `DEFERRED_BY_USER`: `D-003A3I` 及家庭营生分类、列表和控件细节不属于当前重要设计，停止继续细分。
29. `DONE`: `D-003A4A` 已由用户锁定为重要且持续的身份入口，但不制作完整职业晋升树。
30. `DONE`: `D-003A4B` 已由用户锁定为背景基础技能加自由专精；职业/教育/技能细节暂时足够。
31. `DONE`: `D-003A5A` 已由用户锁定为统一基线、少量自由分配并受背景修正。
32. `DONE`: `D-003A5B` 已由用户锁定为必须选择一个真实缺陷且不奖励额外属性点。
33. `DONE`: `D-003A5C` 已由用户锁定为影响选择成本与反馈但不强制普通行动；属性/特质/缺陷方向暂时足够。
34. `DEFERRED_BY_USER_SCOPE`: `D-003A6A` 及关系/资源/秘密的逐项手动配置不进入第一版捏人。
35. `DONE`: `D-V1CC` 已锁定为参考《汴京梦华》的紧凑第一版捏人，复杂底层规则不等于全部显示为控件。
36. `DONE`: `D-V1CC1` 已由用户锁定为第一版“出身＋当前职业”两个背景选择。
37. `DONE`: `D-V1CC2` 已由用户锁定为第一版属性自动派生，不显示手动加点。
38. `DONE`: `D-V1CC3` 已由用户锁定为适配型短流程；第一版捏人方向正式封板。
39. `DONE_DOC`: 已创建 `V1_CHARACTER_CREATION_SPEC.md`，作为第一版捏人实施规格。
40. `DONE`: 已调查并完成 `D-003C1A` 首版具体三条玩家途径 Grill。
41. `DONE_RESEARCH`: 核对官方22途径结构与克莱恩选择占卜家的原作锚点，形成首版名单比较轴。
42. `DONE`: `D-003C1A1` 已由用户锁定为占卜家占用一个首发名额；原创获取链与不复刻克莱恩边界已记录。
43. `DONE`: `D-003C1A2` 已由用户锁定为观众与猎人；首版名单完整锁定为占卜家、观众、猎人。
44. `PAUSED_BY_USER_DEPENDENCY`: `D-003C2A` 尚未作答；用户要求先完成基本玩法设计。
45. `DONE`: `D-CORE1` 已锁定为面板式人生模拟，并完成参考项目主循环、UI入口和结算顺序的只读下钻。
46. `SUPERSEDED`: `D-CORE2` 早期“固定次数”表述已被用户在 `D-GRILLBATCH1.Q4C` 取代；仍保留行动束完成后统一推进世界的节拍。
47. `DONE`: `D-CORE3` 已由用户主动补充并锁定为按周推进，而不是按月推进。
48. `DONE`: `D-CORE4` 已由 `D-GRILLBATCH1.Q5A` 锁定为工作占用1次主要行动。
49. `CANCELLED_BY_USER_SCOPE`: `D-NUM1` 四层数值架构未被选择；用户要求显著简化。
50. `REFRAMED_AFTER_USER_CHALLENGE`: `D-NUM1S` 尚未选择；用户质疑统一交际数值，先处理该前置问题。
51. `DONE`: `D-NUM1S1` 已锁定为取消统一交际数值，社交改由身份、关系、标签与情境判断。
52. `PARTIALLY_DONE`: 用户要求将知识加入可量化核心能力；完整核心能力集合仍待确认。
53. `REFRAMED_AFTER_USER_CHALLENGE`: `D-NUM1S2B` 未作答；用户要求先补齐灵性等遗漏数值。
54. `DONE_RESEARCH`: 核对官方资料，确认灵性会被途径增强且能力存在灵性消耗；灵性纳入数值边界。
55. `DONE`: `D-NUM1S3A` 已锁定为灵性从普通人阶段起以“当前值/上限”独立显示，晋升后提高上限与用途。
56. `DONE`: `D-NUM1S2B` 已锁定为体魄、感知、意志；连同知识形成4项核心能力，另有健康、精神、灵性3项状态。
57. `DONE`: `D-NUM2` 已由用户自定义锁定为4项核心能力统一使用0—500刻度。
58. `DONE`: `D-NUM2A` 已由用户自定义锁定为普通人核心能力通常10—20，并明确为九个序列保留数值空间。
59. `DONE`: `D-NUM2B` 已锁定为500对应序列1数值极限，序列0位于普通属性刻度之外。
60. `DONE`: `D-NUM2C` 已锁定为途径定向强化核心能力，并同时赋予专属非凡能力。
61. `DONE`: `D-NUM2D` 已锁定为仅使用分段宏观边界；用户同时锁定每条途径每个序列依据原著变化独立设计，禁止统一成长模板。
62. `DONE`: `D-003C3A` 已锁定为第一版三条途径均完整做到序列7，共9个独立序列包。
63. `DONE_REFINED`: `D-NUM3` 已锁定健康/精神常态上限100、灵性常态上限500；三项当前值在明确来源作用下允许低于0，负值边界另行确认。
64. `DONE`: `D-NUM3A` 已锁定为普通人四项默认15并派生到10—20，健康/精神100，灵性默认15/15并派生到10—20。
65. `DONE`: `D-NUM4` 已锁定为普通人单项能力通常止于20，极少数天赋与长期专业训练者可达25。
66. `DONE`: `D-NUM5` 已锁定为公开的能力—难度差值概率检定；参考项目的分散概率公式不直接沿用。
67. `DONE`: `D-NUM5A` 已锁定为每点有效能力—难度差改变2个百分点，同值时为50%。
68. `DONE`: `D-NUM5B` 已锁定为可检定行动使用5%—95%概率上下限，自动成功与客观不可能先行判定。
69. `DONE`: `D-NUM5C` 已由用户选择四档通用结果：大成功、成功、失败、大失败。
70. `DONE`: `D-NUM5D` 已锁定为d100固定极端骰面：1—5大成功，96—100大失败。
71. `CORRECTED`: `D-NUM5E` 原问题错误预设“成功等于收益、失败等于代价”，该预设已撤回。
72. `DONE_RESEARCH`: `D-LORE1` 已完成作者访谈与章节索引型资料的基础审计；精确原文措辞与细节仍需合法原作语料逐条复核。
73. `DONE_DOC`: 已创建 `LOTM_CANON_GAMEPLAY_AUDIT.md`，记录来源等级、世界底层、首版三途径锚点、RAG边界及“解决质量/实际后果”双轴纠正。
74. `DONE`: `D-NUM5E` 已锁定双轴单检定：一次d100只确定行动解决质量，实际后果由独立、可追溯且可多向的因果列表结算。
75. `SUPERSEDED`: `D-NUM6` 早期“源头化、分阶段、部分隐藏”呈现已被 `D-GRILLBATCH1.Q3B` 取代；当前采用可见0—100污染主值，精神下降仍只是可能后果。
76. `DONE_DIRECTION`: `D-COMBAT1` 已按用户提出的双阶段大转盘对抗锁定：双方先转能力转盘，再以累计胜率与特殊效果生成战斗结果转盘。
77. `CORRECTED_AND_DONE`: `D-COMBAT1A` 已按用户纠正锁定：战斗结果转盘只判定双方胜负，不判定生死、伤势、逃脱或俘虏。
78. `DONE_RESEARCH`: `D-COMBATREF1` 已实际查看指定B站视频约09:07—11:52的宿傩对战段落，提炼出招次数、双方技能胜率/特效、条件子转盘、胜负转盘及独立伤势/意外层。
79. `DONE`: `D-COMBAT1B` 已锁定为因果化动态后果转盘：只纳入当前确有可能的后果，若结果已唯一确定则直接结算而不转盘。
80. `DONE`: `D-COMBAT2` 已锁定为双方独立、非均匀且由人物能力/当前效果生成的动态出招次数盘；不存在预设1—3或1—7范围。
81. `CANCELLED_BY_USER_CORRECTION`: `D-COMBAT2A` 的“7次上限”问题带有错误前提，已撤回；4—7是可能结果示例而非边界。
82. `DONE`: `D-COMBAT2B` 已锁定逐项专属权重组合；不同途径/序列/能力/效果可用不同规则，不合成为统一战斗力。
83. `DONE_DIRECTION`: `D-COMBAT3` 已锁定玩家与敌人的能力转盘均根据当前实时面板动态适配。
84. `DONE`: `D-COMBAT3A` 已锁定回合开始快照：本回合常规能力转盘保持不变，面板变化在下一回合重算时体现。
85. `DONE`: `D-COMBAT3B` 已锁定允许重复命中；胜率、特效、刷新、次数与消耗由每个项目自己的重复策略决定。
86. `DONE`: `D-COMBAT3C` 已锁定自动收录当前可用且可触及的全部技能/能力与携带、装备、可立即取用的物品；不采用战前删技能配卡。
87. `DONE_DIRECTION`: `D-COMBAT4` 已锁定能力转盘占比由项目基础权重、角色掌握程度和当前明确修正共同生成，再统一归一化。
88. `DONE`: `D-COMBAT4A` 已锁定每项技能/可训练能力使用0—500连续掌握度并派生文字档位；不同能力可使用不同权重曲线。
89. `DONE`: `D-COMBAT4B` 已锁定双方能力转盘完整公开项目、精确概率和主要权重来源；未知情况仅隐藏具体内容，不隐藏占比。
90. `DONE`: `D-COMBAT5` 已锁定A+C组合：实时面板形成基础战势，叠加本轮技能胜势与效果后，按双方有效胜势比例生成最终胜负盘。
91. `DONE`: `D-COMBAT5A` 已按用户要求简化：基础战势只读取序列/位格、四项核心能力、当前状态和先手。
92. `DONE`: `D-COMBAT5B` 已锁定序列/位格决定基础档位，核心能力只作档内强弱修正，状态和先手作为临时修正。
93. `DONE`: `D-COMBAT5C` 已锁定四项核心能力按当前途径的专属权重聚合为档内战势。
94. `DONE`: `D-COMBAT5D` 已锁定普通人四项核心能力各占25%，职业和专长通过实际属性与能力转盘表现。
95. `DONE`: `D-COMBAT5E` 已锁定每条途径的每个序列独立设计四项核心能力权重。
96. `DONE`: `D-COMBAT5F` 已锁定同一途径、同一序列对所有角色使用固定的四项核心能力权重。
97. `DONE`: `D-COMBAT5G` 已锁定每项核心能力权重采用5%刻度，四项合计100%。
98. `DONE`: `D-COMBAT5H` 已锁定序列9占卜家权重为体魄10%、感知40%、意志20%、知识30%。
99. `DONE`: `D-COMBAT5I` 已锁定序列8小丑权重为体魄40%、感知35%、意志15%、知识10%。
100. `DONE`: `D-COMBAT5J` 已锁定序列7魔术师权重为体魄20%、感知30%、意志15%、知识35%。
101. `DONE`: `D-COMBAT5K` 已锁定序列9观众权重为体魄5%、感知45%、意志20%、知识30%。
102. `DONE`: `D-COMBAT5L` 已锁定序列8读心者权重为体魄5%、感知40%、意志30%、知识25%。
103. `DONE`: `D-COMBAT5M` 已锁定序列7心理医生权重为体魄5%、感知25%、意志40%、知识30%。
104. `DONE`: `D-COMBAT5N` 已锁定序列9猎人权重为体魄40%、感知30%、意志10%、知识20%。
105. `DONE`: `D-COMBAT5O` 已锁定序列8挑衅者权重为体魄35%、感知30%、意志25%、知识10%。
106. `DONE`: `D-COMBAT5P` 已锁定序列7纵火家权重为体魄30%、感知25%、意志30%、知识15%；首发九序列权重完成。
107. `DONE`: `D-COMBAT6` 已锁定基础战势采用固定序列基础值加有上限的加权核心能力修正。
108. `DONE`: `D-COMBAT6A` 已锁定同一序列全途径共用一个手工基础值，各序列无需遵循统一增长公式。
109. `DONE`: `D-COMBAT6B` 已锁定首版基础战势值为普通人100、序列9为200、序列8为300、序列7为450。
110. `DONE`: `D-COMBAT6C` 已锁定加权核心能力直接加算，最高为当前序列基础值的20%，低数值不产生倒扣。
111. `DONE`: `D-COMBAT6D` 已锁定健康、精神、灵性分别分档扣减，叠加时受统一总上限约束，并禁止同因重复计算。
112. `DONE`: `D-COMBAT6E` 已锁定三项状态采用76/51/26/1百分比分档、单项扣0/5/10/20%，总扣减封顶40%。
113. `DONE`: `D-COMBAT6F` 已锁定状态扣减作用于完整的“序列基础值＋核心能力加成”。
114. `DONE`: `D-DESIGNORDER` 已锁定先完成数值/判定/算法内核，再建立能力量化结构，最终覆盖标准22途径序列9—0全部能力。
115. `DONE`: `D-COMBAT6G1` 已锁定健康归零触发生存转盘，只决定能否继续战斗，不自动判负或判死。
116. `DONE`: `D-COMBAT6G1A` 已锁定生存转盘动态读取序列/位格、体魄、伤势严重度和明确保命效果。
117. `DONE`: `D-COMBAT6G1B` 已锁定生存转盘复用50%＋2%×能力难度差、5%—95%封顶的通用公式。
118. `DONE`: `D-COMBAT6G1C` 已锁定普通人、序列9、序列8、序列7的生存位阶加成为+0/+5/+10/+15。
119. `DONE`: `D-COMBAT6G1D` 已锁定累积崩溃、重创、致命伤、毁灭性伤势的难度为15/25/35/45。
120. `DONE`: `D-COMBAT6G1E` 已锁定生存成功后恢复到1点健康并进入濒死状态，标签不重复扣通用战势。
121. `DONE`: `D-COMBAT6G1F` 已锁定重复归零继续转生存盘，每次先前成功使后续难度+10，仍保留5%最低机会。
122. `DONE`: `D-COMBAT6G1G` 已按用户最新纠正锁定：生存转盘失败时角色死亡；该判定独立于只判胜负的最终盘。
123. `DEFERRED`: `D-COMBAT6G1H` 仅涉及NPC死亡后的持续效果；玩家死亡已确定立即结束游戏，NPC规则稍后随统一效果生命周期处理。
124. `DONE`: `D-PLAYERDEATH1` 已锁定玩家角色死亡立即结束当前游戏，不继续结算死后反杀或后续胜负。
125. `DONE`: `D-PLAYERDEATH1A` 已锁定死亡周目永久只读封存、不可回档，开始游戏必须创建新角色。
126. `DONE`: `D-SETTLEMENTREF1` 已核验参考项目采用墓志铭式多维人生结算、动态列传和编年轨迹，不是单一总分页；其手动存档仍可保留，不能照搬。
127. `DONE`: `D-SETTLEMENT1` 已锁定终局采用多维非凡者生涯卷宗、结局称号和人生时间线，不设置统一总分。
128. `DONE`: `D-SETTLEMENT2` 已锁定终局事实和称号由确定性规则生成，小模型＋RAG只润色真实档案，并有本地模板降级。
129. `DONE`: `D-ENDING1` 已锁定一局可因死亡或明确非死亡终局条件结束，不设固定周数上限。
130. `DONE`: `D-ENDING1A` 已锁定非死亡终局条件只解锁终局抉择，由玩家选择结束或继续周目。
131. `DONE`: `D-SETTLEMENT3` 已锁定终局卷宗采用六类核心摘要，不显示统一总分或完整原始行动日志。
132. `DONE`: `D-COMBAT6G2` 已按用户纠正锁定精神归零必须按清空原因结算，不使用统一精神转盘。
133. `DONE`: `D-RESOLUTIONBOUNDARY` 已锁定转盘仅用于战斗系统，非战斗正常情况统一使用判定。
134. `DONE`: `D-ZERO1` 已锁定所有可能使健康、精神或灵性归零的来源必须显式声明完整 `onZero`；缺失或不完整即内容校验失败、拒绝载入。
135. `DONE`: `D-ZERO2` 已锁定需要判定的 `onZero` 统一复用大成功、成功、失败、大失败四档；确定性后果不强制判定。
136. `DONE`: `D-ZERO3` 已锁定归零难度由具体清空来源声明，可为固定值或读取权威字段的确定性公式，不采用资源类型统一难度或运行时猜测。
137. `DONE`: `D-ZERO4` 已锁定同一来源同时清空多项资源时必须使用一次联合 `onZero`，最多判定一次并统一映射全部后果。
138. `DONE`: `D-RECOVERY1` 已按用户纠正和参考代码复核锁定：资源恢复嵌入有生活含义的日常行动按钮；不设无条件统一周恢复，具体按钮可恢复、消耗或不影响资源。
139. `DONE`: `D-RECOVERY2` 已锁定按钮点击前显示角色可预期的资源趋势，固定硬成本显示精确值；结算后记录准确变化，未知副作用不提前泄露。
140. `DONE`: `D-ACTIONS1` 已锁定日常行动区采用少量固定核心按钮加由序列、身份、地点、线索、关系、状态和事件产生的情境按钮。
141. `SUPERSEDED`: 历史记录曾把 `D-ACTIONS2` 写成工作、学习、调查、休养、城市切换五个固定核心按钮；后由用户明确城市切换属于新地图、第一版不做，当前以 `FOUR_CORE_WORK_LEARN_INVEST_REST` 为准。
142. `DONE`: `D-WORK1` 已锁定工作用于获得货币，收入不是固定数值，而随玩家产业规模变化。
143. `DONE`: `D-LEARN1` 已锁定学习用于获得具体非凡知识并增长知识属性。
144. `DONE`: `D-INVEST1` 已锁定调查是剧情主要推进手段，可在内部触发普通情境判定和战斗。
145. `DONE`: `D-ACTING1` 已锁定符合扮演原则的日常行动可触发扮演进度，调查在同等条件下收益更高。
146. `DONE`: `D-VISIT1` 已由 `D-GRILLBATCH1.Q6C` 锁定为不设独立拜访按钮，社交通过调查、事件和情境入口发生。
147. `DONE`: `D-MARKET1` 已锁定黑市允许玩家查看商品、上架、购买和出售物品。
148. `DONE`: `D-AUCTION1` 已锁定每三个月举办一次含珍稀物品的拍卖会。
149. `DONE_REFINED`: `D-REST1` 已由 `D-GRILLBATCH1.Q2B` 锁定休养恢复健康、精神、灵性三项当前状态，不改变核心体魄，也不新增体力资源。
150. `DONE`: `D-INDUSTRY1` 已锁定每项产业独立记录类型与1—5级规模，可持有多项；工作收入汇总有效产业而非直接发固定钱。
151. `DONE`: `D-ECON0` 已锁定金钱为普通生活、产业经营、调查准备与非凡成长共同使用的核心资源，并以原著经济跨度为基准。
152. `DONE_READ_ONLY`: `D-ECONREF1` 已建立鲁恩货币、普通周薪/房租和低中序列非凡商品的工作基准；具体正式价格仍需合法原著语料逐项复核。
153. `DONE`: `D-ECON1` 已锁定内部统一使用便士整数，界面自动组合显示金镑、苏勒与便士。
154. `DONE`: `D-ECON2` 已锁定玩家基础生活开销按当前生活档位每周自动结算，并允许主动调整档位。
155. `DONE`: `D-ECON3` 已锁定初版采用赤贫、贫困、普通、体面、奢华五档生活水平。
156. `DONE`: `D-ECON4` 已锁定每周生活费包含住房、基础饮食、衣物维护和普通市内交通，其他重要消费单独支付。
157. `DONE`: `D-ECON5` 已锁定五档基础周费用乘城市／城区消费系数，并按便士取整。
158. `DONE`: `D-STARTCITY1` 已锁定首版标准新游戏从贝克兰德开始，其他城市的旅行与扩展范围后置。
159. `DONE`: `D-ECONHOUSE1` 已锁定生活档位只结算玩家个人，家庭赡养与共同负担作为独立义务或事件处理。
160. `DONE`: `D-ECON6` 已锁定贝克兰德基准城区五档个人周费为30、120、300、600、6000便士，并保留原著非线性跨度。
161. `DONE_REFINED`: `D-ECON7` 已锁定生活档位通过具体事件与NPC反应影响休养、普通风险和社会场景，不直接提供属性或战斗力。
162. `DONE`: `D-ECONEVENT1` 已锁定经济与生活后果必须事件化；后台标签与数值不得冒充已完成玩法。
163. `DONE`: `D-ECON8` 已锁定生活费不足触发带条件选项和后续结果的财务危机事件，不静默透支、自动负债或自动降档。
164. `DONE`: `D-ECON9` 已锁定生活档位通过搬迁／置办事件改变，承担一次性成本并从下周生效。
165. `DONE`: `D-DEBT1` 已锁定首版只记录债务总额和每周固定应还额，借款来源与后果由事件表现。
166. `DONE`: `D-DEBT2` 已锁定周结算自动偿还固定金额，现金不足不形成负余额而触发催款／违约事件。
167. `DONE_SIMPLIFIED`: `D-DEBT3` 依据用户轻量化指令采用借款时一次性计费、不滚动计息的单一债务模型。
168. `DONE`: `D-ECONSCOPE1` 已锁定生活与债务只做轻量支撑，经济设计重心回到工作／产业与非凡资源流通。
169. `DONE`: `D-WORK2` 已锁定一次工作结算职业工资与所有有效产业收益，每个来源每周仅结算一次并通过工作事件呈现。
170. `DONE`: `D-WORK3` 已锁定职业与产业的常规工作收入按固定公式结算，剧情事件收支独立列账。
171. `DONE`: `D-INDUSTRY2` 已锁定产业直接按类型与规模读取固定净周收益，不拆分常规毛收入和成本。
172. `DONE`: `D-INDUSTRY3` 已锁定1—5级共用收益倍率为1、2、4、7、11。
173. `DONE`: `D-INDUSTRY4` 已锁定产业为具有名称、地点、类型、规模、状态与事件入口的具体资产，初版由少量模板支持。
174. `DONE`: `D-INDUSTRY5` 已锁定产业通过满足资金、人物、渠道和前置条件的购买／投资／继承／合作／剧情事件取得。
175. `DONE_SIMPLIFIED`: `D-INDUSTRY6` 已锁定产业面板直接付费即时升一级，常规升级不制作强制事件链。
176. `DONE`: `D-EXTRAORDINARYPRIORITY1` 已锁定生活／产业等支撑系统停在可用闭环，设计重心立即转向非凡体系。
177. `DONE`: `D-ABILITYSCHEMA1` 已锁定每项原著能力只保存一个扁平记录和界面条目，多种用法共享掌握度并写入说明／专属规则。
178. `DONE`: `D-ABILITYSCHEMA2` 已锁定同一能力共享身份与掌握度，同时分别保存普通判定和战斗转盘参数区块。
179. `DONE`: `D-ABILITYSCHEMA3` 已锁定每项能力独立声明无消耗、固定灵性消耗或专属代价，并在使用前显示已知成本。
180. `DONE`: `D-ABILITYMASTERY1` 已锁定掌握度提升可靠性、普通判定表现和战斗权重，但能力本质与力量上限由序列决定。
181. `DONE`: `D-ABILITYMASTERY2` 已锁定所有晋升新获得能力统一从0／500掌握度开始。
182. `DONE`: `D-ABILITYMASTERY3` 已锁定主动能力在0掌握度可粗糙使用，被动基础变化立即生效，但精细运用与可靠性需要成长。
183. `DONE_CUSTOM`: `D-ABILITYMASTERY4` 已锁定学习、非战斗实际运用和战斗均可增长掌握度，其中战斗提供明显更高收益；消化进度独立。
184. `DONE`: `D-ABILITYMASTERY5` 已锁定学习、调查与战斗产生的熟练度收益随机分配给一项能力，玩家不能直接指定。
185. `DONE`: `D-ABILITYMASTERY6` 已锁定熟练度从角色全部已知非凡能力和普通技能中随机分配，允许提升未实际使用的项目。
186. `DONE`: `D-ABILITYMASTERY7` 已锁定全技能池偏向低掌握度项目抽取，500掌握度项目不再吸收成长。
187. `DONE`: `D-ABILITYMASTERY8` 已锁定掌握度0—499使用5/4/3/2/1分档抽取权重，500退出候选池。
188. `DONE`: `D-ABILITYMASTERY9` 已锁定学习、调查有效运用、每场战斗分别生成固定5、8、25点熟练度收益包。
189. `DONE`: `D-ABILITYMASTERY10` 已锁定同周每个有效学习、调查运用和战斗来源都可生成收益包且无周硬上限，重复低风险刷取无收益。
190. `DONE`: `D-ABILITYMASTERY11` 已锁定单项熟练度最高500，收益包超过上限的部分直接作废，不转移也不重抽。
191. `DONE_SUPERSEDED`: `D-ABILITYMASTERY12` 曾锁定基础属性加熟练度数值加成，但该数值加成已被用户否定，由 `D-ABILITYMASTERY13` 取代。
192. `DONE_CUSTOM`: `D-ABILITYCONTENT1` 已锁定底层公式不能代替具体能力设计，后续每项非凡能力都要逐个设计并由用户确认。
193. `DONE_CORRECTED`: `D-ABILITYMASTERY13` 已应用户纠正锁定熟练度不提供通用成功率或有效能力值加成，原百分比换算方案作废。
194. `DONE`: `D-ABILITYMASTERY14` 已锁定熟练度逐项影响能力的控制、消耗、风险、持续或高级用法，不加通用成功率且不能突破序列／位格上限。
195. `DONE`: `D-ABILITYMASTERY15` 已锁定所有能力共用100／200／300／400／500成长节点，但各节点实际效果逐能力设计。
196. `DONE`: `D-COMBAT6H` 已锁定越级取胜仍由转盘运气决定，但必须有特殊条件且高位格压制明显，熟练度不能单独突破位格。
197. `DONE`: `D-COMBAT6I` 已锁定位格压制不另设胜率上限或统一倍率，只由序列基础战势和实际效果进入最终比例转盘。
198. `DONE`: `D-COMBAT6J` 已锁定保留100／200／300／450基础战势，由逐项设计的真实能力效果形成进一步高位格压制。
199. `DONE`: `D-COMBAT6K` 已锁定每套序列能力完成后进行批量转盘模拟，并由人工按原著再次审查。
200. `DONE_CUSTOM`: `D-IMPLEMENTORDER1` 已锁定先制作并验证底层系统，再分批添加、校准全序列能力数值内容。
201. `DONE`: `D-ABILITYENGINE1` 已锁定能力系统以统一数据配置为主，少数无法通用表达的特殊能力使用受控扩展处理器。
202. `SUPERSEDED`: `D-ABILITYENGINE2` 的“特殊处理器返回公共效果结果”提案已被 `D-ABILITYRESOLUTION1` 取代，不进入实现。
203. `DONE`: `D-ABILITYENGINE3` 已锁定特殊处理器只能使用引擎提供的可复现随机源，所有抽取顺序和结果必须记录。
204. `DONE`: `D-ABILITYENGINE4` 已锁定每个行动使用独立可复现随机流，并按固定顺序取数，日志记录流标识与序号。
205. `SUPERSEDED`: `D-ABILITYEFFECT1` 的公共效果列表提案已被 `D-ABILITYRESOLUTION1` 取代，不进入实现。
206. `SUPERSEDED`: `D-ABILITYEFFECT2` 的逐项效果失败规则已随公共效果列表提案一并取代，不进入实现。
207. `DONE_DOCUMENTATION`: `D-DOCS1` 已完成分类 Markdown、根目录 `AGENTS.md` 和内部链接/关键声明一致性校验。
208. `DONE_DOCUMENTATION`: `D-DOCS2` 已把“每道后续 Grill 必须同步对应主题 Markdown”写入台账、接管合同与文档更新协议。
209. `DONE`: `D-ABILITYEFFECT3` 曾由用户选择预检方案，随后因用户指出普通能力直接走数值判定而被 `D-ABILITYRESOLUTION1` 取代；不进入实现。
210. `DONE_SCOPE`: `D-ABILITYEFFECTSCOPE1` 已按用户纠正保留普通判定与战斗转盘分层，但不再启用独立效果事务。
211. `DONE_SIMPLIFIED`: `D-ABILITYRESOLUTION1` 已由用户锁定普通能力直接使用统一数值判定，能力后果按具体能力/事件数据处理，不另设效果事务。
212. `DONE_PROCESS`: `D-GRILLMODE1` 已按用户要求改为按主题分批、批内独立编号提问；每批回答后逐题同步台账与主题 Markdown。
213. `DONE_BATCH`: `D-GRILLBATCH1` 的6道普通判定、资源与周循环问题已由用户确认：资源允许负值、休养恢复三项、污染可见0—100、行动力动态、工作占用1次、拜访按钮替换为城市切换。
214. `DONE_CORRECTION`: 已清理 `D-ABILITYENGINE2`、实现路线和接管说明中的旧“公共效果出口/事务”表述；当前只保留为历史提案，普通能力仍以 `D-ABILITYRESOLUTION1` 为准。
215. `IN_PROGRESS`: 当前批次切换为 `D-GRILLBATCH2`：资源透支边界、归零重复触发、三项恢复方式、污染作用、动态行动力基准和城市切换规则共6题，等待用户按 `Q1...Q6` 回复。
216. `DONE_DOCUMENTATION`: 已将本批6项答案同步到台账、数值系统、核心循环、项目总览、接管说明、决定索引和未决清单；docs-guard自检通过（14文件、29内部链接、26个未锁定登记项）。
217. `DONE_BATCH`: `D-GRILLBATCH2` 已由用户确认 `Q1A Q2A Q3C Q4A Q5B`；来源声明透支下限、首次归零只触发一次、战斗负值按0、单一休养按钮恢复三项且动态、污染阈值事件、行动力基准3次再修正均已锁定。
218. `DONE_SCOPE`: 用户明确城市切换会切换到新地图，第一版可以不做；`D-CITYTRAVEL1..2` 改为 `DEFERRED_V1_NO_CITY_MAP`，第一版固定按钮收敛为工作、学习、调查、休养四项。
219. `IN_PROGRESS`: 当前批次切换为 `D-GRILLBATCH3`：透支字段、动态休养输入合并、污染阈值带、行动力修正合并和跨周结转共5题，等待用户按 `Q1...Q5` 回复。
220. `DONE_DOCUMENTATION`: 已将 `D-GRILLBATCH2` 答案与城市地图延期同步到台账、数值系统、战斗转盘、核心循环、项目总览、接管说明、决定索引和未决清单。
221. `DONE_DOCUMENTATION`: docs-guard自检通过：14个文档入口、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项232、未锁定25项。
222. `DONE_BATCH`: `D-GRILLBATCH3` 已由用户确认 `Q1A Q2A Q3A Q4A Q5A`；透支绝对字段、休养合并顺序、四档污染阈值、行动力整数叠加/最低1次和不结转均已锁定。
223. `IN_PROGRESS`: 当前批次切换为 `D-GRILLBATCH4`，主题为资源生命周期余量、周脉冲边界和战斗失败后的重战规则；城市切换/地图仍延期。
224. `DONE_DOCUMENTATION`: 已将 `D-GRILLBATCH3` 答案同步到台账、数值系统、核心循环、战斗转盘、项目总览、接管说明、决定索引和未决清单。
225. `DONE_DOCUMENTATION`: docs-guard自检通过：14个文档入口、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项239、未锁定26项。
226. `DONE_DOCUMENTATION`: 已补齐 `D-GRILLBATCH4` 的当前批次问题与主题映射；复检内部链接、重复标题、旧状态和占位标记均无新增问题。
227. `DONE_BATCH`: `D-GRILLBATCH4` 已由用户确认全部按照推荐方案：恢复封顶、负值先回零、污染进入新阈值带检查、末次行动后自动周脉冲、战斗失败须由新事件/条件重建交战。
228. `IN_PROGRESS`: 当前批次切换为 `D-GRILLBATCH5`，主题为战斗次数盘/能力盘组合、回合快照失效项目、胜负盘时机和未知情况区；城市切换/地图仍延期。
229. `DONE_DOCUMENTATION`: 已将 `D-GRILLBATCH4` 五项答案同步到台账、数值系统、核心循环、战斗转盘、项目总览、接管说明、决定索引和未决清单；docs-guard待本轮完成后运行。
230. `DONE_BATCH`: `D-GRILLBATCH4` 的五项推荐方案已全部按用户确认锁定；资源封顶、负值回零、污染进带检查、末次行动自动脉冲和新事件重战均已写入对应规则。
231. `IN_PROGRESS`: 当前唯一提问批次为 `D-GRILLBATCH5`，等待次数盘/能力盘组合、回合快照失效、胜负盘时机和未知区权重的逐题确认。
232. `DONE_DOCUMENTATION`: 已将 `D-GRILLBATCH4` 的最终确认同步到台账详情和主题镜像；本轮 docs-guard 将在新增战斗导航段落后执行。
233. `DONE_DOCUMENTATION`: docs-guard复核通过：17个 Markdown 文件（5个根目录资料、12个主题文档）、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项245，按台账口径仍非终态22项。
234. `DONE_BATCH_PARTIAL`: `D-GRILLBATCH5` 已锁定 Q1、Q2、Q3、Q4；Q3明确为双方按各自次数完成本轮能力盘后才进入胜负盘。
235. `IN_PROGRESS`: `D-GRILLBATCH5` 仅剩 Q5 未决；用户回复“A、B”同时命中互斥的未知区来源方案，等待单选或明确混合方案。
236. `DONE_DOCUMENTATION`: 已将本批 Q1—Q4 同步到战斗转盘和台账详情；docs-guard将在 Q5 澄清后再做批次收口检查。
237. `DONE_DOCUMENTATION`: 本轮 docs-guard复核通过：17个 Markdown 文件、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项245，当前非终态22项。
238. `DONE_BATCH`: `D-GRILLBATCH5` 已由用户选择 `Q5M` 收口；未知区采用固定小底噪，并允许明确因果来源在其上追加权重。
239. `IN_PROGRESS`: 当前批次切换为 `D-GRILLBATCH6`，处理能力胜势贡献、次数保底、一次性物品消耗、先手和后果转盘公开层级。
240. `DONE_DOCUMENTATION`: 已将 `D-GRILLBATCH5/Q5M` 同步到战斗转盘、未决清单、接管说明和决定索引；下一轮等待 `D-GRILLBATCH6` 回答。
241. `DONE_DOCUMENTATION`: docs-guard复核通过：17个 Markdown 文件、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项251，当前非终态26项。
242. `DONE_SCOPE`: 用户选择 `A`，第一版战斗范围收敛为只继续确认能力命中胜势贡献和次数盘最低值；一次性物品、先手数值、后果公开层级延期。
243. `DONE_DOCUMENTATION`: 已将 `D-V1COMBAT1` 及三个 `DEFERRED_V1_MVP_SCOPE` 条目同步到台账、战斗转盘、未决清单、接管说明、实现路线和决定索引。
244. `DONE_DOCUMENTATION`: scope A同步后的docs-guard复核通过：17个 Markdown 文件、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项252，当前非终态26项。
245. `DONE_BATCH`: `D-GRILLBATCH6` 已由用户选择 `Q1A Q2A` 收口；能力命中贡献逐次相加，正常次数盘最低1次。
246. `DONE_DOCUMENTATION`: 已将 `D-COMBAT5Q`、`D-COMBAT2D` 的确认结果同步到台账、战斗转盘、未决清单和相关接管文档，并新建 `D-GRILLBATCH7`。
247. `IN_PROGRESS`: 当前批次切换为 `D-GRILLBATCH7`，只处理普通判定修正合并（`D-NUM5F`）与能力默认目标范围（`D-ABILITYSCHEMA4`）。
248. `DONE_DOCUMENTATION`: 本批文档同步后的docs-guard复核通过：17个 Markdown 文件、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项255，当前非终态26项。
249. `DONE_BATCH`: `D-GRILLBATCH7` 已由用户要求两项均按推荐方案收口；普通判定修正直接相加，能力默认目标为显式选择器下的单目标。
250. `DONE_DOCUMENTATION`: 已将 `D-NUM5F`、`D-ABILITYSCHEMA4` 的确认结果同步到台账、数值系统、能力系统、未决清单、接管说明、实现路线、总览和决定索引，并新建 `D-GRILLBATCH8`。
251. `IN_PROGRESS`: 当前批次切换为 `D-GRILLBATCH8`，只处理普通判定后果最小结构（`D-NUM5G`）与能力效果持续/叠加字段（`D-ABILITYSCHEMA5`）。
252. `DONE_GATE_CLARIFICATION`: 已确认底层工程不必等待22途径全部能力；用户明确授权后可用占位能力先实现通用数值、判定、转盘、随机流、持久化和内容装载，完整能力内容继续受设计门槛约束。
253. `DONE_DOCUMENTATION`: 本批文档同步后的docs-guard复核通过：17个 Markdown 文件、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项258，当前非终态26项。
254. `DONE_BATCH`: `D-GRILLBATCH8` 已由用户要求两项均按推荐方案收口；后果结构与效果生命周期均保持最小可复现字段。
255. `DONE_DOCUMENTATION`: 已将 `D-NUM5G`、`D-ABILITYSCHEMA5` 的确认结果同步到台账、数值系统、能力系统、未决清单、接管说明、实现路线和总览。
256. `DONE_GATE_STATUS`: 底层规则批次没有新的阻塞题；UI 外壳仍等待 `D-UI1..3`，用户确认前不进入最终 renderer 实现。
257. `DONE_DOCUMENTATION`: 本批文档同步后的 docs-guard 复核通过：17个 Markdown 文件、0个悬空内部链接、0组重复决定标题、0个当前批次旧状态、0个占位标记；登记项258，当前非终态23项。
258. `DONE_READ_ONLY`: 本轮重新审计参考项目真实双栏布局、行动→周脉冲→事件弹层→终局卷宗流程，以及 gmzz 的 playable shell、OverlayStack、Main/SQLite、公开投影和 RAG 边界；两目录仍只读。
259. `DONE_PROPOSAL`: 新建 `docs/UI_IMPLEMENTATION_PLAN.md`，把屏幕地图、状态机、组件责任、数据合同、战斗分步 UI、施工切片和复用边界写成可执行提案；未把视觉选择写成锁定规则。
260. `DONE_PROPOSAL`: 细化 `docs/IMPLEMENTATION_PLAN.md`，增加文件级落点、四个底层接口最小切口、S0—S5 完成门槛和停止条件；生产实现仍为 `NOT_STARTED`。
261. `QUESTION_READY`: 新增 `D-UI1..3`，分别等待周舞台外壳、战斗承载面和视觉方向；推荐回复 `1A 2A 3A`。
262. `DONE_DOCUMENTATION`: 本轮 docs-guard 自检通过：18 个 Markdown 文件、36 个内部链接均可解析；3 个重复标题组均为跨复用矩阵的通用章节名，不是重复决定标题；当前 UI 提案符号均明确标注为尚未创建的建议接口；未发现 TODO/TBD/FIXME 或当前状态漂移。
263. `DONE_CORRECTION`: 用户指出 UI 提案遗漏已锁定的黑市、季度拍卖、产业/工作收入、生活/债务、知识/掌握度/扮演和资源生命周期；已逐项回扫台账并补入 UI 覆盖表、经济/市场/成长界面、状态分支、数据合同和 S1/S4/S5 施工门槛。
264. `DONE_DOCUMENTATION`: 经济补齐后的 docs-guard 自检通过：18 个 Markdown 文件、36 个内部链接均可解析；新增黑市/拍卖说明没有改变既有锁定规则，未新增未登记的玩法数值。
265. `DONE_READ_ONLY`: 本轮补充审计参考项目事件系统：`events_life/court/local/royal/regional/manage_*` 共按当前文件静态计数至少365个事件定义、781个选项标签，另有30条三阶段连环案；`events_core.js` 实际包含主动池、微事件、被动周/月入口、权重/冷却/重复衰减、pity和链阶段校验；参考弹卡为全屏遮罩中央卡片。
266. `DONE_READ_ONLY`: 已核对 gmzz 可借鉴的事件相关边界：Main/SQLite权威提交、公开事件投影、回合摘要、OverlayStack和RAG收据；无可直接迁入的同类事件卡内容，gmzz私有语料、旧存档和未验收产物仍禁止迁入。
267. `DONE_PROPOSAL`: 新建 `docs/EVENT_CARD_SYSTEM.md`，把事件卡生命周期、六类事件、结构化数据合同、连环案字段、阻塞卡/收件箱 UI、内容四层验收、黑市/季度拍卖事件卡和A/B/C容量档写成提案；生产实现仍为 `NOT_STARTED`。
268. `QUESTION_READY`: 新增 `D-EVENT1..2`，分别等待第一版事件卡规模与周弹出密度；推荐回复 `1B 2A`。两题影响内容工程量和节奏，不新增底层规则阻塞。
269. `DONE_DOCUMENTATION`: 已将事件卡主题接入 `docs/README.md`、`docs/DECISION_INDEX.md`、`docs/OPEN_DECISIONS.md`、`docs/UI_IMPLEMENTATION_PLAN.md`、`docs/IMPLEMENTATION_PLAN.md` 和 `AGENTS.md`；当前仍未写生产代码。
270. `DONE_DOCUMENTATION`: 事件卡补齐后的 docs-guard 自检通过：19 个 Markdown 文件、47 个内部链接均可解析；未发现悬空链接、当前状态漂移或新的占位标记；重复标题仅剩复用矩阵中的通用“禁止迁入/只能借鉴”，不属于重复决定。
271. `DONE_BATCH`: 用户确认 `D-EVENT1=B`、`D-EVENT2=A`；首版目标锁定为90张独立事件卡、9条三阶段连环案（27张阶段卡，合计117张定义），每次行动/周脉冲最多一张阻塞卡，其余进入 `EventInbox`。
272. `QUESTION_READY`: 新增 `D-EVENT3..4`，分别等待默认选项数量与行动成本/事件卡结算先后；推荐回复 `3A 4A`。它们不改变已锁定的117张容量和单阻塞卡密度。
273. `DONE_DOCUMENTATION`: 已把 `D-EVENT1..2` 的用户确认同步到事件卡方案、UI方案、实现路线、未决清单、文档入口和接管合同；本轮复检19个 Markdown、44个内部链接均有效，生产代码仍为 `NOT_STARTED`。
274. `DONE_DOCUMENTATION`: 已将下一批 `D-EVENT3..4` 的互斥选项写入事件卡方案、UI方案、未决清单和台账；本批仍保持 `QUESTION_READY`，未把推荐项写成锁定规则。
275. `DONE_DOCUMENTATION`: 本批同步后的 docs-guard 复检通过：19 个 Markdown 文件、44 个内部链接均可解析；`D-EVENT1..2` 当前锁定、`D-EVENT3..4` 当前待答，未发现悬空链接或新的状态漂移。
276. `DONE_BATCH`: 用户本次回复“1.a 2.a”按当前批次解释为 `D-EVENT3=A`、`D-EVENT4=A`；普通卡默认2项、连环/阈值卡声明后可3项，日常行动先提交固定成本再弹阻塞卡。
277. `QUESTION_READY`: 新增 `D-EVENT5..6`，分别等待四个固定行动的事件覆盖范围与阻塞卡暂存/跳过规则；推荐回复 `5A 6A`，不改变已锁定的117张容量、单阻塞卡密度、选项数量和行动成本顺序。
278. `DONE_DOCUMENTATION`: 已把 `D-EVENT3=A`、`D-EVENT4=A` 同步到事件卡方案、UI方案、实现路线、未决清单、文档入口和接管合同；新增 `D-EVENT5..6` 作为下一批问题。
279. `DONE_DOCUMENTATION`: 本轮同步后的 docs-guard 复检通过：19 个 Markdown 文件、44 个内部链接均可解析；`D-EVENT1..4` 为 `LOCKED`、`D-EVENT5..6` 为 `QUESTION_READY`，未发现新的状态漂移。
280. `DONE_BATCH`: 用户本次回复“1.a 2.a”按当前批次解释为 `D-EVENT5=A`、`D-EVENT6=A`；四个固定行动均可生成阻塞卡，阻塞卡必须当场作答，非阻塞事件可延后。
281. `DESIGN_CLARIFICATION`: 用户指出“收件箱”并非此前设计；该词是 Codex 为承接非阻塞事件而提出的 UI 名称，未视为用户已确认玩法，拆出 `D-EVENT7` 单独 Grill。
282. `QUESTION_READY`: 新增 `D-EVENT7`，等待非阻塞事件是否保留及其最小展示方式；推荐回复 `7A`。在此题回答前，不把 `EventInbox` 当成已锁定的第五按钮或第二套行动系统。
283. `DONE_DOCUMENTATION`: 已将“收件箱并非用户既有设计”的澄清写入事件卡方案、UI方案、未决清单、实现路线、决定索引、接管合同和台账；`D-EVENT7` 单独保持 `QUESTION_READY`。
284. `DONE_DOCUMENTATION`: 已修正所有镜像中的措辞：`EventInbox` 现在明确是 Codex 候选名称，`D-EVENT7` 决定是否保留非阻塞事件列表；未把它写成第五个按钮或既有玩法。
285. `DONE_DOCUMENTATION`: 本轮澄清后的 docs-guard 复检通过：19 个 Markdown 文件、44 个内部链接均可解析；`D-EVENT1..6` 为 `LOCKED`，`D-EVENT7` 为 `QUESTION_READY`，未发现悬空链接或新的当前状态漂移。
286. `DONE_BATCH`: 用户回复 `a`，按当前单题解释为 `D-EVENT7=A`；非阻塞事件保留为周摘要/纪事抽屉中的最小待处理事件列表，不增加行动次数，也不形成第五个按钮；“收件箱”不是用户既有设计，仅保留为历史俗称。
287. `QUESTION_READY`: 新增 `D-EVENT8..9`，分别确认待处理事件的处理成本与到期边界；两题不改变已锁定的阻塞卡密度和四个固定行动。
288. `DESIGN_PROPOSAL`: 用户提出事件卡必须贴合原著、具备真实奖励/惩罚，并考虑“模板 + 本地小模型 + RAG”生成多样化内容；新增 `D-EVENT10`，推荐构建期生成并审核叙事变体，运行时只选择已审核文本。
289. `DONE_BATCH`: 用户回复 `a`，按当前单题解释为 `D-EVENT10=A`；锁定构建期生成、人工审核、变体缓存、运行时确定性选择和固定文本兜底；规则字段、奖励、惩罚、难度与后果不由模型决定。
290. `DONE_DOCUMENTATION`: 已将 `D-EVENT10=A` 同步到事件卡系统、UI方案、原著/RAG边界、实现路线、项目入口、决定索引、未决清单和接管合同；`D-EVENT8..9` 仍保持待答。
291. `DONE_DOCS_GUARD`: 本轮同步后复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；`D-EVENT1..7` 与 `D-EVENT10` 为 `LOCKED`，`D-EVENT8..9` 与 `D-UI1..3` 保持 `QUESTION_READY`，模型/RAG边界未被写成已实现能力。
292. `DONE_BATCH`: 用户明确补充 `D-EVENT8`：待处理事件的阅读/处理不消耗周行动点；不增加行动次数、不返还原行动成本；其他事件自身硬成本暂不被本题免除。
293. `DONE_DOCUMENTATION`: 已将 `D-EVENT8` 的用户修正同步到事件卡系统、UI方案、实现路线、项目入口、未决清单和接管合同；`D-EVENT9` 仍待答。
294. `DONE_DOCS_GUARD`: 本轮同步后复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；`D-EVENT1..8` 与 `D-EVENT10` 为 `LOCKED`，`D-EVENT9` 与 `D-UI1..3` 保持 `QUESTION_READY`。
295. `DONE_DOCS_GUARD`: 补充事件卡状态说明后再次复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；当前单题仍为 `D-EVENT9`。
296. `DONE_BATCH`: 用户回复 `a`，按当前单题解释为 `D-EVENT9=A`；每张可延期事件必须记录 `expiresWeek`，到期执行显式后果或写入 `EXPIRED`，连环案声明继续、终止或转入新卡。
297. `QUESTION_READY`: 新增 `D-EVENT11`，确认事件卡以原创旁线为主还是直接改编/改写原著大事件；推荐受原著约束的原创旁线方案。
298. `DONE_DOCUMENTATION`: 已将 `D-EVENT9=A` 同步到事件卡系统、UI方案、实现路线、项目入口、未决清单和接管合同；`D-EVENT11` 作为当前单题写入台账与主题文档。
299. `DONE_DOCS_GUARD`: 本轮同步后复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；`D-EVENT1..10` 为 `LOCKED`，`D-EVENT11` 与 `D-UI1..3` 保持 `QUESTION_READY`。
300. `DONE_DOCS_GUARD`: 用户回复 `a` 已按当前单题解释为 `D-EVENT9=A`；最终复检确认当前状态保持为 `D-EVENT1..10=LOCKED`、`D-EVENT11` 与 `D-UI1..3=QUESTION_READY`，未将后续内容边界或 UI 方案提前锁定。
301. `DONE_BATCH`: 用户回复 `a`，按当前单题解释为 `D-EVENT11=A`；事件卡以受原著时间线约束的原创地方事件、人物和旁线调查为主，只与原著大事件有限交集，不改写原作主线。
302. `QUESTION_READY`: 应用户要求将事件卡剩余结构问题合并为一批：`D-EVENT12..18`，分别确认候选池抽取、首版类别配比、单卡解析层级、信息公开、重复控制、连环阶段衔接和死亡入口；逐卡文案、数值与原著锚点不计入本批。
303. `DONE_DOCUMENTATION`: 已将 `D-EVENT11=A` 及 `D-EVENT12..18` 的合并问题同步到事件卡系统、UI方案、实现路线、项目入口、决定索引、原著/RAG边界、未决清单和接管合同；当前仍未进入生产实现。
304. `DONE_DOCS_GUARD`: 本批同步后复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；`D-EVENT1..11` 为 `LOCKED`，`D-EVENT12..18` 与 `D-UI1..3` 保持 `QUESTION_READY`。
305. `DONE_BATCH`: 用户整批确认 `D-EVENT12=A`、`D-EVENT13=A`、`D-EVENT14=A`、`D-EVENT15=B`、`D-EVENT16=A`、`D-EVENT17=A`、`D-EVENT18=A`；事件卡基础结构 `D-EVENT1..18` 至此全部锁定。
306. `DESIGN_CLARIFICATION`: `D-EVENT15=B` 公开精确难度、当前概率和主要可预见后果；需要实时生成的战斗胜率在战斗界面精确显示，但任何预览都不得泄露角色未知的原著秘密、幕后身份或隐藏事实。
307. `DONE_DOCUMENTATION`: 已将 `D-EVENT12..18` 的整批确认同步到事件卡系统、UI方案、实现路线、项目入口、未决清单、原著/RAG边界和接管合同；事件卡结构状态更新为 `STRUCTURE_LOCKED_CONTENT_PENDING`，生产实现仍为 `NOT_STARTED`。
308. `DONE_DOCS_GUARD`: 本批同步后复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；当前 `D-EVENT1..18` 全部为 `LOCKED`，仅 `D-UI1..3` 保持 UI 承载 `QUESTION_READY`。
309. `DONE_BATCH`: 用户回复 `a`，按当前单题解释为 `D-UI1=A`；第一版锁定为常驻周仪表盘，调查、判定、事件卡、战斗和结算在其上通过弹层或抽屉承载。
310. `DONE_DOCUMENTATION`: 已将 `D-UI1=A` 同步到 UI方案、实现路线、项目总览、项目入口、未决清单和接管合同；`D-UI2..3` 保持待答，生产实现仍为 `NOT_STARTED`。
311. `DONE_DOCS_GUARD`: 本批同步后复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；当前 `D-UI1=LOCKED`，`D-UI2..3=QUESTION_READY`。
312. `DONE_BATCH`: 用户回复 `a`，按当前单题解释为 `D-UI2=A`；战斗锁定为常驻周仪表盘上的全屏遮罩面板，不跳转独立战斗页面。
313. `DONE_DOCUMENTATION`: 已将 `D-UI2=A` 同步到 UI方案、实现路线、项目总览、项目入口、未决清单和接管合同；`D-UI3` 保持待答，生产实现仍为 `NOT_STARTED`。
314. `DONE_DOCS_GUARD`: 本批同步后复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；当前 `D-UI1..2=LOCKED`，`D-UI3=QUESTION_READY`。
315. `DONE_BATCH`: 用户回复 `a`，按当前单题解释为 `D-UI3=A`；第一版视觉锁定为克制的神秘学卷宗/工作台，深墨底、旧纸信息卡、琥珀与暗红强调，不复制参考项目视觉。
316. `DONE_GATE_STATUS`: 事件卡 `D-EVENT1..18` 与 UI `D-UI1..3` 已全部锁定；S0 底层、事件 schema/fixture 和周仪表盘壳已具备开工条件，但生产实现仍等待用户明确授权。
317. `DONE_DOCUMENTATION`: 已将 `D-UI3=A` 和 S0 授权门禁同步到 UI方案、实现路线、项目总览、项目入口、未决清单、决定索引和接管合同；生产实现仍为 `NOT_STARTED`。
318. `DONE_DOCS_GUARD`: 最终设计同步复检通过：19 个 Markdown 文件、44 个内部链接、0 个悬空链接；当前事件卡 `D-EVENT1..18` 与 UI `D-UI1..3` 全部为 `LOCKED`，项目状态为 `S0_READY_AWAITING_IMPLEMENTATION_AUTHORIZATION`。
319. `IMPLEMENTATION_AUTHORIZED_FOR_GOVERNANCE`: 用户要求先开源、做好 Git 管理、写清 `AGENTS.md`，并建立当前主对话负责审查/发任务、两个独立前后端任务负责开发的拓扑；这构成 R0 治理与任务创建授权，不自动授权臆造未决玩法内容。
320. `DONE_REAUDIT`: 再次对照完整对话固化文档、《汴京梦华》当前审计与 gmzz 协作/权威模式；确认周行动、黑市、季度拍卖、事件卡117定义、普通判定、战斗转盘、结算与构建期 RAG 均已覆盖，主要遗漏是工程合同、写集、逐轮接线/用户审查、Git/开源和抗压缩任务状态。
321. `DONE_PLAN_REVISION_1`: 新建 `docs/MASTER_DEVELOPMENT_PLAN.md`、`ARCHITECTURE_CONTRACT.md`、`THREAD_HANDOFF_PROTOCOL.md`、`OPEN_SOURCE_AND_GIT.md`、`ROUND_LEDGER.md`、R0 合同与两个工作流状态文件；R1—R7 固定为前后端并行、主任务接线、自动门禁和用户审查。
322. `DONE_OPEN_SOURCE_POLICY`: 根据用户“首先先开源”的明确要求，原创代码/工程文档采用 MIT；独立 NOTICE 明确第三方题材/IP/素材不随代码许可证授权，原著正文、私人 corpus、存档、凭据、运行数据库和无来源素材不得进入公共仓库。具体游戏公开发行/商业范围仍为 `PENDING`。
323. `ENGINEERING_BASELINE`: 第一版按本地 Electron 桌面应用实施，Renderer 为前端，Main/preload/领域/SQLite 为后端，主任务拥有共享合同与集成；这是工程落地决定，不替代用户对玩法的最终设计权。
324. `GIT_INITIALIZED`: 已在 `D:\诡秘` 创建 `main` 本地仓库并设置文本换行策略；Git 作者名/邮箱均未配置，因此不伪造身份、不创建初始提交，状态为 `BLOCKED_GIT_IDENTITY_NOT_CONFIGURED`。公共远端与公开发布均未配置。
325. `DOC_VALIDATION`: 当前31个 Markdown 文件的相对链接检查为0个悬空；这只证明文档链接，不代表产品代码、构建或运行测试。
326. `WORKSTREAM_TASKS_CREATED`: 已创建前端任务 `01a04d52-87f7-7c00-a047-7343867cb955` 与后端任务 `01a04d52-95e5-72c0-91d8-ebf0cfe85315`，均为 `gpt-5.6-luna / thinking=max`，当前只读接管并等待 R1 精确合同。任务 API 不提供可验证的“1.5x”参数，因此只把 Luna/Max 写为权威；速度档位若存在由客户端/主机设置。
327. `WORKSTREAM_ONBOARDING_READY`: 前端和后端均完成只读接管并独立确认 `DESIGN_GAP=NONE_FOR_R1`；共同要求主任务冻结 R1 共享类型、窄 bridge、公开投影、intent/receipt/error、根工具链与精确写集，未写产品代码。
328. `GITHUB_AUTHORIZED_AND_PUBLISHED`: 用户明确授权 GitHub 与开源部署；GitHub 插件/CLI 账户为 `dongxuelian11`，仓库本地身份来自授权资料 `E1aina <2806418887@qq.com>`。初始提交 `e0a7677` 已推送到公开仓库 `https://github.com/dongxuelian11/lotm-fan-game` 的 `main`。
329. `DESIGN_GRILL_WORKSTREAM_AUTHORIZED`: 用户要求新增独立深度链接对话，对所有真正未决定的设计按 `grill-me` 一次一题询问，并将回答写入总账本和对应项目 MD。决定只有提交并由主任务合入 `main`、发送 `DESIGN_SYNC` 后才可供开发任务实现。
330. `DESIGN_GRILL_TASK_CREATED`: 已创建独立 worktree 任务 `01a04d69-e530-7df1-b7e9-abc2d24803f1`，模型 `gpt-5.6-sol / high`，基线 `07cf112b6856600981bd1056b3045a8ea029f62f`。它必须先完成只读依赖审计，再从 R2+ 最早未决项一次只问一题；首次写入前切换到 `work/design-grill-r2-foundation`，不得在 detached HEAD 提交。
331. `DONE_DECISION_INTEGRATED`: 设计 Grill 任务从公开 `origin/main=92a6fd9882c154aa998793295b14d172404a50c9` 创建 `work/design-grill-r2-foundation`；用户回复 `a`，将 `D-V1CC4` 锁定为第一版恰好选择2个性格特质并另选1个真实缺陷。主任务已将决定作为 `4107945c276a1d6658bafe2bae49ca6b2b2d86e7` 合入公开 `main` 并发送 ledger revision 247 的 `DESIGN_SYNC`。
332. `R1_ROOT_CONTRACT_FROZEN`: 主任务在 `8048ff1c69fdd540d5b9e7cdae16aec7e007ca21` 建立锁版本 Electron/React/TypeScript/Vite/Vitest 根脚手架、共享 `r1-v1` 类型和最小 CI；在 `e2bfe3833c967d3d9c129919a46b4d9f0d202962` 冻结 R1 桌面权威合同。实测 `npm run typecheck=PASS`、`vitest=1 file / 3 tests PASS`、`npm audit=0 vulnerabilities`；完整 build、桌面 smoke、接线和玩家验收仍为 `NOT_RUN/NOT_STARTED`。
333. `R1_WORKTREES_DISPATCHED`: 前端已迁入任务 `01a04d7d-abe2-7732-9ac0-e4ff95397ca2` / worktree `C:\Users\Administrator\.codex\worktrees\fc83\诡秘`，后端已迁入任务 `01a04d7d-b97c-7311-8700-2f86c39f86c5` / worktree `C:\Users\Administrator\.codex\worktrees\12c6\诡秘`；两者实测清洁且 HEAD 均为公开 `origin/main=e2bfe3833c967d3d9c129919a46b4d9f0d202962`，已收到 Luna/Max、精确写集和 `r1-v1` dispatch。任何新增玩法缺口直接路由设计 Grill，不在开发任务临时决定。
334. `DONE_DECISION_INTEGRATED`: 设计 Grill 任务收到 `ENGINEERING_SYNC=248:86aeb04debe91bc168ac114499479a0293d78c64:R1_FRONTEND_BACKEND_DISPATCHED` 后，从该公开 main 同步并记录用户原答 `a`；`D-V1CC5` 锁定为第一版自动摘要页内选择恰好1项背景过滤的普通技能专精。主任务已将决定作为 `108fc0a457221bca5f8e73e6cb478f4ad2909c2c` 合入公开 `main` 并发送 ledger revision 249 的 `DESIGN_SYNC`。
335. `DONE_DECISION_INTEGRATED`: 设计 Grill 任务从已包含状态同步的公开 `origin/main=294ec4f2ae373e1201c4165b1d55073139356695` 记录用户原答 `b`；`D-V1CC6` 锁定为第一版恰好10个整合出身、五层社会阶层各2个。主任务已将决定作为 `4ec039da4df244d8a318fae61b7ce23ad600185d` 合入公开 `main` 并发送 ledger revision 250 的 `DESIGN_SYNC`；状态同步又作为 `c7da4524b076387a64300e60a652a04e9a3b1206` 合入公开 `main`。
336. `DONE_DECISION_INTEGRATED`: 设计 Grill 任务从公开 `origin/main=c7da4524b076387a64300e60a652a04e9a3b1206` 记录用户原答 `b`；`D-V1CC7` 锁定为第一版恰好12个当前职业，玩家选择其中1个。主任务已将决定作为 `4994ae60663d816018a39523ab5b49ab950c3065` 合入公开 `main` 并发送 ledger revision 251 的 `DESIGN_SYNC`；状态同步又作为 `6eec130cfe361edd71c4e9fca5edf57ebcb8b6ea` 合入公开 `main`。
337. `DONE_DECISION_CANDIDATE`: 设计 Grill 任务在记录用户原答 `b` 后，于提交前同步到最新公开 `origin/main=0b1520ea751a5659b3226397872b2796526e019d`；`D-V1CC8` 候选锁定为出身×当前职业采用直接可选、附带解释与代价可选、绝对禁止三级兼容。该候选等待主任务审查合入和新的 `DESIGN_SYNC`，合入前不得直接进入前后端实现。

## FOUNDATION_AUDIT

- `AUDIT_DATE`: 2026-08-29 Asia/Shanghai。
- `SCOPE`: “基础问题”只统计会阻塞规则引擎、最小可玩纵切或底层算法测试的规则主题；具体途径/能力数据、低优先级角色内容、黑市拍卖细节、RAG 模型选型、发布范围和仅 NPC 的后置规则不计入基础主题数。
- `REGISTERED_NON_LOCKED_TOTAL`: 24。该数字是决定登记中仍非 `LOCKED`/`DONE`/`CANCELLED`/`SUPERSEDED` 的全部条目，均为延期、研究、范围或后续内容项；事件卡 `D-EVENT1..18` 与 UI `D-UI1..3` 已全部锁定，不再计入。
- `CONTENT_AND_LATER_ROUND_THEME_GROUPS_REMAINING`: 6 个主题簇，按真正依赖它们的轮次推进：
  1. 普通能力统一数值判定与能力后果的最小表达（不再建立独立效果事务；具体能力字段后置）。
  2. 健康/精神/灵性/污染/归零/透支/恢复的资源生命周期边界。
  3. 动态周行动束、职业占用关系和世界脉冲入口；城市切换/地图已延期，不阻塞第一版。
  4. 魔药、扮演、晋升、转途径和序列成长边界。
  5. 战斗次数盘与能力盘的组合、快照、可触及、消耗和例外规则。
  6. 胜负后的后果、重战、先手、取整和死亡/俘虏/逃脱等终局边界。
- `COUNT_NOTE`: 这 6 个是内容/后续数值主题簇，不再解释为“开工前还要回答约27题”。R1—R3 的桌面壳、权威存档、公开投影、捏人 fixture、周循环、普通判定和事件 schema 没有新的玩法阻塞题；R4 经济细数、R5 后置战斗细节和 R6 魔药/晋升/真实能力在相应轮次前再 Grill。
- `TECHNICAL_FOUNDATION_BLOCKERS`: 0。事件卡 `D-EVENT1..18`、UI `D-UI1..3` 和底层 fixture 边界足以开始分阶段工程；未决内容不得被占位实现偷偷锁定。
- `MVP_SCOPE_NOTE`: R0 已获用户授权并执行开源/Git/多任务治理。R1 共享合同与根脚手架已冻结，前后端已从同一公开 SHA 开工；这只代表 `R1_IN_PROGRESS`，不代表接线、桌面运行、玩家验收、打包或发布完成。

## RECOVERY_PROTOCOL

发生自动压缩、续接或换代理后，必须按顺序：

1. 读 `AGENTS.md`、本账本、`docs/MASTER_DEVELOPMENT_PLAN.md`、`docs/ARCHITECTURE_CONTRACT.md` 和 `docs/THREAD_HANDOFF_PROTOCOL.md`。
2. 读 `docs/ROUND_LEDGER.md`、当前轮合同和自己的 `docs/workstreams/*_STATUS.md`；深度链接只作导航。
3. 重新查询 Git 分支、基线 SHA、HEAD、差异和三个目录的实时状态；不得把旧快照当 CURRENT。
4. 从已持久化的 `NEXT_ACTION` 继续，不重做已提交工作，不覆盖其他任务写集。
5. 保留所有 `PENDING`、`NOT_STARTED`、`NOT_RUN`、`NOT_AVAILABLE`、`NOT_CONFIGURED`、`BLOCKED` 字面状态，除非得到新证据或用户确认。

## NEXT_ACTION

主任务审查并合入 `D-V1CC8=B_THREE_STATE_ORIGIN_PROFESSION_COMPATIBILITY` 的候选提交，再发送新的 `DESIGN_SYNC`；在此之前前后端不得直接实现该聊天答案。R1 实现权限保持不变，任何新 `DESIGN_GAP` 仍直接推送设计 Grill。
