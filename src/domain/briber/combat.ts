import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { BARBARIAN_COUNT_WHEEL, barbarianActionCount } from '../barbarian/combat.js';
import type { LawyerCombatSource } from '../lawyer/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** S7 G profile. Giving an original is required; catching or accepting it is not. */
export const BRIBER_COUNT_WHEEL = BARBARIAN_COUNT_WHEEL;
export const briberActionCount = barbarianActionCount;
export type BriberMoveId = 'black-emperor.s8.enhanced-body' | 'BODY_FOLLOWUP'
  | 'black-emperor.s7.bribery-weakening' | 'POSITION' | 'black-emperor.s8.mental-resistance' | 'ACCIDENT';
const ABILITIES: readonly {
  id: BriberMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'black-emperor.s8.enhanced-body', label: '贿赂者继承强化身体打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '强化身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'black-emperor.s7.bribery-weakening', label: '赠出原物削弱／破绽护身', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'black-emperor.s8.mental-resistance', label: '核实精神抗性的适用来源', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];
export function isBriber(state: SliceState): boolean {
  return state.progression?.pathwayId === 'black-emperor' && state.progression.sequence === 7;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function briberAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'black-emperor.s8.enhanced-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawBriberAbility(random: ActionRandomStream, stance: SliceStance | null): BriberMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('贿赂者能力盘权重无效');
}

export interface BriberCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): BriberCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
export type BriberCombatSource = LawyerCombatSource;
export function currentBriberCombatSource(state: SliceState): BriberCombatSource | null {
  if (!isBriber(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      !Number.isSafeInteger(state.combat.round) || state.combat.round < 1 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: BriberCombatSource | null): boolean {
  const current = currentBriberCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState,
  id: 'black-emperor.s8.enhanced-body' | 'black-emperor.s9.weak-point-insight' | 'black-emperor.s7.bribery-weakening',
): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** Local to one synchronous round. Never persisted or reused by the coordinator. */
export interface BriberRoundContext {
  source: BriberCombatSource | null;
  pendingWeakening: { giftId: string; factor: number } | null;
}
export function createBriberRoundContext(state: SliceState): BriberRoundContext {
  return { source: currentBriberCombatSource(state), pendingWeakening: null };
}
const groundDestination = (source: BriberCombatSource) => `BATTLE:${source.encounterId}:GROUND`;
const display = (value: number) => Number(value.toFixed(6));

/** Called only after the enemy's actual action and target have been resolved. */
export function consumeBriberWeakening(
  state: SliceState, context: BriberRoundContext, target: 'PLAYER' | 'OTHER',
  selfGain: number, enemyReduction: number,
): { selfGain: number; enemyReduction: number; label: string } | null {
  const pending = context.pendingWeakening;
  if (target !== 'PLAYER' || !pending || !validCombatSource(state, context.source)) return null;
  const source = context.source!;
  const original = state.briber.gifts.find(gift => gift.id === pending.giftId);
  if (!original || original.location !== 'GIVEN' || original.destination !== groundDestination(source) ||
      original.givenWeek !== source.week) return null;
  // A real MISS is still the next action: consume even when both contributions are zero.
  context.pendingWeakening = null;
  const gain = selfGain * (1 - pending.factor), reduction = enemyReduction * (1 - pending.factor);
  return { selfGain: gain, enemyReduction: reduction,
    label: `原赠物${pending.giftId}的贿赂削弱用于本轮下一次实际针对你的行动（G）：敌方自身增势${display(selfGain)}→${display(gain)}，对你减势${display(enemyReduction)}→${display(reduction)}；本次后失效，即使动作落空也已消耗，不追加行动` };
}
export function finishBriberCombatRound(context: BriberRoundContext): string | null {
  if (!context.pendingWeakening) return null;
  const id = context.pendingWeakening.giftId;
  context.pendingWeakening = null;
  return `本轮未再发生针对你的敌方实际行动，原赠物${id}的待用贿赂削弱已失效；不追溯此前动作，原物仍留在战场地面，不自动归还。`;
}

/** B is one existing slot: either pay once and defer, or use inherited defense. */
export function resolveBriberCombatAbility(
  state: SliceState, id: BriberMoveId, physicalStateFactor: number, random: ActionRandomStream,
  context: BriberRoundContext,
  source: BriberCombatSource | null = currentBriberCombatSource(state),
): BriberCombatEffect {
  if (!validCombatSource(state, source) || !validCombatSource(state, context.source)) {
    return noEffect('贿赂者行动：缺少本场仍可触及的可见普通对手与真实现场，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'black-emperor.s8.enhanced-body': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 54 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献，不叠加强化身体或贿赂预算，消耗0灵性，不保证命中'
        : '贿赂者继承强化身体打击：使用野蛮人真实身体力量（G），消耗0灵性；不保证命中，伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 37.8 * masteryFactor(state, 'black-emperor.s8.enhanced-body') * physical;
      return { label: '强化身体侧击：继承同一身体掌握度（G），消耗0灵性，独立占用本次行动；不追加攻击、不恢复伤势或精神',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'black-emperor.s7.bribery-weakening': {
      const gift = state.briber.gifts.find(candidate => candidate.location === 'PLAYER');
      if (!context.pendingWeakening && gift && Number.isFinite(state.spirituality) && state.spirituality >= 3) {
        gift.location = 'GIVEN';
        gift.destination = groundDestination(source!);
        gift.givenWeek = state.week;
        state.spirituality -= 3;
        const factor = 0.35 * masteryFactor(state, id);
        context.pendingWeakening = { giftId: gift.id, factor };
        return noEffect(`实际朝当前普通对手赠出原木筹${gift.id}，原物离开持有库存并落在本场地面，未成为敌方库存；消耗3灵性，本次增势0、减势0。无需对方自愿接住或收下，仅待本轮下一次实际针对你的行动削弱${display(factor * 100)}%（G），不追溯、不控制意志、不追加行动`);
      }
      const reason = context.pendingWeakening ? '本轮已有一份待用贿赂削弱，不重复赠礼或支付'
        : !gift ? '没有实际持有的可赠原物，不凭空生成礼物' : '灵性不足3，不支付或赠出原物';
      return { ...noEffect(`可见破绽判断与护身：${reason}；本次采用继承律师的眼前破绽防守（G），消耗0灵性，不读取思想、不取消对方行动、不强制同意`),
        enemyReduction: 36.45 * masteryFactor(state, 'black-emperor.s9.weak-point-insight') * physical };
    }
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只沿眼前通道调整距离（G），不叠加强化身体或贿赂掌握，不强制取消对手行动'),
        enemyReduction: 6 * physical };
    case 'black-emperor.s8.mental-resistance':
      return noEffect('精神抗性：本场普通对手没有正在使用的有来源精神攻击，本次贡献0、消耗0；不是主动精神免疫、精神控制或恢复，不生成协商条款，不下放扭曲');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成致伤攻击，不是贿赂、扭曲或重掷`), selfGain };
    }
  }
}
