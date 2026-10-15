import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { currentRagerCombatSource, ragerWrathCharge, resolveRagerPhysicalAttack,
  type RagerRoundPolicy } from '../rager/combat.js';
import { currentSailorScalesSource, sameSailorCombatSource, type SailorCombatSource } from '../sailor/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
export { currentWindBlessedCombatSource, type WindBlessedCombatSource } from '../sailor/combat.js';

/** Confirmed Tyrant V2 S7 D-profile; all numeric contributions are game balance (G). */
export const NAVIGATOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 22 }),
  Object.freeze({ id: '2', label: '2次', weight: 28 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 17 }),
  Object.freeze({ id: '5', label: '5次', weight: 8 }),
]);
export type NavigatorMoveId = 'tyrant.s7.water-control' | 'NAVIGATOR_WAVE' | 'NAVIGATOR_WATER_GUARD'
  | 'tyrant.s7.water-binding' | 'tyrant.s7.navigation' | 'ACCIDENT'
  | 'tyrant.s6.wind-blade' | 'tyrant.s6.wind-control';
const ABILITIES: readonly {
  id: NavigatorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'tyrant.s7.water-control', label: '有限水压打击', weight: 32, stance: 'ATTACK' },
  { id: 'NAVIGATOR_WAVE', label: '有限浪击', weight: 18, stance: 'ATTACK' },
  { id: 'NAVIGATOR_WATER_GUARD', label: '水系防护与幻鳞', weight: 12, stance: 'DEFEND' },
  { id: 'tyrant.s7.water-binding', label: '水缚与水膜牵制', weight: 10, stance: 'CONTROL' },
  { id: 'tyrant.s7.navigation', label: '判断现场条件', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '水流偏差', weight: 20, stance: null },
];
// S7 defaults, order and integer-ticket boundaries stay byte-for-byte equivalent.
const WIND_BLESSED_ABILITIES: typeof ABILITIES = [
  ...ABILITIES.map(ability => ({ ...ability, weight: ability.id === 'tyrant.s7.water-control' ? 22
    : ability.id === 'NAVIGATOR_WAVE' ? 13 : ability.id === 'ACCIDENT' ? 15 : ability.weight })),
  { id: 'tyrant.s6.wind-blade', label: '有限风刃', weight: 12, stance: 'ATTACK' },
  { id: 'tyrant.s6.wind-control', label: '有限控风护身', weight: 8, stance: 'DEFEND' },
];
export function isWindBlessed(state: SliceState): boolean {
  return state.progression?.pathwayId === 'tyrant' && state.progression.sequence === 6;
}
export function hasNavigatorCombat(state: SliceState): boolean {
  return isNavigator(state) || isWindBlessed(state);
}
export function isNavigator(state: SliceState): boolean {
  return state.progression?.pathwayId === 'tyrant' && state.progression.sequence === 7;
}
function abilities(sequence: number): typeof ABILITIES { return sequence === 6 ? WIND_BLESSED_ABILITIES : ABILITIES; }
function tickets(stance: SliceStance | null, sequence: number): number[] {
  return abilities(sequence).map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function navigatorAbilityWheel(stance: SliceStance | null, sequence = 7): SliceWheelEntry[] {
  const weights = tickets(stance, sequence), total = weights.reduce((sum, weight) => sum + weight, 0);
  return abilities(sequence).map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawNavigatorAbility(random: ActionRandomStream, stance: SliceStance | null, sequence = 7): NavigatorMoveId {
  const entries = abilities(sequence), weights = tickets(stance, sequence);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return entries[index]!.id;
  }
  throw new Error('航海家能力盘权重无效');
}
export function navigatorActionCount(roll: number): number {
  return roll <= 22 ? 1 : roll <= 50 ? 2 : roll <= 75 ? 3 : roll <= 92 ? 4 : 5;
}
export interface NavigatorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): NavigatorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function hasLiveCombat(state: SliceState): boolean {
  return hasNavigatorCombat(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.combat !== null && state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}
/** Dry ground is not a ban on conjuring the small amount of water S7 can control. */
export type NavigatorCombatSource = SailorCombatSource & {
  needsBreath: true; canWrap: true; suffocationImmune: false; targetWill: 14;
};
export function currentNavigatorCombatSource(state: SliceState): NavigatorCombatSource | null {
  const ordinary = hasNavigatorCombat(state) ? currentSailorScalesSource(state) : null;
  return ordinary ? { ...ordinary, needsBreath: true, canWrap: true,
    suffocationImmune: false, targetWill: 14 } : null;
}
function validCombatSource(state: SliceState, source: NavigatorCombatSource | null): boolean {
  const current = currentNavigatorCombatSource(state);
  return current !== null && source !== null && sameSailorCombatSource(current, source) &&
    source.needsBreath === current.needsBreath && source.canWrap === current.canWrap &&
    source.suffocationImmune === current.suffocationImmune && source.targetWill === current.targetWill;
}
type MasteryId = 'tyrant.s7.water-control' | 'tyrant.s7.water-binding' | 'tyrant.s6.wind-blade' | 'tyrant.s6.wind-control';
function mastery(state: SliceState, id: MasteryId): number {
  const value = state.progression.mastery[id] ?? 0;
  return Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0));
}
function masteryFactor(state: SliceState, id: MasteryId): number {
  return 0.65 + 0.35 * mastery(state, id) / 500;
}
function waterState(state: SliceState) {
  return state.combat!.navigatorWater ??= { soakedRemaining: 0, bound: false, skipNext: false };
}

