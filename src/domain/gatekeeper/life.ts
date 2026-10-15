import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyGatekeeperEncounter, blockGatekeeperEncounter, GATEKEEPER_ENCOUNTER_STORY } from './encounter.js';
import { GATEKEEPER_SPIRIT_FEE } from './content.js';
import { GATEKEEPER_CASE_IDS, type GatekeeperCaseId, type GatekeeperCommand, type GatekeeperActivityCommand, type GatekeeperAction, type GatekeeperProjection } from './types.js';

const CASES = [
  {
    id: 'resting-place', title: '同一个灰羽的新短驻约定',
    story: '成年导师伊芙琳·沃斯在贝克兰德原纪念工作室，指出旧获准记录中的同一个弱小鸟形灵灰羽（SG6-GRAY-FEATHER），现正在原栖架休息。本次体内小冥界短驻与协助须由灰羽本人另行自愿答应；旧一次递信约定与旧信位置照原记录保留。晋升不附赠灵，也不能把旧约定延长成新权限。（原创G）',
    facts: ['体内小冥界依附你的原身体，本场容量限同一个原灰羽；没有另造新灵或自动取得灵体技能库。', '先观察来源，再另花1行动、3灵性、知识14邀请；成功答应本次短驻与有限协助才实付12便士并实际进入。失败不入驻、不收费，本周不再邀请。', '本案能力只在灰羽已实际入驻后，耗2灵性、意志14核对有限休息与自愿回应；不是不可逃出的高位灵监牢。', '停止本次交谈后灰羽仍在原体内休息，可正常生活；若要离开，须0行动在原工作室栖架实际释放。'],
    ability: '准备与已经另行自愿入驻的同一个灰羽作有限交流，核对它在原体内小冥界的短暂休息与自愿回应；实施2灵性、意志14，不派出或转移身体。',
    ordinary: '准备普通核对原导师获准记录、灰羽来源和本次短驻条款；实施知识10、0灵性，不邀请、不入驻，也不假称听见灵体回应。',
    abilityResult: '原灰羽仍在你的原体内小冥界，实际作出有限自愿回应；你核对了本次短暂休息。没有派出它、读取未知真相或把高位灵强行囚禁。',
    ordinaryResult: '你普通核对了原导师记录、同一个灰羽的来源与另立约定的必要性；没有邀请、入驻或冒称能力交流。',
    failure: '本次有限交流或记录核对尚不足以报告；已经入驻的灰羽仍在原体内休息，没有自动离开或被复制。',
    outcome: 'RESTING_CHECKED', spirit: 2, abilityStat: 'will',
  },
  {
    id: 'shared-task', title: '同一枚木标记的两米交接',
    story: '原导师将自己所有的新原木标记GK5-MARKER-1放在工作室原桌。相邻两米桌旁的成年原看守本人同意接收、保管并亲手返还这枚标记。它与旧一次递信使用的原封信是两件不同原物；旧信继续留在旧收件人处，不取回、不复制、不改写旧历史。（原创G）',
    facts: ['GK5-MARKER-1只有一枚，始终归原导师；两桌之间是可正常步行的原净空两米路径。', '能力须使用本次另行自愿入驻的同一个灰羽，3灵性、知识14；成功才实际携原标记两米交付，失败标记仍在DESK，灰羽仍须召回。', '普通方法由你本人实际步行两米亲手交付并走回，包含在实施1行动内；随后核对失败也保留真实交付。', '关闭接触或召回只召回灰羽，不移动原标记；须0行动本人走到原看守处，由他亲手交还同一枚原标记后再走回原桌。'],
    ability: '准备派出另立约定且已实际入驻的原灰羽，沿两米原净空路径携同一枚木标记到原看守桌；实施3灵性、知识14，失败没有交付。',
    ordinary: '准备本人沿两米原普通路径亲手交付同一枚木标记再走回；实施1行动包含实际去回，知识10核对失败也不撤销已交付的原物。',
    abilityResult: '同一个原灰羽实际离开你的体内小冥界，沿原两米路径把GK5-MARKER-1交给同意的成年原看守。原物在RECIPIENT，所有权未变；没有复制、遥距传送或挪用旧信。',
    ordinaryResult: '你本人实际步行两米，把同一枚GK5-MARKER-1亲手交给原看守并走回原桌，完成普通核对。没有派灵或改变原物所有权。',
    failure: '本次交接核对尚不足以报告。普通方法已发生的真实交付保留；能力失败则标记仍在原桌，实际派出的灰羽仍须召回。',
    outcome: 'TASK_CHECKED', spirit: 3, abilityStat: 'knowledge',
  },
  {
    id: 'controlled-threshold', title: '原空壁龛中的有限冥界门',
    story: '原导师在工作室说明已知普通走廊尽头十米外的私有空壁龛及实际去回安排。原固定布条GK5-CLOTH-1牢固系在原锚点上；三米G试验范围没有其他灵、同伴或散落贵重物。先让灰羽实际回到原工作室栖架，实施时你本人沿原走廊步行十米到壁龛；结束时再沿原路走回。（原创G）',
    facts: ['观察与准备只核对原记录和去回计划；你的原身体尚在工作室，只有实施才实际步行十米到原空壁龛。', '灰羽须在原工作室栖架，距离试验位置十米；原木标记须在DESK，不携入试验范围。', '能力耗4灵性、意志14，在当前位置打开有限小冥界门，只比较三米内原固定布条受牵引后的微小偏移；原锚点承受拉力。', '冥界门有吸引与可抵抗边界，并非任意驱逐、必杀或不可逃出的封印。本场不吸入NPC、物品或灰羽，不移动身体，不给予序列4死亡复活。', '成败都须0行动主动停止维持、完全关门，再本人沿原十米走廊走回；普通方法也实际走去，以导师原手扇和固定布条核对气流，再实际返回。'],
    ability: '准备让灰羽留在原栖架、木标记留在原桌，计划沿已知原走廊十米去回；实施才实际走出，另耗4灵性、意志14打开三米有限试验门，比较原固定布条微小偏移。',
    ordinary: '准备沿同一原走廊十米去回，在空壁龛用导师原手扇产生普通气流、核对原布条和锚点；实施知识10、0灵性，不开冥界门。',
    abilityResult: '你本人实际走到原空壁龛，打开的有限冥界门对GK5-CLOTH-1产生一次可核对的微小牵引，原布条仍系在原锚点。没有NPC或物品被吞入，没有异地传送或死亡复活。门与本次接触仍须主动结束，身体尚未走回。',
    ordinaryResult: '你本人实际走到原空壁龛，以导师原手扇和固定布条核对普通气流与锚点，完成一次普通观察；没有打开冥界门或搬走原布条，仍须沿原十米走廊实际走回。',
    failure: '本次布条偏移或普通气流比较尚不足以报告。你的原身体仍在原空壁龛；若用了能力，已打开的有限门仍须主动停止并完全关闭，随后沿原十米走廊实际返回。',
    outcome: 'THRESHOLD_CHECKED', spirit: 4, abilityStat: 'will',
  },
] as const;
type Case = typeof CASES[number];

