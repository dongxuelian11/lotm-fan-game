import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Serial Killer S7: U45, A0.8/E1. All budgets, weights and costs are G.
 * The source establishes demonic knowledge and ritual knowledge, not a named
 * combat spell. FIRST_CASE has no authored ritual source. The inherited body
 * and present alertness are the only extraordinary contributions here.
 * Conscience loss is permanent character history, never armor, immunity,
 * foresight, mind control, an extra action or a refund of an earlier cost.
 */
export const SERIAL_KILLER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

type SerialKillerMasteryId = 'abyss.s8.inhuman-body' | 'abyss.s9.alertness' | 'abyss.s7.demonic-lore';
export type SerialKillerMoveId = SerialKillerMasteryId | 'BODY_FOLLOWUP' | 'POSITION' | 'ACCIDENT';
const ABILITIES: readonly {
  id: SerialKillerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'abyss.s8.inhuman-body', label: '继承非人体魄打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承身体侧击', weight: 20, stance: 'ATTACK' },
  { id: 'abyss.s9.alertness', label: '敏锐直觉与眼前避让', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'abyss.s7.demonic-lore', label: '核实恶魔知识与仪式来源', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isSerialKiller(state: SliceState): boolean {
  return state.progression?.pathwayId === 'abyss' && state.progression.sequence === 7;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function serialKillerAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'abyss.s8.inhuman-body' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawSerialKillerAbility(random: ActionRandomStream, stance: SliceStance | null): SerialKillerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('连环杀手能力盘权重无效');
}
export function serialKillerActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

export interface SerialKillerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): SerialKillerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Present ordinary opponent and original passage only; this is not a ritual source. */
export interface SerialKillerCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; body: 'CURRENT_REACHABLE_BODY';
  space: 'DRY_GROUND_PASSAGE'; exit: 'ORDINARY_OPEN_EXIT';
}
export function currentSerialKillerCombatSource(state: SliceState): SerialKillerCombatSource | null {
  if (!isSerialKiller(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: SerialKillerCombatSource | null): boolean {
  const current = currentSerialKillerCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: SerialKillerMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One current slot at 0S; no S6 demon body, spells, immunity or S5 desire control. */
export function resolveSerialKillerCombatAbility(
  state: SliceState, id: SerialKillerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: SerialKillerCombatSource | null = currentSerialKillerCombatSource(state),
): SerialKillerCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('连环杀手行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'abyss.s8.inhuman-body': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 36 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用这根普通短棍的16贡献，替换体魄预算，不叠加掌握或仪式加成'
        : '继承非人体魄打击：以实际身体近身应对，36f贡献为G，不生成武器、恶魔形态或法术，不消耗灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 25.2 * masteryFactor(state, 'abyss.s8.inhuman-body') * physical;
      return { label: '继承身体侧击：25.2f贡献为G，沿用非人体魄掌握度，独立占用本次行动，不追加攻击或仪式效果',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'abyss.s9.alertness':
      return { ...noEffect('敏锐直觉与眼前避让：只应对当前可见普通对手，27f贡献为G，受身体状态影响，不预知未来危险或下一次抽取'),
        enemyReduction: 27 * masteryFactor(state, id) * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：利用眼前通道调整距离，6贡献受身体状态影响，不强制控制或取消对手行动'),
        enemyReduction: 6 * physical };
    case 'abyss.s7.demonic-lore':
      // Knowledge and practice do not author a usable ritual in this encounter.
      // No caller flag, copied record, mastery or prior practice can grant one.
      return noEffect('核实恶魔知识与仪式来源：首案现场没有已登记的可用仪式来源、器具与对象；知识与异地实践不能补成战斗法术，本次贡献0、消耗0，不额外抽盘、召唤投影、施加诅咒或恢复精神');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成致伤攻击或仪式效果`), selfGain };
    }
  }
}
