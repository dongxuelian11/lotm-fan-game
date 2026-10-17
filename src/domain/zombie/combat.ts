import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveReasonSacrifice, type MadmanRoundPolicy } from '../madman/combat.js';
import type { PrisonerCombatSource } from '../prisoner/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasZombieDisputeOpponent } from './encounter.js';

/** Zombie S6 candidate: U65/P15, A1.4/E1.3. Budgets, costs and healing are G.
 * Steel bracing is limited to its selected slot, not permanent immunity. This
 * ordinary encounter does not implement blanket spiritual or solar resistance. */
export const ZOMBIE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);
export type ZombieMoveId = 'chained.s6.death-craft' | 'BODY_FOLLOWUP' | 'chained.s6.steel-body'
  | 'POSITION' | 'chained.s7.regeneration' | 'ACCIDENT';
const ABILITIES: readonly {
  id: ZombieMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'chained.s6.death-craft', label: '有限寒冷术（G；3灵性，否则普通身体打击）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '本人强化身体次击（G；31.85×钢铁身体掌握×身体，0消耗）', weight: 15, stance: 'ATTACK' },
  { id: 'chained.s6.steel-body', label: '本槽短时钢铁撑护（G；3灵性，否则普通格挡）', weight: 25, stance: 'DEFEND' },
  { id: 'POSITION', label: '实际净空场地普通走位（G；6×身体，0消耗）', weight: 10, stance: 'CONTROL' },
  { id: 'chained.s7.regeneration', label: '继承有限自愈（G；存活受伤时3灵性恢复10健康，0战势）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '寒冷或动作偏差（G；固定−16.25，不另掷正负）', weight: 5, stance: null },
];

export function isZombie(state: SliceState): boolean {
  return state.progression?.pathwayId === 'chained' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function zombieAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'chained.s6.death-craft' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（G；16×身体替换主攻，0灵性，不叠加寒冷）' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawZombieAbility(random: ActionRandomStream, stance: SliceStance | null): ZombieMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('活尸能力盘权重无效');
}
export function zombieActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}

/** The original first-case carrier and the actual paid courtyard arrival remain
 * distinct sources; neither a practice spirit nor an old snapshot is an actor. */
