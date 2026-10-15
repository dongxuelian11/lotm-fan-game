import { SILENT_DISCIPLE_GUIDE } from '../silent-disciple/content.js';
import type { AncientEvilAbilityId, AncientEvilPreparationId } from './types.js';

/** Developer source boundary: Fifthpart96 L183176 directly names S2 Ancient Evil.
 * Sixth8 L202933–937 supports a transformation curse markedly stronger than S3,
 * while still resistible/resolvable. It does not establish a complete formula,
 * ritual, precise duration/cost, or S2 new-moon rules. All finite mechanics below
 * are original implementation. No automatic total ability nullification, free
 * reflection, permanent transformation or stacked predecessor moon is inferred. */
export const ANCIENT_EVIL_GUIDE = SILENT_DISCIPLE_GUIDE;
export const ANCIENT_EVIL_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const ANCIENT_EVIL_MIN_SILENT_DISCIPLE_WEEKS = 12;
export const ANCIENT_EVIL_LABOUR_STEPS = 5;
export const ANCIENT_EVIL_BOTTLE_IDS = ['ancient-evil-potion-1', 'ancient-evil-potion-2', 'ancient-evil-potion-3'] as const;
export const ANCIENT_EVIL_FORMULA_STATUS = '哈伦介绍独立封存的古代邪物成品魔药。须核对本人七阶原瓶与既往记录，检查持续变形和同源解咒的使用边界，并实际走查本次服药处的普通出口。三项准备完成后，另行付费检查当周安静房间，再独立确认饮用所选原瓶。';
export const ANCIENT_EVIL_SOURCE_STATUS = '晋升后仍回到同一安静房间，埃尔莎、哈伦、原衣物、原包、原盘与原纸保持各自身份。持续变形仍作用于同一身体，健康、精神、灵性和伤势不随外形复原；原物须先存妥再实际归还。同源诅咒引导有实际距离、来源与抵抗限制，不能免费取消对方全部能力。每案重新取得同意，撤回即停止新输入，已有形态仍须真实等待或付费尝试解除。旧人物生死、原伤与旧月相经历继续保留。';
export const ANCIENT_EVIL_POTION_SOURCES = ANCIENT_EVIL_BOTTLE_IDS.map((id, index) => ({
  id, source: `${ANCIENT_EVIL_GUIDE}介绍的专业交接处初始批次第${index + 1}瓶序列2古代邪物成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const ANCIENT_EVIL_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const ANCIENT_EVIL_PREPARATIONS: { id: AncientEvilPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对七阶原瓶与既往记录', description: '本人核读囚犯至沉默门徒的七阶实际晋升经历、原瓶耗尽与旧报告，核对原埃尔莎、原衣物、原包、原盘、原纸和旧卡尔德的真实结果。原身体、旧伤、归还与撤回、既往月相经历继续保留，新晋升不洗去旧后果。' },
  { id: 'CHECK_LIMITS', title: '检查持续变形与同源解咒边界', description: '持续变形只作用于当前同一身体，外形改变不治疗伤势或补充资源。和平试验每案重新取得当事人明确同意，原衣物与原包先私下存妥；撤回阻止新输入，已有形态仍须真实等待或支付解除成本。引导只能尝试解除自己本案仍在持续的原变形，须当面核对原身份、原身体和实际施术来源；不能普遍解咒、永久控制身体或免费取消全部能力。' },
  { id: 'MARK_EXIT', title: '标明复原、归物与普通出口', description: '本人走查原安静房间，从门口到四米处，再向前四米到原纸处。确认埃尔莎原衣物与原包各一件、私密原盘位置、身体复原后另行归还和穿回次序，再沿原路步行离场。退出不退款、不治疗或传送；专业照护只处理本次服药排异。' },
];
export const ANCIENT_EVIL_ABILITIES: { id: AncientEvilAbilityId; label: string; description: string }[] = [
  { id: 'chained.s2.enduring-transfiguration', label: '有限持续变形', description: '对当前同一原身体施加有限变形诅咒。生活试验耗1行动、6灵性、2精神，知识20检定；失败总计损4精神，费用不返，成功兔形持续90秒。须当次明确同意、亲见同一身体并先存好原衣物与原包；停输入或撤回不会瞬间抹去已有形态，可等剩余时长或付费尝试同源引导。目标仍可抵抗与解除，复原不归物、穿衣、治伤或补资源。' },
  { id: 'chained.s2.curse-guidance', label: '同源诅咒引导', description: '当面核对原身份与同一身体后，只尝试解除本人在本案仍持续的那次成功变形。生活练习耗1行动、4灵性、2精神，知识20检定；失败总计损4精神，原兔形继续，仍可免费实际等待。撤回后只允许这种收尾，不重新施加变形。不能解除未知来源诅咒、免费取消全部能力或赠送零自伤反射；战斗仍须真实成本、同源入口与抵抗。' },
];
export const ANCIENT_EVIL_CONSUMPTION_RISK = '沉默门徒消化100、实际晋升后12整周、三份旧生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧17项掌握与七阶消化保留，两项新掌握从0开始，共19项；灵性上限120，当前不补满。身体、性别、旧伤、原人物原物和旧月相历史不改写。';
export const ANCIENT_EVIL_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'chained.s9.prisoner-body', label: '囚犯身体', description: '以同一原身体处理实际障碍，原伤势、物体与旁人位置仍有效，不凭空治疗或补充资源。' },
  { id: 'chained.s9.keen-perception', label: '敏锐感知', description: '注意当前在场线索，再以普通事实核对，不读取未来随机结果或自动确认他人意图。' },
  { id: 'chained.s9.improvised-combat', label: '临场格斗', description: '沿用已掌握的身体技巧、原物和实际距离，不凭空获得武器或抹去既有伤势。' },
  { id: 'chained.s8.reason-sacrifice', label: '有限理性牺牲', description: '保留原有使用成本与精神后果，不因晋升清空既往风险。' },
  { id: 'chained.s8.mental-resistance', label: '精神抵抗', description: '沿原规则有限抵抗当前精神压力，不提供必定免疫或无限精神。' },
  { id: 'chained.s7.werewolf-body', label: '狼人身体', description: '仍为本人同一身体，原身体变化与实际收束保持，不复制第二身体。' },
  { id: 'chained.s7.regeneration', label: '有限恢复', description: '恢复受真实资源、伤势与旧规则约束，不复活本人或已经死亡的其他人。' },
  { id: 'chained.s7.toxic-claws', label: '有限毒爪', description: '依实际身体、接触、资源和抵抗使用，不免费远程命中。' },
  { id: 'chained.s6.steel-body', label: '钢铁身体', description: '保留原身体形态、负荷和旧伤，实际复原后才能普通离场。' },
  { id: 'chained.s6.death-craft', label: '有限死亡技艺', description: '沿原有灵性与负荷条件使用，原寒冷和灵性联系须真实结束。' },
  { id: 'chained.s5.reflection-step', label: '镜面移动', description: '只能依原有真实镜面、距离和成本移动，原镜与物品不会凭空复制。' },
  { id: 'chained.s5.spirit-possession', label: '有限附身', description: '须符合原接触与抵抗条件，实际退出宿主，不永久改写他人身份。' },
  { id: 'chained.s4.object-motion', label: '原物移动', description: '只移动实际存在的原物，三块原木块、数量、位置与取回历史保留。' },
  { id: 'chained.s4.cursed-form', label: '有代价诅咒形态', description: '本人实际诅咒形态与完整自伤成本仍保留，不因升阶获得免费反射或免死。' },
  { id: 'chained.s4.curse-link', label: '既有诅咒联系', description: '沿真实对象与当前联系使用，目标仍能抵抗与断开，不挪用旧历史补造新入口。' },
  { id: 'chained.s3.short-transfiguration', label: '同一身体的短时变形', description: '原短时变形、实际成本、目标抵抗和解除保留。原衣物与原包须真实存放和归还，外形复原不治疗。' },
  { id: 'chained.s3.measured-curse', label: '有限联系与有代价诅咒', description: '沿原本人、当前目标和真实联系使用；和平联系只在当次明确非伤害同意内建立，实战既有自伤不得免除。' },
];
