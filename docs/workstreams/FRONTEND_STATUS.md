# Frontend workstream status

下方首个状态块是 R1 历史接管记录，不代表当前仅有 R1 技术壳或仍处于该轮 hold。后续工作按日期条目记录；每项验证只覆盖该条目的提交与范围，不能累加为当前完整验收。当前产品版本与范围见根目录 `package.json` 和 `README.md`。

```text
WORKSTREAM=FRONTEND
THREAD_ID=01a04d7d-abe2-7732-9ac0-e4ff95397ca2
MODEL=gpt-5.6-luna
THINKING=max
ROUND_ID=R1
CONTRACT_VERSION=r1-v1
BASE_SHA=e2bfe3833c967d3d9c129919a46b4d9f0d202962
HEAD_SHA=THIS_COMMIT
WRITE_SET=src/renderer/**;tests/renderer/**;docs/workstreams/FRONTEND_STATUS.md
COMPLETED=R1_RENDERER_SHELL;R1_SIX_STATES;R1_PUBLIC_BRIDGE_FLOW;R1_IDEMPOTENT_RETRY;R1_DISPLAY_NAME_VALIDATION;R1_ACCESSIBLE_FUTURE_PLACEHOLDERS
TESTS=PASS:npm.cmd ci;PASS:npm.cmd run typecheck;PASS:npm.cmd run test (2 files, 16 tests);PASS:npm.cmd run test -- --run tests/renderer/App.test.tsx (13 tests);PASS:npm.cmd run build;PASS:git diff --check HEAD^ HEAD
KNOWN_GAPS=R1_FIXTURE_ONLY;PACKAGE_NOT_RUN;CLEAN_MACHINE_NOT_RUN
DESIGN_GAP=NONE
NEEDS_MASTER_CHANGE=NONE
PLAYER_ACCEPTANCE=NOT_RUN
STATUS=INTEGRATED_AWAITING_PLAYER_ACCEPTANCE
GRILL_DECISION_ID=NONE
PAUSED_FROM_STATUS=INTEGRATED_AWAITING_PLAYER_ACCEPTANCE
PAUSE_HEAD=bff1fbaae110bd1dc935950c8572ab68084e0860
PAUSE_RECEIPT=GLOBAL_STOP_THE_LINE:D-WORLDFEEDBACK-B1:THREAD_HOLD_SENT
LAST_GRILL_PAUSED_FROM_STATUS=INTEGRATED_AWAITING_PLAYER_ACCEPTANCE
LAST_GRILL_PAUSE_HEAD=f35818fddc0eedc7e4c36c2bea7f076a4f57301a
LAST_GRILL_PAUSE_RECEIPT=GLOBAL_STOP_THE_LINE:D-V1CC14:PUBLIC_MAIN=f35818fddc0eedc7e4c36c2bea7f076a4f57301a:CI=33258145079:THREAD_HOLD_SENT
RESUME_AUTHORITY=DESIGN_SYNC:264:538fb5e0a364e7713315c203339fd73799d789be:D-WORLDFEEDBACK0..6:NO_NEW_IMPLEMENTATION_AUTHORITY
NEXT_ACTION=Hold at the restored R1 integrated state. World feedback design is synchronized but not dispatched for implementation; resume only for player acceptance or a new bounded master contract.
MASTER_STATUS_SYNC=248:86aeb04debe91bc168ac114499479a0293d78c64:R1_DISPATCHED
DESIGN_SYNC_NOTICE=249:108fc0a457221bca5f8e73e6cb478f4ad2909c2c:D-V1CC5:R1_UNCHANGED
MASTER_SYNC_NOTICE=250:4ec039da4df244d8a318fae61b7ce23ad600185d:D-V1CC6_FUTURE_ONLY;MASTER_TSCONFIG_FIX_NOT_ABSORBED
MASTER_INTEGRATION=CANDIDATE:72946759cf1c3b0309f85ddf29b26a5b67df7996;MAIN:0b1520ea751a5659b3226397872b2796526e019d;GATE:14d17c60eb910137a270c645993d374ab74f5231
MASTER_GATE=PASS:FULL_TYPECHECK;PASS:6_FILES_44_TESTS;PASS:FULL_BUILD;PASS:TWO_PROCESS_ELECTRON_RECOVERY
```


## 2026-10-21 · 前期体验小步迭代

- 本次按用户“优化迭代、不要过度设计”的新指示处理实际试玩问题，不新增框架或重做路线。
- 商店与成长操作保留面板；保存中不再把焦点与滚动拉回标题。当前成长内容前置，完整路线可折叠并可直接跳转。
- 本次行动与同次周结算一并展示；休养显示健康、精神、灵性、魔药排异的实际前后值。
- 第一份占卜家委托新增观察后的解释选择；真实失败、成本和原有配方保留，旧已完成记录不重算。指导者具名，服药与答复有短场景反馈。
- 定向规则、界面、旧存档续玩测试已通过；原生界面与重启验证使用独立回放数据库，原有艾达存档不写入。最终验证与提交以本次交付记录为准；不代表全量测试、玩家验收或 Windows 发行通过。

## 2026-10-23 · 首案对手肖像

- 基线 `a0d832b65a5d90770bca1e2f02595c2ecfec765e`，本提交仅补原创携铃者肖像、增大双方肖像与对应渲染测试；素材来源与摘要记入现有美术清单。
- 只在当前首案遭遇显示携铃者；其他战斗和已经结束的遭遇仍使用通用标记，不推断历史敌人身份。不改变领域规则、投影、存档、转盘或数值。
- 已通过战斗展示 19 项测试、完整 renderer 类型检查和 renderer 构建。原生 Electron 独立存档实测重启、第 2 回合进攻与结算；双方肖像、转盘、姿态按钮在 1364×900 同屏，原有艾达存档及备份哈希未变。
- 这是本地候选，完整 CI、Windows 打包和玩家验收未运行；交由主任务整合，不自动推送。详细验证和实际截图见本轮交付记录。

## 2026-10-23 · 姿态与真实受创反馈

- 在从 Library v57 精确恢复的源码上继续，恢复提交 `cdad5ef`，本轮领域基线 `347202b`；旧工作区及旧试玩存档不可用，本次没有声称恢复旧存档。
- 首案普通人战斗的姿态说明放在常显转盘旁，读取公开能力盘的实际归一化概率；说明抽中动作不等于命中、直接伤害或保证免伤。结果使用已保存回合的姿态，不误用下一回合默认选择。
- 首案结果明确区分玩家受创、敌方受创和未新增伤势；仅真实受创的一侧显示短促肖像反馈。原始结果文字不改写，其他战斗保留原解释；快速显示和减少动画继续有效。
- 战斗展示 31 项测试在集成数值后通过，完整 renderer 类型检查和 main/renderer 构建通过。新隔离原生存档通过既有命令进入锅炉房，再实际点击追踪、首回合防守及次回合进攻；验证未受创与敌方轻伤两类结果。重启与快速显示后回合、回执数和完整存档内容哈希不变；键盘切换姿态不提交行动。
- 数值调整属于独立领域提交：新结算的普通人首案回合使用当前参数，包括旧活动战斗的下一回合；已存回合不重算。这里不声称改变数值后历史命令重放仍完全相同。完整 CI、Windows 打包与玩家验收未运行，不自动推送。

## 2026-10-23 · 两行实际动作摘要

- 基线 `30501e2` 已完成累计备份后，按主任务确认继续这一小步：普通人首案结果在转盘下分两行显示双方实际动作顺序与已记录胜势贡献，不推算健康伤害，不重算或改写任何回合。其他遭遇、已结束遭遇与无结果的准备页不额外插入摘要。
- 合并结果说明并缩小快速显示区的留白，保留双方肖像、转盘、风险说明、真实伤势及下一回合按钮同屏；完整回合记录仍默认折叠。
- 原生独立存档重载第 2 回合前后哈希一致；再实际进行第 3 回合防守，玩家格挡削减对手胜势 14，对手两次短棍增加胜势 48，真实后果为玩家重伤、健康 100→70。快速显示不增加回执或修改状态。本次没有再改领域数值。
- 验证范围为定向 renderer 测试、完整 renderer 类型检查、renderer 构建与上述原生流程；完整 CI、Windows 打包、旧工作区存档和玩家验收不在本片验证范围。初次运行导入了更正前的空动作测试预期，原始失败和更正后结果均保留在交付证据中。

## 2026-10-23 · 撤退代价与战后恢复试玩

- 基线 `4160843`。从原生第 3 回合重伤状态继续，不重置或挑随机结果：第 4 回合撤退失败，第 5 回合成功，首案收尾时保留部分救援与证据、携带者带物离开，角色仍有未治疗重伤。
- 仅在普通人首案选择撤退时补明“成功会结束此次追击”，可能放走携铃者及危险物，已有救援与证据保留，之后可继续生活处理伤势。措辞不覆盖已有危险物处置事实、不宣称全案失败或立即恢复健康；没有新增确认、规则、投影或存档改动。
- 继续生活后的现有恢复指引已实际走通：核实诊疗点 → 休养到 82 健康 → 支付 60 便士处置 → 后续休养到 94，原重伤真正解除。每步下一行动与费用清楚，因此未新增恢复按钮或面板。
- 38 项 renderer 定向测试、完整 renderer 类型检查和构建通过。新选择前提示在另一份此前合法建立的隔离战斗存档中原生核验，加载与选择姿态前后回执和完整状态哈希不变；连续试玩存档没有回滚。完整 CI、Windows 打包及玩家验收未运行。

## 2026-10-24 · 结案后续玩不重弹旧战斗

- 基线 `2a5165c`。继续同一隔离原生周目，从第 3 周伤势治愈后正常工作、学习、休养，推进至第 5 周拜访指导者、学习配方，停在材料购买与劳动交换的实际选择；没有重置、挑选种子或新增剧情。工资入账、生活费扣除和下一目标均可辨认。
- 真实发现是续玩时自动弹出很早的撤退回合，遮住当前生活目标。仅在读取“普通人、首案已归档、无当前战斗、生活进行中”的存档时，不再自动展开旧回合；刚结案尚未继续生活、当前战斗与其他途径的原有分支不变。完整纪事内仍可回看原案和战斗记录；不改存档、数值或历史文字。
- 40 项战斗展示测试、完整 renderer 类型检查和 renderer 构建通过。新增两个测试覆盖刚继续生活及后续休养的 JSON 恢复、历史回放保留、无额外提交和状态不变；初跑因纪事与回放都有同段文字导致测试定位重复，更精确限定回放区域后通过，原日志保留。
- 原生同一第 5 周 revision 27 存档，刷新新构建并继续后直接显示当前目标；前后 27 份回执及完整状态哈希一致。未运行全量 CI、Windows 打包、旧工作区原始存档或玩家验收；本轮未尝试 GitHub 上传。截图与连续动作证据交主任务备份。

## 2026-10-25 · 首瓶魔药的台面与成长反馈

- 基线 `382d565`。继续同一隔离原生周目：第 5 周工作，第 6 周完成两步材料劳动、支付 60 便士领取七项材料并领取周薪，第 7 周支付 60 便士及 1 行动调配首瓶。没有重置或选取随机结果。
- 实际发现首瓶完成只显示普通日志，服用入口却排在下一批备料之后。本次将普通人的既有原瓶区前置，用原创内联药瓶刻纹、墨绿台面和黄铜色强调；确认仍使用同一入口、原成功率、来源、状态、成本和风险，不增加确认步骤或等待。
- 当前行动里的配制、晋升、排异结果使用不同但克制的标记；药液落定、刻纹淡定均不足 1 秒，快速显示和系统减少动画可关闭。只读纪事和高序列历史不添加里程碑动画，已保存文字与领域规则不修改。耗尽的瓶子为空瓶，不制造另一剂可服用的假象。
- 原生实际服用判定 49/72，正常成功成为序列 9 占卜家；精神 100→90，灵性仍 15、上限变为 30，现金 360、行动 2 不额外扣除。记录为第 34 份回执。服用前的取消/重新打开、服用后的快速显示均无额外提交；第 33 份存档重载前后哈希一致。
- 最终 3 文件 22 项定向 renderer 测试、完整 renderer 类型检查和 renderer 构建通过。初次类型检查发现新测试把已耗尽瓶子的命令字段误写为空，已改为真实投影保留命令但无可用行动的形态，保留初始日志；没有放宽类型或断言。排异与严重排异通过针对性展示测试，未在本自然周目人为制造。真实成功短片与前后截图已交付。
- 本轮没有运行 main 类型检查、全量 CI、Windows 打包或旧工作区原始存档验证；未进行 GitHub 上传。继续使用恢复工作区，不声称找回旧原始艾达存档。

## 2026-10-25 · 书签委托的原物案头

- 基线 `c0d6eb5`。同一连续原生周目第 7 周继续书签委托，灵视判定 68/68 成功，实耗 1 行动、2 灵性；观察与解释仍分两步，不重置或选择随机结果。
- 给既有书签委托加入原创内联蓝布折痕插图和冷灰蓝标题区，让眼前原物有视觉落点。插图在检查、答复、交付状态相同，不制造光效、诅咒或新线索；其他委托不使用该图。原选项、费用、投影、领域和存档均不改变。
- 3 文件 26 项 renderer 测试、完整 renderer 类型检查及 renderer 构建通过；原生生产构建重载第 35 份回执前后完整存档内容哈希和回执序列一致。截图核实说明与两个解释选项同屏可读。完整 CI、main 检查、Windows 打包及玩家验收未运行，未推送。
- 原生重开已晋升角色时仍会自动弹出旧首案第 5 回合；此前修正只覆盖普通人。已记录为独立后续体验问题，本片未扩大修改范围。
- 随后在原生界面选择只说明观察所得，实际第 36 份回执完成交付：现金 360→372、扮演 0→12、灵性直觉掌握 0→8；答复不另扣行动或灵性，仍 1 行动、13/30 灵性。奖励分配为真实保存结果，不把灵视检查误写成灵视掌握增长。

## 2026-10-25 · 晋升后续玩不重弹旧首案

