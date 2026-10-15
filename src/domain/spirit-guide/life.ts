import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applySpiritGuideEncounter, blockSpiritGuideEncounter, SPIRIT_GUIDE_ENCOUNTER_STORY } from './encounter.js';
import { SPIRIT_GUIDE_MESSENGER_FEE } from './content.js';
import { SPIRIT_GUIDE_CASE_IDS, type SpiritGuideCommand, type SpiritGuideActivityCommand, type SpiritGuideAction, type SpiritGuideProjection } from './types.js';

const CASES = [
  {
    id: 'messenger-terms', title: '灰羽与一封信的约定',
    story: '成年导师伊芙琳·沃斯开放贝克兰德原纪念工作室的导师房间。她的获准记录只给出一位弱小鸟形灵灰羽的有限线索，不能替你完成招募。你可谨慎准备并亲自邀请、核实回应，再由灰羽自行接受一次递信条款；也可只用普通方法核对导师记录。（原创G）',
    facts: ['邀请只在已知原导师房间进行，灰羽是本作原创弱小鸟形灵，尚非你的信使。', '限定一次递送导师的一封原封信：从导师房间到相邻已知看守房间，再带回收件人自愿给出的有限答复。', '成年看守已经在相邻原房间等待并同意收件；无未知收件人、远方地点、战斗或世界传送。', '灰羽成功接受约定时，从你本人现金实际支付12便士；成功邀请仍不等于信已送达。'],
    ability: '在原导师房间谨慎准备针对灰羽的有限邀请与一次递送条款；实施3灵性、知识14，成功回应且自行接受条款后才招募并从本人预算实付12便士，不展示现实召唤操作。',
    ordinary: '准备核对导师获准记录中的对象边界、原房间与递信条款；实施知识10、不耗灵性，不邀请或招募灰羽。',
    abilityResult: '灰羽实际回应你本次谨慎准备的邀请，并自行接受仅一次相邻已知房间的原封信往返约定。你实际支付12便士，有限约定已建立，信仍在原桌DESK；没有获得随从库存或战斗支援。',
    ordinaryResult: '你实际核对了导师获准记录、已知原房间与有限条款，保留这是普通查阅的结论。没有邀请、招募或付费给灰羽；下一项仍可本人普通递信。',
    abilityOutcome: 'MESSENGER_RECRUITED', ordinaryOutcome: 'TERMS_REVIEWED',
    close: '你实际停止本次局部联系，收好原记录留在导师房间并从原普通出口离开。已经本人接受的灰羽有限约定和实际付费历史保留，不退费、不解除或抹掉既有约定。',
  },
  {
    id: 'short-delivery', title: '相邻看守房间的原封信',
    story: '导师将自己唯一的一封虚构封信放在原导师房间桌上，授权你把它交给相邻原看守房间中已经在场、同意收件的成年看守。内容只询问原纪念牌当晚何时由看守亲自登记。收件人只答复自己所知，不提供全知证明。本人普通步行和灰羽已接受的一次递送都只使用这两个原房间。（原创G）',
    facts: ['原封信只有一封，起初在导师房间DESK，不复制、不变成可交易物。', '已知成年收件人在相邻原看守房间，已经同意收件和给出自己所知的有限答复。', '仅已自行招募的灰羽可执行约定；能力实施3灵性、知识14，成功才实际完成往返。', '普通路线由本人沿原通道实际携原信往返，同样获得有限答复；不冒称信使递送。'],
    ability: '准备请已接受一次约定的灰羽递送这封原信；实施1行动内另付3灵性、知识14，成功才在两间已知相邻房间实际往返并交回有限答复，随后休息。',
    ordinary: '准备本人携同一封原封信沿原普通通道送到相邻看守房间并带回有限答复；实施知识10、0灵性，没有信使代劳。',
    abilityResult: '灰羽在这次已付1行动内实际携同一封原封信到相邻已知看守房间。已在场且同意的收件人实际接信，给出“我只亲自登记了当晚这一回”的有限答复，灰羽带回答复后休息。原信当前位置RECIPIENT、往返1次；一次约定已用完，没有新副本或物品奖励。',
    ordinaryResult: '你本人沿原通道实际携同一封原封信到相邻看守房间，交给已在场且同意的成年收件人，再实际返回导师房间。你带回“我只亲自登记了当晚这一回”的有限答复。原信当前位置RECIPIENT、往返1次；没有信使递送、复制原信或物品奖励。',
    abilityOutcome: 'MESSENGER_DELIVERED', ordinaryOutcome: 'HAND_DELIVERED',
    close: '你实际结束本次局部递信交谈并离开原导师房间；若由灰羽完成往返，它在这一次约定完成后休息，不自动继续送信。已交付的原信仍由原收件人保管，所得有限答复、原物归属与既有约定历史均保留。',
  },
  {
    id: 'restless-echo', title: '原纪念牌旁的短暂躁动',
    story: '原纪念工作室导师房间的一块旧纪念牌旁，实际留有一缕轻度躁动的徘徊亡魂；导师已经核实其在场，现场没有伤者或未知外来灵。你可谨慎以亡者之语短暂降低当前躁动，或使用原普通隔栏保持距离、记录现象并请原导师协助。（原创G）',
    facts: ['对象是原导师房间实际在场的微弱徘徊亡魂，不凭空创造灵或证人。', '亡者之语直接针对灵体，但本次仍须意志14，可能抵抗或失败。', '成功只记录当前躁动短暂降低，不杀灭、复活、强令永久服从或永久净化。', '原普通隔栏、现场记录与原导师协助提供另一种实际处理方式，不能冒称能力成功。'],
    ability: '准备只对原纪念牌旁当前轻度躁动的原亡魂施加有限亡者之语；实施3灵性、意志14，只求短暂降低当前躁动。',
    ordinary: '准备以现场原普通隔栏保持距离、记录现象并请原导师实际协助；实施知识10、0灵性，不以普通隔栏宣称封印灵体。',
    abilityResult: '你的亡者之语直接针对这缕原亡魂，当前躁动实际短暂降低，只有这一有限观察成立；它没有被杀灭、复活、永久净化或永久控制。',
    ordinaryResult: '你实际使用原普通隔栏保持距离并记录当时现象，原导师在场协助结束这次查看。没有施加亡者之语，也没有宣称隔栏能封印亡魂或永久消除躁动。',
    abilityOutcome: 'ECHO_QUIETED', ordinaryOutcome: 'BARRIER_RECORDED',
    close: '你实际停止本次亡者之语或普通查看，离开原亡魂的局部接触范围；原隔栏和原纪念牌留在原处。短时作用不继续维持，不把有限观察改成永久净化，已有结果和记录保留。',
  },
] as const;

