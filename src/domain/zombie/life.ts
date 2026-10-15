import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { WEREWOLF_MOON_EVENTS } from '../werewolf/content.js';
import { applyZombieEncounter, blockZombieEncounter, ZOMBIE_ENCOUNTER_STORY } from './encounter.js';
import { validateZombieCommand } from './index.js';
import { ZOMBIE_CASE_IDS, type ZombieCommand, type ZombieActivityCommand, type ZombieAction, type ZombieProjection } from './types.js';

const CASES = [
  { id: 'narrow-load', title: '原工坊的低位托架',
    story: '原工坊有一份已经称量、放在原低位托架上的有限工料。哈伦同意在净空的原地面操作区观察你短距离挪稳这份原负荷；原推车就在旁边。没有人在工料下方，不以撞击、射击或割伤测试身体。',
    facts: ['原工料、托架与推车确实在场，重量与移动边界已知，双方保持距离。', '只处理原有限负荷；本人坚硬不保证任意承重、无敌或任何战斗必胜。'],
    ability: '以更强身体在原低位托架上稳住并有限挪动原工料；1行动、3灵性，失败照耗。保持BRACED用力状态直至显式卸力、把原负荷落稳；不会自伤测试。',
    ordinary: '用原有推车与托架有限移动同一原工料；1行动、0灵性，不声称动用钢铁身体，不凭空获得新工具。',
    result: '原工料已在原低位托架落稳，记录本次有限负荷与实际处理范围；本人已卸力，未做自伤或无敌测试，也没有赠送工料。', outcome: 'LOAD_HANDLED' },
  { id: 'cold-tray', title: '清空区域中的原浅盘',
    story: '哈伦已经清空原浅盘周边，盘中只有原有少量清水。原垫与原常温水器在旁，测试只限同一浅盘，没有人、食物或活物作为目标。',
    facts: ['原浅盘与少量水确实在场，区域净空，测试限于薄冰。', '寒冷状态必须在本次实践结束时实际停止、融化并收妥，不能让冰留在通道上。'],
    ability: '在同一原浅盘上形成有限薄冰，核对有限寒冷结果；1行动、3灵性，失败也可能留下薄冰与冷盘。须另选0行动停止寒冷、以原常温水融开并擦干收妥。',
    ordinary: '用原浅盘、原常温水作普通温度与安全放置对照；1行动、0灵性，不制造冰霜，不声称施法。',
    result: '本次原浅盘的有限结果已记录。若实际施加寒冷，薄冰已用原常温水融开，原盘擦干收妥；未冻结他人、建筑或任何活物。', outcome: 'COLD_RECORDED' },
  { id: 'willing-spirit', title: '赫姆认识的旧箱标记',
    story: '成年搬运工赫姆已经去世，他的幽魂在故事开始前就留在原工坊这一处。哈伦介绍他此前负责的原木箱和当时的实物交接记录；赫姆明确自愿只为这次核对指认自己认识的一个箱标。没有召唤、制造新幽魂或挖掘遗体。',
    facts: ['赫姆是此地既存的成年亡者，本人明确同意这一次有限协助；可随时结束，不强迫他透露其它经历。', '指认范围仅限他认识的原箱标，必须与眼前原木箱和原实物记录核对；死者并非全知。'],
    ability: '向此地已经存在且愿意协助的赫姆提出一次有限指认请求，并对照原箱标与实物交接记录；1行动、3灵性。结果可以失败，接触须显式结束并告知他本次协助已解除，不复活或读取所有死者记忆。',
    ordinary: '普通核对眼前原木箱的标记与原实物交接记录；1行动、0灵性，不接通灵性联系，不假称幽魂给了答案。',
    result: '只把原木箱标记与原实物交接记录相符的部分写入报告。若请求了赫姆协助，本次有限请求已经解除，他不被扣留；未获得陌生死者记忆、全知线索或新幽魂。', outcome: 'MARK_CORROBORATED' },
] as const;

