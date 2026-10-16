import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { REAPER_COUNT_WHEEL, reaperActionCount } from '../reaper/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { hasSpiritWarlockDisputeOpponent, hasSpiritWarlockOpenPractice,
  recallSpiritWarlockCombatCompanion, releaseSpiritWarlockCombatDream } from './encounter.js';

/** Independent S5 G profile. No change to the existing Darkness S9–6 wheels. */
export const SPIRIT_WARLOCK_COUNT_WHEEL: readonly SliceWheelEntry[] = REAPER_COUNT_WHEEL;
export const spiritWarlockActionCount = reaperActionCount;
export type SpiritWarlockMoveId = 'STRIKE' | 'SECONDARY_STRIKE' | 'darkness.s5.spirit-assistance'
  | 'darkness.s7.dream-entry' | 'darkness.s5.spirit-shelter' | 'ACCIDENT';
const ABILITIES: readonly { id: SpiritWarlockMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '普通主攻（H，G；原身体12/自有原棍16×身体）', weight: 30, stance: 'ATTACK' },
  { id: 'SECONDARY_STRIKE', label: '普通次攻（J，G；原身体12/自有原棍16×身体）', weight: 15, stance: 'ATTACK' },
  { id: 'darkness.s5.spirit-assistance', label: '原灵协助（B，G；已出动卷叶另耗2灵性，对方−18；否则普通自保）', weight: 20, stance: 'DEFEND' },
  { id: 'darkness.s7.dream-entry', label: '继承渐进梦境牵制（K，G；3灵性，积累0→1→2，意志14）', weight: 20, stance: 'CONTROL' },
  { id: 'darkness.s5.spirit-shelter', label: '唤出实际封存原灵（R，G；2灵性，0优势）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，G；固定−22.5）', weight: 5, stance: null },
];
export function isSpiritWarlock(s: SliceState): boolean {
  return s.progression?.pathwayId === 'darkness' && s.progression.sequence === 5;
}
function tickets(stance: SliceStance | null): number[] {
  return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
}
export function spiritWarlockAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label,
    weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawSpiritWarlockAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): SpiritWarlockMoveId {
  const weights = tickets(stance);
  let roll = random.nextInt(1, weights.reduce((sum, weight) => sum + weight, 0));
  for (let i = 0; i < ABILITIES.length; i += 1) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('灵巫能力盘权重无效');
}
export interface SpiritWarlockCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'SPIRIT_WARLOCK_DISPUTE';
  target: 'ORIGINAL_LIVING_CARRIER' | 'OLIN_SINGLE_ORDINARY_ADULT';
  nature: 'ADULT_LIVING_HUMAN'; visible: true; distanceMetres: 2;
  playerBody: 'ORIGINAL_PLAYER_BODY'; playerHealth: number; playerMind: number;
  enemyHealth: number; enemyMind: number;
  weapon: 'ORIGINAL_CARRIER_CLUB' | 'OLIN_ORIGINAL_CLUB'; weaponLocation: 'HAND';
  space: 'ORIGINAL_FIRST_CASE' | 'ORIGINAL_EMPTY_PRIVATE_COURTYARD';
  exit: 'ORIGINAL_OPEN_EXIT'; ground: 'CLEAR_ORDINARY_GROUND'; pursuit: false;
  attemptWeek: number | null; startHistoryIndex: number | null;
}
/** Each live scene owns its actual adult, held club and current body. Neither an
 * old Alan/Kell encounter nor a daily spirit contact can supply these facts. */
