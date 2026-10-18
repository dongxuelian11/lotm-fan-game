import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { addGameWeeks } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createDemonessSource, validateDemonessSource, demonessBudget, demonessHistoryDigest, demonessDigest, sameDemoness } from './source.js';
import { DEMONESS_PLACES, DEMONESS_GUIDANCE, DEMONESS_CONSUMPTION, DEMONESS_PREPARATION, DEMONESS_SPIRITUALITY_CAP } from './content.js';
import { DEMONESS_ABILITY_IDS, type DemonessBudget, type DemonessCommand, type DemonessEffect, type DemonessEvent, type DemonessHost, type DemonessSlice, type DemonessSource, type DemonessState } from './types.js';
import { createDemonessPassage, validateDemonessPassageCommand, demonessInsidePassage, demonessPassageBlock, applyDemonessPassage, demonessPassageCheck, demonessPassagesComplete, advanceDemonessPassageClock } from './passage.js';
import { createDemonessMaterials, validateDemonessMaterialCommand, demonessMaterialBlock, applyDemonessMaterial, transportDemonessMaterials, settleDemonessConsumption, preserveDemonessDeathResidue } from './materials.js';
export { demonessDigest, sameDemoness } from './source.js';
const clone = <T>(v: T): T => structuredClone(v);
function need(value: unknown, reason: string): asserts value { if (!value) throw Error(reason); }
function dataDigest(root: DemonessState): string { const { journal: _journal, ...rest } = root; return demonessDigest(rest); }
export function createDemonessState(): DemonessState { return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null, passage: null, materials: null, preparations: [], journal: [] }; }
export const createDefaultDemonessState = createDemonessState;
const exact = (v: object, keys: string[]) => sameDemoness(Object.keys(v).sort(), keys.sort());
const boundedId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300 && v.trim() === v;
export function validateDemonessCommand(v: unknown): v is DemonessCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  if (['LEARN_GUIDANCE', 'WORK', 'REST', 'CLINIC', 'NEXT_WEEK', 'RETURN_ON_FOOT'].includes(String(c.type))) return exact(c, ['type']);
  if (c.type === 'TRAVEL') return exact(c, ['type', 'to']) && DEMONESS_PLACES.some(p => p.id === c.to);
  if (c.type === 'STABILIZE_PROMOTION') return exact(c, ['type', 'compoundId']) && boundedId(c.compoundId);
  if (c.type === 'CONSUME') return exact(c, ['type', 'compoundId', 'confirmed']) && boundedId(c.compoundId) && c.confirmed === true;
  if (!exact(c, ['type', 'command'])) return false;
  return c.type === 'PASSAGE' ? validateDemonessPassageCommand(c.command) : c.type === 'MATERIAL' ? validateDemonessMaterialCommand(c.command) : false;
}
declare const demonessOwnedEngineBrand: unique symbol;
export interface DemonessOwnedEngine { readonly [demonessOwnedEngineBrand]: true }
const owned = new WeakMap<DemonessOwnedEngine, DemonessState>();
function retain(root: DemonessState): DemonessOwnedEngine { const handle = Object.freeze({}) as DemonessOwnedEngine; owned.set(handle, root); return handle; }
function getOwned(handle: DemonessOwnedEngine): DemonessState { const root = owned.get(handle); need(root, '当前领域会话无效。'); return root; }
function pay(b: DemonessBudget, cost: { actions?: number; cash?: number; spirituality?: number; health?: number; mind?: number; pollution?: number }): void {
  need(b.actions >= (cost.actions ?? 0) && b.cash >= (cost.cash ?? 0) && b.spirituality >= (cost.spirituality ?? 0), '实际行动、现款或灵性不足。');
  b.actions -= cost.actions ?? 0; b.cash -= cost.cash ?? 0; b.spirituality -= cost.spirituality ?? 0;
  b.health = Math.max(0, b.health - (cost.health ?? 0)); b.mind = Math.max(0, b.mind - (cost.mind ?? 0)); b.pollution = Math.min(100, b.pollution + (cost.pollution ?? 0));
  if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function start(source: DemonessSource): DemonessState {
  const root = createDemonessState(), nowSecond = source.originals.liveSite.clockSeconds;
  root.guidanceKnown = true; root.source = clone(source);
  root.frame = { budget: clone(source.budget), finance: clone(source.finance), random: { ...source.random }, location: 'DM221-GALLERY-EXIT', nowSecond, weekAnchor: Math.floor(nowSecond / 604800) * 604800 };
  pay(root.frame.budget, DEMONESS_GUIDANCE);
  root.passage = createDemonessPassage(source.originals.liveSite.playerEnergy);
  root.materials = createDemonessMaterials(source);
  return root;
}
export function startDemoness(s: SliceState): DemonessState { return start(createDemonessSource(s)); }
export function demonessHost(root: DemonessState, eventId: string, revision: number): DemonessHost {
  const f = root.frame!;
  return { eventId, revision, actorId: root.source!.actorId, sourceDigest: root.source!.historyDigest, week: f.budget.week, nowSecond: f.nowSecond, location: f.location, budget: clone(f.budget), check: null };
}
export const demonessInsideCase = (root: DemonessState) => demonessInsidePassage(root.passage);
function prepared(root: DemonessState, compoundId: string) {
  const f = root.frame!, compound = root.materials!.compounds.find(c => c.id === compoundId);
  return root.preparations.find(p => p.status === 'READY' && p.compoundId === compoundId && p.actorId === root.source!.actorId && p.sourceDigest === root.source!.historyDigest &&
    compound?.status === 'PREPARED' && p.compoundDigest === demonessDigest(compound) && p.location === f.location && f.location === 'DM221-WORKSHOP' &&
    p.passageReportEventId === root.passage!.passageReportEventId && demonessPassagesComplete(root.passage!) && f.nowSecond >= p.preparedSecond && f.nowSecond <= p.expiresSecond) ?? null;
}
function consumptionBlock(root: DemonessState, compoundId: string, preparing = false): string | null {
  const f = root.frame!, b = f.budget, compound = root.materials!.compounds.find(c => c.id === compoundId);
  if (b.sequence !== 1 || b.acting !== 100 || root.promotionWeek !== null) return '须由已经完整消化的末日魔女本人服药。';
  if (b.week - root.source!.actualS1PromotionWeek < 12) return '成为末日魔女尚未满十二个实际周，可继续工作、休养或准备原物。';
  if (!demonessPassagesComplete(root.passage!)) return '先完成两位成人逐段实际通行与安全退出，并核对结果。';
  if (f.location !== 'DM221-WORKSHOP' || compound?.status !== 'PREPARED' || compound.location !== f.location) return '本人和同一成药须实际抵达封闭调配室。';
  if (b.health < 80 || b.mind < (preparing ? 78 : 70) || b.injuries.length) return preparing ? '先恢复到80健康、78精神，并处置和恢复实际伤势。' : '先恢复到80健康、70精神，并解除实际伤势。';
  if (b.actions < 1 || b.spirituality < 30) return '独立服药需要1行动与30灵性。';
  return null;
}
export function getDemonessPromotionStabilityPreview(root: DemonessState, compoundId: string) {
  const b = root.frame!.budget, ready = prepared(root, compoundId) !== null;
  let reason = consumptionBlock(root, compoundId, true);
  if (!reason && ready) reason = '本瓶有效稳定准备已经完成。';
  if (!reason && (b.cash < DEMONESS_PREPARATION.cash || b.spirituality < 42 || b.mind < 78)) reason = '本次准备须实付150便士、12灵性与8精神，并留出服药所需资源。';
  const chance = (preparation: boolean) => computeCheckChance({ baseAbility: b.coreStats.will, difficulty: DEMONESS_CONSUMPTION.difficulty,
    modifiers: preparation ? [{ source: '同一本人的同瓶实际稳定准备', value: DEMONESS_CONSUMPTION.preparedBonus }] : [] });
  return { eligible: reason === null, reason, prepared: ready, chance: chance(ready), preparedChance: chance(true), cost: DEMONESS_PREPARATION };
}
function commandBlock(root: DemonessState, c: DemonessCommand, revision: number): string | null {
  if (!validateDemonessCommand(c) || c.type === 'LEARN_GUIDANCE') return '这项行动无效，或已经听取本次指导。';
  if (!root.source || !root.frame || !root.materials || !root.passage || !root.guidanceKnown || root.frame.budget.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  const f = root.frame, b = f.budget;
  if (revision !== root.source.revision + 2 + root.journal.length) return '当前实际行动次序不一致。';
  if (demonessInsideCase(root) && c.type !== 'PASSAGE') return '先停止持续接触，让本人和成人沿普通侧路逐人退出，再工作、休养、旅行或跨周。';
  if (c.type === 'NEXT_WEEK') return null;
  if (c.type === 'WORK') return f.finance.wagePaidWeek === b.week ? '本周原职业工资已经实际领取。' : b.actions < 1 ? '工作需要一次行动。' : null;
  if (c.type === 'REST') return b.actions < 1 ? '休养需要一次行动，可先走到下一实际周界。' : null;
  if (c.type === 'CLINIC') return !b.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) ? '没有尚未处置的重伤。' : b.actions < 1 || b.cash < 60 ? '普通诊治需要1行动和60便士。' : null;
  if (c.type === 'TRAVEL') return c.to === f.location ? '本人已经在这处地点。' : b.actions < 1 ? '普通步行前往需要1行动，仍可免费步行回街区接待处。' : null;
  if (c.type === 'RETURN_ON_FOOT') return f.location === 'DM221-RECEPTION' ? '本人已经在街区接待处。' : null;
  const host = demonessHost(root, `R221:${root.source.runId}:${revision}`, revision);
  if (c.type === 'PASSAGE') return demonessPassageBlock(root.passage, c.command, host);
  if (c.type === 'MATERIAL') return demonessMaterialBlock(root.materials, c.command, host, root.passage.passageReportEventId, root.source);
  if (c.type === 'STABILIZE_PROMOTION') return getDemonessPromotionStabilityPreview(root, c.compoundId).reason;
  if (c.type === 'CONSUME') return consumptionBlock(root, c.compoundId);
  return '当前没有这项行动。';
}
/** Every actual week bills the existing life/debt reducer. Only WORK earns the existing wage. */
function elapse(root: DemonessState, seconds: number, revision: number, eventId: string, receipts: DemonessEvent['financeReceipts']): void {
  need(Number.isSafeInteger(seconds) && seconds >= 0, '实际用时无效。');
  const f = root.frame!, b = f.budget, target = f.nowSecond + seconds;
  while (target >= f.weekAnchor + 604800) {
    let result = resolveSliceWeeklyFinance({ ...f.finance, week: b.week, revision, cash: b.cash, pulse: 'BILL', billAmount: 0 }); receipts.push(...result.receipts);
    if (result.eventId === 'LIFE-BILL-01') {
      const due = SLICE_LIFE[result.state.lifeTier].cost, paid = result.state.cash;
      result.state.cash = 0; result.state.debts.push({ id: `${eventId}:living-debt:${b.week}`, source: '生活应付款', remaining: due - paid, weeklyPayment: 30, createdWeek: b.week });
      result.state.nextLifeTier = 'DESTITUTE'; result.state.pulse = 'DEBTS';
      receipts.push({ title: '本周生活应付款', text: `已付${paid}便士，未付${due - paid}便士如实计欠，下周采用赤贫生活。` });
      result = resolveSliceWeeklyFinance(result.state); receipts.push(...result.receipts);
    }
    b.cash = result.state.cash;
    const { nextLifeTier, debts, missedWeeks, credit } = result.state;
    Object.assign(f.finance, { lifeTier: nextLifeTier, nextLifeTier, debts: clone(debts), missedWeeks, credit });
    b.week++; b.date = addGameWeeks(b.date, 1); b.actions = f.finance.weeklyBudget; f.weekAnchor += 604800;
  }
  f.nowSecond = target;
}
function reduce(root: DemonessState, c: DemonessCommand, revision: number): DemonessEvent {
  const reason = commandBlock(root, c, revision); need(reason === null, reason ?? '当前无法行动。');
  const f = root.frame!, b = f.budget, eventId = `R221:${root.source!.runId}:${revision}`, before = clone(f), beforeDigest = dataDigest(root);
  const checks: DemonessEvent['checks'] = [], financeReceipts: DemonessEvent['financeReceipts'] = [], notes: string[] = [];
  const time = (seconds: number) => elapse(root, seconds, revision, eventId, financeReceipts);
  const injury = (severity: 'LIGHT' | 'HEAVY', suffix: string) => { b.injuries.push({ id: `${eventId}:${suffix}`, severity, acquiredRevision: revision, treatedRevision: null }); b.injuryRisk += severity === 'HEAVY' ? 2 : 1; };
  const check = (ability: PublicCoreStatKey, difficulty: number, modifiers: { source: string; value: number }[]) => {
    const cursorBefore = f.random.cursor, rng = new DeterministicActionRandomStream(f.random.seed, cursorBefore);
    const result = resolveNormalCheck({ ability, baseAbility: b.coreStats[ability], difficulty, modifiers, roll: rng.nextInt(1, 100) });
    f.random.cursor = rng.cursor; checks.push({ check: result, cursorBefore, cursorAfter: rng.cursor }); return result;
  };
  const effect = (e: DemonessEffect) => {
    pay(b, e); time(e.seconds); if (e.injury) injury(e.injury, 'physical-injury');
    for (const [id, gain] of Object.entries(e.mastery)) {
      need(DEMONESS_ABILITY_IDS.some(x => x === id) && Number.isSafeInteger(gain) && gain >= 0, '技巧掌握的实际应用无效。');
      b.mastery[id] = (b.mastery[id] ?? 0) + gain;
    }
  };
  if (c.type === 'WORK') { pay(b, { actions: 1 }); b.cash += root.source!.character.weeklyWage; f.finance.wagePaidWeek = b.week; time(28800); notes.push(`实际工作八小时领取原职业本周工资${root.source!.character.weeklyWage}便士，同周不能重复领取。`); }
  else if (c.type === 'REST') {
    pay(b, { actions: 1 }); const life = SLICE_LIFE[f.finance.lifeTier], cap = b.sequence === 0 ? DEMONESS_SPIRITUALITY_CAP : 120;
    b.health = Math.min(100, b.health + life.health); b.mind = Math.min(100, b.mind + life.mind); b.spirituality = Math.min(cap, b.spirituality + Math.round(cap * life.spirituality)); b.pollution = Math.max(0, b.pollution - 10);
    b.injuries = b.injuries.filter(i => !(b.health >= 80 && i.acquiredRevision < revision && (i.severity === 'LIGHT' || i.treatedRevision !== null && i.treatedRevision < revision)));
    if (!b.injuries.length) b.injuryRisk = 0; root.passage!.playerEnergy = Math.min(100, root.passage!.playerEnergy + 20); time(28800);
    notes.push('按原实际生活档休养八小时，未处置重伤仍保留；本人精力恢复20，旧成人和旧器具不补满。');
  } else if (c.type === 'CLINIC') { pay(b, { actions: 1, cash: 60 }); for (const i of b.injuries) if (i.severity === 'HEAVY' && i.treatedRevision === null) i.treatedRevision = revision; time(3600); notes.push('实付60便士完成普通重伤处置，仍须实际休养恢复。'); }
  else if (c.type === 'NEXT_WEEK') { b.actions = 0; time(f.weekAnchor + 604800 - f.nowSecond); notes.push('走到下一实际周界，生活费与旧债照常结算；没有自动工资、免费修补或身体恢复。'); }
  else if (c.type === 'TRAVEL' || c.type === 'RETURN_ON_FOOT') {
    const from = f.location; if (c.type === 'TRAVEL') pay(b, { actions: 1 }); f.location = c.type === 'TRAVEL' ? c.to : 'DM221-RECEPTION';
    transportDemonessMaterials(root.materials!, from, f.location); time(c.type === 'TRAVEL' ? 1800 : 7200);
    notes.push(c.type === 'TRAVEL' ? '本人携同一批随身原物沿普通道路步行半小时抵达，旧成人与展廊物件没有随行。' : '本人携同一批随身原物沿普通道路步行两小时回街区接待处，无需行动或现款，旧伤和旧费用保留。');
  } else if (c.type === 'PASSAGE') {
    const host = demonessHost(root, eventId, revision), spec = demonessPassageCheck(root.passage!, c.command, host);
    if (spec) host.check = check(spec.ability, spec.difficulty, spec.modifiers);
    const result = applyDemonessPassage(root.passage!, c.command, host); root.passage = result.state; effect(result.effect); notes.push(...result.notes);
  } else if (c.type === 'MATERIAL') {
    const result = applyDemonessMaterial(root.materials!, c.command, demonessHost(root, eventId, revision), root.passage!.passageReportEventId, root.source!);
    root.materials = result.state; effect(result.effect); notes.push(...result.notes);
  } else if (c.type === 'STABILIZE_PROMOTION') {
    pay(b, DEMONESS_PREPARATION); time(DEMONESS_PREPARATION.seconds); const compound = root.materials!.compounds.find(x => x.id === c.compoundId)!;
    root.preparations.push({ id: `${eventId}:stability`, compoundId: compound.id, actorId: root.source!.actorId, sourceDigest: root.source!.historyDigest,
      compoundDigest: demonessDigest(compound), passageReportEventId: root.passage!.passageReportEventId!, location: f.location,
      preparedSecond: f.nowSecond, expiresSecond: f.nowSecond + DEMONESS_PREPARATION.validSeconds, status: 'READY', changedEventId: null });
    notes.push('实付150便士、1行动、12灵性与8精神，完成同一本人、同一成药与两份实际通行结果的稳定准备；七天内有效，离室、换瓶或服药即失效。');
  } else if (c.type === 'CONSUME') {
    const prep = prepared(root, c.compoundId), result = check('will', DEMONESS_CONSUMPTION.difficulty, prep ? [{ source: '同一本人的同瓶实际稳定准备', value: DEMONESS_CONSUMPTION.preparedBonus }] : []);
    const success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS', severe = result.tier === 'GREAT_FAILURE';
    pay(b, { actions: 1, spirituality: 30 });
    if (success) {
      pay(b, { mind: DEMONESS_CONSUMPTION.successMind }); b.sequence = 0; b.acting = 0; root.promotionWeek = b.week;
      for (const id of DEMONESS_ABILITY_IDS) b.mastery[id] = 0;
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) b.coreStats[stat] = Math.min(500, b.coreStats[stat] + 1);
      b.completedSources.push('DEMONESS_ORIGINAL_SUCCESSION');
    } else {
      pay(b, { health: severe ? DEMONESS_CONSUMPTION.greatFailureHealth : DEMONESS_CONSUMPTION.failureHealth, mind: severe ? DEMONESS_CONSUMPTION.greatFailureMind : DEMONESS_CONSUMPTION.failureMind,
        pollution: severe ? DEMONESS_CONSUMPTION.greatFailurePollution : DEMONESS_CONSUMPTION.failurePollution }); injury('HEAVY', 'potion-injury');
    }
    settleDemonessConsumption(root.materials!, c.compoundId, demonessHost(root, eventId, revision), success, b.status === 'ACTIVE');
    if (prep) { prep.status = 'SPENT'; prep.changedEventId = eventId; } time(3600);
    notes.push(success ? '体内原份、实际携来的两份末日特性与同一唯一性真正融合。四属性各加1，两项新技巧从零开始；当前灵性不补满，性别、姓名、原身份、旧掌握及旧人旧物不变。' : '本瓶实际耗尽，失败费用、重伤与污染照常保留，没有生命保底。幸存者可原地封存同一残余，隔周付费回收再调配；死亡者封存周目，原三份与唯一性留在实际所在地。');
  }
  const physical = advanceDemonessPassageClock(root.passage!, f.nowSecond);
  if (physical.health) pay(b, { health: physical.health }); if (physical.injury) injury('LIGHT', 'fallen-stone-injury'); notes.push(...physical.notes);
  if (b.status !== 'ACTIVE') preserveDemonessDeathResidue(root.materials!, f.location);
  for (const p of root.preparations) if (p.status === 'READY' && prepared(root, p.compoundId)?.id !== p.id) { p.status = 'INVALIDATED'; p.changedEventId = eventId; }
  const event: DemonessEvent = { id: eventId, revision, command: clone(c), before, after: clone(f), checks: clone(checks), financeReceipts, notes, beforeDigest, afterDigest: dataDigest(root) };
  root.journal.push(event); return event;
}
/** Endpoint checks are shared by cold admission and trusted hot transitions. No hash is a capability. */
export function assertDemonessEndpoint(s: DemonessSlice, root: DemonessState): void {
  const source = root.source, f = root.frame; need(source && f, '缺少本人的真实来源。');
  need(s.progression.pathwayId === 'demoness' && s.revision === source.revision + 1 + root.journal.length && sameDemoness(demonessBudget(s), f.budget) && sameDemoness(s.random, f.random), '当前身体与实际行动终点不一致。');
  const { coreStats: _current, ...identity } = s.character, { coreStats: _old, ...originalIdentity } = source.character;
  need(sameDemoness(identity, originalIdentity) && Object.entries(f.finance).every(([key, value]) => sameDemoness(s[key as keyof SliceState], value)), '本人身份或实际生活账本不一致。');
  need(source.historyDigest === demonessHistoryDigest(s) && source.originalWorldDigest === demonessDigest(s.world) && source.combatHistoryLength === s.combatHistory.length && source.combatHistoryDigest === demonessDigest(s.combatHistory), '原人物、原瓶、旧世界或原战斗记录被改写。');
  need(s.combat === null && s.activeEvent === null && s.eventQueue.length === 0 && s.pulse === 'NONE', '本章不能同时开启旧现场。');
  need((f.budget.sequence === 0) === (root.promotionWeek !== null), '实际晋升与服药结果不一致。');
}
function reconstruct(s: DemonessSlice): DemonessState {
  const saved = s.demoness; need(saved?.source && validateDemonessSource(s, saved.source, 'COLD_REOPEN'), '完整末日魔女历史和三份原物来源尚未通过核验。');
  need(Array.isArray(saved.journal), '实际行动记录无效。'); const root = start(clone(saved.source));
  for (const event of saved.journal) { need(event && event.revision === saved.source.revision + 2 + root.journal.length, '本章修订次序不一致。'); const actual = reduce(root, clone(event.command), event.revision); need(sameDemoness(actual, event), '实际随机结果、费用、身体或原物变化与原行动不一致。'); }
  need(sameDemoness(root, saved), '当前通道、原物和身体不能由真实行动重建。'); assertDemonessEndpoint(s, root); return root;
}
export function validateDemonessRoot(s: DemonessSlice): void { reconstruct(s); }
export function openDemonessOwnedEngine(s: DemonessSlice): DemonessOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotDemonessOwnedEngine(handle: DemonessOwnedEngine): DemonessState { return clone(getOwned(handle)); }
export function advanceDemonessOwnedEngine(handle: DemonessOwnedEngine, command: DemonessCommand, revision: number): DemonessOwnedEngine { const next = clone(getOwned(handle)); reduce(next, clone(command), revision); return retain(next); }
export function blockDemonessOwnedEngine(handle: DemonessOwnedEngine, command: DemonessCommand, revision: number): string | null { try { return commandBlock(getOwned(handle), command, revision); } catch { return '当前记录或行动条件无效。'; } }
