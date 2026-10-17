import type { CriminalAbilityId } from './types.js';
export { CRIMINAL_CASE_IDS } from './types.js';

/** Verified chapter summary only. Mentor, supply, acting interpretation and numbers are original G. */
export const CRIMINAL_GUIDE = '旧货管理员罗安·费里';
export const CRIMINAL_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const CRIMINAL_BOTTLE_IDS = ['criminal-potion-1', 'criminal-potion-2', 'criminal-potion-3'] as const;
export const CRIMINAL_SOURCE_STATUS = '《诡秘之主》第二部第45章支持罪犯序列9拥有强健的身体、敏锐的直觉与犯罪相关才能；此时良知尚未泯灭，不自动改写玩家人格或替玩家实施恶行。序列8的进一步堕落与个体化、未逐一命名的魔类法术不下放；序列6恶魔的致命危险预知、巨化与皮肤防护、毒素免疫、火焰与诅咒能力也不下放，敏锐直觉不是预知未来。罗安·费里是本作原创成年旧货管理员，独立成品药渠道、三项实践、劳务及全部游戏数值均为本作原创G，不建立拜血教或其它组织身份。保护他人、克制越界的剧情是本作G扮演解释，不是原著保证善举可以无痛消化，更不保证后续序列7可以绕过其原著要求；只处理虚构场景的选择与后果，不提供现实犯罪操作方法。';
export const CRIMINAL_POTION_SOURCES = CRIMINAL_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CRIMINAL_GUIDE}独立保管的第${index + 1}瓶罪犯成品魔药，原瓶独立封存；管理员与旧货间供给为本作原创G，未声称现场配制。取得此瓶不建立拜血教或其它组织身份。`,
}));
export const CRIMINAL_FORMULA_STATUS = '罪犯完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const CRIMINAL_ABILITIES: { id: CriminalAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s9.brute-force', label: '强健身体', description: '以增强的身体力量处理眼前真实障碍，仍须先看清受力对象和旁人的位置；不能凭空获得武器、徒手破开任何障碍或消除伤势，更没有序列6的巨化与皮肤防护。' },
  { id: 'abyss.s9.alertness', label: '敏锐直觉', description: '对已经在场的细节和不协调之处更敏感，再用普通事实核实；直觉不能确认所有人的意图，也不是序列6对致命威胁的危险预知，不读取未来随机结果。' },
  { id: 'abyss.s9.illicit-insight', label: '犯罪相关才能', description: '在虚构场景中辨认越界取利的机会与其后果，仍由玩家决定是否行动。实际原物的持有与归还分别记录，不自动掠夺、不获得任意开锁或心灵控制，也不提供现实犯罪操作方法。' },
];
export const CRIMINAL_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。管理员在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、异常接触及其它危险。序列9良知尚未泯灭；本作G的克制与保护实践不能被理解成原著保证善举无痛消化，尤其不能据此替代后续序列7的要求。';
