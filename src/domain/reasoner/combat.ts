import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** User-confirmed White Tower COMBAT-V3 S8; all combat numbers are game balance (G). */
export const REASONER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 40 }),
  Object.freeze({ id: '2', label: '2次', weight: 35 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
]);
export type ReasonerMoveId = 'reader.s8.calculated-strike' | 'reader.s8.ritual-attack'
  | 'reader.s8.tactical-calculation' | 'reader.s8.route-interference' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: ReasonerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'reader.s8.calculated-strike', label: '计算落点', weight: 18, stance: 'ATTACK' },
  { id: 'reader.s8.ritual-attack', label: '仪式攻击', weight: 12, stance: 'ATTACK' },
  { id: 'reader.s8.tactical-calculation', label: '战术计算', weight: 32, stance: 'DEFEND' },
  { id: 'reader.s8.route-interference', label: '路线干扰', weight: 25, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '建立战斗模型', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '错误计算', weight: 5, stance: null },
];
export function isReasoner(state: SliceState): boolean {
  return state.progression.pathwayId === 'white-tower' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function reasonerAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawReasonerAbility(random: ActionRandomStream, stance: SliceStance | null): ReasonerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('推理学员能力盘权重无效');
}
export function reasonerActionCount(roll: number): number {
  return roll <= 40 ? 1 : roll <= 75 ? 2 : 3;
}

export type WhiteTowerFamiliarity = 'NONE' | 'FAMILIAR' | 'VERIFIED';
export interface WhiteTowerKnowledgeInput {
  knowledge: number; mastery: number; tier: number;
  targetMainAttribute: number; targetMastery: number; targetTier: number;
  familiarity: WhiteTowerFamiliarity;
  /** S7 actual same-round repetitions only; applied before the shared 10–90 clamp. */
  repetitionBonus?: number;
}
/** No unknown target may silently become a zero-attribute, zero-mastery target. */
export function whiteTowerKnowledgeChance(input: WhiteTowerKnowledgeInput): number {
  const attributes = [input.knowledge, input.mastery, input.targetMainAttribute, input.targetMastery];
  const repetitionBonus = input.repetitionBonus ?? 0;
  if (attributes.some(value => !Number.isFinite(value) || value < 0 || value > 500) ||
      [input.tier, input.targetTier].some(value => !Number.isSafeInteger(value) || value < -1 || value > 9) ||
      !(['NONE', 'FAMILIAR', 'VERIFIED'] as const).includes(input.familiarity) ||
      ![0, 5, 10, 15].includes(repetitionBonus)) {
    throw new RangeError('白塔知识检定需要完整、有效的当前双方能力档');
  }
  const understanding = 0.7 * input.knowledge + 0.3 * input.mastery;
  const complexity = 0.5 * input.targetMainAttribute + 0.5 * input.targetMastery;
  const familiarity = input.familiarity === 'VERIFIED' ? 10 : input.familiarity === 'FAMILIAR' ? 5 : 0;
  return Math.max(10, Math.min(90, 50 + 8 * (input.tier - input.targetTier)
    + 0.1 * (understanding - complexity) + familiarity + repetitionBonus));
}
/**
 * Ordinary FIRST_CASE carrier (G): the existing physical core remains 14 and
 * ordinary actions remain +16/+8. Mastery100 is an explicit trained ordinary
 * template, not missing data treated as zero. Ordinary tier=-1, S9=0, S8=1, S7=2.
 * No authored prebattle knowledge record matches this carrier's combat skill,
 * so the read-only familiarity snapshot for this encounter is always NONE.
 */
export const REASONER_ORDINARY_TARGET = Object.freeze({
  mainAttribute: 14, knowledge: 14, mastery: 100, tier: -1, familiarity: 'NONE' as const,
});
export interface ReasonerCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE'; target: 'CURRENT_VISIBLE_ORDINARY_CARRIER';
  scene: 'VISIBLE_BODY_AND_SHORT_CLUB';
}
function hasLiveCombat(state: SliceState): boolean {
  return isReasoner(state) && state.status === 'ACTIVE' && state.health > 0 && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}
