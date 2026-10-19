import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { REAPER_COUNT_WHEEL, reaperActionCount } from '../reaper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasPriestOfLightDisputeOpponent, hasPriestOfLightOpenPractice } from './encounter.js';

/** Independent S5 G profile; old Bard–Notary rules and random budgets stay unchanged. */
export const PRIEST_OF_LIGHT_COUNT_WHEEL: readonly SliceWheelEntry[] = REAPER_COUNT_WHEEL;
export const priestOfLightActionCount = reaperActionCount;
export type PriestOfLightMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'EVADE'
  | 'sun.s5.holy-light' | 'sun.s9.praise' | 'ACCIDENT';
interface Ability { id: PriestOfLightMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；身体12/自有原棍16×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；身体12/自有原棍16×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '普通避让（B，G；对方−10，不耗灵性）', weight: 20, stance: 'DEFEND' },
  { id: 'sun.s5.holy-light', label: '有限圣光（K，G；4灵性、知识14，成功24×新圣光掌握）', weight: 20, stance: 'CONTROL' },
  { id: 'sun.s9.praise', label: '继承短吟（R，G；2灵性，自身+8×旧歌颂掌握）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isPriestOfLight(s: SliceState): boolean {
  return s.progression?.pathwayId === 'sun' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function priestOfLightAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawPriestOfLightAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): PriestOfLightMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('光之祭司能力盘权重无效');
}

export interface PriestOfLightCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'PRIEST_OF_LIGHT_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'KANE_SINGLE_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; sunVulnerable: false; visible: true; distanceMetres: 2;
  playerBody: 'ORIGINAL_PLAYER_BODY'; playerHealth: number; playerMind: number;
  enemyHealth: number; enemyMind: number;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'KANE_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_EMPTY_PRIVATE_COURTYARD';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false; spiritsPresent: false; alliesPresent: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** FIRST_CASE retains its actual original carrier and scene. The separate paid
 * courtyard visit supplies Kane, an ordinary living adult with no evil tag. */
export function currentPriestOfLightCombatSource(s: SliceState): PriestOfLightCombatSource | null {
  const c = s.combat;
  if (!isPriestOfLight(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasPriestOfLightOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', sunVulnerable: false, visible: true, distanceMetres: 2,
    playerBody: 'ORIGINAL_PLAYER_BODY', playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, weaponLocation: 'HAND',
    exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, spiritsPresent: false, alliesPresent: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.priestOfLight.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasPriestOfLightDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'PRIEST_OF_LIGHT_DISPUTE', target: 'KANE_SINGLE_ADULT',
    weapon: 'KANE_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_COURTYARD',
    attemptWeek: s.priestOfLight.encounter.attemptWeek, startHistoryIndex: s.priestOfLight.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: PriestOfLightCombatSource | null): boolean {
  const current = currentPriestOfLightCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function mastery(s: SliceState, id: 'sun.s5.holy-light' | 'sun.s9.praise'): number {
  const learned = s.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
}
export interface PriestOfLightCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
const noEffect = (label: string): PriestOfLightCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
/** One actual action per slot. Holy light is a normal attack against the current
 * ordinary human; inherited praise only contributes a bounded self advantage. */
export function resolvePriestOfLightCombatAbility(
  s: SliceState, id: PriestOfLightMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: PriestOfLightCombatSource | null = currentPriestOfLightCombatSource(s),
): PriestOfLightCombatEffect {
  if (!validSource(s, source)) return noEffect('光之祭司行动：缺少当前原活敌、2米可见目标、原身体或回合来源，0效果、0消耗，不重抽、不替换原场景或原人物');
  const target = source!.encounterId === 'FIRST_CASE' ? '原携铃者' : '普通门房凯恩';
  if (id === 'sun.s5.holy-light') {
    if (!Number.isFinite(s.spirituality) || s.spirituality < 4) {
      return noEffect('有限圣光：灵性不足4，0效果、0消耗，不重抽、不透支或调用高阶能力');
    }
    s.spirituality -= 4;
    const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 14, modifiers: [] });
    const succeeded = random.nextInt(1, 100) <= chance;
    return {
      ...noEffect(`有限圣光：已耗4灵性，知识难度14检定${chance}%，${succeeded
        ? `成功；只对2米内当前可见的${target}施放一次有限圣光，自身优势+24×新圣光掌握（G），实际伤势仍由共同胜负与后果盘决定`
        : '失败或被抵抗，0效果；实付灵性不退回'}；目标是普通活人，只按普通攻击结算，没有邪恶、亡灵或堕落标签加成；不保证命中、不无视全部防御，不开启序列4无暗领域或净化非凡特性`),
      selfGain: succeeded ? 24 * mastery(s, id) : 0, threatens: succeeded,
    };
  }
  if (id === 'sun.s9.praise') {
    if (!Number.isFinite(s.spirituality) || s.spirituality < 2) {
      return noEffect('继承短吟：灵性不足2，0效果、0消耗，不重抽，不凭空唱出付费效果或补充灵性');
    }
    s.spirituality -= 2;
    return {
      ...noEffect('继承短吟：已耗2灵性，以当前原身体实际短促吟唱，自身优势+8×旧歌颂掌握（G）；不额外检定，本槽结束即止。没有恢复灵性、治疗、复活或强迫对方意愿，不消除全部恐惧、不留下免费持续效果'),
      selfGain: 8 * mastery(s, id),
    };
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不追加行动'), selfGain: -22.5 };
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
    const armed = s.town.clubLocation === 'HAND';
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：${armed ? '使用自己持握的原普通短棍' : '使用自己的原身体'}打击（G），由共同胜负与伤势盘结算，不偷用对方原棍、不追加圣光或短吟`),
      selfGain: (armed ? 16 : 12) * physical, threatens: physical > 0 };
  }
  if (id === 'EVADE') return {
    ...noEffect('普通避让：用当前原身体避让眼前打击，对方优势−10（G），不耗灵性，不额外检定、不保证免伤，不虚构免疫或无暗领域'), enemyReduction: 10,
  };
  return noEffect('光之祭司行动：不是本阶段已实现的战斗动作，0效果、0消耗；不把普通人当亡灵，不调用净化光环杀伤友好灵体，也不提前获得序列4无暗领域');
}
