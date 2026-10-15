# 0.160.0 混乱猎手3：有限原标线与双方实际行动

## 来源与范围
第五部200《真正的神棍》L200622直接3混乱猎手；L200624同时戴0—36。L200996剥夺特莉丝黑焰为个例，不能把神器光枪/翼封空间当3通用。L201014禁令被高阶灰白隔绝。完整3配方/仪式/新增规则/范围次数未核；有限继承4禁令/剥夺、以下新增G均明确原创。下一2平衡者直接L194714/L200569，不下放天使光领域。无全知识别罪恶、任意改规则、强制真话、死亡判决。

## 共享与晋升
root chaosHunter,folder chaos-hunter,types ChaosHunterState/Command/Projection; schema158/content chaos-hunter-v158/package0.160.0。nestedlife/encounter，参考frenzy-mage最新结构。
新能力唯一justiciar.s3.bounded-order，本作G有限双方规则；新mastery0。旧六roots arbiter/sheriff/interrogator/judge/punishmentKnight/imperativeMage全字段冻结，旧实际罗温IM4-ROWAN-KELL不换皮重开；旧伙伴与原物不移动/返能。原352命令来自tests/fixtures/imperative-mage-v01370/natural.json，seed arbiter-natural-v066，W89ACTIVEH50M100S117cash400AP2，cursor269，stats28/23/23/19，promotion82acting100。旧罗温H30M100S0SURRENDERED，4轻1重伤/risk4，5ARC3WARD2COMPOSE；老原人保持。
标准G专业晋升沿frenzy：12整周/acting100，guidance500；3独立原瓶6400，五真实劳务减5500→900；三PREPARE_TASK REVIEW_RECORDS/CHECK_LIMITS/MARK_EXIT各1AP；PREPARE_PROMOTION1AP140p当前周；CONSUME0APconfirmedtrue will30,H>20M>40，四档后果不随机即死，success四属性各+1/spcap120不补当前，imperativeMageActingAtPromotion100。三瓶全败真实跨周新批，旧尸/资源不刷新。完整配方仪式未知，G导师方案。ACTUAL statusDEAD禁止。

## 生活：同一标线、原包、两个有自主身体的人
三case paired-line / withdrawn-line / own-line。新成人志愿者CH3-MIRA米拉·佩恩43，独立健康100精神100，身体A；原导师薇娜·贝尔GUIDE。场地START0→A4m→B4m，B空桌放唯一350gCH3-PARCEL；唯一CH3-LINE标条在A/B通路，非墙；没有旁人。原纸CH3-RULE-PAPER永久写“本次从A到B的越线”，范围与秒数本作G，不改纸不追改过去。每案原物初始GUIDE/START，GO_A导师/玩家普通4m到A；导师额外亲携包去B4m放下并回A4m，原标条放A，原纸交PLAYER。每次这些动作有时间/距离/唯一所有权记录。
每案OBSERVE1AP/PREPARE1AP(methodABILITY|ORDINARY)/PERFORM1AP/REPORT1AP，3案+REFLECT=13AP。START_CASE0锁。GO_A/CHECK_OBJECT核原人/原纸/原包位置/原标条/当前许可。PERFORM能力5S2M knowledge20四档一次，成功准备20秒有限G规则；作用仅本次两人各一次A→B试走，固定合作演练不额外随机抵抗，不等于真实敌人必服。失败成本保留；ORDINARY_CHECK作为未付费PERFORM替代，不检定不S/M。所有亲身尝试为普通步行，规则有效则在A止步不移动，失效/普通则各走4mB。每人最多一次，结果固定存证不能刷。
paired-line：当前两人同意→PERFORM→TRY_PLAYER、TRY_PARTNER(顺序均可，实际每次1s，若走4m再4s)，成功ruleactive都止A，失败/普通都到B；READ_RESULT本人核两实际位置/纸；STOP_RULE清未用效力，已经移动不回滚。伙伴在B则RETURN_PERSON本人自主4m回A，玩家不随移动。玩家在A则WALK_B普通4m；若已B不额外走；TAKE_OBJECT在B亲取唯一原包；RETURN_A同包4m；RETURN_OBJECT本人在A交包/原纸并收起原标条归GUIDE；RECORD_OUTCOME；RETURN_START双方导师本人普通4m、LEAVE_CASE、REPORT。伙伴始终最终A。
withdrawn-line：PERFORM后米拉立即撤回本次规则许可。必须STOP_RULE后才能TRY_PLAYER/TRY_PARTNER，两人均按当前普通意愿A→B；付费/失败历史不抹除，mastery0。之后真实相同收束。不能说同意一次便无限控制。
own-line：当前本人明确自己也受同一规则，米拉本案不参与且在A看守自愿无效果。PERFORM→TRY_PLAYER，TRY_PARTNER不合法；READ_RESULT核本人止A或已B与原纸；STOP_RULE，WALK_B(如必要)/TAKE_OBJECT/RETURN_A/RETURN_OBJECT→CONFIRM_LIMITED{claim:LIMITED|GUARANTEED}→RECORD_OUTCOME→RETURN_START/LEAVE/REPORT。本人不可声称自动豁免。每个成功且实际拦停的paired/own报告+8mastery，撤回0，失败/普通0；最大16，acting3*25+reflection25。
可提前WITHDRAW_CONSENT在paired已CHECK未TRY时；STOP_RULE0停止未应用状态；WAIT_EFFECT0只等剩余20s，不能重复推进长时间。控制离场不等于物品归还。安全收束动作不耗AP；若0AP不能卡原物/现场。合法WITHDRAW保已发生动作，必须实际归原物/返START，未报告可重新准备但不回滚已付费；按frenzy前置withdraw结构，避免放弃后原物凭空归位。
所有clock、steps、movement、consent、cost和能力检定strict replay；advanceChaosHunterClock/advanceChaosHunterLifeClock外部combat60/exit4有记录。samepaper原文永不变，NoLuck，无额外事件盘。
API同159：createChaosHunterLifeState/projectChaosHunterLife/chaosHunterLifeActions/applyChaosHunterActivity(s,c,ctx)/validateChaosHunterLife(s)/validateChaosHunterActivityCommand/chaosHunterActivityReason/hasChaosHunterLifeLock/advanceChaosHunterLifeClock。

