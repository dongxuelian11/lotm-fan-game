import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { resolveProvokerCombatAbility } from '../provoker/combat.js';
import { hasReaperDisputeOpponent, hasReaperOpenPractice } from '../reaper/encounter.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { PyromaniacAbilityId } from './types.js';

/** Finite S7 balance for this stage (G), not a quantitative claim about canon. */
export const PYROMANIAC_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
  Object.freeze({ id: '6', label: '6次', weight: 10 }),
]);

export type PyromaniacMoveId = PyromaniacAbilityId | 'STRIKE' | 'BLOCK' | 'EVADE' | 'OBSERVE' | 'MISS'
  | 'hunter.s9.physical-enhancement' | 'hunter.s9.hunting-instinct'
  | 'hunter.s8.provocation' | 'hunter.s8.hostility-aura';

// Tracking and trap preparation remain real event actions. No free trap, fire
// jump, fire immunity, bullet interception or independent fire-raven actor.
const ABILITIES: readonly {
  id: PyromaniacMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通打击', weight: 8, stance: 'ATTACK' },
  { id: 'BLOCK', label: '格挡护身', weight: 8, stance: 'DEFEND' },
  { id: 'hunter.s9.physical-enhancement', label: '强化打击', weight: 14, stance: 'ATTACK' },
  { id: 'EVADE', label: '闪避', weight: 8, stance: 'DEFEND' },
  { id: 'hunter.s9.hunting-instinct', label: '猎杀直觉', weight: 7, stance: 'CONTROL' },
  { id: 'hunter.s8.provocation', label: '针对性挑衅', weight: 8, stance: 'CONTROL' },
  { id: 'hunter.s8.hostility-aura', label: '憎恶气息', weight: 2, stance: 'CONTROL' },
  { id: 'hunter.s7.flame-control', label: '火焰制造与操控', weight: 10, stance: 'CONTROL' },
  { id: 'hunter.s7.compressed-fireball', label: '压缩火球', weight: 14, stance: 'ATTACK' },
  { id: 'hunter.s7.flame-lance', label: '火焰长枪', weight: 10, stance: 'ATTACK' },
  { id: 'hunter.s7.fire-raven', label: '火鸦', weight: 6, stance: 'ATTACK' },
  { id: 'OBSERVE', label: '观察/调整位置', weight: 3, stance: 'PREPARE' },
  { id: 'MISS', label: '失误', weight: 2, stance: null },
];

export function isPyromaniac(state: SliceState): boolean {
  // S6 keeps this finite S7 profile. No unverified universal damage multiplier
  // or immediate combat mind-control action is inferred from its new abilities.
  return state.progression?.pathwayId === 'hunter' &&
    (state.progression.sequence === 7 || state.progression.sequence === 6);
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function pyromaniacAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({
    id: ability.id, label: ability.label, weight: weights[index]! / total * 100,
  }));
}
export function drawPyromaniacAbility(random: ActionRandomStream, stance: SliceStance | null): PyromaniacMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('纵火家能力盘权重无效');
}
export function pyromaniacActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 75 ? 4 : roll <= 90 ? 5 : 6;
}

export interface PyromaniacCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean; angersEnemy: boolean;
}
function noEffect(label: string): PyromaniacCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false, angersEnemy: false };
}
function hasLiveCombat(state: SliceState): boolean {
  // S5 uses its own wheel; this narrow gate only exposes established inherited
  // moves in its actual independent scene or the unchanged live first case.
  const reaper = state.progression?.pathwayId === 'hunter' && state.progression.sequence === 5 &&
    !hasReaperOpenPractice(state) && (hasReaperDisputeOpponent(state) ||
      (state.combat?.encounterId === 'FIRST_CASE' && state.arc.stage === 'COMBAT' &&
        state.reaper.encounter.status !== 'FIGHTING' && state.world.carrierAlive && state.world.carrierCanResist));
  return (isPyromaniac(state) || reaper) && state.status === 'ACTIVE' && state.health > 0 &&
    state.world.city === 'BACKLUND' && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}

