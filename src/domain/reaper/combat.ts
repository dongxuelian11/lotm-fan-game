import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount, resolvePyromaniacCombatAbility,
  type PyromaniacCombatEffect, type PyromaniacMoveId } from '../pyromaniac/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasReaperDisputeOpponent, hasReaperOpenPractice } from './encounter.js';

/** Independent S5 G profile. H20/J30/B15/K20/R10/A5; one ticket is one
 * action, and the existing S9–6 wheels and random budgets stay unchanged. */
export const REAPER_COUNT_WHEEL: readonly SliceWheelEntry[] = PYROMANIAC_COUNT_WHEEL;
export type ReaperMoveId = PyromaniacMoveId | 'hunter.s5.weakness-observation'
  | 'hunter.s5.precision-strike' | 'ACCIDENT';
interface Ability { id: ReaperMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通近身打击（H，G；12/原棍16×身体）', weight: 20, stance: 'ATTACK' },
  { id: 'hunter.s5.precision-strike', label: '窗口精准打击（J，G；有窗口另耗2灵性，有限追加36×掌握×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'hunter.s9.physical-enhancement', label: '继承强化打击（J，G；28×身体）', weight: 5, stance: 'ATTACK' },
  { id: 'hunter.s7.compressed-fireball', label: '继承压缩火球（J，G；36，3灵性）', weight: 5, stance: 'ATTACK' },
  { id: 'hunter.s7.flame-lance', label: '继承火焰长枪（J，G；32，3灵性）', weight: 5, stance: 'ATTACK' },
  { id: 'EVADE', label: '继承身体避让（B，G；22）', weight: 10, stance: 'DEFEND' },
  { id: 'BLOCK', label: '普通格挡（B，G；10）', weight: 5, stance: 'DEFEND' },
  { id: 'hunter.s7.flame-control', label: '继承自身火焰牵制（K，G；18，2灵性）', weight: 20, stance: 'CONTROL' },
  { id: 'hunter.s5.weakness-observation', label: '观察实际弱点（R；2灵性，0优势，至紧接下一轮）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isReaper(s: SliceState): boolean {
  return s.progression?.pathwayId === 'hunter' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function reaperAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawReaperAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ReaperMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('收割者能力盘权重无效');
}
export const reaperActionCount = pyromaniacActionCount;

export interface ReaperCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'REAPER_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'RE5-VICK'; nature: 'ADULT_LIVING_HUMAN';
  visible: true; distanceMetres: 2; weaknessObservable: boolean;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'RE5-VICK-CLUB'; weaponLocation: 'HAND';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** An actual current opponent is required even for ordinary inherited moves.
 * The first case retains its old facts and supplies no new weakness window. */
export function currentReaperCombatSource(s: SliceState): ReaperCombatSource | null {
  const c = s.combat;
  if (!isReaper(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasReaperOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', visible: true, distanceMetres: 2, weaponLocation: 'HAND',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.reaper.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', weaknessObservable: false, attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasReaperDisputeOpponent(s)) return null;
  const e = s.reaper.encounter;
  return { ...common, encounterId: 'REAPER_DISPUTE', target: 'RE5-VICK', weapon: 'RE5-VICK-CLUB',
    weaknessObservable: true, attemptWeek: e.attemptWeek, startHistoryIndex: e.startHistoryIndex };
}
function validSource(s: SliceState, source: ReaperCombatSource | null): boolean {
  const current = currentReaperCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
const noEffect = (label: string): PyromaniacCombatEffect => ({
  label, selfGain: 0, enemyReduction: 0, threatens: false, angersEnemy: false,
});
function ordinaryStrike(s: SliceState, physical: number, prefix: string): PyromaniacCombatEffect {
  const armed = s.town.clubLocation === 'HAND';
  return { ...noEffect(`${prefix}${armed ? '持握自己的原短棍普通打击' : '普通打击'}，仍由共同胜负与伤势盘结算`),
    selfGain: (armed ? 16 : 12) * physical, threatens: true };
}
function liveWindow(s: SliceState): boolean {
  const w = s.reaper.encounter.weakness, round = s.combat!.round;
  return w.available && Number.isSafeInteger(w.sourceRound) && w.sourceRound !== null &&
    w.sourceRound >= 1 && w.sourceRound <= round && round <= w.sourceRound + 1 &&
    Number.isSafeInteger(w.observations) && Number.isSafeInteger(w.uses) && w.uses >= 0 && w.observations > w.uses;
}

export function resolveReaperCombatAbility(
  s: SliceState, id: ReaperMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: ReaperCombatSource | null = currentReaperCombatSource(s),
): PyromaniacCombatEffect {
  if (!validSource(s, source)) return noEffect('收割者行动：缺少同场原活敌或当前回合来源，贡献0、消耗0，不重抽、不凭空补出弱点');
  if (!ABILITIES.some(a => a.id === id) && ![
    'hunter.s7.fire-raven', 'hunter.s9.hunting-instinct', 'hunter.s8.provocation',
    'hunter.s8.hostility-aura', 'OBSERVE', 'MISS',
  ].includes(id)) return noEffect('收割者行动：不是本途径已继承的有限动作，不借用纸人、火焰跳跃或高阶军团能力，消耗0');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  if (id === 'hunter.s5.weakness-observation') {
    if (!source!.weaknessObservable || source!.encounterId !== 'REAPER_DISPUTE') {
      return noEffect('弱点观察：旧首案未提供本段可核验的实际破绽来源，普通观察0优势、0灵性，不拿维克或练习信号代替');
    }
    if (!Number.isFinite(s.spirituality) || s.spirituality < 2) return noEffect('弱点观察：灵性不足2，不施展、不建立窗口，0贡献，不重抽');
    s.spirituality -= 2;
    const w = s.reaper.encounter.weakness;
    w.sourceRound = s.combat!.round; w.available = true; w.observations += 1;
    return noEffect('弱点观察：耗灵性2，实际观察同场2米活人维克持原棍的重心与暴露空当，建立一个当前或紧接下一轮可用的短窗口；本槽优势0，不额外抽攻击票，重复观察只替换窗口、不叠层。对手仍可行动与抵抗（窗口时限为原创G）');
  }
  if (id === 'hunter.s5.precision-strike') {
    if (!source!.weaknessObservable || source!.encounterId !== 'REAPER_DISPUTE' || !liveWindow(s)) {
      return ordinaryStrike(s, physical, '精准打击：没有仍有效的同场真实观察窗口，不施展、不耗灵性、不重抽，本次只作');
    }
    if (!Number.isFinite(s.spirituality) || s.spirituality < 2) {
      return ordinaryStrike(s, physical, '精准打击：灵性不足2，窗口不消费、不重抽，本次只作');
    }
    s.spirituality -= 2;
    const w = s.reaper.encounter.weakness;
    w.available = false; w.sourceRound = null; w.uses += 1;
    const learned = s.progression.mastery[id] ?? 0;
    const mastery = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
    const strike = ordinaryStrike(s, physical, '');
    return { ...strike, selfGain: strike.selfGain + 36 * mastery * physical,
      label: '精准打击：耗灵性2，消费一次实际观察的短窗口，以自己的原身体或原棍瞄准维克当前破绽；普通打击另加有限优势36×掌握×身体（G），不免费再造窗口，不额外攻击、不无限穿甲、不保证命中或必杀，对手继续按原规则行动，伤势与死亡仅由共同结算决定' };
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负或追加行动，不产生免费窗口'), selfGain: -22.5 };
  // One inherited action, original SP and original empty fire lane. Hunter fire
  // is made by the hunter, never borrowed from diviner lamps or paper weapons.
  return resolvePyromaniacCombatAbility(s, id, physical, random);
}

/** Called before the current round number advances. A window observed in n
 * survives n, can be spent during n+1, and expires at the end of n+1. */
export function finishReaperCombatRound(s: SliceState, continues: boolean): string | null {
  const w = s.reaper.encounter.weakness;
  if (!w.available) return null;
  if (!continues || s.combat?.encounterId !== 'REAPER_DISPUTE' ||
      w.sourceRound === null || w.sourceRound < s.combat.round || w.sourceRound > s.combat.round) {
    w.available = false; w.sourceRound = null;
    return continues ? '实际观察的短窗口已到期，未用不会返还灵性或补抽攻击。' : '冲突结束，剩余弱点窗口关闭；实际观察与打击消耗保留。';
  }
  return null;
}
