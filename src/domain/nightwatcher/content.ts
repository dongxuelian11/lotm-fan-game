import { SPIRIT_WARLOCK_GUIDE } from '../spirit-warlock/content.js';
import type { NightwatcherAbilityId } from './types.js';

/** Verified capability boundaries; concrete sources, scenes and all numerical budgets are original G. */
export const NIGHTWATCHER_GUIDE = SPIRIT_WARLOCK_GUIDE;
export const NIGHTWATCHER_PRICES = { guidance: 520, potion: 7200, labourCredit: 6300 } as const;
export const NIGHTWATCHER_MIN_SPIRIT_WARLOCK_WEEKS = 12;
export const NIGHTWATCHER_LABOUR_STEPS = 5;
export const NIGHTWATCHER_BOTTLE_IDS = ['nightwatcher-potion-1', 'nightwatcher-potion-2', 'nightwatcher-potion-3'] as const;
export const NIGHTWATCHER_FORMULA_STATUS = '守夜人的完整配方、材料名称与用量、完整仪式条件和步骤尚未核实，保持未知。赛琳只介绍本作原创G渠道实际取得的独立序列4成品原瓶；指导不解锁臆造材料采购、完整配方或自制魔药。因斯从看门人跨途径晋升时利用后裔特性与圣者骨灰的特殊个案，不能推作守夜人的通用配方或通用仪式。本作专业准备方案G不声称已经还原原著仪式，也不声称无需仪式。';
export const NIGHTWATCHER_RITUAL_SOURCE = '完整原著仪式仍未核实。本作由赛琳联系独立原创专业人员奥黛莉娅·黑尔（Odelia Hale，66岁成年女性、守夜人4，NW4-ODELIA），自愿在普通持照安静准备室NW4-HALL亲自监督；她不是原著奥黛丽，也不把赛琳推定为半神。每次另付240便士、1行动预约，下一真实周实际赴厅，另1行动由当前仍活着且愿意的本人使用唯一原封装包准备；0行动明确核对并选择继续，才开启本周窗口。服药无论成败均耗尽所选原瓶和该包；取消或结束不退费、不赠送原包，玩家沿普通出口离场，不移动专家。此为原创G专业准备，不提供现实医疗或仪式操作步骤，不能以灵巫旧经历代替本次到场。';
export const NIGHTWATCHER_SOURCE_STATUS = '黑暗途径序列4守夜人的有限厄运可以失败，范围梦境也可能对秘偶等目标失效；本阶不保证任何人入睡。本作仅新增darkness.s4.limited-misfortune与darkness.s4.area-dream，保留不眠者、午夜诗人、梦魇、安魂师和灵巫全部原ID及原掌握。卷叶仍是旧SW5-LEAF-1，必须已经实际取得、当前封存且来源有效才可调用；晋升不附送灵体库。维持梦境时本体不移动的限制继续生效。因斯借助外部红天使与看门人能力的灵界旅行不属于本阶天赋；恐惧主教3仍未开放，恐惧、睡眠与黑暗毁灭的高阶联合不能提前作为本阶攻击。不授予瞬移、复活、窃取或寄生。原梅森、伊尔瓦、手推车、纸条和场地等具体场景，价格、灵性、距离、时序、范围、减势与所有判定均为原创G，不冒充原著精确数值。';
export const NIGHTWATCHER_POTION_SOURCES = NIGHTWATCHER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${NIGHTWATCHER_GUIDE}的独立守夜人成品交接渠道实际封存第${index + 1}瓶序列4原瓶${id}；供给为原创G，不由不眠者至灵巫旧瓶改装。完整配方仍未知，当前专业指导仪式与原封装包须另行准备。`,
}));
export const NIGHTWATCHER_LABOUR_TASKS = ['核对本瓶独立封签', '清点本瓶原运输箱', '整理本瓶交接凭据', '核验本瓶原供应记录', '完成本瓶封存记录复核'] as const;
export const NIGHTWATCHER_ABILITIES: { id: NightwatcherAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s4.limited-misfortune', label: '有限厄运', description: '只对实际在场的有限目标尝试施加厄运，可能失败，不能随意制造必然事故或远程改写命运。本作在有同意、已知安全的场地针对原空车既存不平轮尝试停顿；失败仍沿原路到终点，不凭空损坏车轮。灵性、距离、判定和战斗减势均为G。' },
  { id: 'darkness.s4.area-dream', label: '范围梦境', description: '在有限范围尝试影响当前实际目标，各目标分别检验是否入梦，可以部分成功或全部抵抗。维持时自己的原身体保持不动，结束时只唤醒实际入梦者，不擦除记忆、治愈疾病或把梦中陈述当作真相；秘偶等目标可能不受影响。具体灵性、距离、时长与判定均为G。' },
];
export const NIGHTWATCHER_CONSUMPTION_RISK = '以下均为本作专业指导方案G：灵巫消化100、晋升后满12整周、健康>20且精神>40，实际持有一瓶原魔药，并在本周亲自到原厅、由当前活着且自愿的奥黛莉娅完成专业准备后，再独立确认饮药。0行动、意志难度28；四档都耗尽原瓶和本次唯一仪式包，关闭窗口并沿普通出口离场。大成功：晋升、精神−8；成功：晋升、精神−15；失败：健康−15、精神−25、排异+30；灾难：健康−25、精神−45、排异+60。专业监督仅将本次药物排异的健康与精神保底到1，不保护战斗。成功四属性各+1，全部旧掌握保留，两项新掌握从0，扮演归0，灵性上限120但当前不补满；原身体性别、卷叶状态与旧经历不变。失败仍为灵巫，消化和旧经历不退，须正常休养；下一次另付费预约、下一真实周取得新原包并重新到场。';
