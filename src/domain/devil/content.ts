import { DEMON_GUIDE } from '../demon/content.js';
import { DESIRE_APOSTLE_CALM_VOLUNTEER, DESIRE_APOSTLE_VOLUNTEER } from '../desire-apostle/content.js';
import type { DevilAbilityId } from './types.js';

/** Every preparation, cost, training name, scene and numerical rule below is game-original G. */
export const DEVIL_GUIDE = DEMON_GUIDE;
export const DEVIL_CALM_VOLUNTEER = DESIRE_APOSTLE_CALM_VOLUNTEER;
export const DEVIL_VOLUNTEER = DESIRE_APOSTLE_VOLUNTEER;
export const DEVIL_PROGRAM_ID = 'DV4-PROGRAM-1';
export const DEVIL_INVITATION_ID = 'DV4-INVITATION-1';
export const DEVIL_NOTE_ID = 'DV4-NOTE-1';
export const DEVIL_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const DEVIL_MIN_DESIRE_APOSTLE_WEEKS = 12;
export const DEVIL_LABOUR_STEPS = 5;
export const DEVIL_BOTTLE_IDS = ['devil-potion-1', 'devil-potion-2', 'devil-potion-3'] as const;
export const DEVIL_SOURCE_STATUS = '魔鬼是深渊途径序列4，承接欲望使徒5；它与恶魔6是不同序列。下一阶名称为呓语者，序列3的数字衔接来自原著人物推断，不冒充原著直接给出的完整序列表。魔鬼4完整技能表、完整配方与晋升仪式仍未核实。本切片的“欲望聚焦”“有限催化压力”是明确标注的本作原创G训练名称与欲望使徒继承机制强化，不是新核实的原著技能名；仍以当前目标已经存在的强烈情绪或明显欲望为前提，情绪平稳、欲望内敛或抵抗者不自动受控。长生泉骗局与晋升仪式或消化的关联仅为推测，不设成强制屠杀任务。堕落之笛属于具体物品，不能把它的效果整包授予魔鬼职业；不授普遍降智、固定一至两天预警、免费契约、灵魂所有权或原初恶魔高位能力。原成年导师罗安·费里、原成年蕾娜与米蕾尔沿用同一人，新原节目单DV4-PROGRAM-1、新原邀请纸DV4-INVITATION-1和新原记录纸DV4-NOTE-1均为本作原创G，旧DA5-LEDGER-1、DA5-NOTE-1及原费兰、莫顿结局保持历史。场景、对手、同意范围、距离、持续时间、成本、奖励及判定全为G；三项实践均有普通方法。有限有成本的和平100不是原著保证的无代价安全消化，丧失原有良知、恶欲风险与旧恶魔紧绷均不重置；不读取隐藏思想或保证永久忠诚。';
export const DEVIL_FORMULA_STATUS = '魔鬼完整配方与晋升仪式细节尚未核实，不能据未知细节断言无需仪式。主辅材料、用量、调配顺序与仪式步骤保持未知。本作原创G渠道只交付独立成品原瓶；同一位原成年导师罗安·费里实际核对本次原瓶、准备原旧货库练习室的安静服药位置并在场照护。这是明确的G专业准备流程，不冒充已还原原著仪式，也不解锁完整配方、材料采购或魔药调配。罪犯、折翼天使、连环杀手、恶魔与欲望使徒的原瓶、晋升、原人物、原物、能力及实际风险历史完整保留。';
export const DEVIL_POTION_SOURCES = DEVIL_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DEVIL_GUIDE}经独立魔鬼成品交接渠道实际取得的第${index + 1}瓶序列4魔鬼成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非罪犯、折翼天使、连环杀手、恶魔或欲望使徒旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const DEVIL_LABOUR_TASKS = ['核对本瓶独立封签', '整理原旧货库公开交接册', '清点原练习室普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const DEVIL_ABILITIES: { id: DevilAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s4.desire-focus', label: '欲望聚焦（原创G）', description: '明确的G训练名称及继承欲望使徒机制的有限强化，不是已核实原著技能名。仍须当前真实目标已经有强烈情绪或明显欲望，不能由按钮制造恐惧、兴奋或隐藏思想。和平练习限原成年米蕾尔对自己选择的新节目真实兴奋并明确同意的一次试验：1行动、4灵性、知识18；成功只留下实际种子，尚无催化效果或扮演奖励，失败照付。她可明确撤回同意并实际平复，种子到期；普通谈话不施法。实战同样支付4灵性、知识18，种子只保留埋下当轮及随后两轮的G窗口，不因观察或重抽延长。' },
  { id: 'abyss.s4.catalytic-pressure', label: '有限催化压力（原创G）', description: '明确的G训练名称及继承催化机制强化，不是新增原著技能定论。必须已有同一实际种子且目标当前仍有强烈情绪；3灵性、知识18，成败都消费原种子。和平试验在已付实践内0额外行动，成功只留下30秒内一次可见迟疑的G结果，不迫使交出节目单或改写忠诚，仍须实际结束接触才可报告；可0行动等待原60秒G窗口结束。实战成功只令本轮下一次实际正贡献身体打击或弧光攻击减半一次，敌人原施法成本照付，护术不消耗该效果；不追加即时健康伤害、不控制全部行动、不形成魔法契约。' },
];
export const DEVIL_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原旧货库练习室安静位置并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，欲望使徒消化100且晋升后满12整周，并先结束旧实践、新接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。仅本次G指导服药的健康与精神最低保留1，导师照护后仍须休养；原瓶不会复原，此保护不适用于战斗或其它危险。失败保留欲望使徒消化与全部旧掌握；成功四属性各+1，只新增欲望聚焦与有限催化压力两项G名称0掌握，扮演从0开始，欲望使徒消化100快照保留，灵性上限120且当前灵性不补满。身体与性别不变化；全部旧ID、原瓶、原人物、原物、旧种子、旧敌结局、旧紧绷、良知与恶欲风险完整保留。不赠完整技能表、神话形态、笛子物品效果、免费契约或高位权柄。';
