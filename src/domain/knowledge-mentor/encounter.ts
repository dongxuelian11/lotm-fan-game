import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { AlchemistCreation } from '../alchemist/life.js';
import { hasAlchemistLifeLock } from '../alchemist/life.js';
import { hasArcaneScholarLifeLock } from '../arcane-scholar/life.js';
import { findKnowledgeMentorOriginalCreation, hasKnowledgeMentorLifeLock, knowledgeMentorLifeOriginalTail,
  validateKnowledgeMentorCombatPlate, type KnowledgeMentorCombatPlate } from './life.js';
import { currentKnowledgeMentorCombatSource, validateKnowledgeMentorCombatSource, validateKnowledgeMentorRoundOutcome, type KnowledgeMentorCombatSource, type KnowledgeMentorRoundOutcome } from './combat.js';
import { validateKnowledgeMentorRecordedRound } from '../slice/knowledge-mentor-combat.js';

export const KNOWLEDGE_MENTOR_TARGET_ID = 'KM2-ROWAN-HALE' as const;
export const KNOWLEDGE_MENTOR_POWER_IDS = ['ARC_BOLT', 'WARD', 'JAM'] as const;
export type KnowledgeMentorPowerId = typeof KNOWLEDGE_MENTOR_POWER_IDS[number];
export type KnowledgeMentorEnemyIntent = KnowledgeMentorPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export const KNOWLEDGE_MENTOR_POWERS = [
  { id: 'ARC_BOLT', label: '候选有限弧光术（G）', cost: 7, selfGain: 105, enemyReduction: 0 },
  { id: 'WARD', label: '候选有限护术（G）', cost: 6, selfGain: 0, enemyReduction: 60 },
  { id: 'JAM', label: '候选有限定向干扰（G）', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
type ObjectId = 'AL4-BOX-1' | 'AL4-FRAME-1';
export interface KnowledgeMentorEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface KnowledgeMentorEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof KNOWLEDGE_MENTOR_TARGET_ID;
  approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<KnowledgeMentorPowerId, number>;
  carriedIds: ObjectId[]; carriedPlateIds: string[]; entryCreations: AlchemistCreation[]; entryPlates: KnowledgeMentorCombatPlate[];
  protocolUses: number; protocolSuccesses: number; calibrationUses: number; calibrationSuccesses: number; calibrationEffects: number; totalOwnerMindSpent: number;
  retrievedIds: ObjectId[]; retrievedPlateIds: string[]; exitTravelMetres: 0 | 4; exitSeconds: 0 | 4;
  startSource: KnowledgeMentorCombatSource | null; terminal: KnowledgeMentorEncounterTerminal | null;
}
export type KnowledgeMentorEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface KnowledgeMentorEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: KnowledgeMentorEncounterCommand }
export interface KnowledgeMentorEncounterProjection {
  title: string; story: string; status: KnowledgeMentorEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof KNOWLEDGE_MENTOR_TARGET_ID; name: '罗温·黑尔'; age: 48; sequence: 2; health: number; mind: number; spirituality: number;
    status: KnowledgeMentorEncounterState['enemyStatus']; weaponId: 'KM2-ROWAN-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<KnowledgeMentorPowerId, number> };
  protocolUses: number; protocolSuccesses: number; calibrationUses: number; calibrationSuccesses: number; calibrationEffects: number; totalOwnerMindSpent: number;
  carriedIds: ObjectId[]; carriedPlateIds: string[]; combatPlates: KnowledgeMentorCombatPlate[];
  retrievedIds: ObjectId[]; retrievedPlateIds: string[]; exitTravelMetres: 0 | 4; exitSeconds: 0 | 4;
  actions: KnowledgeMentorEncounterAction[]; facts: string[];
}
export const KNOWLEDGE_MENTOR_ENCOUNTER_STORY = '原创成年人罗温·黑尔（48岁，KM2-ROWAN-HALE）在新的独立净空工院因通行分歧持自己的唯一原棍KM2-ROWAN-CLUB挡路。他是有限G2等效对手，原身体24、独立H100/M100/S120；与旧罗温、科尔温或奥斯里克均不是同一人。双方原身体相距2米，普通出口4米、实走4秒，无追逐和旁人。先实际交谈，再明确选择开战或和平离开。本人携入旧唯一AL4-BOX-1、AL4-FRAME-1及真实付费准备的READY原指令片，沿原储能耐久，不生新件。对方弧光7S/105、护术6S/减60、定向干扰3S/下一次成功封装或协同抵抗30%提高70%（全G）；不足回退原棍20×身体，敌灵性不恢复。候选知识导师2映射、专业晋升、新封装及校准均未核原著完整依据，全部明确G；配方、仪式未知。原著神灵文明造物、无限知识、独立不灭灵魂和免费军队均不属于本场。';
export function createKnowledgeMentorEncounterState(): KnowledgeMentorEncounterState {
  return { status: 'AVAILABLE', targetId: KNOWLEDGE_MENTOR_TARGET_ID, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, JAM: 0 }, carriedIds: [], carriedPlateIds: [], entryCreations: [], entryPlates: [],
    protocolUses: 0, protocolSuccesses: 0, calibrationUses: 0, calibrationSuccesses: 0, calibrationEffects: 0, totalOwnerMindSpent: 0,
    retrievedIds: [], retrievedPlateIds: [], exitTravelMetres: 0, exitSeconds: 0, startSource: null, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const counters = ['protocolUses', 'protocolSuccesses', 'calibrationUses', 'calibrationSuccesses', 'calibrationEffects', 'totalOwnerMindSpent'] as const;
const originals = (s: SliceState) => s.knowledgeMentor.encounter.carriedIds.map(id => findKnowledgeMentorOriginalCreation(s, id));
const plates = (s: SliceState) => s.knowledgeMentor.encounter.carriedPlateIds.map(id => s.knowledgeMentor.life.combatPlates.find(p => p.id === id));
const resource = (x: AlchemistCreation) => ({ id: x.id, charge: x.charge, durability: x.durability, location: x.location, active: x.active });
export function validateKnowledgeMentorEncounterCommand(v: unknown): v is KnowledgeMentorEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type?: unknown }).type));
}
export const isKnowledgeMentorEncounterCommand = validateKnowledgeMentorEncounterCommand;
export const isInsideKnowledgeMentorEncounter = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.knowledgeMentor.encounter.status);
export const hasKnowledgeMentorEncounterLock = isInsideKnowledgeMentorEncounter;
function otherSceneOpen(s: SliceState): boolean {
  return s.knowledgeMentor.preparedWeek !== null || hasKnowledgeMentorLifeLock(s) || s.arcaneScholar.preparedWeek !== null || hasArcaneScholarLifeLock(s) || hasAlchemistLifeLock(s) ||
    Object.values(s.alchemist.life.cases).some(r => r.status === 'PREPARED') || ['READY', 'FIGHTING'].includes(s.alchemist.encounter.status) ||
    ['READY', 'FIGHTING'].includes(s.arcaneScholar.encounter.status) || Object.values(s.astronomer.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
function originalLocations(s: SliceState, location: 'YARD' | 'PLAYER'): boolean {
  return originals(s).every(x => !!x && x.location === location && (location === 'YARD' || !x.active)) &&
    plates(s).every(p => !!p && p.location === location && p.status !== 'FAILED');
}
function entryTailMatches(s: SliceState): boolean {
  const tail = knowledgeMentorLifeOriginalTail(s), e = s.knowledgeMentor.encounter;
  return !!tail && same(e.entryCreations.map(x => resource({ ...x, location: 'PLAYER', active: false })), tail);
}
export function blockKnowledgeMentorEncounter(s: SliceState, c: KnowledgeMentorEncounterCommand): string | null {
  if (!validateKnowledgeMentorEncounterCommand(c)) return '候选知识导师遭遇命令无效。';
  const e = s.knowledgeMentor.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着且已实际晋升候选知识导师2（G）。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德本场独立净空工院。';
  if (otherSceneOpen(s)) return '先实际收束旧原工坊或当前研究现场及晋升准备。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && originalLocations(s, 'YARD') ? null : '须已到场交谈，实际携入原件与原片仍在场且尚未开战。';
  if (s.mind <= 0) return '先恢复当前精神；尚未开战仍可普通取件离开。';
  if (!s.knowledgeMentor.life.reflected) return '先完成三项实际研究、归还与反思；本场不代填研究记录。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') {
    if (e.status !== 'AVAILABLE') return '同一原罗温·黑尔已有进展或结局，不重开、不复位。';
    const pair = (['AL4-BOX-1', 'AL4-FRAME-1'] as const).map(id => findKnowledgeMentorOriginalCreation(s, id));
    if (pair.some(x => !x || x.location !== 'PLAYER' || x.active) || !same(pair.map(x => resource(x!)), knowledgeMentorLifeOriginalTail(s))) return '须先亲手取回并停止同一原盒原架，储能耐久与真实维护尾记录一致。';
    return s.actionsRemaining < 2 ? '交谈1行动，另留1行动供明确开战；仍可和平离开。' : null;
  }
  return e.status === 'READY' && originalLocations(s, 'YARD') ? null : '先实际交谈，确认同一原人、原棍、实付原片与普通出口。';
}
export const knowledgeMentorEncounterReason = blockKnowledgeMentorEncounter;
function retrieveAndExit(s: SliceState, dead: boolean): void {
  const e = s.knowledgeMentor.encounter;
  for (const x of originals(s)) {
    if (!x || x.location !== 'YARD') throw new Error('原件未在真实现场，不能用退出传回。');
    x.active = false;
    if (!dead) { x.location = 'PLAYER'; e.retrievedIds.push(x.id); }
  }
  for (const p of plates(s)) {
    if (!p || p.location !== 'YARD') throw new Error('原指令片未在真实现场，不能复制或删除。');
    if (!dead) { p.location = 'PLAYER'; e.retrievedPlateIds.push(p.id); }
  }
  if (!dead) { e.exitTravelMetres = 4; e.exitSeconds = 4; }
}
export function applyKnowledgeMentorEncounterCommand(s: SliceState, c: KnowledgeMentorEncounterCommand, ctx: SeerContext): void {
  const reason = blockKnowledgeMentorEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.knowledgeMentor.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    retrieveAndExit(s, false); e.status = 'RESOLVED';
    ctx.note('沿新工院原出口和平离开', '本人实际停止并亲手拾回本次同一原盒、原架与全部原指令片，沿普通出口步行4米、4秒；原储能耐久不恢复。没有战斗奖励、追逐或夺棍，原罗温·黑尔仍持自己的原棍。旧人物、死亡和损毁不变。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1;
    for (const id of ['AL4-BOX-1', 'AL4-FRAME-1'] as const) {
      const x = findKnowledgeMentorOriginalCreation(s, id)!; x.location = 'YARD'; e.carriedIds.push(id); e.entryCreations.push(structuredClone(x));
    }
    for (const p of s.knowledgeMentor.life.combatPlates) if (p.status === 'READY' && p.location === 'PLAYER') {
      p.location = 'YARD'; e.carriedPlateIds.push(p.id); e.entryPlates.push(structuredClone(p));
    }
    ctx.note('与原罗温·黑尔实际交谈', `${KNOWLEDGE_MENTOR_ENCOUNTER_STORY}本次实际携入${e.carriedIds.join('、')}，实付原片${e.carriedPlateIds.join('、') || '无'}。尚未代选开战；原件耗尽仍可本人普通行动。`); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'KNOWLEDGE_MENTOR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  e.startSource = currentKnowledgeMentorCombatSource(s);
  if (!e.startSource) throw new Error('缺少原身体、实际原片和原造物的开战来源。');
  ctx.note('承担候选知识导师新工院的真实冲突', '双方原身体、各自原棍与独立真实灵性交战；两原物仍只用旧唯一储能耐久，原片须实际准备。只有双方原次数盘，真实伤势与死亡由共同战盘结算。');
}
export const applyKnowledgeMentorEncounter = applyKnowledgeMentorEncounterCommand;
export function hasKnowledgeMentorDisputeOpponent(s: SliceState): boolean {
  const e = s.knowledgeMentor?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind >= 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === KNOWLEDGE_MENTOR_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    e.exitTravelMetres === 0 && e.exitSeconds === 0 && e.retrievedIds.length === 0 && e.retrievedPlateIds.length === 0 &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'KNOWLEDGE_MENTOR_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk && originalLocations(s, 'YARD') &&
    integer(e.enemySpirituality, 0, 120) && e.enemySpirituality === 120 - KNOWLEDGE_MENTOR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleKnowledgeMentorEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.knowledgeMentor.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'KNOWLEDGE_MENTOR_DISPUTE') throw new Error('没有同一原罗温·黑尔的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原工院战斗结果。');
  const last = c.lastRound, o = last?.knowledgeMentorOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateKnowledgeMentorRoundOutcome(o) || !validateKnowledgeMentorRecordedRound(last) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !originalLocations(s, 'YARD') ||
      !same(o.creations, originals(s)) || !same(o.combatPlates, plates(s)) || !same(o.powerUses, e.powerUses) || counters.some(k => o[k] !== e[k]) ||
      o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS') ||
      outcome === 'RETREATED' && (s.health <= 0 || last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY') ||
      outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || last.winner !== 'PLAYER') ||
      outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || last.winner !== 'PLAYER')) throw new Error('原人、真实回合、原指令片与原物成本不一致。');
  e.terminal = { outcome: outcome as KnowledgeMentorEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  retrieveAndExit(s, outcome === 'PLAYER_DEAD'); s.combat = null;
  ctx.note('新独立工院冲突实际结束', `${outcome === 'PLAYER_DEAD' ? '本人原身体真实死亡，同一原盒原架停止，全部携入原片（含用尽片）留在YARD；没有复活或出口。' : outcome === 'ENEMY_DEAD' ? '同一原罗温·黑尔真实死亡，尸体及自己的原棍留在YARD；本人停止并亲手拾回实际携入原件及全部原片，实走4米4秒离开。' : outcome === 'RETREATED' ? '本人停止、亲手拾回实际携入原件和全部原片，沿原开放出口普通步行4米4秒；罗温·黑尔和自己的原棍留院，无追逐或夺棍。' : '原罗温·黑尔仍活着，因真实伤势自行停战，将自己的唯一原棍放在YARD原地；本人停止并亲手拾回原件及全部原片，普通步行4米4秒离开。'}已付灵性、精神、指令片状态、原件储能耐久和伤势全保留；所有窗口结束，旧人物与损毁不变。`);
}
export function knowledgeMentorEncounterActions(s: SliceState): KnowledgeMentorEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '携原件与实付指令片前往新工院交谈', '1行动，另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原罗温·黑尔的真实冲突（G）', '1行动 · 正常伤势/死亡风险'],
    ['LEAVE_ENCOUNTER', '亲手取回原件原片并普通走4米离开', '0行动 · 实际4秒']] as const).map(([type, label, cost]) => {
    const command: KnowledgeMentorEncounterCommand = { type }, reason = blockKnowledgeMentorEncounter(s, command);
    return { id: `KM2-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectKnowledgeMentorEncounter(s: SliceState): KnowledgeMentorEncounterProjection {
  const e = s.knowledgeMentor.encounter;
  const progress = { protocolUses: e.protocolUses, protocolSuccesses: e.protocolSuccesses, calibrationUses: e.calibrationUses, calibrationSuccesses: e.calibrationSuccesses, calibrationEffects: e.calibrationEffects, totalOwnerMindSpent: e.totalOwnerMindSpent,
    carriedIds: [...e.carriedIds], carriedPlateIds: [...e.carriedPlateIds], combatPlates: plates(s).filter((p): p is KnowledgeMentorCombatPlate => !!p).map(p => structuredClone(p)),
    retrievedIds: [...e.retrievedIds], retrievedPlateIds: [...e.retrievedPlateIds], exitTravelMetres: e.exitTravelMetres, exitSeconds: e.exitSeconds };
  if (!stage(s)) return { ...progress, title: '尚未开放的候选知识导师实践（G）', story: '', status: 'AVAILABLE', inside: false, enemy: null, actions: [], facts: [] };
  return { ...progress, title: '罗温·黑尔的新独立工院（G）', story: KNOWLEDGE_MENTOR_ENCOUNTER_STORY, status: e.status, inside: isInsideKnowledgeMentorEncounter(s),
    enemy: { id: e.targetId, name: '罗温·黑尔', age: 48, sequence: 2, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'KM2-ROWAN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: knowledgeMentorEncounterActions(s),
    facts: ['双方1–6次数权重10/15/25/25/15/10；继承真实体30/感30/意25/知15，1250/底125、上限120，仅继续轮回灵12（G）。',
      '候选封装每轮一次：实际READY原指令片+5S及原件各1储能/知识18，成功40/减20G；失败、抵抗仍用尽同一原片，不补发。',
      '候选校准每轮一次4S+1M/知识18，本轮下一次实际成功原造物动作已有正向效果+18G（纯防守加减势）；普通回退无加成，轮末失效。',
      '新对手弧光7S/105、护术6S/减60、干扰3S；下一次成功封装或继承协同抵抗30%→70%G。独立资源耗尽则原棍普通20×身体。',
      '旧赋灵、指挥、专注、解析和协同沿原ID与成本。原件储能耐久只在旧制造池；旧人物、旧园、旧灵魂与旧物不复位。',
      '实际使用及成功次数独立于掌握成长，掌握0也如实记录用过。没有第二轮盘、免费造物、修复、补能或奇迹师复活。',
      '生还本人先亲手取回原件与全部携入原片（含用尽实物），再沿开放普通出口实走4米4秒；死亡原身体与原件原片留YARD。'] };
}

/** The sole authoritative object pool is alchemist.life.creations. Entry,
 * consecutive round sources and the ordinary physical exit must match it. */
export function validateKnowledgeMentorEncounter(s: SliceState): boolean {
  try {
    const e = s.knowledgeMentor.encounter, fresh = createKnowledgeMentorEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(fresh).sort()) || e.targetId !== KNOWLEDGE_MENTOR_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        !['HAND', 'YARD'].includes(e.weaponLocation) || (e.enemyStatus !== 'RESISTING') !== (e.weaponLocation === 'YARD') ||
        !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || !same(Object.keys(i).sort(), ['acquiredRevision', 'id', 'severity', 'treatedRevision']) || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0, s.revision) || i.treatedRevision !== null) ||
        !e.powerUses || !same(Object.keys(e.powerUses).sort(), [...KNOWLEDGE_MENTOR_POWER_IDS].sort()) || KNOWLEDGE_MENTOR_POWER_IDS.some(id => !integer(e.powerUses[id])) || e.enemySpirituality !== 120 - KNOWLEDGE_MENTOR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        counters.some(k => !integer(e[k])) || e.protocolSuccesses > e.protocolUses || e.calibrationSuccesses > e.calibrationUses || e.calibrationEffects > e.calibrationSuccesses || e.totalOwnerMindSpent !== e.calibrationUses ||
        !Array.isArray(e.carriedIds) || !Array.isArray(e.carriedPlateIds) || !Array.isArray(e.entryCreations) || !Array.isArray(e.entryPlates) || !Array.isArray(e.retrievedIds) || !Array.isArray(e.retrievedPlateIds) ||
        ![0, 4].includes(e.exitTravelMetres) || e.exitSeconds !== e.exitTravelMetres ||
        [e.approachWeek, e.attemptWeek].some(n => n !== null && !integer(n, s.knowledgeMentor.promotionWeek ?? 0, s.week)) || e.approachRevision !== null && !integer(e.approachRevision, 1, s.revision) ||
        e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) return false;
    if (s.knowledgeMentor.promotionWeek === null) return same(e, fresh) && s.combat?.encounterId !== 'KNOWLEDGE_MENTOR_DISPUTE';
    if (!stage(s)) return false;
    if (e.status === 'AVAILABLE') return same(e, fresh) && s.combat?.encounterId !== 'KNOWLEDGE_MENTOR_DISPUTE';
    if (!s.knowledgeMentor.life.reflected || e.approachWeek === null || e.approachRevision === null || !same(e.carriedIds, ['AL4-BOX-1', 'AL4-FRAME-1']) || !entryTailMatches(s) ||
        e.entryCreations.length !== 2 || !same(e.entryCreations.map(x => x.id), e.carriedIds) || e.entryCreations.some(x => x.location !== 'YARD' || x.active) ||
        e.carriedPlateIds.length > 3 || new Set(e.carriedPlateIds).size !== e.carriedPlateIds.length || !same(e.entryPlates.map(p => p.id), e.carriedPlateIds) ||
        e.entryPlates.some(p => !validateKnowledgeMentorCombatPlate(p, e.approachWeek!, e.approachRevision!) || p.status !== 'READY' || p.location !== 'YARD' || p.createdRevision >= e.approachRevision!) ||
        !same(s.knowledgeMentor.life.combatPlates.filter(p => p.status !== 'FAILED').map(p => p.id), e.carriedPlateIds)) return false;
    const inside = ['READY', 'FIGHTING', 'LOST'].includes(e.status);
    if (inside ? e.exitTravelMetres !== 0 || e.retrievedIds.length !== 0 || e.retrievedPlateIds.length !== 0 || !originalLocations(s, 'YARD')
      : e.exitTravelMetres !== 4 || !same(e.retrievedIds, e.carriedIds) || !same(e.retrievedPlateIds, e.carriedPlateIds) || !originalLocations(s, 'PLAYER')) return false;
    const matchPhysical = (cs: AlchemistCreation[], ps: KnowledgeMentorCombatPlate[]) => same(originals(s), cs.map(x => ({ ...x, location: inside ? 'YARD' : 'PLAYER', active: inside && e.status === 'FIGHTING' ? x.active : false }))) && same(plates(s), ps.map(p => ({ ...p, location: inside ? 'YARD' : 'PLAYER' })));
    if (e.startHistoryIndex === null) {
      const normalized = { ...e, status: 'AVAILABLE', approachWeek: null, approachRevision: null, carriedIds: [], carriedPlateIds: [], entryCreations: [], entryPlates: [], retrievedIds: [], retrievedPlateIds: [], exitTravelMetres: 0, exitSeconds: 0 };
      return ['READY', 'RESOLVED'].includes(e.status) && e.terminal === null && e.attemptWeek === null && s.combat?.encounterId !== 'KNOWLEDGE_MENTOR_DISPUTE' && same(normalized, fresh) && matchPhysical(e.entryCreations, e.entryPlates);
    }
    if (e.attemptWeek === null || e.attemptWeek < e.approachWeek || !e.startSource || !validateKnowledgeMentorCombatSource(e.startSource) || e.startSource.runId !== s.runId || e.startSource.randomSeed !== s.random.seed || e.startSource.week !== e.attemptWeek || e.startSource.round !== 1 || e.startSource.startHistoryIndex !== e.startHistoryIndex || !integer(e.startSource.revision, e.approachRevision, s.revision - 1) || !same(e.startSource.creations, e.entryCreations) || !same(e.startSource.combatPlates, e.entryPlates)) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length;
    if (!integer(end, e.startHistoryIndex, s.combatHistory.length)) return false;
    const rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    let previous: KnowledgeMentorRoundOutcome | undefined;
    for (const [i, round] of rounds.entries()) {
      const o = round.knowledgeMentorOutcome;
      if (!validateKnowledgeMentorRoundOutcome(o) || !validateKnowledgeMentorRecordedRound(round) || round.round !== i + 1 || o.source.runId !== s.runId || o.source.randomSeed !== s.random.seed ||
          o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex || !integer(o.source.revision, e.approachRevision, s.revision - 1) ||
          !same(o.source.carriedIds, e.carriedIds) || !same(o.source.carriedPlateIds, e.carriedPlateIds) || i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS')) return false;
      if (previous) {
        if (o.source.revision !== previous.source.revision + 1 || o.source.randomCursor !== previous.randomCursorAfter || o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
            o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
            o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.powerUses, previous.powerUses) || !same(o.source.creations, previous.creations) || !same(o.source.combatPlates, previous.combatPlates) ||
            !same(o.source.playerInjuries, previous.playerInjuriesAfter) || !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.playerRisk !== previous.playerRiskAfter || o.source.enemyRisk !== previous.enemyRiskAfter ||
            !same(o.source.playerCoreStats, previous.source.playerCoreStats) || !same(o.source.mastery, previous.source.mastery) || counters.some(k => o.source[k] !== previous![k])) return false;
      } else if (!same(o.source, { ...e.startSource, revision: e.startSource.revision + 1 }) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 ||
          Object.values(o.source.powerUses).some(n => n !== 0) || counters.some(k => o.source[k] !== 0) || !same(o.source.creations, e.entryCreations) || !same(o.source.combatPlates, e.entryPlates)) return false;
      previous = o;
    }
    if (previous && (previous.enemyHealth !== e.enemyHealth || previous.enemyMind !== e.enemyMind || previous.enemySpirituality !== e.enemySpirituality || previous.enemyStatus !== e.enemyStatus ||
        previous.enemyRiskAfter !== e.enemyRisk || !same(previous.enemyInjuriesAfter, e.enemyInjuries) || !same(previous.powerUses, e.powerUses) || counters.some(k => previous![k] !== e[k]))) return false;
    if (!previous && (s.health !== e.startSource.playerHealth || s.mind !== e.startSource.playerMind || s.spirituality !== e.startSource.playerSpirituality || !same(s.injuries, e.startSource.playerInjuries) || s.injuryRisk !== e.startSource.playerRisk || s.random.cursor !== e.startSource.randomCursor || e.enemyHealth !== 100 || e.enemyMind !== 100 || e.enemySpirituality !== 120 || e.enemyRisk !== 0 || e.enemyInjuries.length !== 0 || counters.some(k => e[k] !== 0))) return false;
    if (!matchPhysical(previous?.creations ?? e.entryCreations, previous?.combatPlates ?? e.entryPlates)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasKnowledgeMentorDisputeOpponent(s) && (!previous || previous.continuing && s.health === previous.playerHealthAfter && s.mind === previous.playerMindAfter &&
      s.spirituality === Math.min(120, previous.playerSpiritualityAfter + 12) && s.injuryRisk === previous.playerRiskAfter && same(s.injuries, previous.playerInjuriesAfter) && s.random.cursor === previous.randomCursorAfter);
    const t = e.terminal, last = rounds.at(-1);
    return !!t && same(Object.keys(t).sort(), ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus'].sort()) && !!previous && !!last && !previous.continuing &&
      t.round === last.round && t.historyIndex === end - 1 && t.enemyHealth === e.enemyHealth && t.enemyMind === e.enemyMind && t.enemySpirituality === e.enemySpirituality && t.enemyStatus === e.enemyStatus && s.combat?.encounterId !== 'KNOWLEDGE_MENTOR_DISPUTE' &&
      (t.outcome === 'PLAYER_DEAD' ? e.status === 'LOST' && s.health === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS' :
        t.outcome === 'RETREATED' ? e.status === 'RETREATED' && last.retreat === 'SUCCESS' :
          t.outcome === 'ENEMY_DEAD' ? e.status === 'RESOLVED' && e.enemyStatus === 'DEAD' && last.winner === 'PLAYER' :
            t.outcome === 'ENEMY_SURRENDERED' && e.status === 'RESOLVED' && e.enemyStatus === 'SURRENDERED' && last.winner === 'PLAYER');
  } catch { return false; }
}
