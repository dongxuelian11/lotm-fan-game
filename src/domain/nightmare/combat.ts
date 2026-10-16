import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed S7 C-profile. All budgets, distances and process thresholds are G. */
export const NIGHTMARE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
]);

export type NightmareMoveId = 'darkness.s8.physical-training' | 'darkness.s8.physical-follow-up'
  | 'darkness.s8.self-protection' | 'darkness.s7.dream-entry' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: NightmareMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'darkness.s8.physical-training', label: '身体训练打击', weight: 20, stance: 'ATTACK' },
  { id: 'darkness.s8.physical-follow-up', label: '近身身体应对', weight: 15, stance: 'ATTACK' },
  { id: 'darkness.s8.self-protection', label: '身体自保', weight: 20, stance: 'DEFEND' },
  { id: 'darkness.s7.dream-entry', label: '有限梦境牵制', weight: 30, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '渐进牵入梦境', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '疲劳或误判', weight: 7, stance: null },
];

export function isNightmare(state: SliceState): boolean {
  return state.progression?.pathwayId === 'darkness' && state.progression.sequence === 7;
}
export function isSootherCombat(state: SliceState): boolean {
  return state.progression?.pathwayId === 'darkness' && state.progression.sequence === 6;
}
/** S6 inherits the complete S7 wheel, without adding its daily spirit abilities. */
export function hasNightmareCombat(state: SliceState): boolean {
  return isNightmare(state) || isSootherCombat(state);
}
function dreamEncounter(state: SliceState) {
  return isSootherCombat(state) || state.combat?.encounterId === 'SOOTHER_DISPUTE'
    ? state.soother.encounter : state.nightmare.encounter;
}
export function nightmareDreamLocked(state: SliceState): boolean {
  return dreamEncounter(state).dreamLocked;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function nightmareAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawNightmareAbility(random: ActionRandomStream, stance: SliceStance | null): NightmareMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('梦魇能力盘权重无效');
}
export function nightmareActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 85 ? 4 : 5;
}

