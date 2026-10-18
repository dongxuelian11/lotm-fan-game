import { INTERROGATOR_GUIDE } from '../interrogator/content.js';
import type { JudgeAbilityId } from './types.js';
export { JUDGE_CASE_IDS } from './types.js';

export const JUDGE_GUIDE = INTERROGATOR_GUIDE;
export const JUDGE_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const JUDGE_MIN_INTERROGATOR_WEEKS = 12;
export const JUDGE_LABOUR_STEPS = 5;
export const JUDGE_BOTTLE_IDS = ['judge-potion-1', 'judge-potion-2', 'judge-potion-3'] as const;
export const JUDGE_SOURCE_STATUS = '第五部第160章支持法官权威是序列9威严的质变，不是保证真话、读取心灵或强制所有人服从。第六部第42与46章支持范围内禁止传送能短暂阻碍高阶者，但对方调整后可以脱离；禁令不是万能、永久封能力或不可抵抗的世界法。当前只新增质变权威和有限禁止两项掌握，仲裁人三项、治安官两项、审讯者两项及原ID完整继承。序列5惩戒骑士的额外惩罚、囚禁和死亡打击不下放。导师薇娜·贝尔、成年自愿者莉达与瑟恩、已有听众、原划线区、同一原木牌、埃文外院争议、独立成品供给与全部数值均为本作原创G；本作的限定区域、短效结束、同时一项禁令、玩家与本人同样受限不是已核原著统一半径、时长、数量或必然同约束。取得魔药不赋予官方身份或组织归属。';
export const JUDGE_FORMULA_STATUS = '审判者途径序列6法官的完整晋升配方尚未核实；用药指导只说明本作原创G渠道实际供应的独立序列6成品原瓶，不解锁完整配方、原料采购或魔药制造，不编造材料。';
export const JUDGE_POTION_SOURCES = JUDGE_BOTTLE_IDS.map((id, index) => ({
  id, source: `${JUDGE_GUIDE}经独立法官成品交接渠道实际取得的第${index + 1}瓶序列6法官成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非仲裁人、治安官或审讯者旧瓶改装，未声称掌握完整配方或在调解处调配。`,
}));
export const JUDGE_LABOUR_TASKS = ['核对本瓶独立封签', '整理原调解处普通存放格', '清点原台与编号木牌', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const JUDGE_ABILITIES: { id: JudgeAbilityId; label: string; description: string }[] = [
  { id: 'justiciar.s6.authority', label: '质变权威', description: '法官权威是低序列威严的质变，可有限影响真实在场者的注意与行动，仍能遭到抵抗。本次和平实践只有已经自愿在场的听众，不制造听众，不保证真话、秘密披露或永久服从。' },
  { id: 'justiciar.s6.prohibition', label: '有限禁止', description: '在当前已明确的原区域内短暂禁止一种明确动作，可以被抵抗或调整行动脱离，不万能或永久封能力。本批G实践限定为原划线区内不越过原线、同一原木牌不携出原台域；玩家与本人分别真实试动作，双方同样受该条G约束。结束必须停止并等候短效消退，原物亲手放回，不瞬移、不复制，不附带序列5惩罚。' },
];
export const JUDGE_CONSUMPTION_RISK = '以下数值为原创G：本次选定原瓶服药必耗，0行动，意志难度24；审讯者消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。薇娜在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留审讯者消化与全部原掌握；成功只新增质变权威与有限禁止两项，从0掌握开始，四属性各+1，灵性上限80但当前灵性不补满。当前有限G实践及和平100都有真实时间与资源代价，不构成一般无伤或无代价消化保证。';