- 基线 `3cd6dd6`。在上述连续周目的重新载入中实际复现：成为占卜家后，旧首案第 5 回合又盖住当前委托。按追加派发作独立小修，沿用原有已归档/无当前战斗/生活进行中条件，仅扩展到序列 9 占卜家；其他途径及更高序列的处理分支不变。
- 原保存回合、历史回放与规则不改动；当前战斗与刚结案未继续生活仍保留结果入口。新增已晋升读档、后续休养、当前战斗、刚结案测试。最终 3 文件 61 项定向测试通过（与上片测试有重叠，不相加）。
- 最终完整 renderer 类型检查、renderer 构建通过。原生生产 renderer 重载同一第 36 份存档后直接回到生活与当前委托，不再弹旧回合；重载前后完整存档哈希与回执序列一致。未重启 Main 进程，未运行全量 CI、main 类型检查或 Windows 打包。

## 2026-10-25 · 委托掌握成长的分配说明

- 基线 `1245194`。同一原生周目自然完成装箱单委托：知识 30/66 成功，消耗 1 行动和 3 灵性，获得 12 便士、12 扮演；掌握成长实际分给灵性直觉 8→16。扣除 120 便士生活费后进入第 8 周，第 37 份回执，现金 264、灵性 10/30、3 行动。
- 实际疑点是“使用占卜，却增长灵性直觉”；只读核对 `awardSeerMastery` 确认为现有随机分配，不是所用能力必涨。仅在仍有处理选项的委托前补一句：成功交付的掌握成长会随机分配给一项已知能力，不一定是本次使用的能力。已完成历史不重复说明；现有结果已显示真实获得者，不再重复加一条结果或加入选择控件。
- 本片不修改领域、随机、奖励、投影、存档，不增加美术卡片；自然试玩停在第 37 份回执。
- 2 文件 17 项定向测试、完整 renderer 类型检查、renderer 构建通过。原生生产 renderer 重载后，解释与两项选择同屏可读；第 37 份完整存档哈希和回执序列不变，下一案未执行。没有运行 main 检查、全量测试/CI、Windows 打包或玩家验收。

## 2026-10-25 · 委托结果回到案卷、次要里程碑收起

- 基线 `a9bc088`。按用户最新持续试玩派发，恢复同一原生周目第 8 周第 37 份回执，实际选择陈列架委托的安全距离直觉检查：感知 92/68 失败，消耗 1 行动、1 灵性，无报酬/扮演/掌握奖励；第 38 份回执，现金 264、灵性 9/30、2 行动，下周可重试。没有重置或挑选随机结果。
- 真实发现是结果压成小字悬浮条，而未开放的反思按钮和耗尽瓶子抢占案头。本片把序列 9 委托回执放回对应的所选委托内，纸面标题与正文分层、正文增大且不悬浮遮挡。仅按公开委托标题匹配现有回执；切到另一案不显示旧案结果。重开可以回看仍为 lastResult 的这条记录，不声称新增全部历史查询；周末同时生成的其他结算仍按原入口显示。
- 未开放反思保持按钮、费用和原因但改为紧凑次要行；仅晋升后且所有瓶子明确已耗尽时默认折入“已耗尽魔药记录”，原来源与结果可展开。普通人、任何备好未用的瓶子仍保留原突出入口。无新增动画、领域/随机/投影/存档规则改动。
- 定向 renderer 测试、完整 renderer 类型检查、renderer 构建及原生同一失败存档重载/切案/展开记录/返回日常验证，精确终态与截图见 `output/commission-layout-20261025/QA-summary.json`（工作区外部证据）。最初类型检查与测试并跑被资源终止，已改为串行独立重跑，不把终止当成功。未运行 main 检查、全量测试/CI、Windows 打包或玩家验收，未推送。

## 2026-10-25 · 交付委托后仍能回日常

- 基线 `6c4fa3a`，待 v65 累计备份完成后继续原生同一周目。第 8 周选择逐字核对注意事项两页，知识 39/64 成功，消耗 1 行动、0 灵性；现金 264→276、扮演 24→36、神秘学记忆掌握 0→5，第 39 份回执，剩 1 行动、灵性 9/30。没有重置、重掷或选择随机结果；下一丝带案只查看未执行。
- 真实发现成功交付后处理选项为空，原有预算与“返回日常行动（不消耗行动）”也随之消失，玩家尚未领取工资却只能看到继续委托入口。本片仅去掉预算区对非空选项的依赖，交付后仍显示真实剩余行动、灵性、工资状态，并沿用原免费返回回调及保存锁。
- 原生将窗口缩至应用最小宽度 1280 检查两项调查方法，方法文字和全部费用仍完整可读，未发现截断；因此没有增加标签、拆解任意叙事或为每张卡机械补插图。窗口已恢复近原宽度（1360），没有关闭应用。
- 定向 renderer 测试、完整 renderer 类型检查、renderer 构建和原生第 39 份存档回看交付/返回日常验证，以 `output/notice-commission-20261025/QA-summary.json` 外部证据终态为准。无领域、随机、奖励、存档和动画改动；不运行全量 CI/Windows 打包，不推送。

## 2026-10-25 · 日常四行动的刻线小幅

- 基线 `9709ccd`，v66 备份确认完成后按主任务批准的美术方向实施。本片不继续游戏，第 39 份存档保持不变。
- 日常城市全景和人物肖像已有版画气氛，底部四行动原细线办公图标较显通用；仅替换为原创内联刻线工具箱、翻页书本、纸边放大镜、杯碟。四幅统一 80×48 画布、64×39 显示与墨色，少量排线和低透明度阴影保持轮廓可辨，不画隐藏线索或暗示玩家拥有新物品。
- 按钮原高度、标签、行动费用、提示、命令与禁用规则全部不变；装饰 SVG 不进入无障碍名称、不新增焦点、动画、导航或外部素材。已有按钮焦点轮廓与禁用淡化继续沿用。
- 验证定向 renderer 测试、完整 renderer 类型检查、renderer 构建及当前 1360/最小1280宽原生同屏效果；精确终态/截图见外部 `output/life-vignettes-20261025/QA-summary.json`。原生不为美术测试额外点击工作/休养；禁用行为由定向测试覆盖，不冒充该周目的实际禁用场景。未运行全量 CI、main 检查、Windows 打包或玩家验收，未推送。

## 2026-10-25 · 委托锁周后的日常去向

- 同一原生存档从 revision 39 自然游玩至 54：领取五次周薪并结算生活费、一次休养、八次委托检查（三次失败保留）、首次反思。第13周完成8/8与扮演100，仍为序列9；现金636、灵性4.5、行动1。没有重置存档或挑选结果。
- 实见7/8且余下委托本周锁定时，“接下来”错误退回泛化能力实践。现仅在未完成数量与非空处理选项数一致、所有选项均禁用且公开原因精确为锁周时，保留交付/扮演进度并导向现有日常行动。可处理委托、待解释书签、8/8反思、消化100晋升准备保持原路径。
- 不增加领域/投影字段，不改失败、行动、工资、灵性、随机或晋升规则。空选项和一般资源不足不视为锁周。
- 定向导航测试39项通过，覆盖无行动提交的LIFE聚焦、可处理委托、空选项、反思及晋升准备；修正该文件旧反思测试与此前保留免费返回预算改动不一致的断言。
- 原生7/8问题前图已保留；修复后不回退真实时间线，不宣称7/8原生后图。当前rev54里程碑用于验证未受影响的晋升准备导航。完整证据与运行状态见 `output/life-cycle-20261025/QA-summary.json`；main/full-suite、CI、安装包和玩家验收未运行。

## 2026-10-25 · 小丑准备的成本与当前资源对照

- 原生第13周的配方准备页中，原按钮只占左半栏，而现金/剩余行动在模态背后不可直接对照。改为同一纸面框内的主行动与窄资源栏，直接显示现有 `resources.actionsRemaining` 和格式化现金；单一准备行动填满主栏。
- 只作用于未晋升且存在准备行动的布局，保留既有成本、指令、禁用原因、风险原文和服药确认；序列8实践不增加准备预算。无新图标、无结果推导、无领域变化。
- 小丑定向17项测试、renderer类型检查与构建通过；该测试文件旧战斗断言同步为现存分开的灵性/纸张文本，战斗实现未改。
- 原生1360、1280与1280大字模式均可同时读到行动成本和现金/行动；键盘焦点与关闭返回正常。未点击购买或服药，revision54状态/回执前后完全相同，窗口1360与常规字号已恢复。
- 证据：`output/clown-preparation-20261025/QA-summary.json`。main/full-suite、CI、安装包和玩家验收未运行。
- 同轮视觉复核追加：仅为既有 `.slice-growth-jump` 链接设置酒红/墨色、保留下划线并补明确键盘焦点，不修改全局链接或导航。最终renderer构建通过，1360原生链接颜色/焦点复核通过；窗口/字号恢复，rev54仍完全不变。

## 2026-10-26 · 原瓶优先与多批备料排版

- 基线 `5e78464`，按最新持续试玩派发从同一 revision54 自然学习小丑配方、完成第一批三次劳务、领取材料并调配；期间正常工作领取周薪，跨周生活费与未领取旧周工资均保留，未重置/改写存档或随机结果。
- 真实发现：多批备料的窄资源侧栏使成本折行且留下空白；调配完可用原瓶被备用采购挤到屏外，与“下一步服用”不一致。仅将现有瓶区移至备料之前（DOM/键盘顺序一致），多行动准备改全宽两列与横向紧凑资源条，单行动原布局及晋升后实践不变。
- 保留原投影成本、禁用原因、指令、风险、独立确认和取消；无领域、存档、概率或数值修改。小丑定向19项测试、renderer类型检查和构建通过。原生1360/1280核对原瓶与备用成本；取消/关闭/重载期间revision61存档和回执完全相同。原生截图重载后临时结果条按既有行为消失，不冒充相同临时UI。
- 随后自然确认第一瓶：意志62/62成功，revision62/week15晋升小丑，精神90、健康100、灵性4.5（上限45不补满）、现金226、行动1；原瓶耗尽，原S9掌握继承，新能力从0开始。停止于该里程碑，没有继续训练或重掷。
- 外部证据 `output/clown-play-20261026/QA-summary.json`。main/full-suite、CI、安装包未运行；GitHub发布由主任务另行协调，本片未推送。

## 2026-10-26 · 战斗展示旧断言与实际风险可读性

- 基线 `ad798a1` 已上传 PR53；其 Windows contract（含桌面重启）与 isolated 已通过。历史分片3发现创生者两项旧展示断言失败：旧测试要求恢复详情始终展开，以及依赖健康标签和值之间的文本空格；现有 CombatStage 已改为健康条与可展开详情。
- 不改变产品代码、伤势规则或已存回合。五个使用相同战斗界面的历史测试保留原风险数值、回放及保存断言，并补检常显的精确轻伤/重伤/死亡条件概率与非整场概率声明，实际打开详情后再核验恢复区。三套健康断言改为核验双方命名进度条的当前/最小/最大值以及对应可见标签和精确值，不用宽泛文本匹配。
- 增加无外部fixture的展示回归，核验打开详情不提交命令、不改变投影。战斗展示46项通过；补强可见健康文本后的单项再跑通过；renderer类型检查、CI inventory与差异空白检查通过。通过认证仅恢复原manifest校验的知识导师boundaries，两个实际首回合/终局回合测试通过（其余10项未运行）。
- 创生者原index及战斗parts04/05尚未在有限已知归档映射中定位，未制造fixture或进行全归档恢复；其余捕获型受影响套件未在本机完整运行。当前远端历史矩阵继续收集结果；本修复尚未推送，不声称全量CI或合并完成。
- 同一远端运行的分片5随后发现医疗导航捕获测试也把恢复详情要求为永不折叠；已复用上述严格常显风险/真实展开验证，同时保留无导航、无提交、原存档与原死亡终态断言。该医疗文件的捕获fixture本机未恢复，完整renderer类型检查通过；不将此称为捕获测试已通过。
- 集成检查另在分片5复现两个领域兜底一致性失败。`bd51d3b` 将首案普通预算判定改为结算器真实无已识别profile的兜底，而非仅看pathwayId是否为空；既有普通首案武器24/格挡14/敌基础95不变，已识别耕种者敌棍16/基础114及专属遭遇分派不变。未支持的mother S1/S0与justiciar空序列继续严格等同普通兜底。原两项断言未削弱，三份相关领域完整文件94项、NatureWalker kernel21项及main类型检查通过。最初公共次数盘selector方案因不等于真实首案分派而撤销，未进入提交；未改公共次数盘或既存回合。
- 同一运行的分片7/8及分片6日志进一步命中同一兜底条件：医师38、仲裁人/律师40、治安官17项原完整文件在现修复HEAD上全部通过，累计定向领域210项/8文件；没有再修改这些断言。分片6实际20批96文件在120分05秒完成，随后清理阶段收到2小时作业上限取消（另有已修复的治安官断言失败），不能称为绿色。按实测仅给矩阵分片6的作业预算150分钟，其余15分片仍120，全部测试/断言/步骤/并行度不变；YAML解析及结构差异验证、inventory检查通过。不是放宽单例超时或跳过失败。
- 分片9唯一失败为小丑测试中`[null,9]`两项旧表仍都期待首案敌基础114；依据已实施的`347202b`普通首案调校，精确修正为null普通109（95档位+14体质），已识别占卜家S9仍114（100+14）。保留原玩家预算、次数、5次抽签与cursor断言，不改变产品或兜底规则。小丑/普通战斗两完整文件90项通过；不是给所有未支持序列放宽期待。
- 分片10的洞察者折叠详情旧断言已包含在前修复；新增发现诡法师捕获测试泛查`status`，与新增“当前姿态”状态区冲突。现严格限定至实际展开的公开轮盘详情内，保留原钟ID、对手灵性、见证人数、非晋升挑战及无提交检查，并确认当前姿态仍在。相同泛查扫描未发现其他捕获战斗/导航套件的同类未限定目标；单独CombatStage结果和独立错误面板不改。新增明确标注的仅展示投影测试验证两类状态可区分、原钟完整事实不变且无提交，1项通过（46项未重跑）；此非S4自然周目。捕获fixture缺失，原捕获文件本机未运行；修改该文件后的renderer类型检查通过。
- 分片12唯一失败为窃梦家测试显式构造普通/null首案时仍期待敌方在手短棍16；按`347202b`精确改为24，保留抽签顺序/总数，并新增普通cursor恰为5的断言。独立的旧Error S7/S8/S9分支保持原断言。该完整文件27项通过；没有产品数值再调整。
- 主动同类扫描（非新增远端失败）定位两处明确普通/null首案旧数值：观众测试敌方16/总130改为24/133，梦魇全落空敌基础114改109；玩家数值、原健康/伤势、随机和梦状态断言不变。修改前精确两项本机复现失败，修改后精确两项通过。两完整文件尝试65项通过、1项因缺失原`nightmare-v0220/negative-accident-boundary.json`而未能验证，不能称两文件全绿。扫描未发现其他同类普通首案数值；已识别途径及历史存档的16/114/10刻意保留。