export type ZombieCombatSource = (PrisonerCombatSource & { activeGhostSource: false }) | {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'ZOMBIE_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'REED_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'REEDS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_CLEAR_COURTYARD'; visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT';
  pursuit: false; activeGhostSource: false;
};
export function currentZombieCombatSource(state: SliceState): ZombieCombatSource | null {
  const combat = state.combat;
  if (!isZombie(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null ||
      !combat || combat.enemyStatus !== 'RESISTING' || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 || state.world.city !== 'BACKLUND' ||
      state.zombie.moon.pendingWeek !== null || state.zombie.practice.body !== 'NORMAL' ||
      !['NONE', 'THAWED'].includes(state.zombie.practice.cold) ||
      !['ABSENT', 'RELEASED'].includes(state.zombie.practice.spirit) ||
      Object.values(state.zombie.cases).some(record => record.contactOpen || record.status === 'PREPARED') ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1) return null;
  if (combat.encounterId === 'FIRST_CASE') {
    if (state.arc.stage !== 'COMBAT' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
    return { runId: state.runId, revision: state.revision, week: state.week, encounterId: 'FIRST_CASE',
      round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT', activeGhostSource: false };
  }
  const e = state.zombie.encounter;
  if (!hasZombieDisputeOpponent(state) || e.startHistoryIndex === null ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'ZOMBIE_DISPUTE', attemptWeek: state.week, startHistoryIndex: e.startHistoryIndex,
    target: 'REED_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'REEDS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_CLEAR_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, activeGhostSource: false };
}
function validSource(state: SliceState, source: ZombieCombatSource | null): boolean {
  const current = currentZombieCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(state: SliceState, id: 'chained.s6.death-craft' | 'chained.s6.steel-body'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
function spend(state: SliceState): boolean {
  if (!Number.isFinite(state.spirituality) || state.spirituality < 3) return false;
  state.spirituality -= 3;
  return true;
}
export interface ZombieCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): ZombieCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Resolve and pay only the selected slot. No added attacks, actors or draws. */
export function resolveZombieCombatAbility(
  state: SliceState, id: ZombieMoveId, physicalStateFactor: number, _random: ActionRandomStream,
  source: ZombieCombatSource | null = currentZombieCombatSource(state),
  roundPolicy: MadmanRoundPolicy = { policy: 'HOLD', triggered: false, mentalCost: 0, spiritualCost: 0 },
): ZombieCombatEffect {
  if (!validSource(state, source)) {
    return noEffect('活尸行动：缺少本场真实存活对手与原现场，或月相待处理、练习尚未收束；0贡献、0灵性、不重抽、不复活');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'chained.s6.death-craft': {
      if (state.town.clubLocation === 'HAND') {
        const burst = resolveReasonSacrifice(state, 16 * physical, roundPolicy);
        return { label: '持握原短棍打击：实际手持镇上原短棍，以16×当前身体系数替换本次主攻（G）；本槽基础0灵性，不同时附加寒冷术，也不取得对手的原棍' + burst.label,
          selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
      }
      if (spend(state)) {
        const selfGain = 59.15 * masteryFactor(state, id);
        return { label: '有限寒冷术：本槽实际耗3灵性，59.15×死亡技艺掌握（G），法术不乘身体系数；只产生本次致伤威胁，仍走共同胜负与伤势盘，失败也付成本。不持续冻结场地、不自动腐烂或操纵尸体',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const burst = resolveReasonSacrifice(state, 12 * physical, roundPolicy);
      return { label: '灵性不足3：回退普通身体打击12×当前身体系数（G），本槽基础0消耗、不透支，不借用练习寒冷或灵体' + burst.label,
        selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const burst = resolveReasonSacrifice(state, 31.85 * masteryFactor(state, 'chained.s6.steel-body') * physical, roundPolicy);
      return { label: '本人强化身体次击：31.85×钢铁身体掌握×当前身体系数（序列6身体成长G），本槽基础0灵性；独立占本次行动，不附赠攻击' + burst.label,
        selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
    }
    case 'chained.s6.steel-body':
      if (spend(state)) {
        return { ...noEffect('本槽短时钢铁撑护：实际耗3灵性，59.15×钢铁身体掌握×当前身体系数（G）；本槽结束即收束，不是常驻免疫，不自动抵抗所有灵性或太阳伤害，不治疗、不抹去旧伤和风险'),
          enemyReduction: 59.15 * masteryFactor(state, id) * physical };
      }
      return { ...noEffect('灵性不足3：普通格挡10×当前身体系数（G），0消耗；不形成钢铁撑护，不治疗或清除风险'),
        enemyReduction: 10 * physical };
    case 'POSITION':
      return { ...noEffect('原净空场地普通走位牵制6×当前身体系数（G），0灵性；本场没有可用幽魂来源，不借练习灵体，不取消对手行动，不使用序列5灵化、附身或瞬移'),
        enemyReduction: 6 * physical };
    case 'chained.s7.regeneration': {
      if (state.health >= 100 || !spend(state)) {
        return noEffect('继承有限自愈：当前健康已满或灵性不足3，实际恢复0、消耗0、战势0；不提前治疗、不增加攻击');
      }
      const before = state.health;
      state.health = Math.min(100, state.health + 10);
      return noEffect(`继承狼人有限自愈：实际耗3灵性，恢复${state.health - before}健康、上限100（G）；本槽战势0、不额外攻击，原伤势、累计风险、精神和污染不变，不使死亡者复活`);
    }
    case 'ACCIDENT':
      return { ...noEffect('寒冷或动作偏差：本次自身优势固定−16.25（活尸候选G），0灵性；不另掷正负、不构成致伤攻击，不自动杀人或附加污染'), selfGain: -16.25 };
  }
}
