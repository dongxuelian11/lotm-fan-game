import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { PSYCHOLOGIST_COUNT_WHEEL, psychologistActionCount } from '../psychologist/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasManipulatorDisputeOpponent } from './encounter.js';
export const MANIPULATOR_COUNT_WHEEL = PSYCHOLOGIST_COUNT_WHEEL;
export const manipulatorActionCount = psychologistActionCount;
export type ManipulatorMoveId = 'audience.s4.mind-island' | 'audience.s4.virtual-persona' | 'audience.s4.mental-plague' | 'audience.s6.scales' | 'STRIKE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: ManipulatorMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'audience.s4.mind-island', label: '有限心灵岛屿接触（H；4灵性，意志16；成功精神−8、优势42×掌握）', weight: 25, stance: 'ATTACK' },
  { id: 'audience.s4.virtual-persona', label: '本人虚拟人格精神防守（J；3灵性＋本人1精神；有限减势24）', weight: 15, stance: 'DEFEND' },
  { id: 'audience.s6.scales', label: '继承鳞片防护／普通自保（B；2灵性；不免伤）', weight: 20, stance: 'DEFEND' },
  { id: 'audience.s4.mental-plague', label: '有限精神瘟疫（K；4灵性、意志18；已感染不重复播种；离场不治愈）', weight: 20, stance: 'CONTROL' },
  { id: 'STRIKE', label: '本人普通身体打击（H；12/原棍16×身体系数）', weight: 5, stance: 'ATTACK' },
  { id: 'OBSERVE', label: '眼前观察（R；0灵性0贡献，不全知或赠送控制）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5）', weight: 5, stance: null },
];
export const isManipulator = (s: SliceState) => s.progression?.pathwayId === 'audience' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function manipulatorAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] { const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 })); }
export function drawManipulatorAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ManipulatorMoveId { const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0)); for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; } throw new Error('操纵师能力盘无效。'); }
export interface ManipulatorCombatSource { runId: string; revision: number; week: number; round: number; encounterId: 'MANIPULATOR_DISPUTE'; attemptWeek: number; startHistoryIndex: number; enemyId: 'MP4-RULAN'; nature: 'AWAKE_ADULT_ORDINARY_HUMAN'; weapon: 'MP4-RULAN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; visible: true; mentalDefence: 'ORDINARY_RESISTANCE'; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false }
export function currentManipulatorCombatSource(s: SliceState): ManipulatorCombatSource | null { if (!hasManipulatorDisputeOpponent(s)) return null; const e = s.manipulator.encounter; return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round, encounterId: 'MANIPULATOR_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, enemyId: 'MP4-RULAN', nature: 'AWAKE_ADULT_ORDINARY_HUMAN', weapon: 'MP4-RULAN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, visible: true, mentalDefence: 'ORDINARY_RESISTANCE', bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false }; }
function validSource(s: SliceState, source: ManipulatorCombatSource | null): boolean { const now = currentManipulatorCombatSource(s); return now !== null && source !== null && Object.entries(now).every(([k, v]) => (source as unknown as Record<string, unknown>)[k] === v); }
export interface ManipulatorRoundOutcome { enemyId: 'MP4-RULAN'; enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyMentalPlague: number; plagueApplications: number; personaGuards: number; islandMindDamage: number; plagueMindDamage: number; ownerMindSpent: number }
export interface ManipulatorRoundContext { source: ManipulatorCombatSource | null; round: number; outcome: ManipulatorRoundOutcome; label: string }
export function beginManipulatorCombatRound(s: SliceState): ManipulatorRoundContext { const e = s.manipulator.encounter, c = s.combat!, source = currentManipulatorCombatSource(s); const ctx: ManipulatorRoundContext = { source, round: c.round, label: '', outcome: { enemyId: 'MP4-RULAN', enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, enemyMentalPlague: e.mentalPlague, plagueApplications: e.plagueApplications, personaGuards: e.personaGuards, islandMindDamage: 0, plagueMindDamage: 0, ownerMindSpent: 0 } }; if (source && e.mentalPlague > 0 && e.infectedRound !== null && e.infectedRound < c.round && e.lastPlagueRound !== c.round) { const damage = Math.min(c.enemyMind, e.mentalPlague * 4); c.enemyMind -= damage; e.enemy.mind = c.enemyMind; e.lastPlagueRound = c.round; e.mentalPlague = Math.min(3, e.mentalPlague + 1); ctx.outcome.plagueMindDamage = damage; ctx.label = `同一原鲁兰已有精神瘟疫本轮实际损耗${damage}精神，余${c.enemyMind}；强度现${e.mentalPlague}（G）。停止新增施术不治愈原病况。`; } return ctx; }
export interface ManipulatorCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
const none = (label: string): ManipulatorCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
const mastery = (s: SliceState, id: string) => 1 + Math.max(0, Math.min(500, s.progression.mastery[id] ?? 0)) / 500;
export function resolveManipulatorCombatAbility(s: SliceState, id: ManipulatorMoveId, physicalStateFactor: number, random: ActionRandomStream, ctx: ManipulatorRoundContext): ManipulatorCombatEffect {
  if (ctx.round !== s.combat?.round || !validSource(s, ctx.source)) return none('缺少本场当前原鲁兰、原棍或现时心灵来源，贡献0、消耗0，不借用别人的心灵或重抽。');
  if (!ABILITIES.some(a => a.id === id)) return none('本动作不在当前有限能力盘内，0贡献0消耗。');
  const e = s.manipulator.encounter, c = s.combat!, physical = Math.max(0, Math.min(1, Number.isFinite(physicalStateFactor) ? physicalStateFactor : 0));
  if (id === 'STRIKE') { const gain = (s.town.clubLocation === 'HAND' ? 16 : 12) * physical; return { ...none('本人以当前原身体作普通近距打击，持有原短棍才用16，否则12（G）；没有人格实体代打。'), selfGain: gain, threatens: gain > 0 }; }
  if (id === 'OBSERVE') return none('只观察眼前原鲁兰仍有自己的心灵与原棍；本槽0灵性0贡献，不读取未来、全知记忆或免费控制。');
  if (id === 'ACCIDENT') return { ...none('判断失衡：本槽固定优势−22.5（G），不赠送人格或重抽。'), selfGain: -22.5 };
  if (id === 'audience.s6.scales') { if (s.spirituality < 2) return { ...none('继承鳞片所需2灵性不足，普通自保10（G）。'), enemyReduction: 10 }; s.spirituality -= 2; return { ...none('继承有限鳞片防护：2灵性，沿用原14×掌握（G）共同减势，不豁免精神、实际伤势或死亡。'), enemyReduction: 14 * mastery(s, id) }; }
  if (id === 'audience.s4.virtual-persona') { if (s.spirituality < 3 || s.mind <= 1) return none('形成有限防守人格需要3灵性与本人1精神；资源不足不产生人格。'); s.spirituality -= 3; s.mind--; e.personaGuards++; e.totalOwnerMindSpent++; ctx.outcome.ownerMindSpent++; return { ...none(`本人形成本场第${e.personaGuards}位短时虚拟人格并在本动作结束时实际重归，实付3灵性和1精神；有限精神防守减势24（G），无实体分身、额外次数或所有心灵伤害免疫。`), enemyReduction: 24 }; }
  if (id === 'audience.s4.mental-plague' && e.plagueApplications > 0) return none('同一原鲁兰已被实际播种一次，本槽不刷新、不重复感染、不耗灵性；原病况仍保留。');
  if (s.spirituality < 4) return none('当前心灵动作需要4灵性，资源不足未接触、不透支、不造成感染。');
  s.spirituality -= 4;
  const difficulty = id === 'audience.s4.mind-island' ? 16 : 18, chance = computeCheckChance({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty, modifiers: [] }), roll = random.nextInt(1, 100);
  if (roll > chance) return none(`原鲁兰当前心灵抵抗：${roll}>${chance}，实际4灵性已付，未${id === 'audience.s4.mind-island' ? '深入或损耗对方精神' : '造成精神瘟疫'}；失败不保证控制。`);
  if (id === 'audience.s4.mind-island') { const damage = Math.min(8, c.enemyMind); c.enemyMind -= damage; e.enemy.mind = c.enemyMind; ctx.outcome.islandMindDamage += damage; return { ...none(`有限心灵岛屿接触成功${roll}≤${chance}：实付4灵性，同一原鲁兰精神实际−${damage}、余${c.enemyMind}，优势42×掌握（G）；本动作已退出，不偷取全部记忆或保证驱动任何行动。`), selfGain: 42 * mastery(s, id), mentalPressure: true }; }
  e.mentalPlague = 1; e.plagueApplications = 1; e.infectedRound = c.round; e.lastPlagueRound = c.round;
  return { ...none(`实际4灵性与意志检定${roll}≤${chance}，同一原鲁兰形成超自然精神瘟疫强度1（G）；本轮不提前扣病况伤害，后续真实回合按4/8/12精神损耗，离场不自动治愈。没有现实病原知识、旁人自动感染或友军免疫。`), mentalPressure: true };
}
export function finishManipulatorCombatRound(s: SliceState, ctx: ManipulatorRoundContext): string { const e = s.manipulator.encounter, c = s.combat!; e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus; if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD'; Object.assign(ctx.outcome, { enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, enemyMentalPlague: e.mentalPlague, plagueApplications: e.plagueApplications, personaGuards: e.personaGuards }); return ctx.label + '本动作心灵接触与防守人格均已真实退出或重归；已付精神及原鲁兰病况保留。'; }
export function projectManipulatorCombat(s: SliceState) { const e = s.manipulator.encounter; return { enemyName: '原40岁仓库看守鲁兰', mentalDefence: '普通当前抵抗，可使检定失败', mentalPlague: e.mentalPlague, enemyMind: e.enemy.mind, source: currentManipulatorCombatSource(s), summary: '4阶核心1250/底线125，灵性120、继续回合恢复12（G）。心灵损耗不判物理死亡；人格实付本人精神，无自动友军免疫，离场不治愈精神瘟疫。' }; }
