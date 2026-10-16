import type { PublicCoreStatKey } from '../../shared/contracts.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { MAGICIAN_OIL_STOCK } from './content.js';
import type { MagicianAction, MagicianActivityCommand, MagicianCommand, MagicianProjection } from './types.js';

type Award = (source: string, amount: 5 | 8 | 25) => void;
interface Practice {
  id: string; title: string; story: string; result: string;
  stat: PublicCoreStatKey; spirituality: number; paper: boolean; lamp: boolean;
}

/** These finite scenes, costs and checks are original game situations/balance (G). */
const PRACTICES: readonly Practice[] = [
  {
    id: 'lamplit-step', title: '两盏原灯之间的一步',
    story: '指导者借出空排练区：场方原有常燃灯与实际灌油点燃的随身油灯相距2米，地面无遮挡。先牵动随身灯的真实火焰，再借另一盏原灯短距离跳跃，最后由你与指导者熄灭随身灯。没有凭空火源，也不穿墙。',
    result: '你先完成火焰操纵，再借2米内的另一盏真实灯火调位，两次法术分别消耗2与3灵性。仍在同一公开排练区，未制造新火焰流。',
    stat: 'perception', spirituality: 5, paper: false, lamp: true,
  },
  {
    id: 'air-target', title: '空场里的固定靶',
    story: '指导者在无人穿行的封闭练习方向固定一块厚软木靶，靶后有原木挡板。你从标线向固定靶施展空气弹，场内没有作为练习目标的人或动物。',
    result: '空气弹打在眼前原固定靶上，指导者核对这一次落点；没有自动命中远处敌人，也没有获得枪支或弹药。',
    stat: 'perception', spirituality: 2, paper: false, lamp: false,
  },
  {
    id: 'consenting-audience', title: '观众知道这是幻象',
    story: '几位成年剧场工作人员事先同意观看感官幻术。你在原空桌上呈现彩色花影、短促铃声与花香，结束后请他们分别说出见到、听到和闻到的内容。',
    result: '观众分别辨认了颜色、声音与气味，演示结束后仍知道原桌是空的。没有真实花束、心智控制或记忆改写。',
    stat: 'will', spirituality: 2, paper: false, lamp: false,
  },
  {
    id: 'shallow-water', title: '水面下的一次呼吸',
    story: '场方开放岸边有台阶的浅水练习池，指导者在岸上照看。你只到水面下1米处，维持一条真实通向眼前水面的空气管道，随后沿原台阶上岸；不进入超过5米的深处。',
    result: '你借通往水面的空气管道完成短暂水下呼吸，再沿原台阶上岸；没有无限深潜、隔绝空气或跨水域移动。',
    stat: 'will', spirituality: 2, paper: false, lamp: false,
  },
  {
    id: 'loose-rope', title: '随时能解开的绳圈',
    story: '一位成年道具师征得你的同意后，用原道具绳在手腕外留出松绳圈，并站在伸手可及处随时解开。没有锁、勒颈或强制捆绑；你练习骨骼软化退出原绳圈，失败就由本人解开。',
    result: '你通过骨骼软化退出眼前的松绳圈，道具师收回自己的原绳；没有隔空开锁或穿过实体障碍。',
    stat: 'physique', spirituality: 2, paper: false, lamp: false,
  },
  {
    id: 'paper-weapon', title: '原纸只能用这一次',
    story: '在同一无人靶区，将实际持有的一张原纸暂时化为纸张武器，向固定软木靶完成一次动作。用后的纸收进场方废纸盒，不成为永久装备，也不回到库存。',
    result: '你用这一张真实原纸完成暂时武器的动作，原纸已经消耗；没有复制纸料或永久增加装备。',
    stat: 'physique', spirituality: 1, paper: true, lamp: false,
  },
];

