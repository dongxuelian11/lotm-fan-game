import { BARREN_MATRIARCH_ABILITY_IDS } from '../barren-matriarch/types.js';
import {COFFIN_BEARER_ABILITY_IDS} from '../coffin-bearer/types.js';
import {ANCIENT_ALCHEMIST_ABILITY_IDS} from '../ancient-alchemist/types.js';
import {DRUID_ABILITY_IDS} from '../druid/types.js';
import {BIOLOGIST_ABILITY_IDS} from '../biologist/types.js';
import {HARVESTPRIEST_ABILITY_IDS} from '../harvestpriest/types.js';
import {PHYSICIAN_ABILITY_IDS} from '../physician/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  CULTIVATOR_ABILITIES, CULTIVATOR_BOTTLE_IDS, CULTIVATOR_CONSUMPTION_RISK, CULTIVATOR_FORMULA_STATUS,
  CULTIVATOR_GUIDE, CULTIVATOR_POTION_SOURCES, CULTIVATOR_PRICES, CULTIVATOR_SOURCE_STATUS,
} from './content.js';
import {
  CULTIVATOR_ABILITY_IDS, CULTIVATOR_CASE_IDS, type CultivatorAcquisitionCommand, type CultivatorAction,
  type CultivatorBottle, type CultivatorCommand, type CultivatorProjection, type CultivatorState,
} from './types.js';

