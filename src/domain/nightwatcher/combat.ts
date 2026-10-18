import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { SpiritWarlockCompanion } from '../spirit-warlock/types.js';
import { hasNightwatcherDisputeOpponent } from './encounter.js';

/** S4 game budgets. Effects are finite, resisted checks do not get a consolation spell. */
export const NIGHTWATCHER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const nightwatcherActionCount = pyromaniacActionCount;
export type NightwatcherMoveId = 'STRIKE' | 'darkness.s4.limited-misfortune' | 'darkness.s5.spirit-assistance' | 'darkness.s4.area-dream' | 'darkness.s5.spirit-shelter' | 'ACCIDENT';
const ABILITIES: readonly { id: NightwatcherMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '本人普通打击（H；原身体12/自持原棍16×身体G）', weight: 30, stance: 'ATTACK' },
  { id: 'darkness.s4.limited-misfortune', label: '有限厄运（J；4灵性、意志16；成功减势22G，失败0）', weight: 15, stance: 'CONTROL' },
  { id: 'darkness.s5.spirit-assistance', label: '同一个原卷叶协助（B；本轮实际DEPLOYED后2灵性、减势22G；无资源普通避让10）', weight: 20, stance: 'DEFEND' },
  { id: 'darkness.s4.area-dream', label: '有限范围入梦（K；5灵性、意志16；原单敌成功减势18G，本体本槽静止后结束）', weight: 20, stance: 'CONTROL' },
  { id: 'darkness.s5.spirit-shelter', label: '实际派出已取得的原卷叶（R；2灵性、0贡献；未取得或已派出普通观察）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A；固定−22.5G）', weight: 5, stance: null },
];
export const isNightwatcher = (s: SliceState): boolean => s.progression.pathwayId === 'darkness' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function nightwatcherAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] { const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0); return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 })); }
export function drawNightwatcherAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): NightwatcherMoveId { const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0)); for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; } throw new Error('守夜人能力盘无效。'); }
export interface NightwatcherCombatSource { runId: string; revision: number; week: number; round: number; encounterId: 'NIGHTWATCHER_DISPUTE'; attemptWeek: number; startHistoryIndex: number; enemyId: 'NW4-BRAM'; nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN'; weaponId: 'NW4-BRAM-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; visible: true; exit: 'ORIGINAL_OPEN_PRACTICE_YARD_EXIT'; pursuit: false }
export function currentNightwatcherCombatSource(s: SliceState): NightwatcherCombatSource | null { if (!hasNightwatcherDisputeOpponent(s)) return null; const e = s.nightwatcher.encounter; return { runId: s.runId, revision: s.revision, week: s.week, round: s.combat!.round, encounterId: 'NIGHTWATCHER_DISPUTE', attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, enemyId: 'NW4-BRAM', nature: 'ORIGINAL_ADULT_ORDINARY_HUMAN', weaponId: 'NW4-BRAM-CLUB', weaponLocation: 'HAND', distanceMetres: 2, visible: true, exit: 'ORIGINAL_OPEN_PRACTICE_YARD_EXIT', pursuit: false }; }
const validSource = (s: SliceState, source: NightwatcherCombatSource | null): boolean => { const now = currentNightwatcherCombatSource(s); return now !== null && source !== null && Object.entries(now).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value); };
export function hasNightwatcherOriginalSpirit(s: SliceState): boolean {
  const c = s.spiritWarlock.companion, week = s.spiritWarlock.promotionWeek;
  return c.source === 'SW5-LEAF-1' && week !== null && Number.isSafeInteger(week) && c.acquiredWeek !== null && Number.isSafeInteger(c.acquiredWeek) && c.acquiredWeek >= week && c.acquiredWeek <= s.week && c.invitedWeek !== null && Number.isSafeInteger(c.invitedWeek) && c.invitedWeek >= c.acquiredWeek && c.invitedWeek <= s.week && s.spiritWarlock.cases['listening-leaves']!.status !== 'AVAILABLE' && Number.isSafeInteger(c.deployments) && c.deployments >= 0 && Number.isSafeInteger(c.recalls) && c.recalls >= 0 && c.deployments - c.recalls === (c.status === 'DEPLOYED' ? 1 : 0);
}
export interface NightwatcherRoundOutcome { enemyId: 'NW4-BRAM'; enemyHealth: number; enemyMind: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; spiritId: 'SW5-LEAF-1' | null; deployments: number; recalls: number; misfortuneSuccesses: number; dreamSuccesses: number; assistanceSuccesses: number }
export interface NightwatcherRoundContext { source: NightwatcherCombatSource; round: number; outcome: NightwatcherRoundOutcome }
export function beginNightwatcherCombatRound(s: SliceState): NightwatcherRoundContext {
  const source = currentNightwatcherCombatSource(s); if (!source) throw new Error('缺少原布拉姆·洛、原短棍或连续回合来源。');
  const c = s.combat!, spirit = s.spiritWarlock.companion;
  return { source, round: c.round, outcome: { enemyId: 'NW4-BRAM', enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, spiritId: hasNightwatcherOriginalSpirit(s) ? 'SW5-LEAF-1' : null, deployments: spirit.deployments, recalls: spirit.recalls, misfortuneSuccesses: 0, dreamSuccesses: 0, assistanceSuccesses: 0 } };
}
export interface NightwatcherCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): NightwatcherCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveNightwatcherCombatAbility(s: SliceState, id: NightwatcherMoveId, physicalStateFactor: number, random: ActionRandomStream, ctx: NightwatcherRoundContext, source: NightwatcherCombatSource | null = ctx.source): NightwatcherCombatEffect {
  if (ctx.round !== s.combat?.round || !validSource(s, source)) return none('缺少当前原布拉姆·洛、原短棍或连续回合，0贡献、0消耗，不重抽。');
  if (!ABILITIES.some(a => a.id === id)) return none('这不是当前已实现的守夜人动作，0贡献、0消耗。');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0, spirit = s.spiritWarlock.companion;
  const evade = (reason: string): NightwatcherCombatEffect => ({ ...none(`${reason}本槽只作本人普通身体避让，减势10（G），0灵性；不假称施法、不保证免伤。`), enemyReduction: 10 });
  if (id === 'ACCIDENT') return { ...none('判断失衡，本槽固定优势−22.5（G），不另抽或新增行动。'), selfGain: -22.5 };
  if (id === 'STRIKE') return { ...none(`本人使用${s.town.clubLocation === 'HAND' ? '自己实际持握的原短棍' : '自己的原身体'}普通打击，12/16×身体（G），0灵性；不附送恐惧攻击。`), selfGain: (s.town.clubLocation === 'HAND' ? 16 : 12) * physical, threatens: physical > 0 };
  if (id === 'darkness.s5.spirit-shelter') {
    if (spirit.status !== 'SEALED' || !hasNightwatcherOriginalSpirit(s) || ctx.outcome.spiritId !== 'SW5-LEAF-1' || s.spirituality < 2) return none('没有当前SEALED且已实际取得的同一原卷叶，原灵已派出，或不足2灵性。本槽普通观察，0贡献、0消耗；不免费招灵、不复制原灵。');
    s.spirituality -= 2; spirit.status = 'DEPLOYED'; spirit.deployments++;
    return none('实耗2灵性，同一个SW5-LEAF-1实际离开原牙齿协助；原派出计数+1，本槽0贡献。后续已抽中B仍需付费，每轮结束实际召回。');
  }
  if (id === 'darkness.s5.spirit-assistance') {
    if (spirit.status !== 'DEPLOYED' || !hasNightwatcherOriginalSpirit(s) || ctx.outcome.spiritId !== 'SW5-LEAF-1' || s.spirituality < 2) return evade('没有本轮实际派出的同一原卷叶或不足2灵性。');
    s.spirituality -= 2; ctx.outcome.assistanceSuccesses++;
    return { ...none('实耗2灵性，已实际DEPLOYED的同一个SW5-LEAF-1在近处做一次有限干扰，减势22（G）；无额外自主行动、身体飞行、穿地或保证免伤。'), enemyReduction: 22 };
  }
  const misfortune = id === 'darkness.s4.limited-misfortune', cost = misfortune ? 4 : 5;
  if (s.spirituality < cost) return evade(`灵性不足${cost}，不能实施${misfortune ? '有限厄运' : '范围入梦'}。`);
  s.spirituality -= cost;
  const chance = computeCheckChance({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 16, modifiers: [] }), roll = random.nextInt(1, 100);
  if (roll > chance) return none(`${misfortune ? '有限厄运' : '范围入梦'}实际意志检验${roll}>${chance}，${cost}灵性照耗，0效果、0贡献；不附送普通避让、不重抽，原人仍清醒抵抗。`);
  if (misfortune) { ctx.outcome.misfortuneSuccesses++; return { ...none(`有限厄运实耗4灵性、意志${roll}≤${chance}；当前原人的一次普通动作出现有限差错，減势22（G）。只限本槽，不积攒运气、不制造额外敌人或保证死亡。`), enemyReduction: 22 }; }
  ctx.outcome.dreamSuccesses++;
  return { ...none(`范围入梦实耗5灵性、意志${roll}≤${chance}；本场只有这个原普通成年敌人，你在本槽保持原身体不动，形成一次有限梦境牵制，减势18（G），本槽后实际结束。没有永久昏睡、删除行动、梦中真话、治疗或跨梦位移。`), enemyReduction: 18 };
}
export function finishNightwatcherCombatRound(s: SliceState, ctx: NightwatcherRoundContext, _continues: boolean): string {
  const e = s.nightwatcher.encounter, c = s.combat!, spirit = s.spiritWarlock.companion;
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  const recalled = spirit.status === 'DEPLOYED' && ctx.outcome.spiritId === 'SW5-LEAF-1' && hasNightwatcherOriginalSpirit(s);
  if (recalled) { spirit.status = 'SEALED'; spirit.recalls++; }
  Object.assign(ctx.outcome, { enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemyStatus: c.enemyStatus, deployments: spirit.deployments, recalls: spirit.recalls });
  return `本轮有限厄运和梦境已结束；${recalled ? '同一个SW5-LEAF-1实际回到原牙齿，召回计数+1；下一轮须重新R派出才可B协助。' : '没有仍在派出的本轮原灵，不虚记召回。'}实际原灵来源、派出与召回历史保留，回灵不增加灵体，不治疗、不复活。`;
}
export interface PublicNightwatcherCombatProjection {
  enemyName: string;
  companion: Pick<SpiritWarlockCompanion, 'source' | 'status' | 'acquiredWeek' | 'invitedWeek' | 'releases' | 'deployments' | 'recalls'>;
  summary: string;
}
export function projectNightwatcherCombat(s: SliceState): PublicNightwatcherCombatProjection {
  const companion = s.spiritWarlock.companion;
  return { enemyName: '原45岁布拉姆·洛', companion: {
    source: companion.source, status: companion.status, acquiredWeek: companion.acquiredWeek, invitedWeek: companion.invitedWeek,
    releases: companion.releases, deployments: companion.deployments, recalls: companion.recalls,
  }, summary: '4阶核心1250/底线125，灵性上限120、继续回合恢复12（G）。有限厄运与梦境均可失败且仅本槽有效；同一个旧卷叶须实际取得、当轮R派出才可B付费协助，每轮实际召回。无资源仅普通观察或身体避让，付费检验失败0贡献。没有运气库、永久昏睡、免费灵、灵界旅行或复活。' }; }