## 2026-10-27 · 小丑实践、补给与护送的卷宗分区

- 从已合并主线 `5d238cd` 的 `feature/clown-ui-flow` 开始。依据同一原生rev64首训后的实见问题，只以既有命令分组：BUY_PAPER进入紧凑库存行，PRACTICE独立日常实践区，RESCUE_TALK/FIGHT与原快递员情境相邻成护送区；战斗保留完整死亡风险文字并增加酒红左线。普通实践正文改墨色、分区标题留白，费用原字符串完整保留，不解析叙事。
- 晋升后的下一步优先实际可用实践，实践不可用时选可用护送，再考虑补给；未晋升配方/瓶子布局与原命令/保存锁不变。无新菜单、领域或随机修改。
- 定向小丑20项测试、renderer类型检查、构建通过，覆盖分组/原命令/禁用/无实践转护送/已结案故事保留。原生约1360与精确1280宽效果可读；布局与重载前后rev64存档完全一致。
- 自然承接此前首训，唯一一次护送交涉失败：rev65/week16，AP2→1；现金286、健康100、精神90、灵性3.5、扮演16不变，艾尔西仍持包裹，本周交涉锁定。真实失败结算后返回日常，未再试、未开启战斗、未买纸；窗口恢复约1360。
- 额外复现未修复问题：fresh build加载S8时旧首案回合自动弹出。公开lastCombatRound无来源，caseArchive无回合边界，不能用猜测隐藏后续战斗；此片记录后交主任务审查最小只读来源方案，不扩大schema。
- 外部证据 `output/clown-flow-20261027/QA-summary.json`。main/full-suite、CI、安装包未运行；没有推送，发布由主任务协调。

## 2026-10-27 · S8 未开始护送战斗时的旧首案弹窗

- 经实际 fresh build 重载复现后，单独增加只读投影 `clown.rescueCombatStarted`，直接取既存 `startHistoryIndex !== null`；未改存档、迁移、随机或战斗规则。交涉成功与失败均不会设置该战斗索引。
- 仅在 ACTIVE、diviner S8、无当前战斗、有首案归档且该字段明确为false时沿用旧首案不自动弹出逻辑。字段缺失保留原行为；护送开始后的胜利/撤退/死亡、当前战斗继续展示。没有声称解决其他途径/序列的来源区分。
- 投影6项、小丑20项、战斗展示55项（共81）通过；随后将死亡用例严格改为DEAD封存入口，相关5项再通过。main/renderer类型与构建通过。旧clown-adventure套件因缺失natural.json fixture未完成，不称全套通过。
- 原生重新启动同一数据目录，rev65直接进入日常，无旧首案弹窗；原失败交涉与资源保留，重载前后读取的完整存档摘要完全相同。历史回放继续可访问。无新增游戏行动。

## 2026-10-27 · S8 战斗来源投影的精确作用域

- PR54 首轮 CI 分片1/2实际发现新字段无条件加入无关途径，使白塔、深渊、审判者等原始公开投影严格比较/哈希不一致。修复产品投影：只在真正 diviner S8 输出可选 `rescueCombatStarted`，与唯一消费条件一致；其他途径及S9/S7不新增该字段。
- 保留全部历史捕获原字节、哈希及严格比较，不修改适配器。检查真实小丑v050捕获消费者：比较私有状态、既有能力及首案归档，不比较含新字段的完整公开投影；本机原natural.json仍缺失，不冒充捕获套件已跑。新增非S8字段缺席/不变性断言，原S8六种来源与当前/死亡/缺字段展示回归保留。
- 与待发布撤退视觉片94d3521分支隔离；本片仅修PR54，不包含后续UI变更。验证与新精确CI运行由外部审查日志记录。

## 2026-10-27 · 撤退意图结果优先于回合胜负

- 在独立本地 `feature/retreat-outcome-clarity`（基线2b6a4b2）处理实际S8第2回合“撤退失败但胜负盘你胜”的层级歧义；PR54原分支/远端不变，不推送。
- 仅使用既有retreat字段，为成功/失败结果增加独立28px标题行和双线分隔，次数/先后保持次级；三个核心盘、数值、普通攻击展示不变。失败且DEAD时死亡优先、保留撤退失败；只有ACTIVE且仍有combat才显示“仍在战斗中”，REVIVAL_PENDING/无战斗历史不暗示可再行动。
- 战斗展示完整60项、renderer类型与构建通过，含失败撤退+玩家胜、失败+受伤、成功无胜负盘转动、死亡/复活待定/无战斗、普通结果与减动画。首轮新增受伤断言错误地选到未受伤的敌胜样本；修正测试取样条件实际要求健康降低，未弱化断言，最终完整60项通过。
- 原生只读重载真实rev71成功撤离，1280与约1360宽三盘、实际后果、返回生活可见；快速显示不改变存档。没有倒改rev70重现失败，失败/死亡变化由结构展示测试覆盖而非声称原生后图；原rev70失败前图保留于clown-combat-20261027。
- 外部证据 output/retreat-clarity-20261027/QA-summary.json。该阶段无游戏行动，无领域/随机/存档改动；主类型、全套、CI和安装包未运行。

## 2026-10-27 · 小丑实践的当前资源与回执层级

- 本地 feature/clown-resource-flow 以 b00a58e 为基础，保留撤退展示修复（cherry-pick 为 c132228）；原 b00a58e 与 94d3521 分支不动，无远端操作。
- 实际伤后休养→纸靶实践发现：费用在下方，行动/现金在遮罩后，纸张/灵性需翻找，而旧回执常驻遮住操作。仅晋升小丑增加紧凑当前资源横栏（直接公开投影：AP/灵性/纸/现金）；回执完整回到正常流，新回执及重开时立即定位，滚动后让当前资源保持可见。未晋升布局、费用、规则和三轮盘不变。
- 自然同存档：rev71休养至rev72健康100伤势清除；唯一纸靶实践失败、消耗1纸与1灵性，周结算扣120至rev73/week18/AP3/cash36；正常工作一次工资180，最终rev74/AP2/cash216/spirit24/45/paper8/acting16。未重试失败、未再战斗、未改存档。
- 原生1280普通/大字与约1360普通布局检查，资源和4实践按钮同屏；大字单位小于数值且无挤压。工资回执关闭重开仍可见，工作后/重开后/最终只读状态完全一致。恢复普通字号宽窗口并返回日常。
- 小丑21、战斗展示60、来源投影10（共91）测试通过；追加精确现金/非晋升资源断言的定向2项通过；renderer类型、最终构建通过。基线main编译通过；未跑全套、CI、安装包。
- 已记录但未扩大修复：加载时已完成护送回合仍自动回看；大字下旧成功撤退轮盘文字偏拥挤，保持后续视觉审查，不声称此次解决。证据 output/clown-resources-20261027/QA-summary.json。

## 2026-10-27 · 已明确返回生活的小丑护送回合不再自动回看

- 独立本地 feature/clown-read-round 基于已备份 fb62192，旧资源/撤退/投影分支保留。只新增Renderer本机已读书签，不改领域存档或随机。
- 确认原因：loadRun恢复lastCombatRound，而返回生活此前只清React状态；rescueCombatStarted=true不能区分已读。仅ACTIVE、diviner S8、无combat、护送确已开始且有保存回合时，在明确返回生活写入runId+历史长度+回合完整内容。重载完全匹配才不自动弹；死亡/进行中/新回合/另一角色/缺字段/存储不可用仍走原展示，完整纪事不变。没有用时间、叙事标题或结局猜测已读，也不自动回填旧存档。
- 原生真实rev74：首次仍弹已保存第3回合→点击返回生活→重载继续直接日常→完整纪事仍能展开该真实成功撤离后果。前后只读状态逐字一致，无任何游戏行动或新战斗。证据 output/clown-read-round-20261027。
- 战斗展示完整69项通过；最终测试类型修正后的书签定向9项通过（其余60未在该次重复）；renderer类型、构建与diff检查通过。首次新增历史断言因未限定section而重复匹配失败，限定真实回放section后修正；类型初次因新增测试误用私有combat形状失败，改用真实公开投影构造后通过。未弱化产品行为。
- 限制：书签为本机UI偏好，首次/清除本机数据后仍显示旧回合一次，需明确返回生活；不跨设备同步，不宣称解决其他序列回看策略。main/full-suite/CI/安装包未运行，无远端操作。

## 2026-10-27 · 护送终结记录明确区分撤离与完成

- 独立本地 feature/clown-escort-record 基于 f5df620/v77，旧分支保留。原生同rev74观察：永久撤离后的护送大卡仅写“已有记录”，既不说明未解决，也不说明不能再次介入，容易误读为成功。
- 只在diviner S8已有终结状态RESCUED/RETREATED/LOST输出可选rescueOutcome；依据既有权威状态调整story，不从回合胜负猜测。撤离明确“未替艾尔西解决冲突/后续仍待确认/未转入库存/不能再次介入”，死亡只说明玩家死亡与未完成，不虚构快递员生死。其他途径/序列、AVAILABLE/FIGHTING不新增字段。没有迁移、数值、随机或可重入规则变化。
- 终结卡采用紧凑卷宗记录样式：同一标题行显示结果，酒红侧线替代待处理卡顶线，正文保留可读，仍可访问历史。旧投影缺字段回退原情境卡；原风险、费用与命令不变。
- 唯一自然实践：陪伴道具师成功，rev74→75、AP2→1、acting16→32、敏捷掌握0→8；week18/cash216/HP100/mind100/spirit24/45/paper8不变。首次滚动中坐标落空后先确认rev74未变，再定位执行一次；未重复尝试或重置。护送既有失败保留。
- 最终renderer24项、只读投影10项通过，含终结字段缺席作用域与缺字段旧卡回退；main/renderer类型、main/renderer构建、diff检查通过。额外尝试clown-adventure捕获套件因原tests/fixtures/clown-v050/natural.json缺失而未运行，不补造fixture、不声称该套件通过；初次混合运行34项通过但该文件加载失败，最终两受影响文件各自通过。
- 原生同rev75普通宽窗与1280大字完整后果可读；Main重启加载新投影仍直接回日常，无旧护送弹窗（书签仅匹配战斗历史长度与lastCombatRound，新增投影字段不在签名内）。实践后/构建重启后/最终只读状态逐字一致。恢复普通字号宽窗并返回日常，无更多行动。
- 证据 output/clown-escort-record-20261027/QA-summary.json。全套、CI、安装包未运行；无远端操作，等待独立审查。

## 2026-10-28 · 小丑成长与周结算回执排版

- 基线 `ebb700d`，新分支 `feature/clown-weekly-flow`，保全所有旧分支。自然实践最后一个行动：真实成功，纸张飞刀随机掌握 +8、扮演 32→48；生活费 120 与新周结算均保留。随后正常领取第 19 周工资 180，停在 rev77 / AP2 / cash276 / spirit22。
- 仅为晋升后 S8 小丑抽屉的回执增加标题/正文分栏、细分隔和随大字号设置放大的正文；不改变记录顺序、文案、领域字段、成本或结算。原有资源横栏与非固定回执位置保留，其他途径和占卜家里程碑不改。
- 24 项小丑 UI 测试、19 项占卜家回执回归、renderer 类型检查及构建通过。覆盖跨周记录、同名多记录、失败成本原文、资源同步、关闭重开不重复提交。
- 原生 1360 普通及 1280 大字号检查完成。before 为真实跨周四条回执；生产重载会清空瞬时回执，after 为随后真实工资回执，不冒称相同内容 A/B 或四条 after。工资后关闭重开与改字号的存档 hash、回执列表完全相同。
- 证据在 `output/clown-weekly-20261028`（工作区外层）。无远端/认证操作；未运行全量 CI、打包及缺失 natural.json 的捕获型小丑领域套件，不以定向测试代替这些边界。

## 2026-10-28 · 当前小丑成长刻度与护送终结后的生活提示

- 基线 `79bc92b`，新分支 `feature/clown-growth-continuation`。本周只自然实践一次“在责备声中把话说完”：真实成功，rev79→80 / AP3→2 / acting48→64，随机纸张飞刀掌握8→16；现金156、灵性21、纸张7不变。上周失败与护送撤离保留，不重试刷结果。
- 当前 diviner S8 的扮演数值配低饱和墨色刻度条，完整保留公开消化说明为次级正文；不解析叙事，不新增解锁承诺或领域字段。准备阶段及其他序列的历史面板不加当前刻度。
- 生活右栏仅在明确已有终结 rescueOutcome 的活动 S8、无事件/战斗时替换过时的“可护送”通用提示，提示不可重入并引用真实 enabled 实践；无可用实践回到日常，不创造新任务。缺字段、其他序列、事件、战斗、死亡仍沿用原提示。
- 31 项小丑 renderer 测试、renderer 类型及构建通过，含刻度0/64/100、行动回执同步、三种终结状态、无可用实践和旧提示保护。首轮3项测试因摘要与已有折叠历史同文命中多个元素而失败，改为限定摘要区域后通过，原始失败日志保留。
- 原生1360普通及1280大字号检查日常、成长、关闭重开；同rev80存档内容hash及回执列表重载前后完全一致，无旧护送自动弹窗。生产重载清空瞬时多条回执，截图比较针对相同64/100成长与终结护送状态，不声称完整回执内容相同。
- 证据目录：工作区 `output/clown-growth-20261028`。无远端/认证操作；全量CI、打包、捕获领域套件未运行。保持rev80等待独立审查及备份。

