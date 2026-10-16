import { hasDreamwalkerDisputeOpponent, hasDreamwalkerOpenPractice } from '../dreamwalker/encounter.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { resolveMindreaderCombatAbility, type MindreaderMoveId } from '../mindreader/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Finite S7 balance (G), not quantitative claims about the novel. */
export const PSYCHOLOGIST_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
  Object.freeze({ id: '6', label: '6次', weight: 5 }),
]);

export type PsychologistMoveId = MindreaderMoveId | 'BLOCK' | 'audience.s7.awe'
  | 'audience.s7.frenzy' | 'audience.s7.suggestion' | 'audience.s7.soothe'
  | 'audience.s6.combat-hypnosis' | 'audience.s6.scales';

// Medium, semi-hypnotic communication requires a quiet, consenting event.
// It remains absent from both wheels; neither wheel overrides core will.
const ABILITIES: readonly {
  id: PsychologistMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通打击', weight: 8, stance: 'ATTACK' },
  { id: 'BLOCK', label: '格挡护身', weight: 8, stance: 'DEFEND' },
  { id: 'EVADE', label: '闪避', weight: 8, stance: 'DEFEND' },
  { id: 'audience.observation', label: '敏锐观察', weight: 8, stance: 'PREPARE' },
  { id: 'audience.behavior-analysis', label: '行为分析', weight: 6, stance: 'CONTROL' },
  { id: 'audience.memory-deduction', label: '记忆与推理', weight: 5, stance: 'PREPARE' },
  { id: 'audience.mind-reading', label: '浅层读心', weight: 5, stance: 'CONTROL' },
  { id: 'audience.s7.awe', label: '震慑', weight: 14, stance: 'CONTROL' },
  { id: 'audience.s7.frenzy', label: '狂乱（精神冲击）', weight: 16, stance: 'ATTACK' },
  { id: 'audience.s7.suggestion', label: '心理暗示', weight: 12, stance: 'CONTROL' },
  { id: 'audience.s7.soothe', label: '安抚', weight: 8, stance: 'DEFEND' },
  { id: 'MISS', label: '失误', weight: 2, stance: null },
];

/** Finite S6 G allocation, totaling 100; inherited effects receive no blanket multiplier. */
const HYPNOTIST_ABILITIES: typeof ABILITIES = [
  { id: 'STRIKE', label: '普通打击', weight: 6, stance: 'ATTACK' },
  { id: 'BLOCK', label: '格挡护身', weight: 6, stance: 'DEFEND' },
  { id: 'EVADE', label: '闪避', weight: 6, stance: 'DEFEND' },
  { id: 'audience.observation', label: '敏锐观察', weight: 6, stance: 'PREPARE' },
  { id: 'audience.behavior-analysis', label: '行为分析', weight: 5, stance: 'CONTROL' },
  { id: 'audience.memory-deduction', label: '记忆与推理', weight: 4, stance: 'PREPARE' },
  { id: 'audience.mind-reading', label: '浅层读心', weight: 4, stance: 'CONTROL' },
  { id: 'audience.s7.awe', label: '震慑', weight: 11, stance: 'CONTROL' },
  { id: 'audience.s7.frenzy', label: '狂乱（精神冲击）', weight: 12, stance: 'ATTACK' },
  { id: 'audience.s7.suggestion', label: '心理暗示', weight: 9, stance: 'CONTROL' },
  { id: 'audience.s7.soothe', label: '安抚', weight: 7, stance: 'DEFEND' },
  { id: 'audience.s6.combat-hypnosis', label: '短暂战斗催眠', weight: 14, stance: 'CONTROL' },
  { id: 'audience.s6.scales', label: '鳞片防护', weight: 8, stance: 'DEFEND' },
  { id: 'MISS', label: '失误', weight: 2, stance: null },
];