export const ZOMBIE_ENVIRONMENT = '以下现场、流程与数值为原创G：观察、准备、实践、报告各1行动；能力实践额外3灵性，普通方法0灵性，失败照付。实践产生真实接触，身体仍用力、盘中薄冰或本次幽魂联系须0行动显式结束；收束时间已预付，不退资源、不治疗。BRACED只是本人当前用力状态，恢复NORMAL不移除活尸的钢铁身体；PRESENT只记录本次向既存赫姆建立的联系，不表示凭空创造亡者。三份真实报告各25扮演，最后反思25，和平100是有成本的G玩法。满月沿用原先提前公示的有限事件，节制剧痛期间先实际度过发作，不能战斗；不以普通替代食物、节制或消化保证解除诅咒。' + ZOMBIE_ENCOUNTER_STORY;
const active = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 6;
const contactOpen = (s: SliceState) => Object.values(s.zombie.cases).some(r => r.contactOpen);
export const zombieInside = (s: SliceState) => s.zombie.moon.pendingWeek !== null || contactOpen(s);
export const isZombieActivity = (c: ZombieCommand): c is ZombieActivityCommand =>
  ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'HANDLE_MOON', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

/** Only the actual, finite preannounced episode; never derive a new lunar calendar. */
export function syncZombieMoon(s: SliceState, ctx: SeerContext): void {
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.activeEvent || s.combat || zombieInside(s)) return;
  if (Object.values(s.werewolf.cases).some(r => r.sceneOpen) || Object.values(s.madman.cases).some(r => r.burstOpen) || Object.values(s.prisoner.cases).some(r => r.holding)) return;
  const event = WEREWOLF_MOON_EVENTS.find(entry => entry.week === s.week);
  if (!event || s.werewolf.moon.history.some(entry => entry.week === s.week) || s.zombie.moon.history.some(entry => entry.week === s.week)) return;
  s.zombie.moon.pendingWeek = s.week;
  ctx.note('原告示中的满月已经到来', `第${event.week}周「${event.title}」的本次G月相事件开始。你作为活尸节制冲动，正在承受真实剧痛，发作期间无法战斗或继续普通活动；须实际度过这段时间。不会自动攻击他人；这取代旧序列的发作形态，旧历史不删除，也不重复结算已经处理的同一场。`);
}
function blocked(s: SliceState, c: ZombieActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockZombieEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成活尸晋升。';
  const m = s.zombie, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (contactOpen(s)) return '先0行动实际卸力落稳、融冰收妥或解除本次幽魂请求。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (c.type === 'HANDLE_MOON') {
    if (m.moon.pendingWeek === null) return '当前没有尚待度过的活尸月圆。';
    return c.method === 'GUARDED' && s.world.city !== 'BACKLUND' ? '哈伦在贝克兰德原工坊，不能被召到异地。' : null;
  }
  if (m.moon.pendingWeek !== null) return '先实际度过本次活尸月圆剧痛，当前不能战斗或继续普通活动。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德哈伦的原工坊。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前已准备的事项。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践未成，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' ? '先取得真实结果，并实际结束本次接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力需要3灵性，不能透支；可取消准备后选择普通方法。' : null;
}

