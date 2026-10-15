import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { REAPER_COUNT_WHEEL, reaperActionCount } from '../reaper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasAstronomerDisputeOpponent, hasAstronomerOpenPractice } from './encounter.js';

/** Independent S5 G profile, H30/J25/B20/K10/R10/A5. Its ordinary 1–6
 * action-count distribution explicitly reuses REAPER_COUNT_WHEEL (10/15/25/25/15/10).
 * No S9–6 wheel, old equipment, action budget or random draw is changed. */
export const ASTRONOMER_COUNT_WHEEL: readonly SliceWheelEntry[] = REAPER_COUNT_WHEEL;
export const astronomerActionCount = reaperActionCount;
export type AstronomerMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'EVADE' | 'DISTANCE'
  | 'paragon.s5.precision-focus' | 'ACCIDENT';
interface Ability { id: AstronomerMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；身体12/自有原棍16×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；身体12/自有原棍16×身体）', weight: 25, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（B，G；对方−10，不保证免伤）', weight: 20, stance: 'DEFEND' },
  { id: 'DISTANCE', label: '普通距离牵制（K，G；对方−8，不删除行动）', weight: 10, stance: 'CONTROL' },
  { id: 'paragon.s5.precision-focus', label: '短时专注校准（R，原创G；2灵性，+12×本项掌握）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isAstronomer(s: SliceState): boolean {
  return s.progression?.pathwayId === 'paragon' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function astronomerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawAstronomerAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): AstronomerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('天文学家能力盘权重无效');
}

export interface AstronomerCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'ASTRONOMER_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'HOBER_SINGLE_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; visible: true; distanceMetres: 2;
  playerBody: 'ORIGINAL_PLAYER_BODY'; playerHealth: number; playerMind: number;
  enemyHealth: number; enemyMind: number;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'HOBER_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_OBSERVATORY_OUTER_COURTYARD';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** A paid visit supplies Hober himself. The old first case is a separate,
 * narrowly authored live source and never supplies Hober or observatory facts. */
export function currentAstronomerCombatSource(s: SliceState): AstronomerCombatSource | null {
  const c = s.combat;
  if (!isAstronomer(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasAstronomerOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', visible: true, distanceMetres: 2, playerBody: 'ORIGINAL_PLAYER_BODY',
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    weaponLocation: 'HAND', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.astronomer.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasAstronomerDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'ASTRONOMER_DISPUTE', target: 'HOBER_SINGLE_ADULT',
    weapon: 'HOBER_ORIGINAL_CLUB', space: 'ORIGINAL_OBSERVATORY_OUTER_COURTYARD',
    attemptWeek: s.astronomer.encounter.attemptWeek, startHistoryIndex: s.astronomer.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: AstronomerCombatSource | null): boolean {
  const current = currentAstronomerCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
export interface AstronomerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
const noEffect = (label: string): AstronomerCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveAstronomerCombatAbility(
  s: SliceState, id: AstronomerMoveId, physicalStateFactor: number, _random: ActionRandomStream,
  source: AstronomerCombatSource | null = currentAstronomerCombatSource(s),
): AstronomerCombatEffect {
  if (!validSource(s, source)) return noEffect('天文学家行动：缺少同场原活敌、当前原身体或回合来源，0效果、0消耗，不重抽');
  if (id === 'paragon.s5.precision-focus') {
    if (!Number.isFinite(s.spirituality) || s.spirituality < 2) {
      return noEffect('短时专注校准：灵性不足2，本次不施展，0效果、0消耗，不免费校准、不重抽');
    }
    const learned = s.progression.mastery[id] ?? 0;
    const mastery = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
    s.spirituality -= 2;
    return { ...noEffect('短时专注校准：耗灵性2，短时集中自己的注意力，核对自己当前原身体的站姿与动作，有限优势+12×本项掌握（原创G）；本槽后不留下持续效果，不读取对手想法、不预知下一步或从星象取得真相，不保证命中，不删除对手行动'), selfGain: 12 * mastery };
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不追加行动或免费校准'), selfGain: -22.5 };
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
    const armed = s.town.clubLocation === 'HAND';
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：${armed ? '使用自己持握的原普通短棍' : '使用自己的原身体'}打击（G），没有星光或天象攻击，仍由共同胜负与伤势盘结算`),
      selfGain: (armed ? 16 : 12) * physical, threatens: physical > 0 };
  }
  if (id === 'EVADE') return { ...noEffect('普通避让：以当前身体站位避让，削减对方优势10（G），不保证免伤、不产生护盾'), enemyReduction: 10 };
  if (id === 'DISTANCE') return { ...noEffect('普通距离牵制：在当前原场地调整间距，削减对方优势8（G），不瞬移、不束缚或删除对方行动'), enemyReduction: 8 };
  return noEffect('天文学家行动：不是本阶段已实现的动作，0效果、0消耗；不虚构星术、引力、天气或赋灵，不借用客户处ART6-LAMP-1');
}
