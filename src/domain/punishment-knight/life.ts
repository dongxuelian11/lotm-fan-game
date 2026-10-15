import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyPunishmentKnightEncounter, blockPunishmentKnightEncounter, PUNISHMENT_KNIGHT_ENCOUNTER_STORY } from './encounter.js';
import { validatePunishmentKnightCommand } from './index.js';
import { PUNISHMENT_KNIGHT_CASE_IDS, type PunishmentKnightCommand, type PunishmentKnightActivityCommand, type PunishmentKnightAction, type PunishmentKnightProjection } from './types.js';

const CASES = [
  {
    id: 'breach-and-pad', title: '真实越过原训练线后的软靶实践',
    story: '薇娜·贝尔的原调解处安全练习室里，同一软靶PK5-SOFT-PAD-1稳放在原支架，原可收地线PK5-LINE-1仍在原盒。原创成年递件员阿伦明确同意这一次短时训练：能力方法先宣告一条刻意减弱的“不越过这条训练线”，由他保留选择并实际迈步越过，再只对原软靶尝试有限惩戒关联的速度与力量。阿伦不是攻击目标。',
    facts: ['薇娜现场观察阿伦本人先真实越过原线；有实际动作才记BREACHED，不能用计划、指控或标签冒充违反。', '刻意减弱的训练宣告并非绝对物理屏障，其范围与对安全原物的惩戒用法均为原创G，不是法律、官方职权或原著通用授权。', '同一原软靶只在成功后落到原安全垫MAT；失败仍在原支架STAND。普通方法只有本人真实跨线与普通试靶，没有神秘禁令或惩罚。'],
    ability: '复核阿伦本次明确同意、停止信号与原物，准备1行动；尚未宣告、迈步或击靶。实施另1行动、3灵性、知识14：实际越线在先，惩戒尝试只向原软靶，失败照付。',
    ordinary: '准备本人同意的普通跨线与试靶，实施1行动、0灵性、知识12；没有施法，不因普通方法增加能力掌握。',
    outcome: 'PUNISHMENT_CHECKED',
  },
  {
    id: 'willing-pause', title: '阿伦本人同意的一次有限停步',
    story: '原练习室的同一短路平整、清楚，原出口可用。成年阿伦只同意这一次短暂试步停顿，并与薇娜核实随时有效的停止信号；你可以尝试有限囚禁，也可使用普通口头停步。完成后必须实际解除，让本人沿原短路走回起点。',
    facts: ['准备阶段阿伦自由站稳，不存在提前囚禁；实施时重新核实本人的当下同意，许可不能延长为永久服从。', '只有能力判定成功才暂记HELD；失败与普通口头方法始终FREE。普通自行停步不伪称神秘囚禁。', 'CLOSE实际停止影响、解除束缚并让本人走回原短路起点；即使0行动、0灵性或精神耗尽，也不收取释放费用。'],
    ability: '核实本次有限同意与停止信号，准备1行动，尚未施法；实施另1行动、3灵性、知识14，尝试一次短时囚禁，失败照付。',
    ordinary: '准备普通口头停步，实施1行动、0灵性、知识10，由阿伦自己停步，始终保有行动自由；之后仍须本人实际走回原起点。',
    outcome: 'PAUSE_CHECKED',
  },
  {
    id: 'wound-record', title: '同一原纸上的诚实伤势记录',
    story: '薇娜保留同一张原记录纸PK5-NOTE-1。你只用普通方法核对已有实际伤势记录；没有已有记录时，就明确写“未观察到可记录伤势”。阿伦未在训练中受伤，不为测试创造伤口，也不对本人尝试伤口裁决。',
    facts: ['这项记录不要求先战斗，不推断隐藏伤势，不把速度、禁令或停步当作伤口。', '实施时薇娜亲手递来同一PK5-NOTE-1，实际普通书写；失败也留下WRITTEN，重试保留并更正同一原纸上的旧文字。', '结束必须亲手交回同一已写原纸并由薇娜当面收妥，才成为HANDED_OVER；普通记录不增加伤口裁决或任何能力掌握。'],
    ability: null,
    ordinary: '准备普通核对与书写，实施1行动、0灵性、知识10；记录真实已有伤势或明确未观察到伤势，再0行动亲手交付同一原纸。',
    outcome: 'RECORD_CHECKED',
  },
] as const;

