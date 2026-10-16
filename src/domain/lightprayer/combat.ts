import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed Sun V1 S8 D-profile. Numeric contributions are game balance (G). */
export const LIGHTPRAYER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 30 }),
  Object.freeze({ id: '2', label: '2次', weight: 30 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 15 }),
]);
export type LightprayerMoveId = 'sun.s8.light' | 'sun.s8.solar-flame' | 'LIGHTPRAYER_BLESSING'
  | 'LIGHTPRAYER_GLARE' | 'sun.s8.ritual' | 'ACCIDENT';
const ABILITIES: readonly {
  id: LightprayerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'sun.s8.light', label: '日光术', weight: 32, stance: 'ATTACK' },
  { id: 'sun.s8.solar-flame', label: '有限金焰', weight: 18, stance: 'ATTACK' },
  { id: 'LIGHTPRAYER_BLESSING', label: '祝福与稳定自身士气', weight: 12, stance: 'DEFEND' },
  { id: 'LIGHTPRAYER_GLARE', label: '眼前强光干扰', weight: 10, stance: 'CONTROL' },
  { id: 'sun.s8.ritual', label: '准备光源与小型仪式', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '过曝或光源偏差', weight: 20, stance: null },
];

export function isLightprayer(state: SliceState): boolean {
  return state.progression?.pathwayId === 'sun' && state.progression.sequence === 8;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function lightprayerAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawLightprayerAbility(random: ActionRandomStream, stance: SliceStance | null): LightprayerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('祈光人能力盘权重无效');
}
export function lightprayerActionCount(roll: number): number {
  return roll <= 30 ? 1 : roll <= 60 ? 2 : roll <= 85 ? 3 : 4;
}

/**
 * This encounter authors only the present ordinary human, with no Sun weakness,
 * hidden detectable disguise, undead nature, or distant/area target.
 */
export interface LightprayerCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN'; sunVulnerable: false;
  scope: 'CURRENT_VISIBLE_SINGLE_TARGET';
}
export function currentLightprayerCombatSource(state: SliceState): LightprayerCombatSource | null {
  if (!isLightprayer(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round,
    target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', nature: 'ORDINARY_HUMAN', sunVulnerable: false,
    scope: 'CURRENT_VISIBLE_SINGLE_TARGET' };
}
function validCombatSource(state: SliceState, source: LightprayerCombatSource | null): boolean {
  const current = currentLightprayerCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.nature === current.nature &&
    source.sunVulnerable === current.sunVulnerable && source.scope === current.scope;
}
function masteryFactor(state: SliceState, id: 'sun.s8.light' | 'sun.s8.solar-flame' | 'sun.s8.ritual'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** Only an authored exact tag affects a direct Sun attack, once per contribution. */
export function applyAuthoredSunVulnerability(
  contribution: number, directSunAttack: boolean, authoredTargetTags: readonly string[],
): number {
  return directSunAttack && contribution > 0 && authoredTargetTags.includes('SUN_VULNERABLE')
    ? contribution * 1.25 : contribution;
}

export interface LightprayerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): LightprayerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** One original action slot. No persistent blessing, chorus queue, or new resource. */
export function resolveLightprayerCombatAbility(
  state: SliceState, id: LightprayerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: LightprayerCombatSource | null = currentLightprayerCombatSource(state),
): LightprayerCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('祈光人能力：缺少当前可见普通对手来源，本次贡献0；不借用旧现场或扫描未知目标');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'sun.s8.light': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：本次物理主攻16替代日光术预算，不叠加光术、歌颂支援或太阳易伤',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const selfGain = applyAuthoredSunVulnerability(19.5 * masteryFactor(state, id), true, []);
      return { label: '日光术：向眼前单一目标施放有限日光；普通携铃者没有太阳易伤，仅结算本次主攻预算（G）',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'sun.s8.solar-flame': {
      const selfGain = applyAuthoredSunVulnerability(10.5 * masteryFactor(state, id), true, []);
      return { label: '有限金焰：只结算眼前单一普通目标的太阳火焰次攻预算（G）；没有太阳易伤，不追加攻击或持续灼烧',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'LIGHTPRAYER_BLESSING':
      return { ...noEffect('祝福：只稳定自身士气，结算本次普通减势（G）；不恢复健康或精神、不清除污染、不建立免疫或后续支援'),
        enemyReduction: 7.8 * masteryFactor(state, 'sun.s8.ritual') };
    case 'LIGHTPRAYER_GLARE':
      return { ...noEffect('眼前强光干扰：仅扰动当前可见普通对手的动作，结算本次普通减势（G）；不扫描秘密、不判断善恶、不夺取控制或删减行动'),
        enemyReduction: 4.2 * masteryFactor(state, 'sun.s8.light') };
    case 'sun.s8.ritual':
      return noEffect('准备光源与小型仪式：即时贡献0；未发动祝福，不增加灵性、行动或歌颂支援');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -7.5 : 7.5;
      return { ...noEffect(`过曝或光源偏差：本次贡献${selfGain < 0 ? '−' : '+'}7.5（G），不构成致伤攻击或揭露秘密`), selfGain };
    }
  }
}
