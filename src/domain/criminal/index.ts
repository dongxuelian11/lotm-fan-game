import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import {BLATHERER_ABILITY_IDS} from '../blatherer/types.js';
import {DEVIL_ABILITY_IDS} from '../devil/types.js';
import {DESIRE_APOSTLE_ABILITY_IDS} from '../desire-apostle/types.js';
import {DEMON_ABILITY_IDS} from '../demon/types.js';
import {SERIAL_KILLER_ABILITY_IDS} from '../serial-killer/types.js';
import {UNWINGED_ABILITY_IDS} from '../unwinged/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  CRIMINAL_ABILITIES, CRIMINAL_BOTTLE_IDS, CRIMINAL_CONSUMPTION_RISK, CRIMINAL_FORMULA_STATUS,
  CRIMINAL_GUIDE, CRIMINAL_POTION_SOURCES, CRIMINAL_PRICES, CRIMINAL_SOURCE_STATUS,
} from './content.js';
import {
  CRIMINAL_ABILITY_IDS, CRIMINAL_CASE_IDS, type CriminalAcquisitionCommand, type CriminalAction,
  type CriminalBottle, type CriminalCommand, type CriminalProjection, type CriminalState,
} from './types.js';

export function createCriminalState(): CriminalState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: CRIMINAL_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(CRIMINAL_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', holding: false, tookOriginal: false, returns: 0,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const potionPrice = (bottle: CriminalBottle) => CRIMINAL_PRICES.potion - (bottle.labourSteps === 2 ? CRIMINAL_PRICES.labourCredit : 0);
const bottleNumber = (bottle: CriminalBottle) => Number(bottle.id.slice('criminal-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (criminal: CriminalState) => criminal.bottles.length > 0 && criminal.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${CRIMINAL_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的罪犯成品魔药，原瓶criminal-potion-${number}。旧货间供给为本作原创，完整配方尚未核实，未声称在旧货间配制；取得此瓶不建立任何组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isCriminalAcquisitionCommand(command: CriminalCommand): command is CriminalAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact intents only; life owns actual handling and return of the original pay packet. */
export function validateCriminalCommand(value: unknown): value is CriminalCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^criminal-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^criminal-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'RETURN', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && CRIMINAL_CASE_IDS.includes(value.caseId as typeof CRIMINAL_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && CRIMINAL_CASE_IDS.includes(value.caseId as typeof CRIMINAL_CASE_IDS[number]) && ['ABILITY', 'ORDINARY', 'TAKE'].includes(value.method as string);
  return false;
}

function commandBlock(s: SliceState, command: CriminalAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.criminal.cases).some(caseState => caseState.holding)) return '先实际归还仍由你持有的原工资袋。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到旧货管理员。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服罪犯魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.criminal.discovered ? '已经认识这位旧货管理员。' : null;
  if (!s.criminal.discovered) return '先拜访旧货管理员。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.criminal.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < CRIMINAL_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.criminal.guidanceKnown) return '先听管理员说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.criminal.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.criminal) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.criminal.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.criminal.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.criminal) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.criminal.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选罪犯原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次旧货间劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; life owns evidence, original possession, return and withdrawal. */
