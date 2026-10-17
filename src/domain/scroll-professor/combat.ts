import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { WizardSpellId } from '../wizard/types.js';
import type { ScrollProfessorScroll } from './types.js';

/** Hermit S6 candidate budgets are G adaptation, not canon damage or a spell catalogue. */
export const SCROLL_PROFESSOR_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 30 }),
  Object.freeze({ id: '2', label: '2次', weight: 32 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 13 }),
]);
export type ScrollProfessorMoveId = 'hermit.s6.scrollcraft' | 'BODY_FOLLOWUP' | 'BRIEF_WARD'
  | 'BLUR_MARK' | 'hermit.s9.ritual-lore' | 'ACCIDENT';
const ABILITIES: readonly {
  id: ScrollProfessorMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'hermit.s6.scrollcraft', label: '已授权冲力原卷轴／已学有限冲力（G；原卷轴1灵性、法术2灵性）', weight: 18, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承实练次击（G；20.475×原格斗掌握×身体；不附赠攻击）', weight: 14, stance: 'ATTACK' },
  { id: 'BRIEF_WARD', label: '已授权防护原卷轴／已学短暂防护／继承灵视（G）', weight: 16, stance: 'DEFEND' },
  { id: 'BLUR_MARK', label: '已学局部遮扰／继承实练牵制（G；没有麻痹卷轴）', weight: 14, stance: 'CONTROL' },
  { id: 'hermit.s9.ritual-lore', label: '复核现有原卷轴准备（0贡献、0消耗；不现场制卷或附加增益）', weight: 30, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '卷轴或动作偏差（G；固定−16.25，不另掷正负）', weight: 8, stance: null },
];

export function isScrollProfessor(state: SliceState): boolean {
  return state.progression?.pathwayId === 'hermit' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function scrollProfessorAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'hermit.s6.scrollcraft' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击（G；16×身体替换主攻，0灵性、不燃毁卷轴）' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawScrollProfessorAbility(random: ActionRandomStream, stance: SliceStance | null): ScrollProfessorMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('卷轴教授能力盘权重无效');
}
export function scrollProfessorActionCount(roll: number): number {
  return roll <= 30 ? 1 : roll <= 62 ? 2 : roll <= 87 ? 3 : 4;
}

