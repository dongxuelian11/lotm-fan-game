import type { WandererAbilityId, WandererPreparationId } from './types.js';

/** Names and the offworld direction are verified; this finite route, support and every quantity are original G. */
export const WANDERER_GUIDE = '52岁导师赫斯特·沃尔（WN3-HESTER，独立原创G人物）';
export const WANDERER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const WANDERER_MIN_SECRETS_SORCERER_WEEKS = 12;
export const WANDERER_LABOUR_STEPS = 5;
export const WANDERER_BOTTLE_IDS = ['wanderer-potion-1', 'wanderer-potion-2', 'wanderer-potion-3'] as const;
export const WANDERER_FORMULA_STATUS = '门途径序列3漫游者名称与本体离开灵界限制的漫游方向已原核，完整配方与晋升仪式尚未核实。材料、用量、调配顺序及完整仪式保持未知，不能断言无需仪式。本阶段只采用本作原创G独立成品渠道与专业指导；三项准备和当次场地检查均为G支持流程，不冒充原著仪式，不复用秘法师4的旧敌意半神封印仪式，不开放自制配方。';
export const WANDERER_SOURCE_STATUS = '第五部第130章明确序列3漫游者、序列2旅法师、序列1星之匙；第七部第68章在危险劝诱语境中给出漫游者可脱离灵界限制，进入星空、星界和异星的方向。第六部第58章提示天使以下面临星空污染危险，不能把能力理解为真空免疫或保证安全。序列3完整配方、仪式、存活、携带、导航、返回、距离和灵性消耗未核。以下指定原端点、防护、供给、回程条件与所有定量均为原创G；星界定位是辅助核对已确认有限端点的原创G技巧，不是全知导航、占星或凭空获得宇宙知识。序列2的三类虫与九处外星传说仪式、序列2象征化及序列0概念化均不下放到3。';
export const WANDERER_POTION_SOURCES = WANDERER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WANDERER_GUIDE}介绍的独立漫游者成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非秘法师或更早原瓶改装。完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const WANDERER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const WANDERER_PREPARATIONS: { id: WandererPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_DESTINATION', title: '亲自核读有限目的地与原记录', description: '在独立指导场核读已记录的指定停泊舱与本地原锚点，区分实际原记录、当前信号与未知星空。只提供这次有限端点的G知识，不发放任意坐标菜单，不提前完成后来现场的许可或信号核验。' },
  { id: 'CHECK_PROTECTION', title: '实际复核防护与污染边界', description: '本人核对有限护具的使用边界并了解星空污染危险；职业能力不等于真空免疫、无限呼吸或友方免疫。这项准备不提前借出原护具、不替现场检查、不填充任何资源，也不治疗原伤势。' },
  { id: 'PLAN_RETURN', title: '实际核对回程预算与停止次序', description: '本人核对指定原锚、出返所需的两份原供给与灵性保留条件，并沿指导场普通出口实际检查返回。能力失误、原物耗尽和死亡均有真实后果；后来每案须独立许可，普通退出不会把远处身体传回。' },
];
export const WANDERER_ABILITIES: { id: WandererAbilityId; label: string; description: string }[] = [
  { id: 'door.s3.star-wandering', label: '星空漫游（有限往返G）', description: '本体可脱离灵界限制的方向已原核，具体实现为原创G有限往返。只在当前原信号、原锚、借出的同一护具和两片原供给均核实后单独确认出发；出程8灵性、1片、知识20，失败仍扣成本且留本地，精神−5、污染+2。成功同一身体经10秒转移到指定原停泊舱；原回程标记核实后8灵性与剩余1片、10秒回本地。护具仅90秒，不保证任意绝境返回，不提供无限生存。战斗只作本地1米侧避再回1米，不是星际打击。' },
  { id: 'door.s3.astral-positioning', label: '星界定位（本作G）', description: '本作原创G技巧：6灵性、知识18，只辅助更快核对已经读取的原坐标册、原航标刻号或同次真实出返记录。失败可实际花时间手工逐项复核，不重骰，不产生未知地址、天空知识、预言或全知导航。战斗只辅助本人有限定位，不凭定位直接伤害原敌人。' },
];
export const WANDERER_CONSUMPTION_RISK = '以下全部具体规则为本作G：秘法师消化100、从秘法师实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与140便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1、秘法师消化100和全部旧掌握保留，两项新能力掌握0；灵性上限仍120且当前不补满，身体性别不改变。旧学徒至秘法师的原瓶、真实记录库、原门、口袋原物、封印原活体及原框、原伤势和旧代价全部保留，不赠记录或口袋物品，不复活旧死亡档，也不把旧4仪式当成3仪式。';
