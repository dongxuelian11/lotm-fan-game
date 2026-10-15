import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** S6 M profile: U65, A1.7/E0.5. Contributions, costs and windows are finite G. */
export const DAWN_PALADIN_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 18 }),
  Object.freeze({ id: '2', label: '2次', weight: 25 }),
  Object.freeze({ id: '3', label: '3次', weight: 27 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 10 }),
]);
export type DawnPaladinMoveId = 'warrior.s6.dawn-weapon' | 'warrior.s6.light-storm'
  | 'warrior.s6.dawn-armor' | 'warrior.s6.dawn-light' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: DawnPaladinMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'warrior.s6.dawn-weapon', label: '晨曦剑主攻（已有剑时2灵性；未凝剑时原持棍16或普通身体12替换）', weight: 38, stance: 'ATTACK' },
  { id: 'warrior.s6.light-storm', label: '光之风暴（已有剑时4灵性；单一实际目标；失剑并冲散自身光甲）', weight: 20, stance: 'ATTACK' },
  { id: 'warrior.s6.dawn-armor', label: '晨曦光甲（3灵性建立下一次实际物理攻击×0.60；至下回合末；不同时减势）', weight: 8, stance: 'DEFEND' },
  { id: 'warrior.s6.dawn-light', label: '晨曦破幻（仅已有幻象；本场无来源时普通格挡10、0灵性）', weight: 5, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '凝聚／重凝双手晨曦剑（双手空出时3灵性、0即时贡献；风暴失剑当回合不能重凝）', weight: 4, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '突破或失衡（±16.25；0灵性；不判伤）', weight: 25, stance: null },
];

export function isDawnPaladin(state: SliceState): boolean {
  return state.progression?.pathwayId === 'warrior' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function dawnPaladinAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  const encounter = state?.dawnPaladin.encounter;
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'warrior.s6.dawn-weapon' && encounter && !encounter.swordReady
      ? `${ability.label}；当前未实际持有晨曦剑，抽中不自动凝剑`
      : ability.id === 'warrior.s6.dawn-armor' && encounter?.armorReady
      ? `现有晨曦光甲保留原期限至第${encounter.armorExpiresRound}回合末；再次抽中仅普通自保21.125×掌握系数，0灵性、不续期`
      : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawDawnPaladinAbility(random: ActionRandomStream, stance: SliceStance | null): DawnPaladinMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('黎明骑士能力盘权重无效');
}
export function dawnPaladinActionCount(roll: number): number {
  return roll <= 18 ? 1 : roll <= 43 ? 2 : roll <= 70 ? 3 : roll <= 90 ? 4 : 5;
}

