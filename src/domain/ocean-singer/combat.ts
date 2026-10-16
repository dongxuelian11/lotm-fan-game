import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { REAPER_COUNT_WHEEL, reaperActionCount } from '../reaper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasOceanSingerDisputeOpponent, hasOceanSingerOpenPractice } from './encounter.js';

/** Independent S5 G profile; old Sailor–Wind Blessed rules and random budgets stay unchanged. */
export const OCEAN_SINGER_COUNT_WHEEL: readonly SliceWheelEntry[] = REAPER_COUNT_WHEEL;
export const oceanSingerActionCount = reaperActionCount;
export type OceanSingerMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'EVADE'
  | 'tyrant.s5.shallow-lightning' | 'tyrant.s5.sea-song' | 'ACCIDENT';
interface Ability { id: OceanSingerMoveId; label: string; weight: number; stance: SliceStance | null }
const ABILITIES: readonly Ability[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；身体12/自有原棍16×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；身体12/自有原棍16×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'EVADE', label: '有限风防（B，G；2灵性，对方−14；不足时普通避让−10）', weight: 20, stance: 'DEFEND' },
  { id: 'tyrant.s5.shallow-lightning', label: '浅层雷击（K，G；4灵性、知识14，成功24×掌握）', weight: 20, stance: 'CONTROL' },
  { id: 'tyrant.s5.sea-song', label: '短促歌声（R，G；3灵性、意志14，成功对方−16×掌握）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5，只抽一次）', weight: 5, stance: null },
];
export function isOceanSinger(s: SliceState): boolean {
  return s.progression?.pathwayId === 'tyrant' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function oceanSingerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, n) => sum + n, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawOceanSingerAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): OceanSingerMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, n) => sum + n, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('海洋歌者能力盘权重无效');
}

export interface OceanSingerCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'OCEAN_SINGER_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'BRUN_SINGLE_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; visible: true; distanceMetres: 2;
  playerBody: 'ORIGINAL_PLAYER_BODY'; playerHealth: number; playerMind: number;
  enemyHealth: number; enemyMind: number;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'BRUN_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_EMPTY_PRIVATE_QUAY';
  exit: 'ORIGINAL_OPEN_EXIT'; pursuit: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** FIRST_CASE keeps the actual original carrier and scene; only the paid quay
 * visit supplies the original dock foreman. Neither source invents a new field. */
export function currentOceanSingerCombatSource(s: SliceState): OceanSingerCombatSource | null {
  const c = s.combat;
  if (!isOceanSinger(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasOceanSingerOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', visible: true, distanceMetres: 2, playerBody: 'ORIGINAL_PLAYER_BODY',
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    weaponLocation: 'HAND', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.oceanSinger.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasOceanSingerDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'OCEAN_SINGER_DISPUTE', target: 'BRUN_SINGLE_ADULT',
    weapon: 'BRUN_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_QUAY',
    attemptWeek: s.oceanSinger.encounter.attemptWeek, startHistoryIndex: s.oceanSinger.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: OceanSingerCombatSource | null): boolean {
  const current = currentOceanSingerCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function mastery(s: SliceState, id: 'tyrant.s5.shallow-lightning' | 'tyrant.s5.sea-song'): number {
  const learned = s.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
}
export interface OceanSingerCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
const noEffect = (label: string): OceanSingerCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
/** Every slot is one actual action. Song and wind finish in that slot, and no
 * effect is stored for an unpaid later round or used to force surrender. */
export function resolveOceanSingerCombatAbility(
  s: SliceState, id: OceanSingerMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: OceanSingerCombatSource | null = currentOceanSingerCombatSource(s),
): OceanSingerCombatEffect {
  if (!validSource(s, source)) return noEffect('海洋歌者行动：缺少当前原活敌、2米可见目标、原身体或回合来源，0效果、0消耗，不重抽、不把原场景替换成码头');
  const target = source!.encounterId === 'FIRST_CASE' ? '原携铃者' : '码头管事布伦';
  if (id === 'tyrant.s5.shallow-lightning' || id === 'tyrant.s5.sea-song') {
    const lightning = id === 'tyrant.s5.shallow-lightning', cost = lightning ? 4 : 3;
    const label = lightning ? '浅层雷击' : '短促歌声', ability = lightning ? 'knowledge' : 'will';
    if (!Number.isFinite(s.spirituality) || s.spirituality < cost) {
      return noEffect(`${label}：灵性不足${cost}，0效果、0消耗，不重抽、不透支或调用高阶能力`);
    }
    s.spirituality -= cost;
    const chance = computeCheckChance({ ability, baseAbility: s.character.coreStats[ability], difficulty: 14, modifiers: [] });
    const succeeded = random.nextInt(1, 100) <= chance;
    if (lightning) return {
      ...noEffect(`浅层雷击：已耗4灵性，知识难度14检定${chance}%，${succeeded
        ? `成功；只向2米内当前可见的${target}发出一次浅层雷击，自身优势+24×雷击掌握（G），实际伤势仍由共同胜负与后果盘决定`
        : '失败或被抵抗，0效果；实付灵性不退回'}；不保证命中、不无视全部防御，不召唤雷暴、海啸或新增攻击`),
      selfGain: succeeded ? 24 * mastery(s, id) : 0, threatens: succeeded,
    };
    return {
      ...noEffect(`短促歌声：已耗3灵性，意志难度14检定${chance}%，${succeeded
        ? `成功；实际出声对2米内的${target}形成一次短暂分神，对方优势−16×歌声掌握（G）`
        : '失败或被抵抗，0效果；实付灵性不退回'}；本次实际战斗现场没有同伴，绝非自动识别或豁免友军；堵耳也不构成可靠免疫。歌声当次结束，不强迫意愿、睡眠或投降，不造成额外伤害、不删除敌方行动、不留下免费持续效果`),
      enemyReduction: succeeded ? 16 * mastery(s, id) : 0,
    };
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不追加行动'), selfGain: -22.5 };
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
    const armed = s.town.clubLocation === 'HAND';
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：${armed ? '使用自己持握的原普通短棍' : '使用自己的原身体'}打击（G），由共同胜负与伤势盘结算，不偷用对方原棍、不追加雷击或歌声`),
      selfGain: (armed ? 16 : 12) * physical, threatens: physical > 0 };
  }
  if (id === 'EVADE') {
    if (!Number.isFinite(s.spirituality) || s.spirituality < 2) return {
      ...noEffect('有限风防：灵性不足2，改用当前原身体普通避让，对方优势−10（G），不耗灵性、不重抽、不保证免伤'), enemyReduction: 10,
    };
    s.spirituality -= 2;
    return { ...noEffect('有限风防：已耗2灵性，仅以继承的有限气流干扰本次眼前普通打击，对方优势−14（G）；不建立持续护盾、不保证免伤、不飞行或补充灵性'), enemyReduction: 14 };
  }
  return noEffect('海洋歌者行动：不是本阶段已实现的战斗动作，0效果、0消耗；不提前获得序列4雷暴、海啸、大型海怪支配或无限潜水');
}