export function applyZombieActivity(s: SliceState, c: ZombieActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateZombieCommand(c) || !isZombieActivity(c)) throw new Error('活尸活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyZombieEncounter(s, c, ctx); return; }
  const m = s.zombie;
  if (c.type === 'HANDLE_MOON') {
    const week = m.moon.pendingWeek!, mentalCost = Math.min(s.mind, c.method === 'GUARDED' ? 10 : 20);
    s.mind -= mentalCost; m.moon.history.push({ week, method: c.method, mentalCost }); m.moon.pendingWeek = null;
    ctx.note('实际度过本次活尸满月剧痛', c.method === 'GUARDED' ? '你当面向哈伦提出本次守望，他自愿在原工坊的隔开空间协助你度过这一段真实发作时间。剧痛期间没有战斗，他没有替你承担诅咒，也未被召到异地。' : '你留在当前地点停止接触他人，独自节制并实际度过这一段发作时间；剧痛期间没有战斗，没有被传送到新的安全地点。');
    ctx.note('本次发作过去，诅咒仍在', `0行动，精神实际消耗${mentalCost}。月相事件这一段时间实际过去，峰值剧痛随本次发作结束；没有治疗、补灵性、增加消化或掌握。原狼人历史保留，不重复付旧代价。节制、消化与普通替代食物都不保证治愈诅咒；下一场以原先公示的有限月相事件为准，末场之后尚未展开不代表诅咒消失。`); return;
  }
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1; m.practice.body = 'NORMAL';
    if (m.practice.cold === 'ICED') m.practice.cold = 'THAWED';
    if (m.practice.spirit === 'PRESENT') m.practice.spirit = 'RELEASED';
    ctx.note('实际结束本次接触', c.caseId === 'narrow-load' ? '你把原有限负荷实际落稳在原低位托架，卸去本次用力姿态；原推车留在原处。NORMAL表示不再用力，不移除永久钢铁身体。0行动，不退款、不治疗。' : c.caseId === 'cold-tray' ? '你实际停止原浅盘上的寒冷，用原常温水融开本次薄冰，擦干并收妥同一原浅盘；普通观察则收妥原器具。0行动，收束时间已预付，不退款、不治疗。' : '你明确告知原地既存的赫姆本次协助请求已经解除，实际停止灵性联系，让他自由结束本次协助；普通方法则结束实物核对。他没有被创造、复活、消灭或转移。0行动，不退款、不治疗。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消准备，没有开始新的身体用力、薄冰或幽魂联系；不退之前已经花费的行动。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('zombie-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看有限力量与真实边界', '你把有限负荷、真实寒冷、既存亡者本人的意愿、实物证据与实际停止分别记录。G扮演+25；和平100只是有成本的G玩法，不使钢铁身体变成无敌、不复活、不读取一切死者记忆，也不消除满月诅咒。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`zombie-case:${p.id}`, 8);
    ctx.note(p.title, p.result + (r.method === 'ORDINARY' ? '本次采用普通方法，没有虚构施法或幽魂答案。' : '') + '本次接触已结束，G扮演+25，已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    if (p.id === 'narrow-load') m.practice.body = 'BRACED';
    if (p.id === 'cold-tray') m.practice.cold = 'ICED';
    if (p.id === 'willing-spirit') m.practice.spirit = 'PRESENT';
    ctx.note('本次有限实践已经开始', '实际消耗3灵性。' + (p.id === 'narrow-load' ? '你正在对原低位有限负荷用力，结果失败也须卸力落稳。' : p.id === 'cold-tray' ? '同一原浅盘已经受冷并留有薄冰，核对失败也必须实际融开收妥。' : '你向原地已经存在且本人愿意配合的赫姆建立本次有限请求联系；没有召来或制造新幽魂，指认仍可能失败。') + '须显式0行动结束，不退成本。');
  }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'perception', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    ctx.note(p.title, p.id === 'willing-spirit' ? (r.method === 'ABILITY' ? '赫姆自愿指出自己认识的原箱标；你当场与同一木箱和原实物交接记录核对相符，仅确认这一点。本次有限联系仍在，须实际解除请求。' : '你普通核对了同一原木箱与原实物交接记录，只确认相符标记，没有借用幽魂答案。普通接触须结束后再报告。') : '本次有限测试已取得结果，但当前接触仍在，须先实际卸力落稳、融冰收妥或结束普通观察。');
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, '本次未取得可报告结果，已付行动和灵性不会退还，当前接触仍在。先0行动实际卸力落稳、融冰收妥或解除本次请求；下一真实周可重新准备，不追加危险或自伤试验。');
  }
}