export function isPsychologist(state: SliceState): boolean {
  return state.progression?.pathwayId === 'audience' &&
    (state.progression.sequence === 7 || state.progression.sequence === 6);
}
function abilities(sequence: number): typeof ABILITIES {
  return sequence === 6 ? HYPNOTIST_ABILITIES : ABILITIES;
}
function tickets(stance: SliceStance | null, sequence: number): number[] {
  return abilities(sequence).map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function psychologistAbilityWheel(stance: SliceStance | null, sequence = 7): SliceWheelEntry[] {
  const weights = tickets(stance, sequence), total = weights.reduce((sum, weight) => sum + weight, 0);
  return abilities(sequence).map((ability, index) => ({
    id: ability.id, label: ability.label,
    // Neutral/retreat tickets total 400: preserve the exact integer G weights.
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100,
  }));
}
export function drawPsychologistAbility(random: ActionRandomStream, stance: SliceStance | null, sequence = 7): PsychologistMoveId {
  const entries = abilities(sequence), weights = tickets(stance, sequence);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return entries[index]!.id;
  }
  throw new Error('心理医生能力盘权重无效');
}
export function psychologistActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 80 ? 4 : roll <= 95 ? 5 : 6;
}

export interface PsychologistCombatEffect {
  label: string; selfGain: number; enemyReduction: number;
  /** Physical harm permission only. Mental pressure must never set this flag. */
  threatens: boolean; mentalPressure: boolean;
}
function noEffect(label: string): PsychologistCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false };
}
function ordinaryBlock(prefix = ''): PsychologistCombatEffect {
  return { ...noEffect(`${prefix}格挡护身`), enemyReduction: 10 };
}
/** S5 inherits only its authored awake encounter or the original live first case. */
function hasDreamwalkerInheritedBattle(state: SliceState): boolean {
  if (state.progression.pathwayId !== 'audience' || state.progression.sequence !== 5) return false;
  if (state.combat?.encounterId === 'DREAMWALKER_DISPUTE') return hasDreamwalkerDisputeOpponent(state);
  return state.combat?.encounterId === 'FIRST_CASE' && state.arc.stage === 'COMBAT' &&
    state.world.carrierAlive && state.world.carrierCanResist && state.activeEvent === null &&
    state.dreamwalker.encounter.status !== 'FIGHTING' && !hasDreamwalkerOpenPractice(state) &&
    Number.isFinite(state.mind) && state.mind > 0 &&
    Number.isSafeInteger(state.combat.round) && state.combat.round >= 1;
}
function hasLiveCombat(state: SliceState): boolean {
  return (isPsychologist(state) || hasDreamwalkerInheritedBattle(state)) && state.status === 'ACTIVE' && state.health > 0 &&
    state.world.city === 'BACKLUND' && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}

interface MindSourceMoment {
  round: number; attemptWeek: number; startHistoryIndex: number;
  mind: 'ORDINARY_UNPROTECTED'; aggression: 'VISIBLE_SHORT_CLUB_THREAT';
}
export type PsychologistMindSource = MindSourceMoment & ({
  encounterId: 'PSYCHOLOGIST_DISPUTE';
  target: 'BRYCE_SINGLE_AWAKE_ADULT'; mind: 'ORDINARY_UNPROTECTED';
  space: 'PUBLIC_ROOM'; aggression: 'VISIBLE_SHORT_CLUB_THREAT';
} | {
  encounterId: 'HYPNOTIST_DISPUTE'; target: 'ROWAN_SINGLE_AWAKE_ADULT';
  space: 'EMPTY_CLUB_BACK_PASSAGE'; distanceMetres: 2;
  bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT';
} | {
  encounterId: 'DREAMWALKER_DISPUTE'; target: 'MAS_SINGLE_AWAKE_ADULT';
  space: 'EMPTY_CLUB_REAR_COURTYARD'; distanceMetres: 2;
  bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT';
} | {
  encounterId: 'FIRST_CASE'; target: 'ORIGINAL_LIVING_CARRIER';
  space: 'ORIGINAL_FIRST_CASE'; distanceMetres: 2;
  bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT';
});