## 2026-10-28 · 成长终点不再把补纸当作下一步

- 基线2b93398，新分支feature/clown-progression-loop。真实工作及最后一项纸靶实践后rev82/week21/AP3/cash216/spirit20/paper6/acting80，五实践完成，原护送RETREATED保留；未刷取、未改存档。发现购买纸被列为成长下一步，以及五实践80无法接续S7的领域覆盖缺口；后者单独处理，不用提示掩盖。
- 当前S8仅优先实际实践/护送命令；已终结且无实践时明确纸张不加扮演，满进度则提示查看已有魔术师条件。生活主引导在未满且无剩余实践时回日常，不虚构可做任务。纸张真实库存、购买动作/费用、历史保留；缺终结字段及非当前序列不套用终点说明。
- 此提交只改Renderer。证据与各阶段检查见工作区output/clown-loop-20261028；下一提交才引入获批的有限撤离后复盘。

## 2026-10-28 · 魔术师筹备的当前批次与实际预算

- v81/f1ea0a1后继续真实S7筹备，新分支feature/magician-preparation-loop。正常领第21、22周工资、学习配方240便士、跨周生活费各120、完成第一批四项劳动，停在rev90/week23/AP1/cash96、周龄8/8、扮演100。没有重复领取工资、没有开始备用批次。
- 观察到第一批已抵1800主材费、只差150辅材时，摘要却推荐第二批重新劳动；平铺动作还让不同批次左右混杂。现只按现有命令batchId分组：保留首个未完批次的目标与真实阻塞原因，已备原瓶优先；其他批次置于明确可展开的备用区域，精确命令/费用不变，不隐藏不可逆风险。
- 仅筹备页增加紧凑AP/现金资源横栏，不复制S8纸张库存。筹备回执改静态以免与资源重复吸顶，沿用现有结算后滚动查看结果。已晋升实践与确认服药的原资源/风险界面不变。无领域/随机/价格变化。
- 同rev90普通及1280大字改前证据与最终验证详见output/magician-loop-20261028/QA-summary.json。后续真实购买/结算另行记录，不把不同状态截图冒称相同内容对照。
- 37项魔术师Renderer测试、最终renderer类型检查/构建通过。真实rev90改前改后存档摘要及原始内容hash完全一致；备用批次展开仍可用，已备瓶/失败重配/阻塞摘要由定向测试覆盖，未伪造原生瓶状态。
- 随后正常领取第23周工资并跨周支付生活费，rev91现金156/AP3；实际购入第一批六料扣150且0AP，rev92现金6/AP3，摘要准确指向缺60便士的调配。关闭重开抽屉的存档摘要与hash完全一致，未重复扣费。未继续调配/服药，等待本提交审查备份。

## 2026-10-28 · 魔术师原瓶确认风险分层

- 基线5109c5f/v82，新分支feature/magician-risk-clarity。真实第24周领取工资180后，用第一批六料支付1行动/60调配原瓶，停在rev94/AP1/cash126/HP100/mind100/spirit20，原瓶尚未服用。普通及1280大字号观察到四档后果与补货规则混成长段，最终确认位置看不到原瓶成功率。
- 经主任务批准，固定内容拆成同源规则、四档后果和保护说明；既有公开risk文本按原顺序拼接完全不变，无公开投影新字段、无领域结算/概率/存档变更。默认展示全部四档后果和保护边界，完整筹备补货说明仍可展开。实际原瓶概率和动作成本移至最终确认按钮前，不硬编码或夸大概率。
- 先保持未消费原瓶完成同rev94原生前后检查和测试，提交审查后才自然服用，不回滚制造对照。截图、检查日志、实际服药结果将记在工作区output/magician-consumption-20261028/QA-summary.json。确认前取消不提交指令，使用已有一次提交锁。
- 42项Renderer测试、main/renderer类型与两端构建通过；测试包括完整原文逐字相等、四档/保护默认可见、所选瓶的实际概率/成本、取消和忙碌/重复确认保护。原生普通及1280大字四档和确认摘要已检查；完整补货原文可展开，取消重开/重载后同rev94摘要与存档hash完全不变。未在本提交前消费原瓶，等待短暂独立审查后自然继续。

## 2026-10-28 · 失败后重配行动与耗尽原瓶记录

- 基线f7402b3/v83，新分支feature/magician-recovery-records。第一瓶真实失败后，正常3次休养将排异25→15→5→0，健康/精神回到100；第25、26周工资和两次生活费照常结算。第二批仅完成第一项劳动，当前rev101/week26/AP1/cash246/spirit40.25，第一瓶失败耗尽仍保留。
- 观察到旧瓶大卡置顶使1280大字号的当前第二批劳动落到屏下。现仅按既有CONSUME动作的bottleId关联区分准备瓶与耗尽记录；含disabled的准备原瓶仍优先，耗尽记录放在当前材料行动之后的计数折叠内，来源/失败状态原文全部保留。已晋升历史、确认/取消/一次提交逻辑不变；无领域或投影变更。
- 同状态普通/1280大字前后、历史展开及后续自然筹备证据见工作区output/magician-recovery-20261028。生产重载清空瞬时劳务回执，比较仅为同存档布局而非相同回执内容。
- 46项魔术师Renderer测试、renderer类型/构建通过，包含有效/耗尽混合、disabled原瓶仍保留、全耗尽当前批次可见、历史展开、晋升后原历史以及确认取消回归。普通与1280大字原生检查当前劳动按钮与预算同屏，历史可展开看到“排异，未晋升”。同rev101重载/改字号/展开前后存档摘要与hash完全相同。Main/领域未变，本切片未重跑全CI或缺fixture套件。

## 2026-10-28 · 魔术师晋升后的局部入口滚动

- 基线886a07f/v84，新分支feature/magician-promotion-entry。第二批完整4次劳动、第27/28周工资与周生活费均正常结算；支付150辅材、1AP/60调配，第二瓶真实意志39/54成功。停在rev109/week28/S7acting0/AP1/cash156/HP100/mind90/spirit40.25，上限60但未补满；原第一瓶58/54失败仍保留。
- 观察到确认页底部scrollTop在S8→S7组件切换后保留，sticky成功回执在顶，但新实践入口在上方不可见。根因既有回执滚动限定准备期，晋升同次状态变化使条件失效。只增加同run magician.promoted false→true时最近.slice-dialog的scrollTop=0；不是整页跳转、不改后续普通实践滚动/页面、不新增持久化或领域规则。
- 真实晋升不允许回滚重演：bug截图来自实际rev109，修后转换由定向组件状态转换测试覆盖；原生只检查当前S7入口和之后一次自然实践，不冒称原生重演晋升。

### 2026-10-28 — Preserve explicitly read escort record after S7 promotion
- The local read bookmark can recognize the identical previously acknowledged S8 round after promotion to active S7 Magician; writing remains S8-only.
- Exact same-run history length and full round signature remain required. Missing bookmark, changed/new round, active combat, death and other sequences retain existing reveal behavior.
- No projection, domain save, combat rule or RNG changes. Native verification uses the existing rev110 timeline without creating a synthetic bookmark.

### 2026-10-28 — Persistent theatre dispute consequences
- Existing encounter status and startHistoryIndex distinguish resolved negotiation from completed combat without new state or string parsing.
- Terminal practice cards describe already-settled consequences instead of inviting intervention in an ongoing obstruction; active story and archived notes remain unchanged.
- Actual successful negotiation at rev113 supplies native normal/large-text evidence; other terminal outcomes are synthetic test coverage, not replayed live outcomes.

### 2026-10-28 — S7 unfinished goals before optional supplies
- Base60c50ab/v87, branchfeature/magician-next-step. Real same-save play completed distinct rope, paper, lamplit and shallow-water practices; the earlier shallow-water failure/cost remains. Six practices plus peaceful dispute and one reflection naturally reached acting100 at rev123/week32/AP1/cash204/spirit24.25.
- At92 and100 the growth heading still recommended optional oil instead of reflection/next-stage preparation. Guidance now chooses existing unfinished practice/scene/reflection actions (including their actual disabled reason), never optional supply as the growth goal. Original preparation bottle/batch ordering remains untouched.
- At100 display the existing S6 preparation path with explicit12-week/formula/material/independent-consumption conditions, and reuse existing page navigation when available. No rule, projection, save or RNG changes. Normal/1280large native same-revision evidence and final frozen-tree checks recorded in output/magician-growth-20261028/QA-summary.json; previous before screenshots have transient receipts that reload clears.

### 2026-10-28 — Truthful ordinary learning gains at the existing cap
- Base6f8b595/v88, branchfeature/learning-gain-clarity. Natural S7 study of old notes succeeded but knowledge22→22 while menu promised extra+2; random body-control mastery16→21 was a separate real reward. Cost/roll and completed topic remain preserved.
- Continued normal income/recovery and five distinct first-batch Faceless labour steps to rev140/week38/AP3/cash240, mature10/12weeks. Paying360 for guidance triggered an actual unpaid bill:24 paid/96 owed, subsequent two30 instalments leave36, destitute life30/week. No reset, free materials or forced success.
- Extract only the exact existing knowledge cap/bonus and check difficulty into a shared pure helper used by settlement and public target text. Preview shows actual limited increase or unchanged above-cap value, distinguishing optional random known-ability mastery. Ordinary20/paragon30 caps, education bonus, notes+2, check/RNG and completion rules unchanged; no new projection fields/schema.
- Same rev140 ordinary and1280large menu evidence plus final frozen-tree types/build/tests recorded in output/faceless-preparation-20261028/QA-summary.json. Current notes already completed; its pre-action promise and actual22→22 receipt are earlier native evidence, not recreated after fix. Notes/near-cap/paragon cases are synthetic tests only.
- Final frozen-source validation:189/189 targeted tests, main+renderer type checks, both builds and diff check passed. Existing cap is computed once for preview/settlement without consuming random input.
- Native AFTER verification is BLOCKED, not complete: normal close of old game followed by existing launcher restart was rejected by action review. One retry after read-only script verification and empty-terminal screenshot was also rejected; no alternate route was used. Same rev140 full state JSON remains byte-identical. Before normal/large and actual earlier22→22 receipt remain valid native evidence; no after screenshot is claimed. Parent requested local commit for review/backup with this explicit acceptance gap.

### 2026-11-01 — Faceless preparation hierarchy and readable confirmation
- Isolated v89 source restored without Git; 4,249 available tracked blobs match the saved target manifest. The same 194 historical fixtures are missing. Prior Faceless next-action candidate restored with both file hashes matching its saved receipt.
- Show current cash and action points beside preparation, with a static budget strip to avoid colliding with existing action feedback. Group current and reserve material actions into distinct dossier cards; reserve choices remain visible, all costs, disabled reasons and commands unchanged.
- Confirmation lays out the projected four outcome sentences separately, preserving the full projected prefix, punctuation and protection text. Unusual intervening wording falls back to the unchanged paragraph rather than dropping content. No domain values, projection fields, save data or RNG changed.
- Automated validation and final hashes are recorded in the sibling qa directory. Native visual and playtest acceptance remain NOT_RUN, pending the specific restart confirmation. No new screenshots, Git commit, remote publication or PR approval is claimed.

### 2026-11-02 — Preserve historical public learning snapshots
- Before draft publication, the real Door928 capture comparison failed: only the three `learnTargets` descriptions differed; private state equality passed. No archived input, pinned hash, or historical assertion was changed.
- Restore the existing public target descriptions exactly. The current learning menu formats accurate capped gains from the existing public character and pathway fields. A small pure calculation is shared with settlement; no rule, random draw, command or projection-field change.
- Added unchanged-projection and unknown-topic fallback coverage; final targeted tests, exact Door928 comparison, types and builds are recorded outside the repository. Native acceptance remains pending explicit restart confirmation.

## 2026-11-02 — Pro review: bounded daily player clarity (local candidate)

- Base: `a338a72e44e5ab3726fff62b20eefd944a9d98d1`; isolated `work/frontend-pro-player-clarity`, not a change to frozen PR55.
- Added a wrapping paper-ledger summary in the ordinary daily view and learning/investigation drawer: current week/AP/cash, health/mind/spirituality, current-tier weekly living charge, separately labelled next-week plan, and debt balance explicitly distinguished from this week's repayment.
- Added transient confirmed before/after public-resource feedback. Same-run intent/revision checks prevent stale or duplicate receipt summaries; failed requests, reload and return-to-title clear it. Week changes explicitly include weekly settlement, not action-only rewards. Existing action/check text, permanent history, hidden fields and combat wheels are unchanged.
- Scope is these existing daily/drawer surfaces, not a redesign of dedicated high-sequence pages. No new objectives, mechanics, balance, projection or save-schema changes.
- Verification: affected renderer suite 5 files / 137 tests passed; main and renderer typechecks and production build passed. Renderer typecheck was initially killed during concurrent verification; sequential rerun passed. Build retains large-chunk warnings.
- Source review confirms wrapping, non-fixed-height layout for normal/large text; no native/browser launch, visual screenshot or real playtest was performed. Native visual/playtest acceptance remains pending explicit restart confirmation. No Git push or PR modification.

## 2026-11-02 — Authorized native continuation and failed-ascent recovery (candidate)

