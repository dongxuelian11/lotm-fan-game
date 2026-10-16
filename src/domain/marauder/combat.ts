import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck, type NormalCheckInput } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Error V1 S9 profile: U20, A0.6/E0.3. Contribution budgets are game balance (G). */
export const MARAUDER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
]);

export type MarauderMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'COVER'
  | 'SITE_PRESSURE' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: MarauderMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '灵敏近身攻击', weight: 32, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '灵巧精准次击', weight: 18, stance: 'ATTACK' },
  { id: 'COVER', label: '敏捷闪避', weight: 12, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '近身普通牵制（无可窃取物）', weight: 10, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察眼前动作空当', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '近身动作偏差', weight: 20, stance: null },
];

export function isMarauder(state: SliceState): boolean {
  return state.progression?.pathwayId === 'error' && state.progression.sequence === 9;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function marauderAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  const dispute = state && currentMarauderCombatSource(state)?.encounterId === 'MARAUDER_DISPUTE';
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: state && dispute && ability.id === 'SITE_PRESSURE'
      ? canStealSimonClub(state)
        ? `窃取塞蒙手中原短棍（${marauderTheftChance(state)}% · 成功0即时贡献 · 失败下次敌打击+4仅本轮一次）`
        : '近身普通牵制（当前无法窃取原短棍）'
      : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawMarauderAbility(random: ActionRandomStream, stance: SliceStance | null): MarauderMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('偷盗者能力盘权重无效');
}
export function marauderActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 85 ? 4 : 5;
}

export interface MarauderCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): MarauderCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * FIRST_CASE supplies a reachable ordinary opponent, but no registered item
 * instance eligible for theft. The carrier's narrative bell, box and club are
 * not inventory producers. Prior daily theft never supplies a battle item.
 */