## 新独立有限战斗
CH3-EDRIC埃德里克·梅森44，实际S4H100M100S120physical22，原棍CH3-EDRIC-ROD，两米日光净空院CH3-COURT，4m原普通出口，无旁人/追赶。TALK1AP/FIGHT1AP/LEAVE0AP真实4m4s，不重置旧罗温。主人序列3核心沿原30/20/35/15，budget1250/max120/floor125，双方1–6 count12/20/25/23/14/6。共用65/30/5伤势与旧累计risk，实际每轮60s，活着终局实走4m4s，死者留院，敌死原棍COURT否则HAND。
六槽weight30/15/25/10/15/5，stance5/4，沿原imperative-mage：
H justiciar.s9.combat-training 实持原短棍16×physical或59.15×bodyMasteryfactor×physical。若本轮真实敌方抵抗本规则并完成正贡献BODY的breachReady，可另付3S加20×旧punishmentfactor×physical，消耗一次真实来源；不额外行动，不靠名称处决。
J justiciar.s5.wound-verdict 旧目标真实injury+3S才知识14原二元check，success45×woundfactor/否则0；无旧伤/资源普通41.405×bodyfactor×physical0S，算BODY受规则。
B justiciar.s4.intimidation 旧4S知识18二元check，后续正BODY/ARC×.6一次，可被COMPOSE清除；无资源旧trace防护49.29×tracefactor×physical0S。
K justiciar.s3.bounded-order 新5S知识20四档，成功给PLAYER与ENEMY各一个pendingBODY约束，本轮可各触发一次。当前有任一pending不叠加、不付费；失败成本保留。每次实际H/普通J/敌actualBODY才独立抵抗roll1–100，threshold55+20*旧prohibitionmastery/500（G，沿旧基础），被挡该原动作贡献0，没挡原动作真实继续。敌实际正BODY抵抗才给breachReady；本人抵抗不是可攻击敌人的来源。仅BODY，不束ARC/WARD/COMPOSE/有伤J。不能以敌人的一次动作偷耗玩家那一份。0即时贡献；资源不足普通移动6×physical0S。所有新K判定/双pending/抵抗要日志可审。
R justiciar.s4.deprivation 旧4S知识18二元，暂剥敌原ARC；其后计划ARC回退真实普通BODY0S，仍受本人待用K，原敌资源不虚扣；COMPOSE实付可清R且本轮抗R/B。不可偷到能力，不复制原ARC。
A−22.5固定。
EnemyARC35 cost5 gain70；WARD25 cost4 reduction30；BODY25 gain20×physical0S；COMPOSE10 cost4 gain8 清B/R并本轮抗B/R，不清双方body规则（原类别不同）；ACC5−22.5。有费用原术先确认可付，若不足/剥夺改真实BODY，规则在实际BODY上判定；未发动术不能收费。继续轮主人+12S，敌永不补能。所有pending轮末清但已付费用不退，未用breach不延续。不新战斗掌握。
API完全沿frenzy：beginChaosHunterCombatRound(s,stance,random)，currentChaosHunterCombatSource，chaosHunterActionCount/EnemyActionCount，CHAOS_HUNTER_COUNT_WHEEL/ENEMY_COUNT_WHEEL，chaosHunterAbilityWheel(s,stance)，drawChaosHunterAbility(random,s,stance)，drawChaosHunterEnemyAbility(random)，resolveChaosHunterCombatAbility/resolveChaosHunterEnemyCombatAbility，finishChaosHunterCombatRound/validateChaosHunterRoundOutcome；outcomechaosHunterOutcome,encounterCHAOS_HUNTER_DISPUTE。source含核心/双方伤/风险，重演真实顺序/各自pending及资源。适配器集成。

