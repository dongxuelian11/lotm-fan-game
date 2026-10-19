import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import type { InterrogatorCombatSource } from '../interrogator/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasJudgeDisputeOpponent, hasJudgeOpenPractice } from './encounter.js';

/** S6 finite G profile: U65/P15, A1.2/E1.3. The fair, symmetric close-strike
 * restriction is this game's explicit rule, not a claim of a canon requirement.
 * No S5 punishment, confinement or death strike is granted here. */
export const JUDGE_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 10 }),
  Object.freeze({ id: '2', label: '2次', weight: 15 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 30 }),
  Object.freeze({ id: '5', label: '5次', weight: 20 }),
]);
export type JudgeMoveId = 'justiciar.s9.combat-training' | 'BODY_FOLLOWUP'
  | 'justiciar.s7.mental-puncture' | 'justiciar.s6.prohibition'
  | 'justiciar.s6.authority' | 'ACCIDENT';
type JudgeMasteryId = 'justiciar.s9.combat-training' | 'justiciar.s8.trace-sensing'
  | 'justiciar.s7.mental-puncture' | 'justiciar.s6.prohibition' | 'justiciar.s6.authority';
const ABILITIES: readonly {
  id: JudgeMoveId; label: string; weight: number; stance: SliceStance | null;
}[] = [
  { id: 'justiciar.s9.combat-training', label: '继承格斗打击（G；50.7×原格斗掌握×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承格斗侧击（G；35.49×原格斗掌握×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'justiciar.s7.mental-puncture', label: '继承精神刺穿／痕迹护身（G；3灵性）', weight: 25, stance: 'ATTACK' },
  { id: 'justiciar.s6.prohibition', label: '有限禁令：双方身体近击禁止（G；3灵性，本轮剩余）', weight: 10, stance: 'CONTROL' },
  { id: 'justiciar.s6.authority', label: '法官权威（G；3灵性，一次抵抗）', weight: 15, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '时机或失衡（G；固定−16.25，不另掷正负）', weight: 5, stance: null },
];
export function isJudge(state: SliceState): boolean {
  return state.progression?.pathwayId === 'justiciar' && state.progression.sequence === 6;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(ability => ability.weight * (stance !== null && ability.stance === stance ? 5 : 4));
}
export function judgeAbilityWheel(stance: SliceStance | null, state?: SliceState): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({ id: ability.id,
    label: ability.id === 'justiciar.s9.combat-training' && state?.town.clubLocation === 'HAND'
      ? '持握原短棍打击' : ability.label,
    weight: total === 400 ? weights[index]! / 4 : weights[index]! / total * 100 }));
}
export function drawJudgeAbility(random: ActionRandomStream, stance: SliceStance | null): JudgeMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return ABILITIES[index]!.id;
  }
  throw new Error('法官能力盘权重无效');
}
export function judgeActionCount(roll: number): number {
  return roll <= 10 ? 1 : roll <= 25 ? 2 : roll <= 50 ? 3 : roll <= 80 ? 4 : 5;
}
export type JudgeCombatSource = InterrogatorCombatSource | {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'JUDGE_DISPUTE'; attemptWeek: number; startHistoryIndex: number;
  target: 'EVAN_SINGLE_ADULT_ORDINARY_HUMAN'; nature: 'ORDINARY_HUMAN';
  body: 'CURRENT_REACHABLE_BODY'; weapon: 'EVANS_OWN_ORDINARY_SHORT_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_CLEAR_COURTYARD'; visibility: 'MUTUALLY_VISIBLE'; distanceMetres: 2;
  ground: 'CLEAR_ORDINARY_GROUND'; bystanders: 'NONE'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
};
/** Separate S6 gate: inherited S9–7 FIRST_CASE gates and random streams stay unchanged. */
export function currentJudgeCombatSource(state: SliceState): JudgeCombatSource | null {
  const combat = state.combat, practice = state.judge.practice;
  if (!isJudge(state) || state.status !== 'ACTIVE' || !Number.isFinite(state.health) || state.health <= 0 ||
      !Number.isFinite(state.mind) || state.mind <= 0 || state.activeEvent !== null ||
      !combat || combat.enemyStatus !== 'RESISTING' || !Number.isFinite(combat.enemyHealth) || combat.enemyHealth <= 0 ||
      !Number.isFinite(combat.enemyMind) || combat.enemyMind <= 0 || state.world.city !== 'BACKLUND' ||
      hasJudgeOpenPractice(state) || !['READY', 'FREE'].includes(practice.audience) ||
      !['CLEAR', 'RELEASED'].includes(practice.boundary) || !['ON_TABLE', 'RETURNED'].includes(practice.token) ||
      Object.values(state.judge.cases).some(record => record.contactOpen || record.status === 'PREPARED') ||
      !Number.isSafeInteger(combat.round) || combat.round < 1 ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Number.isSafeInteger(state.week) || state.week < 1) return null;
  if (combat.encounterId === 'FIRST_CASE') {
    if (state.arc.stage !== 'COMBAT' || !state.world.carrierAlive || !state.world.carrierCanResist) return null;
    return { runId: state.runId, revision: state.revision, week: state.week, encounterId: 'FIRST_CASE',
      round: combat.round, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' };
  }
  const e = state.judge.encounter;
  if (!hasJudgeDisputeOpponent(state) || e.startHistoryIndex === null ||
      state.combatHistory.length - e.startHistoryIndex !== combat.round - 1 ||
      !state.combatHistory.slice(e.startHistoryIndex).every((round, index) =>
        round.round === index + 1 && round.winner !== null && round.retreat !== 'SUCCESS')) return null;
  return { runId: state.runId, revision: state.revision, week: state.week, round: combat.round,
    encounterId: 'JUDGE_DISPUTE', attemptWeek: state.week, startHistoryIndex: e.startHistoryIndex,
    target: 'EVAN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY',
    weapon: 'EVANS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', space: 'ORIGINAL_CLEAR_COURTYARD',
    visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false };
}
function validSource(state: SliceState, source: JudgeCombatSource | null): boolean {
  const current = currentJudgeCombatSource(state);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function masteryValue(state: SliceState, id: JudgeMasteryId): number {
  const mastery = state.progression.mastery[id] ?? 0;
  return Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0));
}
function masteryFactor(state: SliceState, id: JudgeMasteryId): number {
  return 0.65 + 0.35 * masteryValue(state, id) / 500;
}
export interface JudgeCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
function noEffect(label: string): JudgeCombatEffect {
  return { label, selfGain: 0, enemyReduction: 0, threatens: false };
}
/** A synchronous, finite profile-local context; never a saved/general prohibition system. */
export interface JudgeRoundContext {
  source: JudgeCombatSource | null;
  closeStrikesProhibited: boolean;
}
export function createJudgeRoundContext(state: SliceState): JudgeRoundContext {
  return { source: currentJudgeCombatSource(state), closeStrikesProhibited: false };
}
/** Called only AFTER the ordinary enemy slot was really drawn and consumed. */
export function judgeEnemyProhibition(
  state: SliceState, context: JudgeRoundContext, moveId: string,
): string | null {
  if (moveId !== 'STRIKE' || !context.closeStrikesProhibited || !validSource(state, context.source)) return null;
  return '本轮已生效的双方身体近击禁止（G）：敌方本次STRIKE仍已实际抽出并消耗，贡献0、不形成致伤威胁；不重抽、不追加行动、不夺取或移动原短棍';
}
export function finishJudgeCombatRound(context: JudgeRoundContext): string | null {
  if (!context.closeStrikesProhibited) return null;
  context.closeStrikesProhibited = false;
  return '本轮结束，双方身体近击禁止已自动消散；不追溯此前动作，不跨轮保留，不追加惩戒、囚禁或死亡打击。';
}