export const GATEKEEPER_ENVIRONMENT = '三项原创G实践核对原灰羽的新短驻约定、同一枚新木标记的两米交付与实际取回、原空壁龛的三米有限冥界门。晋升不附赠灵：旧记录中的同一个灰羽须另花1行动、3灵性、知识14邀请，自愿答应才实付12便士并进入原体内小冥界，本场容量1。旧递信约定、原信和历史不改写。每案观察、准备、实施、报告各1行动；能力实施分别2灵性意志14、3灵性知识14、4灵性意志14，普通方法知识10、0灵性。失败成本保留，0行动实际收束后下一真实周重试。结束交谈、取消准备、召回、释放和本人实际取回原木标记均0行动，不返资源。静息入驻不妨碍普通生活；未结束接触、派出、未归还标记或未关门则须先收束。第三案先在原工作室释放灰羽；实施时原身体走十米到空壁龛，关闭时关门并沿原路走回。原固定布条始终连着原锚点，无NPC驱逐、原物传送或序列4死亡复活。三案报告各G扮演25，能力报告一次已有知识池单项掌握8；普通报告不伪造能力掌握，三案反思25也可和平100。全部人物、场地、容量、距离和数值为原创G。 ' + GATEKEEPER_ENCOUNTER_STORY;
export const gatekeeperInside = (s: SliceState) => Object.values(s.gatekeeper.cases).some(r => r.contactOpen) || s.gatekeeper.practice.marker === 'RECIPIENT' || s.gatekeeper.practice.gateOpen || s.gatekeeper.companion.status === 'DEPLOYED';
export const isGatekeeperActivity = (c: GatekeeperCommand): c is GatekeeperActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_MARKER', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is GatekeeperActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_MARKER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!GATEKEEPER_CASE_IDS.includes(c.caseId as GatekeeperCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: GatekeeperActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'death' || s.progression.sequence !== 5) return '先完成看门人晋升。';
  const m = s.gatekeeper, f = m.practice, companion = m.companion, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原纪念工作室与原物旁，不能借收束瞬移。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次接触。';
  if (c.type === 'RECALL_SPIRIT') return companion.status === 'DEPLOYED' && !f.gateOpen ? null : '原灰羽没有正在进行的本场派出，不能凭空召回。';
  if (c.type === 'RETRIEVE_MARKER') return f.marker === 'RECIPIENT' && !f.gateOpen && !m.cases['controlled-threshold']!.contactOpen ? null : '没有在原看守处等待实际取回的原木标记，或须先关门并实际返回。';
  if (gatekeeperInside(s)) return '先0行动实际停止接触、召回原灰羽、取回原标记；若在壁龛，还须完全关门并实际走回。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (c.type === 'RELEASE_SPIRIT') return companion.status === 'INSIDE' ? null : '只有实际入驻、没有正在派出或接触的原灰羽可在原工作室栖架自愿释放。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或0行动取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockGatekeeperEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'INVITE_SPIRIT') {
    if (companion.status !== 'OUTSIDE' || m.cases['resting-place']!.status === 'AVAILABLE') return '先观察旧记录中的同一个灰羽；不能重复入驻、邀请未知灵或默认延长旧约定。';
    if (m.inviteAttemptWeek === s.week) return '本周原灰羽的答复保留，下一真实周才可另行邀请。';
    if (s.cash < GATEKEEPER_SPIRIT_FEE) return '先备齐本次成功自愿入驻所需的12便士；失败不收费，也可用普通方法实践。';
    return s.spirituality < 3 ? '本次新邀请需要3灵性；也可直接选择普通实践。' : null;
  }
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场、来源与实际退出安排已经核对。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果、实际结束接触并取回原木标记。';
  if (c.caseId === 'controlled-threshold' && companion.status !== 'OUTSIDE') return '先0行动在原工作室栖架实际释放同一个灰羽，让它留在距试验位置十米外的原处。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与有限同意。' : r.attemptWeek === s.week ? '本周实际尝试与成本保留，下一真实周再准备。' : null;
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才可重试。';
  const p = CASES.find(p => p.id === c.caseId)!;
  if (r.method === 'ABILITY' && p.id !== 'controlled-threshold' && companion.status !== 'INSIDE') return '本次能力需要另立新约定且已经实际入驻的同一个灰羽；可0行动取消准备后采用普通方法。';
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次能力需要${p.spirit}灵性；可0行动取消准备，休养或改用普通方法。` : null;
}
const recall = (s: SliceState) => { const c = s.gatekeeper.companion; if (c.status === 'DEPLOYED') { c.status = 'INSIDE'; c.recalls += 1; } };
const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => method === 'ABILITY' ? p.abilityResult : p.ordinaryResult;
const practiceText = (s: SliceState) => {
  const f = s.gatekeeper.practice;
  return `原GK5-MARKER-1${f.marker === 'DESK' ? '在导师原桌' : '仍在原看守桌，须本人实际取回'}；实际交付${f.deliveries}次、取回${f.returns}次。${f.gateOpen ? '有限冥界门仍在原空壁龛维持，须主动完全关闭并沿原路走回' : '没有仍在维持的练习冥界门'}；成功核对门的有限牵引${f.gateTests}次。`;
};
export function applyGatekeeperActivity(s: SliceState, c: GatekeeperActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('看门人实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyGatekeeperEncounter(s, c, ctx); return; }
  const m = s.gatekeeper, f = m.practice, companion = m.companion;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!, opened = f.gateOpen, deployed = companion.status === 'DEPLOYED';
    r.contactOpen = false; r.closes += 1; f.gateOpen = false; recall(s);
    ctx.note('实际结束本次有限接触', '0行动实际停止本次交谈、交接或试验。' + (c.caseId === 'controlled-threshold' ? (opened ? '你主动停止维持，令有限冥界门完全关闭；原布条仍固定在原锚点。' : '你收好导师原手扇，结束普通气流观察，没有把普通方法写成开过冥界门。') + '你本人再沿原普通走廊步行十米回到原工作室，灰羽仍在原栖架，没有借关闭传送。' : '你的原身体一直在原工作室。') + (deployed ? '同一个灰羽实际回到你的原体内小冥界休息，本次派出结束。' : '没有重复召回；已经入驻的原灰羽仍可在体内休息。') + '原木标记的位置不变，若在看守处仍须本人实际取回；旧信与旧约定不变。已付成本不返、不治疗、不再奖励。' + practiceText(s)); return;
  }
  if (c.type === 'RECALL_SPIRIT') {
    recall(s); ctx.note('召回同一个原灰羽', '0行动结束本场派出，同一个SG6-GRAY-FEATHER实际回到你的原体内小冥界休息。没有移动你的本体或GK5-MARKER-1，也没有自动结束本次接触；已付成本保留，不奖励。'); return;
  }
  if (c.type === 'RETRIEVE_MARKER') {
    f.marker = 'DESK'; f.returns += 1;
    ctx.note('本人实际取回同一枚原木标记', '0行动沿原净空普通路径步行两米，成年原看守本人亲手交还同一枚GK5-MARKER-1；你再走回，将它放回导师原桌。所有权仍属导师，不复制、不传送，不借召回偷换原物位置。旧原封信仍在旧收件人处，没有一同取回。本次接触若未停止仍须明确结束；不返行动或灵性、不奖励。'); return;
  }
  if (c.type === 'RELEASE_SPIRIT') {
    companion.status = 'OUTSIDE'; companion.releases += 1;
    ctx.note('原灰羽实际回到原工作室栖架', '0行动在原工作室栖架旁结束本次短驻，让同一个SG6-GRAY-FEATHER实际离开你的原身体并在原栖架自由休息。新约定、实付费用和历次入驻派出历史保留，旧一次递信记录不变；不退费、不奖励。此后若另邀短驻，仍须重新自愿同意、支付12便士并遵守每真实周一次。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察与此前实际结果、已付行动保留。原身体尚未走到空壁龛，没有派出灰羽、移动标记或打开冥界门，不退成本。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'INVITE_SPIRIT') {
    m.inviteAttemptWeek = s.week; s.spirituality -= 3;
    const result = ctx.check('knowledge', 14);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      companion.status = 'INSIDE'; companion.agreementWeek = s.week; companion.entries += 1; companion.feePaid += GATEKEEPER_SPIRIT_FEE; s.cash -= GATEKEEPER_SPIRIT_FEE;
      ctx.note('原灰羽本人自愿接受新短驻约定', '在原工作室栖架旁，同一个SG6-GRAY-FEATHER另行自愿答应本次原体内小冥界短驻、有限交接与短暂协助，并实际进入你的原身体。本次1行动、3灵性已付，成功另从本人现金实付12便士。旧一次递信约定并未延长，旧信和历史不变；本场容量1，没有新灵、自动技能或掌握奖励。');
    } else ctx.note('原灰羽这次没有答应', '本次1行动、3灵性已经支出；同一个灰羽仍在原工作室栖架自由休息，没有默认同意、实际入驻或扣取12便士。旧约定与旧原信不变；下一真实周可再次邀请，也可用普通方法继续实践。');
    return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('gatekeeper-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看新同意、原物与门的有限边界', '回看原灰羽另行自愿的短驻、同一枚原木标记真实去回，以及有限门必须主动关闭并本人实际返回。G扮演+25；旧约定不自动延长，原身体与原物不因界面收束而传送，普通方法也能完成有限帮助。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '本次只核对原来源、有限同意和去回安排，尚未派出、交付、走到壁龛或开门。'); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `gatekeeper-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(p, r.method!) + '上述实施之后，本次接触已实际停止，原木标记已在原桌，若去过壁龛也已完全收束并沿原十米走廊回到工作室。G扮演+25；' + (r.method === 'ABILITY' ? '能力报告获一次已有知识池单项掌握+8。' : '普通报告不冒充施法掌握，不要求招募也可完成扮演。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'controlled-threshold') ctx.note('原身体实际步行到原空壁龛', '本次实施1行动包含原身体沿已知普通走廊步行十米到原空壁龛，以及稍后收束时沿原路实际走回。灰羽留在十米外的原工作室栖架，木标记留在原桌。三米试验范围净空，GK5-CLOTH-1始终系在原锚点，导师原手扇随本次普通去回实际携带。');
  if (r.method === 'ABILITY') {
    s.spirituality -= p.spirit;
    if (p.id === 'shared-task') { companion.status = 'DEPLOYED'; companion.deployments += 1; }
    if (p.id === 'controlled-threshold') f.gateOpen = true;
    ctx.note('实际进行本次有界能力', `${p.spirit}灵性已经支出。` + (p.id === 'resting-place' ? '同一个原灰羽仍在你的原体内小冥界休息，只开始本次有限自愿交谈，不派出。' : p.id === 'shared-task' ? '同一个原灰羽实际离开你的原身体，在原两米路径上协助；判定成功才交付同一枚标记。' : '你在原空壁龛实际打开并维持三米G试验范围内的有限冥界门，原固定布条受到轻微拉力，原锚点仍承受它；之后只判定本次有限核对是否成功，没有吸入任何原物或NPC。') + '失败也保留成本与本次接触，仍须0行动明确收束。');
  } else if (p.id === 'shared-task') {
    f.marker = 'RECIPIENT'; f.deliveries += 1;
    ctx.note('本人步行完成原木标记交付', '实施的1行动包含你沿原净空路径步行两米，将同一枚GK5-MARKER-1亲手交给明确同意的成年原看守，再走回原桌。真实交付已经发生，接下来的普通知识核对若失败也不撤销它。');
  }
  const result = ctx.check(r.method === 'ABILITY' ? p.abilityStat : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'shared-task' && r.method === 'ABILITY') { f.marker = 'RECIPIENT'; f.deliveries += 1; }
    if (p.id === 'controlled-threshold' && r.method === 'ABILITY') f.gateTests += 1;
    ctx.note(p.title, resultText(p, r.method!) + '尚须0行动明确停止本次接触；已交付的原木标记须实际取回，壁龛试验须实际走回后才能报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, p.failure + '本次已付行动与灵性不返，先0行动实际收束与返回，下一真实周可重新准备。' + practiceText(s));
}
export function gatekeeperActions(s: SliceState): GatekeeperAction[] {
  if (s.progression.pathwayId !== 'death' || s.progression.sequence !== 5) return [];
  const out: GatekeeperAction[] = [], m = s.gatekeeper;
  const add = (id: string, label: string, cost: string, command: GatekeeperActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (m.companion.status === 'OUTSIDE') add('gatekeeper-invite', '另邀同一个原灰羽自愿短驻', '1行动 · 3灵性 · 知识14 · 成功另12便士 · 本周一次', { type: 'INVITE_SPIRIT' });
  if (m.companion.status === 'DEPLOYED') add('gatekeeper-recall', '召回同一个原灰羽', '0行动 · 原灵实际入体 · 不取回原标记', { type: 'RECALL_SPIRIT' });
  if (m.companion.status === 'INSIDE') add('gatekeeper-release', '将原灰羽实际释放到原工作室栖架', '0行动 · 保留新旧约定与实付历史', { type: 'RELEASE_SPIRIT' });
  if (m.practice.marker === 'RECIPIENT') add('gatekeeper-retrieve', '本人实际取回同一枚原木标记', '0行动 · 原两米步行去回 · 看守亲手交还', { type: 'RETRIEVE_MARKER' });
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', p.id === 'controlled-threshold' ? '实际结束试验、完全关门并走十米返回' : '实际停止接触并召回已派出原灰羽', '0行动 · 不自动取回原木标记', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原来源、本人同意与实际去回', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'controlled-threshold' ? '准备空壁龛三米有限门试验' : p.id === 'shared-task' ? '准备请原灰羽携同一枚木标记' : '准备与体内原灰羽有限交流', `1行动 · 实施另${p.spirit}灵性 · ${p.id === 'controlled-threshold' ? '先实际释放灰羽到原栖架' : '需另立约定且已实际入驻的原灰羽'}`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'controlled-threshold' ? '准备本人步行去回与普通手扇气流核对' : p.id === 'shared-task' ? '准备本人步行交付原木标记' : '准备普通核对原导师记录', '1行动 · 实施0灵性 · 不授予灵体', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', '实际进行这一次有限实践', r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · ${p.abilityStat === 'will' ? '意志' : '知识'}14` : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 尚未走到壁龛 · 成本保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告实际结果与有限边界', '1行动 · 先真实收束、取回与返回', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('gatekeeper-reflect', '回看新同意、原物与门的有限边界', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('gatekeeper-encounter-talk', '前往原空院与洛克当面澄清', '1行动 · 先完成一项报告', { type: 'ENCOUNTER_TALK' });
    add('gatekeeper-encounter-fight', '前往原空院并承担有限冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function gatekeeperCases(s: SliceState): GatekeeperProjection['cases'] {
  if (s.progression.pathwayId !== 'death' || ![5, 4, 3, 2].includes(s.progression.sequence!)) return [];
  return CASES.map(p => {
    const r = s.gatekeeper.cases[p.id]!;
    const closure = p.id === 'controlled-threshold' && r.attemptWeek !== null && !r.contactOpen ? '本次实施之后已实际结束试验，若开过门也已完全关闭；原身体已沿原十米走廊回到工作室。' : '';
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(p, r.method!) + closure + practiceText(s)
      : r.attemptWeek !== null ? `第${r.attemptWeek}周有限核对未成，真实派出、交付、行走与成本保留；先实际收束并取回原物，下一真实周再准备。` + closure + practiceText(s)
        : r.withdrawals ? '尚未实施的准备已取消，原身体未去壁龛；原观察和已付行动保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? p.id === 'controlled-threshold' ? '原身体仍在空壁龛，须0行动结束试验、完全关门并步行十米返回' : '本次接触仍须明确停止；关闭不会取回原木标记' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
export function gatekeeperCompanion(s: SliceState): GatekeeperProjection['companion'] {
  if (s.progression.pathwayId !== 'death' || ![5, 4, 3, 2].includes(s.progression.sequence!)) return null;
  const c = s.gatekeeper.companion, dead = s.status === 'DEAD';
  const statuses = { OUTSIDE: s.longChapter.cycleDeathDate !== null ? '原灰羽已在旧年代实际释放；原栖架只保留旧地点记录，后世当前位置与联系未知' : dead ? '原灰羽已在体外；终局死亡不会把它传回工作室，也不能重新邀请' : '原工作室栖架自由休息，没有当前体内短驻', INSIDE: '另行自愿入驻原体内小冥界休息；已关闭接触时可正常生活', DEPLOYED: '同一个原灰羽正在原两米交接现场协助，仍须实际召回' };
  return { name: '灰羽', source: c.source + ' · 死灵导师旧获准记录中的同一个原弱小鸟形灵（原创G）', status: statuses[c.status], history: [
    '旧一次递信约定、旧原封信位置与旧付费历史独立保留，不自动扩展为本次权限',
    s.gatekeeper.inviteAttemptWeek === null ? '尚未花费行动与灵性另行邀请短驻' : `最近于第${s.gatekeeper.inviteAttemptWeek}真实周另行邀请；失败不收费且不入驻`,
    c.agreementWeek === null ? '尚未本人同意新短驻，没有实际入驻的灵可协助' : `最近成功的新短驻约定在第${c.agreementWeek}真实周；本场原体内容量1`,
    `实际入驻${c.entries}次、释放${c.releases}次，成功短驻累计实付${c.feePaid}便士；实际派出${c.deployments}次、召回${c.recalls}次，始终同一个原灰羽`,
  ] };
}
export function gatekeeperPractice(s: SliceState): GatekeeperProjection['practice'] {
  if (s.progression.pathwayId !== 'death' || ![5, 4, 3, 2].includes(s.progression.sequence!)) return null;
  const f = s.gatekeeper.practice, threshold = s.gatekeeper.cases['controlled-threshold']!;
  return { marker: `GK5-MARKER-1 · ${f.marker === 'DESK' ? '在导师原桌' : '在原看守桌，等待本人实际取回'} · 所有权仍属原导师，旧原封信未改变`, gate: f.gateOpen ? '原空壁龛三米有限冥界门仍在维持；原布条连着锚点，须完全关门再步行十米返回' : threshold.contactOpen ? '没有练习冥界门；普通试验原身体仍在空壁龛，须步行十米返回' : '没有仍在维持的练习冥界门，也没有尚未走回的壁龛试验', summary: practiceText(s) };
}

/** Validate one authored original spirit, its newly accepted agreement and real local exits. */
export function validateGatekeeperLife(s: SliceState): boolean {
  const m = s.gatekeeper;
  if (!record(m) || !record(m.cases) || !shape(m.cases, GATEKEEPER_CASE_IDS) || !record(m.companion) || !record(m.practice) || !Array.isArray(s.seer.completedSources)) return false;
  const c = m.companion, f = m.practice, promoted = s.progression.pathwayId === 'death' && [5, 4, 3, 2].includes(s.progression.sequence!);
  if (!shape(c, ['source', 'status', 'agreementWeek', 'entries', 'releases', 'deployments', 'recalls', 'feePaid']) || !shape(f, ['marker', 'gateOpen', 'deliveries', 'returns', 'gateTests'])) return false;
  if (c.source !== 'SG6-GRAY-FEATHER' || !['OUTSIDE', 'INSIDE', 'DEPLOYED'].includes(c.status) || !['DESK', 'RECIPIENT'].includes(f.marker) || typeof f.gateOpen !== 'boolean') return false;
  const firstWeek = m.promotionWeek ?? s.week, weeks = s.week - firstWeek + 1;
  if (![c.entries, c.releases, c.deployments, c.recalls, c.feePaid, f.deliveries, f.returns].every(x => integer(x, 0)) || !integer(f.gateTests, 0, 1)) return false;
  if (m.inviteAttemptWeek !== null && !integer(m.inviteAttemptWeek, firstWeek, s.week) || c.agreementWeek !== null && !integer(c.agreementWeek, firstWeek, s.week)) return false;
  if (c.entries - c.releases !== (c.status === 'OUTSIDE' ? 0 : 1) || c.deployments - c.recalls !== (c.status === 'DEPLOYED' ? 1 : 0) || f.deliveries - f.returns !== (f.marker === 'RECIPIENT' ? 1 : 0)) return false;
  if (c.feePaid !== c.entries * GATEKEEPER_SPIRIT_FEE || c.entries > weeks) return false;
  if (c.entries === 0 && (c.agreementWeek !== null || c.releases || c.deployments || c.recalls || c.status !== 'OUTSIDE')) return false;
  if (c.entries > 0 && (c.agreementWeek === null || m.inviteAttemptWeek === null || c.agreementWeek > m.inviteAttemptWeek || c.entries > c.agreementWeek - firstWeek + 1)) return false;
  if (s.status === 'DEAD' && s.progression.sequence === 5 && c.status !== 'OUTSIDE') return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, weeks)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, firstWeek, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `gatekeeper-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - firstWeek + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    // A later new agreement must not invalidate an earlier, closed ability report.
    if (r.attemptWeek !== null && r.status !== 'PREPARED' && r.method === 'ABILITY' && p.id !== 'controlled-threshold' && c.entries < 1) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || r.closes >= r.attemptWeek - firstWeek + 1) return false;
      if (r.method === 'ABILITY' && p.id !== 'controlled-threshold' && (c.status === 'OUTSIDE' || c.agreementWeek === null || c.agreementWeek > r.attemptWeek)) return false;
    }
    if (!promoted && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const resting = m.cases['resting-place']!, task = m.cases['shared-task']!, threshold = m.cases['controlled-threshold']!;
  if (resting.status === 'AVAILABLE' && (m.inviteAttemptWeek !== null || c.entries !== 0)) return false;
  if (c.status === 'DEPLOYED' && !(task.contactOpen && task.method === 'ABILITY')) return false;
  if (resting.contactOpen && resting.method === 'ABILITY' && c.status !== 'INSIDE') return false;
  if (task.attemptWeek !== null && task.status !== 'PREPARED' && task.method === 'ABILITY' && c.deployments < 1) return false;
  if (f.gateOpen !== (threshold.contactOpen && threshold.method === 'ABILITY')) return false;
  if (threshold.contactOpen && (c.status !== 'OUTSIDE' || f.marker !== 'DESK')) return false;
  if (threshold.status === 'PREPARED' && c.status !== 'OUTSIDE') return false;
  if (f.gateTests !== (['EXAMINED', 'RESOLVED'].includes(threshold.status) && threshold.method === 'ABILITY' ? 1 : 0)) return false;
  if (task.attemptWeek === null && (f.deliveries !== 0 || f.returns !== 0)) return false;
  if (f.deliveries > (task.attemptWeek === null ? 0 : task.attemptWeek - firstWeek + 1)) return false;
  if (['EXAMINED', 'RESOLVED'].includes(task.status) && f.deliveries < 1) return false;
  if (f.marker === 'RECIPIENT' && (task.attemptWeek !== s.week || !['OBSERVED', 'EXAMINED'].includes(task.status) || task.method === null || task.method === 'ABILITY' && task.status !== 'EXAMINED' || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || prepared !== 0)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'gatekeeper-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || m.inviteAttemptWeek !== null || c.status !== 'OUTSIDE' || c.agreementWeek !== null || c.entries || c.releases || c.deployments || c.recalls || c.feePaid || f.marker !== 'DESK' || f.gateOpen || f.deliveries || f.returns || f.gateTests)) return false;
  if (promoted && (s.progression.sequence === 5 ? s.progression.acting : s.undying.gatekeeperActingAtPromotion) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
