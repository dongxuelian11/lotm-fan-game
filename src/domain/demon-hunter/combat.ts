import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { TRAVELER_COUNT_WHEEL, travelerActionCount } from '../traveler/combat.js';
import { hasGuardianOpenPractice } from '../guardian/encounter.js';
import { hasDemonHunterLifeLock } from './life.js';
import { DEMON_HUNTER_TARGET_ID, DEMON_HUNTER_POWERS, DEMON_HUNTER_POWER_IDS, hasDemonHunterDisputeOpponent,
  type DemonHunterCoating, type DemonHunterEnemyIntent, type DemonHunterPowerId } from './encounter.js';

export const DEMON_HUNTER_COUNT_WHEEL = TRAVELER_COUNT_WHEEL;
export const demonHunterActionCount = travelerActionCount;
export const DEMON_HUNTER_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const demonHunterEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const DEMON_HUNTER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'CORRUPTION_PULSE', label: '灰烬脉冲：5灵性，48×身体（G）', weight: 30 },
  { id: 'CINDER_GUARD', label: '可见灰壳格挡：3灵性，对方−30（G）', weight: 25 },
  { id: 'CINDER_LUNGE', label: '原身体短扑：4灵性，56×身体（G）', weight: 20 },
  { id: 'BODY_STRIKE', label: '原身体普通打击：18×身体（G）', weight: 20 },
  { id: 'ACCIDENT', label: '实际失衡：0贡献，不补灵性', weight: 5 },
];
export type DemonHunterMoveId = 'warrior.s6.dawn-weapon' | 'warrior.s4.targeted-preparation' | 'warrior.s5.guard-state'
  | 'warrior.s4.discern-corruption' | 'warrior.s4.veil-intent' | 'ACCIDENT';
