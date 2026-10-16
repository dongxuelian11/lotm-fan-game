import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { REAPER_COUNT_WHEEL, reaperActionCount } from '../reaper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { resolveCrimsonScholarVampireAbility } from '../vampire/combat.js';
import { hasCrimsonScholarDisputeOpponent, hasCrimsonScholarOpenPractice } from './encounter.js';

/** Independent S5 G profile, H30/J15/B20/K20/R10/A5. Its ordinary 1–6
 * action-count distribution explicitly reuses REAPER_COUNT_WHEEL (10/15/25/25/15/10).
 * No S9–6 wheel, old equipment, action budget or random draw is changed. */
export const CRIMSON_SCHOLAR_COUNT_WHEEL: readonly SliceWheelEntry[] = REAPER_COUNT_WHEEL;
export const crimsonScholarActionCount = reaperActionCount;
export type CrimsonScholarMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'moon.s7.dark-wings' | 'moon.s7.abyss-shackles'
  | 'moon.s5.moonlight-reassembly' | 'ACCIDENT';
interface Ability { id: CrimsonScholarMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；身体12/自有原棍16×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；身体12/自有原棍16×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'moon.s7.dark-wings', label: '继承黑暗之翼（B，G；3灵性，对方−22）', weight: 20, stance: 'DEFEND' },
  { id: 'moon.s7.abyss-shackles', label: '继承深渊枷锁（K，G；3灵性，可抵抗，不删行动）', weight: 20, stance: 'CONTROL' },
  { id: 'moon.s5.moonlight-reassembly', label: '有限自身月光重组（R，G；6灵性，每轮至多一次，最多健康+8）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isCrimsonScholar(s: SliceState): boolean {
  return s.progression?.pathwayId === 'moon' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function crimsonScholarAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawCrimsonScholarAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): CrimsonScholarMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('深红学者能力盘权重无效');
}

export interface CrimsonScholarCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'CRIMSON_SCHOLAR_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'SID_SINGLE_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; visible: true; distanceMetres: 2;
  playerBody: 'ORIGINAL_PLAYER_BODY'; playerHealth: number; playerMind: number;
  enemyHealth: number; enemyMind: number;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'SID_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_PRIVATE_MOONLIT_COURTYARD';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  moonlight: 'CURRENT_AUTHORED_COURTYARD_MOONLIGHT' | 'NOT_AUTHORED';
  shadow: 'SIDS_CURRENT_ORIGINAL_SHADOW' | 'NOT_AUTHORED';
  reassemblyRound: number | null;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** A paid agreed night visit supplies Sid and the original courtyard moonlight.
 * FIRST_CASE has no authored moonlight or shadow and never supplies Sid. */
export function currentCrimsonScholarCombatSource(s: SliceState): CrimsonScholarCombatSource | null {
  const c = s.combat;
  if (!isCrimsonScholar(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasCrimsonScholarOpenPractice(s) ||
      (s.crimsonScholar.encounter.reassemblyRound !== null &&
       s.crimsonScholar.encounter.reassemblyRound !== c.round)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', visible: true, distanceMetres: 2, playerBody: 'ORIGINAL_PLAYER_BODY',
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    weaponLocation: 'HAND', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.crimsonScholar.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null,
      moonlight: 'NOT_AUTHORED', shadow: 'NOT_AUTHORED', reassemblyRound: s.crimsonScholar.encounter.reassemblyRound };
  }
  if (!hasCrimsonScholarDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'CRIMSON_SCHOLAR_DISPUTE', target: 'SID_SINGLE_ADULT',
    weapon: 'SID_ORIGINAL_CLUB', space: 'ORIGINAL_PRIVATE_MOONLIT_COURTYARD',
    attemptWeek: s.crimsonScholar.encounter.attemptWeek, startHistoryIndex: s.crimsonScholar.encounter.startHistoryIndex,
    moonlight: 'CURRENT_AUTHORED_COURTYARD_MOONLIGHT', shadow: 'SIDS_CURRENT_ORIGINAL_SHADOW',
    reassemblyRound: s.crimsonScholar.encounter.reassemblyRound };
}
function validSource(s: SliceState, source: CrimsonScholarCombatSource | null): boolean {
  const current = currentCrimsonScholarCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
export interface CrimsonScholarCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
const noEffect = (label: string): CrimsonScholarCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveCrimsonScholarCombatAbility(
  s: SliceState, id: CrimsonScholarMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: CrimsonScholarCombatSource | null = currentCrimsonScholarCombatSource(s),
): CrimsonScholarCombatEffect {
  if (!validSource(s, source)) return noEffect('深红学者行动：缺少同场原活敌、当前原身体或回合来源，0效果、0消耗，不重抽');
  if (id === 'moon.s5.moonlight-reassembly') {
    if (s.health < 1) return noEffect('月光重组：当前健康不在1至99的可用范围，0效果、0消耗，不复活、不重抽');
    if (s.health >= 100) return noEffect('月光重组：当前健康已满，0效果、0消耗，不重抽');
    if (source!.moonlight !== 'CURRENT_AUTHORED_COURTYARD_MOONLIGHT') {
      return noEffect('月光重组：当前原身体所在区域没有已核实的实际月光，0效果、0消耗，不凭空造月光、不重抽');
    }
    if (s.crimsonScholar.encounter.reassemblyRound === s.combat!.round) {
      return noEffect('月光重组：本轮已经重组一次，0效果、0消耗，不重抽');
    }
    if (!Number.isFinite(s.spirituality) || s.spirituality < 6) {
      return noEffect('月光重组：灵性不足6，0效果、0消耗，不重抽');
    }
    const healed = Math.min(8, 100 - s.health);
    s.spirituality -= 6; s.health += healed;
    s.crimsonScholar.encounter.reassemblyRound = s.combat!.round;
    return noEffect(`月光重组：耗灵性6，在当前实际月光中有限月光化并重组自己的原身体，健康恢复${healed}（原创G），本轮至多一次；不加优势、不恢复精神、不抹除原伤势与风险、不复制身体、不复活，也不覆盖此后真实死亡`);
  }
  if (id === 'moon.s7.dark-wings' || id === 'moon.s7.abyss-shackles') {
    return resolveCrimsonScholarVampireAbility(s, id, random, source);
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不追加行动或免费校准'), selfGain: -22.5 };
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
    const armed = s.town.clubLocation === 'HAND';
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：${armed ? '使用自己持握的原普通短棍' : '使用自己的原身体'}打击（G），没有创造额外武器或人物，仍由共同胜负与伤势盘结算`),
      selfGain: (armed ? 16 : 12) * physical, threatens: physical > 0 };
  }
  return noEffect('深红学者行动：本场没有该动作，0效果、0消耗；区域月相与月光闪现属于独立真实生活实践，不在战斗凭空开场域、传送、变蝙蝠或使用序列4月光纸人');
}
/** The per-round marker never survives round settlement, including death/retreat. */
export function finishCrimsonScholarCombatRound(s: SliceState): void {
  s.crimsonScholar.encounter.reassemblyRound = null;
}
