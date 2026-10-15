import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Approved S7 profile: U45, A1.5/E0.4. All budgets and the two-stage rule are G. */
export const WEAPONMASTER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 22 }),
  Object.freeze({ id: '2', label: '2次', weight: 28 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 17 }),
  Object.freeze({ id: '5', label: '5次', weight: 8 }),
]);

export type WeaponmasterMoveId = 'warrior.s9.physique' | 'warrior.s7.weapons' | 'warrior.s9.restraint'
  | 'POSITION' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly {
  id: WeaponmasterMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'warrior.s9.physique', label: '武器大师体魄打击（0灵性）', weight: 38, stance: 'ATTACK' },
  { id: 'warrior.s7.weapons', label: '武器技击／两段弱点（0灵性）', weight: 20, stance: 'ATTACK' },
  { id: 'warrior.s9.restraint', label: '克制格挡与避让（0灵性）', weight: 8, stance: 'DEFEND' },
  { id: 'POSITION', label: '持械步法牵制（0灵性）', weight: 5, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察落点与退路（0贡献；0灵性）', weight: 4, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '突破或失衡（±11.25；0灵性；不判伤）', weight: 25, stance: null },
];

export function isWeaponmaster(state: SliceState): boolean {
  return state.progression?.pathwayId === 'warrior' && state.progression.sequence === 7;
}

/** This is the inherited original, never a newly generated or automatically borrowed weapon. */
export function weaponmasterPlayerHoldsPracticeClub(state: SliceState): boolean {
  const club = state.warrior?.practiceClub;
  return isWeaponmaster(state) && club?.id === 'warrior-training-club' &&
    club.owner === '奥斯温·布莱克特' && club.custodian === 'PLAYER' && club.location === 'player:hand';
}
function heldClubLabel(state: SliceState | undefined): string | null {
  if (!state) return null;
  if (state.town.clubLocation === 'HAND') return '持握原短棍打击';
  return weaponmasterPlayerHoldsPracticeClub(state) ? '持握奥斯温原练习短棍打击' : null;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}

/** Read-only explanation of this battle's preparation, also used in the public projection. */
export function weaponmasterPreparationSummary(state: SliceState): string | null {
  if (!isWeaponmaster(state) || !state.combat) return null;
  if (!currentWeaponmasterCombatSource(state)) return '两段弱点：当前没有仍在场的可见普通对手，不能建立或兑现标记；0灵性。';
  const mark = state.combat.weaponmasterWeakPoint;
  if (!heldClubLabel(state)) return `两段弱点：未实际持有原短棍，抽中后回退普通技击47.25×武器技击掌握系数×当前身体系数；${mark?.prepared ? '已有本场标记保留，当前不能兑现' : '不建立空白标记'}；0灵性。`;
  if (!mark?.observed) return '两段弱点：须先看到本场对手实际打击或寻找空当；当前抽中回退普通技击，不凭空发现弱点；0灵性。';
  return mark.prepared
    ? '两段弱点：已准备；再次抽中且仍持有原短棍、对手仍在场时消耗标记，贡献420×弱点掌握系数×当前身体系数；仍抽共同胜负与后果盘，不直接判死；0灵性。'
    : '两段弱点：已有本场实际打击或空当证据；第一次合格命中仅建立标记，0贡献，跨回合保留至本场结束；0灵性。';
}

export function weaponmasterAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  const clubLabel = heldClubLabel(state);
  const preparation = state ? weaponmasterPreparationSummary(state) : null;
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'warrior.s9.physique' && clubLabel ? `${clubLabel}（普通16替换体魄预算；0灵性）`
      : ability.id === 'warrior.s7.weapons'
      ? `${ability.label}：次攻内普通技击12/20、弱点8/20（中立主盘12%／8%）；${preparation ?? '须持有原短棍，并已看到本场普通对手实际打击或寻找空当；第一段0贡献，第二段420×弱点掌握系数×当前身体系数，不直接判死'}`
      : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawWeaponmasterAbility(random: ActionRandomStream, stance: SliceStance | null): WeaponmasterMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('武器大师能力盘权重无效');
}
export function weaponmasterActionCount(roll: number): number {
  return roll <= 22 ? 1 : roll <= 50 ? 2 : roll <= 75 ? 3 : roll <= 92 ? 4 : 5;
}