## UI/验证
region混乱猎手,title混乱猎手与有限规则,selector选择混乱猎手事项,close关闭混乱猎手页面。一个当前目标、折叠历史，能力与未来名称原核边界明示，反复实际失败不强成功。公共命令、失败保存锁、选瓶独立confirm、双方规则不误当原著精准，新原人与旧罗温分明。
fixture tests/fixtures/chaos-hunter-v01600/natural.json,boundaries.json，旧352命令same seed前缀，capturesprepared/promoted/practiced/combatStart/final。全部六root深等无例外。自然死亡原样保留，成功/退出若只定向须明确标签。不为本阶段调seed/资源/敌人。到161后优先统一真实可玩性审查再2阶，不追加泛化体系。


## 161后可玩性审查已确认重点

159自然战前H100仍有两份未处置重伤、risk2、careKnown=false而careAvailable=true；首败后实际35/30/35盘死亡。先审查真实诊所发现/入口、战前伤势风险解释、60便士处置再休养的公开路线，与普通REST区别。不先改死亡盘，旧死档保留，再从原活体前缀分支实际治疗后独立自然验证，禁止重抽/免费治愈。门半神与六猎问题同次审查。


## 实际验证

477条同seed公开自然命令，原律令法师352条前缀完整重放且迁入终态全字段相等。W98首原瓶失败，实际休养重筹后W106第二原瓶大成功晋3。混乱猎手3和平衡者2名称编号已核；本阶专业晋升和新增有限双方规则均G。双方越线案知识检定成功，本人和原米拉各真实尝试后留A；撤回案和本人案检定失败，不重抽，实际普通步行至B并归还原物。三案分别35/43/34秒，本人48米、导师48米，原350克包、永久文字原纸及原标条真实归还；实耗15灵性6精神，新掌握8，报告反思100。W114可选战首轮真实死亡H0/M100/S112，原身体留院没有出口。战前H100仍有一处未治疗重伤和累计风险2，本轮失败后风险3，共同35/30/35盘实际95进入死亡。原埃德里克H100/M100/S101仍抵抗，3次弧光和1次护持实际耗19灵性，原棍在手。本人两次旧震慑实际耗8灵性，没有抽中新K；战斗中双方独立抵抗/违令惩戒/活着退出由明确标注定向测试覆盖，不替换自然死亡。旧罗温仍SURRENDERED/H30/M100/S0，4轻1重伤及六阶原历史完整保留。609项唯一相关测试（480领域25文件、129界面7文件）、37真实SQLite边界、主编译、应用类型检查与完整生产构建通过。1080模块仍有大包警告；本版未重复干净安装，0.138已有实装。真实GUI/Electron可见窗口/Windows未验。22条9→4有限切片，前二十一条有有限3内容；门4/漫游者3、银骑士3含定向验证，不得称全部自然通关。最后抬棺人3、全部2→0及完整1.0未完成。

主编译、自然流程、480领域测试首跑通过。界面首跑128通过、最后一项因512MiB堆内存不足中断；仅将新导航测试持有的52MB全边界档改为先选实际单边界后再渲染，原输入与断言未删。该导航文件7项重跑通过，唯一界面总数129。原首OOM日志与原死亡分支保存，不改自然seed、随机游标、资源或敌强度。旧法官历史奖励不再被后续当前死亡错误否决，仍核原遭遇已解决及实际有效记录。
