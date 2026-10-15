import { computeCheckChance } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { currentWhiteTowerTacticalSource, REASONER_ORDINARY_TARGET, whiteTowerKnowledgeChance,
  type ReasonerCombatSource } from '../reasoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** User-confirmed White Tower COMBAT-V3 S7 I profile; all numbers are game balance (G). */
export const DETECTIVE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 35 }),
  Object.freeze({ id: '2', label: '2次', weight: 32 }),
  Object.freeze({ id: '3', label: '3次', weight: 22 }),
  Object.freeze({ id: '4', label: '4次', weight: 11 }),
]);
export type DetectiveMoveId = 'reader.s7.weapon-combat' | 'reader.s7.trajectory-strike'
  | 'reader.s7.battlefield-model' | 'reader.s7.tactical-blockade'
  | 'reader.s6.limited-imitation' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: DetectiveMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'reader.s7.weapon-combat', label: '武器/格斗', weight: 18, stance: 'ATTACK' },
  { id: 'reader.s7.trajectory-strike', label: '轨迹打击', weight: 12, stance: 'ATTACK' },
  { id: 'reader.s7.battlefield-model', label: '战场模型', weight: 32, stance: 'DEFEND' },
  { id: 'reader.s7.tactical-blockade', label: '战术封锁', weight: 25, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察重复动作', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '轨迹误判', weight: 5, stance: null },
];
// Keep the S7 table, input defaults, order and integer-ticket draws unchanged.
const POLYMATH_ABILITIES: typeof ABILITIES = ABILITIES.flatMap(ability =>
  ability.id === 'reader.s7.tactical-blockade'
    ? [{ ...ability, weight: 15 },
      { id: 'reader.s6.limited-imitation' as const, label: '有限闪光模仿', weight: 10, stance: 'CONTROL' as const }]
    : [ability]);
