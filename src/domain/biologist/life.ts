import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyHarvestpriestActivity } from '../harvestpriest/life.js';
import { applyBiologistEncounter, blockBiologistEncounter, BIOLOGIST_ENCOUNTER_STORY } from './encounter.js';
import { validateBiologistCommand } from './index.js';
import { BIOLOGIST_CASE_IDS, type BiologistCommand, type BiologistActivityCommand, type BiologistAction, type BiologistProjection } from './types.js';

const CASES = [
  { id: 'sample-record', title: '原封土壤样本上的有限记录',
    story: '伊芙把原有、来源已登记的普通土壤样本B6-SOIL-1放在温室原台。她只允许保持原封观察外观与原记录，不拆封、不加入材料、不作可食或安全保证。你要把实际可见与尚不清楚的事分开。',
    facts: ['同一原封样本一直留在原温室台上，没有新库存或拆封操作。', '封签、外观与来源记录只能支持有限观察，不能读出隐藏成分或作全知鉴定。'],
    ability: '核对原封签与记录，样本保持稳定；实践时用原创G有限样本研究辅助观察，1行动、3灵性，失败照付。',
    ordinary: '准备核对同一原样本的外观、编号与原记录；实践1行动、0灵性，不虚构鉴定或实验。',
    result: '你记录了同一原封普通样本可见的有限情况，明确未知仍在。原样本保持原封并留在原台，不宣称掌握全部成分、危险性或可食性。', outcome: 'SAMPLE_RECORDED' },
  { id: 'paired-seedling', title: '两株原苗与下一周的实际复核',
    story: '同苗圃温室原台上已有伊芙的两株已知普通原苗B6-SEED-1与B6-SEED-2；两株都只作有限观察与对照，不作食物。伊芙允许这次有限照护与记录。实践须从原畦旁既有标记格实际取1份原水到温室，随后仍把同一原苗留在原台等待。',
    facts: ['同一苗圃内的两株原苗编号与归属固定，不凭空增加苗木、新品种或产量。', '能力方法实用1份原水及3灵性；普通方法使用同一份原水、0灵性。成功也必须在下一真实周花1行动亲自查看同一原苗，周结不自动复核。'],
    ability: '保持两株原苗原位稳定，准备原创G有限对照；实际实践另付1份原水、3灵性。没有现实实验配方、危险生物或即时杂交成果。',
    ordinary: '准备对同一两株原苗的普通照护和有限记录；实践实用1份同源原水、0灵性，之后仍须跨周亲自复核。',
    result: '本次有限照护与对照已有记录，并已在下一真实周亲自查看同一两株原苗。记录只覆盖实际看到的有限情况，不证明可食、新品种或额外产量。', outcome: 'TRIAL_RECORDED' },
  { id: 'safe-return', title: '带着复核记录交还同一原苗',
    story: '伊芙在同一温室等你交还B6-SEED-1与B6-SEED-2。你必须先有下一真实周亲自复核的记录，当面说明这只是有限观察、不能据此宣称可食或新品种，再把同一两株原苗亲手交回本人；没有苗木进入玩家库存。',
    facts: ['未完成跨周实际复核，不能开始本次交还。', '交还前当面说明未知与限制；同一两株原苗归还同一主人，不能被当作新收获或免费实验材料。'],
    ability: '整理已有有限研究与实际复核记录，保持原苗稳定；此项只作警告和亲手交还，实践1行动、不再施术或耗灵性。',
    ordinary: '普通复核编号与既有记录，准备当面说明限制并亲手交回；实践1行动、0灵性。',
    result: '你已当面向伊芙说明有限结果、未证可食和未知风险，再亲手将同一两株原苗交回本人。原苗仍在同一温室且归伊芙，没有新产物、钱款或新品种。', outcome: 'RETURN_RECORDED' },
] as const;

