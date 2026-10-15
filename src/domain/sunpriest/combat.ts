import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { applyAuthoredSunVulnerability } from '../lightprayer/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Confirmed Sun V1 S7 D-profile. Numeric contributions are game balance (G). */
export const SUNPRIEST_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 22 }),
  Object.freeze({ id: '2', label: '2次', weight: 28 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 17 }),
  Object.freeze({ id: '5', label: '5次', weight: 8 }),
]);
export type SunpriestMoveId = 'sun.s7.holy-light' | 'SUNPRIEST_LIGHTFIRE' | 'sun.s7.sacred-oath'
  | 'sun.s7.sun-aura' | 'sun.s7.holy-water' | 'ACCIDENT' | 'sun.s6.notarization';
const ABILITIES: readonly {
  id: SunpriestMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'sun.s7.holy-light', label: '有限圣光', weight: 32, stance: 'ATTACK' },
  { id: 'SUNPRIEST_LIGHTFIRE', label: '有限光焰', weight: 18, stance: 'ATTACK' },
  { id: 'sun.s7.sacred-oath', label: '神圣誓约与自身恐惧抵御', weight: 12, stance: 'DEFEND' },
  { id: 'sun.s7.sun-aura', label: '太阳光环的眼前压迫', weight: 10, stance: 'CONTROL' },
  { id: 'sun.s7.holy-water', label: '神圣之水仪式准备', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '光焰偏差或誓约失稳', weight: 20, stance: null },
];

// S7 defaults and integer tickets remain exact; signed contracts belong only to daily scenes.
const NOTARY_ABILITIES: typeof ABILITIES = [
  ...ABILITIES.map(ability => ({ ...ability, weight: ability.id === 'sun.s7.holy-light' ? 24
    : ability.id === 'ACCIDENT' ? 13 : ability.weight })),
  { id: 'sun.s6.notarization', label: '本回合有限能力公证', weight: 15, stance: 'CONTROL' },
];
export function isNotary(state: SliceState): boolean {
  return state.progression?.pathwayId === 'sun' && state.progression.sequence === 6;
}
export function hasSunpriestCombat(state: SliceState): boolean {
  return isSunpriest(state) || isNotary(state);
}
export function isSunpriest(state: SliceState): boolean {
  return state.progression?.pathwayId === 'sun' && state.progression.sequence === 7;
}
function abilities(sequence: number): typeof ABILITIES { return sequence === 6 ? NOTARY_ABILITIES : ABILITIES; }
function tickets(stance: SliceStance | null, sequence: number): number[] {
  return abilities(sequence).map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function sunpriestAbilityWheel(stance: SliceStance | null, sequence = 7): SliceWheelEntry[] {
  const weights = tickets(stance, sequence), total = weights.reduce((sum, weight) => sum + weight, 0);
  return abilities(sequence).map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawSunpriestAbility(random: ActionRandomStream, stance: SliceStance | null, sequence = 7): SunpriestMoveId {
  const entries = abilities(sequence), weights = tickets(stance, sequence);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return entries[index]!.id;
  }
  throw new Error('太阳神官能力盘权重无效');
}
export function sunpriestActionCount(roll: number): number {
  return roll <= 22 ? 1 : roll <= 50 ? 2 : roll <= 75 ? 3 : roll <= 92 ? 4 : 5;
}

/** FIRST_CASE authors an ordinary present human, never an inferred evil or undead target. */
export interface SunpriestFirstCaseSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN'; sunVulnerable: false;
  scope: 'CURRENT_VISIBLE_SINGLE_TARGET';
}
export function currentSunpriestCombatSource(state: SliceState): SunpriestCombatSource | null {
  if (isNotary(state)) return currentNotaryCombatSource(state);
  if (!isSunpriest(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round,
    target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', nature: 'ORDINARY_HUMAN', sunVulnerable: false,
    scope: 'CURRENT_VISIBLE_SINGLE_TARGET' };
}
/** The visit identifies one real adult and his own club, independent of the old carrier. */
export interface NotaryCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'NOTARY_DISPUTE'; target: 'BREN_SINGLE_ORDINARY_ADULT';
  nature: 'ORDINARY_HUMAN'; sunVulnerable: false; scope: 'CURRENT_VISIBLE_SINGLE_TARGET';
  attemptWeek: number; startHistoryIndex: number;
  weapon: 'BRENS_ORDINARY_SHORT_CLUB';
  space: 'ORIGINAL_CHAPEL_WORKROOM_OUTER_COURTYARD';
  visibility: 'MUTUALLY_VISIBLE'; lighting: 'ORIGINAL_FIXED_LAMPLIGHT';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND';
  bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
}
export type SunpriestCombatSource = SunpriestFirstCaseSource | NotaryCombatSource;
function hasLiveNotaryCombat(state: SliceState): boolean {
  return isNotary(state) && state.status === 'ACTIVE' && state.health > 0 && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}
