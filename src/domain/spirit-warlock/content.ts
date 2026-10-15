import { SOOTHER_GUIDE } from '../soother/content.js';
import type { SpiritWarlockAbilityId } from './types.js';
export { SPIRIT_WARLOCK_CASE_IDS } from './types.js';

/** Canonical capability boundaries; all concrete scenes, people, prices and checks are original G. */
export const SPIRIT_WARLOCK_GUIDE = SOOTHER_GUIDE;
export const SPIRIT_WARLOCK_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const SPIRIT_WARLOCK_MIN_SOOTHER_WEEKS = 12;
export const SPIRIT_WARLOCK_LABOUR_STEPS = 5;
export const SPIRIT_WARLOCK_BOTTLE_IDS = ['spirit-warlock-potion-1', 'spirit-warlock-potion-2', 'spirit-warlock-potion-3'] as const;
export const SPIRIT_WARLOCK_SOURCE_STATUS = '黑暗途径序列5灵巫能够让身体成为灵的休憩与封存之地，牙齿是已有依据的媒介；实际取得并驱使的灵可在施术者维持梦魇时协助。灵的帮助取决于独立取得的具体灵，晋升不附赠灵体库，也不默认获得飞行、土行或任意灵能力。本作只设一只原安静庭院老榆树旁实际存在的小自然灵卷叶（SW5-LEAF-1）；观察、介绍、邀请及其同意必须分别实际发生，成功后以一颗牙齿为G休憩媒介。没有死神途径序列5体内冥界，也不提前获得黑暗途径序列4厄运。继承不眠者、午夜诗人、梦魇和安魂师全部原ID与原掌握，维持梦境时本体不能移动的限制继续生效。原成年导师赛琳、成年值班员梅森、原庭院、原纸条SW5-NOTE-1、三项有限实践与可选原空院冲突，以及价格、供给、成熟周数、成本和判定均为原创G。';
export const SPIRIT_WARLOCK_FORMULA_STATUS = '灵巫完整配方与晋升仪式尚未核实，材料、用量、调配顺序及仪式细节保持未知，不能据此断言无需仪式。赛琳提供的准备指导与本次指导服药是本作原创G流程，不解锁配方、材料采购或调配；当前仅能取得原创G渠道实际供应的序列5独立成品原瓶。';
export const SPIRIT_WARLOCK_POTION_SOURCES = SPIRIT_WARLOCK_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SPIRIT_WARLOCK_GUIDE}经独立灵巫成品交接渠道实际取得的第${index + 1}瓶序列5灵巫成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非不眠者、午夜诗人、梦魇或安魂师旧瓶改装，未声称掌握完整配方或仪式。`,
}));
export const SPIRIT_WARLOCK_LABOUR_TASKS = ['核对本瓶独立封签', '整理原值班室公开交接册', '清点原值班室普通封存器具', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const SPIRIT_WARLOCK_ABILITIES: { id: SpiritWarlockAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s5.spirit-shelter', label: '灵体休憩与封存', description: '身体可作为已独立取得之灵的休憩与封存之地，牙齿为已有依据的媒介。本阶段仅邀请同一只实际自然灵卷叶，自愿同意后才以一颗牙齿休憩；失败不造灵，解除后仍回原庭院。具体邀请、成本与媒介安排为G，晋升不附赠任何灵。' },
  { id: 'darkness.s5.spirit-assistance', label: '实际灵体协助', description: '放出已取得并封存的同一只卷叶作有限叶动回应或搬运同一张原纸条，实际消耗灵性。卷叶不提供飞行、土行、真相读取或新物品；能力由实际灵的范围决定，不能调用未取得的灵。具体实践为G。' },
  { id: 'darkness.s5.spirit-coordination', label: '梦魇与灵配合', description: '继承梦魇时由实际放出的灵协助，施术者本体仍须不动。本阶段仅在成年梅森本次同意的短暂休息中维持有限梦境，并让附近卷叶作约定叶动信号；必须实际结束梦境并唤醒本人，不穿越身体、不凭信号判真相。具体场景与判定为G。' },
];
export const SPIRIT_WARLOCK_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度26；服药前健康须高于20、精神须高于40，不足时先休养；安魂师消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师赛琳在场处理本次指导服药排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留安魂师消化及全部原掌握；成功只新增三项0掌握，四属性各+1，灵性上限100但当前灵性不补满。晋升不自动取得卷叶或其它灵。';
