import { hasNightwatcherLifeLock, nightwatcherOwnsOriginalLeafDeployment } from '../nightwatcher/life.js';
import { hasFearBishopLifeLock } from '../fear-bishop/life.js';
import { hasFearBishopEncounterLock } from '../fear-bishop/encounter.js';
import { hasConcealmentServantLifeLock } from '../concealment-servant/life.js';
import { hasConcealmentServantEncounterLock } from '../concealment-servant/encounter.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applySpiritWarlockEncounter, blockSpiritWarlockEncounter, SPIRIT_WARLOCK_ENCOUNTER_STORY } from './encounter.js';
import { SPIRIT_WARLOCK_CASE_IDS, type SpiritWarlockCaseId, type SpiritWarlockCommand, type SpiritWarlockActivityCommand, type SpiritWarlockAction, type SpiritWarlockProjection } from './types.js';

const CASES = [
  {
    id: 'listening-leaves', title: '老榆树下的一次卷叶回应',
    story: '原导师赛琳带你来到贝克兰德一处安静原小庭，介绍始终住在原老榆树旁的一个小型自然灵卷叶（SW5-LEAF-1）。它并非晋升附赠。你先看清原处的落叶与气流，再决定是否另行邀请它自愿在你的一颗牙齿内休息；本案只比较约好的有限卷叶回应。（原创G）',
    facts: ['本场始终是原老榆树旁同一个卷叶，不是任意灵体库，也不新增同伴。', '邀请要另花1行动、3灵性并通过意志14；失败仍未封入，成功后才有真实可派出的灵。', '叶子的移动只支持本次有限比较，不代表身份、秘密或完整真相。'],
    ability: '准备呼出已经自愿封入原牙齿的卷叶，请它在附近按约卷动一片原落叶；实施另耗3灵性、意志14，回应可失败。',
    ordinary: '准备站在原树旁普通观察原落叶与气流，用普通知识比较可见变化，不邀请、封存或派出灵体。',
    abilityResult: '实际呼出的原卷叶按约使附近一片原落叶卷动，你核对了这一有限回应。没有读取身份、秘密或把叶子当成真相。',
    ordinaryResult: '你普通观察原树旁的落叶与气流，记录了一次可见变化与比较边界。没有招募、封入或派出卷叶，也没有声称听见灵体答案。',
    failure: '本次叶动与回应不足以形成可报告的有限比较，原卷叶和落叶的来源不变。',
    outcome: 'LEAVES_CHECKED', spirit: 3,
  },
  {
    id: 'original-message', title: '同一张纸条的两米去回',
    story: '赛琳将她所有的原纸条SW5-NOTE-1放在原小庭桌上，成年值班员梅森在两米外的原桌旁明确同意接收并返还。两桌之间是净空、可正常步行的原地面。纸上只写一次普通交接安排；本案要真实交付同一张纸，再由本人实际取回，不能把放灵或关闭界面写成传送。（原创G）',
    facts: ['只有原纸条SW5-NOTE-1一张，始终归赛琳；梅森只同意本次接收与返还，不改变所有权。', '能力成功才由实际派出的原卷叶携纸走完这段两米普通净空路径；失败纸仍在原桌。', '普通方法由你本人步行两米亲手交付后走回，包含在实施的1行动内；核对失败也保留真实交付。', '结束接触和召回都不取回纸条；须0行动实际走到梅森处，由他亲手交还同一张原纸再走回。'],
    ability: '准备派出已封入的原卷叶，沿两米原净空路径携原纸到梅森原桌；实施另耗3灵性、意志14，成功才实际交付。',
    ordinary: '准备本人沿原两米普通路径步行交付同一张纸条，再走回原桌；实施1行动包含去回，普通核对失败也不撤销已经发生的交付。',
    abilityResult: '原卷叶确已沿两米原净空路径把同一张SW5-NOTE-1放到梅森原桌，梅森本人确认收到。纸条不是新生成的物品，内容也没有被当作秘密真相。',
    ordinaryResult: '你本人确已步行两米，把原SW5-NOTE-1亲手交给梅森并走回原桌，随后完成普通交接核对。没有派灵、复制纸条或改变所有权。',
    failure: '本次交接核对未形成可报告的结果。普通方法已经发生的交付仍保留；能力方法未成功则原纸仍在原桌。',
    outcome: 'MESSAGE_CHECKED', spirit: 3,
  },
  {
    id: 'quiet-coordination', title: '静坐维持梦境时的约定叶信号',
    story: '成年梅森本人只同意这一次短暂梦境配合，已在原小庭的原椅上安静休息，原导师赛琳全程在旁照看。你在另一原椅上保持真实身体不动，维持继承梦魇的有限梦境，同时请已经取得的原卷叶在附近作一次约定叶信号。普通方法则等梅森醒着时一起讨论和比较信号，不施加梦境。（原创G）',
    facts: ['梅森本人已经休息且仅同意此次短暂配合，不对清醒抵抗者强行瞬间入梦。', '维持梦境期间你的原身体始终留在原椅，卷叶只在附近协作，不携身体飞行、穿地或跨梦移动。', '实施的1行动只承载这段短暂G练习；结尾仍须0行动明确停止梦境、让梅森醒来并召回原卷叶。'],
    ability: '准备保持本体静坐，维持继承梦魇的有限梦境，同时呼出已封入的原卷叶作约定叶信号；实施另耗4灵性、意志14，协作可失败。',
    ordinary: '准备与醒着且自愿的梅森普通讨论、比较约定叶信号；不施加梦境，也不派出或凭空得到灵体。',
    abilityResult: '你的本体始终静坐维持这段有限梦境，原卷叶实际在附近作出约定叶信号，完成一次协作核对。灵体确可在你维持梦境时协助，但没有搬走你的身体或取得未知真相。',
    ordinaryResult: '你与醒着的梅森完成普通讨论和信号比较，记下何时应停止、何处仍不能确定。没有施加梦境、派出灵体或把普通结果记成非凡协作。',
    failure: '本次信号协调尚不足以报告；若维持了梦境，本体仍须静坐，依原同意停止并让梅森醒来。',
    outcome: 'COORDINATION_CHECKED', spirit: 4,
  },
] as const;
type Case = typeof CASES[number];