const active = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 5;
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
export const punishmentKnightInside = (s: SliceState) => Object.values(s.punishmentKnight.cases).some(r => r.contactOpen) || s.punishmentKnight.practice.pad === 'MAT' || s.punishmentKnight.practice.partner === 'HELD' || s.punishmentKnight.practice.rule !== 'NONE' || s.punishmentKnight.practice.note === 'WRITTEN';
export const isPunishmentKnightActivity = (c: PunishmentKnightCommand): c is PunishmentKnightActivityCommand => typeof c === 'object' && c !== null &&
  ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

export const PUNISHMENT_KNIGHT_ENVIRONMENT = '以下现场、范围、持续与数值均为原创G：观察、准备、实施、报告各1行动，前两项能力实施另3灵性、知识14，失败照付。阿伦先实际越过刻意减弱的原训练线，再只向同一安全软靶尝试有限惩戒；训练宣告不是法律、官方职权或绝对屏障，对安全原物的用法不冒充原著通用规则。普通试靶知识12、口头停步知识10，均0灵性。囚禁只限本人这次同意，真实解除后由本人沿原短路走回。伤势记录只许普通书写、知识10，不要求先战斗，没有伤势就如实写未观察到，不制造伤口或伤口裁决掌握。全部接触成败都须0行动实际扶回同一原软靶、收起同一原线、解除并走回，或亲手交付同一已写原纸；不退款、不治疗。失败实际收束后下一真实周才重试。三份报告各G扮演25，只有前两项真实成功的能力报告各得已有知识池随机单项掌握8，普通方法不伪造掌握；反思25，全普通和平100有实际成本。不提前获得序列4能力剥夺，不把伤口裁决写成一句话必死。' + PUNISHMENT_KNIGHT_ENCOUNTER_STORY;

function closeBlock(s: SliceState, caseId: string): string | null {
  const m = s.punishmentKnight, f = m.practice, r = m.cases[caseId];
  if (!r?.contactOpen || r.attemptWeek !== s.week || r.method === null || !['OBSERVED', 'EXAMINED'].includes(r.status)) return '没有尚待实际结束的本次接触。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '须在原练习室的同一实际接触里收回原物或解除并让本人返回。';
  if (caseId === 'breach-and-pad') return f.pad === (r.status === 'EXAMINED' ? 'MAT' : 'STAND') && f.rule === (r.method === 'ABILITY' ? 'BREACHED' : 'NONE') && f.partner === 'FREE' && f.note === 'BLANK' ? null : '须保留本次真实越线和同一原软靶状态，才能亲手扶回原物、收起原线并结束训练。';
  if (caseId === 'willing-pause') return f.pad === 'STAND' && f.rule === 'NONE' && f.partner === (r.status === 'EXAMINED' && r.method === 'ABILITY' ? 'HELD' : 'FREE') && f.note === 'BLANK' ? null : '须保留阿伦本次真实停步状态，才能解除并让本人沿原短路返回。';
  return f.pad === 'STAND' && f.rule === 'NONE' && f.partner === 'FREE' && f.note === 'WRITTEN' && r.method === 'ORDINARY' ? null : '须先实际写过并持有同一原纸，才能亲手交付。';
}

function blocked(s: SliceState, c: PunishmentKnightActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockPunishmentKnightEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成惩戒骑士晋升。';
  const m = s.punishmentKnight, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return closeBlock(s, c.caseId);
  if (punishmentKnightInside(s)) return '先0行动实际复位同一原软靶与原线、解除并让本人走回，或亲手交付同一已写原纸。';
  if ([s.judge, s.interrogator, s.sheriff, s.arbiter].some(prior => Object.values(prior.cases).some(value => value.contactOpen))) return '先实际结束原序列尚未收束的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德薇娜的原调解处练习室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备；已经实施的接触须实际结束。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前尚未实施的准备。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已经报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践已发生，下一真实周再准备。' : c.caseId === 'wound-record' && c.method === 'ABILITY' ? '伤势记录只许普通书写，不制造伤口或伪造伤口裁决。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' || r.outcome === 'NONE' ? '先取得真实结果，并实际结束接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力需要3灵性，不能透支；可0行动取消准备后选择普通方法。' : null;
}

