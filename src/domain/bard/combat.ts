import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed Sun V1 S9 D-profile; every contribution is game balance (G). */
export const BARD_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 35 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
]);

export type BardMoveId = 'sun.s9.praise' | 'CHORUS_SUPPORT' | 'sun.s9.courage'
  | 'BREAK_FEAR' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: BardMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'sun.s9.praise', label: '歌颂强化后的体术/武器', weight: 32, stance: 'ATTACK' },
  { id: 'CHORUS_SUPPORT', label: '歌颂支援自身下一次合法攻击', weight: 18, stance: 'ATTACK' },
  { id: 'sun.s9.courage', label: '稳定自身士气', weight: 12, stance: 'DEFEND' },
  { id: 'BREAK_FEAR', label: '短歌振作与抵御畏惧', weight: 10, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '选择短句与节奏', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '走调或节奏偏差', weight: 20, stance: null },
];

export function isBard(state: SliceState): boolean {
  return state.progression?.pathwayId === 'sun' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function bardAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawBardAbility(random: ActionRandomStream, stance: SliceStance | null): BardMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('歌颂者能力盘权重无效');
}
export function bardActionCount(roll: number): number {
  return roll <= 35 ? 1 : roll <= 65 ? 2 : roll <= 85 ? 3 : 4;
}

export interface BardCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): BardCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * FIRST_CASE authors a visible ordinary human and an active, unrestricted
 * speaker. It authors no ally, silence, supernatural fear, or Sun weakness.
 * This snapshot authorizes a short utterance, not an already completed song.
 */
export interface BardCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN'; sunVulnerable: false;
  speaker: 'CURRENT_ACTIVE_PLAYER'; voice: 'ORDINARY_UNRESTRICTED_SHORT_PHRASE'; listeners: 'SELF_ONLY';
}
export function currentBardCombatSource(state: SliceState): BardCombatSource | null {
  if (!isBard(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round,
    target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', nature: 'ORDINARY_HUMAN', sunVulnerable: false,
    speaker: 'CURRENT_ACTIVE_PLAYER', voice: 'ORDINARY_UNRESTRICTED_SHORT_PHRASE', listeners: 'SELF_ONLY' };
}
function validCombatSource(state: SliceState, source: BardCombatSource | null): boolean {
  const current = currentBardCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.nature === current.nature &&
    source.sunVulnerable === current.sunVulnerable && source.speaker === current.speaker &&
    source.voice === current.voice && source.listeners === current.listeners;
}
function masteryFactor(mastery: number): number {
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** Caller-local only: not part of the save, character, or next round. */
export interface BardEffectContext {
  pendingSupportBudgets: number[];
  finished: boolean;
}
export interface BardRoundContext extends BardEffectContext {
  source: BardCombatSource | null;
}
/** Actual participant data only; source authorization stays in each caller's scene guard. */
export interface BardActor {
  armed: boolean; physicalStateFactor: number; praiseMastery: number; courageMastery: number;
  targetDescription: string;
}
export function createBardRoundContext(state: SliceState): BardRoundContext {
  return { source: currentBardCombatSource(state), pendingSupportBudgets: [], finished: false };
}

/**
 * Singing is performed by this one drawn slot. Support spends its own original
 * 6.3f budget on the next real, legal physical main action; it neither multiplies
 * that action nor invents an ally or another turn. A held club replaces 11.7f.
 */
export function resolveBardCombatAbility(
  state: SliceState, id: BardMoveId, physicalStateFactor: number, random: ActionRandomStream,
  context: BardRoundContext,
): BardCombatEffect {
  if (context.finished || !validCombatSource(state, context.source)) {
    return noEffect('歌颂者能力：缺少本场可见普通对手与可发声的本人来源，本次贡献0；不借用旧现场或虚构同伴');
  }
  return resolveBardActorCombatAbility({ armed: state.town.clubLocation === 'HAND', physicalStateFactor,
    praiseMastery: state.progression.mastery['sun.s9.praise'] ?? 0,
    courageMastery: state.progression.mastery['sun.s9.courage'] ?? 0,
    targetDescription: '普通携铃者' }, id, random, context);
}

/** Shared S9 contributions and local support ledger, without any player/scene impersonation. */
export function resolveBardActorCombatAbility(
  actor: BardActor, id: BardMoveId, random: ActionRandomStream, context: BardEffectContext,
): BardCombatEffect {
  if (context.finished) return noEffect('歌颂者本轮已结束，本次贡献0');
  const physical = Number.isFinite(actor.physicalStateFactor) ? Math.max(0, Math.min(1, actor.physicalStateFactor)) : 0;
  switch (id) {
    case 'sun.s9.praise': {
      const armed = actor.armed;
      const attackGain = (armed ? 16 : 11.7 * masteryFactor(actor.praiseMastery)) * physical;
      if (attackGain <= 0) return noEffect('歌颂强化体术：本次未能形成有效身体攻击，待用支援未被消耗；没有圣光或额外攻击');
      const support = context.pendingSupportBudgets.reduce((sum, budget) => sum + budget, 0);
      const supportCount = context.pendingSupportBudgets.length;
      context.pendingSupportBudgets = [];
      return { label: `实际唱出短句赞歌后${armed ? '持握原短棍打击：采用普通短棍16贡献，替换而不叠加歌颂主攻预算' : '以歌颂强化自身力量与敏捷，实施一次近身体术'}${supportCount > 0 ? `；消耗本轮${supportCount}次歌颂支援的原槽预算合计+${support}（G），只加在这次实际攻击，不相乘` : ''}；${actor.targetDescription}没有太阳易伤，不作善恶判定`,
        selfGain: attackGain + support, enemyReduction: 0, threatens: true };
    }
    case 'CHORUS_SUPPORT': {
      const budget = 6.3 * masteryFactor(actor.praiseMastery);
      context.pendingSupportBudgets.push(budget);
      return noEffect(`实际唱出短句赞歌，暂存本次支援原槽预算+${budget}（G），只待本人本轮下一次合法身体攻击使用；当下贡献0，不生成同伴或新行动`);
    }
    case 'sun.s9.courage':
      return { ...noEffect('实际唱出勇气短歌，稳定本人当前士气，以普通自保减势结算后结束；不治疗伤势、不清除污染、不重置精神、不产生永久恐惧免疫'),
        enemyReduction: 5.2 * masteryFactor(actor.courageMastery) };
    case 'BREAK_FEAR':
      return { ...noEffect('实际唱出勇气短歌，振作本人并抵御当前畏惧，以普通控制槽减势结算后结束；没有已公开的超凡恐惧可解除，不操纵敌人、不强制皈依或放弃抵抗'),
        enemyReduction: 2.8 * masteryFactor(actor.courageMastery) };
    case 'OBSERVE':
      return noEffect('选择适合眼前短暂交锋的赞美短句与节奏，本次贡献0；尚未唱出，不预存支援、不追加攻击');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`走调或节奏偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G）；不是致伤攻击、精神控制或神术`), selfGain };
    }
  }
}

/** Report expiration in the round consequence, never as another action slot. */
export function finishBardCombatRound(context: BardEffectContext): string | null {
  if (context.finished) return null;
  context.finished = true;
  const count = context.pendingSupportBudgets.length;
  context.pendingSupportBudgets = [];
  return count === 0 ? null : `本轮${count}次歌颂支援未等到本人后续合法身体攻击，原槽预算已到期，攻击加成0；不结转、不增加行动。`;
}
