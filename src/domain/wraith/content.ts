import { ZOMBIE_GUIDE } from '../zombie/content.js';
import type { WraithAbilityId } from './types.js';
export { WRAITH_CASE_IDS } from './types.js';

/** Verified supernatural categories are distinct from all original G costs and finite procedures. */
export const WRAITH_GUIDE = ZOMBIE_GUIDE;
export const WRAITH_VOLUNTEER = '成年志愿者诺兰（Nolan）';
export const WRAITH_FLAG_ID = 'WF5-FLAG-1';
export const WRAITH_NOTE_ID = 'WF5-NOTE-1';
export const WRAITH_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const WRAITH_MIN_ZOMBIE_WEEKS = 12;
export const WRAITH_LABOUR_STEPS = 5;
export const WRAITH_BOTTLE_IDS = ['wraith-potion-1', 'wraith-potion-2', 'wraith-potion-3'] as const;
export const WRAITH_SOURCE_STATUS = '怨魂是被缚者途径序列5，承接囚犯9、疯子8、狼人7和活尸6。第二部第118章支持灵体化、穿过障碍、隐藏于镜面、灵体攻击、借真实反射面移动及附身，旧能力完整继承；本体转成怨魂，不在起点另留一具身体。第三部第245章支持露水、玻璃与结冰水面等实际反射面及可能被躲开的附身；更高位格可排斥附身并迫使显形，不是无条件或永久控制。第四部第147章莎伦的三百米镜面跳跃是她的个人表现，不是所有初晋怨魂的统一距离。本作只在原工坊两面相距4米、实际可见且已揭开的原固定镜子间往返；原侧廊可普通步行，不制造任意出口或自动携带同行者、手持物。原成年诺兰只同意本次一次举起原旗WF5-FLAG-1，可要求停止；这份同意是G场景约定，不是原著附身必备条件，更不是永久支配许可。失败可被排斥，成功也须实际退出，不读记忆、不知真相、不改变所有权。第二部第118章满月需吞食人类灵魂或承受极端虚弱；此处开放不伤人的虚弱分支，不创造受害者。怨魂发作替换旧活尸剧痛与狼人嗜血形态，不三重叠收，旧月相历史保留。序列4为木偶，不是占卜家途径秘偶大师；不提前获得器物操控、纸人联系或诅咒之源。哈伦、诺兰、贝文、两面原镜、原旗、原记录纸WF5-NOTE-1、有限实践、八场原月相告示及全部距离、费用、判定和持续时间均为原创G。莎伦、马里奇的特定药物与绯红月冕不属于全体怨魂标准能力。和平100是有成本的G玩法，不是原著保证的无风险消化法或诅咒解药。';
export const WRAITH_FORMULA_STATUS = '怨魂完整配方、主辅材料及其用量、调配顺序与6→5晋升仪式细节尚未核实，不能据未知细节断言无需仪式。本作原创G渠道只交付独立成品原瓶；同一位原成年导师哈伦·维斯实际核对本次原瓶、准备原旧工坊的安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。此前囚犯、疯子、狼人和活尸的原瓶、原晋升、实践事实、原能力、风险与月相历史完整保留。';
export const WRAITH_POTION_SOURCES = WRAITH_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WRAITH_GUIDE}经独立怨魂成品交接渠道实际取得的第${index + 1}瓶序列5怨魂成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非囚犯、疯子、狼人或活尸旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const WRAITH_LABOUR_TASKS = ['核对本瓶独立封签', '整理原旧工坊公开交接册', '清点原镜遮布与普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const WRAITH_ABILITIES: { id: WraithAbilityId; label: string; description: string }[] = [
  { id: 'chained.s5.reflection-step', label: '灵化与反射面移动', description: '自身实际转为怨魂形态，通过当前真实可达的反射面移动；没有另留在起点的本体。本作G原工坊练习只开放两面相距4米、可见且实际揭开的原固定镜子，1行动、3灵性和知识14判定支付本次有限往返预算，失败同样需要实际返回。成功或失败均在原壁龛保持本次状态，0行动、0追加灵性沿同一原镜实际返回原室后显形并盖镜。只带已有衣物，不带原旗、他人或任意手持物。普通方法沿原侧廊实际步行往返，没有镜面移动或能力掌握。战斗短暂灵化只提供该次槽位有限自保，槽位结束前完全显形，没有整场无敌或永久免疫。' },
  { id: 'chained.s5.spirit-possession', label: '灵体攻击与有限附身', description: '灵体攻击不保证即死；附身有条件、可失败或被排斥，不能读取全部记忆、永久控制人格或夺走物件所有权。本作G和平实践只对原成年诺兰实施本次同意的一次原旗举起，1行动、3灵性、知识14，失败仍耗费并被排斥显形；成功暂在原宿主体内，必须0行动、0追加灵性实际退出显形，由诺兰将同一原旗放回原桌。实战只对当前2米内原贝文尝试一次短暂迟疑，3灵性、知识14，每回合最多尝试一次，并在同一次动作结束前明确退出；成功仅使本回合下一次实际正贡献普通攻击减半一次，不即时伤害、不永久操控。' },
];
export const WRAITH_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年哈伦在场核对本次原瓶、实际准备原旧工坊安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；活尸消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。哈伦处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗、满月或其它危险。失败保留活尸消化及全部原掌握；成功仅新增chained.s5.reflection-step与chained.s5.spirit-possession两项0掌握，四属性各+1，灵性上限100但当前灵性不补满。全部旧ID、原瓶、实践、原物、亡者协助、敌人结果和月相记录保留。必须先结束旧接触并度过旧月圆，才能晋升。怨魂满月极端虚弱取代旧发作，不能战斗或继续普通活动；沿原八场有限G告示，哈伦在原工坊守望至多消耗10精神，或当前地点独处至多20精神，实际等待本次发作结束，不恢复资源、不增长扮演、不伤害他人，也不保证诅咒消失。没有序列4木偶能力。';
