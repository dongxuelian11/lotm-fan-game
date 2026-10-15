import { MANIPULATOR_GUIDE } from '../manipulator/content.js';
import type { DreamWeaverAbilityId, DreamWeaverPreparationId } from './types.js';

export const DREAM_WEAVER_GUIDE = MANIPULATOR_GUIDE;
export const DREAM_WEAVER_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const DREAM_WEAVER_MIN_MANIPULATOR_WEEKS = 12;
export const DREAM_WEAVER_LABOUR_STEPS = 5;
export const DREAM_WEAVER_BOTTLE_IDS = ['dream-weaver-potion-1', 'dream-weaver-potion-2', 'dream-weaver-potion-3'] as const;
export const DREAM_WEAVER_FORMULA_STATUS = '织梦人的完整配方与晋升仪式尚未核实：材料、用量、调配顺序及仪式要求保持未知，不能断言无需仪式。本阶段只采用本作原创G专业指导与独立序列3成品渠道，不解锁虚构配方或调配。三项专业准备和当次场地检查均为G支持流程，不冒充原著仪式，也不重复操纵师的万人共鸣。';
export const DREAM_WEAVER_SOURCE_STATUS = '已核原文支持分割外部身份，身份与本人思想、心思共通；逼真形象在目标相信时可造成精神后果，识破与精神抵抗可以制约。本阶段最多一具外部身份，60秒、6米、具体代价与有限场景均为本作原创G。身份不是新灵魂、独立资源池或第二套装备，不能生成真钱、原物或额外完整攻击回合；未取得的事实不会自动得知。旧观众至操纵师全部原ID掌握保留，原人格、七滴泪与旧集会不重造；不提前获得洞察者2权柄。';
export const DREAM_WEAVER_POTION_SOURCES = DREAM_WEAVER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DREAM_WEAVER_GUIDE}的独立织梦人成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非操纵师或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`,
}));
export const DREAM_WEAVER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const DREAM_WEAVER_PREPARATIONS: { id: DreamWeaverPreparationId; title: string; description: string }[] = [
  { id: 'INSPECT_ROUTE', title: '亲自踏查原阅览室普通路线', description: '本人实际走过原阅览室近桌、远桌及普通出口，确认3米开放通路；只记录亲自取得的现场事实，不产生外部身份或远处知识。' },
  { id: 'CHECK_ORIGINALS', title: '核对原物与本人状态', description: '在专业指导下实际检查本人状态与原场器材，确认每件原物只有一份并归位；不复制物品、继承旧同意或代办当前服药场地检查。' },
  { id: 'PLAN_WITHDRAWAL', title: '实际演练中止与返回安排', description: '本人沿原普通路线演练停止、求助和离场，并记录外部身份不能替本人移动、补精神或复活的边界；这是本作G专业准备，不完成任何原著仪式。' },
];
export const DREAM_WEAVER_ABILITIES: { id: DreamWeaverAbilityId; label: string; description: string }[] = [
  { id: 'audience.s3.external-identity', label: '有限外部身份', description: '实际分割最多一具保留本名的外部身份，与本人共通已经取得的心思和知识。在6米、60秒的G有限范围内可沿普通路走动、观察和交谈；使用5灵性与本人2精神、意志难度16。不能搬运原物、生成钱或装备，也无第二份资源池；归并不移动本人、不复活伤亡。' },
  { id: 'audience.s3.woven-image', label: '有限织梦形象', description: '编织一项逼真形象，目标相信时产生有限真实精神后果，识破或既有精神抵抗可制。生活演示须当前知情成人明确同意并能随时停止，6灵性、意志难度16及场景限额为G；结束须现实核对唯一原物，不能生成新实体、真神或无条件控制。' },
];
export const DREAM_WEAVER_CONSUMPTION_RISK = '以下全部具体规则为本作G：操纵师消化100、从操纵师实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，旧掌握与操纵师消化100保留，两项新能力掌握0；灵性上限仍120且当前不补满，身体性别不改变。';
