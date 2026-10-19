import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Approved Witch S7 profile: U45, A1/E1.2. Contributions and local costs are G. */
export const WITCH_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);

type WitchMasteryId = 'assassin.s7.black-flame' | 'assassin.s9.burst'
  | 'assassin.s7.substitute' | 'assassin.s7.invisibility' | 'assassin.s7.frost'
  | 'assassin.s7.divination-interference';
export type WitchMoveId = Exclude<WitchMasteryId, 'assassin.s7.invisibility'> | 'ACCIDENT';
const ABILITIES: readonly {
  id: WitchMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'assassin.s7.black-flame', label: '近距离黑焰（2灵性）', weight: 30, stance: 'ATTACK' },
  { id: 'assassin.s9.burst', label: '继承蓄力爆发（1灵性）', weight: 15, stance: 'ATTACK' },
  { id: 'assassin.s7.substitute', label: '已备镜替／粉剂隐形／普通避让', weight: 25, stance: 'DEFEND' },
  { id: 'assassin.s7.frost', label: '有限冰霜牵制（2灵性）', weight: 15, stance: 'CONTROL' },
  { id: 'assassin.s7.divination-interference', label: '干扰占卜：本场没有占卜来源（0贡献；0灵性）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡（±11.25；0灵性；不判伤）', weight: 5, stance: null },
];

export function isWitch(state: SliceState): boolean {
  return state.progression?.pathwayId === 'demoness' && state.progression.sequence === 7;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
function canSpend(state: SliceState, cost: number): boolean {
  return Number.isFinite(state.spirituality) && state.spirituality >= cost;
}
function hasDose(held: number): boolean {
  return Number.isSafeInteger(held) && held > 0;
}
type Defence = 'MIRROR' | 'INVISIBILITY' | 'ORDINARY';
/** Read the same original inventory for preview and resolution, never a combat copy. */
function defence(state: SliceState): Defence {
  const tools = state.witch.tools;
  if (tools.mirrorPrepared === true && hasDose(tools.mirrorsHeld) && canSpend(state, 3)) return 'MIRROR';
  if (hasDose(tools.powderHeld) && canSpend(state, 2)) return 'INVISIBILITY';
  return 'ORDINARY';
}
function defenceLabel(state?: SliceState): string {
  if (!state) return '已备镜替（3灵性＋1面原镜）；否则粉剂隐形（2灵性＋1剂原粉）；不足则普通避让（0灵性）';
  switch (defence(state)) {
    case 'MIRROR': return '已备镜替（3灵性＋1面原镜；仅共同减势，镜碎后本次隐蔽结束）';
    case 'INVISIBILITY': return '镜替条件不足，改粉剂隐形（2灵性＋1剂原粉；仅共同减势）';
    case 'ORDINARY': return '镜替／粉剂隐形条件不足，改普通避让（0灵性；不耗镜片或粉剂）';
  }
}

export function witchAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'assassin.s7.substitute' ? defenceLabel(state)
      : ability.id === 'assassin.s7.black-flame' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（普通16替换黑焰预算；0灵性）'
      : ability.id === 'assassin.s7.black-flame' && state && !canSpend(state, 2)
      ? '黑焰灵性不足，改普通身体打击（0灵性）'
      : ability.id === 'assassin.s9.burst' && state && !canSpend(state, 1)
      ? '爆发灵性不足，改普通身体打击（0灵性）'
      : ability.id === 'assassin.s7.frost' && state && !canSpend(state, 2)
      ? '冰霜灵性不足，改普通走位牵制（0灵性）' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawWitchAbility(random: ActionRandomStream, stance: SliceStance | null): WitchMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('女巫能力盘权重无效');
}
export function witchActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

export interface WitchCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): WitchCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Only the actual present, living, resisting first-case opponent is authored.
 * The direct black flame needs this reachable opponent, not a fabricated blood
 * medium. No remote curse, practice subject or knowledge note grants a target.
 */
