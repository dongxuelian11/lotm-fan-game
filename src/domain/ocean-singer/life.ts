import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyOceanSingerEncounter, blockOceanSingerEncounter, OCEAN_SINGER_ENCOUNTER_STORY } from './encounter.js';
import { OCEAN_SINGER_CASE_IDS, type OceanSingerCaseId, type OceanSingerCommand, type OceanSingerActivityCommand, type OceanSingerAction, type OceanSingerProjection } from './types.js';

const CASES = [
  {
    id: 'warned-rehearsal', title: '原排练区里仍会听见的同伴',
    story: '原成年码头工米娅自愿在导师艾洛·芬奇指定的原排练区参与一次短歌核对。她起初在你身旁2米处，原普通步道长8米，通向短歌本次5米有限作用范围外的原遮蔽点。须真实请求并由她接受、普通走过去；遮蔽点的距离才是本次安排，不以堵耳或同伴身份保证免疫。原场与全部数值均为原创G。',
    facts: ['原成年米娅在NEAR的2米处；MOVE_ALLY是她接受请求后真实普通步行8米到SHELTER。', '本次短歌有限范围5米；同伴身份与遮耳不能保证避开歌声。近处误受影响只是暂时分心，不是伤害、睡眠或操控。', 'CLOSE停止短歌，CLEAR_ALLY以普通交谈与休息消除已发生的分心，RETURN_ALLY才是她真实走回；三项互不代替。'],
    ability: '准备一次5米范围的有限短歌；实施3灵性、意志14。可以不先请米娅离开，但近处同伴会暂时分心，本案不算通过；判定成功且她已实际到SHELTER才取得合格结果。',
    ordinary: '准备在原排练区用可见手势和普通交谈核对沟通；实施知识10、0灵性，不唱歌、不催眠，也不影响同伴。',
    spirit: 3, abilityStat: 'will', abilityOutcome: 'ALLY_SHELTERED', ordinaryOutcome: 'SIGNAL_CHECKED',
    abilityResult: '你实际支付3灵性唱出有限短歌，核对时米娅已沿原8米步道到本次5米范围外的SHELTER，未让她受本次歌声影响；这只是该次有限安排，不保证歌声必中特定目标或穿透一切防御。',
    ordinaryResult: '你与原成年米娅实际使用可见手势和普通交谈完成沟通核对，没有唱歌、消耗灵性、催眠或赋予魔法能力。',
    close: '你实际停下本次短歌或普通沟通，结束原排练接触。已经发生的分心和米娅所在位置不会随之消失；如有需要，另行普通交谈休息与实际步行返回。',
  },
  {
    id: 'lightning-target', title: '原空凹间的一块湿炭靶',
    story: '导师允许你在原私人码头空凹间核对一块已固定的原湿炭靶。原靶距离3米，原标线以内没有其他身体，也没有携带金属的人或可带走的财物；只有原普通接触指示片可供比较。一次付费实施只尝试一道浅层雷击，原靶和指示片始终留在现场，不能无限破坏或刷取物品。（原创G）',
    facts: ['同一块原湿炭靶固定在3米外的原空私人凹间；对象不是人、远处目标或天气。', '能力实施4灵性、知识14，实际尝试一道有限浅层雷击，可能失败。', '普通方法实际手工核对原接触指示片；原物不进入库存，不召唤风暴或海啸。'],
    ability: '准备只对3米外同一原湿炭靶尝试一道浅层雷击；实施4灵性、知识14，失败照耗，不召唤天气。',
    ordinary: '准备实际手工比较原接触指示片与同一原靶的普通标记；实施知识10、0灵性，不施加雷击。',
    spirit: 4, abilityStat: 'knowledge', abilityOutcome: 'TARGET_CHECKED', ordinaryOutcome: 'TARGET_CHECKED',
    abilityResult: '你实际以4灵性尝试一道浅层雷击，在同一块3米外原湿炭靶上取得一处可核对标记；没有影响天气、旁人或别的物品，也没有可领取战利品。',
    ordinaryResult: '你实际手工比较原接触指示片与同一原靶上的普通标记，完成本次核对；没有施加雷击或取得魔法掌握。',
    close: '你实际停止本次雷击接触或普通指示片核对，将原指示片留回原位，原靶留在原凹间，再从原普通出口离开。',
  },
  {
    id: 'tidal-observation', title: '跨真实周的原码头水流对照',
    story: '导师指定原码头同一个有标线的小水盆观察点。你先真实观察并记下当周流向，之后必须等到下一真实周或更晚，再到同一原观察点比较。能力方法实际使用继承的小范围水流感知，并拨动盆内一股有限小水流作对照；普通方法手工比较两周的原流向记录。本人始终在原码头上，不把关于更长水下活动的限度认识写成已经潜水。（原创G）',
    facts: ['OBSERVE记录真实观察周；同周不能PERFORM，准备本身不阻止正常周结。', '能力实施2灵性、知识14，真实感知水流并在原标线水盆内拨动一股小水流；不制造无限水量、不指挥海怪。', '普通实施知识10、0灵性，实际手工比较先前周和当前周的原流向记录。两种方法都不宣称已经潜水或获得无限水下活动。'],
    ability: '准备等到观察周之后的真实周，实际以继承的有限水流感知和盆内一股小水流核对两周差异；实施2灵性、知识14。没有已完成的潜水行程。',
    ordinary: '准备等到观察周之后的真实周，手工比较原观察记录与当周流向；实施知识10、0灵性，不施法或潜水。',
    spirit: 2, abilityStat: 'knowledge', abilityOutcome: 'TIDE_CHECKED', ordinaryOutcome: 'TIDE_CHECKED',
    abilityResult: '你本人在原码头实际感知当周水流，并支付2灵性在原标线水盆内拨动一股有限小水流，与先前真实周保存的流向记录完成对照。记录包含对水下活动限度的认识，不包含未进行的潜水。',
    ordinaryResult: '你本人在原码头手工比较先前真实周的原流向记录与当周实际观察，完成有限对照；没有施法、潜水或增加魔法掌握。',
    close: '你实际停止本次小水流或普通记录核对，水盆与原标线留在原码头，再从原普通出口离开；没有待完成的潜水返程。',
  },
] as const;
type Case = typeof CASES[number];

