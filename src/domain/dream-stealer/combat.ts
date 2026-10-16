import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { GATEKEEPER_COUNT_WHEEL, gatekeeperActionCount } from '../gatekeeper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasDreamStealerDisputeOpponent, hasDreamStealerOpenPractice } from './encounter.js';

/** Finite S5 G profile; no borrowed power is supplied by this ordinary opponent. */
export const DREAM_STEALER_COUNT_WHEEL: readonly SliceWheelEntry[] = GATEKEEPER_COUNT_WHEEL;
export const dreamStealerActionCount = gatekeeperActionCount;
export type DreamStealerMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'BLOCK'
  | 'error.s5.thought-theft' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: DreamStealerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；自身身体12/自有原棍16×身体，0灵性）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；自身身体12/自有原棍16×身体，0灵性）', weight: 15, stance: 'ATTACK' },
  { id: 'BLOCK', label: '普通格挡（B，G；对方−10，0灵性）', weight: 20, stance: 'DEFEND' },
  { id: 'error.s5.thought-theft', label: '窃取当前念头（K，G；3灵性、知识14；成功立即用自己的身体或原工具执行，原主只失去该次待行动）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '普通观察（R，G；0贡献、0灵性；普通人没有可偷取的非凡能力）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isDreamStealer(s: SliceState): boolean {
  return s.progression?.pathwayId === 'error' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function dreamStealerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawDreamStealerAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): DreamStealerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('窃梦家能力盘权重无效');
}

export interface DreamStealerCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'DREAM_STEALER_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'MARLOW_SINGLE_ADULT'; nature: 'ORDINARY_ADULT_HUMAN';
  visible: true; distanceMetres: 2; playerBody: 'ORIGINAL_PLAYER_BODY';
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number;
  playerClubLocation: SliceState['town']['clubLocation'];
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'MARLOW_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_EMPTY_PRIVATE_COURTYARD';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false; bystanders: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** The first case remains its original carrier. The paid visit alone supplies
 * Marlow; neither actor is silently replaced by the old S9 Bard. */