function hasCurrentOpponent(state: SliceState): boolean {
  const combat = state.combat;
  return isWitch(state) && state.status === 'ACTIVE' && Number.isFinite(state.health) && state.health > 0 &&
    state.arc.stage === 'COMBAT' && state.world.city === 'BACKLUND' &&
    combat?.encounterId === 'FIRST_CASE' && combat.enemyStatus === 'RESISTING' &&
    Number.isFinite(combat.enemyHealth) && combat.enemyHealth > 0 &&
    Number.isSafeInteger(combat.round) && combat.round > 0 &&
    state.world.carrierAlive && state.world.carrierCanResist;
}
function masteryFactor(state: SliceState, id: WitchMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One drawn slot, with no extra turn, HP undo or replacement of the consequence draw. */
export function resolveWitchCombatAbility(
  state: SliceState, id: WitchMoveId, physicalStateFactor: number, random: ActionRandomStream,
): WitchCombatEffect {
  if (!hasCurrentOpponent(state)) {
    return noEffect('女巫行动：缺少本场仍在抵抗的真实近距离对手，本次贡献0、0灵性，不生成目标或媒介');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'assassin.s7.black-flame': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：普通16×当前身体系数替换本次黑焰贡献，不叠加黑焰；0灵性',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (!canSpend(state, 2)) {
        const selfGain = 12 * physical;
        return { label: '黑焰所需2灵性不足：改为普通身体打击12×当前身体系数；0灵性，不透支',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      state.spirituality -= 2;
      const selfGain = 45 * masteryFactor(state, id);
      return { label: '近距离黑焰：消耗2灵性，直接迎击眼前仍抵抗的携铃者；45×黑焰掌握系数，仍走共同伤势盘；不是远程诅咒，没有生成血液媒介',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'assassin.s9.burst': {
      if (!canSpend(state, 1)) {
        const selfGain = 12 * physical;
        return { label: '爆发所需1灵性不足：改为普通身体打击12×当前身体系数；0灵性，不透支',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      state.spirituality -= 1;
      const selfGain = 31.5 * masteryFactor(state, id) * physical;
      return { label: '继承蓄力爆发：消耗1灵性，以原身体力量完成近击；31.5×爆发掌握系数×当前身体系数，不叠加短棍贡献，不是必杀',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'assassin.s7.substitute': {
      const tools = state.witch.tools;
      switch (defence(state)) {
        case 'MIRROR':
          state.spirituality -= 3;
          tools.mirrorsHeld -= 1;
          tools.mirrorsUsed += 1;
          tools.mirrorPrepared = false;
          return { ...noEffect('已备镜替：消耗3灵性与1面实际已备原镜；镜片破碎，本次隐蔽结束，54×替身掌握系数仅计共同减势；不取消敌方行动、不撤销伤势或死亡，不是绝对免疫'),
            enemyReduction: 54 * masteryFactor(state, id) };
        case 'INVISIBILITY':
          state.spirituality -= 2;
          tools.powderHeld -= 1;
          tools.powderUsed += 1;
          return { ...noEffect('镜替条件不足：消耗2灵性与1剂实际原粉，改为有限隐形27×隐形掌握系数；只计本次共同减势，不免疫所有视觉或攻击，不取消敌方行动'),
            enemyReduction: 27 * masteryFactor(state, 'assassin.s7.invisibility') };
        case 'ORDINARY':
          return { ...noEffect('镜替／粉剂隐形条件不足：普通避让10×当前身体系数；0灵性，不消耗镜片或粉剂，不生成替身'),
            enemyReduction: 10 * physical };
      }
    }
    case 'assassin.s7.frost': {
      if (!canSpend(state, 2)) {
        return { ...noEffect('冰霜所需2灵性不足：改为普通走位牵制6×当前身体系数；0灵性，不透支'),
          enemyReduction: 6 * physical };
      }
      state.spirituality -= 2;
      return { ...noEffect('有限冰霜牵制：消耗2灵性，37.8×冰霜掌握系数仅计共同减势；不跳过敌方行动，不瞬间冻杀或施加绝对控制'),
        enemyReduction: 37.8 * masteryFactor(state, id) };
    }
    case 'assassin.s7.divination-interference':
      return noEffect('干扰占卜：原首案对手没有已发生的占卜行动或可干扰来源，本次没有合法干扰目标；0贡献、0灵性，不伪造反占卜或预知未来');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`时机或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G）；0灵性，不构成致伤攻击`), selfGain };
    }
  }
}
