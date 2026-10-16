import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyWindBlessedEncounter, blockWindBlessedEncounter, WIND_BLESSED_ENCOUNTER_STORY } from './encounter.js';
import { WIND_BLESSED_CASE_IDS, type WindBlessedCommand, type WindBlessedActivityCommand, type WindBlessedAction, type WindBlessedProjection } from './types.js';

const CASES = [
  {
    id: 'crosswind-screen', title: '原工作框里的横风帆布',
    story: '原成年导师艾洛·芬奇在贝克兰德原维修院允许你使用空工作框与一块原帆布，并以原风向标核对近处风向。你只稳定这块本人获准操作的原帆布，供导师在原地核检；无人处于工作框内，普通支杆也留在原处。（原创G）',
    facts: ['空工作框、原帆布和原风向标实际在场且获准使用。', '对象只是一块原帆布，不控制全院或全城天气。', '原支杆可供普通固定，所有原物完成后留在原场。'],
    ability: '准备在原空工作框内有限控风，只稳定本人获准的这块原帆布，供导师核检；实施另耗3灵性、体质14。',
    ordinary: '准备使用原普通支杆固定这块原帆布，供导师核检；实施知识10、不耗灵性、不施加控风。',
    abilityResult: '你只以有限控风稳定原工作框内这块获准帆布，导师实际完成核检；没有操控全城天气。',
    ordinaryResult: '你用原支杆实际固定原帆布，导师完成核检；没有施加控风或改变天气。',
    abilityOutcome: 'WIND_STABILIZED', ordinaryOutcome: 'POLES_FIXED',
    close: '你实际停止控风；若用了普通固定，则拆下本次原支杆。你将原帆布及本次使用的原支杆归还原位留在维修院，再从原普通出口离开。',
  },
  {
    id: 'low-platform', title: '原维修院的低台往返',
    story: '原维修院内的稳定低台距离原地面起点水平6米、高2米；原8米普通楼梯回路始终开放且已由导师核对。平台只供本人，没有旁人、大件或水域；不携其他人，不额外搬运原场物或大件；本人原随身物仍在原保管中。去程与返程必须分别选择并实际完成，不凭空换位置。（原创G）',
    facts: ['原稳定低台水平6米、高2米，尺寸和所有检定为G。', '原8米普通楼梯回路始终开放，普通登台不构成飞行。', '本人单独移动，不携其他人，不额外搬运原场物或大件；本人原随身物仍在原保管中；场内没有水域或旁人。', '借风去程3灵性、体质14；借风返程另耗2灵性、独立体质14，往返预计5灵性。只有3灵性也可去程，原楼梯始终可0行动0灵性回地面。'],
    ability: '准备借风只托举本人，短程到原稳定低台；实施3灵性、体质14，失败留在GROUND。返程另选2灵性独立检定，或0灵性走原楼梯，往返预计5灵性。',
    ordinary: '准备沿始终开放的原8米普通楼梯实际到台面；知识10，不耗灵性、不飞行。到台面后仍须明确选择原楼梯或付费风托返回。',
    abilityResult: '你实际以3灵性短程风托到原低台，当前位置LOW_PLATFORM，未携其他人，也未额外搬运原场物或大件；本人原随身物仍在原保管中。去程成功不包含返程；原8米楼梯仍开放。',
    ordinaryResult: '你实际沿原8米楼梯走到原低台，当前位置LOW_PLATFORM，没有飞行或消耗灵性。去程成功不包含返程，原楼梯仍开放。',
    abilityOutcome: 'FLOWN_TO_PLATFORM', ordinaryOutcome: 'STAIRS_TO_PLATFORM',
    close: '你已实际回到原GROUND，停止本次风托或楼梯往返并从原普通出口离开；原台面与楼梯留在原地，没有携走原场物品；本人原随身物仍在原保管中。',
  },
  {
    id: 'cutting-target', title: '原无人靶位的废木条',
    story: '导师允许你在原维修院无人靶位处理一块已获准的普通薄废木条。原薄木与原普通手锯在现场，没有旁人或远处目标；只检验这块薄木的有限切割结果，原工具和切后木条留在原场。（原创G）',
    facts: ['原无人靶位与这块普通薄废木条已获准使用。', '薄木不等同铠甲，不指向远处NPC或其它物品。', '普通路线用原手锯真实切割；原工具不带离，木条不进入库存。'],
    ability: '准备对原无人靶位这块普通薄废木条施加有限风刃；实施另耗3灵性、体质14，不穿甲或远程伤人。',
    ordinary: '准备使用原普通手锯实际切这块废木条；实施知识10、不耗灵性，手锯与原木条留在现场。',
    abilityResult: '有限风刃实际切开这块获准普通薄木，只确认这个有限结果，不能宣称穿甲或伤及远处NPC。',
    ordinaryResult: '你用原普通手锯实际切开这块获准薄木，没有施加风刃；原手锯和切后木条仍属于原维修院。',
    abilityOutcome: 'WIND_CUT', ordinaryOutcome: 'SAW_CUT',
    close: '你实际停止风刃或普通锯切，把原手锯归还原位，切后木条或未切成的原木条仍留在原靶位，再从原普通出口离开。',
  },
] as const;