type AuthoredEncounter = 'FIRST_CASE' | 'HUNTER_CARGO' | 'PROVOKER_DISPUTE' | 'PYROMANIAC_DISPUTE'
  | 'CONSPIRATOR_DISPUTE' | 'REAPER_DISPUTE';
function currentEncounter(state: SliceState): AuthoredEncounter | null {
  if (!hasLiveCombat(state)) return null;
  switch (state.combat!.encounterId) {
    case 'FIRST_CASE':
      return state.arc.stage === 'COMBAT' && state.world.carrierAlive && state.world.carrierCanResist
        ? 'FIRST_CASE' : null;
    case 'HUNTER_CARGO': return state.hunter.cargo.status === 'FIGHTING' ? 'HUNTER_CARGO' : null;
    case 'PROVOKER_DISPUTE': return state.provoker.encounter.status === 'FIGHTING' ? 'PROVOKER_DISPUTE' : null;
    case 'PYROMANIAC_DISPUTE': return state.pyromaniac.encounter.status === 'FIGHTING' ? 'PYROMANIAC_DISPUTE' : null;
    case 'REAPER_DISPUTE': return hasReaperDisputeOpponent(state) ? 'REAPER_DISPUTE' : null;
    case 'CONSPIRATOR_DISPUTE':
      return state.progression.sequence === 6 && state.conspirator.encounter.status === 'FIGHTING' &&
        state.conspirator.encounter.attemptWeek === state.week &&
        state.conspirator.encounter.startHistoryIndex !== null ? 'CONSPIRATOR_DISPUTE' : null;
    default: return null;
  }
}

export interface PyromaniacDangerSource {
  encounterId: AuthoredEncounter; round: number; action: 'VISIBLE_CLUB_MOVEMENT';
}
export function currentPyromaniacDangerSource(state: SliceState): PyromaniacDangerSource | null {
  const encounterId = currentEncounter(state);
  return encounterId === null ? null : { encounterId, round: state.combat!.round, action: 'VISIBLE_CLUB_MOVEMENT' };
}

export type PyromaniacFireSource = {
  round: number; attemptWeek: number; startHistoryIndex: number;
} & ({
  encounterId: 'PYROMANIAC_DISPUTE';
  space: 'OPEN_BRICK_COURTYARD'; lane: 'OWNER_CLEARED_CLOTH_CRATES';
  distanceMetres: 6; target: 'HAARN_SINGLE_ADULT';
} | {
  encounterId: 'CONSPIRATOR_DISPUTE';
  space: 'OPEN_PASSAGE'; lane: 'EXISTING_EMPTY_PASSAGE';
  distanceMetres: 2; target: 'OREN_SINGLE_ADULT';
} | {
  encounterId: 'REAPER_DISPUTE';
  space: 'OPEN_STONE_COURTYARD'; lane: 'EXISTING_EMPTY_STONE_LANE';
  distanceMetres: 2; target: 'RE5-VICK';
});

