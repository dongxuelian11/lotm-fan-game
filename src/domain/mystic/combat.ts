import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { ScrollProfessorScroll } from '../scroll-professor/types.js';
import { STAR_MYSTIC_COUNT_WHEEL, starMysticActionCount } from '../star-mystic/combat.js';
import { MYSTIC_TARGET_ID, MYSTIC_POWERS, MYSTIC_POWER_IDS, hasMysticDisputeOpponent, type MysticEnemyIntent, type MysticPowerId } from './encounter.js';

/** All costs, weights, distances and finite effects are explicit G, not novel statistics. */
export const MYSTIC_COUNT_WHEEL = STAR_MYSTIC_COUNT_WHEEL;
export const mysticActionCount = starMysticActionCount;
export const MYSTIC_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const mysticEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const MYSTIC_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原弧光术：5灵性，贡献55（G）', weight: 40 },
  { id: 'WARD', label: '原小型护术：3灵性，对方−30（G）', weight: 30 },
  { id: 'BODY_STRIKE', label: '自有原棍普通打击：18×身体（G）', weight: 25 },
  { id: 'ACCIDENT', label: '实际失衡：0贡献，不恢复灵性', weight: 5 },
];
export type MysticMoveId = 'hermit.s6.scrollcraft' | 'BODY_FOLLOWUP' | 'BRIEF_WARD'
  | 'hermit.s5.star-cage' | 'hermit.s4.mystical-reenactment' | 'ACCIDENT';