- Following explicit restart/current-test-save permission, launched the documented `npm start` with the source-defined `LOTM_TEST_USER_DATA` pointing to the existing test save. Verified revision80 against its earlier receipt, backed up SQLite outside source, and played naturally to revision96/week25/S8. No state edits, seeding, rollback or forced outcomes.
- Built26b79f4 native checks: normal/large daily strip; LEARN capped-gain menu and empty INVESTIGATE drawer; close/reopen; WORK +180; REST crossing week with −120 living expense and AP/spirituality reset clearly labelled as net settlement; title/load clears transient feedback. Existing PR55 learning menu was viewed, but completed notes were not replayed.
- Natural route: paper practice and reflection reached acting100; actual formula purchase, four material labour actions, helper purchase, brewing and original-bottle confirmation. Cancel/reopen preserved the bottle and resources. First S7 attempt genuinely failed roll58/chance54 at revision96: health90, mind80, rejection25, cash6, AP3. Bottle and costs remain spent.
- This exposed a misleading next-step priority (more materials immediately after failure) and internal batch IDs in player-facing provenance/results. Candidate uses only public failed-bottle status and current recovery resources to prioritize existing daily recovery navigation; preparation remains accessible with its costs and rest never promises success. Renderer-only human labels leave saved records/command identifiers unchanged. No domain, RNG, projection, balance or combat-wheel changes.
- Targeted final tests:4 renderer files/92 tests passed; main+renderer typechecks and production build passed (existing chunk warning). Native same-save normal/large after screenshots verified at revision96 with byte-identical state JSON before/after restart. Recovery navigation itself costs no AP. Actual subsequent rest advanced to revision97 (health90→100, mind80→95, AP3→2), and work to98; recovery/second preparation continue naturally. Stale/duplicate receipt envelope replacement cases are automated coverage, not manufactured native transactions. Full native chain and backups are outside source under output/pro-native-20261102; no runtime DB or credentials belong in source artifacts. No remote publication.

## 2026-11-02 当前魔术师能力概览与详情入口

基于 `d1a6c0ead4e8628fc0a7dab008c83e4248cda3e0`，在已晋升且能力列表非空时展示当前公开能力名称与实际数量，提供打开、聚焦并滚动至既有能力详情的入口；不将既有能力标为新解锁，不改领域规则、存档、随机数或实践按钮。概览继承正文与大字设置，不使用固定小字号。

验证：魔术师面板定向测试 66/66、renderer typecheck、完整 production build、diff check 通过。原生同存档 revision 120（W32/S7）普通/大字截图分别两行/三行能力名，下一步均可见；详情展开、滚动与键盘焦点通过。字号检查前后 current_json SHA256 相同，未提交游戏行动。源代码和最终实际截图均经独立审查。本条仅覆盖能力概览与入口，不代表其他序列或全流程验收。

## 2026-11-02 无面人原瓶显示编号

基于 `0cf0c3a24e945db1a5b5e0ef97bab29fe7ed04f9`，仅扩展既有显示转换：已知无面人批次显示为“第N批备料”“第N批无面人原瓶”，用于原瓶来源、确认标识和既有反馈显示。未知标识后缀原样保留；原始来源、历史、命令与瓶ID不改。

验证：无面人面板与反馈定向测试 2 文件 38/38、完整 main/renderer typecheck、production build、diff check 通过。原生同 revision 151（W41/S7）普通/大字来源与确认页显示通过，取消/返回不消耗原瓶，检查前后 current_json SHA256 不变。未重新调配；旧调配瞬时反馈的转换仅有单元测试覆盖，不宣称已原生重演。独立源码及修后实际截图审查通过。本条不代表无面人晋升或后续能力验收。

## 2026-11-02 无面人排异后休养指引

基于 `ad0815152eced4a10c9810868fb4e0d05ebc0b2a` 的独立后续改动：未晋升且实际耗尽原瓶发生排异、健康或精神未满或仍有排异时，优先展示休养建议及当前公开数值。返回日常仅关闭卷宗，不自动休息、消费或重试；材料筹备与成本保持原样。回看、接触中、已晋升不覆盖其原提示，保存忙碌或错误时禁用返回按钮。

验证：无面人面板 39/39 测试、完整 main/renderer typecheck、production build、diff check 通过；独立源码与实际普通/大字截图审查通过。同 revision 152 的两字号与返回导航检查未改变存档。自然试玩 REST 至 revision 154 时健康/精神已满、排异仍为5，建议仍显示；正常工作跨周后 revision 156 REST 排异降到0，建议正确回到第二批筹备，第一瓶保持耗尽。未修改恢复数值、费用、随机数或历史，休养不承诺晋升成功。本改动不纳入先前已冻结发布候选。

## 2026-11-02 无面人实践说明玩家文案

基于 `97eb1e7f34642cc7f90492a6553217e929838892` 的独立后续改动：仅在当前现场与原道具服说明中，以现有中文外貌名称和“结束本次练习”“复原本人外貌与原声”替代已知技术标识。成年人、同意、来源、费用、持续状态及归还边界不变；原物编号 `FC6-PROP-COAT-1` 保留。未知标识原样显示，不改领域、命令、历史或存档。

验证：面板测试 41/41、完整 main/renderer typecheck、production build、diff check 通过；独立源码与原生普通/大字实际截图通过。同 revision 173 重启后，舞台外貌与已借原外套保持，借1还0；文字检查前后存档 SHA256 不变。两处说明换行正常。本条仅覆盖实践说明，不包含另行发现的旧战斗弹窗问题，也不纳入已冻结 PR56。

## 2026-11-02 无面人阶段继承已读旧战斗书签

基于 `c70ceb20bed3263323d2b7f44366bf3583ab9bcc`，仅为确已晋升的序列6开放已有序列8战斗已读书签的只读匹配；序列7行为保留，书签写入仍仅限序列8。仍要求同角色运行、完整回合内容与历史长度一致，死亡、活动战斗、缺标、变签及其他途径/阶段不抑制。未改领域、轮盘、随机数或战斗历史。

验证：战斗展示测试 91/91、完整 main/renderer typecheck、production build、diff check 通过。同 revision 173 原生正式重启直接进入日常，不再自动弹出旧已读回合；完整纪事仍可手动展开第3回合，原骰13/32、71.9%及撤退成功记录保留，检查前后存档 SHA256 不变。书签不写入由测试验证，未宣称原生提取并比对过其值哈希。独立源码与实际加载/历史截图审查通过。本改动不纳入冻结 PR56。

## 2026-11-02 无面人练习失败的中性重试说明

基于 `49095338455e1fb3575584e86b8ba643464301e7`，仅在三个既有无面人练习标题、已知失败开头与精确旧尾句同时匹配时，把显示建议改为“下周可再次准备；普通方法也是可选路线。”不从缺失的方法字段推断此前采用哪条路线，不改失败成本、额外疲劳、结束接触要求、原始记录或领域状态。未知标题、开头或尾句不改；面板已有正确结果文案不动。

验证：反馈定向测试 16/16、renderer typecheck、完整 production build、diff check 与独立源码审查通过。修复依据真实 revision 178 普通方法失败回执及其原文；该瞬时回执已被后续自然行动替换，修后尾句仅有实际输入与单元测试覆盖，没有回滚或伪造原生重放。此独立文案修复不纳入冻结 PR56。

## 2026-11-02 本人原貌普通练习后的自我报告提示

基于 `bf2a8f0accb12fb6bf962a8e02d7172e646812af`，仅对“扮演结束后记住自己”的精确已知成功回执和当前结果句作显示修正：保留角色片段完成事实，按当前外貌与原服状态提示必要复原/归还；已结束的当前结果不再要求重复结束。瞬时成功反馈仍保留0行动结束练习要求。不推断方法，不改报告门控、成本、投影、领域或原文，未知文本保持原样。

验证：反馈及面板测试 64/64、renderer typecheck、完整 production build、diff check 与独立源码审查通过。同 revision 197 正式重启后的普通/大字当前结果文案完整，REPORT 保持可用、费用仍为1行动，检查前后存档 SHA256 不变。独立截图审查通过。revision 196 已消失的瞬时成功回执仅以真实输入及测试验证，未回放；原生证据仅覆盖197当前结果。未纳入冻结 PR56。

## 2026-11-02 无面人日常当前指引与既有成长入口一致

基于 `7e9de8c6fa0679ba94df1e9c4379b9509e226ed1`，仅在已晋升序列6、正常身心且无事件/战斗阻塞，并精确匹配旧俱乐部兜底提示时，复用既有 dashboardGuide 的当前成长/晋升准备目标与说明。保留成熟条件及费用提醒，不新增按钮，不改领域 events、历史、投影或规则；其他阶段与权威提示原样。

验证：小丑/当前指引测试 48/48、完整 main/renderer typecheck、production build、diff check 通过。环境中断后先确认两文件完整、无未决写入，再完成类型检查与构建。独立源码及修后实际截图审查通过。同 revision 199 普通/大字右栏指向秘偶大师准备，现有入口仍展示7/12整周、420便士与1行动条件，导航前后存档 SHA256 不变。扮演未满与异常状态分支仅测试覆盖，不制造原生回放。本改动不纳入冻结 PR56。

## 2026-11-02 秘偶大师当前原瓶中文显示标签

基于 `765fd3f12c22a7fed608ef5231c0d5d3fd8911f8`，仅扩展已知秘偶大师批次的显示标签，并用于当前来源及确认页的原瓶标识。未知标识前后缀保持原样；命令、原始来源、历史、领域、随机数与旧无面人经历页不变。

验证：反馈与秘偶大师面板测试 42/42、完整 main/renderer typecheck、production build、diff check 与独立源码/实际截图审查通过。同 revision 216 普通/大字来源、确认、取消检查通过，原46%成功率、0行动、12/12整周及真实歌唱条件保留，取消前后存档 SHA256 不变，原瓶仍未服用。revision 214 调配瞬时回执未重演，转换仅由真实输入及测试覆盖。本独立改动不纳入冻结 PR56。

## 2026-11-02 海岸现场的秘偶大师下一步指引

基于 `5fe275075c7f29e89fd3dbf5d7af36d1fb1c02d6`，保留领域 insideCase 包括海岸的原有含义。仅在无实际 CLOSE 且当前位置为海岸时，让顶部指引使用既有 enabled 服药/开歌/停歌返程动作；真实 CLOSE 优先，非海岸捕获分支不变。展示不重新计算资格，不改按钮、原命令、成本或领域规则。

验证：面板测试 30/30、完整 main/renderer typecheck、production build、diff check 与独立源码/像素审查通过。同 revision 216 普通/大字顶部正确指向当前原瓶；原46%/0行动/12周确认及取消保留，存档 SHA256 不变、未服药或停歌。revision 215 开歌前状态未重演，BEGIN_SONG 选择仅源码/测试覆盖。本独立改动不纳入冻结 PR56。

## 2026-11-02 · 观众原瓶来源与当前回执可读标签

- 基线 `a98af569ff7ca28db815f86f9bdf606d47638855`；仅现有 renderer formatter 为已知 `audience-batch-N(:bottle)` 显示“第N批备料／第N批观众原瓶”，保留未知前后缀；观众当前瓶来源、确认来源与瓶号接入。既有当前／近期回执沿同 formatter 展示，原始纪事、投影、命令、风险、门槛和 RNG 不变。
- 40 项定向 renderer 测试、main/renderer 完整类型检查、完整构建与 diff 检查通过。包括未知标识原样、取消无命令、确认原命令不变、近期摘要中文显示且输入纪事不变。环境重启中断的首次构建不计通过；恢复后最终 tests→types→build 串行全部 exit 0。
- 原生同观众 rev21 官方重启，普通／大字已耗瓶来源与近期晋升摘要通过：材料顺序、已耗尽成功状态、真实 53/72、能力初始掌握0及灵性上限30但未补满保留。玩家只读核验前后 current_json SHA 均为 `82386d59eff9bc44b5f04713e0ed7c4261c84cf9f96b0b00112378ff9d9d68c1`。未重演 rev20 服药确认；其修后覆盖仅自动测试，瞬时成功回执未重新执行。
- 独立源码与原生像素审查收据另附；本地候选不代表已推送、合并、完整 CI 或发行包验收。未混改冻结 PR56。

## 2026-11-02 · 观众已有原瓶时优先解释服药门槛

- 基线 `bac637889a87c90b71d2afce45ccedeb2c1f8611`。实际普通人 rev14／第3周已完成首瓶调配，却在顶部推荐第2批劳动；原因是 disabled CONSUME 被其他 enabled 备料动作越过。
- 仅 renderer 下一步候选增加窄 fallback：未晋升，现有公开 CONSUME 精确对应状态为“已调配，尚未服用”的瓶时，保留该动作与原禁用原因，优先于另备材料。原 enabled CONSUME 仍优先，所有材料入口、费用、确认按钮与命令保持原样；不重算周数、资源或资格。
- 27 项 audience renderer 测试、main/renderer 完整类型检查、完整构建与 diff 检查通过。新增覆盖周门槛、其他公开禁用原因、无备料动作、enabled 服药优先、缺瓶／缺命令／耗尽／未知状态不造目标、晋升后社会行动不受影响。
- 这是修前 rev14 实际画面与自动测试验证，不声称修后第3周原生通过：当前自然存档已晋升序列9，未重置、未回放、未为了测试另造魔药。独立源码审查另附；不改变领域或保存数据，不混入冻结 PR56。

## 2026-11-02 · 观众社会情境状态中文显示

- 基线 `7180ac13d173ecb26d2a6acedefbb16f8e465f59`。仅观众下拉选项及当前情境状态采用局部精确映射：AVAILABLE→尚未观察，OBSERVED→已观察，待核实，RESOLVED→核验已完成；未知字符串原样。已核对现有领域含义：失败交涉仍 OBSERVED，成功共同核实才 RESOLVED，不暗示读取思想或所有事实已确定。
- 33 项 audience renderer 测试、main/renderer 完整类型检查、完整构建与 diff 检查通过；三状态与未知／相近／已有中文的原样回退、切换不发命令、输入投影不变均覆盖。
- 同实际观众 rev26 正常重启后，普通／大字当前情境及下拉三个真实状态通过，成人与同意边界、已获扮演20／信任2和操作原文保持。玩家只读核验重启／字号／纯导航前后 current_json SHA 均为 `08f61cb7bd2a2504be39440706c11bf658390446f3068da9f6f89d29b5ff20d7`。没有重演服药或修改存档。
- 独立源码与实际像素审查收据另附。本地独立候选，未推送，不混改冻结 PR56；不等同完整 CI 或发行包验收。