export const SPIRIT_WARLOCK_ENVIRONMENT = '三项原创G实践分别核对老榆树下有限叶动、真实原纸条两米交付与取回、静坐维持继承梦境时的原灵协作。晋升不附赠灵：卷叶SW5-LEAF-1须先观察原树，再另花1行动、3灵性以意志14邀请；自愿同意才封入一颗牙齿作为休息媒介。身体可作灵的休息封存处，不是死神途径的体内冥界；飞行、穿地仍需另行取得合适灵，本场卷叶不能代替。每项观察、准备、实施、报告各1行动；能力实施依次耗3、3、4灵性、意志14，普通方法知识10、0灵性。失败成本保留，实际结束后下一真实周重试。结束、取消准备、召回、释放、实际取回原纸均0行动；召回不移动本体或纸条，不结束梦境与接触。每项报告G扮演+25，能力报告另获一次原规则单项掌握+8；普通报告也能与三案反思+25达到扮演100。全部人物、有限场景与数值是原创G。 ' + SPIRIT_WARLOCK_ENCOUNTER_STORY;
export const spiritWarlockInside = (s: SliceState) => Object.values(s.spiritWarlock.cases).some(r => r.contactOpen) || s.spiritWarlock.practice.note === 'RECIPIENT' || s.spiritWarlock.practice.dreamOpen || s.spiritWarlock.companion.status === 'DEPLOYED';
export const isSpiritWarlockActivity = (c: SpiritWarlockCommand): c is SpiritWarlockActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_NOTE', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is SpiritWarlockActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_NOTE', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!SPIRIT_WARLOCK_CASE_IDS.includes(c.caseId as SpiritWarlockCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: SpiritWarlockActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  const inherited = s.progression.pathwayId === 'darkness' && ([4, 3, 2].includes(s.progression.sequence ?? 0));
  if (s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 5 && !inherited) return '先完成灵巫晋升。';
  if (inherited && (c.type !== 'INVITE_SPIRIT' && c.type !== 'RELEASE_SPIRIT')) return '更高阶仅继承同一个原卷叶的邀请与释放；旧五阶案件已只读。';
  if (inherited && (hasNightwatcherLifeLock(s) || Object.values(s.nightwatcher.life.cases).some(r => r.status === 'PREPARED') || s.nightwatcher.ritual.playerLocation === 'HALL' || ['READY', 'FIGHTING'].includes(s.nightwatcher.encounter.status))) return '先收束守夜人原现场、准备或遭遇，再返回原老榆树。';
  if (inherited && (s.fearBishop.preparedWeek !== null || hasFearBishopLifeLock(s) || hasFearBishopEncounterLock(s) ||
      s.concealmentServant.preparedWeek !== null || hasConcealmentServantLifeLock(s) || hasConcealmentServantEncounterLock(s))) return '先实际结束恐惧主教或隐秘之仆的准备、原现场与遭遇，再沿普通路径返回原老榆树。';
  const m = s.spiritWarlock, f = m.practice, companion = m.companion, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (inherited && (m.promotionWeek === null || companion.source !== 'SW5-LEAF-1' || m.cases['listening-leaves']!.status === 'AVAILABLE' || c.type === 'RELEASE_SPIRIT' && companion.acquiredWeek === null)) return '只可邀请或释放早先实际认识的同一个原卷叶；没有新灵或免费取得。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗；本场派出的灵随真实战斗结算召回。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原小庭、原老榆树与同一张纸条旁。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次接触。';
  if (c.type === 'RECALL_SPIRIT') return companion.status === 'DEPLOYED' ? null : '原卷叶没有正在进行的派出，不能凭空召回。';
  if (c.type === 'RETRIEVE_NOTE') return f.note === 'RECIPIENT' && !f.dreamOpen ? null : '没有在梅森处等待实际取回的原纸条。';
  if (spiritWarlockInside(s)) return '先0行动停止接触与梦境、召回原灵，并实际取回仍在梅森处的同一张纸。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或0行动取消另一项尚未实施的准备。';
  if (c.type === 'RELEASE_SPIRIT') return companion.status === 'SEALED' ? null : '只有实际封入且没有正在派出的原卷叶可自愿释放。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockSpiritWarlockEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'INVITE_SPIRIT') {
    if (!['AVAILABLE', 'RELEASED'].includes(companion.status)) return '先观察原老榆树；不能邀请未知灵或重复封入已有卷叶。';
    if (m.cases['listening-leaves']!.status === 'AVAILABLE') return '先亲自观察原老榆树旁同一个卷叶。';
    if (companion.invitedWeek === s.week) return '本周原卷叶的答复保留，下一真实周才可再次邀请。';
    return s.spirituality < 3 ? '本次自愿邀请需要3灵性；也可直接选普通实践。' : null;
  }
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场、本人同意与退出边界已经核对。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与有限同意。' : r.attemptWeek === s.week ? '本周实际尝试与成本保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果、实际结束接触并取回原纸。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才可重试。';
  const p = CASES.find(p => p.id === c.caseId)!;
  if (r.method === 'ABILITY' && companion.status !== 'SEALED') return '本次能力需要已经实际取得并封入原牙齿的卷叶；可取消准备后采用普通方法。';
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次能力需要${p.spirit}灵性；可0行动取消准备，休养或改用普通方法。` : null;
}
const recall = (s: SliceState) => { const c = s.spiritWarlock.companion; if (c.status === 'DEPLOYED') { c.status = 'SEALED'; c.recalls += 1; } };
const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => method === 'ABILITY' ? p.abilityResult : p.ordinaryResult;
const practiceText = (s: SliceState) => {
  const f = s.spiritWarlock.practice;
  return `原SW5-NOTE-1${f.note === 'TABLE' ? '在赛琳原桌' : '仍在梅森原桌，须本人实际取回'}；实际交付${f.deliveries}次、取回${f.returns}次。${f.dreamOpen ? '有限梦境仍在维持，本体不能移动，须明确停止' : '当前没有仍在维持的练习梦境'}；已核对非凡协作${f.coordinationChecks}次。`;
};
export function applySpiritWarlockActivity(s: SliceState, c: SpiritWarlockActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('灵巫实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applySpiritWarlockEncounter(s, c, ctx); return; }
  const m = s.spiritWarlock, f = m.practice, companion = m.companion;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1;
    const dreamed = f.dreamOpen, deployed = companion.status === 'DEPLOYED';
    f.dreamOpen = false; recall(s);
    ctx.note('实际停止本次接触', '0行动实际停止本次观察、交接或信号比较。' + (dreamed ? '你停止继承梦境，梅森在原椅上醒来；你的原身体始终未移动。' : '没有把普通方法写成施过梦境。') + (deployed ? '同一个卷叶实际回到原牙齿休息，本次派出结束。' : '没有重复召回或新增灵体。') + '原纸条的位置保持，仍在梅森处就须另行实际取回；已付成本不返，不治疗、不再奖励。' + practiceText(s)); return;
  }
  if (c.type === 'RECALL_SPIRIT') {
    recall(s); ctx.note('召回原卷叶', '0行动结束当前派出，同一个SW5-LEAF-1回到原牙齿休息。没有移动你的本体或SW5-NOTE-1，也没有结束正在维持的梦境或本次接触；原成本保留，不奖励。'); return;
  }
  if (c.type === 'RETRIEVE_NOTE') {
    f.note = 'TABLE'; f.returns += 1;
    ctx.note('实际取回同一张原纸条', '0行动沿原净空普通路径步行两米，成年梅森本人亲手交还同一张SW5-NOTE-1；你再走回并将它放在赛琳原桌。所有权仍属赛琳，不复制、不传送、不借召回偷换纸的位置。本次接触若未停止仍须明确结束，不返行动或灵性、不奖励。'); return;
  }
  if (c.type === 'RELEASE_SPIRIT') {
    companion.status = 'RELEASED'; companion.releases += 1;
    ctx.note('将同一个卷叶自愿释放回原处', '0行动在原小庭老榆树旁结束封存，让原SW5-LEAF-1离开你的原牙齿、回到它原来居住处。首次取得周、历次派出与召回保留，不制造新灵或奖励；此后若再邀请，仍须同一个卷叶自愿同意并遵守每真实周一次。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备；原观察、本人有限同意、此前实际结果与已付行动保留。没有派出灵、移动纸条或开始梦境，不退成本。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'INVITE_SPIRIT') {
    companion.invitedWeek = s.week; s.spirituality -= 3;
    const result = ctx.check('will', 14);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      companion.status = 'SEALED'; companion.acquiredWeek ??= s.week;
      ctx.note('原卷叶自愿在牙齿中休息', '在原小庭老榆树旁，赛琳见证同一个SW5-LEAF-1自愿接受这次邀请，实际封入你的一颗原牙齿作为休息媒介。本次1行动、3灵性已付，没有附赠第二个灵、不授予飞行穿地或掌握奖励。');
    } else ctx.note('原卷叶这次没有答应', '本次1行动、3灵性已经支出；同一个SW5-LEAF-1仍自由留在原老榆树旁，未封入、未派出，没有默认同意。下一个真实周可再邀请，也可用普通方法继续实践。');
    return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('spirit-warlock-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('同意、原物与静坐协作的边界', '回看有限叶动、同一张原纸的真实去回，以及维持梦境或普通讨论时的协作边界。G扮演+25；取得灵需要其本人同意，借助不能代替来源与原物，普通方法同样可以完成有限帮助。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED'; if (p.id === 'listening-leaves' && companion.status === 'UNMET') companion.status = 'AVAILABLE';
    ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '本次只核对原现场和有限同意，尚未派出、交付或维持梦境。'); return;
  }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `spirit-warlock-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(p, r.method!) + '本次接触已实际停止，若曾交付原纸也已实际取回。G扮演+25；' + (r.method === 'ABILITY' ? '能力报告获一次原规则单项掌握+8。' : '普通报告不冒充施法掌握，不要求封灵也可完成扮演。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= p.spirit; companion.status = 'DEPLOYED'; companion.deployments += 1;
    if (p.id === 'quiet-coordination') f.dreamOpen = true;
    ctx.note('实际派出已取得的原卷叶', `${p.spirit}灵性已经支出，同一个SW5-LEAF-1实际离开原牙齿在本次原现场协助。` + (f.dreamOpen ? '梅森本人已休息并同意；你保持原身体静坐，实际维持继承梦魇的短暂有限梦境，之后只判定叶信号协调是否成功。' : '没有新生成灵、自动完成核对或挪动原纸。') + '失败也保留成本，仍须结束本次接触。');
  } else if (p.id === 'original-message') {
    f.note = 'RECIPIENT'; f.deliveries += 1;
    ctx.note('本人步行完成原纸交付', '实施的1行动包含你沿原净空路径步行两米，将原SW5-NOTE-1亲手交给明确同意的梅森，再走回原桌。真实交付已经发生，接下来的普通知识核对若失败也不撤销它。');
  }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'original-message' && r.method === 'ABILITY') { f.note = 'RECIPIENT'; f.deliveries += 1; }
    if (p.id === 'quiet-coordination' && r.method === 'ABILITY') f.coordinationChecks += 1;
    ctx.note(p.title, resultText(p, r.method!) + '尚须0行动明确停止本次接触；原纸若已交付，还须实际取回后才能报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED';
  ctx.note(p.title, p.failure + '本次已付行动与灵性不返，先0行动停止接触并处理原纸，下一真实周可重新准备。' + practiceText(s));
}
export function spiritWarlockActions(s: SliceState): SpiritWarlockAction[] {
  if (s.progression.pathwayId !== 'darkness' || ![5, 2].includes(s.progression.sequence ?? 0)) return [];
  const out: SpiritWarlockAction[] = [], m = s.spiritWarlock;
  const add = (id: string, label: string, cost: string, command: SpiritWarlockActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (s.progression.sequence === 2) {
    if (['AVAILABLE', 'RELEASED'].includes(m.companion.status)) add('spirit-warlock-invite', '邀请同一个原卷叶自愿在牙齿中休息', '1行动 · 3灵性 · 意志14 · 本周一次', { type: 'INVITE_SPIRIT' });
    if (m.companion.status === 'SEALED') add('spirit-warlock-release', '自愿释放同一个原卷叶回原老榆树', '0行动 · 保留取得、释放与派出历史', { type: 'RELEASE_SPIRIT' });
    return out;
  }
  if (['AVAILABLE', 'RELEASED'].includes(m.companion.status)) add('spirit-warlock-invite', '邀请原卷叶自愿在牙齿中休息', '1行动 · 3灵性 · 意志14 · 本周一次', { type: 'INVITE_SPIRIT' });
  if (m.companion.status === 'DEPLOYED') add('spirit-warlock-recall', '召回同一个卷叶', '0行动 · 不移动本体或原纸 · 不结束梦境', { type: 'RECALL_SPIRIT' });
  if (m.companion.status === 'SEALED') add('spirit-warlock-release', '自愿释放原卷叶回原老榆树', '0行动 · 保留取得与派出历史', { type: 'RELEASE_SPIRIT' });
  if (m.practice.note === 'RECIPIENT') add('spirit-warlock-retrieve', '本人实际取回同一张原纸条', '0行动 · 原两米步行去回 · 梅森亲手交还', { type: 'RETRIEVE_NOTE' });
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际停止接触、结束梦境并召回', '0行动 · 不自动取回原纸', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原现场、来源与本人有限同意', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'quiet-coordination' ? '准备静坐维持梦境并请原灵协作' : p.id === 'original-message' ? '准备请原卷叶携同一张纸条' : '准备核对原卷叶的有限回应', `1行动 · 实施另耗${p.spirit}灵性 · 需已封入原卷叶`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'original-message' ? '准备本人步行交付原纸' : p.id === 'quiet-coordination' ? '准备醒时普通讨论与信号比较' : '准备普通观察落叶与气流', '1行动 · 不招募或派出灵 · 实施0灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', '实际进行这一次有限实践', r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · 意志14` : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 原成本与事实保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告实际结果与未知范围', '1行动 · 先真实结束并取回原纸', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('spirit-warlock-reflect', '回看同意、原物与静坐协作的边界', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('spirit-warlock-encounter-talk', '前往原空院与奥林当面澄清', '1行动 · 先完成一项报告', { type: 'ENCOUNTER_TALK' });
    add('spirit-warlock-encounter-fight', '前往原空院并承担有限冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function spiritWarlockCases(s: SliceState): SpiritWarlockProjection['cases'] {
  if (s.progression.pathwayId !== 'darkness' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0)) return [];
  return CASES.map(p => {
    const r = s.spiritWarlock.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(p, r.method!) + practiceText(s)
      : r.attemptWeek !== null ? `第${r.attemptWeek}周有限核对未成，实际派出、交付与成本按原状态保留；停止接触并取回原纸后，下一真实周再准备。` + practiceText(s)
        : r.withdrawals ? '尚未实施的准备已取消，原观察与已付行动保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触仍须明确停止；关闭不会自动取回原纸' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
export function spiritWarlockCompanion(s: SliceState): SpiritWarlockProjection['companion'] {
  if (s.progression.pathwayId !== 'darkness' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0)) return null;
  const c = s.spiritWarlock.companion;
  const statuses = { UNMET: '尚未亲自观察原老榆树', AVAILABLE: '原老榆树旁自由活动，尚未同意封入', SEALED: '自愿封入原牙齿休息', DEPLOYED: '同一个卷叶正在原现场协助', RELEASED: '已经自愿释放回原老榆树' };
  return { name: '卷叶', source: c.source + ' · 贝克兰德原小庭老榆树旁的小型自然灵（原创G）', status: statuses[c.status], history: [
    c.invitedWeek === null ? '尚未花费行动与灵性发出邀请' : `最近于第${c.invitedWeek}真实周实际邀请；不代表每次都答应`,
    c.acquiredWeek === null ? '尚未实际取得，没有可派出的灵' : `首次于第${c.acquiredWeek}真实周自愿同意并封入原牙齿`,
    `实际派出${c.deployments}次、召回${c.recalls}次、释放回原处${c.releases}次；始终是同一个原灵`,
  ] };
}
export function spiritWarlockPractice(s: SliceState): SpiritWarlockProjection['practice'] {
  if (s.progression.pathwayId !== 'darkness' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0)) return null;
  const f = s.spiritWarlock.practice;
  return { note: `SW5-NOTE-1 · ${f.note === 'TABLE' ? '在赛琳原桌' : '在梅森原桌，等待本人实际取回'} · 所有权仍属赛琳`, dream: f.dreamOpen ? '仍在维持有限梦境；本体原椅静坐，须明确停止并让梅森醒来' : '没有仍在维持的练习梦境', summary: practiceText(s) };
}

/** Validate these authored originals and their reachable exits, without a general spirit registry. */
export function validateSpiritWarlockLife(s: SliceState): boolean {
  const m = s.spiritWarlock;
  if (!record(m) || !record(m.cases) || !shape(m.cases, SPIRIT_WARLOCK_CASE_IDS) || !record(m.companion) || !record(m.practice) || !Array.isArray(s.seer.completedSources)) return false;
  const c = m.companion, f = m.practice, promoted = s.progression.pathwayId === 'darkness' && [5, 4, 3, 2].includes(s.progression.sequence ?? 0);
  if (!shape(c, ['status', 'invitedWeek', 'acquiredWeek', 'releases', 'deployments', 'recalls', 'source']) || !shape(f, ['note', 'dreamOpen', 'deliveries', 'returns', 'coordinationChecks'])) return false;
  if (c.source !== 'SW5-LEAF-1' || !['UNMET', 'AVAILABLE', 'SEALED', 'DEPLOYED', 'RELEASED'].includes(c.status) || !['TABLE', 'RECIPIENT'].includes(f.note) || typeof f.dreamOpen !== 'boolean') return false;
  const firstWeek = m.promotionWeek ?? s.week, weeks = s.week - firstWeek + 1;
  if (![c.releases, c.deployments, c.recalls, f.deliveries, f.returns].every(x => integer(x, 0)) || !integer(f.coordinationChecks, 0, 1)) return false;
  if (c.invitedWeek !== null && !integer(c.invitedWeek, firstWeek, s.week) || c.acquiredWeek !== null && !integer(c.acquiredWeek, firstWeek, s.week)) return false;
  if (c.deployments - c.recalls !== (c.status === 'DEPLOYED' ? 1 : 0) || f.deliveries - f.returns !== (f.note === 'RECIPIENT' ? 1 : 0)) return false;
  if (c.acquiredWeek === null && (c.releases || c.deployments || c.recalls || ['SEALED', 'DEPLOYED', 'RELEASED'].includes(c.status))) return false;
  if (c.acquiredWeek !== null && (c.invitedWeek === null || c.acquiredWeek > c.invitedWeek || ['UNMET', 'AVAILABLE'].includes(c.status))) return false;
  if (c.status === 'RELEASED' && c.releases === 0 || c.releases > weeks) return false;
  let open = 0, prepared = 0, resolved = 0, abilityOpen = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, weeks)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, firstWeek, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `spirit-warlock-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - firstWeek + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.attemptWeek !== null && r.status !== 'PREPARED' && r.method === 'ABILITY' && (c.acquiredWeek === null || c.acquiredWeek > r.attemptWeek || c.deployments < 1)) return false;
    if (r.contactOpen) {
      open += 1; if (r.method === 'ABILITY') abilityOpen += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || r.closes >= r.attemptWeek - firstWeek + 1) return false;
    }
    if (!promoted && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const leaves = m.cases['listening-leaves']!, message = m.cases['original-message']!, quiet = m.cases['quiet-coordination']!;
  if ((leaves.status === 'AVAILABLE') !== (c.status === 'UNMET')) return false;
  if (c.status === 'UNMET' && (c.invitedWeek !== null || c.acquiredWeek !== null)) return false;
  if (c.status === 'DEPLOYED' && !abilityOpen && !nightwatcherOwnsOriginalLeafDeployment(s) && !(s.combat?.encounterId === 'FIRST_CASE' || s.combat?.encounterId === 'SPIRIT_WARLOCK_DISPUTE' && m.encounter.status === 'FIGHTING')) return false;
  if (abilityOpen && !['SEALED', 'DEPLOYED'].includes(c.status)) return false;
  if (f.dreamOpen !== (quiet.contactOpen && quiet.method === 'ABILITY')) return false;
  if (f.coordinationChecks !== (['EXAMINED', 'RESOLVED'].includes(quiet.status) && quiet.method === 'ABILITY' ? 1 : 0)) return false;
  if (message.attemptWeek === null && (f.deliveries !== 0 || f.returns !== 0)) return false;
  if (f.deliveries > (message.attemptWeek === null ? 0 : message.attemptWeek - firstWeek + 1)) return false;
  if (['EXAMINED', 'RESOLVED'].includes(message.status) && f.deliveries < 1) return false;
  if (f.note === 'RECIPIENT' && (message.attemptWeek !== s.week || !['OBSERVED', 'EXAMINED'].includes(message.status) || message.method === null || message.method === 'ABILITY' && message.status !== 'EXAMINED' || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || prepared !== 0)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'spirit-warlock-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || c.status !== 'UNMET' || c.invitedWeek !== null || c.acquiredWeek !== null || c.releases || c.deployments || c.recalls || f.note !== 'TABLE' || f.dreamOpen || f.deliveries || f.returns || f.coordinationChecks)) return false;
  if (promoted && s.progression.sequence === 5 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (promoted && ([4, 3, 2].includes(s.progression.sequence ?? 0)) && (open || prepared || f.dreamOpen || f.note !== 'TABLE' || s.nightwatcher.spiritWarlockActingAtPromotion !== resolved * 25 + (m.reflected ? 25 : 0))) return false;
  return true;
}
