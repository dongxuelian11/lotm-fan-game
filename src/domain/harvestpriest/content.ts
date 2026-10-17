import type { HarvestpriestAbilityId } from './types.js';
export { HARVESTPRIEST_CASE_IDS } from './types.js';

/** Only the S7 name is verified here; the guide, finished supply, limited care and numbers are original G. */
export const HARVESTPRIEST_GUIDE = '苗圃照料员伊芙·莫兰';
export const HARVESTPRIEST_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800, water: 30 } as const;
export const HARVESTPRIEST_MIN_PHYSICIAN_WEEKS = 8;
export const HARVESTPRIEST_BOTTLE_IDS = ['harvestpriest-potion-1', 'harvestpriest-potion-2', 'harvestpriest-potion-3'] as const;
export const HARVESTPRIEST_SOURCE_STATUS = '《诡秘之主》第三部第225章仅核实序列7名称“丰收祭司”；完整配方与精确序列7法术表尚未核实。丰收照料、生命支持、原菜畦照料、有限收成分享和下一季计划均为本作原创G，不宣称原著规定这些具体法术或数值。三项耕种者与两项医师能力及原ID掌握完整继承；不下放弗兰克在序列6生物学家的杂交改造，不把“生命手杖”的区域生命爆发当作序列7能力。不复活、不治愈污染、不保证治疗失控，不创造免费额外收成、自动再生或天气控制。伊芙·莫兰仍是已认识的本作原创成年苗圃照料员；她明确允许照料自己的六株已接近采收期的原菜苗，并把这一次有限三份收成交给你用于分享。原菜苗不是凭空生成的种子，也不是无限生产源；完成实际照料后仍须等下一真实周才能采收一次。独立成品原瓶、劳务、价格、实际用水及全部数值均为本作原创G，不自动建立大地母神教会或其它组织身份。';
export const HARVESTPRIEST_POTION_SOURCES = HARVESTPRIEST_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${HARVESTPRIEST_GUIDE}从独立丰收祭司成品交接渠道实际取得的第${index + 1}瓶序列7丰收祭司成品魔药，独立封存原瓶${id}；照料员与供给均为本作原创G，不是耕种者或医师旧瓶改装，也未声称在小苗圃配制。取得此瓶不建立大地母神教会或其它组织身份。`,
}));
export const HARVESTPRIEST_FORMULA_STATUS = '丰收祭司完整配方尚未核实，全部材料名称、主辅分类、数量与投料顺序均不作为已知内容；配方列表保持空且未知，不补造任何原料。第三部第225章只确认序列名称，不提供已核完整配方或法术表。当前只开放本作原创G的独立成品原瓶；用药指导不解锁配方学习、魔药材料采购或调配。30便士购买的2份普通灌溉水仅为照料原菜苗的实际物资，不是魔药材料，也不创造额外植株。';
export const HARVESTPRIEST_LABOUR_TASKS = ['核验丰收祭司原瓶封记', '整理独立成品交接记录', '对照小苗圃收货清单', '复核本瓶交付凭据'] as const;
export const HARVESTPRIEST_ABILITIES: { id: HarvestpriestAbilityId; label: string; description: string }[] = [
  { id: 'mother.s7.harvest-care', label: '丰收照料（G）', description: '本作原创G的有限幻想照料：仅照料伊芙明确许可的这六株原菜苗，依实际水源、灵性成本和普通判定改善本次状态。成功后仍要等下一真实周实际采收一次三份；失败保留支出，不免费增产、自动再生、改变天气或杂交出新生物。不是原著完整序列7法术表。' },
  { id: 'mother.s7.life-support', label: '生命支持（G）', description: '本作原创G的有限生命照护与支援，按当前明确对象、实有资源和接触边界处理，不把有限观察当作确诊。它不复活、不治愈污染、不保证治疗失控，不复制“生命手杖”的区域生命爆发；分享有限收成及记录下一季计划仍须实际执行。' },
];
export const HARVESTPRIEST_CONSUMPTION_RISK = '服药必定消耗本次选定丰收祭司原瓶，0行动，意志难度18；医师扮演须达100且晋升医师后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊芙在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触或其它危险。失败保留医师消化与全部五项原有掌握；成功只新增从0开始的丰收照料与生命支持掌握，体质+1、感知+1、意志+1、知识+1，灵性上限60且当前灵性不补满。有限照料与生命支持均为本作原创G，不下放生物学家的杂交改造，不复制“生命手杖”的区域生命爆发，不提供现实诊断、治疗或处方。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
