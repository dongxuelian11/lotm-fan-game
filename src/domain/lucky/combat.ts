import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import {
  MACHINE_COUNT_WHEEL, drawMachineAbility, machineAbilityWheel, machineActionCount,
  type MachineCombatEffect, type MachineCombatSource, type MachineMoveId,
} from '../machine/combat.js';
import type { SliceStance, SliceState } from '../slice/types.js';

/** S7 inherits the exact S8 action profile; passive luck never becomes a seventh slot. */
export const LUCKY_COUNT_WHEEL = MACHINE_COUNT_WHEEL;
export const luckyAbilityWheel = machineAbilityWheel;
export const drawLuckyAbility = drawMachineAbility;
export const luckyActionCount = machineActionCount;
export type LuckyMoveId = MachineMoveId;
export type LuckyCombatEffect = MachineCombatEffect;
export type LuckyCombatSource = MachineCombatSource;
export interface LuckyPassiveLuck { roll: number; triggered: boolean; bonus: number }

export function isLucky(state: SliceState): boolean {
  return state.progression?.pathwayId === 'wheel' && state.progression.sequence === 7;
}
function noEffect(label: string): LuckyCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only the present, still resisting ordinary FIRST_CASE carrier is a source. */
export function currentLuckyCombatSource(state: SliceState): LuckyCombatSource | null {
  if (!isLucky(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      !Number.isSafeInteger(state.combat.round) || state.combat.round < 1 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: LuckyCombatSource | null): boolean {
  const current = currentLuckyCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}

/**
 * G: one independent d100 before both action-count draws. The round coordinator
 * calls this once, never for retreat. No state mutation, resources, debt, stored
 * luck, injury permission, future RNG inspection or player-selected activation.
 */
export function drawLuckyPassiveLuck(
  state: SliceState, stance: SliceStance, physicalStateFactor: number, random: ActionRandomStream,
  source: LuckyCombatSource | null = currentLuckyCombatSource(state),
): LuckyPassiveLuck | null {
  if (stance === 'RETREAT' || !validCombatSource(state, source)) return null;
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const roll = random.nextInt(1, 100), triggered = roll <= 25;
  return { roll, triggered, bonus: triggered ? 45 * masteryFactor(state, 'wheel.s7.passive-luck') * physical : 0 };
}

export function luckyPassiveLuckConsequence(luck: LuckyPassiveLuck): string {
  return luck.triggered
    ? `被动幸运（G）抽取${luck.roll}/100，落在1—25并触发；仅本轮增加${Number(luck.bonus.toFixed(3))}战势，不增加行动、不保证胜利，也不抵消真实伤势或死亡。`
    : `被动幸运（G）抽取${luck.roll}/100，超过25未触发，本轮幸运贡献0；不储存好运，也不追加必然厄运。`;
}

function masteryFactor(state: SliceState,
  id: 'wheel.s8.calculation-control' | 'wheel.s9.danger-intuition' | 'wheel.s7.passive-luck',
): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One existing slot; only an actual physical attack can enter the shared injury draw. */
export function resolveLuckyCombatAbility(
  state: SliceState, id: LuckyMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: LuckyCombatSource | null = currentLuckyCombatSource(state),
): LuckyCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('幸运者继承行动：缺少本场仍可触及的可见普通对手与真实现场，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'wheel.s8.calculation-control': {
      // Only the original club actually in HAND replaces H; talent never equips or duplicates it.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 27 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献，不叠加计算、身体或武器天赋预算，不保证命中'
        : '计算与精确身体打击：以眼前距离和真实身体控制完成本次攻击（G），不是金属身体，不保证命中；伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 18.9 * masteryFactor(state, 'wheel.s8.calculation-control') * physical;
      return { label: '精确身体侧击：采用同一计算与控制掌握度（G），独立占用本次行动，不追加攻击、不凭空制造或取得武器',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'wheel.s9.danger-intuition':
      return { ...noEffect('危险直觉与眼前避让：继承原危险直觉，只减少当前真实可见普通对手的压力，不预知下一次随机结果、不取消敌方行动'),
        enemyReduction: 24.3 * masteryFactor(state, id) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只沿眼前通道调整距离（G），不叠加计算掌握，不强制取消对手行动'),
        enemyReduction: 6 * physical };
    case 'wheel.s8.divination-guard':
      return noEffect('占卜与反占卜：本场普通对手没有正在使用的有来源占卜效果，本次贡献0、消耗0；不生成预知、不宣称占卜免疫，不读取未来随机结果、不重掷或回退');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}7.5（G），不构成致伤攻击，不是幸运操纵或重掷`), selfGain };
    }
  }
}
