# 0.154 预言大师3 最小阶段提案

起点：mystic-v01310/natural.json，411条原公开命令、seed pryer-natural-v048；W108 ACTIVE H100/M100/S112，cash750/AP2，神秘学家4扮演100。完整迁入、原卢坎投降与原公开故事105知情者保持。

原核：L177931/L203615明确3预言大师；模糊命运画面需解释，受位格限制，可判断错误，无法阻止全部灾难。完整配方仪式未知；命运之蛇血是嘉德丽雅原4个别准备，不给新3免费使用或当通用仪式。下一2贤者信息化及阻止高位灾难仪式留2。

G获取沿现有三独立成品渠道、五次劳务、12整周/前阶消化、三项准备与当周140检查，四档代价和跨周补货。只新增一个预兆能力，不送新故事库。

三项有限场景：
1. 原仓库的两种相似铃声：独立记录模糊预兆，只列两种假说；实际查看原铃架与原排班册，排除错误解释才交付，预言不自动写入真相。
2. 原短途送件：预兆显示遮暗的门和一线亮光，真实门两端/原遮帘/当事人核实；可改走普通原路并付时程，物件仍须本人实际交付，不凭预兆传送。
3. 原仪器的有限异常：先明确低阶可观测范围、付出灵性；失败无结论仍可普通停机核验，明确拒绝继续探高位来源；不做点击必知所有秘密。三场25+反思25，成功用能力且核实后才增掌握。

战斗新原创成年对手仍实际S120与原武器/有限法术。替换原聚焦/一槽为预兆准备：付费获得有限下一次真实敌攻击预判窗口，受对方假动作/间隔影响，不自动伤害、不改随机历史；沿原S4共享核心与伤势盘，旧已公开迟钟回声仍15%效力、原卷只消耗现存库存。失去目标窗口不退成本。

保存各预兆文本、当时不确定解释、后续物证与实际行动，不能先偷读后台再称可知未来。范围、成本、具体文本、人物与剧情均G。原故事公开不能回收，旧卷/眼镜/原人结果保持。自然原411重放与少量SQLite边界，真实GUI仍未验。

## 共享实施契约（冻结供静态分工）

root prophecyMaster；domain prophecy-master；UI ProphecyMasterPanel；command PROPHECY_MASTER；schema152/content prophecy-master-v152；package0.154.0。
三瓶prophecy-master-potion-1/2/3，导师PM3-ELIRA（埃莉拉·温特53岁G）；500指导/6400药，五实劳务减5500为900，准备140/1AP，当周0AP独立喝药，前4满12周/acting100。准备REVIEW_RECORDS/CHECK_LIMITS/MARK_EXIT。升3四属性各+1、maxS120不补满、保存mysticActingAtPromotion。不再解析另一滴神话血、不要求做2阶灾难仪式。新能力仅hermit.s3.prophetic-glimpse。
继承原六根pryer/combatScholar/wizard/scrollProfessor/starMystic/mystic；原NPC、原神话血/原故事发布105人/效力15%全保留。只有实际耗用旧原卷轴才可改变旧scrollProfessor原库存；若本阶段没用则全等价。

Life API使用UnagingDemoness同型标准（ProphecyMaster命名），state.clockSeconds与advanceProphecyMasterLifeClock(s,seconds)。CASE_IDS=['bell-schedule','covered-door','bounded-source']。3案各OBSERVE1AP、PREPARE1AP{method:ABILITY|ORDINARY}、PERFORM1AP、REPORT1AP；REFLECT1AP，共13AP。PERFORM只进现场，不自动施法。每案一个原桌记录页/实际物件借还，成年原参与者逐场同意可撤回。玩家START/A/B；START↔A6m，A↔B12m，B→A→START普通回路。所有移动实际耗对应秒，不是瞬移。
指令通常{type,caseId}：CONSENT_OWNER,TAKE_RECORD,GLIMPSE,STATE_HYPOTHESIS{hypothesis:ALARM|HANDOVER},GO_A,READ_SCHEDULE,WITNESS_BELL,CHECK_DOOR,WALK_B,DELIVER_PARCEL,READ_DELIVERY,COMPARE_EVIDENCE,CLOSE_SHUTTER,CHECK_WARNING,STOP_INQUIRY,ORDINARY_CHECK,RETURN_A,RETURN_START,RETURN_RECORD,INSPECT,CLOSE,REPORT,WITHDRAW；只按各案真实适用列actions。不需全部案共同用每条。
1 bell-schedule: consent+take原记录→GLIMPSE可选（6S/2M，knowledge18，成功给“两声回响，原架暂空”的模糊画面，失败无可靠结论）→STATE_HYPOTHESIS二选一，允许猜错保存→GO_A→READ_SCHEDULE现实表→WITNESS_BELL实际12秒，原保管人按预定清点临时取下原铃敲两声再放回。证据说明HANDOVER不是ALARM；COMPARE_EVIDENCE记录修正，实际走回/归页/检/关/报。幻象不提前附后台答案，也不代表说出即成真。
2 covered-door: 原封包800g由TAKE_RECORD同时交付（明确实际两件）；可GLIMPSE“遮暗门与一线亮光”→STATE_HYPOTHESIS ALARM|HANDOVER（均待证）→GO_A→CHECK_DOOR发现原帘遮门，原门已锁；没有预测直接开锁/透门。WALK_B沿12m侧道→DELIVER_PARCEL给PM3-TOMAS→READ_DELIVERY核原签收/原帘用于保管→COMPARE_EVIDENCE→RETURN_A→RETURN_START→RETURN_RECORD(原回执)→INSPECT/CLOSE/REPORT。全程原物同体真实搬运。
3 bounded-source: 原参与者以明确G低强度封存残响教学，不假装高位真实秘密。GLIMPSE付费仅给“过亮的边缘、未辨来源”，成功也不知全部；失败亦可STOP_INQUIRY。GO_A→CHECK_WARNING读来源边界→CLOSE_SHUTTER原遮盖实际关→STOP_INQUIRY终止能力→ORDINARY_CHECK核原外壳/已有说明，不打开核心、不神话窥视→COMPARE_EVIDENCE→RETURN_START/RETURN_RECORD/INSPECT/CLOSE/REPORT。不把停止探查等同驱散真实污染。原封存件留A不搬走，原工具有位置。
0资源撤回允许停止、归还、普通真实路径；不返还已花SP/M/AP。知识18失败损失成本，成功与物证报告后才mastery+8；报告25/反思25，不需要无意义失败重刷或确保3次成功。
每案保存原不确定预兆、原假说、后实证、修正记录与时间顺序，表象成功不是客观真相。UI一个主目标selector+真实可用动作，细节可折叠。before任何未来事件真正发生时投影不显示其结果。

