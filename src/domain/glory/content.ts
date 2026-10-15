import type { GloryAbilityId, GloryPreparationId } from './types.js';

/** Developer evidence boundary: the S2 name/mapping, full recipe and rite have not been
 * source-verified. This finished-bottle channel, adult mentors, two finite practices,
 * preparations, combat mechanisms and quantities are original G. These steps neither
 * claim a canonical rite nor assert that the original rite is unnecessary. */
export const GLORY_GUIDE = '贝克兰德荣耀者专业交接处';
export const GLORY_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const GLORY_MIN_SILVER_KNIGHT_WEEKS = 12;
export const GLORY_LABOUR_STEPS = 5;
export const GLORY_BOTTLE_IDS = ['glory-potion-1', 'glory-potion-2', 'glory-potion-3'] as const;
export const GLORY_FORMULA_STATUS = '交接处供应分别封存的荣耀者成品魔药。领取药瓶后，仍须亲自完成三项专业准备，并在服用当周检查场地。';
export const GLORY_SOURCE_STATUS = '修护室的教员会核对你现有的银甲、身体状况和实际退路。每次实践都要重新取得参与者的同意；已有伤势、甲片损耗和身体负担都如实保留。';
export const GLORY_POTION_SOURCES = GLORY_BOTTLE_IDS.map((id, index) => ({
  id, source: `${GLORY_GUIDE}初始批次第${index + 1}瓶序列2荣耀者成品魔药，封存编号${id}。本瓶有独立的交付与耗用记录。`,
}));
export const GLORY_LABOUR_TASKS = ['核验本瓶封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const GLORY_PREPARATIONS: { id: GloryPreparationId; title: string; description: string }[] = [
  { id: 'TRACE_ARMOR', title: '核对已有银甲和损耗', description: '本人同教员核对既有银甲的来源与完整度，记录此前的承压和停止经过。检查沿用同一件银甲，不修补既有磨损。' },
  { id: 'PLAN_LOAD', title: '核读负载与本人承受范围', description: '本人核对有限测力装置、护垫和参与者此次意愿，区分自身承压与照应身边一人的负担。旧伤须先实际诊疗和休养，过去的许可不能代替此次同意。' },
  { id: 'CHECK_EXIT', title: '走查停手与普通退出路线', description: '本人沿原通道检查桥面、普通侧路和出口，确认停止作用、归还护具及本人步行返回的顺序。每次尝试须留下返程精力，身体与物件都沿实际路径移动。' },
];
export const GLORY_ABILITIES: { id: GloryAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s2.armor-temper', label: '银甲淬护', description: '花6灵性、1行动，以知识难度20尝试加强身上的同一件银甲，最长30秒。仍须在原测力点实际承压才算应用，承压会磨损5完整度；失败或时间用尽可以改用普通护垫。无法凭空生成银甲、修复旧损耗或形成永久防护。' },
  { id: 'warrior.s2.close-guard', label: '近身护持', description: '花6灵性、1行动，以意志难度20尝试照应当前同意的身边一人。本人陪同对方实际走过6米桥面，成功分担时另付5健康和5精力；对方的身体、位置与意愿始终独立。普通侧路也可通行。独自交战时，这项技巧用于本人守势，不会凭空出现受保护的同伴。' },
];
export const GLORY_CONSUMPTION_RISK = '银骑士消化100、从实际晋升周起经过12整周，且健康>20、精神>40。三项专业准备各需1行动，服药当周另花1行动与140便士检查场地，再以0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和本次场地准备都会耗尽。专业支持仅将本次药物排异后的健康与精神保底到1，普通死亡与战斗照常结算。已有三项准备经历保留，休养后须另筹原瓶并重新检查场地。成功后四属性各+1，前七阶的消化与18项掌握保留，两项新掌握从0开始；灵性上限120、当前不补满，身体性别保持。';

