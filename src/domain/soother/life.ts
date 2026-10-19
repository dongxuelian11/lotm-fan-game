import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applySootherEncounter, blockSootherEncounter, SOOTHER_ENCOUNTER_STORY } from './encounter.js';
import { SOOTHER_CASE_IDS, type SootherCommand, type SootherActivityCommand, type SootherAction, type SootherProjection } from './types.js';

const BOUNDARY = '原旧值班室的残影呈现过强的恐惧烙印；本次不能由你单独消除。第一次有限接触实际到此为止，不抽成功骰，不把声响或残影视为已经净化。';
const NEW_FACT = '你与原导师赛琳当场约好：下一真实周仍回这间原值班室，只比较原门窗声响与有限残影的变化，发现过强部分便停止，不承诺消除。';
const REVISION = '下一真实周你与原导师按约回到原旧值班室，将原目标改为有限对照：能力方法只看见并缓和后记录，普通方法只检查原门窗与窗扣；过强烙印保持未知与未清除。';
const CASES = [
  {
    id: 'restless-wolf', title: '废弃犬舍边的野狼幽魂',
    story: '原废弃犬舍近处有一只躁动的野狼幽魂，你可以直接看见它。成年守门人与原导师赛琳留在已确认的安全外侧，不靠近幽魂；普通退路仍在。它不是可领取的战利品，也没有人要求你把它消灭。（原创G）',
    facts: ['本次只涉及犬舍近处这只可见野狼幽魂，不增加其它灵体。', '守门人与赛琳实际留在安全外侧，退路没有被封住。', '安抚可能失败；普通隔离绕开也能留下有限观察，不能写成施过安抚。'],
    ability: '准备只安抚这只野狼幽魂，实施另耗3灵性，意志难度14；不封灵、不许诺净化或战利品。',
    ordinary: '准备沿原安全外侧隔离绕开，记录这只幽魂的可见行为，不施加安抚。',
    abilityResult: '这只野狼幽魂的躁动已平静。范围仅限眼前这一只，没有毁灭灵体、生成物品或净化其它污染。',
    ordinaryResult: '你沿原安全外侧隔离绕开并记下这只幽魂的有限行为。没有施加安抚，不能断言它已平静或消散。',
    abilityOutcome: 'WOLF_PACIFIED', ordinaryOutcome: 'WOLF_OBSERVED',
    abilityClose: '你停止进一步作用，实际观察这只已经平静的野狼幽魂自行淡去，再沿原安全外侧离开；没有把它收进体内或留下战利品。',
    ordinaryClose: '你结束普通观察并沿原安全外侧实际离开，守门人与赛琳仍保留退路；幽魂没有被你安抚、消灭或收走。',
  },
  {
    id: 'echo-at-wall', title: '旧值班室墙边的回声',
    story: '原旧值班室传来声响，近墙处只有有限残影。第一次接触会明确遇到无法独自消除的过强恐惧烙印；原导师赛琳会与你约好下周回原地做有限对照。声音并不自动证明灵体说了什么，报告必须保留未知。（原创G）',
    facts: ['本次声响、有限残影与原门窗是不同证据，不把一项自动当作另一项。', '原门窗与窗扣保持原位，普通方法可以实际检查。', '强烈恐惧烙印可能只能缓和，原导师不会替你宣告全部净化。'],
    ability: '准备看见近墙灵体并尝试有限缓和，实施另耗3灵性；第一次必定触及过强边界，不能单独消除，不抽成功骰。',
    ordinary: '准备普通声源核对；第一次同样先面对无法独自消除的过强残影，停止并约定下周的原门窗对照。',
    abilityResult: '你在原导师约定的有限对照中看见近墙灵体，缓和其当前躁动后记下有限变化；强烈恐惧烙印未被单独清除，声响原因和未获回应的部分仍有未知。',
    ordinaryResult: '你实际检查原门窗，确认这一阵可核对的响声来自风动原窗扣。这个普通声源结论没有解释全部残影，也没有施加安抚或宣布净化。',
    abilityOutcome: 'ECHO_COMPARED', ordinaryOutcome: 'WINDOW_CHECKED',
    abilityClose: '你停止对近墙灵体的进一步作用，与原导师实际退离原旧值班室。缓和记录保留，过强烙印没有被宣告消除。',
    ordinaryClose: '你停止原门窗检查，与原导师实际退离原旧值班室；原窗扣和残影留在原处，不把风动声源结论扩大为净化。',
  },
  {
    id: 'remembered-name', title: '小庭里被记住的称呼',
    story: '成年家属莉娅自愿在原小庭追忆，只同意谈自己选择的一段往事。附近徘徊的灵只回应有限称呼，不交出完整死亡真相；是否继续由莉娅本人决定，最后她会亲口要求停止。（原创G）',
    facts: ['莉娅本人只同意这次有限追忆，未同意被治疗、追问全部私事或交出决定。', '附近徘徊灵只回应有限称呼；回应不能证明全部身份或死亡经过。', '莉娅最后亲口决定停止，任何方法都须结束接触并实际离开。'],
    ability: '在莉娅本次明确同意范围内，准备看见近处徘徊灵并有限平复，实施另耗3灵性；不追索完整死亡真相。',
    ordinary: '准备普通陪伴与记录，只写莉娅愿意说的称呼与往事，不施加安抚或声称得知灵体秘密。',
    abilityResult: '莉娅同意的有限接触中，附近徘徊灵的躁动得到平复，仅留下对有限称呼的回应。莉娅本人随后说到这里为止，没有得到完整死亡真相或医疗保证。',
    ordinaryResult: '你普通陪伴莉娅，记录她自愿说出的有限称呼与往事。莉娅本人随后决定到这里为止；没有施加灵体安抚，也未取得完整死亡真相。',
    abilityOutcome: 'NAME_PACIFIED', ordinaryOutcome: 'NAME_RECORDED',
    abilityClose: '依莉娅本人停止的决定，你实际停止进一步安抚与追问，结束接触并离开原小庭；没有封存或带走徘徊灵。',
    ordinaryClose: '依莉娅本人停止的决定，你结束普通陪伴与记录并实际离开原小庭，未延长她的同意或追问其它私事。',
  },
] as const;
export const SOOTHER_ENVIRONMENT = '能看见近处实际灵体，安抚可被抵抗且不等于净化；强烈恐惧烙印不能凭一次接触全部清除。三案分别处理原犬舍野狼幽魂、旧值班室有限残影与风动窗扣、成年莉娅自愿追忆，普通方法有独立有限结果。第二案首次确定触及过强边界，不抽成功骰，约好下一真实周与原导师在原处对照。每次实施都须0行动实际停止接触并离开，失败也不退3灵性。每案报告G扮演+25、原规则单项掌握+8，三案后反思+25；无序列5封灵或放灵助攻。全部事件和数值为原创G。 ' + SOOTHER_ENCOUNTER_STORY;
export const sootherInside = (s: SliceState) => Object.values(s.soother.cases).some(r => r.contactOpen);
export const isSootherActivity = (c: SootherCommand): c is SootherActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join('|') === keys.sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is SootherActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!SOOTHER_CASE_IDS.includes(c.caseId as typeof SOOTHER_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: SootherActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockSootherEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 6) return '先完成安魂师晋升。';
  const r = 'caseId' in c ? s.soother.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次接触。';
  if (sootherInside(s)) return '先0行动结束本次接触并实际离开。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到原导师赛琳联络的贝克兰德原现场。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.soother.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.soother.reflected ? '已经回看这段经历。' : CASES.some(p => s.soother.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '当前现场与边界观察已经保留。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场、有限范围与退出边界。' : r.attemptWeek === s.week ? '本周结果保留，下周再依已核事实重新准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触离开。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力实践需要3灵性；可取消准备后选择普通方法。' : null;
}
export function applySootherActivity(s: SliceState, c: SootherActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('安魂师实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applySootherEncounter(s, c, ctx); return; }
  const m = s.soother;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!, p = CASES.find(p => p.id === c.caseId)!;
    r.contactOpen = false; r.closes += 1;
    const success = r.status === 'EXAMINED';
    const ending = success ? r.method === 'ABILITY' ? p.abilityClose : p.ordinaryClose
      : p.id === 'remembered-name' ? '莉娅本人说到这里为止。你依她的决定实际停止本次安抚或普通陪伴，结束追问并离开原小庭；未取得死亡真相。'
        : p.id === 'echo-at-wall' ? '你与原导师实际停止本次进一步作用或观察并退离原旧值班室。过强残影没有被消除；已约下周的有限对照与第一次边界记录保留。'
          : '你实际停止进一步作用或普通观察，沿原安全外侧离开犬舍。未成功安抚的幽魂没有被消灭、收走或宣告消散；守门人和导师仍在安全外侧。';
    ctx.note('实际结束本次接触并离开', '0行动。' + ending + '已付行动与灵性、原观察和修订记录保留，不返资源、不治疗、不清除排异、不再抽奖。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消这次准备，原观察、已付行动、过强残影边界与修订依据仍保留。未施加新作用或延长本人同意。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('soother-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('平静之外仍有未知', '回看野狼幽魂、旧值班室有限对照与莉娅的称呼。G扮演+25；看见不等于全知，安抚不等于净化，普通查证与本人停止同样构成有限帮助。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'echo-at-wall' && r.notes.includes(BOUNDARY) && !r.revised) { r.revised = true; r.notes.push(REVISION); ctx.note('与原导师按约准备有限对照', REVISION); }
    ctx.note(p.title, r.revised ? REVISION + (c.method === 'ABILITY' ? '本次另耗3灵性，只看见灵体并有限缓和后记录。' : '本次仅用普通方法实际检查原门窗。') : c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`soother-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult + p.abilityClose : p.ordinaryResult + p.ordinaryClose) + '本次已实际离开现场，G扮演+25、原规则单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') { s.spirituality -= 3; ctx.note('有限安抚的实际成本', '本次3灵性已经支出；范围、抵抗与本人同意仍有效，不保证成功，不能清除全部污染。'); }
  if (p.id === 'echo-at-wall' && !r.notes.includes(BOUNDARY)) {
    r.status = 'OBSERVED'; r.notes.push(BOUNDARY, NEW_FACT);
    ctx.note('过强残影划出的实际边界', BOUNDARY + ' ' + NEW_FACT + '本次不抽成功骰。先0行动结束接触离开，下一真实周再作约定对照。'); return;
  }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次接触尚须0行动停止并实际离开，之后才能报告。');
  } else {
    r.status = 'OBSERVED'; if (result.tier === 'GREAT_FAILURE') s.mind = Math.max(0, s.mind - 5);
    const failure = p.id === 'restless-wolf' ? '本次未取得可报告的平静或有限观察；幽魂没有被消灭或赠予任何物品。'
      : p.id === 'echo-at-wall' ? '本次有限对照尚不足以报告，过强残影与第一次边界仍保留；没有宣告净化。'
        : '本次未取得足够的有限记录；莉娅本人决定停止，不能强迫继续，也没有完整死亡真相。';
    ctx.note(p.title, failure + (result.tier === 'GREAT_FAILURE' ? '额外疲劳，精神损失至多5。' : '') + '先实际结束接触离开，下周可在原边界内重试。');
  }
}
export function sootherActions(s: SliceState): SootherAction[] {
  if (s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 6) return [];
  const out: SootherAction[] = [];
  const add = (id: string, label: string, cost: string, command: SootherActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.soother.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际结束本次接触并离开', '0行动 · 保留原事实与未解部分', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原现场、有限范围与停止边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      const revised = p.id === 'echo-at-wall' && r.notes.includes(BOUNDARY);
      add(p.id + '-ability', revised ? '按约准备有限灵体对照' : '准备本次有限安抚', '1行动 · 实施另耗3灵性 · 可被抵抗', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', revised ? '按约准备原门窗普通查证' : '准备本次普通方法', '1行动 · 不声称施加安抚', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', '实际进行本次有限接触', r.method === 'ABILITY' ? '1行动 · 3灵性 · 仍可能失败' : '1行动 · 普通方法', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 不重置原边界', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告有限结果与未知范围', '1行动', { type: 'REPORT', caseId: p.id });
  }
  if (!s.soother.reflected) add('soother-reflect', '回看平静、未解残影与本人停止的边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.soother.encounter.status === 'AVAILABLE') {
    add('soother-encounter-talk', '前往原夜间空院并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('soother-encounter-fight', '前往原夜间空院并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function sootherCases(s: SliceState): SootherProjection['cases'] {
  if (s.progression.pathwayId !== 'darkness' || ![6, 5, 4, 3, 2].includes(s.progression.sequence ?? 0)) return [];
  return CASES.map(p => {
    const r = s.soother.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status)
      ? (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + (r.contactOpen ? ' 尚须停止接触并实际离开。' : r.method === 'ABILITY' ? p.abilityClose : p.ordinaryClose)
      : r.notes.includes(BOUNDARY) ? BOUNDARY + (r.revised ? ' 原目标已修订为有限对照，仍须实际评估。' : ' 下一真实周按约与原导师对照。')
        : r.attemptWeek !== null ? '此前接触未成，已付成本、抵抗和未知保留。' : r.withdrawals ? '尚未实施的准备已取消。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...r.notes], preparation: r.status === 'PREPARED' ? r.revised ? REVISION + (r.method === 'ABILITY' ? ' 另耗3灵性。' : ' 仅作原门窗普通查证。') : r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触仍须停止并实际离开' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
/** Exact authored boundaries and independent ordinary outcomes; no general spirit subsystem. */
export function validateSootherLife(s: SliceState): boolean {
  const m = s.soother;
  if (!record(m) || !record(m.cases) || !shape(m.cases, [...SOOTHER_CASE_IDS]) || !Array.isArray(s.seer.completedSources)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'revised'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean' || typeof r.revised !== 'boolean' || !Array.isArray(r.notes)) return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `soother-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) {
      if (r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome)) return false;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.notes.length || r.revised)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.notes.length)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (p.id === 'echo-at-wall') {
      const expected = r.attemptWeek === null ? [] : r.revised ? [BOUNDARY, NEW_FACT, REVISION] : [BOUNDARY, NEW_FACT];
      if (JSON.stringify(r.notes) !== JSON.stringify(expected) || r.revised && (r.attemptWeek === null || r.closes < 1)) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status as string) && !r.revised) return false;
    } else if (r.notes.length !== 0 || r.revised) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.filter(x => x === 'soother-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'darkness' && s.progression.sequence === 6 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