function practiceText(s: SliceState): string {
  const f = s.punishmentKnight.practice;
  return `同一原软靶PK5-SOFT-PAD-1为${f.pad}，原训练线PK5-LINE-1的本次规则为${f.rule}，阿伦为${f.partner}，同一原纸PK5-NOTE-1为${f.note}；原物所有权不变。`;
}
function resultText(s: SliceState, id: string): string {
  const r = s.punishmentKnight.cases[id]!;
  if (id === 'breach-and-pad') return r.method === 'ABILITY' ? '阿伦在薇娜观察下先实际越过刻意减弱的原训练线，才形成此次BREACHED事实；你随后实付的有限惩戒关联速度与力量只作用于同一PK5-SOFT-PAD-1，使原软靶落到原安全垫。阿伦自由且未受伤，训练不是法律判决。' : '阿伦本人先普通迈步跨过原线，你再用普通方法实际试击同一PK5-SOFT-PAD-1，使原软靶落到原安全垫；没有神秘禁令、惩戒或对人的伤害。';
  if (id === 'willing-pause') return r.method === 'ABILITY' ? '阿伦本次自愿试步确实被一次有限囚禁短暂阻住；不是精神控制或永久服从，必须实际解除并由本人走回。' : '阿伦听清普通口头约定后自行停步，始终FREE；没有施加囚禁或取消其自由选择。';
  return '你在同一PK5-NOTE-1上普通核对并写下已有实际伤势记录，或明确未观察到可记录伤势；没有创造伤口、推断隐藏伤势或实施伤口裁决。';
}

