import type { ProphecyMasterAbilityId, ProphecyMasterPreparationId } from './types.js';

/** Novel-backed direction is separate from the finite original G scenes and all numbers. */
export const PROPHECY_MASTER_GUIDE = '53岁导师埃莉拉·温特（PM3-ELIRA，独立原创G人物）';
export const PROPHECY_MASTER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const PROPHECY_MASTER_MIN_MYSTIC_WEEKS = 12;
export const PROPHECY_MASTER_LABOUR_STEPS = 5;
export const PROPHECY_MASTER_BOTTLE_IDS = ['prophecy-master-potion-1', 'prophecy-master-potion-2', 'prophecy-master-potion-3'] as const;
export const PROPHECY_MASTER_FORMULA_STATUS = '隐者途径序列3预言大师名称已原核，完整配方与晋升仪式尚未核实。材料、用量、调配顺序和完整仪式均保持未知，不能因此断言无需仪式。本阶段仅有明确本作原创G的独立成品渠道与专业支持；三项准备及当周场地检查不冒充原著完整仪式，不开放自制配方。完全解析一滴神话生物血液属于既有神秘学家4的已知仪式部分，原滴的真实归还与研究保留，本次不再要求另一滴。命运之蛇血是嘉德丽雅的个别准备，不当作预言大师通用仪式或赠送命运能力的凭据。';
export const PROPHECY_MASTER_SOURCE_STATUS = '原核L177931/L203615明确预言大师3。预言呈现模糊命运画面，需要本人解释，受位格限制，可能判断错误，也无法阻止所有灾难。本阶段只新增hermit.s3.prophetic-glimpse一项有限预兆，不送神秘再现故事库。原神秘学家公开故事的105名实际知情者与迟钟回声15%效力保留，公开信息不能回收。下一序列2贤者的信息化及阻止高位灾难的仪式留在2阶，不由3阶预兆提前取得。三项原仓库案例、成年参与者、6米和12米普通路线、6灵性2精神与知识18检定、战斗下一实际攻击贡献乘0.7窗口以及全部具体场景、文本和数值均为原创G。预兆本身不造成伤害、不改已提交随机历史，不使推测说出即成真；后续现场物证与实际行动必须分别保存。';
export const PROPHECY_MASTER_POTION_SOURCES = PROPHECY_MASTER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PROPHECY_MASTER_GUIDE}介绍的独立预言大师成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非神秘学家或更早原瓶改装。完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const PROPHECY_MASTER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const PROPHECY_MASTER_PREPARATIONS: { id: ProphecyMasterPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对既有观察与原研究记录', description: '本人核读神秘学家原晋升、原血样归还与原故事研究及公开经历，明确既有事实与自己的解释不同。不会撤销105人的已知信息、改写迟钟回声15%效力，不能凭抄录生成新故事库或预先取得未来物证。' },
  { id: 'CHECK_LIMITS', title: '核验预兆的有限范围与错误可能', description: '本人按原指导记录区分模糊画面、两种待核解释和实际发生的事。知觉受位格限制，失败没有可靠结论，成功也不能保证判断正确；不窥探高位来源，不声称能阻止所有灾难，也不把下一贤者2的信息化或灾难仪式提前领取。' },
  { id: 'MARK_EXIT', title: '标明停止探查与普通核验出口', description: '本人写清每处原场的普通步行与原物借还顺序，并标明停止能力、关回原遮盖、真实归还的步骤。撤回不退灵性、精神或行动，0行动出口仍实际走路和操作；本步骤不替后续成年人同意，也不把停止探查说成消除了外来污染。' },
];
export const PROPHECY_MASTER_ABILITIES: { id: ProphecyMasterAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s3.prophetic-glimpse', label: '模糊预兆（有限解释与核验G）', description: '实付6灵性、2精神，知识18检定。成功仅留下本案模糊画面，失败没有可靠结论；本人须另记可能错误的假说，再到原处核实当前排班、门帘、签收或已有低阶说明，不能预先读取未来结果。原物本人沿真实路线搬运，停止探查不驱散未知污染。战斗成功只准备本轮下一次实际正贡献身体攻击或付费弧光攻击乘0.7的有限窗口；敌方真实假动作可先消耗窗口，回合结束也会失效，不退成本、不先行造成伤害、不改既有随机与历史。不赋予贤者2信息化、神话窥视、任意改命或全知。' },
];
export const PROPHECY_MASTER_CONSUMPTION_RISK = '以下具体规则均为本作G：神秘学家消化100，从原神秘学家晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周场地，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，神秘学家消化100与旧掌握保留，只新增hermit.s3.prophetic-glimpse一项0掌握；灵性上限120且当前不补满。窥秘人至神秘学家全部原瓶、原物、原血样与原敌生死保留，旧卷仍须实有且使用时真实消耗。原已公开故事105名知情者与15%效力不回收；不再索取另一滴神话血，不送命运之蛇血能力、新故事库、贤者2信息化或阻止高位灾难仪式。';
