import type { PublicCheckResult, PublicGameDate } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasSageOldPractice } from './index.js';
import { SAGE_INHERITED_ABILITIES } from './content.js';
import type { SageAcquisitionBudget, SageAction } from './types.js';

export const SAGE_RITUAL_COMMANDS = ['RITUAL_VISIT', 'RITUAL_STUDY', 'RITUAL_EVACUATE', 'RITUAL_CUT_PLATE', 'RITUAL_CUT_INDEX', 'RITUAL_CONTAIN', 'RITUAL_REVIEW', 'RITUAL_RETREAT', 'RITUAL_BUY_SEALS'] as const;
export type SageRitualCommand = { type: typeof SAGE_RITUAL_COMMANDS[number] };
export type SageRitualLocation = 'OUTSIDE' | 'HALL' | 'PLATES' | 'INDEX' | 'CORE';
export interface SageRitualSeal {
  id: string; source: string; purchasedWeek: number; status: 'HELD' | 'USED';
  usedFor: 'PLATE' | 'INDEX' | 'CORE' | null; usedWeek: number | null;
}
export interface SageRitualEvent {
  week: number; date: PublicGameDate; revision: number; command: SageRitualCommand;
  actor: { name: string; gender: string; pathwayId: 'hermit'; prophecyMasterPromotionWeek: number; pryerPromotionWeek: number };
  before: SageAcquisitionBudget; after: SageAcquisitionBudget;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface SageRitualState {
  siteId: 'SAGE2-OLD-ARCHIVE'; sourceId: 'SAGE2-GLASS-REGISTER'; provenance: string;
  introducedWeek: number | null; introducedDate: PublicGameDate | null;
  status: 'UNSEEN' | 'ACTIVE' | 'STOPPED'; location: SageRitualLocation;
  travelMetres: number; elapsedSeconds: number; closure: 'UNRECORDED' | 'CLOSED' | 'SEALED';
  studiedWeek: number | null; evacuatedWeek: number | null;
  records: { id: 'SAGE2-ORIGINAL-RECORDS'; total: 12; damaged: number };
  plates: { id: 'SAGE2-ORIGINAL-PLATES'; total: 4; damaged: number };
  people: { id: string; name: string; age: number; location: 'HALL' | 'OUTSIDE'; health: number; mind: number; injuries: string[] }[];
  core: { id: 'SAGE2-GLASS-CORE'; highLevelRemnant: true; active: boolean; sealedWeek: number | null; sealId: string | null };
  routes: { plate: { objectId: 'SAGE2-PLATE-CONNECTION'; active: boolean; cutWeek: number | null; sealId: string | null }; index: { objectId: 'SAGE2-INDEX-CIRCUIT'; active: boolean; cutWeek: number | null; sealId: string | null } };
  seals: SageRitualSeal[];
  stoppedRecord: { id: 'SAGE2-STOPPED-DISASTER'; week: number; actorName: string; sourceId: 'SAGE2-GLASS-REGISTER'; coreId: 'SAGE2-GLASS-CORE'; routeIds: string[]; damagedRecords: number; damagedPlates: number } | null;
  review: { week: number; actorName: string; recordId: 'SAGE2-STOPPED-DISASTER' } | null;
  journal: SageRitualEvent[];
}
export interface SageRitualProjection {
  title: string; story: string; status: string; location: string; source: string; threat: string; damage: string;
  people: string[]; routes: string[]; materials: string; stoppedRecord: string | null; review: string | null;
  actions: SageAction[]; inside: boolean; nextStep: string;
}
export const SAGE_RITUAL_PROVENANCE = '旧档案馆移交卷SG-42记录：格兰维尔旧宅封存物玻璃名录于本纪元1348年交入原馆，编号SAGE2-GLASS-REGISTER。唯一原玻璃核心SAGE2-GLASS-CORE留在原地下核心间，以原刻印板连接和原索引回路接触馆内记录。移交卷与当前裂纹、覆写和伤者记录共同确认这是高层次遗留物引发的真实信息洪流，并非预言大师仓库中始终封存的低强度教学残响。';
export const SAGE_RITUAL_STORY = '玻璃名录破损后持续把杂乱而危险的信息压入原档案和刻印板。三份原记录已被覆写，一块原板开裂，两名成年馆员受伤。你须先亲自研究原移交卷与现有回路，护送他们沿普通门道离开，再分别切断刻印板连接、索引回路，最后封存唯一核心。导师不会代你阻止灾难。';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const POSITIONS: Record<SageRitualLocation, number> = { OUTSIDE: 0, HALL: 6, PLATES: 12, INDEX: 16, CORE: 22 };
const LOCATION_NAMES: Record<SageRitualLocation, string> = { OUTSIDE: '馆外普通出口', HALL: '原门厅', PLATES: '刻印板间', INDEX: '索引间', CORE: '地下核心间' };
const SEAL_PRICE = 120;
export function createSageRitualState(): SageRitualState {
  return { siteId: 'SAGE2-OLD-ARCHIVE', sourceId: 'SAGE2-GLASS-REGISTER', provenance: SAGE_RITUAL_PROVENANCE,
    introducedWeek: null, introducedDate: null, status: 'UNSEEN', location: 'OUTSIDE', travelMetres: 0, elapsedSeconds: 0, closure: 'UNRECORDED', studiedWeek: null, evacuatedWeek: null,
    records: { id: 'SAGE2-ORIGINAL-RECORDS', total: 12, damaged: 3 }, plates: { id: 'SAGE2-ORIGINAL-PLATES', total: 4, damaged: 1 },
    people: [
      { id: 'SAGE2-MAREN', name: '玛伦·克莱', age: 46, location: 'HALL', health: 88, mind: 82, injuries: ['此前接触洪流造成的掌部割伤与持续耳鸣'] },
      { id: 'SAGE2-EDRIC', name: '埃德里克·芬', age: 39, location: 'HALL', health: 91, mind: 79, injuries: ['此前抢救原板造成的前臂伤与意识混乱'] },
    ],
    core: { id: 'SAGE2-GLASS-CORE', highLevelRemnant: true, active: true, sealedWeek: null, sealId: null },
    routes: { plate: { objectId: 'SAGE2-PLATE-CONNECTION', active: true, cutWeek: null, sealId: null }, index: { objectId: 'SAGE2-INDEX-CIRCUIT', active: true, cutWeek: null, sealId: null } },
    seals: [], stoppedRecord: null, review: null, journal: [] };
}
export const hasSageRitualSceneLock = (s: SliceState): boolean => s.sage.ritual.location !== 'OUTSIDE';
export function hasSageStoppedDisaster(s: SliceState): boolean {
  const r = s.sage.ritual;
  return r.status === 'STOPPED' && !r.core.active && !r.routes.plate.active && !r.routes.index.active && r.studiedWeek !== null && r.evacuatedWeek !== null &&
    r.stoppedRecord !== null && r.stoppedRecord.actorName === s.character.name && r.review !== null && r.review.recordId === r.stoppedRecord.id && r.review.actorName === s.character.name && r.location === 'OUTSIDE';
}
export function validateSageRitualCommand(v: unknown): v is SageRitualCommand {
  return record(v) && shape(v, ['type']) && SAGE_RITUAL_COMMANDS.includes(v.type as SageRitualCommand['type']);
}
function budget(s: SliceState): SageAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, pollution: s.seer.pollution,
    sequence: s.progression.sequence as 3 | 2, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery },
    completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function validBudget(v: unknown): v is SageAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    v.sequence !== 3 || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) || !Object.values(v.coreStats).every(n => integer(n, 0, 500)) ||
    !record(v.mastery) || !shape(v.mastery, SAGE_INHERITED_ABILITIES.map(a => a.id)) || !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) ||
    !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) || new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