export const BIOLOGIST_ENVIRONMENT = '以下场地、物件与全部数值为原创G：观察、准备、实践、报告各1行动；前两案能力实践额外3灵性，普通方法0灵性，失败照付。第二案还必须实际消耗原丰收祭司标记格的1份原水，不建立第二水库存；成功后下一真实周需1行动VERIFY亲自查看原苗，不能周结自动验证。PREPARE只整理稳定原物；PERFORM才实际操作，之后0行动CLOSE或WITHDRAW放稳原物、停止本次能力并退开。取消未实施准备不退款，已实施的用水、失败、复核和交还事实不回滚。三报告各25扮演、反思25。不是全知鉴定，不生成可食保证、新品种或额外产量，不下放德鲁伊能力。' + BIOLOGIST_ENCOUNTER_STORY;
const active = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 6;
export const biologistInside = (s: SliceState) => Object.values(s.biologist.cases).some(r => r.contactOpen);
export const isBiologistActivity = (c: BiologistCommand): c is BiologistActivityCommand =>
  ['BUY_WATER', 'VERIFY', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

function blocked(s: SliceState, c: BiologistActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockBiologistEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成生物学家晋升。';
  const m = s.biologist, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待结束的原现场操作。';
  if (c.type === 'WITHDRAW' && r?.contactOpen) return null;
  if (biologistInside(s)) return '先0行动放稳原物、停止本次能力并退开。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德伊芙的原苗圃温室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备或待结束的接触。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (c.type === 'BUY_WATER') return s.harvestpriest.plot.water > 0 ? '先使用原标记格现有原水，不重复堆购。' : s.cash < 30 ? '本次2份原水需要30便士。' : null;
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前已准备的事项。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  if (c.type === 'VERIFY') return c.caseId !== 'paired-seedling' || r.status !== 'EXAMINED' || m.trial.status !== 'WAITING' || m.trial.careWeek === null ? '先实际对照成功，并结束接触，让同一原苗留在原台等待。' : s.week <= m.trial.careWeek ? '必须到下一真实周亲自查看同一原苗，本周不能验证。' : null;
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : c.caseId === 'safe-return' && m.trial.status !== 'VERIFIED' ? '先完成下一真实周的实际复核。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原样本、原苗与本次边界。' : r.attemptWeek === s.week ? '本周实践已结束，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' ? '先取得真实结果，并实际结束本次接触。' : c.caseId === 'paired-seedling' && m.trial.status !== 'VERIFIED' ? '先到下一真实周花1行动VERIFY，亲自查看同一原苗后再报告。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  if (c.caseId === 'safe-return') return m.trial.status !== 'VERIFIED' || m.trial.verifiedWeek === null || m.trial.location !== 'BENCH' ? '须先有真实跨周复核，且同一原苗仍在原台，才可交还。' : null;
  if (c.caseId === 'paired-seedling') {
    if (m.trial.status !== 'IDLE') return '同一原苗已实际照护成功，不能重置、重复用水或凭空增加苗木。';
    if (s.harvestpriest.plot.water < 1) return '本次对照需从原标记格实际取1份原水。';
  }
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次有限能力实践需要3灵性，不能透支；可0行动取消准备后改用普通方法。' : null;
}

export function applyBiologistActivity(s: SliceState, c: BiologistActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateBiologistCommand(c) || !isBiologistActivity(c)) throw new Error('生物学家活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyBiologistEncounter(s, c, ctx); return; }
  const m = s.biologist;
  if (c.type === 'BUY_WATER') { applyHarvestpriestActivity(s, { type: 'BUY_WATER' }, ctx, award); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!, wasOpen = r.contactOpen;
    if (wasOpen) {
      r.contactOpen = false; r.closes += 1;
      ctx.note('放稳同一原物并退开', '你停止本次有限能力或普通操作，核对原封样本仍在原台、两株同一原苗留在同一温室；已交还的仍由伊芙本人保管，等待复核的仍稳定留在原台，随后退开。本次已发生的用水、结果与亲手交还保留；0行动，收束时间已含原实践预算，不退款、不治疗。等待中的原苗可以正常跨周，仍须之后亲自VERIFY。');
    } else {
      r.status = 'OBSERVED'; r.method = null;
      ctx.note('取消尚未实施的准备', '原样本保持原封、两株原苗原位稳定，未开始能力或取水。0行动，不退准备成本，可以回到正常生活。');
    }
    if (c.type === 'WITHDRAW') r.withdrawals += 1;
    return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('biologist-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('研究、复核与交还的责任', '你区分已见与未知，保留真实材料成本、可能失败、跨周亲自复核和明确警告后的实际交还。G扮演+25；有限记录不等于可食、新品种或额外产量，弗兰克的惊人成果不是普通新晋生物学家的保证。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    ctx.note('准备本次有限研究', (c.method === 'ABILITY' ? p.ability : p.ordinary) + '现在只有稳定原物与整理记录，没有施法、用水或新接触；即使这是本周最后行动，也可0行动取消或正常等待。'); return;
  }
  if (c.type === 'VERIFY') {
    m.trial.verifiedWeek = s.week; m.trial.status = 'VERIFIED';
    ctx.note('下一真实周亲自复核同一原苗', `第${s.week}周，你花1行动回到原温室台，核对B6-SEED-1与B6-SEED-2仍为第${m.trial.careWeek}周照护的同一原苗，再记录实际可见的有限情况。没有再次用水或耗灵性，不抽取新品种、产量或可食性；这次亲自复核已完成，可以报告。`); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`biologist-case:${p.id}`, 8);
    ctx.note(p.title, p.result + (r.method === 'ORDINARY' ? '本次使用普通方法，没有虚构施法。' : '') + '本次接触已实际结束，G扮演+25，已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'safe-return') {
    m.practice.warningsRecorded = true;
    m.trial.location = 'OWNER'; m.trial.status = 'RETURNED';
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    ctx.note(p.title, p.result + '伊芙本人已经接受同一两株原苗；先0行动结束本次交还接触，再报告。'); return;
  }
  if (p.id === 'paired-seedling') {
    s.harvestpriest.plot.water -= 1; s.harvestpriest.plot.waterUsed += 1; m.trial.waterUsed += 1;
    ctx.note('实际取用同一来源原水', '你从伊芙原畦旁既有标记格实际取出1份原水，带到同苗圃温室，实际用于同一两株已知原苗的有限照护与对照。原格少1份，累计已用加1份，没有新水库存；失败也不退回原水。');
  }
  if (r.method === 'ABILITY') s.spirituality -= 3;
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 10 : 12);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'sample-record') m.practice.sampleRecorded = true;
    else { m.trial.careWeek = s.week; m.trial.status = 'WAITING'; }
    ctx.note(p.title, p.id === 'sample-record' ? '已取得可见外观与原记录的有限观察，没有拆封或全知鉴定。先0行动停止本次操作并退开，再报告。' : '有限照护与本次初始对照记录已经完成，同一原苗仍留原台。先0行动结束接触，正常生活并等待下一真实周，再花1行动VERIFY亲自复核，才可报告；没有即时产物。');
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, '本次记录不足，不能形成可报告结果。已付行动、原水（若使用）与3灵性（若施术）保留；原封样本与两株原苗没有被替换，未生成任何产物。先0行动CLOSE或WITHDRAW放稳原物、停止本次能力并退开，下一真实周再准备。');
  }
}