export const OCEAN_SINGER_ENVIRONMENT = '三项明确原创G实践：原成年米娅、2米近处与8米普通步道之外的遮蔽点、5米有限短歌；3米原空凹间的一块固定湿炭靶；同一原码头标线水盆的跨真实周水流对照。观察、准备、实施、报告各1行动；CLOSE、CLEAR_ALLY、RETURN_ALLY、MOVE_ALLY、WITHDRAW为0行动，互不代替。短歌3灵性/意志14，浅层雷击4灵性/知识14，实际继承水流能力2灵性/知识14；普通方法均知识10、0灵性。失败照耗，结束接触后下一真实周才可重试。报告各G扮演25，只有实际能力成功报告按已有知识池给单项掌握8，普通报告只保留来源；三案反思另25，可全普通和平100。准备不等于仍在现场，短歌、分心、同伴仍在遮蔽点或仪式仍在COAST/BELLY则须真实结束及返回，0行动退出始终可用。不保证歌声必中、完全穿透防御或自动排除同伴，不催眠，不提前下放风暴、海啸或大型海怪统御；水流核对不能冒充已潜水。 ' + OCEAN_SINGER_ENCOUNTER_STORY;
const promoted = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 5;
const inherited = (s: SliceState) => s.progression.pathwayId === 'tyrant' && (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && typeof s.cataclysmPriest?.promotionWeek === 'number';
export const oceanSingerInside = (s: SliceState) => s.oceanSinger.ritual.location !== 'DOCK' || s.oceanSinger.practice.songOpen || s.oceanSinger.practice.allyAffected || s.oceanSinger.practice.allyPosition === 'SHELTER' || Object.values(s.oceanSinger.cases).some(r => r.contactOpen);
export const isOceanSingerActivity = (c: OceanSingerCommand): c is OceanSingerActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'MOVE_ALLY', 'RETURN_ALLY', 'CLEAR_ALLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is OceanSingerActivityCommand {
  if (!record(c)) return false;
  if (['MOVE_ALLY', 'RETURN_ALLY', 'CLEAR_ALLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!OCEAN_SINGER_CASE_IDS.includes(c.caseId as OceanSingerCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: OceanSingerActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!promoted(s)) return '先完成海洋歌者晋升。';
  const m = s.oceanSinger, f = m.practice, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND' || m.ritual.location !== 'DOCK') return '先沿原付费路线真实回到贝克兰德码头；不能以实践结束代替海岸或海怪腹内返程。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次原现场接触。';
  if (c.type === 'CLEAR_ALLY') return f.songOpen ? '先明确停止短歌，不能边唱边消除本次分心。' : f.allyAffected ? null : '米娅没有尚待消除的本次分心。';
  if (c.type === 'RETURN_ALLY') return f.songOpen ? '先明确停止短歌，米娅不能在歌声仍开时走回近处。' : f.allyPosition === 'SHELTER' ? null : '米娅已经在原近处，没有可伪造的返程。';
  if (c.type === 'MOVE_ALLY') {
    if (m.cases['warned-rehearsal']?.status !== 'PREPARED') return '先观察并准备原排练，才能请求原成年米娅沿原步道避开本次范围。';
    if (f.allyPosition !== 'NEAR') return '米娅已经实际到原遮蔽点。';
    return f.songOpen || f.allyAffected || Object.values(m.cases).some(x => x.contactOpen) ? '先结束本次接触并处理已发生的分心。' : null;
  }
  const shelteredPreparation = c.type === 'PERFORM' && c.caseId === 'warned-rehearsal' && r?.status === 'PREPARED' && f.allyPosition === 'SHELTER' && !f.songOpen && !f.allyAffected && !Object.values(m.cases).some(x => x.contactOpen);
  const shelteredWithdrawal = c.type === 'WITHDRAW' && c.caseId === 'warned-rehearsal' && r?.status === 'PREPARED' && !f.songOpen && !f.allyAffected && !Object.values(m.cases).some(x => x.contactOpen);
  if (oceanSingerInside(s) && !shelteredPreparation && !shelteredWithdrawal) return '先0行动停止接触与短歌、用普通交谈休息清除分心，并请米娅沿原8米步道实际走回；这些动作互不代替。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockOceanSingerEncounter(s, c);
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项真实有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  const p = CASES.find(p => p.id === c.caseId)!;
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场观察已经保留。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先实际观察本项原现场。' : r.attemptWeek === s.week ? '本周实际尝试与成本保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得合格有限结果，明确结束接触并完成本次同伴返回与恢复。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才能重试。';
  if (p.id === 'tidal-observation' && (f.tideObservedWeek === null || s.week <= f.tideObservedWeek)) return `必须等到原观察第${f.tideObservedWeek ?? '未知'}周之后的真实周，才能比较两周实际水流；现在尚未发生第二周。`;
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次实际能力需要${p.spirit}灵性，可取消准备后选择普通方法。` : null;
}
function practiceHistory(s: SliceState): string[] {
  const f = s.oceanSinger.practice;
  return [`实际短歌尝试${f.songChecks}次，实际浅层雷击成功标记${f.lightningMarks}处。`, f.tideObservedWeek === null ? '尚未记下原码头水流观察周。' : `原流向已在第${f.tideObservedWeek}真实周实际观察；${f.tideVerified ? '已经在之后真实周完成对照。' : `当前第${s.week}周，${s.week <= f.tideObservedWeek ? '仍须等待之后真实周再实施。' : '已经跨到之后真实周，仍须实际实施对照。'}`}`, '同伴原步道往返各8米，停止歌声、处理分心与真实返回分别记录；没有未付费潜水、瞬移或自动排除友方。'];
}
function resultText(s: SliceState, p: Case): string {
  const r = s.oceanSinger.cases[p.id]!;
  return (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + (p.id === 'tidal-observation' ? `原观察第${s.oceanSinger.practice.tideObservedWeek}周，实际核对第${r.attemptWeek}周。` : '');
}
export function applyOceanSingerActivity(s: SliceState, c: OceanSingerActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('海洋歌者实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyOceanSingerEncounter(s, c, ctx); return; }
  const m = s.oceanSinger, f = m.practice;
  if (c.type === 'MOVE_ALLY') {
    f.allyPosition = 'SHELTER';
    ctx.note('米娅本人接受请求并实际走到原遮蔽点', '0行动，属于这次已经付费准备的有限排练安排。你当面请求原成年米娅避开本次短歌，她接受后沿原8米普通步道实际走到5米范围外的SHELTER；没有传送、操控或强制睡眠，没有替她提前走回。'); return;
  }
  if (c.type === 'RETURN_ALLY') {
    f.allyPosition = 'NEAR';
    ctx.note('米娅本人沿原步道实际走回', '短歌已经明确停止。0行动，米娅自愿沿同一原8米普通步道实际走回NEAR原2米近处；没有瞬移，不代替CLOSE，也不清除任何已发生的分心，不增加扮演或掌握。'); return;
  }
  if (c.type === 'CLEAR_ALLY') {
    f.allyAffected = false;
    ctx.note('用本次普通交谈与休息实际消除分心', '短歌已经明确停止。0行动，原成年米娅与你在原排练区进行普通交谈并实际休息，确认这次暂时分心消退；属于同一次已付费排练的收尾，不是魔法治疗、精神控制或新奖励，不恢复玩家身体、精神、灵性或行动。'); return;
  }
  if (c.type === 'CLOSE') {
    const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
    r.contactOpen = false; r.closes += 1;
    if (p.id === 'warned-rehearsal') f.songOpen = false;
    ctx.note('明确停止本次能力并结束原接触', '0行动。' + p.close + '已付行动与灵性不返还，成功或失败记录保留，不治疗、不增加掌握或扮演。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动，原观察与已付准备行动保留，没有实施能力。米娅若已沿原步道走到SHELTER，仍须单独RETURN_ALLY请她实际走回；取消准备不会移人、唱歌或清除分心。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('ocean-singer-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('歌声波及同伴，水流对照须有真实时间', '回看原排练、同一湿炭靶与跨真实周的原水流记录。G扮演+25；实际停止、同伴恢复与步行返回各有不同含义，有限雷击不等于天气权柄，水下活动限度认识不能冒充已经潜水。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED'; if (p.id === 'tidal-observation') f.tideObservedWeek = s.week;
    ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + (p.id === 'tidal-observation' ? `本次已实际观察并保存第${s.week}真实周的原流向记录，尚未发生之后周的比较。` : '本次仅核对原现场，未唱歌、雷击或移动同伴。') + '观察后已离开，没有尚待结束的接触。'); return;
  }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `ocean-singer-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(s, p) + (r.method === 'ABILITY' ? '本次现场已实际结束，报告G扮演+25、已有知识池单项掌握+8。' : '本次现场已实际结束，普通报告G扮演+25，仅保留本案来源，不增加魔法掌握。')); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true; r.outcome = 'NONE';
  if (r.method === 'ABILITY') {
    s.spirituality -= p.spirit;
    if (p.id === 'warned-rehearsal') {
      f.songOpen = true; f.songChecks += 1;
      if (f.allyPosition === 'NEAR') f.allyAffected = true;
      ctx.note('实际开始本次有限短歌', `3灵性与1行动已付，原5米短歌已开始。${f.allyPosition === 'NEAR' ? '原成年米娅仍在2米近处，即使遮耳或身为同伴也未被自动排除，已出现暂时分心；没有受伤、被控制或入睡，本次不能成为合格排练结果。' : '米娅此前已自愿沿原8米步道实际到范围外的SHELTER，本次没有作用于她。'}无论判定如何都须明确CLOSE停止歌声，之后分别处理分心或实际返回。`);
    } else ctx.note('实际实施本次有限能力', `${p.spirit}灵性与1行动已付，失败照耗。` + (p.id === 'lightning-target' ? '只对3米外原固定湿炭靶尝试一道浅层雷击，不召唤天气，也不生成可领取物品。' : `你本人在原码头实际感知第${s.week}周水流，并在原标线水盆内拨动一股有限小水流，对照第${f.tideObservedWeek}周的原观察；没有潜水、免费水下旅行或海怪统御。`));
  }
  const result = ctx.check(r.method === 'ABILITY' ? p.abilityStat : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  const success = (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') && !(p.id === 'warned-rehearsal' && r.method === 'ABILITY' && f.allyPosition !== 'SHELTER');
  if (success) {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    if (p.id === 'lightning-target' && r.method === 'ABILITY') f.lightningMarks += 1;
    if (p.id === 'tidal-observation') f.tideVerified = true;
    ctx.note(p.title, resultText(s, p) + '先0行动明确结束原接触；首案另须同伴没有分心且已实际返回NEAR，之后才能报告。'); return;
  }
  r.status = 'OBSERVED';
  ctx.note(p.title, '本次未取得合格可报告结果，原观察与全部实际成本保留，不增加掌握或扮演。' + (p.id === 'warned-rehearsal' && f.allyAffected ? '近处米娅已暂时分心，必须先CLOSE停歌，再CLEAR_ALLY普通交谈休息；不能把清除分心当作本次成功。' : '先0行动明确结束原接触；米娅若在SHELTER还须实际走回。') + '结束后下一真实周才可重新准备，不能同周重刷。');
}

export function oceanSingerActions(s: SliceState): OceanSingerAction[] {
  if (!promoted(s)) return [];
  const out: OceanSingerAction[] = [], m = s.oceanSinger;
  const add = (id: string, label: string, cost: string, command: OceanSingerActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (m.cases['warned-rehearsal']!.status === 'PREPARED' && m.practice.allyPosition === 'NEAR') add('ocean-singer-move-ally', '请求米娅本人沿8米原步道走到遮蔽点', '0行动 · 本次付费排练 · 自愿真实步行', { type: 'MOVE_ALLY' });
  if (m.practice.allyAffected) add('ocean-singer-clear-ally', '普通交谈休息，实际消除本次分心', '0行动 · 先明确停歌 · 不恢复玩家资源', { type: 'CLEAR_ALLY' });
  if (m.practice.allyPosition === 'SHELTER') add('ocean-singer-return-ally', '请米娅本人沿8米原步道实际走回', '0行动 · 先明确停歌 · 不代替关闭接触', { type: 'RETURN_ALLY' });
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '明确停止本次能力并结束原接触', '0行动 · 不自动清除分心或移回同伴', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', p.id === 'tidal-observation' ? '实际观察并记录本周原水流' : '实际核对本项原现场与对象', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', '准备本项有限能力实践', `1行动 · 实施另${p.spirit}灵性` + (p.id === 'tidal-observation' ? ' · 须等到观察之后真实周' : ''), { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', '准备原现场普通核对', '1行动 · 实施知识10、0灵性' + (p.id === 'tidal-observation' ? ' · 同样须等之后真实周' : ''), { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', p.id === 'tidal-observation' ? '实际比较当前与先前真实周的原水流' : '实际实施本次有限实践', r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · ${p.abilityStat === 'will' ? '意志' : '知识'}14 · 失败照耗` : '1行动 · 知识10 · 0灵性', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 不移回已到遮蔽点的米娅', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告本案真实有限结果', '1行动 · 先结束接触、处理分心并实际返回', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('ocean-singer-reflect', '回看同伴边界与真实水流时间', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('ocean-singer-encounter-talk', '前往原空私人码头工场当面澄清', '1行动 · 一项真实报告后', { type: 'ENCOUNTER_TALK' });
    add('ocean-singer-encounter-fight', '前往原空私人码头工场承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function oceanSingerCases(s: SliceState): OceanSingerProjection['cases'] {
  if (!promoted(s) && !inherited(s)) return [];
  return CASES.map(p => {
    const r = s.oceanSinger.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(s, p) : r.attemptWeek !== null ? `第${r.attemptWeek}周未取得合格报告结果，原观察与实际成本保留；结束接触、处理分心并真实返回后，下一真实周再准备。` : r.withdrawals ? '尚未实施的准备已取消，已付行动与原观察保留；米娅如在遮蔽点仍须另行实际走回。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...practiceHistory(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触尚须明确CLOSE；停止、处理分心与实际步行返回互不代替' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
export function oceanSingerPractice(s: SliceState): OceanSingerProjection['practice'] {
  if (!promoted(s) && !inherited(s)) return null;
  const f = s.oceanSinger.practice;
  return { allyPosition: f.allyPosition === 'NEAR' ? '原成年米娅在NEAR原2米近处' : '米娅已自愿沿原8米步道到SHELTER，仍须实际走回', song: f.songOpen ? '本次5米有限短歌尚未明确停止' : '没有仍在持续的本次短歌', affected: f.allyAffected ? '米娅暂时分心；停歌后须普通交谈休息实际清除' : '米娅没有尚待处理的本次分心', history: practiceHistory(s) };
}

/** Finite real contacts, explicit companion movements and actual cross-week observations. */
export function validateOceanSingerLife(s: SliceState): boolean {
  const m = s.oceanSinger;
  if (!record(m) || !record(m.cases) || !shape(m.cases, OCEAN_SINGER_CASE_IDS) || !record(m.practice) || !shape(m.practice, ['allyPosition', 'songOpen', 'allyAffected', 'songChecks', 'lightningMarks', 'tideObservedWeek', 'tideVerified']) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, first = m.promotionWeek ?? s.week, weeks = Math.max(0, s.week - first + 1), active = promoted(s) || inherited(s);
  if (!['NEAR', 'SHELTER'].includes(f.allyPosition) || typeof f.songOpen !== 'boolean' || typeof f.allyAffected !== 'boolean' || typeof f.tideVerified !== 'boolean' || !integer(f.songChecks, 0, weeks) || !integer(f.lightningMarks, 0, 1)) return false;
  if (f.tideObservedWeek !== null && !integer(f.tideObservedWeek, first, s.week)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, weeks) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string) || r.attemptWeek !== null && !integer(r.attemptWeek, first, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `ocean-singer-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
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
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.ritual.location !== 'DOCK' || r.closes >= r.attemptWeek - first + 1) return false;
    }
    if (!active && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const song = m.cases['warned-rehearsal']!, lightning = m.cases['lightning-target']!, tide = m.cases['tidal-observation']!;
  if (f.songOpen !== (song.contactOpen && song.method === 'ABILITY')) return false;
  if (f.songChecks > song.closes + (song.contactOpen ? 1 : 0) || song.attemptWeek === null && f.songChecks !== 0 || song.method === 'ABILITY' && song.attemptWeek !== null && song.status !== 'PREPARED' && f.songChecks === 0) return false;
  if (f.allyAffected && (song.status !== 'OBSERVED' || song.method !== 'ABILITY' || song.attemptWeek !== s.week || f.allyPosition !== 'NEAR' || f.songChecks === 0)) return false;
  if (f.songOpen && f.allyPosition === 'NEAR' && !f.allyAffected) return false;
  if (song.status === 'EXAMINED' && song.method === 'ABILITY' && song.contactOpen && f.allyPosition !== 'SHELTER') return false;
  if (f.allyPosition === 'SHELTER' && ['AVAILABLE', 'RESOLVED'].includes(song.status)) return false;
  if ((f.allyPosition === 'SHELTER' || f.allyAffected || f.songOpen) && (!active || s.status !== 'ACTIVE' || s.activeEvent !== null || s.combat !== null || s.world.city !== 'BACKLUND' || m.ritual.location !== 'DOCK')) return false;
  if (f.lightningMarks !== (['EXAMINED', 'RESOLVED'].includes(lightning.status) && lightning.method === 'ABILITY' ? 1 : 0)) return false;
  if ((f.tideObservedWeek === null) !== (tide.status === 'AVAILABLE') || tide.attemptWeek !== null && (f.tideObservedWeek === null || tide.attemptWeek <= f.tideObservedWeek)) return false;
  if (f.tideVerified !== ['EXAMINED', 'RESOLVED'].includes(tide.status)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'ocean-singer-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!active && (m.reflected || f.allyPosition !== 'NEAR' || f.songOpen || f.allyAffected || f.songChecks || f.lightningMarks || f.tideObservedWeek !== null || f.tideVerified)) return false;
  if (inherited(s) && (Object.values(m.cases).some(r => r.attemptWeek !== null && r.attemptWeek > s.cataclysmPriest.promotionWeek!) || f.tideObservedWeek !== null && f.tideObservedWeek > s.cataclysmPriest.promotionWeek! || open || prepared || resolved !== 3 || !m.reflected || f.allyPosition !== 'NEAR' || f.songOpen || f.allyAffected || s.cataclysmPriest.oceanSingerActingAtPromotion !== 100)) return false;
  if (promoted(s) && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
