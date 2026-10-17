import { WEATHER_WARLOCK_GUIDE } from '../weather-warlock/content.js';
import type { ConquerorAbilityId, ConquerorPreparationId } from './types.js';

/** Canon establishes Hunter S1 征服者. Its full formula, ritual and exact ability
 * mechanics have not been established here. All bounded abilities, scenes,
 * prices, preparation, distances, checks and rewards below are original game
 * design, not a claim about canonical S1 ritual. S0 continent-wide war is not
 * imported into this stage. Developer provenance stays out of player prose. */
export const CONQUEROR_GUIDE = WEATHER_WARLOCK_GUIDE;
export const CONQUEROR_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const CONQUEROR_MIN_WEATHER_WARLOCK_WEEKS = 12;
export const CONQUEROR_LABOUR_STEPS = 5;
export const CONQUEROR_BOTTLE_IDS = ['conqueror-potion-1', 'conqueror-potion-2', 'conqueror-potion-3'] as const;
export const CONQUEROR_FORMULA_STATUS = '原指导者介绍独立封存的征服者成品魔药。核对猎人至天气术士的八阶原瓶、既往报告与原队经历，检查阵势合力和焰势凝束的使用边界，亲自走查本次服药处的普通出口。三项准备分别完成后，另付费检查当周安静房间，最后独立确认饮用所选原瓶。';
export const CONQUEROR_SOURCE_STATUS = '原队伍继续保有各自的身体、意愿、旧伤和共同经历。新实践只邀请实际愿意、尚有精力的原成员；未到场的人不提供力量。阵势合力须在明确范围和短时限内共同出力，焰势凝束只作用于眼前原铁件。退出后须亲手收好原物，沿普通路线离场；旧药瓶、原敌人的伤亡与已消耗物件不会补回。';
export const CONQUEROR_POTION_SOURCES = CONQUEROR_BOTTLE_IDS.map((id, index) => ({ id,
  source: `${CONQUEROR_GUIDE}介绍的专业交接处初始批次第${index + 1}瓶序列1征服者成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const CONQUEROR_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const CONQUEROR_PREPARATIONS: { id: ConquerorPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对八阶原瓶与原队经历', description: '本人核读猎人至天气术士的八阶真实晋升、已耗原瓶、天气实践报告和原队共同经历。旧伤、成员意愿、人物生死、原物去向与已有掌握继续保留；原名单仍是同一批人。' },
  { id: 'CHECK_LIMITS', title: '检查合力与凝焰的使用边界', description: '核对阵势范围、时限和各人须亲自支付的精力，确认拒绝或离场不能被强行计作同意。核对凝焰的原铁件、净空通道和冷却步骤；停止不返还灵性或消除已经发生的热量与伤害。' },
  { id: 'MARK_EXIT', title: '走查普通出口与中止求助', description: '本人走完安静房的普通退路，核对求助位置和原封存箱，演练暂停与身份锚定。专业支持仅处理本次服药排异，不保护普通死亡；中止后未服原瓶保留，已付费用与行动不退。' },
];
export const CONQUEROR_ABILITIES: { id: ConquerorAbilityId; label: string; description: string }[] = [
  { id: 'hunter.s1.formation-momentum', label: '阵势合力', description: '在实际到场且自愿的原成员之间，短时协调同一次实体行动。本人支付灵性，各人支付精力；范围、时限和拒绝照常约束。只对正在发生的行动产生有限作用，不召唤、复制成员或共享无限力量，不改变已经结束的伤亡。' },
  { id: 'hunter.s1.focused-flame', label: '焰势凝束', description: '把本人有限火焰凝向当前可见的原目标，实付灵性并保留产生的热量、损坏和危险。原铁件须实际冷却、亲手归还；战斗仍由双方行动、共同胜负与伤势结算，不提供无条件命中或免伤。' },
];
export const CONQUEROR_CONSUMPTION_RISK = '天气术士消化100、实际晋升后12整周，三份天气生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧21项掌握与八阶消化保留，两项新掌握从0开始，共23项；灵性上限120，当前不补满。角色性别、年龄、旧伤、原成员状态、人物生死和原物去向不因晋升改变。';
export const CONQUEROR_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  ['hunter.s9.tracking', '追踪'], ['hunter.s9.trapcraft', '陷阱制作'], ['hunter.s9.physical-enhancement', '身体强化'], ['hunter.s9.hunting-instinct', '狩猎直觉'],
  ['hunter.s8.provocation', '挑衅'], ['hunter.s8.hostility-aura', '敌意气场'], ['hunter.s7.flame-control', '火焰控制'], ['hunter.s7.compressed-fireball', '压缩火球'], ['hunter.s7.flame-lance', '火焰长枪'], ['hunter.s7.fire-raven', '火鸦'],
  ['hunter.s6.reasoning-plan', '推理谋划'], ['hunter.s6.targeted-persuasion', '针对劝说'], ['hunter.s5.weakness-observation', '弱点观察'], ['hunter.s5.precision-strike', '精准打击'],
  ['hunter.s4.flame-steel', '钢铁火焰'], ['hunter.s4.comrade-link', '战友联系'], ['hunter.s3.formation-link', '阵势联系'], ['hunter.s3.coordinated-action', '协同行动'],
  ['hunter.s2.battle-fog', '有限战场迷雾'], ['hunter.s2.frost', '有限冰霜'], ['hunter.s2.storm', '有限风雨雷势'],
].map(([id, label]) => ({ id: id!, label: label!, description: '保留此项原有掌握和使用条件；原物、同伴、灵性与失败成本分别结算。晋升不会增加此项熟练度，也不改变过去的实际结果。' }));