export function biologistActions(s: SliceState): BiologistAction[] {
  if (!active(s)) return [];
  const out: BiologistAction[] = [];
  const add = (id: string, label: string, cost: string, command: BiologistActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (s.harvestpriest.plot.water === 0 && s.biologist.trial.status === 'IDLE') add('biologist-buy-water', '从原供水处购买2份原水', '30便士 · 0行动 · 同一原标记格 · 不堆购', { type: 'BUY_WATER' });
  for (const p of CASES) {
    const r = s.biologist.cases[p.id]!;
    if (r.contactOpen) {
      add(`${p.id}-close`, '放稳原物，停止本次能力并退开', '0行动 · 原事实与成本保留', { type: 'CLOSE', caseId: p.id });
      add(`${p.id}-withdraw`, '结束本次操作并回到生活', '0行动 · 保留已发生的结果与成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原物、许可与有限边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, p.id === 'sample-record' ? '准备G有限样本研究' : p.id === 'paired-seedling' ? '准备G有限对照实践' : '整理复核记录与交还警告', '1行动 · 原物稳定 · 尚未施法或取水', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备同一原物的普通方法', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, p.id === 'safe-return' ? '当面说明警告，再亲手交还同一原苗' : '实际完成本次有限研究', `1行动${p.id === 'paired-seedling' ? ' · 原水1份' : ''} · ${r.method === 'ABILITY' && p.id !== 'safe-return' ? '3灵性' : '0灵性'} · 失败照付`, { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 原物稳定 · 不退准备成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (p.id === 'paired-seedling' && s.biologist.trial.status === 'WAITING') add(`${p.id}-verify`, '下一真实周亲自查看同一原苗', `1行动 · 第${s.biologist.trial.careWeek! + 1}周起 · 不自动验证`, { type: 'VERIFY', caseId: p.id });
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告实际有限结果与未知', '1行动 · 先结束接触，对照须跨周亲自复核', { type: 'REPORT', caseId: p.id });
  }
  if (!s.biologist.reflected) add('biologist-reflect', '回看研究、复核与交还责任', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.biologist.encounter.status === 'AVAILABLE') {
    add('biologist-encounter-talk', '到温室外院向洛恩当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('biologist-encounter-fight', '到温室外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function biologistCases(s: SliceState): BiologistProjection['cases'] {
  if (!active(s) && !(s.progression.pathwayId==='mother'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) return [];
  return CASES.map(p => {
    const r = s.biologist.cases[p.id]!;
    let result: string | null = r.status === 'RESOLVED' ? p.result : r.status === 'EXAMINED' ? r.contactOpen ? '本次操作已有实际结果，先0行动放稳原物、停止本次能力并退开。' : p.id === 'paired-seedling' && s.biologist.trial.status === 'WAITING' ? `第${s.biologist.trial.careWeek}周照护的同一原苗仍在温室原台，下一真实周须花1行动VERIFY亲自查看；尚未复核，不能报告或交还。` : p.result : r.attemptWeek !== null ? '此前结果不足，原行动、用水与能力成本保留；先实际结束接触，下一真实周可再准备。' : r.withdrawals ? '尚未实施的准备已取消，原样本与原苗保持稳定。' : null;
    if (result && ['EXAMINED', 'RESOLVED'].includes(r.status) && r.method === 'ORDINARY') result += '本次使用普通方法，没有虚构施法。';
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次原现场操作尚待实际结束' : '没有尚待结束的本次接触', closes: r.closes };
  });
}

/** Validate source, real-water conservation, explicit next-week verification and irreversible return. */
export function validateBiologistLife(s: SliceState): boolean {
  const m = s.biologist, t = m.trial;
  const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const shape = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join('|') === keys.sort().join('|');
  const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
  if (!record(m.practice) || !shape(m.practice, ['sampleRecorded', 'warningsRecorded']) || typeof m.practice.sampleRecorded !== 'boolean' || typeof m.practice.warningsRecorded !== 'boolean') return false;
  if (!record(t) || !shape(t, ['careWeek', 'verifiedWeek', 'waterUsed', 'location', 'status']) || !integer(t.waterUsed) || !['BENCH', 'OWNER'].includes(t.location) || !['IDLE', 'WAITING', 'VERIFIED', 'RETURNED'].includes(t.status)) return false;
  if (t.careWeek !== null && !integer(t.careWeek, m.promotionWeek ?? s.week, s.week) || t.verifiedWeek !== null && !integer(t.verifiedWeek, (t.careWeek ?? s.week) + 1, s.week)) return false;
  if (!record(s.harvestpriest.plot) || !integer(s.harvestpriest.plot.waterUsed) || s.harvestpriest.plot.waterUsed < t.waterUsed || s.harvestpriest.plot.water + s.harvestpriest.plot.waterUsed !== s.harvestpriest.plot.waterPacks * 2) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [i, p] of CASES.entries()) {
    const r = m.cases[p.id]; if (!r) return false;
    const sources = s.seer.completedSources.filter(x => x === `biologist-case:${p.id}`).length;
    if (sources !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (i > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[i - 1]!.id]!.status !== 'RESOLVED') return false;
    if (r.status === 'AVAILABLE' && (r.attemptWeek !== null || r.method !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.contactOpen) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.outcome !== p.outcome || r.attemptWeek === null || r.method === null) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.closes < 1 || r.contactOpen) return false; }
    if (r.closes > 0 && r.attemptWeek === null) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.status !== 'ACTIVE' || s.activeEvent !== null || s.combat !== null || s.world.city !== 'BACKLUND') return false; }
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const sample = m.cases['sample-record']!, paired = m.cases['paired-seedling']!, returned = m.cases['safe-return']!;
  if (m.practice.sampleRecorded !== ['EXAMINED', 'RESOLVED'].includes(sample.status)) return false;
  if ((t.careWeek !== null) !== ['EXAMINED', 'RESOLVED'].includes(paired.status) || t.careWeek !== null && t.careWeek !== paired.attemptWeek) return false;
  if (t.waterUsed === 0 && paired.attemptWeek !== null || t.waterUsed > 0 && paired.attemptWeek === null) return false;
  if (t.status === 'IDLE' && (t.careWeek !== null || t.verifiedWeek !== null || t.location !== 'BENCH')) return false;
  if (t.status === 'WAITING' && (t.careWeek === null || t.verifiedWeek !== null || t.location !== 'BENCH' || paired.status !== 'EXAMINED')) return false;
  if (['VERIFIED', 'RETURNED'].includes(t.status) && (t.careWeek === null || t.verifiedWeek === null || paired.contactOpen)) return false;
  if (t.status === 'VERIFIED' && t.location !== 'BENCH') return false;
  if (t.status === 'RETURNED' && t.location !== 'OWNER') return false;
  if ((t.verifiedWeek !== null) !== ['VERIFIED', 'RETURNED'].includes(t.status)) return false;
  if ((t.status === 'RETURNED') !== ['EXAMINED', 'RESOLVED'].includes(returned.status) || m.practice.warningsRecorded !== (t.status === 'RETURNED')) return false;
  if (returned.status !== 'AVAILABLE' && (t.verifiedWeek === null || paired.status !== 'RESOLVED')) return false;
  if (returned.attemptWeek !== null && (t.verifiedWeek === null || returned.attemptWeek < t.verifiedWeek)) return false;
  if (paired.status === 'RESOLVED' && t.verifiedWeek === null) return false;
  if (s.seer.completedSources.filter(x => x === 'biologist-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if ((active(s)||(s.progression.pathwayId==='mother'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) && ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?s.druid.biologistActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (t.status !== 'IDLE' || t.waterUsed !== 0 || m.practice.sampleRecorded || m.practice.warningsRecorded || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
