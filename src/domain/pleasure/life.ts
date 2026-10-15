import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyWitchActivity } from '../witch/life.js';
import { applyPleasureEncounter, blockPleasureEncounter, PLEASURE_ENCOUNTER_STORY } from './encounter.js';
import { PLEASURE_FRAME_SOURCE, PLEASURE_GUIDE, PLEASURE_VOLUNTEER } from './content.js';
import { PLEASURE_CASE_IDS, type PleasureCommand, type PleasureActivityCommand, type PleasureAction, type PleasureProjection } from './types.js';

const REFUSAL = `${PLEASURE_VOLUNTEER}当面明确拒绝：“我不愿参加那场需要久留的社交聚会。”本次邀请结束，魅惑不能推翻拒绝，不抽成功骰，也没有同意或扮演奖励。`;
const NEW_FACT = '艾妲说自己愿意考虑下周白天在原练习场进行一次短暂的公开读句比较；只表示可以重新询问，并未同意尚未提出的新方案。';
const REVISION = '下一真实周实际撤去久留聚会的提议，改为原练习场白天的一次短暂公开读句比较；实施时仍须先听本人真实回答，魅惑永远不能代替本人愿意。';
const WILLING = '艾妲先清楚说明：“我自愿参加这一次短暂的读句比较，随时可以停下。”这是她对修订提议的真实愿意，发生在任何本次魅惑表现之前；只覆盖本次窄范围。';
const CASES = [
  {
    id: 'silk-release', title: '愿意参与，也能随时松开',
    story: `${PLEASURE_GUIDE}在原独立练习场见证一次非亲密安全演示。${PLEASURE_VOLUNTEER}明确自愿让手腕承受一圈轻度束缚，并约定随时可以停止。只可使用本次细丝或原桌上的普通练习绳，不捆身体其它部位，不限制离场，不把魅惑当作同意。（原创G）`,
    facts: ['艾妲是成年人，已当面明确自愿参加这一次轻度手腕演示，事先知道可以随时要求松开。', '普通练习绳在原桌上且属于原场地；能力方案必须本次真实生成蛛丝。', '成功后必须明确0行动松开本次蛛丝，或用普通手法解开原绳并放回原桌；失败也须结束本次接触。'],
    ability: '准备本次真实生成的一圈轻度蛛丝束缚；仅在既有自愿范围内，实施1行动、3灵性、感知14。',
    ordinary: '准备原练习绳的普通轻结比较，实施1行动、0灵性、知识10；实际解开后归还原绳。',
    abilityResult: '在本人已明确自愿的范围内，你实际生成一圈细丝轻束艾妲手腕，完成短时可停止的比较；没有改变她的意愿。',
    ordinaryResult: '在本人已明确自愿的范围内，用同一条原练习绳打了可随时解开的轻结，完成普通比较；没有施展魅惑。',
    abilityOutcome: 'SILK_BOUND', ordinaryOutcome: 'CORD_TIED',
  },
  {
    id: 'refused-invitation', title: '拒绝后重新询问',
    story: `${PLEASURE_VOLUNTEER}已有自己的安排。第一次提出需要久留的聚会邀请时，她会真正拒绝。你要结束接触，下一真实周改变提议，重新听取她自己的回答；能力只能用于她已经愿意参加的短时比较，不能把拒绝变成同意。（原创G）`,
    facts: ['原提议是需要久留的社交聚会，艾妲尚未接受，不存在默认同意。', '拒绝真实发生并保留，能力、行动成本或检定成功都不能替代本人愿意。', '后续窄提议只有在下一真实周重新询问并听到明确自愿回答后，才可实施。'],
    ability: '准备提出原邀请；第一次实施即使耗3灵性准备自己的短时表现，也会实际被拒绝，不能对拒绝者继续使用魅惑。',
    ordinary: '准备普通口头邀请；本人同样可以拒绝，不把礼貌回应当作同意。',
    abilityResult: '先得到本人对修订读句比较的真实愿意，再实际作有限魅惑表现比较；没有改变原拒绝、建立关系或扩大同意范围。',
    ordinaryResult: '先得到本人对修订读句比较的真实愿意，再作普通读句比较；不使用魅惑，原拒绝完整保留。',
    abilityOutcome: 'WILLING_CONVERSATION', ordinaryOutcome: 'ORDINARY_CONVERSATION',
  },
  {
    id: 'fire-break', title: '先有真丝，再以黑焰断开',
    story: `${PLEASURE_FRAME_SOURCE}。导师与艾妲只在安全距离自愿观察。先另花1行动、3灵性在原空框上实际布一段薄蛛丝；之后另一次实施才能使用已经掌握的灵性黑焰烧断，或用原桌上的普通剪刀剪断。没有真人束缚或凭空断丝。（原创G）`,
    facts: ['原空木框固定，始终没有人、动物或其它物品；原普通剪刀在桌上，所有权不改变。', 'SPIN_SILK实际消耗1行动、3灵性，生成本次真实薄丝；准备文案本身不产生丝线。', '黑焰实施必须再耗1行动、3灵性；普通剪断1行动、0灵性。失败保留实际薄丝和成本，退出须普通清理。'],
    ability: '先另行实际布丝，再准备以继承的灵性黑焰打断眼前薄丝；断丝另耗1行动、3灵性，知识14。不是普通火焰或自动成功。',
    ordinary: '先另行实际布丝，再用原普通剪刀剪断眼前薄丝；断丝另耗1行动、0灵性，知识10。',
    abilityResult: '真实薄丝已先布在原空框上，你随后另行实际施展继承的灵性黑焰，成功烧断当前薄丝；没有焚烧他人、治愈或清除污染。',
    ordinaryResult: '真实薄丝已先布在原空框上，你随后用同一把原普通剪刀剪断当前薄丝；没有施放黑焰。',
    abilityOutcome: 'FLAME_BROKEN', ordinaryOutcome: 'SCISSORS_CUT',
  },
] as const;

