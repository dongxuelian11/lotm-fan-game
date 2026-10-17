import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { releaseStoredRecorderCombatRecord, storedRecorderCombatRecord, type RecorderRoundContext } from '../astrologer/combat.js';
import { REAPER_COUNT_WHEEL, reaperActionCount } from '../reaper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasTravelerDisputeOpponent, hasTravelerOpenPractice } from './encounter.js';

/** Independent S5 G profile; each draw uses exactly one actual action. */
export const TRAVELER_COUNT_WHEEL: readonly SliceWheelEntry[] = REAPER_COUNT_WHEEL;
export const travelerActionCount = reaperActionCount;
export type TravelerMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'EVADE'
  | 'door.s5.travel' | 'door.s6.release' | 'ACCIDENT';
interface Ability { id: TravelerMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；身体12/自有原棍16×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；不用无形之手攻击）', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（B，G；对方−10，不耗灵性）', weight: 20, stance: 'DEFEND' },
  { id: 'door.s5.travel', label: '成对短旅行（K，G；已核实净空落点、去2灵性回2灵性、意志14）', weight: 20, stance: 'CONTROL' },
  { id: 'door.s6.release', label: '继承原记录释放（R，G；首份真实STORED样本、2灵性、每轮至多一次）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isTraveler(s: SliceState): boolean {
  return s.progression?.pathwayId === 'door' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function travelerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawTravelerAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): TravelerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('旅行家能力盘权重无效');
}
export interface TravelerCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'TRAVELER_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'BELAN_SINGLE_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; visible: true;
  playerBody: 'ORIGINAL_PLAYER_BODY'; playerHealth: number; playerMind: number;
  playerClubLocation: SliceState['town']['clubLocation'];
  enemyHealth: number; enemyMind: number;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'BELAN_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_EMPTY_PRIVATE_HALL';
  exit: 'EXISTING_ORDINARY_GROUND_EXIT' | 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  /** FIRST_CASE supplies no additional landing geometry. */
  landing: 'NONE_VERIFIED' | 'VERIFIED_EMPTY_TWO_METRE_SIDESTEP_AND_RETURN';
  distanceMetres: 2 | null; bystanders: 'NONE' | 'UNSPECIFIED';
  attemptWeek: number | null; startHistoryIndex: number | null;
}
export function currentTravelerCombatSource(s: SliceState): TravelerCombatSource | null {
  const c = s.combat;
  if (!isTraveler(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasTravelerOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', visible: true, playerBody: 'ORIGINAL_PLAYER_BODY',
    playerHealth: s.health, playerMind: s.mind, playerClubLocation: s.town.clubLocation,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, weaponLocation: 'HAND', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist || s.traveler.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER', weapon: 'ORIGINAL_CARRIER_CLUB',
      space: 'ORIGINAL_FIRST_CASE', exit: 'EXISTING_ORDINARY_GROUND_EXIT', landing: 'NONE_VERIFIED',
      distanceMetres: null, bystanders: 'UNSPECIFIED', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasTravelerDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'TRAVELER_DISPUTE', target: 'BELAN_SINGLE_ADULT', weapon: 'BELAN_ORIGINAL_CLUB',
    space: 'ORIGINAL_EMPTY_PRIVATE_HALL', exit: 'ORIGINAL_OPEN_EXIT',
    landing: 'VERIFIED_EMPTY_TWO_METRE_SIDESTEP_AND_RETURN', distanceMetres: 2, bystanders: 'NONE',
    attemptWeek: s.traveler.encounter.attemptWeek, startHistoryIndex: s.traveler.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: TravelerCombatSource | null): boolean {
  const current = currentTravelerCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
export function createTravelerRecorderRound(s: SliceState): RecorderRoundContext {
  return { recordingId: isTraveler(s) ? s.recorder.records.find(r => storedRecorderCombatRecord(s, r.id) !== null)?.id ?? null : null, released: false };
}
function travelMastery(s: SliceState): number {
  const learned = s.progression.mastery['door.s5.travel'] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
}
export interface TravelerCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const noEffect = (label: string): TravelerCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveTravelerCombatAbility(
  s: SliceState, id: TravelerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: TravelerCombatSource | null = currentTravelerCombatSource(s),
  recorderRound: RecorderRoundContext = createTravelerRecorderRound(s),
): TravelerCombatEffect {
  if (!validSource(s, source)) return noEffect('旅行家行动：当前原身体、原活敌、真实到场、装备或连续回合来源无效，0效果、0消耗，不重抽或替换原现场');
  if (id === 'door.s5.travel') {
    if (source!.landing !== 'VERIFIED_EMPTY_TWO_METRE_SIDESTEP_AND_RETURN') {
      return noEffect('普通站位观察：首案没有新增核实的短旅行落点与返回路径，本槽0效果、0灵性；保留原普通通路，不虚构2米侧移、穿越关闭路线或免费逃生');
    }
    if (!Number.isFinite(s.spirituality) || s.spirituality < 4) return noEffect('成对短旅行：灵性不足去程2与返程2合计4，0效果、0消耗，不只付单程、不重抽或透支');
    s.spirituality -= 4;
    const chance = computeCheckChance({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 14, modifiers: [] });
    const succeeded = random.nextInt(1, 100) <= chance;
    return {
      ...noEffect(`成对短旅行：已付去程2灵性与返程2灵性，合计4；意志难度14检定${chance}%，${succeeded
        ? '成功；原身体连同自己当前携带的原装备经灵界实际离开原交手点，抵达已核实的侧面2米净空落点；随后原身体与同一原装备经灵界实际返回原交手点，去返各一次，对方优势−16×旅行掌握（G）'
        : '失败；原身体与自己的原装备仍在原交手点，没有任何位移，实付4灵性不退回'}。贝兰及其原棍始终在原现场、原持有关系不变；这一个动作结束时已回原交手点或未曾离开，没有持续躲藏、关闭路线穿越、额外行动或免费逃生；实际伤亡仍由共同胜负与后果盘决定`),
      enemyReduction: succeeded ? 16 * travelMastery(s) : 0, threatens: succeeded,
    };
  }
  if (id === 'door.s6.release') {
    const target = source!.encounterId === 'FIRST_CASE' ? '原携铃者' : '成年仓库守门人贝兰';
    return releaseStoredRecorderCombatRecord(s, recorderRound.recordingId, target, recorderRound) ??
      noEffect('普通准备：没有本轮首份可用原STORED记录、已经释放一次或灵性不足2，本槽0效果、0消耗；不生成样本、不重选下一份、不返还已耗记录');
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不追加行动'), selfGain: -22.5 };
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
    const armed = s.town.clubLocation === 'HAND';
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：${armed ? '使用自己持握的原普通短棍' : '使用自己的原身体'}打击（G），由共同胜负与伤势盘结算；不偷用贝兰或携铃者的原棍、不施放无形之手攻击、不叠加旅行或记录`),
      selfGain: (armed ? 16 : 12) * physical, threatens: physical > 0 };
  }
  if (id === 'EVADE') return { ...noEffect('普通避让：当前原身体避让眼前打击，对方优势−10（G），不耗灵性、不额外检定、不保证免伤、不伪装成旅行'), enemyReduction: 10 };
  return noEffect('旅行家行动：不是本阶段已实现的动作，0效果、0消耗；没有隐秘空间、口袋空间、放逐或未知记录');
}
