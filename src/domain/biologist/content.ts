import { HARVESTPRIEST_GUIDE } from '../harvestpriest/content.js';
import type { BiologistAbilityId } from './types.js';
export { BIOLOGIST_CASE_IDS } from './types.js';

export const BIOLOGIST_GUIDE = HARVESTPRIEST_GUIDE;
export const BIOLOGIST_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const BIOLOGIST_MIN_HARVESTPRIEST_WEEKS = 12;
export const BIOLOGIST_LABOUR_STEPS = 5;
export const BIOLOGIST_BOTTLE_IDS = ['biologist-potion-1', 'biologist-potion-2', 'biologist-potion-3'] as const;
export const BIOLOGIST_SOURCE_STATUS = '原文中的序列6生物学家弗兰克需要长期研究和实际材料，尝试也会失败；他的惊人杂交成果与神战遗迹事故不是每位新晋序列6的通用能力模板。完整晋升配方尚未核实。本批仅用明确原创G的有限样本研究和有限对照实践表达研究、记录、复核与责任，不提供现实实验配方、病原或危险生物操作。耕种者三项、医师两项、丰收祭司两项及原ID完整继承；序列5德鲁伊的催化、动物变化和沼泽不下放。伊芙·莫兰、原封土壤样本、温室两株已知普通原苗、洛恩外院争议、独立成品供给与全部数值均为本作原创G。取得魔药不赋予教会或组织身份。';
export const BIOLOGIST_FORMULA_STATUS = '母亲途径序列6生物学家的完整晋升配方尚未核实；用药指导只说明本作原创G渠道实际供应的独立序列6成品原瓶，不解锁完整配方、原料采购或魔药制造，不编造材料。';
export const BIOLOGIST_POTION_SOURCES = BIOLOGIST_BOTTLE_IDS.map((id, index) => ({
  id, source: `${BIOLOGIST_GUIDE}经独立生物学家成品交接渠道实际取得的第${index + 1}瓶序列6生物学家成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非耕种者、医师或丰收祭司旧瓶改装，未声称掌握完整配方或在原苗圃温室调配。`,
}));
export const BIOLOGIST_LABOUR_TASKS = ['核对本瓶独立封签', '整理原温室普通记录柜', '核查原样本封签与苗木编号', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const BIOLOGIST_ABILITIES: { id: BiologistAbilityId; label: string; description: string }[] = [
  { id: 'mother.s6.specimen-study', label: '有限样本研究', description: '原创G：在已知来源的同一原封普通样本上辅助有限观察、记录可见差异与未知。不拆封、不生成材料，不全知鉴定、读出全部成分或保证可食性；成功报告仍只覆盖实际观察。' },
  { id: 'mother.s6.controlled-trial', label: '有限对照实践', description: '原创G：以同苗圃温室两株已知普通原苗进行有限幻想能力对照，实用原标记格1份原水、3灵性且允许失败；普通方法使用同一原水但0灵性。成功后须到下一真实周花1行动亲自复核，不瞬间造新品种、产量或可食性；明确警告后同一原苗当面交还伊芙。' },
];
export const BIOLOGIST_CONSUMPTION_RISK = '以下数值为原创G：本次选定原瓶服药必耗，0行动，意志难度24；丰收祭司消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊芙在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留丰收祭司消化与全部原掌握；成功只新增两项G有限研究能力，从0掌握开始，四属性各+1，灵性上限80但当前灵性不补满。和平100仍需真实行动、原水、可能的灵性和跨周复核，不构成一般无伤或无代价保证。';
