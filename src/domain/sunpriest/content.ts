import { BARD_GUIDE } from '../bard/content.js';
import type { SunpriestAbilityId } from './types.js';
export { SUNPRIEST_CASE_IDS } from './types.js';

/** All six quantities are verified. Array order is a G supplier manifest, not canonical mixing order. */
export const SUNPRIEST_FORMULA_SOURCE = '《诡秘之主》第三部第33章（原著核验定位L93861）已核太阳神官完整六项配方与数量；确切投料顺序未核定。此处材料排列及导师调配操作规程、供货、劳动、价格、成熟周数、四组掌握、判定与属性数值均为本作玩法改编G，不声称原著规定此排列为调配顺序。';
export const SUNPRIEST_GUIDE = BARD_GUIDE;
export const SUNPRIEST_PRICES = { formula: 240, mainMaterials: 1800, auxiliaryMaterials: 150, brewing: 60 } as const;
export const SUNPRIEST_BATCH_IDS = ['sunpriest-batch-1', 'sunpriest-batch-2', 'sunpriest-batch-3'] as const;
export const SUNPRIEST_MIN_LIGHTPRAYER_WEEKS = 8;
export const SUNPRIEST_LABOUR_STEPS = 4;
export const SUNPRIEST_LABOUR_TASKS = ['抄录六料清单', '核对原料封签', '整理导师调配规程', '清理调配场地'] as const;
export const SUNPRIEST_FORMULA = [
  { id: 'dawn-rooster-red-comb', name: '黎明雄鸡红冠', quantity: 1, unit: '朵' },
  { id: 'radiant-spirit-tree-fruit', name: '光辉契灵树果实', quantity: 1, unit: '枚' },
  { id: 'dawn-rooster-blood', name: '黎明雄鸡血', quantity: 100, unit: 'mL' },
  { id: 'sun-essential-oil', name: '太阳精油', quantity: 10, unit: '滴' },
  { id: 'golden-finger-citron-powder', name: '金手柑粉末', quantity: 8, unit: 'g' },
  { id: 'solidified-lava', name: '凝固熔浆', quantity: 5, unit: 'g' },
] as const;
export const SUNPRIEST_SOURCE_STATUS = '序列7太阳神官的原著能力包括光与火、恐惧免疫、神圣誓约、净化斩、太阳光环、神圣之光和制造圣水。本作将它们组合成四组掌握以便操作；分组、场景范围和灵性数值是玩法G。恐惧免疫不消除伤势或危险，有限圣水不保证清除所有高位污染。本阶段不提供序列6公证人的公证、复活或万能净化，也不建立教会组织身份。';
export const SUNPRIEST_ABILITIES: { id: SunpriestAbilityId; label: string; description: string }[] = [
  { id: 'sun.s7.holy-light', label: '神圣之光', description: '将太阳神官的光与火、净化斩、神圣之光组合为本作G掌握组。只能面对已确认的真实对象，在当前场景范围内造成有限作用；不保证命中，不穿透所有遮蔽，也不保证清除高位污染。' },
  { id: 'sun.s7.sacred-oath', label: '神圣誓约', description: '以神圣誓约支持明确自愿的有限行动，配合太阳神官的恐惧免疫；恐惧免疫不等于免伤或无视危险。不能强迫别人宣誓、扫描善恶、改写记忆或代替序列6公证。具体支持强度与掌握分组为玩法G。' },
  { id: 'sun.s7.sun-aura', label: '太阳光环', description: '对场景内已确认的对象施加有限太阳光环；具体范围、作用与消耗为玩法G。不能凭空获知异常来源、审判普通人的善恶或覆盖全城，不能承诺对所有高位污染有效。' },
  { id: 'sun.s7.holy-water', label: '制造圣水', description: '在真实清水、容器和准备条件满足后制造有限圣水，逐份记录制备、持有和使用；圣水不能凭空补给，也不保证清除所有高位污染，不能治愈一切伤病或复活。数量与具体场景效果为玩法G。' },
];
export const SUNPRIEST_CONSUMPTION_RISK = '本段数值为本作玩法改编G：服药必定消耗所选太阳神官原瓶，0行动，意志难度18；祈光人扮演须达100且祈光人晋升后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
