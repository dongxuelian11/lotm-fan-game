import type { SageAbilityId, SagePreparationId } from './types.js';

/** Canonical boundaries: L191674 requires stopping a high-level disaster; L229621–635
 * support informationization with assimilation/consciousness risk; L229659 supports
 * useful information drawn from actual information. The full potion formula is not
 * established here. All particular people, archive objects, costs and numbers below
 * are original game implementation. The cited item's 2–3 seconds is not a universal
 * Sage limit; Knowledge Emperor remains S1. No source text is bundled. */
export const SAGE_GUIDE = '贝克兰德旧档案馆专业交接处';
export const SAGE_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const SAGE_MIN_PROPHECY_MASTER_WEEKS = 12;
export const SAGE_LABOUR_STEPS = 5;
export const SAGE_BOTTLE_IDS = ['sage-potion-1', 'sage-potion-2', 'sage-potion-3'] as const;
export const SAGE_FORMULA_STATUS = '交接处按独立封存编号供应贤者成品魔药。你须以预言大师的身份亲自阻止旧档案馆中正在扩散的高层次信息灾难，保留封存与专业复核记录，再安排本周服药。';
export const SAGE_SOURCE_STATUS = '旧档案馆的玻璃名录有自己的移交卷、原核心、刻印板与索引回路。信息洪流已经毁损原记录，并使在场的两名成年人受伤。研究、疏散、切断两条传播路、封存核心必须由你亲自完成。单纯逃离或救出人员后，尚未切断的灾害仍在；导师只提供说明和服药支持。';
export const SAGE_POTION_SOURCES = SAGE_BOTTLE_IDS.map((id, index) => ({
  id, source: `${SAGE_GUIDE}初始批次第${index + 1}瓶序列2贤者成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const SAGE_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const SAGE_PREPARATIONS: { id: SagePreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_DISASTER', title: '核对本人阻止灾难的原始记录', description: '逐一核对玻璃名录的来源、原损毁、成年伤者、两条已截断回路和已封存的唯一核心。仅当本人已经实际阻止灾难并完成专业复核时才能完成；抢救与撤退记录本身不能充作成功仪式。' },
  { id: 'CHECK_IDENTITY', title: '确认自我锚定与信息同化风险', description: '本人核读姓名、身体与既有研究经历，明确大量信息会侵蚀意识；有限的信息化和筛取都须保留停止、恢复身体与独立核对。不得把旧物的一次持续时间当成所有贤者的恒定上限。' },
  { id: 'CHECK_RETURN', title: '检查服药支持与普通离场路线', description: '本人走查实际服药处的普通出口和当次排异照护安排。专业支持只处理本次魔药排异，不替本人消除旧灾害、修复记录或治疗既有伤势。' },
];
export const SAGE_ABILITIES: { id: SageAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s2.information-form', label: '信息化与重新凝聚', description: '把自身转为有限信息形态，沿已经检查的实际载体移动，再依自我锚定重新凝聚。生活练习预付8灵性（含返回凝聚）、2精神与2精力，知识20检定；同化和意识失稳会留下真实消耗。不能任意穿越未知空间、复制身体或携带旁人。战斗中的窗口、代价和抵抗按本场实际记录结算。' },
  { id: 'hermit.s2.information-sift', label: '信息洪流中的有限筛取', description: '从当前实际取得、已获准接触的信息中筛取有用片段，再与原件独立核验。生活练习花6灵性、2精神，知识20检定；失败同样付费且不能凭空取得正确答案。信息缺失、错误、撤回许可与高位干扰仍有效，不读取未知资料、他人内心或全部未来。' },
];
export const SAGE_CONSUMPTION_RISK = '预言大师消化100、实际晋升后12整周、三份生活报告及反思完成，健康>20、精神>40。必须已亲自阻止玻璃名录灾难并保留专业复核；三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽。专业支持仅将这次排异后的健康与精神保底到1，普通死亡及战斗照常结算。失败不抹去已阻止的灾难或复核，可休养后筹新原瓶并重做当周检查。成功四属性各+1，旧11项掌握与前七阶消化保留，两项新掌握从0开始，共13项；灵性上限120，当前不补满，性别、旧伤、人物与物件历史不改写。';
export const SAGE_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'hermit.s9.spirit-vision', label: '灵视', description: '在实际观察范围内辨认有限灵性表现，保留遮挡、抵抗与解释误差，不凭空获得隐藏真相。' },
  { id: 'hermit.s9.ritual-lore', label: '仪式知识', description: '依本人已学记录和实际准备的原材料辨识有限仪式；不赠送来源、未研究知识或高位力量。' },
  { id: 'hermit.s9.occult-study', label: '神秘学研习', description: '实际阅读和核对神秘学材料，危险信息仍可能造成精神损耗与污染；停读不会撤销已受影响。' },
  { id: 'hermit.s8.combat-study', label: '格斗研究', description: '依据亲自观察和练习的身体动作应对，保留原掌握；不能凭记载自动达到精熟或免除伤害。' },
  { id: 'hermit.s7.spellcraft', label: '有限法术', description: '只有实际学会、已获准使用的教学术才可施用，实际支付灵性并核对对象，不能凭空增加新法术库。' },
  { id: 'hermit.s6.scrollcraft', label: '卷轴刻录', description: '原工坊材料、刻录、成品与耗尽记录保留。使用须确实持有同一原卷并实际消耗，不因晋升回填。' },
  { id: 'hermit.s5.mystic-sight', label: '神秘之眼', description: '真实佩戴原厚镜片并对实际对象有限观察；高位信息存在危险，不自动看穿一切。' },
  { id: 'hermit.s5.star-cage', label: '星光牢笼', description: '在本场实际范围与灵性约束下尝试有限禁锢，可被抵抗或打断，按原掌握结算。' },
  { id: 'hermit.s4.mystical-reenactment', label: '神秘再现', description: '只有本人实际研究并留存来源的旧故事才能有限再现。原公开故事的知情者和迟钟回声15%效力继续保留，不回收他人知识或赠送新故事。' },
  { id: 'hermit.s4.shared-sight', label: '有限共享视野', description: '依已同意的真实参与者和现有感知联系共享有限所见；许可可撤回，不复制身体或读取秘密。' },
  { id: 'hermit.s3.prophetic-glimpse', label: '模糊预兆', description: '既有预兆仍须本人解释与实际物证核验，受位格限制且可能错误。原场和原随机记录保留，不改变已经发生的事实或保证阻止每一场灾难。' },
];
