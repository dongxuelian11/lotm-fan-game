import type { ThreeHeadedTemplarAbilityId, ThreeHeadedTemplarPreparationId } from './types.js';

/** The novel-backed direction never supplies an invented exact cap, source or ritual. */
export const THREE_HEADED_TEMPLAR_GUIDE = '51岁玛拉·埃尔文（THT3-MARA，独立原创G指导者与原封存保管者）';
export const THREE_HEADED_TEMPLAR_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const THREE_HEADED_TEMPLAR_MIN_BLACK_KNIGHT_WEEKS = 12;
export const THREE_HEADED_TEMPLAR_LABOUR_STEPS = 5;
export const THREE_HEADED_TEMPLAR_BOTTLE_IDS = ['three-headed-templar-potion-1', 'three-headed-templar-potion-2', 'three-headed-templar-potion-3'] as const;
export const THREE_HEADED_TEMPLAR_FORMULA_STATUS = '倒吊人途径序列3三首圣堂名称与可突破一次只外放一位半神灵的方向已原核，完整配方与晋升仪式尚未核实。材料、用量、调配顺序与完整仪式保持未知，不能断言无需仪式。本阶段只有明确本作原创G的三瓶独立成品渠道与实际专业准备；三项核对及当周场地检查不冒充原著完整仪式，不开放自制。';
export const THREE_HEADED_TEMPLAR_SOURCE_STATUS = '原核只确定三首圣堂3突破一次只外放一位半神灵的限制，没有给出具体新上限。本作至多2位外放明确为G，主人仍同时只借1灵；总放牧上限7、每灵至多3个实际已选技能保留。本切片本人借用只沿用旧伊芮斯，两位新半神灵仅支持有限外放协作，不暗赠新的本人借用技能库。赫莲娜·奎因（THT3-HELENA，生前54）与罗兰·维克（THT3-ROLAND，生前61）是两个此前已故的独立原创G半神灵来源，各有不同原死亡记录、原封存容器和玛拉保管记录。须本人会面、同意交接、逐灵实付180便士及1行动准备，再以1行动6灵性2精神、知识18承担风险；失败消耗不返，同一仍封存原灵只可跨真实周重新付费准备再试。成功取得者才可外放，永久释放者不得重新获得，无免费替代灵。原塞德里克永久释放、原伊芮斯实际放牧、旧不受控影体永久隔离和原加里克投降保留。三处生活原案、成年人物、距离、持续、价格、资源、技能方法与战斗精确数值均为原创G。';
export const THREE_HEADED_TEMPLAR_POTION_SOURCES = THREE_HEADED_TEMPLAR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${THREE_HEADED_TEMPLAR_GUIDE}介绍的独立三首圣堂成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非黑骑士或更早原瓶改装。完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const THREE_HEADED_TEMPLAR_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const THREE_HEADED_TEMPLAR_PREPARATIONS: { id: ThreeHeadedTemplarPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对原灵、原瓶与原隔离记录', description: '本人核读黑骑士原晋升与六阶原瓶经历，核对原伊芮斯的实际放牧和已选方法、塞德里克的永久释放与旧独立影体的真实隔离。已释放者不可重新获得，隔离影体不是宠物或新半神灵源，不复制或改写任何旧记录。' },
  { id: 'CHECK_LIMITS', title: '核验双灵外放与本人借用边界', description: '区分原核的突破单灵外放方向与本作G最多2位的有限实现。主人仍同一时刻只借1灵，原低阶灵不升级；总放牧至多7位、每灵至多3项真实已选技能。新两灵必须从两个原封存来源风险取得，外放、本人维持和各灵实际技能分别付费，回收不补满。' },
  { id: 'MARK_EXIT', title: '标明原容器、强光中断与普通退出', description: '本人写清原站至4米A和8米B的同一路径、每个原封存容器及原物归还顺序。强光只削弱实际受影响的原灵；撤回沿原路并保持已耗资源。无灵者可逐处本人步行完成，0行动收束仍实际走路、召回和关闭原灯；本步骤不替后续场景同意，也不消除死亡后果。' },
];
export const THREE_HEADED_TEMPLAR_ABILITIES: { id: ThreeHeadedTemplarAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s3.multiple-release', label: '有限双灵外放（实际原灵协作G）', description: '实际取得的两位原半神灵各自保有30灵性上限与100完整度；一次外放实付主人4灵性2精神、知识18检定，失败照耗且仍在原内。最多2位是本作G；每次有限方法须原灵实际在场并支出自身3灵性，主人另付明确维持成本。本人仍一次只借1灵，当前仅实现旧伊芮斯借用。回收沿原<=8米路线计时，不刷新资源；强光削弱同一原灵20完整度并中断，0完整度消散，永久释放与消散不可复原。休养只由跨周原封存照料、1行动40便士实际恢复，不能随外放刷新。普通步行照料能完成消化，却不谎称使用能力或奖励掌握。战斗两灵每轮各至多一次实际付费协作，非无限自主战斗或免费伤害，仍受共同盘与死亡后果。' },
];
export const THREE_HEADED_TEMPLAR_CONSUMPTION_RISK = '以下具体规则均为本作G：黑骑士消化100，从原黑骑士晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周场地，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，黑骑士消化100与旧掌握保留，只新增hanged-man.s3.multiple-release一项0掌握；灵性上限120且当前不补满。秘祈人至黑骑士六阶全部原瓶、原物、原灵、原储备与原敌伤势或死亡保持。旧塞德里克永久释放、原伊芮斯实际放牧、旧影体永久隔离和原加里克投降保留。晋升不赠送半神灵库、本人借用技能库或免费替代原灵；新两灵须另行会面、实际付费准备并承担风险。';
