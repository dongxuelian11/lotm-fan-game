import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyDreamStealerEncounter, blockDreamStealerEncounter, DREAM_STEALER_ENCOUNTER_STORY } from './encounter.js';
import { DREAM_STEALER_CASE_IDS, type DreamStealerCaseId, type DreamStealerCommand, type DreamStealerActivityCommand, type DreamStealerAction, type DreamStealerProjection } from './types.js';

const CASES = [
  {
    id: 'announced-seat', title: '她刚想坐下，你已经坐下',
    story: '艾德温·洛克的原练习室内，同一位成年瑟蕾·芬恩另行同意这一次有限念头试验。她站在她自己的原椅前，你站在你自己的原椅前；两把原椅一直各归其主。她只在实际实施时才形成“现在坐在自己椅上”的念头，旧盗火人演示与能力借用约定不延长。（原创G）',
    facts: ['观察与准备只核对两把原椅、安全空间及本人这一次同意；双方仍站立，尚未发生目标念头、暂停或偷取。', '能力实施1行动、3灵性、知识14；成功时她暂忘当前坐下念头、仍站立，你在同一行动中立即坐在你自己的原椅上，不能存着以后执行。', '失败时她按自己的原念头实际坐下，你仍站立；没有偷取、代执行或取得她的闪光和冰霜。', '0行动收束实际经过本场G十秒，核对当前决定恢复，再让已坐下的本人各自普通起身；没有永久删除念头，恢复后她可以拒绝进一步试验。'],
    ability: '只准备这一次自愿坐下意图试验；此刻双方仍站立。实施时才发生她当前坐下的念头，成功偷取后你立即坐自己的原椅；另耗3灵性、知识14，不储存念头或顺带偷她的能力。',
    ordinary: '准备普通请求、暂停比较与各自在原椅上坐下的演示；实施知识10、0灵性。双方依普通约定自愿行动，没有强制暂停或遗忘。',
    abilityResult: '实施时瑟蕾刚形成坐下的当前念头，你成功偷取；她仍站立、短暂忘记这一次要坐下，你在同一个已付行动内立即坐在自己的原椅上。没有延迟执行，没有取得她的非凡能力。',
    ordinaryResult: '实施时瑟蕾依普通约定自愿暂停、示范在自己的原椅上坐下，你也普通坐在你自己的原椅上作比较。没有强制暂停、念头遗忘或能力偷取。',
    failure: '本次核对未成。能力失败时瑟蕾已按原念头普通坐下，你仍站立；普通方法失败也保留双方已经自愿坐下的事实。',
    outcome: 'SEAT_CHECKED',
  },
  {
    id: 'intended-reach', title: '伸向自己的空桌，原木片留在原处',
    story: '同一位成年诺汀·布莱尔在原练习室另行同意一次有限试验。他自己的唯一蓝色原木片DS5-TOKEN-1放在他面前的原桌上；与你的空桌相隔两米。你的原桌和手都空着。他只在实际实施时才形成“伸手拿我桌上木片”的当前念头。（原创G）',
    facts: ['原木片只有一枚，始终属于诺汀；你的原桌没有对应木片，不用复制物件让偷来的念头自动成功。', '能力实施1行动、3灵性、知识14；成功时你立刻伸空手向自己的空桌，诺汀短暂忘记当前伸手念头，原木片仍在他的原桌。', '失败时诺汀实际拿起自己原木片，你仍站立；普通方法则由他自愿演示实际拿起，你用空手作普通伸手比较。', '0行动收束实际经过G十秒；被偷取者恢复后自由完成本次伸手，亲手拿起并放回同一枚原木片，你撤回自己的空手。原物移动逐次保留，不借念头偷取转移物权。'],
    ability: '只准备这一次当前伸手念头试验，原木片仍在诺汀原桌，你的桌和手仍空着。实施成功即在同一行动中伸向自己的空桌，另耗3灵性、知识14；不偷取木片或勇气。',
    ordinary: '准备请求诺汀用自己的原手拿起唯一原木片，你在自己的空桌上普通模仿伸手；实施知识10、0灵性，不让他遗忘或强制暂停。',
    abilityResult: '实施时诺汀刚决定伸手拿起自己的木片，你偷取该当前念头并立即伸空手向自己的空桌；他暂忘这一次伸手，DS5-TOKEN-1仍在他的原桌。念头已在同一行动中执行，既没取得原木片，也没取得勇气能力。',
    ordinaryResult: '实施时诺汀自愿亲手拿起同一枚DS5-TOKEN-1，你普通伸空手向自己的空桌作比较。原木片仍在原主手里，所有权不变；没有念头遗忘或偷取。',
    failure: '本次核对未成；诺汀已按自己的当前念头亲手拿起原木片。能力失败时你仍站立，普通方法失败也保留你已经普通伸手的事实。',
    outcome: 'REACH_CHECKED',
  },
  {
    id: 'empty-performance', title: '会动的木臂没有自己的念头',
    story: '原导师展示原桌上由同一原杠杆带动的木臂，以及说明连接方式的原记录。它的动作来自普通机构，没有独立心智；动作相似不等于它正在形成可偷取的念头。本案只做普通检查。（原创G）',
    facts: ['原木臂的运动由原杠杆产生，没有独立心智，也没有当前决定可偷取。', '仅开放普通知识10、0灵性的方法：亲手检查原杠杆和原连接，再核对原记录；不造假目标能力池。', '窃取梦境或理想有原著名称边界，但详细操作未核实，本段不把未知梦境、机械动作或幻象冒充真实念头，不开放全局梦境系统。'],
    ability: '',
    ordinary: '准备普通检查同一原杠杆、木臂连接和原记录，知识10、0灵性；没有能力按钮、虚构心智或可偷取技能。',
    abilityResult: '',
    ordinaryResult: '你实际操作并检查原杠杆与原木臂的机械连接，再核对原记录，确认这次动作来自普通机构。它没有自己的心智或当前意图，不是可以偷取的思想来源；未核实的梦境操作仍保持未知。',
    failure: '本次原机构与记录的普通核对尚不足以报告；没有偷取尝试，也没有把木臂变成有心智者。',
    outcome: 'NO_MIND_CHECKED',
  },
] as const;
type Case = typeof CASES[number];

