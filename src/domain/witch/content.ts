import { ASSASSIN_GUIDE } from '../assassin/content.js';
import type { WitchAbilityId } from './types.js';
export { WITCH_CASE_IDS } from './types.js';

/** Source amounts and physical G supply portions are intentionally distinct. */
export const WITCH_FORMULA_SOURCE = '《诡秘之主》第一部第200章已核女巫六项配方：主材为黑渊魔鱼全部血液、玛瑙孔雀的蛋；辅材为纯水80毫升、金色曼陀罗汁5滴、阴影蜥蜴鳞片3枚、水仙花汁10滴。黑渊魔鱼取全部血液，不编造毫升数；玛瑙孔雀的蛋原文未另列数量。本作每批分别供给1份主材只是玩法G交付单位，不冒充原著重量或数量。逐项投料顺序未核定，清单顺序不等于原著调配顺序；导师操作规程、批次、劳动、价格、成熟周数、掌握、判定与属性均为本作G。';
export const WITCH_GUIDE = ASSASSIN_GUIDE;
export const WITCH_PRICES = { formula: 240, mainMaterials: 1800, auxiliaryMaterials: 150, brewing: 60 } as const;
export const WITCH_BATCH_IDS = ['witch-batch-1', 'witch-batch-2', 'witch-batch-3'] as const;
export const WITCH_MIN_INSTIGATOR_WEEKS = 8;
export const WITCH_LABOUR_STEPS = 4;
export const WITCH_LABOUR_TASKS = ['抄录女巫六料清单', '核对主材完整封签', '整理导师调配规程', '清理独立调配台'] as const;
/** quantity/unit reflect the source; supplyQuantity/supplyUnit are this game's physical manifest. */
export const WITCH_FORMULA = [
  { id: 'black-abyss-demonic-fish-blood', name: '黑渊魔鱼全部血液', quantity: null, unit: '全部', supplyQuantity: 1, supplyUnit: '份', note: '原著取全部血液，未给毫升或重量；每批1份是本作G供货单位。' },
  { id: 'agate-peacock-egg', name: '玛瑙孔雀的蛋', quantity: null, unit: '原文未另列数量', supplyQuantity: 1, supplyUnit: '份', note: '原文未另列数量；每批1份是本作G供货单位。' },
  { id: 'pure-water', name: '纯水', quantity: 80, unit: '毫升', supplyQuantity: 80, supplyUnit: '毫升' },
  { id: 'golden-datura-juice', name: '金色曼陀罗汁', quantity: 5, unit: '滴', supplyQuantity: 5, supplyUnit: '滴' },
  { id: 'shadow-lizard-scales', name: '阴影蜥蜴鳞片', quantity: 3, unit: '枚', supplyQuantity: 3, supplyUnit: '枚' },
  { id: 'narcissus-juice', name: '水仙花汁', quantity: 10, unit: '滴', supplyQuantity: 10, supplyUnit: '滴' },
] as const;
export const WITCH_BODY_CHANGE = '女巫晋升成功会改变游戏角色的身体：原男性角色转为女性，原女性角色的外貌与魅力也会发生变化。服药前须独立确认接受这项后果；你可以继续停留在序列8教唆者，不晋升。系统保留原角色性别记录，不替你决定角色自称、自我认同或关系选择，也不推断现实玩家的身份；外貌变化不代表获得任意变脸能力。';
export const WITCH_SOURCE_STATUS = '女巫序列7的有限黑焰、冰霜、本人隐形、替身、占卜与反占卜、黑魔法据《诡秘之主》第一部第123章等已核范围实现。该章的黑焰诅咒使用真实血液媒介，知道目标姓名或ID不能代替媒介。本作不凭空制造血液或诅咒联系；术式、灵性消耗与五段和平练习是玩法G。继承四项刺客与一项教唆者掌握，保留诺艾拉·温瑟的原创成年独立导师渠道，不要求加入魔女教派，不以伤害他人或亲密关系作为消化条件。不提前开放序列6蛛丝、序列5疾病、任意变脸、无敌隐形或无限镜替。';
export const WITCH_ABILITIES: { id: WitchAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s7.black-flame', label: '有限黑焰', description: '在当前已确认对象与有限范围内操纵黑焰，效果依实际结算，不保证必中或必杀。媒介诅咒须有真实且仍有效的联系；目标ID、姓名、知识记录都不是血液媒介。不能使用猎人的火焰化身或压缩火球。' },
  { id: 'assassin.s7.frost', label: '冰霜', description: '对眼前有限对象制造冰霜或有限防护，受当前环境与实际灵性制约；不是大范围天气控制、绝对免伤或不计代价冻结。' },
  { id: 'assassin.s7.invisibility', label: '本人隐形', description: '短暂降低本人在现场的可见性；动作、声响、干扰与侦察仍可暴露，不让同行者隐形，不穿墙，不提供绝对隐身。' },
  { id: 'assassin.s7.substitute', label: '有限替身', description: '用实际持有且单独准备的小镜施作有限替身。原镜消费后不能复生或重复使用，失败也须按实际消耗记录；不是无限免伤或复活。' },
  { id: 'assassin.s7.divination-interference', label: '占卜与干扰', description: '围绕眼前实际标记做有限占卜对照和干扰，保留不确定性并与普通原记录核实；不读心，不凭空获得隐藏真相，也不保证阻断所有高位占卜。' },
  { id: 'assassin.s7.black-magic', label: '黑魔法', description: '以真实准备的施术材料和已确认对象进行有限仪式辨认。练习粉末与普通小镜是本作G耗材，和女巫魔药六料分开记账；不把粉末、姓名或目标ID冒充血媒介，不提前获得蛛丝和疾病。' },
];
export const WITCH_CONSUMPTION_RISK = `本段数值为本作玩法改编G：服药必定消耗所选女巫原瓶，0行动，意志难度18；教唆者扮演须达100且晋升后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。只有成功晋升才改变角色身体，失败保留原性别、消化与旧掌握。导师在场处理本次指导服药的排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。${WITCH_BODY_CHANGE}`;
