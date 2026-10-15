import type { PlaneswalkerAbilityId, PlaneswalkerAuxiliaryKind, PlaneswalkerPreparationId } from './types.js';

/** Source boundaries: Part5 ch130 L189036 names Door3→2→1; Part6 ch57 L211518–522 gives the
 * three auxiliary worms and legends at nine offworld places, not nine planets or a complete main formula.
 * Part8 ch31 L243455 supports symbolic transit; S0 conceptualization and S1 authority stay excluded.
 * Star Staff item-copy rules are not S2 rules. All prices, checks, named channels, donors, nine specific
 * settlements, protection quantities and bounded pattern practice below are authored game mechanics. */
export const PLANESWALKER_GUIDE = '52岁导师赫斯特·沃尔介绍的旅法师独立封存渠道';
export const PLANESWALKER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const PLANESWALKER_MIN_WANDERER_WEEKS = 12;
export const PLANESWALKER_LABOUR_STEPS = 5;
export const PLANESWALKER_BOTTLE_IDS = ['planeswalker-potion-1', 'planeswalker-potion-2', 'planeswalker-potion-3'] as const;
export const PLANESWALKER_AUXILIARY_DONORS: { kind: PlaneswalkerAuxiliaryKind; name: string; donorId: string; donorName: string; donorAge: number; donorPathway: 'door' | 'error' | 'diviner'; donorSequence: 4; sequenceName: string }[] = [
  { kind: 'STAR_WORM', name: '星之虫', donorId: 'PW2-IRINA', donorName: '伊琳娜·维尔', donorAge: 44, donorPathway: 'door', donorSequence: 4, sequenceName: '秘法师' },
  { kind: 'TIME_WORM', name: '时之虫', donorId: 'PW2-JULIAN', donorName: '朱利安·沃斯', donorAge: 46, donorPathway: 'error', donorSequence: 4, sequenceName: '寄生者' },
  { kind: 'SPIRIT_WORM', name: '灵体之虫', donorId: 'PW2-CECILY', donorName: '塞西莉·罗', donorAge: 41, donorPathway: 'diviner', donorSequence: 4, sequenceName: '诡法师' },
];
export const PLANESWALKER_FORMULA_STATUS = '旅法师是门途径序列2。晋升仪式要求在本星球外的九处留下传说；本次指导提供同一异星上九处独立聚居点的有限路线。每处都须本人实际到场帮助、由当地居民亲见，再到下一真实周回访，听另一居民转述并核对当地原记录。九处履历完成后才能准备服药。渠道提供独立成品，并为每瓶另封星之虫、时之虫、灵体之虫各一条；完整主材料和自行调配方法不对本次交付开放。';
export const PLANESWALKER_SOURCE_STATUS = '三种辅助原件来自三位具名成年序列4提供者，逐瓶保留各自交接凭据与独立封签。旧伙伴、旧药瓶、旧护具与旧能源片不承担新供给。远行前可留在本地取消；一旦抵达异星，须用当次原回程标记、剩余原能源和灵性实际返回。现场生活舱只提供有限正常呼吸，不会抵消污染；已付费用、失败和耗材不会因回家或晋升恢复。';
export const PLANESWALKER_POTION_SOURCES = PLANESWALKER_BOTTLE_IDS.map(id => ({ id, source: `${PLANESWALKER_GUIDE}的独立原瓶${id}及其专属辅助封存箱；尚待专业介绍登记本批入库周，现在尚未交付。` }));
export function planeswalkerPotionSource(number: number, week: number): string {
  return `${PLANESWALKER_GUIDE}，第${Math.ceil(number / 3)}批、第${week}周实际登记入库；独立封存原瓶planeswalker-potion-${number}与专属箱PW2-KIT-${number}。本瓶连同三件独立辅助原件交付，费用与每次场地检查分别结算。`;
}
export const PLANESWALKER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶辅助箱与三条原件', '核对三位提供者的本瓶交接凭据', '整理本瓶实际运输与供货清单', '完成本瓶原封签及交付复核'] as const;
export const PLANESWALKER_PREPARATIONS: { id: PlaneswalkerPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_COORDINATES', title: '核读九处坐标与原航标记录', description: '本人核读同一异星上九处独立聚居点、各自原航标与当前回程标记的来源，区分已知端点和未知星空。指导不代替后来每次出返的现场坐标检查，也不凭一次学习生成任何当地传说。' },
  { id: 'CHECK_PROTECTION', title: '核对防护边界与辅助原件来源', description: '核查三位成年序列4提供者的来源说明，并检查有限远行护具、能源消耗和污染风险。旧诺拉与埃利亚斯不提供这些辅助原件；此项学习不借出装备，不补充旧护具或旧能源，也不消除已有伤势。' },
  { id: 'PLAN_RETURN', title: '演练真实回程与停止次序', description: '核算指定原锚、出返所需能源与必须保留的灵性，并亲自检查本地普通出口。远处身体不能靠关闭窗口返回；可在出发前取消，已经出发则必须按真实位置完成回程和原物交还。' },
];
export const PLANESWALKER_ABILITIES: { id: PlaneswalkerAbilityId; label: string; description: string }[] = [
  { id: 'door.s2.symbolic-transit', label: '象征通行', description: '将本次通行转为有限象征态，借星界连接已亲自核实、仍有效的两端。成功打开通路还不等于实际抵达：须同一身体携带同一原物真正通过，实际位置、耗时与损耗随之改变。仅限本次核准的有限端点，不产生分身，不赋予全图定位、恒星避伤或污染免疫；许可撤回和端点受阻时应停止，已付施术消耗保留。' },
  { id: 'door.s2.pattern-reproduction', label: '有限式样复现', description: '只练习短时再现本人已经亲见、核对且理解的原航标光纹，供现场比对使用。必须保留同一原航标和已读记录；未知图案、人物、实体物质、非凡特性与神器能力均不在范围内。成功显出光纹后还须实际完成对照才能积累掌握；失败可沿原记录人工核验，未用上的成功和撤回后的尝试不获额外收益。' },
];
export const PLANESWALKER_CONSUMPTION_RISK = '要求漫游者消化100、从其实际晋升周起满12整周、健康>20且精神>40，并在本星球外九处真正留下可复核的传说。三项各1行动专业准备完成后，另付1行动与140便士复核九处履历、检查当周场地，并打开核对自己持有原瓶的专属辅助箱；最后单独确认所选药瓶，饮用需要0行动。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败不晋升，健康−15、精神−25、排异+30；严重失败不晋升，健康−25、精神−45、排异+60。所选原瓶及其星之虫、时之虫、灵体之虫各一条全部耗尽，本次场地检查失效；专业照护仅使此次排异后的健康和精神最低为1，不保护普通死亡或战斗。药败后九处真实传说与当地原人原物保留，不要求凭空重做传说；重试仍须另一真实原瓶与全新辅助原件，并付费重新核验。指导500便士，每瓶6400便士，或完成本瓶五项实际劳动后付900便士。现有三瓶全部失败耗尽，才能花1行动申请下一批，下一真实周起确认到货且仍须逐瓶付费。成功四属性各+1、十三项旧掌握原值保留、两项新掌握从0开始；灵性上限120且当前不补满，性别、原伤势、累计风险和既有历史保持。';
