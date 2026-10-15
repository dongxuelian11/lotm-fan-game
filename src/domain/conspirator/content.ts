import { HUNTER_GUIDE } from '../hunter/content.js';
import type { ConspiratorAbilityId } from './types.js';
export { CONSPIRATOR_CASE_IDS } from './types.js';

/** Verified S6 boundaries are kept separate from the original G mentor, supplies, cases and numbers. */
export const CONSPIRATOR_GUIDE = HUNTER_GUIDE;
export const CONSPIRATOR_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const CONSPIRATOR_MIN_PYROMANIAC_WEEKS = 12;
export const CONSPIRATOR_LABOUR_STEPS = 5;
export const CONSPIRATOR_BOTTLE_IDS = ['conspirator-potion-1', 'conspirator-potion-2', 'conspirator-potion-3'] as const;
export const CONSPIRATOR_SOURCE_STATUS = '已核原文支持阴谋家组织说辞与说服能力的增强，以及依据信息进行推理和安排；有情报的推理仍可能失败。说服须面对对象的真实利益和已核事实，不自动使人降智、洗脑、读心或必然同意。猎人、挑衅者与纵火家的全部原ID能力及掌握保留；火焰能力来自已获得的纵火家阶段。本阶段只新增有据谋划与针对性说服，不下放序列5收割者的弱点收割或固定穿防。原指导人索伦·里奇继续提供渠道，不凭晋升自动取得组织或官方身份。三项货栈事务、成年人物、有限后门冲突、成品供给、价格、成熟周数与全部数值均为本作原创G，不是原著必然效果，不提供现实犯罪教程。';
export const CONSPIRATOR_FORMULA_STATUS = '阴谋家完整配方尚未核实，材料、用量和调配顺序均保持未知。指导不解锁配方、材料采购或调配；目前仅能取得本作原创G渠道实际供应的序列6独立成品原瓶。';
export const CONSPIRATOR_POTION_SOURCES = CONSPIRATOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CONSPIRATOR_GUIDE}从独立阴谋家成品交接渠道实际取得的第${index + 1}瓶序列6阴谋家成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非猎人、挑衅者或纵火家旧瓶改装，未声称掌握完整配方。`,
}));
export const CONSPIRATOR_LABOUR_TASKS = ['核验本瓶封存记录', '整理原货栈公开班表', '校对公开收货目录', '核查原瓶交接凭据', '完成本瓶供货清单复核'] as const;
export const CONSPIRATOR_ABILITIES: { id: ConspiratorAbilityId; label: string; description: string }[] = [
  { id: 'hunter.s6.reasoning-plan', label: '有据谋划', description: '整理已有情报，寻找矛盾与可行备用方案。推理仍会失败，必须由现场核对支持；不是预知、读取未知秘密或自动发现弱点。具体判定为G。' },
  { id: 'hunter.s6.targeted-persuasion', label: '针对性说服', description: '依据已核事实及对象公开表达的真实利益组织说辞。对方可以拒绝，重试需要实际新事实与修订；不降低对方智慧、不洗脑、不保证让步。具体判定为G。' },
];
export const CONSPIRATOR_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；纵火家消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。索伦在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留纵火家消化及全部原掌握；成功只新增两项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
