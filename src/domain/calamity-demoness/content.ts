import type { CalamityDemonessAbilityId, CalamityDemonessPreparationId } from './types.js';

/** Internal evidence boundary: this S2 name/mapping, recipe, rite and two new powers
 * have not been verified in the uploaded primary text. The supply, preparations,
 * finite exercises, participants, combat implementation and all new numbers are G.
 * The older candidate design is not primary evidence. S1 remains unavailable;
 * the old formula's 末日 wording does not authorize new divinity or other powers. */
export const CALAMITY_DEMONESS_GUIDE = '贝克兰德镜廊专业交接处';
export const CALAMITY_DEMONESS_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const CALAMITY_DEMONESS_MIN_UNAGING_DEMONESS_WEEKS = 12;
export const CALAMITY_DEMONESS_LABOUR_STEPS = 5;
export const CALAMITY_DEMONESS_BOTTLE_IDS = ['calamity-demoness-potion-1', 'calamity-demoness-potion-2', 'calamity-demoness-potion-3'] as const;
export const CALAMITY_DEMONESS_FORMULA_STATUS = '交接处供应分别封存的灾难魔女成品魔药。领取药瓶后，仍须亲自核对原镜、安排封闭处置与普通退路，并在服用当周检查场地。';
export const CALAMITY_DEMONESS_SOURCE_STATUS = '镜廊附室沿用维瑞娜拥有的两面原镜。她与马库斯保有各自的身体、位置和当次意愿；旧记录继续保存，新的操作需要当前许可。短暂镜幕与封闭黑焰均有实际耗材、时间和灵性边界，原镜损坏不能凭空修复。';
export const CALAMITY_DEMONESS_POTION_SOURCES = CALAMITY_DEMONESS_BOTTLE_IDS.map((id, index) => ({
  id, source: `${CALAMITY_DEMONESS_GUIDE}初始批次第${index + 1}瓶序列2灾难魔女成品魔药，封存编号${id}。本瓶有独立交付与耗用记录，不取用此前已耗尽的原瓶。`,
}));
export const CALAMITY_DEMONESS_LABOUR_TASKS = ['核验本瓶封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const CALAMITY_DEMONESS_PREPARATIONS: { id: CalamityDemonessPreparationId; title: string; description: string }[] = [
  { id: 'TRACE_ORIGINAL_MIRRORS', title: '核对原镜来源与现有状态', description: '本人核对维瑞娜名下两面原镜的身份、位置和完整状态，保留旧镜路与返程记录。检查不会造出另一面镜子，也不修复破损，更不能替代物主此次同意。' },
  { id: 'PLAN_CONTAINMENT', title: '安排封闭负载与残留物处置', description: '本人核读有限测力负载、保护插片和封闭箱的使用边界，确认只有箱内一份封存残留物，并安排失败后的普通封存交接。参与者须在接触区外，既有伤势须实际诊疗和休养。' },
  { id: 'CHECK_RETURN', title: '走查停止与普通返回路线', description: '本人核对附室门口、原镜A、封闭箱、原镜B及室外出口之间的实际路径，安排停手、返还未用插片与步行离场。必须保留返程精力，人在镜内时只能先沿已知入口实际返回。' },
];
export const CALAMITY_DEMONESS_ABILITIES: { id: CalamityDemonessAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s2.mirror-screen', label: '短暂镜幕', description: '花6灵性、以知识难度20尝试在获准的原镜前形成最长30秒的有限镜幕。保护插片须实际装好；对一份12单位封闭负载成功缓冲5单位才算应用，插片承受5磨损并耗尽。失败或到期仍须普通插片承压。战斗另用本人付费携带的三次镜片，每轮至多一次施作，成功设置耗一份耐用度，只减轻随后一次实际身体攻击的45战势；被打断或到期不会退还成本。' },
  { id: 'assassin.s2.black-flame-channel', label: '封闭黑焰疏导', description: '本人实际到达封闭箱，确认两位成年人在接触区外并取得当前许可后，花6灵性、以知识难度20尝试一次最长10秒的有限黑焰。只处置箱内一份已封存残留物，成功耗尽原残留物和付费插片，箱体焦痕保留；失败留下原封存物，须普通封闭交接。战斗每轮至多一次，以同样灵性与检定代价尝试有限黑焰攻击，失手也付成本；不能清洗人的身体、灵魂或所有污染。' },
];
export const CALAMITY_DEMONESS_CONSUMPTION_RISK = '不老魔女消化100、从实际晋升周起经过12整周，且健康>20、精神>40。三项专业准备各需1行动，服药当周另花1行动与140便士检查场地，再以0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和本次场地准备都会耗尽。专业支持仅将本次药物排异后的健康与精神保底到1，普通死亡与战斗照常结算。已有三项准备经历保留，休养后须另筹原瓶并重新检查场地。成功后四属性各+1，前七阶消化与16项掌握保留，两项新掌握从0开始，共18项；灵性上限120、当前不补满，原女巫身体变化与当前性别保持。';