/** Main owns each finite scene, including whether its original lane is clear. */
export function currentPyromaniacFireSource(state: SliceState): PyromaniacFireSource | null {
  const encounterId = currentEncounter(state);
  if (encounterId === 'REAPER_DISPUTE') {
    const encounter = state.reaper.encounter;
    return { encounterId, round: state.combat!.round, attemptWeek: encounter.attemptWeek!,
      startHistoryIndex: encounter.startHistoryIndex!, space: 'OPEN_STONE_COURTYARD',
      lane: 'EXISTING_EMPTY_STONE_LANE', distanceMetres: 2, target: 'RE5-VICK' };
  }
  if (encounterId === 'CONSPIRATOR_DISPUTE') {
    const encounter = state.conspirator.encounter;
    // This original passage is already empty; no borrowed crates, lamp or old
    // carrier fact creates it. The current approach/fight owns this source.
    return { encounterId, round: state.combat!.round,
      attemptWeek: encounter.attemptWeek!, startHistoryIndex: encounter.startHistoryIndex!,
      space: 'OPEN_PASSAGE', lane: 'EXISTING_EMPTY_PASSAGE', distanceMetres: 2, target: 'OREN_SINGLE_ADULT' };
  }
  if (encounterId !== 'PYROMANIAC_DISPUTE' ||
      !state.pyromaniac.encounter.surveyed || !state.pyromaniac.encounter.safeLane ||
      state.pyromaniac.encounter.attemptWeek !== state.week ||
      state.pyromaniac.encounter.startHistoryIndex === null) return null;
  return { encounterId: 'PYROMANIAC_DISPUTE', round: state.combat!.round,
    attemptWeek: state.pyromaniac.encounter.attemptWeek, startHistoryIndex: state.pyromaniac.encounter.startHistoryIndex,
    space: 'OPEN_BRICK_COURTYARD', lane: 'OWNER_CLEARED_CLOTH_CRATES',
    distanceMetres: 6, target: 'HAARN_SINGLE_ADULT' };
}
function validFireSource(state: SliceState, source: PyromaniacFireSource | null): boolean {
  const current = currentPyromaniacFireSource(state);
  return current !== null && source !== null && source.encounterId === current.encounterId &&
    source.round === current.round && source.attemptWeek === current.attemptWeek &&
    source.startHistoryIndex === current.startHistoryIndex && source.space === current.space && source.lane === current.lane &&
    source.distanceMetres === current.distanceMetres && source.target === current.target;
}
function ordinaryStrike(state: SliceState, physicalStateFactor: number, prefix = ''): PyromaniacCombatEffect {
  const armed = state.town.clubLocation === 'HAND';
  return { label: `${prefix}${armed ? '持握原短棍打击' : '普通打击'}`,
    selfGain: (armed ? 16 : 12) * physicalStateFactor, enemyReduction: 0, threatens: true, angersEnemy: false };
}
function ordinaryBlock(prefix = ''): PyromaniacCombatEffect {
  return { label: `${prefix}格挡护身`, selfGain: 0, enemyReduction: 10, threatens: false, angersEnemy: false };
}