export const MAGICIAN_DISPUTE_STORY = '成年道具搬运工莉亚正抱着剧院原道具箱经过公开侧巷，普通工人莫里持短棍拦住原通路，要求一笔拿不出凭据的搬运费。箱子始终由莉亚持有并归剧院；你可以当面请他核对原通行记录，也可以承担真实伤亡风险介入。撤退不会把莉亚或道具箱自动带走。';
const ACTIVITY_TYPES = ['BUY_OIL', 'PREPARE_LANTERN', 'PREPARE_FIGURINE', 'PRACTICE', 'TRANSFER_INJURY', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT'];
const promoted = (s: SliceState) => s.progression.pathwayId === 'diviner' && (s.progression.sequence === 7 || (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const won = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const sourceFor = (id: string) => `magician-practice:${id}`;
const hasSource = (s: SliceState, id: string) => s.seer.completedSources.includes(id);
const actionCost = (c: MagicianActivityCommand) => c.type === 'BUY_OIL' || c.type === 'PREPARE_LANTERN' ? 0 : 1;

export const isMagicianActivity = (c: MagicianCommand): c is MagicianActivityCommand => ACTIVITY_TYPES.includes(c.type);

function blocked(s: SliceState, c: MagicianActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已经结束。';
  if (!promoted(s)) return '先成为魔术师。';
  if ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && !['BUY_OIL', 'PREPARE_LANTERN', 'PREPARE_FIGURINE', 'TRANSFER_INJURY'].includes(c.type)) return '旧魔术师实践与争议记录已保留；原灯油、纸人与自身伤害转移仍可按原成本使用，请继续诡法师实践。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要本人返回贝克兰德的原场地。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < actionCost(c)) return '这项行动需要1行动。';
  const m = s.magician;
  switch (c.type) {
    case 'BUY_OIL': return m.lantern.oilStock < 1 && (m.lantern.lastSupplyWeek === null || s.week <= m.lantern.lastSupplyWeek)
      ? '原供应方本批六份灯油已经售完，最早下一个真实周补入下一批。' : s.cash < 12 ? '一份原灯油需要12便士。' : null;
    case 'PREPARE_LANTERN': return m.lantern.prepared ? '这盏实际随身油灯已经点燃。' : m.lantern.oilHeld < 1 ? '先取得一份实际持有的灯油。' : null;
    case 'PREPARE_FIGURINE': return s.clown.paperSheets < 1 ? '剪制纸人需要一张实际持有的原纸。' : null;
    case 'TRANSFER_INJURY': {
      const injury = s.injuries.find(x => x.id === c.injuryId);
      if (!injury || injury.severity !== 'HEAVY') return '只能处理本人实际存在的一处重伤。';
      if (m.damageTransfers.includes(injury.id)) return '这一处原伤势已经在本人身体内转移过一次。';
      return s.spirituality < 3 ? '伤害转移需要3灵性。' : null;
    }
    case 'PRACTICE': {
      const p = PRACTICES.find(x => x.id === c.practiceId);
      if (!p) return '未知的魔术师实践。';
      if (m.practices.includes(p.id)) return '这段实践已经完成，不重复成长。';
      if (m.practiceAttempts[p.id] === s.week) return '本周已经尝试过这段实践，下周再来。';
      if (s.spirituality < p.spirituality) return `这段实践需要${p.spirituality}灵性。`;
      if (p.paper && s.clown.paperSheets < 1) return '需要一张实际持有的原纸。';
      if (p.lamp && (!m.lantern.prepared || m.lantern.oilSpent < 1)) return '先用实际灯油点燃随身油灯，才有本次练习的真实火源。';
      return null;
    }
    case 'REFLECT': return m.reflected ? '已经整理过这段魔术师经历。'
      : PRACTICES.some(x => !m.practices.includes(x.id)) || m.encounter.status !== 'RESOLVED' ? '先完成六段不同实践并解决原侧巷争议。' : null;
    case 'ENCOUNTER_TALK':
    case 'ENCOUNTER_FIGHT':
      if (m.practices.length === 0) return '先完成至少一段魔术师实践，确认当前能力边界。';
      if (m.encounter.status !== 'AVAILABLE') return '这次侧巷争议已经有了结果，不能重开刷取。';
      return c.type === 'ENCOUNTER_TALK' && m.encounter.attemptWeek === s.week ? '本周交涉已经尝试过。可下周再谈，或另花一次行动承担战斗风险。' : null;
  }
}

export function applyMagicianPractice(s: SliceState, c: MagicianActivityCommand, ctx: SeerContext, award: Award): void {
  if (!isMagicianActivity(c)) throw new Error('未知的魔术师实践命令。');
  const reason = blocked(s, c);
  if (reason) throw new Error(reason);
  s.actionsRemaining -= actionCost(c);
  const m = s.magician;
  switch (c.type) {
    case 'BUY_OIL':
      if (m.lantern.oilStock === 0) { m.lantern.oilStock = MAGICIAN_OIL_STOCK; m.lantern.deliveries++; }
      s.cash -= 12; m.lantern.oilStock--; m.lantern.oilHeld++;
      m.lantern.lastSupplyWeek = s.week;
      ctx.note('取得一份原灯油', '支付12便士、0行动，原供应方当前六份灯油批次中的一份实际交到手中。本批售完后，最早下一个真实周才补入下一批，仍按原价逐份交付。尚未点灯，也不会自动生成火源。');
      return;
    case 'PREPARE_LANTERN':
      m.lantern.oilHeld--; m.lantern.oilSpent++; m.lantern.prepared = true;
      ctx.note('点燃实际随身油灯', '0行动，将一份原灯油灌入原随身油灯并点燃。原灯油已经消耗，当前有可携带的真实灯火；一次灯火实践、战斗结束或转去普通活动时熄灭，不跨周永燃。');
      return;
    case 'PREPARE_FIGURINE':
      s.clown.paperSheets--; s.clown.paperSpent++; m.figurinesMade++; m.figurinesHeld++;
      ctx.note('实际剪好一个纸人', '消耗1行动和1张原纸，得到1个预制纸人。尚未施展替身，不自动增加扮演或掌握；只有真实物理后果尚未提交时才可消耗纸人与灵性替代。');
      return;
    case 'TRANSFER_INJURY': {
      const injury = s.injuries.find(x => x.id === c.injuryId)!;
      s.spirituality -= 3; injury.severity = 'LIGHT'; m.damageTransfers.push(injury.id);
      if (!hasSource(s, 'magician-damage-transfer')) award('magician-damage-transfer', 8);
      ctx.note('同一人身体内的伤害转移', `消耗1行动、3灵性，将自身原伤势${injury.id}在自己体内转移一次，重伤降为轻伤（G）。原伤势编号、医疗记录、健康和累计伤势风险保留，不转给他人；这一阶段只首次实际使用给予一次掌握成长，不增加扮演。`);
      return;
    }
    case 'PRACTICE': {
      const p = PRACTICES.find(x => x.id === c.practiceId)!;
      s.spirituality -= p.spirituality; m.practiceAttempts[p.id] = s.week;
      if (p.paper) { s.clown.paperSheets--; s.clown.paperSpent++; }
      if (p.lamp) m.lantern.prepared = false;
      const result = ctx.check(p.stat, 14), success = won(result.tier);
      if (success) {
        m.practices.push(p.id); s.progression.acting = Math.min(100, s.progression.acting + 12);
        award(sourceFor(p.id), 8);
      }
      ctx.note(p.title, `${p.story} ${success ? `${p.result} 扮演+12，已知能力中一项掌握+8。` : '这一次未能稳定完成。指导者停止练习，沿原通路收场；没有新增伤势或成长，下周才能重试。'} 本次行动与${p.spirituality}灵性已经消耗${p.paper ? '，用过的原纸不退回' : ''}${p.lamp ? '，随身油灯已经熄灭，原灯油不退回' : ''}。`);
      return;
    }
    case 'REFLECT':
      m.reflected = true; s.seer.completedSources.push('magician-reflection');
      s.progression.acting = Math.min(100, s.progression.acting + 8);
      ctx.note('准备与惊奇都有边界', '你对照六段亲自完成的实践与侧巷争议：奇妙效果仍依赖真实火焰、纸料、空气、原通路和当事人的反应。整理一次，扮演+8；不制造伤势，不抹去失败，不重复成长。');
      return;
    case 'ENCOUNTER_TALK': {
      m.encounter.attemptWeek = s.week;
      const result = ctx.check('will', 14);
      if (won(result.tier)) {
        m.encounter.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 20);
        award('magician-dispute', 8);
        ctx.note('原道具箱沿原路送达', `${MAGICIAN_DISPUTE_STORY} 你请莉亚出示当面持有的原通行记录，莫里核对后让开。莉亚自己抱着原箱走回剧院；扮演+20，单项掌握+8，没有战利品或心智控制。`);
      } else ctx.note('当面交涉暂未奏效', `${MAGICIAN_DISPUTE_STORY} 莫里没有让路，莉亚仍在现场抱着原箱。没有凭空移动人或物，也没有成长奖励；下周可再谈。`);
      m.lantern.prepared = false;
      return;
    }
    case 'ENCOUNTER_FIGHT':
      m.encounter.attemptWeek = s.week; m.encounter.status = 'FIGHTING';
      m.encounter.startHistoryIndex = s.combatHistory.length;
      s.combat = { encounterId: 'MAGICIAN_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
        enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
      ctx.note('侧巷搬运争议', `${MAGICIAN_DISPUTE_STORY} 你花费1行动实际介入，莫里举起手中的原短棍。${m.lantern.prepared ? '你已将事先点燃的实际油灯带到同场2米内的地面，可供有限火焰法术使用。' : '你没有携带点燃的油灯，当前不能凭空发动火焰法术。'}纸人只使用实际预制库存；不自动保护莉亚或原箱。`);
      return;
  }
}

export function magicianActions(s: SliceState): MagicianAction[] {
  if (!promoted(s)) return [];
  const actions: MagicianAction[] = [];
  const add = (id: string, label: string, cost: string, command: MagicianActivityCommand) => {
    if ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && !['BUY_OIL', 'PREPARE_LANTERN', 'PREPARE_FIGURINE', 'TRANSFER_INJURY'].includes(command.type)) return;
    const reason = blocked(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  add('magician-buy-oil', '取得一份原灯油', `0行动 · 12便士 · 供应方剩${s.magician.lantern.oilStock}份`, { type: 'BUY_OIL' });
  add('magician-prepare-lantern', '用原灯油点燃随身油灯', '0行动 · 原灯油1份 · 实践或战斗收场后熄灭', { type: 'PREPARE_LANTERN' });
  add('magician-prepare-figurine', '用一张原纸剪制纸人', '1行动 · 原纸1张 · 预制库存+1 · 无成长奖励', { type: 'PREPARE_FIGURINE' });
  for (const p of PRACTICES) if (!s.magician.practices.includes(p.id)) {
    const stat = p.stat === 'will' ? '意志' : p.stat === 'physique' ? '体质' : '感知';
    add(`magician-practice-${p.id}`, p.title, `1行动 · ${p.spirituality}灵性${p.paper ? ' · 原纸1张' : ''}${p.lamp ? ' · 当前真实灯火' : ''} · ${stat}难度14 · 成功扮演+12（G）`, { type: 'PRACTICE', practiceId: p.id });
  }
  for (const injury of s.injuries) if (injury.severity === 'HEAVY' && !s.magician.damageTransfers.includes(injury.id)) {
    add(`magician-transfer-${injury.id}`, `转移自身原重伤：${injury.id}`, '1行动 · 3灵性 · 同一伤势一次 · 不恢复健康', { type: 'TRANSFER_INJURY', injuryId: injury.id });
  }
  if (s.magician.encounter.status === 'AVAILABLE') {
    add('magician-dispute-talk', '陪搬运工当面核对原通行记录', '1行动 · 意志难度14 · 原道具箱仍归剧院', { type: 'ENCOUNTER_TALK' });
    add('magician-dispute-fight', '介入侧巷搬运争议', '1行动 · 真实战斗，可能受伤或死亡 · 无自动战利品', { type: 'ENCOUNTER_FIGHT' });
  }
  if (!s.magician.reflected) add('magician-reflect', '整理六次实践与争议结果', '1行动 · 六实践与争议完成后 · 扮演+8仅一次', { type: 'REFLECT' });
  return actions;
}

export function magicianPractices(s: SliceState): MagicianProjection['practices'] {
  if (!promoted(s)) return [];
  return [
    ...PRACTICES.map(p => ({ id: p.id, title: p.title, story: p.story,
      status: s.magician.practices.includes(p.id) ? '已实际完成' : s.magician.practiceAttempts[p.id] === s.week ? '本周未成，下周可重试' : '尚未完成' })),
    { id: 'magician-dispute', title: '侧巷里的原道具箱', story: MAGICIAN_DISPUTE_STORY,
      status: ({ AVAILABLE: '可交涉或承担战斗风险', FIGHTING: '实际战斗中', RESOLVED: '抵抗结束，原箱由本人带走', RETREATED: '你已退离，人和原箱未随你转移', LOST: '已死亡，原争议未解决' } as const)[s.magician.encounter.status] },
  ];
}

export function settleMagicianEncounter(s: SliceState, outcome: string, ctx: SeerContext, award: Award): void {
  const e = s.magician.encounter, combat = s.combat;
  if (e.status !== 'FIGHTING' || combat?.encounterId !== 'MAGICIAN_DISPUTE' || e.startHistoryIndex === null) throw new Error('当前没有正在进行的魔术师侧巷战斗。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知侧巷战斗结果。');
  if (outcome === 'CONTINUE') return;
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  if (e.status === 'RESOLVED') {
    s.progression.acting = Math.min(100, s.progression.acting + 20);
    const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
    if (effective) award('magician-dispute', 25);
  }
  s.magician.lantern.prepared = false;
  ctx.note('侧巷争议结果', e.status === 'RESOLVED'
    ? '原通路上的抵抗已经结束，莉亚自己抱着剧院原道具箱走回原目的地。扮演+20，实际有效参战才给予一次掌握成长；没有物品自动归你。随身灯火已熄灭。'
    : e.status === 'RETREATED' ? '你已从原通路退离，莉亚与原道具箱的后续仍未解决，没有自动随你移动。本次不发成长，已耗纸料、灯油和实际伤势保留，随身灯火已熄灭。'
      : '你的死亡已经实际结算，原争议未记作完成，也没有成长或战利品。已耗原物和伤势事实保留，随身灯火已熄灭。');
  s.combat = null;
}

/** Cross-check finite completions and historical sources after basic state-shape validation. */
export function validateMagicianPractice(s: SliceState): boolean {
  const m = s.magician;
  if (!m || !Array.isArray(m.practices) || !m.practiceAttempts || typeof m.practiceAttempts !== 'object' || Array.isArray(m.practiceAttempts) || !m.encounter || !m.lantern || !Array.isArray(m.damageTransfers)) return false;
  if (new Set(m.practices).size !== m.practices.length || m.practices.some(id => !PRACTICES.some(p => p.id === id))) return false;
  const firstWeek = m.promotionWeek ?? 1;
  if (Object.entries(m.practiceAttempts).some(([id, week]) => !PRACTICES.some(p => p.id === id) || !Number.isSafeInteger(week) || week < firstWeek || week > s.week)) return false;
  for (const p of PRACTICES) {
    if (m.practices.includes(p.id) !== hasSource(s, sourceFor(p.id))) return false;
    if (m.practices.includes(p.id) && !Object.hasOwn(m.practiceAttempts, p.id)) return false;
  }
  if (Object.hasOwn(m.practiceAttempts, 'lamplit-step') && m.lantern.oilSpent < 1) return false;
  if (Object.hasOwn(m.practiceAttempts, 'paper-weapon') && s.clown.paperSpent <= m.figurinesMade) return false;
  if (![m.figurinesMade, m.figurinesHeld, m.figurinesUsed].every(v => Number.isSafeInteger(v) && v >= 0) || m.figurinesMade !== m.figurinesHeld + m.figurinesUsed || m.figurinesMade > s.clown.paperSpent) return false;
  if (![m.lantern.oilStock, m.lantern.oilHeld, m.lantern.oilSpent, m.lantern.deliveries].every(v => Number.isSafeInteger(v) && v >= 0) || m.lantern.oilStock > MAGICIAN_OIL_STOCK || m.lantern.oilStock + m.lantern.oilHeld + m.lantern.oilSpent !== MAGICIAN_OIL_STOCK * (m.lantern.deliveries + 1) || m.lantern.prepared && m.lantern.oilSpent < 1) return false;
  if (new Set(m.damageTransfers).size !== m.damageTransfers.length || m.damageTransfers.some(id => typeof id !== 'string' || !id || s.injuries.some(injury => injury.id === id && injury.severity !== 'LIGHT'))) return false;
  if (hasSource(s, 'magician-damage-transfer') && m.damageTransfers.length === 0) return false;
  if (m.reflected !== hasSource(s, 'magician-reflection') || m.reflected && (PRACTICES.some(p => !m.practices.includes(p.id)) || m.encounter.status !== 'RESOLVED')) return false;
  const e = m.encounter;
  if (!['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status)) return false;
  if (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < firstWeek || e.attemptWeek > s.week)) return false;
  if (e.startHistoryIndex !== null && (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex > s.combatHistory.length)) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'MAGICIAN_DISPUTE')) return false;
  if (e.status === 'AVAILABLE' && e.startHistoryIndex !== null || e.status !== 'AVAILABLE' && e.attemptWeek === null || e.attemptWeek !== null && m.practices.length === 0) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.status === 'RESOLVED' && e.startHistoryIndex === null && !hasSource(s, 'magician-dispute')) return false;
  if (hasSource(s, 'magician-dispute') && e.status !== 'RESOLVED') return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  return true;
}
