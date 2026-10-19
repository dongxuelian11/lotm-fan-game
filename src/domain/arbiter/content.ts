import type { ArbiterAbilityId } from './types.js';
export { ARBITER_CASE_IDS } from './types.js';

/** Verified chapter summary only. Guide, finished supply, cases and numbers are original G. */
export const ARBITER_GUIDE = '民间调解文书员薇娜·贝尔';
export const ARBITER_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const ARBITER_BOTTLE_IDS = ['arbiter-potion-1', 'arbiter-potion-2', 'arbiter-potion-3'] as const;
export const ARBITER_SOURCE_STATUS = '《诡秘之主》第一部第114章《成员的标准》支持仲裁人拥有令人信服的魅力、权威与出色格斗能力。序列9的威严和魅力可以影响可交流对象，命令不等于必须服从；不改写现实，不自动判定法律罪责，也不赋予司法裁决权。序列8治安官的图像追踪与有条件感应、序列7审讯者的精神刺穿与审讯、序列6法官的禁止均不下放。薇娜·贝尔是本作原创成年民间调解文书员；独立成品药渠道、普通劳务、三项有限调解与反思、全部游戏数值均为本作原创G，不任命玩家为官方人员，不自动建立王室、教会或其它组织身份。';
export const ARBITER_POTION_SOURCES = ARBITER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ARBITER_GUIDE}独立保管的第${index + 1}瓶仲裁人成品魔药，原瓶独立封存；文书员与民间调解处供给为本作原创G，未声称现场配制。取得此瓶不赋予官方身份，不建立王室、教会或其它组织身份。`,
}));
export const ARBITER_FORMULA_STATUS = '仲裁人完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const ARBITER_ABILITIES: { id: ArbiterAbilityId; label: string; description: string }[] = [
  { id: 'justiciar.s9.authority', label: '威严', description: '以仲裁人的权威感稳定可交流的现场，提出清楚而有限的要求。对方仍能拒绝，命令不等于必须服从；没有神秘禁令，不自动判定法律罪责，也不获得官方任命。' },
  { id: 'justiciar.s9.persuasive-charisma', label: '令人信服的魅力', description: '让可交流对象更愿意认真听取眼前的理由与安排。接受范围仍须以实际回应确认；不读心、不自动取得真相、不支配人格，也不能把不同意改写成同意。' },
  { id: 'justiciar.s9.combat-training', label: '格斗训练', description: '获得出色的格斗能力，以身体训练、步法和近身技巧应对实际危险。不会自动获得武器，不保证攻击命中，也不带有治安官的图像追踪、审讯者的精神刺穿或法官的禁止。' },
];
export const ARBITER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。文书员在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、异常接触及其它危险。威严与魅力不能取代实际同意，命令可能被拒绝；停止本次交涉不会抹除已经说过的话、达成的约定或造成的后果。';
