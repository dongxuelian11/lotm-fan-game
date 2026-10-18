import type { PhysicianAbilityId } from './types.js';
export { PHYSICIAN_CASE_IDS } from './types.js';

/** Verified chapter boundaries only; the guide, supply, limited care and all numbers are original G. */
export const PHYSICIAN_GUIDE = '苗圃照料员伊芙·莫兰';
export const PHYSICIAN_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050, kit: 45 } as const;
export const PHYSICIAN_MIN_CULTIVATOR_WEEKS = 4;
export const PHYSICIAN_BOTTLE_IDS = ['physician-potion-1', 'physician-potion-2', 'physician-potion-3'] as const;
export const PHYSICIAN_SOURCE_STATUS = '《诡秘之主》第三部第225章核实序列8医师及旧称“治疗牧师”；第三部第226章回忆医师时期曾让船上植物生长，不将这段表现改写成完整治疗能力表。第二部第94章中的医师未能解决神父混杂失控的问题，仍需巨龙相关神奇物品帮助；不把这段结果解释为治疗能消除失控或污染。医师的精确序列8治疗能力表与完整配方尚未核实。有限治疗、病况观察、轻微伤口照料、未知疲乏记录与危险耳语转介均为本作原创G的有限幻想照料，不是现实诊断、治疗或处方。三项耕种者能力与原ID掌握完整继承；不下放序列7丰收祭司、序列6生物学家的能力，不复活、不治愈污染、不保证治疗失控。伊芙·莫兰是已认识的本作原创成年苗圃照料员；独立进阶成品原瓶、劳务、价格、实际敷料库存及全部数值均为本作原创G，不自动建立大地母神教会或其它组织身份。';
export const PHYSICIAN_POTION_SOURCES = PHYSICIAN_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PHYSICIAN_GUIDE}从独立进阶成品渠道实际取得的第${index + 1}瓶序列8医师成品魔药，独立封存原瓶${id}；照料员与供给均为本作原创G，不是耕种者旧瓶改装，也未声称在小苗圃配制。取得此瓶不建立大地母神教会或其它组织身份。`,
}));
export const PHYSICIAN_FORMULA_STATUS = '医师完整配方尚未核实，全部材料名称、主辅分类、数量与投料顺序均不作为已知内容，配方列表保持空且未知；不补造任何原料。当前只开放本作原创G的独立成品原瓶；用药指导不解锁配方学习、魔药材料采购或调配。45便士购买的3份普通敷料仅为有限照料物资，不是魔药配方或原料。';
export const PHYSICIAN_LABOUR_TASKS = ['核验医师原瓶封记', '整理进阶成品交接记录', '复核小苗圃实收清单'] as const;
export const PHYSICIAN_ABILITIES: { id: PhysicianAbilityId; label: string; description: string }[] = [
  { id: 'mother.s8.limited-healing', label: '有限治疗（G）', description: '本作原创G的有限幻想照料：只对本次明确的轻微伤口支付3灵性后进行普通判定，成功改善该成年人物的本次伤口；失败仍保留成本。不是原著完整治疗表，不复活、不治愈污染，不处理未知病因，不提供现实处方。' },
  { id: 'mother.s8.condition-observation', label: '病况观察（G）', description: '本作原创G：区分眼前可观察伤口、未明原因的疲乏与应停止接触的危险耳语，只记录有限事实与不确定性并进行适当转介。观察不等于确诊，不读取隐藏病因，不保证消除失控或精神污染，不替代普通核实。' },
];
export const PHYSICIAN_CONSUMPTION_RISK = '服药必定消耗本次选定医师原瓶，0行动，意志难度12；耕种者扮演须达100且首次晋升耕种者后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊芙在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触或其它危险。失败保留耕种者消化和三项掌握；成功只新增两项从0开始的医师掌握，体质+1、感知+1、意志+1、知识+1，灵性上限45且当前灵性不补满。有限幻想照料不复活、不治愈污染、不提供现实处方，无法把未知疲乏或危险耳语直接治疗为健康。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
