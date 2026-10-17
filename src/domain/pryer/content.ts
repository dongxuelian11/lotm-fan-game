import type { PryerAbilityId } from './types.js';
export { PRYER_CASE_IDS } from './types.js';

/** Novel chapter summaries only. The adult mentor, supply, peaceful activities,
 * and every numerical adaptation are original G; no novel text is stored. */
export const PRYER_GUIDE = '抄录室指导者莉奈·安瑟';
export const PRYER_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const PRYER_BOTTLE_IDS = ['pryer-potion-1', 'pryer-potion-2', 'pryer-potion-3'] as const;
export const PRYER_SOURCE_STATUS = '《诡秘之主》第一部第28章支持窥秘人序列9初步涉足神秘学、仪式与星象相关知识，并可能感知隐秘存在及其危险；这不是完整答案或随意施法。第一部第51章限定低序列仪式多依靠外部力量，回应可能缺席或被扭曲。灵视只提供有限迹象，不能直接得出完整健康状况、身份或未来。第一部第164章老尼尔的复活教导处于失控情境，不能列为可用能力。第三部第82章提示未经请求的知识可能压倒接收者，普通学习本身不是病态。序列8仅确认格斗学者名称、序列7为巫师；本阶段不开放二者能力或配方，也不下放序列5嘉德丽雅的高阶窥秘之眼、数十米隔墙视觉及序列4神秘再现。莉奈·安瑟为本作原创成年抄录室指导者；成品药渠道、实践、劳务及全部游戏数值为本作原创G。';
export const PRYER_POTION_SOURCES = PRYER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PRYER_GUIDE}独立保管的第${index + 1}瓶窥秘人成品魔药，原瓶独立封存；指导者与抄录室供给为本作原创G，未声称现场配制。取得此瓶不建立摩斯苦修会或其它组织身份。`,
}));
export const PRYER_FORMULA_STATUS = '窥秘人完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const PRYER_ABILITIES: { id: PryerAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s9.spirit-vision', label: '有限灵视', description: '在已观察的局部现场辨认有限灵性迹象，并用普通观察交叉核对。迹象不是完整健康诊断、身份答案或未来；不能隔墙远视，也不能保证看清隐秘存在后不受影响。' },
  { id: 'hermit.s9.ritual-lore', label: '初步仪式知识', description: '核对已给出的仪式准备、记载与适用条件，不凭空获得法术。低序列仪式多请求外部力量，可能没有回应或遭到扭曲；完成准备核对不代表请求已生效，更不提供复活。' },
  { id: 'hermit.s9.occult-study', label: '初步神秘学研习', description: '比较已有抄件和有限知识，区分原记录、推测与未知。普通学习不自动产生污染；面对这次异常页的侵入迹象，可以实际合页停止本次阅读，但不能因此免疫隐匿贤者或其它隐秘影响。' },
];
export const PRYER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。指导者在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、异常知识及其它危险。合上本次异常页只结束眼前的阅读行为，不代表免疫隐匿贤者。';
