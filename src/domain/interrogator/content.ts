import type { InterrogatorAbilityId } from './types.js';
export { INTERROGATOR_CASE_IDS } from './types.js';

/** Verified chapter boundaries; the guide, finished supply, voluntary practice and numerical rules are original G. */
export const INTERROGATOR_GUIDE = '民间调解文书员薇娜·贝尔';
export const INTERROGATOR_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const INTERROGATOR_MIN_SHERIFF_WEEKS = 8;
export const INTERROGATOR_BOTTLE_IDS = ['interrogator-potion-1', 'interrogator-potion-2', 'interrogator-potion-3'] as const;
export const INTERROGATOR_SOURCE_STATUS = '《诡秘之主》第二部第17章支持审讯者的精神压迫能带来疼痛，但当时的克莱恩并未屈服；这不能推出必然屈服、自动识谎或保证真实口供。第五部第4章中新晋审讯者休使用精神刺穿；第三部第100章中，特雷茜躲开了精神刺穿，因此不设必中或无法躲避。三项仲裁人与两项治安官能力及原ID掌握完整继承，只新增精神刺穿与精神压迫，不下放序列6法官的禁止。薇娜·贝尔仍是已认识的本作原创成年民间调解文书员，沿同一指导渠道继续；取得魔药不赋予官方身份，不自动建立王室、教会或其它组织身份。独立成品原瓶、劳务、价格、片段陈述/交付矛盾/撤回访谈的自愿核对、有限战斗及全部数值均为本作原创G，不是原著必然效果。和平实践尊重本人停止与撤回，不把疼痛当作真相证据，也不开放强迫施压或刑讯。';
export const INTERROGATOR_POTION_SOURCES = INTERROGATOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${INTERROGATOR_GUIDE}从独立审讯者成品交接渠道实际取得的第${index + 1}瓶序列7审讯者成品魔药，独立封存原瓶${id}；文书员与供给均为本作原创G，不是仲裁人或治安官旧瓶改装，也未声称在调解处配制。取得此瓶不赋予官方身份，不建立王室、教会或其它组织身份。`,
}));
export const INTERROGATOR_FORMULA_STATUS = '第二部第239章《班森的打算》仅核到审讯者主材料片段：闪纹黑蛇的角与湖中之灵粉尘。完整配方尚未核实；这两种主材料的投料数量、辅材、完整用量和调配顺序不作为已知内容，不补造克数或辅材。片段不构成可制造配方，配方列表保持空且未知。当前只开放本作原创G的独立成品原瓶；用药指导不解锁配方学习、材料采购或调配。';
export const INTERROGATOR_LABOUR_TASKS = ['核验审讯者原瓶封记', '整理独立成品交接记录', '对照调解处收货清单', '复核本瓶交付凭据'] as const;
export const INTERROGATOR_ABILITIES: { id: InterrogatorAbilityId; label: string; description: string }[] = [
  { id: 'justiciar.s7.mental-puncture', label: '精神刺穿', description: '对实际处于接触范围的目标施加有限精神打击。原著存在目标躲开精神刺穿的情形，本作仍需实际判定与有限目标，不保证命中、失能或投降。不是读取记忆、审判罪责或法官的禁止。' },
  { id: 'justiciar.s7.mental-pressure', label: '精神压迫', description: '能造成精神层面的压力与疼痛，但不保证对方屈服，更不保证口供真实。和平实践仅采用本人自愿、可随时停止的有限核对；沉默、迟疑、疼痛与矛盾都不自动证明说谎或有罪，仍须独立记录与普通证据复核。' },
];
export const INTERROGATOR_CONSUMPTION_RISK = '服药必定消耗本次选定审讯者原瓶，0行动，意志难度18；治安官扮演须达100且晋升治安官后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。薇娜在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触或其它危险。失败保留治安官消化与全部五项原有掌握；成功只新增从0开始的精神刺穿与精神压迫掌握，体质+1、感知+1、意志+2、知识不增加，灵性上限60且当前灵性不补满。精神压迫不保证屈服或真实口供，精神刺穿可以被躲避；不获得法官的禁止或官方身份。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
