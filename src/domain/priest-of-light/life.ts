import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyPriestOfLightEncounter, blockPriestOfLightEncounter, PRIEST_OF_LIGHT_ENCOUNTER_STORY } from './encounter.js';
import { PRIEST_OF_LIGHT_CASE_IDS, type PriestOfLightCaseId, type PriestOfLightCommand, type PriestOfLightActivityCommand, type PriestOfLightAction, type PriestOfLightProjection } from './types.js';

const CASES = [
  {
    id: 'darkened-walk', title: '原暗工作间里的三米短路',
    story: '导师在原私人工作间留下同一条3米普通短路、一处原标记和一盏原普通暗灯。你实际核对有限照明与夜间视物，或者用原暗灯普通照看短路；现场没有伤者、恐惧诅咒或等待复活的人。原工作间、标记、距离与数值均为原创G。',
    facts: ['原工作间只有3米短路和同一原标记，有限亮光不能冒充序列4无暗领域。', '能力实施1灵性、知识14，实际用有限神圣之光照亮本段并核对夜间视物，失败照耗。', '普通方法使用现场同一盏原普通暗灯，知识10、0灵性；灯和标记不进入库存。'],
    ability: '准备以有限神圣之光照看原3米短路，核对夜间视物；实施1灵性、知识14，不治疗、不复活，也不解除一切恐惧。',
    ordinary: '准备实际持原普通暗灯核对同一段短路和标记；实施知识10、0灵性，没有使用神圣之光。',
    spirit: 1, abilityStat: 'knowledge', abilityOutcome: 'LIGHT_CHECKED', ordinaryOutcome: 'LAMP_COMPARED',
    abilityResult: '你支付1灵性实际用有限神圣之光照亮同一原3米短路并核对夜间视物，确认原标记；这不生成无暗领域、不治疗身体或精神、不保证驱散全部恐惧。',
    ordinaryResult: '你实际以现场同一盏原普通暗灯照看3米短路并核对原标记；没有施法，原灯仍留在工作间。',
    close: '你实际停止本次有限照明或普通暗灯核对，将原灯留回原处，再从原普通出口离开。',
  },
  {
    id: 'bounded-cleansing', title: '同一块原石板的有限死气残留',
    story: '导师在原空工作间封存着同一块原石板SLATE，其上只有一处已核验的有限旧死气残留。这里没有活人、身体、非凡特性或宇宙污染。能力只尝试减弱这处原残留一次；普通方法则由导师实际把同一原石板放入原普通封存容器并移回保管处，不把普通封存写成净化。原石板、残留与保管安排均为原创G。',
    facts: ['同一原石板SLATE与同一处有限旧死气残留始终保持身份，不重置、不生成新残留或可领取物品。', '能力实施2灵性、知识14；成功只把原残留由PRESENT减弱为REDUCED一次，不声称彻底清空一切污染。', '普通实施知识10、0灵性，导师实际用原普通容器封存并移走同一原石板；SEALED表示保管，不代表能力净化。'],
    ability: '准备以一次有限神圣之光尝试减弱同一原石板的旧死气；实施2灵性、知识14，失败保留原残留与成本。',
    ordinary: '准备协助导师把同一原石板放入原普通容器、封存并移回原保管处；实施知识10、0灵性，不声称残留被净化。',
    spirit: 2, abilityStat: 'knowledge', abilityOutcome: 'TRACE_REDUCED', ordinaryOutcome: 'TRACE_SEALED',
    abilityResult: '你支付2灵性实际施用有限神圣之光，使同一原石板SLATE上的旧死气残留减弱一次，状态为REDUCED。原石板仍是原物，没有新增或重置残留，没有净化非凡特性或任何活人。',
    ordinaryResult: '你与导师实际把同一原石板SLATE放入原普通封存容器，并由导师移回原保管处，状态为SEALED。原残留只是被普通封存，未被能力净化，容器与石板不进入库存。',
    close: '你实际停止本次有限神圣之光或普通封存接触，把同一原石板与原容器留给导师保管，再从原普通出口离开；已减弱或封存的事实保持。',
  },
  {
    id: 'mixed-company', title: '原灯里的友善灵体也会被波及',
    story: '原成年协作者诺拉在原排练区2米近处，属于她的同一盏原灯内确实有友善小灵体“栖灯”，也在2米处。栖灯知情接受本次有限安全核对；它不是玩家宠物、道具奖励或假装成灵体的普通标记。本次净化光环仅用明确原创G的5米范围。主人须亲自把原灯与其中同一原灵体沿原8米普通步道送到范围外的遮蔽点，放稳后自己走回近处，才能安全核对能力；友善关系不会让灵体自动免疫。人物、灵体、同意安排、原路与数值均为原创G。',
    facts: ['同一原灯与真实友善灵体栖灯最初均在NEAR原2米近处；MOVE_LANTERN是成年主人亲自沿原8米步道搬运原灯和原灵体到SHELTER，不是传送或换灯。', '本次5米有限净化光环3灵性、意志14。原普通成年协作者不因争执被标成邪恶；近处友善灵体仍会短暂不适并受驱斥，不会被杀死、抹除或变成奖励。', 'CLOSE明确停环，CLEAR_SPIRIT须停环后由原主人陪同普通安抚与等待恢复，RETURN_LANTERN须主人沿原8米路线真实搬回原灯与原灵体；三项互不代替。'],
    ability: '准备一次5米范围有限净化光环；实施3灵性、意志14。先请原主人真实搬走原灯与栖灯才可取得合格结果；若仍在近处，友善灵体也会短暂不适，必须停环后收尾。',
    ordinary: '准备以原地普通标线核对5米范围，并由原主人确认原灯与灵体位置；实施知识10、0灵性，不打开光环，不净化或驱斥灵体。',
    spirit: 3, abilityStat: 'will', abilityOutcome: 'SPIRIT_SHELTERED', ordinaryOutcome: 'RADIUS_CHECKED',
    abilityResult: '你支付3灵性实际打开本次5米有限净化光环；原主人此前已亲自沿原8米步道搬运同一原灯与栖灯到SHELTER，自己普通走回2米近处，本次原灵体没有受到范围作用。普通成年协作者没有因身份或争执被判为邪恶；友善灵体也没有获得自动免疫。',
    ordinaryResult: '你实际核对原5米普通标线，由原主人确认同一原灯与栖灯的位置。没有打开净化光环，没有消耗灵性、驱斥或净化灵体，也没有增加魔法掌握。',
    close: '你实际关闭本次净化光环或停止普通标线核对，结束本次原接触。已经发生的灵体不适和原灯位置保留；须分别由原主人陪同恢复与沿原8米步道真实搬回。',
  },
] as const;
type Case = typeof CASES[number];

