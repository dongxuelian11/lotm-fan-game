import { DETECTIVE_GUIDE } from '../detective/content.js';
import type { PolymathAbilityId, PolymathSampleId } from './types.js';
export { POLYMATH_CASE_IDS } from './types.js';

/** 2-081 supplies the verified S6 analysis/imitation boundary, not a free item or skill library.
 * Teachers, three finite samples, sources, cases, costs, checks and maturity below are G. */
export const POLYMATH_GUIDE = DETECTIVE_GUIDE;
export const POLYMATH_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const POLYMATH_MIN_DETECTIVE_WEEKS = 12;
export const POLYMATH_LABOUR_STEPS = 5;
export const POLYMATH_BOTTLE_IDS = ['polymath-potion-1', 'polymath-potion-2', 'polymath-potion-3'] as const;
export const POLYMATH_SOURCE_STATUS = '第二部第202章《戒指》中封印物2-081的序列6特性支持辨识、记住并模拟已经见过的非凡能力：越强越难，模仿可能失败，成功也弱于原版。它不是赠予玩家的戒指或完整技能库，物品特有负面也不能普遍套给博学者本体。博学者本体的具体次数、槽位和距离未核，本作只开放三个明确标记G的低阶教学样本及有限判定。原阅读者、推理学员、守知者全部原ID能力与掌握保留，不获得序列5秘术导师的千里仪式入梦或制造。原成年导师塞缪尔渠道、诺亚与塔莉娅、成品供应、场地、三案和全部数值均为原创G。';
export const POLYMATH_FORMULA_STATUS = '博学者完整配方尚未核实，不拼补材料、剂量或调配步骤。用药指导不解锁配方、材料采购或制造；目前只交付原创G独立渠道实际取得的序列6成品原瓶。';
export const POLYMATH_POTION_SOURCES = POLYMATH_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${POLYMATH_GUIDE}经独立博学者成品交接渠道实际取得的第${index + 1}瓶序列6博学者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非阅读者、推理学员或守知者旧瓶改装，未声称掌握完整配方。`,
}));
export const POLYMATH_LABOUR_TASKS = ['核对本瓶独立封签', '整理原借阅馆公开交接册', '按原编号归还教学示意册', '校对本瓶交接日期', '复核本瓶成品供货凭据'] as const;
export const POLYMATH_ABILITIES: { id: PolymathAbilityId; label: string; description: string }[] = [
  { id: 'reader.s6.analysis', label: '非凡能力辨析', description: '辨识并理解亲眼见过且有明确来源的非凡能力。只见过不等于已经理解，辨析可失败，不能读取未知NPC的能力池或补出未见细节。本阶段只对诺亚与塔莉娅实际同意演示的三个原创G低阶样本进行知识14辨析。' },
  { id: 'reader.s6.limited-imitation', label: '有限弱化模仿', description: '对已亲见、已成功辨析的有限样本尝试弱化模仿，成功才记为学会。越强越难且可能失败，成功也弱于原版；不复制物品全部技能、装备、身份或高序列权能。本阶段每次教学实践3灵性、知识16，具体次数、成本与效果均为G。' },
];
export const POLYMATH_SAMPLES: { id: PolymathSampleId; label: string; source: string; boundary: string }[] = [
  { id: 'FLASH', label: '低强闪光样本', source: '原创G成年戏法大师诺亚明确同意，在原借阅馆教学室向你实际演示低强闪光；只记录这次亲见的有限样本。', boundary: '成功模仿只产生弱于原示范的小闪光，不造成伤害、不扩展成未知技能。可选空院战斗仅已成功模仿的FLASH支持2灵性、知识18、敌贡献降低8的G小闪；来源或现场不足时普通回退。' },
  { id: 'FROST', label: '原杯薄冰样本', source: '原创G成年戏法大师诺亚明确同意，在原教学室对原杯温水表面实际演示一层薄冰，原杯与水留在原处。', boundary: '成功模仿只在这只原杯水面形成更有限的薄冰；不冻人、不改变气候，不复制或带走原杯与水，不自动加入战斗。' },
  { id: 'COURAGE', label: '自愿短句鼓舞样本', source: '原创G成年歌颂者塔莉娅明确同意，在原小庭向自愿成年同伴示范一段短句鼓舞，你亲自在场观察；同伴可随时停止。', boundary: '成功模仿只使本次同意的成年本人短暂、有限振作；不能控心、保证说服、替人决定或回满灵性，不自动加入战斗。' },
];
export const POLYMATH_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；守知者消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。成年导师塞缪尔在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留守知者消化与原掌握；成功只新增两项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
