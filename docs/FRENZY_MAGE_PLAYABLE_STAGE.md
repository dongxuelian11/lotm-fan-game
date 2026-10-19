# 0.159.0 狂乱法师3：有限的既有动作偏转

## 原核与未知
第二部110《开启咒文》L58310–322黑皇帝牌直接4堕落伯爵→3狂乱法师→2熵之公爵→1弑序亲王。名称编号可靠；3完整主辅配方/晋升仪式/新增机制未展示。L58340–346建国、异常规则、九陵寝是1→0，不给3。L158935纳斯特“应该”3、扭曲炮弹轨迹为人物推测/个例，不当新3通用数值。黑皇帝号灵界跳跃为船，不能给3。3新玩法完全原创G有限延伸，2能力未知，不按熵字发明热力学万能。

## Schema与接入
root frenzyMage,folder frenzy-mage,types FrenzyMageState/Command/Projection,package0.159.0,schema157/content frenzy-mage-v157。标准结构沿chaos-walker/types/index的nestedlife/encounter，但没有任何幸运池/幸运检定。新能力仅一项black-emperor.s3.ordered-deviation（本作G有限既有动作偏转），成功晋升仅该mastery0。继承6旧roots lawyer/barbarian/briber/corruptionBaron/mentorDisorder/fallenEarl；旧原马洛FE4-MARLOW-VENN已死亡永不复活，原尸/原装备原历史不重开。只有briber.gifts中当前PLAYER的真实旧礼物可在新战斗中实际GIVEN，所有其他旧fields及已经GIVEN旧礼物原destination/givenWeek保留；不发新礼物，不回收旧given，不新库存。其他source/pools不改。
标准专业G晋升：4原promotion起12整周、acting100；guidance500；3独立原瓶6400、5真实劳务减5500到900；PREPARE_TASK REVIEW_RECORDS/CHECK_LIMITS/MARK_EXIT各1AP；PREPARE_PROMOTION1AP140p当前周；CONSUME0AP confirmedtrue will30 HP>20/M>40。四档后果沿158；success四属性各+1,maxS120不补当前；fallenEarlActingAtPromotion100。配方/完整仪式未知专业G。3失败可实际跨周独立下一批，无限刷当周禁止。原性别年龄身体不变。备药可0AP撤销不退款。

## 原自然起点
文件tests/fixtures/fallen-earl-v01360/natural.json，438commands，seedlawyer-natural-v063，finalACTIVEW115H70M100S116cash300AP2acting100，fallenEarlpromotion108，RNGcursor184，stats27/21/23/21。原马洛H0/M100/S8 DEAD、1轻伤，poweruses4ARC/1WARD/3COMPOSE，旧箱/垫/原伊芙都已归还/状态收束。briber.gifts共15，1–10已GIVEN旧去向不动，11–15在PLAYER可真实用于新战；不得复制新库。

