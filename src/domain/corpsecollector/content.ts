import type { CorpsecollectorAbilityId } from './types.js';
export { CORPSECOLLECTOR_CASE_IDS } from './types.js';

/** S9 boundaries are source-verified; no S8 death-eye or S7 spirit questioning.
 * The adult mentor, mortuary channel, sealed supply, jobs, cases and numerical rules are G. */
export const CORPSECOLLECTOR_GUIDE = '独立殓房登记员伊芙琳·沃斯';
export const CORPSECOLLECTOR_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const CORPSECOLLECTOR_BOTTLE_IDS = ['corpsecollector-potion-1', 'corpsecollector-potion-2', 'corpsecollector-potion-3'] as const;
export const CORPSECOLLECTOR_SOURCE_STATUS = '能力边界据《诡秘之主》第四部第186章：收尸人具有尸体特质、较低体温，容易被无智慧亡灵误认作同类；体能增强，能够承受腐烂、寒冷与死亡气息，具有天然灵视及部分不死生物知识。这些表现不是绝对毒素免疫、所有幽灵友善或免疫死亡，也不能凭灵视认定凶手。死亡之眼属于序列8边界，通灵问答属于序列7边界，本阶段均未获得。伊芙琳·沃斯为本作原创成年独立导师；殓房登记员身份、成品供给、场景及数值均为本作原创G，不强制加入黑夜教会、灵教团或其它组织。';
export const CORPSECOLLECTOR_POTION_SOURCES = CORPSECOLLECTOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CORPSECOLLECTOR_GUIDE}独立保管的第${index + 1}瓶收尸人成品魔药，原瓶独立封存；导师与殓房的独立供给为本作原创G，未声称现场配制。取得此瓶不建立黑夜教会、灵教团或其它组织身份。`,
}));
export const CORPSECOLLECTOR_FORMULA_STATUS = '目前仅核得小说中的材料片段“风干的成年黑斑青蛙”；未核定数量、主辅材料分类、其余材料或投料顺序，完整配方仍未知。这个片段不构成完整制造配方；当前只开放本作原创G的独立成品原瓶，用药指导不解锁配方学习、材料采购或调配。';
export const CORPSECOLLECTOR_ABILITIES: { id: CorpsecollectorAbilityId; label: string; description: string }[] = [
  { id: 'death.s9.corpse-physique', label: '尸体特质', description: '体温较低、体能增强，并能承受腐烂、寒冷与死亡气息；无智慧亡灵可能误认你为同类。适用对象和情境必须核实，不等于绝对毒素免疫、普通伤害免疫、免疫死亡或让所有幽灵友善；有智慧、受命或主动攻击的亡灵不会因此自动停止。' },
  { id: 'death.s9.spiritual-sight', label: '天然灵视', description: '有限观察眼前真实对象的灵性迹象，所得观察必须与原记录分开记载并保留未知；无法据此识别凶手、读出全部死因或检出一切危险。本阶段没有序列8死亡之眼，也没有序列7通灵问答，不能询问死者后伪造供述。' },
  { id: 'death.s9.undead-knowledge', label: '不死生物知识', description: '掌握部分关于尸体与不死生物的知识，用于谨慎核对原记录、辨认有限现象和承认不能判断的部分。知识并非万能鉴定，不支配亡灵、不召唤不存在的幽灵、不复活遗体；没有实际检查或证据就不能断言死因和凶手。' },
];
export const CORPSECOLLECTOR_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