export interface NightmareCombatEffect {
  label: string; selfGain: number; enemyReduction: number;
  /** Dream pressure/control alone can never authorize physical injury or death. */
  threatens: boolean;
}
function noEffect(label: string): NightmareCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasLiveCombat(state: SliceState): boolean {
  return hasNightmareCombat(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}

export interface NightmareNightSource {
  encounterId: 'NIGHTMARE_DISPUTE'; round: number; attemptWeek: number; startHistoryIndex: number;
  target: 'KELL_SINGLE_ORDINARY_ADULT'; body: 'CURRENT_VISIBLE_BODY';
  origin: 'OBSERVED_AWAKE_BEFORE_PULL'; time: 'SCHEDULED_NIGHT';
  space: 'OPEN_SMALL_COURTYARD'; exit: 'ORDINARY_OPEN_EXIT';
  range: 'LOCAL_DREAM_AT_MOST_SIX_METRES';
  bystander: 'PORTER_PRESENT' | 'PORTER_WITHDRAWN'; aggression: 'VISIBLE_SHORT_CLUB_THREAT';
}

/** A historical night/watch cannot supply the body, geometry or attempt of this fight. */
export function currentNightmareNightSource(state: SliceState): NightmareNightSource | null {
  const encounter = state.nightmare.encounter;
  if (!hasLiveCombat(state) || !isNightmare(state) || state.world.city !== 'BACKLUND' ||
      state.combat!.encounterId !== 'NIGHTMARE_DISPUTE' || encounter.status !== 'FIGHTING' ||
      !encounter.observed || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 || encounter.startHistoryIndex > state.combatHistory.length) return null;
  return { encounterId: 'NIGHTMARE_DISPUTE', round: state.combat!.round,
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    target: 'KELL_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY',
    origin: 'OBSERVED_AWAKE_BEFORE_PULL', time: 'SCHEDULED_NIGHT', space: 'OPEN_SMALL_COURTYARD',
    exit: 'ORDINARY_OPEN_EXIT', range: 'LOCAL_DREAM_AT_MOST_SIX_METRES',
    bystander: encounter.bystanderCleared ? 'PORTER_WITHDRAWN' : 'PORTER_PRESENT',
    aggression: 'VISIBLE_SHORT_CLUB_THREAT' };
}
export interface SootherNightSource {
  encounterId: 'SOOTHER_DISPUTE'; round: number; attemptWeek: number; startHistoryIndex: number;
  target: 'ALAN_SINGLE_ORDINARY_ADULT'; body: 'CURRENT_VISIBLE_BODY';
  origin: 'OBSERVED_AWAKE_BEFORE_PULL'; time: 'SCHEDULED_NIGHT';
  space: 'ORIGINAL_NIGHT_WATCH_OUTER_COURTYARD'; exit: 'ORIGINAL_OPEN_EXIT';
  range: 'LOCAL_DREAM_AT_TWO_METRES'; bystander: 'NONE'; aggression: 'VISIBLE_SHORT_CLUB_THREAT';
  weapon: 'ALANS_ORDINARY_SHORT_CLUB'; lighting: 'ORIGINAL_FIXED_LAMPLIGHT';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; pursuit: false;
}
export type NightmareCombatNightSource = NightmareNightSource | SootherNightSource;

/** This paid encounter supplies Alan and the current night, never Kell's old encounter. */
export function currentSootherNightSource(state: SliceState): SootherNightSource | null {
  const combat = state.combat;
  if (!isSootherCombat(state) || !hasLiveCombat(state) || state.activeEvent !== null ||
      state.world.city !== 'BACKLUND' || !combat || combat.encounterId !== 'SOOTHER_DISPUTE' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1) return null;
  const encounter = state.soother.encounter;
  if (encounter.status !== 'FIGHTING' || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(encounter.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { encounterId: 'SOOTHER_DISPUTE', round: combat.round,
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    target: 'ALAN_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY',
    origin: 'OBSERVED_AWAKE_BEFORE_PULL', time: 'SCHEDULED_NIGHT',
    space: 'ORIGINAL_NIGHT_WATCH_OUTER_COURTYARD', exit: 'ORIGINAL_OPEN_EXIT',
    range: 'LOCAL_DREAM_AT_TWO_METRES', bystander: 'NONE', aggression: 'VISIBLE_SHORT_CLUB_THREAT',
    weapon: 'ALANS_ORDINARY_SHORT_CLUB', lighting: 'ORIGINAL_FIXED_LAMPLIGHT',
    distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', pursuit: false };
}
export function currentNightmareCombatSource(state: SliceState): NightmareCombatNightSource | null {
  return isSootherCombat(state) ? currentSootherNightSource(state) : currentNightmareNightSource(state);
}
function hasClearDreamTarget(source: NightmareCombatNightSource | null): boolean {
  return source !== null && (source.bystander === 'NONE' || source.bystander === 'PORTER_WITHDRAWN');
}
export function currentNightmareDreamSource(state: SliceState): NightmareCombatNightSource | null {
  const source = currentNightmareCombatSource(state);
  return hasClearDreamTarget(source) && state.combat!.enemyMind > 0 ? source : null;
}
function validNightSource(state: SliceState, source: NightmareCombatNightSource | null): boolean {
  const current = currentNightmareCombatSource(state);
  if (current === null || source === null) return false;
  if (current.encounterId === 'SOOTHER_DISPUTE' &&
      (source.encounterId !== 'SOOTHER_DISPUTE' || source.weapon !== current.weapon ||
       source.lighting !== current.lighting || source.distanceMetres !== current.distanceMetres ||
       source.ground !== current.ground || source.pursuit !== current.pursuit)) return false;
  return source.encounterId === current.encounterId &&
    source.round === current.round && source.attemptWeek === current.attemptWeek &&
    source.startHistoryIndex === current.startHistoryIndex && source.target === current.target &&
    source.body === current.body && source.origin === current.origin && source.time === current.time &&
    source.space === current.space && source.exit === current.exit && source.range === current.range &&
    source.bystander === current.bystander && source.aggression === current.aggression;
}
function masteryFactor(state: SliceState, id: string): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** Also used before ordinary retreat; no magical movement or free escape is granted. */
export function releaseNightmareDream(state: SliceState): void {
  const encounter = dreamEncounter(state);
  encounter.dreamLocked = false;
  encounter.pressure = 0;
}

/** Unfinished pressure is battle-local; a surviving lock never crosses a round boundary. */
export function finishNightmareCombatRound(state: SliceState, continuing: boolean): void {
  if (!continuing || nightmareDreamLocked(state) || !currentNightmareDreamSource(state)) {
    releaseNightmareDream(state);
  }
}

/** Called after the ability draw, so immobility consumes the original physical slot. */
export function resolveNightmareCombatAbility(
  state: SliceState, id: NightmareMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: NightmareCombatNightSource | null = currentNightmareCombatSource(state),
): NightmareCombatEffect {
  if (!hasLiveCombat(state)) {
    releaseNightmareDream(state);
    return noEffect('梦魇能力：当前没有可结算的对应战斗行动');
  }
  const encounter = dreamEncounter(state);
  const targetName = state.combat!.encounterId === 'SOOTHER_DISPUTE' ? '阿兰' : '凯尔';
  const night = validNightSource(state, source), nightFactor = night ? 1.1 : 1;
  const dreamSource = night && hasClearDreamTarget(source) && state.combat!.enemyMind > 0;
  if (!dreamSource) releaseNightmareDream(state);
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  if (encounter.dreamLocked && (id === 'darkness.s8.physical-training' ||
      id === 'darkness.s8.physical-follow-up' || id === 'darkness.s8.self-protection')) {
    return noEffect('梦境牵制仍在维持：施术者本体不能移动，本次已抽中的身体行动贡献0，不耗额外资源、不重抽；原短棍也不能绕过本体限制');
  }
  switch (id) {
    case 'darkness.s8.physical-training':
    case 'darkness.s8.physical-follow-up': {
      const primary = id === 'darkness.s8.physical-training';
      const armed = primary && state.town.clubLocation === 'HAND';
      const selfGain = armed ? 16 * physical
        : (primary ? 20.475 : 11.025) * masteryFactor(state, 'darkness.s8.physical-training') * nightFactor * physical;
      return { label: armed
        ? '持握原短棍打击：采用原短棍普通规则，不叠加C主攻预算或夜间强化'
        : `${primary ? '身体训练打击' : '近身身体应对'}：${night ? '本次已确认夜间，贡献×1.1（G）' : '当前未确认夜间，无夜间加成'}`,
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'darkness.s8.self-protection':
      return { ...noEffect(`身体自保：以继承的身体训练避让眼前打击，${night ? '本次已确认夜间，贡献×1.1（G）' : '当前未确认夜间，无夜间加成'}；不保证免伤`),
        enemyReduction: 29.25 * masteryFactor(state, 'darkness.s8.physical-training') * nightFactor };
    case 'OBSERVE': {
      if (!dreamSource) return noEffect('渐进牵入梦境：缺少本次已观察的清醒普通目标、有效近距来源或旁人尚未撤离，贡献0；未耗灵性、不作检定、不重抽，不读取秘密');
      if (encounter.dreamLocked) return noEffect('渐进牵入梦境：维持现有梦境，本体不能移动，没有重复牵梦或额外优势；本次贡献0，不重抽、不另扣重新施术费用，最初施术消耗保留');
      if (!(state.spirituality >= 3)) return noEffect('渐进牵入梦境：灵性不足3，贡献0，不扣费、不作检定、不重抽');
      state.spirituality -= 3;
      encounter.pressure = encounter.pressure === 0 ? 1 : 2;
      return noEffect(`渐进牵入梦境：耗灵性3，牵引积累${encounter.pressure}/2（G），本次即时贡献0；从清醒状态逐渐牵引，${targetName}仍按原次数行动，尚未形成梦境锁定，不读取秘密`);
    }
    case 'darkness.s7.dream-entry': {
      if (!dreamSource) return noEffect('有限梦境牵制：本次目标或近距来源无效，贡献0；未耗灵性、不作检定、不重抽');
      if (encounter.dreamLocked) return noEffect('有限梦境牵制：维持现有梦境，本体不能移动，没有重复牵梦或额外优势；本次贡献0，不重抽、不另扣重新施术费用，最初施术消耗保留');
      if (encounter.pressure < 2) return noEffect(`有限梦境牵制：牵引积累仅${encounter.pressure}/2，须先渐进牵引；贡献0，不瞬间催眠、不扣费、不作检定、不重抽`);
      if (!(state.spirituality >= 4)) return noEffect('有限梦境牵制：灵性不足4，贡献0，不扣费、不作检定、不重抽');
      state.spirituality -= 4;
      const result = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
        difficulty: 16, modifiers: [], roll: random.nextInt(1, 100) });
      state.lastCheck = result;
      const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      if (success) encounter.dreamLocked = true;
      else releaseNightmareDream(state);
      return { ...noEffect(`有限梦境牵制：耗灵性4，意志${result.roll}/${result.chance}，${success ? '成功' : '失败'}；${success
        ? '在逐渐牵引后形成短暂梦境牵制，夜间贡献×1.1（G）；施术者本体不能移动，对方下次原行动仍会抵抗'
        : '目标抵抗住牵引，贡献0，牵引积累归0'}；不制造身体伤害、不删除对方行动次数`),
      enemyReduction: success ? 15.75 * masteryFactor(state, 'darkness.s7.dream-entry') * nightFactor : 0 };
    }
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`疲劳或误判：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不叠加夜间强化、不构成致伤攻击`), selfGain };
    }
  }
}

export interface NightmareEnemyResponse {
  suppressed: boolean; physicalMultiplier: 1 | 1.25; label: string;
}

/** Modifies just the already-drawn original action; it never draws an extra move. */
export function resolveNightmareEnemyAction(
  state: SliceState, random: ActionRandomStream, physicalAttack: boolean,
): NightmareEnemyResponse | null {
  if (!currentNightmareDreamSource(state)) {
    releaseNightmareDream(state);
    return null;
  }
  if (!nightmareDreamLocked(state)) return null;
  const targetName = state.combat!.encounterId === 'SOOTHER_DISPUTE' ? '阿兰' : '凯尔';
  // G: this authored ordinary adult has will 8; difficulty is the player's
  // actual will, using the existing normal check and its ordinary 5–95% cap.
  const result = resolveNormalCheck({ ability: 'will', baseAbility: 8,
    difficulty: state.character.coreStats.will, modifiers: [], roll: random.nextInt(1, 100) });
  state.lastCheck = result;
  const resisted = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
  releaseNightmareDream(state);
  return { suppressed: !resisted, physicalMultiplier: resisted && physicalAttack ? 1.25 : 1,
    label: `${targetName}抵抗梦境：普通意志8对施术者意志${result.difficulty}（G），${result.roll}/${result.chance}，${resisted
      ? `成功抵抗，执行本次原行动${physicalAttack ? '；施术者本体暴露，本次原身体打击贡献×1.25（G）' : ''}`
      : '未能抵抗，仅本次原行动贡献0，原行动次数保留'}；本次行动后解除梦境牵制、牵引积累归0` };
}
