import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyRecorderEncounter, blockRecorderEncounter, RECORDER_ENCOUNTER_STORY } from './encounter.js';
import { RECORDER_SAMPLES } from './content.js';
import { RECORDER_CASE_IDS, RECORDER_INSTRUCTOR_IDS, RECORDER_SAMPLE_IDS, type RecorderCommand, type RecorderActivityCommand, type RecorderAction, type RecorderProjection, type RecorderSampleId } from './types.js';

const CASES = [
  {
    id: 'flash-screen', sample: 'FLASH', title: '不透光屏障后的原空靶',
    story: '诺拉·维恩的原教学室已经保留不透光屏障和明确标出的无人空靶。屏障保护旁观者，玩家处在安全观察位置。你可以释放一份自己此前亲见并成功记录的低强闪光，或仅检查原屏障和固定照明。观察现场不会赠送新的记录。（原创G）',
    facts: ['原屏障不透光，旁观者处在遮挡后，能力仅向明确空靶释放。', 'FLASH只能来自诺拉本人在原教学室实际付出灵性的示范与你的成功记录。', '每次释放恰好耗一份STORED记录和2灵性，失败也耗尽，不伤人、不回收记录。'],
    ability: '准备把一份原FLASH记录释放到原空靶；实施1行动、2灵性、知识14，失败也消耗该记录。',
    ordinary: '准备普通检查原屏障、空靶与固定照明；实施1行动、知识10、0灵性，不释放记录。',
    abilityResult: '你实际释放了有原示范来源的一份低强闪光，原空靶上的短光被观察到，旁观者仍由原不透光屏障保护；这一份记录已经RELEASED，不能再用。',
    ordinaryResult: '你以普通方法实际核查原屏障、空靶和固定照明，记录遮挡边界；没有施放闪光或获得任何能力记录。',
    abilityOutcome: 'FLASH_RELEASED', ordinaryOutcome: 'SCREEN_CHECKED',
    close: '你确认原空靶短光已经结束，停止本次试演或普通检查，从原普通出口离开；原屏障、空靶与固定灯留在原处。',
  },
  {
    id: 'courage-task', sample: 'COURAGE', title: '本人稳手完成的普通任务',
    story: '原教学室中有一项把原木块平稳放回原桌标记的普通任务。你可释放此前亲见萨芙·里恩自愿示范并成功记录的短句鼓舞，只鼓舞你自己；也可通过普通呼吸、停顿和核对手势完成任务。没有要求朋友接受影响。（原创G）',
    facts: ['萨芙·里恩是明确同意示范的原创成年序列9歌颂者，真实示范须单独付行动观看并记录。', '本项释放对象只有玩家本人，不默认朋友同意、不控制别人或保证说服。', '短暂鼓舞不治疗、回满灵性或永久改变性格；原木块最后留回原桌，不成为奖励。'],
    ability: '准备消耗一份原COURAGE记录，只对自己施加有限鼓舞以完成普通稳手任务；实施1行动、2灵性、知识14。',
    ordinary: '准备普通停顿、调整手势并核对原桌标记；实施1行动、知识10、0灵性，不释放记录。',
    abilityResult: '你向自己实际释放了一份原COURAGE记录，短暂振作后亲手把同一原木块平稳放回原桌标记；不影响旁人、不治疗，记录已耗尽。',
    ordinaryResult: '你通过普通停顿和手势核对，亲手把原木块平稳放回原桌标记；没有施放鼓舞，原木块仍归原主人。',
    abilityOutcome: 'COURAGE_RELEASED', ordinaryOutcome: 'TASK_CHECKED',
    close: '你实际停止鼓舞或普通练习，确认短效结束并将原木块留回原桌，沿原出口离开；不延长示范者或他人的同意。',
  },
  {
    id: 'missing-source', sample: null, title: '没有亲见来源的高阶记录',
    story: '原导师出示一则尚无可核实现场的高阶能力记录传闻。这里没有施术者、真实示范或可用原记录，空置的中序列与半神容量不能填补证据。你只能普通核对边界、拒绝假装已经记录，并实际退出本次查阅。（原创G）',
    facts: ['未亲见实际能力，传闻和空槽都不能变成STORED记录。', '没有序列5旅行示范，也没有已记录旅行；记录官不会自带任意旅行。', '一次已记录能力释放后即耗尽，单份旅行用掉不能据此保证返回；本段仅核对这一限制。'],
    ability: '没有真实亲见来源，不能准备未知高阶能力。',
    ordinary: '准备核对导师提供的有限传闻与已知记录限制，明确拒绝虚构来源；实施1行动、知识10、0灵性。',
    abilityResult: '',
    ordinaryResult: '你实际核对了记录必须亲见与用后耗尽的限制，明确写下“没有可核实高阶示范，未记录未知能力”，并保留原普通出口；没有获得旅行、中序列或半神记录。',
    abilityOutcome: 'LIMIT_REVIEWED', ordinaryOutcome: 'LIMIT_REVIEWED',
    close: '你将原传闻页放回导师原桌，结束本次查阅并从原普通出口实际退出，不以未知旅行离开。',
  },
] as const;

