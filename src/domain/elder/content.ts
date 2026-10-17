import type { ElderAbilityId, ElderPreparationId } from './types.js';

/** S2 name and the bounded whisper/chorus direction are source-backed, but the
 * supplied source does not establish a full formula or promotion ritual. All
 * people, seals, costs, ranges and checks are original game implementation.
 * S1 Dark Angel is jointly inferred at L236405/L236476; Sasrir and Chaos Sea
 * feats are not generic Elder powers. No source text is distributed here. */
export const ELDER_GUIDE = '贝克兰德封存院专业交接处';
export const ELDER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const ELDER_MIN_THREE_HEADED_TEMPLAR_WEEKS = 12;
export const ELDER_LABOUR_STEPS = 5;
export const ELDER_BOTTLE_IDS = ['elder-potion-1', 'elder-potion-2', 'elder-potion-3'] as const;
export const ELDER_FORMULA_STATUS = '封存院交接处按独立编号供应秽语长老成品魔药。须核对本人既有原瓶、原灵与隔离记录，检查低语和合唱的使用边界，并实际走查本次服药处的普通出口。三项准备完成后，另行付费检查当周场地，再独立确认饮用所选原瓶。';
export const ELDER_SOURCE_STATUS = '晋升后仍回到同一封存院，玛拉、原卡、左右原箱、原灯与原遮板均保持各自身份。低语只能有限压制眼前封存的残留，合唱只调用一位已经真实放牧、仍然存续并有对应已选方法的原灵。原许可须重新取得，光照和撤回仍能中断作用；原物封签与本人、原灵资源逐次实际消耗。没有现存合格原灵时，可以亲自沿普通路线核对。';
export const ELDER_POTION_SOURCES = ELDER_BOTTLE_IDS.map((id, index) => ({
  id, source: `${ELDER_GUIDE}初始批次第${index + 1}瓶序列2秽语长老成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const ELDER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const ELDER_PREPARATIONS: { id: ElderPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对原瓶、原灵与隔离记录', description: '本人核读秘祈人至三首圣堂的七阶实际晋升经历、原瓶耗尽与旧报告，逐一核对伊芮斯、塞德里克和封存院两位原灵的当前状态、取得与释放记录、已选方法和实际剩余资源。旧影体隔离与旧对手的原伤亡继续保留，释放或消散者不能重新取得。' },
  { id: 'CHECK_LIMITS', title: '检查低语与合唱的使用边界', description: '低语只对眼前可接触的实际对象有限作用，仍可能失败或反噬。合唱只调用当前真正拥有的原灵及其已选方法，不新增技能库。总放牧至多7位、同时外放至多2位、本人同时借用1灵保持；旧灵不升级，不复制身体，不因回收或晋升刷新资源。' },
  { id: 'MARK_EXIT', title: '标明中断、封存与普通出口', description: '本人走查本次服药处的普通出口，并核对后续封存院START至A4米、再到B4米的同一路线、原卡归还与原灯关闭次序。强光、撤回许可与灵体损毁都能中断作用；普通步行和真实收尾必须可行。排异照护只处理本次服药，不治疗旧伤或复活旧人物。' },
];
export const ELDER_ABILITIES: { id: ElderAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s2.low-whisper', label: '有限低语', description: '向实际可接触的封存残留低声施加有限压制。生活练习耗1行动、6灵性、2精神与一格实际封存纸，知识20检定；成功窗口12秒，失败总计损4精神，原费用不返。不能凭空创造残留、控制他人意志或消除永久后果。战斗的目标、抵抗、费用和短暂作用按当场实际记录结算。' },
  { id: 'hanged-man.s2.focused-chorus', label: '定向合唱', description: '从当前确实放牧的一位原灵调用其实际已选方法，在本人所在的原场内维持短暂投影。生活练习耗1行动、6本人灵性、2精神、一格封存纸与该原灵3灵性，知识20检定；失败也照耗，精神总计损4，成功窗口6秒。投影不生成第二位灵或另一具身体，不扩容放牧、外放与借用；强光使同一受影响原灵损20完整度并中断。' },
];
export const ELDER_CONSUMPTION_RISK = '三首圣堂消化100、实际晋升后12整周、三份旧生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧13项掌握与七阶消化保留，两项新掌握从0开始，共15项；灵性上限120，当前不补满。性别、旧伤、血肉储备、原灵资源与人物原物历史不改写。';
export const ELDER_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'hanged-man.s9.secret-sense', label: '有限隐秘感知', description: '对实际接触范围内的灵性线索保持有限感知，遮挡、错误解释和精神风险继续有效。' },
  { id: 'hanged-man.s9.sacrificial-lore', label: '祭祀知识', description: '只依本人真实学习的旧记录判断，不取得新的祭品、许可、高位回应或未知配方。' },
  { id: 'hanged-man.s9.ritual-practice', label: '有限祈仪', description: '沿既有准备与已持原材料开展有限祈仪，旧许可、真实消耗与停止条件保留。' },
  { id: 'hanged-man.s8.whisper-listening', label: '有限倾听', description: '只倾听当前实际存在的声音或联系，杂音、精神损耗和污染风险保留，不能凭倾听得到全知答案。' },
  { id: 'hanged-man.s7.shadow-concealment', label: '阴影隐蔽', description: '依实际阴影与原身体进行有限隐蔽，光照、距离和现场观察仍能揭露本人，不生成替身。' },
  { id: 'hanged-man.s6.flesh-shaping', label: '血肉塑形', description: '作用于本人原身体，旧掌握与实际储备保持；先收束身体形态再普通离场，不凭空复制身体。' },
  { id: 'hanged-man.s6.self-renewal', label: '有限自修复', description: '实际支出旧血肉储备和灵性进行有限修复；晋升不会替代诊疗、返还份额或抹去旧伤。' },
  { id: 'hanged-man.s5.grazing', label: '放牧', description: '仅保有实际获得且仍存续的原灵，合计至多7位，每灵至多3项实际已选方法；永久释放和消散不可逆。' },
  { id: 'hanged-man.s5.borrowed-arts', label: '有限借用', description: '本人同一时刻只借1灵，沿用原伊芮斯实际已选技巧；旧低阶灵不升级，不新增未获得的方法。' },
  { id: 'hanged-man.s4.flesh-soul-blade', label: '灵肉之刃', description: '对实际原武器或原身体付费施用，灵性、原掌握与目标抵抗均有效，原物不会因晋升复制。' },
  { id: 'hanged-man.s4.shadow-command', label: '有限影子限制', description: '对实际现场可接触的原影尝试短暂限制，光照和反抗继续有效；不挪用旧隔离影体。' },
  { id: 'hanged-man.s4.fallen-shadow', label: '危险影体经验', description: '旧独立影体仍保留原失控、破损和隔离记录，不能作为宠物、免费原灵或免死替身重新调用。' },
  { id: 'hanged-man.s3.multiple-release', label: '有限双灵外放', description: '实际获得的原半神灵至多同时外放2位，各自资源、完整度和方法保持；每次启动、协作与维持照常付费，召回不补满，主人仍只同时借1灵。' },
];
