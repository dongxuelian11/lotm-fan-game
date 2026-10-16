import type { WarriorAbilityId, WarriorPracticeClub } from './types.js';
export { WARRIOR_CASE_IDS } from './types.js';

/** Novel B1 ch138 gives the sequence names. Roy's B7 ch18 strength feat is
 * bounded by B7 ch24's identification as a Warrior advancing to Gladiator.
 * Training categories, mentor, supply, scenes and all numbers are original G. */
export const WARRIOR_GUIDE = '独立训练场导师奥斯温·布莱克特';
export const WARRIOR_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const WARRIOR_BOTTLE_IDS = ['warrior-potion-1', 'warrior-potion-2', 'warrior-potion-3'] as const;
export const WARRIOR_SOURCE_STATUS = '序列名称据《诡秘之主》第一部第138章的战士、格斗家与武器大师；第七部第18章罗伊以力量开启井盖的表现，由第七部第24章其战士身份与即将晋升格斗家的说明限定为序列9的力量参考。本阶段将强健体魄、持械训练与克制施力作为本作原创G的三个训练分类，分别记录实践；这不是原著列出的三项独立超能力。奥斯温·布莱克特为本作原创成年独立导师，训练场、供药渠道、劳务、场景及全部游戏数值均为本作原创G，不强制加入战神教会或其它组织。战士不自动精通所有武器，不免疫恐惧，不获得徒手防弹；序列6的晨曦铠甲、晨曦武器与光之风暴不属于本阶段。';
export const WARRIOR_POTION_SOURCES = WARRIOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WARRIOR_GUIDE}独立保管的第${index + 1}瓶战士成品魔药，原瓶独立封存；导师与训练场的独立供给为本作原创G，未声称现场配制。取得此瓶不建立战神教会或其它组织身份。`,
}));
export const WARRIOR_FORMULA_STATUS = '战士完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const WARRIOR_ABILITIES: { id: WarriorAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s9.physique', label: '强健体魄', description: '基于罗伊实际力量表现的本作G训练分类。只对眼前真实障碍和负重施力，仍需检查支点、清空落点与留出退路；体力增强不等于无限力量、免伤或徒手防弹。' },
  { id: 'warrior.s9.arms', label: '持械训练', description: '本作G训练分类：持有现场实际借到的练习棍，学习握持、距离与停止动作。服药不自动精通所有武器，也不会凭空创造兵器；训练棍仍属导师所有，借用与归还分别记录。' },
  { id: 'warrior.s9.restraint', label: '克制施力', description: '本作G训练分类：在力量实践中辨认危险、控制施力并尊重停止信号，普通团队方法也能完成现场目标。这不是恐惧免疫、无敌防护或新的精神超能力；不开放晨曦铠甲与光之风暴。' },
];
export const WARRIOR_PRACTICE_CLUB: Readonly<WarriorPracticeClub> = {
  id: 'warrior-training-club', owner: '奥斯温·布莱克特', custodian: 'MENTOR', location: 'training-rack', version: 1,
};
export const WARRIOR_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
