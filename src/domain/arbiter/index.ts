import { BALANCER_ABILITY_IDS } from '../balancer/types.js';
import {CHAOS_HUNTER_ABILITY_IDS} from '../chaos-hunter/types.js';
import {IMPERATIVE_MAGE_ABILITY_IDS} from '../imperative-mage/types.js';
import {PUNISHMENT_KNIGHT_ABILITY_IDS} from '../punishment-knight/types.js';
import {JUDGE_ABILITY_IDS} from '../judge/types.js';
import {INTERROGATOR_ABILITY_IDS} from '../interrogator/types.js';
import {SHERIFF_ABILITY_IDS} from '../sheriff/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  ARBITER_ABILITIES, ARBITER_BOTTLE_IDS, ARBITER_CONSUMPTION_RISK, ARBITER_FORMULA_STATUS,
  ARBITER_GUIDE, ARBITER_POTION_SOURCES, ARBITER_PRICES, ARBITER_SOURCE_STATUS,
} from './content.js';
import {
  ARBITER_ABILITY_IDS, ARBITER_CASE_IDS, type ArbiterAcquisitionCommand, type ArbiterAction,
  type ArbiterBottle, type ArbiterCommand, type ArbiterProjection, type ArbiterState,
} from './types.js';

export function createArbiterState(): ArbiterState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: ARBITER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(ARBITER_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const potionPrice = (bottle: ArbiterBottle) => ARBITER_PRICES.potion - (bottle.labourSteps === 2 ? ARBITER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ArbiterBottle) => Number(bottle.id.slice('arbiter-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (arbiter: ArbiterState) => arbiter.bottles.length > 0 && arbiter.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ARBITER_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的仲裁人成品魔药，原瓶arbiter-potion-${number}。民间调解处供给为本作原创，完整配方尚未核实，未声称在调解处配制；取得此瓶不赋予官方身份，不建立任何组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isArbiterAcquisitionCommand(command: ArbiterCommand): command is ArbiterAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact intents only; life owns actual verification, closing and bounded reporting. */
export function validateArbiterCommand(value: unknown): value is ArbiterCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^arbiter-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^arbiter-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && ARBITER_CASE_IDS.includes(value.caseId as typeof ARBITER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && ARBITER_CASE_IDS.includes(value.caseId as typeof ARBITER_CASE_IDS[number]) && ['AUTHORITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

function commandBlock(s: SliceState, command: ArbiterAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.arbiter.cases).some(caseState => caseState.contactOpen)) return '先实际停止仍在进行的本次交涉，保留已经说过的话、实际回应与调解记录。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到民间调解文书员。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服仲裁人魔药；未服的原瓶仍为你保留。';
  if (s.week < 5) return `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起才能拜访民间调解文书员。`;
  if (command.type === 'DISCOVER') return s.arbiter.discovered ? '已经认识这位民间调解文书员。' : null;
  if (!s.arbiter.discovered) return '先拜访民间调解文书员。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.arbiter.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < ARBITER_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.arbiter.guidanceKnown) return '先听文书员说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.arbiter.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.arbiter) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.arbiter.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.arbiter.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.arbiter) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.arbiter.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选仲裁人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次调解处劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; life owns verification, contact and withdrawal. */
export function applyArbiterCommand(s: SliceState, command: ArbiterAcquisitionCommand, c: SeerContext): void {
  rule(validateArbiterCommand(command) && isArbiterAcquisitionCommand(command), '仲裁人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.arbiter.discovered = true;
      c.note('认识民间调解文书员', `你在贝克兰德拜访了${ARBITER_GUIDE}，消耗1行动。这位成年文书员保管三瓶独立封存的仲裁人成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。文书员与成品药渠道为本作原创G，不代表已知配方或可以在调解处制造魔药。${ARBITER_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ARBITER_PRICES.guidance;
      s.arbiter.guidanceKnown = true;
      c.note('听取仲裁人用药说明', `花费1行动、120便士，听文书员说明三瓶现有魔药的交付方式和指导服药的四档风险。${ARBITER_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。威严、令人信服的魅力与格斗训练分别记录掌握度。共用院落、嘈杂作业与出口争执三项原创G实践都要先观察，再选择威严调解或普通商量；实际结束本次交涉后，报告只写眼前情况、当事人实际回应和接受的安排；威严不能取代同意，命令不等于必须服从。结束交涉不抹除已经说过的话或约定。${ARBITER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.arbiter.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成普通调解记录核对' : '完成调解处预约整理', bottle.labourSteps === 1
        ? `你在文书员监督下核对普通调解记录与当事人已确认的原件，标注缺项，不接触异常物件，完成一次实际调解处劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由文书员保管。第二次整理劳务完成后可抵该瓶600便士。普通劳务不赋予非凡能力，也不产生异常知识污染。`
        : `你在薇娜指导下整理普通调解预约与交接清单，按现有日期归档，归还清单与工具，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.arbiter.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('仲裁人原瓶交付', `文书员将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次调解处劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${ARBITER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.arbiter.resupply.requestedWeek = s.week;
      c.note('申请下一批仲裁人魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${ARBITER_GUIDE}提出下一批三瓶的补给请求，并清点调解处收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由文书员持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.arbiter.resupply.deliveries += 1;
      const firstNumber = s.arbiter.resupply.deliveries * ARBITER_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < ARBITER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.arbiter.bottles.push({ id: `arbiter-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.arbiter.resupply.requestedWeek = null;
      c.note('下一批仲裁人原瓶到货', `第${s.week}周，本作G供给第${s.arbiter.resupply.deliveries + 1}批三瓶实际送到调解处，原瓶arbiter-potion-${firstNumber}至arbiter-potion-${firstNumber + 2}由文书员保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.arbiter.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'justiciar';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(ARBITER_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 1], ['knowledge', 0]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为仲裁人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+1、意志+1、知识不增加。威严、令人信服的魅力与格斗训练从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。这些数值为本作原创G。威严与魅力可能使人愿意听取要求，对方仍能拒绝；不自动判定法律罪责，不改写现实，也不获得官方身份。三项本作G实践保留普通商量方法，实际结束交涉后只报告当事人真实接受的安排；每份有效报告扮演+25，三项完成后的反思再+25。不获得治安官的图像追踪与有条件感应、审讯者的精神刺穿与审讯或法官的禁止。${ARBITER_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '文书员中断了仲裁人晋升' : '仲裁人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。文书员处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Life adds only observed scenes and the readable state of actual contact. */
export function projectArbiter(s: SliceState): ArbiterProjection {
  const actions: ArbiterAction[] = [], isPromoted = promoted(s), known = s.arbiter.discovered;
  const acting = isPromoted ? (s.progression.sequence===9?s.progression.acting:s.sheriff.arbiterActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: ArbiterAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-arbiter', `拜访${ARBITER_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.arbiter.guidanceKnown) add('learn-arbiter-guidance', '请文书员说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.arbiter.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '普通调解记录核对' : '调解处预约整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶仲裁人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.arbiter.resupply.requestedWeek !== null) add('receive-arbiter-supply', '确认下一批三瓶到货', `0行动 · 第${s.arbiter.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.arbiter)) add('request-arbiter-supply', '向文书员订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.arbiter.guidanceKnown) {
    for (const bottle of s.arbiter.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶仲裁人魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.arbiter.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.arbiter.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '仲裁人 · 序列9' : '仲裁人之路', discovered: known, guidanceKnown: s.arbiter.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${ARBITER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.arbiter.resupply.requestedWeek === null ? `已实际接收后续供给${s.arbiter.resupply.deliveries}批。` : `第${s.arbiter.resupply.requestedWeek}周提出补给请求，第${s.arbiter.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: ARBITER_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.arbiter.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 仲裁人成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `文书员保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? ARBITER_ABILITIES.map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可以拜访民间调解文书员，了解渠道并独立选择服药。`
      : acting >= 100 ? '仲裁人魔药已在本作G有限调解与反思中消化；三项能力仍按实际练习分别记录掌握度，不代表可以自动判定法律罪责、强制他人服从或改写现实。'
        : acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察共用院落、嘈杂作业与出口争执，选择威严调解或普通商量；实际结束本次交涉后，只报告当事人真实接受的局部安排。三项有限报告各25、反思25及消化规则均为本作原创G；威严不能取代同意，命令不等于必须服从。'
          : `已留下仲裁人扮演经历（${acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${ARBITER_CONSUMPTION_RISK}`
      : '完成4整周普通生活后，从第5周起拜访民间调解文书员，了解仲裁人成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], insideCase: Object.values(s.arbiter.cases).some(caseState => caseState.contactOpen), environment: '',
  };
}

/** Acquisition verifies shapes and provenance; life validates causal practice transitions. */
export function validateArbiterState(s: SliceState): boolean {
  const raw: unknown = s.arbiter;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (raw.discovered && s.week < 5) return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ARBITER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, ARBITER_CASE_IDS)) return false;
  for (const caseState of Object.values(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0) || !integer(caseState.closes, 0)) return false;
    if (caseState.method !== null && !['AUTHORITY', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (!['NONE', 'TURN_AGREED', 'VOLUME_AGREED', 'PASSAGE_AGREED'].includes(caseState.outcome as string)) return false;
    if (typeof caseState.contactOpen !== 'boolean') return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const arbiter = raw as unknown as ArbiterState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'justiciar' && !isPromoted) return false;
  if (isPromoted) {
    if (!arbiter.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...ARBITER_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?SHERIFF_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?INTERROGATOR_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?JUDGE_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?PUNISHMENT_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?IMPERATIVE_MAGE_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?CHAOS_HUNTER_ABILITY_IDS:[]),...(s.progression.sequence===2?BALANCER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (ARBITER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || arbiter.reflected
    || Object.values(arbiter.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.outcome !== 'NONE' || caseState.contactOpen || caseState.closes !== 0)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of arbiter.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `arbiter-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 5;
    if (index < ARBITER_BOTTLE_IDS.length) {
      if (bottle.source !== ARBITER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!arbiter.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ARBITER_BOTTLE_IDS.length) - 1;
      if (index % ARBITER_BOTTLE_IDS.length === 0) {
        const previous = arbiter.bottles.slice(index - ARBITER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!arbiter.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (arbiter.resupply.requestedWeek !== null && (!arbiter.guidanceKnown || !supplyExhausted(arbiter) || arbiter.bottles.some(bottle => bottle.consumedWeek! > arbiter.resupply.requestedWeek!) || s.progression.promotionWeek !== null && arbiter.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { ARBITER_ABILITIES } from './content.js';
export { ARBITER_CASE_IDS } from './types.js';
export type { ArbiterActivityCommand, ArbiterAction, ArbiterProjection } from './types.js';