export function isPolymath(state: SliceState): boolean {
  return state.progression.pathwayId === 'white-tower' && state.progression.sequence === 6;
}
export function hasDetectiveCombat(state: SliceState): boolean {
  return isDetective(state) || isPolymath(state);
}
export function isDetective(state: SliceState): boolean {
  return state.progression.pathwayId === 'white-tower' && state.progression.sequence === 7;
}
function abilities(sequence: number): typeof ABILITIES { return sequence === 6 ? POLYMATH_ABILITIES : ABILITIES; }
function tickets(stance: SliceStance | null, sequence: number): number[] {
  return abilities(sequence).map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function detectiveAbilityWheel(stance: SliceStance | null, sequence = 7): SliceWheelEntry[] {
  const weights = tickets(stance, sequence), total = weights.reduce((sum, weight) => sum + weight, 0);
  return abilities(sequence).map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawDetectiveAbility(random: ActionRandomStream, stance: SliceStance | null, sequence = 7): DetectiveMoveId {
  const entries = abilities(sequence), weights = tickets(stance, sequence);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return entries[index]!.id;
  }
  throw new Error('守知者能力盘权重无效');
}
export function detectiveActionCount(roll: number): number {
  return roll <= 35 ? 1 : roll <= 67 ? 2 : roll <= 89 ? 3 : 4;
}
function hasLiveCombat(state: SliceState): boolean {
  return hasDetectiveCombat(state) && state.status === 'ACTIVE' && state.health > 0 && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}
export interface PolymathCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'POLYMATH_DISPUTE'; target: 'IAN_SINGLE_ORDINARY_ADULT';
  scene: 'CURRENT_VISIBLE_BODY_AND_OWN_SHORT_CLUB';
  attemptWeek: number; startHistoryIndex: number;
  weapon: 'IANS_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_LIBRARY_TEACHING_ROOM_OUTER_COURTYARD';
  visibility: 'MUTUALLY_VISIBLE'; lighting: 'ORIGINAL_FIXED_LAMPLIGHT';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND';
  bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export type DetectiveCombatSource = ReasonerCombatSource | PolymathCombatSource;
/** The paid visit produces this current adult, never a carrier or an old sample's teacher. */
export function currentPolymathCombatSource(state: SliceState): PolymathCombatSource | null {
  const combat = state.combat;
  if (!isPolymath(state) || !hasLiveCombat(state) || state.activeEvent !== null ||
      state.world.city !== 'BACKLUND' || !combat || combat.encounterId !== 'POLYMATH_DISPUTE' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1) return null;
  const encounter = state.polymath.encounter;
  if (encounter.status !== 'FIGHTING' || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(encounter.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'POLYMATH_DISPUTE', target: 'IAN_SINGLE_ORDINARY_ADULT',
    scene: 'CURRENT_VISIBLE_BODY_AND_OWN_SHORT_CLUB', attemptWeek: encounter.attemptWeek,
    startHistoryIndex: encounter.startHistoryIndex, weapon: 'IANS_ORDINARY_SHORT_CLUB',
    space: 'ORIGINAL_LIBRARY_TEACHING_ROOM_OUTER_COURTYARD', visibility: 'MUTUALLY_VISIBLE',
    lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND',
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
export function currentDetectiveCombatSource(state: SliceState): DetectiveCombatSource | null {
  return isPolymath(state) ? currentPolymathCombatSource(state)
    : isDetective(state) ? currentWhiteTowerTacticalSource(state) : null;
}
function validSource(state: SliceState, source: DetectiveCombatSource | null): boolean {
  const current = currentDetectiveCombatSource(state);
  if (current === null || source === null || current.runId !== source.runId ||
      current.revision !== source.revision || current.week !== source.week || current.round !== source.round ||
      current.encounterId !== source.encounterId || current.target !== source.target || current.scene !== source.scene) return false;
  if (current.encounterId === 'FIRST_CASE') return true;
  return source.encounterId === 'POLYMATH_DISPUTE' && current.attemptWeek === source.attemptWeek &&
    current.startHistoryIndex === source.startHistoryIndex && current.weapon === source.weapon &&
    current.space === source.space && current.visibility === source.visibility && current.lighting === source.lighting &&
    current.distanceMetres === source.distanceMetres && current.ground === source.ground &&
    current.bystanders === source.bystanders && current.exit === source.exit && current.pursuit === source.pursuit;
}
/** Old inventory and a single observation cannot produce this learned sample. */
function hasLearnedFlash(state: SliceState): boolean {
  const sample = state.polymath.samples.FLASH;
  const { observedWeek, understoodWeek, learnedWeek, analysisAttemptWeek } = sample;
  return [observedWeek, understoodWeek, learnedWeek, analysisAttemptWeek].every(week =>
    week !== null && Number.isSafeInteger(week) && week >= 1 && week <= state.week) &&
    observedWeek! <= understoodWeek! && understoodWeek! <= learnedWeek! &&
    observedWeek! <= analysisAttemptWeek! && analysisAttemptWeek! <= learnedWeek!;
}
/** The S6 scene has the same inherited, once-only ordinary interference rule. */
export function consumePolymathInterference(
  state: SliceState, ordinaryPositiveGain: number,
): { selfGain: number; label: string } {
  if (state.combat?.reasonerInterference !== true || currentPolymathCombatSource(state) === null ||
      !Number.isFinite(ordinaryPositiveGain) || ordinaryPositiveGain <= 0) {
    return { selfGain: ordinaryPositiveGain, label: '' };
  }
  delete state.combat.reasonerInterference;
  return { selfGain: ordinaryPositiveGain * 0.85,
    label: '；先前战场模型/战术封锁于本次实际普通正向贡献生效×0.85，一次性干扰已消耗' };
}

export type DetectiveObservedMoveId = 'STRIKE' | 'BLOCK' | 'OPENING' | 'DISTANCE' | 'MISS';
const OBSERVED_LABELS: Readonly<Record<DetectiveObservedMoveId, string>> = Object.freeze({
  STRIKE: '短棍打击', BLOCK: '格挡护身', OPENING: '寻找空当', DISTANCE: '拉开距离', MISS: '动作落空',
});
/** Ephemeral resolver-local observations, never serialized or reconstructed from old combat history. */
export interface DetectiveRoundObservations {
  source: DetectiveCombatSource | null;
  counts: Partial<Record<DetectiveObservedMoveId, number>>;
  lastMove: DetectiveObservedMoveId | null;
}
export function createDetectiveRoundObservations(state: SliceState): DetectiveRoundObservations {
  return { source: currentDetectiveCombatSource(state), counts: {}, lastMove: null };
}
/** Call only after the ordinary enemy action has actually resolved. No random draws. */
export function observeDetectiveEnemyAction(observations: DetectiveRoundObservations, id: DetectiveObservedMoveId): void {
  if (observations.source === null) return;
  observations.counts[id] = (observations.counts[id] ?? 0) + 1;
  observations.lastMove = id;
}
/** Only the latest actually observed ability is the target; other repeated abilities cannot lend their bonus. */
export function detectiveRepeatBonus(state: SliceState, observations: DetectiveRoundObservations): number {
  if (!validSource(state, observations.source) || observations.lastMove === null) return 0;
  const count = observations.counts[observations.lastMove];
  return Number.isSafeInteger(count) && count! > 1 ? Math.min(15, (count! - 1) * 5) : 0;
}
function observationLabel(state: SliceState, observations: DetectiveRoundObservations): string {
  const id = observations.lastMove;
  if (!validSource(state, observations.source) || id === null ||
      !Number.isSafeInteger(observations.counts[id]) || observations.counts[id]! < 1) {
    return '本回合尚未观察到敌方实际动作，重复加值+0';
  }
  const count = observations.counts[id]!;
  return `本回合已实际观察「${OBSERVED_LABELS[id]}」${count}次，${count > 1 ? '出现同能力重复' : '尚无同能力重复'}，重复加值+${detectiveRepeatBonus(state, observations)}（上限+15）`;
}
function mastery(state: SliceState, key: 'reconstruction' | 'combat-training' | 'agility'): number {
  const value = state.progression.mastery[`reader.s7.${key}`] ?? 0;
  return Number.isFinite(value) ? Math.max(0, Math.min(500, value)) : 0;
}
function factor(value: number): number { return 0.65 + 0.35 * value / 500; }
export interface DetectiveCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): DetectiveCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
export function resolveDetectiveCombatAbility(
  state: SliceState, id: DetectiveMoveId, physicalStateFactor: number, random: ActionRandomStream,
  observations: DetectiveRoundObservations = createDetectiveRoundObservations(state),
): DetectiveCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('守知者能力：当前没有可结算的对应战斗行动');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'reader.s6.limited-imitation': {
      if (!isPolymath(state)) return noEffect('有限闪光模仿：当前序列没有该能力槽');
      if (!validSource(state, observations.source) || !hasLearnedFlash(state) || state.spirituality < 2) {
        return { ...noEffect('有限闪光模仿：缺少当前真实目标、已分析学会的闪光样本或2点灵性，改用普通格挡护身；不从旧物取得技能、不耗灵性、不重抽'),
          enemyReduction: 10 };
      }
      state.spirituality -= 2;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: state.character.coreStats.knowledge,
        difficulty: 18, modifiers: [] });
      const succeeded = random.nextInt(1, 100) <= chance;
      const rawMastery = state.progression.mastery['reader.s6.limited-imitation'] ?? 0;
      const level = Number.isFinite(rawMastery) ? Math.max(0, Math.min(500, rawMastery)) : 0;
      return { ...noEffect(`有限闪光模仿：已耗2点灵性；知识难度18检定${chance}%，${succeeded
        ? '成功；将实际学会的低阶闪光弱化再现为单个眼前目标的短暂扰动'
        : '失败；没有产生有效扰动，灵性不退回'}；不造成直接伤害、不删除敌方动作、不群控，不是太阳净化或高阶雷击`),
        enemyReduction: succeeded ? 8 * (1 + level / 500) : 0 };
    }
    case 'reader.s7.weapon-combat': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 17.55 * factor(mastery(state, 'combat-training'))) * physical;
      return { label: armed
        ? '武器/格斗：持握原短棍打击，采用原普通16贡献并替代本槽17.55f预算；不叠加、不制造工具、不耗灵性'
        : '武器/格斗：以实际身体和格斗训练打击（17.55f，G）；不凭空产生武器、不耗灵性',
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'reader.s7.trajectory-strike': {
      const selfGain = 9.45 * factor(mastery(state, 'agility')) * physical;
      return { label: '轨迹打击：依眼前轨迹以实际身体敏捷打击（9.45f，G）；不预读未来、不创造仪式或投射物、不叠加短棍贡献、不耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'reader.s7.battlefield-model':
    case 'reader.s7.tactical-blockade': {
      const defense = id === 'reader.s7.battlefield-model', label = defense ? '战场模型' : '战术封锁';
      if (!validSource(state, observations.source)) return {
        ...noEffect(`${label}：当前没有有效的同场普通对手来源，改用普通${defense ? '格挡护身' : '拉开距离'}；不读取旧案或未来动作、不耗灵性、不重抽`),
        enemyReduction: defense ? 10 : 8,
      };
      const level = mastery(state, 'reconstruction');
      const chance = whiteTowerKnowledgeChance({ knowledge: state.character.coreStats.knowledge,
        mastery: level, tier: 2, targetMainAttribute: REASONER_ORDINARY_TARGET.mainAttribute,
        targetMastery: REASONER_ORDINARY_TARGET.mastery, targetTier: REASONER_ORDINARY_TARGET.tier,
        familiarity: REASONER_ORDINARY_TARGET.familiarity, repetitionBonus: detectiveRepeatBonus(state, observations) });
      const succeeded = random.nextInt(1, 1_000_000) <= chance * 10_000;
      if (succeeded) state.combat!.reasonerInterference = true;
      return { ...noEffect(`${label}：${observationLabel(state, observations)}；依眼前普通身体、短棍与站位进行知识检定${chance.toFixed(2)}%，${succeeded
        ? '成功；承接战术计算，敌方下一次实际普通正向贡献×0.85，仅一次，重复成功只刷新不叠加'
        : '失败；未建立新的干扰'}。本槽普通应对仍结算；不复制技能、不建立解析标记、不耗灵性`),
      enemyReduction: (defense ? 29.25 : 15.75) * factor(level) };
    }
    case 'OBSERVE':
      return noEffect(validSource(state, observations.source)
        ? `观察重复动作：${observationLabel(state, observations)}；只整理本回合已实际展示的普通动作，即时贡献0；不抽取或读取未来动作、不额外增加重复次数、不建立干扰`
        : '观察重复动作：没有当前可用的普通现场来源，即时贡献0；不读取旧案或未来动作');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`轨迹误判：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成致伤攻击或仪式反噬`), selfGain };
    }
  }
}
