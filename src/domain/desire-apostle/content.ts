import { DEMON_GUIDE } from '../demon/content.js';
import type { DesireApostleAbilityId } from './types.js';
export { DESIRE_APOSTLE_CASE_IDS } from './types.js';

/** Verified supernatural boundaries are distinct from every original G cost and procedure. */
export const DESIRE_APOSTLE_GUIDE = DEMON_GUIDE;
export const DESIRE_APOSTLE_CALM_VOLUNTEER = '成年志愿者蕾娜（Reina）';
export const DESIRE_APOSTLE_VOLUNTEER = '成年志愿者米蕾尔（Mirel）';
export const DESIRE_APOSTLE_LEDGER_ID = 'DA5-LEDGER-1';
export const DESIRE_APOSTLE_NOTE_ID = 'DA5-NOTE-1';
export const DESIRE_APOSTLE_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const DESIRE_APOSTLE_MIN_DEMON_WEEKS = 12;
export const DESIRE_APOSTLE_LABOUR_STEPS = 5;
export const DESIRE_APOSTLE_BOTTLE_IDS = ['desire-apostle-potion-1', 'desire-apostle-potion-2', 'desire-apostle-potion-3'] as const;
export const DESIRE_APOSTLE_SOURCE_STATUS = '欲望使徒是深渊途径序列5，承接恶魔6。第二部第201章支持借目标已经存在的强烈情绪波动或明显欲望埋下种子、随后催化，可能逐渐使其堕落或在关键时刻失去反抗；不是无条件控制任何心智。第二部第212章明确情绪平稳、欲望内敛的目标无法操控催化，催爆恐惧致死是具体实战个例，不是对任意目标自动停止心脏。第三部第203章的延迟与对手实际平复情绪使催化失败，特定受控者的十余秒延迟不是通用施法时间。第三部第202章燃烧羊角是个体实战代价，第二部第212章影化、舍身留影是该恶魔特点；本次不将其当作全体欲望使徒常驻技能。序列4是魔鬼，不是污秽君王；序列4能力与仪式不提前解锁。旧恶魔危险预感、身体、火焰能力及其限制、丧失原有良知与恶欲失控风险均保留。原成年导师罗安·费里、蕾娜（Reina）、米蕾尔（Mirel）、看守费兰（Ferran）、原旧货库练习室、原记录册DA5-LEDGER-1与原记录纸DA5-NOTE-1均为本作原创G。志愿者对一次有限练习明确同意是本作场景安排，不是原著魔法的通用条件。准备、距离、判定、资源费用、种子持续与效果比例全是原创G；和平100是有成本的替代玩法，不是原著保证的无代价安全消化法。不读隐藏思想、记忆或真相，不创造永久忠诚。';
export const DESIRE_APOSTLE_FORMULA_STATUS = '欲望使徒完整配方、主辅材料及其用量、调配顺序与6→5晋升仪式细节尚未核实，不能据未知细节断言无需仪式。本作原创G渠道只交付独立成品原瓶；同一位原成年导师罗安·费里实际核对本次原瓶、准备原旧货库练习室的安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。此前罪犯、折翼天使、连环杀手与恶魔的原瓶、原晋升、实践事实、原能力及风险记录完整保留。';
export const DESIRE_APOSTLE_POTION_SOURCES = DESIRE_APOSTLE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DESIRE_APOSTLE_GUIDE}经独立欲望使徒成品交接渠道实际取得的第${index + 1}瓶序列5欲望使徒成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非罪犯、折翼天使、连环杀手或恶魔旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const DESIRE_APOSTLE_LABOUR_TASKS = ['核对本瓶独立封签', '整理原旧货库公开交接册', '清点原练习室普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const DESIRE_APOSTLE_ABILITIES: { id: DesireApostleAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s5.emotion-seed', label: '强烈情绪中的种子', description: '只有当前真实目标已经有强烈情绪或明显欲望时才可能埋下种子。平静者不满足条件，不能借按钮强迫其产生感情。本作G和平练习仅限原成年米蕾尔对自己所选舞台排演的真实兴奋与明确同意，花1行动、3灵性，知识14判定，失败照耗；成功仅留下待催化种子，不直接控制或奖励。种子只在本次有限实践中等待，0行动停止并等过本次约定窗口后到期，不保证消除一切诅咒。实战对当前仍强烈激动的费兰花3灵性、知识14，成功也无即时伤害或胜势；本次与下一回合的窗口属于G，不是原著统一寿命。' },
  { id: 'abyss.s5.catalysis', label: '有限催化', description: '催化必须有实际种子，且目标仍处于强烈情绪；情绪平复会阻止催化。和平实践在同一次已付行动中另花2灵性、知识14判定，0额外行动；成功只记米蕾尔一次短暂可见迟疑，不改写忠诚或读取真相，失败仍耗灵性并消耗本次种子。0灵性时仍可停止，不能强制继续。实战花2灵性、知识14，只把本回合下一次实际正贡献普通身体攻击减为一半一次，不追加即时健康伤害或控制全部行动。种子、催化均有失败可能，不自动投降、杀死或迫使自伤。' },
];
export const DESIRE_APOSTLE_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原旧货库练习室安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；恶魔消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。罗安·费里处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留恶魔消化及全部原掌握；成功仅新增abyss.s5.emotion-seed与abyss.s5.catalysis两项0掌握，四属性各+1，灵性上限100但当前灵性不补满。全部旧ID、原瓶、实践事实和已解决敌人记录完整保留；良知不恢复，恶欲风险不消失，不赠送个体燃角招式、影化能力或序列4魔鬼能力。G和平路线不是原著无风险消化保证。';