Combat继承原MYSTIC核心10/30/25/35，1250/120/floor125，两边1–6动作，普通盘/持续+12；仅新遭遇PROPHECY_MASTER_DISPUTE。独立对手PM3-OSRIC（奥斯里克·盖尔48岁G），原棍PM3-OSRIC-ROD，H100M100S120，4m净空无追逐场，原卢坎仍投降。
轮盘：原卷/已学冲力/实棍H30，BODY_FOLLOWUP15，BRIEF_WARD20，旧星光牢笼15，旧迟钟回声10，新GLIMPSE5，ACC5；和为100。旧技能真实素材/知识/成本和已公开回声15%保留，不免费送新法术/原卷。新槽6S+2M/knowledge18，成功仅准备本回合下一个正贡献实际身体或付费弧光攻击×0.7（减势G），不是必中躲闪或先行造成伤；敌先假动作可消耗该窗口而无伤，或回合过期。敌ARC_BOLT5S70、WARD4S30、FEINT3S真实消耗预兆窗口(若无窗口则0贡献普通动作不收灵性)、BODY_STRIKE20×身体、ACC；加权可合理默认，所有新参数G。不要把预兆或假动作计为致伤威胁。敌法术与原棍必须实有，历史有序证据重放校验。
Combat API按UnagingDemoness公共context(source,playerActions,enemyActions)；finish推进life60s，清本轮window/cage/echo。原卷消耗/旧工具变化按实际，旧NPC/剧情不改。新3不能做2贤者信息流或阻高位灾难仪式。

## 实际验证

507条同seed自然公开命令，原神秘学家411条前缀完整重放且迁入终态全字段相等。W116第一原瓶大成功晋3。三次实际预兆均失败，仍花18灵性6精神，不改随机数求成功；三案119秒60米，以真实排班册、原铃敲响、普通侧路与原800g封包签收、原封存外壳核验纠正此前假说。预言掌握0，报告与反思扮演100；不称已自然成功窥见未来。W121实际消耗原材料12，制成原卷9（makerSequence3）并授权，W123第二轮真正烧耗。同场共4轮：原奥斯里克5次弧光/7次屏护实耗53灵性，最终原身体死亡H0/S67、原棍留院；两次无窗口假动作普通回退0耗费。本人两轻伤H80，沿4米普通出口离开，W124真实WORK后cash530/AP3/S114；旧卢坎H70/S17投降仍活，原故事105知情者和15%效力、六阶旧记录保留。自然新预兆战斗槽未成功使用；成功窗口、假动作耗窗等为明确定向验证。453项唯一相关测试（393领域21文件、60界面4文件）、33真实SQLite边界、主编译、应用类型检查及完整生产构建通过。1032模块仍有大包警告；本版未重复干净安装，0.138已有实装。真实GUI/Electron可见窗口/Windows未验。22条9→4有限切片，前十五条有有限3内容；门4/漫游者3、银骑士3仍含定向验证，不得称全部自然通关。其余7条3、全部2→0与完整1.0未完成。

自然首次晋升发现继承能力数组重复新预兆条目，窄修后以原seed完整重放，未改资源或随机游标。旧相关共享测试读取时迁入当前schema152，保全部原输入与原断言；新3卷轴沿真实原材料制作，原卷源验证接受实际makerSequence3。补原敌既有战斗历史不能重置为AVAILABLE的有限守卫；界面最后一例明确主动停查不等于撤回当事人同意。原失败日志保留。
