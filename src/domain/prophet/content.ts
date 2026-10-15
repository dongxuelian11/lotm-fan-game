import { MYSTICISM_MAGISTER_GUIDE } from '../mysticism-magister/content.js';
import type { ProphetAbilityId } from './types.js';

/** Verified limits only; all people, originals, prices, scenes and numerical mechanics are G. */
export const PROPHET_GUIDE = MYSTICISM_MAGISTER_GUIDE;
export const PROPHET_PRICES = { guidance: 520, potion: 7200, labourCredit: 6300 } as const;
export const PROPHET_MIN_MYSTICISM_MAGISTER_WEEKS = 12;
export const PROPHET_LABOUR_STEPS = 5;
export const PROPHET_BOTTLE_IDS = ['prophet-potion-1', 'prophet-potion-2', 'prophet-potion-3'] as const;
export const PROPHET_FORMULA_STATUS = '预言家的完整配方、材料名称与用量、完整晋升仪式条件和步骤尚未核实，保持未知。塞缪尔只介绍本作原创G渠道实际取得的独立序列4成品原瓶；指导不解锁臆造材料采购、完整配方或自制魔药。秘术导师原非凡残材包与弱闪原件不是预言家配方材料，也不能代替成品原瓶。本作专业准备方案G不声称已经还原原著仪式，也不声称无需仪式。';
export const PROPHET_RITUAL_SOURCE = '完整原著仪式仍未核实。本作由塞缪尔联系独立原创专业人员玛莎·维尔（Martha Vell，64岁成年女性、预言家4，PF4-MARTHA），自愿在普通持照安静准备室PF4-HALL亲自监督；塞缪尔不是因此成为半神。每次另付240便士、1行动预约，下一真实周实际赴厅，另1行动由当前仍活着且愿意的本人使用唯一原封装包准备；0行动明确核对并选择继续，才开启本周窗口。服药无论成败均耗尽所选原瓶和该包；取消或结束不退费、不赠送原包，玩家沿普通出口离场，不移动专家。此为原创G专业准备，不提供现实医疗或仪式操作步骤，不能以秘术导师旧经历代替本次到场。';
export const PROPHET_SOURCE_STATUS = '白塔途径序列4预言家可得到需要解释的片段预见，包括梦中有限意象及对未来麻烦、可能帮助者的不确定提示。第五部7、11、152—153章中卢卡的表现不构成全知未来，也不保证避开灾难；解释仍可能偏差，实际帮助者仍须真实会面和调查。本作仅新增reader.s4.fragmentary-foresight与reader.s4.symbolic-interpretation，保留阅读者、推理学员、守知者、博学者和秘术导师全部原ID及原掌握、实际样本、原联系物和制造原件。自己的片段记录不能控制他人梦境、认定犯罪或迫使事情按预言发生；后续实际核验才形成事实。未来更高阶段待核，不开放全知未来、改写结果、时间停止、灵魂控制或任意技能库。诺拉、埃德温、乔纳斯、原窗板、原蓝门、原纸页与原包裹及具体场景，价格、灵性、距离、时序、减势与所有判定均为原创G，不冒充原著精确数值。';
export const PROPHET_POTION_SOURCES = PROPHET_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PROPHET_GUIDE}的独立预言家成品交接渠道实际封存第${index + 1}瓶序列4原瓶${id}；供给为原创G，不由阅读者至秘术导师旧瓶改装。完整配方仍未知，当前专业指导仪式与原封装包须另行准备。`,
}));
export const PROPHET_LABOUR_TASKS = ['核对本瓶独立封签', '清点本瓶原运输箱', '整理本瓶交接凭据', '核验本瓶原供应记录', '完成本瓶封存记录复核'] as const;
export const PROPHET_ABILITIES: { id: ProphetAbilityId; label: string; description: string }[] = [
  { id: 'reader.s4.fragmentary-foresight', label: '片段预见', description: '尝试获得自己的有限未来片段或梦中意象，可以失败，不能读取全部未来或保证规避麻烦。记录只是尚待核验的提示，不揭示秘密身份、替代真实见面调查或改写战斗结果；同一原物与人物继续按实际行为发展。灵性、判定及战斗减势均为G。' },
  { id: 'reader.s4.symbolic-interpretation', label: '意象解释', description: '将有限意象与实际已知背景联系，提出可被后续事实否定的解释。强解释不是已证实真相；须真实跨周返回、核对同一人物与原物后作有限报告。不从意象直接得知犯罪、伤害或帮助者身份，不迫使他人自愿，不令预言必然应验；实践和掌握结算均为G。' },
];
export const PROPHET_CONSUMPTION_RISK = '以下均为本作专业指导方案G：秘术导师消化100、晋升后满12整周、健康>20且精神>40，实际持有一瓶原魔药，并在本周亲自到原厅、由当前活着且自愿的玛莎完成专业准备后，再独立确认饮药。0行动、意志难度28；四档都耗尽原瓶和本次唯一仪式包，关闭窗口并沿普通出口离场。大成功：晋升、精神−8；成功：晋升、精神−15；失败：健康−15、精神−25、排异+30；灾难：健康−25、精神−45、排异+60。专业监督仅将本次药物排异的健康与精神保底到1，不保护战斗。成功四属性各+1，全部旧掌握保留，两项新掌握从0，扮演归0，灵性上限120但当前不补满；原身体性别、实际样本、原联系物与弱闪原件不变。失败仍为秘术导师，消化和旧经历不退，须正常休养；下一次另付费预约、下一真实周取得新原包并重新到场。';
