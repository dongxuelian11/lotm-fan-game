import type { SummoningMasterAbilityId, SummoningMasterPreparationId } from './types.js';

/** The sequence names are verified; supply, preparation and all playable bounds below are original G. */
export const SUMMONING_MASTER_GUIDE = '原巫王导师格蕾丝·维尔（WK4-GRACE）';
export const SUMMONING_MASTER_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const SUMMONING_MASTER_MIN_WITCH_KING_WEEKS = 12;
export const SUMMONING_MASTER_LABOUR_STEPS = 5;
export const SUMMONING_MASTER_BOTTLE_IDS = ['summoning-master-potion-1', 'summoning-master-potion-2', 'summoning-master-potion-3'] as const;
export const SUMMONING_MASTER_FORMULA_STATUS = '召唤大师的完整配方与晋升仪式尚未核实：材料、用量、调配顺序及仪式要求保持未知，不能断言无需仪式。本阶段只采用本作原创G专业指导与独立序列3成品渠道，不解锁虚构配方或调配。三项专业准备和当次场地检查均为G支持流程，不冒充原著仪式，也不复用巫王的旧仪式包。';
export const SUMMONING_MASTER_SOURCE_STATUS = '第六部84《降临的投影》直接核实月亮序列3召唤大师，第七部55直接核实下一序列2创生者之名；完整能力表、配方、晋升仪式、对象数量、范围和耗灵尚未核实。卡拉曼召唤天使是受外来加持的巫王越阶个例，目标为组织原有天使；太阳攻击毁门令尚未完成出门者返回，只支持媒介可受干扰。指环的临时协议、五分钟和渴血代价属于物品，不能写成职业硬参数。本阶段的一位有来源低强来客、有限门与有限合作均为明确原创G，不授予天使库、免费灵魂、创造生命或创生者能力；已到场的同一身体不会随门消失。';
export const SUMMONING_MASTER_POTION_SOURCES = SUMMONING_MASTER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SUMMONING_MASTER_GUIDE}的独立召唤大师成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非巫王或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`,
}));
export const SUMMONING_MASTER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const SUMMONING_MASTER_PREPARATIONS: { id: SummoningMasterPreparationId; title: string; description: string }[] = [
  { id: 'INSPECT_SOURCE', title: '亲自核对联系来源与独立来客边界', description: '向原巫王导师格蕾丝实际核对已有联系来源，区分有居处的独立成年意识与自己的创造物；不凭名字补出天使、契约或能力，也不代做晋升后的本人当面拜访和每次当前同意。' },
  { id: 'CHECK_RETURN', title: '实际核对原地点与普通返回路线', description: '本人沿原私人仪式厅旁玻璃暖房与小石院之间的普通30米小径实际核对去回路线；明确开门失败或断连后已到场者仍在实际地点，旧纸、旧靶和旧人不会被新阶段重置。' },
  { id: 'PLAN_WITHDRAWAL', title: '实际演练关门与普通撤离', description: '本人在原指导场实际演练停用和普通离开，核对先还原物、陪同同一来客返回原居处的次序。这是本作G专业准备，不等于已经邀请来客、不提供免费召唤，也不完成原著未知的序列3仪式。' },
];
export const SUMMONING_MASTER_ABILITIES: { id: SummoningMasterAbilityId; label: string; description: string }[] = [
  { id: 'moon.s3.bounded-summoning', label: '有限召唤之门（G）', description: '本作原创G：只连接已核实的原暖房与30米外原小院，一次6灵性、知识18，成功门持续40秒。须当次同意才让唯一低强来客流灯以同一身体过门，来客实际耗6精力；失败照耗灵性，可沿普通小径接送。门失效不删除已经到场者、不复制身体、不带走主人或装备，也不提供天使库。' },
  { id: 'moon.s3.guest-cooperation', label: '来客有限合作（G）', description: '本作原创G有限合作，不冒称另一项已核实的原著法术：与当次自愿且实际在场的同一流灯合作，一次3灵性、来客8精力、知识16。生活只把同一张不超过200克的原小牌送到3米原桌，失败可本人普通搬运；战斗成功贡献32、减势16。来客有自己的身体、精神、精力、伤亡与退出，不复制玩家技能或领取第二轮盘。' },
];
export const SUMMONING_MASTER_CONSUMPTION_RISK = '以下全部具体规则为本作G：巫王消化100、从巫王实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1、巫王消化100和全部旧掌握保留，两项新能力掌握0；灵性上限仍120且当前不补满，身体性别不改变，原血食、驯兽动物、原瓶、原灵材、纸张、旧靶与旧人物保持真实状态，不发免费灵魂或天使。';
