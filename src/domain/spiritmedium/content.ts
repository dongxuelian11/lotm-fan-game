import { GRAVEDIGGER_GUIDE } from '../gravedigger/content.js';
import type { SpiritmediumAbilityId } from './types.js';
export { SPIRITMEDIUM_CASE_IDS } from './types.js';

/** Book four chapter 186 supports spirit-related rituals, direct communication
 * with natural spirits and lingering souls in reality, borrowing different spirits'
 * spellcasting and limited control of natural spirits from S7 onward. Recruitment
 * from the spirit world and stronger Words of the Dead belong to S6; the Underworld
 * Gate belongs to S5. Mentor, original supply, cases and all numeric rules are G. */
export const SPIRITMEDIUM_GUIDE = GRAVEDIGGER_GUIDE;
export const SPIRITMEDIUM_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const SPIRITMEDIUM_MIN_GRAVEDIGGER_WEEKS = 8;
export const SPIRITMEDIUM_BOTTLE_IDS = ['spiritmedium-potion-1', 'spiritmedium-potion-2', 'spiritmedium-potion-3'] as const;
export const SPIRITMEDIUM_SOURCE_STATUS = '能力边界据《诡秘之主》第四部第186章：通灵者掌握灵相关仪式，能直接沟通现实中的自然灵与徘徊亡魂，借助不同灵施展相应法术；从序列7开始可有限控制、驱使自然灵。可理解的真实回答不等于全部真相，回答仍受对象所知、片段缺失与污染危险限制，不能变成全知调查。序列6才扩展到灵界招募信使与高强度亡者之语，序列5的冥界之门也未提前下放。伊芙琳·沃斯、独立新供给、案例、固定范围、灵性成本与全部数值均为本作玩法改编G，不建立教会或灵教团身份。';
export const SPIRITMEDIUM_POTION_SOURCES = SPIRITMEDIUM_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SPIRITMEDIUM_GUIDE}从新灵性器具清点交接渠道实际购入的第${index + 1}瓶序列7通灵者成品魔药，独立封存原瓶${id}；这批现货并非收尸人或掘墓人旧瓶改装，导师与成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立黑夜教会、灵教团或其它组织身份。`,
}));
export const SPIRITMEDIUM_FORMULA_STATUS = '序列7通灵者的完整配方尚未核定，不提供未经核实的材料名称、数量、主辅分类或投料顺序，也不沿用收尸人材料片段或掘墓人成品来源冒充通灵者配方。当前只开放本作G独立成品原瓶，用药指导不解锁配方学习、材料采购或调配。';
export const SPIRITMEDIUM_LABOUR_TASKS = ['核验本批独立原瓶封记', '整理获准查阅的器具借还簿', '按原编号归还灵性器具档案', '复核本批成品交接清单'] as const;
export const SPIRITMEDIUM_ABILITIES: { id: SpiritmediumAbilityId; label: string; description: string }[] = [
  { id: 'death.s7.spirit-ritual', label: '灵相关仪式', description: '依据第四部第186章，可进行灵相关仪式，与现场实际存在的灵建立有限联系。对象、准备、范围和所得回应须分别核实；仪式不是凭空制造证人、保证答案或屏蔽一切污染。具体场景、判定与灵性成本为玩法G，不提供现实招灵操作教程。' },
  { id: 'death.s7.spirit-communication', label: '直接灵体沟通', description: '可直接沟通现实中的自然灵与徘徊亡魂，理解实际获得的回答。可理解的真实回答不等于全部真相：对象所知有限、片段可能缺失，接触仍有污染危险。不能读取未曾知晓的一切、逼出完整历史或自动认定嫌疑人；灵界招募信使与高强度亡者之语属于序列6的扩展。' },
  { id: 'death.s7.spirit-borrowing', label: '有限借灵施法', description: '可借助不同灵施展相应法术，并从序列7开始有限控制、驱使自然灵。本作只使用现场已经确认存在的有限自然灵及其对应能力，实际对象、距离、效果与代价仍须检查。不从灵界招募信使、不统御无限亡灵、不保证命中，也不提前开放序列5冥界之门；本段原纸片的有限移动为玩法G。' },
];
export const SPIRITMEDIUM_CONSUMPTION_RISK = '服药必定消耗所选通灵者原瓶，0行动，意志难度18；掘墓人扮演须达100且晋升掘墓人后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、通灵接触与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