export function sageRitualBlock(s: SliceState, c: SageRitualCommand): string | null { return block(s, c, false); }
function block(s: SliceState, c: SageRitualCommand, historical: boolean): string | null {
  if (!validateSageRitualCommand(c)) return '档案馆行动无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着并保持清醒，灾难没有死亡保护。';
  if (s.progression.pathwayId !== 'hermit' || s.progression.sequence !== 3 || !s.sage.guidanceKnown || s.prophecyMaster.promotionWeek === null) return '先以预言大师身份听取贤者指导，再亲自处理原档案馆灾难。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、战斗与周结算。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德的原旧档案馆。';
  if (s.sage.preparedWeek !== null) return '先结束当前服药准备。';
  if (!historical && hasSageOldPractice(s)) return '须先结束旧实践、归还旧原物，沿普通路线离开旧场。';
  const r = s.sage.ritual;
  if (c.type === 'RITUAL_RETREAT') return r.location === 'OUTSIDE' ? '本人已经在馆外。' : null;
  if (c.type === 'RITUAL_BUY_SEALS') return r.location !== 'OUTSIDE' ? '先沿普通通道回到馆外领取封缄材料。' : r.status === 'STOPPED' ? '原灾难已停止，无须再为此原核心购买材料。' : s.cash < SEAL_PRICE ? '三份实际封缄材料需120便士。' : null;
  if (c.type === 'RITUAL_REVIEW') return r.location !== 'OUTSIDE' ? '先实际回到馆外进行交接复核。' : r.stoppedRecord === null ? '必须本人先切断两路并封存原核心，只有疏散或撤退记录不合格。' : r.review !== null ? '这份本人阻止灾难的记录已复核，失败服药也不抹去。' : null;
  if (c.type === 'RITUAL_VISIT') return r.location !== 'OUTSIDE' ? '本人已经在馆内，不能重复进入。' : r.status === 'STOPPED' ? '原核心已经封存，不能为晋升重新制造灾难。' : null;
  if (r.status !== 'ACTIVE' || r.location === 'OUTSIDE') return '先实际进入仍被封闭的原档案馆。';
  if (s.actionsRemaining < 1) return '本次实作需要1行动；仍可0行动沿原通道退回馆外，下周再来，灾害不会因此消失。';
  if (c.type === 'RITUAL_STUDY') return r.studiedWeek !== null ? '已亲自研究同一原来源和两条回路，不能重复领取研究。' : s.spirituality < 4 || s.mind <= 2 ? '研究需4灵性、2精神，且必须保持清醒。' : null;
  if (r.studiedWeek === null) return '先本人研究原移交卷、当前损毁和两条实际回路，不能直接借导师结论封存。';
  if (c.type === 'RITUAL_EVACUATE') return r.evacuatedWeek !== null ? '两名原成年人已在馆外，不能再复制一次疏散。' : null;
  if (r.evacuatedWeek === null || r.people.some(p => p.location !== 'OUTSIDE')) return '先亲自护送两名仍在门厅的成年馆员沿普通出口离开。';
  if (c.type === 'RITUAL_CUT_PLATE' && !r.routes.plate.active || c.type === 'RITUAL_CUT_INDEX' && !r.routes.index.active) return '这条原传播路已经实际截断，不可重复结算。';
  if (c.type === 'RITUAL_CONTAIN' && (r.routes.plate.active || r.routes.index.active)) return '先分别截断原刻印板连接和原索引回路；只救人仍未阻止灾难。';
  if (!r.seals.some(seal => seal.status === 'HELD')) return '没有未用的封缄材料；可普通退回馆外，付120便士补购三份，不会重置已完成步骤。';
  const spirit = c.type === 'RITUAL_CONTAIN' ? 8 : 6;
  if (s.spirituality < spirit || s.mind <= 12 || s.health <= 10) return `此次需${spirit}灵性、2精神，且精神>12、健康>10以承受可能反冲；不足时可普通撤出休养。`;
  return null;
}
function move(r: SageRitualState, to: SageRitualLocation): void {
  const distance = Math.abs(POSITIONS[r.location] - POSITIONS[to]);
  r.travelMetres += distance; r.elapsedSeconds += distance; r.location = to;
}
function worsen(r: SageRitualState, severe = false): void {
  r.records.damaged = Math.min(r.records.total, r.records.damaged + (severe ? 2 : 1));
  r.plates.damaged = Math.min(r.plates.total, r.plates.damaged + 1);
}
function apply(s: SliceState, c: SageRitualCommand, ctx: SeerContext, historical = false): void {
  const reason = block(s, c, historical); if (reason) throw new Error(reason);
  const r = s.sage.ritual;
  if (c.type === 'RITUAL_BUY_SEALS') {
    s.cash -= SEAL_PRICE; const first = r.seals.length + 1;
    for (let n = first; n < first + 3; n++) r.seals.push({ id: `sage-seal-${n}`, source: `旧档案馆馆外交接处第${s.week}周交付的独立封缄材料sage-seal-${n}，本批三份实付120便士。`, purchasedWeek: s.week, status: 'HELD', usedFor: null, usedWeek: null });
    ctx.note('封缄材料实际交付', `0行动，实付120便士取得三份独立材料sage-seal-${first}至sage-seal-${first + 2}；每次截路或封核心尝试都耗一份，失败也不返还。旧耗材、损毁与步骤不回填。`); return;
  }
  if (c.type === 'RITUAL_VISIT') {
    move(r, 'HALL');
    if (r.introducedWeek === null) { r.introducedWeek = s.week; r.introducedDate = { ...s.date }; r.status = 'ACTIVE'; r.closure = 'CLOSED'; }
    ctx.note('沿普通门道进入旧档案馆', `0行动，实际步行6米至原门厅。${SAGE_RITUAL_STORY}原馆继续封闭，已花费用与旧损毁不会复原。`); return;
  }
  if (c.type === 'RITUAL_RETREAT') {
    const distance = POSITIONS[r.location]; move(r, 'OUTSIDE');
    ctx.note('沿原通道实际退到馆外', `0行动、实际步行${distance}米回到馆外。${r.core.active ? '核心仍活跃，未断传播路继续存在，原馆保持封闭；此次撤离不构成阻止灾难。' : '原核心保持封存，原馆封闭管理，损毁及伤者继续保留。'}已用行动、灵性、精神和封缄材料不返还。`); return;
  }
  if (c.type === 'RITUAL_REVIEW') {
    r.review = { week: s.week, actorName: s.character.name, recordId: 'SAGE2-STOPPED-DISASTER' };
    ctx.note('复核本人阻止灾难的原记录', `0行动，你在馆外与专业人员逐项核对本人实作、两路切断、唯一核心封存以及原伤者和损毁。第${r.stoppedRecord!.week}周的实际阻止记录继续留存，后续药物排异不撤销它。导师没有代你处理灾难。`); return;
  }
  s.actionsRemaining--;
  if (c.type === 'RITUAL_STUDY') {
    move(r, 'HALL'); s.spirituality -= 4; s.mind -= 2; r.elapsedSeconds += 60; r.studiedWeek = s.week;
    r.records.damaged = Math.min(12, r.records.damaged + 1);
    ctx.note('亲自研究原名录与传播路径', `1行动、4灵性、2精神。你本人对原移交卷、核心外壳和眼前损毁做交叉核对，确认刻印板连接与索引回路各自仍在扩散。研究期间又一份原记录被覆写，累计${r.records.damaged}/12份；读取线索本身没有停止灾难，也没有提前得到贤者能力。`); return;
  }
  if (c.type === 'RITUAL_EVACUATE') {
    move(r, 'HALL'); move(r, 'OUTSIDE'); r.evacuatedWeek = s.week;
    for (const p of r.people) p.location = 'OUTSIDE';
    r.elapsedSeconds += 30;
    ctx.note('亲自护送两名成年伤者出馆', '1行动。你走回原门厅，带同一46岁玛伦和39岁埃德里克沿6米普通通道到馆外；他们的身体、伤势和精神损耗保留，没有复制、治疗或隐去他们。原核心和两条传播路仍然活跃，疏散尚不构成阻止灾难。'); return;
  }
  const part = c.type === 'RITUAL_CUT_PLATE' ? 'PLATE' : c.type === 'RITUAL_CUT_INDEX' ? 'INDEX' : 'CORE';
  move(r, part === 'PLATE' ? 'PLATES' : part === 'INDEX' ? 'INDEX' : 'CORE');
  const seal = r.seals.find(v => v.status === 'HELD')!; seal.status = 'USED'; seal.usedFor = part; seal.usedWeek = s.week;
  const spirit = part === 'CORE' ? 8 : 6, difficulty = part === 'CORE' ? 25 : 20;
  s.spirituality -= spirit; s.mind -= 2; r.elapsedSeconds += 30;
  const check = ctx.check('knowledge', difficulty);
  if (success(check.tier)) {
    if (part === 'CORE') {
      r.core.active = false; r.core.sealedWeek = s.week; r.core.sealId = seal.id; r.status = 'STOPPED'; r.closure = 'SEALED';
      r.stoppedRecord = { id: 'SAGE2-STOPPED-DISASTER', week: s.week, actorName: s.character.name, sourceId: r.sourceId, coreId: r.core.id,
        routeIds: [r.routes.plate.objectId, r.routes.index.objectId], damagedRecords: r.records.damaged, damagedPlates: r.plates.damaged };
    } else {
      const route = part === 'PLATE' ? r.routes.plate : r.routes.index;
      route.active = false; route.cutWeek = s.week; route.sealId = seal.id;
    }
  } else {
    const severe = check.tier === 'GREAT_FAILURE'; worsen(r, severe);
    s.health -= severe ? 8 : 4; s.mind -= severe ? 8 : 4; s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 8 : 4));
  }
  ctx.note(part === 'CORE' ? '本人尝试封存唯一原核心' : part === 'PLATE' ? '本人尝试切断原刻印板连接' : '本人尝试切断原索引回路',
    `1行动、${spirit}灵性、2精神，消耗原材料${seal.id}，知识${difficulty}检定${check.roll}/${check.chance}。${success(check.tier) ? part === 'CORE' ? '两路已断后，你本人封存同一原核心，实际停止高层次信息洪流，留下可复核的阻止记录。' : '这一条原传播路实际截断；另一条和原核心仍须分别处理。' : `尝试失败，未改变该目标的活跃状态，反冲另损健康${check.tier === 'GREAT_FAILURE' ? 8 : 4}、精神${check.tier === 'GREAT_FAILURE' ? 8 : 4}及增加同量污染；原档案和刻印板进一步损毁。原馆继续封闭，不能把失败当成功；撤出休养补购后可继续同一原场。`}损毁记录${r.records.damaged}/12、原板${r.plates.damaged}/4，原伤者在馆外，旧伤不消失。`);
}
export function applySageRitualCommand(s: SliceState, command: SageRitualCommand, ctx: SeerContext): void {
  const reason = sageRitualBlock(s, command); if (reason) throw new Error(reason);
  const before = budget(s), actor: SageRitualEvent['actor'] = { name: s.character.name, gender: s.character.gender, pathwayId: 'hermit', prophecyMasterPromotionWeek: s.prophecyMaster.promotionWeek!, pryerPromotionWeek: s.progression.promotionWeek! };
  let check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const context: SeerContext = { ...ctx, check(ability, difficulty) {
    if (check !== null) throw new Error('同一步不能重复判定。');
    randomBefore = s.random.cursor; check = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor; return check;
  } };
  apply(s, command, context);
  s.sage.ritual.journal.push({ week: s.week, date: { ...s.date }, revision: s.revision, command: { ...command }, actor, before, after: budget(s), randomBefore, randomAfter, check });
}
/** Reconstructs an exact committed prefix; acquisition uses it instead of granting
 * a later successful ritual retroactively to an earlier potion event. */
