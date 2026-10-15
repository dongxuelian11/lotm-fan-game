import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveBardActorCombatAbility, type BardEffectContext, type BardMoveId } from '../bard/combat.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { marauderPlayerHoldsClub } from '../marauder/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** All budgets and the two round windows are finite G, not canon distances/hours. */
export const FIRE_THIEF_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
  Object.freeze({ id: '6', label: '6次', weight: 12 }),
]);
export type FireThiefMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'COVER' | 'SITE_PRESSURE'
  | 'OBSERVE' | 'ACCIDENT' | 'error.s6.power-theft';
const ABILITIES: readonly { id: FireThiefMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'BODY_STRIKE', label: '普通身体打击（12；原持棍16替换；0灵性）', weight: 20, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通身体次击（8；0灵性）', weight: 15, stance: 'ATTACK' },
  { id: 'COVER', label: '解读本轮已见普通动作（有界减势；无来源普通格挡10）', weight: 20, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '普通现场牵制（减势8；不取消行动）', weight: 10, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察当前事实与原出口（0贡献；不读取能力池、不窃取）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '普通动作偏差（±11.25；不致伤）', weight: 7, stance: null },
  { id: 'error.s6.power-theft', label: '能力暂窃／使用：亲见勇气后3灵性尝试；已借时2灵性释放一次勇气自保5.2f；玩家最多2轮、原主3轮；否则格挡10（G）', weight: 18, stance: 'CONTROL' },
];
export function isFireThief(state: SliceState): boolean {
  return state.progression?.pathwayId === 'error' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(entry => entry.weight * (stance !== null && entry.stance === stance ? 5 : 4));
}
export function fireThiefAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((entry, index) => ({ id: entry.id, label: entry.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawFireThiefAbility(random: ActionRandomStream, stance: SliceStance | null): FireThiefMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('盗火人能力盘权重无效');
}
export function fireThiefActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 45 ? 3 : roll <= 68 ? 4 : roll <= 88 ? 5 : 6;
}

/** The current paid arrival is the sole source; daily teachers/loans never supply this opponent. */
export interface FireThiefCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRE_THIEF_DISPUTE'; target: 'BELIN_SINGLE_ADULT_BARD'; nature: 'SUN_SEQUENCE_9';
  attemptWeek: number; startHistoryIndex: number; body: 'CURRENT_REACHABLE_BODY';
  weapon: 'BELINS_OWN_ORDINARY_SHORT_CLUB'; space: 'ORIGINAL_MENTOR_PRACTICE_OUTER_COURTYARD';
  visibility: 'MUTUALLY_VISIBLE'; lighting: 'ORIGINAL_FIXED_LAMPLIGHT'; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  abilityObservation: 'CURRENT_BATTLE_ACTUAL_ACTIONS_ONLY';
}
export function currentFireThiefCombatSource(state: SliceState): FireThiefCombatSource | null {
  const combat = state.combat, e = state.fireThief.encounter;
  const loan = e.battleLoan;
  if (!isFireThief(state) || state.status !== 'ACTIVE' || state.health <= 0 || state.mind <= 0 ||
      state.activeEvent !== null || state.world.city !== 'BACKLUND' || !combat ||
      combat.encounterId !== 'FIRE_THIEF_DISPUTE' || combat.enemyStatus !== 'RESISTING' || combat.enemyHealth <= 0 ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      Object.values(state.fireThief.cases).some(item => item.contactOpen || item.status === 'PREPARED') ||
      !Object.values(state.fireThief.cases).some(item => item.status === 'RESOLVED') ||
      state.fireThief.loan.playerSteps !== 0 || state.fireThief.loan.targetSteps !== 0 ||
      !Number.isSafeInteger(e.enemySpirituality) || e.enemySpirituality < 0 || e.enemySpirituality > 20 ||
      typeof e.enemyCourageSeen !== 'boolean' ||
      !Number.isSafeInteger(loan.playerRounds) || loan.playerRounds < 0 || loan.playerRounds > 2 ||
      !Number.isSafeInteger(loan.targetRounds) || loan.targetRounds < 0 || loan.targetRounds > 3 ||
      (loan.uses !== 0 && loan.uses !== 1) || (loan.uses === 1 && loan.playerRounds !== 0) ||
      (loan.startedRound === null ? loan.playerRounds !== 0 || loan.targetRounds !== 0 || loan.uses !== 0
        : !Number.isSafeInteger(loan.startedRound) || loan.startedRound < 1 || loan.startedRound > combat.round || !e.enemyCourageSeen) ||
      e.status !== 'FIGHTING' || e.attemptWeek !== state.week || e.startHistoryIndex === null ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'FIRE_THIEF_DISPUTE', target: 'BELIN_SINGLE_ADULT_BARD', nature: 'SUN_SEQUENCE_9',
    attemptWeek: e.attemptWeek, startHistoryIndex: e.startHistoryIndex, body: 'CURRENT_REACHABLE_BODY',
    weapon: 'BELINS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_MENTOR_PRACTICE_OUTER_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2,
    ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false,
    abilityObservation: 'CURRENT_BATTLE_ACTUAL_ACTIONS_ONLY' };
}
function validSource(state: SliceState, source: FireThiefCombatSource | null): boolean {
  const current = currentFireThiefCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}

