import { MARAUDER_GUIDE } from '../marauder/content.js';
import type { CryptologistAbilityId } from './types.js';
export { CRYPTOLOGIST_CASE_IDS } from './types.js';

/** Book three ch215 supports the sequence order. Book five ch35's necklace
 * recalls existing experience to expose an illusion's inconsistencies; ch85's
 * S7 Hazel detects incoherence but stops at danger. These do not grant access
 * to unknown past events or S6 power theft. Mentor, supply, cases and numbers are G. */
export const CRYPTOLOGIST_GUIDE = MARAUDER_GUIDE;
export const CRYPTOLOGIST_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const CRYPTOLOGIST_MIN_SWINDLER_WEEKS = 8;
export const CRYPTOLOGIST_BOTTLE_IDS = ['cryptologist-potion-1', 'cryptologist-potion-2', 'cryptologist-potion-3'] as const;
export const CRYPTOLOGIST_SOURCE_STATUS = '错误途径序列7解密学者的阶序据《诡秘之主》第三部第215章；有限解密边界参考第五部第35章项链使既有经历被重新回想、从幻境的不一致处寻找破绽，以及第五部第85章序列7海柔尔察觉不协调而在危险前止步的表现。前者是原物能力表现的边界参考，不把完整物品效果额外赠予角色。当前只增加一项解密掌握，依赖实际接触的材料、已有经历与可核实的矛盾，不凭空看见未经历的过去、读取他人秘密或自动获得全知答案；不开放序列6盗火人的非凡能力偷取。艾德温·洛克沿用本作原创成年独立导师身份，新解密资料交接渠道的独立成品原瓶、三段有限情境、具体步骤和全部数值均为本作玩法G。三项偷盗者能力及诈骗师骗术按原ID继承，不建立家族或组织身份。';
export const CRYPTOLOGIST_POTION_SOURCES = CRYPTOLOGIST_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CRYPTOLOGIST_GUIDE}从新解密资料交接渠道实际购入的第${index + 1}瓶序列7解密学者成品魔药，独立封存原瓶${id}；这批现货并非偷盗者或诈骗师旧瓶改装，成年导师与独立成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立任何家族或组织身份。`,
}));
export const CRYPTOLOGIST_FORMULA_STATUS = '错误途径序列7解密学者的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作G的新渠道独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const CRYPTOLOGIST_LABOUR_TASKS = ['核对解密资料交接封记', '逐瓶登记独立成品编号', '整理本批原收货记录', '复核本瓶交付清单'] as const;
export const CRYPTOLOGIST_ABILITIES: { id: CryptologistAbilityId; label: string; description: string }[] = [
  { id: 'error.s7.decryption', label: '解密', description: '依据实际接触的材料与已有经历，重新梳理关系并寻找不一致之处；可以形成有限解释，仍需与原记录核对，也可能失败或在危险前停止。不能看见未经历的过去、读取他人秘密、自动知道完整真相或偷取非凡能力。记录次序、原走廊与标记拓印的具体实践和数值均为本作玩法G。' },
];
export const CRYPTOLOGIST_CONSUMPTION_RISK = '服药必定消耗所选解密学者原瓶，0行动，意志难度18；诈骗师扮演须达100且晋升诈骗师后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