export function zombieActions(s: SliceState): ZombieAction[] {
  if (!active(s)) return [];
  const out: ZombieAction[] = [];
  const add = (id: string, label: string, cost: string, command: ZombieActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (s.zombie.moon.pendingWeek !== null && !contactOpen(s)) {
    add('zombie-moon-guarded', '请哈伦当面守望，实际度过剧痛', '0行动 · 至多10精神 · 不治疗或成长', { type: 'HANDLE_MOON', method: 'GUARDED' });
    add('zombie-moon-alone', '留在当前地点独自度过剧痛', '0行动 · 至多20精神 · 不治疗或成长', { type: 'HANDLE_MOON', method: 'ALONE' }); return out;
  }
  for (const p of CASES) {
    const r = s.zombie.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'narrow-load' ? '卸力并将原负荷实际落稳' : p.id === 'cold-tray' ? '停止寒冷、融冰并收妥原盘' : '解除本次请求，结束与赫姆的联系', '0行动 · 实际收束 · 不退款、不治疗', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场与当前边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, p.id === 'narrow-load' ? '准备有限身体负荷实践' : p.id === 'cold-tray' ? '准备原浅盘有限薄冰' : '准备向既存赫姆请求有限协助', '1行动 · 尚未施法', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备原物的普通核对方法', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际完成本次有限实践', r.method === 'ABILITY' ? '1行动 · 3灵性 · 失败照耗' : '1行动 · 0灵性 · 仍可失败', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告实际结果与有限边界', '1行动 · 先实际结束接触', { type: 'REPORT', caseId: p.id });
  }
  if (!s.zombie.reflected) add('zombie-reflect', '回看力量、证据与本人的边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.zombie.encounter.status === 'AVAILABLE') {
    add('zombie-encounter-talk', '到原工坊外院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('zombie-encounter-fight', '到原工坊外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function zombieCases(s: SliceState): ZombieProjection['cases'] {
  if (!active(s) && !(s.progression.pathwayId==='chained'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) return [];
  return CASES.map(p => {
    const r = s.zombie.cases[p.id]!;
    let result: string | null = r.status === 'RESOLVED' ? p.result : r.status === 'EXAMINED' ? r.contactOpen ? '已取得本次有限结果，但当前接触仍在；先实际卸力、融冰收妥或解除请求。' : p.result : r.attemptWeek !== null ? '上次未形成可报告结果；成本保留，接触须先收束，下一真实周可重新准备。' : r.withdrawals ? '尚未实施的准备已经取消，没有开始新的能力消耗。' : null;
    if (result && ['EXAMINED', 'RESOLVED'].includes(r.status) && r.method === 'ORDINARY') result += '本次为普通方法，没有施法或借用幽魂答案。';
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触尚未结束，须实际收束' : '无本次持续用力、薄冰或幽魂联系', closes: r.closes };
  });
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
export function validateZombieLife(s: SliceState): boolean {
  const m = s.zombie;
  if (!record(m) || !record(m.cases) || !shape(m.cases, ZOMBIE_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  if (!record(m.practice) || !shape(m.practice, ['body', 'cold', 'spirit']) || !['NORMAL', 'BRACED'].includes(m.practice.body) || !['NONE', 'ICED', 'THAWED'].includes(m.practice.cold) || !['ABSENT', 'PRESENT', 'RELEASED'].includes(m.practice.spirit)) return false;
  if (!record(m.moon) || !shape(m.moon, ['pendingWeek', 'history']) || !Array.isArray(m.moon.history) || !record(s.werewolf.moon) || !Array.isArray(s.werewolf.moon.history)) return false;
  const promotion = m.promotionWeek ?? s.week;
  const moonWeeks = new Set<number>();
  for (const entry of m.moon.history) {
    if (!record(entry) || !shape(entry, ['week', 'method', 'mentalCost']) || !integer(entry.week, promotion, s.week) || !WEREWOLF_MOON_EVENTS.some(event => event.week === entry.week) || moonWeeks.has(entry.week) || s.werewolf.moon.history.some(old => old.week === entry.week)) return false;
    if (!['GUARDED', 'ALONE'].includes(entry.method) || !integer(entry.mentalCost, 0, entry.method === 'GUARDED' ? 10 : 20)) return false;
    moonWeeks.add(entry.week);
  }
  if (m.moon.pendingWeek !== null && (!active(s) || m.moon.pendingWeek !== s.week || !integer(m.moon.pendingWeek, promotion, s.week) || !WEREWOLF_MOON_EVENTS.some(event => event.week === m.moon.pendingWeek) || moonWeeks.has(m.moon.pendingWeek) || s.werewolf.moon.history.some(old => old.week === m.moon.pendingWeek) || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE')) return false;
  let open = 0, prepared = 0, resolved = 0, braced = false, iced = false, present = false;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `zombie-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1 || r.outcome !== p.outcome) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen) || r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.moon.pendingWeek !== null) return false;
      if (r.method === 'ABILITY') { braced = p.id === 'narrow-load'; iced = p.id === 'cold-tray'; present = p.id === 'willing-spirit'; }
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
  }
  if ((m.practice.body === 'BRACED') !== braced || (m.practice.cold === 'ICED') !== iced || (m.practice.spirit === 'PRESENT') !== present || open > 1 || prepared > 1 || open && prepared) return false;
  for (const [id, field, finished, initial] of [['cold-tray', 'cold', 'THAWED', 'NONE'], ['willing-spirit', 'spirit', 'RELEASED', 'ABSENT']] as const) {
    const r = m.cases[id]!;
    if (m.practice[field] === finished && (r.attemptWeek === null || r.closes < 1)) return false;
    if (r.method === 'ABILITY' && r.status !== 'PREPARED' && r.attemptWeek !== null && !r.contactOpen && m.practice[field] !== finished) return false;
    if (r.attemptWeek === null && m.practice[field] !== initial) return false;
  }
  if (s.seer.completedSources.filter(x => x === 'zombie-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if ((active(s)||(s.progression.pathwayId==='chained'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) && ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?s.wraith.zombieActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (m.practice.body !== 'NORMAL' || m.practice.cold !== 'NONE' || m.practice.spirit !== 'ABSENT' || m.moon.pendingWeek !== null || m.moon.history.length !== 0 || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