export const DREAM_STEALER_ENVIRONMENT = '三项原创G实践分别核对成年原志愿者当前坐下念头、当前伸手念头，以及没有心智的原机械木臂。人物、本人新同意、原场地、距离、十秒恢复段和数值全为原创G。每案观察、准备、实施、报告各1行动；前两案能力实施3灵性、知识14，成功偷取必须在同一行动中立即由本人执行相应动作，不能储存、转嫁或免除自身执行。目标暂忘当前念头，可以恢复决定；不永久删除人格，不顺带取得念头涉及的能力。普通方法知识10、0灵性，第三案仅普通检查。失败保留已付成本及真实动作，先0行动收束后下一真实周再准备。准备不生成念头、不暂停目标；只有实际接触、未复原姿势、目标暂停或原木片仍在手上才需先收束。收束实际经过G十秒、核对决定恢复，双方各自普通起身或撤回空手，诺汀亲手拿起并放回同一枚原木片，所有权不变。三案报告各G扮演25；能力报告一次已有知识池单项掌握8，普通报告不伪造能力奖励；三案反思25可和平100。更强者可抵抗，幻象和无心智机构不构成有效原念头；梦境窃取详细操作未核实，不新增全局梦境机制。' + DREAM_STEALER_ENCOUNTER_STORY;
export const dreamStealerInside = (s: SliceState) => Object.values(s.dreamStealer.cases).some(r => r.contactOpen) || s.dreamStealer.practice.playerPose !== 'STANDING' || s.dreamStealer.practice.targetPaused || s.dreamStealer.practice.token === 'TARGET_HAND';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export const isDreamStealerActivity = (c: DreamStealerCommand): c is DreamStealerActivityCommand => record(c) && ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
function validActivity(c: unknown): c is DreamStealerActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!DREAM_STEALER_CASE_IDS.includes(c.caseId as DreamStealerCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: DreamStealerActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'error' || s.progression.sequence !== 5) return '先完成窃梦家晋升。';
  const m = s.dreamStealer, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德艾德温·洛克的原练习室，不能借结束接触瞬移。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次接触。';
  if (dreamStealerInside(s)) return '先0行动实际核对当前决定恢复、各自起身或撤手，并让原主放回同一枚原木片。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或0行动取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockDreamStealerEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场、当前意图边界与本人同意已经核对。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果，再实际核对恢复、姿势与原木片复位。';
  if (c.type === 'PREPARE') {
    if (c.caseId === 'empty-performance' && c.method === 'ABILITY') return '原机械木臂没有独立心智，不能从普通运动制造可偷取的念头。';
    return r.status !== 'OBSERVED' ? '先核对原现场与这一次有限同意。' : r.attemptWeek === s.week ? '本周实际尝试与成本保留，下一真实周再准备。' : null;
  }
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才可重试。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力需要3灵性；可0行动取消准备，休养或改用普通方法。' : null;
}
const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => method === 'ABILITY' ? p.abilityResult : p.ordinaryResult;
const practiceText = (s: SliceState) => {
  const f = s.dreamStealer.practice;
  return `你的当前姿势：${f.playerPose === 'STANDING' ? '普通站立、空手已收回' : f.playerPose === 'SEATED' ? '已坐在自己的原椅上' : '空手已伸向自己的空桌'}；${f.targetPaused ? '原目标暂忘当前念头，仍须实际核对恢复' : '没有仍被偷取暂停的当前念头，原目标可自由决定'}。唯一DS5-TOKEN-1${f.token === 'TARGET_DESK' ? '在诺汀原桌' : '在诺汀本人手里'}，始终属于诺汀。成功偷取${f.thefts}次、同一行动立即自身执行${f.executions}次、实际恢复${f.recoveries}次；原木片由原主亲手移动${f.tokenMoves}次。`;
};
export function applyDreamStealerActivity(s: SliceState, c: DreamStealerActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('窃梦家实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyDreamStealerEncounter(s, c, ctx); return; }
  const m = s.dreamStealer, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!, recovering = f.targetPaused;
    let movement = '';
    if (c.caseId === 'intended-reach') {
      if (recovering) { f.token = 'TARGET_HAND'; f.tokenMoves += 1; movement += '诺汀在实际经过十秒并恢复当前决定后，自由完成这次伸手，亲手拿起自己的同一枚原木片；'; }
      if (f.token === 'TARGET_HAND') { f.token = 'TARGET_DESK'; f.tokenMoves += 1; movement += '他再亲手把同一枚DS5-TOKEN-1放回自己的原桌，所有权不变。'; }
      movement += '你普通撤回自己的空手，回到站立姿势。';
    } else if (c.caseId === 'announced-seat') movement = '已经坐下的本人各自普通从自己的原椅起身；瑟蕾若一直站立就仍站立，两把原椅没有交换或复制。你回到普通站立姿势。';
    else movement = '你实际停止操作原杠杆，让原木臂停止普通机械动作，原机构与原记录留在原处；没有心智恢复或能力执行。';
    if (recovering) f.recoveries += 1;
    f.targetPaused = false; f.targetRecovered = true; f.playerPose = 'STANDING'; r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次接触与复位', '0行动结束这次有限实践。' + (c.caseId !== 'empty-performance' ? '本次已付实施内实际经过原创G十秒；' + (recovering ? '核对原目标已经恢复当前决定，并可自由拒绝进一步试验；没有永久删除念头。' : '没有被偷取的念头需要恢复，也不把普通配合说成强制遗忘。') : '') + movement + '已付行动与灵性不返、不治疗、不再奖励。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次计划，原观察及已付准备行动保留。尚未形成待偷取的当前念头、暂停目标、坐下或伸手，原木片仍在原主桌上；没有储存的念头需要释放。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('dream-stealer-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看当前决定、自身执行与来源边界', '回看同一动作必须立即由自身执行、原目标能够恢复当前决定，以及原物不会随念头转移。无心智木臂没有可偷来源；未知梦境仍保持未知。G扮演+25，普通方法也可完成有限帮助，不获得能力掌握奖励。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '本次只核对原现场与有限边界，尚未形成待偷念头或改变任何姿势、原物位置。'); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `dream-stealer-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, '本次实施记录：' + resultText(p, r.method!) + '随后已经实际结束接触、核对当前决定恢复和普通复位；原木片现在在原主桌上。G扮演+25；' + (r.method === 'ABILITY' ? '能力报告获一次已有知识池单项掌握+8，不复制志愿者能力。' : '普通报告不冒充能力掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') s.spirituality -= 3;
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10), success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  if (p.id !== 'empty-performance') {
    if (r.method === 'ABILITY' && success) {
      f.thefts += 1; f.executions += 1; f.targetPaused = true; f.targetRecovered = false;
      f.playerPose = p.id === 'announced-seat' ? 'SEATED' : 'REACHING';
    } else {
      // Ordinary physical demonstrations happen even if subsequent checking fails.
      f.playerPose = r.method === 'ORDINARY' ? p.id === 'announced-seat' ? 'SEATED' : 'REACHING' : 'STANDING';
      if (p.id === 'intended-reach') { f.token = 'TARGET_HAND'; f.tokenMoves += 1; }
    }
  }
  if (success) {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    ctx.note(p.title, resultText(p, r.method!) + '本次接触仍须0行动实际收束后才能报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, p.failure + '本次已付1行动' + (r.method === 'ABILITY' ? '与3灵性' : '') + '不返；先0行动实际收束，下一真实周可重新准备。' + practiceText(s));
}
export function dreamStealerActions(s: SliceState): DreamStealerAction[] {
  if (s.progression.pathwayId !== 'error' || s.progression.sequence !== 5) return [];
  const out: DreamStealerAction[] = [], m = s.dreamStealer;
  const add = (id: string, label: string, cost: string, command: DreamStealerActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', p.id === 'empty-performance' ? '停止原杠杆检查与本次接触' : '实际核对恢复并各自普通复位', '0行动 · 原木片由原主亲手放回 · 成本保留', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原现场、来源与这一次同意', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.id !== 'empty-performance') add(p.id + '-ability', p.id === 'announced-seat' ? '准备当前坐下念头试验' : '准备当前伸手念头试验', '1行动 · 此刻不执行 · 实施另3灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'empty-performance' ? '准备普通检查原杠杆与记录' : '准备自愿普通动作比较', '1行动 · 实施0灵性 · 知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', r.method === 'ABILITY' ? '尝试偷取并立即自身执行当前动作' : '实际进行普通检查与比较', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识14 · 自身执行不能延后' : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 没有已偷取的念头 · 成本保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告实际动作与有限边界', '1行动 · 先实际收束与复位', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('dream-stealer-reflect', '回看当前决定、自身执行与来源边界', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('dream-stealer-encounter-talk', '前往原空院与马洛当面澄清', '1行动 · 先完成一项报告', { type: 'ENCOUNTER_TALK' });
    add('dream-stealer-encounter-fight', '前往原空院并承担有限冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function dreamStealerCases(s: SliceState): DreamStealerProjection['cases'] {
  if (s.progression.pathwayId !== 'error' || (s.progression.sequence !== 5&&(s.progression.sequence!==4&&(s.progression.sequence!==3&&s.progression.sequence!==2)))) return [];
  return CASES.map(p => {
    const r = s.dreamStealer.cases[p.id]!;
    const closed = r.attemptWeek !== null && !r.contactOpen ? '这次实施之后已实际收束；当前姿势与原物位置见下方核对。' : '';
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? '本次实施记录：' + resultText(p, r.method!) + closed + practiceText(s)
      : r.attemptWeek !== null ? `第${r.attemptWeek}周有限核对未成，实际动作与已付成本保留；先收束，下一真实周再准备。` + closed + practiceText(s)
        : r.withdrawals ? '尚未实施的准备已取消；没有偷取或执行，原观察和已付行动保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触仍须0行动实际结束，并核对恢复与普通复位' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
export function dreamStealerPractice(s: SliceState): DreamStealerProjection['practice'] {
  if (s.progression.pathwayId !== 'error' || (s.progression.sequence !== 5&&(s.progression.sequence!==4&&(s.progression.sequence!==3&&s.progression.sequence!==2)))) return null;
  const f = s.dreamStealer.practice;
  return {
    pose: f.playerPose === 'STANDING' ? '普通站立；自己的空手已收回' : f.playerPose === 'SEATED' ? '已经坐在自己的原椅上，须普通起身' : '自己的空手已伸向自己的空桌，须普通撤回',
    target: f.targetPaused ? '原目标暂忘这一次当前念头；尚须实际经过G十秒并核对决定恢复' : '没有仍被偷取暂停的念头；原目标可自由决定并拒绝进一步试验',
    token: `DS5-TOKEN-1 · 唯一原蓝色木片 · ${f.token === 'TARGET_DESK' ? '在诺汀原桌' : '在诺汀本人手里'} · 所有权始终属于诺汀`,
    history: [`成功偷取${f.thefts}次，同一行动立即自身执行${f.executions}次，实际恢复${f.recoveries}次`, `原木片由原主亲手移动${f.tokenMoves}次；没有复制、传送或改变所有权`, '旧瑟蕾、诺汀的演示、能力借用与恢复历史独立保留；本次念头试验不偷取它们的非凡能力', '梦境窃取详细操作未核实；当前念头不能储存，也没有序列4免除自身执行'],
  };
}

/** Current thoughts are executed immediately; only real local recovery closes contact. */
export function validateDreamStealerLife(s: SliceState): boolean {
  const m = s.dreamStealer;
  if (!record(m) || !record(m.cases) || !shape(m.cases, DREAM_STEALER_CASE_IDS) || !record(m.practice) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, promoted = s.progression.pathwayId === 'error' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!shape(f, ['playerPose', 'targetPaused', 'targetRecovered', 'token', 'thefts', 'executions', 'recoveries', 'tokenMoves'])) return false;
  if (!['STANDING', 'SEATED', 'REACHING'].includes(f.playerPose) || !['TARGET_DESK', 'TARGET_HAND'].includes(f.token) || typeof f.targetPaused !== 'boolean' || typeof f.targetRecovered !== 'boolean') return false;
  if (![f.thefts, f.executions, f.recoveries].every(x => integer(x, 0, 2)) || !integer(f.tokenMoves, 0)) return false;
  if (f.executions !== f.thefts || f.recoveries > f.thefts || f.targetRecovered !== !f.targetPaused || f.thefts - f.recoveries !== Number(f.targetPaused)) return false;
  const firstWeek = m.promotionWeek ?? s.week, weeks = s.week - firstWeek + 1;
  let open = 0, prepared = 0, resolved = 0, successfulThefts = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, weeks)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string) || p.id === 'empty-performance' && r.method === 'ABILITY') return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, firstWeek, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `dream-stealer-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) {
      if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false;
      if (r.method === 'ABILITY') successfulThefts += 1;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - firstWeek + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || r.closes >= r.attemptWeek - firstWeek + 1) return false;
    }
    if (!promoted && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared || f.thefts !== successfulThefts) return false;
  const seat = m.cases['announced-seat']!, reach = m.cases['intended-reach']!;
  const seatTheft = seat.contactOpen && seat.method === 'ABILITY' && seat.status === 'EXAMINED';
  const reachTheft = reach.contactOpen && reach.method === 'ABILITY' && reach.status === 'EXAMINED';
  if (f.targetPaused !== (seatTheft || reachTheft)) return false;
  const expectedPose = seat.contactOpen && (seat.method === 'ORDINARY' || seatTheft) ? 'SEATED' : reach.contactOpen && (reach.method === 'ORDINARY' || reachTheft) ? 'REACHING' : 'STANDING';
  if (f.playerPose !== expectedPose) return false;
  const holding = reach.contactOpen && !reachTheft;
  if ((f.token === 'TARGET_HAND') !== holding || f.tokenMoves !== reach.closes * 2 + Number(holding)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'dream-stealer-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || f.playerPose !== 'STANDING' || f.targetPaused || !f.targetRecovered || f.token !== 'TARGET_DESK' || f.thefts || f.executions || f.recoveries || f.tokenMoves)) return false;
  if (promoted && ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.parasite.dreamStealerActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
