import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasAlchemistLifeLock } from '../alchemist/life.js';
import { findArcaneScholarOriginalCreation, hasArcaneScholarLifeLock } from './life.js';
import { validateArcaneScholarRoundOutcome, type ArcaneScholarRoundOutcome } from './combat.js';

export const ARCANE_SCHOLAR_TARGET_ID = 'AR3-CORWIN' as const;
export const ARCANE_SCHOLAR_POWER_IDS = ['ARC_BOLT', 'WARD', 'JAM'] as const;
export type ArcaneScholarPowerId = typeof ARCANE_SCHOLAR_POWER_IDS[number];
export type ArcaneScholarEnemyIntent = ArcaneScholarPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export const ARCANE_SCHOLAR_POWERS = [
  { id: 'ARC_BOLT', label: '有限弧光术', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'WARD', label: '有限护术', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'JAM', label: '有限协同干扰', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface ArcaneScholarEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface ArcaneScholarEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof ARCANE_SCHOLAR_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<ArcaneScholarPowerId, number>;
  carriedIds: ('AL4-BOX-1' | 'AL4-FRAME-1')[]; terminal: ArcaneScholarEncounterTerminal | null;
}
export type ArcaneScholarEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface ArcaneScholarEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ArcaneScholarEncounterCommand }
export interface ArcaneScholarEncounterProjection {
  title: string; story: string; status: ArcaneScholarEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof ARCANE_SCHOLAR_TARGET_ID; name: '科尔温'; age: 47; sequence: 3; health: number; mind: number; spirituality: number;
    status: ArcaneScholarEncounterState['enemyStatus']; weaponId: 'AR3-CORWIN-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<ArcaneScholarPowerId, number> };
  actions: ArcaneScholarEncounterAction[]; facts: string[];
}
export const ARCANE_SCHOLAR_ENCOUNTER_STORY = '成年科尔温（47岁，AR3-CORWIN）在独立净空工院因通路分歧持自己的唯一原棍AR3-CORWIN-CLUB挡路。他是原创有限G3等效对手，有独立H100/M100/S120，不是旧奥斯里克。双方实际原身体相距2米，普通出口开放，无追逐、无旁人。先交谈，再明确选择开战或和平离开；随身同一AL4-BOX-1与AL4-FRAME-1实际携入，储能耐久沿用原记录，不生新件。科尔温弧光术5S/75、护术4S/减45、干扰4S/本轮下一次协同抵抗30%提高70%（均G）；不足时原棍普通20×身体，不自动补S。原著奥秘学者3新能力表未核，本次解析、协同和数值全为明确G。';
export function createArcaneScholarEncounterState(): ArcaneScholarEncounterState {
  return { status: 'AVAILABLE', targetId: ARCANE_SCHOLAR_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, JAM: 0 }, carriedIds: [], terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 3;
export function validateArcaneScholarEncounterCommand(v: unknown): v is ArcaneScholarEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type?: unknown }).type));
}
export const isArcaneScholarEncounterCommand = validateArcaneScholarEncounterCommand;
export const isInsideArcaneScholarEncounter = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.arcaneScholar.encounter.status);
export const hasArcaneScholarEncounterLock = isInsideArcaneScholarEncounter;
function otherSceneOpen(s: SliceState): boolean {
  return s.arcaneScholar.preparedWeek !== null || hasArcaneScholarLifeLock(s) || hasAlchemistLifeLock(s) ||
    Object.values(s.alchemist.life.cases).some(r => r.status === 'PREPARED') || ['READY', 'FIGHTING'].includes(s.alchemist.encounter.status) ||
    Object.values(s.astronomer.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
function originalLocations(s: SliceState, location: 'YARD' | 'PLAYER'): boolean {
  return s.arcaneScholar.encounter.carriedIds.every(id => { const x = findArcaneScholarOriginalCreation(s, id); return x?.location === location && (location === 'YARD' || !x.active); });
}
export function blockArcaneScholarEncounter(s: SliceState, c: ArcaneScholarEncounterCommand): string | null {
  if (!validateArcaneScholarEncounterCommand(c)) return '奥秘学者遭遇命令无效。';
  const e = s.arcaneScholar.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着且已成为奥秘学者3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德本场独立净空工院。';
  if (otherSceneOpen(s)) return '先实际收束旧原工坊或当前研究现场及准备。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && originalLocations(s, 'YARD') ? null : '须已到场交谈，原携入物仍在场且尚未开战。';
  if (s.mind <= 0) return '先恢复当前精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原科尔温已有进展或结局，不重开、不复位。' : s.actionsRemaining < 2 ? '交谈1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' && originalLocations(s, 'YARD') ? null : '先实际交谈，确认同一原人、原棍、实际携入物与普通出口。';
}
export const arcaneScholarEncounterReason = blockArcaneScholarEncounter;
function returnOriginals(s: SliceState, dead: boolean): void {
  for (const id of s.arcaneScholar.encounter.carriedIds) { const x = findArcaneScholarOriginalCreation(s, id); if (x?.location === 'YARD') { x.active = false; if (!dead) x.location = 'PLAYER'; } }
}
export function applyArcaneScholarEncounterCommand(s: SliceState, c: ArcaneScholarEncounterCommand, ctx: SeerContext): void {
  const reason = blockArcaneScholarEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.arcaneScholar.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { returnOriginals(s, false); e.status = 'RESOLVED'; ctx.note('沿独立工院原出口和平离开', '本人停止并亲手带回本次实际携入的同一原盒和原架，沿普通出口步行离开；原储能耐久不恢复。没有战斗奖励或追逐；旧奥斯里克及原棍结局不改。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'READY'; e.approachWeek = s.week;
    for (const id of ['AL4-BOX-1', 'AL4-FRAME-1'] as const) { const x = findArcaneScholarOriginalCreation(s, id); if (x?.location === 'PLAYER' && !x.active) { x.location = 'YARD'; e.carriedIds.push(id); } }
    ctx.note('与原科尔温实际交谈', `${ARCANE_SCHOLAR_ENCOUNTER_STORY}本次实际携入${e.carriedIds.join('、') || '无可携原件'}，尚未代选开战；原件缺能或损坏时由本人普通行动。`); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'ARCANE_SCHOLAR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担独立工院的真实冲突', '双方原身体、原棍与各自真实灵性交战；两原物仍各只有一份储能耐久，只有双方原次数盘。真实伤势、死亡与撤退由共同战盘结算。');
}
export const applyArcaneScholarEncounter = applyArcaneScholarEncounterCommand;
export function hasArcaneScholarDisputeOpponent(s: SliceState): boolean {
  const e = s.arcaneScholar?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === ARCANE_SCHOLAR_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'ARCANE_SCHOLAR_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && stableStringify(e.enemyInjuries) === stableStringify(c.enemyInjuries) && e.enemyRisk === c.enemyRisk && originalLocations(s, 'YARD') &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality === 120 - ARCANE_SCHOLAR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleArcaneScholarEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.arcaneScholar.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'ARCANE_SCHOLAR_DISPUTE') throw new Error('没有同一原科尔温的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原工院战斗结果。');
  const last = c.lastRound, o = last?.arcaneScholarOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateArcaneScholarRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !originalLocations(s, 'YARD') ||
      stableStringify(o.creations) !== stableStringify(e.carriedIds.map(id => findArcaneScholarOriginalCreation(s, id))) || stableStringify(o.powerUses) !== stableStringify(e.powerUses) ||
      o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS') ||
      outcome === 'RETREATED' && (s.health <= 0 || last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY') ||
      outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || last.winner !== 'PLAYER') ||
      outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || last.winner !== 'PLAYER')) throw new Error('原人、真实回合与原物资源结果不一致。');
  e.terminal = { outcome: outcome as ArcaneScholarEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; returnOriginals(s, outcome === 'PLAYER_DEAD'); s.combat = null;
  ctx.note('独立原工院冲突实际结束', `${outcome === 'PLAYER_DEAD' ? '本人真实死亡，同一原盒原架停止并留场，无替死或复活。' : outcome === 'ENEMY_DEAD' ? '同一原科尔温真实死亡，尸体及自己的原棍留场；本人亲手收回实际携入原件。' : outcome === 'RETREATED' ? '本人停止、亲手带回实际携入原件，沿原开放出口普通步行离开，无追逐或夺棍。' : '科尔温仍活着，因真实伤势自行停战并放下原棍；本人停止并收回实际携入原件。'}已付灵性、原件储能耐久和伤势保留，解析窗口及协同均结束。旧奥斯里克与旧园损毁不变。`);
}
export function arcaneScholarEncounterActions(s: SliceState): ArcaneScholarEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '携原件前往独立工院交谈', '1行动，另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原科尔温的真实冲突', '1行动 · 正常伤势/死亡风险'],
    ['LEAVE_ENCOUNTER', '带回原件沿普通出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: ArcaneScholarEncounterCommand = { type }, reason = blockArcaneScholarEncounter(s, command);
    return { id: `AR3-ENCOUNTER:${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectArcaneScholarEncounter(s: SliceState): ArcaneScholarEncounterProjection {
  const e = s.arcaneScholar.encounter;
  if (!stage(s) && !(s.progression.pathwayId==='paragon'&&(s.progression.sequence===2||s.progression.sequence===1))) return { title: '尚未开放的奥秘学者实践', story: '', status: 'AVAILABLE', inside: false, enemy: null, actions: [], facts: [] };
  return { title: '科尔温的独立原工院', story: ARCANE_SCHOLAR_ENCOUNTER_STORY, status: e.status, inside: isInsideArcaneScholarEncounter(s),
    enemy: { id: e.targetId, name: '科尔温', age: 47, sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'AR3-CORWIN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: arcaneScholarEncounterActions(s),
    facts: ['双方1–6次权重10/15/25/25/15/10；继承实际核心体30/感30/意25/知15，1250/底125、上限120，仅继续轮回灵12（G）。',
      '新解析4S/知识18：本轮下一次普通身体打击有限弱处窗口；新双件协同5S及两原件各1储能、知识18，成功贡献40/减势20（G）。',
      '科尔温干扰实付4S，本轮下一次协同抵抗30%→70%，不可叠加；失配和抵抗保留真实成本，不重新抽取。',
      '原盒原架仍是旧唯一原件，缺能或损坏由本人普通回退；旧赋灵4S/原架1储能、旧指挥2S/原架1储能，真实承接原棍才耐久−5。',
      '无第二轮盘、补能或新造物。生还本人停止并亲手收回原件；本人死亡则原物停止留场。旧奥斯里克死亡、旧园损毁和旧原棍不复位。'] };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export function validateArcaneScholarEncounter(s: SliceState): boolean {
  try {
    const e = s.arcaneScholar.encounter;
    if (!e || !same(Object.keys(e).sort(), Object.keys(createArcaneScholarEncounterState()).sort()) || e.targetId !== ARCANE_SCHOLAR_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        !['HAND', 'YARD'].includes(e.weaponLocation) || (e.enemyStatus !== 'RESISTING') !== (e.weaponLocation === 'YARD') ||
        !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision)) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || ARCANE_SCHOLAR_POWER_IDS.some(id => !integer(e.powerUses[id])) || e.enemySpirituality !== 120 - ARCANE_SCHOLAR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        !Array.isArray(e.carriedIds) || e.carriedIds.length > 2 || new Set(e.carriedIds).size !== e.carriedIds.length || e.carriedIds.some(id => !['AL4-BOX-1', 'AL4-FRAME-1'].includes(id)) ||
        [e.approachWeek, e.attemptWeek].some(n => n !== null && !integer(n, s.arcaneScholar.promotionWeek ?? 0, s.week)) || e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) return false;
    if (s.arcaneScholar.promotionWeek === null) return same(e, createArcaneScholarEncounterState()) && s.combat?.encounterId !== 'ARCANE_SCHOLAR_DISPUTE';
    if (!stage(s) && !(s.progression.pathwayId==='paragon'&&(s.progression.sequence===2||s.progression.sequence===1))) return false;
    if (e.startHistoryIndex === null) {
      const initial = createArcaneScholarEncounterState();
      return ['AVAILABLE', 'READY', 'RESOLVED'].includes(e.status) && e.terminal === null && e.attemptWeek === null && s.combat?.encounterId !== 'ARCANE_SCHOLAR_DISPUTE' &&
        (e.status === 'AVAILABLE' ? e.approachWeek === null && e.carriedIds.length === 0 : e.approachWeek !== null) &&
        (e.status !== 'READY' || originalLocations(s, 'YARD')) && same({ ...e, status: initial.status, approachWeek: null, carriedIds: [] }, initial);
    }
    if (e.approachWeek === null || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    let previous: ArcaneScholarRoundOutcome | undefined;
    for (const [i, round] of rounds.entries()) {
      const o = round.arcaneScholarOutcome;
      if (!validateArcaneScholarRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
          !same(o.source.carriedIds, e.carriedIds) || i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS')) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.powerUses, previous.powerUses) || !same(o.source.creations, previous.creations)
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0)) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (!same(moves, round.moves) || o.playerActions.length > round.playerCount || o.enemyActions.length > round.enemyCount) return false;
      previous = o;
    }
    if (previous && (previous.enemyHealth !== e.enemyHealth || previous.enemyMind !== e.enemyMind || previous.enemySpirituality !== e.enemySpirituality || previous.enemyStatus !== e.enemyStatus || !same(previous.powerUses, e.powerUses))) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasArcaneScholarDisputeOpponent(s) && (!previous || previous.continuing && same(previous.creations, e.carriedIds.map(id => structuredClone(findArcaneScholarOriginalCreation(s, id)))));
    const t = e.terminal, last = rounds.at(-1);
    return !!t && !!previous && !!last && !previous.continuing && t.round === last.round && t.historyIndex === end - 1 && t.enemyHealth === e.enemyHealth && t.enemyMind === e.enemyMind && t.enemySpirituality === e.enemySpirituality && t.enemyStatus === e.enemyStatus && s.combat?.encounterId !== 'ARCANE_SCHOLAR_DISPUTE' &&
      (t.outcome === 'PLAYER_DEAD' ? e.status === 'LOST' && s.health === 0 && last.winner === 'ENEMY' && originalLocations(s, 'YARD') && same(previous.creations, e.carriedIds.map(id => findArcaneScholarOriginalCreation(s, id))) : t.outcome === 'RETREATED' ? e.status === 'RETREATED' && last.retreat === 'SUCCESS' : t.outcome === 'ENEMY_DEAD' ? e.status === 'RESOLVED' && e.enemyStatus === 'DEAD' && last.winner === 'PLAYER' : t.outcome === 'ENEMY_SURRENDERED' && e.status === 'RESOLVED' && e.enemyStatus === 'SURRENDERED' && last.winner === 'PLAYER');
  } catch { return false; }
}
