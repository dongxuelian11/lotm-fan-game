import {FATE_TROJAN_ABILITY_IDS} from '../fate-trojan/types.js';
import {DECEIT_MENTOR_ABILITY_IDS} from '../deceit-mentor/types.js';
import {PARASITE_ABILITY_IDS} from '../parasite/types.js';
import {DREAM_STEALER_ABILITY_IDS} from '../dream-stealer/types.js';
import {FIRE_THIEF_ABILITY_IDS} from '../fire-thief/types.js';
import {CRYPTOLOGIST_ABILITY_IDS} from '../cryptologist/types.js';
import {SWINDLER_ABILITY_IDS} from '../swindler/types.js';
import {createMarauderDispute,projectMarauderDispute} from './dispute.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  MARAUDER_ABILITIES, MARAUDER_BOTTLE_IDS, MARAUDER_CONSUMPTION_RISK, MARAUDER_FORMULA_STATUS,
  MARAUDER_GUIDE, MARAUDER_ORIGINALS, MARAUDER_POTION_SOURCES, MARAUDER_PRICES, MARAUDER_SOURCE_STATUS,
} from './content.js';
import {
  MARAUDER_ABILITY_IDS, MARAUDER_CASE_IDS, MARAUDER_ORIGINAL_IDS, type MarauderAcquisitionCommand, type MarauderAction,
  type MarauderBottle, type MarauderCommand, type MarauderProjection, type MarauderState,
} from './types.js';