/** The complete inherited catalogue is owned by this stage's current projection.
 * These descriptions do not mutate old IDs, records or settlement rules. */
export const CALAMITY_DEMONESS_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'assassin.s9.lightness', label: '短暂轻身与敏捷步伐', description: '短时减轻本人移动负担，配合敏捷步伐越过已观察的有限高差。须检查落点并实际返回，不能飞行、滞空或携带旁人；普通步行退路持续保留。' },
  { id: 'assassin.s9.vision', label: '鹰视与黑暗视觉', description: '辨认眼前远处或昏暗处的真实标记，再与原物核对。遮挡、未知信息和观察误差仍存在，不会凭空知道隐藏真相。' },
  { id: 'assassin.s9.shadow', label: '藏影', description: '借用现存阴影降低本人的显眼程度，仍依赖实际观察与步行。亮处、声响与观察者可能暴露身体位置，不能穿墙或绝对隐去。' },
  { id: 'assassin.s9.burst', label: '集中力量的一击', description: '将本人力量集中于一次有限动作，保持实际距离与收力边界。命中、抵抗及后果照常判定，不额外生成武器或保证致命。' },
  { id: 'assassin.s8.instigation', label: '教唆', description: '对眼前已有欲望、动摇与冲突施加有限影响，须依据实际话语与反应。不能读心、凭空制造欲望或把拒绝改写为同意，造成的升温仍须真实平息。' },
  { id: 'assassin.s7.black-flame', label: '有限黑焰', description: '在已经确认的有限对象与范围内操纵黑焰，效果按实际判定结算。媒介诅咒仍需真实有效的联系，姓名、目标编号或知识记录不能代替媒介。' },
  { id: 'assassin.s7.frost', label: '冰霜', description: '对眼前有限对象施加冰霜或形成有限防护，付出实际灵性，保留环境与抵抗影响。本次庭院战花6灵性、知识难度18，成功后按这项旧掌握有限降低敌方战势，不冻结整片场地。' },
  { id: 'assassin.s7.invisibility', label: '本人隐形', description: '短暂降低本人的现场可见性；动作、声响、干扰与侦察仍可能暴露位置。不把同行者一同隐去，也不能穿墙。' },
  { id: 'assassin.s7.substitute', label: '有限替身', description: '使用实际持有且另行准备的小镜施作有限替身。原镜与粉剂按各自历史库存消费，已经耗尽的物件不会复原；不提供无限免伤或复活。' },
  { id: 'assassin.s7.divination-interference', label: '占卜与干扰', description: '围绕真实标记进行有限占卜对照与干扰，保留不确定性并核对普通记录。不读取他人内心，也不能保证阻断所有更高层次的窥探。' },
  { id: 'assassin.s7.black-magic', label: '黑魔法', description: '依实际准备的材料和确认对象辨认有限术式。粉剂、小镜与药物材料各有来源和消耗，不能把普通耗材或目标姓名冒充诅咒媒介。' },
  { id: 'assassin.s6.silk-binding', label: '真实蛛丝与有限束缚', description: '先实际生成并布置蛛丝，真实接触后才可能束缚，断丝即失效。参与者的当前同意与退出独立保留，旧练习的丝线不能免费转给新的交战。' },
  { id: 'assassin.s6.charm', label: '有限魅惑', description: '有限影响可感知目标的注意与反应，对方仍可抵抗并明确拒绝。魅惑本身不能构成同意，也不会自动建立亲密关系或改变身份。' },
  { id: 'assassin.s5.disease', label: '渐进的超自然疾病', description: '此前有限现场的超自然疾病按真实接触、灵性和持续成本推进，已有病史不会随离场清除。停止播散不等于治疗，友人没有天然免疫；当前封闭箱中的虚构残留物不是真实病原体。' },
  { id: 'assassin.s4.plague', label: '渐进瘟疫与有限施法干扰', description: '原场的有限瘟疫与干扰保留原范围、成本和实际病势记录。撤场或晋升不治疗旧对手，不复制已经解决的接触，也不会将旧病势转移给新的庭院对手。' },
  { id: 'assassin.s3.mirror-passage', label: '镜界通行', description: '本人沿已知两面原镜之间的有限镜内道路实际通行，进入和离开各有独立成本与失败可能。出口受阻须沿已知入口返回，再走普通外路；镜内仍可能被截留，不提供任意传送、自动复活或免费新镜。' },
];
