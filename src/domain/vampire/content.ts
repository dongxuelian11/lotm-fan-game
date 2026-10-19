import { TAMER_GUIDE } from '../tamer/content.js';
import type { VampireAbilityId } from './types.js';

/** Canon boundaries supplied by the stage audit: S7 needs blood, principally human;
 * animal blood is possible but not fully equivalent. Healing is stronger, not immortality.
 * Sunlight causes discomfort, not instant death. Dark Wings and Abyss Shackles are S7.
 * Only blood-source essence is verified as a main ingredient; quantities and auxiliaries
 * are unknown. The human potion-drinking player must act and digest; an exemption for
 * naturally born S7 Sanguine does not apply. All prices, stock, labour, maturity, checks,
 * attribute gains and bounded practice implementations are original G game rules.
 * Fictional blood supplies have consenting adult provenance; no real collection procedure. */
export const VAMPIRE_GUIDE = TAMER_GUIDE;
export const VAMPIRE_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const VAMPIRE_MIN_TAMER_WEEKS = 8;
export const VAMPIRE_BOTTLE_IDS = ['vampire-potion-1', 'vampire-potion-2', 'vampire-potion-3'] as const;
export const VAMPIRE_POTION_SOURCES = VAMPIRE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${VAMPIRE_GUIDE}从新夜间诊所交接渠道实际购入的第${index + 1}瓶序列7吸血鬼成品魔药，独立封存原瓶${id}；这批现货并非药师或驯兽师旧瓶改装，导师渠道与供应为本作G原创。`,
}));
export const VAMPIRE_FORMULA_STATUS = '吸血鬼完整配方资料待核；仅确认主材料线索“血源精华”，数量与辅助材料未知。没有完整配方，不开放配方学习与制造；目前只能取得新渠道实际供应的序列7独立成品原瓶，不以血食替代魔药。';
export const VAMPIRE_LABOUR_TASKS = ['核验夜间诊所药箱封记', '整理夜间诊所普通遮光用品', '护送密封药箱到诊所', '复核本批成品交接记录'] as const;
export const VAMPIRE_ABILITIES: { id: VampireAbilityId; label: string; description: string }[] = [
  { id: 'moon.s7.blood-scent', label: '血气辨识', description: '血族感官能在实际接触的有限情境中辨识血气线索；本阶段以有来源的虚构封存样本练习，不远距全知追踪，不从血气读取记忆。需要以人血为主的血食，动物血并非完全等价替代；当前供应只采用本作G自愿成年供给者的有来源封存血食，不涉及现实采集操作。' },
  { id: 'moon.s7.abyss-shackles', label: '深渊枷锁', description: '施展黑暗法术短暂束缚实际目标；本作G仅开放明确场景中的有限限制和主动解除，受灵性与判定约束，不是永久控制或必然命中，不操纵目标的思想。' },
  { id: 'moon.s7.dark-wings', label: '黑暗之翼', description: '展开黑暗之翼进行有限移动与闪避；本作G只开放已有落点和已核实路径，不凭空穿墙、无限飞行或自动带走他人。阳光会引起不适，并非接触阳光便立即死亡。' },
  { id: 'moon.s7.regeneration', label: '再生', description: '血族身体拥有更强的恢复能力；本作G以实际血食、灵性及每周限制支持有限恢复。仍可被杀死，不复活死亡角色，不保证免疫伤势、污染或疾病，不提供现实医疗建议。' },
];
export const VAMPIRE_CONSUMPTION_RISK = '以下金额、时间与判定均为本作G游戏平衡：服药必定消耗所选吸血鬼原瓶，0行动，意志难度18；驯兽师扮演须达100且晋升驯兽师后满8整周，同行动物须先安全回到原主人处。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。人类服药成为吸血鬼后仍须扮演并消化魔药；天生血族的序列7情况不构成玩家的豁免。';
