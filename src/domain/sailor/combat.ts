import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed Tyrant V2 S9 M-profile. Contributions are game balance (G). */
export const SAILOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 35 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
]);

export type SailorMoveId = 'tyrant.s9.physique' | 'tyrant.s9.aquatic-affinity'
  | 'tyrant.s9.balance' | 'GRIP' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: SailorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'tyrant.s9.physique', label: '水手体术', weight: 38, stance: 'ATTACK' },
  { id: 'tyrant.s9.aquatic-affinity', label: '水中突袭/投掷', weight: 20, stance: 'ATTACK' },
  { id: 'tyrant.s9.balance', label: '幻鳞与平衡自保', weight: 8, stance: 'DEFEND' },
  { id: 'GRIP', label: '近身抓握', weight: 5, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '选择立足点', weight: 4, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '步伐偏差', weight: 25, stance: null },
];

export function isSailor(state: SliceState): boolean {
  return state.progression?.pathwayId === 'tyrant' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function sailorAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawSailorAbility(random: ActionRandomStream, stance: SliceStance | null): SailorMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('水手能力盘权重无效');
}
export function sailorActionCount(roll: number): number {
  return roll <= 35 ? 1 : roll <= 65 ? 2 : roll <= 85 ? 3 : 4;
}

export interface SailorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): SailorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasLiveCombat(state: SliceState): boolean {
  return isSailor(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}

/** A current ordinary scene, not a tag inferred from old aquatic practice. */
export interface SailorFirstCaseCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; body: 'CURRENT_VISIBLE_BODY';
  space: 'DRY_GROUND_PASSAGE'; water: 'NONE'; throwable: 'NONE'; exit: 'ORDINARY_OPEN_EXIT';
}
/** Authored S6 visit: this adult and his own weapon never alias the first-case carrier. */
export interface WindBlessedCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'WIND_BLESSED_DISPUTE'; target: 'RUEN_SINGLE_ORDINARY_ADULT';
  body: 'CURRENT_VISIBLE_BODY'; scene: 'CURRENT_VISIBLE_BODY_AND_OWN_SHORT_CLUB';
  attemptWeek: number; startHistoryIndex: number; weapon: 'RUENS_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_REPAIR_YARD_OUTER_COURTYARD';
  visibility: 'MUTUALLY_VISIBLE'; lighting: 'ORIGINAL_FIXED_LAMPLIGHT';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND';
  water: 'NONE'; throwable: 'NONE'; bystanders: 'NONE';
  exit: 'ORDINARY_OPEN_EXIT'; pursuit: false;
}
export type SailorCombatSource = SailorFirstCaseCombatSource | WindBlessedCombatSource;
export function currentWindBlessedCombatSource(state: SliceState): WindBlessedCombatSource | null {
  const combat = state.combat, windBlessed = state.windBlessed;
  if (state.progression?.pathwayId !== 'tyrant' || state.progression.sequence !== 6 ||
      state.status !== 'ACTIVE' || state.health <= 0 || state.activeEvent !== null ||
      state.world.city !== 'BACKLUND' || !combat || combat.encounterId !== 'WIND_BLESSED_DISPUTE' ||
      combat.enemyHealth <= 0 || combat.enemyStatus !== 'RESISTING' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 || !windBlessed ||
      windBlessed.flight.position !== 'GROUND' || Object.values(windBlessed.cases).some(entry => entry.contactOpen)) return null;
  const encounter = windBlessed.encounter;
  if (encounter.status !== 'FIGHTING' || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(encounter.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'WIND_BLESSED_DISPUTE', target: 'RUEN_SINGLE_ORDINARY_ADULT',
    body: 'CURRENT_VISIBLE_BODY', scene: 'CURRENT_VISIBLE_BODY_AND_OWN_SHORT_CLUB',
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    weapon: 'RUENS_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_REPAIR_YARD_OUTER_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2,
    ground: 'CLEAR_ORDINARY_GROUND', water: 'NONE', throwable: 'NONE', bystanders: 'NONE',
    exit: 'ORDINARY_OPEN_EXIT', pursuit: false };
}
/** Compare all scene provenance while leaving the original S9/S8/S7 source contract unchanged. */
export function sameSailorCombatSource(current: SailorCombatSource | null, source: SailorCombatSource | null): boolean {
  if (current === null || source === null || source.runId !== current.runId ||
      source.revision !== current.revision || source.week !== current.week ||
      source.encounterId !== current.encounterId || source.round !== current.round ||
      source.target !== current.target || source.body !== current.body || source.space !== current.space ||
      source.water !== current.water || source.throwable !== current.throwable || source.exit !== current.exit) return false;
  if (current.encounterId === 'FIRST_CASE') return true;
  return source.encounterId === 'WIND_BLESSED_DISPUTE' && source.scene === current.scene &&
    source.attemptWeek === current.attemptWeek && source.startHistoryIndex === current.startHistoryIndex &&
    source.weapon === current.weapon && source.visibility === current.visibility && source.lighting === current.lighting &&
    source.distanceMetres === current.distanceMetres && source.ground === current.ground &&
    source.bystanders === current.bystanders && source.pursuit === current.pursuit;
}
export function currentSailorCombatSource(state: SliceState): SailorCombatSource | null {
  return isSailor(state) ? currentSailorScalesSource(state) : null;
}
/** S6 inherits scales only through its actual new encounter, never borrowed first-case geometry. */
export function currentSailorScalesSource(state: SliceState): SailorCombatSource | null {
  if (state.progression?.pathwayId === 'tyrant' && state.progression.sequence === 6) return currentWindBlessedCombatSource(state);
  if (state.progression?.pathwayId !== 'tyrant' || ![9, 8, 7].includes(state.progression.sequence ?? -1) ||
      state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat!.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat!.round,
    target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_VISIBLE_BODY',
    space: 'DRY_GROUND_PASSAGE', water: 'NONE', throwable: 'NONE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: SailorCombatSource | null): boolean {
  return sameSailorCombatSource(currentSailorCombatSource(state), source);
}
function masteryFactor(state: SliceState, id: 'tyrant.s9.physique' | 'tyrant.s9.balance'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/**
 * One drawn S9 action. FIRST_CASE has neither water nor an authored throwable
 * producer, so the conditional 7.7f secondary budget is unavailable here. Its
 * fallback replaces the slot; it never adds another attack or a water bonus.
 * Self-defense also arms the confirmed V2 one-use phantom scales against the
 * next actual ordinary impact. This grants no extra action, RNG or S8 wrath.
 */
export function resolveSailorCombatAbility(
  state: SliceState, id: SailorMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: SailorCombatSource | null = currentSailorCombatSource(state),
): SailorCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('水手能力：当前没有可结算的对应战斗行动');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'tyrant.s9.physique': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 14.3 * masteryFactor(state, id)) * physical;
      return { label: armed
        ? '持握原短棍打击：采用普通短棍贡献，不叠加体术预算'
        : '水手体术：以强化体魄近身应对',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'tyrant.s9.aquatic-affinity': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 12) * physical;
      const scene = validCombatSource(state, source) ? '这里是干地，也没有可用投掷物'
        : '当前没有经核实的水中突袭条件或可用投掷物';
      return { label: `水中突袭/投掷：${scene}，改用${armed ? '持握原短棍打击' : '普通徒手打击'}`,
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'tyrant.s9.balance': {
      const ordinaryOpponent = validCombatSource(state, source);
      if (ordinaryOpponent) state.combat!.sailorScalesReady = true;
      return { ...noEffect(ordinaryOpponent
        ? '幻鳞与平衡自保：稳住身形；另备一次幻鳞防护，下一普通冲击贡献×0.75，不能防弹'
        : '平衡自保：稳住身形；缺少当前普通对手来源，未建立幻鳞防护'),
        enemyReduction: 2.6 * masteryFactor(state, id) };
    }
    case 'GRIP':
      return validCombatSource(state, source)
        ? { ...noEffect('近身抓握：只牵制眼前携铃者的普通动作'),
          enemyReduction: 1.4 * masteryFactor(state, 'tyrant.s9.physique') }
        : { ...noEffect('近身抓握：缺少当前可见对手来源，改用普通格挡护身'), enemyReduction: 10 };
    case 'OBSERVE':
      return noEffect(validCombatSource(state, source)
        ? '选择立足点：确认眼前干地与普通退路，本次贡献0'
        : '选择立足点：缺少当前现场来源，本次贡献0');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`步伐偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击`), selfGain };
    }
  }
}

/** Only the authored enemy's real short-club strike is an ordinary impact. */
export function consumeSailorScales(
  state: SliceState, enemyMove: 'STRIKE' | 'BLOCK' | 'OPENING' | 'DISTANCE' | 'MISS',
): { physicalMultiplier: number; label: string } | null {
  if (enemyMove !== 'STRIKE' || !state.combat?.sailorScalesReady || !currentSailorScalesSource(state)) return null;
  delete state.combat.sailorScalesReady;
  return { physicalMultiplier: 0.75, label: '幻鳞防护已消耗：本次普通冲击贡献×0.75' };
}