export const SPIRIT_GUIDE_ENVIRONMENT = '三个有限原现场事项及全部数值均为原创G：观察1行动，准备1行动，实施1行动；招募与递送各3灵性、知识14，亡者之语3灵性、意志14；普通方法知识10、不耗灵性。招募成功还需从本人现金实付12便士，只建立灰羽的一次相邻房间递送约定；没有免费随从。每次实施均打开本次接触，无论成败都须0行动明确停止本次局部联系并离开；结束不返费、不擦除已接受约定、原信位置、答复或历史。失败照耗，下周重试。每案报告25扮演与单项掌握8，三案反思25，可全程普通方法和平100。原信成功交付后留在原收件人处，灰羽完成一次往返后休息，不自动无限递送或参与战斗。 ' + SPIRIT_GUIDE_ENCOUNTER_STORY;
export const spiritGuideInside = (s: SliceState) => Object.values(s.spiritGuide.cases).some(r => r.contactOpen);
export const isSpiritGuideActivity = (c: SpiritGuideCommand): c is SpiritGuideActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is SpiritGuideActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!SPIRIT_GUIDE_CASE_IDS.includes(c.caseId as typeof SPIRIT_GUIDE_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: SpiritGuideActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockSpiritGuideEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'death' || s.progression.sequence !== 6) return '先完成死灵导师晋升。';
  const p = 'caseId' in c ? CASES.find(p => p.id === c.caseId) : null;
  const r = p ? s.spiritGuide.cases[p.id] : null;
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen) return '没有尚未结束的本次接触。';
    return s.activeEvent || s.combat || s.world.city !== 'BACKLUND' ? '本次原现场位置不符，不能以结束接触瞬移。' : null;
  }
  if (spiritGuideInside(s)) return '先0行动实际停止本次局部联系并离开；既有约定、原信与结果保留。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原纪念工作室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.spiritGuide.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.spiritGuide.reflected ? '已经回看这段经历。' : CASES.some(p => s.spiritGuide.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!p || !r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (p.id === 'short-delivery' && s.spiritGuide.cases['messenger-terms']?.status !== 'RESOLVED') return '先完成并报告原房间与有限递信条款的核对；普通核对也可以。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场观察已经保留。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先实际观察本项原现场。';
    if (r.attemptWeek === s.week) return '本周实施结果保留，下一真实周再依原观察准备。';
    if (p.id === 'short-delivery' && c.method === 'ABILITY' && !s.spiritGuide.messenger.recruited) return '尚未自行招募灰羽；可选择本人普通递送原信。';
    return null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触离开。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.method === 'ABILITY' && s.spirituality < 3) return '本次能力实施需要3灵性，可取消准备后选择普通方法。';
  if (p.id === 'messenger-terms' && r.method === 'ABILITY' && s.cash < SPIRIT_GUIDE_MESSENGER_FEE) return '成功招募需由你本人实付12便士；先备齐费用，或取消后选择普通核对。';
  if (p.id === 'short-delivery') {
    if (s.spiritGuide.messenger.letter !== 'DESK' || s.spiritGuide.messenger.deliveries !== 0) return '唯一原信已经交付，不能复制或重复递送。';
    if (r.method === 'ABILITY' && !s.spiritGuide.messenger.recruited) return '尚未自行招募灰羽，不能把导师记录当成你的信使。';
  }
  return null;
}
export function applySpiritGuideActivity(s: SliceState, c: SpiritGuideActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('死灵导师实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applySpiritGuideEncounter(s, c, ctx); return; }
  const m = s.spiritGuide;
  if (c.type === 'CLOSE') {
    const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次局部联系并离开', '0行动。' + p.close + '本次成功或失败与已付行动、灵性均保留，不返资源、不治疗、不增加掌握或扮演。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察与已付行动保留；没有实际招募、递信或施加亡者之语，既有约定与原信位置不变。可以重新选择普通方法。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('spirit-guide-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('约定有边界，回答有来源', '回看灰羽有限条款、原封信真实往返与当前躁动。G扮演+25；普通方法同样可以完成三项实践。已知片段不等于全部真相，自愿递送不等于无限支配，短暂安静不等于永久净化。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '实际观察后离开，尚未邀请、递送或施加亡者之语，没有待结束接触。'); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`spirit-guide-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次后续已实际结束局部联系并离开，报告G扮演+25、原规则单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') s.spirituality -= 3;
  const result = ctx.check(r.method === 'ABILITY' && p.id === 'restless-echo' ? 'will' : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    if (p.id === 'messenger-terms' && r.method === 'ABILITY') { s.cash -= SPIRIT_GUIDE_MESSENGER_FEE; m.messenger.recruited = true; m.messenger.feePaid = SPIRIT_GUIDE_MESSENGER_FEE; }
    if (p.id === 'short-delivery') { m.messenger.letter = 'RECIPIENT'; m.messenger.replyReceived = true; m.messenger.deliveries = 1; }
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次接触尚须0行动实际停止局部交谈或作用并离开，之后才能报告。'); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, `本次实施未取得可报告结果，原观察保留。1行动${r.method === 'ABILITY' ? '与3灵性' : ''}已经实际消耗，不增加掌握或扮演；${p.id === 'messenger-terms' ? '没有成功招募，未收取12便士。' : p.id === 'short-delivery' ? '尚未送出，唯一原封信仍在DESK，没有答复或成功递送。既有约定保留。' : '没有确认原亡魂当前躁动降低，也不宣称净化。'}先0行动结束本次局部联系并离开，下一真实周再准备。`);
}
export function spiritGuideActions(s: SliceState): SpiritGuideAction[] {
  if (s.progression.pathwayId !== 'death' || s.progression.sequence !== 6) return [];
  const out: SpiritGuideAction[] = [];
  const add = (id: string, label: string, cost: string, command: SpiritGuideActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.spiritGuide.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际结束本次局部联系并离开', '0行动 · 保留原信、有限约定与已有结果', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '实际观察本项原现场', '1行动 · 核实对象与原物来源', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'messenger-terms' ? '准备亲自邀请灰羽与一次约定' : p.id === 'short-delivery' ? '准备请已招募灰羽递送原信' : '准备对原亡魂施加有限亡者之语', p.id === 'messenger-terms' ? '1行动 · 实施另3灵性，成功另付12便士' : '1行动 · 实施另3灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'short-delivery' ? '准备本人普通递送原信' : '准备原现场普通方法', '1行动 · 实施不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', r.method === 'ABILITY' ? '实际实施本项有限能力' : '实际使用原现场普通方法', r.method === 'ABILITY' ? `1行动 · 3灵性 · ${p.id === 'restless-echo' ? '意志' : '知识'}14 · 失败照耗${p.id === 'messenger-terms' ? ' · 成功实付12便士' : ''}` : '1行动 · 知识10 · 0灵性', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 已付成本不退', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告本项有限结果与实际离开', '1行动 · 结束本次接触后', { type: 'REPORT', caseId: p.id });
  }
  if (!s.spiritGuide.reflected) add('spirit-guide-reflect', '回看有限约定、原信与灵体边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.spiritGuide.encounter.status === 'AVAILABLE') {
    add('spirit-guide-encounter-talk', '前往原纪念工作室外空院并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('spirit-guide-encounter-fight', '前往原纪念工作室外空院并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function spiritGuideCases(s: SliceState): SpiritGuideProjection['cases'] {
  if (s.progression.pathwayId !== 'death' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2)) return [];
  return CASES.map(p => {
    const r = s.spiritGuide.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status)
      ? (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + (r.contactOpen ? ' 尚须明确结束本次局部联系并离开。' : ' 随后' + p.close)
      : r.attemptWeek !== null ? '此前实施未成，已付成本与原观察保留。' + (p.id === 'short-delivery' ? '原信仍在DESK，未收答复，没有成功递送。' : '') : r.withdrawals ? '尚未实施的准备已取消，原观察保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次局部联系仍须明确结束并离开' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
/** Only the original agreement, actual one-letter delivery and bounded successful case outcomes are persisted. */
export function validateSpiritGuideLife(s: SliceState): boolean {
  const m = s.spiritGuide;
  if (!record(m) || !record(m.cases) || !shape(m.cases, SPIRIT_GUIDE_CASE_IDS) || !record(m.messenger) || !shape(m.messenger, ['recruited', 'deliveries', 'letter', 'replyReceived', 'feePaid']) || !Array.isArray(s.seer.completedSources) || !s.seer.completedSources.every(x => typeof x === 'string') || typeof m.reflected !== 'boolean') return false;
  const messenger = m.messenger;
  if (typeof messenger.recruited !== 'boolean' || typeof messenger.replyReceived !== 'boolean' || !['DESK', 'RECIPIENT'].includes(messenger.letter) || !integer(messenger.deliveries, 0, 1) || !integer(messenger.feePaid, 0, SPIRIT_GUIDE_MESSENGER_FEE)) return false;
  const isPromoted = s.progression.pathwayId === 'death' && (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `spirit-guide-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
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
    if (p.id === 'messenger-terms') {
      if (messenger.recruited !== (successful && r.method === 'ABILITY') || messenger.feePaid !== (messenger.recruited ? SPIRIT_GUIDE_MESSENGER_FEE : 0)) return false;
    }
    if (p.id === 'short-delivery') {
      if (r.status !== 'AVAILABLE' && m.cases['messenger-terms']?.status !== 'RESOLVED') return false;
      if (r.method === 'ABILITY' && !messenger.recruited) return false;
      if (messenger.deliveries !== (successful ? 1 : 0) || messenger.replyReceived !== successful || messenger.letter !== (successful ? 'RECIPIENT' : 'DESK')) return false;
    }
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.some(x => x.startsWith('spirit-guide-case:') && !SPIRIT_GUIDE_CASE_IDS.some(id => x === `spirit-guide-case:${id}`))) return false;
  if (s.seer.completedSources.filter(x => x === 'spirit-guide-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!isPromoted && (m.reflected || messenger.recruited || messenger.deliveries !== 0 || messenger.letter !== 'DESK' || messenger.replyReceived || messenger.feePaid !== 0)) return false;
  if (isPromoted && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.gatekeeper.spiritGuideActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