## 三个有限G动作试验，实际场地和原物
新成年志愿信差FM3-DARIAN达里安·维尔42，自主心智，原身体/健康100/精神100保持；导引仍原米蕾·沃德。场地为协会净空投递演练房，START0，A4m，B/C各距A4m、独立空置有垫接收台，无其他人在轨迹。原纸FM3-ROUTE-PAPER永久写“从A到B”；能力不能改写原纸或既发行动。原封包FM3-PARCEL400g（没有真实机密、协会自有演练件），唯一FM3-PRACTICE-BALL80g软布球，原物每个只有一件/地点/主人，结束必须原件归还。
共13AP标准：每案OBSERVE1/PREPARE1/PERFORM1/REPORT_CASE1，REFLECT1。START_CASE0后真实锁住现场。methodABILITY或ORDINARY。新PERFORM能力5S2M，知识20四档，一次check，成功只对当时已明确但尚未执行的一个动作预备30秒G偏转；尚未真正执行不奖掌握，不追改结果或强制接受新的长期意愿。目标独立、可拒绝；中途撤回须STOP_INPUT清未应用影响，失败/取消/过期付费不退。ORDINARY无需check/S/M，1AP；能力失败后普通收束不额外AP。每次真实移动/读取/执行推进有限秒数。WAIT_EFFECT0仅等待当前剩余时间，STOP_INPUT0消除未用状态，已发事实不回滚。
1 case courier-route：达里安在A持唯一演练封包，当面同意一次有限动作试验，亲口声明下一步沿纸面A→B。玩家GO_A/CHECK_OBJECT核本人/原包/当前许可/原纸后PERFORM；EXECUTE_ACTION由达里安实际执行原待行走动作，成功修正使其普通走4m到C（不是传送），失败/普通到B。原包随原人唯一移动，原纸依旧B。玩家WALK_RESULT实走4m到实际B/C，READ_RESULT当面核本人原包；RETURN_PERSON由达里安自己带原包普通4m回A，玩家随行4m；RETURN_OBJECT当面归导引原包，RECORD_OUTCOME、RETURN_START4m、LEAVE_CASE、REPORT。导引真实START→A并返START，两次实走。能力影响仅这次已表示的动作，不能任意指令/未来终身服从。
2 case withdrawn-route：同一成年人/原包/原纸仍A，先取得当前许可与同一A→B的明确待行走动作；PERFORM之后本人立即撤回能力参与。STOP_INPUT必须清未用偏转，EXECUTE_ACTION只按其本人当前普通A→B，原人原包真实走B。玩家实走B读结果/原纸记录，RETURN_PERSON双方同路回A；归还原包、记录撤回、返START报告。不能把成功check当已实际改动作，取消后mastery0，不强迫改去C。ORDINARY路线可从未同意中直接普通完成，不诱导强制服从。
3 case own-throw：本人在A亲手取原80g布球，读原纸目标B、检查两个空垫，明确本人待执行的普通投球动作。PERFORM同一有限偏转，EXECUTE_ACTION本人实际投一次球，成功从既定B偏到C，失败/普通落B；物理动作本身存在、球实际飞4m后落空垫，不是凭空远程搬运或召唤。玩家WALK_RESULT实走4m，READ_RESULT看原球与原纸不一致，TAKE_OBJECT取原球，RETURN_A带同一球4m回A，RETURN_OBJECT交导引，再RECORD_OUTCOME/RETURN_START/LEAVE_CASE/REPORT。不能再投以抹除首次结果。成功实际应用奖新技能8，失败/取消/撤回不奖。确认LIMITED可作为记录要求，不要求任意魔法必成功。固定轨迹结果是有限G试验，不用额外概率重掷；所有成功/失败均保存。
每案实际封存observed/check/steps/movement/item/consent/elapsed，validator可重演，不只是文字走路。新root只有真实自己的物件、人物、时钟。界面普通退出只能在原物归主、本体START后；不瞬移退出、不耗尽永久卡场。

## 有限独立战斗
新G成年FM3-ALDEN阿尔登·鲁克45，S4H100M100S120体格22，独立净空院2m、原棍FM3-ALDEN-ROD、普通4m出口，无旁人/追赶。先TALK1AP再FIGHT1AP，可LEAVE0AP实走4m4s；不得把原死马洛再用。双方1–6行动、stage1250/max120/floor125，继承BLACK_EMPEROR35/15/20/30。共同65/30/5伤势/累积风险，实际敌术耗自己的灵性，无免费补充，继续轮本人+12S。
六槽沿FallenEarl exactweight30/15/25/10/15/5、姿态5/4：H旧s4.magnify，本人真实原短棍16×physical或强化身体59.15×bodyMastery×physical，实际4S只×(1+.25*oldmagnifyfactor)本击，没资源普通原击；J41.405×oldbodyfactor×physical0S。B旧s7.bribery：实际给旧briber.gifts PLAYER一件、3S，仅待用下一次针对自己动作×(1-.35*oldbriberyfactor)，原gift落新BATTLE:FRENZY_MAGE_DISPUTE:GROUND并永久保持；无gift/已有待用/资源不足则旧36.45×weakpointfactor×physical护身0S。K新ordered-deviation，5S知识20四档，成功仅一个pending：下一次实际正贡献BODY/ARC或实际正WARD减半该动作贡献；不消耗未发生动作、不改变前面已用招。敌COMPOSE实付4S gain8清未用pending并抵抗本轮新K，未清以前应用；0即时伤害/不强投降。R旧s4.exploit只有同一实际原gift未延长时3S将削弱从1次到2次，上限2不可叠加，没源0S/0贡献；A−22.5固定0S。保旧原礼物inventory真实，不奖新战斗mastery。
Enemy ARC35 5S70;WARD25 4S30;BODY25 20×physical;COMPOSE10 4S8;ACC5−22.5。实际全付费后才减半/旧礼物缩减；不把COMPOSE当攻击也不让gift影响其SELF行为。K可影响WARD，但gift只对targetPLAYER，两状态独立可按顺序乘、未用轮末清，费用与原gift不退。R只延gift不延K。
每轮新lifeclock实际60秒，活着终局普通4m4s出口，死者留院；敌死亡原棍COURT，否则HAND。完整source/order/资源/gifts快照/伤势重演，不重抽、重置老资源。各源与exactAPI向lead冻结：beginFrenzyMageCombatRound(s,stance,random)，currentFrenzyMageCombatSource，frenzyMageActionCount/EnemyActionCount，FRENZY_MAGE_COUNT_WHEEL/ENEMY_COUNT_WHEEL，frenzyMageAbilityWheel(s,stance)，drawFrenzyMageAbility(random,s,stance)，drawFrenzyMageEnemyAbility(random)，resolveFrenzyMageCombatAbility/resolveFrenzyMageEnemyCombatAbility，finishFrenzyMageCombatRound(s,context,continuing)，validateFrenzyMageRoundOutcome；outcomefrenzyMageOutcome,encounterFRENZY_MAGE_DISPUTE。

