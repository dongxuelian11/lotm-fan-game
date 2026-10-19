import { NIGHTMARE_GUIDE } from '../nightmare/content.js';
import type { SootherAbilityId } from './types.js';
export { SOOTHER_CASE_IDS } from './types.js';

/** Verified Book 5 ch.48/38 boundaries. Stories, prices, costs and checks below are original G. */
export const SOOTHER_GUIDE = NIGHTMARE_GUIDE;
export const SOOTHER_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const SOOTHER_MIN_NIGHTMARE_WEEKS = 12;
export const SOOTHER_LABOUR_STEPS = 5;
export const SOOTHER_BOTTLE_IDS = ['soother-potion-1', 'soother-potion-2', 'soother-potion-3'] as const;
export const SOOTHER_SOURCE_STATUS = '第五部第48章《前奏》支持安魂师能直接看见灵体；第五部第38章《积极应对》出现安抚野狼鬼魂，使其躁动平静并消散的表现。安抚与净化有别，目标仍可抵抗；更强者使用安魂师层次能力也只能缓和强烈恐惧烙印，不能据此声称清除全部污染。继承不眠者、午夜诗人、梦魇全部原ID能力及掌握，维持梦境时施术者本体不能移动的限制继续保留。这里只新增近处灵体可见与有限安抚，不获得序列5灵巫封灵、放灵助攻或任意死亡真相。成年导师沿原值班室赛琳渠道；三个具体现场、成人角色、独立成品供给、周数、数值和可选空院冲突均为本作原创G。';
export const SOOTHER_FORMULA_STATUS = '安魂师完整配方尚未核实：不拼补主辅料、剂量或调配顺序。用药指导不解锁配方、材料采购或调配；目前仅能取得本作原创G渠道实际供应的序列6独立成品原瓶。';
export const SOOTHER_POTION_SOURCES = SOOTHER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SOOTHER_GUIDE}经独立安魂师成品交接渠道实际取得的第${index + 1}瓶序列6安魂师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非不眠者、午夜诗人或梦魇旧瓶改装，未声称掌握完整配方。`,
}));
export const SOOTHER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原值班室公开交接册', '清点原值班室普通遮光用品', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const SOOTHER_ABILITIES: { id: SootherAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s6.spirit-sight', label: '看见灵体', description: '可直接看见本次近处实际存在的灵体。看见不等于知道身份、死亡真相或全部污染，也不凭空生成可交谈的灵；本阶段只记录固定现场可见的有限回应。距离与判定为G。' },
  { id: 'darkness.s6.spirit-pacification', label: '有限安抚', description: '安抚眼前灵体的躁动，可以被抵抗；安抚不等于净化、毁灭或封存。强烈恐惧烙印可能只能缓和，不能单独消除，也不会清除角色排异或治疗伤势。没有序列5封灵、放灵助攻，具体成本与判定为G。' },
];
export const SOOTHER_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；梦魇消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师赛琳在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留梦魇消化及全部原掌握；成功只新增两项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
