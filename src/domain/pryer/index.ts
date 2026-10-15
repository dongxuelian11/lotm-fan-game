import { SAGE_ABILITY_IDS } from '../sage/types.js';
import {PROPHECY_MASTER_ABILITY_IDS} from '../prophecy-master/types.js';
import {MYSTIC_ABILITY_IDS} from '../mystic/types.js';
import {STAR_MYSTIC_ABILITY_IDS} from '../star-mystic/types.js';
import {SCROLL_PROFESSOR_ABILITY_IDS} from '../scroll-professor/types.js';
import {WIZARD_ABILITY_IDS} from '../wizard/types.js';
import {COMBAT_SCHOLAR_ABILITY_IDS} from '../combat-scholar/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  PRYER_ABILITIES, PRYER_BOTTLE_IDS, PRYER_CONSUMPTION_RISK, PRYER_FORMULA_STATUS,
  PRYER_GUIDE, PRYER_POTION_SOURCES, PRYER_PRICES, PRYER_SOURCE_STATUS,
} from './content.js';
import {
  PRYER_ABILITY_IDS, PRYER_CASE_IDS, type PryerAcquisitionCommand, type PryerAction,
  type PryerBottle, type PryerCommand, type PryerProjection, type PryerState,
} from './types.js';

export function createPryerState(): PryerState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: PRYER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(PRYER_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', readingOpen: false, overclaims: 0,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'hermit' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))));
const potionPrice = (bottle: PryerBottle) => PRYER_PRICES.potion - (bottle.labourSteps === 2 ? PRYER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PryerBottle) => Number(bottle.id.slice('pryer-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (pryer: PryerState) => pryer.bottles.length > 0 && pryer.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${PRYER_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的窥秘人成品魔药，原瓶pryer-potion-${number}。抄录室供给为本作原创，完整配方尚未核实，未声称在抄录室配制；取得此瓶不建立任何组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isPryerAcquisitionCommand(command: PryerCommand): command is PryerAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact intents only; reports carry their bounded claim and closing is a real action. */
export function validatePryerCommand(value: unknown): value is PryerCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^pryer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^pryer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && PRYER_CASE_IDS.includes(value.caseId as typeof PRYER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && PRYER_CASE_IDS.includes(value.caseId as typeof PRYER_CASE_IDS[number]) && ['MYSTIC', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'REPORT') return shape(value, ['type', 'caseId', 'claim']) && PRYER_CASE_IDS.includes(value.caseId as typeof PRYER_CASE_IDS[number]) && ['LIMITED', 'COMPLETE'].includes(value.claim as string);
  return false;
}

function commandBlock(s: SliceState, command: PryerAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.pryer.cases).some(caseState => caseState.readingOpen)) return '先实际合上仍打开的异常页，结束本次阅读。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到抄录室指导者。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服窥秘人魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.pryer.discovered ? '已经认识这位抄录室指导者。' : null;
  if (!s.pryer.discovered) return '先拜访抄录室指导者。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.pryer.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < PRYER_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.pryer.guidanceKnown) return '先听指导者说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.pryer.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.pryer) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.pryer.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.pryer.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.pryer) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.pryer.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选窥秘人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次抄录室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; life owns observed evidence and actual page closure. */
