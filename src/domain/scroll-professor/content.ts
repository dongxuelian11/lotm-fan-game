import { WIZARD_GUIDE } from '../wizard/content.js';
import type { WizardSpellId } from '../wizard/types.js';
import type { ScrollProfessorAbilityId, ScrollProfessorScrollKind } from './types.js';
export { SCROLL_PROFESSOR_CASE_IDS } from './types.js';

export const SCROLL_PROFESSOR_GUIDE = WIZARD_GUIDE;
export const SCROLL_PROFESSOR_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const SCROLL_PROFESSOR_KIT_PRICE = 100;
export const SCROLL_PROFESSOR_MIN_WIZARD_WEEKS = 12;
export const SCROLL_PROFESSOR_LABOUR_STEPS = 5;
export const SCROLL_PROFESSOR_BOTTLE_IDS = ['scroll-professor-potion-1', 'scroll-professor-potion-2', 'scroll-professor-potion-3'] as const;
export const SCROLL_PROFESSOR_SOURCE_STATUS = '第二部第4章核实隐者途径序列6卷轴教授的名称；第二部第238章支持灵性材料的实际使用；第三部第171、175章支持事先制作、持有实体卷轴并一次消耗，使用仍可能失败。以上不构成完整晋升配方或原著材料数量。当前只新增卷轴制造一项掌握，将本人此前实际学会的巫师G有限牵引或短时护持分别写入实体冲力或护持卷轴，不因晋升自动学会术式。伊蕾、供给渠道、材料包、两个低阶模板、课堂、成年人、价格、时长、消耗、判定及战斗数值全部为本作原创G。继承窥秘人、格斗学者与巫师原ID和掌握；不开放序列5星象或序列4神秘再现，不制造无限法术。';
export const SCROLL_PROFESSOR_FORMULA_STATUS = '卷轴教授完整晋升配方尚未核实；用药指导只说明本作原创G渠道实际供应的独立序列6成品原瓶，不解锁晋升配方、原料采购或魔药制造。卷轴材料是单独购买的原创G教学用品，不是晋升魔药配方。';
export const SCROLL_PROFESSOR_POTION_SOURCES = SCROLL_PROFESSOR_BOTTLE_IDS.map((id, index) => ({
  id, source: `${SCROLL_PROFESSOR_GUIDE}经独立卷轴教授成品交接渠道实际取得的第${index + 1}瓶序列6卷轴教授成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非窥秘人、格斗学者或巫师旧瓶改装，未声称掌握完整配方。`,
}));
export const SCROLL_PROFESSOR_LABOUR_TASKS = ['核对本瓶独立封签', '整理原教学室普通存放格', '清点原制卷台普通器具', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const SCROLL_PROFESSOR_ABILITIES: { id: ScrollProfessorAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s6.scrollcraft', label: '卷轴制造', description: '用真实持有的G灵性材料预先写入本人已学的有限低阶术式。每次制造失败也耗材料；成功才有独立卷轴，制造时固定本人序列、卷轴掌握与材料来源。卷轴可跨周携带，一次使用后实物耗尽；只在主动授权后供匹配战斗槽自动用一次，使用仍可失败，不自动教会未学法术。' },
];
export const SCROLL_PROFESSOR_SCROLLS: Record<ScrollProfessorScrollKind, { title: string; spellId: WizardSpellId; effect: string }> = {
  IMPACT: { title: 'G有限冲力卷轴', spellId: 'light-touch', effect: '封存本人已学有限牵引的低阶G冲力模板；不搬运人物，不遥取任意物品。' },
  WARD: { title: 'G短时护持卷轴', spellId: 'brief-ward', effect: '封存本人已学短时护持的低阶G模板；只提供有限防护，不无敌，不治疗，不跳过对手行动。' },
};
export const SCROLL_PROFESSOR_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；巫师消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊蕾在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗与其它危险。失败保留巫师消化与全部原掌握；成功只新增卷轴制造0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
