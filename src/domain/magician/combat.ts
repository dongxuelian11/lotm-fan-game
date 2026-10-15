import { hasBizarroRitualOpponent } from '../bizarro-sorcerer/ritual.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import {
  currentClownDangerSource, resolveClownCombatAbility, type ClownMoveId,
} from '../clown/combat.js';
import { resolveSeerCombatAbility } from '../seer/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { MagicianAbilityId } from './types.js';

/** This stage's finite encounter balance is game-original (G), not quantitative canon. */
export const MAGICIAN_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
  Object.freeze({ id: '6', label: '6次', weight: 10 }),
]);

export type MagicianMoveId = ClownMoveId | MagicianAbilityId | 'STRIKE' | 'BLOCK'
  | 'diviner.s9.spiritual-intuition';
interface MagicianAbility {
  id: MagicianMoveId; label: string; weight: number; stance: SliceStance | null;
}

// Event divination/knowledge stay outside the immediate-action wheel. Water and
// restraints are not invented for this duel; the figurine is a consequence hook.
const MAGICIAN_ABILITIES: readonly MagicianAbility[] = [
  { id: 'STRIKE', label: '普通打击', weight: 8, stance: 'ATTACK' },
  { id: 'BLOCK', label: '格挡护身', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s8.body-control', label: '体术/身体控制', weight: 12, stance: 'ATTACK' },
  { id: 'diviner.s8.balance', label: '平衡闪避', weight: 7, stance: 'DEFEND' },
  { id: 'diviner.s8.agility', label: '敏捷调位', weight: 6, stance: 'PREPARE' },
  { id: 'diviner.s8.danger-prediction', label: '危险预感', weight: 6, stance: 'CONTROL' },
  { id: 'diviner.s8.paper-dagger', label: '纸飞刀', weight: 5, stance: 'ATTACK' },
  { id: 'diviner.s9.spiritual-sight', label: '灵视', weight: 3, stance: 'CONTROL' },
  { id: 'diviner.s9.spiritual-intuition', label: '灵性直觉', weight: 2, stance: 'CONTROL' },
  { id: 'diviner.s7.air-bullet', label: '空气弹', weight: 12, stance: 'ATTACK' },
  { id: 'diviner.s7.flame-control', label: '火焰操纵', weight: 7, stance: 'ATTACK' },
  { id: 'diviner.s7.flame-jump', label: '火焰跳跃', weight: 7, stance: 'DEFEND' },
  { id: 'diviner.s7.illusion', label: '幻术', weight: 8, stance: 'CONTROL' },
  { id: 'diviner.s7.paper-weapon', label: '纸张武器', weight: 5, stance: 'ATTACK' },
  { id: 'OBSERVE', label: '观察', weight: 2, stance: 'PREPARE' },
  { id: 'MISS', label: '失误', weight: 2, stance: null },
];
const DAMAGE_TRANSFER: MagicianAbility = {
  id: 'diviner.s7.damage-transfer', label: '伤害转移', weight: 8, stance: 'DEFEND',
};

export function isMagician(state: SliceState): boolean {
  return state.progression?.pathwayId === 'diviner' &&
    (state.progression.sequence === 7 || state.progression.sequence === 6 || state.progression.sequence === 5 || state.progression.sequence === 4);
}

function transferableInjury(state: SliceState): SliceInjury | undefined {
  return state.injuries.find(injury => injury.severity === 'HEAVY' &&
    !state.magician.damageTransfers.includes(injury.id));
}

function abilities(state: SliceState): readonly MagicianAbility[] {
  return transferableInjury(state) ? [...MAGICIAN_ABILITIES, DAMAGE_TRANSFER] : MAGICIAN_ABILITIES;
}

function tickets(entries: readonly MagicianAbility[], stance: SliceStance | null): number[] {
  return entries.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}

export function magicianAbilityWheel(state: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const entries = abilities(state), weights = tickets(entries, stance);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return entries.map((ability, index) => ({
    id: ability.id, label: ability.label, weight: weights[index]! / total * 100,
  }));
}

export function drawMagicianAbility(
  random: ActionRandomStream, state: SliceState, stance: SliceStance | null,
): MagicianMoveId {
  const entries = abilities(state), weights = tickets(entries, stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return entries[index]!.id;
  }
  throw new Error('魔术师能力盘权重无效');
}

export function magicianActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 75 ? 4 : roll <= 90 ? 5 : 6;
}