export const PLEASURE_ENVIRONMENT = '三项为原独立练习场的成年自愿、非露骨原创G实践。每项报告扮演+25、已知能力单项掌握+8，三案反思+25，可和平达到100；这是本作G和平替代路线，不宣称完成原著完整亲密扮演。魅惑不能构成同意，拒绝真实保留；手腕必须明确松开或普通解开，真丝先布再另行黑焰打断。每次实施后都要0行动真实退出，期间不能工作或处理别的事情；不清除污染、不治疗、不开放疾病。' + PLEASURE_ENCOUNTER_STORY;
export const pleasureInside = (s: SliceState) => Object.values(s.pleasure.cases).some(r => r.contactOpen);
export const isPleasureActivity = (c: PleasureCommand): c is PleasureActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'SPIN_SILK', 'BUY_SUPPLIES', 'PREPARE_MIRROR', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validatePleasureActivityCommand(c: unknown): c is PleasureActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'BUY_SUPPLIES', 'PREPARE_MIRROR'].includes(c.type as string)) return shape(c, ['type']);
  if (!PLEASURE_CASE_IDS.includes(c.caseId as typeof PLEASURE_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'SPIN_SILK') return c.caseId === 'fire-break' && shape(c, ['type', 'caseId']);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: PleasureActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockPleasureEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'demoness' || s.progression.sequence !== 6) return '先完成欢愉魔女晋升。';
  const r = 'caseId' in c ? s.pleasure.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未实际结束的本次接触。';
  if (pleasureInside(s)) return '先0行动明确松开、普通解开或清理原框并实际退出。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原独立练习场。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备可取消。';
  if (Object.entries(s.pleasure.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (c.type === 'PREPARE_MIRROR') return s.witch.tools.mirrorPrepared ? '原小镜已经备好。' : s.witch.tools.mirrorsHeld < 1 ? '没有实际持有的原小镜。' : null;
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'BUY_SUPPLIES') return s.witch.tools.lastPurchaseWeek === s.week ? '本周这份原工具包已交付，下周再购。' : s.cash < 60 ? '原工具包需要60便士。' : null;
  if (c.type === 'REFLECT') return s.pleasure.reflected ? '已经回看这段经历。' : CASES.some(p => s.pleasure.cases[p.id].status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原观察与当面同意已经保留。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先核对原物、本人同意和本次范围。';
    return r.attemptWeek === s.week ? '本周结果与拒绝保留，下一个真实周再依原事实准备。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (c.type === 'SPIN_SILK') return s.pleasure.practice.fireSilk === 'ON_FRAME' ? '原空框已有本次真实薄丝，不能重复布丝。' : s.spirituality < 3 ? '实际布丝需要3灵性。' : null;
  if (c.caseId === 'fire-break' && s.pleasure.practice.fireSilk !== 'ON_FRAME') return '先另行实际布丝，不能对不存在的丝线实施断丝。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力实施需要3灵性；可取消准备后选择普通方法。' : null;
}
export function applyPleasureActivity(s: SliceState, c: PleasureActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validatePleasureActivityCommand(c)) throw new Error('欢愉魔女实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyPleasureEncounter(s, c, ctx); return; }
  if (c.type === 'BUY_SUPPLIES' || c.type === 'PREPARE_MIRROR') { applyWitchActivity(s, c, ctx, award); return; }
  const m = s.pleasure, pstate = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]; r.contactOpen = false; r.closes += 1;
    if (c.caseId === 'silk-release') {
      const wrist = pstate.wrist; pstate.wrist = 'FREE';
      ctx.note('明确松开并结束手腕演示', wrist === 'SILK' ? '0行动、0灵性明确松开本次轻束蛛丝，使艾妲手腕实际恢复自由；停止效果并退离，她随时可自行离开。' : wrist === 'CORD' ? '0行动、0灵性用普通手法解开同一条原练习绳，把原绳放回原桌；艾妲手腕实际恢复自由，双方结束演示并离开。' : '本次没有成功束住手腕；0行动停止尝试并实际退离，不虚构释放，也不退还已付成本。');
    } else if (c.caseId === 'fire-break') {
      const intact = pstate.fireSilk === 'ON_FRAME'; pstate.fireSilk = 'CLEARED';
      ctx.note('实际清理原空框并离开', `0行动、0灵性${intact ? '用原普通剪刀剪除失败后仍在原空框上的薄丝' : '移除已断薄丝的残段'}，将原剪刀放回原桌，停止黑焰并退离；原框净空，没有退灵性、传送、治疗或污染清除。`);
    } else ctx.note('停止表现并结束谈话', '0行动、0灵性停止本次表现并实际退离；原拒绝和后来真实愿意的有限范围、观察与成本保留，不追问、不把魅惑解释成同意。');
    return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'fire-break' && pstate.fireSilk === 'ON_FRAME') { pstate.fireSilk = 'CLEARED'; ctx.note('普通清除已布薄丝并取消准备', '0行动用原剪刀清除原空框上的本次真实薄丝，归还原剪刀，再取消尚未实施的断丝准备；已经付出的布丝行动与3灵性不退还。'); }
    else ctx.note('取消尚未实施的准备', '0行动取消本次准备，保留原观察、拒绝与修订记录，不退还行动或灵性，不影响其它事项。');
    return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('pleasure-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('真实意愿、松开与断丝', '回看成年人的明确自愿、不能被魅惑推翻的拒绝，以及先有实际薄丝再实际断丝。G扮演+25；三项报告加反思可和平100。这是本作原创G替代路线，不宣称完成原著完整亲密扮演，不建立亲密关系。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; if (p.id === 'silk-release') pstate.wristConsent = true; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'refused-invitation' && r.notes === 1) { r.revised = true; ctx.note('下一周实际修改邀请', REVISION); }
    ctx.note(p.title, r.revised ? REVISION + (c.method === 'ABILITY' ? '本人愿意后才作本次有限魅惑比较，另耗3灵性。' : '本人愿意后才作普通读句比较。') : c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'SPIN_SILK') {
    s.spirituality -= 3; pstate.fireSilk = 'ON_FRAME';
    ctx.note('实际在原空框布出一段薄丝', `另花1行动、3灵性，在${PLEASURE_FRAME_SOURCE}上实际生成本次薄丝。当前薄丝尚未断开，尚未施放黑焰；下一次实施另付断丝成本，取消准备则须普通清除本次丝线。`); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`pleasure-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + ' 本次接触已实际结束、束缚已解除、原物在原处。原创G和平扮演+25、单项掌握+8；不是原著完整亲密扮演。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') { s.spirituality -= 3; ctx.note('本次能力实际支出', '本次3灵性已经支出，失败不退还；能力支出不能成为任何人的同意。'); }
  if (p.id === 'refused-invitation' && r.notes === 0) {
    r.status = 'OBSERVED'; r.notes = 1;
    ctx.note('艾妲真实拒绝原邀请', REFUSAL + ' ' + NEW_FACT + ' 先0行动结束接触，下一真实周才能改变提议。'); return;
  }
  if (p.id === 'refused-invitation') { pstate.invitationWilling = true; ctx.note('先听到本人真正愿意', WILLING); }
  if (p.id === 'fire-break') ctx.note(r.method === 'ABILITY' ? '另行实际施放灵性黑焰' : '另行实际拿原剪刀断丝', r.method === 'ABILITY' ? '对原空框上本次已真实生成的薄丝，另一次实际施放继承的灵性黑焰；不是把普通火源或准备文字算作黑焰，仍须检定断丝效果。' : '用原普通剪刀实际剪断原空框上的本次薄丝，仍须检查结果；没有施放黑焰。');
  const ability = r.method === 'ABILITY' ? p.id === 'silk-release' ? 'perception' : p.id === 'refused-invitation' ? 'will' : 'knowledge' : 'knowledge';
  const result = ctx.check(ability, r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    if (p.id === 'silk-release') pstate.wrist = r.method === 'ABILITY' ? 'SILK' : 'CORD';
    if (p.id === 'fire-break') { pstate.fireSilk = 'BROKEN'; pstate.fireBreak = r.method === 'ABILITY' ? 'BLACK_FLAME' : 'SCISSORS'; }
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + ' 先0行动实际松开、解开或清理并退离。');
  } else {
    r.status = 'OBSERVED'; if (result.tier === 'GREAT_FAILURE') s.mind = Math.max(0, s.mind - 5);
    ctx.note(p.title, '本次没有形成可报告的有限结果；已付行动与灵性保留。' + (p.id === 'fire-break' ? '真实薄丝仍在原空框，退出必须普通清除。' : p.id === 'silk-release' ? '没有成功束住手腕，仍须停止尝试并结束接触。' : '本人对窄提议的真实愿意并非魅惑结果，原拒绝仍保留。') + (result.tier === 'GREAT_FAILURE' ? '额外疲劳，精神损失至多5。' : '') + '先0行动退出，下一个真实周可再准备。');
  }
}
export function pleasureActions(s: SliceState): PleasureAction[] {
  if (s.progression.pathwayId !== 'demoness' || s.progression.sequence !== 6) return [];
  const out: PleasureAction[] = [];
  const add = (id: string, label: string, cost: string, command: PleasureActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('pleasure-buy-tools', '领取本周原女巫粉剂与小镜', '1行动 · 60便士 · 每周一包', { type: 'BUY_SUPPLIES' });
  add('pleasure-arm-mirror', '把持有的原镜备给替身', '0行动 · 0灵性 · 本次不碎镜', { type: 'PREPARE_MIRROR' });
  for (const p of CASES) {
    const r = s.pleasure.cases[p.id];
    if (r.contactOpen) add(p.id + '-close', p.id === 'silk-release' ? s.pleasure.practice.wrist === 'CORD' ? '普通解开原绳、归还并退出' : '明确松开本次蛛丝并退出' : p.id === 'fire-break' ? '实际清理原空框、停焰并退出' : '停止表现、结束谈话并退出', '0行动 · 0灵性 · 不退成本', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原物、成年人意愿与本次范围', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      const revised = p.id === 'refused-invitation' && r.notes === 1;
      add(p.id + '-ability', revised ? '下周改为短暂比较并重新询问' : '准备有限能力方案', '1行动 · 实施另耗3灵性 · 难度14', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', revised ? '下周改为普通短暂比较并重新询问' : '准备普通方法', '1行动 · 实施0灵性 · 知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      if (p.id === 'fire-break' && s.pleasure.practice.fireSilk !== 'ON_FRAME') add(p.id + '-spin', '先实际在原空框布一段薄丝', '1行动 · 3灵性 · 断丝另行实施', { type: 'SPIN_SILK', caseId: 'fire-break' });
      add(p.id + '-perform', p.id === 'fire-break' ? r.method === 'ABILITY' ? '另行施放灵性黑焰断开真实薄丝' : '用原普通剪刀剪断真实薄丝' : '实际实施并听取本人回答', r.method === 'ABILITY' ? '1行动 · 3灵性 · 仍可能失败' : '1行动 · 0灵性 · 仍可能失败', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', p.id === 'fire-break' ? '普通清理已布薄丝并取消准备' : '取消尚未实施的准备', '0行动 · 0灵性 · 不退还原成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告有限结果与真实边界', '1行动', { type: 'REPORT', caseId: p.id });
  }
  if (!s.pleasure.reflected) add('pleasure-reflect', '回看本人意愿、松开与实际断丝', '1行动 · 三项报告后 · 原创G和平替代', { type: 'REFLECT' });
  if (s.pleasure.encounter.status === 'AVAILABLE') {
    add('pleasure-encounter-talk', '前往原空院当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('pleasure-encounter-fight', '前往原空院并承担真实冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function pleasureCases(s: SliceState): PleasureProjection['cases'] {
  if (s.progression.pathwayId !== 'demoness' || (s.progression.sequence !== 6 && s.progression.sequence !== 5 && (s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2))) return [];
  return CASES.map(p => {
    const r = s.pleasure.cases[p.id], practice = s.pleasure.practice;
    const actual = p.id === 'silk-release' ? practice.wrist === 'FREE' ? ' 当前手腕自由，没有残留束缚。' : ' 当前仍有轻束缚，必须明确松开或普通解开。' : p.id === 'fire-break' ? ` 当前原框丝线：${practice.fireSilk === 'ON_FRAME' ? '真实薄丝尚未断开' : practice.fireSilk === 'BROKEN' ? '已断，残段待清理' : practice.fireSilk === 'CLEARED' ? '已实际清理' : '尚未生成'}。` : '';
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...(r.notes ? [REFUSAL, NEW_FACT] : []), ...(r.revised ? [REVISION] : []), ...(p.id === 'refused-invitation' && practice.invitationWilling ? [WILLING] : [])], preparation: r.status === 'PREPARED' ? (r.revised ? REVISION : r.method === 'ABILITY' ? p.ability : p.ordinary) + actual : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + actual : r.notes ? REFUSAL + (r.revised ? ' 已实际改提议，仍须完成本人的短暂比较。' : ' 下一真实周可以改提议并重新询问。') : r.attemptWeek !== null ? '此前实施未成，原成本仍保留。' + actual : r.withdrawals ? '尚未实施的准备已取消。' + actual : null, status: r.status, contactOpen: r.contactOpen ? '本次接触仍开着，须实际松开、普通解开或清理并退离' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
/** Validate the three finite original practices; no generic consent or relationship meter. */
export function validatePleasureLife(s: SliceState): boolean {
  const m = s.pleasure;
  if (!record(m) || !record(m.cases) || !shape(m.cases, PLEASURE_CASE_IDS) || !record(m.practice) || !shape(m.practice, ['wrist', 'wristConsent', 'invitationWilling', 'fireSilk', 'fireBreak']) || !Array.isArray(s.seer.completedSources)) return false;
  const practice = m.practice;
  if (!['FREE', 'SILK', 'CORD'].includes(practice.wrist) || typeof practice.wristConsent !== 'boolean' || typeof practice.invitationWilling !== 'boolean' || !['NONE', 'ON_FRAME', 'BROKEN', 'CLEARED'].includes(practice.fireSilk) || !['NONE', 'BLACK_FLAME', 'SCISSORS'].includes(practice.fireBreak)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'revised'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || !integer(r.notes, 0, 1) || typeof r.contactOpen !== 'boolean' || typeof r.revised !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `pleasure-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome)) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.notes !== 0 || r.revised)) return false;
    if (r.status === 'OBSERVED' && r.method !== null && r.attemptWeek === null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.notes !== 0)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (p.id === 'refused-invitation') {
      if (r.notes !== (r.attemptWeek === null ? 0 : 1)) return false;
      if (r.revised && (r.notes !== 1 || r.closes < 1)) return false;
      if (r.status === 'PREPARED' && r.notes === 1 && (!r.revised || r.attemptWeek === s.week)) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status as string) && !r.revised) return false;
      if (r.contactOpen && r.revised && r.closes < 1) return false;
    } else if (r.notes !== 0 || r.revised) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const wrist = m.cases['silk-release'], invitation = m.cases['refused-invitation'], fire = m.cases['fire-break'];
  if (practice.wristConsent !== (wrist.status !== 'AVAILABLE')) return false;
  const wristSucceeded = ['EXAMINED', 'RESOLVED'].includes(wrist.status);
  if (practice.wrist !== (wristSucceeded && wrist.contactOpen ? wrist.method === 'ABILITY' ? 'SILK' : 'CORD' : 'FREE')) return false;
  if (practice.invitationWilling && (!invitation.revised || invitation.attemptWeek === null || invitation.status === 'AVAILABLE')) return false;
  if (invitation.revised && invitation.contactOpen && !practice.invitationWilling || ['EXAMINED', 'RESOLVED'].includes(invitation.status) && !practice.invitationWilling) return false;
  const fireSucceeded = ['EXAMINED', 'RESOLVED'].includes(fire.status);
  if (fireSucceeded) {
    if (practice.fireSilk !== (fire.contactOpen ? 'BROKEN' : 'CLEARED') || practice.fireBreak !== (fire.method === 'ABILITY' ? 'BLACK_FLAME' : 'SCISSORS')) return false;
  } else {
    if (practice.fireBreak !== 'NONE' || practice.fireSilk === 'BROKEN') return false;
    if (practice.fireSilk === 'ON_FRAME' && !(fire.status === 'PREPARED' || fire.status === 'OBSERVED' && fire.contactOpen)) return false;
    if (fire.contactOpen && practice.fireSilk !== 'ON_FRAME') return false;
    if (fire.status === 'AVAILABLE' && practice.fireSilk !== 'NONE') return false;
    if (practice.fireSilk === 'CLEARED' && fire.withdrawals === 0 && fire.closes === 0) return false;
  }
  if (s.seer.completedSources.filter(x => x === 'pleasure-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'demoness' && (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))) && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.pain.pleasureActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