/** One actual paid arrival. Daily paper objects and FIRST_CASE do not supply a combat target. */
export interface ScrollProfessorCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'SCROLL_PROFESSOR_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'KARL_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'KARLS_OWN_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_SCROLL_TEACHING_EMPTY_COURTYARD'; visibility: 'MUTUALLY_VISIBLE';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export function currentScrollProfessorCombatSource(state: SliceState): ScrollProfessorCombatSource | null {
  const combat = state.combat, e = state.scrollProfessor.encounter;
  if (!isScrollProfessor(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null || state.world.city !== 'BACKLUND' ||
      !combat || combat.encounterId !== 'SCROLL_PROFESSOR_DISPUTE' || combat.enemyStatus !== 'RESISTING' ||
      !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1 ||
      Object.values(state.scrollProfessor.cases).some(item => item.contactOpen || item.status === 'PREPARED') ||
      !Object.values(state.scrollProfessor.cases).some(item => item.status === 'RESOLVED') ||
      e.status !== 'FIGHTING' || e.attemptWeek !== state.week || e.startHistoryIndex === null ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'SCROLL_PROFESSOR_DISPUTE', attemptWeek: e.attemptWeek, startHistoryIndex: e.startHistoryIndex,
    target: 'KARL_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'KARLS_OWN_ORDINARY_SHORT_CLUB', space: 'ORIGINAL_SCROLL_TEACHING_EMPTY_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND',
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: ScrollProfessorCombatSource | null): boolean {
  const current = currentScrollProfessorCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryFactor(value: number): number {
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(value) ? value : 0)) / 500;
}
function learnedFactor(state: SliceState, id: string): number {
  return masteryFactor(state.progression.mastery[id] ?? 0);
}
function canPay(state: SliceState, amount: number): boolean {
  return Number.isFinite(state.spirituality) && state.spirituality >= amount;
}
function canCast(state: SliceState, spellId: WizardSpellId): boolean {
  return state.wizard.lessons[spellId]?.learned === true && canPay(state, 2);
}

/** Only a unique held original with its own spent real material can be activated. */
function authorizedOriginal(state: SliceState, kind: ScrollProfessorScroll['kind']): ScrollProfessorScroll | null {
  const { scrolls, materials } = state.scrollProfessor.workshop;
  return scrolls.find(scroll => {
    if (scroll.kind !== kind || scroll.authorized !== true || scroll.status !== 'HELD' || scroll.usedWeek !== null ||
        scroll.makerSequence !== 6 || !Number.isFinite(scroll.inscriptionMastery) ||
        scroll.inscriptionMastery < 0 || scroll.inscriptionMastery > 500 ||
        !Number.isSafeInteger(scroll.createdWeek) || scroll.createdWeek < 1 || scroll.createdWeek > state.week ||
        !/^scroll-professor-scroll-[1-9]\d*$/.test(scroll.id) ||
        !/^scroll-professor-material-[1-9]\d*$/.test(scroll.materialId) ||
        scrolls.filter(item => item.id === scroll.id).length !== 1 ||
        scrolls.filter(item => item.materialId === scroll.materialId).length !== 1) return false;
    const inputs = materials.filter(material => material.id === scroll.materialId);
    const input = inputs[0];
    return inputs.length === 1 && input !== undefined && input.status === 'SPENT' &&
      Number.isSafeInteger(input.acquiredWeek) && input.acquiredWeek >= 1 && input.acquiredWeek <= scroll.createdWeek &&
      input.spentWeek === scroll.createdWeek;
  }) ?? null;
}
function burn(state: SliceState, scroll: ScrollProfessorScroll): void {
  state.spirituality -= 1;
  scroll.status = 'USED'; scroll.usedWeek = state.week; scroll.authorized = false;
}
export interface ScrollProfessorCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): ScrollProfessorCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/**
 * Each call consumes exactly one already-drawn action. Only a matching original
 * may burn; there is no combat manufacture, reading roll, free extra strike or
 * unknown foreign scroll. The sealed mastery never follows later player gains.
 */
