import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { ScrollProfessorScroll, ScrollProfessorWorkshop } from '../scroll-professor/types.js';
import { advanceProphecyMasterLifeClock } from './life.js';
import { PROPHECY_MASTER_TARGET_ID, PROPHECY_MASTER_POWERS, PROPHECY_MASTER_POWER_IDS, hasProphecyMasterDisputeOpponent,
  type ProphecyMasterEnemyIntent, type ProphecyMasterPowerId, type ProphecyMasterEncounterScene } from './encounter.js';

/** All numerical effects, costs, distances and this original opponent are bounded G adaptation. */
export const PROPHECY_MASTER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const PROPHECY_MASTER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const prophecyMasterActionCount = pyromaniacActionCount;
export const prophecyMasterEnemyActionCount = pyromaniacActionCount;
const IMPACT = 'hermit.s6.scrollcraft', BODY = 'BODY_FOLLOWUP', WARD = 'BRIEF_WARD', CAGE = 'hermit.s5.star-cage', ECHO = 'hermit.s4.mystical-reenactment', GLIMPSE = 'hermit.s3.prophetic-glimpse';
const MASTERY_IDS = ['hermit.s8.combat-study', 'hermit.s7.spellcraft', IMPACT, CAGE, ECHO, GLIMPSE] as const;
export type ProphecyMasterMoveId = typeof IMPACT | typeof BODY | typeof WARD | typeof CAGE | typeof ECHO | typeof GLIMPSE | 'ACCIDENT';
const ABILITIES: readonly { id: ProphecyMasterMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: IMPACT, label: '原冲力卷1S／本人已学冲力2S／本人原棍或身体（H30，继承预算）', weight: 30, stance: 'ATTACK' },
  { id: BODY, label: '继承实练次击20.475×旧掌握×身体（J15，G）', weight: 15, stance: 'ATTACK' },
  { id: WARD, label: '原防护卷1S／本人已学防护2S／普通格挡（B20，继承预算）', weight: 20, stance: 'DEFEND' },
  { id: CAGE, label: '旧星光牢笼3S/知识14，下一正贡献身体打击×0.5（K15，G）', weight: 15, stance: 'CONTROL' },
  { id: ECHO, label: '已学迟钟回声4S/知识18，公开后仅15%效力（R10，G）', weight: 10, stance: 'PREPARE' },
  { id: GLIMPSE, label: '模糊预兆6S＋2M/知识18，仅本轮下一真实攻击×0.7（5，G）', weight: 5, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差固定−22.5（5，G）', weight: 5, stance: null },
];
export const PROPHECY_MASTER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光5S/70G', weight: 35 },
  { id: 'WARD', label: '原有限屏护4S/减势30G', weight: 25 },
  { id: 'BODY_STRIKE', label: '自己的原棍20×身体G', weight: 20 },
  { id: 'FEINT', label: '有预兆窗口时付3S真实假动作，无伤；无窗口0S普通观察', weight: 15 },
  { id: 'ACCIDENT', label: '实际失衡0贡献/0S', weight: 5 },
];
export const isProphecyMaster = (s: SliceState): boolean => s.progression.pathwayId === 'hermit' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function prophecyMasterAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100,
    label: a.id !== ECHO ? a.label : !s.mystic.life.echoLearned ? '未实际学会迟钟回声：普通观察0贡献/0S，不赠法术或聚焦'
      : `本人已学迟钟回声4S/知识18，下一实际付费弧光×${s.mystic.life.publicDisclosed ? '0.955，公开后仅15%效力' : '0.7，原来源未公开'}（R10，G）` }));
}
export function drawProphecyMasterAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ProphecyMasterMoveId {
  let roll = random.nextInt(1, tickets(stance).reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { roll -= tickets(stance)[i]!; if (roll <= 0) return a.id; }
  throw new Error('预言大师能力盘权重无效。');
}
export function drawProphecyMasterEnemyAbility(random: ActionRandomStream): ProphecyMasterEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of PROPHECY_MASTER_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as ProphecyMasterEnemyIntent; }
  throw new Error('原奥斯里克动作盘权重无效。');
}
export interface ProphecyMasterCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'PROPHECY_MASTER_DISPUTE'; targetId: typeof PROPHECY_MASTER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 48; targetSequence: 3; targetPhysique: 20; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'PM3-OSRIC-ROD'; weaponLocation: 'HAND'; distanceMetres: 4; space: 'PM3-COURT';
  abilitySource: 'ORIGINAL_LIMITED_G'; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; lifeClockSeconds: number;
  mastery: Record<string, number>; learnedImpact: boolean; learnedWard: boolean; echoLearned: boolean; publicDisclosed: boolean;
  workshop: ScrollProfessorWorkshop; scene: ProphecyMasterEncounterScene; powerUses: Record<ProphecyMasterPowerId, number>;
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const bounded = (v: number, max: number) => Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
const masteryFactor = (v: number) => .65 + .35 * bounded(v, 500) / 500;
const echoMultiplier = (disclosed: boolean) => disclosed ? .955 : .7;
export function currentProphecyMasterCombatSource(s: SliceState): ProphecyMasterCombatSource | null {
  if (!hasProphecyMasterDisputeOpponent(s)) return null;
  const e = s.prophecyMaster.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'PROPHECY_MASTER_DISPUTE', targetId: PROPHECY_MASTER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 48, targetSequence: 3, targetPhysique: 20, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'PM3-OSRIC-ROD', weaponLocation: 'HAND', distanceMetres: 4, space: 'PM3-COURT', abilitySource: 'ORIGINAL_LIMITED_G', ordinaryExit: true,
    pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk,
    clubHeld: s.town.clubLocation === 'HAND', knowledge: s.character.coreStats.knowledge, lifeClockSeconds: s.prophecyMaster.life.clockSeconds,
    mastery: Object.fromEntries(MASTERY_IDS.map(id => [id, s.progression.mastery[id] ?? 0])), learnedImpact: s.wizard.lessons['light-touch']?.learned === true,
    learnedWard: s.wizard.lessons['brief-ward']?.learned === true, echoLearned: s.mystic.life.echoLearned, publicDisclosed: s.mystic.life.publicDisclosed,
    workshop: structuredClone(s.scrollProfessor.workshop), scene: structuredClone(e.scene), powerUses: { ...e.powerUses } };
}
export interface ProphecyMasterCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends ProphecyMasterCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[]; mode: string }
export interface ProphecyMasterPlayerAction extends ActionEvidence {
  id: ProphecyMasterMoveId; mindCost: number; prepared: 'CAGE' | 'ECHO' | 'GLIMPSE' | null;
  scroll: Pick<ScrollProfessorScroll, 'id' | 'materialId' | 'makerSequence' | 'inscriptionMastery'> | null;
}
export interface ProphecyMasterEnemyAction extends ActionEvidence {
  planned: ProphecyMasterEnemyIntent; actual: ProphecyMasterEnemyIntent; cageConsumed: boolean; echoConsumed: boolean; windowConsumed: boolean; echoMultiplier: number;
}
export interface ProphecyMasterRoundContext {
  source: ProphecyMasterCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerActions: ProphecyMasterPlayerAction[]; enemyActions: ProphecyMasterEnemyAction[]; label: string; outcome: ProphecyMasterRoundOutcome | null;
}
const none = (label: string): ProphecyMasterCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string {
  return stableStringify({ spirituality: s.spirituality, mind: s.mind, encounter: s.prophecyMaster.encounter,
    workshop: s.scrollProfessor.workshop, clockSeconds: s.prophecyMaster.life.clockSeconds });
}
const dynamicSource = new Set(['playerSpirituality', 'playerMind', 'enemySpirituality', 'powerUses', 'workshop']);
function validRound(s: SliceState, r: ProphecyMasterRoundContext, supplied: ProphecyMasterCombatSource | null): boolean {
  const actual = currentProphecyMasterCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof ProphecyMasterCombatSource], value));
}
export function beginProphecyMasterCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): ProphecyMasterRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('预言大师战斗姿态无效。');
  const source = currentProphecyMasterCombatSource(s), e = s.prophecyMaster.encounter;
  if (!source || e.cageReady || e.echoReady || e.propheticWindow) throw new Error('缺少同一原奥斯里克、原棍与连续回合，或上一轮窗口未结束。');
  return { source, stance, finished: false, liveState: liveState(s), playerActions: [], enemyActions: [], outcome: null,
    label: `48岁原奥斯里克在净空原院4米外持自己的唯一原棍，独立S${source.enemySpirituality}/120。模糊预兆只准备本轮下一真实威胁，假动作可耗掉窗口；不先行攻击或保证未来。` };
}
export const createProphecyMasterCombatRound = beginProphecyMasterCombatRound;
interface Resources { playerS: number; playerM: number; enemyS: number; workshop: ScrollProfessorWorkshop; powers: Record<ProphecyMasterPowerId, number>; cage: boolean; echo: boolean; window: boolean }
function resources(s: SliceState): Resources {
  const e = s.prophecyMaster.encounter;
  return { playerS: s.spirituality, playerM: s.mind, enemyS: e.enemySpirituality, workshop: structuredClone(s.scrollProfessor.workshop), powers: { ...e.powerUses }, cage: e.cageReady, echo: e.echoReady, window: e.propheticWindow };
}
function commit(s: SliceState, r: ProphecyMasterRoundContext, q: Resources): void {
  const e = s.prophecyMaster.encounter; s.spirituality = q.playerS; s.mind = q.playerM; s.scrollProfessor.workshop = q.workshop;
  e.enemySpirituality = q.enemyS; e.powerUses = q.powers; e.cageReady = q.cage; e.echoReady = q.echo; e.propheticWindow = q.window; r.liveState = liveState(s);
}
/** Same physical inventory eligibility as Mystic4, also accepting an actually inscribed S3 original; progression never creates or upgrades a scroll. */
function authorizedOriginal(workshop: ScrollProfessorWorkshop, week: number, kind: ScrollProfessorScroll['kind']): ScrollProfessorScroll | null {
  const { scrolls, materials } = workshop;
  return scrolls.find(scroll => {
    if (scroll.kind !== kind || scroll.authorized !== true || scroll.status !== 'HELD' || scroll.usedWeek !== null || ![6, 5, 4, 3].includes(scroll.makerSequence) ||
      !Number.isFinite(scroll.inscriptionMastery) || scroll.inscriptionMastery < 0 || scroll.inscriptionMastery > 500 || !integer(scroll.createdWeek, 1, week) ||
      !/^scroll-professor-scroll-[1-9]\d*$/.test(scroll.id) || !/^scroll-professor-material-[1-9]\d*$/.test(scroll.materialId) ||
      scrolls.filter(x => x.id === scroll.id).length !== 1 || scrolls.filter(x => x.materialId === scroll.materialId).length !== 1) return false;
    const inputs = materials.filter(m => m.id === scroll.materialId), input = inputs[0];
    return inputs.length === 1 && !!input && input.status === 'SPENT' && integer(input.acquiredWeek, 1, scroll.createdWeek) && input.spentWeek === scroll.createdWeek;
  }) ?? null;
}
function rollsRequired(x: ProphecyMasterCombatSource, q: Resources, id: ProphecyMasterMoveId): number {
  return Number(id === CAGE && !q.cage && q.playerS >= 3 || id === ECHO && x.echoLearned && !q.echo && q.playerS >= 4 ||
    id === GLIMPSE && !q.window && q.playerS >= 6 && q.playerM > 2);
}
/** Pure transition shared by runtime and saved-evidence validation. */
function playerAction(x: ProphecyMasterCombatSource, q: Resources, id: ProphecyMasterMoveId, physical: number, rolls: number[], order: number): ProphecyMasterPlayerAction {
  const a: ProphecyMasterPlayerAction = { ...none(''), order, id, paidCost: 0, mindCost: 0, physicalFactor: physical, rolls: [...rolls], mode: 'NONE', prepared: null, scroll: null };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本次动作偏差固定−22.5G，0S，不重抽或假造高位灾难。'; }
  else if (id === BODY) { a.selfGain = 20.475 * masteryFactor(x.mastery['hermit.s8.combat-study'] ?? 0) * physical; a.threatens = a.selfGain > 0; a.mode = 'INHERITED_BODY'; a.label = '继承实练次击20.475×旧格斗掌握×实际身体G，独占一槽、0S。'; }
  else if (id === IMPACT || id === WARD) {
    const impact = id === IMPACT, budget = impact ? 38.025 : 42.25, scroll = authorizedOriginal(q.workshop, x.week, impact ? 'IMPACT' : 'WARD');
    let value: number;
    if (scroll && q.playerS >= 1) {
      a.paidCost = 1; a.mode = 'ORIGINAL_SCROLL'; scroll.status = 'USED'; scroll.usedWeek = x.week; scroll.authorized = false;
      a.scroll = { id: scroll.id, materialId: scroll.materialId, makerSequence: scroll.makerSequence, inscriptionMastery: scroll.inscriptionMastery };
      value = budget * masteryFactor(scroll.inscriptionMastery);
      a.label = `实际燃毁已授权${impact ? '冲力' : '防护'}原卷${scroll.id}，实付1S；原材料${scroll.materialId}、制作者序列${scroll.makerSequence}、封存掌握${scroll.inscriptionMastery}不变，继承预算${budget}×刻录系数G。`;
    } else if ((impact ? x.learnedImpact : x.learnedWard) && q.playerS >= 2) {
      a.paidCost = 2; a.mode = 'LEARNED_SPELL'; value = budget * masteryFactor(x.mastery['hermit.s7.spellcraft'] ?? 0);
      a.label = `本人实际已学${impact ? '冲力' : '短暂防护'}实付2S，继承${budget}×旧法术掌握G，不生成新卷或未知法术。`;
    } else {
      a.mode = 'ORDINARY'; value = (impact ? x.clubHeld ? 16 : 12 : 10) * physical;
      a.label = `${impact ? x.clubHeld ? '本人实际原棍16' : '本人原身体12' : '普通格挡10'}×身体G，0S，不借用原奥斯里克的棍或未知卷轴。`;
    }
    a.selfGain = impact ? value : 0; a.enemyReduction = impact ? 0 : value; a.threatens = impact && value > 0;
  } else {
    const ready = id === CAGE ? q.cage : id === ECHO ? q.echo : q.window, cost = id === CAGE ? 3 : id === ECHO ? 4 : 6;
    if (id === ECHO && !x.echoLearned) { a.mode = 'NOT_LEARNED'; a.label = '未实际学会旧迟钟回声，普通观察0贡献/0S；不送未知故事、眼镜聚焦或法术。'; }
    else if (ready) { a.mode = 'ALREADY_PREPARED'; a.label = '本轮同一有限效果尚待实际触发，不叠加、不再付费或抽检定。'; }
    else if (q.playerS < cost || id === GLIMPSE && q.playerM <= 2) { a.mode = 'LOW_RESOURCE'; a.label = '实际灵性或精神不足，普通观察0贡献/0消耗，不免费预言、不透支。'; }
    else {
      a.paidCost = cost; a.mindCost = id === GLIMPSE ? 2 : 0;
      const chance = computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: id === CAGE ? 14 : 18, modifiers: [] }), success = rolls[0]! <= chance;
      a.mode = success ? 'PREPARED' : 'FAILED';
      if (success) { a.prepared = id === CAGE ? 'CAGE' : id === ECHO ? 'ECHO' : 'GLIMPSE'; if (id === CAGE) q.cage = true; else if (id === ECHO) q.echo = true; else q.window = true; }
      a.label = id === GLIMPSE
        ? `实付6S＋2M，知识18实抽${rolls[0]}/${chance}；${success ? '只见模糊的棍影与一线弧光，解释仍不确定；准备本轮下一实际正贡献身体或付费弧光攻击×0.7G的窗口，敌先假动作亦可耗掉' : '未得可靠预兆，0贡献，费用不退'}。不提前知晓下一动作、不自动攻击或免伤，不改写既定历史。`
        : id === CAGE ? `旧星光牢笼实付3S，知识14实抽${rolls[0]}/${chance}；${success ? '只限制本轮下一正贡献身体打击×0.5G' : '失败无效，费用不退'}，不限制护术、弧光或思想。`
          : `本人已学迟钟回声实付4S，知识18实抽${rolls[0]}/${chance}；${success ? `下一实际付费正贡献弧光×${echoMultiplier(x.publicDisclosed)}G` : '未形成干扰，费用不退'}。${x.publicDisclosed ? '旧故事已公开，效力只余15%。' : '沿用原私密来源。'}不取消敌方费用或原行动。`;
    }
  }
  q.playerS -= a.paidCost; q.playerM -= a.mindCost; return a;
}
function enemyAction(x: ProphecyMasterCombatSource, q: Resources, planned: ProphecyMasterEnemyIntent, physical: number, order: number): ProphecyMasterEnemyAction {
  const power = PROPHECY_MASTER_POWERS.find(p => p.id === planned), noWindow = planned === 'FEINT' && !q.window;
  const usable = !!power && !noWindow && q.enemyS >= power.cost, actual = power && !usable && !noWindow ? 'BODY_STRIKE' : planned;
  const a: ProphecyMasterEnemyAction = { ...none(''), order, planned, actual, paidCost: usable ? power!.cost : 0, physicalFactor: physical, rolls: [],
    mode: noWindow ? 'NO_WINDOW' : actual !== planned ? 'ORDINARY_FALLBACK' : 'ORIGINAL', cageConsumed: false, echoConsumed: false, windowConsumed: false, echoMultiplier: 1 };
  if (usable) { q.enemyS -= a.paidCost; q.powers[power!.id]++; }
  if (actual === 'FEINT') {
    if (usable) { q.window = false; a.windowConsumed = true; }
    a.label = usable ? '原奥斯里克实付3S实际作出假动作，耗掉本轮预兆窗口；0贡献、无致伤威胁，不消耗旧牢笼或回声。' : '当前没有预兆窗口，原奥斯里克普通观察0贡献/0S；不假装施法、不直接造成伤害。';
  } else if (actual === 'ACCIDENT') a.label = '原奥斯里克实际失衡0贡献/0S，不恢复灵性或重抽。';
  else if (actual === 'WARD') { a.enemyReduction = 30; a.label = '同一原奥斯里克实际付4S施原有限屏护，减势30G；0致伤威胁，不消费预兆、牢笼或回声。'; }
  else {
    const raw = actual === 'ARC_BOLT' ? 70 : 20 * physical;
    a.cageConsumed = raw > 0 && actual === 'BODY_STRIKE' && q.cage;
    a.echoConsumed = raw > 0 && actual === 'ARC_BOLT' && usable && q.echo;
    a.windowConsumed = raw > 0 && q.window;
    a.echoMultiplier = a.echoConsumed ? echoMultiplier(x.publicDisclosed) : 1;
    a.selfGain = raw * (a.cageConsumed ? .5 : 1) * a.echoMultiplier * (a.windowConsumed ? .7 : 1); a.threatens = a.selfGain > 0;
    if (a.cageConsumed) q.cage = false; if (a.echoConsumed) q.echo = false; if (a.windowConsumed) q.window = false;
    a.label = `${actual === 'ARC_BOLT' ? '同一原奥斯里克实付5S完成原弧光70G' : `${a.mode === 'ORDINARY_FALLBACK' ? '原法术资源不足，0S普通回退；' : ''}以自己的唯一PM3-OSRIC-ROD实际打击20×身体G`}${a.cageConsumed ? '；旧牢笼本次×0.5后结束' : ''}${a.echoConsumed ? `；旧回声本次×${a.echoMultiplier}后结束` : ''}${a.windowConsumed ? '；付费预兆窗口只减本次实际威胁×0.7后结束' : ''}。费用不退，实际伤势仍由共同胜负与伤势盘决定。`;
  }
  return a;
}
export function resolveProphecyMasterCombatAbility(s: SliceState, id: ProphecyMasterMoveId, physical: number, random: ActionRandomStream,
  r: ProphecyMasterRoundContext, source: ProphecyMasterCombatSource | null = r.source): ProphecyMasterCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id)) return none('当前原人或原资源来源无效，0贡献/0消耗，不燃毁原卷、不重抽。');
  const q = resources(s), rolls = Array.from({ length: rollsRequired(r.source, q, id) }, () => random.nextInt(1, 100));
  const a = playerAction(r.source, q, id, bounded(physical, 1), rolls, r.playerActions.length + r.enemyActions.length);
  r.playerActions.push(a); commit(s, r, q); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveProphecyMasterEnemyAbility(s: SliceState, planned: ProphecyMasterEnemyIntent, physical: number, _random: ActionRandomStream,
  r: ProphecyMasterRoundContext, source: ProphecyMasterCombatSource | null = r.source): ProphecyMasterCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...PROPHECY_MASTER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('当前原奥斯里克或原资源来源无效，0贡献/0消耗，不重抽。');
  const q = resources(s), a = enemyAction(r.source, q, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length);
  r.enemyActions.push(a); commit(s, r, q); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface ProphecyMasterRoundOutcome {
  targetId: typeof PROPHECY_MASTER_TARGET_ID; round: number; source: ProphecyMasterCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number; playerSpiritualityBefore: number; playerSpiritualityAfter: number;
  playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number; powerUses: Record<ProphecyMasterPowerId, number>;
  sceneAfter: ProphecyMasterEncounterScene; workshopAfter: ScrollProfessorWorkshop; cageReadyAfter: false; echoReadyAfter: false; propheticWindowAfter: false;
  elapsedSeconds: 60; lifeClockSecondsAfter: number; playerActions: ProphecyMasterPlayerAction[]; enemyActions: ProphecyMasterEnemyAction[];
}
export function finishProphecyMasterCombatRound(s: SliceState, r: ProphecyMasterRoundContext, continuing = true): ProphecyMasterRoundOutcome {
  const e = s.prophecyMaster.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'PROPHECY_MASTER_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原回合已结束或原资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  if (!continuing && s.health > 0 && e.scene.playerPosition !== 'EXIT') { e.scene.ordinaryWalkedMetres += 4; e.scene.playerPosition = 'EXIT'; }
  e.cageReady = false; e.echoReady = false; e.propheticWindow = false; advanceProphecyMasterLifeClock(s, 60); r.finished = true;
  r.outcome = { targetId: PROPHECY_MASTER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk, playerSpiritualityBefore: r.source.playerSpirituality,
    playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    powerUses: { ...e.powerUses }, sceneAfter: structuredClone(e.scene), workshopAfter: structuredClone(s.scrollProfessor.workshop),
    cageReadyAfter: false, echoReadyAfter: false, propheticWindowAfter: false, elapsedSeconds: 60, lifeClockSecondsAfter: s.prophecyMaster.life.clockSeconds,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function prophecyMasterRoundOutcome(r: ProphecyMasterRoundContext): ProphecyMasterRoundOutcome { if (!r.outcome) throw new Error('先实际结束原回合。'); return structuredClone(r.outcome); }
export function projectProphecyMasterCombat(s: SliceState) {
  const e = s.prophecyMaster.encounter, visible = isProphecyMaster(s);
  return { enemyName: visible ? '奥斯里克·盖尔（48岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null, powerUses: visible ? { ...e.powerUses } : null,
    scene: visible ? structuredClone(e.scene) : null, source: visible ? currentProphecyMasterCombatSource(s) : null,
    summary: visible ? '双方1–6次，继承神秘学家4实际核心10/30/25/35；1250/底125、S120，只有CONTINUE恢复12。七槽H30/J15/B20/K15/R10/预兆5/失衡5。新预兆6S＋2M/知识18，成功只准备本轮下一实际身体或付费弧光正贡献×0.7；假动作能耗窗，失败与过期不退款，不自动攻击、免伤或揭露真相。原卷只用已有已授权原件，旧已学迟钟公开后仍仅15%效力；敌弧光5S/屏护4S/假动作有窗3S，资源不足普通原棍回退。原卢坎投降和旧故事105人公开历史不改。' : '' };
}
function validWorkshop(w: ScrollProfessorWorkshop, week: number): boolean {
  return !!w && integer(w.kitsBought) && integer(w.craftAttempts) && integer(w.craftFailures, 0, w.craftAttempts) &&
    (w.lastKitWeek === null || integer(w.lastKitWeek, 1, week)) && Array.isArray(w.materials) && Array.isArray(w.scrolls) &&
    new Set(w.materials.map(m => m.id)).size === w.materials.length && new Set(w.scrolls.map(s => s.id)).size === w.scrolls.length && new Set(w.scrolls.map(s => s.materialId)).size === w.scrolls.length &&
    w.materials.every(m => /^scroll-professor-material-[1-9]\d*$/.test(m.id) && integer(m.acquiredWeek, 1, week) &&
      (m.status === 'HELD' ? m.spentWeek === null : m.status === 'SPENT' && integer(m.spentWeek, m.acquiredWeek, week))) &&
    w.scrolls.every(s => /^scroll-professor-scroll-[1-9]\d*$/.test(s.id) && ['IMPACT', 'WARD'].includes(s.kind) && [6, 5, 4, 3].includes(s.makerSequence) && integer(s.inscriptionMastery, 0, 500) &&
      integer(s.createdWeek, 1, week) && typeof s.authorized === 'boolean' && (s.status === 'HELD' ? s.usedWeek === null : s.status === 'USED' && integer(s.usedWeek, s.createdWeek, week) && !s.authorized) &&
      w.materials.some(m => m.id === s.materialId && m.status === 'SPENT' && m.spentWeek === s.createdWeek && m.acquiredWeek <= s.createdWeek));
}
export function validProphecyMasterCombatScene(v: ProphecyMasterEncounterScene): boolean {
  return !!v && v.courtId === 'PM3-COURT' && v.ordinaryExit === 'OPEN' && v.thirdPartiesInArea === 0 && typeof v.clearanceConfirmed === 'boolean' &&
    ['COURT', 'EXIT'].includes(v.playerPosition) && v.distanceMetres === 4 && v.exitMetres === 4 && integer(v.ordinaryWalkedMetres, 0, 4);
}
export function validateProphecyMasterRoundOutcome(value: unknown): value is ProphecyMasterRoundOutcome {
  try {
    const o = value as ProphecyMasterRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || x.runId.length === 0 || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
      x.encounterId !== 'PROPHECY_MASTER_DISPUTE' || x.targetId !== PROPHECY_MASTER_TARGET_ID || x.targetAge !== 48 || x.targetSequence !== 3 || x.targetPhysique !== 20 ||
      x.actualOriginalBody !== true || x.independentMind !== true || x.enemyWeapon !== 'PM3-OSRIC-ROD' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 4 || x.space !== 'PM3-COURT' ||
      x.ordinaryExit !== true || x.pursuit !== false || x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.abilitySource !== 'ORIGINAL_LIMITED_G' ||
      ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.knowledge, 0, 10000) || typeof x.clubHeld !== 'boolean' ||
      !integer(x.lifeClockSeconds) || o.lifeClockSecondsAfter !== x.lifeClockSeconds + 60 || !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
      o.targetId !== PROPHECY_MASTER_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' ||
      o.elapsedSeconds !== 60 || o.cageReadyAfter !== false || o.echoReadyAfter !== false || o.propheticWindowAfter !== false || !integer(o.enemyHealth, 0, x.enemyHealth) || !integer(o.playerHealthAfter, 0, x.playerHealth) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) || o.enemyMind !== x.enemyMind || !integer(o.playerMindAfter, 1, x.playerMind) ||
      ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) || o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality ||
      !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || !same(Object.keys(x.powerUses).sort(), [...PROPHECY_MASTER_POWER_IDS].sort()) ||
      !PROPHECY_MASTER_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - PROPHECY_MASTER_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0) ||
      !validProphecyMasterCombatScene(x.scene) || !x.scene.clearanceConfirmed || x.scene.playerPosition !== 'COURT' || x.scene.ordinaryWalkedMetres !== 0 ||
      !validWorkshop(x.workshop, x.week) || !x.mastery || !same(Object.keys(x.mastery).sort(), [...MASTERY_IDS].sort()) || Object.values(x.mastery).some(n => !integer(n, 0, 500)) ||
      ![x.learnedImpact, x.learnedWard, x.echoLearned, x.publicDisclosed].every(v => typeof v === 'boolean') || x.publicDisclosed && !x.echoLearned) return false;
    const q: Resources = { playerS: x.playerSpirituality, playerM: x.playerMind, enemyS: x.enemySpirituality, workshop: structuredClone(x.workshop), powers: { ...x.powerUses }, cage: false, echo: false, window: false };
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') { const b = entry.a; if (!ABILITIES.some(v => v.id === b.id) || b.rolls.length !== rollsRequired(x, q, b.id) || !same(b, playerAction(x, q, b.id, b.physicalFactor, b.rolls, i))) return false; }
      else { const b = entry.a; if (![...PROPHECY_MASTER_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || !same(b, enemyAction(x, q, b.planned, b.physicalFactor, i))) return false; }
    }
    if ((!o.playerActions.some(a => a.threatens) && (o.enemyHealth !== x.enemyHealth || o.enemyStatus !== 'RESISTING' || !same(o.enemyInjuriesAfter, x.enemyInjuries))) ||
      (!o.enemyActions.some(a => a.threatens) && o.playerHealthAfter !== x.playerHealth)) return false;
    const scene = structuredClone(x.scene);
    if (!o.continuing && o.playerHealthAfter > 0) { scene.ordinaryWalkedMetres += 4; scene.playerPosition = 'EXIT'; }
    return q.playerS === o.playerSpiritualityAfter && q.playerM === o.playerMindAfter && q.enemyS === o.enemySpirituality && same(q.powers, o.powerUses) && same(q.workshop, o.workshopAfter) && same(scene, o.sceneAfter);
  } catch { return false; }
}