export function currentSpiritWarlockCombatSource(s: SliceState): SpiritWarlockCombatSource | null {
  const c = s.combat;
  if (!isSpiritWarlock(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 ||
      !Number.isFinite(s.mind) || s.mind <= 0 || s.activeEvent !== null || s.world.city !== 'BACKLUND' ||
      !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      hasSpiritWarlockOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    nature: 'ADULT_LIVING_HUMAN', visible: true, distanceMetres: 2, playerBody: 'ORIGINAL_PLAYER_BODY',
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    weaponLocation: 'HAND', exit: 'ORIGINAL_OPEN_EXIT', ground: 'CLEAR_ORDINARY_GROUND', pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE') {
    if (s.arc.stage !== 'COMBAT' || !s.world.carrierAlive || !s.world.carrierCanResist ||
        s.spiritWarlock.encounter.status === 'FIGHTING') return null;
    return { ...common, encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null };
  }
  if (!hasSpiritWarlockDisputeOpponent(s)) return null;
  return { ...common, encounterId: 'SPIRIT_WARLOCK_DISPUTE', target: 'OLIN_SINGLE_ORDINARY_ADULT',
    weapon: 'OLIN_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_COURTYARD',
    attemptWeek: s.spiritWarlock.encounter.attemptWeek, startHistoryIndex: s.spiritWarlock.encounter.startHistoryIndex };
}
function validSource(s: SliceState, source: SpiritWarlockCombatSource | null): boolean {
  const current = currentSpiritWarlockCombatSource(s);
  return current !== null && source !== null && Object.entries(current).every(([key, value]) =>
    (source as unknown as Record<string, unknown>)[key] === value);
}
function acquiredOriginalSpirit(s: SliceState): boolean {
  const companion = s.spiritWarlock.companion, promotion = s.spiritWarlock.promotionWeek;
  return companion.source === 'SW5-LEAF-1' && Number.isSafeInteger(promotion) && promotion !== null &&
    Number.isSafeInteger(companion.acquiredWeek) && companion.acquiredWeek !== null &&
    companion.acquiredWeek >= promotion && companion.acquiredWeek <= s.week &&
    Number.isSafeInteger(companion.invitedWeek) && companion.invitedWeek !== null &&
    companion.invitedWeek >= companion.acquiredWeek && companion.invitedWeek <= s.week &&
    s.spiritWarlock.cases['listening-leaves']?.status !== 'AVAILABLE' &&
    Number.isSafeInteger(companion.deployments) && Number.isSafeInteger(companion.recalls) &&
    companion.deployments >= 0 && companion.recalls >= 0 &&
    companion.deployments - companion.recalls === (companion.status === 'DEPLOYED' ? 1 : 0);
}
export interface SpiritWarlockCombatEffect {
  label: string; selfGain: number; enemyReduction: number; threatens: boolean;
}
const noEffect = (label: string): SpiritWarlockCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
export function resolveSpiritWarlockCombatAbility(
  s: SliceState, id: SpiritWarlockMoveId, physicalStateFactor: number, random: ActionRandomStream,
  source: SpiritWarlockCombatSource | null = currentSpiritWarlockCombatSource(s),
): SpiritWarlockCombatEffect {
  if (!validSource(s, source)) return noEffect('灵巫行动：缺少同场原活敌、当前原身体或回合来源，0效果、0消耗，不重抽');
  const e = s.spiritWarlock.encounter, companion = s.spiritWarlock.companion;
  if (id === 'darkness.s5.spirit-shelter') {
    if (companion.status !== 'SEALED' || !acquiredOriginalSpirit(s)) {
      return noEffect('唤出原灵：没有实际独立取得并封存在原牙齿中的卷叶，或原灵已经出动；0效果、0消耗，不凭空造灵、不重抽');
    }
    if (!Number.isFinite(s.spirituality) || s.spirituality < 2) return noEffect('唤出原灵：灵性不足2，0效果、0消耗，卷叶仍在原牙齿休息，不重抽');
    s.spirituality -= 2; companion.status = 'DEPLOYED'; companion.deployments += 1;
    return noEffect('唤出原灵：耗灵性2，同一卷叶SW5-LEAF-1从原牙齿安息处出动；本次优势0，没有额外行动、复制灵或免费协助；本体仍在原地');
  }
  if (id === 'darkness.s5.spirit-assistance') {
    if (companion.status === 'DEPLOYED' && acquiredOriginalSpirit(s)) {
      if (!Number.isFinite(s.spirituality) || s.spirituality < 2) return noEffect('原灵协助：灵性不足2，本次协助0效果、0消耗，不补灵性、不重抽；原卷叶仍在场');
      s.spirituality -= 2;
      return { ...noEffect(`原灵协助：耗灵性2，实际已出动的同一卷叶在近处作有限干扰，对方优势−18（原创G）；${e.dreamLocked ? '你维持梦境且本体仍不能移动，原灵照常完成本次已抽中的协助' : '本次只结算已抽中的B槽'}，没有另给自主行动、不保证免伤或造成身体伤害`), enemyReduction: 18 };
    }
    if (e.dreamLocked) return noEffect('普通身体自保：没有可用的已出动原卷叶；维持梦境时本体不能移动，本次0效果、0消耗，不虚构协助、不重抽');
    return { ...noEffect('普通身体自保：原卷叶尚未实际出动，本次只以原身体避让，对方优势−10（G），不耗灵性、不保证免伤'), enemyReduction: 10 };
  }
  if (id === 'darkness.s7.dream-entry') {
    if (e.dreamLocked) return noEffect('继承梦境牵制：维持现有有限梦境，本体不能移动；本次0效果、0消耗，不重复锁定、不重抽');
    if (!Number.isFinite(s.spirituality) || s.spirituality < 3) return noEffect('继承梦境牵制：灵性不足3，0效果、0消耗，不作检定、不重抽');
    s.spirituality -= 3; e.pressure = e.pressure === 0 ? 1 : 2;
    const name = source!.encounterId === 'FIRST_CASE' ? '原携铃者' : '奥林';
    if (e.pressure < 2) return noEffect(`继承渐进牵梦：耗灵性3，原清醒目标${name}的牵引积累1/2（G），本次优势0；没有瞬间催眠、不读取秘密、不删除原行动`);
    const result = resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will,
      difficulty: 14, modifiers: [], roll: random.nextInt(1, 100) });
    s.lastCheck = result;
    const success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
    if (success) e.dreamLocked = true; else releaseSpiritWarlockCombatDream(s);
    const learned = s.progression.mastery['darkness.s7.dream-entry'] ?? 0;
    const mastery = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(learned) ? learned : 0)) / 500;
    return { ...noEffect(`继承渐进牵梦：耗灵性3，积累2/2后意志${result.roll}/${result.chance}，${success ? '成功；短暂维持梦境，本体不能移动，但实际出动卷叶仍可按已抽中B槽协助；对手下次原行动仍会抵抗' : '目标抵抗，积累归0，本次贡献0'}；不读心、不制造伤势、不删除行动次数`), enemyReduction: success ? 15.75 * mastery : 0 };
  }
  if (id === 'STRIKE' || id === 'SECONDARY_STRIKE') {
    if (e.dreamLocked) return noEffect('维持梦境时本体不能移动：本次已抽中的原身体或原短棍攻击贡献0，不耗资源、不重抽；不能借原灵绕过身体限制');
    const physical = Number.isFinite(physicalStateFactor) ? Math.max(0, Math.min(1, physicalStateFactor)) : 0;
    const armed = s.town.clubLocation === 'HAND';
    return { ...noEffect(`${id === 'STRIKE' ? '普通主攻' : '普通次攻'}：使用${armed ? '自己当前持握的原普通短棍' : '自己的原身体'}打击，仍由共同胜负和真实伤势盘结算（G）`),
      selfGain: (armed ? 16 : 12) * physical, threatens: physical > 0 };
  }
  if (id === 'ACCIDENT') return { ...noEffect('判断失衡：本槽固定优势−22.5（G），不另抽正负、不额外调用原灵'), selfGain: -22.5 };
  return noEffect('灵巫行动：不是本阶段已经实现的动作，0效果、0消耗；不赠飞行、穿地、内置冥界或厄运');
}
export { releaseSpiritWarlockCombatDream } from './encounter.js';
/** A real lock ends after its resisted action or round. Incomplete pressure can
 * span continuing rounds; neither pressure nor a deployment survives battle. */