export function reconstructSageRitualState(s: SliceState, count = s.sage.ritual.journal.length): SageRitualState | null {
  try {
    const source = s.sage.ritual.journal;
    if (!Array.isArray(source) || source.length > 10000 || !integer(count, 0, source.length)) return null;
    const expected = createSageRitualState(); let previous: SageRitualEvent | null = null, nextCursor = 0;
    const guidance = s.sage.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
    for (const raw of source.slice(0, count)) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.prophecyMaster.promotionWeek ?? s.week, s.sage.promotionWeek ?? s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateSageRitualCommand(raw.command) || !validBudget(raw.before) || !validBudget(raw.after) || !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'pathwayId', 'prophecyMasterPromotionWeek', 'pryerPromotionWeek']) ||
        raw.actor.name !== s.character.name || raw.actor.gender !== s.character.gender || raw.actor.pathwayId !== 'hermit' || raw.actor.prophecyMasterPromotionWeek !== s.prophecyMaster.promotionWeek || raw.actor.pryerPromotionWeek !== s.progression.promotionWeek ||
        !guidance || raw.revision <= guidance.revision || raw.week < guidance.week || compareGameDates(raw.date, guidance.date) < 0) return null;
      const e = raw as unknown as SageRitualEvent, b = e.before;
      if (previous && (e.week < previous.week || compareGameDates(e.date, previous.date) < 0 || e.revision <= previous.revision ||
        e.revision === previous.revision + 1 && e.week === previous.week && previous.after.actions > 0 && !same(e.before, previous.after))) return null;
      if (previous && (!same(e.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources) || SAGE_INHERITED_ABILITIES.some(a => e.before.mastery[a.id]! < previous!.after.mastery[a.id]!))) return null;
      const shadow: SliceState = { ...s, status: 'ACTIVE', week: e.week, date: { ...e.date }, revision: e.revision, health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: e.randomBefore ?? 0 },
        character: { ...s.character, coreStats: { ...b.coreStats } }, progression: { ...s.progression, sequence: 3, acting: b.acting, mastery: { ...b.mastery } }, seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
        sage: { ...s.sage, guidanceKnown: true, preparedWeek: null, ritual: expected } };
      let checks = 0;
      const ctx: SeerContext = { note() {}, roll() { throw new Error('无额外随机来源。'); }, check(ability, difficulty) {
        if (++checks !== 1 || ability !== 'knowledge' || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor)) throw new Error('仪式随机来源错误。');
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore);
        const result = resolveNormalCheck({ ability: 'knowledge', baseAbility: b.coreStats.knowledge, difficulty, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(result, e.check)) throw new Error('仪式结果与原随机来源不符。');
        shadow.random.cursor = random.cursor; nextCursor = random.cursor; return result;
      } };
      apply(shadow, e.command, ctx, true);
      if (!same(budget(shadow), e.after)) return null;
      const checked = ['RITUAL_CUT_PLATE', 'RITUAL_CUT_INDEX', 'RITUAL_CONTAIN'].includes(e.command.type);
      if (checked ? checks !== 1 : checks !== 0 || e.check !== null || e.randomBefore !== null || e.randomAfter !== null) return null;
      expected.journal.push(structuredClone(e)); previous = e;
    }
    return expected;
  } catch { return null; }
}
export function validateSageRitualState(s: SliceState): boolean {
  try {
    const expected = reconstructSageRitualState(s); if (!expected || !same(expected, s.sage.ritual)) return false;
    const last = expected.journal.at(-1);
    if (last && (SAGE_INHERITED_ABILITIES.some(a => !integer(s.progression.mastery[a.id], last.after.mastery[a.id]!, 500)) || !same(s.seer.completedSources.slice(0, last.after.completedSources.length), last.after.completedSources))) return false;
    if (s.sage.promotionWeek !== null && !hasSageStoppedDisaster(s)) return false;
    return true;
  } catch { return false; }
}
export function sageRitualActions(s: SliceState): SageAction[] {
  if (s.progression.pathwayId !== 'hermit' || s.progression.sequence !== 3 || !s.sage.guidanceKnown) return [];
  const r = s.sage.ritual, rows: [SageRitualCommand['type'], string, string][] = [];
  if (r.location !== 'OUTSIDE') rows.push(['RITUAL_RETREAT', '沿原通道实际退到馆外', `0行动 · 实走${POSITIONS[r.location]}米 · 保留灾害与损毁`]);
  if (r.status !== 'STOPPED') {
    if (r.location === 'OUTSIDE') {
      if (r.seals.filter(v => v.status === 'HELD').length < 3) rows.push(['RITUAL_BUY_SEALS', '补购三份独立封缄材料', '0行动 · 120便士 · 每次尝试消耗一份']);
      rows.push(['RITUAL_VISIT', '沿普通门道进入旧档案馆', '0行动 · 实走6米 · 现有灾害继续']);
    } else if (r.studiedWeek === null) rows.push(['RITUAL_STUDY', '亲自研究原名录及两条传播路', '1行动 · 4灵性 · 2精神 · 仍有实际损毁']);
    else if (r.evacuatedWeek === null) rows.push(['RITUAL_EVACUATE', '亲自护送两名成年伤者出馆', '1行动 · 沿实际6米普通出口 · 不停止灾害']);
    else {
      if (r.routes.plate.active) rows.push(['RITUAL_CUT_PLATE', '切断原刻印板连接', '1行动 · 6灵性 · 2精神 · 1份封缄材料 · 知识20']);
      if (r.routes.index.active) rows.push(['RITUAL_CUT_INDEX', '切断原索引回路', '1行动 · 6灵性 · 2精神 · 1份封缄材料 · 知识20']);
      if (!r.routes.plate.active && !r.routes.index.active) rows.push(['RITUAL_CONTAIN', '亲自封存唯一原核心', '1行动 · 8灵性 · 2精神 · 1份封缄材料 · 知识25']);
    }
  } else if (r.review === null) rows.push(['RITUAL_REVIEW', '复核本人阻止灾难的原记录', '0行动 · 须已实际走到馆外']);
  return rows.map(([type, label, cost]) => { const command: SageRitualCommand = { type }, reason = sageRitualBlock(s, command); return { id: `sage-${type.toLowerCase().replaceAll('_', '-')}`, label, cost, enabled: reason === null, reason, command }; });
}
export function projectSageRitual(s: SliceState): SageRitualProjection {
  const r = s.sage.ritual, visible = s.sage.guidanceKnown, discovered = r.introducedWeek !== null, actions = sageRitualActions(s);
  const preferred = actions.find(a => a.enabled && a.command.type !== 'RITUAL_RETREAT') ?? actions.find(a => a.enabled);
  return { title: '玻璃名录 · 亲自阻止信息灾难', story: visible ? SAGE_RITUAL_STORY : '', status: r.status === 'UNSEEN' ? '尚未实际到场' : r.status === 'ACTIVE' ? '真实灾害仍在扩散' : '原核心已封存，洪流已停止',
    location: LOCATION_NAMES[r.location], source: discovered ? r.provenance : '', threat: discovered ? r.core.active ? '高层次原核心仍活跃；撤退、救人和截断一条路都不足以停止灾难。原馆继续封闭。' : '两条传播路已断，唯一原核心已封存；原馆继续封闭管理，既有伤者和损毁保留。' : '',
    damage: discovered ? `原记录${r.records.damaged}/${r.records.total}份已损毁，原刻印板${r.plates.damaged}/${r.plates.total}块已损毁。没有自动修复。` : '',
    people: discovered ? r.people.map(p => `${p.name}，${p.age}岁；${p.location === 'OUTSIDE' ? '馆外' : '原门厅'}；健康${p.health}、精神${p.mind}。${p.injuries.join('；')}。`) : [],
    routes: discovered ? [r.routes.plate, r.routes.index].map(route => `${route.objectId === r.routes.plate.objectId ? '原刻印板连接' : '原索引回路'}：${route.active ? '仍在传播' : `第${route.cutWeek}周本人已切断，消耗${route.sealId}`}。`) : [],
    materials: visible ? `封缄材料现有${r.seals.filter(v => v.status === 'HELD').length}份、已耗${r.seals.filter(v => v.status === 'USED').length}份；三份120便士，失败也实际耗用。累计实际步行${r.travelMetres}米、现场${r.elapsedSeconds}秒。` : '',
    stoppedRecord: r.stoppedRecord ? `${r.stoppedRecord.actorName}在第${r.stoppedRecord.week}周本人切断两路并封存原核心，实际停止玻璃名录灾难；原损毁记录继续留存。` : null,
    review: r.review ? `第${r.review.week}周完成原阻止记录专业复核；后续药物排异不撤销既往成功。` : null, actions, inside: hasSageRitualSceneLock(s),
    nextStep: preferred ? `${preferred.label}：${preferred.cost}。` : hasSageStoppedDisaster(s) ? '已保留本人阻止灾难与专业复核，可完成服药准备。' : actions.find(a => a.reason)?.reason ?? '先听取贤者指导。' };
}