export interface MagicianCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): MagicianCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasLiveCombat(state: SliceState): boolean {
  return state.status === 'ACTIVE' && state.health > 0 && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}

export interface MagicianFireSource {
  encounterId: 'FIRST_CASE' | 'CLOWN_RESCUE' | 'MAGICIAN_DISPUTE' | 'FACELESS_DISPUTE' | 'MARIONETTIST_DISPUTE' | 'BIZARRO_RITUAL';
  round: number;
  source: 'CARRIED_LANTERN';
  distanceMetres: 2;
}

/** The authored carried lamp has already consumed actual oil before this duel. */
export function currentMagicianFireSource(state: SliceState): MagicianFireSource | null {
  const combat = state.combat;
  if (!isMagician(state) || !hasLiveCombat(state) || state.world.city !== 'BACKLUND' || !combat ||
      !state.magician.lantern.prepared || state.magician.lantern.oilSpent < 1) return null;
  if (combat.encounterId === 'BIZARRO_RITUAL') {
    if (!hasBizarroRitualOpponent(state)) return null;
  } else if (combat.encounterId === 'FIRST_CASE') {
    if (state.arc.stage !== 'COMBAT' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  } else if (combat.encounterId !== 'CLOWN_RESCUE' && combat.encounterId !== 'MAGICIAN_DISPUTE' && combat.encounterId !== 'FACELESS_DISPUTE' && combat.encounterId !== 'MARIONETTIST_DISPUTE') return null;
  return { encounterId: combat.encounterId, round: combat.round, source: 'CARRIED_LANTERN', distanceMetres: 2 };
}

function validFireSource(state: SliceState, source: MagicianFireSource | null): boolean {
  const current = currentMagicianFireSource(state);
  return current !== null && source !== null && source.encounterId === current.encounterId &&
    source.round === current.round && source.source === current.source && source.distanceMetres === 2;
}

function ordinaryStrike(state: SliceState, physicalStateFactor: number, prefix = ''): MagicianCombatEffect {
  const armed = state.town.clubLocation === 'HAND';
  return { label: `${prefix}${armed ? '持握原短棍打击' : '普通打击'}`,
    selfGain: (armed ? 16 : 12) * physicalStateFactor, enemyReduction: 0, threatens: true };
}
function ordinaryBlock(prefix = ''): MagicianCombatEffect {
  return { label: `${prefix}格挡护身`, selfGain: 0, enemyReduction: 10, threatens: false };
}

/** One selected action produces one effect. No spell creates a redraw or extra attack. */
export function resolveMagicianCombatAbility(
  state: SliceState, id: MagicianMoveId, physicalStateFactor: number,
  fire: MagicianFireSource | null = currentMagicianFireSource(state),
): MagicianCombatEffect {
  if (!isMagician(state) || !hasLiveCombat(state)) return noEffect('魔术师能力：当前没有可结算的对应战斗行动');
  // Faceless inherits this finite profile and its real sources. B2 ch239 gives
  // qualitative increases; these exact advantage values remain game balance (G).
  // Appearance changes add no action, memory reset, surrender or escape here.
  const faceless = state.progression.sequence === 6 || state.progression.sequence === 5 || state.progression.sequence === 4;
  switch (id) {
    case 'STRIKE': return ordinaryStrike(state, physicalStateFactor);
    case 'BLOCK': return ordinaryBlock();
    case 'diviner.s7.damage-transfer': {
      const injury = transferableInjury(state);
      if (!injury) return noEffect('伤害转移：没有自身尚未转移过的重伤，本次未施法、未消耗灵性');
      if (state.spirituality < 3) return noEffect('伤害转移：灵性不足3，本次未施法，不重抽');
      state.spirituality -= 3;
      injury.severity = 'LIGHT';
      state.magician.damageTransfers.push(injury.id);
      return noEffect(`伤害转移：耗灵性3，将自身原伤势${injury.id}在自己体内转移一次，重伤降为轻伤（G）；健康不恢复，伤势记录及累计风险保留，不转给对手`);
    }
    case 'diviner.s7.air-bullet': {
      if (state.spirituality < 2) return ordinaryStrike(state, physicalStateFactor, '空气弹：灵性不足2，不重抽，本次改用');
      state.spirituality -= 2;
      const selfGain = faceless ? 60 : 30;
      return { label: `空气弹：耗灵性2射出空气弹，优势+${selfGain}（G），仍须结算胜负与伤势`, selfGain, enemyReduction: 0, threatens: true };
    }
    case 'diviner.s7.flame-control': {
      if (!validFireSource(state, fire)) return noEffect('火焰操纵：当前没有同场可用的真实火源，未施法、未消耗灵性');
      if (state.spirituality < 2) return ordinaryStrike(state, physicalStateFactor, '火焰操纵：灵性不足2，不重抽，本次改用');
      state.spirituality -= 2;
      const selfGain = faceless ? 31.2 : 24;
      return { label: `火焰操纵：耗灵性2，牵动同场2米内已点燃油灯的实际火焰，优势+${selfGain}（G）；没有凭空产生火焰流`, selfGain, enemyReduction: 0, threatens: true };
    }
    case 'diviner.s7.flame-jump': {
      if (!validFireSource(state, fire)) return noEffect(faceless
        ? '火焰跳跃：当前没有同场2米内的原油灯火焰落点，未施法、未消耗灵性'
        : '火焰跳跃：当前没有同场30米内可用的真实火焰落点，未施法、未消耗灵性');
      if (state.spirituality < 3) return ordinaryBlock('火焰跳跃：灵性不足3，不重抽，本次改用');
      state.spirituality -= 3;
      const enemyReduction = faceless ? 31.2 : 24;
      return { label: `火焰跳跃：耗灵性3，借同场2米内的真实灯火局部避让，敌方优势−${enemyReduction}（G）；仍在战斗中，不穿过封闭墙壁，也不保证免伤`, selfGain: 0, enemyReduction, threatens: false };
    }
    case 'diviner.s7.illusion':
      if (state.spirituality < 2) return ordinaryBlock('幻术：灵性不足2，不重抽，本次改用');
      state.spirituality -= 2;
      return { label: '幻术：耗灵性2，以感官幻象干扰眼前对手，敌方优势−16（G）；不控制心智或改写记忆', selfGain: 0, enemyReduction: 16, threatens: false };
    case 'diviner.s7.paper-weapon': {
      if (state.clown.paperSheets < 1 || state.spirituality < 1) {
        const reason = state.clown.paperSheets < 1 && state.spirituality < 1 ? '原纸与灵性不足'
          : state.clown.paperSheets < 1 ? '原纸不足' : '灵性不足1';
        return ordinaryStrike(state, physicalStateFactor, `纸张武器：${reason}，不重抽，本次改用`);
      }
      state.clown.paperSheets -= 1;
      state.clown.paperSpent += 1;
      state.spirituality -= 1;
      return { label: '纸张武器：耗原纸1、灵性1，暂时化纸为武器发起本次攻击，优势+22×身体状态（G）；用后纸张不回库存', selfGain: 22 * physicalStateFactor, enemyReduction: 0, threatens: true };
    }
    case 'diviner.s7.paper-figurine':
      return noEffect('纸人替身：只在尚未提交的真实物理后果到来时检查预制纸人，不占主动扇区');
    case 'diviner.s7.underwater-breathing':
      return noEffect('水下呼吸：当前战斗没有水下情境，本次未施法');
    case 'diviner.s7.bone-softening':
      return noEffect('骨骼软化：当前战斗没有绳索束缚或已声明的狭窄通路，本次未施法');
    case 'diviner.s9.spiritual-intuition':
      return resolveSeerCombatAbility(state, id, physicalStateFactor);
    default:
      return resolveClownCombatAbility(state, id, physicalStateFactor, currentClownDangerSource(state));
  }
}

/** Called only after an effective physical threat rolls its pending consequence. */
export function resolveMagicianFigurineReplacement(
  state: SliceState, pendingSeverity: 'LIGHT' | 'HEAVY' | 'DEATH',
): { label: string } | null {
  if (!isMagician(state) || !hasLiveCombat(state) || state.magician.figurinesHeld < 1 ||
      state.magician.figurinesMade <= state.magician.figurinesUsed || state.spirituality < 5) return null;
  state.magician.figurinesHeld -= 1;
  state.magician.figurinesUsed += 1;
  state.spirituality -= 5;
  const severity = pendingSeverity === 'DEATH' ? '死亡' : pendingSeverity === 'HEAVY' ? '重伤' : '轻伤';
  return { label: `原后果盘抽中${severity}。纸人替身在本次物理后果提交前替代，耗预制纸人1、灵性5（G），本次后果未落到本体；不是死后复活，原有伤势、健康与累计风险不被清除` };
}
