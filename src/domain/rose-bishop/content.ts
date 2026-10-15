import { SHADOW_ASCETIC_GUIDE } from '../shadow-ascetic/content.js';
import type { RoseBishopAbilityId } from './types.js';
export { ROSE_BISHOP_CASE_IDS } from './types.js';

export const ROSE_BISHOP_GUIDE = SHADOW_ASCETIC_GUIDE;
export const ROSE_BISHOP_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const ROSE_BISHOP_RATION_PRICE = 40;
export const ROSE_BISHOP_MIN_SHADOW_ASCETIC_WEEKS = 12;
export const ROSE_BISHOP_LABOUR_STEPS = 5;
export const ROSE_BISHOP_BOTTLE_IDS = ['rose-bishop-potion-1', 'rose-bishop-potion-2', 'rose-bishop-potion-3'] as const;
export const ROSE_BISHOP_SOURCE_STATUS = '第二部第36章支持蔷薇主教血肉魔法与藏入宿主身体，但融合后脱离会杀死宿主；本阶段不实现进入活人。第三部第165章支持有足够血肉供给时维持能力，也明确鱼等非人血肉可用，不要求食人或自伤。第三部第175、179章支持血肉重塑及作为隔离容器，但不能据此安全消化任意污染。第四部第49章的恢复有道具等条件，不能视为无条件复活或瞬间治好一切。当前只新增血肉塑形与有限自体修复两项掌握。原三阶能力及原ID完整继承；没有序列5牧羊人放牧、窃取灵魂或他途径能力。伊森、动物来源封装份额、具体身体练习、供给、人物与全部数值均为本作原创G。';
export const ROSE_BISHOP_FORMULA_STATUS = '蔷薇主教完整晋升配方尚未核实；用药指导只说明本作原创G渠道实际供应的独立序列6成品原瓶，不解锁配方、晋升原料采购或魔药制造。另购动物来源封装份额只用于G血肉储备，不是魔药原料。';
export const ROSE_BISHOP_POTION_SOURCES = ROSE_BISHOP_BOTTLE_IDS.map((id, index) => ({
  id, source: `${ROSE_BISHOP_GUIDE}经独立蔷薇主教成品交接渠道实际取得的第${index + 1}瓶序列6蔷薇主教成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非秘祈人、倾听者或隐修士旧瓶改装，未声称掌握完整配方。`,
}));
export const ROSE_BISHOP_LABOUR_TASKS = ['核对本瓶独立封签', '整理原旧物间普通存放格', '清点原练习台普通器具', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const ROSE_BISHOP_ABILITIES: { id: RoseBishopAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s6.flesh-shaping', label: '血肉塑形', description: '以实际血肉储备和灵性作有限自体血肉调整，只有眼前真实目标和接触范围；不改变骨骼、不进入活人、不任意穿墙。练习后必须实际恢复本人正常形态，失败照耗。' },
  { id: 'hanged-man.s6.self-renewal', label: '有限自体修复', description: '仅在本人仍活着、有真实储备且满足本次条件时尝试有限自体恢复；失败照耗，不复活、不瞬间治好一切、不修复他人，也不清除任意污染。补充动物来源份额只增加储备，不直接治疗。具体消耗与效果为本作G。' },
];
export const ROSE_BISHOP_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；隐修士消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊森在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗与其它危险。失败保留隐修士消化与全部原掌握；成功只新增血肉塑形与有限自体修复0掌握，四属性各+1，灵性上限80但当前灵性不补满，不赠血肉储备。';