/** Each authored encounter supplies only its own present adult and visible threat. */
export function currentPsychologistMindSource(state: SliceState): PsychologistMindSource | null {
  if (!hasLiveCombat(state) || state.combat!.enemyMind <= 0) return null;
  if (hasDreamwalkerInheritedBattle(state)) {
    const combat = state.combat!;
    if (combat.encounterId === 'DREAMWALKER_DISPUTE') {
      const e = state.dreamwalker.encounter;
      return { encounterId: 'DREAMWALKER_DISPUTE', round: combat.round,
        attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!,
        target: 'MAS_SINGLE_AWAKE_ADULT', mind: 'ORDINARY_UNPROTECTED',
        space: 'EMPTY_CLUB_REAR_COURTYARD', distanceMetres: 2, bystanders: 'NONE',
        exit: 'ORIGINAL_OPEN_EXIT', aggression: 'VISIBLE_SHORT_CLUB_THREAT' };
    }
    return { encounterId: 'FIRST_CASE', round: combat.round, attemptWeek: state.week,
      startHistoryIndex: state.combatHistory.length - combat.round + 1,
      target: 'ORIGINAL_LIVING_CARRIER', mind: 'ORDINARY_UNPROTECTED',
      space: 'ORIGINAL_FIRST_CASE', distanceMetres: 2, bystanders: 'NONE',
      exit: 'ORIGINAL_OPEN_EXIT', aggression: 'VISIBLE_SHORT_CLUB_THREAT' };
  }
  if (state.combat!.encounterId === 'HYPNOTIST_DISPUTE') {
    const encounter = state.hypnotist.encounter, combat = state.combat!;
    if (state.progression.sequence !== 6 || encounter.status !== 'FIGHTING' ||
        encounter.attemptWeek !== state.week || encounter.startHistoryIndex === null ||
        !Number.isSafeInteger(encounter.startHistoryIndex) || encounter.startHistoryIndex < 0 ||
        state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1) return null;
    return { encounterId: 'HYPNOTIST_DISPUTE', round: combat.round,
      attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
      target: 'ROWAN_SINGLE_AWAKE_ADULT', mind: 'ORDINARY_UNPROTECTED',
      space: 'EMPTY_CLUB_BACK_PASSAGE', distanceMetres: 2, bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT',
      aggression: 'VISIBLE_SHORT_CLUB_THREAT' };
  }
  const encounter = state.psychologist.encounter;
  if (state.combat!.encounterId !== 'PSYCHOLOGIST_DISPUTE' ||
      encounter.status !== 'FIGHTING' || !encounter.observed ||
      encounter.attemptWeek !== state.week || encounter.startHistoryIndex === null) return null;
  return { encounterId: 'PSYCHOLOGIST_DISPUTE', round: state.combat!.round,
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    target: 'BRYCE_SINGLE_AWAKE_ADULT', mind: 'ORDINARY_UNPROTECTED',
    space: 'PUBLIC_ROOM', aggression: 'VISIBLE_SHORT_CLUB_THREAT' };
}
function validMindSource(state: SliceState, source: PsychologistMindSource | null): boolean {
  const current = currentPsychologistMindSource(state);
  return current !== null && source !== null && source.encounterId === current.encounterId &&
    source.round === current.round && source.attemptWeek === current.attemptWeek &&
    source.startHistoryIndex === current.startHistoryIndex && source.target === current.target &&
    source.mind === current.mind && source.space === current.space && source.aggression === current.aggression &&
    (current.encounterId === 'PSYCHOLOGIST_DISPUTE' ||
      (source.encounterId !== 'PSYCHOLOGIST_DISPUTE' && source.distanceMetres === current.distanceMetres &&
        source.bystanders === current.bystanders && source.exit === current.exit));
}

/** Only the two new S6 effects use their own bounded mastery factor (G). */
function hypnotistFactor(state: SliceState, id: PsychologistMoveId): number {
  return 1 + Math.max(0, Math.min(500, state.progression.mastery[id] ?? 0)) / 500;
}

