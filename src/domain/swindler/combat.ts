import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { marauderPlayerHoldsClub } from '../marauder/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Error V1 S8: U30, A0.8/E0.5. The two-hit mechanism and budgets are game rules (G). */
export const SWINDLER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 12 }),
  Object.freeze({ id: '2', label: '2次', weight: 18 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 28 }),
  Object.freeze({ id: '5', label: '5次', weight: 17 }),
]);
export type SwindlerMoveId = 'BODY_STRIKE' | 'MISDIRECT' | 'COVER' | 'DECEIT' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: SwindlerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '计划性近身行动（真实身体；0灵性）', weight: 24, stance: 'ATTACK' },
  { id: 'MISDIRECT', label: '误导（已观察普通动作后耗1灵性；下一次敌能力失效；0即时贡献）', weight: 14, stance: 'ATTACK' },
  { id: 'COVER', label: '借注意空当脱离（身体避让；0灵性；不取消行动）', weight: 12, stance: 'DEFEND' },
  { id: 'DECEIT', label: '两段式骗局', weight: 8, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '锁定已观察信息差', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '骗局反转或普通动作空当（±7.5；0灵性；不判伤）', weight: 32, stance: null },
];

export function isSwindler(state: SliceState): boolean {
  return state.progression?.pathwayId === 'error' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function swindlerAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  const context = state?.combat?.swindlerDeceit;
  const stage = !state ? '须先有本场已发生的可见普通动作'
    : currentSwindlerCombatSource(state) === null ? '当前无合格同场普通人；0效果、不耗灵性'
    : !context?.observed ? '尚无已发生的可见普通动作；本次仅观察0效果'
    : context.prepared ? `已准备；再次命中且敌有剩余次数时完成，耗1灵性${state.spirituality < 1 ? '（当前不足，保持准备）' : ''}`
    : '已有可见动作；第一次命中只建立准备，耗0灵性';
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'DECEIT' || ability.id === 'OBSERVE'
      ? `${ability.label}（K/R共用两段；${stage}；完成转移至多1次当前剩余次数并使下一敌能力失效；0即时贡献，不额外立即行动）`
      : ability.id === 'MISDIRECT' && state
      ? `${ability.label}；${!currentSwindlerCombatSource(state) || !context?.observed ? '当前前置不足，0效果、不耗灵性'
        : context.skipNext ? '下一次失效已待触发，不叠加、不重复付费'
        : state.spirituality < 1 ? '当前灵性不足，0效果、不耗灵性' : '当前可发动'}`
      : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawSwindlerAbility(random: ActionRandomStream, stance: SliceStance | null): SwindlerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('诈骗师能力盘权重无效');
}
export function swindlerActionCount(roll: number): number {
  return roll <= 12 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 83 ? 4 : 5;
}

/** Only this encounter authors a current living, visible, communicable ordinary target. */
export interface SwindlerCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; speech: 'CURRENT_ORDINARY_CONVERSATION';
  space: 'DRY_GROUND_PASSAGE'; exit: 'EXISTING_ORDINARY_GROUND_EXIT';
}
export function currentSwindlerCombatSource(state: SliceState): SwindlerCombatSource | null {
  const combat = state.combat;
  const inherited = state.progression?.pathwayId === 'error' && state.progression.sequence === 7;
  if ((!isSwindler(state) && !inherited) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !combat || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 || combat.enemyStatus !== 'RESISTING' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 || state.arc.stage !== 'COMBAT' ||
      state.world.city !== 'BACKLUND' || combat.encounterId !== 'FIRST_CASE' ||
      !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', speech: 'CURRENT_ORDINARY_CONVERSATION',
    space: 'DRY_GROUND_PASSAGE', exit: 'EXISTING_ORDINARY_GROUND_EXIT' };
}
function validSource(state: SliceState, source: SwindlerCombatSource | null): boolean {
  const current = currentSwindlerCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week && source.round === current.round &&
    source.encounterId === current.encounterId && source.target === current.target &&
    source.nature === current.nature && source.body === current.body && source.speech === current.speech &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: 'error.s9.agility' | 'error.s9.dexterity'): number {
  const value = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500;
}
export interface SwindlerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
export interface SwindlerActionRemainder { PLAYER: number; ENEMY: number }
function noEffect(label: string): SwindlerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Called after a real, unsuppressed ordinary action, never from an undrawn future slot. */
export function observeSwindlerEnemyAction(state: SliceState, abilityId: string): void {
  if (!currentSwindlerCombatSource(state) ||
      !['STRIKE', 'BLOCK', 'OPENING', 'DISTANCE', 'MISS'].includes(abilityId)) return;
  const context = state.combat!.swindlerDeceit ??= { observed: false, prepared: false, skipNext: false };
  context.observed = true;
}

/** Consumes exactly the next actual ordinary ability slot, after its normal draw. */
export function consumeSwindlerMisdirection(state: SliceState): string | null {
  if (!currentSwindlerCombatSource(state) || state.combat?.swindlerDeceit?.skipNext !== true) return null;
  state.combat.swindlerDeceit.skipNext = false;
  return '先前误导于本次实际能力生效：本次全部贡献归0，行动次数已正常消耗；一次失效已用尽，没有催眠、记忆改写或控制意志';
}

