import { CALAMITY_DEMONESS_ABILITY_IDS } from '../calamity-demoness/types.js';
import {UNAGING_DEMONESS_ABILITY_IDS} from '../unaging-demoness/types.js';
import {DESPAIR_ABILITY_IDS} from '../despair/types.js';
import {PAIN_ABILITY_IDS} from '../pain/types.js';
import {PLEASURE_ABILITY_IDS} from '../pleasure/types.js';
import {WITCH_ABILITY_IDS} from '../witch/types.js';
import {INSTIGATOR_ABILITY_IDS} from '../instigator/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  ASSASSIN_ABILITIES, ASSASSIN_BOTTLE_IDS, ASSASSIN_CONSUMPTION_RISK, ASSASSIN_FORMULA_STATUS,
  ASSASSIN_GUIDE, ASSASSIN_ORIGINAL_DRAFT, ASSASSIN_POTION_SOURCES, ASSASSIN_PRICES, ASSASSIN_SOURCE_STATUS,
} from './content.js';
import {
  ASSASSIN_ABILITY_IDS, ASSASSIN_CASE_IDS, type AssassinAcquisitionCommand, type AssassinAction,
  type AssassinBottle, type AssassinCommand, type AssassinProjection, type AssassinState,
} from './types.js';

export function createAssassinState(): AssassinState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: ASSASSIN_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(ASSASSIN_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', position: 'START',
    }])),
    draft: { ...ASSASSIN_ORIGINAL_DRAFT },
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const potionPrice = (bottle: AssassinBottle) => ASSASSIN_PRICES.potion - (bottle.labourSteps === 2 ? ASSASSIN_PRICES.labourCredit : 0);
const bottleNumber = (bottle: AssassinBottle) => Number(bottle.id.slice('assassin-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (assassin: AssassinState) => assassin.bottles.length > 0 && assassin.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ASSASSIN_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的刺客成品魔药，原瓶assassin-potion-${number}。练习场供给为本作原创，完整配方尚未核实，未声称在练习场配制；取得此瓶不建立任何家族或组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isAssassinAcquisitionCommand(command: AssassinCommand): command is AssassinAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateAssassinCommand(value: unknown): value is AssassinCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^assassin-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^assassin-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && ASSASSIN_CASE_IDS.includes(value.caseId as typeof ASSASSIN_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && ASSASSIN_CASE_IDS.includes(value.caseId as typeof ASSASSIN_CASE_IDS[number]) && ['SKILL', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'RETURN') return shape(value, ['type', 'caseId', 'route']) && ASSASSIN_CASE_IDS.includes(value.caseId as typeof ASSASSIN_CASE_IDS[number]) && ['LIGHTNESS', 'STAIRS'].includes(value.route as string);
  return false;
}

function commandBlock(s: SliceState, command: AssassinAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到练习场导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服刺客魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.assassin.discovered ? '已经认识这位练习场导师。' : null;
  if (!s.assassin.discovered) return '先拜访练习场导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.assassin.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < ASSASSIN_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.assassin.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.assassin.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.assassin) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.assassin.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.assassin.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.assassin) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.assassin.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选刺客原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次练习场劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; life owns body position and the original draft. */
export function applyAssassinCommand(s: SliceState, command: AssassinAcquisitionCommand, c: SeerContext): void {
  rule(validateAssassinCommand(command) && isAssassinAcquisitionCommand(command), '刺客准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.assassin.discovered = true;
      c.note('认识独立练习场导师', `你在贝克兰德拜访了${ASSASSIN_GUIDE}，消耗1行动。这位成年独立导师在练习场接待你，保管三瓶独立封存的刺客成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。导师与成品药渠道为本作原创G，不代表已知配方或可以在练习场制造魔药。${ASSASSIN_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ASSASSIN_PRICES.guidance;
      s.assassin.guidanceKnown = true;
      c.note('听取刺客用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${ASSASSIN_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。${ASSASSIN_SOURCE_STATUS}本阶段分别记录轻身、视觉、藏影与集中爆发的掌握度。先观察真实标记、上层托盘、阴影与软垫，再选择有限能力或普通方法；和平完成四段实践并如实反思同样能积累扮演。诺艾拉的原稿只有实际取到后才由你保管，登上上层必须实际返回，普通楼梯始终保留为退路。轻身不是飞行，藏影不是绝对隐形，爆发不是必杀，也不改变性别或身体形态。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.assassin.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成灯具与软垫点验' : '完成楼梯与练习区清理', bottle.labourSteps === 1
        ? `你在导师监督下逐件检查灯具编号、灯罩与软垫接缝，记录磨损和缺件，完成一次实际练习场劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由练习场保管。完成第二次楼梯与练习区清理后可抵该瓶600便士。点验不赋予非凡能力，也不移动上层托盘中的原稿。`
        : `你在诺艾拉指导下清理楼梯踏面与练习区通道，并将点验清单归还原柜，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.assassin.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('刺客原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次练习场劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${ASSASSIN_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.assassin.resupply.requestedWeek = s.week;
      c.note('申请下一批刺客魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${ASSASSIN_GUIDE}提出下一批三瓶的补给请求，并清点练习场收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.assassin.resupply.deliveries += 1;
      const firstNumber = s.assassin.resupply.deliveries * ASSASSIN_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < ASSASSIN_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.assassin.bottles.push({ id: `assassin-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.assassin.resupply.requestedWeek = null;
      c.note('下一批刺客原瓶到货', `第${s.week}周，本作G供给第${s.assassin.resupply.deliveries + 1}批三瓶实际送到练习场，原瓶assassin-potion-${firstNumber}至assassin-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.assassin.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'demoness';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(ASSASSIN_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 2], ['will', 1], ['knowledge', 0]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为刺客', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+2、意志+1、知识不增加。轻身、视觉、藏影与集中爆发四项能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。你可以和平核对标记、取回原稿、测试阴影遮蔽并完成受控软垫练习，也能选择普通方法。上层原稿仍属诺艾拉，只有实际取到并交还才改变保管状态；移动也必须实际返回。轻身不是飞行，藏影不是绝对隐形，爆发不是必杀，不提前开放女巫黑焰或身体转变，也不自动加入任何组织。${ASSASSIN_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了刺客晋升' : '刺客魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Life projection adds observed scenes, the actual body position and draft custody. */
export function projectAssassin(s: SliceState): AssassinProjection {
  const actions: AssassinAction[] = [], isPromoted = promoted(s), known = s.assassin.discovered;
  const add = (id: string, label: string, cost: string, command: AssassinAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-assassin', `拜访${ASSASSIN_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.assassin.guidanceKnown) add('learn-assassin-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.assassin.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '灯具与软垫点验' : '楼梯与练习区清理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶刺客魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.assassin.resupply.requestedWeek !== null) add('receive-assassin-supply', '确认下一批三瓶到货', `0行动 · 第${s.assassin.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.assassin)) add('request-assassin-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.assassin.guidanceKnown) {
    for (const bottle of s.assassin.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶刺客魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.assassin.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.assassin.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '刺客 · 序列9' : '刺客之路', discovered: known, guidanceKnown: s.assassin.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${ASSASSIN_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.assassin.resupply.requestedWeek === null ? `已实际接收后续供给${s.assassin.resupply.deliveries}批。` : `第${s.assassin.resupply.requestedWeek}周提出补给请求，第${s.assassin.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: ASSASSIN_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.assassin.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 刺客成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? ASSASSIN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?(s.instigator.assassinActingAtPromotion??100):s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : (s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))||s.progression.acting >= 100) ? '刺客魔药已消化；轻身、视觉、藏影与集中爆发仍按各自实际练习分别记录掌握度。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察标记、高差、阴影和软垫，再选择有限能力或普通方法；实际完成后如实报告，上层取稿后须实际返回并交还原稿。四段和平报告各积累20扮演，最后反思积累20，不要求伤害他人。'
          : `已留下刺客扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${ASSASSIN_CONSUMPTION_RISK}`
      : '拜访练习场导师，了解刺客成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [],
    insideCase: false,
    draft: null,
    environment: '',
  };
}

/** Acquisition validates provenance and shapes; life owns causal activity transitions. */
export function validateAssassinState(s: SliceState): boolean {
  const raw: unknown = s.assassin;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected', 'draft'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ASSASSIN_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, ASSASSIN_CASE_IDS)) return false;
  for (const [caseId, caseState] of Object.entries(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'position'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0)) return false;
    if (caseState.method !== null && !['SKILL', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (!['NONE', 'SIGN_CHECKED', 'DRAFT_RETRIEVED', 'SHADOW_TESTED', 'BURST_STOPPED'].includes(caseState.outcome as string)) return false;
    if (!['START', 'UPPER'].includes(caseState.position as string) || caseState.position === 'UPPER' && (caseId !== 'upper-draft' || caseState.status !== 'EXAMINED' || caseState.outcome !== 'DRAFT_RETRIEVED')) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const draft = raw.draft;
  if (!record(draft) || !shape(draft, ['id', 'owner', 'custodian', 'location', 'version'])
    || draft.id !== ASSASSIN_ORIGINAL_DRAFT.id || draft.owner !== ASSASSIN_ORIGINAL_DRAFT.owner
    || !['NOAELA', 'PLAYER'].includes(draft.custodian as string)
    || !['upper-tray', 'player:hand', 'author-desk'].includes(draft.location as string) || !integer(draft.version, 1)) return false;
  if (draft.custodian === 'NOAELA' && !['upper-tray', 'author-desk'].includes(draft.location as string) || draft.custodian === 'PLAYER' && draft.location !== 'player:hand') return false;
  const assassin = raw as unknown as AssassinState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'demoness' && !isPromoted) return false;
  if (isPromoted) {
    if (!assassin.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery,[...ASSASSIN_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?INSTIGATOR_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?WITCH_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?PLEASURE_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?PAIN_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DESPAIR_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?UNAGING_DEMONESS_ABILITY_IDS:[]),...(s.progression.sequence===2?CALAMITY_DEMONESS_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (ASSASSIN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || assassin.reflected
    || draft.custodian !== 'NOAELA' || draft.location !== 'upper-tray' || draft.version !== 1
    || Object.values(assassin.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.outcome !== 'NONE' || caseState.position !== 'START')) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of assassin.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `assassin-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < ASSASSIN_BOTTLE_IDS.length) {
      if (bottle.source !== ASSASSIN_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!assassin.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ASSASSIN_BOTTLE_IDS.length) - 1;
      if (index % ASSASSIN_BOTTLE_IDS.length === 0) {
        const previous = assassin.bottles.slice(index - ASSASSIN_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!assassin.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week)) return false;
    if (s.progression.promotionWeek !== null && bottle.acquiredWeek! > s.progression.promotionWeek) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(5, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (s.progression.promotionWeek !== null && bottle.consumedWeek! > s.progression.promotionWeek) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== s.progression.promotionWeek) return false;
    }
  }
  if (assassin.resupply.requestedWeek !== null && (!assassin.guidanceKnown || !supplyExhausted(assassin) || assassin.bottles.some(bottle => bottle.consumedWeek! > assassin.resupply.requestedWeek!) || s.progression.promotionWeek !== null && assassin.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { ASSASSIN_ABILITIES } from './content.js';
export { ASSASSIN_CASE_IDS } from './types.js';
export type { AssassinActivityCommand, AssassinAction, AssassinProjection } from './types.js';
