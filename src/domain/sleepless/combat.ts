import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed S9 I-profile; the scene's ×1.1 night modifier is finite game balance (G). */
export const SLEEPLESS_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 25 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
]);

export type SleeplessMoveId = 'darkness.s9.night-vigor' | 'darkness.s9.physical-follow-up'
  | 'darkness.s9.night-vision' | 'darkness.s9.danger-sense' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: SleeplessMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'darkness.s9.night-vigor', label: '身体打击', weight: 18, stance: 'ATTACK' },
  { id: 'darkness.s9.physical-follow-up', label: '近身身体应对', weight: 12, stance: 'ATTACK' },
  { id: 'darkness.s9.night-vision', label: '夜视自保', weight: 32, stance: 'DEFEND' },
  { id: 'darkness.s9.danger-sense', label: '危险感知应对', weight: 25, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '夜间观察', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '疲劳或误判', weight: 5, stance: null },
];

export function isSleepless(state: SliceState): boolean {
  return state.progression?.pathwayId === 'darkness' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function sleeplessAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawSleeplessAbility(random: ActionRandomStream, stance: SliceStance | null): SleeplessMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('不眠者能力盘权重无效');
}
export function sleeplessActionCount(roll: number): number {
  return roll <= 25 ? 1 : roll <= 55 ? 2 : roll <= 80 ? 3 : 4;
}

export interface SleeplessCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): SleeplessCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasLiveCombat(state: SliceState): boolean {
  return isSleepless(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}

export interface SleeplessNightSource {
  encounterId: 'SLEEPLESS_WATCH'; round: number; attemptWeek: number; startHistoryIndex: number;
  target: 'RAFE_SINGLE_ORDINARY_ADULT'; body: 'CURRENT_VISIBLE_BODY';
  time: 'SCHEDULED_NIGHT'; space: 'OPEN_WAREHOUSE_COURTYARD'; exit: 'ORDINARY_OPEN_EXIT';
  aggression: 'VISIBLE_SHORT_CLUB_THREAT';
}

/** Darkness, a lamp or another pathway's scene never establishes actual night. */
export function currentSleeplessNightSource(state: SliceState): SleeplessNightSource | null {
  const encounter = state.sleepless.encounter;
  if (!hasLiveCombat(state) || state.world.city !== 'BACKLUND' ||
      state.combat!.encounterId !== 'SLEEPLESS_WATCH' || encounter.status !== 'FIGHTING' ||
      !encounter.observed || !encounter.night || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null) return null;
  return { encounterId: 'SLEEPLESS_WATCH', round: state.combat!.round,
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    target: 'RAFE_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY',
    time: 'SCHEDULED_NIGHT', space: 'OPEN_WAREHOUSE_COURTYARD', exit: 'ORDINARY_OPEN_EXIT',
    aggression: 'VISIBLE_SHORT_CLUB_THREAT' };
}
function validNightSource(state: SliceState, source: SleeplessNightSource | null): boolean {
  const current = currentSleeplessNightSource(state);
  return current !== null && source !== null && source.encounterId === current.encounterId &&
    source.round === current.round && source.attemptWeek === current.attemptWeek &&
    source.startHistoryIndex === current.startHistoryIndex && source.target === current.target &&
    source.body === current.body && source.time === current.time && source.space === current.space &&
    source.exit === current.exit && source.aggression === current.aggression;
}
function masteryFactor(state: SliceState, id: string): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One drawn action; no passive resource cost, free turn, recovery or fabricated control. */
export function resolveSleeplessCombatAbility(
  state: SliceState, id: SleeplessMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: SleeplessNightSource | null = currentSleeplessNightSource(state),
): SleeplessCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('不眠者能力：当前没有可结算的对应战斗行动');
  const night = validNightSource(state, source), nightFactor = night ? 1.1 : 1;
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'darkness.s9.night-vigor':
    case 'darkness.s9.physical-follow-up': {
      const primary = id === 'darkness.s9.night-vigor';
      // Existing town item rules replace this strike, never add a passive +4,
      // I-budget or night multiplier. Carrying the item in the bag is not using it.
      const armed = primary && state.town.clubLocation === 'HAND';
      const selfGain = armed ? 16 * physical
        : (primary ? 6.5 : 3.5) * masteryFactor(state, 'darkness.s9.night-vigor') * nightFactor * physical;
      const label = armed
        ? '持握原短棍打击：本次采用原短棍普通规则，不叠加I主攻预算或夜间强化'
        : `${primary ? '身体打击' : '近身身体应对'}：${night ? '本次已确认夜间，贡献×1.1（G）' : '当前未确认夜间，无夜间加成'}`;
      return { label, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'darkness.s9.night-vision':
    case 'darkness.s9.danger-sense': {
      const vision = id === 'darkness.s9.night-vision', name = vision ? '夜视自保' : '危险感知应对';
      if (!night) return { ...noEffect(`${name}：缺少本次仍有效的夜间现场与眼前动作来源，不重抽、不耗灵性，本次改用格挡护身`), enemyReduction: 10 };
      return { ...noEffect(vision
        ? '夜视自保：辨清眼前拉夫的身体与院落站位后避让，贡献×1.1（G）；不保证免伤'
        : '危险感知应对：只从眼前拉夫持棍动作应对迫近威胁，贡献×1.1（G）；不读心、不删除行动'),
        enemyReduction: (vision ? 9.1 : 4.9) * masteryFactor(state, id) * nightFactor };
    }
    case 'OBSERVE':
      return noEffect(night
        ? '夜间观察：只复核已亲见的院落、拉夫与普通出口，本次即时贡献0；没有获得隐藏信息或额外行动'
        : '夜间观察：当前没有仍有效的已观察夜间来源，本次即时贡献0');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`疲劳或误判：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击`), selfGain };
    }
  }
}