export const RECORDER_ENVIRONMENT = '原教学室、成年示范者与各项数值为原创G。亲到原教学室付1行动，观看原教师当次实际示范并尝试记录：教师耗2灵性，玩家耗3灵性，知识14；每样本每真实周只尝试一次，成功才增加一份有原demo来源的STORED记录。两位教师各有限池20，只有下次付行动亲访时按真实间隔每周恢复2、最多20；点击或读档不回满。记录持久保留直到实际RELEASED，没有每日过期或免费高阶记录。三案观察1行动、准备1行动、实施1行动；前两案能力实施耗一份匹配原记录和2灵性、知识14，普通方法知识10、0灵性。第三案仅普通核对。实施成败都须0行动明确停止并从原出口离开；失败照耗，下周再试。每案报告25扮演与单项掌握8，三案反思25，可全普通和平100。 ' + RECORDER_ENCOUNTER_STORY;
export const recorderInside = (s: SliceState) => Object.values(s.recorder.cases).some(r => r.contactOpen);
export const isRecorderActivity = (c: RecorderCommand): c is RecorderActivityCommand => ['RECORD', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is RecorderActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (c.type === 'RECORD') return shape(c, ['type', 'sample']) && RECORDER_SAMPLE_IDS.includes(c.sample as RecorderSampleId);
  if (!RECORDER_CASE_IDS.includes(c.caseId as typeof RECORDER_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
const storedSample = (s: SliceState, sample: RecorderSampleId) => s.recorder.records.find(r => r.sample === sample && r.status === 'STORED');
function blocked(s: SliceState, c: RecorderActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockRecorderEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'door' || (s.progression.sequence !== 6 && !((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))&&c.type==='RECORD'))) return '先完成记录官晋升；旅行家只继续亲见记录，不重复旧课奖励。';
  const p = 'caseId' in c ? CASES.find(p => p.id === c.caseId) : null;
  const r = p ? s.recorder.cases[p.id] : null;
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen) return '没有尚未结束的本次接触。';
    return s.activeEvent || s.combat || s.world.city !== 'BACKLUND' ? '本次原现场位置不符，不能以结束接触瞬移。' : null;
  }
  if (recorderInside(s)) return '先0行动停止本次试演或查阅，并从原出口实际离开。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德诺拉·维恩的原教学室。';
  if (Object.values(s.apprentice.cases).some(x => x.position === 'INSIDE')) return '先从原门内实际返回。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.recorder.cases).some(([id, x]) => x.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'RECORD') {
    if (s.recorder.lastAttemptWeek[c.sample] === s.week) return '这个样本本周已经实际示范并尝试记录，下一真实周再亲访。';
    if (s.recorder.records.filter(x => x.status === 'STORED').length >= 20) return '低序列20个记录位已经用满，必须实际释放原记录后才有空位。';
    if (s.spirituality < 3) return '亲见记录需要玩家实际支付3灵性。';
    const actor = s.recorder.instructorSpirituality[RECORDER_SAMPLES[c.sample].actor];
    const rested = Math.min(20, actor.spirituality + Math.max(0, s.week - (actor.restWeek ?? s.recorder.promotionWeek ?? s.week)) * 2);
    return rested < 2 ? '原教师本次可用灵性不足2，须等待真实周恢复后再亲访。' : null;
  }
  if (c.type === 'REFLECT') return s.recorder.reflected ? '已经回看这段经历。' : CASES.some(p => s.recorder.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!p || !r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场观察已经保留。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先实际观察本项原现场。';
    if (r.attemptWeek === s.week) return '本周实施结果保留，下一真实周再依原观察准备。';
    if (c.method === 'ABILITY' && !p.sample) return '没有可亲见的高阶示范来源，只能普通核对限制。';
    return c.method === 'ABILITY' && p.sample && !storedSample(s, p.sample) ? '没有匹配的STORED原记录，先亲见原教师实际示范并成功记录，或选择普通方法。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触离开。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.method === 'ABILITY') {
    if (!p.sample || !storedSample(s, p.sample)) return '本次释放必须仍持有一份匹配的STORED原记录。';
    if (s.spirituality < 2) return '本次释放需要2灵性，可取消后选择普通方法。';
  }
  return null;
}
export function applyRecorderActivity(s: SliceState, c: RecorderActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('记录官实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyRecorderEncounter(s, c, ctx); return; }
  const m = s.recorder;
  if (c.type === 'CLOSE') {
    const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际停止本次试演并离开', '0行动。' + p.close + '本次结果、已释放原记录与已付成本均保留，不返资源、不治疗或增加扮演。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.releasedRecordId = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察与已付行动保留；本次尚未释放或消耗记录，不擦除更早的实际释放历史。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'RECORD') {
    const sample = RECORDER_SAMPLES[c.sample], actor = m.instructorSpirituality[sample.actor];
    actor.spirituality = Math.min(20, actor.spirituality + Math.max(0, s.week - (actor.restWeek ?? m.promotionWeek ?? s.week)) * 2) - 2;
    actor.restWeek = s.week; s.spirituality -= 3; m.lastAttemptWeek[c.sample] = s.week;
    const result = ctx.check('knowledge', 14), success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
    const demo = { id: `recorder-demo-${m.demonstrations.length + 1}`, sample: c.sample, actor: sample.actor, week: s.week, revision: s.revision + 1, success };
    m.demonstrations.push(demo);
    if (success) m.records.push({ id: `recorder-record-${m.records.length + 1}`, sample: c.sample, sequence: sample.sequence, status: 'STORED', sourceDemoId: demo.id, createdWeek: s.week, releasedWeek: null });
    ctx.note(success ? '亲见本次实际示范并成功记录' : '原示范已见，记录仍失败', `你花费1行动实际来到原教学室的已确认安全观察位。${sample.source}原教师在这次真实示范支出2灵性，当前${actor.spirituality}/20；你支出3灵性，以脑海与灵体尝试记录，知识14判定${success ? '成功，新增一份唯一STORED原记录' : '失败，没有新增记录'}。原示范${demo.id}、第${s.week}周、版本${demo.revision}与实际结果保留。示范者停止短效，你结束观看并从原普通出口离开；不产生持续接触，行动与灵性不返还，不增加扮演或掌握。这个样本下一真实周才能再次亲访。`); return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('recorder-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('记录有来源，释放有尽头', '回看亲见示范、一次原记录释放与拒绝虚构高阶来源。G扮演+25；容量只是上限，不是能力库存，普通核查也可完成和平100。记录用完不能承诺原路旅行返回。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '实际观察后离开，没有观看新能力示范、获得记录或打开持续接触。'); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; r.releasedRecordId = null; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`recorder-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次已实际停止并离开，报告G扮演+25、原规则单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    const original = storedSample(s, p.sample!)!;
    original.status = 'RELEASED'; original.releasedWeek = s.week; r.releasedRecordId = original.id; s.spirituality -= 2;
    ctx.note('一份原记录实际耗尽', `仅${original.id}从STORED变为RELEASED，原示范${original.sourceDemoId}保留；另支出2灵性。无论本次作用成功或失败都不返还，不从其它样本补位。`);
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次接触尚须0行动实际停止并从原出口离开，之后才能报告。');
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, `本次实施未取得可报告结果，原观察保留。1行动${r.method === 'ABILITY' ? '、2灵性和这一份原记录已经实际耗尽' : '已经支出，未消耗灵性或记录'}；先0行动停止并从原出口离开，下一真实周再准备，不增加扮演或掌握。`);
  }
}
export function recorderActions(s: SliceState): RecorderAction[] {
  if (s.progression.pathwayId !== 'door' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&(s.progression.sequence!==4&&s.progression.sequence!==3))) return [];
  const out: RecorderAction[] = [];
  const add = (id: string, label: string, cost: string, command: RecorderActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const sample of RECORDER_SAMPLE_IDS) add(`recorder-record-${sample.toLowerCase()}`, `亲访${RECORDER_SAMPLES[sample].name}观看并记录${RECORDER_SAMPLES[sample].label}`, '1行动 · 玩家3灵性 · 原教师2灵性 · 知识14 · 每样本每真实周一次', { type: 'RECORD', sample });
  for (const p of CASES) {
    const r = s.recorder.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际停止本次试演并从原出口离开', '0行动 · 原物留原处 · 消耗不返还', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '实际观察本项原现场', '1行动 · 不赠送能力记录', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.sample) add(p.id + '-ability', '准备释放一份匹配原记录', '1行动 · 需STORED原记录 · 实施另耗2灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.sample ? '准备原现场普通方法' : '准备普通核对并拒绝虚构来源', '1行动 · 实施不耗灵性或记录', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', r.method === 'ABILITY' ? '实际释放一份原记录' : '实际完成原现场普通核对', r.method === 'ABILITY' ? '1行动 · 2灵性 · 耗一份原记录 · 知识14 · 失败照耗' : '1行动 · 知识10 · 0灵性', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 不返准备成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告有限结果与实际离开', '1行动 · 结束本次接触后', { type: 'REPORT', caseId: p.id });
  }
  if (!s.recorder.reflected) add('recorder-reflect', '回看来源、消耗与记录边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.recorder.encounter.status === 'AVAILABLE') {
    add('recorder-encounter-talk', '前往原教学室外空院并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('recorder-encounter-fight', '前往原教学室外空院并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?out.filter(a=>a.command.type==='RECORD'):out;
}
export function recorderCases(s: SliceState): RecorderProjection['cases'] {
  if (s.progression.pathwayId !== 'door' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&(s.progression.sequence!==4&&s.progression.sequence!==3))) return [];
  return CASES.map(p => {
    const r = s.recorder.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status)
      ? (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + (r.contactOpen ? ' 尚须实际停止并从原出口离开。' : ' 随后' + p.close)
      : r.attemptWeek !== null ? '此前实施未成，实际消耗与原观察保留；不能复原已释放记录。' : r.withdrawals ? '尚未实施的准备已取消，原观察保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次试演或查阅仍须明确停止并离开' : '没有尚未结束的本次接触', closes: r.closes };
  });
}

/** Validate actual local demonstrations, unique one-use records, and the three small case transitions. */
export function validateRecorderLife(s: SliceState): boolean {
  const m = s.recorder;
  if (!record(m) || !record(m.cases) || !shape(m.cases, RECORDER_CASE_IDS) || !Array.isArray(m.records) || !Array.isArray(m.demonstrations) || !record(m.lastAttemptWeek) || !shape(m.lastAttemptWeek, RECORDER_SAMPLE_IDS) || !record(m.instructorSpirituality) || !shape(m.instructorSpirituality, RECORDER_INSTRUCTOR_IDS) || !Array.isArray(s.seer.completedSources) || !s.seer.completedSources.every(x => typeof x === 'string') || typeof m.reflected !== 'boolean') return false;
  const isPromoted = s.progression.pathwayId === 'door' && (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  const pools = { NORA: { spirituality: 20, restWeek: null as number | null }, SAFF: { spirituality: 20, restWeek: null as number | null } };
  const last = { FLASH: null as number | null, COURAGE: null as number | null };
  let successes = 0, previousRevision = -1;
  for (const [index, demo] of m.demonstrations.entries()) {
    if (!record(demo) || !shape(demo, ['id', 'sample', 'actor', 'week', 'revision', 'success']) || demo.id !== `recorder-demo-${index + 1}` || !RECORDER_SAMPLE_IDS.includes(demo.sample) || typeof demo.success !== 'boolean') return false;
    const sample = RECORDER_SAMPLES[demo.sample];
    if (!sample || demo.actor !== sample.actor || !integer(demo.week, m.promotionWeek ?? s.week, s.week) || !integer(demo.revision, 1, s.revision) || demo.revision <= previousRevision || last[demo.sample] !== null && demo.week <= last[demo.sample]!) return false;
    previousRevision = demo.revision;
    const actor = pools[demo.actor];
    actor.spirituality = Math.min(20, actor.spirituality + (demo.week - (actor.restWeek ?? m.promotionWeek ?? demo.week)) * 2) - 2;
    actor.restWeek = demo.week; last[demo.sample] = demo.week;
    if (actor.spirituality < 0) return false;
    if (demo.success) successes += 1;
  }
  for (const id of RECORDER_INSTRUCTOR_IDS) {
    const actor = m.instructorSpirituality[id], expected = pools[id];
    if (!record(actor) || !shape(actor, ['spirituality', 'restWeek']) || actor.spirituality !== expected.spirituality || actor.restWeek !== expected.restWeek) return false;
  }
  if (RECORDER_SAMPLE_IDS.some(id => m.lastAttemptWeek[id] !== last[id]) || m.records.length !== successes) return false;
  const successfulDemos = m.demonstrations.filter(demo => demo.success);
  for (const [index, item] of m.records.entries()) {
    if (!record(item) || !shape(item, ['id', 'sample', 'sequence', 'status', 'sourceDemoId', 'createdWeek', 'releasedWeek']) || item.id !== `recorder-record-${index + 1}` || !RECORDER_SAMPLE_IDS.includes(item.sample)) return false;
    const demo = successfulDemos[index]!;
    if (item.sourceDemoId !== demo.id || item.sample !== demo.sample || item.sequence !== RECORDER_SAMPLES[item.sample].sequence || item.createdWeek !== demo.week) return false;
    if (item.status === 'STORED') { if (item.releasedWeek !== null) return false; }
    else if (item.status !== 'RELEASED' || !integer(item.releasedWeek, item.createdWeek, s.week)) return false;
  }
  if (m.records.filter(item => item.status === 'STORED').length > 20 || !isPromoted && (m.records.length > 0 || m.demonstrations.length > 0)) return false;
  let open = 0, prepared = 0, resolved = 0;
  const usedCaseRecords = new Set<string>();
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'releasedRecordId'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string) || r.method === 'ABILITY' && !p.sample) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `recorder-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    const successful = ['EXAMINED', 'RESOLVED'].includes(r.status as string);
    if (successful) {
      if (r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome)) return false;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week || r.releasedRecordId !== null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.releasedRecordId !== null)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (r.releasedRecordId !== null) {
      if (typeof r.releasedRecordId !== 'string' || usedCaseRecords.has(r.releasedRecordId) || r.method !== 'ABILITY' || r.attemptWeek === null) return false;
      const item = m.records.find(item => item.id === r.releasedRecordId);
      if (!item || item.sample !== p.sample || item.status !== 'RELEASED' || item.releasedWeek !== r.attemptWeek) return false;
      usedCaseRecords.add(r.releasedRecordId);
    } else if (r.method === 'ABILITY' && (successful || r.contactOpen || r.status === 'OBSERVED' && r.attemptWeek !== null)) return false;
    if (!isPromoted && (r.status !== 'AVAILABLE' || r.attemptWeek !== null || r.method !== null || r.outcome !== 'NONE' || r.contactOpen || r.closes !== 0 || r.withdrawals !== 0 || r.releasedRecordId !== null)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.some(x => x.startsWith('recorder-case:') && !RECORDER_CASE_IDS.some(id => x === `recorder-case:${id}`))) return false;
  if (s.seer.completedSources.filter(x => x === 'recorder-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!isPromoted && m.reflected || isPromoted && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.traveler.recorderActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
