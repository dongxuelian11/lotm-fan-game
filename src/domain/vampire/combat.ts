import { currentCrimsonScholarCombatSource, type CrimsonScholarCombatSource } from '../crimson-scholar/combat.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Finite S7 game balance (G), not quantitative claims about the novel. */
export const VAMPIRE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 25 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
  Object.freeze({ id: '6', label: '6次', weight: 5 }),
]);

export type VampireMoveId = 'STRIKE' | 'BLOCK' | 'DISTANCE' | 'MISS'
  | 'moon.s7.abyss-shackles' | 'moon.s7.dark-wings' | 'moon.s7.regeneration';

// Blood scent is an observed event clue, never an attack or a source of secrets.
// S6 inherits this exact finite wheel. Its daily prepared medicines and teaching
// do not supply combat slots, automatic use, a new multiplier or free effects.
const ABILITIES: readonly {
  id: VampireMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'STRIKE', label: '普通打击', weight: 25, stance: 'ATTACK' },
  { id: 'BLOCK', label: '格挡护身', weight: 15, stance: 'DEFEND' },
  { id: 'DISTANCE', label: '拉开距离', weight: 10, stance: 'PREPARE' },
  { id: 'moon.s7.abyss-shackles', label: '深渊枷锁', weight: 20, stance: 'CONTROL' },
  { id: 'moon.s7.dark-wings', label: '黑暗之翼', weight: 15, stance: 'DEFEND' },
  { id: 'moon.s7.regeneration', label: '有限再生', weight: 10, stance: 'DEFEND' },
  { id: 'MISS', label: '动作落空', weight: 5, stance: null },
];

export function isVampire(state: SliceState): boolean {
  return state.progression?.pathwayId === 'moon' &&
    (state.progression.sequence === 7 || state.progression.sequence === 6);
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function vampireAbilityWheel(stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({
    id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100,
  }));
}
export function drawVampireAbility(random: ActionRandomStream, stance: SliceStance | null): VampireMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('吸血鬼能力盘权重无效');
}
export function vampireActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 30 ? 2 : roll <= 55 ? 3 : roll <= 80 ? 4 : roll <= 95 ? 5 : 6;
}

export interface VampireCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): VampireCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
function ordinaryBlock(prefix = ''): VampireCombatEffect {
  return { ...noEffect(`${prefix}格挡护身`), enemyReduction: 10 };
}
function hasLiveCombat(state: SliceState): boolean {
  return isVampire(state) && state.status === 'ACTIVE' && state.health > 0 &&
    state.world.city === 'BACKLUND' && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}

interface VampireS7BodySource {
  encounterId: 'VAMPIRE_DISPUTE'; round: number; attemptWeek: number; startHistoryIndex: number;
  target: 'BROOK_SINGLE_ORDINARY_ADULT'; body: 'CURRENT_VISIBLE_BODY';
  space: 'LAMPLIT_OPEN_YARD'; shadow: 'VISIBLE_LAMPLIT_SHADOW';
  aggression: 'VISIBLE_SHORT_CLUB_THREAT';
}

