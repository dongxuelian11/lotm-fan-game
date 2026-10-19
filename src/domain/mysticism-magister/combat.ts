import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { REAPER_COUNT_WHEEL, reaperActionCount } from '../reaper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasMysticismMagisterDisputeOpponent, hasMysticismMagisterOpenPractice } from './encounter.js';
import type { MysticismMagisterCraft } from './types.js';

/** Independent S5 G profile. The old S6 resolver, samples and random budgets stay unchanged. */
export const MYSTICISM_MAGISTER_COUNT_WHEEL: readonly SliceWheelEntry[] = REAPER_COUNT_WHEEL;
export const mysticismMagisterActionCount = reaperActionCount;
export type MysticismMagisterMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'EVADE'
  | 'reader.s6.limited-imitation' | 'reader.s5.material-imitation' | 'ACCIDENT';
interface Ability { id: MysticismMagisterMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；身体12/自有原棍16×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；身体12/自有原棍16×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（B，G；对方−10，不保证免伤）', weight: 20, stance: 'DEFEND' },
  { id: 'reader.s6.limited-imitation', label: '继承有限闪光（K，G；已学原样本、2灵性、知识14）', weight: 20, stance: 'CONTROL' },
  { id: 'reader.s5.material-imitation', label: '耗用已制原闪光物（R，G；最早持有原件一次、无额外灵性）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isMysticismMagister(s: SliceState): boolean {
  return s.progression?.pathwayId === 'white-tower' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function mysticismMagisterAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawMysticismMagisterAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): MysticismMagisterMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('秘术导师能力盘权重无效');
}

export interface MysticismMagisterCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'MYSTICISM_MAGISTER_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'ROWAN_SINGLE_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; visible: true; distanceMetres: 2;
  playerBody: 'ORIGINAL_PLAYER_BODY'; playerHealth: number; playerMind: number;
  enemyHealth: number; enemyMind: number;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'ROWAN_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_EMPTY_PRIVATE_WORKYARD';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** The paid workyard visit supplies Rowan. FIRST_CASE retains its own visible
 * living carrier, original club and existing close-range body/tool scene. */