/** Current public descriptions of the inherited catalogue; no old rule or save record is rewritten. */
export const GLORY_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'warrior.s9.physique', label: '强健体魄', description: '对眼前真实障碍和负重施力，仍须检查支点、清空落点并留出退路。力量和体力有实际边界，受伤与疲劳照常保留。' },
  { id: 'warrior.s9.arms', label: '持械训练', description: '使用实际持有的器具，掌握握持、距离与停止动作。借来的训练棍仍归导师，取用与归还都有各自记录。' },
  { id: 'warrior.s9.restraint', label: '克制施力', description: '辨认危险、控制施力并尊重停止信号。普通合作同样能够完成合适的现场目标。' },
  { id: 'warrior.s8.combat-skill', label: '格斗技巧', description: '以本人的身体练习距离与有限近身动作。练习伙伴须当次同意，停止后实际解除接触；恐惧、精神干扰和伤势仍能影响本人。' },
  { id: 'warrior.s7.weapons', label: '兵器运用', description: '根据手中实物核验握持、距离和适配，通过真实使用积累熟练。不会复制器具，也不会改变借物的所有权。' },
  { id: 'warrior.s7.weak-point', label: '弱点观察', description: '根据可见痕迹、距离与动作变化作有限判断，并实际复核。看不见的信息仍须调查，命中与突破防御都不保证。' },
  { id: 'warrior.s6.dawn-light', label: '晨曦', description: '晨曦可驱散幻觉，并轻微伤害幽灵等适用对象。此前对原幻象的实际驱散和志愿者付出的灵性保留，已经结束的幻象不会随晋升重新出现。' },
  { id: 'warrior.s6.dawn-armor', label: '晨曦铠甲', description: '凝聚有防护力的光甲，受力仍会破损，恢复缓慢。旧试验留下的裂纹按原记录保存；凝甲不会治疗本人或同伴。' },
  { id: 'warrior.s6.dawn-weapon', label: '晨曦武器', description: '以晨曦凝聚武器，双手巨剑威力最强。实际使用仍需支付相应代价，已经消散的训练光剑不会成为一件免费库存武器。' },
  { id: 'warrior.s6.light-storm', label: '光之风暴', description: '在净空场地中施放危险的光芒风暴。此前毁坏的原靶、焦黑框架和自身光甲裂纹持续保留；没有免费重置或旁人免伤保证。' },
  { id: 'warrior.s5.guard-state', label: '放弃攻击的守护状态', description: '放弃攻击时增强防御，主动攻击会降低防护。战斗选择防御表示整轮放弃攻击，实际敌方攻击仍按有限防护与身体后果结算。' },
  { id: 'warrior.s5.damage-sharing', label: '附近同伴伤害分担', description: '替实际在附近且愿意接受保护的同伴承担伤害。分担由本人承受，双方位置与原伤保留；独处时没有可分担的同伴伤害。' },
  { id: 'warrior.s4.discern-corruption', label: '邪恶与污染痕迹辨识', description: '对实际接触的具体痕迹作有限辨识。不会读出物主完整身份、历史或善恶；原封存残片与普通烟灰的实际检查结果仍可回看。' },
  { id: 'warrior.s4.targeted-preparation', label: '真实材料的针对性准备', description: '依据已知目标、弱点和真实材料制作短效针对性涂层，失败也消耗材料。旧试剂和原目标的涂层保持原用途，不能免费转给另一个目标。' },
  { id: 'warrior.s4.veil-intent', label: '隐藏自身行动意图', description: '收敛本人的行动意图，干扰相应的危险预感。身体、脚步与响声依旧存在，实际接近和返程均须沿原路线完成。' },
  { id: 'warrior.s3.silver-armor', label: '实质银甲', description: '凝聚具有有限防护与完整度的银甲，实际负载会使其磨损。原训练形成的银甲沿用同一身份，当前完整度按后续实际损耗记录。' },
  { id: 'warrior.s3.light-concealment', label: '借光隐藏', description: '本人实际到达光区后，借现存光隐藏；观察者仍可能察觉。光熄或主动停止便在同一位置显露，身体不能穿墙或免去碰撞。' },
  { id: 'warrior.s3.silver-thrust', label: '传送银白细剑', description: '核实真实目标后，使有限银白细剑绕过普通屏障，仍可能失手、被抵抗或遭封锁。此技巧移动的是细剑，本人仍在原位置。' },
];
