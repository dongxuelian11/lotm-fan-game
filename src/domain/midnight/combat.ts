import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed S8 C-profile; all numeric budgets and the local night modifier are G. */
export const MIDNIGHT_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 20 }),
  Object.freeze({ id: '2', label: '2次', weight: 25 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 10 }),
]);

export type MidnightMoveId = 'darkness.s8.physical-training' | 'darkness.s8.physical-follow-up'
  | 'darkness.s8.self-protection' | 'darkness.s8.poetry' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: MidnightMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'darkness.s8.physical-training', label: '身体训练打击', weight: 20, stance: 'ATTACK' },
  { id: 'darkness.s8.physical-follow-up', label: '近身身体应对', weight: 15, stance: 'ATTACK' },
  { id: 'darkness.s8.self-protection', label: '身体自保', weight: 20, stance: 'DEFEND' },
  { id: 'darkness.s8.poetry', label: '安宁困倦诗歌', weight: 30, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '现场观察', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '疲劳或误判', weight: 7, stance: null },
];

export function isMidnight(state: SliceState): boolean {
  return state.progression?.pathwayId === 'darkness' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function midnightAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawMidnightAbility(random: ActionRandomStream, stance: SliceStance | null): MidnightMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('午夜诗人能力盘权重无效');
}
export function midnightActionCount(roll: number): number {
  return roll <= 20 ? 1 : roll <= 45 ? 2 : roll <= 70 ? 3 : roll <= 90 ? 4 : 5;
}

