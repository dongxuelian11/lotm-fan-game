import { LUCKY_GUIDE } from '../lucky/content.js';
import type { CalamityPriestAbilityId } from './types.js';
export { CALAMITY_PRIEST_CASE_IDS } from './types.js';
export const CALAMITY_PRIEST_GUIDE = LUCKY_GUIDE;
export const CALAMITY_PRIEST_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const CALAMITY_PRIEST_MIN_LUCKY_WEEKS = 12;
export const CALAMITY_PRIEST_LABOUR_STEPS = 5;
export const CALAMITY_PRIEST_BOTTLE_IDS = ['calamity-priest-potion-1', 'calamity-priest-potion-2', 'calamity-priest-potion-3'] as const;
export const CALAMITY_PRIEST_SOURCE_STATUS = '《诡秘之主》第四部第178章支持序列6灾祸教士被动预见将要发生的灾祸，得以准备、应对并减轻损害；也可主动吸引灾难，依靠幸运避开大部分，却不是全部危险。精神风暴造成精神眩晕、混乱，不是强制服从、读心、记忆改写或治疗。当前只新增灾祸察觉、招灾、精神风暴三项掌握，原三项怪物、两项机器与一项幸运者能力及原ID完整继承。序列7幸运仍被动波动，没有等量厄运偿还；幸运储存与主动控运属于序列5，不下放。原记录员艾妲·芬恩、独立成品原瓶、原报时铺漏雨货架、本人许可的小板试验、成年人佩林的自愿轻微精神试验、杜兰的场地争执与全部数值均为本作原创G。当前有限场地布置不构成对自己、同伴或其它场景的一般安全保证。';
export const CALAMITY_PRIEST_FORMULA_STATUS = '命运之轮途径序列6灾祸教士的完整晋升配方尚未核实；用药指导只说明本作原创G渠道实际供应的独立序列6成品原瓶，不解锁完整配方、原料采购或魔药制造，不编造材料。';
export const CALAMITY_PRIEST_POTION_SOURCES = CALAMITY_PRIEST_BOTTLE_IDS.map((id, index) => ({
  id, source: `${CALAMITY_PRIEST_GUIDE}经独立灾祸教士成品交接渠道实际取得的第${index + 1}瓶序列6灾祸教士成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非怪物、机器或幸运者旧瓶改装，未声称掌握完整配方或在报时铺调配。`,
}));
export const CALAMITY_PRIEST_LABOUR_TASKS = ['核对本瓶独立封签', '整理原报时铺普通存放格', '清点原小板与接物盘', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const CALAMITY_PRIEST_ABILITIES: { id: CalamityPriestAbilityId; label: string; description: string }[] = [
  { id: 'wheel.s6.disaster-awareness', label: '灾祸察觉', description: '被动察觉将至灾祸，仍须据现场观察准备、应对、减轻损害。原雨漏支架只给本次有限线索，必须实际查看、挪开原箱并固定；不是全知未来或随时保证躲开一切危险。当前能力实践3灵性为主动集中核对的G成本，不把被动征兆写成随时收费。' },
  { id: 'wheel.s6.disaster-attraction', label: '招灾', description: '能够主动吸引灾祸，幸运帮助避开大部分危险却不保证自身或同伴无伤。本作只在物主明确许可、清空隔开的原工作间，使用同一原小板与原接物盘作有限一次坠落实践；必须实际重新支好和收妥，不能凭空添加战斗灾源。' },
  { id: 'wheel.s6.mental-storm', label: '精神风暴', description: '造成有限精神眩晕或混乱，效果仍可失败或被抵抗。本次只向明确自愿的成年记录员佩林作短暂轻微试验，停止施加并等候实际短效结束；不迫供、不控制意愿、不改写记忆，也不声称治疗。' },
];
export const CALAMITY_PRIEST_CONSUMPTION_RISK = '以下数值为原创G：本次选定原瓶服药必耗，0行动，意志难度24；幸运者消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。艾妲在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留幸运者消化与全部原掌握；成功只新增三项灾祸教士掌握，从0开始，四属性各+1，灵性上限80但当前灵性不补满。当前有限G实践及和平100都有真实时间与资源代价，不构成一般无伤或无代价消化保证。';
