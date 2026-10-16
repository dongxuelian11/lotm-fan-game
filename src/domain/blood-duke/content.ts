import { CRIMINAL_GUIDE } from '../criminal/content.js';
import type { BloodDukeAbilityId, BloodDukePreparationId } from './types.js';

/** Developer source boundary: the supplied canon does not verify the exact S2
 * Blood Duke name, formula, ritual or these two mechanics. The existing career
 * name is retained; paid professional preparation and every bounded mechanic
 * below are original implementation, not a reconstructed canonical sacrifice.
 * No blood control, resurrection, angel corruption or soul ownership is added. */
export const BLOOD_DUKE_GUIDE = CRIMINAL_GUIDE;
export const BLOOD_DUKE_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const BLOOD_DUKE_MIN_BLATHERER_WEEKS = 12;
export const BLOOD_DUKE_LABOUR_STEPS = 5;
export const BLOOD_DUKE_BOTTLE_IDS = ['blood-duke-potion-1', 'blood-duke-potion-2', 'blood-duke-potion-3'] as const;
export const BLOOD_DUKE_FORMULA_STATUS = '罗安介绍独立封存的鲜血大公成品魔药。须核对本人七阶原瓶与既往记录，检查自我约束和情绪干涉的使用边界，并实际走查本次服药处的普通出口。三项准备完成后，另行付费检查当周安静房间，再独立确认饮用所选原瓶。';
export const BLOOD_DUKE_SOURCE_STATUS = '晋升后仍回到同一安静房间，诺拉、罗安、原卡、原铃与原记录保持各自身份。自我约束只暂时约束本人当场已确认的冲动；情绪干涉只能触及当事人当前已有的强烈情绪，产生短暂迟疑，不创造情绪或改写选择。同意须重新取得，撤回、普通冷静与离场都必须真实处理。原良知变化、恶欲风险、旧伤与人物生死继续保留。';
export const BLOOD_DUKE_POTION_SOURCES = BLOOD_DUKE_BOTTLE_IDS.map((id, index) => ({
  id, source: `${BLOOD_DUKE_GUIDE}介绍的专业交接处初始批次第${index + 1}瓶序列2鲜血大公成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const BLOOD_DUKE_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const BLOOD_DUKE_PREPARATIONS: { id: BloodDukePreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对七阶原瓶与既往记录', description: '本人核读罪犯至呓语者的七阶实际晋升经历、原瓶耗尽与旧报告，核对原人物同意和撤回、原物借还、恶魔身体与火焰、旧种子和声音效果。旧良知变化、紧绷、恶欲风险及原对手伤亡继续保留，不把新晋升当成洗去旧后果。' },
  { id: 'CHECK_LIMITS', title: '检查自我约束与情绪干涉边界', description: '自我约束只作用于本人当场实际存在的冲动，短暂作用不会治疗身体、返还消耗或重写良知。情绪干涉须有当前真实强烈情绪作为入口，生活试验另须本人明确同意；拒绝与撤回不能被旧许可覆盖。两者均可能失败，不能远程强迫、永久改写意志或操纵血液。' },
  { id: 'MARK_EXIT', title: '标明停用、归物与普通出口', description: '本人走查本次服药处的普通出口，核对原安静房间START至A4米、再到B4米的路线和原卡归还次序。停止不返还费用，已有短暂残余须实际等候消退；普通步行与真实收尾始终可行。排异照护只处理本次服药，不治疗旧伤或复活旧人物。' },
];
export const BLOOD_DUKE_ABILITIES: { id: BloodDukeAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s2.self-restraint', label: '有限自我约束', description: '暂时约束本人已经在当场确认的冲动。生活练习耗1行动、6灵性、2精神，知识20检定；失败总计损4精神，费用不返。成功窗口8秒，只处理本次实际冲动，不清除良知变化、旧恶欲风险或伤势。战斗同样实际付费，只能有限缓和下一次符合条件的实际冲击，仍须承担共同胜负与伤亡。' },
  { id: 'abyss.s2.emotion-interference', label: '短暂情绪干涉', description: '仅以原对象当前真实强烈情绪为入口，造成一次短暂迟疑。生活练习另须当事人当次明确同意，耗1行动、6灵性、2精神，知识20检定；失败总计损4精神，成功窗口6秒。拒绝、撤回、情绪消退或普通冷静会限制施用，不创造情绪、替人决定或永久控制他人。战斗仍须检定并面对真实抵抗，有限作用不能代替共同结果判定。' },
];
export const BLOOD_DUKE_CONSUMPTION_RISK = '呓语者消化100、实际晋升后12整周、三份旧生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧14项掌握与七阶消化保留，两项新掌握从0开始，共16项；灵性上限120，当前不补满。性别、旧伤、原恶魔紧绷、良知变化、恶欲风险与人物原物历史不改写。';
export const BLOOD_DUKE_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'abyss.s9.brute-force', label: '强健身体', description: '以本人原身体处理当前实际障碍，原伤势、物体与旁人位置仍有效，不凭空获得武器或消除伤势。' },
  { id: 'abyss.s9.alertness', label: '敏锐直觉', description: '注意已在场的细节并以普通事实核实，不读取未来结果或确认所有人的意图。' },
  { id: 'abyss.s9.illicit-insight', label: '犯罪相关才能', description: '辨认虚构场景中的越界机会与后果，实际原物借还和人物选择保留，不自动替玩家实施恶行。' },
  { id: 'abyss.s8.inhuman-body', label: '非人身体', description: '本人既有身体经历和良知变化保留，使用仍受当前资源、位置与伤势约束。' },
  { id: 'abyss.s7.demonic-lore', label: '恶魔知识', description: '只使用本人真正取得的既往知识，不补造未知配方、祭品、材料或高位回应。' },
  { id: 'abyss.s7.ritual-practice', label: '有限祈仪', description: '沿既有实际准备、原物与停止条件开展有限实践，不赠仪式、不把专业准备当成完整献祭。' },
  { id: 'abyss.s6.danger-premonition', label: '有限危险预知', description: '保留既往实际危险感应与局限，不读未来随机结果，不保证躲避全部威胁。' },
  { id: 'abyss.s6.demonic-body', label: '恶魔身体', description: '使用本人同一原身体，原紧绷与有限负荷保持；实际收束后才能普通离场，不复制身体。' },
  { id: 'abyss.s6.flame-hex', label: '有限火焰与诅咒', description: '沿用既有火焰与诅咒的真实灵性和负荷成本，原火焰必须实际熄灭，不免费补发或无限持续。' },
  { id: 'abyss.s5.emotion-seed', label: '有限情绪种子', description: '只沿原有真实情绪入口、原对象和原许可施用，种子历史与终止继续保存，不转移到新人物。' },
  { id: 'abyss.s5.catalysis', label: '有限催化', description: '只催化实际存在且符合旧条件的情绪联系，真实成本、失败与抵抗保留，不永久改写人格。' },
  { id: 'abyss.s4.desire-focus', label: '有限欲望聚焦', description: '以本人真正掌握的方法聚焦原场当前欲望，原准备、入口与有限资源仍须满足。' },
  { id: 'abyss.s4.catalytic-pressure', label: '有限催化压迫', description: '仍依原对象、旧种子与当场实际条件施压，不能挪用旧历史为新对象补造入口。' },
  { id: 'abyss.s3.limited-murmur', label: '有限低语', description: '沿用本人已学的短促低语、实际听距和有限迟疑，须停输入并实际等待残余；不制造血晶、祭坛或远程声音。' },
];