export function currentDreamStealerCombatSource(s: SliceState): DreamStealerCombatSource | null {
  const c = s.combat;
  if (!isDreamStealer(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasDreamStealerOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ORDINARY_ADULT_HUMAN', visible: true, distanceMetres: 2, playerBody: 'ORIGINAL_PLAYER_BODY',
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    playerClubLocation: s.town.clubLocation, weaponLocation: 'HAND',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, bystanders: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.dreamStealer.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasDreamStealerDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'DREAM_STEALER_DISPUTE', target: 'MARLOW_SINGLE_ADULT',
    weapon: 'MARLOW_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_COURTYARD',
    attemptWeek: s.dreamStealer.encounter.attemptWeek, startHistoryIndex: s.dreamStealer.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: DreamStealerCombatSource | null): boolean {
  const current = currentDreamStealerCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}

export type DreamStealerOrdinaryIntent = 'STRIKE' | 'BLOCK' | 'OPENING' | 'DISTANCE' | 'MISS';
/** Resolver-local current decision, not a future list, saved power or UI forecast.
 * MISS is an involuntary failed action and cannot supply a stealable intention. */
export interface DreamStealerRoundContext {
  source: DreamStealerCombatSource | null;
  pending: { id: DreamStealerOrdinaryIntent; stolen: boolean } | null;
  decisions: number; consumed: number; finished: boolean;
}
export function createDreamStealerRoundContext(s: SliceState): DreamStealerRoundContext {
  return { source: currentDreamStealerCombatSource(s), pending: null, decisions: 0, consumed: 0, finished: false };
}
/** Only the battle runner invokes this with its one actual unchanged drawAbility
 * decision: before the first action, then after each consumed enemy action. */
export function decideDreamStealerEnemyIntent(s: SliceState, context: DreamStealerRoundContext, id: DreamStealerOrdinaryIntent): void {
  if (!validSource(s, context.source) || context.finished || context.pending !== null ||
      context.decisions !== context.consumed || !['STRIKE', 'BLOCK', 'OPENING', 'DISTANCE', 'MISS'].includes(id)) {
    throw new Error('只能在当前原敌没有待执行决定时形成一个新普通决定');
  }
  context.pending = { id, stolen: false }; context.decisions += 1;
}
/** Consuming the actual slot does not draw again. The next decision, if there is
 * another enemy action, is formed by the battle runner only after this slot. */
export function consumeDreamStealerEnemyIntent(s: SliceState, context: DreamStealerRoundContext): { id: DreamStealerOrdinaryIntent; stolen: boolean } {
  if (!validSource(s, context.source) || context.finished || context.pending === null || context.decisions !== context.consumed + 1) {
    throw new Error('当前原敌没有可消耗的同轮普通决定');
  }
  const pending = context.pending; context.pending = null; context.consumed += 1;
  return pending;
}
export function finishDreamStealerCombatRound(context: DreamStealerRoundContext): void {
  context.pending = null; context.finished = true;
}
export interface DreamStealerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
const noEffect = (label: string): DreamStealerCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function mastery(s: SliceState): number {
  const learned = s.progression.mastery['error.s5.thought-theft'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
}
/** Executing a thought means the player's own immediate ordinary action. No
 * enemy weapon, skill, spirituality, future action or separate damage is copied. */
function executeOwnOrdinaryAction(s: SliceState, id: Exclude<DreamStealerOrdinaryIntent, 'MISS'>, physical: number): DreamStealerCombatEffect {
  const factor = mastery(s);
  if (id === 'STRIKE') {
    const armed = s.town.clubLocation === 'HAND', selfGain = (armed ? 16 : 12) * physical * factor;
    return { ...noEffect(armed ? '立即用自己实际握在手中的原短棍作普通打击16×身体×掌握（G）'
      : '立即用自己原身体作徒手普通打击12×身体×掌握（G）；对方的原短棍没有来到手中'), selfGain, threatens: selfGain > 0 };
  }
  if (id === 'BLOCK') return { ...noEffect('立即用自己原身体作普通格挡，对方−10×掌握（G）'), enemyReduction: 10 * factor };
  if (id === 'OPENING') return { ...noEffect('立即以自己原身体作普通寻找空当，优势+8×掌握（G），本身不造成伤害'), selfGain: 8 * factor };
  return { ...noEffect('立即以自己原身体作普通拉开距离，对方−8×掌握（G），没有瞬移'), enemyReduction: 8 * factor };
}
export function resolveDreamStealerCombatAbility(
  s: SliceState, id: DreamStealerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  context: DreamStealerRoundContext = createDreamStealerRoundContext(s),
  source: DreamStealerCombatSource | null = currentDreamStealerCombatSource(s),
): DreamStealerCombatEffect {
  if (!validSource(s, source) || !validSource(s, context.source) || context.finished) {
    return noEffect('窃梦家行动：缺少当前原身体、可见普通活敌或同轮现场来源，0效果、0消耗、不抽检定，不替换原人物');
  }
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  if (id === 'error.s5.thought-theft') {
    const pending = context.pending;
    if (!pending || pending.stolen || pending.id === 'MISS' || context.decisions !== context.consumed + 1) {
      return noEffect('普通准备：当前没有可窃取的待执行普通念头，或该念头已经被取走；意外落空不是自主决定。0灵性、0贡献、不抽检定，不读取未来随机数');
    }
    if (!Number.isFinite(s.spirituality) || s.spirituality < 3) return noEffect('当前不足3灵性，不能尝试窃取念头；普通准备0贡献，不透支、不抽检定');
    s.spirituality -= 3;
    const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge,
      difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
    const success = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
    const detail = `窃取当前念头：已耗3灵性；知识难度14，成功率${check.chance}%，实抽${check.roll}/100；`;
    if (!success) return noEffect(`${detail}失败或被抵抗，原敌当前决定保留，本次0贡献，已付灵性不返还`);
    pending.stolen = true;
    const effect = executeOwnOrdinaryAction(s, pending.id, physical);
    return { ...effect, label: `${detail}成功；${effect.label}。这是当前同一个K行动立即执行，没有存储选择或额外玩家槽。原敌仅暂时忘记这一待行动，其原槽到来时贡献0，随后可以重新作下一个普通决定；不永久删除思想、不复制非凡能力、不夺物、不获得序列4免执行或寄生` };
  }
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    const armed = s.town.clubLocation === 'HAND', selfGain = (armed ? 16 : 12) * physical;
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：${armed ? '用自己实际持握的原短棍16' : '自己原身体12'}×身体状态（G），0灵性；没有搬来对方原棍或附加能力`), selfGain, threatens: selfGain > 0 };
  }
  if (id === 'BLOCK') return { ...noEffect('普通格挡：用自己原身体护身，对方−10（G），0灵性，不抹除对方念头'), enemyReduction: 10 };
  if (id === 'OBSERVE') return noEffect('普通观察：眼前原成年普通人、自己的原短棍与原出口真实可见；本槽0贡献、0灵性。他没有可供盗火人能力窃取的非凡能力，不读取隐藏能力池、不把普通人变成歌颂者，也不预知下一决定');
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本次−22.5（G），不致伤、不耗灵性、不追加检定或重新抽盘'), selfGain: -22.5 };
  return noEffect('没有已建模且来自当前实际来源的行动，0效果、0消耗，不提供能力复制、梦境操作或序列4寄生');
}