const ABILITIES: readonly { id: MysticMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'hermit.s6.scrollcraft', label: '已授权冲力原卷轴1灵性／本人已学冲力2灵性／实际原棍或身体（H；继承预算）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承实练次击（J；20.475×旧掌握×身体，G）', weight: 15, stance: 'ATTACK' },
  { id: 'BRIEF_WARD', label: '已授权防护原卷轴1灵性／本人已学防护2灵性／普通格挡（B；继承预算）', weight: 20, stance: 'DEFEND' },
  { id: 'hermit.s5.star-cage', label: '原星光牢笼（K；3灵性、知识14；下一正贡献身体打击×0.5，本轮即散，G）', weight: 20, stance: 'CONTROL' },
  { id: 'hermit.s4.mystical-reenactment', label: '本人实际学会的迟钟回声（R；4灵性、知识18；下一正贡献弧光×0.7，G）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5，G）', weight: 5, stance: null },
];
export const isMystic = (s: SliceState): boolean => s.progression.pathwayId === 'hermit' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function mysticAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id !== 'hermit.s4.mystical-reenactment' ? a.label : s.mystic.life.echoLearned
      ? `本人实际学会的迟钟回声（R；4灵性、知识18；下一实际付费正贡献弧光×${s.mystic.life.publicDisclosed ? '0.955，公开后效力仅15%' : '0.7，私密原来源'}，G）；小护术与普通打击不消费回声`
      : s.starMystic.practice.lenses === 'WORN'
        ? '未学会迟钟回声：继承原眼镜聚焦（R；3灵性、2精神，仅下次K阈值+5，不同时给回声）'
        : '未学会迟钟回声且未佩戴原眼镜：普通观察（R；0贡献、0消耗，不赠未知法术或眼镜）' }));
}
export function drawMysticAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): MysticMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('神秘学家动作盘权重无效。');
}
export function drawMysticEnemyAbility(random: ActionRandomStream): MysticEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of MYSTIC_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as MysticEnemyIntent; }
  throw new Error('原卢坎动作盘权重无效。');
}
export interface MysticCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'MYSTIC_DISPUTE'; targetId: typeof MYSTIC_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 4; noBystanders: true; friendImmunity: false; ordinaryExit: true; pursuit: false;
  targetSequence: 5; targetPhysique: 20; enemyWeapon: 'MY4-LUCAN-CLUB'; space: 'ORIGINAL_MYSTIC_EMPTY_ANNEX';
  originalLenses: 'SM5-LENS-1' | null; echoLearned: boolean; publicDisclosed: boolean;
}
export function currentMysticCombatSource(s: SliceState): MysticCombatSource | null {
  if (!hasMysticDisputeOpponent(s)) return null;
  const e = s.mystic.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'MYSTIC_DISPUTE', targetId: MYSTIC_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, knowledge: s.character.coreStats.knowledge, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 4, noBystanders: true, friendImmunity: false, ordinaryExit: true, pursuit: false,
    targetSequence: 5, targetPhysique: 20, enemyWeapon: 'MY4-LUCAN-CLUB', space: 'ORIGINAL_MYSTIC_EMPTY_ANNEX',
    originalLenses: s.starMystic.practice.lenses === 'SUPPLIER' ? null : 'SM5-LENS-1',
    echoLearned: s.mystic.life.echoLearned, publicDisclosed: s.mystic.life.publicDisclosed };
}
export interface MysticCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface MysticPlayerAction {
  order: number; id: MysticMoveId; paidCost: number; mindCost: number;
  checkChance: number | null; checkRoll: number | null; prepared: 'CAGE' | 'ECHO' | 'FOCUS' | null; focusConsumed: boolean;
  scroll: Pick<ScrollProfessorScroll, 'id' | 'materialId' | 'makerSequence' | 'inscriptionMastery'> | null;
  selfGain: number; enemyReduction: number;
}
export interface MysticEnemyAction {
  order: number; planned: MysticEnemyIntent; actual: MysticEnemyIntent; paidCost: number;
  physicalFactor: number; cageApplied: boolean; echoApplied: boolean; echoMultiplier: number;
  selfGain: number; enemyReduction: number;
}
export interface MysticRoundContext {
  source: MysticCombatSource; stance: SliceStance; finished: boolean;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number;
  playerActions: MysticPlayerAction[]; enemyActions: MysticEnemyAction[]; label: string;
}
const none = (label: string): MysticCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const masteryFactor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => masteryFactor(s.progression.mastery[id] ?? 0);
const echoMultiplier = (publicDisclosed: boolean) => publicDisclosed ? .955 : .7;
function validRound(s: SliceState, r: MysticRoundContext, source: MysticCombatSource | null): boolean {
  const current = currentMysticCombatSource(s);
  return !r.finished && !!current && !!source && Object.entries(r.source).every(([k, v]) =>
    (source as unknown as Record<string, unknown>)[k] === v && (k === 'playerMind' || (current as unknown as Record<string, unknown>)[k] === v)) &&
    s.mind === r.source.playerMind - r.playerActions.reduce((n, a) => n + a.mindCost, 0) &&
    s.spirituality === r.playerSpiritualityBefore - r.playerActions.reduce((n, a) => n + a.paidCost, 0);
}
export function beginMysticCombatRound(s: SliceState, stance: SliceStance): MysticRoundContext {
  const source = currentMysticCombatSource(s); if (!source) throw new Error('缺少神秘学家当前原卢坎、原身体、净空原附院或连续回合来源。');
  return { source, stance, finished: false, playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: s.mystic.encounter.enemySpirituality,
    playerActions: [], enemyActions: [], label: '原卢坎在原独立附院4米外，原灵性有限40；没有旁人不代表友军免疫。' };
}
/** Original maker6/5/4 records retain the same sealed power and real spent input. */
function authorizedOriginal(s: SliceState, kind: ScrollProfessorScroll['kind']): ScrollProfessorScroll | null {
  const { scrolls, materials } = s.scrollProfessor.workshop;
  return scrolls.find(scroll => {
    if (scroll.kind !== kind || scroll.authorized !== true || scroll.status !== 'HELD' || scroll.usedWeek !== null ||
        ![6, 5, 4].includes(scroll.makerSequence) || !Number.isFinite(scroll.inscriptionMastery) || scroll.inscriptionMastery < 0 || scroll.inscriptionMastery > 500 ||
        !Number.isSafeInteger(scroll.createdWeek) || scroll.createdWeek < 1 || scroll.createdWeek > s.week ||
        !/^scroll-professor-scroll-[1-9]\d*$/.test(scroll.id) || !/^scroll-professor-material-[1-9]\d*$/.test(scroll.materialId) ||
        scrolls.filter(x => x.id === scroll.id).length !== 1 || scrolls.filter(x => x.materialId === scroll.materialId).length !== 1) return false;
    const inputs = materials.filter(x => x.id === scroll.materialId), input = inputs[0];
    return inputs.length === 1 && input !== undefined && input.status === 'SPENT' &&
      Number.isSafeInteger(input.acquiredWeek) && input.acquiredWeek >= 1 && input.acquiredWeek <= scroll.createdWeek && input.spentWeek === scroll.createdWeek;
  }) ?? null;
}
export function resolveMysticCombatAbility(s: SliceState, id: MysticMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: MysticRoundContext, source: MysticCombatSource | null = r.source): MysticCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('缺少本回合实际原卢坎来源，0贡献、0消耗，不燃毁原卷轴或重抽。');
  const a: MysticPlayerAction = { order: r.playerActions.length + r.enemyActions.length, id, paidCost: 0, mindCost: 0,
    checkChance: null, checkRoll: null, prepared: null, focusConsumed: false, scroll: null, selfGain: 0, enemyReduction: 0 };
  const result = resolvePlayer(s, id, bounded(physicalStateFactor, 1), random, a);
  a.selfGain = result.selfGain; a.enemyReduction = result.enemyReduction; r.playerActions.push(a); return result;
}
function resolvePlayer(s: SliceState, id: MysticMoveId, physical: number, random: ActionRandomStream, a: MysticPlayerAction): MysticCombatEffect {
  const e = s.mystic.encounter, canPay = (n: number) => Number.isFinite(s.spirituality) && s.spirituality >= n;
  const pay = (n: number) => { s.spirituality -= n; a.paidCost = n; };
  const check = (difficulty: number, bonus = 0) => {
    a.checkChance = Math.min(95, computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty, modifiers: [] }) + bonus);
    a.checkRoll = random.nextInt(1, 100); return a.checkRoll <= a.checkChance;
  };
  if (id === 'ACCIDENT') return { ...none('本次视线或动作偏差固定−22.5（G），0灵性，不假造高位注视或污染。'), selfGain: -22.5 };
  if (id === 'BODY_FOLLOWUP') {
    const selfGain = 20.475 * mastery(s, 'hermit.s8.combat-study') * physical;
    return { label: '继承实练次击20.475×旧格斗掌握×身体（G），独立占一槽，0灵性，不附赠攻击。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'hermit.s6.scrollcraft' || id === 'BRIEF_WARD') {
    const impact = id === 'hermit.s6.scrollcraft', budget = impact ? 38.025 : 42.25, kind = impact ? 'IMPACT' : 'WARD';
    const scroll = authorizedOriginal(s, kind), spell = impact ? 'light-touch' : 'brief-ward';
    if (scroll && canPay(1)) {
      pay(1); scroll.status = 'USED'; scroll.usedWeek = s.week; scroll.authorized = false;
      a.scroll = { id: scroll.id, materialId: scroll.materialId, makerSequence: scroll.makerSequence, inscriptionMastery: scroll.inscriptionMastery };
      const value = budget * masteryFactor(scroll.inscriptionMastery);
      return { label: `实际燃毁已授权${impact ? '冲力' : '防护'}原卷轴${scroll.id}，实付1灵性；原材料${scroll.materialId}、实际制作者序列${scroll.makerSequence}与封存掌握${scroll.inscriptionMastery}保留。仍用继承预算${budget}×刻录系数（G），不因晋升增强旧卷轴。`,
        selfGain: impact ? value : 0, enemyReduction: impact ? 0 : value, threatens: impact };
    }
    if (s.wizard.lessons[spell]?.learned === true && canPay(2)) {
      pay(2); const value = budget * mastery(s, 'hermit.s7.spellcraft');
      return { label: `本人实际已学${impact ? '有限冲力' : '短暂防护'}实付2灵性，继承${budget}×旧法术掌握（G），占同一槽，不生成新卷轴或未知法术。`, selfGain: impact ? value : 0, enemyReduction: impact ? 0 : value, threatens: impact };
    }
    const value = (impact ? s.town.clubLocation === 'HAND' ? 16 : 12 : 10) * physical;
    return { label: `${impact ? s.town.clubLocation === 'HAND' ? '实际本人原棍16' : '普通身体打击12' : '普通格挡10'}×身体（G），0灵性；无可支付的已授权原卷轴或本人已学法术，不借用原卢坎的棍或未知库存。`, selfGain: impact ? value : 0, enemyReduction: impact ? 0 : value, threatens: impact && value > 0 };
  }
  if (id === 'hermit.s5.star-cage') {
    if (e.cageReady) return none('原牢笼尚待本轮下一正贡献身体打击，不叠加、不再支付或抽判定。');
    if (!canPay(3)) return none('不足3灵性，原星光牢笼无法形成，0消耗，不透支。');
    const focused = e.focused && s.starMystic.practice.lenses === 'HELD'; pay(3);
    if (focused) { e.focused = false; a.focusConsumed = true; s.starMystic.practice.lenses = 'WORN'; }
    e.cageReady = check(14, focused ? 5 : 0); if (e.cageReady) a.prepared = 'CAGE';
    return none(`原星光牢笼实付3灵性，知识14判定${a.checkRoll}/100、阈值${a.checkChance}（G）${focused ? '；消费原眼镜聚焦+5，戴回同一原镜' : ''}；${e.cageReady ? '限制同一原卢坎下一次正贡献BODY_STRIKE×0.5，0即时贡献' : '遭原身体抵抗未成形，费用保留'}。不限制弧光、小护术、思想或所有动作，本轮结束即散。`);
  }
  if (s.mystic.life.echoLearned) {
    if (e.echoReady) return none('本轮迟钟回声尚待下一实际正贡献弧光，不叠加、不再付费或抽判定。');
    if (!canPay(4)) return none('不足4灵性，无法再现本人已学迟钟回声，0消耗；不转为眼镜双重增益。');
    pay(4); e.echoReady = check(18); if (e.echoReady) a.prepared = 'ECHO';
    return none(`本人实际研究原记录MY4-STORY-1学会的迟钟回声实付4灵性，知识18对抗判定${a.checkRoll}/100、阈值${a.checkChance}（G）；${e.echoReady ? `形成有限感知干扰，下一次实际付费正贡献弧光×${echoMultiplier(s.mystic.life.publicDisclosed)}` : '被原卢坎识破，未形成干扰，费用不退'}。${s.mystic.life.publicDisclosed ? '故事已真实公开，效力只余15%。' : '原来源尚未广泛公开。'}不是时间控制，不取消敌方法术或费用，不改变意愿，不同时聚焦眼镜，本轮结束即散。`);
  }
  if (e.focused) return none('本轮已抬起原眼镜，不重复聚焦、不叠加阈值；仍未学会任何再现法术。');
  if (s.starMystic.practice.lenses !== 'WORN') return none('未学会迟钟回声且未实际佩戴本人原厚眼镜，普通观察，0贡献、0灵性、0精神；不赠眼镜或未知法术。');
  if (!canPay(3) || !Number.isFinite(s.mind) || s.mind <= 2) return none('不能承担3灵性及2精神，保留原厚眼镜佩戴并普通观察，0消耗，不透支。');
  pay(3); a.mindCost = 2; s.mind -= 2; s.starMystic.practice.lenses = 'HELD'; e.focused = true; a.prepared = 'FOCUS';
  return none('未学会迟钟回声：实际抬起本人原厚眼镜SM5-LENS-1，继承有限聚焦实付3灵性、2精神，仅下次K知识阈值+5百分点，0即时贡献。本轮结束或使用后戴回同一原镜；没有再现成功、隐藏知识或未来视。');
}
export function resolveMysticEnemyAbility(s: SliceState, planned: MysticEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: MysticRoundContext, source: MysticCombatSource | null = r.source): MysticCombatEffect {
  if (!validRound(s, r, source) || ![...MYSTIC_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少本回合实际原卢坎来源，原敌不凭空施术或补灵性。');
  const e = s.mystic.encounter, power = MYSTIC_POWERS.find(p => p.id === planned), payable = !!power && e.enemySpirituality >= power.cost;
  const actual: MysticEnemyIntent = planned === 'ACCIDENT' ? 'ACCIDENT' : payable ? planned : 'BODY_STRIKE';
  const physical = bounded(physicalStateFactor, 1), rawGain = actual === 'ACCIDENT' ? 0 : payable ? power!.selfGain : 18 * physical;
  // Pay before applying the perceptual effect. The actual spell still completes.
  if (payable) { e.enemySpirituality -= power!.cost; e.powerUses[power!.id]++; }
  const cageApplied = actual === 'BODY_STRIKE' && rawGain > 0 && e.cageReady;
  const echoApplied = payable && rawGain > 0 && e.echoReady;
  const multiplier = echoApplied ? echoMultiplier(s.mystic.life.publicDisclosed) : 1;
  if (cageApplied) e.cageReady = false;
  if (echoApplied) e.echoReady = false;
  const selfGain = rawGain * (cageApplied ? .5 : multiplier), enemyReduction = payable ? power!.enemyReduction : 0;
  r.enemyActions.push({ order: r.playerActions.length + r.enemyActions.length, planned, actual, paidCost: payable ? power!.cost : 0,
    physicalFactor: physical, cageApplied, echoApplied, echoMultiplier: multiplier, selfGain, enemyReduction });
  return { label: `${actual === 'ACCIDENT' ? '原卢坎动作失衡，0贡献、0费用' : payable ? `同一原卢坎实际完成${power!.label}，先实付${power!.cost}灵性，余${e.enemySpirituality}/40` : `${power ? '原法术灵性不足，实际回退' : ''}自有原棍普通打击18×身体（G），0费用`}${cageApplied ? '；原星光牢笼只消费于本次正贡献身体打击×0.5，随即结束' : ''}${echoApplied ? `；有限迟钟感知干扰只令本次原弧光正贡献×${multiplier}，回声随即结束，已付费用不退` : ''}。没有取消原行动或直接扣健康。`, selfGain, enemyReduction, threatens: selfGain > 0 };
}
export interface MysticRoundOutcome {
  targetId: typeof MYSTIC_TARGET_ID; round: number; source: MysticCombatSource;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<MysticPowerId, number>; focused: false; cageReady: false; echoReady: false;
  playerActions: MysticPlayerAction[]; enemyActions: MysticEnemyAction[];
}
export function finishMysticCombatRound(s: SliceState, r: MysticRoundContext): MysticRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'MYSTIC_DISPUTE' || s.combat.round !== r.source.round) throw new Error('同一原回合已结束或不存在。');
  const e = s.mystic.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  if (e.focused && s.starMystic.practice.lenses === 'HELD') s.starMystic.practice.lenses = 'WORN';
  e.focused = false; e.cageReady = false; e.echoReady = false; r.finished = true;
  return { targetId: MYSTIC_TARGET_ID, round: c.round, source: { ...r.source }, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, playerSpiritualityBefore: r.playerSpiritualityBefore,
    playerSpiritualityAfter: s.spirituality, playerMindAfter: s.mind, enemySpiritualityBefore: r.enemySpiritualityBefore,
    powerUses: { ...e.powerUses }, focused: false, cageReady: false, echoReady: false,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectMysticCombat(s: SliceState) {
  const e = s.mystic.encounter, learned = s.mystic.life.echoLearned, disclosed = s.mystic.life.publicDisclosed;
  return { enemyName: '卢坎·维伊（MY4-LUCAN-VEY，原创成年序列5对手，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, powerUses: { ...e.powerUses }, focused: e.focused, cageReady: e.cageReady, echoReady: e.echoReady,
    echoLearned: learned, publicDisclosed: disclosed, effectFactor: learned ? disclosed ? .15 : 1 : 0,
    originalExit: true, pursuit: false, distanceMetres: 4, source: currentMysticCombatSource(s),
    summary: `原敌剩余灵性${e.enemySpirituality}/40。${learned ? `已学迟钟回声：下一实际付费弧光×${echoMultiplier(disclosed)}${disclosed ? '，公开后仅余15%效力' : ''}` : '尚未学会迟钟回声；R只能使用实际已佩戴原眼镜聚焦或普通观察'}。原牢笼仅限制下一正贡献身体打击；所有有限效果本轮结束，费用不退，原眼镜戴回。`,
    enemyCountWheel: MYSTIC_ENEMY_COUNT_WHEEL, enemyAbilityWheel: MYSTIC_ENEMY_ABILITY_WHEEL };
}
export function validateMysticRoundOutcome(v: unknown): v is MysticRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as MysticRoundOutcome;
  const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  const a = p.source;
  if (!a || typeof a !== 'object' || a.targetId !== MYSTIC_TARGET_ID || a.encounterId !== 'MYSTIC_DISPUTE' || a.round !== p.round ||
      typeof a.runId !== 'string' || a.runId.length === 0 || !integer(a.revision, 0) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex, 0) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 1, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !resource(a.knowledge, 10000) ||
      typeof a.clubLocation !== 'string' || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 4 || a.noBystanders !== true || a.friendImmunity !== false ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetSequence !== 5 || a.targetPhysique !== 20 || a.enemyWeapon !== 'MY4-LUCAN-CLUB' || a.space !== 'ORIGINAL_MYSTIC_EMPTY_ANNEX' ||
      (a.originalLenses !== null && a.originalLenses !== 'SM5-LENS-1') || typeof a.echoLearned !== 'boolean' || typeof a.publicDisclosed !== 'boolean' || (a.publicDisclosed && !a.echoLearned)) return false;
  if (p.targetId !== MYSTIC_TARGET_ID || !integer(p.round, 1) || !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind ||
      !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore || !integer(p.playerMindAfter, 1, a.playerMind) ||
      !p.powerUses || Object.keys(p.powerUses).length !== 2 || MYSTIC_POWER_IDS.some(id => !integer(p.powerUses[id], 0, 13)) ||
      p.enemySpirituality !== 40 - MYSTIC_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.focused !== false || p.cageReady !== false || p.echoReady !== false || !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 4) return false;
  let spent = 0, playerSpent = 0, mindSpent = 0, cage = false, echo = false, focus = false;
  const ordered = [...p.playerActions.map(x => ({ kind: 'PLAYER' as const, action: x })), ...p.enemyActions.map(x => ({ kind: 'ENEMY' as const, action: x }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 9))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index]!; if (entry.action.order !== index) return false;
    if (entry.kind === 'PLAYER') {
      const x = entry.action;
      if (!ABILITIES.some(m => m.id === x.id) || !integer(x.paidCost, 0, 4) || !integer(x.mindCost, 0, 2) || ![null, 'CAGE', 'ECHO', 'FOCUS'].includes(x.prepared) || typeof x.focusConsumed !== 'boolean' ||
          !Number.isFinite(x.selfGain) || !Number.isFinite(x.enemyReduction) || x.enemyReduction < 0 || (x.selfGain < 0 && (x.id !== 'ACCIDENT' || x.selfGain !== -22.5))) return false;
      if (x.checkRoll !== null) {
        const cageCheck = x.id === 'hermit.s5.star-cage', echoCheck = x.id === 'hermit.s4.mystical-reenactment' && a.echoLearned;
        if (!cageCheck && !echoCheck || !integer(x.checkRoll, 1, 100) || x.paidCost !== (cageCheck ? 3 : 4) ||
            x.checkChance === null || x.checkChance !== Math.min(95, computeCheckChance({ ability: 'knowledge', baseAbility: a.knowledge, difficulty: cageCheck ? 14 : 18, modifiers: [] }) + (x.focusConsumed ? 5 : 0)) ||
            x.prepared !== (x.checkRoll <= x.checkChance ? cageCheck ? 'CAGE' : 'ECHO' : null) || (cageCheck ? cage : echo)) return false;
      } else if (x.checkChance !== null || x.prepared === 'CAGE' || x.prepared === 'ECHO') return false;
      if (x.focusConsumed) { if (x.id !== 'hermit.s5.star-cage' || !focus || x.checkRoll === null) return false; focus = false; }
      if (x.prepared === 'FOCUS') {
        if (x.id !== 'hermit.s4.mystical-reenactment' || a.echoLearned || a.originalLenses !== 'SM5-LENS-1' || focus || x.paidCost !== 3 || x.mindCost !== 2) return false;
        focus = true;
      } else if (x.mindCost !== 0) return false;
      if (x.prepared === 'CAGE') cage = true;
      if (x.prepared === 'ECHO') { if (!a.echoLearned) return false; echo = true; }
      if (x.id === 'hermit.s5.star-cage' || x.id === 'hermit.s4.mystical-reenactment') {
        if (x.selfGain !== 0 || x.enemyReduction !== 0 || x.scroll !== null || (x.paidCost > 0 && x.checkRoll === null && x.prepared !== 'FOCUS')) return false;
      } else if (x.checkRoll !== null || x.focusConsumed || x.prepared !== null || x.mindCost !== 0) return false;
      if (x.id === 'ACCIDENT' && (x.paidCost !== 0 || x.selfGain !== -22.5 || x.enemyReduction !== 0 || x.scroll !== null)) return false;
      if (x.id === 'BODY_FOLLOWUP' && (x.paidCost !== 0 || x.selfGain < 0 || x.selfGain > 20.475 || x.enemyReduction !== 0 || x.scroll !== null)) return false;
      if (x.id === 'hermit.s6.scrollcraft' || x.id === 'BRIEF_WARD') {
        const impact = x.id === 'hermit.s6.scrollcraft', value = impact ? x.selfGain : x.enemyReduction, limit = impact ? 38.025 : 42.25;
        if (x.paidCost > 2 || value < 0 || value > limit || (impact ? x.enemyReduction !== 0 : x.selfGain !== 0) || (x.paidCost === 1) !== (x.scroll !== null)) return false;
        if (x.scroll && (!/^scroll-professor-scroll-[1-9]\d*$/.test(x.scroll.id) || !/^scroll-professor-material-[1-9]\d*$/.test(x.scroll.materialId) ||
            ![6, 5, 4].includes(x.scroll.makerSequence) || !resource(x.scroll.inscriptionMastery, 500) || Math.abs(value - limit * masteryFactor(x.scroll.inscriptionMastery)) > 1e-9)) return false;
      }
      playerSpent += x.paidCost; mindSpent += x.mindCost;
      if (playerSpent > p.playerSpiritualityBefore || a.playerMind - mindSpent < 1) return false;
    } else {
      const x = entry.action, power = MYSTIC_POWERS.find(q => q.id === x.planned), payable = !!power && p.enemySpiritualityBefore - spent >= power.cost;
      if (![...MYSTIC_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned) || !resource(x.physicalFactor, 1) || typeof x.cageApplied !== 'boolean' || typeof x.echoApplied !== 'boolean' ||
          x.actual !== (x.planned === 'ACCIDENT' ? 'ACCIDENT' : payable ? x.planned : 'BODY_STRIKE') || x.paidCost !== (payable ? power!.cost : 0)) return false;
      const raw = x.actual === 'ACCIDENT' ? 0 : payable ? power!.selfGain : 18 * x.physicalFactor;
      if (x.cageApplied !== (x.actual === 'BODY_STRIKE' && raw > 0 && cage) || x.echoApplied !== (payable && raw > 0 && echo) ||
          x.echoMultiplier !== (x.echoApplied ? echoMultiplier(a.publicDisclosed) : 1) || x.selfGain !== raw * (x.cageApplied ? .5 : x.echoMultiplier) || x.enemyReduction !== (payable ? power!.enemyReduction : 0)) return false;
      if (x.cageApplied) cage = false;
      if (x.echoApplied) echo = false;
      spent += x.paidCost;
    }
  }
  return p.enemySpiritualityBefore - spent === p.enemySpirituality && p.playerSpiritualityBefore - playerSpent === p.playerSpiritualityAfter && a.playerMind - mindSpent === p.playerMindAfter;
}
