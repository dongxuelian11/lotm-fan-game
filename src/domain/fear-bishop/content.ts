import { NIGHTWATCHER_GUIDE } from '../nightwatcher/content.js';
import type { FearBishopAbilityId, FearBishopPreparationId } from './types.js';

/** S3 sleep/fear darkness is verified; all playable bounds, supply and preparation are original G. */
export const FEAR_BISHOP_GUIDE = NIGHTWATCHER_GUIDE;
export const FEAR_BISHOP_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const FEAR_BISHOP_MIN_NIGHTWATCHER_WEEKS = 12;
export const FEAR_BISHOP_LABOUR_STEPS = 5;
export const FEAR_BISHOP_BOTTLE_IDS = ['fear-bishop-potion-1', 'fear-bishop-potion-2', 'fear-bishop-potion-3'] as const;
export const FEAR_BISHOP_FORMULA_STATUS = '恐惧主教的完整配方与晋升仪式尚未核实：材料、用量、调配顺序及仪式要求保持未知，不能断言无需仪式。本阶段只采用本作原创G专业指导与独立序列3成品渠道，不解锁虚构配方或调配。三项专业准备和当次场地检查均为G支持流程，不冒充原著仪式，也不复用守夜人的旧仪式包。';
export const FEAR_BISHOP_SOURCE_STATUS = '第六部14章直接核实黑暗序列3恐惧主教掌握安眠与恐惧结合的黑暗毁灭、消逝力量，并非隐秘权柄。阿里安娜历史投影的黑潮是天使表现，不能下放为初晋者的全场必中；阿蒙时钟能够减缓该力量，不能删除反制。完整配方、晋升仪式、媒介、范围、持续与消耗尚未核实；下一隐秘之仆对应序列2仅为人物关系推断，尚不开放。两项可玩能力的定量、弱原残留、有限睡眠恐惧压力和全部场景均为明确原创G，不声称原著存在独立固定恐惧公式，不获得隐秘、全图毁灭、读心、现实治疗或无条件必杀。灵巫原灵继续按真实来源继承，恐惧女妖的物种技能不等于恐惧主教职业能力。';
export const FEAR_BISHOP_POTION_SOURCES = FEAR_BISHOP_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${FEAR_BISHOP_GUIDE}的独立恐惧主教成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非守夜人或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`,
}));
export const FEAR_BISHOP_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const FEAR_BISHOP_PREPARATIONS: { id: FearBishopPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_RESIDUE', title: '亲自核对残留来源与毁弃边界', description: '向原导师赛琳实际学习核对残留的来源、当前物权与旁人位置，区分弱残留与真实人物、原自然灵；不凭黑暗外观判断危险，不以晋升代替物主当次毁弃许可。尚未接触或毁弃新库房原凝片，也不把保管员的物品当赠品。' },
  { id: 'AGREE_STOP', title: '实际演练明确同意与停止信号', description: '本人在指导场练习说明一次低强压力的界限、听取停止口令并立即停用，核对醒来与退出步骤；这是普通专业演练，不对任何人施加超凡压力，也不替代晋升后托马斯本人当次有限同意，不提供读心、真相验证或治疗。' },
  { id: 'PLAN_EXIT', title: '实际核对普通撤离与原物归还次序', description: '本人实际查看指导场原普通出口并练习离场次序，区分能力成功消散原残留与失败普通封存的不同后果。新库房8米正廊、12米侧路和原物仍须到场核对；既有死亡、原灵释放与旧物历史不会因准备复原。' },
];
export const FEAR_BISHOP_ABILITIES: { id: FearBishopAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s3.dark-dissolution', label: '有限黑暗毁灭（G定量）', description: '依据安眠与恐惧结合的黑暗毁灭方向，本作只让一次6灵性、知识18尝试消散有来源且已获许可的原弱残留。成功实际改变同一原件，失败仍为原件并可普通封存或绕路；不毁未知人物或原灵。战斗成功贡献65并按新掌握缩放，仍经共同伤势盘，不是天使黑潮、隐秘或秒杀。' },
  { id: 'darkness.s3.sleep-fear', label: '有限安眠与恐惧压力（G）', description: '本作原创G有限压力，不冒称原著独立固定公式：一次5灵性、意志18。在当次自愿成年人的一次生活体验中，成功只令其短暂困倦并实耗2精神，停止、醒来与确认必须实际发生，精神不免费返还；失败如实无效果。战斗成功减势32，可被敌方本轮专注抵抗，不直接扣健康、不永久削意志，不读秘密或强制真话。' },
];
export const FEAR_BISHOP_CONSUMPTION_RISK = '以下全部具体规则为本作G：守夜人消化100、从守夜人实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1、守夜人消化100和全部旧掌握保留，两项新能力掌握0；灵性上限仍120且当前不补满，身体性别不改变。原卷叶取得、封存、释放和再邀请历史，原纸、原车、原梅森与伊尔瓦，以及原布拉姆已有死亡与原棍落场均保持真实状态，不发免费灵体库或复活旧人。';
