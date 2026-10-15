import { CORPSECOLLECTOR_GUIDE } from '../corpsecollector/content.js';
import type { GravediggerAbilityId } from './types.js';
export { GRAVEDIGGER_CASE_IDS } from './types.js';

/** Novel book four chapter 186 supports enhanced physique/agility/spiritual sight,
 * initial communication with a few nearby spirits and death-eye recognition of
 * weaknesses in unfamiliar undead/spirit-world beings. Supply, mentor, cases,
 * fixed costs, gains and check values are gameplay adaptation G. */
export const GRAVEDIGGER_GUIDE = CORPSECOLLECTOR_GUIDE;
export const GRAVEDIGGER_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const GRAVEDIGGER_MIN_CORPSECOLLECTOR_WEEKS = 4;
export const GRAVEDIGGER_BOTTLE_IDS = ['gravedigger-potion-1', 'gravedigger-potion-2', 'gravedigger-potion-3'] as const;
export const GRAVEDIGGER_SOURCE_STATUS = '能力边界据《诡秘之主》第四部第186章：掘墓人的体能、敏捷与灵视增强，能够初步与附近少量灵沟通；死亡之眼可寻找陌生不死生物和灵界生物的弱点。死亡之眼不是即死术，也不能看穿任意普通人的弱点；初步沟通不等于完整通灵问答、强迫灵体作证或控制亡灵军队。序列7通灵者的更完整能力未提前授予。伊芙琳·沃斯、独立新供给、案例、固定距离、灵性成本与全部数值均为本作玩法改编G，不建立教会或灵教团身份。';
export const GRAVEDIGGER_POTION_SOURCES = GRAVEDIGGER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${GRAVEDIGGER_GUIDE}从新墓园器具库交接渠道实际购入的第${index + 1}瓶序列8掘墓人成品魔药，独立封存原瓶${id}；这批现货并非收尸人旧瓶改装，导师与成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立黑夜教会、灵教团或其它组织身份。`,
}));
export const GRAVEDIGGER_FORMULA_STATUS = '序列8掘墓人的完整配方尚未核定，不提供未经核实的材料名称、数量、主辅分类或投料顺序，也不沿用序列9收尸人的材料片段冒充掘墓人配方。当前只开放本作G独立成品原瓶，用药指导不解锁配方学习、材料采购或调配。';
export const GRAVEDIGGER_LABOUR_TASKS = ['核验墓园器具库的原封记', '整理独立殓房的交接记录', '复核新批次成品收货清单'] as const;
export const GRAVEDIGGER_ABILITIES: { id: GravediggerAbilityId; label: string; description: string }[] = [
  { id: 'death.s8.death-eye', label: '死亡之眼', description: '体能、敏捷与灵视已增强。面对实际存在的陌生不死生物或灵界生物，可用死亡之眼辨识其有限弱点；对象、观察与所得线索须逐项确认。不是即死术，不识别任意普通人的弱点，不隔空处决，也不自动给出凶手或战斗胜利。具体判定、范围与成本为玩法G。' },
  { id: 'death.s8.spirit-contact', label: '初步灵体沟通', description: '可尝试与附近实际存在的少量灵初步沟通；回应可能片面、含混或中断，只记录实际获得的有限片段并保留未知。不召来不存在的证人、不强迫回答、不保证完整供述，也不控制亡灵军队。序列7更完整的通灵能力未获得；距离、成本与案例是玩法G。' },
];
export const GRAVEDIGGER_CONSUMPTION_RISK = '服药必定消耗所选掘墓人原瓶，0行动，意志难度12；收尸人扮演须达100且首次晋升收尸人后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