/** Only this paid arrival supplies an opponent. No daily trial or FIRST_CASE can substitute. */
export interface DawnPaladinCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'DAWN_PALADIN_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'ROALD_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'ROALDS_OWN_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_TRAINING_OUTER_COURTYARD'; visibility: 'MUTUALLY_VISIBLE';
  lighting: 'ORIGINAL_FIXED_LAMPLIGHT'; distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND';
  bystanders: 'NONE'; illusion: 'NONE'; holyVulnerable: false; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export function currentDawnPaladinCombatSource(state: SliceState): DawnPaladinCombatSource | null {
  const combat = state.combat, e = state.dawnPaladin.encounter;
  if (!isDawnPaladin(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null || state.world.city !== 'BACKLUND' ||
      !combat || combat.encounterId !== 'DAWN_PALADIN_DISPUTE' || combat.enemyStatus !== 'RESISTING' ||
      !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      Object.values(state.dawnPaladin.cases).some(item => item.contactOpen || item.status === 'PREPARED') ||
      !Object.values(state.dawnPaladin.cases).some(item => item.status === 'RESOLVED') ||
      e.status !== 'FIGHTING' || e.attemptWeek !== state.week || e.startHistoryIndex === null ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS') ||
      typeof e.swordReady !== 'boolean' || typeof e.armorReady !== 'boolean' ||
      (e.swordReady && handsOccupied(state)) ||
      (e.swordLostRound !== null && (!Number.isSafeInteger(e.swordLostRound) || e.swordLostRound < 1 ||
        e.swordLostRound > combat.round || (e.swordReady && e.swordLostRound === combat.round))) ||
      (e.armorReady ? e.armorExpiresRound === null || !Number.isSafeInteger(e.armorExpiresRound) ||
        e.armorExpiresRound < combat.round || e.armorExpiresRound > combat.round + 1 : e.armorExpiresRound !== null)) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'DAWN_PALADIN_DISPUTE', attemptWeek: e.attemptWeek, startHistoryIndex: e.startHistoryIndex,
    target: 'ROALD_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'ROALDS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_TRAINING_OUTER_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2,
    ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE', illusion: 'NONE', holyVulnerable: false,
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: DawnPaladinCombatSource | null): boolean {
  const current = currentDawnPaladinCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(state: SliceState, id: DawnPaladinMoveId): number {
  const value = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500;
}
function heldClubLabel(state: SliceState): string | null {
  if (state.town.clubLocation === 'HAND') return '持握原短棍';
  const club = state.warrior.practiceClub;
  return club.id === 'warrior-training-club' && club.owner === '奥斯温·布莱克特' &&
    club.custodian === 'PLAYER' && club.location === 'player:hand' ? '持握奥斯温原练习短棍' : null;
}
function handsOccupied(state: SliceState): boolean {
  return state.town.clubLocation === 'HAND' || state.warrior.practiceClub.location === 'player:hand';
}
export interface DawnPaladinCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): DawnPaladinCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function guard(reason: string): DawnPaladinCombatEffect {
  return { ...noEffect(`${reason}；回退普通格挡10（G），0灵性，不建立能力效果、不重抽`), enemyReduction: 10 };
}
function ordinaryAttack(state: SliceState, physical: number, reason: string, secondary = false): DawnPaladinCombatEffect {
  const club = secondary ? null : heldClubLabel(state), budget = secondary ? 8 : club ? 16 : 12;
  const selfGain = budget * physical;
  return { label: `${reason}；${club ?? '普通身体'}${secondary ? '次击' : '打击'}${budget}×当前身体系数替换本槽预算（G），0灵性；不凭空凝剑、不叠加旧两段弱点`,
    selfGain, enemyReduction: 0, threatens: selfGain > 0 };
}
function canPay(state: SliceState, amount: number): boolean {
  return Number.isFinite(state.spirituality) && state.spirituality >= amount;
}

/** One actual slot; sword preparation, attacking, storm and armor never share a free extra action. */
export function resolveDawnPaladinCombatAbility(
  state: SliceState, id: DawnPaladinMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: DawnPaladinCombatSource | null = currentDawnPaladinCombatSource(state),
): DawnPaladinCombatEffect {
  if (!validSource(state, source)) return noEffect('黎明骑士行动：缺少本场实际到场、仍可行动的罗尔德与原空院来源；0贡献、0灵性、不重抽');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const e = state.dawnPaladin.encounter, round = state.combat!.round;
  switch (id) {
    case 'warrior.s6.dawn-weapon': {
      if (!e.swordReady) return ordinaryAttack(state, physical, '当前尚未凝聚晨曦剑');
      if (!canPay(state, 2) || physical <= 0) return ordinaryAttack(state, physical, '当前不足2灵性或身体无法执行晨曦剑主攻');
      state.spirituality -= 2;
      const selfGain = 65 * 1.7 * 0.65 * masteryFactor(state, id) * physical;
      return { label: '实际晨曦剑主攻：已耗2灵性，71.825×晨曦武器掌握系数×当前身体系数（G）；单一普通人罗尔德没有神圣易伤，不叠加持棍预算或旧两段弱点，不直接判死',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s6.light-storm': {
      if (!e.swordReady) return ordinaryAttack(state, physical, '没有实际晨曦剑，不能释放光之风暴', true);
      if (!canPay(state, 4) || physical <= 0) return ordinaryAttack(state, physical, '当前不足4灵性或身体无法释放光之风暴，现有剑甲不消失', true);
      state.spirituality -= 4;
      const hadArmor = e.armorReady;
      e.swordReady = false; e.swordLostRound = round;
      e.armorReady = false; e.armorExpiresRound = null;
      const selfGain = 65 * 1.7 * 0.35 * masteryFactor(state, id) * physical;
      return { label: `光之风暴：已耗4灵性，38.675×本能力掌握系数×当前身体系数（G）；实际范围内只有罗尔德一人，数量不另抽、无神圣易伤；晨曦剑已散去，本回合不能重凝。${hadArmor ? '风暴也冲散了自身现有光甲，防护已清除' : '风暴会波及自身光甲，本次没有现存光甲'}；现场没有旁人，不虚构友军受伤，后果仍走共同盘`,
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'warrior.s6.dawn-armor':
      if (e.armorReady) return { ...noEffect('现有晨曦光甲尚未消耗：本槽仅普通自保21.125×光甲掌握系数（G），0灵性；原防护期限不刷新、不另建或叠加光甲'),
        enemyReduction: 65 * 0.5 * 0.65 * masteryFactor(state, id) };
      if (!canPay(state, 3)) return guard('当前不足3灵性，不能凝聚晨曦光甲');
      state.spirituality -= 3; e.armorReady = true; e.armorExpiresRound = round + 1;
      return noEffect(`晨曦光甲：已耗3灵性；建立下一次实际指向自身的物理攻击普通贡献×0.60的一次防护，消耗后清除，最迟第${e.armorExpiresRound}回合末失效；本次0即时减势，不治伤、不阻止共同伤势或死亡盘`);
    case 'warrior.s6.dawn-light':
      return guard('当前固定灯照空院没有实际已知幻象或阴影遮蔽；不发动破幻、不虚构幻象来源、不把普通人判为邪恶');
    case 'OBSERVE':
      if (e.swordReady) return noEffect('已有实际晨曦剑：只复核握持、眼前站位和原出口；0贡献、0灵性，不再凝剑、不追加攻击');
      if (e.swordLostRound === round) return noEffect('本回合刚由光之风暴失剑，低序列本回合不能重凝；本次0贡献、0灵性，须等后续回合再次抽中预备槽');
      if (handsOccupied(state)) return noEffect('原短棍仍实际占据手部，不能凭空收物或同时持双手晨曦剑；本次0贡献、0灵性，原物归属与位置不变');
      if (!canPay(state, 3)) return noEffect('当前不足3灵性，凝剑失败；0贡献、0灵性，没有生成晨曦剑，不重抽');
      state.spirituality -= 3; e.swordReady = true;
      return noEffect('凝聚晨曦剑：已耗3灵性，只建立实际持剑状态；本次0贡献，不附送主攻或光之风暴；后续抽中对应槽时另付成本');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -16.25 : 16.25;
      return { ...noEffect(`突破或失衡：本次意外贡献${selfGain > 0 ? '+' : '−'}16.25（G）；0灵性，不构成致伤攻击、不生成或摧毁剑甲`), selfGain };
    }
  }
}

/** Consume only the next unsuppressed, positive physical hit, never an opening/block or an earlier injury. */
export function consumeDawnPaladinArmor(
  state: SliceState, abilityId: string, actualContribution: number, suppressed = false,
): { physicalMultiplier: number; label: string } | null {
  if (suppressed || abilityId !== 'STRIKE' || !Number.isFinite(actualContribution) || actualContribution <= 0 ||
      !currentDawnPaladinCombatSource(state) || !state.dawnPaladin.encounter.armorReady) return null;
  const e = state.dawnPaladin.encounter;
  e.armorReady = false; e.armorExpiresRound = null;
  return { physicalMultiplier: 0.6,
    label: '晨曦光甲承受本次实际物理打击：仅该次普通贡献×0.60，光甲已消耗；未取消行动、不另外减势，未豁免后续伤势或死亡' };
}

/** Called before the common round number advances; terminal cleanup also runs after actual injury/death. */
export function finishDawnPaladinCombatRound(state: SliceState, continuing: boolean): string | null {
  if (!isDawnPaladin(state) || state.combat?.encounterId !== 'DAWN_PALADIN_DISPUTE') return null;
  const e = state.dawnPaladin.encounter;
  if (!continuing) {
    const hadGear = e.swordReady || e.armorReady || e.swordLostRound !== null;
    e.swordReady = false; e.swordLostRound = null; e.armorReady = false; e.armorExpiresRound = null;
    return hadGear ? '本场结束，临时晨曦剑、光甲与失剑回合记录清除；已付灵性、实际伤势和原武器归属保留。' : null;
  }
  if (e.armorReady && e.armorExpiresRound !== null && e.armorExpiresRound <= state.combat.round) {
    e.armorReady = false; e.armorExpiresRound = null;
    return '本回合结束，未触发的晨曦光甲已到原定期限并消散；不补回灵性、不自动重凝。';
  }
  return null;
}