/** Each call consumes only its already drawn slot. Only unprohibited H/J threaten. */
export function resolveJudgeCombatAbility(
  state: SliceState, id: JudgeMoveId, physicalStateFactor: number, random: ActionRandomStream,
  context: JudgeRoundContext,
  source: JudgeCombatSource | null = currentJudgeCombatSource(state),
): JudgeCombatEffect {
  if (!validSource(state, source) || !validSource(state, context.source)) {
    return noEffect('法官行动：缺少本场真实存活普通对手与原现场，或练习尚未收束；本次贡献0、消耗0，不重抽、不虚构禁令对象');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  if (context.closeStrikesProhibited && (id === 'justiciar.s9.combat-training' || id === 'BODY_FOLLOWUP')) {
    return noEffect(`本轮已生效的双方身体近击禁止（G）：你的${id === 'BODY_FOLLOWUP' ? '格斗侧击J' : state.town.clubLocation === 'HAND' ? '原短棍打击H' : '格斗打击H'}仍已实际抽出并消耗，贡献0、不形成致伤威胁；本人同受约束，不重抽、不追加行动、不移动原物`);
  }
  switch (id) {
    case 'justiciar.s9.combat-training': {
      const heldClub = state.town.clubLocation === 'HAND';
      const selfGain = (heldClub ? 16 : 50.7 * masteryFactor(state, id)) * physical;
      return { label: heldClub
        ? '持握原短棍打击：只采用实际在手的镇上原普通短棍16×身体（G），不叠加格斗或权威预算，0灵性，不取得埃文的原棍'
        : '继承格斗打击：50.7×原仲裁人格斗掌握×当前身体系数（G），0灵性，不保证命中；伤势仍由共同后果盘结算',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'BODY_FOLLOWUP': {
      const selfGain = 35.49 * masteryFactor(state, 'justiciar.s9.combat-training') * physical;
      return { label: '继承格斗侧击：35.49×原格斗掌握×当前身体系数（G），0灵性，独立占本次行动，不追加攻击',
        selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    case 'justiciar.s7.mental-puncture': {
      if (!Number.isFinite(state.spirituality) || state.spirituality < 3) {
        return { ...noEffect('精神刺穿灵性不足3：改用继承痕迹辨认与护身42.25×原痕迹掌握×身体（G），0消耗、不抽命中盘；只观察眼前已知动作，不读取心智或预读未来'),
          enemyReduction: 42.25 * masteryFactor(state, 'justiciar.s8.trace-sensing') * physical };
      }
      const threshold = 55 + Math.floor(20 * masteryValue(state, id) / 500);
      state.spirituality -= 3;
      const roll = random.nextInt(1, 100), success = roll <= threshold;
      return { ...noEffect(`继承精神刺穿：消耗3灵性，命中盘${roll}/100、阈值${threshold}（G）；${success ? '42.25×原精神刺穿掌握形成短暂战势贡献，不乘身体系数' : '对方避开或抵抗，本次贡献0'}。不是身体近击，不受本条禁令限制；不是必中，不保证真话，不取消其它行动，本槽不形成物理致伤或死亡威胁`),
        selfGain: success ? 42.25 * masteryFactor(state, id) : 0 };
    }
    case 'justiciar.s6.prohibition': {
      if (context.closeStrikesProhibited) {
        return noEffect('双方身体近击禁止本轮已经生效：重复K占用本次抽出槽，贡献0、成本0、抵抗抽签0；不续期、不叠加、不重抽、不追加行动');
      }
      if (!Number.isFinite(state.spirituality) || state.spirituality < 3) {
        return { ...noEffect('有限禁令灵性不足3：回退普通走位6×身体（G），0消耗、0抵抗抽签；不宣布禁令、不透支、不重抽'), enemyReduction: 6 * physical };
      }
      const threshold = 55 + 20 * masteryValue(state, id) / 500;
      state.spirituality -= 3;
      const roll = random.nextInt(1, 100), success = roll <= threshold;
      context.closeStrikesProhibited = success;
      return { ...noEffect(`有限禁令：消耗3灵性，抵抗盘${roll}/100、阈值${threshold}（G）；${success
        ? '从现在至本轮结束，双方身体近击禁止。后续本人的H/J与当前普通敌人的STRIKE仍实际抽出并消耗，但贡献0且不形成致伤威胁；不追溯此前动作、不取消其它技能、不重抽、不追加行动。双方同受约束是本作明确G公平规则，不冒充原著必须如此'
        : '对方抵抗，禁令未生效；仅回退普通走位6×身体，不取消任何动作、不返还已耗灵性'}。不给序列5惩戒、囚禁或死亡打击`),
        enemyReduction: success ? 0 : 6 * physical };
    }
    case 'justiciar.s6.authority': {
      if (!Number.isFinite(state.spirituality) || state.spirituality < 3) {
        return noEffect('法官权威灵性不足3：本次贡献0、消耗0，不抽抵抗盘、不额外行动');
      }
      const threshold = 35 + 15 * masteryValue(state, id) / 500;
      state.spirituality -= 3;
      const roll = random.nextInt(1, 100), success = roll <= threshold;
      return { ...noEffect(`法官权威：消耗3灵性，抵抗盘${roll}/100、阈值${threshold}（G）；${success ? '21.125×新权威掌握，仅削减本轮战势，不乘身体系数' : '对方抵抗，本次贡献0'}。不取消行动，不保证真话、认罪或同意，不控制意志，不形成物理致伤或死亡威胁`),
        enemyReduction: success ? 21.125 * masteryFactor(state, id) : 0 };
    }
    case 'ACCIDENT':
      return { ...noEffect('时机或失衡：本次固定−16.25战势（G），0灵性，不另掷正负，不形成致伤威胁'), selfGain: -16.25 };
  }
}
