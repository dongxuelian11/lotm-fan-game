import type { WizardAbilityId, WizardSpellId } from './types.js';
export { WIZARD_CASE_IDS, WIZARD_SPELL_IDS } from './types.js';

/** B1 ch65 L12121 and B2 ch4 L40190 confirm the name/pathway only.
 * The three low-order applications, instructor, supply and numbers are original G. */
export const WIZARD_GUIDE = '法术教学室导师伊蕾·莫文';
export const WIZARD_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const WIZARD_MIN_COMBAT_SCHOLAR_WEEKS = 8;
export const WIZARD_BOTTLE_IDS = ['wizard-potion-1', 'wizard-potion-2', 'wizard-potion-3'] as const;
export const WIZARD_SOURCE_STATUS = '《诡秘之主》第一部第65章（核验定位L12121）与第二部第4章（核验定位L40190）仅确认隐者途径序列7巫师的名称与途径归属，未核实完整法术表。当前只新增法术研习这一项掌握；有限牵引、短时护持、局部模糊均明确为本作原创G低阶教学应用，来源只公开本作教学，不声称原著完整技能表。莉奈·安瑟介绍的伊蕾·莫文是本作原创成年导师；教学室、独立成品渠道、三项课程、实践、劳务和全部数值均为本作原创G。三项窥秘人能力与格斗研习掌握完整继承；晋升不会自动学会三术，不强制加入摩斯苦修会或其它组织，不开放复活、高阶窥秘之眼、序列4神秘再现或序列6卷轴制造。';
export const WIZARD_POTION_SOURCES = WIZARD_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `莉奈·安瑟介绍的成年${WIZARD_GUIDE}从独立巫师成品交接渠道实际取得的第${index + 1}瓶序列7巫师成品魔药，独立封存原瓶${id}；成年导师与供应均为本作原创G，不是窥秘人或格斗学者旧瓶改装，也未声称在教学室配制。取得此瓶不建立摩斯苦修会或其它组织身份。`,
}));
export const WIZARD_FORMULA_STATUS = '隐者途径序列7巫师的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const WIZARD_LABOUR_TASKS = ['核验教学室进阶原瓶封记', '整理独立成品交接记录', '核对教学室实际收货清单', '归档该瓶保管与领取凭证'] as const;
export const WIZARD_ABILITIES: { id: WizardAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s7.spellcraft', label: '法术研习', description: '本作G低阶教学分类：分别学会有限牵引、短时护持和局部模糊后，才可针对实际对象施放对应法术。三项课程共享这一项掌握，学过不等于无限适用；法术效果必须实际结束。不自动获得所有魔法，不复活，不开放高阶窥秘之眼、神秘再现或卷轴制造。' },
];
export const WIZARD_SPELLS: { id: WizardSpellId; label: string; description: string }[] = [
  { id: 'light-touch', label: '有限牵引', description: '本作原创G教学：对眼前轻小纸标作有限牵引，先检查实际位置与可用范围；真实战斗可作短促有限冲击，不能把人当物件搬运，不遥取任意物品，也不是复活或神秘再现。须单独学习成功后才能施放。' },
  { id: 'brief-ward', label: '短时护持', description: '本作原创G教学：在明确同意的软垫小冲击试验中作短暂护持，保护有限且须实际收束；不是无敌屏障，不能抵挡所有攻击。须单独学习成功后才能施放。' },
  { id: 'blur-mark', label: '局部模糊', description: '本作原创G教学：短暂模糊眼前原标签的一小块可视标记，再实际解除并核对原标；不让人完全隐形，不改写原物或他人记忆。须单独学习成功后才能施放。' },
];
export const WIZARD_CONSUMPTION_RISK = '服药必定消耗所选巫师原瓶，0行动，意志难度18；格斗学者扮演须达100且晋升格斗学者后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊蕾在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常知识或其它危险。成功后体质+1、感知+1、意志+2、知识+2，灵性上限60，当前灵性不补满；三项课程仍须逐项学习。教学、金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