function resolveHypnotistObservation(
  state: SliceState, id: MindreaderMoveId, random: ActionRandomStream, source: PsychologistMindSource | null,
): PsychologistCombatEffect {
  if (!validMindSource(state, source)) {
    return ordinaryBlock('继承能力：缺少本场当前的真实观察来源，未耗灵性、不重抽，本次改用');
  }
  const target = source!.encounterId === 'DREAMWALKER_DISPUTE' ? '马斯' : '罗温';
  const place = source!.encounterId === 'DREAMWALKER_DISPUTE' ? '原会所净空后庭' : '原会所空后门通道';
  if (id === 'audience.observation') return {
    ...noEffect(`敏锐观察：${target}${state.combat!.enemyHealth >= 100 ? '未显受伤' : '身上已有伤势'}，仍在${place}约2米处持普通短棍抵抗；没有旁人，只确认眼前状态`), selfGain: 8,
  };
  if (id === 'audience.behavior-analysis') return {
    ...noEffect('行为分析：依据' + target + '眼前持棍姿态推测空当，仍需防备动作变化'), selfGain: 6,
  };
  if (id === 'audience.memory-deduction') {
    const combat = state.combat!, previous = combat.lastRound;
    if (combat.round <= 1 || !previous || previous.round !== combat.round - 1 ||
        previous.winner === null || previous.retreat === 'SUCCESS' ||
        !previous.moves.some(move => move.actor === 'ENEMY')) {
      return noEffect('记忆与推理：本场尚无上一轮已亲历的对手动作可供比较');
    }
    return { ...noEffect('记忆与推理：回顾本场上一轮' + target + '的已见动作，与眼前站位比较；不预知下一步'), selfGain: 6 };
  }
  if (state.spirituality < 1) return noEffect('浅层读心：灵性不足1，本次没有效果，不重抽');
  state.spirituality -= 1;
  const result = resolveNormalCheck({ ability: 'perception', baseAbility: state.character.coreStats.perception,
    difficulty: 12, modifiers: [], roll: random.nextInt(1, 100) });
  state.lastCheck = result;
  const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
  return { ...noEffect(`浅层读心：耗灵性1，感知${result.roll}/${result.chance}；${success
    ? target + '此刻想守住持棍的身前空间，不愿让你近身；只读到当前浅层意图，不保证下一步动作，优势+10'
    : target + '的紧张与抵触念头混杂，未辨清浅层意图，优势不变'}`), selfGain: success ? 10 : 0 };
}

/** Reuse the actual inherited source, without widening the older profiles. */
function resolveInherited(
  state: SliceState, id: MindreaderMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: PsychologistMindSource | null,
): PsychologistCombatEffect {
  if (id.startsWith('audience.') && ((state.progression.sequence === 6 && state.combat!.encounterId === 'HYPNOTIST_DISPUTE') ||
      (state.progression.sequence === 5 && state.combat!.encounterId === 'DREAMWALKER_DISPUTE'))) {
    return resolveHypnotistObservation(state, id, random, source);
  }
  if (id.startsWith('audience.') && state.combat!.encounterId !== 'FIRST_CASE') {
    return ordinaryBlock('继承能力：没有本目标对应的已写明观察或浅层意图来源，不套用携铃者的旧事；未耗灵性、不重抽，本次改用');
  }
  // The resolver only mutates spirituality and lastCheck. Its temporary view
  // shares the real encounter/source, but cannot downgrade actual progression.
  const inherited: SliceState = { ...state, progression: { ...state.progression, sequence: 8 } };
  const result = resolveMindreaderCombatAbility(inherited, id, physicalStateFactor, random);
  state.spirituality = inherited.spirituality;
  state.lastCheck = inherited.lastCheck;
  return { ...result, mentalPressure: false };
}

