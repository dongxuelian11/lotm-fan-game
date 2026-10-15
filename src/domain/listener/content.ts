import type { ListenerAbilityId } from './types.js';
export { LISTENER_CASE_IDS } from './types.js';

/** B1 ch105 supports direct hearing of corresponding hidden entities and possible,
 * non-universal powers. Mentor, supply, scenarios and numerical rules are original G. */
export const LISTENER_GUIDE = '旧物管理员伊森·洛弗';
export const LISTENER_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const LISTENER_MIN_SECRET_SUPPLICANT_WEEKS = 4;
export const LISTENER_BOTTLE_IDS = ['listener-potion-1', 'listener-potion-2', 'listener-potion-3'] as const;
export const LISTENER_SOURCE_STATUS = '《诡秘之主》第一部第105章《通灵》支持序列8倾听者能直接听到对应隐秘存在的耳语，并可能获得独特或扭曲的力量；“可能”不是自动赐予，也不是每位倾听者都拥有同一套通用法术。声音、片段、来源推测与普通核实分别保留，听到不等于理解或证明真相。当前普通首案没有已核实的超凡声音来源，不能凭能力名称编出启示或战斗增益。本阶段只新增有限耳语倾听一项稳定能力分类，三项秘祈人能力完整继承；不下放隐修士阴影能力、蔷薇主教血肉魔法或牧羊人放牧，不把西里斯失控情境下的肉瘤与黑血当作稳定技能。不设置人人五年必死的倒计时，不用游戏异常接触解释现实心理症状或作诊断。离开本次倾听位置只能结束本次主动接触，不消除已发生的后果，也不保证免受未知影响。伊森·洛弗为本作原创成年旧物管理员；新进阶成品渠道、三段有限实践、劳务、金额与全部游戏数值均为本作原创G，不建立极光会或其它组织身份。';
export const LISTENER_POTION_SOURCES = LISTENER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${LISTENER_GUIDE}从独立进阶成品渠道实际取得的第${index + 1}瓶序列8倾听者成品魔药，独立封存原瓶${id}；管理员与供给均为本作原创G，不是秘祈人旧瓶改装，也未声称在旧物间配制。取得此瓶不建立极光会或其它组织身份。`,
}));
export const LISTENER_FORMULA_STATUS = '倒吊人途径序列8倾听者的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const LISTENER_LABOUR_TASKS = ['核验进阶原瓶封记', '整理独立成品交接记录', '复核旧物间实收清单'] as const;
export const LISTENER_ABILITIES: { id: ListenerAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s8.whisper-listening', label: '有限耳语倾听', description: '对当前情境中实际存在、具有对应来源的有限耳语进行倾听。直接听到不等于能可靠理解、确认身份或命令来源；需要普通核实，并保留片段和未知。可能的独特或扭曲力量不自动获得，不形成人人通用的法术表。普通敲击不自动成为超凡声音，离开本次位置也不能保证免受未知影响。' },
];
export const LISTENER_CONSUMPTION_RISK = '服药必定消耗所选倾听者原瓶，0行动，意志难度12；秘祈人扮演须达100且首次晋升秘祈人后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊森在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触或其它危险。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