/** One selected action yields one effect; fire never skips the ordinary injury wheel. */
export function resolvePyromaniacCombatAbility(
  state: SliceState, id: PyromaniacMoveId, physicalStateFactor: number, random: ActionRandomStream,
  fire: PyromaniacFireSource | null = currentPyromaniacFireSource(state),
  danger: PyromaniacDangerSource | null = currentPyromaniacDangerSource(state),
): PyromaniacCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('纵火家能力：当前没有可结算的对应战斗行动');
  switch (id) {
    case 'STRIKE': return ordinaryStrike(state, physicalStateFactor);
    case 'BLOCK': return ordinaryBlock();
    case 'hunter.s9.hunting-instinct': {
      const current = currentPyromaniacDangerSource(state);
      const valid = current && danger && danger.encounterId === current.encounterId &&
        danger.round === current.round && danger.action === current.action;
      return valid
        ? { label: '猎杀直觉：从当前对手可见的短棍动作判断迫近威胁，不保证准确',
          selfGain: 0, enemyReduction: 15, threatens: false, angersEnemy: false }
        : noEffect('猎杀直觉：没有仍然有效的同场威胁来源，本次未形成优势');
    }
    case 'hunter.s8.provocation': {
      const known = state.provoker.cases['queue-boast']?.status;
      if (currentEncounter(state) !== 'PROVOKER_DISPUTE' || (known !== 'OBSERVED' && known !== 'COMPLETED')) {
        return noEffect('针对性挑衅：缺少当前抵抗目标的已知言行，不套用威斯的旧事或凭空猜测弱点');
      }
      if (!(state.spirituality >= 1)) return noEffect('针对性挑衅：灵性不足1，本次没有效果，不重抽');
      state.spirituality -= 1;
      const result = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
        difficulty: 12, modifiers: [], roll: random.nextInt(1, 100) });
      state.lastCheck = result;
      const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      const tier = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' }[result.tier];
      const prefix = `针对性挑衅：以威斯自称“我只认先来后到”反问他；耗灵性1，意志${result.roll}/${result.chance}，${tier}`;
      return { label: success ? `${prefix}，优势+10；本轮后续攻击权重×1.25，仍自主抽取`
        : `${prefix}，未激起有效怒意，优势不变`, selfGain: success ? 10 : 0,
      enemyReduction: 0, threatens: false, angersEnemy: success };
    }
    case 'hunter.s7.flame-control':
    case 'hunter.s7.compressed-fireball':
    case 'hunter.s7.flame-lance':
    case 'hunter.s7.fire-raven': {
      const control = id === 'hunter.s7.flame-control';
      const cost = control || id === 'hunter.s7.fire-raven' ? 2 : 3;
      const name = ABILITIES.find(ability => ability.id === id)!.label;
      const fallback = (reason: string) => control
        ? ordinaryBlock(`${name}：${reason}，未施法、未耗灵性，不重抽，本次改用`)
        : ordinaryStrike(state, physicalStateFactor, `${name}：${reason}，未施法、未耗灵性，不重抽，本次改用`);
      if (!validFireSource(state, fire)) return fallback(state.combat?.encounterId === 'CONSPIRATOR_DISPUTE' || state.combat?.encounterId === 'REAPER_DISPUTE'
        ? '缺少当前有效的原2米净空施火通路' : '缺少当前已清空布箱的安全施火通路');
      if (!(state.spirituality >= cost)) return fallback(`灵性不足${cost}`);
      state.spirituality -= cost;
      const conspiratorScene = fire!.encounterId === 'CONSPIRATOR_DISPUTE';
      const reaperScene = fire!.encounterId === 'REAPER_DISPUTE';
      const target = reaperScene ? '维克' : conspiratorScene ? '奥伦' : '哈恩';
      const lane = reaperScene ? '原石院2米净空通道' : conspiratorScene ? '既有空通道' : '已清空通路';
      if (control) return { label: `火焰制造与操控：耗灵性2，制造自身火焰并在${reaperScene
        ? '原石院2米净空通道' : conspiratorScene ? '既有2米空通道' : '已清空的砖院通路'}内牵制${target}，敌方优势−18（G）；不保证免伤`,
        selfGain: 0, enemyReduction: 18, threatens: false, angersEnemy: false };
      const detail = id === 'hunter.s7.compressed-fireball'
        ? `压缩自身火焰形成火球，在${lane}内曲线投射并于${target}所在处爆发`
        : id === 'hunter.s7.flame-lance' ? `凝聚自身火焰为长枪，沿${lane}投向${target}`
        : `在本次行动内维持一只自身火焰构成的火鸦，沿${lane}袭向${target}；此后消散，不产生独立或跨轮行动`;
      const selfGain = id === 'hunter.s7.compressed-fireball' ? 36 : id === 'hunter.s7.flame-lance' ? 32 : 24;
      return { label: `${name}：耗灵性${cost}，${detail}，优势+${selfGain}（G）。仅处理同场${fire!.distanceMetres}米内一个成人目标，仍按胜负与伤势盘结算，不穿墙、不追加范围伤害`,
        selfGain, enemyReduction: 0, threatens: true, angersEnemy: false };
    }
    default:
      // Exact inherited S8 physical/ordinary behavior, without invoking its
      // sequence-specific known-opponent check for a different person.
      return resolveProvokerCombatAbility(state, id, physicalStateFactor, random);
  }
}
