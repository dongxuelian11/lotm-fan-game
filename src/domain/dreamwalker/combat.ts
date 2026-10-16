import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { PSYCHOLOGIST_COUNT_WHEEL, psychologistActionCount, resolvePsychologistCombatAbility,
  type PsychologistCombatEffect, type PsychologistMoveId } from '../psychologist/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasDreamwalkerDisputeOpponent, hasDreamwalkerOpenPractice } from './encounter.js';

/** Independent finite S5 G allocation: H10/J10/B25/K40/R10/A5.
 * One drawn ticket is one actual action. S9–6 wheels and RNG stay unchanged. */
export const DREAMWALKER_COUNT_WHEEL: readonly SliceWheelEntry[] = PSYCHOLOGIST_COUNT_WHEEL;
export type DreamwalkerMoveId = PsychologistMoveId | 'audience.s5.dream-guidance'
  | 'audience.s5.dream-modification' | 'audience.s5.dream-travel' | 'ACCIDENT';
interface Ability { id: DreamwalkerMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通打击（H，G；12/原棍16×身体）', weight: 10, stance: 'ATTACK' },
  { id: 'audience.s7.frenzy', label: '继承狂乱（J，G；3灵性，可抵抗，成功+28）', weight: 10, stance: 'ATTACK' },
  { id: 'audience.s6.scales', label: '继承鳞片防护（B，G；2灵性，有限物理防守）', weight: 10, stance: 'DEFEND' },
  { id: 'audience.s7.soothe', label: '继承安抚（B，G；2灵性，对方−16）', weight: 8, stance: 'DEFEND' },
  { id: 'EVADE', label: '普通避让（B，G；对方−18，不保证免伤）', weight: 7, stance: 'DEFEND' },
  { id: 'audience.s6.combat-hypnosis', label: '继承战斗催眠（K，G；3灵性，可抵抗）', weight: 20, stance: 'CONTROL' },
  { id: 'audience.s7.awe', label: '继承震慑（K，G；2灵性，对方−22）', weight: 10, stance: 'CONTROL' },
  { id: 'audience.s7.suggestion', label: '继承心理暗示（K，G；2灵性，可抵抗）', weight: 10, stance: 'CONTROL' },
  { id: 'audience.s5.dream-guidance', label: '梦境引导（R；对手清醒、无现成梦境，0灵性0效果）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isDreamwalker(s: SliceState): boolean {
  return s.progression?.pathwayId === 'audience' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function dreamwalkerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawDreamwalkerAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): DreamwalkerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('梦境行者能力盘权重无效');
}
export const dreamwalkerActionCount = psychologistActionCount;
export interface DreamwalkerCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'DREAMWALKER_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'MAS_SINGLE_AWAKE_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; awareness: 'AWAKE'; dream: 'NONE';
  visible: true; distanceMetres: 2; mind: 'ORDINARY_UNPROTECTED';
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'MAS_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** Neither old practice dreams nor another opponent supplies a combat dream. */
export function currentDreamwalkerCombatSource(s: SliceState): DreamwalkerCombatSource | null {
  const c = s.combat;
  if (!isDreamwalker(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasDreamwalkerOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', awareness: 'AWAKE', dream: 'NONE', visible: true, distanceMetres: 2,
    mind: 'ORDINARY_UNPROTECTED', weaponLocation: 'HAND', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.dreamwalker.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasDreamwalkerDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'DREAMWALKER_DISPUTE', target: 'MAS_SINGLE_AWAKE_ADULT',
    weapon: 'MAS_ORIGINAL_CLUB', attemptWeek: s.dreamwalker.encounter.attemptWeek,
    startHistoryIndex: s.dreamwalker.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: DreamwalkerCombatSource | null): boolean {
  const current = currentDreamwalkerCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
const noEffect = (label: string): PsychologistCombatEffect => ({
  label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
});
export function resolveDreamwalkerCombatAbility(
  s: SliceState, id: DreamwalkerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: DreamwalkerCombatSource | null = currentDreamwalkerCombatSource(s),
): PsychologistCombatEffect {
  if (!validSource(s, source)) return noEffect('梦境行者行动：缺少同场原活敌或当前回合来源，贡献0、消耗0，不重抽、不补出梦境');
  if (id === 'audience.s5.dream-guidance') {
    return noEffect('梦境引导：眼前' + (source!.encounterId === 'DREAMWALKER_DISPUTE' ? '马斯' : '原携铃者') +
      '当前清醒，没有可进入和引导的现成梦境，本槽0效果、0灵性、不重抽；不能把清醒者直接拖入梦，旧练习与短暂催眠后的迟疑不成为现成梦境');
  }
  if (id === 'audience.s5.dream-modification') return noEffect('梦境修改：本场没有已进入的现成梦境，0效果、0灵性；不制造梦牢、不改写清醒人格、现实经历或强迫证词');
  if (id === 'audience.s5.dream-travel') return noEffect('梦境穿梭：本场没有两个智慧生物的现成梦境端点，0效果、0灵性；不能从站立处任意瞬移，也不借用相距不超过500米的双梦练习通路');
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不补抽行动或赠送梦境'), selfGain: -22.5 };
  if (!ABILITIES.some(a => a.id === id) && ![
    'BLOCK', 'MISS', 'audience.observation', 'audience.behavior-analysis', 'audience.memory-deduction', 'audience.mind-reading',
  ].includes(id)) return noEffect('梦境行者行动：不是本途径已继承的有限动作，0效果0消耗，不借用梦魇拖梦、人格分身或精神瘟疫');
  if (!Number.isFinite(s.spirituality)) return noEffect('梦境行者行动：灵性状态无效，本槽没有效果或额外消耗');
  const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
  // The S6/S7 resolver accepts S5 only with this real encounter or the live
  // original first case. Its original costs and bounded mastery are retained.
  return resolvePsychologistCombatAbility(s, id, physical, random);
}
