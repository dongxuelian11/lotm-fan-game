import { DREAM_STEALER_GUIDE } from '../dream-stealer/content.js';
import type { ParasiteAbilityId } from './types.js';

export const PARASITE_GUIDE = DREAM_STEALER_GUIDE;
export const PARASITE_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const PARASITE_MIN_DREAM_STEALER_WEEKS = 12;
export const PARASITE_LABOUR_STEPS = 5;
export const PARASITE_BOTTLE_IDS = ['parasite-potion-1', 'parasite-potion-2', 'parasite-potion-3'] as const;
/** Source paraphrases only; the finite consent, preparation, positions and costs are game rules. */
export const PARASITE_SOURCE_STATUS = '错误途径序列4寄生者的初步寄生能够共享宿主的视觉、听觉并隐蔽自身，不能直接读取或干涉宿主思想；交流须借宿主发声。全面寄生接近灵体融合，能够读取意图并接管身体。本段只开放原创成年托马斯·里德34岁、档案递送员在场自愿参与的有限接触；初步感官共享与单项木片搬运的全面控制分别取得同意，不扩张为永久许可或任意NPC夺舍。每个身体只有一个实际位置，唯一木片PR4-TOKEN-1仍归托马斯；入内后没有另一具留在外面自由行动的玩家身体或复制装备。长期寄生动物可能受到身份与生理影响，本段仅警示该风险，不编造安全时限或万能驱逐。序列4可将偷来的当前念头延后执行，选择其显现时机；窃得念头不等于同时取得所需能力，没有自身心智的秘偶不提供真实念头。继承的能力窃取可从同一真实目标取得最多三种不同能力，每次只偷一种，了解程度影响选择与成功，并非凭空拥有全能力库；已核对来源提及两小时维持期限。本段的场景时间、实际消耗、期限及返还处理均另列G实现，不套用火种手套的负面效果或十二小时、十分钟规则。完整寄生门槛、数量、距离和分离规则尚未充分核实，有限监督与分离保障仅为本作G。下一序列为欺瞒导师；本段不下放命运、身份窃取或天使分身。原导师艾德温·洛克、旧志愿者瑟蕾·芬恩和诺汀·布莱尔、全部旧物、借用与归还及敌人结局均保留。';
export const PARASITE_FORMULA_STATUS = '寄生者完整配方与晋升仪式细节尚未核实；不能据未知细节断言无需仪式。材料、用量、调配顺序及仪式步骤保持未知。本作原创G渠道只提供独立成品原瓶；原成年导师艾德温·洛克实际核对本次原瓶、准备原练习室的安静服药场地并在场照护，再指导本次服药。这是明确的G专业准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。';
export const PARASITE_POTION_SOURCES = PARASITE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PARASITE_GUIDE}经独立寄生者成品交接渠道实际取得的第${index + 1}瓶序列4寄生者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非任何旧序列原瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const PARASITE_LABOUR_TASKS = ['核对本瓶独立封签', '整理原练习室公开交接册', '清点原练习室普通桌椅', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const PARASITE_ABILITIES: { id: ParasiteAbilityId; label: string; description: string }[] = [
  { id: 'error.s4.parasitism', label: '有限寄生与共享感官', description: '初步寄生共享宿主实际看到、听到的内容，不能直接读取或干涉思想，交流借宿主发声。全面寄生可接管身体，本段须另行确认托马斯本人只对原木片搬运与归还的有限同意；原主意识及身体控制状态公开，原物不复制。监督、80便士准备、预留分离能力及有限场景均为G；不能对任意人强行寄生，也没有可自由行动的外部第二身体。' },
  { id: 'error.s4.deferred-thought', label: '当前念头暂存与延后显现', description: '窃取真实目标当前将要执行的念头后，不必本人立即执行；可以选择稍后让这一次具体行动显现。本段只使用自愿成年艾莉丝·伍德当前坐下的决定，G实施4灵性、意志18，成功后本人仍站立。公开选择在原椅安全位置执行或不执行而释放，随后核对目标恢复决定，不永久删除人格、不凭念头取得非凡能力。' },
];
export const PARASITE_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原练习室安静场地并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，窃梦家消化100且晋升后满12整周，并先结束旧实践、新接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。仅本次G指导服药的健康与精神最低保留1，导师照护后仍可休养；原瓶不会复原，此保护不适用于战斗或其它危险。失败保留窃梦家消化与全部旧掌握；成功四属性各+1，只新增有限寄生和延后念头两项0掌握，扮演从0开始，灵性上限120且当前灵性不补满。原性别、原老师、原物归属、实际借用/返还和敌人结局不变，不附赠能力库存。';