/** One actual player slot. K/R share preparation and never pay a second immediate budget. */
export function resolveSwindlerCombatAbility(
  state: SliceState, id: SwindlerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  remaining: SwindlerActionRemainder,
  source: SwindlerCombatSource | null = currentSwindlerCombatSource(state),
): SwindlerCombatEffect {
  if (!validSource(state, source)) return noEffect('诈骗师行动：缺少本场存活、可见且可交流的普通对手，本次贡献0、不耗灵性、不重抽');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const maxSpirituality = state.progression.sequence === 7 ? 60 : 45;
  switch (id) {
    case 'BODY_STRIKE': {
      const stolenClub = marauderPlayerHoldsClub(state), armed = state.town.clubLocation === 'HAND' || stolenClub;
      const selfGain = (armed ? 16 : 15.6 * masteryFactor(state, 'error.s9.agility')) * physical;
      return { label: stolenClub
        ? `计划性近身行动：持握塞蒙原短棍${state.marauder.dispute.weapon.id} v${state.marauder.dispute.weapon.version}，普通短棍16贡献（G），替换而不叠加主攻预算；所有权仍属塞蒙，耗0灵性`
        : armed ? '计划性近身行动：持握原短棍打击，普通16贡献（G）替换而不叠加主攻预算，耗0灵性'
        : '计划性近身行动：实际身体近身打击，15.6×原灵敏掌握系数（G），耗0灵性；不附赠骗局或额外行动',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'COVER':
      return { ...noEffect('借注意空当脱离：仅凭实际身体避让，自保减势9.75×原灵敏掌握系数（G），耗0灵性；不保证免伤、不取消行动、不凭空改变对手意志'),
        enemyReduction: 9.75 * masteryFactor(state, 'error.s9.agility') };
    case 'MISDIRECT': {
      const context = state.combat!.swindlerDeceit;
      if (!context?.observed) return noEffect('误导：本场尚未发生可见普通动作，没有已观察的信息差；仅观察，0效果、不耗灵性、不预读意图');
      if (context.skipNext) return noEffect('误导：下一次能力失效已待触发，不叠加次数、不重复付费，本次即时贡献0');
      if (!Number.isFinite(state.spirituality) || state.spirituality < 1) return noEffect('误导：灵性不足1，0效果、不耗灵性、不重抽');
      const before = state.spirituality;
      state.spirituality -= 1;
      context.skipNext = true;
      return noEffect(`误导：依据本场已发生的可见普通动作错开对手注意，耗1灵性（上限${maxSpirituality}的1%向上取整，${before}→${state.spirituality}）；下一次实际能力全部失效，仅一次、不叠加；本次即时贡献0，不催眠、不改写记忆、不替对手作决定`);
    }
    case 'DECEIT':
    case 'OBSERVE': {
      const label = id === 'DECEIT' ? '两段式骗局' : '锁定已观察信息差', context = state.combat!.swindlerDeceit;
      if (!context?.observed) return noEffect(`${label}：尚无本场已实际发生的可见普通动作，只有观察，不建立骗局准备；0贡献、0灵性，不制造隐藏信息差`);
      if (!context.prepared) {
        context.prepared = true;
        return noEffect(`${label}：第一次有效命中，只根据已发生的可见普通动作建立准备；准备跨回合保留至本场结束，本次0贡献、0灵性，不窃取次数、不令能力失效`);
      }
      if (![remaining.PLAYER, remaining.ENEMY].every(value => Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER)) {
        return noEffect(`${label}：当前剩余次数无效，保持准备；不转移、不耗灵性、不重抽`);
      }
      if (remaining.ENEMY === 0) return noEffect(`${label}：敌方当前剩余次数为0，保持准备；不凭空增加己方次数、不新增失效、不耗灵性、不重抽`);
      if (!Number.isFinite(state.spirituality) || state.spirituality < 1) return noEffect(`${label}：完成段需1灵性，当前不足，保持准备；不转移、不新增失效、不耗灵性、不重抽`);
      const playerBefore = remaining.PLAYER, enemyBefore = remaining.ENEMY, spiritBefore = state.spirituality;
      const transfer = Math.min(1, remaining.ENEMY);
      remaining.ENEMY -= transfer;
      remaining.PLAYER += transfer;
      state.spirituality -= 1;
      context.prepared = false;
      context.skipNext = true;
      return noEffect(`${label}：第二次有效命中，完成骗局，耗1灵性（上限${maxSpirituality}的1%向上取整，${spiritBefore}→${state.spirituality}）；当前剩余次数敌${enemyBefore}→${remaining.ENEMY}、我${playerBefore}→${remaining.PLAYER}，总数守恒；下一次实际敌能力失效，仅一次、不叠加。清除准备，本次即时贡献0；转来次数等待原小轮后续位置使用，不立即追加行动，不预抽被转走的敌方能力`);
    }
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`骗局反转或普通动作空当：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），耗0灵性；不创建准备或失效，不构成致伤攻击`), selfGain };
    }
  }
}
