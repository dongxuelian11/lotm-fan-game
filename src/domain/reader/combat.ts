import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceCombatMove, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed White Tower V3 S9 I-profile; all contributions are game balance (G). */
export const READER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 45 }),
  Object.freeze({ id: '2', label: '2次', weight: 35 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
]);

export type ReaderMoveId = 'reader.s9.ritual-tool' | 'reader.s9.prepared-talisman'
  | 'reader.s9.ritual-protection' | 'reader.s9.quick-identification' | 'OBSERVE' | 'ACCIDENT';

const ABILITIES: readonly {
  id: ReaderMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'reader.s9.ritual-tool', label: '仪式攻击/工具利用', weight: 18, stance: 'ATTACK' },
  { id: 'reader.s9.prepared-talisman', label: '已准备符咒', weight: 12, stance: 'ATTACK' },
  { id: 'reader.s9.ritual-protection', label: '仪式防护', weight: 32, stance: 'DEFEND' },
  { id: 'reader.s9.quick-identification', label: '快速辨识', weight: 25, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '战术准备', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '误判', weight: 5, stance: null },
];

export function isReader(state: SliceState): boolean {
  return state.progression?.pathwayId === 'white-tower' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function readerAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawReaderAbility(random: ActionRandomStream, stance: SliceStance | null): ReaderMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('阅读者能力盘权重无效');
}
export function readerActionCount(roll: number): number {
  return roll <= 45 ? 1 : roll <= 80 ? 2 : 3;
}

export interface ReaderCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): ReaderCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasLiveCombat(state: SliceState): boolean {
  return isReader(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}
function hasVisibleFirstCaseOpponent(state: SliceState): boolean {
  return hasLiveCombat(state) && state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    state.combat!.encounterId === 'FIRST_CASE' && state.world.carrierAlive && state.world.carrierCanResist;
}

/** Values already exposed by the ordinary enemy resolver, never hidden NPC data. */
const ORDINARY_ENEMY_MOVES: readonly Omit<SliceCombatMove, 'actor'>[] = [
  { label: '短棍打击', selfGain: 16, enemyReduction: 0 },
  { label: '格挡护身', selfGain: 0, enemyReduction: 10 },
  { label: '寻找空当', selfGain: 8, enemyReduction: 0 },
  { label: '拉开距离', selfGain: 0, enemyReduction: 8 },
  { label: '动作落空', selfGain: 0, enemyReduction: 0 },
];
export interface ReaderActionSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; previousRound: number;
  previousWinner: 'PLAYER' | 'ENEMY'; previousRetreat: 'NONE' | 'FAILURE';
  enemyActionCount: number; moveIndex: number; move: SliceCombatMove;
}

/**
 * The nested snapshot is reset by the existing FIRST_CASE entry. Global combat
 * history and event knowledge cannot substitute for this opponent's last round.
 * Only the last actually displayed ordinary enemy action can be compared.
 */
export function currentReaderActionSource(state: SliceState): ReaderActionSource | null {
  const combat = state.combat, previous = combat?.lastRound;
  if (!hasVisibleFirstCaseOpponent(state) || !combat || !previous ||
      !Number.isSafeInteger(combat.round) || combat.round <= 1 || previous.round !== combat.round - 1 ||
      previous.winner === null || previous.retreat === 'SUCCESS') return null;
  let moveIndex = previous.moves.length - 1;
  while (moveIndex >= 0 && previous.moves[moveIndex]!.actor !== 'ENEMY') moveIndex -= 1;
  if (moveIndex < 0) return null;
  const move = previous.moves[moveIndex]!;
  if (!ORDINARY_ENEMY_MOVES.some(known => known.label === move.label &&
      known.selfGain === move.selfGain && known.enemyReduction === move.enemyReduction)) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    previousRound: previous.round, previousWinner: previous.winner, previousRetreat: previous.retreat,
    enemyActionCount: previous.moves.filter(entry => entry.actor === 'ENEMY').length,
    moveIndex, move: { ...move } };
}
function validActionSource(state: SliceState, source: ReaderActionSource | null): boolean {
  const current = currentReaderActionSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.previousRound === current.previousRound &&
    source.previousWinner === current.previousWinner && source.previousRetreat === current.previousRetreat &&
    source.enemyActionCount === current.enemyActionCount && source.moveIndex === current.moveIndex &&
    source.move.actor === current.move.actor && source.move.label === current.move.label &&
    source.move.selfGain === current.move.selfGain && source.move.enemyReduction === current.move.enemyReduction;
}
function masteryFactor(state: SliceState): number {
  const mastery = state.progression.mastery['reader.s9.understanding'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/**
 * No ritual or combat-talisman producer exists in this stage. The nominal S9
 * 3.9f / 2.1f / 9.1f budgets therefore remain unavailable, not free spell effects.
 * A fallback replaces its one drawn action, without cost, redraw or mastery gain.
 */
export function resolveReaderCombatAbility(
  state: SliceState, id: ReaderMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: ReaderActionSource | null = currentReaderActionSource(state),
): ReaderCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('阅读者能力：当前没有可结算的对应战斗行动');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'reader.s9.ritual-tool': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 12) * physical;
      return { label: `仪式攻击/工具利用：没有本次已备妥的仪式材料与准备，改用${armed ? '持握原短棍打击' : '普通徒手打击'}；采用原普通规则，不叠加仪式预算，不耗灵性、不重抽`,
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'reader.s9.prepared-talisman':
      return { ...noEffect('已准备符咒：当前没有实际制备并持有的战斗符咒，本次改用普通拉开距离；不生成符咒、不耗灵性、不重抽'), enemyReduction: 8 };
    case 'reader.s9.ritual-protection':
      return { ...noEffect('仪式防护：没有本次已备妥的防护仪式材料与准备，本次改用普通格挡护身；不产生法术、不耗灵性、不重抽'), enemyReduction: 10 };
    case 'reader.s9.quick-identification': {
      if (!validActionSource(state, source)) return { ...noEffect('快速辨识：本场没有仍有效的上一轮已亲见普通动作来源，本次改用普通格挡护身；不读取旧案历史、不耗灵性、不重抽'), enemyReduction: 10 };
      const move = source!.move;
      return { ...noEffect(`快速辨识：复核携铃者上一轮已展示的「${move.label}」（自身优势+${move.selfGain}、削减对手${move.enemyReduction}），据此谨慎应对当前站位（G）；不预知下一步、不复制能力或揭示超凡弱点`),
        enemyReduction: 4.9 * masteryFactor(state) };
    }
    case 'OBSERVE':
      return noEffect(hasVisibleFirstCaseOpponent(state)
        ? '战术准备：复核眼前携铃者的普通站位与已见现场证据，本次即时贡献0；不获得隐藏真相、额外行动或仪式材料'
        : '战术准备：当前没有可复核的同场普通证据，本次即时贡献0；不读取旧案或生成未知事实');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`误判：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击或材料反噬`), selfGain };
    }
  }
}