/** Called once at the start of an actual round, never by projection or a single K use.
 * Derivation is idempotent if re-entered in that same round. Finish increments combat.round
 * but persists the just-resolved windows, so merely viewing the next round cannot spend time. */
export function beginFireThiefCombatRound(state: SliceState): string | null {
  if (!currentFireThiefCombatSource(state)) return null;
  const loan = state.fireThief.encounter.battleLoan;
  if (loan.startedRound === null) return null;
  const previousTargetRounds = loan.targetRounds;
  const elapsed = state.combat!.round - loan.startedRound;
  if (!Number.isSafeInteger(elapsed) || elapsed < 0) return null;
  loan.playerRounds = loan.uses > 0 ? 0 : Math.max(0, 2 - elapsed);
  loan.targetRounds = Math.max(0, 3 - elapsed);
  return previousTargetRounds > 0 && loan.targetRounds === 0
    ? '本轮开始，原主受限的3轮窗口实际到期，贝林的原勇气能力恢复可用；玩家暂借份额保持已用完或到期，不补灵性、不自动唱歌、不额外行动。'
    : null;
}
export interface FireThiefCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): FireThiefCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function guard(label: string): FireThiefCombatEffect {
  return { ...noEffect(`${label}；按预写保底普通格挡10（G），不耗灵性、不抽检定、不重抽`), enemyReduction: 10 };
}
function masteryFactor(state: SliceState, id: string): number {
  const value = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500;
}

/** This actual S9 actor uses the unchanged Bard budgets. Existing songs cost zero S.
 * Only Courage B/K is unavailable during target time; praise and real club attacks continue. */
export function resolveFireThiefEnemyAction(
  state: SliceState, id: BardMoveId, suppressed: boolean, random: ActionRandomStream,
  context: BardEffectContext = { pendingSupportBudgets: [], finished: false }, physicalStateFactor = 1,
  source: FireThiefCombatSource | null = currentFireThiefCombatSource(state),
): (FireThiefCombatEffect & { courage: boolean }) | null {
  if (suppressed || context.finished || !validSource(state, source)) return null;
  const isCourage = id === 'sun.s9.courage' || id === 'BREAK_FEAR';
  if (isCourage && state.fireThief.encounter.battleLoan.targetRounds > 0) {
    return { ...noEffect(id === 'sun.s9.courage'
      ? '贝林的勇气暂时不可用：改以普通格挡护身10（G）；原赞歌、身体与原短棍动作仍可继续，0灵性'
      : '贝林的勇气暂时不可用：改以普通现场牵制8（G）；不唱勇气、不取消任何身体动作，0灵性'),
      enemyReduction: id === 'sun.s9.courage' ? 10 : 8, courage: false };
  }
  const effect = resolveBardActorCombatAbility({ armed: true, physicalStateFactor,
    praiseMastery: 0, courageMastery: 0, targetDescription: '眼前盗火人' }, id,
    random, context);
  if (isCourage) state.fireThief.encounter.enemyCourageSeen = true;
  return { ...effect, label: `成年序列9歌颂者贝林：${effect.label}；沿既有歌颂者零灵性预算`, courage: isCourage };
}

