import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyGuardianEncounter, blockGuardianEncounter, GUARDIAN_ENCOUNTER_STORY } from './encounter.js';
import { GUARDIAN_CASE_IDS, type GuardianCaseId, type GuardianCommand, type GuardianActivityCommand, type GuardianAction, type GuardianProjection } from './types.js';

const CASES = [
  {
    id: 'guarded-load', title: '不出手，承受原摆锤的一次轻触',
    story: '奥斯温·布莱克特带你查看原训练院已经清空的第一处标线角落。这里原有独立软垫摆锤GD5-PROBE-1与停摆扣；这一次由你本人同意接受低强度探测。摆锤不会攻击别处的人，也不需要幻造敌人。（原创G）',
    facts: ['观察先核对可见原摆锤、空地与停摆扣；准备只是约定方法，摆锤仍停止，你还没有进入守护状态。', '能力实施1行动、3灵性、意志14；本人放弃攻击接受一次原摆锤探测。G基准6健康的轻量探测，成功实际承受1健康，失败仍承受2健康。', '普通方法亲手检查并把同一原摆锤移出试压位置，0灵性、0伤害；移除后不再凭空添一具重做。', '实施后的0行动收束停止原摆锤并解除本人守护姿态；已受伤势保留。第二、第三项各有事先存在的独立原摆锤，不重置这一具。'],
    ability: '只准备由自己承受这一次低强度探测；现在不摆动原锤、不守护也不攻击。实施另耗3灵性，意志14；成功健康−1，失败健康−2，均须实际停摆收束。',
    ordinary: '准备普通检查停摆扣，并亲手把同一具GD5-PROBE-1移出试压位置；实施0灵性、0伤害，移除事实保留。',
    abilityResult: '你放弃攻击，实际进入守护状态，承受GD5-PROBE-1的一次原软垫探测。G基准6健康的冲击减到1健康，已经实际扣除；不是免伤或凭空治疗。',
    ordinaryResult: '你亲手检查停摆扣，将同一具GD5-PROBE-1移出试压位置，原探测源已经移除。没有启动探测、消耗灵性或宣称使用了守护能力。',
    failure: '守护核对未成，但你确实没有攻击并承受了一次原软垫探测；G基准6减到2健康，伤势和已付成本已经保留。',
    abilityOutcome: 'GUARD_TESTED', ordinaryOutcome: 'PROBE_REMOVED',
  },
  {
    id: 'lowered-guard', title: '出手时，防御随之降低',
    story: '原训练院第二处标线有另一具原软垫摆锤GD5-PROBE-2和唯一原纸靶GD5-TARGET-1。奥斯温已检查周围没有其他人；你的目标只是原纸靶，用本人拳脚或已持有的原短棍出手，不免费凝出晨曦剑。（原创G）',
    facts: ['第二具原摆锤与第一项独立，第一项已经移除的原物不会重新出现；GD5-TARGET-1只有这一张。', '能力实施1行动、3灵性、意志14；实际放低守护、用自身或手中原棍击中纸靶，留下MARKED痕迹。', '出手时防御降低：无论核对成败，这一次G基准6的探测实际造成3健康损失；失败也不擦除原纸靶痕迹。', '普通方法亲手卸下同一张原纸靶并拆下第二原摆锤，0灵性、0伤害。收束只停止原探测、收回手脚，不复原纸靶也不治疗。'],
    ability: '准备实际放低守护并用本人身体或已持有原短棍击中原纸靶；此刻尚未攻击。实施3灵性、意志14，实际健康−3；不凝剑、不复制纸靶。',
    ordinary: '准备普通卸下唯一原纸靶和第二原摆锤；实施0灵性、0伤害，拆除后原纸靶不自动复原。',
    abilityResult: '你实际放低守护，用本人身体或已持有原短棍击中同一张GD5-TARGET-1，纸靶留下痕迹。出手时防御降低，第二原摆锤的G基准6探测实际造成3健康损失；没有免费凝剑。',
    ordinaryResult: '你亲手卸下同一张GD5-TARGET-1，并拆下第二具原软垫摆锤。原纸靶保持拆除状态，没有攻击、灵性消耗或新伤，也没有补出另一张纸靶。',
    failure: '本次防御变化核对未成；实际出手和原纸靶痕迹已经发生，第二原摆锤仍实际造成3健康损失。不能以失败取消攻击、伤势或把原纸靶换新。',
    abilityOutcome: 'ATTACK_TESTED', ordinaryOutcome: 'TARGET_DISMANTLED',
  },
  {
    id: 'nearby-companion', title: '维拉走到两米标线，由你承担一半',
    story: '同一位成年院工维拉为这一次有限伤害分担试验另行明确同意。她先在原训练院紧邻第三处的原等候点等候，第三具原软垫摆锤GD5-PROBE-3、两米标线路径和停摆扣都已存在。准备不把她带进试压位置；只有实际实施才由她沿原路走到距你两米的标线。（原创G）',
    facts: ['维拉本人可拒绝进一步试验；只有这一次同意生效，不沿用搬门、错身或旧练习的同意。健康显示及全部探测数值均为本场原创G。', '能力实施1行动、3灵性、意志14；你须健康高于10，维拉须健康高于12。她实际走两米到位，你守护且不攻击，她接受一次G基准6的原软垫探测。', '本场G分担范围3米：成功时两米内的维拉承受3健康、你承担另3健康；失败未能转移，你承受0、她实际承受6。没有先扣她6再额外扣3。', '0行动收束实际停摆、解除守护，再由维拉沿同一条两米路走回原等候点；她的伤势持久保留，不因离开或下周恢复。普通方法是双方沿标记退路离开探测范围并停止原摆锤，0灵性、0伤害。'],
    ability: '只约定本次有限分担与原两米去回路线，维拉现在仍在原等候点。实施时她才实际走到两米标线，你另耗3灵性、意志14守护且不攻击；成功双方各损3健康，失败她损6、你损0。',
    ordinary: '准备与维拉共同停止第三原摆锤、沿原标记退路避开探测范围；她不进入承压标线，实施0灵性、0伤害，没有虚假的伤害分担。',
    abilityResult: '维拉本人沿原两米路径实际走到距你两米的标线，你守护且没有攻击。第三原软垫探测只发生一次：G基准6中她承受3健康，你在3米内实际分担3健康。两人的实际伤势各扣一次，没有替她复原健康。',
    ordinaryResult: '你与维拉共同扣住第三原摆锤的停摆扣，沿原标记退路实际避开探测范围，她没有进入承压标线。双方都未受伤，0灵性；这是普通退出，没有伤害转移或虚拟同伴。',
    failure: '维拉已经亲自沿两米原路走到标线，你进入守护且没有攻击，但这一次未能转移伤害。第三原软垫探测只发生一次，她实际承受6健康，你承受0；伤势不会在收束时消失。',
    abilityOutcome: 'SHARE_TESTED', ordinaryOutcome: 'BOTH_WITHDRAWN',
  },
] as const;
type Case = typeof CASES[number];
const promoted = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 5;
export const GUARDIAN_ENVIRONMENT = '奥斯温的原训练院中，三项有限实践分别是全力守护且不出手、出手后的防御降低、为两米内本人同意的成年维拉分担伤害。人物、原标线、三具独立软垫探测源、唯一原纸靶、距离和全部数值都是原创G。每案观察、准备、实施、报告各1行动；能力实施3灵性、意志14，原低强探测基准6健康，不冒充实战武器伤害。第一案成功损1、失败损2；第二案无论成败损3并留下原靶痕迹；第三案成功双方各损3、失败维拉损6本人0，G范围3米。维拉只有实施时才沿原两米路实际到位。准备不是在场接触；实施后即使0行动也可实际停摆、解除守护、由她走原路回等候点。已付成本、双方伤势和原物变化持久保留，不治疗、不复制原物；失败先收束，下一真实周可再准备。普通方法是实际移除原探测源、拆原纸靶或双方退出，不耗灵性、不受伤。三案报告各G扮演25，能力报告另有一次已有知识池单项掌握8，普通报告无能力奖励，反思25可和平100。守护者不受普通幻象欺骗的原著边界不等于读心、识别邪恶或预先获得猎魔者能力。' + GUARDIAN_ENCOUNTER_STORY;
export const guardianInside = (s: SliceState) => Object.values(s.guardian.cases).some(r => r.contactOpen) || s.guardian.practice.guardActive || s.guardian.practice.allyPresent;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export const isGuardianActivity = (c: GuardianCommand): c is GuardianActivityCommand => record(c) && ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
function validActivity(c: unknown): c is GuardianActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!GUARDIAN_CASE_IDS.includes(c.caseId as GuardianCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: GuardianActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!promoted(s)) return '先完成守护者晋升。';
  const m = s.guardian, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德奥斯温的原训练院，不能借收束让人瞬移。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次探测接触。';
  if (guardianInside(s)) return '先0行动实际停摆、解除守护，并让已经到位的维拉沿两米原路返回。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或0行动取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockGuardianEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成，原物和伤势保持实际结果。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原探测源、停止方法和本次同意已经核对。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际停摆收束。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与这一次有限同意。' : r.attemptWeek === s.week ? '本周实际尝试、伤势和成本保留，下一真实周再准备。' : null;
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才可重试。';
  if (r.method !== 'ABILITY') return null;
  if (s.spirituality < 3) return '本次能力需要3灵性；可0行动取消准备、休养或改用普通方法。';
  if (s.health <= 10) return '本人健康须高于10，才能承受这一次有限原探测；可取消准备改用普通方法。';
  return c.caseId === 'nearby-companion' && m.practice.allyHealth <= 12 ? '维拉的实际健康须高于12；既往伤势保留，可取消准备，双方普通退出。' : null;
}
const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => method === 'ABILITY' ? p.abilityResult : p.ordinaryResult;
const practiceText = (s: SliceState) => {
  const f = s.guardian.practice;
  return `当前${f.guardActive ? '仍在守护，必须停摆解除' : '没有持续守护姿态'}；原纸靶${f.target === 'INTACT' ? '完整' : f.target === 'MARKED' ? '留有实际攻击痕迹' : '已经拆除'}。维拉${f.allyPresent ? `实际在${f.allyDistance}米标线，须沿原路走回` : '不在承压标线'}，健康${f.allyHealth}/100。累计实际探测${f.probes}次、本人受伤${f.playerDamageTaken}、维拉受伤${f.allyDamageTaken}，其中本人分担${f.sharedDamage}；已发生的伤势不因收束复原。`;
};
export function applyGuardianActivity(s: SliceState, c: GuardianActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('守护者实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyGuardianEncounter(s, c, ctx); return; }
  const m = s.guardian, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!, returning = f.allyPresent;
    f.guardActive = false; f.allyPresent = false; f.allyDistance = null; r.contactOpen = false; r.closes += 1;
    ctx.note('实际停摆与原路收束', '0行动实际扣住本次原摆锤、停止接触，解除本人守护并收回手脚。' + (returning ? '维拉本人沿同一条两米原路径实际走回相邻的原等候点；她的健康和既往伤势保持原值。' : '维拉没有从别处出现，原物保持实际移除、拆除或受击状态。') + '已付行动与灵性不返，不治疗、不恢复纸靶、不另行奖励。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消这一次计划，原观察及已付准备行动保留。尚未开始新的探测、守护或攻击，维拉没有进入承压标线；此前真实伤势与原物变化不重置。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('guardian-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看放弃攻击与实际承担', '守护时放弃攻击，出手便降低防御；替近旁自愿同伴分担的伤害由自己真实承担。普通停摆、拆除与退出也完成有限帮助，不能把同伴伤势抹去。G扮演+25，不另给能力掌握。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '此刻只观察，没有启动探测、进入守护或把维拉带到承压标线。'); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `guardian-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, '本次实施记录：' + resultText(p, r.method!) + '随后已经实际停摆、解除守护，已到位者沿原路返回。G扮演+25；' + (r.method === 'ABILITY' ? '能力报告获一次已有知识池单项掌握+8。' : '普通报告不冒充能力掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ORDINARY') {
    if (p.id === 'lowered-guard') f.target = 'DISMANTLED';
    r.status = 'EXAMINED'; r.outcome = p.ordinaryOutcome;
    ctx.note(p.title, p.ordinaryResult + '还须0行动结束这次原现场操作后才能报告。' + practiceText(s)); return;
  }
  s.spirituality -= 3;
  const result = ctx.check('will', 14), success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  f.probes += 1;
  let playerDamage = 0;
  if (p.id === 'guarded-load') { f.guardActive = true; playerDamage = success ? 1 : 2; }
  else if (p.id === 'lowered-guard') { f.guardActive = false; f.playerAttacked = true; f.target = 'MARKED'; playerDamage = 3; }
  else {
    f.guardActive = true; f.allyPresent = true; f.allyDistance = 2;
    playerDamage = success ? 3 : 0;
    const allyDamage = 6 - playerDamage;
    f.sharedDamage += playerDamage; f.allyDamageTaken += allyDamage; f.allyHealth -= allyDamage;
  }
  s.health -= playerDamage; f.playerDamageTaken += playerDamage;
  r.status = success ? 'EXAMINED' : 'OBSERVED'; r.outcome = success ? p.abilityOutcome : 'NONE';
  ctx.note(p.title, (success ? p.abilityResult : p.failure) + (success ? '本次实际接触仍须0行动收束后才能报告。' : '已付1行动与3灵性不返；先0行动实际停摆收束，下一真实周可再准备。') + practiceText(s));
}
export function guardianActions(s: SliceState): GuardianAction[] {
  if (!promoted(s)) return [];
  const out: GuardianAction[] = [], m = s.guardian;
  const add = (id: string, label: string, cost: string, command: GuardianActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际停摆、收回手脚并按原路收束', '0行动 · 双方伤势与原物变化保留', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原探测源、退路与这一次同意', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'guarded-load' ? '准备不出手的守护探测' : p.id === 'lowered-guard' ? '准备出手后防御降低的比较' : '约定维拉实际到位后的有限分担', '1行动 · 此刻不接触 · 实施另3灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'guarded-load' ? '准备普通移除第一原摆锤' : p.id === 'lowered-guard' ? '准备拆下唯一原靶与第二原摆锤' : '准备双方普通停摆退出', '1行动 · 实施0灵性、0伤害', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      const injury = p.id === 'guarded-load' ? '成功健康−1、失败−2' : p.id === 'lowered-guard' ? '健康−3 · 原靶留痕' : '成功双方各−3、失败维拉−6';
      add(p.id + '-perform', r.method === 'ABILITY' ? '实际进行本次有限守护探测' : '实际普通停摆、移除或退出', r.method === 'ABILITY' ? '1行动 · 3灵性 · 意志14 · ' + injury : '1行动 · 0灵性 · 0伤害', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 成本与既往伤势保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告实际防护、伤势与原物结果', '1行动 · 先实际停摆收束', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('guardian-reflect', '回看放弃攻击与实际承担', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('guardian-encounter-talk', '前往原外院与埃德温当面澄清', '1行动 · 先完成一项报告', { type: 'ENCOUNTER_TALK' });
    add('guardian-encounter-fight', '前往原外院并承担有限冲突', '1行动 · 真实伤势与死亡风险 · 无同伴参战', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function guardianCases(s: SliceState): GuardianProjection['cases'] {
  if (!(s.progression.pathwayId==='warrior'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))) return [];
  return CASES.map(p => {
    const r = s.guardian.cases[p.id]!;
    const closed = r.attemptWeek !== null && !r.contactOpen ? '这次实施之后已经实际停摆、收束，双方伤势与原物结果继续保留。' : '';
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? '本次实施记录：' + resultText(p, r.method!) + closed + practiceText(s)
      : r.attemptWeek !== null ? `第${r.attemptWeek}周核对未成，实际探测、伤势、原靶痕迹及已付成本保留；先收束，下一真实周再准备。` + closed + practiceText(s)
        : r.withdrawals ? '尚未实施的准备已取消，没有开始探测、攻击或守护，维拉没有进入承压标线。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '须0行动实际停摆、解除姿态并按原路收束' : '没有尚未结束的本次探测接触', closes: r.closes };
  });
}
export function guardianPractice(s: SliceState): GuardianProjection['practice'] {
  if (!(s.progression.pathwayId==='warrior'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))) return null;
  const f = s.guardian.practice;
  return {
    guard: (f.guardActive ? '当前守护中，放弃攻击；须实际停摆解除' : '当前没有持续守护姿态') + `；本人累计受伤${f.playerDamageTaken}`,
    target: `GD5-TARGET-1 · 唯一原纸靶 · ${f.target === 'INTACT' ? '完整' : f.target === 'MARKED' ? '已有实际攻击痕迹' : '已经亲手拆除，不复原'}`,
    companion: `成年维拉 · ${f.allyPresent ? `已经沿原路走到${f.allyDistance}米标线，须实际走两米返回` : '不在承压标线，没有被召来参战'} · 健康${f.allyHealth}/100 · 累计受伤${f.allyDamageTaken} · 本人已替她分担${f.sharedDamage}`,
    history: [`原探测实际发生${f.probes}次；本人累计受伤${f.playerDamageTaken}，其中实际分担维拉伤害${f.sharedDamage}`, f.playerAttacked ? '本人已经真实出手，原靶痕迹或拆除结果保留；出手时降低守护防御' : '本段尚未真实攻击原靶', '维拉的健康不会在离开、报告或下一周自动恢复；三具探测源各是事先存在的原物', '普通幻象不欺骗守护者不等于读心、邪恶鉴定或获得序列4猎魔者能力'],
  };
}

/** One probe per actual ability attempt; persistent injuries are counted exactly once. */
export function validateGuardianLife(s: SliceState): boolean {
  const m = s.guardian;
  if (!record(m) || !record(m.cases) || !shape(m.cases, GUARDIAN_CASE_IDS) || !record(m.practice) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice;
  if (!shape(f, ['guardActive', 'playerAttacked', 'probes', 'playerDamageTaken', 'allyPresent', 'allyDistance', 'allyHealth', 'allyDamageTaken', 'sharedDamage', 'target'])) return false;
  if (![f.guardActive, f.playerAttacked, f.allyPresent].every(x => typeof x === 'boolean') || !['INTACT', 'MARKED', 'DISMANTLED'].includes(f.target)) return false;
  if (![f.probes, f.playerDamageTaken, f.allyDamageTaken, f.sharedDamage].every(x => integer(x, 0)) || !integer(f.allyHealth, 0, 100)) return false;
  if (f.allyDistance !== null && f.allyDistance !== 2 || f.allyHealth !== 100 - f.allyDamageTaken) return false;
  const firstWeek = m.promotionWeek ?? s.week;
  let open = 0, prepared = 0, resolved = 0;
  const attempts: number[] = [], successes: boolean[] = [];
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, s.week - firstWeek + 1) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string) || r.attemptWeek !== null && !integer(r.attemptWeek, firstWeek, s.week)) return false;
    const successful = ['EXAMINED', 'RESOLVED'].includes(r.status as string);
    if (successful ? r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome) : r.outcome !== 'NONE') return false;
    if (s.seer.completedSources.filter(x => x === `guardian-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - firstWeek + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || r.closes >= r.attemptWeek - firstWeek + 1) return false;
      if (r.method === 'ORDINARY' && !successful) return false;
    }
    if (!(s.progression.pathwayId==='warrior'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    attempts.push(r.closes + Number(r.contactOpen) - Number(successful && r.method === 'ORDINARY'));
    successes.push(successful && r.method === 'ABILITY');
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const guard = m.cases['guarded-load']!, attack = m.cases['lowered-guard']!, share = m.cases['nearby-companion']!;
  const guardOpen = guard.contactOpen && guard.method === 'ABILITY', shareOpen = share.contactOpen && share.method === 'ABILITY';
  if (f.guardActive !== (guardOpen || shareOpen) || f.allyPresent !== shareOpen || f.allyDistance !== (shareOpen ? 2 : null)) return false;
  const [guardAttempts, attackAttempts, shareAttempts] = attempts as [number, number, number];
  const shared = Number(successes[2]) * 3;
  if (shareAttempts > 15 || f.allyHealth < 10) return false;
  if (f.probes !== guardAttempts + attackAttempts + shareAttempts || f.sharedDamage !== shared || f.allyDamageTaken !== shareAttempts * 6 - shared) return false;
  if (f.playerDamageTaken !== guardAttempts * 2 - Number(successes[0]) + attackAttempts * 3 + shared || f.playerAttacked !== (attackAttempts > 0)) return false;
  const target = attack.outcome === 'TARGET_DISMANTLED' ? 'DISMANTLED' : attackAttempts > 0 ? 'MARKED' : 'INTACT';
  if (f.target !== target) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'guardian-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!(s.progression.pathwayId==='warrior'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) && (m.reflected || f.probes !== 0)) return false;
  return !(s.progression.pathwayId==='warrior'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) || ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.demonHunter.guardianActingAtPromotion:s.progression.acting) === resolved * 25 + (m.reflected ? 25 : 0);
}