export function finishSpiritWarlockCombatRound(s: SliceState, continuing: boolean): string | null {
  const locked = s.spiritWarlock.encounter.dreamLocked;
  if (!continuing || locked) releaseSpiritWarlockCombatDream(s);
  const recalled = !continuing && recallSpiritWarlockCombatCompanion(s);
  return locked || recalled ? `${locked ? '本轮梦境牵制解除，本体恢复行动、积累归0。' : ''}${recalled ? '同一卷叶实际返回原牙齿休息，出动结束；不治疗、不补灵性、不移动原便条。' : ''}` : null;
}
export function resolveSpiritWarlockEnemyAction(
  s: SliceState, random: ActionRandomStream, physicalAttack: boolean,
): { suppressed: boolean; physicalMultiplier: 1 | 1.25; label: string } | null {
  if (!currentSpiritWarlockCombatSource(s)) { releaseSpiritWarlockCombatDream(s); return null; }
  if (!s.spiritWarlock.encounter.dreamLocked) return null;
  const result = resolveNormalCheck({ ability: 'will', baseAbility: 8,
    difficulty: s.character.coreStats.will, modifiers: [], roll: random.nextInt(1, 100) });
  s.lastCheck = result;
  const resisted = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  const name = s.combat!.encounterId === 'FIRST_CASE' ? '原携铃者' : '奥林';
  releaseSpiritWarlockCombatDream(s);
  return { suppressed: !resisted, physicalMultiplier: resisted && physicalAttack ? 1.25 : 1,
    label: `${name}抵抗继承梦境：意志8对施术者意志${result.difficulty}（G），${result.roll}/${result.chance}，${resisted ? `成功，执行本次原行动${physicalAttack ? '；本体暴露使本次原身体打击×1.25' : ''}` : '未抵抗，仅本次已抽中的原行动贡献0，次数仍消耗'}；梦境实际解除、积累归0，原卷叶保持原出动状态` };
}