export function createCultivatorState(): CultivatorState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: CULTIVATOR_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(CULTIVATOR_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0,
    }])),
    reflected: false,
    garden: { suppliesBought: false, seeds: 0, water: 0, plantedWeek: null, caredWeek: null, harvestWeek: null, produce: 0, delivered: 0 },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && (s.progression.sequence === 9 || s.progression.sequence === 8 || s.progression.sequence === 7 || (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const potionPrice = (bottle: CultivatorBottle) => CULTIVATOR_PRICES.potion - (bottle.labourSteps === 2 ? CULTIVATOR_PRICES.labourCredit : 0);
const bottleNumber = (bottle: CultivatorBottle) => Number(bottle.id.slice('cultivator-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (cultivator: CultivatorState) => cultivator.bottles.length > 0 && cultivator.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${CULTIVATOR_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的耕种者成品魔药，原瓶cultivator-potion-${number}。小苗圃供给为本作原创，完整配方尚未核实，未声称在小苗圃配制；取得此瓶不建立大地母神教会或其它组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isCultivatorAcquisitionCommand(command: CultivatorCommand): command is CultivatorAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact intents only; life owns actual verification, closing and bounded reporting. */
export function validateCultivatorCommand(value: unknown): value is CultivatorCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'BUY_GARDEN', 'CARE', 'HARVEST'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^cultivator-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^cultivator-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && CULTIVATOR_CASE_IDS.includes(value.caseId as typeof CULTIVATOR_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && CULTIVATOR_CASE_IDS.includes(value.caseId as typeof CULTIVATOR_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

function commandBlock(s: SliceState, command: CultivatorAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.cultivator.cases).some(caseState => caseState.contactOpen)) return '先实际放回工具并结束本次园圃操作，保留已经消耗的物资、生长日期与记录。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到苗圃照料员。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服耕种者魔药；未服的原瓶仍为你保留。';
  if (s.week < 5) return `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起才能拜访苗圃照料员。`;
  if (command.type === 'DISCOVER') return s.cultivator.discovered ? '已经认识这位苗圃照料员。' : null;
  if (!s.cultivator.discovered) return '先拜访苗圃照料员。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.cultivator.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < CULTIVATOR_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.cultivator.guidanceKnown) return '先听照料员说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.cultivator.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.cultivator) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.cultivator.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.cultivator.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.cultivator) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.cultivator.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选耕种者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次小苗圃劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; life owns verification, contact and withdrawal. */
export function applyCultivatorCommand(s: SliceState, command: CultivatorAcquisitionCommand, c: SeerContext): void {
  rule(validateCultivatorCommand(command) && isCultivatorAcquisitionCommand(command), '耕种者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.cultivator.discovered = true;
      c.note('认识苗圃照料员', `你在贝克兰德拜访了${CULTIVATOR_GUIDE}，消耗1行动。这位成年照料员保管三瓶独立封存的耕种者成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。照料员与成品药渠道为本作原创G，不代表已知配方或可以在小苗圃制造魔药。${CULTIVATOR_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= CULTIVATOR_PRICES.guidance;
      s.cultivator.guidanceKnown = true;
      c.note('听取耕种者用药说明', `花费1行动、120便士，听照料员说明三瓶现有魔药的交付方式和指导服药的四档风险。${CULTIVATOR_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。耕作知识、时令观察与细心照料分别记录掌握度。土壤记录、小床播种与共享菜篮三项原创G实践都要先观察，再选择有限能力辅助或普通方法；实际结束本次操作后，只报告已有土壤记录、跨周生长与实际交付。种子、水、行动和等待都有实际成本，结束操作不返还物资或重置日期。${CULTIVATOR_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.cultivator.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成普通种子标签核对' : '完成小苗圃用水记录整理', bottle.labourSteps === 1
        ? `你在照料员监督下核对普通种子标签与现有清单，标注缺项，不取走种子，不接触异常物件，完成一次实际小苗圃劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由照料员保管。第二次整理劳务完成后可抵该瓶600便士。普通劳务不赋予非凡能力，也不产生异常知识污染。`
        : `你在伊芙指导下整理普通用水记录与交接清单，按现有日期归档，归还清单与工具，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.cultivator.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('耕种者原瓶交付', `照料员将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次小苗圃劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${CULTIVATOR_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.cultivator.resupply.requestedWeek = s.week;
      c.note('申请下一批耕种者魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${CULTIVATOR_GUIDE}提出下一批三瓶的补给请求，并清点小苗圃收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由照料员持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.cultivator.resupply.deliveries += 1;
      const firstNumber = s.cultivator.resupply.deliveries * CULTIVATOR_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < CULTIVATOR_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.cultivator.bottles.push({ id: `cultivator-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.cultivator.resupply.requestedWeek = null;
      c.note('下一批耕种者原瓶到货', `第${s.week}周，本作G供给第${s.cultivator.resupply.deliveries + 1}批三瓶实际送到小苗圃，原瓶cultivator-potion-${firstNumber}至cultivator-potion-${firstNumber + 2}由照料员保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.cultivator.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'mother';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(CULTIVATOR_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 0], ['knowledge', 2]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为耕种者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志不增加、知识+2。耕作知识、时令观察与细心照料从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。这些数值与三项能力解释均为本作原创G。土壤记录、小床播种与共享菜篮保留普通方法，实际结束操作后，只报告已观察的记录与已经交付的有限收成；每份有效报告扮演+25，三项完成后的反思再+25。小苗圃只售一次60便士的3份普通种子与2份水；播种消耗3份种子与1份水，下一个真实周起再用1份水照料，播种至少两周后才收成2份，再实际交付1份。不瞬间制造粮食、不控制天气，不下放医师、丰收祭司或序列6生物学家的能力。${CULTIVATOR_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '照料员中断了耕种者晋升' : '耕种者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。照料员处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Life adds only observed scenes and the readable state of actual contact. */
export function projectCultivator(s: SliceState): CultivatorProjection {
  const actions: CultivatorAction[] = [], isPromoted = promoted(s), known = s.cultivator.discovered;
  const acting = isPromoted ? (s.progression.sequence===9?s.progression.acting:s.physician.cultivatorActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: CultivatorAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-cultivator', `拜访${CULTIVATOR_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.cultivator.guidanceKnown) add('learn-cultivator-guidance', '请照料员说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.cultivator.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '普通种子标签核对' : '小苗圃用水记录整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶耕种者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.cultivator.resupply.requestedWeek !== null) add('receive-cultivator-supply', '确认下一批三瓶到货', `0行动 · 第${s.cultivator.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.cultivator)) add('request-cultivator-supply', '向照料员订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.cultivator.guidanceKnown) {
    for (const bottle of s.cultivator.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶耕种者魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.cultivator.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.cultivator.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '耕种者 · 序列9' : '耕种者之路', discovered: known, guidanceKnown: s.cultivator.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${CULTIVATOR_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.cultivator.resupply.requestedWeek === null ? `已实际接收后续供给${s.cultivator.resupply.deliveries}批。` : `第${s.cultivator.resupply.requestedWeek}周提出补给请求，第${s.cultivator.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: CULTIVATOR_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.cultivator.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 耕种者成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `照料员保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? CULTIVATOR_ABILITIES.map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可以拜访苗圃照料员，了解渠道并独立选择服药。`
      : acting >= 100 ? '耕种者魔药已在本作G有限园圃实践与反思中消化；三项能力仍按实际练习分别记录掌握度，不代表能瞬间制造粮食、控制天气或进行生物杂交。'
        : acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察土壤记录、小床播种与共享菜篮，选择有限能力辅助或普通方法；实际结束园圃操作后，只报告已核实记录与已经交付的有限收成。种子与水须购买并实际消耗，跨周照料与等待不能跳过。三项有限报告各25、反思25及消化规则均为本作原创G。'
          : `已留下耕种者扮演经历（${acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${CULTIVATOR_CONSUMPTION_RISK}`
      : '完成4整周普通生活后，从第5周起拜访苗圃照料员，了解耕种者成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], insideCase: Object.values(s.cultivator.cases).some(caseState => caseState.contactOpen), environment: '', garden: '',
  };
}

/** Acquisition verifies shapes and provenance; life validates causal practice transitions. */
export function validateCultivatorState(s: SliceState): boolean {
  const raw: unknown = s.cultivator;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected', 'garden'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (raw.discovered && s.week < 5) return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== CULTIVATOR_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, CULTIVATOR_CASE_IDS)) return false;
  for (const caseState of Object.values(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0) || !integer(caseState.closes, 0)) return false;
    if (caseState.method !== null && !['ABILITY', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (!['NONE', 'SOIL_RECORDED', 'GROWTH_RECORDED', 'PORTION_DELIVERED'].includes(caseState.outcome as string)) return false;
    if (typeof caseState.contactOpen !== 'boolean') return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  if (!record(raw.garden) || !shape(raw.garden, ['suppliesBought', 'seeds', 'water', 'plantedWeek', 'caredWeek', 'harvestWeek', 'produce', 'delivered'])) return false;
  const garden = raw.garden;
  if (typeof garden.suppliesBought !== 'boolean' || !integer(garden.seeds, 0, 3) || !integer(garden.water, 0, 2) || !integer(garden.produce, 0, 2) || !integer(garden.delivered, 0, 1)) return false;
  for (const date of [garden.plantedWeek, garden.caredWeek, garden.harvestWeek]) {
    if (date !== null && !integer(date, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  if (!garden.suppliesBought && (garden.seeds !== 0 || garden.water !== 0 || garden.plantedWeek !== null || garden.caredWeek !== null || garden.harvestWeek !== null || garden.produce !== 0 || garden.delivered !== 0)) return false;
  if (garden.plantedWeek !== null && !garden.suppliesBought) return false;
  if (garden.caredWeek !== null && (garden.plantedWeek === null || (garden.caredWeek as number) <= (garden.plantedWeek as number))) return false;
  if (garden.harvestWeek !== null && (garden.plantedWeek === null || garden.caredWeek === null || (garden.harvestWeek as number) < (garden.plantedWeek as number) + 2 || (garden.harvestWeek as number) < (garden.caredWeek as number))) return false;
  if (garden.harvestWeek === null && (garden.produce !== 0 || garden.delivered !== 0)) return false;
  const cultivator = raw as unknown as CultivatorState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'mother' && !isPromoted) return false;
  if (isPromoted) {
    if (!cultivator.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...CULTIVATOR_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?PHYSICIAN_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?HARVESTPRIEST_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?BIOLOGIST_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?DRUID_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?ANCIENT_ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?COFFIN_BEARER_ABILITY_IDS:[]),...(s.progression.sequence===2?BARREN_MATRIARCH_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (cultivator.garden.suppliesBought || CULTIVATOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || cultivator.reflected
    || Object.values(cultivator.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.outcome !== 'NONE' || caseState.contactOpen || caseState.closes !== 0)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of cultivator.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `cultivator-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 5;
    if (index < CULTIVATOR_BOTTLE_IDS.length) {
      if (bottle.source !== CULTIVATOR_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!cultivator.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / CULTIVATOR_BOTTLE_IDS.length) - 1;
      if (index % CULTIVATOR_BOTTLE_IDS.length === 0) {
        const previous = cultivator.bottles.slice(index - CULTIVATOR_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!cultivator.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (cultivator.resupply.requestedWeek !== null && (!cultivator.guidanceKnown || !supplyExhausted(cultivator) || cultivator.bottles.some(bottle => bottle.consumedWeek! > cultivator.resupply.requestedWeek!) || s.progression.promotionWeek !== null && cultivator.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { CULTIVATOR_ABILITIES } from './content.js';
export { CULTIVATOR_CASE_IDS } from './types.js';
export type { CultivatorActivityCommand, CultivatorAction, CultivatorProjection } from './types.js';