## 2026-11-02 · 观众当前情境在事务后保持选择

- 基线 `be4dda2975c4abfd30c9f1b88b59ccf53b61cd64`。实际 rev30 观察第三案跨周，回执第三案而正文跳回第二案；根因是首次自动默认未写入本地选择，公开 enabled 动作变化便重新默认。仅 panel effect 固化当前实际默认 ID；有效选择在禁用／完成后仍保留，缺失／空集合用原回退，非晋升状态清空；已有 runId key 继续隔离周目。不新增存储、不改变领域、命令或 RNG。
- 36 项 audience renderer 测试、main/renderer 完整类型检查、完整构建与 diff 检查最终通过。rerender 覆盖自动默认、失败禁用、跨周前案重新可用、当前案已完成、缺 ID／空集合、周目 key 与阶段重置。初次测试 helper 的 mock 类型标注过宽导致 types 失败，已仅修正测试参数类型并完整串行复验，原失败日志保留。
- 同 rev30 官方重启前后 SHA `a1a3fe75fc635b2e328583642944bb1cd7b486b0c8a25350b25963b364f9a1e3` 不变。首次进入自动默认第二案，未手动选择，随后自然新询问 58/66 成功至 rev31，当前案虽已完成且第三案可行动，正文仍保留第二案；普通字实际图覆盖根因。没有重演 rev29 失败或 rev30 观察。
- 关闭重开仍采用有用的新入口默认第三案；大字手动选回已完成第二案仅验证排版，不冒称覆盖自动默认根因。rev31 字号／导航前后 SHA 均为 `631eccc4eab9816556e37c2144b85b2063cf0699c5d3aba7f37f99701bdf663c`。独立源码与实际像素审查收据另附；本地候选不代表已推送或完整 CI，未混改 PR56。

## 2026-11-02 · 猎人已有原瓶门槛指引与可读瓶号

- 基线 `20d504374108d6d6877484efefb6578c43b30d96`。真实猎人独立普通人存档 rev13／第3周已领取首瓶，顶部却推荐第2瓶劳动；仅 renderer 在未晋升且公开 CONSUME 精确匹配“已交付，尚未服用”原瓶时，优先展示其原禁用原因。enabled 服药仍优先，其他备料入口保留，不计算周数或资格。
- 当前瓶来源、确认来源／瓶号接入既有可读 formatter，精确 hunter-potion-N 显示“第N瓶猎人原瓶”，未知前后缀原样。已知交付短语仅在两个编号相同时去重为“第N瓶现成猎人魔药”，保留现成事实；不一致编号整短语原样。既有当前／近期回执沿同 formatter，原记录、领域、命令、库存及 RNG 不变。
- 最终 42 项定向测试、完整 main/renderer 类型检查、完整构建与 diff 检查通过；初次旧确认测试仍期望内部瓶号，更正为中文展示后完整串行复验。独立源码审查通过。
- 同 rev13 正式重启，普通／大字门槛与来源、近期实际交付摘要通过，2/4整周及第5周原原因、60便士／0行动／劳务抵600便士不变。纯导航、Escape 关闭重开前后玩家只读核验 SHA 均为 `faefe463bc0139566653bd652c3885b9d93ec814def27ad8208166decb2bd5ba`。瞬时领取回执未重演；enabled 服药确认／取消待自然第5周后原生验证，目前只自动测试，不夸提前覆盖。
- 独立实际像素收据另附；本地候选未推送、未混改 PR56，不代表完整 CI 或发行包验收。

## 2026-11-02 · 主任务授权的猎人真实撤离后有限消化恢复

- 基线 `9da31ef8074bfdb6ed66f5cc9537e23cca78a867`；这是一项明确获批的领域修复，不是 renderer 擅改规则。实际普通人首案已结束后才晋升的猎人，货运撤离后原六实践上限72，无法达到挑衅者要求100。复用 REFLECT：六实践全部完成、货运 RETREATED、未反思时，1行动一次+28扮演，最高100，无额外掌握／钱／物品／RNG；RESCUED 原+8和原叙述不变。原货运结果、物权、陷阱、伤势、战斗历史均保留。blocked／projection／apply／validator 同步，LOST／死亡不开放，沿用公共门控和同一唯一反思标记，不新增字段或迁移。
- 独立源码审查通过。197 项 domain acquisition/adventure/combat 与 renderer 测试、5 项原历史 shared 测试、完整 main/renderer 类型检查与构建通过。新增覆盖5/6、全部终态、重复、公共门控、无 RNG／全状态差异限域、旧首案额外进度封顶、S8成熟仍保留、最后AP跨周生活费与确定重放。初次测试误把生活费仅在正文检索，改为标题+正文后复验，未改变结算逻辑。
- Hunter/Clown 原冻结 fixture 从 canonical archive 精确恢复，未重新基线；四份 Hunter 快照 private/public/save-roundtrip 在旧构建与候选完全一致，真实 rev36 public SHA 亦一致。原 DB 字符串 SHA 与 JSON.stringify 哈希分开记录，不混称。原 fixture、私有存档、DB 均不入源码提交或小备份。
- 原生同36重启原状态不变；随后自然实践与失败冷却、工作、原绳购买均真实执行。rev49五项/60仍无反思，51六项/72普通大字出现反思；52实际一次72→100、AP2→1。原 hunter 全对象（RETREATED/物权/陷阱）、mastery/random/world/combatHistory/健康/精神/灵性/现金/周数均不变，反思按钮消失。52 SHA `55b2fae00fd2319ae2ecf795bfd3db78f2e6494df33a6f705f879591635d7dc6`；独立像素审查通过。未重演51，未改seed或恢复旧档。
- 发现的顶部购买推荐及“下一序列尚未开放”另作 renderer 小修，不混入本领域提交；尚未购买或服用S8。本地验证不等同完整CI/发行验收，未触冻结PR56。

## 2026-11-02 · 猎人复盘与消化完成后的真实下一步

- 基线 `091ca04b5002afd4ecdc1a58b80055d92e98a0c5`；本片仅 renderer。已晋升时保留原实践／货运优先，随后优先已有 enabled REFLECT，避免可复盘时先推荐可选购买原件；不重算资格或改变按钮。实际51已执行反思，优先排序修后仅源码／测试覆盖，加真实修前图，不重演51冒充原生通过。
- 仅 promoted、acting>=100 且精确旧“下一序列尚未开放”摘要时，顶部及能力消化显示指向既有挑衅者条件，保留成熟周数与原瓶要求；无实践／货运／反思动作时顶部不再推荐可选购买。未知原文／未满／未晋升保持，原购买入口仍可用，不新增按钮或自动打开，不改领域摘要、存档或命令。
- 27 项 renderer 测试、完整 main/renderer 类型检查和完整构建通过，独立源码审查通过。同实际52官方重启，普通／大字顶部与能力消化准确，既有日程CTA到挑衅者显示100/100、8/6周；现金156不足180指导费仍禁用，未购买或提交游戏行动。52前后SHA均 `55b2fae00fd2319ae2ecf795bfd3db78f2e6494df33a6f705f879591635d7dc6`，另两档状态不变；独立像素审查收据另附。
- 与领域修复分开提交及备份；未推送、未触PR56，不等同完整CI或发行包验收。

## 2026-11-03 · 猎人已读终结回合不再反复弹出

- 基线 `85de5c0a60ec179f909573c0e014b0d52c420b5e`，隔离 `fix/hunter-history-bookmark`。仅 ACTIVE、hunter S9、已晋升、无当前战斗且有末回合时，明确点击“返回生活”写独立周目 UI 书签；完整公开末回合和完整战斗历史精确匹配才在读档时抑制。未读、新回合、同长度历史内容变化、异周目、死亡、活动战斗及其他阶段保持原显示，存储异常回退未读。Clown 书签、领域与存档不改。
- 110 项 combat-presentation 测试、完整 main/renderer 类型检查及构建通过，独立源码审查通过。覆盖明确确认后读档及手动完整纪事，无游戏命令；其余边界由自动测试验证，不冒称真实死亡或新战斗已跑。
- 原生为书签与另项大字 CSS 的一个联合候选，不是两个分别验收版本。真实 rev52 首次载入仍弹；未确认正常退出后再载仍弹；随后明确返回生活，再标题／载入直接日常，完整纪事仍保留原第2回合。无游戏行动。玩家只读核验 Hunter52、观众38、占卜家219 三档 SHA 均不变；Hunter52 为 `55b2fae00fd2319ae2ecf795bfd3db78f2e6494df33a6f705f879591635d7dc6`。公开签名摘要仅由官方投影计算，不声称读取了 localStorage 实值。
- 独立像素审查收据另附。CSS 将另作精确提交；本轮不修改已发布85de标签／资产或PR56，不等同Windows运行或完整发行CI。

## 2026-11-03 · 大字战斗转盘文字容纳

- 基线 `6e459b30ab15862fa97842849b15e1deab8f5774`。真实 Hunter rev52 第2回合历史弹窗中，大字标签由14增至21px，但原120px转盘／84px内圈不扩展，导致标签断行及“未进入胜负盘”下溢。仅 `combat-stage.css` 为大字模式增大三盘至168px／内圈132px，居中文字并留间隙，长结果均衡换行；原字号不缩减，普通模式、三个常显转盘、flex换行、快捷显示与减少动画规则不变。不改文案、组件、领域、RNG或存档。
- 最终串行110项战斗展示测试、完整 main/renderer 类型检查、完整生产构建和 diff 检查通过。本次原生验证使用书签修复与CSS合并候选，不声称两份独立原生构建。实际 Linux Electron 同 Hunter52／round2，在1364×900及1282×900下分别检验普通／大字，共四张实际图；标签与两行撤退结果均完整位于圈内，下方说明分离，返回生活可见。源码及实际像素已独立审查。
- 未重演战斗、未清书签或改档。纯字号／窗口／导航核验前后三档状态SHA不变：Hunter52 `55b2fae00fd2319ae2ecf795bfd3db78f2e6494df33a6f705f879591635d7dc6`；其他两档保持原revision38／219。完整回合记录仍可从纪事打开。新战斗的动画和快速显示保持原实现且自动测试覆盖，不冒称本次重新执行战斗。更窄窗口未实测；Windows原生、完整CI和新发行包未运行。原公开测试候选及标签未改动。

## 2026-11-03 · 战斗历史优势与成功撤离的显示语义

- 基线 `607a220240f552cfb08a28e896dc4559215628e5`。仅 RoundRecord 两个显示点：双方最终优势复用现有 displayNumber（整数原样、小数1位），清除二进制浮点尾数；retreat SUCCESS 优先“成功脱离战斗（未进入胜负盘）”，概率标为“参考胜率…（未进入胜负盘）”。NONE／FAILURE 保留原 winner 语义，原概率、优势、winner、后果及历史均未改。已只读核实共同引擎 SUCCESS 先 return RETREATED，早于胜负随机骰，与既有 CombatStage／轮盘语义一致。
- 最终115项 combat-presentation 测试、完整 main/renderer 类型检查、完整构建及独立源码审查通过。新增5矩阵覆盖实际浮点输入、SUCCESS、普通胜负平及失败撤离。首轮5项测试误在隐藏重复后果的记录区找后果；改为检查原 modal 后果区并保留初始失败日志，未为测试更改产品逻辑。
- 官方同 Hunter52 冷重启仍不重弹已读回合，手动完整纪事正常／大字均显示198.7／122、62.0%参考概率及真实安全撤离；原骰2／1、对手动作及保住现场的事实保留，独立像素审查通过。纯导航，无新战斗或游戏行动；三档 current_json SHA 全不变，Hunter52 为 `55b2fae00fd2319ae2ecf795bfd3db78f2e6494df33a6f705f879591635d7dc6`。
- 其他结果仅源码与测试覆盖，不造原生状态；本轮为Linux原生历史显示验收，不代表Windows实机或完整发行CI。独立提交，不修改已发布85de标签／资产。

## 2026-11-03 · 挑衅者当前原瓶可读编号

- 基线 `9e14d9566ef1e17beeae34ceefbc8fbbe2994915`。当前来源／确认来源／确认瓶号三处接既有显示 helper，精确 provoker-potion-N 显示“第N瓶挑衅者原瓶”，保留未知前后缀。实际交付“第N瓶序列8成品魔药provoker-potion-N”仅同N整短语去重为“第N瓶序列8挑衅者成品魔药”；异N原样。当前／近期回执沿原 formatter，领域、原历史、命令和库存不改。
- 37项 formatter／Provoker renderer 测试、完整 main/renderer 类型检查及构建通过。覆盖来源、确认、原 command、投影输入不变、未知／异N／幂等；独立源码审查通过。
- 玩家自然工作、指导、三次劳务及170便士实际领取后冻结 rev61；同61正式重启，普通／大字来源和确认中文完整，60%／0行动／100消化／11/6整周及四档风险保持，两字号取消成功。短暂CUA断线仅在截图／滚动后，恢复同窗口续验，未重复服用或领取。前后 current_json SHA均 `ad8959491ff494f21e2765b6ffacb78e26bdd1cc1cdae591c961af44c14b4cdd`，原瓶未服。独立4图像素审查通过，大字风险需滚动，不称全部单屏。
- 交付瞬时原生未重演，同N回执转换按实际领域输入与测试覆盖；未购买额外瓶用于验收。独立本地提交／小备份，不变更已发布85de标签／资产，不等同Windows实机或完整CI。

## 2026-11-03 · 挑衅者完成劳务后优先领取原瓶