/** Reads only the present visible body/tool and existing ordinary scene. Never draws a future action. */
export function currentWhiteTowerTacticalSource(state: SliceState): ReasonerCombatSource | null {
  if (state.progression.pathwayId !== 'white-tower' ||
      (state.progression.sequence !== 8 && state.progression.sequence !== 7) ||
      state.status !== 'ACTIVE' || state.health <= 0 || state.combat === null ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat!.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist ||
      !Number.isSafeInteger(state.combat!.round) || state.combat!.round < 1) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: state.combat!.round,
    encounterId: 'FIRST_CASE', target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', scene: 'VISIBLE_BODY_AND_SHORT_CLUB' };
}
export function currentReasonerCombatSource(state: SliceState): ReasonerCombatSource | null {
  return isReasoner(state) ? currentWhiteTowerTacticalSource(state) : null;
}
function validSource(state: SliceState, source: ReasonerCombatSource | null): boolean {
  const current = currentReasonerCombatSource(state);
  return current !== null && source !== null && current.runId === source.runId &&
    current.revision === source.revision && current.week === source.week && current.round === source.round &&
    current.encounterId === source.encounterId && current.target === source.target && current.scene === source.scene;
}
function mastery(state: SliceState, key: 'observation' | 'deduction' | 'ritual-specialism'): number {
  const value = state.progression.mastery[`reader.s8.${key}`] ?? 0;
  return Number.isFinite(value) ? Math.max(0, Math.min(500, value)) : 0;
}
function factor(value: number): number { return 0.65 + 0.35 * value / 500; }
export interface ReasonerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): ReasonerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

export function resolveReasonerCombatAbility(
  state: SliceState, id: ReasonerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: ReasonerCombatSource | null = currentReasonerCombatSource(state),
): ReasonerCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('推理学员能力：当前没有可结算的对应战斗行动');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'reader.s8.calculated-strike': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 7.8 * factor(mastery(state, 'observation'))) * physical;
      return { label: armed
        ? '计算落点：持握原短棍打击，采用原普通16贡献并替代本槽预算；不叠加、不制造工具、不耗灵性'
        : '计算落点：观察眼前落点后以实际身体打击（7.8f，G）；不凭空发动仪式、不耗灵性',
      selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'reader.s8.ritual-attack': {
      // Nominal 4.2f cannot execute without a real approved preparation producer.
      const armed = state.town.clubLocation === 'HAND', selfGain = (armed ? 16 : 12) * physical;
      return { label: `仪式攻击：没有本次已备妥的仪式材料与准备，改用${armed ? '持握原短棍打击' : '普通徒手打击'}；采用原普通规则，不叠加4.2f仪式预算、不耗灵性、不重抽`,
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'reader.s8.tactical-calculation':
    case 'reader.s8.route-interference': {
      const defense = id === 'reader.s8.tactical-calculation', label = defense ? '战术计算' : '路线干扰';
      if (!validSource(state, source)) return { ...noEffect(`${label}：当前没有有效的同场普通对手来源，改用普通${defense ? '格挡护身' : '拉开距离'}；不读取旧案、不预测未知动作、不耗灵性、不重抽`), enemyReduction: defense ? 10 : 8 };
      const level = mastery(state, 'deduction');
      const chance = whiteTowerKnowledgeChance({ knowledge: state.character.coreStats.knowledge,
        mastery: level, tier: 1, targetMainAttribute: REASONER_ORDINARY_TARGET.mainAttribute,
        targetMastery: REASONER_ORDINARY_TARGET.mastery, targetTier: REASONER_ORDINARY_TARGET.tier,
        familiarity: REASONER_ORDINARY_TARGET.familiarity });
      // A million-point draw preserves the fractional knowledge chance exactly.
      const succeeded = random.nextInt(1, 1_000_000) <= chance * 10_000;
      if (succeeded) state.combat!.reasonerInterference = true;
      return { ...noEffect(`${label}：依据眼前携铃者的普通身体、短棍与站位进行知识检定${chance.toFixed(2)}%，${succeeded
        ? '成功；敌方下一次实际普通正向贡献×0.85，仅一次，重复成功只刷新不叠加'
        : '失败；未建立新的干扰'}。本槽普通应对仍结算；不预读未来、不读取事件秘密、不耗灵性`),
      enemyReduction: (defense ? 15.6 : 8.4) * factor(level) };
    }
    case 'OBSERVE':
      return noEffect(validSource(state, source)
        ? '建立战斗模型：仅整理眼前普通身体、短棍、站位和本场已实际展示的动作，即时贡献0；不建立干扰、不读取下一动作或未知真相'
        : '建立战斗模型：没有当前可用的普通现场来源，即时贡献0；不把旧案知识转为战场全知');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`错误计算：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击或仪式反噬`), selfGain };
    }
  }
}

/** Called only by the real ordinary enemy-action branch, after its actual draw. */
export function consumeReasonerInterference(
  state: SliceState, ordinaryPositiveGain: number,
): { selfGain: number; label: string } {
  if (state.combat?.reasonerInterference !== true || currentWhiteTowerTacticalSource(state) === null ||
      !Number.isFinite(ordinaryPositiveGain) || ordinaryPositiveGain <= 0) {
    return { selfGain: ordinaryPositiveGain, label: '' };
  }
  delete state.combat.reasonerInterference;
  return { selfGain: ordinaryPositiveGain * 0.85,
    label: `；先前${isReasoner(state) ? '战术计算/路线干扰' : '战场模型/战术封锁'}于本次实际普通正向贡献生效×0.85，一次性干扰已消耗` };
}