export type MarauderCombatSource = {
  runId: string; revision: number; week: number; round: number;
  nature: 'ORDINARY_HUMAN'; body: 'CURRENT_REACHABLE_BODY';
} & ({
  encounterId: 'FIRST_CASE'; target: 'CURRENT_VISIBLE_ORDINARY_CARRIER';
  space: 'DRY_GROUND_PASSAGE'; stealableItem: 'NONE'; exit: 'EXISTING_ORDINARY_GROUND_EXIT';
} | {
  encounterId: 'MARAUDER_DISPUTE'; target: 'CURRENT_VISIBLE_ORDINARY_SIMON';
  space: 'ORIGINAL_REPAIR_YARD'; stealableItem: 'marauder-simon-club'; exit: 'ORIGINAL_REPAIR_YARD_EXIT';
});
export function currentMarauderCombatSource(state: SliceState): MarauderCombatSource | null {
  if (!isMarauder(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.world.city !== 'BACKLUND') return null;
  if (state.combat.encounterId === 'MARAUDER_DISPUTE') {
    if (state.marauder.dispute.stage !== 'ACTIVE' || state.marauder.dispute.outcome !== null) return null;
    // This identifies the already-observed original, not its mutable custody.
    // Re-read custody/version per action so a theft cannot stale the round source.
    return { runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'MARAUDER_DISPUTE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_SIMON',
      nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'ORIGINAL_REPAIR_YARD',
      stealableItem: 'marauder-simon-club', exit: 'ORIGINAL_REPAIR_YARD_EXIT' };
  }
  if (state.arc.stage !== 'COMBAT' || state.combat.encounterId !== 'FIRST_CASE' ||
      !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
    stealableItem: 'NONE', exit: 'EXISTING_ORDINARY_GROUND_EXIT' };
}

/** Existing ordinary encounters retain their original armed template. */
export function marauderEnemyArmed(state: SliceState): boolean {
  if (state.combat?.encounterId !== 'MARAUDER_DISPUTE') return true;
  const weapon = state.marauder.dispute.weapon;
  return weapon.id === 'marauder-simon-club' && weapon.owner === '塞蒙' &&
    weapon.custodian === 'SIMON' && weapon.location === 'SIMON_HAND';
}

export function marauderPlayerHoldsClub(state: SliceState): boolean {
  const weapon = state.marauder.dispute.weapon;
  return weapon.id === 'marauder-simon-club' && weapon.owner === '塞蒙' &&
    weapon.custodian === 'PLAYER' && weapon.location === 'PLAYER_HAND';
}

function canStealSimonClub(state: SliceState): boolean {
  return state.combat?.encounterId === 'MARAUDER_DISPUTE' &&
    marauderEnemyArmed(state) && state.town.clubLocation !== 'HAND' && !marauderPlayerHoldsClub(state);
}

function marauderTheftCheckInput(state: SliceState): NormalCheckInput {
  const rawMastery = state.progression.mastery['error.s9.theft'] ?? 0;
  const mastery = Math.max(0, Math.min(500, Number.isFinite(rawMastery) ? rawMastery : 0));
  return { ability: 'perception', baseAbility: state.character.coreStats.perception,
    difficulty: 12, modifiers: [{ source: '偷取掌握度', value: Math.floor(mastery / 50) }] };
}

/** Preview uses exactly the same current input as resolution, without a draw. */
export function marauderTheftChance(state: SliceState): number {
  return computeCheckChance(marauderTheftCheckInput(state));
}

function validCombatSource(state: SliceState, source: MarauderCombatSource | null): boolean {
  const current = currentMarauderCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week &&
    source.encounterId === current.encounterId && source.round === current.round &&
    source.target === current.target && source.nature === current.nature &&
    source.body === current.body && source.space === current.space &&
    source.stealableItem === current.stealableItem && source.exit === current.exit;
}
function masteryFactor(state: SliceState, id: 'error.s9.agility' | 'error.s9.dexterity'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One actual action slot; physical dexterity neither spends nor steals resources. */
export function resolveMarauderCombatAbility(
  state: SliceState, id: MarauderMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: MarauderCombatSource | null = currentMarauderCombatSource(state),
): MarauderCombatEffect {
  if (!validCombatSource(state, source)) {
    return noEffect('偷盗者行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'BODY_STRIKE': {
      const stolenClub = marauderPlayerHoldsClub(state);
      const armed = state.town.clubLocation === 'HAND' || stolenClub;
      const selfGain = (armed ? 16 : 7.8 * masteryFactor(state, 'error.s9.agility')) * physical;
      return { label: stolenClub
        ? `持握塞蒙原短棍打击：原件${state.marauder.dispute.weapon.id} v${state.marauder.dispute.weapon.version}，普通短棍16贡献（G），替换而不叠加主攻预算；所有权仍属塞蒙`
        : armed
        ? '持握原短棍打击：采用普通短棍16贡献（G），替换而不叠加主攻预算；由真实身体实施'
        : `灵敏近身攻击：以本人身体的快速动作攻击眼前普通${source?.encounterId === 'MARAUDER_DISPUTE' ? '人塞蒙' : '携铃者'}，不额外消耗灵性`,
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 4.2 * masteryFactor(state, 'error.s9.dexterity') * physical;
      return { label: '灵巧精准次击：只结算本次真实近身动作，不另赠武器攻击或额外行动',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'COVER':
      return { ...noEffect('敏捷闪避：以身体避让眼前普通攻击，只结算减势，不保证免伤或取消后续短棍动作'),
        enemyReduction: 3.9 * masteryFactor(state, 'error.s9.agility') };
    case 'SITE_PRESSURE': {
      if (source?.encounterId === 'MARAUDER_DISPUTE') {
        if (!canStealSimonClub(state)) {
          const reason = state.town.clubLocation === 'HAND' ? '自己的原短棍已占手'
            : marauderPlayerHoldsClub(state) ? '同一原短棍已经在你手中'
            : '塞蒙当前未持有这件已观察的原短棍';
          return { ...noEffect(`近身普通牵制：${reason}，没有合格的可窃取物；本次不抽窃取判定、不重复取物，以灵巧接触牵制且不取消对手行动`),
            enemyReduction: 2.1 * masteryFactor(state, 'error.s9.dexterity') };
        }
        const result = resolveNormalCheck({ ...marauderTheftCheckInput(state),
          roll: random.nextInt(1, 100) });
        const weapon = state.marauder.dispute.weapon, version = weapon.version;
        const success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
        const tier = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '灾难' }[result.tier];
        const check = `感知${result.baseAbility}+偷取掌握修正${result.effectiveAbility - result.baseAbility}对难度12，成功率${result.chance}%，掷骰${result.roll}/100，${tier}`;
        if (success) {
          weapon.custodian = 'PLAYER'; weapon.location = 'PLAYER_HAND'; weapon.version += 1;
          return noEffect(`原短棍转移成功：${check}；原件${weapon.id} v${version}→v${weapon.version}从塞蒙手中转到你手中，所有权仍属${weapon.owner}；0灵性、0即时贡献，不赠送攻击或行动。塞蒙之后的实际打击按徒手结算，你需等后续真实主攻动作才能使用原棍`);
        }
        state.marauder.dispute.attention += 1;
        return noEffect(`窃取塞蒙原短棍失败：${check}；原件${weapon.id} v${version}仍在塞蒙手中，所有权、持有与版本未变；0灵性、0即时贡献。塞蒙注意+1，本轮下一次实际普通打击反击贡献+4（G），仅一次，轮末失效，不增加行动`);
      }
      return { ...noEffect('近身普通牵制：本场没有已登记的可窃取实物，改以灵巧接触牵制；没有发生窃取，也不取消对手行动'),
        enemyReduction: 2.1 * masteryFactor(state, 'error.s9.dexterity') };
    }
    case 'OBSERVE':
      return noEffect('观察眼前动作空当：只为下一次实际动作留意可见机会，本次贡献0；不保证后续成功，不揭露物品用途或隐藏情报');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -5 : 5;
      return { ...noEffect(`近身动作偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}5（G），不形成致伤攻击或任何窃取`), selfGain };
    }
  }
}