export function applyPunishmentKnightActivity(s: SliceState, c: PunishmentKnightActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validatePunishmentKnightCommand(c) || !isPunishmentKnightActivity(c)) throw new Error('惩戒骑士活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyPunishmentKnightEncounter(s, c, ctx); return; }
  const m = s.punishmentKnight, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    let closure: string;
    if (c.caseId === 'breach-and-pad') {
      const moved = f.pad === 'MAT'; f.pad = 'STAND'; f.rule = 'NONE';
      closure = (moved ? '你亲手从原安全垫扶起同一PK5-SOFT-PAD-1，稳放回原支架STAND。' : '同一PK5-SOFT-PAD-1仍在原支架，你亲手扶稳并核对。') + '你实际拾起同一PK5-LINE-1收回原盒，停止本次训练宣告并等候短效结束，规则回到NONE。阿伦始终自由，没有对他实施伤害。';
    } else if (c.caseId === 'willing-pause') {
      f.partner = 'FREE';
      closure = '你实际停止本次有限囚禁或普通停步约定，解除束缚并等候短效消退；阿伦本人沿原清楚短路实际走回原起点，恢复FREE。本次有限同意已经结束，下一次须重新核实，不留跨周囚禁或长期服从。';
    } else {
      f.note = 'HANDED_OVER';
      closure = '你亲手把已经写过的同一张PK5-NOTE-1实际交回薇娜·贝尔，由她当面接住收妥HANDED_OVER；失败文字同样保留，没有复制、远程转移或凭空补纸。';
    }
    r.contactOpen = false; r.closes += 1;
    ctx.note('原物与本人实际收束', '0行动、0额外灵性。' + closure + '收束时间已包含在原实践预算，真实结果与已付成本保留，不退款、不治疗、不奖励。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消方案与本次尚未实施的有限同意，原软靶仍在原支架、原线仍收在原盒，阿伦自由，原纸没有新增文字；没有施法、越线、击靶或囚禁。原观察与已付准备行动保留，不退款、不治疗。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('punishment-knight-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看真实动作、有限同意与伤势边界', '实际越线在先，惩戒练习只向原软靶；囚禁有本人当下同意和实际解除，伤势记录不制造伤口。三项原物与本人均已收束。G扮演+25，全普通和平100有实际成本，不伪造掌握；伤口裁决须有真实已有伤势，不是一句话必死，也不提前获得序列4能力剥夺。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability! : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `punishment-knight-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    const closed = p.id === 'breach-and-pad' ? '同一原软靶已亲手扶回原支架，原线收回原盒，训练宣告结束。' : p.id === 'willing-pause' ? '本次影响已实际解除，阿伦已沿原短路走回起点。' : '同一已写原纸已亲手交回薇娜。';
    ctx.note(p.title, resultText(s, p.id) + closed + '本次接触已结束，G扮演+25；' + (r.method === 'ABILITY' ? '真实成功的能力报告给予一次已有知识池随机单项掌握8。' : '普通方法不增加任何能力掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    ctx.note('本次有限能力已实付', '实际消耗3灵性，只有当前原现场的一次有限尝试；失败照付，不扩大范围，不保证成功。');
  }
  if (p.id === 'breach-and-pad') {
    if (r.method === 'ABILITY') f.rule = 'DECLARED';
    ctx.note('原线上的实际动作先发生', '你再次核实阿伦本次同意与停止信号，亲手从原盒取出同一PK5-LINE-1放在原地。' + (r.method === 'ABILITY' ? '你先宣告刻意减弱的“不越过这条训练线”；这不是绝对物理屏障。阿伦保留自己的选择，在薇娜现场观察下真实迈步跨过原线，实际越线在先，才记BREACHED。' : '没有任何神秘宣告，阿伦本人先真实迈步跨过同一原线，规则仍为NONE。') + '随后你才只向同一PK5-SOFT-PAD-1尝试击靶；阿伦不是攻击目标，未制造任何人的伤势。');
    f.rule = r.method === 'ABILITY' ? 'BREACHED' : 'NONE';
  } else if (p.id === 'willing-pause') {
    ctx.note('本人实际开始本次有限停步试验', '再次核实成年阿伦对本次短暂停步的明确同意与停止信号；他在原清楚短路实际开始试步。' + (r.method === 'ABILITY' ? '你此时才尝试一次有限囚禁，是否短暂阻住须实际判定。' : '你实际说出普通停步提示，由他自主决定停步，始终FREE。') + '无论成败，本次接触仍须实际结束并由本人走回原起点。');
  } else {
    const retry = f.note === 'HANDED_OVER'; f.note = 'WRITTEN';
    const wounds = s.injuries.length ? '现有实际伤势记录：' + s.injuries.map(injury => `${injury.id}（${injury.severity === 'HEAVY' ? '重伤' : '轻伤'}，${injury.treatedRevision === null ? '未治疗' : '已治疗'}）`).join('、') + '。只照录已有记录，不拿玩家伤势当成针对他人的裁决来源。' : '未观察到可记录伤势。';
    ctx.note('同一原纸已实际普通书写', '薇娜亲手递来同一PK5-NOTE-1，你接过后普通写下：' + wounds + (retry ? '之前失败文字保留，在同一原纸上核对和更正。' : '没有新造纸张或改变其归属。') + '阿伦没有因训练受伤，不创造伤口，也没有施展伤口裁决；核对失败仍留下文字并须亲手交付。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : p.id === 'breach-and-pad' ? 12 : 10);
  if (success(result.tier)) {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'breach-and-pad') f.pad = 'MAT';
    if (p.id === 'willing-pause' && r.method === 'ABILITY') f.partner = 'HELD';
    ctx.note(p.title, resultText(s, p.id) + '本次接触仍在，先0行动实际收束才能报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, '本次没有形成可报告结果，实际行动与已付灵性不退。' + (p.id === 'breach-and-pad' ? '阿伦确实已先越线，但击靶核对未成功，原软靶仍在原支架STAND；实际越线不等于成功惩戒，也不表示本人有罪。' : p.id === 'willing-pause' ? '本次未成功阻住或完整核对停步，阿伦仍FREE，不伪称已经囚禁。' : '同一原纸已实际写过，失败文字仍为WRITTEN，不创造新伤势。') + '先0行动实际收束，下一真实周重新准备和核实本次同意。' + practiceText(s));
}

export function punishmentKnightActions(s: SliceState): PunishmentKnightAction[] {
  if (!active(s)) return [];
  const out: PunishmentKnightAction[] = [];
  const add = (id: string, label: string, cost: string, command: PunishmentKnightActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.punishmentKnight.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'breach-and-pad' ? '亲手扶回原靶、收起原线并结束训练' : p.id === 'willing-pause' ? '实际解除，让阿伦沿原短路走回' : '亲手交回同一已写原纸', '0行动 · 0额外灵性 · 不退款、不治疗', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场、本人同意与有限边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.ability) add(`${p.id}-ability`, p.id === 'breach-and-pad' ? '准备真实越线后的安全原靶练习' : '准备本人同意的一次有限囚禁', '1行动 · 尚未施法或接触', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'wound-record' ? '准备普通核对同一伤势记录纸' : '准备同一原现场的普通方法', '1行动 · 0灵性 · 不伪造掌握', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际实施本次有限方案', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识14 · 失败照付' : `1行动 · 0灵性 · 知识${p.id === 'breach-and-pad' ? 12 : 10}`, { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 原物稳定 · 不退款', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告真实结果与实际收束', '1行动 · 扮演25 · 仅成功能力给掌握', { type: 'REPORT', caseId: p.id });
  }
  if (!s.punishmentKnight.reflected) add('punishment-knight-reflect', '回看真实动作、有限同意与伤势边界', '1行动 · 三份报告后 · 扮演25', { type: 'REFLECT' });
  if (s.punishmentKnight.encounter.status === 'AVAILABLE') {
    add('punishment-knight-encounter-talk', '到原调解处外院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('punishment-knight-encounter-fight', '到原调解处外院承担有限冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function punishmentKnightCases(s: SliceState): PunishmentKnightProjection['cases'] {
  if (!active(s)&&!(s.progression.pathwayId==='justiciar'&&(s.progression.sequence===4||s.progression.sequence===3))) return [];
  return CASES.map(p => {
    const r = s.punishmentKnight.cases[p.id]!;
    const closed = r.attemptWeek !== null && !r.contactOpen ? p.id === 'breach-and-pad' ? '同一原软靶已实际扶回原支架，原线收回原盒，本次宣告结束。' : p.id === 'willing-pause' ? '本次限制已实际解除，阿伦本人已沿原短路走回起点，有限同意结束。' : '同一已写原纸已亲手交回薇娜，失败文字也保留。' : '';
    let result: string | null = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(s, p.id) : r.attemptWeek !== null ? '上次没有取得可报告结果；真实动作与原物状态保留，已付成本不退。' : r.withdrawals ? '尚未实施的准备与本次有限同意已取消，没有施法。' : null;
    if (result !== null) result += closed + (r.contactOpen ? '本次接触仍在，须0行动实际收束。' : '') + practiceText(s);
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次真实接触尚未结束，须0行动实际收束' : '没有尚未收束的本次接触', closes: r.closes };
  });
}
export function punishmentKnightPractice(s: SliceState): PunishmentKnightProjection['practice'] { return { ...s.punishmentKnight.practice }; }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Every finite effect is tied to its original physical state and an actual current contact. */
export function validatePunishmentKnightLife(s: SliceState): boolean {
  const m = s.punishmentKnight;
  if (!record(m) || !record(m.cases) || !shape(m.cases, PUNISHMENT_KNIGHT_CASE_IDS) || !record(m.practice) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, promotion = m.promotionWeek ?? s.week;
  if (!shape(f, ['pad', 'partner', 'rule', 'note']) || !['STAND', 'MAT'].includes(f.pad) || !['FREE', 'HELD'].includes(f.partner) || !['NONE', 'DECLARED', 'BREACHED'].includes(f.rule) || !['BLANK', 'WRITTEN', 'HANDED_OVER'].includes(f.note)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week) || p.id === 'wound-record' && r.method === 'ABILITY') return false;
    if (s.seer.completedSources.filter(source => source === `punishment-knight-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.status === 'OBSERVED' && r.method !== null)) return false;
    if (r.attemptWeek !== null && (!r.contactOpen && r.closes < 1 || r.closes + (r.contactOpen ? 1 : 0) > r.attemptWeek - promotion + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!active(s) || !['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
    if (m.promotionWeek === null && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const pad = m.cases['breach-and-pad']!, pause = m.cases['willing-pause']!, note = m.cases['wound-record']!;
  if (f.pad !== (pad.contactOpen && pad.status === 'EXAMINED' ? 'MAT' : 'STAND')) return false;
  if (f.rule !== (pad.contactOpen && pad.method === 'ABILITY' ? 'BREACHED' : 'NONE')) return false;
  if (f.partner !== (pause.contactOpen && pause.status === 'EXAMINED' && pause.method === 'ABILITY' ? 'HELD' : 'FREE')) return false;
  if (f.note !== (note.contactOpen ? 'WRITTEN' : note.attemptWeek !== null ? 'HANDED_OVER' : 'BLANK')) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(source => source === 'punishment-knight-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId==='justiciar' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)) && ((s.progression.sequence===4||s.progression.sequence===3)?s.imperativeMage.punishmentKnightActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && m.reflected) return false;
  return true;
}