/** One drawn action, one cost/check. Consequences belong to the shared round. */
export function resolvePsychologistCombatAbility(
  state: SliceState, id: PsychologistMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: PsychologistMindSource | null = currentPsychologistMindSource(state),
): PsychologistCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('心理医生能力：当前没有可结算的对应战斗行动');
  if (id === 'BLOCK') return ordinaryBlock();
  switch (id) {
    case 'audience.s6.combat-hypnosis':
    case 'audience.s6.scales': {
      const hypnosis = id === 'audience.s6.combat-hypnosis', cost = hypnosis ? 3 : 2;
      const name = hypnosis ? '短暂战斗催眠' : '鳞片防护';
      const fallback = (reason: string) => ordinaryBlock(`${name}：${reason}，未施术、未耗灵性、不重抽，本次改用`);
      if (state.progression.sequence !== 6 && !hasDreamwalkerInheritedBattle(state)) return fallback('当前没有对应的序列6能力');
      if (hypnosis && !validMindSource(state, source)) return fallback('缺少本次清醒普通人及当前敌意来源');
      if (state.spirituality < cost) return fallback(`灵性不足${cost}`);
      state.spirituality -= cost;
      const factor = hypnotistFactor(state, id);
      if (!hypnosis) return {
        ...noEffect(`鳞片防护：耗灵性2，形成针对普通物理打击的有限防守，对方优势−${14 * factor}（G）；不额外造成伤害，不改原伤势，不抵挡精神攻击或保证免伤`),
        enemyReduction: 14 * factor,
      };
      const result = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
        difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
      state.lastCheck = result;
      const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      return { ...noEffect(`短暂战斗催眠：耗灵性3，意志${result.roll}/${result.chance}；${success
        ? `对方短暂迟疑后醒来，本次对方优势−${18 * factor}（G）`
        : '对方保持警觉并抵抗了引导，本次优势不变'}；强意志与珍视之事可以构成抵抗，不指令自杀、不读取真相、不删除行动、不建立持续控制`),
      enemyReduction: success ? 18 * factor : 0 };
    }
    case 'audience.s7.awe':
    case 'audience.s7.frenzy':
    case 'audience.s7.suggestion':
    case 'audience.s7.soothe': {
      const cost = id === 'audience.s7.frenzy' ? 3 : 2;
      const name = ABILITIES.find(ability => ability.id === id)!.label;
      const fallback = (reason: string) => ordinaryBlock(
        `${name}：${reason}，未施术、未耗灵性、不重抽，本次改用`,
      );
      if (!validMindSource(state, source)) return fallback('缺少本次已亲见的清醒普通人及当前敌意来源');
      if (!(state.spirituality >= cost)) return fallback(`灵性不足${cost}`);
      state.spirituality -= cost;
      const target = source!.encounterId === 'DREAMWALKER_DISPUTE' ? '马斯'
        : source!.encounterId === 'FIRST_CASE' ? '携铃者' : source!.encounterId === 'HYPNOTIST_DISPUTE' ? '罗温' : '布莱斯';
      if (id === 'audience.s7.awe') return {
        ...noEffect(`震慑：耗灵性2，令眼前${target}短暂畏惧，对方优势−22（G）；不取消行动，不操纵意志`),
        enemyReduction: 22,
      };
      if (id === 'audience.s7.frenzy' && state.progression.sequence === 5) {
        const result = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
          difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
        state.lastCheck = result;
        const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
        return { ...noEffect('继承狂乱：耗灵性3，意志' + result.roll + '/' + result.chance + '；' +
          (success ? '有限精神冲击形成优势+28（G）' : target + '保持警觉并抵抗，优势0，已耗灵性不返还') +
          '；只结算精神压力，不产生肉体伤害、精神瘟疫或绝对控制，对手仍照常行动'),
          selfGain: success ? 28 : 0, mentalPressure: success };
      }
      if (id === 'audience.s7.frenzy') return {
        ...noEffect(`狂乱：耗灵性3，以有限精神冲击干扰${target}，己方优势+28（G）；胜出仅可结算精神损耗，不等于肉体伤害或绝对控制`),
        selfGain: 28, mentalPressure: true,
      };
      if (id === 'audience.s7.soothe') return {
        ...noEffect('安抚：耗灵性2，暂时缓和眼前攻击情绪，对方优势−16（G）；不恢复健康或精神、不净化污染，也不替对方同意任何安排'),
        enemyReduction: 16,
      };
      const result = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
        difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
      state.lastCheck = result;
      const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      const tier = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' }[result.tier];
      return { ...noEffect(`心理暗示：耗灵性2，意志${result.roll}/${result.chance}，${tier}；${success
        ? '以眼前冲突为限提示稍作停顿，对方优势−18（G）'
        : '对方没有接受这次引导，优势不变'}；不删除行动、不违背核心意愿，不建立控制`),
      enemyReduction: success ? 18 : 0 };
    }
    default: return resolveInherited(state, id, physicalStateFactor, random, source);
  }
}