export const PRIEST_OF_LIGHT_ENVIRONMENT = '三项明确原创G实践：原3米暗工作间的有限照明与夜间视物；同一原石板SLATE上一处有限旧死气；同一原灯中的真实友善灵体栖灯与原成年主人，2米近处、原8米普通路线和本次5米有限光环。观察、准备、实施、报告各1行动；CLOSE、MOVE_LANTERN、CLEAR_SPIRIT、RETURN_LANTERN、WITHDRAW各0行动。有限照明1灵性/知识14，原残留减弱2灵性/知识14，净化光环3灵性/意志14；普通方法均知识10、0灵性。失败照耗，结束后下一真实周重试。报告各G扮演25，实际能力成功报告只按已有知识池给单项掌握8；三案反思另25，可全普通和平100。准备本身不阻止日常生活；实际接触、光环未停、灵体仍不适、原灯尚在遮蔽点或身体仍在CHAMBER/ICE时须真实退出返回，0行动收尾始终可用。普通封存不冒充净化，友善灵体不自动免疫；不治疗、复活、解除所有恐惧、净化非凡特性或提前获得序列4无暗领域。 ' + PRIEST_OF_LIGHT_ENCOUNTER_STORY;
const promoted = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 5;
const inherited = (s: SliceState) => s.progression.pathwayId === 'sun' && (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && typeof s.unshadowed?.promotionWeek === 'number';
export const priestOfLightInside = (s: SliceState) => s.priestOfLight.ritual.location !== 'GUIDE' || s.priestOfLight.practice.auraOpen || s.priestOfLight.practice.spiritDistressed || s.priestOfLight.practice.lanternPosition === 'SHELTER' || Object.values(s.priestOfLight.cases).some(r => r.contactOpen);
export const isPriestOfLightActivity = (c: PriestOfLightCommand): c is PriestOfLightActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'MOVE_LANTERN', 'RETURN_LANTERN', 'CLEAR_SPIRIT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validatePriestOfLightActivityCommand(c: unknown): c is PriestOfLightActivityCommand {
  if (!record(c)) return false;
  if (['MOVE_LANTERN', 'RETURN_LANTERN', 'CLEAR_SPIRIT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!PRIEST_OF_LIGHT_CASE_IDS.includes(c.caseId as PriestOfLightCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: PriestOfLightActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!promoted(s)) return '先完成光之祭司晋升。';
  const m = s.priestOfLight, f = m.practice, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND' || m.ritual.location !== 'GUIDE') return '先由原协助者实际结束冰内仪式并沿原路回到导师处；不能以实践收尾代替身体返程。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次原现场接触。';
  if (c.type === 'CLEAR_SPIRIT') return f.auraOpen ? '先明确关闭净化光环，不能边驱斥边恢复本次不适。' : f.spiritDistressed ? null : '原灵体栖灯没有尚待处理的本次不适。';
  if (c.type === 'RETURN_LANTERN') return f.auraOpen ? '先明确关闭光环，不能把原灯与栖灯搬回仍在作用的近处。' : f.lanternPosition === 'SHELTER' ? null : '原灯与栖灯已经在原近处，没有可伪造的返程。';
  if (c.type === 'MOVE_LANTERN') {
    if (m.cases['mixed-company'].status !== 'PREPARED') return '先观察并准备原共同排练，才能请求原主人搬运原灯与栖灯。';
    if (f.lanternPosition !== 'NEAR') return '原灯与栖灯已经实际到原遮蔽点。';
    return f.auraOpen || f.spiritDistressed || Object.values(m.cases).some(x => x.contactOpen) ? '先结束本次接触与光环，并由原主人处理已发生的不适。' : null;
  }
  const shelteredPreparation = c.type === 'PERFORM' && c.caseId === 'mixed-company' && r?.status === 'PREPARED' && f.lanternPosition === 'SHELTER' && !f.auraOpen && !f.spiritDistressed && !Object.values(m.cases).some(x => x.contactOpen);
  const shelteredWithdrawal = c.type === 'WITHDRAW' && c.caseId === 'mixed-company' && r?.status === 'PREPARED' && !f.auraOpen && !f.spiritDistressed && !Object.values(m.cases).some(x => x.contactOpen);
  if (priestOfLightInside(s) && !shelteredPreparation && !shelteredWithdrawal) return '先0行动明确停止接触与光环、由原主人陪同恢复灵体不适，并沿原8米步道实际搬回同一原灯与栖灯；这些动作互不代替。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockPriestOfLightEncounter(s, c);
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id].status !== 'RESOLVED') ? '先完成三项真实有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  const p = CASES.find(p => p.id === c.caseId)!;
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场观察已经保留。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先实际观察本项原现场。' : r.attemptWeek === s.week ? '本周实际尝试与成本保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得合格有限结果，明确结束接触，并完成本次原灯返回与灵体恢复。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才能重试。';
  if (p.id === 'bounded-cleansing' && f.trace !== 'PRESENT') return '同一原残留已经减弱或封存，不能生成、重置或重复处理它。';
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次实际能力需要${p.spirit}灵性，可取消准备后选择普通方法。` : null;
}
function practiceHistory(s: SliceState): string[] {
  const f = s.priestOfLight.practice;
  return [`实际有限照明尝试${f.lightChecks}次，实际有限光环尝试${f.auraChecks}次。`, f.trace === 'PRESENT' ? '同一原石板SLATE上的有限旧死气残留仍在，尚未减弱或封存。' : f.trace === 'REDUCED' ? '同一原石板SLATE的原残留已被有限神圣之光减弱一次；没有重置或无限生成。' : '同一原石板SLATE与原残留已由导师实际放入原普通容器封存并移回保管处；未使用能力净化。', '原成年主人亲自沿原8米步道搬运同一原灯与栖灯；停环、普通安抚恢复与真实搬回分别记录，不把友善当成免疫，也不改变原灵体归属。'];
}
function resultText(s: SliceState, p: Case): string { return s.priestOfLight.cases[p.id].method === 'ABILITY' ? p.abilityResult : p.ordinaryResult; }
export function applyPriestOfLightActivity(s: SliceState, c: PriestOfLightActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validatePriestOfLightActivityCommand(c)) throw new Error('光之祭司实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyPriestOfLightEncounter(s, c, ctx); return; }
  const m = s.priestOfLight, f = m.practice;
  if (c.type === 'MOVE_LANTERN') {
    f.lanternPosition = 'SHELTER';
    ctx.note('原主人亲自搬运同一原灯与栖灯', '0行动，属于这次已经付费准备的有限排练安排。原成年主人诺拉与栖灯接受本次请求，她亲自沿原8米普通步道把同一原灯与其中真实灵体搬到本次5米范围外的SHELTER，放稳后自己沿原路走回2米近处。没有传送、强制控制、替换原灯或让栖灯自动免疫；原灯与原灵体仍须另外实际搬回。'); return;
  }
  if (c.type === 'RETURN_LANTERN') {
    f.lanternPosition = 'NEAR';
    ctx.note('原主人沿原路实际搬回同一原灯与栖灯', '光环已经明确停止。0行动，原成年主人实际走到遮蔽点，再沿同一原8米普通步道把同一原灯与栖灯搬回NEAR原2米近处；没有瞬移，不代替CLOSE或CLEAR_SPIRIT，不增加扮演、掌握或玩家资源。'); return;
  }
  if (c.type === 'CLEAR_SPIRIT') {
    f.spiritDistressed = false;
    ctx.note('停环后由原主人陪同恢复本次不适', '光环已经明确停止。0行动，原主人陪同同一原灯中的栖灯，普通安抚并实际等待，确认本次暂时不适与驱斥反应消退。栖灯没有死亡、被净化抹除或成为奖励；这不是魔法治疗，不恢复玩家身体、精神、灵性或行动，也不改写本次未通过的结果。'); return;
  }
  if (c.type === 'CLOSE') {
    const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id];
    r.contactOpen = false; r.closes += 1;
    if (p.id === 'mixed-company') f.auraOpen = false;
    ctx.note('明确停止本次能力并结束原接触', '0行动。' + p.close + '已付行动与灵性不返还，成功或失败记录保留，不治疗、不增加掌握或扮演。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动，原观察与已付准备行动保留，没有实施能力。原灯与栖灯若已到SHELTER，仍须单独RETURN_LANTERN由原主人真实搬回；取消准备不会移动原物、打开光环或清除不适。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('priest-of-light-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('照明、原残留与友善灵体各有真实边界', '回看原短路、同一原石板与原灯中的栖灯。G扮演+25；有限照明不能治疗或复活，普通封存不等于能力净化，友善灵体仍可能被净化光环波及。停环、普通恢复与主人实际搬回互不代替，不将人判为邪恶，也不提前获得无暗领域。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id];
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED';
    ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '本次只实际核对原现场，没有施法、减弱或封存残留，也没有搬运原灯。观察后已离开，没有尚待结束的接触。'); return;
  }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `priest-of-light-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(s, p) + (r.method === 'ABILITY' ? '本次现场已实际结束，原灯已在NEAR且栖灯没有待处理的不适。报告G扮演+25、已有知识池单项掌握+8。' : '本次现场已实际结束，原灯已在NEAR且栖灯没有待处理的不适。普通报告G扮演+25，仅保留本案来源，不增加魔法掌握。')); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true; r.outcome = 'NONE';
  if (r.method === 'ABILITY') {
    s.spirituality -= p.spirit;
    if (p.id === 'mixed-company') {
      f.auraOpen = true; f.auraChecks += 1;
      if (f.lanternPosition === 'NEAR') f.spiritDistressed = true;
      ctx.note('实际打开本次有限净化光环', `3灵性与1行动已付，原5米光环已打开。${f.lanternPosition === 'NEAR' ? '同一原灯与真实友善灵体栖灯仍在2米近处，友善身份没有让灵体自动免疫，已出现短暂不适与驱斥反应；没有死亡或被净化抹除，本次不能成为合格结果。' : '原主人此前已经亲自沿原8米步道搬运原灯与栖灯到范围外的SHELTER，再自己普通走回近处，本次未作用于原灵体。'}原普通成年协作者没有被判为邪恶。无论判定如何都须明确CLOSE停环，再分别恢复不适或实际搬回原灯。`);
    } else {
      if (p.id === 'darkened-walk') f.lightChecks += 1;
      ctx.note('实际实施本次有限神圣之光', `${p.spirit}灵性与1行动已付，失败照耗。` + (p.id === 'darkened-walk' ? '只照看原3米短路并核对夜间视物，不生成无暗领域或治疗身体。' : '只尝试减弱同一原石板SLATE上的有限旧死气残留，不作用于活人、不净化非凡特性或宇宙污染。'));
    }
  }
  const result = ctx.check(r.method === 'ABILITY' ? p.abilityStat : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  const success = (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') && !(p.id === 'mixed-company' && r.method === 'ABILITY' && f.lanternPosition !== 'SHELTER');
  if (success) {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    if (p.id === 'bounded-cleansing') f.trace = r.method === 'ABILITY' ? 'REDUCED' : 'SEALED';
    ctx.note(p.title, resultText(s, p) + '先0行动明确结束原接触；若原灯还在SHELTER，仍须原主人实际搬回，且栖灯没有待处理的不适，之后才能报告。'); return;
  }
  r.status = 'OBSERVED';
  ctx.note(p.title, '本次未取得合格可报告结果，原观察与全部实际成本保留，不增加掌握或扮演。' + (p.id === 'mixed-company' && f.spiritDistressed ? '近处栖灯已短暂不适，必须先CLOSE停环，再CLEAR_SPIRIT由原主人陪同普通恢复；不能把恢复当成本次成功。' : '先0行动明确结束原接触；原灯若在SHELTER还须由原主人实际搬回。') + '同一原残留不会因失败新增或重置；结束后下一真实周才可重新准备，不能同周重刷。');
}

export function priestOfLightActions(s: SliceState): PriestOfLightAction[] {
  if (!promoted(s)) return [];
  const out: PriestOfLightAction[] = [], m = s.priestOfLight;
  const add = (id: string, label: string, cost: string, command: PriestOfLightActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (m.cases['mixed-company'].status === 'PREPARED' && m.practice.lanternPosition === 'NEAR') add('priest-of-light-move-lantern', '请原主人沿8米原路搬走原灯与栖灯', '0行动 · 本次付费排练 · 原主人真实搬运', { type: 'MOVE_LANTERN' });
  if (m.practice.spiritDistressed) add('priest-of-light-clear-spirit', '请原主人陪同普通恢复本次不适', '0行动 · 先明确停环 · 不恢复玩家资源', { type: 'CLEAR_SPIRIT' });
  if (m.practice.lanternPosition === 'SHELTER') add('priest-of-light-return-lantern', '请原主人沿8米原路实际搬回原灯与栖灯', '0行动 · 先明确停环 · 不代替关闭接触', { type: 'RETURN_LANTERN' });
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (r.contactOpen) add(p.id + '-close', '明确停止本次能力并结束原接触', '0行动 · 不自动恢复灵体或搬回原灯', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '实际核对本项原现场与对象', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', '准备本项有限能力实践', `1行动 · 实施另${p.spirit}灵性`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', '准备原现场普通核对', '1行动 · 实施知识10、0灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', '实际实施本次有限实践', r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · ${p.abilityStat === 'will' ? '意志' : '知识'}14 · 失败照耗` : '1行动 · 知识10 · 0灵性', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 不搬回已到遮蔽点的原灯与栖灯', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告本案真实有限结果', '1行动 · 先停环、恢复灵体并实际搬回原灯', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('priest-of-light-reflect', '回看有限照明、原残留与友善灵体', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('priest-of-light-encounter-talk', '前往原空私人院落当面澄清', '1行动 · 一项真实报告后', { type: 'ENCOUNTER_TALK' });
    add('priest-of-light-encounter-fight', '前往原空私人院落承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function priestOfLightCases(s: SliceState): PriestOfLightProjection['cases'] {
  if (!promoted(s) && !inherited(s)) return [];
  return CASES.map(p => {
    const r = s.priestOfLight.cases[p.id];
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(s, p) : r.attemptWeek !== null ? `第${r.attemptWeek}周未取得合格报告结果，原观察与实际成本保留；结束接触、恢复原灵体并真实搬回原灯后，下一真实周再准备。` : r.withdrawals ? '尚未实施的准备已取消，已付行动与原观察保留；原灯与栖灯如在遮蔽点仍须另行实际搬回。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...practiceHistory(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触尚须明确CLOSE；停环、恢复不适与主人实际搬回互不代替' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
export function priestOfLightPractice(s: SliceState): PriestOfLightProjection['practice'] {
  if (!promoted(s) && !inherited(s)) return null;
  const f = s.priestOfLight.practice;
  return { lanternPosition: f.lanternPosition === 'NEAR' ? '同一原灯与真实友善灵体栖灯在NEAR原2米近处' : '原主人已沿原8米步道搬运同一原灯与栖灯到SHELTER，仍须实际搬回', aura: f.auraOpen ? '本次5米有限净化光环尚未明确停止' : '没有仍在持续的本次净化光环', distressed: f.spiritDistressed ? '栖灯暂时不适并受驱斥；停环后须原主人陪同普通恢复' : '栖灯没有尚待处理的本次不适', history: practiceHistory(s) };
}
export const projectPriestOfLightPractice = priestOfLightPractice;

/** Same original slate, lantern and spirit; bounded costs and separately recorded cleanup. */
export function validatePriestOfLightLife(s: SliceState): boolean {
  const m = s.priestOfLight;
  if (!record(m) || !record(m.cases) || !shape(m.cases, PRIEST_OF_LIGHT_CASE_IDS) || !record(m.ritual) || !record(m.practice) || !shape(m.practice, ['lanternPosition', 'auraOpen', 'spiritDistressed', 'lightChecks', 'trace', 'auraChecks']) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, first = m.promotionWeek ?? s.week, weeks = Math.max(0, s.week - first + 1), active = promoted(s) || inherited(s);
  if (!['NEAR', 'SHELTER'].includes(f.lanternPosition) || typeof f.auraOpen !== 'boolean' || typeof f.spiritDistressed !== 'boolean' || !['PRESENT', 'REDUCED', 'SEALED'].includes(f.trace) || !integer(f.lightChecks, 0, weeks) || !integer(f.auraChecks, 0, weeks)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, weeks) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string) || r.attemptWeek !== null && !integer(r.attemptWeek, first, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `priest-of-light-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    const success = ['EXAMINED', 'RESOLVED'].includes(r.status as string);
    if (success ? r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome) : r.outcome !== 'NONE') return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - first + 1)) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.ritual.location !== 'GUIDE' || r.closes >= r.attemptWeek - first + 1) return false;
    }
    if (!active && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const light = m.cases['darkened-walk'], trace = m.cases['bounded-cleansing'], mixed = m.cases['mixed-company'];
  if (f.auraOpen !== (mixed.contactOpen && mixed.method === 'ABILITY')) return false;
  for (const [r, checks] of [[light, f.lightChecks], [mixed, f.auraChecks]] as const) {
    if (checks > r.closes + (r.contactOpen ? 1 : 0) || r.attemptWeek === null && checks !== 0 || r.method === 'ABILITY' && r.attemptWeek !== null && r.status !== 'PREPARED' && checks === 0) return false;
  }
  if (f.spiritDistressed && (mixed.status !== 'OBSERVED' || mixed.method !== 'ABILITY' || mixed.attemptWeek !== s.week || f.lanternPosition !== 'NEAR' || f.auraChecks === 0)) return false;
  if (f.auraOpen && f.lanternPosition === 'NEAR' && !f.spiritDistressed) return false;
  if (mixed.status === 'EXAMINED' && mixed.method === 'ABILITY' && mixed.contactOpen && f.lanternPosition !== 'SHELTER') return false;
  if (f.lanternPosition === 'SHELTER' && (['AVAILABLE', 'RESOLVED'].includes(mixed.status) || mixed.status === 'OBSERVED' && mixed.attemptWeek === null && mixed.withdrawals === 0)) return false;
  if ((f.lanternPosition === 'SHELTER' || f.spiritDistressed || f.auraOpen) && (!active || s.status !== 'ACTIVE' || s.activeEvent !== null || s.combat !== null || s.world.city !== 'BACKLUND' || m.ritual.location !== 'GUIDE')) return false;
  const traceSuccess = ['EXAMINED', 'RESOLVED'].includes(trace.status);
  if (f.trace !== (traceSuccess ? trace.method === 'ABILITY' ? 'REDUCED' : 'SEALED' : 'PRESENT')) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'priest-of-light-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!active && (m.reflected || f.lanternPosition !== 'NEAR' || f.auraOpen || f.spiritDistressed || f.lightChecks || f.auraChecks || f.trace !== 'PRESENT')) return false;
  if (inherited(s) && (Object.values(m.cases).some(r => r.attemptWeek !== null && r.attemptWeek > s.unshadowed.promotionWeek!) || open || prepared || resolved !== 3 || !m.reflected || f.lanternPosition !== 'NEAR' || f.auraOpen || f.spiritDistressed || m.ritual.location !== 'GUIDE' || s.unshadowed.priestOfLightActingAtPromotion !== 100)) return false;
  if (promoted(s) && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