export interface NavigatorSuffocationTarget {
  needsBreath: boolean; canWrap: boolean; suffocationImmune: boolean; targetWill: number;
}
/** G: bounded will/mastery contest for this ordinary encounter, not automatic suffocation. */
export function resolveNavigatorSuffocationContest(
  random: ActionRandomStream, playerWill: number, bindingMastery: number, target: NavigatorSuffocationTarget,
): { chance: number; roll: number; targetResisted: boolean } | null {
  if (!target.needsBreath || !target.canWrap || target.suffocationImmune ||
      !Number.isFinite(playerWill) || !Number.isFinite(bindingMastery) || !Number.isFinite(target.targetWill)) return null;
  const boundedMastery = Math.max(0, Math.min(500, bindingMastery));
  const chance = Math.max(10, Math.min(90, 50 + 2 * (playerWill - target.targetWill) + 0.06 * boundedMastery));
  const roll = random.nextInt(1, 100);
  return { chance, roll, targetResisted: roll > chance };
}

/** One drawn action only. No ocean, weather creation, healing, or extra attack. */
export function resolveNavigatorCombatAbility(
  state: SliceState, id: NavigatorMoveId, physicalStateFactor: number, random: ActionRandomStream,
  roundPolicy: RagerRoundPolicy = { policy: 'HOLD', released: false },
  source: NavigatorCombatSource | null = currentNavigatorCombatSource(state),
): NavigatorCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('航海家能力：当前没有可结算的对应战斗行动');
  const validSource = validCombatSource(state, source);
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'tyrant.s6.wind-blade':
    case 'tyrant.s6.wind-control': {
      const blade = id === 'tyrant.s6.wind-blade', label = blade ? '有限风刃' : '有限控风护身';
      if (!isWindBlessed(state)) return noEffect(`${label}：当前序列没有该能力槽`);
      const cost = blade ? 3 : 2;
      if (!validSource || source?.encounterId !== 'WIND_BLESSED_DISPUTE' ||
          !Number.isFinite(state.spirituality) || state.spirituality < cost) {
        return { ...noEffect(`${label}：缺少当前原维修院外院的真实目标来源或${cost}点灵性，改用普通格挡护身；不耗灵性、不重抽、不建立水缚、幻鳞或怒势`),
          enemyReduction: 10 };
      }
      state.spirituality -= cost;
      return { label: `${label}：已耗${cost}点灵性；${blade
        ? '只向眼前鲁恩发出一次有限风刃，28×掌握因子贡献（G），不无视护甲或保证致伤'
        : '只以有限气流干扰眼前普通打击，14×掌握因子削弱（G），不建立无敌或绝对免伤'}；不增加行动、不积累或释放怒势，不调用飞行、雷击或歌声`,
        selfGain: blade ? 28 * masteryFactor(state, id) : 0,
        enemyReduction: blade ? 0 : 14 * masteryFactor(state, id), threatens: blade };
    }
    case 'tyrant.s7.water-control': {
      if (state.town.clubLocation === 'HAND') {
        const wrath = resolveRagerPhysicalAttack(state, 'NAVIGATOR_CLUB_STRIKE', 16 * physical,
          roundPolicy, validSource ? currentRagerCombatSource(state) : null);
        return { label: `持握原短棍打击：本次为物理主攻，替代水压预算，不叠加、不建立湿润${wrath.label}`,
          selfGain: wrath.selfGain, enemyReduction: 0, threatens: wrath.selfGain > 0 };
      }
      if (!validSource) return noEffect('有限水压打击：缺少当前可见普通目标来源，本次贡献0，不建立湿润');
      const selfGain = 38.025 * masteryFactor(state, id);
      waterState(state).soakedRemaining = 2;
      return { label: '有限水压打击：操控少量水压迫眼前目标；湿润刷新为2次敌方能力结算（G）；水系攻击不积累或释放怒势',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'NAVIGATOR_WAVE': {
      if (!validSource) return noEffect('有限浪击：缺少当前可见普通目标来源，本次贡献0');
      const selfGain = 20.475 * masteryFactor(state, 'tyrant.s7.water-control');
      return { label: '有限浪击：仅分配本次单目标水系次攻预算（G），不创造海域或海啸，不积累或释放怒势',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'NAVIGATOR_WATER_GUARD': {
      if (validSource) state.combat!.sailorScalesReady = true;
      return { ...noEffect(validSource
        ? '水系防护与幻鳞：有限水系护身；继承一次幻鳞，下一实际普通冲击贡献×0.75；不恢复健康、不加怒势'
        : '有限水系护身：缺少当前普通敌对来源，未建立幻鳞；不恢复健康、不加怒势'),
        enemyReduction: 8.775 * masteryFactor(state, 'tyrant.s7.water-control') };
    }
    case 'tyrant.s7.water-binding': {
      if (!validSource) return noEffect('水缚：缺少当前可见可包裹目标来源，本次贡献0，不作窒息对抗');
      const water = waterState(state);
      water.soakedRemaining = 2;
      let label: string;
      if (water.skipNext) {
        label = '水缚：已有待结算的水膜牵制，仅刷新湿润2次，不叠加失效或束缚';
      } else if (!water.bound) {
        water.bound = true;
        label = '水缚：建立一次束缚与湿润2次；下一实际移动、近战或空间姿态能力贡献×0.75后消耗（G）';
      } else {
        const contest = resolveNavigatorSuffocationContest(random, state.character.coreStats.will,
          mastery(state, id), source!);
        water.bound = false;
        if (!contest) label = '水膜牵制：目标不满足呼吸或包裹条件，不作假对抗；清除束缚，仅保留湿润';
        else {
          water.skipNext = !contest.targetResisted;
          label = `水膜牵制：普通目标意志${source!.targetWill}对施术者意志${state.character.coreStats.will}、水缚掌握度${mastery(state, id)}；发动成功率${contest.chance}%、实抽${contest.roll}/100（G）；${contest.targetResisted
            ? '目标抵抗成功，后续能力正常，仅保留湿润'
            : '目标抵抗失败，下一次原能力使用贡献0，不删除行动次数'}；清除束缚，湿润刷新2次`;
        }
      }
      return { ...noEffect(label), enemyReduction: 4.725 * masteryFactor(state, id) };
    }
    case 'tyrant.s7.navigation':
      return noEffect('判断现场条件：本次即时贡献0；保留普通退路，不创造海域、暴雨、额外行动或怒势');
    case 'ACCIDENT': {
      const charge = ragerWrathCharge(state), extra = [0, 3, 6, 10][charge]!;
      const bad = random.nextInt(1, 100 + extra) > 50;
      return { ...noEffect(`水流偏差：怒势${charge}/3，意外候选有利50/不利${50 + extra}归一化；本次贡献${bad ? '−' : '+'}11.25（G），不构成致伤攻击、不加怒势`),
        selfGain: bad ? -11.25 : 11.25 };
    }
  }
}

export interface NavigatorEnemyResponse {
  suppressed: boolean; contributionMultiplier: 1 | 0.75; label: string;
}
/** Called once after the original enemy draw; modifies that slot and expires wetness once. */
export function consumeNavigatorWater(
  state: SliceState, enemyMove: 'STRIKE' | 'BLOCK' | 'OPENING' | 'DISTANCE' | 'MISS',
  selfGain: number, enemyReduction: number,
  source: NavigatorCombatSource | null = currentNavigatorCombatSource(state),
): NavigatorEnemyResponse | null {
  const water = state.combat?.navigatorWater;
  if (!water || !validCombatSource(state, source)) return null;
  let suppressed = false, contributionMultiplier: 1 | 0.75 = 1;
  const labels: string[] = [];
  if (water.skipNext) {
    water.skipNext = false;
    water.bound = false;
    suppressed = true;
    labels.push('水膜牵制已消耗：本次原能力贡献0，原行动次数保留，不重抽');
  } else if (water.bound && (enemyMove === 'STRIKE' || enemyMove === 'DISTANCE') &&
      (selfGain > 0 || enemyReduction > 0)) {
    water.bound = false;
    contributionMultiplier = 0.75;
    labels.push('水缚已消耗：本次原近战或移动能力贡献×0.75');
  }
  if (water.soakedRemaining > 0) {
    water.soakedRemaining = water.soakedRemaining === 2 ? 1 : 0;
    labels.push(`本次敌方能力结算后湿润剩余${water.soakedRemaining}次`);
  }
  if (water.soakedRemaining === 0 && !water.bound && !water.skipNext) delete state.combat!.navigatorWater;
  return labels.length > 0 ? { suppressed, contributionMultiplier, label: labels.join('；') } : null;
}