export function currentMysticismMagisterCombatSource(s: SliceState): MysticismMagisterCombatSource | null {
  const c = s.combat;
  if (!isMysticismMagister(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasMysticismMagisterOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', visible: true, distanceMetres: 2, playerBody: 'ORIGINAL_PLAYER_BODY',
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    weaponLocation: 'HAND', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.mysticismMagister.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasMysticismMagisterDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'MYSTICISM_MAGISTER_DISPUTE', target: 'ROWAN_SINGLE_ADULT',
    weapon: 'ROWAN_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_WORKYARD',
    attemptWeek: s.mysticismMagister.encounter.attemptWeek, startHistoryIndex: s.mysticismMagister.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: MysticismMagisterCombatSource | null): boolean {
  const current = currentMysticismMagisterCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function hasLearnedFlash(s: SliceState): boolean {
  const sample = s.polymath.samples.FLASH;
  const { observedWeek, understoodWeek, learnedWeek, analysisAttemptWeek } = sample;
  return [observedWeek, understoodWeek, learnedWeek, analysisAttemptWeek].every(week =>
    week !== null && Number.isSafeInteger(week) && week >= 1 && week <= s.week) &&
    observedWeek! <= understoodWeek! && understoodWeek! <= learnedWeek! &&
    observedWeek! <= analysisAttemptWeek! && analysisAttemptWeek! <= learnedWeek!;
}
/** Original identity, one real consumed source kit, fixed manufacture power.
 * This never repairs invalid inventory or fabricates an item on a drawn slot. */
function oldestPreparedFlash(s: SliceState): MysticismMagisterCraft | null {
  const m = s.mysticismMagister;
  const eligible = m.crafts.filter(c => {
    const kit = /^MM5-KIT-([1-9]\d*)$/.exec(c.sourceKitId);
    return /^MM5-FLASH-[1-9]\d*$/.test(c.id) && kit !== null &&
      Number.isSafeInteger(Number(kit[1])) && c.id === `MM5-FLASH-${kit[1]}` &&
      Number.isSafeInteger(m.practice.kitsUsed) && Number(kit[1]) <= m.practice.kitsUsed &&
      c.status === 'PLAYER' && c.usedWeek === null && Number.isSafeInteger(c.createdWeek) &&
      m.promotionWeek !== null && c.createdWeek >= m.promotionWeek && c.createdWeek <= s.week &&
      Number.isFinite(c.power) && c.power >= 0.65 && c.power <= 1 &&
      m.crafts.filter(other => other.id === c.id || other.sourceKitId === c.sourceKitId).length === 1;
  });
  return eligible.sort((a, b) => a.createdWeek - b.createdWeek ||
    Number(a.id.slice('MM5-FLASH-'.length)) - Number(b.id.slice('MM5-FLASH-'.length)))[0] ?? null;
}
export interface MysticismMagisterCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
const noEffect = (label: string): MysticismMagisterCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveMysticismMagisterCombatAbility(
  s: SliceState, id: MysticismMagisterMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: MysticismMagisterCombatSource | null = currentMysticismMagisterCombatSource(s),
): MysticismMagisterCombatEffect {
  if (!validSource(s, source)) return noEffect('秘术导师行动：缺少当前原活敌、2米可见目标、原身体或回合来源，0效果、0消耗，原闪光物保留，不重抽');
  const target = source!.encounterId === 'FIRST_CASE' ? '原携铃者' : '罗文';
  if (id === 'reader.s6.limited-imitation') {
    if (!hasLearnedFlash(s) || !Number.isFinite(s.spirituality) || s.spirituality < 2) {
      return noEffect('继承有限闪光：没有实际学会的原FLASH样本或灵性不足2，0效果、0消耗，不重抽、不制造知识库');
    }
    s.spirituality -= 2;
    const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge,
      difficulty: 14, modifiers: [] });
    const succeeded = random.nextInt(1, 100) <= chance;
    const learned = s.progression.mastery['reader.s6.limited-imitation'] ?? 0;
    const mastery = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
    return { ...noEffect(`继承有限闪光：已耗2灵性，知识难度14检定${chance}%，${succeeded
      ? `成功；将实际已学的原低强闪光弱化再现，对2米内可见的${target}形成一次短暂扰动，对方优势−12×原博学者模仿掌握（G）`
      : '失败，0效果；实付灵性不退回'}；不造成伤害、不删除敌方行动、不追加材料或新样本，不是即时入梦仪式`),
      enemyReduction: succeeded ? 12 * mastery : 0 };
  }
  if (id === 'reader.s5.material-imitation') {
    if (s.mysticismMagister.cases['modest-craft']?.status !== 'RESOLVED') {
      return noEffect('耗用已制原闪光物：制造实践尚未完成真实安全测试与报告，首件原试作品须保留供实际TEST_TOKEN核验；本槽0效果、0消耗，原件保留，不重抽');
    }
    const craft = oldestPreparedFlash(s);
    if (!craft) return noEffect('耗用已制原闪光物：没有实际制成且仍由本人持有的合格原件，0效果、0消耗，现存原物不变；不现场制造、不补库存、不重抽');
    craft.status = 'CONSUMED'; craft.usedWeek = s.week;
    const remaining = s.mysticismMagister.crafts.filter(c => c.status === 'PLAYER').length;
    return { ...noEffect(`耗用已制原闪光物：实际一次耗尽${craft.id}（原材料包${craft.sourceKitId}），对2米内可见的${target}产生有限低强闪光，对方优势−18×制作时固定效力${craft.power}（G）；尚持有${remaining}件。制作时已实付4灵性，此次额外灵性0；不按当前掌握重算，不造成伤害、不删除敌方行动，耗尽原件保留历史且不补充`),
      enemyReduction: 18 * craft.power };
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不追加行动或免费材料'), selfGain: -22.5 };
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
    const armed = s.town.clubLocation === 'HAND';
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：${armed ? '使用自己持握的原普通短棍' : '使用自己的原身体'}打击（G），仍由共同胜负与伤势盘结算，不凭仪式知识发射攻击`),
      selfGain: (armed ? 16 : 12) * physical, threatens: physical > 0 };
  }
  if (id === 'EVADE') return { ...noEffect('普通避让：以当前原身体站位护身，对方优势−10（G），不保证免伤、不产生仪式护盾'), enemyReduction: 10 };
  return noEffect('秘术导师行动：不是本阶段已实现的战斗动作，0效果、0消耗；不创造免费法术库、材料、即时入梦仪式或高阶预言');
}