- 基线 `0d9ad0da4d919808cda002ebafa611813d9faabe`。实际rev58首瓶劳务3/3、现金不足170领取时，顶部却推荐第二瓶劳动。仅未晋升且公开瓶状态精确“导师保管 · 劳动3/3”，匹配同ID现有BUY_POTION；enabled服用仍先，随后enabled领取／原disabled领取原因，再原备料。价格／资格／按钮／命令不变，其他瓶劳动仍可选。
- 23项Provoker renderer测试（新增10项）、完整main/renderer类型检查及构建通过，独立源码与日志审查通过。覆盖不足现金原原因、可领取、2/3、未知／已耗／已领／缺瓶／异ID、enabled服用优先及晋升不套用。
- 根因证据为真实rev58修前图加组件测试；修后rev58原生为NOT_RUN。玩家已自然取得首瓶并晋升至rev64，不回退、不额外购买来制造覆盖。经主任务批准先独立提交本片，后续选择修复的同64联合smoke仅可证明已晋升分支无回归，不能宣称重演58。
- 本地源码候选和安全备份，不改发布85de标签／资产，不等同Windows实机或完整CI。

## 2026-11-03 · 挑衅者实践完成后保持当前情境

- 基线 `4f9d8140b5d57a4032967076e2ffeb00b51a0b31`。实际首案完成后动作从投影移除，旧界面按动作过滤case导致正文跳到下一案。现首次仍用原可行动集合的有用默认并固化ID；有效当前ID从原公开cases保留，仅将这一个已见case并入原下拉，完成／禁用后仍可读其公开story。不扩大到所有无动作case，不臆称其完成或开放新按钮；手动离开后旧无动作case不额外保留。缺ID／空集合／未晋升清理，既有runId key保持周目隔离。
- 26项Provoker renderer测试、完整main/renderer类型检查和构建通过，独立源码及最终像素审查通过。rerender覆盖默认、观察／禁用、完成后动作移除、手动切换、未见无动作case不展示、缺ID／空集合／阶段／周目；旧跳案测试改为保持新期望。
- 同64官方重启哈希不变，未手动选案的默认第二案自然观察至65，再普通方法成功至66，回执与selector/body仍为第二案，原动作已消失；普通字图覆盖根因。大字关闭重开后自然默认第三案，仅证明新入口与排版，不冒称大字根因重演。无回退63／64。66纯导航后SHA为 `801f703e2f602e6054a61ea6bd7d7242207218dc9c95d4088beff84b4cf82393`。
- 联合当前已晋升流程未套用前项领取指引；rev58领取根因修后仍仅组件测试。重启发现旧S9书签在S8不继承，另派只读诊断，不混本片。Linux原生限定，不等同Windows实机或发布CI，原85de标签／资产不改。

## 2026-11-03 · 晋升后仅读同猎人原终结回合书签

- 基线 `d4a5ec5f7a26cc8a184b6f731747e9ad1ef6e071`。实际S8重载又弹已在S9明确读过的旧回合；仅放宽读取门控为ACTIVE、同hunter途径、公开hunter.promoted、无当前战斗、有原末回合且完整末回合／历史签名精确匹配。公开promoted已表示取得并保留猎人身份，不在renderer逐级枚举。写入仍只S9，晋升后不创建或覆盖；不宣称高阶段新战斗已读都持久化。
- 130项combat-presentation测试、完整main/renderer类型检查和构建通过。S8至S1参数化仅仅读旧标记／不能新建覆盖，异run、完整历史变化、缺标、未promoted、异途径、死亡、当前战斗保持不抑制，手动历史入口保留。Clown逻辑及所有领域字段不变。
- 同实际66官方冷启动直接日常，无新确认、无清书签；手动完整纪事原第2回合骰34／15、次数2／1及撤离后果可读。纯导航无游戏行动；玩家核验三档哈希完全不变，Hunter66 SHA `801f703e2f602e6054a61ea6bd7d7242207218dc9c95d4088beff84b4cf82393`。独立源码／日志／像素收据另附。
- 高阶段矩阵仅自动测试，原生仅当前S8；不改已发布85de标签／资产或PR56，不等同Windows实机或完整CI。

## 2026-11-03 · 挑衅者选择的具体判定与失败代价

- 基线 `7d0f8fc3553c3915312e5e987b3a7690d58431b3`。实际犬案rev68界面把能力选择写为“人的冲突可能导致推搡受伤”，且缺少具体判定。主任务批准独立共享静态表写集例外：只抽出现有四种选择的属性、难度、灵性、失败健康／精神扣值和共同成功20扮演／8掌握，领域继续权威结算；无新存档字段、数值、概率系统、NPC关系或原著解释。
- renderer只注释已经公开的已知情境／CHOOSE组合，精确删除旧泛化风险尾缀而保留原行动／灵性成本；显示各自判定与失败扣值。普通方法明确“不额外扣健康或精神”，不声称无成本；共同成功奖励与失败本周冷却仅显示一次。未知组合／费用原样保留，动作、禁用、原因与原投影字节不变。原REFLECT两分支未修改。
- 5文件69项定向测试、完整main/renderer类型与生产构建、diff检查通过，独立源码／日志审查无阻断。原canonical Hunter／Provoker输入、迁移private/public/roundtrip哈希及当前真实69raw/public前后完全一致；四选择×成功失败的完整私有／公开／action哈希、check/award/note次序和原结果文字逐字相同。未修改或重基线历史fixture。
- 实际69三案已经完成，不回退或重开。选择修后原生为NOT_RUN；另有1项临时规范组件HTML导出检查通过，不计入69项产品门禁。受控headless截图受环境socket权限及升级执行环境失败阻断，无可用after图，不把DOM或HTML当像素验收。原生同69联合冷启的独立记录由玩家任务提供，不能当作已完成选择的重演。
- 新本地源码候选，已发布85de标签／安装包及PR56不变。Windows实机、完整CI及新发行包NOT_RUN。

## 2026-11-03 · 货栈常量故事明确为历史背景

- 基线 `219c9cad21477b1801e699bea0569ddd8682f32f`。实际72已交涉解决且复盘100，原常量故事仍用“当前货栈情境”语义展示起初扣车。仅在原story前新增可见“事件起因（历史背景）”标题，并把ARIA标为“货栈争议历史背景”；原summary、故事全文与所有行动不变，不从文本推断当前结果，不扩公开schema或改领域。
- 28项Provoker renderer测试、完整main/renderer类型检查及构建通过，独立源码审查通过。覆盖有／无行动时原文完整、原命令与输入不变。
- 同实际72正式重启，正常／大字历史背景标题及全文均清楚，扮演100及无重新行动保持，纯导航无S7购买或游戏命令，独立像素收据另附。玩家核验三档current_json SHA不变，Hunter72为 `755ef8e11c17d27a35c9633157a4ef710c7626cf29ecfb7eae64782d8a8aab69`。不把常量背景当新结果，不重演已完成交涉。
- Linux原生限定，不等同Windows实机或完整发行CI；不变更已发布85de标签／资产。

## 2026-11-03 · 撤退能力盘说明独立脱离判定

- 基线 `42174646884540d0b9a35861a1503272e6b55175`，独立后续分支 `fix/retreat-feedback-clarity`。受控 B 原生风险面板中，选择撤退时“你的能力盘”留空；六次失败后第七次成功的真实记录不变。只在现有能力盘段落的 RETREAT 分支说明不抽取己方能力、单独判定脱离，以及回合胜利不等于离开战斗。其他姿态列表、整回合行动代价、受伤／死亡警告、命令和三盘保持原样；无 CSS、概率、领域、存档或历史改动。
- 131 项战斗展示测试、完整 main/renderer 类型检查和生产构建通过。新增覆盖两次切换后恢复原进攻列表、原风险、三盘及输入不变、只选择不提交、确认时仅提交原 RETREAT payload。首轮新增测试误写 envelope.command，130 旧项通过；改为现有合同 payload 后全过，初次失败日志保留，未修改产品规则迁就测试。
- 已查看真实受控 B 修前图；修后 RETREAT 原生为 NOT_RUN，未制造新战斗、改档或重放。源码独立审查通过；自动测试不冒称原生像素验收。本切片是本地后续候选，不更改冻结421、PR57/58或公开85de标签／资产，不代表完整CI或Windows实机。

## 2026-11-03 · 日常下一步导航随大字设置放大

- 基线 `5ff5c7369cc25e5c2578eda1809a8fa187cafd50`，独立 `fix/large-guide-text`。真实72主屏及80普通／大字对照显示，“接下来”的说明与导航按钮仍固定17px。仅为这两处加入既有大字字号组：说明21px（辅助正文）、按钮22px（交互标签）。正常17px、换行、44px最小目标、导航、预算及固定行动区均不改。
- 3文件54项定向测试、完整main/renderer类型检查及生产构建通过；独立源码审查通过。新两项CSS源回归不冒充布局测量。首轮renderer类型检查发现新测试正则捕获可能undefined，仅为测试helper补空值处理，原失败日志保留；最终完整串行重跑成功。
- 同canonical72官方Linux Electron重启，1364×900普通／大字说明及三个导航按钮完整可读，滚动后保持完整；原生Tab有可见焦点，Return和鼠标均打开原晋升准备，Escape返回，切回普通恢复正常字号。没有购买或游戏行动；玩家核验Hunter72、观众38、占卜家219三档完整current_json哈希前后相同。字号21／22px来自源码核对，原生像素仅证明实际放大，不冒充computed-style测量。
- 独立审查员已核源码、最终日志与全部7张实际截图，未见阻断。此片不修改领域、存档或冻结PR57/58；原生仅当前1364×900状态，不等同Windows实机、所有窄窗或发行CI。

## 2026-11-03 · 读心者当前原瓶与回执编号中文化

- 基线 `5eca4b267672f72ed73317615ed89b95a3e9fe6c`，独立 `fix/mindreader-bottle-labels`。真实45调配回执与来源卡露出 `mindreader-batch-1:bottle`。仅既有显示helper增加精确ASCII边界的读心者批次／原瓶中文名，并在当前来源、确认来源与编号三处使用；编号保留，未知token原样，不改旧观众历史区、原记录、道具ID、命令、存档、领域、概率或CSS。
- 2文件45项定向测试、完整main/renderer类型检查及生产构建通过，独立源码审查无阻断。覆盖实际公开调配文字仅显示变化、未知前后缀、幂等、其他七类已实现药剂标签保持、取消／重开／原确认命令及投影输入不变。
- 玩家自然首瓶46成功，后推进到49；同49官方重启，仅导航核普通／大字已耗瓶来源，中文编号与六料来源完整，成功晋升状态保留。玩家核验Audience49、Hunter72、Diviner219三档current_json SHA均不变。修后prepared确认、45／46瞬时调配／服药回执及被新行动挤出的近期成功摘要原生 `NOT_RUN`，不回退或重演。
- 独立审查员已核最终源码、门禁日志和同49两字号实际图，无阻断。本片未推送，不改冻结发布头，Windows实机与完整发行CI未运行。

## 2026-11-03 · 读心者社会情境状态中文说明

- 基线 `af363eb07cc56bbf91345e6c6386654bcfb0c404`，独立 `fix/mindreader-scene-status`。真实46下拉出现AVAILABLE、49当前情境为OBSERVED。只在当前情境下拉和正文状态两处做精确显示映射：AVAILABLE→尚未到场，OBSERVED→已观察，待核实，RESOLVED→核实已完成，未知值原样保留；旧观众历史、瓶状态和其他路线不改。
- 已核领域语义：到场才进入OBSERVED，读取成功／失败都不代表核实完成，仅当面交谈或普通查证成功才RESOLVED。不改领域状态、schema、命令、原记录、存档或CSS。
- 25项完整Mindreader renderer测试、完整main/renderer类型检查和生产构建通过，独立源码审查无阻断。新增6参数覆盖3已知态、未知／近似／既有中文原样，两显示位置及来回选择无命令、输入不变。同49官方Linux Electron重启，仅切字号和打开原生下拉：普通／大字当前显示“已观察，待核实”，另两项“尚未到场”，没有误说已完成。玩家核验三档49／72／219 current_json哈希精确不变；当前没有自然RESOLVED，仅测试覆盖，不为覆盖制造结果。
- 独立审查员已核源码、最终门禁及4张实际截图，无阻断；不声称Windows、所有窗口或发行CI已验证，不改冻结PR。

### 2026-11-03 RoundRecord 精确优势与约数概览（本地候选）

- 基线：42174646884540d0b9a35861a1503272e6b55175。修复历史纯白天使回合精度回归：原 Number 优势没有一位小数合同，不以任意截位猜测浮点噪声。
- 仅 RoundRecord 将友好一位概览明确标记为“约”，新增默认收起的原生“查看完整优势数值”，原样显示双方最终优势。成功撤离、参考胜率、后果、原始记录、领域与存档不变。
- 原 pure-white-angel-navigation 整文件12例及 combat-presentation 首轮合计145例通过；原历史断言和canonical输入未改。补强先展开外层记录再操作精度详情后，combat 133例、完整main/renderer类型与生产构建再次通过。零、负、高阶四位精度、浮点长尾与各撤退/胜负分支均覆盖，展示操作无命令/输入变更。
- 独立只读源码审查通过。原生同当前Hunter72旧round2历史零行动检查通过：普通/大字概览与精确详情可读，默认收起，Tab/Return展开与收起、Escape返回均有效；三档72/52/219哈希由试玩回执确认不变。没有回退52、没有新战斗，原生未复演纯白天使高阶战斗。未推送，未修改冻结PR。

## 2026-11-03 · 权威结果驱动的原创三盘仪表（本地候选）