type OrdinaryMove = 'STRIKE' | 'BLOCK' | 'OPENING' | 'DISTANCE' | 'MISS';
const FACTS: Readonly<Record<OrdinaryMove, string>> = {
  STRIKE: '本轮实际短棍打击的接近方式', BLOCK: '本轮实际格挡姿态',
  OPENING: '本轮实际寻找空当的普通站位', DISTANCE: '本轮实际退开距离', MISS: '本轮刚发生的动作落空',
};
/** Resolver-local evidence; never recovered by parsing labels, prior fights or future draws. */
export interface FireThiefRoundObservations {
  source: FireThiefCombatSource | null; lastMove: OrdinaryMove | null; remainingContribution: number;
}
export function createFireThiefRoundObservations(state: SliceState): FireThiefRoundObservations {
  return { source: currentFireThiefCombatSource(state), lastMove: null, remainingContribution: 0 };
}
export function observeFireThiefEnemyAction(
  state: SliceState, observations: FireThiefRoundObservations, id: string, actualSelfGain: number,
  suppressed = false, courage = false,
): void {
  if (suppressed || courage || !validSource(state, observations.source) || !Object.hasOwn(FACTS, id)) return;
  observations.lastMove = id as OrdinaryMove;
  if ((id === 'STRIKE' || id === 'OPENING') && Number.isFinite(actualSelfGain) && actualSelfGain > 0) {
    observations.remainingContribution += Math.min(id === 'STRIKE' ? 16 : 8, actualSelfGain);
  }
}
export function resolveFireThiefCombatAbility(
  state: SliceState, id: FireThiefMoveId, physicalStateFactor: number, random: ActionRandomStream,
  observations: FireThiefRoundObservations = createFireThiefRoundObservations(state),
  source: FireThiefCombatSource | null = currentFireThiefCombatSource(state),
): FireThiefCombatEffect {
  if (!validSource(state, source)) return noEffect('盗火人行动：缺少本场实际到场、仍可行动的贝林与原外院来源，本次贡献0、不耗灵性、不抽检定');
  if (id === 'error.s6.power-theft') {
    const e = state.fireThief.encounter, loan = e.battleLoan;
    if (loan.playerRounds > 0) {
      if (!Number.isFinite(state.spirituality) || state.spirituality < 2) return guard('暂借勇气仍在玩家窗口内，但当前不足2灵性');
      state.spirituality -= 2; loan.uses = 1; loan.playerRounds = 0;
      const effect = resolveBardActorCombatAbility({ armed: false, physicalStateFactor,
        praiseMastery: 0, courageMastery: state.progression.mastery['error.s6.borrowed-power'] ?? 0,
        targetDescription: '贝林' }, 'sun.s9.courage', random, { pendingSupportBudgets: [], finished: false });
      return { ...effect, label: `使用暂借的勇气：已耗2灵性，沿勇气原B槽5.2×借用掌握系数自保减势（G），一次性临时扇区已用完；玩家份额归0，原主仍剩${loan.targetRounds}轮，原主时钟独立继续；${effect.label}` };
    }
    if (!e.enemyCourageSeen) return guard('尚未在本场亲见贝林实际唱出勇气；观察不会读取隐藏能力池');
    if (loan.targetRounds > 0) return guard('玩家借用窗口已结束，原主勇气仍暂时不可用；不能重复窃取或续期');
    if (!Number.isFinite(state.spirituality) || state.spirituality < 3) return guard('当前不足3灵性，不能尝试暂窃勇气');
    state.spirituality -= 3;
    const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: state.character.coreStats.knowledge,
      difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
    const success = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
    if (success) { loan.playerRounds = 2; loan.targetRounds = 3; loan.startedRound = state.combat!.round; loan.uses = 0; }
    return noEffect(`暂窃亲见的勇气：已耗3灵性；知识难度14，成功率${check.chance}%，实抽${check.roll}/100；${success
      ? '成功，玩家借用2轮、原主停用3轮（G）分别计时；当前0即时贡献，下一次抽到本槽才能另耗2灵性使用'
      : '失败，本次贡献0，已付灵性不返还'}；不撤销已发生歌声，不永久复制，不偷取思想、梦境、身体行动或污染`);
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'BODY_STRIKE': {
      const held = marauderPlayerHoldsClub(state), armed = held || state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 12) * physical;
      return { ...noEffect(armed
        ? `持握${held ? '塞蒙原' : '原'}短棍打击：普通16×身体状态（G）替换而不叠加主攻，原所有权不变；0灵性`
        : '普通身体打击：12×身体状态（G），不附加暂借勇气或解密攻击；0灵性'), selfGain, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 8 * physical;
      return { ...noEffect('普通身体次击：8×身体状态（G），不追加持棍或法术攻击；0灵性'), selfGain, threatens: selfGain > 0 };
    }
    case 'COVER': {
      if (!validSource(state, observations.source) || observations.remainingContribution <= 0) return guard('本轮没有尚未抵消的已见正向普通动作');
      const reduction = Math.min(31.5 * masteryFactor(state, 'error.s7.decryption'), observations.remainingContribution);
      observations.remainingContribution -= reduction;
      return { ...noEffect(`解读已实际发生的普通动作：本次减势${reduction}（G），仅抵消本轮尚未抵消的已观察普通贡献；不读取未来动作、不取消歌声或身体行动；0灵性`), enemyReduction: reduction };
    }
    case 'SITE_PRESSURE': return { ...noEffect('普通现场牵制：减势8（G），不取消身体行动、不建立继承骗局或能力停用；0灵性'), enemyReduction: 8 };
    case 'OBSERVE': return noEffect(`观察当前事实：${validSource(state, observations.source) && observations.lastMove !== null ? FACTS[observations.lastMove] : '贝林在原照明下可见，原出口净空'}；本槽贡献0，不检查能力池、不标记亲见勇气、不发动窃取、不预知下一抽`);
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`普通动作偏差：本次贡献${selfGain}（G），不致伤、不耗灵性、不抹除污染`), selfGain };
    }
  }
}
