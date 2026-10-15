import { HUNTER_GUIDE } from '../hunter/content.js';
import type { ReaperAbilityId } from './types.js';
export { REAPER_CASE_IDS } from './types.js';

export const REAPER_GUIDE = HUNTER_GUIDE;
export const REAPER_PRICES = { guidance: 420, potion: 4600, labourCredit: 4000 } as const;
export const REAPER_MIN_CONSPIRATOR_WEEKS = 12;
export const REAPER_LABOUR_STEPS = 5;
export const REAPER_BOTTLE_IDS = ['reaper-potion-1', 'reaper-potion-2', 'reaper-potion-3'] as const;
export const REAPER_SOURCE_STATUS = '已核原文支持收割者观察弱点，并配合实际出现的窗口进行高伤攻击；命中与重创仍有条件，不是必中、必杀或固定穿透一切防护。猎人、挑衅者、纵火家与阴谋家的全部原ID能力及掌握保留；火焰能力来自既有纵火家阶段，只新增弱点观察与精准打击。没有序列4的火焰化、铁血军团或团队连接；不赋予丧钟物品的三枪、5秒限制或负面效果。原指导人索伦·里奇继续提供渠道，不凭晋升自动取得组织或官方身份。三项练习、成年教练伊沃、有限独立院冲突、成品供给、价格、成熟周数与全部数值均为本作原创G；工具、挡片和耐火靶均有明确原处与所有人，不变成玩家装备或奖励。';
export const REAPER_FORMULA_STATUS = '收割者完整配方与晋升仪式尚未核实，材料、用量、调配顺序及仪式要求均保持未知，不能据此断言无需仪式。指导不解锁配方、材料采购或调配；目前仅能取得本作原创G渠道实际供应的序列5独立成品原瓶，指导服药是本阶段G流程。';
export const REAPER_POTION_SOURCES = REAPER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${REAPER_GUIDE}从独立收割者成品交接渠道实际取得的第${index + 1}瓶序列5收割者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非猎人、挑衅者、纵火家或阴谋家旧瓶改装，未声称掌握完整配方或仪式。`,
}));
export const REAPER_LABOUR_TASKS = ['核验本瓶封存记录', '核对原练习场器材目录', '整理公开供货清单', '核查原瓶交接凭据', '完成本瓶供货记录复核'] as const;
export const REAPER_ABILITIES: { id: ReaperAbilityId; label: string; description: string }[] = [
  { id: 'hunter.s5.weakness-observation', label: '弱点观察', description: '观察眼前目标已有的结构与动作，寻找可验证的薄弱处。观察可失败，不能预知未知弱点或保证命中；具体窗口和成本为G。' },
  { id: 'hunter.s5.precision-strike', label: '精准打击', description: '配合已观察的弱点与实际出现的短暂窗口进行有限高伤打击；时机、命中与伤害均有条件，不是必中必杀，也不是丧钟物品规则。具体判定为G。' },
];
export const REAPER_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度26；服药前健康须高于20、精神须高于40，不足时先休养；阴谋家消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。索伦在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留阴谋家消化及全部原掌握；成功只新增两项0掌握，四属性各+1，灵性上限100但当前灵性不补满。';