export function currentNotaryCombatSource(state: SliceState): NotaryCombatSource | null {
  const combat = state.combat;
  if (!hasLiveNotaryCombat(state) || state.activeEvent !== null || state.world.city !== 'BACKLUND' ||
      !combat || combat.encounterId !== 'NOTARY_DISPUTE' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      Object.values(state.notary.cases).some(item => item.contactOpen || item.status === 'PREPARED') ||
      state.notary.contract.tool !== 'TABLE' || state.notary.contract.active) return null;
  const encounter = state.notary.encounter;
  if (encounter.status !== 'FIGHTING' || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(encounter.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'NOTARY_DISPUTE', target: 'BREN_SINGLE_ORDINARY_ADULT', nature: 'ORDINARY_HUMAN',
    sunVulnerable: false, scope: 'CURRENT_VISIBLE_SINGLE_TARGET', attemptWeek: encounter.attemptWeek,
    startHistoryIndex: encounter.startHistoryIndex, weapon: 'BRENS_ORDINARY_SHORT_CLUB',
    space: 'ORIGINAL_CHAPEL_WORKROOM_OUTER_COURTYARD', visibility: 'MUTUALLY_VISIBLE',
    lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND',
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validCombatSource(state: SliceState, source: SunpriestCombatSource | null): boolean {
  const current = currentSunpriestCombatSource(state);
  if (current === null || source === null || source.runId !== current.runId ||
      source.revision !== current.revision || source.week !== current.week ||
      source.encounterId !== current.encounterId || source.round !== current.round ||
      source.target !== current.target || source.nature !== current.nature ||
      source.sunVulnerable !== current.sunVulnerable || source.scope !== current.scope) return false;
  if (current.encounterId === 'FIRST_CASE') return true;
  return source.encounterId === 'NOTARY_DISPUTE' && source.attemptWeek === current.attemptWeek &&
    source.startHistoryIndex === current.startHistoryIndex && source.weapon === current.weapon &&
    source.space === current.space && source.visibility === current.visibility && source.lighting === current.lighting &&
    source.distanceMetres === current.distanceMetres && source.ground === current.ground &&
    source.bystanders === current.bystanders && source.exit === current.exit && source.pursuit === current.pursuit;
}

/** Resolver-local only. Never serialize or reconstruct certification from prior rounds. */
export interface NotaryRoundContext {
  source: NotaryCombatSource | null;
  validityReady: boolean;
}
export function createNotaryRoundContext(state: SliceState): NotaryRoundContext {
  return { source: currentNotaryCombatSource(state), validityReady: false };
}
export function finishNotaryCombatRound(context: NotaryRoundContext): string {
  if (!context.validityReady) return '';
  context.validityReady = false;
  return '本回合能力公证未等到自身实际圣光或光焰，随本回合结束失效；没有即时贡献，也不带入后续回合。';
}
function applyNotaryCertification(
  state: SliceState, context: NotaryRoundContext, effect: SunpriestCombatEffect,
): SunpriestCombatEffect {
  if (!context.validityReady || !isNotary(state) || !validCombatSource(state, context.source) ||
      !Number.isFinite(effect.selfGain) || effect.selfGain <= 0) return effect;
  context.validityReady = false;
  return { ...effect, selfGain: effect.selfGain * 1.15,
    label: effect.label + '；本回合先前有限能力公证只在这次自身实际施展的神术上生效，正向贡献×1.15（G），一次消耗；不增加攻击或行动' };
}
function masteryFactor(state: SliceState, id: 'sun.s7.holy-light' | 'sun.s7.sacred-oath' | 'sun.s7.sun-aura'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

export interface SunpriestCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): SunpriestCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** One original player slot. Certification affects only a later actual spell in this same round. */
export function resolveSunpriestCombatAbility(
  state: SliceState, id: SunpriestMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: SunpriestCombatSource | null = currentSunpriestCombatSource(state),
  context: NotaryRoundContext = createNotaryRoundContext(state),
): SunpriestCombatEffect {
  if (id === 'sun.s6.notarization') {
    if (!hasLiveNotaryCombat(state)) return noEffect('有限能力公证：当前没有可结算的公证人战斗行动');
    if (!validCombatSource(state, source) || !validCombatSource(state, context.source) || context.validityReady ||
        !Number.isFinite(state.spirituality) || state.spirituality < 3) {
      return { ...noEffect('有限能力公证：缺少当前真实来源或3点灵性，或本回合已有待用公证，改用普通格挡护身；不耗灵性、不抽检定、不叠加公证'), enemyReduction: 10 };
    }
    state.spirituality -= 3;
    const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: state.character.coreStats.knowledge,
      difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
    const succeeded = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
    context.validityReady = succeeded;
    return noEffect(`有限能力公证：已耗3点灵性；知识难度14检定${check.chance}%，实抽${check.roll}/100，${succeeded
      ? '成功；只为本回合稍后自身实际施展的下一次圣光或光焰保留一次×1.15正向贡献（G）'
      : '失败；未形成有效公证，灵性不退回'}；本槽即时贡献0，只限本回合，未等到实际神术则回合末失效；不认证普通短棍、意外或他人行动，不以一句话改写现实，不给未同意的布伦强立契约`);
  }
  if (!validCombatSource(state, source)) {
    return noEffect('太阳神官能力：缺少当前可见普通对手来源，本次贡献0；不借用旧现场、远方队友或未知目标');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  switch (id) {
    case 'sun.s7.holy-light': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：本次物理主攻16替代圣光预算，不叠加光焰、净化斩击、歌颂支援或太阳易伤',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      const selfGain = applyAuthoredSunVulnerability(35.1 * masteryFactor(state, id), true, []);
      return applyNotaryCertification(state, context, { label: isNotary(state)
        ? '有限圣光：只攻击眼前普通成年布伦；没有太阳易伤，仅结算本次圣光主攻预算（G），不将冲突或拒签等同邪恶'
        : '有限圣光：只攻击眼前单一目标；普通携铃者没有太阳易伤，仅结算本次圣光主攻预算（G），不将犯罪等同邪恶',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 });
    }
    case 'SUNPRIEST_LIGHTFIRE': {
      const selfGain = applyAuthoredSunVulnerability(18.9 * masteryFactor(state, 'sun.s7.holy-light'), true, []);
      return applyNotaryCertification(state, context, { label: '有限光焰：本次使用太阳神术次攻预算（G）；普通目标没有太阳易伤，不叠加武器或净化斩击、不扩散目标或持续灼烧',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 });
    }
    case 'sun.s7.sacred-oath':
      return { ...noEffect('神圣誓约与恐惧抵御：只稳定实际在场的自身，结算本次普通减势（G）；无恐惧来源时不虚构驱散，不建立全能免疫，不恢复健康、精神或清除污染'),
        enemyReduction: 14.625 * masteryFactor(state, id) };
    case 'sun.s7.sun-aura':
      return { ...noEffect('太阳光环：以眼前强光与压迫干扰当前普通对手，结算本次普通减势（G）；不扫描秘密、不判断善恶、不控制意志或删减行动，也不凭空支援队友'),
        enemyReduction: 7.875 * masteryFactor(state, id) };
    case 'sun.s7.holy-water':
      return noEffect('神圣之水仪式准备：本次即时贡献0；战斗随机槽不制作、使用或消耗生活圣水，不加灵性、行动或后续支援');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`光焰偏差或誓约失稳：本次贡献${selfGain < 0 ? '−' : '+'}11.25（G），不构成致伤攻击、净化或能力公证`), selfGain };
    }
  }
}