export function createMarauderState(): MarauderState {
  return {
    discovered: false, guidanceKnown: false, dispute:createMarauderDispute(),
    bottles: MARAUDER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(MARAUDER_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, mistakes: 0, conclusion: null, attention: 0,
    }])),
    originals: Object.fromEntries(MARAUDER_ORIGINALS.map(original => [original.id, { ...original }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'error' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const potionPrice = (bottle: MarauderBottle) => MARAUDER_PRICES.potion - (bottle.labourSteps === 2 ? MARAUDER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: MarauderBottle) => Number(bottle.id.slice('marauder-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (marauder: MarauderState) => marauder.bottles.length > 0 && marauder.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${MARAUDER_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的偷盗者成品魔药，原瓶marauder-potion-${number}。失物登记处供给为本作原创，完整配方尚未核实，未声称在失物登记处配制；取得此瓶不建立任何家族或组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isMarauderAcquisitionCommand(command: MarauderCommand): command is MarauderAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateMarauderCommand(value: unknown): value is MarauderCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT','OBSERVE_DISPUTE','PREPARE_DISPUTE','START_DISPUTE','LEAVE_DISPUTE','RETURN_TOOL'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^marauder-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^marauder-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'RETURN', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && MARAUDER_CASE_IDS.includes(value.caseId as typeof MARAUDER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && MARAUDER_CASE_IDS.includes(value.caseId as typeof MARAUDER_CASE_IDS[number]) && ['DEXTERITY', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'REPORT') return shape(value, ['type', 'caseId', 'conclusion']) && MARAUDER_CASE_IDS.includes(value.caseId as typeof MARAUDER_CASE_IDS[number]) && ['LIMITED', 'CERTAIN'].includes(value.conclusion as string);
  return false;
}

function commandBlock(s: SliceState, command: MarauderAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到失物登记处导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服偷盗者魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.marauder.discovered ? '已经认识这位失物登记处导师。' : null;
  if (!s.marauder.discovered) return '先拜访失物登记处导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.marauder.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < MARAUDER_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.marauder.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.marauder.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.marauder) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.marauder.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.marauder.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.marauder) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.marauder.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选偷盗者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次失物登记处劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy. Actual original-item transfers are dispatched separately. */
export function applyMarauderCommand(s: SliceState, command: MarauderAcquisitionCommand, c: SeerContext): void {
  rule(validateMarauderCommand(command) && isMarauderAcquisitionCommand(command), '偷盗者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.marauder.discovered = true;
      c.note('认识独立失物登记处导师', `你在贝克兰德拜访了${MARAUDER_GUIDE}，消耗1行动。这位成年独立登记员在登记处接待你，保管三瓶独立封存的偷盗者成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。导师与成品药渠道为本作原创G，不代表已知配方或可以在失物登记处制造魔药。${MARAUDER_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= MARAUDER_PRICES.guidance;
      s.marauder.guidanceKnown = true;
      c.note('听取偷盗者用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${MARAUDER_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。${MARAUDER_SOURCE_STATUS}本阶段按敏捷、灵巧与偷取三个本作G训练分类记录掌握度；实践必须先看到真实原物并核对持有关系，普通沟通与当面交接也能完成协助。实际取走只改变持有与位置，不把原物所有权交给你；未打开的封套仍保持未知，被注意和后续归还分别留下事实。不能远程读取库存、偷取能力或灵性，也没有已核实的序列9宝物感应。接触导师与服药都不建立教会或其它组织身份。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.marauder.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成失物编号核对' : '完成交接清单整理', bottle.labourSteps === 1
        ? `你在登记员监督下核对失物编号与借还清单，记录缺号与交接次序，完成一次实际失物登记处劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由失物登记处保管。完成第二次清单整理后可抵该瓶600便士。核对不赋予非凡能力，也不把登记处的失物交给你保管。`
        : `你在艾德温指导下整理失物登记处的交接清单，并将借阅册页归还原柜，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.marauder.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('偷盗者原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次失物登记处劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${MARAUDER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.marauder.resupply.requestedWeek = s.week;
      c.note('申请下一批偷盗者魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${MARAUDER_GUIDE}提出下一批三瓶的补给请求，并清点失物登记处收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.marauder.resupply.deliveries += 1;
      const firstNumber = s.marauder.resupply.deliveries * MARAUDER_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < MARAUDER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.marauder.bottles.push({ id: `marauder-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.marauder.resupply.requestedWeek = null;
      c.note('下一批偷盗者原瓶到货', `第${s.week}周，本作G供给第${s.marauder.resupply.deliveries + 1}批三瓶实际送到失物登记处，原瓶marauder-potion-${firstNumber}至marauder-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.marauder.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'error';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(MARAUDER_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 2], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为偷盗者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+2、意志+1、知识+1。敏捷、灵巧与偷取三个本作G训练分类从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。你能练习对眼前可接触普通原物的实际操作，成功只改变持有者与位置，不转移所有权。没有远程库存、能力偷取、灵性偷取或已核实的序列9宝物感应，也不自动加入任何组织。${MARAUDER_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了偷盗者晋升' : '偷盗者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** The activity module adds observed original items and actual custody changes. */
export function projectMarauder(s: SliceState): MarauderProjection {
  const actions: MarauderAction[] = [], isPromoted = promoted(s), known = s.marauder.discovered;
  const add = (id: string, label: string, cost: string, command: MarauderAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-marauder', `拜访${MARAUDER_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.marauder.guidanceKnown) add('learn-marauder-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.marauder.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '失物编号核对' : '交接清单整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶偷盗者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.marauder.resupply.requestedWeek !== null) add('receive-marauder-supply', '确认下一批三瓶到货', `0行动 · 第${s.marauder.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.marauder)) add('request-marauder-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.marauder.guidanceKnown) {
    for (const bottle of s.marauder.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶偷盗者魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.marauder.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.marauder.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '偷盗者 · 序列9' : '偷盗者之路', discovered: known, guidanceKnown: s.marauder.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${MARAUDER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.marauder.resupply.requestedWeek === null ? `已实际接收后续供给${s.marauder.resupply.deliveries}批。` : `第${s.marauder.resupply.requestedWeek}周提出补给请求，第${s.marauder.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: MARAUDER_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.marauder.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 偷盗者成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? MARAUDER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ([8,7,6,5,4,3,2].includes(s.progression.sequence!)?(s.swindler.marauderActingAtPromotion??100):s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : ([8,7,6,5,4,3,2].includes(s.progression.sequence!)||(s.progression.acting>=100)) ? '偷盗者魔药已消化；能力掌握仍按实际操作、原物交接和如实报告分别记录。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察原物、持有人与交接条件，再选择灵巧操作或普通方法；实际归还后如实报告，封套内未见的内容仍保持未知。'
          : `已留下偷盗者扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${MARAUDER_CONSUMPTION_RISK}`
      : '拜访失物登记处导师，了解偷盗者成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [],
    originals: [],
    dispute:projectMarauderDispute(s),
    environment: '',
  };
}

/** Finite-original conservation and provenance. The activity module validates evidence boundaries and case transitions. */
export function validateMarauderState(s: SliceState): boolean {
  const raw: unknown = s.marauder;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'originals', 'reflected','dispute'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== MARAUDER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, MARAUDER_CASE_IDS)) return false;
  for (const caseState of Object.values(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'mistakes', 'conclusion', 'attention'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0)) return false;
    if (!integer(caseState.mistakes, 0)) return false;
    if (!integer(caseState.attention, 0)) return false;
    if (caseState.method !== null && !['DEXTERITY', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (caseState.conclusion !== null && !['LIMITED', 'CERTAIN'].includes(caseState.conclusion as string)) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  if (!record(raw.originals) || !shape(raw.originals, MARAUDER_ORIGINAL_IDS)) return false;
  for (const id of MARAUDER_ORIGINAL_IDS) {
    const original = raw.originals[id];
    if (!record(original) || !shape(original, ['id', 'owner', 'custodian', 'location', 'version', 'sealed'])) return false;
    if (original.id !== id || typeof original.owner !== 'string' || original.owner.trim().length === 0
      || !['HOLDER', 'SITE', 'PLAYER', 'OWNER'].includes(original.custodian as string)
      || typeof original.location !== 'string' || original.location.trim().length === 0
      || !integer(original.version, 1) || typeof original.sealed !== 'boolean') return false;
  }
  const marauder = raw as unknown as MarauderState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'error' && !isPromoted) return false;
  if (isPromoted) {
    if (!marauder.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery,[...MARAUDER_ABILITY_IDS,...([8,7,6,5,4,3,2].includes(s.progression.sequence!)?SWINDLER_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?CRYPTOLOGIST_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?FIRE_THIEF_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?DREAM_STEALER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?PARASITE_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?DECEIT_MENTOR_ABILITY_IDS:[]),...(s.progression.sequence===2?FATE_TROJAN_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (MARAUDER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || marauder.reflected
    || Object.values(marauder.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.mistakes !== 0 || caseState.conclusion !== null || caseState.attention !== 0)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of marauder.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `marauder-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < MARAUDER_BOTTLE_IDS.length) {
      if (bottle.source !== MARAUDER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!marauder.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / MARAUDER_BOTTLE_IDS.length) - 1;
      if (index % MARAUDER_BOTTLE_IDS.length === 0) {
        const previous = marauder.bottles.slice(index - MARAUDER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!marauder.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (marauder.resupply.requestedWeek !== null && (!marauder.guidanceKnown || !supplyExhausted(marauder) || marauder.bottles.some(bottle => bottle.consumedWeek! > marauder.resupply.requestedWeek!) || s.progression.promotionWeek !== null && marauder.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { MARAUDER_ABILITIES } from './content.js';
export { MARAUDER_CASE_IDS, MARAUDER_ORIGINAL_IDS } from './types.js';
export type { MarauderActivityCommand, MarauderAction, MarauderProjection } from './types.js';