export const WIND_BLESSED_ENVIRONMENT = '三个原维修院具体事项及全部数值均为原创G：观察1行动，准备1行动，实施1行动；能力实施3灵性、体质14，普通实施知识10、不耗灵性。失败照耗并须实际结束接触，下周才能重试。每案报告25扮演与单项掌握8，三案反思25，可和平100。低台去程成功后必须选择真实返程：原楼梯0行动0灵性，或风托0行动2灵性独立体质14；返程失败仍在原台面、接触不关闭、灵性不退，可转走始终开放的原楼梯。往返预计5灵性，不新增行动，不免费回满；在台面上不能工作、周结或瞬移离开。不携其他人，不额外搬运原场物或大件；本人原随身物仍在原保管中，不下放海洋歌者歌声雷击。 ' + WIND_BLESSED_ENCOUNTER_STORY;
export const windBlessedInside = (s: SliceState) => s.windBlessed.flight.position !== 'GROUND' || Object.values(s.windBlessed.cases).some(r => r.contactOpen);
export const isWindBlessedActivity = (c: WindBlessedCommand): c is WindBlessedActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is WindBlessedActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!WIND_BLESSED_CASE_IDS.includes(c.caseId as typeof WIND_BLESSED_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'CLOSE') return shape(c, ['type', 'caseId']) || shape(c, ['type', 'caseId', 'returnMethod']) && c.caseId === 'low-platform' && ['STAIRS', 'FLIGHT'].includes(c.returnMethod as string);
  return ['OBSERVE', 'PERFORM', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: WindBlessedActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockWindBlessedEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'tyrant' || s.progression.sequence !== 6) return '先完成风眷者晋升。';
  const p = 'caseId' in c ? CASES.find(p => p.id === c.caseId) : null;
  const r = p ? s.windBlessed.cases[p.id] : null;
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen) return '没有尚未结束的本次接触。';
    if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '本次原现场位置不符，不能以结束接触瞬移。';
    if (s.windBlessed.flight.position === 'LOW_PLATFORM') {
      if (c.caseId !== 'low-platform' || !c.returnMethod) return '仍在原低台，须明确选择原楼梯或另付2灵性借风返回。';
      return c.returnMethod === 'FLIGHT' && s.spirituality < 2 ? '借风返程需要2灵性；仍可沿原8米楼梯0行动0灵性安全返回。' : null;
    }
    return c.returnMethod ? '尚未到原台面，不能伪造返程；请普通结束本次接触。' : null;
  }
  if (windBlessedInside(s)) return '先0行动实际停风、归还原物留在原场，并完成真实返程离开。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原维修院。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.windBlessed.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.windBlessed.reflected ? '已经回看这段经历。' : CASES.some(p => s.windBlessed.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!p || !r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场观察已经保留。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先实际观察本项原现场。';
    return r.attemptWeek === s.week ? '本周实施结果保留，下一真实周再依原观察准备。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触离开。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力实施需要3灵性，可取消准备后选择普通方法。' : null;
}
export function applyWindBlessedActivity(s: SliceState, c: WindBlessedActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('风眷者实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyWindBlessedEncounter(s, c, ctx); return; }
  const m = s.windBlessed;
  if (c.type === 'CLOSE') {
    const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
    if (m.flight.position === 'LOW_PLATFORM') {
      if (c.returnMethod === 'FLIGHT') {
        s.spirituality -= 2;
        const result = ctx.check('physique', 14);
        if (result.tier !== 'SUCCESS' && result.tier !== 'GREAT_SUCCESS') {
          ctx.note('借风返程未成，仍在原低台', `0行动，返程2灵性已实际消耗，独立体质14判定${result.roll}/${result.chance}未通过。当前位置仍为LOW_PLATFORM，本次接触没有关闭，不退灵性、不补资源。原8米楼梯仍开放，可另选0行动0灵性沿楼梯安全返回。`);
          return;
        }
        m.flight.position = 'GROUND'; m.flight.flightReturns += 1;
        ctx.note('实际借风返回原地面', '0行动，另耗2灵性，独立体质14成功；本人从原低台实际回到GROUND，没有携其他人，也未额外搬运原场物或大件；本人原随身物仍在原保管中，不返还去程成本。');
      } else {
        m.flight.position = 'GROUND'; m.flight.stairReturns += 1;
        ctx.note('实际沿原楼梯回到地面', '0行动、0灵性，你沿始终开放的原8米普通楼梯实际从LOW_PLATFORM回到GROUND。没有飞行或新的主要行动，也没有免费恢复灵性。');
      }
    }
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次接触并离开', '0行动。' + p.close + '本次成功或失败与已付行动、灵性均保留，不返资源、不治疗、不增加掌握或扮演。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察与已付行动保留。没有施加风、切木或移动到低台；可以重新选择普通方法。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('wind-blessed-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('风有范围，往返有真实代价', '回看原帆布、低台往返与原薄木。G扮演+25；有限控风不等于天气权柄，去程不是已经返回，原楼梯和普通工具始终是实际可选的方法。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '实际核实原现场后离开，尚未施术、切割或登台，没有待结束接触。'); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`wind-blessed-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次后续已实际停风、归还原物并返回地面离开，报告G扮演+25、原规则单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') s.spirituality -= 3;
  const result = ctx.check(r.method === 'ABILITY' ? 'physique' : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    if (p.id === 'low-platform') { m.flight.position = 'LOW_PLATFORM'; m.flight.ascents += 1; }
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + (p.id === 'low-platform' ? '现在须明确选择原楼梯或另付2灵性的借风返程，不能直接结束或周结。' : '本次接触尚须0行动实际停风、归还原物并离开，之后才能报告。')); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, `本次实施未取得可报告结果，原观察保留。1行动${r.method === 'ABILITY' ? '与3灵性' : ''}已经实际消耗，不增加掌握或扮演；${p.id === 'low-platform' ? '去程失败仍在原GROUND，没有登台或返程。' : ''}先0行动停风或结束普通操作、归还原物并离开，下一真实周再准备。`);
}
export function windBlessedActions(s: SliceState): WindBlessedAction[] {
  if (s.progression.pathwayId !== 'tyrant' || s.progression.sequence !== 6) return [];
  const out: WindBlessedAction[] = [];
  const add = (id: string, label: string, cost: string, command: WindBlessedActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.windBlessed.cases[p.id]!;
    if (r.contactOpen) {
      if (p.id === 'low-platform' && s.windBlessed.flight.position === 'LOW_PLATFORM') {
        add(p.id + '-stairs-return', '沿原8米楼梯实际返回地面并离开', '0行动 · 0灵性 · 原楼梯始终开放', { type: 'CLOSE', caseId: p.id, returnMethod: 'STAIRS' });
        add(p.id + '-flight-return', '另付灵性借风返回地面并离开', '0行动 · 2灵性 · 独立体质14 · 失败仍在台面，可走原楼梯', { type: 'CLOSE', caseId: p.id, returnMethod: 'FLIGHT' });
      } else add(p.id + '-close', '实际停风、归还原物并离开', '0行动 · 0灵性 · 原物留原场', { type: 'CLOSE', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '实际观察本项原现场', '1行动 · 核实原物与回路', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', '准备本项有限风能力', p.id === 'low-platform' ? '1行动 · 去程另3灵性 · 风托往返预计5灵性，原楼梯可0灵性回' : '1行动 · 实施另3灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'low-platform' ? '准备沿原楼梯登台' : '准备原现场普通方法', '1行动 · 实施不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', r.method === 'ABILITY' ? '实际实施本项有限风能力' : '实际使用原现场普通方法', r.method === 'ABILITY' ? '1行动 · 3灵性 · 体质14 · 失败照耗' : '1行动 · 知识10 · 0灵性', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 已付成本不退', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告本项有限结果与实际离开', '1行动 · 返回地面并离开后', { type: 'REPORT', caseId: p.id });
  }
  if (!s.windBlessed.reflected) add('wind-blessed-reflect', '回看有限控风和真实往返代价', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.windBlessed.encounter.status === 'AVAILABLE') {
    add('wind-blessed-encounter-talk', '前往原维修院外空院并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('wind-blessed-encounter-fight', '前往原维修院外空院并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function windBlessedCases(s: SliceState): WindBlessedProjection['cases'] {
  if (s.progression.pathwayId !== 'tyrant' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2)) return [];
  return CASES.map(p => {
    const r = s.windBlessed.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status)
      ? (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + (r.contactOpen ? p.id === 'low-platform' ? ' 仍在原台面，待明确选择原楼梯或另付2灵性风托返回。' : ' 尚须停风、归还原物并实际离开。' : ' 随后' + p.close + (p.id === 'low-platform' ? ` 当前GROUND，已完成风托返程${s.windBlessed.flight.flightReturns}次、原楼梯返程${s.windBlessed.flight.stairReturns}次。` : ''))
      : r.attemptWeek !== null ? '此前实施未成，已付成本与原观察保留。' + (p.id === 'low-platform' ? '当前位置GROUND，没有登台。' : '') : r.withdrawals ? '尚未实施的准备已取消，原观察保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? p.id === 'low-platform' && s.windBlessed.flight.position === 'LOW_PLATFORM' ? '仍在原低台，返程与离开尚未完成' : '本次接触仍须实际结束并离开' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
/** No implicit flight return, invented object, duplicate growth source or cross-week open contact. */
export function validateWindBlessedLife(s: SliceState): boolean {
  const m = s.windBlessed;
  if (!record(m) || !record(m.cases) || !shape(m.cases, WIND_BLESSED_CASE_IDS) || !record(m.flight) || !shape(m.flight, ['position', 'ascents', 'flightReturns', 'stairReturns']) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.flight;
  if (!['GROUND', 'LOW_PLATFORM'].includes(f.position) || !integer(f.ascents, 0, 1) || !integer(f.flightReturns, 0, 1) || !integer(f.stairReturns, 0, 1)) return false;
  if (f.ascents !== f.flightReturns + f.stairReturns + (f.position === 'LOW_PLATFORM' ? 1 : 0)) return false;
  const isPromoted = s.progression.pathwayId === 'tyrant' && (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `wind-blessed-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    const successful = ['EXAMINED', 'RESOLVED'].includes(r.status as string);
    if (successful) {
      if (r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome)) return false;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (!isPromoted && (r.status !== 'AVAILABLE' || r.attemptWeek !== null || r.method !== null || r.outcome !== 'NONE' || r.contactOpen || r.closes !== 0 || r.withdrawals !== 0)) return false;
    if (p.id === 'low-platform') {
      if (f.ascents !== (successful ? 1 : 0)) return false;
      if ((f.position === 'LOW_PLATFORM') !== (successful && r.contactOpen)) return false;
    }
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.filter(x => x === 'wind-blessed-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!isPromoted && (m.reflected || f.position !== 'GROUND' || f.ascents !== 0)) return false;
  if (isPromoted && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.oceanSinger.windBlessedActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
