import { BRIBER_GUIDE } from '../briber/content.js';
import type { CorruptionBaronAbilityId } from './types.js';
export { CORRUPTION_BARON_CASE_IDS } from './types.js';

export const CORRUPTION_BARON_GUIDE = BRIBER_GUIDE;
export const CORRUPTION_BARON_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const CORRUPTION_BARON_MIN_BRIBER_WEEKS = 12;
export const CORRUPTION_BARON_LABOUR_STEPS = 5;
export const CORRUPTION_BARON_BOTTLE_IDS = ['corruption-baron-potion-1', 'corruption-baron-potion-2', 'corruption-baron-potion-3'] as const;
export const CORRUPTION_BARON_SOURCE_STATUS = '序列6腐化男爵的扭曲作用于既有语言、行动或意图，产生短暂且可抵抗的有限偏转；不是凭空创造事实、永久支配人格、任意改写合同或瞬间转移物件。当前只新增扭曲一项掌握，律师三项、野蛮人两项和贿赂者一项能力及原ID完整继承。继承贿赂削弱仍须实际给予东西，不要求目标自愿接住或饮用才生效；实际已给物的去向不回滚。序列5混乱和序列4正式放大、利用均未下放。原契约铺的米蕾·沃德、核册员伊芙、成年递送员赛恩、原排队安排、封闭托盘中的原木球、限定路线、沃恩的外院争执、独立成品供给及所有数值均为本作原创G。三项有限实践不改变组织归属，不保证所有对象接受影响。';
export const CORRUPTION_BARON_FORMULA_STATUS = '黑皇帝途径序列6腐化男爵的完整晋升配方尚未核实；用药指导只说明本作原创G渠道实际供应的独立序列6成品原瓶，不解锁完整配方、原料采购或魔药制造，不编造材料。';
export const CORRUPTION_BARON_POTION_SOURCES = CORRUPTION_BARON_BOTTLE_IDS.map((id, index) => ({
  id, source: `${CORRUPTION_BARON_GUIDE}经独立腐化男爵成品交接渠道实际取得的第${index + 1}瓶序列6腐化男爵成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非律师、野蛮人或贿赂者旧瓶改装，未声称掌握完整配方或在契约铺调配。`,
}));
export const CORRUPTION_BARON_LABOUR_TASKS = ['核对本瓶独立封签', '整理原契约铺普通存放格', '清点原托盘与编号木球', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const CORRUPTION_BARON_ABILITIES: { id: CorruptionBaronAbilityId; label: string; description: string }[] = [
  { id: 'black-emperor.s6.distortion', label: '有限扭曲', description: '有限偏转正在使用的语言安排、实际运动或已有行动意图，短暂且可抵抗。当前G实践只暂调原核册次序、让已经滚动的原木球沿连续轨迹进入原侧袋、或短时偏转成年自愿者在约定区域内的已有路线；结束须恢复原安排、实际收停原物或停止并等候短效结束。不凭空造动作、瞬移、永久控制、扩大原效果或提前获得混乱。' },
];
export const CORRUPTION_BARON_CONSUMPTION_RISK = '以下数值为原创G：本次选定原瓶服药必耗，0行动，意志难度24；贿赂者消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。米蕾在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留贿赂者消化与全部原掌握；成功只新增扭曲一项，从0掌握开始，四属性各+1，灵性上限80但当前灵性不补满。当前有限G实践及和平100都有真实时间与资源代价，不构成一般无伤或无代价消化保证。';
