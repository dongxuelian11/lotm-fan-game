import { APPRAISER_GUIDE } from '../appraiser/content.js';
import type { ArtisanAbilityId } from './types.js';
export { ARTISAN_CASE_IDS } from './types.js';

/** Canon: Book 2 ch.4; Book 3 ch.133/150. Specific lamp, supplies and numerical rules are original G. */
export const ARTISAN_GUIDE = APPRAISER_GUIDE;
export const ARTISAN_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const ARTISAN_KIT_PRICE = 100;
export const ARTISAN_MIN_APPRAISER_WEEKS = 12;
export const ARTISAN_LABOUR_STEPS = 5;
export const ARTISAN_BOTTLE_IDS = ['artisan-potion-1', 'artisan-potion-2', 'artisan-potion-3'] as const;
export const ARTISAN_SOURCE_STATUS = '第二部第4章支持序列6工匠制作机械奇物、较弱非凡器物及仪式增强；序列5星术师／天文学家才获得新的本体实战手段。第三部第133章的银牌制作仍会多次失败，也不能完全复现原效果；第三部第150章的召唤口琴依赖详细已知仪式和灵性材料。因此制作必须有已知方案、实际材料与原工房工具，不能复制任意高阶能力、清除污染或让普通废铁无中生出魔力。保留通识者、考古学家和鉴定师全部原ID与掌握。导师沿原工坊导师埃德温·沃德渠道；本作低强微光灯片、图纸、铜壳、教学灵性材料、次数、价格、工序、失败判定及成年角色均为原创G，不冒充原著配方或材料。';
export const ARTISAN_FORMULA_STATUS = '工匠完整魔药配方尚未核实；用药指导不解锁配方、采购配方材料或调配。当前只能取得本作原创G渠道实际供应的序列6独立成品原瓶。灯片教学图纸不是工匠魔药配方。';
export const ARTISAN_POTION_SOURCES = ARTISAN_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ARTISAN_GUIDE}经独立工匠成品联络渠道实际取得的第${index + 1}瓶序列6工匠成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非通识者、考古学家或鉴定师旧瓶改装，未声称掌握完整配方。`,
}));
export const ARTISAN_LABOUR_TASKS = ['核对本瓶独立封签', '整理原工房普通工具', '清点原工作台夹具', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const ARTISAN_ABILITIES: { id: ArtisanAbilityId; label: string; description: string }[] = [
  { id: 'paragon.s6.mechanical-craft', label: '机械奇物制作', description: '依据实际学过的图纸，使用原工具和真实材料制作机械奇物。知识、结构和工序仍须核对；不凭空出现机械、装备或材料。具体教学工艺为G。' },
  { id: 'paragon.s6.spiritual-craft', label: '较弱非凡器物制作', description: '将符合已知方案的真实灵性材料制作成有限非凡器物；成品效果由材料和方案限定，失败会实际耗料。不能复制任意高阶效果或把普通废铁凭空赋能。具体灯片为G。' },
  { id: 'paragon.s6.ritual-fixation', label: '有限仪式固化', description: '仪式能力增强，只能根据详细已知资料和合适材料进行有限固化，不保证完全复现。此次仅固定已学微光图纸的低强照明，不能召唤未知对象、驱邪、清污或使用序列5本体星术。' },
];
export const ARTISAN_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；鉴定师消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年工坊导师在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留鉴定师消化及全部原掌握；成功只新增三项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
