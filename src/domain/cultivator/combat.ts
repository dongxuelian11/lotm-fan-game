import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { PrisonerCombatSource } from '../prisoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/**
 * Cultivator S9: the low-stage canon ability table is unverified. This complete
 * combat profile is explicit G: ordinary body, actual tools and current-ground
 * observation only. Practice mastery is not a claim of supernatural strength.
 * No plant attacks, roots, hybrids, weather control or instant food are supplied.
 */
export const CULTIVATOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
]);

type CultivatorMasteryId = 'mother.s9.careful-practice' | 'mother.s9.season-observation';
export type CultivatorMoveId = 'STRIKE' | 'BODY_FOLLOWUP' | 'mother.s9.season-observation'
  | 'POSITION' | 'mother.s9.cultivation-knowledge' | 'ACCIDENT';
const ABILITIES: readonly {
  id: CultivatorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通近身打击', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '审慎练习后的普通侧击', weight: 20, stance: 'ATTACK' },
  { id: 'mother.s9.season-observation', label: '当前干燥地面观察与护身', weight: 20, stance: 'DEFEND' },
  { id: 'POSITION', label: '普通走位牵制', weight: 10, stance: 'CONTROL' },
  { id: 'mother.s9.cultivation-knowledge', label: '核对耕作准备条件', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡', weight: 5, stance: null },
];

export function isCultivator(state: SliceState): boolean {
  return state.progression?.pathwayId === 'mother' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function cultivatorAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'STRIKE' && state?.town.clubLocation === 'HAND' ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawCultivatorAbility(random: ActionRandomStream, stance: SliceStance | null): CultivatorMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('耕种者能力盘权重无效');
}
export function cultivatorActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 85 ? 4 : 5;
}

export interface CultivatorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): CultivatorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only the authored visible ordinary carrier and present reachable dry passage. */
export type CultivatorCombatSource = PrisonerCombatSource;
export function currentCultivatorCombatSource(state: SliceState): CultivatorCombatSource | null {
  if (!isCultivator(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !state.combat || !Number.isFinite(state.combat.enemyHealth) || state.combat.enemyHealth <= 0 ||
      state.combat.enemyStatus !== 'RESISTING' || state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      !Number.isSafeInteger(state.combat.round) || state.combat.round < 1 ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validCombatSource(state: SliceState, source: CultivatorCombatSource | null): boolean {
  const current = currentCultivatorCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.body === current.body &&
    source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: CultivatorMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** Every slot revalidates its source. Only the actual ordinary H/J can threaten. */
export function resolveCultivatorCombatAbility(
  state: SliceState, id: CultivatorMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: CultivatorCombatSource | null = currentCultivatorCombatSource(state),
): CultivatorCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('耕种者行动：缺少本场仍可触及的可见普通对手与真实干燥地面，本次贡献0、消耗0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'STRIKE': {
      // Ownership is encoded by town custody: only the existing HAND club counts.
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 12) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用已经在手的普通短棍贡献（G），不叠加练习掌握或体能强化'
        : '普通近身打击：普通身体贡献（G），不宣称已核实超凡体魄；伤害仍由共同伤势盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 8.4 * masteryFactor(state, 'mother.s9.careful-practice') * physical;
      return { label: '审慎练习后的普通侧击：按练习掌握度折算普通身体贡献（G），独立占用本次行动，不追加攻击或超凡强化',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'mother.s9.season-observation':
      return { ...noEffect('当前干燥地面观察与护身：只观察眼前通道落脚处（G），不读取隐藏信息或未来天气，不控制天气、取消敌方行动或保证存活'),
        enemyReduction: 14 * masteryFactor(state, 'mother.s9.season-observation') * physical };
    case 'POSITION':
      return { ...noEffect('普通走位牵制：只沿眼前通道调整距离（G），不催生根系或植物，不取消对手行动'),
        enemyReduction: 6 * physical };
    case 'mother.s9.cultivation-knowledge':
      return noEffect('耕作准备：本场没有可即时投入战斗的种植来源。本次贡献0、消耗0，不抽随机盘；耕作需要真实工具、种子、土地与时间，不凭空生成植物攻击、根系、杂交、天气控制或即食粮食');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不构成致伤攻击，不生成植物、粮食或天气变化`), selfGain };
    }
  }
  return noEffect('耕种者行动：本槽没有已实现的合法战斗能力，本次贡献0、消耗0，不追加行动或随机盘');
}