/** Only the current first-case ordinary carrier and actual ground passage are authored. */
export interface WeaponmasterCombatSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; space: 'DRY_GROUND_PASSAGE'; exit: 'ORDINARY_OPEN_EXIT';
}
export function currentWeaponmasterCombatSource(state: SliceState): WeaponmasterCombatSource | null {
  const combat = state.combat;
  if (!isWeaponmaster(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !combat || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 || combat.enemyStatus !== 'RESISTING' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 || state.arc.stage !== 'COMBAT' ||
      state.world.city !== 'BACKLUND' || combat.encounterId !== 'FIRST_CASE' ||
      !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
}
function validSource(state: SliceState, source: WeaponmasterCombatSource | null): boolean {
  const current = currentWeaponmasterCombatSource(state);
  return current !== null && source !== null && source.runId === current.runId &&
    source.revision === current.revision && source.week === current.week && source.round === current.round &&
    source.encounterId === current.encounterId && source.target === current.target && source.nature === current.nature &&
    source.body === current.body && source.space === current.space && source.exit === current.exit;
}
function masteryFactor(state: SliceState,
  id: 'warrior.s9.physique' | 'warrior.s7.weapons' | 'warrior.s9.restraint' | 'warrior.s7.weak-point',
): number {
  const value = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500;
}
export interface WeaponmasterCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): WeaponmasterCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** Invoke only after a real ordinary enemy move; suppressed slots and other moves give no evidence. */
export function observeWeaponmasterEnemyAction(state: SliceState, abilityId: string, suppressed = false): void {
  if (suppressed || !currentWeaponmasterCombatSource(state) || (abilityId !== 'STRIKE' && abilityId !== 'OPENING')) return;
  const context = state.combat!.weaponmasterWeakPoint ??= { observed: false, prepared: false };
  context.observed = true;
}

/** Exactly one player action. A selected J slot has one finite12:8 subdraw, never a free extra strike. */
export function resolveWeaponmasterCombatAbility(
  state: SliceState, id: WeaponmasterMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: WeaponmasterCombatSource | null = currentWeaponmasterCombatSource(state),
): WeaponmasterCombatEffect {
  if (!validSource(state, source)) return noEffect('武器大师行动：缺少本场仍在场、可触及的普通对手，本次贡献0、0灵性、不重抽');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'warrior.s9.physique': {
      const clubLabel = heldClubLabel(state);
      const selfGain = (clubLabel ? 16 : 67.5 * masteryFactor(state, id)) * physical;
      return { label: clubLabel
        ? `${clubLabel}：普通16贡献替换体魄预算，不叠加；0灵性`
        : '武器大师体魄打击：继承的真实身体近身应对，67.5×体魄掌握系数×当前身体系数，不生成武器；0灵性',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s7.weapons': {
      const weakPoint = random.nextInt(1, 20) > 12;
      const context = state.combat!.weaponmasterWeakPoint;
      const clubLabel = heldClubLabel(state);
      if (!weakPoint || !clubLabel || !context?.observed || physical <= 0) {
        const selfGain = 47.25 * masteryFactor(state, id) * physical;
        const reason = !weakPoint ? '抽中普通技击'
          : !clubLabel ? '未实际持有原短棍，弱点分支回退普通技击，不建立或兑现标记'
          : !context?.observed ? '本场尚无已发生的打击或空当证据，弱点分支回退普通技击，不建立标记'
          : '当前身体条件不足，弱点分支回退普通技击，不建立或兑现标记';
        return { label: `武器技击：${reason}；47.25×武器技击掌握系数×当前身体系数；0灵性，不追加攻击`,
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (!context.prepared) {
        context.prepared = true;
        return noEffect('两段弱点第一段：持握实际原短棍，依据本场对手已发生的打击或寻找空当建立标记；准备跨回合保留至本场结束，本次0贡献、0灵性，不追加攻击、不读取隐藏身体信息');
      }
      context.prepared = false;
      const selfGain = 420 * masteryFactor(state, 'warrior.s7.weak-point') * physical;
      return { label: '两段弱点第二段：实际原短棍兑现本场标记，标记已消耗；420×弱点掌握系数×当前身体系数（G），0灵性；仍通过共同胜负与后果盘，不直接判死、不附加普通技击预算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s9.restraint':
      return { ...noEffect('克制格挡与避让：普通身体防守，18×克制掌握系数；0灵性，不能防弹、不产生晨曦光甲'),
        enemyReduction: 18 * masteryFactor(state, id) };
    case 'POSITION':
      return { ...noEffect('持械步法牵制：依据真实距离调整，12.6×武器技击掌握系数；0灵性，不自动缴械、不取消对手行动'),
        enemyReduction: 12.6 * masteryFactor(state, 'warrior.s7.weapons') };
    case 'OBSERVE':
      return noEffect('观察落点与退路：只复核眼前站位和原普通出口；本次贡献0、0灵性，不追加攻击，不替代两段弱点的实际动作证据');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`突破或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G）；0灵性，不构成致伤攻击`), selfGain };
    }
  }
}