export interface MidnightCombatEffect {
  label: string; selfGain: number; enemyReduction: number;
  /** Only an actual body/tool strike permits the shared physical consequence draw. */
  threatens: boolean;
}
function noEffect(label: string): MidnightCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function ordinaryBlock(reason: string): MidnightCombatEffect {
  return { ...noEffect(`安宁困倦诗歌：${reason}，未吟诵、未耗灵性、不作检定、不重抽，本次改用格挡护身`), enemyReduction: 10 };
}
function hasLiveCombat(state: SliceState): boolean {
  return isMidnight(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}

export interface MidnightNightSource {
  encounterId: 'MIDNIGHT_DISPUTE'; round: number; attemptWeek: number; startHistoryIndex: number;
  target: 'HERN_SINGLE_ORDINARY_ADULT'; body: 'CURRENT_VISIBLE_BODY';
  time: 'SCHEDULED_NIGHT'; space: 'OPEN_SMALL_COURTYARD'; exit: 'ORDINARY_OPEN_EXIT';
  voice: 'PLAYER_CAN_VOICE'; range: 'LOCAL_VOICE_AT_MOST_SIX_METRES';
  bystander: 'PORTER_PRESENT' | 'PORTER_WITHDRAWN'; aggression: 'VISIBLE_SHORT_CLUB_THREAT';
}

/** Only this observed authored scene establishes actual night and audible local geometry. */
export function currentMidnightNightSource(state: SliceState): MidnightNightSource | null {
  const encounter = state.midnight.encounter;
  if (!hasLiveCombat(state) || state.world.city !== 'BACKLUND' ||
      state.combat!.encounterId !== 'MIDNIGHT_DISPUTE' || encounter.status !== 'FIGHTING' ||
      !encounter.observed || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null) return null;
  return { encounterId: 'MIDNIGHT_DISPUTE', round: state.combat!.round,
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    target: 'HERN_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY', time: 'SCHEDULED_NIGHT',
    space: 'OPEN_SMALL_COURTYARD', exit: 'ORDINARY_OPEN_EXIT', voice: 'PLAYER_CAN_VOICE',
    range: 'LOCAL_VOICE_AT_MOST_SIX_METRES',
    bystander: encounter.bystanderCleared ? 'PORTER_WITHDRAWN' : 'PORTER_PRESENT',
    aggression: 'VISIBLE_SHORT_CLUB_THREAT' };
}

/** The bystander must leave by the authored ordinary route before a voiced poem is usable. */
export function currentMidnightPoemSource(state: SliceState): MidnightNightSource | null {
  const source = currentMidnightNightSource(state);
  return source?.bystander === 'PORTER_WITHDRAWN' && state.combat!.enemyMind > 0 ? source : null;
}
function validNightSource(state: SliceState, source: MidnightNightSource | null): boolean {
  const current = currentMidnightNightSource(state);
  return current !== null && source !== null && source.encounterId === current.encounterId &&
    source.round === current.round && source.attemptWeek === current.attemptWeek &&
    source.startHistoryIndex === current.startHistoryIndex && source.target === current.target &&
    source.body === current.body && source.time === current.time && source.space === current.space &&
    source.exit === current.exit && source.voice === current.voice && source.range === current.range &&
    source.bystander === current.bystander && source.aggression === current.aggression;
}
function masteryFactor(state: SliceState, id: string): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One chosen action. A resisted poem costs once and never suppresses an enemy turn. */
export function resolveMidnightCombatAbility(
  state: SliceState, id: MidnightMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: MidnightNightSource | null = currentMidnightNightSource(state),
): MidnightCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('午夜诗人能力：当前没有可结算的对应战斗行动');
  const night = validNightSource(state, source), nightFactor = night ? 1.1 : 1;
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'darkness.s8.physical-training':
    case 'darkness.s8.physical-follow-up': {
      const primary = id === 'darkness.s8.physical-training';
      // Holding the actual original club replaces only the primary strike.
      const armed = primary && state.town.clubLocation === 'HAND';
      const selfGain = armed ? 16 * physical
        : (primary ? 11.7 : 6.3) * masteryFactor(state, 'darkness.s8.physical-training') * nightFactor * physical;
      return { label: armed
        ? '持握原短棍打击：本次采用原短棍普通规则，不叠加C主攻预算或夜间强化'
        : `${primary ? '身体训练打击' : '近身身体应对'}：${night ? '本次已确认夜间，贡献×1.1（G）' : '当前未确认夜间，无夜间加成'}`,
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'darkness.s8.self-protection':
      return { ...noEffect(`身体自保：以身体训练避让眼前打击，${night ? '本次已确认夜间，贡献×1.1（G）' : '当前未确认夜间，无夜间加成'}；不保证免伤`),
        enemyReduction: 15.6 * masteryFactor(state, 'darkness.s8.physical-training') * nightFactor };
    case 'darkness.s8.poetry': {
      if (!night || state.combat!.enemyMind <= 0) return ordinaryBlock('缺少本次可发声、可见普通目标与正常近距声音范围来源');
      if (!state.midnight.encounter.bystanderCleared || source!.bystander !== 'PORTER_WITHDRAWN') {
        return ordinaryBlock('搬运工仍在附近，声音可能影响同伴，须先沿原路让其离开');
      }
      if (!(state.spirituality >= 2)) return ordinaryBlock('灵性不足2');
      state.spirituality -= 2;
      const result = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
        difficulty: 12, modifiers: [], roll: random.nextInt(1, 100) });
      state.lastCheck = result;
      const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      const tier = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' }[result.tier];
      return { ...noEffect(`安宁困倦诗歌：近距发声吟诵，耗灵性2，意志${result.roll}/${result.chance}，${tier}；${success
        ? '有限缓和贺恩的攻击情绪并带来困倦，对方优势降低，夜间贡献×1.1（G）'
        : '贺恩抵抗住了这次诗歌影响，对方优势不变'}；普通对手仍按原次数行动，不保证睡眠、不删除行动、不造成身体伤害`),
      enemyReduction: success ? 8.4 * masteryFactor(state, 'darkness.s8.poetry') * nightFactor : 0 };
    }
    case 'OBSERVE':
      return noEffect(night
        ? '现场观察：只复核亲见的夜间小院、贺恩与普通出口，本次即时贡献0；不自动清场、不获得额外行动'
        : '现场观察：当前没有仍有效的本次夜间来源，本次即时贡献0；不补造声音范围');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`疲劳或误判：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击`), selfGain };
    }
  }
}