export function applyCriminalCommand(s: SliceState, command: CriminalAcquisitionCommand, c: SeerContext): void {
  rule(validateCriminalCommand(command) && isCriminalAcquisitionCommand(command), '罪犯准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.criminal.discovered = true;
      c.note('认识旧货管理员', `你在贝克兰德拜访了${CRIMINAL_GUIDE}，消耗1行动。这位成年管理员保管三瓶独立封存的罪犯成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。管理员与成品药渠道为本作原创G，不代表已知配方或可以在旧货间制造魔药。${CRIMINAL_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= CRIMINAL_PRICES.guidance;
      s.criminal.guidanceKnown = true;
      c.note('听取罪犯用药说明', `花费1行动、120便士，听管理员说明三瓶现有魔药的交付方式和指导服药的四档风险。${CRIMINAL_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。强健身体、敏锐直觉与犯罪相关才能分别记录掌握度。工资袋、催促接下的差事与卡住的手推车都要先观察，再选择能力或普通方法；若实际拿走原工资袋，必须实际归还，不能用一句报告代替。保护他人、克制越界的实践是本作G扮演解释，不是原著保证善举就能无痛消化，尤其不能据此跳过后续序列7的原著要求。${CRIMINAL_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.criminal.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成普通旧物编号核对' : '完成货架与空箱整理', bottle.labourSteps === 1
        ? `你在管理员监督下核对普通旧物的编号与现有清单，记录缺项，不接触异常旧物，完成一次实际旧货间劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由管理员保管。第二次整理劳务完成后可抵该瓶600便士。普通劳务不赋予非凡能力，也不产生异常知识污染。`
        : `你在罗安指导下整理货架与普通空箱，清出既有过道，归还清单和借用工具，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.criminal.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('罪犯原瓶交付', `管理员将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次旧货间劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${CRIMINAL_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.criminal.resupply.requestedWeek = s.week;
      c.note('申请下一批罪犯魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${CRIMINAL_GUIDE}提出下一批三瓶的补给请求，并清点旧货间收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由管理员持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.criminal.resupply.deliveries += 1;
      const firstNumber = s.criminal.resupply.deliveries * CRIMINAL_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < CRIMINAL_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.criminal.bottles.push({ id: `criminal-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.criminal.resupply.requestedWeek = null;
      c.note('下一批罪犯原瓶到货', `第${s.week}周，本作G供给第${s.criminal.resupply.deliveries + 1}批三瓶实际送到旧货间，原瓶criminal-potion-${firstNumber}至criminal-potion-${firstNumber + 2}由管理员保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.criminal.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'abyss';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(CRIMINAL_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 0], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为罪犯', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+1、意志不增加、知识+1。强健身体、敏锐直觉与犯罪相关才能从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。罪犯此时仍有良知，你仍选择如何行动；可在三项本作G实践中辨认越界诱惑、保护原物和拒绝可疑差事，普通方法同样保留。实际拿走工资袋后必须把同一原物归还。此G扮演解释不保证原著中任意善举都能无痛消化，更不替代后续序列7的要求；不获得序列8个体魔类法术或序列6致命危险预知，也不自动加入任何组织。${CRIMINAL_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '管理员中断了罪犯晋升' : '罪犯魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。管理员处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Life adds observed scenes and the readable state of the actual original. */
export function projectCriminal(s: SliceState): CriminalProjection {
  const actions: CriminalAction[] = [], isPromoted = promoted(s), known = s.criminal.discovered;
  const acting = isPromoted ? (s.progression.sequence===9?s.progression.acting:s.unwinged.criminalActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: CriminalAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-criminal', `拜访${CRIMINAL_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.criminal.guidanceKnown) add('learn-criminal-guidance', '请管理员说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.criminal.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '普通旧物编号核对' : '货架与空箱整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶罪犯魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.criminal.resupply.requestedWeek !== null) add('receive-criminal-supply', '确认下一批三瓶到货', `0行动 · 第${s.criminal.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.criminal)) add('request-criminal-supply', '向管理员订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.criminal.guidanceKnown) {
    for (const bottle of s.criminal.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶罪犯魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.criminal.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.criminal.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '罪犯 · 序列9' : '罪犯之路', discovered: known, guidanceKnown: s.criminal.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${CRIMINAL_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.criminal.resupply.requestedWeek === null ? `已实际接收后续供给${s.criminal.resupply.deliveries}批。` : `第${s.criminal.resupply.requestedWeek}周提出补给请求，第${s.criminal.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: CRIMINAL_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.criminal.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 罪犯成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `管理员保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? CRIMINAL_ABILITIES.map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在管理员面前服药。`
      : acting >= 100 ? '罪犯魔药已在本作G实践中消化；三项能力仍按各自实际练习分别记录掌握度。这是本段原创扮演解释，不保证原著高序列也能以同样方式消化。'
        : acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察工资袋、催促接下的差事与卡住的手推车，再选择有限能力或普通方法，实际归还手中的原工资袋后才能收尾。三段实践与反思的消化数值为本作原创G，不宣称善举能保证原著魔药无痛消化，尤其不替代序列7的要求。'
          : `已留下罪犯扮演经历（${acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${CRIMINAL_CONSUMPTION_RISK}`
      : '拜访旧货管理员，了解罪犯成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], insideCase: false, environment: '',
  };
}

/** Acquisition verifies shapes and provenance; life validates causal practice transitions. */
export function validateCriminalState(s: SliceState): boolean {
  const raw: unknown = s.criminal;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== CRIMINAL_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, CRIMINAL_CASE_IDS)) return false;
  for (const [caseId, caseState] of Object.entries(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'holding', 'tookOriginal', 'returns'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0) || !integer(caseState.returns, 0)) return false;
    if (caseState.method !== null && !['ABILITY', 'ORDINARY', 'TAKE'].includes(caseState.method as string)) return false;
    if (!['NONE', 'PAY_RETURNED', 'JOB_DECLINED', 'CART_CLEARED'].includes(caseState.outcome as string)) return false;
    if (typeof caseState.holding !== 'boolean' || typeof caseState.tookOriginal !== 'boolean') return false;
    if (caseId !== 'found-pay' && (caseState.holding || caseState.tookOriginal || caseState.returns !== 0)) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const criminal = raw as unknown as CriminalState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'abyss' && !isPromoted) return false;
  if (isPromoted) {
    if (!criminal.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...CRIMINAL_ABILITY_IDS,...(s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?UNWINGED_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?SERIAL_KILLER_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?DEMON_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?DESIRE_APOSTLE_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DEVIL_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?BLATHERER_ABILITY_IDS:[]),...(s.progression.sequence===2?BLOOD_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (CRIMINAL_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || criminal.reflected
    || Object.values(criminal.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.outcome !== 'NONE' || caseState.holding || caseState.tookOriginal || caseState.returns !== 0)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of criminal.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `criminal-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < CRIMINAL_BOTTLE_IDS.length) {
      if (bottle.source !== CRIMINAL_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!criminal.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / CRIMINAL_BOTTLE_IDS.length) - 1;
      if (index % CRIMINAL_BOTTLE_IDS.length === 0) {
        const previous = criminal.bottles.slice(index - CRIMINAL_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!criminal.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (criminal.resupply.requestedWeek !== null && (!criminal.guidanceKnown || !supplyExhausted(criminal) || criminal.bottles.some(bottle => bottle.consumedWeek! > criminal.resupply.requestedWeek!) || s.progression.promotionWeek !== null && criminal.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { CRIMINAL_ABILITIES } from './content.js';
export { CRIMINAL_CASE_IDS } from './types.js';
export type { CriminalActivityCommand, CriminalAction, CriminalProjection } from './types.js';