- 基线7c9341b00cba9d501df981b186a4fc3b31d5b282。用户要求改轮盘样式；指定参考页面只显示登录门槛，未看到其轮盘。本片为基于现有游戏的原创黄铜／墨绿仪表，不声称借鉴未见画面，不使用第三方角色或品牌素材。
- 视觉与DOM同序保留你的次数、对手次数、回合胜负。次数针按公开已保存d100原骰停位，实际次数大字独立展示；当前公开次数权重仅用于备战，历史无快照不重建。胜负环按已存winChance分配色带，指针只演示winner区域中点，明示不是还原原胜负骰；成功撤离不转第三盘，null或无有效位置不伪造结果。
- 新生产组件只做显示：初次加载／历史默认静止，新round props触发有限CSS顺序动画，可重播／跳过，快速显示与减少动态即时最终态；无计时器、随机、新依赖、持久化或领域改动。历史原记录内新增默认收起的“查看已保存轮盘”按需挂载，保留原完整优势精度详情与后果。
- 4文件177项测试（包含原纯白天使导航12例）、完整main/renderer类型与生产构建通过，独立源码审查通过。初轮两个新测试因jsdom缺AnimationEvent而使用错误事件名失败，依据本地React vendor映射修为对应事件；初次严格类型错误仅补undefined与reduce数字类型，原失败日志保留。独审发现的旧CSS内圈／hover覆盖已修，胜负动画晚于两次数定格。
- 最终明确null为“未决出胜负”而不推断平局，概率行明确“你的胜率约…”避免误读为赢家概率。最终4文件177项测试、完整main/renderer类型与生产构建再次通过，原纯白天使历史断言、领域和保存输入均未修改。
- 真实Hunter72旧历史零行动原生通过：首版1364×900／1280×896普通与大字均完整，键盘重播／跳过、自然动画结束、重开静止与hover可读；第2回合原骰34／15对应2／1且撤离第三盘静止，第1回合原骰14／72对应1／2，真实66%份额与对手胜指针可读。没有为演示制造新战斗、回档、清标记或注入fixture。
- 两句文案定稿后官方最终冷启，同72在1364×900重新取得普通／大字撤离与真实第1回合大字三张终版图，源码SHA核对一致，最终“你的胜率约66%”已实际看到；三档72／52／219完整状态SHA由玩家前后核验不变。最终图与先前窄窗／交互图分开保留，独立实际像素审查通过。玩家另记录一次滚动即时截图瞬态，原截图保留，未作输入或代码改动的随后稳定图正常，不推断其根因。
- 覆盖限Linux历史回看，正常敌胜是原真实历史而非新战斗；null、fresh-round自动揭示与减少动态分支以源码／自动测试覆盖，不制造原生状态。未测试1280以下官方不支持窗口或Windows；参考页面内容仍未见。未推送，不修改冻结PR58。

## 2026-11-03 — S5 继承既有小丑回合已读标记

- 基线 `aa61af51df6dba77621ebe032786220e7ecdd2ab`；仅 renderer 书签 helper、combat-presentation 测试及本条记录。真实 Diviner219 载入重弹旧 round3，公开记录与先前 S6 原生收据同 run、history8、完整末回合排序 JSON 哈希一致；未读取或清除 localStorage。
- 仅读兼容新增精确 `sequence === 5 && marionettist.promoted`；S7/S6 规则、S8 显式确认写入门槛、既有 key/签名保持不变，不扩至未知高阶，不改领域／存档／随机结果。
- 最终 combat-presentation 145 项、完整 main/renderer 类型检查、生产构建通过（既有 chunk-size 警告）；独立源码审查通过。日志 `output/clown-s5-bookmark-20261103/`。
- 修后在自然推进后的真实 Diviner224 官方冷启零游戏命令验收：直接日常，不自动弹旧回合；手动完整纪事仍可读 round3 原骰13/32、成功撤离及对方保现场后果。未新确认或重写标记；玩家核验三档224/72/52完整状态哈希前后一致。两张实际截图及 `bookmark224-native-qa.json` 在 `output/diviner-s5-native-20261103/`；不是重演219、不是新战斗，也不代表其他未实现高阶原生验证。

## 2026-11-03 — 秘偶大师实践说明使用既有中文动作名

- 基线 `86ac4a898abec6e46dd9fffca7ab4a83536d3b3a`；仅 MarionettistPanel、seer-feedback、对应两测试及本条记录。真实221规则与223成功公开回执含 PREPARE/PERFORM/CLOSE/WITHDRAW；改为精确已知观察／结果句、完整环境规则句及三个精确标题＋完整成功回执的展示映射，使用现有中文按钮名。未知句原样，成本、失败不退、实际释放后报告、自愿成年人及不完整转化限制保留。
- 不改命令、领域、原始回执、历史、存档或物品编号。最终两文件61测试、完整 main/renderer 类型与生产构建通过（既有 chunk-size 警告）；首次新增测试 caseId 类型过宽的 TS2322 已用已知 literal 修正，初错日志保留。日志 `output/marionettist-practice-copy-20261103/`。
- 独立源码审查通过。真实 Diviner224 官方冷启零命令验收普通／大字静态规则，完整中文动作名与原费用／失败限制可滚动阅读；三档224/72/52状态哈希由试玩者核验前后一致。图及 `practice-copy224-native-qa.json` 在 `output/diviner-s5-native-20261103/`。223瞬时成功与 controlled-release 新观察修后原生仍 NOT_RUN，仅公开输入／源码／测试覆盖，未重演或制造状态。

## 2026-11-03 — Chaos Hunter 历史导航测试按条目读取原输入

- 基线 `1234d47c23c3cbd99dafef559ef76ead7163425d`。PR59 Windows historical1 batch16 在原7例的第4例期间发生 V8 OOM；无失败断言报告。关闭历史的轮盘本已延迟挂载，未发现需修改产品轮盘的证据。
- Linux Node24.22.1/Vitest4.1.11、同 canonical 原输入和 `--max-old-space-size=768` 对照：main66048与1234原第4单例、原7例整套均通过，未复现 Windows OOM。原53,482,831字节 boundaries 含37条；只将该测试的全量解析改为现有 `readObjectEntry` 读取原键，7例、顺序、旧断言、fixtures、产品代码和内存预算不变。五种键值逐条与旧查找 deepStrictEqual，缺键仍抛错。
- 单次同环境全套实测：1234原加载33.72秒／RSS峰值999.9MiB；流式28.59秒／895.4MiB。RSS包含非堆内存；采样heap只作当前线程下界，不是全部worker堆峰值。最终原7例、既有helper测试1例、完整 main/renderer 类型及生产构建通过；独立源码审查通过。构建仅既有chunk-size警告。
- 证据在 `output/chaos-oom-probe-20261103/` 与 `output/chaos-fixture-stream-20261103/`；最初计时壳因 `/usr/bin/time` 不存在，在测试启动前退出127，改用Python资源计量，保留记录。此为测试内存加固，不宣称 Windows CI 已验证；未推送、重试CI、改冻结头或进行游戏行动。

## 2026-11-04 — 已保存轮盘回看提示保持事实一致

- 基线 `1234d47c23c3cbd99dafef559ef76ead7163425d`。PR59 historical11 原 Dark Angel 重开断言失败：快速显示临时设置重置后，静止的同一保存结果少了提示。产品仅将条件提示改为恒定事实“结果已保存，动画仅作演示”，不声称当前播放阶段；指针、动画、重播、跳过、快速显示、减少动态的逻辑与按钮状态全部不变。
- 原历史套件及全部断言、canonical fixture、领域、概率、存档均未修改。基线完整6例复现5通过／第353行失败；初版动态状态文案修好353但引起原256行新动画与冷重开文本差异，原失败日志保留，未采用该版本。
- 最终原历史6例＋轮盘16例＋战斗展示145例，共167项通过；完整main/renderer类型与生产构建通过（既有chunk警告）。新增冷重挂及各播放阶段事实提示断言，独立只读源码审查通过。证据在 `output/roulette-reopen-status-20261104/`。
- 仅本地Linux自动验证；修后Electron原生、Windows与远端CI仍NOT_RUN。未推送或修改冻结PR头。

## 2026-11-04 — 未读成功的普通交谈失败回执不声称已有片段

- 基线 `82ca36f729129d6f0b31bd9b680b45c3437ba9c8`。真实观众55在第二案读取失败后普通交谈也失败，上方原回执固定声称“已读到的历史片段保留”，与公开未读说明矛盾。领域旧句与历史回放保持原样，本片只修新确认回执的临时显示副本。
- 精确确认 intentId、run、前后revision、新增chronicle成员、非replayed、S8观众及已晋升、对应DISCUSS的已知case/title/完整失败句；仅当同案OBSERVED且公开READ动作仍存在，显示“尚未读到本次浅层片段”。READ动作由领域仅在该案未读成功时公开，不解析impression、不使用其他案状态。缺少依据、已读成功、未知句、旧/迟到/不匹配回执全部原样；原receipt、lastResult、chronicle、命令、规则、随机与存档均不修改。
- 定向Mindreader与seer-feedback两文件87项、SliceApp与日常结算两文件20项回归通过，完整main/renderer类型及生产构建通过（既有chunk警告），独立只读源码审查无阻断。证据 `output/mindreader-unread-feedback-20261104/`。
- 真实55瞬时失败没有重演，修后仅公开原句输入和受控组件/桥接测试；修后原生与Windows均NOT_RUN。旧保存历史原文有意不追改，未推送、不修改冻结PR59。

## 2026-11-04 — 已完成的未读心案不再暗示还可继续处理

- 基线 `91b37610fc3277bf48f8f36daaac7a49ef671d59`。真实57第三案普通交谈完成后，公开投影为RESOLVED、无本案动作，但旧未读说明仍称普通观察/询问可继续。仅选中已知三案之一、精确RESOLVED、精确旧未读整句、无同案处理动作四条件同时成立时，显示“未读到本次浅层片段；本案已完成。”并不显示该分支误称已有读取内容的通用说明。
- 未完成、未知状态/文本/案号、真实已有读取记录、有同案动作等全部保留原样；其它案动作不干扰本案判断。原投影、历史、领域、命令、选择行为与规则不变。两测试文件99项、完整main/renderer类型与生产构建通过，独立源码审查无阻断；日志 `output/mindreader-completed-impression-20261104/`。
- 官方同57冷启零游戏命令原生检查普通/大字完成第三案与未完成第二案：完成句及原核实结果完整、无重复处理动作，未完成第二案原说明和三动作仍可见。实际截图与 `native-qa.json` 在 `output/mindreader-completed-native-20261104/`；本人已看像素无截断。57完整currentJSON哈希及其它封存档文件哈希由试玩者核验守恒，未重演57成功或55失败。Windows未验证，未推送。

## 2026-11-05 — 第二项秘偶大师观察回执复用既有中文动作说明

- 基线 `d704990cca7f9280237b7e6b7bbb8a9ba3bdf5a8`。真实226观察回执将固定故事与两条facts合并，顶部仍含PREPARE/PERFORM/CLOSE/WITHDRAW，而下方逐条观察已中文。仅精确标题“五米内短暂初控并主动放开”与完整226公开原句同时匹配时，逐字保留故事，复用已有两条facts中文显示映射。未知标题、追加/前缀、人物或命令变体原样保留。
- 只改seer-feedback显示函数和对应测试；原始回执、领域、投影、存档、完整纪事及已有成功回执映射均不变。两文件62项测试、完整main/renderer类型与生产构建通过，独立只读源码/修前像素及公开回执审查无阻断。证据 `output/marionettist-observation-copy-20261104/`。
- 修前证据为 `output/diviner-second-practice-20261104/rev226-observed-normal.png` 与公开record-226-369。当前229公开近期只含228/229，226不再位于该formatter的当前/近期展示；未回滚或重演226，修后目标原生NOT_RUN，仅实际公开输入测试覆盖。Windows未验证，未推送，不改冻结PR60。

### 2026-11-05 大字行动回执字号（本地候选）
- 基线 `598411a`；仅 `slice-styles.css` 为通用本次行动结果增加大字 22px / 1.5 行高，使用 `:where` 保留小丑更具体的局部规则，普通字号不变。未改内容、命令或领域。
- `action-feedback-style`、`SliceApp`、`daily-state-summary` 共 21 项通过；完整 main/renderer 类型检查、生产构建及 diff check 通过。样式测试按真实先小丑后通用 CSS 顺序检查计算样式；不代替布局验收。
- 初次新增级联断言误将 computed px 期待为 em，失败日志保留；修正为原计算值对照后重跑通过。独立源码审查通过。
- 官方冷启同新手 revision 9 后瞬时会面回执已消失：目标 22px 长反馈与 1280 目标布局均 NOT_RUN，不重演行动。1364 普通/大字一般导航、Tab 焦点关闭及 Return/Escape 通过；独立试玩者核验新手及旧三档哈希不变。证据 `output/large-feedback-native-20261104/native-qa.json`，不以一般导航代替目标反馈验收。Windows 未验证。

### 2026-11-05 卷宗弹层滚动隔离（本地候选）
- 基线 `b389ae5`，独立 `fix/modal-scroll-isolation`。新手真实配方截图同时可见卷宗与底层页面滚动条；源码原先只令底层 inert，未锁定页面滚动。仅将 body 滚动锁绑定既有 modalOpen 生命周期，关闭/卸载恢复，卷宗 overflow:auto 保留并加 overscroll-behavior:contain。未改规则、命令、存档、文本或版式尺寸。
- 两文件18项测试通过，覆盖开启/关闭/Escape/重复开启/卸载、不干扰其他body类、阻塞事件Escape保持锁、无命令/公开投影不变及CSS计算样式。独立源码审查通过。测试不冒充真实滚轮/边界滚动/位置恢复验收；原生与Windows均待核。
- 完整main/renderer类型检查、生产构建及diff check均通过（既有chunk体积警告）。证据 `output/modal-scroll-20261105/`；尚未推送，不修改冻结PR。
- 原生补验：代码头 `38b173f`，从真实rev25备份装入独立candidate-userdata，普通/大字成长与完整纪事到底继续滚轮时底层不动，Escape/Close后日常中栏与右栏滚动恢复，重复打开关闭正常；Tab首个可见焦点在关闭按钮，未穷举完整循环。本人已查看普通/大字底部实际像素，未见外层滚动条或内容裁切。试玩者核验主/候选current_json SHA均为`b374aa1669473aafb1c4c92a4662a769a7261e55a2f8b33a3be693533ac89f40`，仍rev25；未提交游戏命令。图在 `output/natural-continuation-20261104/candidate-*-bottom.png`，Windows未验证。
