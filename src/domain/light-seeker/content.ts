import { JUSTICE_MENTOR_GUIDE } from '../justice-mentor/content.js';
import type { LightSeekerAbilityId, LightSeekerPreparationId } from './types.js';

/** The author's volume summary names Sun S2 Light Seeker (formerly Sun Chaser).
 * Formula, ritual and exact new powers are not source-verified. All finite mechanics below are original game design. */
export const LIGHT_SEEKER_GUIDE = JUSTICE_MENTOR_GUIDE;
export const LIGHT_SEEKER_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const LIGHT_SEEKER_MIN_JUSTICE_MENTOR_WEEKS = 12;
export const LIGHT_SEEKER_LABOUR_STEPS = 5;
export const LIGHT_SEEKER_BOTTLE_IDS = ['light-seeker-potion-1', 'light-seeker-potion-2', 'light-seeker-potion-3'] as const;
export const LIGHT_SEEKER_FORMULA_STATUS = '逐光者是太阳途径序列2。导师可以介绍独立封存的成品药瓶，并提供服药前的专业准备；当前渠道没有可供自行调配的完整配方。先充分消化正义导师魔药，留出十二整周，再逐项准备并承担服药风险。';
export const LIGHT_SEEKER_SOURCE_STATUS = '采光廊内，定向光辉只照亮当前通畅光路上的目标；有限收光只约束自己的这次光照。遮挡、时间、人的位置与当前许可都影响后续行动。停光以后，仍要沿普通地面走回、收好遮罩和刻字板、关好遮光闸。';
export const LIGHT_SEEKER_POTION_SOURCES = LIGHT_SEEKER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${LIGHT_SEEKER_GUIDE}介绍的逐光者成品渠道，初始批次第${index + 1}瓶，独立封存药瓶${id}。本瓶费用与专业准备分别结算。`,
}));
export const LIGHT_SEEKER_LABOUR_TASKS = ['核验本瓶封存记录', '清点本瓶交接箱与封签', '整理本瓶供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const LIGHT_SEEKER_PREPARATIONS: { id: LightSeekerPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_LIGHT_PATH', title: '检查光路与成品来源', description: '在指导场核对光源、遮挡、目标位置和药瓶封存记录。先看清已有物体和通路，再确定能照到什么；这一准备不提供新药瓶，也不预先打开采光廊的闸门。' },
  { id: 'REVIEW_EXPOSURE', title: '复核照射风险与当前许可', description: '逐项核对作用区内的人与灵，练习当面询问、确认当前位置并记录撤回意愿。以后到采光廊仍须重新询问；太阳光照对友善灵也有风险，不能仅凭友善关系省略避让。' },
  { id: 'PLAN_RETURN', title: '演练停光与普通返程', description: '按停光、归还原物、实际步行返回、关闭遮光闸的次序演练收尾。光照结束后，人员位置和物品磨损仍会保留，必须沿可用普通通路完成返程。' },
];
export const LIGHT_SEEKER_ABILITIES: { id: LightSeekerAbilityId; label: string; description: string }[] = [
  { id: 'sun.s2.guided-radiance', label: '定向辉光', description: '生活实践消耗7灵性、10秒，进行意志20检验；成功后形成20秒定向光照。必须在遮光闸开放且未损坏、当前许可有效时，实际陪同玛拉走到远端并核读已有刻字，才算完成应用。普通油灯可作为备用。战斗每次7灵性、意志20，光路通畅时提供105优势；若被闸遮住，该槽可改为一次普通开闸，不追加攻击或重抽。' },
  { id: 'sun.s2.limited-light', label: '限光', description: '生活实践先以3灵性、4秒建立小范围照明，再以6灵性、6秒进行知识20检验，合计9灵性、10秒。成功后20秒内收束自己的光照，仍须把同一遮罩放好，并让玛拉沿实际通路返回。检验失败保留普通光照和已付消耗，须停光后普通收尾。撤回许可后不能继续应用，友善灵也不会自动免疫。战斗每轮最多尝试一次，消耗6灵性、知识20；成功后仅抵减本轮下一次实际成功的敌方光击45，使用一次即耗尽，对棍击无效。' },
];
export const LIGHT_SEEKER_CONSUMPTION_RISK = '要求正义导师消化100、从实际晋升周起满12整周、健康>20且精神>40。先完成三项各1行动的专业准备，再付1行动与120便士检查当周服药场地，最后单独确认所选药瓶，饮用需要0行动。意志难度30：大成功晋升并消耗8精神；成功晋升并消耗15精神；失败不晋升，健康−15、精神−25、排异+30；严重失败不晋升，健康−25、精神−45、排异+60。每次药瓶与本次场地准备都会耗尽；三项专业经历保留，重试需要另一瓶和新的当周检查。现场专业照护使本次排异后的健康与精神最低为1。每瓶6200便士，或完成本瓶五项劳务后付800便士；全部现有药瓶失败耗尽后，可花1行动申请下一批，下一周起确认到货，新药瓶仍须逐瓶付费。成功使四项属性各+1，正义导师消化100留存，十八项已有掌握保持，两项新掌握从0开始。灵性上限120，当前灵性、身体性别、已有伤势、累计风险和过去人物物品记录均保持。';
