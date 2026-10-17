import type { ApothecaryAbilityId, ApothecaryCaseId } from './types.js';
export { APOTHECARY_CASE_IDS } from './types.js';

/** S9 can prepare drugs for bleeding/healing and a calming medicine with spiritual materials,
 * resist toxins and observe body/aura clues. Strong physique and animal taming belong to S8.
 * Mentor, clinic, individual finished bottles, cases and every number below are game content (G).
 * Only main ingredients are verified; missing auxiliaries must never become a fake formula. */
export const APOTHECARY_GUIDE = '药师导师艾琳·摩尔';
export const APOTHECARY_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const APOTHECARY_BOTTLE_IDS = ['apothecary-potion-1', 'apothecary-potion-2', 'apothecary-potion-3'] as const;
export const APOTHECARY_POTION_SOURCES = APOTHECARY_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${APOTHECARY_GUIDE}诊所保管的第${index + 1}瓶药师成品魔药，原瓶独立封存；导师与诊所供给为本作原创G，未声称在诊所配制。`,
}));
export const APOTHECARY_FORMULA_STATUS = '药师完整配方资料待核：仅核实主材为成年独角飞马的角（未记克重）与皇冠水母毒液结晶3克，辅助材料尚未核实。目前只取得独立封存的成品原瓶，不开放晋升魔药配方学习与制造。';
export const APOTHECARY_ABILITIES: { id: ApothecaryAbilityId; label: string; description: string }[] = [
  { id: 'moon.s9.pharmacy', label: '药物配制', description: '以实际材料提前准备止血、促进伤口愈合的药物，或含灵性材料的安抚药。护理使用真实库存；不能复活、再生肢体或净化非凡污染。这里的药物与效果为游戏内容，不提供现实配药教程。' },
  { id: 'moon.s9.aura-observation', label: '身体与气场观察', description: '观察身体表现和气场中的线索，再结合询问判断护理需要；观察不是绝对诊断，未知病因与超出能力的情况仍应转诊。' },
  { id: 'moon.s9.toxin-resistance', label: '毒素抗性', description: '具有较强毒素抗性，但不是对所有毒物绝对免疫，也不能代替他人解毒或抵消非凡污染；强壮体魄与驯兽不是序列9能力。' },
];
export const APOTHECARY_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';

/** Three original game cases. Their underlying state stays private until clinic observation. */
export const APOTHECARY_CASES=[
 {id:'workshop-cut',title:'工坊里的划伤',story:'成年装订工玛莎来到诊所，愿意让你查看刚刚被薄铁边划破的前臂。她已经离开机器，原工具由工坊保管。',health:72,mind:80,observations:['她能清楚回答问题，伤口仍有少量渗血。','你在本人同意下看见局部外伤；这不是对全部内脏状态的检查。','导师确认本次可用已制备的普通外伤护理剂，也可交由诊所继续处理。'],care:'使用1份原外伤护理剂并记录恢复',result:'你实际用掉一份外伤护理剂，处理局部渗血，玛莎健康72→84。伤处仍需继续观察，未宣称瞬间痊愈或修复所有损伤。'},
 {id:'night-fever',title:'夜里持续的发热',story:'成年抄写员布兰带着自己记下的发热时段来诊所。他允许观察身体气场与普通外观，但病因尚未确定。',health:65,mind:70,observations:['布兰面色疲惫，记录表显示发热反复。','你可见气场的异常，但仅凭颜色不能区分所有可能病因。','本次护理剂不能作为未知病因的万能解药。'],care:'记录症状，说明不确定处并预约诊所复诊',result:'你整理真实症状和时间记录，没有试用不相干药剂，也没有把气场颜色当确诊。布兰接受诊所复诊安排；当前健康仍65，后续疗效未知。'},
 {id:'shaken-courier',title:'惊慌的成年信使',story:'成年信使文森特经历一场街头惊吓后主动求助。本人清醒，愿意讨论是否接受导师核准的本次安神护理；这不是处理非凡失控的办法。',health:95,mind:35,observations:['他讲话连贯，但双手颤抖，难以安静坐下。','本人确认愿意接受本次有限安神护理，也可以选择诊所继续观察。','没有证据证明他被控制或污染，不能据此作出神秘学诊断。'],care:'本人同意后使用1份原安神剂',result:'本人再次同意后，你实际用掉一份安神剂；文森特精神35→45，逐渐能坐下继续交谈。没有读心、控制意志或清除污染，仍需休息与观察。'},
] as const;
