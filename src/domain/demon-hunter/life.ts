import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import type { DemonHunterAbilityId } from './types.js';

export const DEMON_HUNTER_CASE_IDS = ['sealed-sample', 'tailored-coating', 'concealed-approach'] as const;
export type DemonHunterCaseId = typeof DEMON_HUNTER_CASE_IDS[number];
export type DemonHunterActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: DemonHunterCaseId }
  | { type: 'PREPARE'; caseId: DemonHunterCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'TEST_PROBE' | 'WITHDRAW_PROBE'; caseId: 'tailored-coating' }
  | { type: 'RETURN_ROUTE' | 'RUSTLE'; caseId: 'concealed-approach' }
  | { type: 'REFLECT' };
export interface DemonHunterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  method: 'ABILITY' | 'ORDINARY' | null;
  attemptWeek: number | null;
  preparations: number; abilityPreparations: number; attempts: number; abilityAttempts: number;
  withdrawals: number; closes: number; contactOpen: boolean; checkedSuccess: boolean; taskComplete: boolean;
  noiseMade: boolean; lastOutcome: 'NONE' | 'SUCCESS' | 'FAILURE' | 'INTERRUPTED';
}
interface DemonHunterReagentDose {
  id: string; name: '暮星凝露（虚构G）' | '灰月印脂（虚构G）'; status: 'SEALED' | 'SPENT' | 'DISCARDED';
}
export interface DemonHunterReagentKit {
  id: number; preparedWeek: number; performedWeek: number | null;
  targetId: 'DH4-SHARD-1'; doses: [DemonHunterReagentDose, DemonHunterReagentDose];
  coatingProduced: boolean; coatingUsed: boolean; coatingDiscarded: boolean;
}
export interface DemonHunterLifeState {
  cases: Record<DemonHunterCaseId, DemonHunterCaseState>;
  reflected: boolean; paidProtectionKits: number; reagentKits: DemonHunterReagentKit[]; currentKitId: number | null;
  samples: {
    shardId: 'DH4-SHARD-1'; shardVitrine: 'DH4-VITRINE-1'; shardLid: 'CLOSED' | 'OPEN';
    sootId: 'DH4-SOOT-1'; sootVitrine: 'DH4-VITRINE-2'; sootLid: 'CLOSED' | 'OPEN'; innerSeals: 'INTACT';
    residualStrength: number; finding: 'UNKNOWN' | 'LIMITED_TRACE' | 'RECORDS_UNCERTAIN'; recordCompared: boolean;
  };
  probe: { id: 'DH4-PROBE-1'; location: 'RACK' | 'SHARD_CHAMBER'; coatingKitId: number | null; tests: number; withdrawals: number };
  moth: {
    id: 'DH4-MOTH-1'; enclosure: 'DH4-BARRED-ANNEX'; location: 'INSIDE_CAGE'; sight: true; hearing: true;
    cover: 'COVERED' | 'OPEN'; alerted: boolean; intentVeiled: boolean; rustles: number; alerts: number; covers: number;
  };
  player: { location: 'START_MARK' | 'SCREEN_END'; walks: number; distanceMetres: number };
}
export interface DemonHunterLifeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DemonHunterActivityCommand;
}
export interface DemonHunterLifeProjection {
  cases: { id: DemonHunterCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: { samples: string; preparation: string; probe: string; moth: string; route: string; cost: string; history: string[] } | null;
}

const CASES = [
  { id: 'sealed-sample', title: '两座原柜中的痕迹', story: '奥斯温的原检验室里，DH4-SHARD-1残片与DH4-SOOT-1普通炉灰各在自己的带盖玻璃柜。内封保持完整；编号、采集标签和第五纪1349年6月21日的原检验记录可以实际核对。原物、记录、场地及数值为原创G。', facts: ['原残片在DH4-VITRINE-1，原炉灰在DH4-VITRINE-2，内封不拆；两者不交换或复制。', '能力只感到这次观察范围内的污染痕迹，不得推断物主身份、全部历史或某个人天生邪恶。', '普通方法比较原标签与有日期的记录，结论保留不确定性；两种方法都实际支付60便士普通防护包。'] },
  { id: 'tailored-coating', title: '为同一残片准备一支探针', story: '上一案的同一DH4-SHARD-1初始残余强度为30。原青铜探针DH4-PROBE-1从原架取用；能力方法另购90便士的两剂封装虚构G试剂，借针对这块残片的知识与特殊冥想制成一次性涂层。', facts: ['暮星凝露、灰月印脂都是完整虚构G物质；本场不是现实化学或原著完整配方。', '两剂都须实际消耗。成功只让原探针带有针对DH4-SHARD-1的短时涂层；还须单独插入标记处试验，才消耗涂层并使这一原残片强度降低10。', '试验后原探针仍在柜内，必须实际抽回原架并合上屏蔽盖；普通方法核对留存记录，做正常屏蔽观察，不制造附魔或净化。'] },
  { id: 'concealed-approach', title: '遮屏后的两米距离', story: '原带栏玻璃隔间里只有一只低强度灰蛾DH4-MOTH-1。它对近处攻击意图敏感，也能看见与听见；这只灰蛾的物种和感知挑战为原创G，不是原著通用恶魔模板。固定不透明遮屏已覆盖从起点到终点的两米原路线。', facts: ['隐藏意图只作用于这次近处意图预警，不遮住身体、不消除脚步或衣料声；已有遮屏和轻步仍必需。', '能力成功才实际走到两米终点；故意让衣料作响仍会惊动原灰蛾，警觉持续到奥斯温实际盖住隔间。', '普通方法从起点用原长视镜观察并保留不确定性。走到终点的人必须沿原路走回，不能用关闭场景瞬移。'] },
] as const;
export const DEMON_HUNTER_LIFE_ENVIRONMENT = '三项不同的原创G有限实践；观察、准备、实施、报告各1行动，每项报告扮演25，三项后的反思另1行动、扮演25。普通方法同样可以和平100，不冒充能力掌握。第一案两种方法准备均60便士；第二案能力准备90便士、两剂原试剂，普通方法0便士；第三案准备0便士。能力实施依次3灵性/感知18、4灵性/知识18、3灵性/意志18；普通实施0灵性/知识10。失败保留成本，先实际收束，下一真实周才可重试。抽针、原路返回与合盖都是0行动、0灵性的原地操作。没有神话形态展示、银骑士传送或身体隐形。';
const emptyCase = (): DemonHunterCaseState => ({ status: 'AVAILABLE', method: null, attemptWeek: null, preparations: 0, abilityPreparations: 0, attempts: 0, abilityAttempts: 0, withdrawals: 0, closes: 0, contactOpen: false, checkedSuccess: false, taskComplete: false, noiseMade: false, lastOutcome: 'NONE' });
export function createDemonHunterLifeState(): DemonHunterLifeState {
  return {
    cases: { 'sealed-sample': emptyCase(), 'tailored-coating': emptyCase(), 'concealed-approach': emptyCase() },
    reflected: false, paidProtectionKits: 0, reagentKits: [], currentKitId: null,
    samples: { shardId: 'DH4-SHARD-1', shardVitrine: 'DH4-VITRINE-1', shardLid: 'CLOSED', sootId: 'DH4-SOOT-1', sootVitrine: 'DH4-VITRINE-2', sootLid: 'CLOSED', innerSeals: 'INTACT', residualStrength: 30, finding: 'UNKNOWN', recordCompared: false },
    probe: { id: 'DH4-PROBE-1', location: 'RACK', coatingKitId: null, tests: 0, withdrawals: 0 },
    moth: { id: 'DH4-MOTH-1', enclosure: 'DH4-BARRED-ANNEX', location: 'INSIDE_CAGE', sight: true, hearing: true, cover: 'COVERED', alerted: false, intentVeiled: false, rustles: 0, alerts: 0, covers: 0 },
    player: { location: 'START_MARK', walks: 0, distanceMetres: 0 },
  };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: Record<string, unknown>, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'warrior' && [4,3,2].includes(s.progression.sequence!);
const abilityFor = (id: DemonHunterCaseId): DemonHunterAbilityId => id === 'sealed-sample' ? 'warrior.s4.discern-corruption' : id === 'tailored-coating' ? 'warrior.s4.targeted-preparation' : 'warrior.s4.veil-intent';
const spiritCost = (id: DemonHunterCaseId) => id === 'tailored-coating' ? 4 : 3;
const sourceFor = (id: DemonHunterCaseId) => `demon-hunter-case:${id}`;
const preparationCost = (id: DemonHunterCaseId, method: 'ABILITY' | 'ORDINARY') => id === 'sealed-sample' ? 60 : id === 'tailored-coating' && method === 'ABILITY' ? 90 : 0;

export function validateDemonHunterActivityCommand(c: unknown): c is DemonHunterActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'REFLECT') return shape(c, ['type']);
  if (!DEMON_HUNTER_CASE_IDS.includes(c.caseId as DemonHunterCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (!shape(c, ['type', 'caseId'])) return false;
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string)) return true;
  if (['TEST_PROBE', 'WITHDRAW_PROBE'].includes(c.type as string)) return c.caseId === 'tailored-coating';
  return ['RETURN_ROUTE', 'RUSTLE'].includes(c.type as string) && c.caseId === 'concealed-approach';
}
export function hasDemonHunterLifeLock(s: SliceState): boolean {
  const l = s.demonHunter.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.probe.location !== 'RACK' || l.probe.coatingKitId !== null || l.player.location !== 'START_MARK' || l.samples.shardLid !== 'CLOSED' || l.samples.sootLid !== 'CLOSED' || l.moth.cover !== 'COVERED' || l.moth.alerted || l.moth.intentVeiled;
}
export function demonHunterActivityReason(s: SliceState, c: DemonHunterActivityCommand): string | null {
  if (!validateDemonHunterActivityCommand(c)) return '猎魔者实践命令无效。';
  if (!promoted(s)||s.progression.sequence!==4) return '此处保留原猎魔者练习，当前阶段不重新开启。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.combat || s.activeEvent) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要留在贝克兰德原检验室，不能跨城移动原物或复位。';
  const l = s.demonHunter.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return !r?.contactOpen ? '没有本次尚未结束的检验。' : l.probe.location !== 'RACK' ? '先把同一原探针实际抽回原架。' : l.player.location !== 'START_MARK' ? '先沿实际两米路线走回原起点。' : null;
  if (c.type === 'WITHDRAW_PROBE') return r?.contactOpen && l.probe.location === 'SHARD_CHAMBER' ? null : '原探针目前不在残片柜内。';
  if (c.type === 'RETURN_ROUTE') return r?.contactOpen && l.player.location === 'SCREEN_END' ? null : '你目前不在两米终点。';
  if (c.type === 'RUSTLE') return !r?.contactOpen || r.noiseMade ? '只在本次开放的原隔间示范一次实际衣料声。' : null;
  if (c.type === 'TEST_PROBE') return !r?.contactOpen || r.method !== 'ABILITY' || r.status !== 'ACTIVE' || !r.checkedSuccess || l.probe.location !== 'RACK' || l.probe.coatingKitId === null ? '需要本次实际制成且仍在原探针上的针对性涂层。' : l.samples.residualStrength < 10 ? '这块原残片没有可用于本次有限试验的残余强度。' : null;
  if (hasDemonHunterLifeLock(s)) return '先抽回原探针、沿原路返回并实际合盖收束。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(l.cases).some(([id, other]) => other.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '已经完成反思。' : DEMON_HUNTER_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r || r.status === 'RESOLVED') return '这项报告已经完成。';
  const index = DEMON_HUNTER_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[DEMON_HUNTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成上一项原现场的报告，再承接这一项。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '已经观察过原现场与边界。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.checkedSuccess && r.taskComplete ? null : '先完成真实检验、原物与原位置收束，再报告。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场。' : r.attemptWeek === s.week ? '本周已实际尝试，下一真实周再准备。' : s.cash < preparationCost(c.caseId, c.method) ? `本次准备需要${preparationCost(c.caseId, c.method)}便士实际材料费用。` : null;
  if (c.type !== 'PERFORM' || r.status !== 'PREPARED') return '先准备本次方法。';
  if (r.attemptWeek === s.week) return '本周已实际尝试，下一真实周再试。';
  return r.method === 'ABILITY' && s.spirituality < spiritCost(c.caseId) ? `实施需要${spiritCost(c.caseId)}灵性；可0行动取消准备。` : null;
}

export function applyDemonHunterActivity(s: SliceState, c: DemonHunterActivityCommand, ctx: SeerContext, award: (id: DemonHunterAbilityId, amount?: number) => void): void {
  const reason = demonHunterActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.demonHunter.life, p = l.probe, m = l.moth;
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.seer.completedSources.push('demon-hunter-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('知识、准备与真实边界', '三项原现场已经实际收束：痕迹不是物主罪恶证明，涂层需要实际目标和已耗材料，遮蔽意图不消除视听。G扮演+25，没有免费通用克制或神话形态。'); return;
  }
  const r = l.cases[c.caseId], spec = CASES.find(x => x.id === c.caseId)!;
  const kit = l.currentKitId === null ? null : l.reagentKits[l.currentKitId - 1]!;
  if (c.type === 'WITHDRAW') {
    if (kit) { kit.doses.forEach(d => { d.status = 'DISCARDED'; }); l.currentKitId = null; }
    r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '原物没有变化；本次防护包与封装试剂按本场G保管规则实际交回废料盒，不退款、不重新补出材料。已付行动保留，可选择普通方法。'); return;
  }
  if (c.type === 'TEST_PROBE') {
    kit!.coatingUsed = true; p.coatingKitId = null; p.location = 'SHARD_CHAMBER'; p.tests += 1; l.samples.shardLid = 'OPEN'; l.samples.residualStrength -= 10;
    r.taskComplete = true; r.status = 'EXAMINED';
    ctx.note('同一原探针实际插入', `DH4-PROBE-1进入DH4-SHARD-1的标记检验口，一次性针对涂层实际耗尽；这块原残片强度降低10至${l.samples.residualStrength}。内封依然完整，原探针仍在柜内，必须另行抽回；不能套用到陌生目标。`); return;
  }
  if (c.type === 'WITHDRAW_PROBE') {
    p.location = 'RACK'; p.withdrawals += 1; l.samples.shardLid = 'CLOSED';
    ctx.note('原探针实际抽回原架', 'DH4-PROBE-1从同一原柜检验口抽回原架，原屏蔽盖随后合上。残片强度与已耗两剂材料保留；0行动、0灵性，不复制探针或恢复涂层。'); return;
  }
  if (c.type === 'RETURN_ROUTE') {
    l.player.location = 'START_MARK'; l.player.walks += 1; l.player.distanceMetres += 2; m.intentVeiled = false;
    ctx.note('沿遮屏后的原路返回', '你从两米终点轻步沿同一实际路线走回起点，身体没有隐形或瞬移；这一次意图遮蔽结束。原灰蛾若已警觉仍然警觉，须另由奥斯温实际盖住隔间。'); return;
  }
  if (c.type === 'RUSTLE') {
    r.noiseMade = true; m.rustles += 1; if (!m.alerted) m.alerts += 1; m.alerted = true;
    r.taskComplete = false; r.status = 'OBSERVED'; r.lastOutcome = r.checkedSuccess ? 'INTERRUPTED' : 'FAILURE';
    ctx.note('原灰蛾确实听见衣料声', '衣料在实际位置作响，同一DH4-MOTH-1转向声源并持续警觉，即使这次意图仍被遮蔽也不例外。原遮屏只挡视线；本次安静检验已中断，没有完整任务奖励。先实际返回并合盖，下一真实周可重新尝试。'); return;
  }
  if (c.type === 'CLOSE') {
    if (kit?.coatingProduced && !kit.coatingUsed) { kit.coatingDiscarded = true; p.coatingKitId = null; }
    l.currentKitId = null; l.samples.shardLid = 'CLOSED'; l.samples.sootLid = 'CLOSED';
    if (c.caseId === 'concealed-approach') { m.cover = 'COVERED'; m.alerted = false; m.intentVeiled = false; m.covers += 1; }
    if (r.checkedSuccess && !r.taskComplete) { r.status = 'OBSERVED'; r.lastOutcome = 'INTERRUPTED'; }
    r.contactOpen = false; r.closes += 1;
    ctx.note('原现场实际收束', '奥斯温在原检验室实际合好原柜或隔间盖，未用的短时涂层擦除并废弃；原探针已在原架、你已在实际起点。只有这个有盖隔间的灰蛾在遮蔽刺激后结束本次警觉，不是通用清除敌意。残片强度、失败、资金与材料消耗全部保留。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(spec.title, spec.story + ' ' + spec.facts.join(' ') + '观察本身不打开原柜、不消耗试剂、不施加能力。'); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations += 1; r.abilityPreparations += Number(c.method === 'ABILITY'); r.checkedSuccess = false; r.taskComplete = false; r.noiseMade = false;
    const fee = preparationCost(c.caseId, c.method); s.cash -= fee;
    if (c.caseId === 'sealed-sample') l.paidProtectionKits += 1;
    if (c.caseId === 'tailored-coating' && c.method === 'ABILITY') {
      const id = l.reagentKits.length + 1;
      l.reagentKits.push({ id, preparedWeek: s.week, performedWeek: null, targetId: 'DH4-SHARD-1', doses: [{ id: `DH4-REAGENT-${id}-A`, name: '暮星凝露（虚构G）', status: 'SEALED' }, { id: `DH4-REAGENT-${id}-B`, name: '灰月印脂（虚构G）', status: 'SEALED' }], coatingProduced: false, coatingUsed: false, coatingDiscarded: false }); l.currentKitId = id;
    }
    ctx.note(spec.title, `本次准备实际花费${fee}便士，原物仍在原处。` + (c.method === 'ABILITY' ? c.caseId === 'tailored-coating' ? '两剂有独立原编号的虚构G试剂仍封装，尚未生成涂层；实施另1行动、4灵性、知识18。' : `实施另1行动、${spiritCost(c.caseId)}灵性、${c.caseId === 'sealed-sample' ? '感知' : '意志'}18。` : '准备核对记录或从起点使用原长视镜，实施另1行动、0灵性、知识10；保留普通证据的不确定性。')); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.seer.completedSources.push(sourceFor(c.caseId)); s.progression.acting = Math.min(100, s.progression.acting + 25);
    if (r.method === 'ABILITY') award(abilityFor(c.caseId), 8);
    ctx.note(spec.title, '已分开记录亲眼事实与有限推断，确认同一原物、花掉的材料及实际收束。G扮演+25；' + (r.method === 'ABILITY' ? '本次实际成功能力掌握+8。' : '普通记录仍有不确定性，不冒充能力掌握。')); return;
  }
  r.attemptWeek = s.week; r.attempts += 1; r.abilityAttempts += Number(r.method === 'ABILITY'); r.contactOpen = true;
  if (r.method === 'ABILITY') s.spirituality -= spiritCost(c.caseId);
  if (kit) { kit.performedWeek = s.week; kit.doses.forEach(d => { d.status = 'SPENT'; }); }
  const result = ctx.check(r.method === 'ORDINARY' ? 'knowledge' : c.caseId === 'sealed-sample' ? 'perception' : c.caseId === 'tailored-coating' ? 'knowledge' : 'will', r.method === 'ABILITY' ? 18 : 10);
  const success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  r.checkedSuccess = success; r.taskComplete = success; r.lastOutcome = success ? 'SUCCESS' : 'FAILURE'; r.status = success ? 'EXAMINED' : 'OBSERVED';
  if (c.caseId === 'sealed-sample') {
    l.samples.shardLid = 'OPEN'; l.samples.sootLid = 'OPEN';
    if (r.method === 'ORDINARY') l.samples.recordCompared = true;
    if (success) l.samples.finding = r.method === 'ABILITY' ? 'LIMITED_TRACE' : 'RECORDS_UNCERTAIN';
  } else if (c.caseId === 'tailored-coating') {
    if (r.method === 'ABILITY' && success) { kit!.coatingProduced = true; p.coatingKitId = kit!.id; r.taskComplete = false; r.status = 'ACTIVE'; }
    if (r.method === 'ORDINARY') l.samples.recordCompared = true;
  } else {
    m.cover = 'OPEN';
    if (r.method === 'ABILITY' && success) { l.player.location = 'SCREEN_END'; l.player.walks += 1; l.player.distanceMetres += 2; m.intentVeiled = true; }
    if (!success) { m.alerted = true; m.alerts += 1; }
  }
  const actual = c.caseId === 'sealed-sample' ? r.method === 'ABILITY' ? '只在原残片检测到有限污染痕迹，原炉灰在本次检查中未显同样痕迹；没有物主身份或完整历史。' : '已实际比较原采集标签与有日期的原检验记录；只作有保留的记录判断。' : c.caseId === 'tailored-coating' ? r.method === 'ABILITY' ? '两剂已实际消耗，特殊冥想与针对性知识使同一原青铜探针带上仅适配原残片的短时涂层；尚未插针、尚未减弱残片。' : '从屏蔽观察口核对同一残片与留存记录，没有涂层、没有减弱强度，原探针仍在原架。' : r.method === 'ABILITY' ? '你遮蔽这次近处意图，沿原不透明遮屏后轻步实际走到两米终点。灰蛾仍能看见和听见，遮屏与轻步没有被能力替代；仍须实际原路返回。' : '你留在实际起点，通过原长视镜作普通观察；没有近身、没有遮蔽意图，结论保留不确定性。';
  ctx.note(spec.title, success ? actual : '本次检定未成；行动与已付资金、灵性、两剂材料照常消耗，没有生成有效能力结果。原探针没有新涂层，玩家没有移动到新位置；灰蛾案保留实际警觉。先按原位置合盖收束，下一真实周可再准备。');
}

export function demonHunterLifeActions(s: SliceState): DemonHunterLifeAction[] {
  if (!promoted(s)) return [];
  const out: DemonHunterLifeAction[] = [], l = s.demonHunter.life;
  const add = (id: string, label: string, cost: string, command: DemonHunterActivityCommand) => { const reason = demonHunterActivityReason(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const spec of CASES) {
    const id = spec.id, r = l.cases[id];
    if (r.status === 'AVAILABLE') add(id + '-observe', '观察原现场与实际边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      add(id + '-ability', id === 'sealed-sample' ? '准备检查污染痕迹' : id === 'tailored-coating' ? '购买两剂针对性虚构试剂' : '准备遮蔽意图并轻步前进', `1行动 · ${preparationCost(id, 'ABILITY')}便士 · 实施另${spiritCost(id)}灵性`, { type: 'PREPARE', caseId: id, method: 'ABILITY' });
      add(id + '-ordinary', id === 'concealed-approach' ? '准备从起点使用原长视镜' : '准备普通记录与屏蔽检查', `1行动 · ${preparationCost(id, 'ORDINARY')}便士 · 实施0灵性`, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(id + '-perform', r.method === 'ABILITY' ? id === 'tailored-coating' ? '耗用两剂并制作原探针涂层' : id === 'concealed-approach' ? '遮蔽意图并尝试走过原两米路线' : '实际感知两座原柜中的痕迹' : '实际进行普通检查', r.method === 'ABILITY' ? `1行动 · ${spiritCost(id)}灵性 · ${id === 'sealed-sample' ? '感知' : id === 'tailored-coating' ? '知识' : '意志'}18` : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: id });
      add(id + '-withdraw', '取消尚未实施的准备', '0行动 · 已付费用与耗材不退', { type: 'WITHDRAW', caseId: id });
    }
    if (r.contactOpen) {
      if (id === 'tailored-coating') {
        if (l.probe.coatingKitId !== null) add(id + '-test', '把同一带涂层原探针插入标记检验口', '0行动 · 涂层耗尽 · 仅原残片强度−10', { type: 'TEST_PROBE', caseId: id });
        if (l.probe.location === 'SHARD_CHAMBER') add(id + '-withdraw-probe', '把同一原探针抽回原架并合上屏蔽盖', '0行动 · 0灵性 · 不恢复残片或涂层', { type: 'WITHDRAW_PROBE', caseId: id });
      }
      if (id === 'concealed-approach') {
        if (l.player.location === 'SCREEN_END') add(id + '-return', '沿遮屏后的原两米路线实际走回', '0行动 · 0灵性 · 不瞬移', { type: 'RETURN_ROUTE', caseId: id });
        if (!r.noiseMade) add(id + '-rustle', '让衣料作响，检验声音仍会暴露位置', '0行动 · 原灰蛾警觉 · 本次任务中断', { type: 'RUSTLE', caseId: id });
      }
      add(id + '-close', '由奥斯温实际合盖并收束原现场', '0行动 · 先抽针、原路返回 · 成本保留', { type: 'CLOSE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(id + '-report', '报告真实结果与尚存的不确定性', '1行动 · 先收束 · G扮演+25', { type: 'REPORT', caseId: id });
  }
  if (!l.reflected) add('demon-hunter-reflect', '反思针对性准备与意图遮蔽的边界', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  return out;
}
export function projectDemonHunterLife(s: SliceState): DemonHunterLifeProjection {
  if (!promoted(s)) return { cases: [], insideCase: false, environment: '', practice: null };
  const l = s.demonHunter.life, x = l.samples, p = l.probe, m = l.moth;
  return {
    insideCase: hasDemonHunterLifeLock(s), environment: DEMON_HUNTER_LIFE_ENVIRONMENT,
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return {
      id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [...spec.facts], status: r.status,
      preparation: r.status === 'PREPARED' ? `本次${r.method === 'ABILITY' ? '能力' : '普通'}准备已实际付${preparationCost(spec.id, r.method!)}便士；尚未实施。${r.method === 'ABILITY' ? `另耗${spiritCost(spec.id)}灵性。` : '0灵性，普通知识检查仍有不确定性。'}` : null,
      result: r.attemptWeek === null ? r.withdrawals ? '尚未实施的准备已取消，成本保留。' : null : `第${r.attemptWeek}周：${r.lastOutcome === 'SUCCESS' ? '检定成功' : r.lastOutcome === 'INTERRUPTED' ? '真实实施后中断' : '检定未成'}；${r.taskComplete ? '本次有限任务已完成' : '没有可报告的完整任务'}。实际尝试${r.attempts}次、收束${r.closes}次。`,
      contactOpen: r.contactOpen ? '原现场仍在开放，必须按实际原位置收束' : '本次没有尚未收束的原现场', closes: r.closes,
    }; }),
    practice: {
      samples: `同一${x.shardId}在${x.shardVitrine}，柜盖${x.shardLid === 'CLOSED' ? '已合' : '打开'}；同一${x.sootId}在${x.sootVitrine}，柜盖${x.sootLid === 'CLOSED' ? '已合' : '打开'}。两物内封完整。残片强度${x.residualStrength}/30。${x.finding === 'LIMITED_TRACE' ? '仅查见原残片的有限污染痕迹；原炉灰本次未显同样痕迹。' : x.finding === 'RECORDS_UNCERTAIN' ? '已据原采集标签与有日期的原检验记录作有限判断，仍有不确定性。' : '尚无成功检验结论。'}不能判断物主身份、全部历史或人的善恶。`,
      preparation: l.reagentKits.length ? l.reagentKits.map(k => `第${k.id}套90便士：${k.doses.map(d => `${d.id} ${d.name} ${d.status === 'SEALED' ? '仍封装' : d.status === 'SPENT' ? '已耗用' : '已交回废弃'}`).join('；')}。${k.coatingUsed ? '一次涂层已在原残片耗尽' : k.coatingDiscarded ? '未试验的短时涂层已擦除废弃' : k.coatingProduced ? '一次涂层仍在原探针上，只适用于DH4-SHARD-1' : '没有制成涂层'}`).join('。') : '未购买两剂原试剂；普通检查不会生成涂层。虚构G物质不提供现实制作配方。',
      probe: `唯一${p.id}青铜探针${p.location === 'RACK' ? '在原架' : '仍插在同一残片柜的检验口'}；${p.coatingKitId === null ? '没有可用涂层' : `带第${p.coatingKitId}套两剂制成的短时涂层`}。实际插针${p.tests}次、实际抽回${p.withdrawals}次；不会刷新残片强度或复制原物。`,
      moth: `同一${m.id}始终在原带栏玻璃隔间${m.enclosure}内；${m.cover === 'OPEN' ? '隔间盖打开' : '奥斯温已实际盖住隔间'}，${m.alerted ? '仍警觉' : '未处于本次警觉'}。视力与听力一直存在；${m.intentVeiled ? '目前只遮蔽这一次近处意图，身体仍可见、声响仍可闻' : '目前没有维持意图遮蔽'}。有限感知挑战和盖布降刺激是原创G。`,
      route: `你实际在${l.player.location === 'START_MARK' ? '原起点' : '原遮屏后的两米终点'}；固定不透明遮屏覆盖原两米路线，原长视镜在起点。累计实际移动${l.player.distanceMetres}米、${l.player.walks}个单程，原路返回不会瞬移。`,
      cost: `实际已付防护包${l.paidProtectionKits}套（${l.paidProtectionKits * 60}便士）与两剂试剂包${l.reagentKits.length}套（${l.reagentKits.length * 90}便士）。失败不返行动、资金、灵性或耗材；收束0行动、0灵性。`,
      history: [`原残片30→${x.residualStrength}，同一探针试验${p.tests}次，已耗涂层${l.reagentKits.filter(k => k.coatingUsed).length}次。`, `原灰蛾实际听见衣料声${m.rustles}次、警觉${m.alerts}次；奥斯温实际合隔间盖${m.covers}次。`, '意图遮蔽不等于物理隐形；没有银骑士3的传送、银甲或免费永久神话形态。'],
    },
  };
}

/** Plain-data validation of original objects, finite materials and physical cleanup. */
export function validateDemonHunterLife(s: SliceState): boolean {
  try {
    const l = s.demonHunter.life;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'paidProtectionKits', 'reagentKits', 'currentKitId', 'samples', 'probe', 'moth', 'player']) || !record(l.cases) || !shape(l.cases, DEMON_HUNTER_CASE_IDS)) return false;
    if (![l.samples, l.probe, l.moth, l.player].every(record) || !Array.isArray(l.reagentKits) || !Array.isArray(s.seer.completedSources) || typeof l.reflected !== 'boolean' || !integer(l.paidProtectionKits)) return false;
    const x = l.samples, p = l.probe, m = l.moth, player = l.player, first = s.demonHunter.promotionWeek ?? s.week;
    if (!shape(x, ['shardId', 'shardVitrine', 'shardLid', 'sootId', 'sootVitrine', 'sootLid', 'innerSeals', 'residualStrength', 'finding', 'recordCompared']) || x.shardId !== 'DH4-SHARD-1' || x.shardVitrine !== 'DH4-VITRINE-1' || x.sootId !== 'DH4-SOOT-1' || x.sootVitrine !== 'DH4-VITRINE-2' || x.innerSeals !== 'INTACT') return false;
    if (!['OPEN', 'CLOSED'].includes(x.shardLid) || !['OPEN', 'CLOSED'].includes(x.sootLid) || !['UNKNOWN', 'LIMITED_TRACE', 'RECORDS_UNCERTAIN'].includes(x.finding) || typeof x.recordCompared !== 'boolean' || !integer(x.residualStrength, 0, 30)) return false;
    if (!shape(p, ['id', 'location', 'coatingKitId', 'tests', 'withdrawals']) || p.id !== 'DH4-PROBE-1' || !['RACK', 'SHARD_CHAMBER'].includes(p.location) || !integer(p.tests, 0, 1) || !integer(p.withdrawals, 0, p.tests)) return false;
    if (!shape(m, ['id', 'enclosure', 'location', 'sight', 'hearing', 'cover', 'alerted', 'intentVeiled', 'rustles', 'alerts', 'covers']) || m.id !== 'DH4-MOTH-1' || m.enclosure !== 'DH4-BARRED-ANNEX' || m.location !== 'INSIDE_CAGE' || m.sight !== true || m.hearing !== true || !['COVERED', 'OPEN'].includes(m.cover) || ![m.alerted, m.intentVeiled].every(b => typeof b === 'boolean') || ![m.rustles, m.alerts, m.covers].every(n => integer(n))) return false;
    if (!shape(player, ['location', 'walks', 'distanceMetres']) || !['START_MARK', 'SCREEN_END'].includes(player.location) || !integer(player.walks) || !integer(player.distanceMetres) || player.distanceMetres !== player.walks * 2 || player.walks % 2 !== Number(player.location === 'SCREEN_END')) return false;
    if (x.residualStrength !== 30 - p.tests * 10 || p.tests - p.withdrawals !== Number(p.location === 'SHARD_CHAMBER')) return false;
    let open = 0, prepared = 0, resolved = 0;
    for (const [index, id] of DEMON_HUNTER_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, Object.keys(emptyCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'SUCCESS', 'FAILURE', 'INTERRUPTED'].includes(r.lastOutcome)) return false;
      if (![r.preparations, r.abilityPreparations, r.attempts, r.abilityAttempts, r.withdrawals, r.closes].every(n => integer(n)) || ![r.contactOpen, r.checkedSuccess, r.taskComplete, r.noiseMade].every(b => typeof b === 'boolean')) return false;
      if (r.attemptWeek !== null && !integer(r.attemptWeek, first, s.week) || (r.attemptWeek === null) !== (r.attempts === 0)) return false;
      if (r.preparations !== r.attempts + r.withdrawals + Number(r.status === 'PREPARED') || r.abilityPreparations > r.preparations || r.abilityAttempts > r.abilityPreparations || r.abilityAttempts > r.attempts || r.attempts !== r.closes + Number(r.contactOpen) || r.attempts > s.week - first + 1) return false;
      if (r.contactOpen && (r.attemptWeek !== s.week || r.method === null || !['OBSERVED', 'ACTIVE', 'EXAMINED'].includes(r.status))) return false;
      if (r.status === 'PREPARED' && (r.method === null || r.contactOpen || r.checkedSuccess || r.taskComplete || r.noiseMade || r.attemptWeek === s.week)) return false;
      if (r.status === 'ACTIVE' && (id !== 'tailored-coating' || r.method !== 'ABILITY' || !r.contactOpen || !r.checkedSuccess || r.taskComplete)) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.checkedSuccess || !r.taskComplete || r.lastOutcome !== 'SUCCESS' || r.method === null || r.attemptWeek === null)) return false;
      if (r.status === 'RESOLVED' && r.contactOpen || r.taskComplete && !r.checkedSuccess || r.lastOutcome === 'NONE' && r.attempts > 0 || r.lastOutcome === 'FAILURE' && r.checkedSuccess || r.lastOutcome === 'INTERRUPTED' && r.taskComplete) return false;
      if (r.noiseMade && id !== 'concealed-approach' || r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase())) return false;
      if (index > 0 && r.status !== 'AVAILABLE' && l.cases[DEMON_HUNTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(v => v === sourceFor(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(r.status === 'PREPARED'); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared) return false;
    const sample = l.cases['sealed-sample'], coating = l.cases['tailored-coating'], approach = l.cases['concealed-approach'];
    if (l.paidProtectionKits !== sample.preparations || l.reagentKits.length !== coating.abilityPreparations) return false;
    if (x.sootLid !== (sample.contactOpen ? 'OPEN' : 'CLOSED') || x.shardLid !== (sample.contactOpen || p.location === 'SHARD_CHAMBER' ? 'OPEN' : 'CLOSED')) return false;
    if (x.finding !== 'UNKNOWN' && !sample.checkedSuccess || sample.checkedSuccess && x.finding !== (sample.method === 'ABILITY' ? 'LIMITED_TRACE' : 'RECORDS_UNCERTAIN') || x.finding === 'RECORDS_UNCERTAIN' && !x.recordCompared) return false;
    if (p.location !== 'RACK' && (!coating.contactOpen || !coating.taskComplete || coating.method !== 'ABILITY')) return false;
    if (p.coatingKitId !== null && (!integer(p.coatingKitId, 1, l.reagentKits.length) || !coating.contactOpen || coating.status !== 'ACTIVE' || p.location !== 'RACK' || p.coatingKitId !== l.currentKitId)) return false;
    if (l.currentKitId !== null && (!integer(l.currentKitId, 1, l.reagentKits.length) || coating.method !== 'ABILITY' || !(coating.status === 'PREPARED' || coating.contactOpen))) return false;
    if ((coating.method === 'ABILITY' && (coating.status === 'PREPARED' || coating.contactOpen)) !== (l.currentKitId !== null)) return false;
    let used = 0, performed = 0, sealed = 0;
    for (const [index, kit] of l.reagentKits.entries()) {
      if (!record(kit) || !shape(kit, ['id', 'preparedWeek', 'performedWeek', 'targetId', 'doses', 'coatingProduced', 'coatingUsed', 'coatingDiscarded']) || kit.id !== index + 1 || kit.targetId !== 'DH4-SHARD-1' || !integer(kit.preparedWeek, first, s.week) || kit.performedWeek !== null && !integer(kit.performedWeek, kit.preparedWeek, s.week)) return false;
      if (!Array.isArray(kit.doses) || kit.doses.length !== 2 || ![kit.coatingProduced, kit.coatingUsed, kit.coatingDiscarded].every(b => typeof b === 'boolean')) return false;
      for (const [i, dose] of kit.doses.entries()) if (!record(dose) || !shape(dose, ['id', 'name', 'status']) || dose.id !== `DH4-REAGENT-${kit.id}-${i === 0 ? 'A' : 'B'}` || dose.name !== (i === 0 ? '暮星凝露（虚构G）' : '灰月印脂（虚构G）') || !['SEALED', 'SPENT', 'DISCARDED'].includes(dose.status)) return false;
      const status = kit.doses[0].status;
      if (kit.doses[1].status !== status || (status === 'SPENT') !== (kit.performedWeek !== null) || kit.coatingProduced && status !== 'SPENT' || kit.coatingUsed && (!kit.coatingProduced || kit.coatingDiscarded) || kit.coatingDiscarded && !kit.coatingProduced) return false;
      if (status === 'SEALED' && (l.currentKitId !== kit.id || coating.status !== 'PREPARED')) return false;
      const activeCoating = kit.coatingProduced && !kit.coatingUsed && !kit.coatingDiscarded;
      if (activeCoating !== (p.coatingKitId === kit.id) || kit.id === l.currentKitId && (coating.status === 'PREPARED' ? status !== 'SEALED' : status !== 'SPENT')) return false;
      used += Number(kit.coatingUsed); performed += Number(kit.performedWeek !== null); sealed += Number(status === 'SEALED');
    }
    if (used !== p.tests || performed !== coating.abilityAttempts || sealed > 1 || coating.taskComplete && coating.method === 'ABILITY' && p.tests !== 1) return false;
    if (m.cover !== (approach.contactOpen ? 'OPEN' : 'COVERED') || m.covers !== approach.closes || m.rustles > approach.attempts || m.alerts > approach.attempts || player.walks > approach.abilityAttempts * 2) return false;
    if (m.alerted && !approach.contactOpen || !approach.contactOpen && m.intentVeiled || approach.noiseMade && approach.contactOpen && !m.alerted) return false;
    if (player.location === 'SCREEN_END' && (!approach.contactOpen || approach.method !== 'ABILITY' || !approach.checkedSuccess || !m.intentVeiled)) return false;
    if (m.intentVeiled && (player.location !== 'SCREEN_END' || approach.method !== 'ABILITY' || !approach.checkedSuccess)) return false;
    if (approach.contactOpen && approach.lastOutcome === 'FAILURE' && !m.alerted || m.alerted && approach.taskComplete) return false;
    if (hasDemonHunterLifeLock(s) && (s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.combat || s.activeEvent)) return false;
    if (s.seer.completedSources.filter(v => v === 'demon-hunter-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3) return false;
    return promoted(s) ? ((s.progression.sequence===3||s.progression.sequence===2)?s.silverKnight.demonHunterActingAtPromotion:s.progression.acting) === resolved * 25 + Number(l.reflected) * 25 : stableStringify(l) === stableStringify(createDemonHunterLifeState());
  } catch { return false; }
}