## Public UI/tests
FrenzyMagePanel,region狂乱法师,title狂乱法师与有限次序,selector选择狂乱法师事项,关闭狂乱法师页面。专业未知边界/所有新增G、原马洛永久死亡与旧礼物实际去向清楚。当前目标少量主要动作，详情折叠；失败保存锁、选原瓶独立确认、停止未发不等复原已发生、原人在实际地点、原纸未改变、原物真实返还。无书名脑补熵/船传送/建国仪式。
Fixtures plannedtests/fixtures/frenzy-mage-v01590/natural.json,boundaries.json，sameoriginalseed/creation438prefix；capturesprepared/promoted/practiced/combatStart/final。自然结果如实，不改随机游标或资源保过；定向测试另标。旧原roots全字段冻结，唯一briber.gifts允许原PLAYER被真实GIVEN，已GIVEN一律固定。执行权lead-only，不运行任何产品命令。


## 实际验证

558条同seed自然公开命令，原堕落伯爵438条前缀完整重放且迁入终态全字段相等。W125首原瓶严重排异，实际休养重筹后W133第二原瓶成功晋3。狂乱法师编号已核，本阶专业晋升与新增有限既有动作偏转均G。三案能力检定均失败，真实付15灵性6精神，不重抽；信差原包与本人原球各按原纸A到B实际行动，撤回案先停止未用影响再由本人普通走B。三案85秒、本人48米、导师24米、原纸永久写从A到B，原400g包和80g球实际归还；新掌握0，报告反思100，不称自然成功偏转。W141可选战首轮本人真实死亡H0/M100/S111、原身体留院，无普通工作或瞬移出口。原阿尔登H100/M100/S101仍抵抗，3次弧光及1次凝神实耗19灵性，原棍在手。本人原礼物11–13实付9灵性并逐件交付至本场地面，原礼物1–10去向与周次不变、14–15仍在PLAYER；没有补送新库。该轮未抽中新K，成功偏转、敌方凝神抵抗、真实活着出口由明确标注定向测试覆盖，不替换自然死亡。原马洛DEAD/H0/M100/S8、一处轻伤及六阶历史全部保留。626项唯一相关测试（504领域25文件、122界面7文件）、32真实SQLite边界、主编译、应用类型检查及完整生产构建通过。1072模块仍有大包警告；本版未重复干净安装，0.138已有实装。真实GUI/Electron可见窗口/Windows未验。22条9→4有限切片，前二十条有有限3内容；门4/漫游者3、银骑士3含定向验证，不得称全部自然通关。其余2条3、全部2→0与完整1.0未完成。

首主编译与自然流程直接通过。相关旧测试将已开放3作为未实现阶，窄改为尚未开放2；旧原档在读取时迁入当前schema157，全部原输入与旧玩法断言保留。旧腐化男爵奖励校验移除后来当前死亡的错误否决，仍校验原遭遇已解决及实际有效记录，首轮真实死亡已完整保存。不改自然seed、随机游标、资源、敌强度或任何既成结果；首失败日志保留。

## 下一整合重点

22条3接完后，优先实际可玩性与战斗节奏审查，再推进2阶。门半神路线自然未通、银骑士六猎频繁投降与必须猎杀冲突，以及跨阶段旧伤势累计导致普遍终局死亡，均为1.0前必审，必须公开合理改版后重新自然验证，不能用定向游标代替通关。