export function resolveScrollProfessorCombatAbility(
  state: SliceState, id: ScrollProfessorMoveId, physicalStateFactor: number, _random: ActionRandomStream,
  source: ScrollProfessorCombatSource | null = currentScrollProfessorCombatSource(state),
): ScrollProfessorCombatEffect {
  if (!validSource(state, source)) {
    return noEffect('卷轴教授行动：缺少本场实际到场、仍可行动的卡尔与原空院来源；0贡献、0灵性、不燃毁原卷轴、不重抽');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const spellcraft = learnedFactor(state, 'hermit.s7.spellcraft');
  const training = learnedFactor(state, 'hermit.s8.combat-study');
  switch (id) {
    case 'hermit.s6.scrollcraft': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：实际手持原短棍，以16×当前身体系数替换本次主攻（G）；0灵性、不同时释放法术、不燃毁已授权原卷轴',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const scroll = authorizedOriginal(state, 'IMPACT');
      if (scroll && canPay(state, 1)) {
        burn(state, scroll);
        return { label: `自制冲力原卷轴 ${scroll.id}：实际燃毁原件并耗1灵性（G），独立原材料${scroll.materialId}不再生成副本；制作者序列6、刻录掌握${scroll.inscriptionMastery}，38.025×刻录系数且不超过本人当前同槽M500预算38.025；替换本槽，非额外攻击，抵抗也不退款`,
          selfGain: Math.min(38.025, 38.025 * masteryFactor(scroll.inscriptionMastery)), enemyReduction: 0, threatens: true };
      }
      if (canCast(state, 'light-touch')) {
        state.spirituality -= 2;
        return { label: '没有可支付且已授权的冲力原卷轴：使用本人实际已学有限冲力，耗2灵性，38.025×原法术掌握系数（G）替换本槽；不燃毁其它原件、不生成卷轴',
          selfGain: 38.025 * spellcraft, enemyReduction: 0, threatens: true };
      }
      const selfGain = 12 * physical;
      return { label: '没有可用冲力原卷轴，且有限冲力未学会或灵性不足：回退普通身体打击12×当前身体系数（G），0灵性、不透支、不借用未知法术',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 20.475 * training * physical;
      return { label: '继承实练次击：20.475×原格斗训练掌握系数×当前身体系数（G），0灵性；独立占本次行动，不燃毁原卷轴、不附送攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BRIEF_WARD': {
      const scroll = authorizedOriginal(state, 'WARD');
      if (scroll && canPay(state, 1)) {
        burn(state, scroll);
        return { ...noEffect(`自制防护原卷轴 ${scroll.id}：实际燃毁原件并耗1灵性（G），独立原材料${scroll.materialId}只对应本件；制作者序列6、刻录掌握${scroll.inscriptionMastery}，42.25×刻录系数且不超过本人当前同槽M500预算42.25；只进入共同减势，不无敌、不取消敌方行动，抵抗也不退款`),
          enemyReduction: Math.min(42.25, 42.25 * masteryFactor(scroll.inscriptionMastery)) };
      }
      if (canCast(state, 'brief-ward')) {
        state.spirituality -= 2;
        return { ...noEffect('没有可支付且已授权的防护原卷轴：使用本人实际已学短暂防护，耗2灵性，42.25×原法术掌握系数（G）；只进入共同减势，不建立额外护盾或取消行动'),
          enemyReduction: 42.25 * spellcraft };
      }
      if (canPay(state, 1)) {
        state.spirituality -= 1;
        return { ...noEffect('短暂防护未学会或灵性不足：回退继承有限灵视，耗1灵性，21.125×原灵视掌握系数（G）；不读取对方秘密、不预知、不编造幻象'),
          enemyReduction: 21.125 * learnedFactor(state, 'hermit.s9.spirit-vision') };
      }
      return { ...noEffect('防护卷轴、法术与灵视的灵性均不足：普通格挡10×当前身体系数（G），0灵性，不透支'),
        enemyReduction: 10 * physical };
    }
    case 'BLUR_MARK':
      if (canCast(state, 'blur-mark')) {
        state.spirituality -= 2;
        return { ...noEffect('已学局部遮扰：耗2灵性，仅作用于眼前局部视线，22.75×原法术掌握系数（G）；只进入共同减势，不绝对隐形、不取消行动、不凭空提供麻痹卷轴'),
          enemyReduction: 22.75 * spellcraft };
      }
      return { ...noEffect('局部遮扰未学会或灵性不足：回退继承实练走位牵制18.9×原格斗掌握系数×当前身体系数（G），0灵性，不保证控制、不燃毁其它原卷轴'),
        enemyReduction: 18.9 * training * physical };
    case 'hermit.s9.ritual-lore': {
      const ready = [authorizedOriginal(state, 'IMPACT'), authorizedOriginal(state, 'WARD')]
        .filter((scroll): scroll is ScrollProfessorScroll => scroll !== null).map(scroll => scroll.id);
      return noEffect(`复核现有原卷轴准备：${ready.length ? `首先可用的已授权原件${ready.join('、')}` : '当前没有已授权可用原件'}；本次0贡献、0灵性，不现场制卷、不自动授权、不延长次数、不积累增益或附加攻击`);
    }
    case 'ACCIDENT':
      return { ...noEffect('卷轴或动作偏差：本次自身优势固定−16.25（隐者候选G），0灵性；不另掷正负、不构成致伤攻击、不编造污染、不毁坏未使用原卷轴'), selfGain: -16.25 };
  }
}
