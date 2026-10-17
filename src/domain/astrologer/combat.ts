import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { RecorderRecord } from '../recorder/types.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';

/** Door V1 S7: U45, A/E .9/.8; exact balance budgets, not canon measurements. */
export const ASTROLOGER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 20 }),
  Object.freeze({ id: '4', label: '4次', weight: 23 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
  Object.freeze({ id: '6', label: '6次', weight: 12 }),
]);

export type AstrologerMoveId = 'TRICK_ATTACK' | 'BODY_FOLLOWUP' | 'TRICK_COVER'
  | 'SITE_PRESSURE' | 'OBSERVE' | 'ACCIDENT' | 'door.s6.release';
const ABILITIES: readonly {
  id: AstrologerMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'TRICK_ATTACK', label: '单次弱小电击（2灵性）', weight: 18, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '普通次击（本场无原穿门路径）', weight: 12, stance: 'ATTACK' },
  { id: 'TRICK_COVER', label: '单次雾气掩护（2灵性）', weight: 32, stance: 'DEFEND' },
  { id: 'SITE_PRESSURE', label: '普通牵制（对方无占卜/预知）', weight: 25, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察原现场与普通退路', weight: 8, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差', weight: 5, stance: null },
];

// S6 retains all inherited budgets; only its actual stored-record slot is new.
const RECORDER_ABILITIES: typeof ABILITIES = [
  ...ABILITIES.map(ability => ability.id === 'TRICK_COVER' ? { ...ability, weight: 25 }
    : ability.id === 'SITE_PRESSURE' ? { ...ability, weight: 15 } : ability),
  { id: 'door.s6.release', label: '释放本轮选定的原记录（2灵性）', weight: 17, stance: 'CONTROL' },
];
export function isRecorder(state: SliceState): boolean {
  return state.progression?.pathwayId === 'door' && state.progression.sequence === 6;
}
export function hasAstrologerCombat(state: SliceState): boolean {
  return isAstrologer(state) || isRecorder(state);
}
export function isAstrologer(state: SliceState): boolean {
  return state.progression?.pathwayId === 'door' && state.progression.sequence === 7;
}
function abilities(sequence: number): typeof ABILITIES { return sequence === 6 ? RECORDER_ABILITIES : ABILITIES; }
function tickets(stance: SliceStance | null, sequence: number): number[] {
  return abilities(sequence).map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function astrologerAbilityWheel(stance: SliceStance | null, sequence = 7): SliceWheelEntry[] {
  const weights = tickets(stance, sequence), total = weights.reduce((sum, weight) => sum + weight, 0);
  return abilities(sequence).map((ability, index) => ({ id: ability.id, label: ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawAstrologerAbility(random: ActionRandomStream, stance: SliceStance | null, sequence = 7): AstrologerMoveId {
  const entries = abilities(sequence), weights = tickets(stance, sequence);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return entries[index]!.id;
  }
  throw new Error('占星人能力盘权重无效');
}
export function astrologerActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 45 ? 3 : roll <= 68 ? 4 : roll <= 88 ? 5 : 6;
}

/** Authored FIRST_CASE scope, not a general gas, weather or physics system. */
export interface AstrologerFirstCaseSource {
  runId: string; revision: number; week: number; encounterId: 'FIRST_CASE'; round: number;
  target: 'CURRENT_VISIBLE_ORDINARY_CARRIER'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; space: 'DRY_GROUND_PASSAGE';
  scope: 'CURRENT_LOCAL_SINGLE_OPPONENT'; gasObject: 'NONE'; doorPath: 'NONE';
  enemyDivination: 'NONE'; enemyForecast: 'NONE';
  exit: 'EXISTING_ORDINARY_GROUND_EXIT'; companion: 'NONE';
}
export function currentAstrologerCombatSource(state: SliceState): AstrologerCombatSource | null {
  if (isRecorder(state)) return currentRecorderCombatSource(state);
  if (!isAstrologer(state) || state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyHealth <= 0 || state.combat.enemyStatus !== 'RESISTING' ||
      state.arc.stage !== 'COMBAT' || state.world.city !== 'BACKLUND' ||
      state.combat.encounterId !== 'FIRST_CASE' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
  return { runId: state.runId, revision: state.revision, week: state.week,
    encounterId: 'FIRST_CASE', round: state.combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
    nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
    scope: 'CURRENT_LOCAL_SINGLE_OPPONENT', gasObject: 'NONE', doorPath: 'NONE',
    enemyDivination: 'NONE', enemyForecast: 'NONE',
    exit: 'EXISTING_ORDINARY_GROUND_EXIT', companion: 'NONE' };
}
/** Only the actual paid teaching-room visit supplies this current adult opponent. */
export interface RecorderCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'RECORDER_DISPUTE'; target: 'MIR_SINGLE_ORDINARY_ADULT';
  nature: 'ORDINARY_HUMAN'; body: 'CURRENT_REACHABLE_BODY';
  scope: 'CURRENT_LOCAL_SINGLE_OPPONENT'; attemptWeek: number; startHistoryIndex: number;
  weapon: 'MIRS_ORDINARY_SHORT_CLUB'; space: 'ORIGINAL_TEACHING_ROOM_OUTER_COURTYARD';
  visibility: 'MUTUALLY_VISIBLE'; lighting: 'ORIGINAL_FIXED_LAMPLIGHT';
  distanceMetres: 2; ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  gasObject: 'NONE'; doorPath: 'NONE'; companion: 'NONE';
  enemyDivination: 'NONE'; enemyForecast: 'NONE';
}
export type AstrologerCombatSource = AstrologerFirstCaseSource | RecorderCombatSource;
function hasLiveRecorderCombat(state: SliceState): boolean {
  return isRecorder(state) && state.status === 'ACTIVE' && state.health > 0 && state.combat !== null &&
    state.combat.enemyHealth > 0 && state.combat.enemyStatus === 'RESISTING';
}
export function currentRecorderCombatSource(state: SliceState): RecorderCombatSource | null {
  const combat = state.combat;
  if (!hasLiveRecorderCombat(state) || state.activeEvent !== null || state.world.city !== 'BACKLUND' ||
      !combat || combat.encounterId !== 'RECORDER_DISPUTE' ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      Object.values(state.recorder.cases).some(item => item.contactOpen || item.status === 'PREPARED') ||
      !Object.values(state.recorder.cases).some(item => item.status === 'RESOLVED')) return null;
  const encounter = state.recorder.encounter;
  if (encounter.status !== 'FIGHTING' || encounter.attemptWeek !== state.week ||
      encounter.startHistoryIndex === null || !Number.isSafeInteger(encounter.startHistoryIndex) ||
      encounter.startHistoryIndex < 0 ||
      state.combatHistory.length - encounter.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(encounter.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'RECORDER_DISPUTE', target: 'MIR_SINGLE_ORDINARY_ADULT', nature: 'ORDINARY_HUMAN',
    body: 'CURRENT_REACHABLE_BODY', scope: 'CURRENT_LOCAL_SINGLE_OPPONENT', attemptWeek: encounter.attemptWeek,
    startHistoryIndex: encounter.startHistoryIndex, weapon: 'MIRS_ORDINARY_SHORT_CLUB',
    space: 'ORIGINAL_TEACHING_ROOM_OUTER_COURTYARD', visibility: 'MUTUALLY_VISIBLE',
    lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND',
    bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, gasObject: 'NONE',
    doorPath: 'NONE', companion: 'NONE', enemyDivination: 'NONE', enemyForecast: 'NONE' };
}
function validCombatSource(state: SliceState, source: AstrologerCombatSource | null): boolean {
  const current = currentAstrologerCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
/** Select the original item, never a copied combat inventory or an inferred sample. */
export function storedRecorderCombatRecord(state: SliceState, recordingId: string | null): RecorderRecord | null {
  if (!(state.progression?.pathwayId === 'door' && (state.progression.sequence === 6 || state.progression.sequence === 5 || (state.progression.sequence===4||state.progression.sequence===3))) || typeof recordingId !== 'string' || !/^recorder-record-[1-9]\d*$/.test(recordingId)) return null;
  const matches = state.recorder.records.filter(record => record.id === recordingId);
  if (matches.length !== 1) return null;
  const record = matches[0]!;
  if (record.status !== 'STORED' || record.releasedWeek !== null ||
      !Number.isSafeInteger(record.createdWeek) || record.createdWeek < 1 || record.createdWeek > state.week ||
      !/^recorder-demo-[1-9]\d*$/.test(record.sourceDemoId) ||
      !((record.sample === 'FLASH' && record.sequence === 8) || (record.sample === 'COURAGE' && record.sequence === 9)) ||
      state.recorder.records.filter(item => item.sourceDemoId === record.sourceDemoId).length !== 1) return null;
  const demonstrations = state.recorder.demonstrations.filter(demo => demo.id === record.sourceDemoId);
  if (demonstrations.length !== 1) return null;
  const demo = demonstrations[0]!;
  return demo.success === true && demo.sample === record.sample && demo.week === record.createdWeek &&
    demo.actor === (record.sample === 'FLASH' ? 'NORA' : 'SAFF') &&
    Number.isSafeInteger(demo.revision) && demo.revision >= 1 && demo.revision <= state.revision ? record : null;
}
/** This context belongs only to one round and is never persisted as a prepared buff. */
export interface RecorderRoundContext { recordingId: string | null; released: boolean }
function masteryFactor(state: SliceState, id: 'door.s8.tricks' | 'door.s9.door-opening' | 'door.s6.release'): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
}

export interface AstrologerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): AstrologerCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}

/** The same original low record and demonstration survive S6→S5 unchanged.
 * Callers validate their own authored encounter before invoking this shared
 * payment/release operation; no stock, demonstration or copied skill is made. */
export function releaseStoredRecorderCombatRecord(
  state: SliceState, recordingId: string | null, target: string, round: RecorderRoundContext,
): AstrologerCombatEffect | null {
  const record = storedRecorderCombatRecord(state, recordingId);
  if (!record || round.recordingId !== recordingId || round.released ||
      state.status !== 'ACTIVE' || state.health <= 0 || !state.combat ||
      state.combat.enemyStatus !== 'RESISTING' || state.combat.enemyHealth <= 0 ||
      !Number.isFinite(state.spirituality) || state.spirituality < 2) return null;
  state.spirituality -= 2;
  record.status = 'RELEASED'; record.releasedWeek = state.week; round.released = true;
  const amount = 12 * masteryFactor(state, 'door.s6.release');
  const detail = `耗灵性2并消耗原记录${record.id}，当次结算即止；不追加记录或读取未来、不取消对方行动，败北或撤退也不返还（G）`;
  return record.sample === 'FLASH'
    ? { ...noEffect(`释放原闪光记录：仅扰动当前${target}的视野，减势12×释放掌握系数；${detail}`), enemyReduction: amount }
    : { ...noEffect(`释放原勇气记录：只支持自己本次行动，增势12×释放掌握系数；不致伤、不强迫对方服从；${detail}`), selfGain: amount };
}

/**
 * One paid trick consumes one existing action and one 2S payment. The current
 * encounter retains electric and fog, sharing the one actual S8 tricks record.
 * Astrology stays outside combat; no enemy divination or forecast is authored,
 * so the control slot uses ordinary restraint and creates no interference state.
 * No control, combo or fog state survives this contribution; injury still uses
 * the shared consequence. Other known tricks do not silently fire as bonuses.
 */
export function resolveAstrologerCombatAbility(
  state: SliceState, id: AstrologerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: AstrologerCombatSource | null = currentAstrologerCombatSource(state),
  recorderRound: RecorderRoundContext = { recordingId: null, released: false },
): AstrologerCombatEffect {
  if (id === 'door.s6.release') {
    if (!hasLiveRecorderCombat(state)) return noEffect('释放记录：当前没有记录官可结算的实际战斗');
    const record = storedRecorderCombatRecord(state, recorderRound.recordingId);
    if (!validCombatSource(state, source) || recorderRound.released || record === null ||
        !Number.isFinite(state.spirituality) || state.spirituality < 2) {
      return { ...noEffect('释放记录：本轮保留、已用过、原记录或当前来源无效，或灵性不足2；改用普通格挡护身10（G），不耗灵性、不消耗原记录、不重抽'), enemyReduction: 10 };
    }
    return releaseStoredRecorderCombatRecord(state, record.id, '弥尔', recorderRound)!;
  }
  if (!validCombatSource(state, source)) {
    return noEffect('占星人行动：缺少本场仍可触及的普通对手与真实局部现场，本次贡献0');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  const factor = masteryFactor(state, 'door.s8.tricks');
  const ordinary = masteryFactor(state, 'door.s9.door-opening');
  const canPay = Number.isFinite(state.spirituality) && state.spirituality >= 2;
  switch (id) {
    case 'TRICK_ATTACK': {
      if (state.town.clubLocation === 'HAND') {
        const selfGain = 16 * physical;
        return { label: '持握原短棍打击：普通短棍16贡献（G）替换而不叠加主攻戏法；本次不用戏法、不耗灵性',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      if (!canPay) {
        const selfGain = 6.5 * ordinary * physical;
        return { label: '灵性不足2：改用原普通身体攻击（G），不施放电击，不耗灵性、不重抽行动',
          selfGain, enemyReduction: 0, threatens: selfGain > 0 };
      }
      state.spirituality -= 2;
      return { label: '弱小电击：只作用眼前单一普通对手的可触及身体，耗灵性2；本次主攻26.325×掌握系数（G），不造成持续麻痹或追加冻结，伤势另走普通后果盘',
        selfGain: 26.325 * factor, enemyReduction: 0, threatens: true };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 14.175 * ordinary * physical;
      return { label: '普通次击：本场没有原穿门路径或同行者，以实际身体结算次攻14.175×原掌握系数预算（G）；不携带任何人穿门，不追加持棍或戏法攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'TRICK_COVER': {
      if (!canPay) return { ...noEffect('灵性不足2：改用原普通闪避（G），不耗灵性；本场没有可穿过的原隔断，不能开门取消后续攻击'),
        enemyReduction: 7.8 * ordinary };
      state.spirituality -= 2;
      return { ...noEffect('短促雾气掩护：只扰动眼前交手位置的视野，耗灵性2；本次自保减势23.4×掌握系数（G），当次结算即止，不保证免伤、不取消行动或制造门径'),
        enemyReduction: 23.4 * factor };
    }
    case 'SITE_PRESSURE':
      return { ...noEffect(`普通现场牵制：当前${isRecorder(state) ? '弥尔' : '携铃者'}没有占卜或预知能力，不能触发占卜干扰；只结算原普通动作12.6×原掌握系数减势（G），不耗灵性，不施放闪光、不取消后续身体或武器动作、不留下干扰标记`),
        enemyReduction: 12.6 * ordinary };
    case 'OBSERVE':
      return noEffect('观察原现场与普通退路：本次贡献0；占星术只在战斗外核实有限关系，本槽不读取未来行动或战斗结果，不施放戏法、记录法术或留下准备标记');
    case 'ACCIDENT': {
      const selfGain = random.nextInt(1, 2) === 1 ? -11.25 : 11.25;
      return { ...noEffect(`动作偏差：本次意外贡献${selfGain > 0 ? '+' : '−'}11.25（G），不构成额外戏法或致伤攻击`), selfGain };
    }
  }
}
