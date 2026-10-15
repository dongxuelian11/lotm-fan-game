import { VAMPIRE_GUIDE } from '../vampire/content.js';
import type { PotionProfessorAbilityId, PotionProfessorAssistanceKind } from './types.js';
export { POTION_PROFESSOR_CASE_IDS } from './types.js';

/** Book 3 ch.127; Book 4 ch.15/64; Book 5 ch.63. All implementations and quantities below are fictional G. */
export const POTION_PROFESSOR_GUIDE = VAMPIRE_GUIDE;
export const POTION_PROFESSOR_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const POTION_PROFESSOR_KIT_PRICE = 100;
export const POTION_PROFESSOR_MIN_VAMPIRE_WEEKS = 12;
export const POTION_PROFESSOR_LABOUR_STEPS = 5;
export const POTION_PROFESSOR_BOTTLE_IDS = ['potion-professor-potion-1', 'potion-professor-potion-2', 'potion-professor-potion-3'] as const;
export const POTION_PROFESSOR_SOURCE_STATUS = '第三部第127章支持随身带有灵性材料并事先调配药剂；第四部第15章的静步、去味、身体透明与衣物透明需要分别准备，普通衣物和气味不会随身体透明自动消失。第四部第64章的太阳之水也会伤害本人，本阶段只说明风险，不实装攻击药。第五部第63章支持向愿意学习的平民教学与研究的扮演方向。保留药师、驯兽师、吸血鬼全部原ID与掌握，以及原血食与身体代价；没有序列5满月场域、月光闪现或重组能力。导师沿已认识的艾琳渠道；本阶段成年角色、封闭教学卡、低强灵性材料、四种辅助药的有限效果、短效等待、价格、供给和判定均为原创G，不冒充原著完整配方，也不提供现实制药教程。';
export const POTION_PROFESSOR_FORMULA_STATUS = '魔药教授完整晋升配方尚未核实；用药指导不解锁完整配方、配方采购或晋升魔药制造，只交付原创G渠道实际供应的序列6独立成品原瓶。辅助药仅按本作G已知教学卡封闭调配，不输出真实材料或操作配方，也不是晋升魔药。';
export const POTION_PROFESSOR_POTION_SOURCES = POTION_PROFESSOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${POTION_PROFESSOR_GUIDE}经独立魔药教授成品交接渠道实际取得的第${index + 1}瓶序列6魔药教授成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非药师、驯兽师或吸血鬼旧瓶改装，未声称掌握完整配方。`,
}));
export const POTION_PROFESSOR_LABOUR_TASKS = ['核对本瓶独立封签', '整理原药房普通存放格', '清点原教学区普通器具', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const POTION_PROFESSOR_ABILITIES: { id: PotionProfessorAbilityId; label: string; description: string }[] = [
  { id: 'moon.s6.support-potions', label: '有限辅助药剂', description: '凭已知教学卡和真实持有的灵性材料事先制药，成功才有可携带的独立原瓶。静步、去味、身体透明、衣物透明分别准备和消耗；身体透明不隐藏普通衣物或气味，不穿墙，不无限隐身。此次只在原室短时实践，不把药效带入战斗。' },
  { id: 'moon.s6.potion-teaching', label: '药剂研究与教学', description: '对已有真实结果进行有限研究，向愿意学习的成年人说明原瓶来源、失败成本、分别准备与实际结束的边界；对方可以不理解或拒绝。教学不凭空产生药剂、配方或高阶能力，也不强迫学习。' },
];
export const POTION_PROFESSOR_ASSISTANCE: Record<PotionProfessorAssistanceKind, { title: string; card: string; effect: string }> = {
  QUIET_STEP: { title: 'G静步辅助药', card: 'G教学卡·静步', effect: '只在原室已核实地面有限走动，实际比较脚步声；不能穿墙或无视地面。' },
  ODOR_VEIL: { title: 'G去味辅助药', card: 'G教学卡·去味', effect: '只短时降低原室这次核验中的自身气味信号，不隐去身体或普通衣物。' },
  BODY_VEIL: { title: 'G身体透明辅助药', card: 'G教学卡·身体透明', effect: '只短时使身体透明；普通衣物仍可见，气味仍在，不能当作完整隐身。' },
  CLOTH_VEIL: { title: 'G衣物透明辅助药', card: 'G教学卡·衣物透明', effect: '独立原瓶只处理本次穿着的普通衣物，不替代身体透明或去味。' },
};
export function potionProfessorAssistanceSource(kind: PotionProfessorAssistanceKind, kit: number): string {
  return `${POTION_PROFESSOR_ASSISTANCE[kind].title}，按原药房已知${POTION_PROFESSOR_ASSISTANCE[kind].card}封闭调配，实际耗用第${kit}包原创G封装低强灵性材料1份；非真实材料或操作配方。`;
}
export const POTION_PROFESSOR_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；吸血鬼消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗与其它危险。失败保留吸血鬼消化与全部原掌握；成功只新增两项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