export interface PotionProfessorCombatSource {
  encounterId: 'POTION_PROFESSOR_DISPUTE';
  round: number; attemptWeek: number; startHistoryIndex: number;
  target: 'EVAN_SINGLE_ORDINARY_ADULT'; body: 'CURRENT_VISIBLE_BODY';
  weapon: 'EVANS_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_NIGHT_PHARMACY_OUTER_COURTYARD';
  lighting: 'ORIGINAL_FIXED_LAMPLIGHT'; shadow: 'EVANS_VISIBLE_ORIGINAL_SHADOW';
  aggression: 'VISIBLE_SHORT_CLUB_THREAT';
  distanceMetres: 2; ground: 'ORDINARY'; bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export type VampireBodySource = VampireS7BodySource | PotionProfessorCombatSource;

/** This paid visit supplies its own adult, original shadow and ordinary exit. */
export function currentPotionProfessorCombatSource(state: SliceState): PotionProfessorCombatSource | null {
  const combat = state.combat;
  if (!hasLiveCombat(state) || state.progression.sequence !== 6 || state.activeEvent !== null ||
      !combat || combat.encounterId !== 'POTION_PROFESSOR_DISPUTE' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1) return null;
  const encounter = state.potionProfessor.encounter;
  if (encounter.status !== 'FIGHTING' || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1) return null;
  return {
    encounterId: 'POTION_PROFESSOR_DISPUTE', round: combat.round,
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    target: 'EVAN_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY',
    weapon: 'EVANS_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_NIGHT_PHARMACY_OUTER_COURTYARD',
    lighting: 'ORIGINAL_FIXED_LAMPLIGHT', shadow: 'EVANS_VISIBLE_ORIGINAL_SHADOW',
    aggression: 'VISIBLE_SHORT_CLUB_THREAT', distanceMetres: 2, ground: 'ORDINARY',
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false,
  };
}

/** Only this attempt's public observation establishes Brook, light, shadow and space. */
export function currentVampireBodySource(state: SliceState): VampireBodySource | null {
  if (state.combat?.encounterId === 'POTION_PROFESSOR_DISPUTE') return currentPotionProfessorCombatSource(state);
  const encounter = state.vampire.encounter;
  if (!hasLiveCombat(state) || state.progression.sequence !== 7 || state.combat!.encounterId !== 'VAMPIRE_DISPUTE' ||
      encounter.status !== 'FIGHTING' || !encounter.observed ||
      encounter.attemptWeek !== state.week || encounter.startHistoryIndex === null) return null;
  return { encounterId: 'VAMPIRE_DISPUTE', round: state.combat!.round,
    attemptWeek: encounter.attemptWeek, startHistoryIndex: encounter.startHistoryIndex,
    target: 'BROOK_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY',
    space: 'LAMPLIT_OPEN_YARD', shadow: 'VISIBLE_LAMPLIT_SHADOW',
    aggression: 'VISIBLE_SHORT_CLUB_THREAT' };
}
function validBodySource(state: SliceState, source: VampireBodySource | null): boolean {
  const current = currentVampireBodySource(state);
  if (current === null || source === null) return false;
  if (current.encounterId === 'POTION_PROFESSOR_DISPUTE' &&
      (source.encounterId !== 'POTION_PROFESSOR_DISPUTE' ||
       source.weapon !== current.weapon || source.lighting !== current.lighting ||
       source.distanceMetres !== current.distanceMetres || source.ground !== current.ground ||
       source.bystanders !== current.bystanders || source.exit !== current.exit ||
       source.pursuit !== current.pursuit)) return false;
  return source.encounterId === current.encounterId &&
    source.round === current.round && source.attemptWeek === current.attemptWeek &&
    source.startHistoryIndex === current.startHistoryIndex && source.target === current.target &&
    source.body === current.body && source.space === current.space && source.shadow === current.shadow &&
    source.aggression === current.aggression;
}

/** One drawn action, one cost/check. Existing physical consequences remain authoritative. */
export function resolveVampireCombatAbility(
  state: SliceState, id: VampireMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: VampireBodySource | null = currentVampireBodySource(state),
): VampireCombatEffect {
  if (!hasLiveCombat(state)) return noEffect('吸血鬼能力：当前没有可结算的对应战斗行动');
  if (state.combat!.encounterId === 'POTION_PROFESSOR_DISPUTE' && !currentPotionProfessorCombatSource(state)) {
    return noEffect('继承的吸血鬼能力：本次原药房外院的到场与目标来源无效');
  }
  switch (id) {
    case 'STRIKE': {
      const armed = state.town.clubLocation === 'HAND';
      return { label: armed ? '持握原短棍打击' : '普通打击',
        selfGain: (armed ? 16 : 12) * physicalStateFactor, enemyReduction: 0, threatens: true };
    }
    case 'BLOCK': return ordinaryBlock();
    case 'DISTANCE': return { ...noEffect('拉开距离：仍在当前现场避让，不等于撤离'), enemyReduction: 8 };
    case 'MISS': return noEffect('动作落空：这次行动未形成有效优势');
    case 'moon.s7.abyss-shackles':
    case 'moon.s7.dark-wings':
    case 'moon.s7.regeneration': {
      const name = ABILITIES.find(ability => ability.id === id)!.label;
      const fallback = (reason: string) => ordinaryBlock(
        `${name}：${reason}，未施术、未耗灵性、不重抽，本次改用`,
      );
      if (id === 'moon.s7.regeneration') {
        if (!(state.health < 100)) return fallback('当前健康已满，无需再生');
      } else if (!validBodySource(state, source)) {
        return fallback('缺少本次已亲见的本人、灯影及同场腾挪空间');
      }
      if (!(state.spirituality >= 3)) return fallback('灵性不足3');
      state.spirituality -= 3;
      if (id === 'moon.s7.regeneration') {
        const healed = Math.min(6, 100 - state.health);
        state.health += healed;
        return { ...noEffect(`有限再生：耗灵性3，健康恢复${healed}、己方优势+8（G）；原伤势、治疗记录和带伤败北风险保留，不恢复精神或复活`),
          selfGain: 8 };
      }
      const potionProfessorScene = source?.encounterId === 'POTION_PROFESSOR_DISPUTE';
      if (id === 'moon.s7.dark-wings') return {
        ...noEffect(potionProfessorScene
          ? '黑暗之翼：耗灵性3，本人在已亲见的原药房灯照外院短促振翼避让，对方优势−22（G）；仍在原现场，不飞越墙壁、不免伤、不携人转移，也未自动逃脱'
          : '黑暗之翼：耗灵性3，本人在已观察的灯照院落短促振翼避让，对方优势−22（G）；仍在原现场，不免伤、不携人转移，也未自动逃脱'),
        enemyReduction: 22,
      };
      const result = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
        difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
      state.lastCheck = result;
      const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      const tier = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' }[result.tier];
      return { ...noEffect(`深渊枷锁：耗灵性3，意志${result.roll}/${result.chance}，${tier}；${success
        ? potionProfessorScene
          ? '借原固定照明下艾文本人的原影短暂牵制眼前身体，对方优势−24（G）'
          : '借当前灯下影子短暂牵制眼前布鲁克的身体，对方优势−24（G）'
        : '没能牵制眼前身体，对方优势不变'}；不删除行动、不造成直接伤害，也不建立绝对控制`),
        enemyReduction: success ? 24 : 0 };
    }
  }
  return noEffect('当前能力不在继承的有限战斗盘中；未施术、未用药、未耗灵性');
}

/** S5-only inherited adapter. It does not broaden isVampire, change its wheel,
 * or authorize old S7 abilities in another scene. Exact S7 costs/checks stay G. */
export function resolveCrimsonScholarVampireAbility(
  state: SliceState, id: 'moon.s7.dark-wings' | 'moon.s7.abyss-shackles', random: ActionRandomStream,
  source: CrimsonScholarCombatSource | null = currentCrimsonScholarCombatSource(state),
): VampireCombatEffect {
  const current = currentCrimsonScholarCombatSource(state);
  if (!current || !source || !Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value)) {
    return noEffect('继承吸血鬼能力：缺少本轮原身体和原活敌来源，0效果、0消耗，不重抽');
  }
  const name = id === 'moon.s7.dark-wings' ? '黑暗之翼' : '深渊枷锁';
  const fallback = (reason: string) => ordinaryBlock(`${name}：${reason}，未施术、未耗灵性、不重抽，本次改用`);
  if (source.encounterId !== 'CRIMSON_SCHOLAR_DISPUTE' ||
      source.moonlight !== 'CURRENT_AUTHORED_COURTYARD_MOONLIGHT' || source.shadow !== 'SIDS_CURRENT_ORIGINAL_SHADOW') {
    return fallback('本场没有已核实的原照明、原影及同场腾挪空间');
  }
  if (!Number.isFinite(state.spirituality) || state.spirituality < 3) return fallback('灵性不足3');
  state.spirituality -= 3;
  if (id === 'moon.s7.dark-wings') return {
    ...noEffect('继承黑暗之翼：耗灵性3，在已亲见的原私人月照庭院短促振翼避让，对方优势−22（沿用S7原创G）；仍在原场地，不飞越墙壁、不免伤、不携人转移，也未自动撤退'),
    enemyReduction: 22,
  };
  const result = resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
    difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
  state.lastCheck = result;
  const success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
  const tier = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' }[result.tier];
  return { ...noEffect(`继承深渊枷锁：耗灵性3，意志${result.roll}/${result.chance}，${tier}；${success
    ? '借当前月照下西德本人的原影短暂牵制原身体，对方优势−24（沿用S7原创G）'
    : '没能牵制西德的原身体，对方优势不变'}；不删除任何实际行动、不造成直接伤害，不建立绝对控制或强迫投降`),
    enemyReduction: success ? 24 : 0 };
}
