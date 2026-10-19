import { GUARDIAN_GUIDE } from '../guardian/content.js';
import type { DemonHunterAbilityId } from './types.js';

export const DEMON_HUNTER_GUIDE = GUARDIAN_GUIDE;
export const DEMON_HUNTER_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const DEMON_HUNTER_MIN_GUARDIAN_WEEKS = 12;
export const DEMON_HUNTER_LABOUR_STEPS = 5;
export const DEMON_HUNTER_BOTTLE_IDS = ['demon-hunter-potion-1', 'demon-hunter-potion-2', 'demon-hunter-potion-3'] as const;
/** Canonical power boundaries and original G objects are disclosed separately from numerical rules. */
export const DEMON_HUNTER_SOURCE_STATUS = '黄昏巨人途径序列4猎魔者能够辨识邪恶与污染的相关痕迹，并隐藏自身行动意图，干扰危险预感；这不等于物理隐身、读取完整历史或全知的道德审判，不能据一次痕迹给人贴永久邪恶标签。猎魔者掌握怪物弱点、材料用途及针对性准备知识，通过实际材料与特殊冥想制作相应药剂、药膏、油或符号；知识、准备与及时反应都重要，不是免费万能克制。原封存残片DH4-SHARD-1、普通烟灰DH4-SOOT-1、青铜探针DH4-PROBE-1、虚构封存试剂与栏后灰蛾DH4-MOTH-1均为本作G，不冒充原著物种或真实化学流程。灰蛾只具有本场有限的近距离意图、视听反应，不能推广成所有恶魔的统一机制。序列4不完整巨人神话形态可能污染旁观者并造成自身失控，本段不提供免费永久变身。下一序列3白银骑士的实体银甲、光线隐匿与传送银剑不提前发放；荣耀之冠的真话辨识、荣耀之证的绝对光牢属于物品能力，不能变成本职业免费能力。原成年导师奥斯温·布莱克特、院工维拉与盖伦、全部战士、格斗家、武器大师、黎明骑士、守护者原能力ID和掌握、借棍归属、原同伴真实伤势、旧物和敌人结局均保留。';
export const DEMON_HUNTER_FORMULA_STATUS = '猎魔者完整配方与晋升仪式细节尚未核实；不能据未知细节断言无需仪式。材料、用量、调配顺序及仪式步骤保持未知。本作原创G渠道只提供独立成品原瓶；原成年导师奥斯温·布莱克特实际核对本次原瓶、准备原训练场的安静服药场地并在场照护，再指导本次服药。这是明确的G专业准备流程，不冒充已还原原著仪式，也不解锁完整配方、材料采购或魔药调配。';
export const DEMON_HUNTER_POTION_SOURCES = DEMON_HUNTER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DEMON_HUNTER_GUIDE}经独立猎魔者成品交接渠道实际取得的第${index + 1}瓶序列4猎魔者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非任何旧序列原瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const DEMON_HUNTER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原训练场公开交接册', '清点原标本室普通封柜', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const DEMON_HUNTER_ABILITIES: { id: DemonHunterAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s4.discern-corruption', label: '邪恶与污染痕迹辨识', description: '对实际接触到的具体痕迹作有限辨识，不能读取物主身份、完整历史或裁决任何人的善恶。本段支付3灵性、感知难度18检查原封存残片与普通烟灰；普通方法保留收集标签、日期记录和不确定性。战斗的弱点仍须单独支付4灵性、感知难度18实际观察原灰烬守卫的可见裂隙。' },
  { id: 'warrior.s4.targeted-preparation', label: '真实材料的针对性准备', description: '结合已知目标、怪物弱点与实际材料，经特殊冥想制作短效针对性涂层。本段90便士虚构原试剂包含两剂具名原物，知识难度18、4灵性的一次制作实际消耗两剂；失败材料也耗尽。原青铜探针必须实际入柜测试并取回，一层只削弱这一原残片10点有限残留强度，不能净化任意目标或无材料造药。' },
  { id: 'warrior.s4.veil-intent', label: '隐藏自身行动意图', description: '收敛本人意图，干扰相应的危险预感，不抹去身体、脚步或响声。本段3灵性、意志难度18尝试沿原遮屏后的安静2米路线接近栏后原灰蛾；制造响声仍会使其警觉，结束须沿原2米路线实际走回。战斗只影响原灰烬守卫本轮有限预警反应，敌人仍可看到并格挡实际攻击。' },
];
export const DEMON_HUNTER_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原训练场安静场地并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，守护者消化100且晋升后满12整周，并先结束旧实践、新接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。仅本次G指导服药的健康与精神最低保留1，导师照护后仍可休养；原瓶不会复原，此保护不适用于战斗或其它危险。失败保留守护者消化与全部旧掌握；成功四属性各+1，只新增污染辨识、针对性准备、隐藏自身意图三项0掌握，扮演从0开始，灵性上限120且当前灵性不补满。原性别、原老师、原物归属、实际借用/返还、同伴伤势和敵人结局不变；没有附赠神话形态、白银骑士能力或封印物效果。';