const ABILITIES: readonly { id: DemonHunterMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'warrior.s6.dawn-weapon', label: '晨曦剑主攻（H，召剑4灵性＋实击2灵性；已有剑只付2；不能则普通身体12/原棍16）', weight: 30, stance: 'ATTACK' },
  { id: 'warrior.s4.targeted-preparation', label: '针对弱点涂层实击（J，已观察裂缝＋实际剑棍＋原涂层1份＋2灵性；否则普通次击8）', weight: 15, stance: 'ATTACK' },
  { id: 'warrior.s5.guard-state', label: '继承守护格挡（B，对方−35.1×守护掌握系数；无同伴分担）', weight: 20, stance: 'DEFEND' },
  { id: 'warrior.s4.discern-corruption', label: '实际观察原裂缝（K，4灵性/感知18；只记录此原目标，不自动诊断他人）', weight: 20, stance: 'CONTROL' },
  { id: 'warrior.s4.veil-intent', label: '隐蔽下一次进攻意图（R，3灵性/意志18；本轮仅防原哨卫一次预警，不物理隐形）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，固定−22.5，G）', weight: 5, stance: null },
];
export const isDemonHunter = (s: SliceState): boolean => s.progression.pathwayId === 'warrior' && s.progression.sequence === 4;
function tickets(stance: SliceStance | null) { return ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4)); }
export function demonHunterAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100,
    label: stance === 'DEFEND' && (a.id === 'warrior.s6.dawn-weapon' || a.id === 'warrior.s4.targeted-preparation')
      ? '保持整轮守护，不执行此攻击槽；0灵性、0涂层、0贡献' : `${a.label}${stance === 'DEFEND' ? '；开轮3灵性全力守护，整轮放弃攻击' : ''}` }));
}
export function drawDemonHunterAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): DemonHunterMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('猎魔者动作盘权重无效。');
}
export function drawDemonHunterEnemyAbility(random: ActionRandomStream): DemonHunterEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of DEMON_HUNTER_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as DemonHunterEnemyIntent; }
  throw new Error('原哨卫动作盘权重无效。');
}
export interface DemonHunterCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'DEMON_HUNTER_DISPUTE' | 'FIRST_CASE'; targetId: typeof DEMON_HUNTER_TARGET_ID | 'ORIGINAL_LIVING_CARRIER';
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number;
  clubLocation: SliceState['town']['clubLocation']; practiceClubLocation: string;
  actualOriginalBody: true; mutuallyVisible: true; distanceMetres: 2; ally: false;
  ordinaryExit: true; pursuit: false; attemptWeek: number | null; startHistoryIndex: number | null;
}
export function currentDemonHunterCombatSource(s: SliceState): DemonHunterCombatSource | null {
  const c = s.combat;
  if (!isDemonHunter(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 || hasDemonHunterLifeLock(s) || hasGuardianOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, clubLocation: s.town.clubLocation, practiceClubLocation: s.warrior.practiceClub.location,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, ally: false, ordinaryExit: true, pursuit: false } as const;
  if (c.encounterId === 'FIRST_CASE' && s.arc.stage === 'COMBAT' && s.world.carrierAlive && s.world.carrierCanResist && s.demonHunter.encounter.status !== 'FIGHTING') {
    return { ...common, encounterId: 'FIRST_CASE', targetId: 'ORIGINAL_LIVING_CARRIER', attemptWeek: null, startHistoryIndex: null };
  }
  return hasDemonHunterDisputeOpponent(s) ? { ...common, encounterId: 'DEMON_HUNTER_DISPUTE', targetId: DEMON_HUNTER_TARGET_ID,
    attemptWeek: s.demonHunter.encounter.attemptWeek, startHistoryIndex: s.demonHunter.encounter.startHistoryIndex } : null;
}
function validSource(s: SliceState, source: DemonHunterCombatSource | null): boolean {
  const current = currentDemonHunterCombatSource(s);
  return !!source && !!current && Object.entries(current).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value);
}
export interface DemonHunterRoundContext {
  source: DemonHunterCombatSource | null; defending: boolean; paidGuard: boolean; veilReady: boolean; finished: boolean;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; label: string;
}
export function beginDemonHunterCombatRound(s: SliceState, stance: SliceStance): DemonHunterRoundContext {
  const source = currentDemonHunterCombatSource(s), defending = stance === 'DEFEND', playerSpiritualityBefore = s.spirituality;
  const paidGuard = !!source && defending && Number.isFinite(s.spirituality) && s.spirituality >= 3;
  if (paidGuard) s.spirituality -= 3;
  return { source, defending, paidGuard, veilReady: false, finished: false, playerSpiritualityBefore,
    enemySpiritualityBefore: source?.targetId === DEMON_HUNTER_TARGET_ID ? s.demonHunter.encounter.enemySpirituality : 0,
    label: defending ? paidGuard ? '开轮实付3灵性全力守护，整轮放弃攻击；实际正向身体打击×0.35（G），不豁免真实伤势和死亡。'
      : '不足3灵性，整轮仍放弃攻击，仅普通防御×1；没有免费守护。'
      : '未建立全力守护，迎战正向身体打击×0.75（G），未自动召唤同伴或分担伤害。' };
}
export interface DemonHunterCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): DemonHunterCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function mastery(s: SliceState, id: string): number {
  const n = s.progression.mastery[id] ?? 0;
  return 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(n) ? n : 0)) / 500;
}
function clubHeld(s: SliceState): boolean {
  const c = s.warrior.practiceClub;
  return s.town.clubLocation === 'HAND' || c.id === 'warrior-training-club' && c.owner === '奥斯温·布莱克特' && c.custodian === 'PLAYER' && c.location === 'player:hand';
}
function ordinary(s: SliceState, physical: number, reason: string, secondary = false): DemonHunterCombatEffect {
  const amount = secondary ? 8 : clubHeld(s) ? 16 : 12;
  return { label: `${reason}；明确回退普通${secondary ? '次击' : '打击'}${amount}×当前身体（G），0灵性、0涂层，不伪造准备打击。`, selfGain: amount * physical, enemyReduction: 0, threatens: physical > 0 };
}
function check(s: SliceState, random: ActionRandomStream, ability: 'perception' | 'will', difficulty: number) {
  const r = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) });
  return { success: r.tier === 'SUCCESS' || r.tier === 'GREAT_SUCCESS', label: `${ability === 'perception' ? '感知' : '意志'}${difficulty}，成功率${r.chance}%，实抽${r.roll}` };
}
/** This creature's finite G intent reaction, never general invisibility. */
function warning(s: SliceState, r: DemonHunterRoundContext, effect: DemonHunterCombatEffect): DemonHunterCombatEffect {
  if (!effect.threatens || effect.selfGain <= 0 || r.source?.targetId !== DEMON_HUNTER_TARGET_ID) return effect;
  const e = s.demonHunter.encounter;
  if (r.veilReady) {
    r.veilReady = false;
    return { ...effect, label: `${effect.label} 本次进攻意图被隐蔽，只跳过原哨卫这一次意图预警；身体与剑棍依然可见，实际格挡仍能生效。` };
  }
  if (e.warningUses >= 3 || e.enemySpirituality < 2) return effect;
  e.warningUses += 1; e.enemySpirituality -= 2;
  return { ...effect, selfGain: Math.max(0, effect.selfGain - 8), threatens: effect.selfGain > 8, label: `${effect.label} 原哨卫以自身2灵性作第${e.warningUses}/3次意图预警，本次优势−8（G）；不额外攻击、不重抽行动。` };
}
export function resolveDemonHunterCombatAbility(s: SliceState, id: DemonHunterMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: DemonHunterRoundContext, source = currentDemonHunterCombatSource(s)): DemonHunterCombatEffect {
  if (!validSource(s, source) || !validSource(s, r.source) || r.finished) return none('本场实际原身体、原目标或回合来源不成立；0效果0消耗、不重抽。');
  const physical = Math.max(0, Math.min(1, Number.isFinite(physicalStateFactor) ? physicalStateFactor : 0)), e = s.demonHunter.encounter;
  const canPay = (n: number) => Number.isFinite(s.spirituality) && s.spirituality >= n;
  if (r.defending && (id === 'warrior.s6.dawn-weapon' || id === 'warrior.s4.targeted-preparation')) return none('本整轮已放弃攻击：此槽只保持守护，0灵性、0涂层，不凝剑、不挥棍或追加攻击。');
  if (id === 'ACCIDENT') return { ...none('本槽判断失衡，固定−22.5（G），不是攻击，不重新抽取。'), selfGain: -22.5 };
  if (id === 'warrior.s5.guard-state') return { ...none('继承守护自保：对方−35.1×守护掌握系数（G），本槽0灵性；不重复叠防御倍率，不分担不存在的同伴伤害。'), enemyReduction: 35.1 * mastery(s, id) };
  if (source?.targetId !== DEMON_HUNTER_TARGET_ID) {
    if (id === 'warrior.s6.dawn-weapon') return ordinary(s, physical, '首案仍是原普通携铃者，未建立侧院晨曦剑');
    if (id === 'warrior.s4.targeted-preparation') return ordinary(s, physical, '封装涂层不适用于首案原携铃者', true);
    return none('只观察首案原人和原出口；不把侧院目标弱点、意图感应或涂层移植给普通人，0灵性。');
  }
  if (id === 'warrior.s6.dawn-weapon') {
    if (physical <= 0) return none('当前身体无法实击，不付召剑或攻击成本。');
    if (!e.swordReady) {
      if (s.town.clubLocation === 'HAND' || s.warrior.practiceClub.location === 'player:hand') return warning(s, r, ordinary(s, physical, '原短棍占手，不自动收物或召双手晨曦剑'));
      if (!canPay(6)) return warning(s, r, ordinary(s, physical, '不足本槽召剑4＋实击2灵性，未召出半付费剑'));
      s.spirituality -= 4; e.swordReady = true; e.swordExpiresRound = s.combat!.round + 2;
    }
    if (!canPay(2)) return warning(s, r, ordinary(s, physical, '不足2灵性，现存晨曦剑不产生免费剑击'));
    s.spirituality -= 2;
    return warning(s, r, { label: `实际晨曦剑实击2灵性，必要时另付4召剑；剑到第${e.swordExpiresRound}轮末消散。继承71.825×晨曦武器掌握×身体（G），不自动认定神圣易伤，不召银甲或瞬移剑。`,
      selfGain: 71.825 * mastery(s, id) * physical, enemyReduction: 0, threatens: true });
  }
  if (id === 'warrior.s4.targeted-preparation') {
    const coating = e.coatings.find(c => c.status === 'SEALED');
    if (!coating) return warning(s, r, ordinary(s, physical, '原涂层库存为0，J明确只做普通次击', true));
    if (e.weaknessObservedRound === null) return warning(s, r, ordinary(s, physical, '没有实际观察的原裂缝，保留封装原涂层', true));
    if (!e.swordReady && !clubHeld(s)) return warning(s, r, ordinary(s, physical, '没有实际持握剑棍承载涂层，保留原涂层', true));
    if (!canPay(2) || physical <= 0) return warning(s, r, ordinary(s, physical, '不足2灵性或身体不能完成涂层实击，原库存不假扣', true));
    s.spirituality -= 2; coating.status = 'SPENT'; coating.usedRound = s.combat!.round;
    return warning(s, r, { label: `实付2灵性并将${coating.id}一次涂敷于${e.swordReady ? '实际晨曦剑' : '实际原短棍'}后击向亲见发光裂缝；本槽61.175×针对性准备掌握×身体（G）。涂层在这一次接触耗尽，封装空件与使用轮次保留，不净化其他目标、不补货。`,
      selfGain: 61.175 * mastery(s, id) * physical, enemyReduction: 0, threatens: true });
  }
  if (id === 'warrior.s4.discern-corruption') {
    if (e.weaknessObservedRound !== null) return none('已经观察同一原哨卫胸前发光裂缝；复核原事实，0灵性，不堆叠弱点或追加攻击。');
    if (!canPay(4)) return none('不足4灵性，未进行超凡辨察；不自动知道弱点。');
    s.spirituality -= 4; const test = check(s, random, 'perception', 18);
    if (!test.success) return none(`实付4灵性，${test.label}失败，尚不能定位裂缝；不返还成本。`);
    e.weaknessObservedRound = s.combat!.round;
    return none(`实付4灵性，${test.label}成功：实际观察到此原哨卫胸前发光裂缝与腐蚀痕迹，仅记录此处；不读完整历史、身份或善恶，也不附送涂层。`);
  }
  if (r.veilReady) return none('已有本轮待用的一次意图隐蔽，0消耗、不堆叠；身体仍可见。');
  if (!canPay(3)) return none('不足3灵性，无法隐蔽此次意图；身体与进攻预警均未改变。');
  s.spirituality -= 3; const test = check(s, random, 'will', 18);
  if (!test.success) return none(`实付3灵性，${test.label}失败；原哨卫仍能使用剩余有限预警。`);
  r.veilReady = true;
  return none(`实付3灵性，${test.label}成功：本轮下一次实际攻击避过原哨卫的一次意图预警。身体、声音、剑棍仍可感知，目视格挡不失效；未用效果轮末结束。`);
}
export function consumeDemonHunterDefense(s: SliceState, r: DemonHunterRoundContext, abilityId: string, actualContribution: number): { physicalMultiplier: number; label: string } | null {
  if (r.finished || !validSource(s, r.source) || !['STRIKE', 'BODY_STRIKE', 'CINDER_LUNGE'].includes(abilityId) || !Number.isFinite(actualContribution) || actualContribution <= 0) return null;
  const physicalMultiplier = r.defending ? r.paidGuard ? 0.35 : 1 : 0.75;
  return { physicalMultiplier, label: `本次真实身体打击贡献×${physicalMultiplier}（G），不叠旧光甲、不抵免共同伤势或死亡` };
}
export function resolveDemonHunterEnemyAbility(s: SliceState, id: DemonHunterEnemyIntent, physicalStateFactor: number, r: DemonHunterRoundContext): DemonHunterCombatEffect {
  if (r.finished || r.source?.targetId !== DEMON_HUNTER_TARGET_ID || !validSource(s, r.source)) throw new Error('没有同一原哨卫的实际当前回合。');
  const e = s.demonHunter.encounter, physical = Math.max(0, Math.min(1, Number.isFinite(physicalStateFactor) ? physicalStateFactor : 0));
  if (id === 'ACCIDENT') return none('原哨卫失衡，0贡献，不恢复灵性或预警次数。');
  const p = DEMON_HUNTER_POWERS.find(p => p.id === id), payable = p && e.enemySpirituality >= p.cost;
  const actual = payable ? id : 'BODY_STRIKE';
  if (payable) { e.enemySpirituality -= p.cost; e.powerUses[p.id] += 1; }
  const original = payable ? p.selfGain * physical : 18 * physical;
  const defense = consumeDemonHunterDefense(s, r, actual, original);
  return { label: payable ? `原哨卫实际${p.label}，从有限36灵性中支出${p.cost}，余${e.enemySpirituality}；${actual === 'CINDER_GUARD' ? '直接看见原身体与剑棍后格挡，隐蔽意图不取消它。' : ''}${defense?.label ?? ''}`
      : `原哨卫只以原身体普通打击18×身体（G）；无此法术或灵性不足时明确回退，不恢复资源。${defense?.label ?? ''}`,
    selfGain: original * (defense?.physicalMultiplier ?? 1), enemyReduction: payable ? p.enemyReduction : 0, threatens: original > 0 };
}
export interface DemonHunterRoundOutcome {
  targetId: typeof DEMON_HUNTER_TARGET_ID; round: number; source: DemonHunterCombatSource;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<DemonHunterPowerId, number>; warningUses: number; coatings: DemonHunterCoating[];
  weaknessObservedRound: number | null; swordReady: boolean; swordExpiresRound: number | null;
  defending: boolean; paidGuard: boolean;
}
export function finishDemonHunterCombatRound(s: SliceState, r: DemonHunterRoundContext, continuing: boolean): DemonHunterRoundOutcome | null {
  r.veilReady = false; r.finished = true;
  if (r.source?.targetId !== DEMON_HUNTER_TARGET_ID) return null;
  const e = s.demonHunter.encounter, c = s.combat!;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  if (!continuing || e.swordExpiresRound !== null && e.swordExpiresRound <= c.round) { e.swordReady = false; e.swordExpiresRound = null; }
  return { targetId: DEMON_HUNTER_TARGET_ID, round: c.round, source: { ...r.source }, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, playerSpiritualityBefore: r.playerSpiritualityBefore,
    playerSpiritualityAfter: s.spirituality, enemySpiritualityBefore: r.enemySpiritualityBefore,
    powerUses: { ...e.powerUses }, warningUses: e.warningUses, coatings: e.coatings.map(c => ({ ...c })), weaknessObservedRound: e.weaknessObservedRound,
    swordReady: e.swordReady, swordExpiresRound: e.swordExpiresRound, defending: r.defending, paidGuard: r.paidGuard };
}
export function projectDemonHunterCombat(s: SliceState) {
  const e = s.demonHunter.encounter;
  return { enemyName: '灰烬哨卫（DH4-CINDER-GUARD，原创受腐蚀生物，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    warningUses: e.warningUses, coatingsRemaining: e.coatings.filter(c => c.status === 'SEALED').length,
    weaknessObservedRound: e.weaknessObservedRound, swordReady: e.swordReady, swordExpiresRound: e.swordExpiresRound,
    originalExit: true, pursuit: false, enemyCountWheel: DEMON_HUNTER_ENEMY_COUNT_WHEEL, enemyAbilityWheel: DEMON_HUNTER_ENEMY_ABILITY_WHEEL };
}
export function validateDemonHunterRoundOutcome(v: unknown): v is DemonHunterRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as DemonHunterRoundOutcome, integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 120;
  if (Object.keys(p).length !== 18 || p.targetId !== DEMON_HUNTER_TARGET_ID || !integer(p.round, 1) ||
      !integer(p.enemyHealth, 0, 100) || !integer(p.enemyMind, 0, 100) || !integer(p.enemySpirituality, 0, 36) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 36) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !p.powerUses || Object.keys(p.powerUses).length !== 3 || DEMON_HUNTER_POWER_IDS.some(id => !integer(p.powerUses[id], 0, 12)) || !integer(p.warningUses, 0, 3) ||
      p.enemySpirituality !== 36 - p.warningUses * 2 - DEMON_HUNTER_POWERS.reduce((n, a) => n + p.powerUses[a.id] * a.cost, 0) ||
      typeof p.defending !== 'boolean' || typeof p.paidGuard !== 'boolean' || (p.paidGuard && (!p.defending || p.playerSpiritualityBefore - p.playerSpiritualityAfter < 3)) ||
      typeof p.swordReady !== 'boolean' || (p.swordReady ? !integer(p.swordExpiresRound, p.round + 1, p.round + 2) : p.swordExpiresRound !== null) ||
      (p.weaknessObservedRound !== null && !integer(p.weaknessObservedRound, 1, p.round)) || !Array.isArray(p.coatings) || ![0, 2].includes(p.coatings.length) ||
      p.coatings.some((c, i) => !c || Object.keys(c).length !== 4 || c.id !== `DH4-COATING-${i + 1}` || c.targetId !== DEMON_HUNTER_TARGET_ID ||
        !['SEALED', 'SPENT'].includes(c.status) || (c.status === 'SEALED' ? c.usedRound !== null : !integer(c.usedRound, p.weaknessObservedRound ?? Number.MAX_SAFE_INTEGER, p.round)))) return false;
  const a = p.source;
  return !!a && typeof a === 'object' && Object.keys(a).length === 20 && a.targetId === DEMON_HUNTER_TARGET_ID && a.encounterId === 'DEMON_HUNTER_DISPUTE' && a.round === p.round &&
    typeof a.runId === 'string' && a.runId.length > 0 && integer(a.revision, 0) && integer(a.week, 1) && a.attemptWeek === a.week && integer(a.startHistoryIndex, 0) &&
    integer(a.playerHealth, 1, 100) && integer(a.playerMind, 1, 100) && integer(a.enemyHealth, 1, 100) && integer(a.enemyMind, 1, 100) &&
    typeof a.clubLocation === 'string' && typeof a.practiceClubLocation === 'string' && a.actualOriginalBody === true && a.mutuallyVisible === true && a.distanceMetres === 2 && a.ally === false && a.ordinaryExit === true && a.pursuit === false;
}