export function applyPryerCommand(s: SliceState, command: PryerAcquisitionCommand, c: SeerContext): void {
  rule(validatePryerCommand(command) && isPryerAcquisitionCommand(command), '窥秘人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.pryer.discovered = true;
      c.note('认识抄录室指导者', `你在贝克兰德拜访了${PRYER_GUIDE}，消耗1行动。这位成年指导者保管三瓶独立封存的窥秘人成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。指导者与成品药渠道为本作原创G，不代表已知配方或可以在抄录室制造魔药。${PRYER_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PRYER_PRICES.guidance;
      s.pryer.guidanceKnown = true;
      c.note('听取窥秘人用药说明', `花费1行动、120便士，听指导者说明三瓶现有魔药的交付方式和指导服药的四档风险。${PRYER_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。有限灵视、初步仪式知识与神秘学研习分别记录掌握度。先核对抄件、灯旁迹象、仪式准备与异常页，再选择有限能力或普通核查；只报告实际观察到的有限结果。异常页实际打开后必须先合上，失败后也要关闭，合页不消除已有后果，也不代表免疫隐匿贤者。普通学习不会自动产生污染，不能把老尼尔失控时的复活教导用作法术。${PRYER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.pryer.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成普通抄件编号核对' : '完成书架与灯具整理', bottle.labourSteps === 1
        ? `你在指导者监督下核对普通抄件的编号与页数，记录缺页，不接触异常页，完成一次实际抄录室劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由指导者保管。第二次整理劳务完成后可抵该瓶600便士。普通劳务不赋予非凡能力，也不产生异常知识污染。`
        : `你在莉奈指导下整理书架与普通灯具，清出既有过道，归还清单和借用工具，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.pryer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('窥秘人原瓶交付', `指导者将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次抄录室劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${PRYER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.pryer.resupply.requestedWeek = s.week;
      c.note('申请下一批窥秘人魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${PRYER_GUIDE}提出下一批三瓶的补给请求，并清点抄录室收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由指导者持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.pryer.resupply.deliveries += 1;
      const firstNumber = s.pryer.resupply.deliveries * PRYER_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < PRYER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.pryer.bottles.push({ id: `pryer-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.pryer.resupply.requestedWeek = null;
      c.note('下一批窥秘人原瓶到货', `第${s.week}周，本作G供给第${s.pryer.resupply.deliveries + 1}批三瓶实际送到抄录室，原瓶pryer-potion-${firstNumber}至pryer-potion-${firstNumber + 2}由指导者保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.pryer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'hermit';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(PRYER_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 0], ['perception', 2], ['will', 2], ['knowledge', 2]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为窥秘人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质不增加、感知+2、意志+2、知识+2。有限灵视、初步仪式知识与神秘学研习从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。可以和平比较原抄件、核查有限灵性迹象与仪式准备，面对实际异常页时停止本次阅读，再如实报告局部结果；普通方法同样保留。不能把迹象说成完整答案，不能保证外部力量回应，不获得复活或高阶窥秘能力，也不自动加入任何组织。${PRYER_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了窥秘人晋升' : '窥秘人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。指导者处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Life adds actual observed scenes, overclaims and the readable open-page state. */
export function projectPryer(s: SliceState): PryerProjection {
  const actions: PryerAction[] = [], isPromoted = promoted(s), known = s.pryer.discovered;
  const acting=isPromoted?(s.progression.sequence===9?s.progression.acting:s.combatScholar.pryerActingAtPromotion??0):0;
  const add = (id: string, label: string, cost: string, command: PryerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-pryer', `拜访${PRYER_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.pryer.guidanceKnown) add('learn-pryer-guidance', '请指导者说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.pryer.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '普通抄件编号核对' : '书架与灯具整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶窥秘人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.pryer.resupply.requestedWeek !== null) add('receive-pryer-supply', '确认下一批三瓶到货', `0行动 · 第${s.pryer.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.pryer)) add('request-pryer-supply', '向指导者订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.pryer.guidanceKnown) {
    for (const bottle of s.pryer.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶窥秘人魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.pryer.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.pryer.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '窥秘人 · 序列9' : '窥秘人之路', discovered: known, guidanceKnown: s.pryer.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${PRYER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.pryer.resupply.requestedWeek === null ? `已实际接收后续供给${s.pryer.resupply.deliveries}批。` : `第${s.pryer.resupply.requestedWeek}周提出补给请求，第${s.pryer.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: PRYER_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.pryer.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 窥秘人成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `指导者保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PRYER_ABILITIES.map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在指导者面前服药。`
      : acting >= 100 ? '窥秘人魔药已消化；有限灵视、初步仪式知识与神秘学研习仍按各自实际练习分别记录掌握度。'
        : acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察抄件、灯旁迹象、仪式准备与异常页，再选择有限能力或普通方法；实际核查后如实报告，异常页打开后须先实际合上。四段有限报告各积累20扮演，最后反思积累20，不要求伤害他人。'
          : `已留下窥秘人扮演经历（${acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${PRYER_CONSUMPTION_RISK}`
      : '拜访抄录室指导者，了解窥秘人成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], insideCase: false, environment: '',
  };
}

/** Acquisition verifies shapes and provenance; life validates causal practice transitions. */
export function validatePryerState(s: SliceState): boolean {
  const raw: unknown = s.pryer;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PRYER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, PRYER_CASE_IDS)) return false;
  for (const [caseId, caseState] of Object.entries(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'readingOpen', 'overclaims'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0) || !integer(caseState.overclaims, 0)) return false;
    if (caseState.method !== null && !['MYSTIC', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (!['NONE', 'MARGIN_COMPARED', 'AURA_NOTED', 'RITUAL_CHECKED', 'PAGE_NOTED'].includes(caseState.outcome as string)) return false;
    if (typeof caseState.readingOpen !== 'boolean' || caseState.readingOpen && caseId !== 'intrusive-page') return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const pryer = raw as unknown as PryerState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'hermit' && !isPromoted) return false;
  if (isPromoted) {
    if (!pryer.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...PRYER_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))))?COMBAT_SCHOLAR_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))))?WIZARD_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2)))?SCROLL_PROFESSOR_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))?STAR_MYSTIC_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2)?MYSTIC_ABILITY_IDS:[]),...([3, 2].includes(s.progression.sequence ?? 0)?PROPHECY_MASTER_ABILITY_IDS:[]),...(s.progression.sequence===2?SAGE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (PRYER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || pryer.reflected
    || Object.values(pryer.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.outcome !== 'NONE' || caseState.readingOpen || caseState.overclaims !== 0)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of pryer.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `pryer-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < PRYER_BOTTLE_IDS.length) {
      if (bottle.source !== PRYER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!pryer.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PRYER_BOTTLE_IDS.length) - 1;
      if (index % PRYER_BOTTLE_IDS.length === 0) {
        const previous = pryer.bottles.slice(index - PRYER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!pryer.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (pryer.resupply.requestedWeek !== null && (!pryer.guidanceKnown || !supplyExhausted(pryer) || pryer.bottles.some(bottle => bottle.consumedWeek! > pryer.resupply.requestedWeek!) || s.progression.promotionWeek !== null && pryer.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { PRYER_ABILITIES } from './content.js';
export { PRYER_CASE_IDS } from './types.js';
export type { PryerActivityCommand, PryerAction, PryerProjection } from './types.js';
