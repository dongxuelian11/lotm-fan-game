import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Death V2 S7 C-profile: U45, A0.8, E0.9. Contribution budgets are game balance (G). */
export const SPIRITMEDIUM_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 22 }),
  Object.freeze({ id: '2', label: '2次', weight: 28 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 17 }),
  Object.freeze({ id: '5', label: '5次', weight: 8 }),
]);

/** FIRST_CASE has ordinary actions only; it supplies no death-eye target. */
export type SpiritmediumMoveId = 'BODY_STRIKE' | 'BODY_FOLLOWUP' | 'COVER'
  | 'SITE_PRESSURE' | 'RITUAL_PREPARATION' | 'ACCIDENT' | 'death.s6.dead-words';
const ABILITIES: readonly {
  id: SpiritmediumMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'BODY_STRIKE', label: '实际身体/持握武器攻击', weight: 20, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '实际身体次击', weight: 15, stance: 'ATTACK' },
  { id: 'COVER', label: '实际掩护与闪避', weight: 20, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '普通牵制，死亡之眼无适用对象', weight: 23, stance: 'CONTROL' },
  { id: 'RITUAL_PREPARATION', label: '通灵仪式准备（无可借力原灵）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差', weight: 7, stance: null },
];

// S7's default wheel, order, costs and integer-ticket boundaries stay exact.
const SPIRIT_GUIDE_ABILITIES: typeof ABILITIES = [
  ...ABILITIES.map(ability => ({ ...ability, weight: ability.id === 'SITE_PRESSURE' ? 10
    : ability.id === 'RITUAL_PREPARATION' ? 10 : ability.weight })),
  { id: 'death.s6.dead-words', label: '有限亡者之语', weight: 18, stance: 'CONTROL' },
];
export function isSpiritGuide(state: SliceState): boolean {
  return state.progression?.pathwayId === 'death' && state.progression.sequence === 6;
}
export function hasSpiritmediumCombat(state: SliceState): boolean {
  return isSpiritmedium(state) || isSpiritGuide(state);
}
export function isSpiritmedium(state: SliceState): boolean {
  return state.progression?.pathwayId === 'death' && state.progression.sequence === 7;
}
function abilities(sequence: number): typeof ABILITIES { return sequence === 6 ? SPIRIT_GUIDE_ABILITIES : ABILITIES; }
function tickets(stance: SliceStance | null, sequence: number): number[] {
  return abilities(sequence).map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function spiritmediumAbilityWheel(stance: SliceStance | null, sequence = 7): SliceWheelEntry[] {
  const weights = tickets(stance, sequence), total = weights.reduce((sum, weight) => sum + weight, 0);
  return abilities(sequence).map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawSpiritmediumAbility(random: ActionRandomStream, stance: SliceStance | null, sequence = 7): SpiritmediumMoveId {
  const entries = abilities(sequence), weights = tickets(stance, sequence);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return entries[index]!.id;
  }
  throw new Error('通灵者能力盘权重无效');
}
export function spiritmediumActionCount(roll: number): number {
  return roll <= 22 ? 1 : roll <= 50 ? 2 : roll <= 75 ? 3 : roll <= 92 ? 4 : 5;
}

export interface SpiritmediumCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): SpiritmediumCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * This source is the current ordinary human on the existing dry passage.
 * No authored undead/spirit-world target means no death-eye K sub-entry or
 * weakness mark. No cold/decay threat means no resistance B sub-entry. The
 * eligible ordinary actions retain their category budgets, not extra effects.
 * S7 can perform spirit rituals and borrow from different actual local spirits,
 * but FIRST_CASE has none. Earlier life scenes and their original spirits,
 * communication and one-paper borrowing never become an ally or combat asset.
 * Direct death spells belong to higher sequences, not this S7 profile.
 */
export interface SpiritmediumFirstCaseSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; space: 'DRY_GROUND_PASSAGE';
  coldThreat: 'NONE'; decayThreat: 'NONE'; undead: 'NONE'; spiritWorldTarget: 'NONE';
  localSpirit: 'NONE'; borrowableSpirit: 'NONE';
}
export function currentSpiritmediumCombatSource(state: SliceState): SpiritmediumCombatSource | null {
  if (isSpiritGuide(state)) return currentSpiritGuideCombatSource(state);
  if (!isSpiritmedium(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
    coldThreat: 'NONE', decayThreat: 'NONE', undead: 'NONE', spiritWorldTarget: 'NONE',
    localSpirit: 'NONE', borrowableSpirit: 'NONE' };
}
/** The authored S6 visit identifies the living adult's spirit, not an undead ally. */
export interface SpiritGuideCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'SPIRIT_GUIDE_DISPUTE'; target: 'DEAN_SINGLE_ORDINARY_ADULT';
  nature: 'ORDINARY_HUMAN'; sunVulnerable: false;
  body: 'CURRENT_REACHABLE_BODY'; humanSpirit: 'CURRENT_ORDINARY_HUMAN_SPIRIT'; targetWill: 14;
  scope: 'CURRENT_VISIBLE_SINGLE_TARGET'; attemptWeek: number; startHistoryIndex: number;
  weapon: 'DEANS_ORDINARY_SHORT_CLUB'; space: 'ORIGINAL_MEMORIAL_WORKROOM_OUTER_COURTYARD';
  visibility: 'MUTUALLY_VISIBLE'; lighting: 'ORIGINAL_FIXED_LAMPLIGHT';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  coldThreat: 'NONE'; decayThreat: 'NONE'; undead: 'NONE'; spiritWorldTarget: 'NONE';
  localSpirit: 'NONE'; borrowableSpirit: 'NONE';
}
export type SpiritmediumCombatSource = SpiritmediumFirstCaseSource | SpiritGuideCombatSource;
function hasLiveSpiritGuideCombat(state: SliceState): boolean {
  return isSpiritGuide(state) && state.status === 'ACTIVE' && state.health > 0 && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}
