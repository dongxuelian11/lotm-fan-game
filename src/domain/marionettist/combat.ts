import { hasBizarroRitualOpponent } from '../bizarro-sorcerer/ritual.js';
import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { MAGICIAN_COUNT_WHEEL, magicianActionCount, resolveMagicianCombatAbility,
  type MagicianCombatEffect, type MagicianMoveId } from '../magician/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasMarionettistDisputeOpponent, hasMarionettistOpenPractice } from './encounter.js';
import { hasMarionettistOpenCapture } from './puppet.js';

/** Independent new S5 finite G profile. Neutral H15/J25/B20/K25/R10/A5;
 * J/B subdivisions select one inherited move, never a second action or draw.
 * S9–6 wheels, counts and random streams remain unchanged. */
export const MARIONETTIST_COUNT_WHEEL: readonly SliceWheelEntry[] = MAGICIAN_COUNT_WHEEL;
export type MarionettistMoveId = MagicianMoveId | 'diviner.s5.spirit-threads' | 'diviner.s5.marionette-control' | 'ACCIDENT';
interface Ability { id: MarionettistMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通近身打击（H，G；12/原棍16×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'diviner.s8.body-control', label: '继承体术（J，G；30×身体）', weight: 7, stance: 'ATTACK' },
  { id: 'diviner.s7.air-bullet', label: '继承六阶空气弹（J，G；60，2灵性）', weight: 10, stance: 'ATTACK' },
  { id: 'diviner.s8.paper-dagger', label: '原纸飞刀（J，G；34×身体，原纸1/灵性1）', weight: 3, stance: 'ATTACK' },
  { id: 'diviner.s7.paper-weapon', label: '原纸武器（J，G；22×身体，原纸1/灵性1）', weight: 3, stance: 'ATTACK' },
  { id: 'diviner.s7.flame-control', label: '继承六阶原火操纵（J，G；31.2，2灵性）', weight: 2, stance: 'ATTACK' },
  { id: 'diviner.s8.balance', label: '继承平衡避让（B，G；28）', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s7.flame-jump', label: '继承六阶原火避让（B，G；31.2，3灵性）', weight: 8, stance: 'DEFEND' },
  { id: 'diviner.s7.illusion', label: '继承有限幻术（B，G；16，2灵性）', weight: 4, stance: 'DEFEND' },
  { id: 'diviner.s5.spirit-threads', label: '灵体之线有限迟缓（K，G；36×掌握，2灵性）', weight: 25, stance: 'CONTROL' },
  { id: 'diviner.s5.marionette-control', label: '无可用原秘偶时普通观察（R；0贡献/0灵性）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '专注失衡（A，G；固定−22.5，不另抽正负）', weight: 5, stance: null },
];
export function isMarionettist(s: SliceState): boolean {
  return s.progression?.pathwayId === 'diviner' && s.progression.sequence === 5;
}
function abilities(s: SliceState): readonly Ability[] {
  const transfer = s.injuries.some(i => i.severity === 'HEAVY' && !s.magician.damageTransfers.includes(i.id));
  return transfer ? ABILITIES.map<Ability>(a => a.id === 'diviner.s8.balance' ? {
    id: 'diviner.s7.damage-transfer', label: '继承同一原伤的体内伤转（B，G；3灵性）', weight: a.weight, stance: a.stance,
  } : a) : ABILITIES;
}
function tickets(entries: readonly Ability[], stance: SliceStance | null): number[] {
  return entries.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function marionettistAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const entries = abilities(s), weights = tickets(entries, stance), total = weights.reduce((sum, n) => sum + n, 0);
  return entries.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawMarionettistAbility(random: ActionRandomStream, s: SliceState, stance: SliceStance | null): MarionettistMoveId {
  const entries = abilities(s), weights = tickets(entries, stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < entries.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return entries[i]!.id; }
  throw new Error('秘偶大师能力盘权重无效');
}
export const marionettistActionCount = magicianActionCount;
export interface MarionettistCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'MARIONETTIST_DISPUTE' | 'BIZARRO_RITUAL';
  target: string; nature: 'LIVING_HUMAN' | 'ORIGINAL_LIVING_S4_EQUIVALENT_BEAST'; distanceMetres: 2;
  visible: true; spiritThreads: true; weapon: 'ORIGINAL_CARRIER_CLUB' | 'MM5-DORN-CLUB' | 'ORIGINAL_BEAST_BODY';
  weaponLocation: 'HAND' | 'ORIGINAL_BODY'; exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
export function currentMarionettistCombatSource(s: SliceState): MarionettistCombatSource | null {
  const c = s.combat;
  if (!isMarionettist(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasMarionettistOpenPractice(s) || hasMarionettistOpenCapture(s)) return null;
  if (c.encounterId === 'BIZARRO_RITUAL') {
    if (!hasBizarroRitualOpponent(s)) return null;
    const r = s.bizarroSorcerer.ritual;
    return { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
      encounterId: 'BIZARRO_RITUAL', target: r.currentTargetId!, nature: 'ORIGINAL_LIVING_S4_EQUIVALENT_BEAST', distanceMetres: 2,
      visible: true, spiritThreads: true, weapon: 'ORIGINAL_BEAST_BODY', weaponLocation: 'ORIGINAL_BODY',
      exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, attemptWeek: r.visitWeek, startHistoryIndex: r.startHistoryIndex };
  }
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist) return null;
    return { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
      encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER', nature: 'LIVING_HUMAN', distanceMetres: 2,
      visible: true, spiritThreads: true, weapon: 'ORIGINAL_CARRIER_CLUB', weaponLocation: 'HAND',
      exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasMarionettistDisputeOpponent(s)) return null;
  const e = s.marionettist.encounter;
  if (e.startHistoryIndex === null || s.combatHistory.length - e.startHistoryIndex !== c.round - 1 ||
      !s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS')) return null;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    encounterId: 'MARIONETTIST_DISPUTE', target: 'MM5-DORN', nature: 'LIVING_HUMAN', distanceMetres: 2,
    visible: true, spiritThreads: true, weapon: 'MM5-DORN-CLUB', weaponLocation: 'HAND',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, attemptWeek: e.attemptWeek, startHistoryIndex: e.startHistoryIndex };
}
function validSource(s: SliceState, source: MarionettistCombatSource | null): boolean {
  const current = currentMarionettistCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
const noEffect = (label: string): MagicianCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveMarionettistCombatAbility(
  s: SliceState, id: MarionettistMoveId, physicalStateFactor: number,
  source: MarionettistCombatSource | null = currentMarionettistCombatSource(s),
): MagicianCombatEffect {
  if (!validSource(s, source)) return noEffect('秘偶大师行动：缺少同场真实活人、可见灵体线或原回合来源；贡献0、消耗0，不重抽、不生成秘偶');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  if (id === 'diviner.s5.spirit-threads') {
    if (!Number.isFinite(s.spirituality) || s.spirituality < 2) return noEffect('灵体之线：主人灵性不足2，本次普通观察0贡献，不重抽、不取消对手行动');
    s.spirituality -= 2;
    const learned = s.progression.mastery[id] ?? 0;
    const mastery = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
    if (source?.encounterId === 'BIZARRO_RITUAL') return { ...noEffect('灵体之线：耗本人2灵性辨明原兽真实灵体线；高位原活兽仅12×掌握有限减势（G），不初控、不转化、不迫降'), enemyReduction: 12 * mastery };
    return { ...noEffect('灵体之线：耗主人2灵性，专注牵动同场2米活人的真实灵体线，只令其短时迟缓，敌方优势−36×掌握（G）；对手仍能行动、抵抗并可能挣脱。本槽不算20秒初控，不累积跨回合完全化，不致死、不强迫投降，完整捕获另需战后两段与死亡确认'), enemyReduction: 36 * mastery };
  }
  if (id === 'diviner.s5.marionette-control') return noEffect('秘偶操纵：本场没有可用的已控原秘偶，只作普通观察，贡献0、灵性0；不凭空生成队友，不借尸体复活，不把别人能力给主人');
  if (id === 'ACCIDENT') return { ...noEffect('专注失衡：本槽固定贡献−22.5（G），不追加随机、不追加攻击，不把失误变成免费控制'), selfGain: -22.5 };
  // Existing S6 inheritance preserves real paper, flame, wound and SP authority.
  return resolveMagicianCombatAbility(s, id, physical);
}
