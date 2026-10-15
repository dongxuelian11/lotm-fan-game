import { CRIMSON_SCHOLAR_GUIDE } from '../crimson-scholar/content.js';
import type { WitchKingAbilityId } from './types.js';

/** Verified book/chapter references below; all numerical costs, sources and playable scenes are original G. */
export const WITCH_KING_GUIDE = CRIMSON_SCHOLAR_GUIDE;
export const WITCH_KING_PRICES = { guidance: 520, potion: 7200, labourCredit: 6300 } as const;
export const WITCH_KING_MIN_CRIMSON_SCHOLAR_WEEKS = 12;
export const WITCH_KING_LABOUR_STEPS = 5;
export const WITCH_KING_BOTTLE_IDS = ['witch-king-potion-1', 'witch-king-potion-2', 'witch-king-potion-3'] as const;
export const WITCH_KING_FORMULA_STATUS = '巫王的完整配方、材料名称与用量、完整仪式条件和步骤尚未核实，保持未知。艾琳只提供本作原创G渠道实际取得的独立序列4成品原瓶；指导不解锁臆造材料采购、完整配方或自制魔药。专业监督方案G并非已经还原的原著仪式。';
export const WITCH_KING_RITUAL_SOURCE = '第五部63《馈赠总是要归还》支持血族晋升到序列4也不能省略仪式；第六部69《换一个目标》支持取得非凡特性后准备仪式，但没有核实完整步骤。本作由艾琳联系原创成年血族女伯爵格蕾丝·维尔（214岁、成年外貌，巫王4，WK4-GRACE），她自愿在原许可私人仪式厅WK4-HALL亲自指导。每次另付240便士、1行动预约，下一真实周实际赴厅，另1行动由当前仍活着且愿意的本人使用唯一原封装包准备；0行动明确核对并选择继续，才开启本周窗口。服药无论成败均耗尽该包；取消或结束不退费、不赠送遗留原包。完整方法未知，不提供现实医疗或仪式操作步骤，也不把深红学者的旧满月仪式当作本阶已完成。';
export const WITCH_KING_SOURCE_STATUS = '第六部83《两处》支持巫王的月光化趋近本能、通常自然寿限约1200年，不能据此宣称永生、无敌、任意重组或死后复活。第六部84《降临的投影》支持会消耗的月亮纸人；85《最佳辅助》支持血月之箭，深渊枷锁仍沿用序列7原ID moon.s7.abyss-shackles，并可能无法命中难以预判的闪现。这里只新增月亮纸人和血月之箭两项，保留深红学者月光能力及药师、驯兽师、吸血鬼、魔药教授全部旧掌握、原血食和身体事实。召唤大师3仍未开放；高阶召唤门、天使、原封印物或戒指效果不属于本阶免费能力。全部纸张供给、练习人物、场地、价格、灵性、距离、时序、判定均为原创G，不冒充原著精确数值。';
export const WITCH_KING_POTION_SOURCES = WITCH_KING_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WITCH_KING_GUIDE}的独立巫王成品交接渠道实际封存第${index + 1}瓶序列4原瓶${id}；供给为原创G，不由药师至深红学者旧瓶改装。完整配方仍未知，当前专业指导仪式与原封装包须另行准备。`,
}));
export const WITCH_KING_LABOUR_TASKS = ['核对本瓶独立封签', '清点本瓶原运输箱', '整理本瓶交接凭据', '核验本瓶原供应记录', '完成本瓶封存记录复核'] as const;
export const WITCH_KING_ABILITIES: { id: WitchKingAbilityId; label: string; description: string }[] = [
  { id: 'moon.s4.moon-paper-substitute', label: '月亮纸人', description: '先明确准备实际持有的一张本作原创G月亮纸，再为当前一次有限避让生成短时纸人替身；使用会耗尽所选原纸，失败也不返还。只作当前实际威胁下的有限替代，不复制人物或灵魂，不永久免疫伤害，也不自动复活。准备、灵性、减伤和范围为G。' },
  { id: 'moon.s4.blood-moon-arrow', label: '血月之箭', description: '向实际可见、可达的原目标施放有限血月之箭，实际消耗灵性并检验命中；失败照耗且可因闪现或抗性落空。具体代价、威力和靶场为G，不无视遮挡或无限射程，不提供现实武器操作。' },
];
export const WITCH_KING_CONSUMPTION_RISK = '以下均为本作专业指导方案G：深红学者消化100、晋升后满12整周、健康>20且精神>40，实际持有一瓶原魔药，并在本周亲自到原厅、由当前活着且自愿的格蕾丝完成专业准备后，再独立确认饮药。0行动、意志难度28；四档都耗尽原瓶和本次唯一仪式包，关闭窗口并沿普通出口离场。大成功：晋升、精神−8；成功：晋升、精神−15；失败：健康−15、精神−25、排异+30；灾难：健康−25、精神−45、排异+60。专业监督仅将本次药物排异的健康与精神保底到1，不保护战斗。成功四属性各+1，全部旧掌握保留，两项新掌握从0，扮演归0，灵性上限120但当前不补满；原血食和身体性别不变。失败仍为深红学者，消化和旧经历不退，须正常休养；下一次另付费预约、下一真实周取得新原包并重新到场。';