export function currentSpiritGuideCombatSource(state: SliceState): SpiritGuideCombatSource | null {
  const combat = state.combat;
  if (!hasLiveSpiritGuideCombat(state) || state.activeEvent !== null || state.world.city !== 'BACKLUND' ||
      !combat || combat.encounterId !== 'SPIRIT_GUIDE_DISPUTE' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      Object.values(state.spiritGuide.cases).some(item => item.contactOpen || item.status === 'PREPARED')) return null;
  const encounter = state.spiritGuide.encounter;
  if (encounter.status !== 'FIGHTING' || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(encounter.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'SPIRIT_GUIDE_DISPUTE', target: 'DEAN_SINGLE_ORDINARY_ADULT', nature: 'ORDINARY_HUMAN',
    sunVulnerable: false, body: 'CURRENT_REACHABLE_BODY', humanSpirit: 'CURRENT_ORDINARY_HUMAN_SPIRIT',
    targetWill: 14, scope: 'CURRENT_VISIBLE_SINGLE_TARGET', attemptWeek: encounter.attemptWeek,
    startHistoryIndex: encounter.startHistoryIndex, weapon: 'DEANS_ORDINARY_SHORT_CLUB',
    space: 'ORIGINAL_MEMORIAL_WORKROOM_OUTER_COURTYARD', visibility: 'MUTUALLY_VISIBLE',
    lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND',
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false,
    coldThreat: 'NONE', decayThreat: 'NONE', undead: 'NONE', spiritWorldTarget: 'NONE',
    localSpirit: 'NONE', borrowableSpirit: 'NONE' };
}
function validCombatSource(state: SliceState, source: SpiritmediumCombatSource | null): boolean {
  const current = currentSpiritmediumCombatSource(state);
  if (current === null || source === null || source.runId !== current.runId ||
      source.revision !== current.revision || source.week !== current.week ||
      source.encounterId !== current.encounterId || source.round !== current.round ||
      source.target !== current.target || source.nature !== current.nature ||
      source.body !== current.body || source.space !== current.space ||
      source.coldThreat !== current.coldThreat || source.decayThreat !== current.decayThreat ||
      source.undead !== current.undead || source.spiritWorldTarget !== current.spiritWorldTarget ||
      source.localSpirit !== current.localSpirit || source.borrowableSpirit !== current.borrowableSpirit) return false;
  if (current.encounterId === 'FIRST_CASE') return true;
  return source.encounterId === 'SPIRIT_GUIDE_DISPUTE' && source.sunVulnerable === current.sunVulnerable &&
    source.humanSpirit === current.humanSpirit && source.targetWill === current.targetWill &&
    source.scope === current.scope && source.attemptWeek === current.attemptWeek &&
    source.startHistoryIndex === current.startHistoryIndex && source.weapon === current.weapon &&
    source.visibility === current.visibility && source.lighting === current.lighting &&
    source.distanceMetres === current.distanceMetres && source.ground === current.ground &&
    source.bystanders === current.bystanders && source.exit === current.exit && source.pursuit === current.pursuit;
}
function deadWordsMasteryFactor(state: SliceState): number {
  const mastery = state.progression.mastery['death.s6.dead-words'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}
function bodyMasteryFactor(state: SliceState): number {
  // Inherited physique governs body/ordinary options. S7 ritual, communication
  // and borrowing mastery cannot manufacture a present source or buff the body.
  const mastery = state.progression.mastery['death.s9.corpse-physique'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

/** One original action slot, with no summons, marks, ghost damage or immunity. */
export function resolveSpiritmediumCombatAbility(
  state: SliceState, id: SpiritmediumMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: SpiritmediumCombatSource | null = currentSpiritmediumCombatSource(state),
): SpiritmediumCombatEffect {
  if (id === 'death.s6.dead-words') {
    if (!hasLiveSpiritGuideCombat(state)) return noEffect('有限亡者之语：当前没有可结算的死灵导师战斗行动');
    if (!validCombatSource(state, source) || source?.encounterId !== 'SPIRIT_GUIDE_DISPUTE' ||
        !Number.isFinite(state.spirituality) || state.spirituality < 3) {
      return { ...noEffect('有限亡者之语：缺少当前已知、可触及的普通人灵体来源或3点灵性，改用普通格挡护身；不耗灵性、不抽检定'), enemyReduction: 10 };
    }
    state.spirituality -= 3;
    const check = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
      difficulty: source.targetWill, modifiers: [], roll: random.nextInt(1, 100) });
    const succeeded = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
    return { ...noEffect(`有限亡者之语：已耗3点灵性；意志难度14检定${check.chance}%，实抽${check.roll}/100，${succeeded
      ? '成功；只对本场迪恩已知、可触及的普通人灵体施加有限压迫，减势16×本能力掌握系数（G）'
      : '失败；本次贡献0，灵性不退回'}；不直接损伤身体、不触发即死、不强迫服从，也不取消对方实际短棍攻击；不招来战斗帮手、不打开冥界之门或复活死者`),
      enemyReduction: succeeded ? 16 * deadWordsMasteryFactor(state) : 0 };
  }
  if (!validCombatSource(state, source)) {
    return noEffect('通灵者行动：缺少本场仍可触及的普通对手与真实现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const factor = bodyMasteryFactor(state);
  switch (id) {
    case 'BODY_STRIKE': {
      const armed = state.town.clubLocation === 'HAND';
      const selfGain = (armed ? 16 : 23.4 * factor) * physical;
      return { label: armed
        ? '持握原短棍打击：采用普通短棍16贡献（G），替换而不叠加主攻预算；由真实身体实施'
        : isSpiritGuide(state)
        ? '实际身体攻击：以本人近身动作应对普通成年迪恩；没有死亡之眼弱点加成，不把亡者之语叠加为身体伤害'
        : '实际身体攻击：以本人近身动作应对普通携铃者；没有死亡之眼弱点加成或死亡法术',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 12.6 * factor * physical;
      return { label: '实际身体次击：只结算本次身体动作的次攻预算；现场无可借力原灵，不把仪式、沟通或旧纸签借力转化为幽灵伤害，也不另赠攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'COVER':
      return { ...noEffect('实际掩护与闪避：只以现场普通自保减势；没有寒冷或腐烂来源可供尸体抗性匹配，普通短棍仍可伤人'),
        enemyReduction: 26.325 * factor };
    case 'SITE_PRESSURE':
      return { ...noEffect(isSpiritGuide(state)
        ? '普通牵制，死亡之眼无适用对象：只结算眼前普通成年迪恩的现场走位减势；普通人灵体不是适用亡灵弱点，不即死、不召灵或控制亡灵'
        : '普通牵制，死亡之眼无适用对象：只结算眼前普通携铃者的现场走位减势；不标记人体弱点、不即死、不召灵或控制亡灵'),
        enemyReduction: 14.175 * factor };
    case 'RITUAL_PREPARATION':
      return noEffect(isSpiritGuide(state)
        ? '通灵仪式准备：本次贡献0；现场没有可借力原灵，不凭空招来战斗帮手；生活中新招信使只同意一次相邻房间送信，不用于攻击、掩护撤退或挡伤；不打开冥界之门、不复活死者、不宣称所有灵必须服从'
        : '通灵仪式准备：本次贡献0；现场没有既存可沟通、可借力的原灵，不临时召来盟友、不搬入生活现场的灵或纸签借力，也不读取死者证言、揭示案件真相或施放高阶死亡法术');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`动作偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成致伤攻击`), selfGain };
    }
  }
}
