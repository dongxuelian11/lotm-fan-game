import { LIFE_GIVER_ABILITY_IDS } from '../life-giver/types.js';
import {SUMMONING_MASTER_ABILITY_IDS} from '../summoning-master/types.js';
import {WITCH_KING_ABILITY_IDS} from '../witch-king/types.js';
import {CRIMSON_SCHOLAR_ABILITY_IDS} from '../crimson-scholar/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APOTHECARY_ABILITY_IDS } from '../apothecary/types.js';
import { TAMER_ABILITY_IDS } from '../tamer/types.js';
import { validatePotionProfessorLife } from './life.js';
import { VAMPIRE_ABILITY_IDS } from '../vampire/types.js';
import {
  POTION_PROFESSOR_ABILITIES, POTION_PROFESSOR_BOTTLE_IDS, POTION_PROFESSOR_CONSUMPTION_RISK, POTION_PROFESSOR_FORMULA_STATUS,
  POTION_PROFESSOR_ASSISTANCE, POTION_PROFESSOR_GUIDE, POTION_PROFESSOR_LABOUR_TASKS, POTION_PROFESSOR_MIN_VAMPIRE_WEEKS, POTION_PROFESSOR_POTION_SOURCES, POTION_PROFESSOR_PRICES, POTION_PROFESSOR_SOURCE_STATUS,
} from './content.js';
import {
  POTION_PROFESSOR_ABILITY_IDS, POTION_PROFESSOR_ASSISTANCE_KINDS, POTION_PROFESSOR_CASE_IDS, type PotionProfessorAcquisitionCommand, type PotionProfessorAction,
  type PotionProfessorBottle, type PotionProfessorCommand, type PotionProfessorProjection, type PotionProfessorState,
} from './types.js';

export function createPotionProfessorState(): PotionProfessorState {
  return {
    guidanceKnown: false,
    bottles: POTION_PROFESSOR_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, vampireActingAtPromotion: null,
    cases: Object.fromEntries(POTION_PROFESSOR_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    laboratory: { kitsBought: 0, kitStock: 3, restockAfterWeek: null, materials: 0, brewAttempts: 0, brewFailures: 0, potions: [], effects: { quietStep: false, odorVeil: false, bodyVeil: false, clothVeil: false } },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'moon' && (s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0)));
const isVampire = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.apothecary.discovered && s.apothecary.guidanceKnown && s.tamer.guidanceKnown && s.vampire.guidanceKnown && s.vampire.promotionWeek !== null && (isVampire(s) || promoted(s));
const potionPrice = (bottle: PotionProfessorBottle) => POTION_PROFESSOR_PRICES.potion - (bottle.labourSteps === 5 ? POTION_PROFESSOR_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PotionProfessorBottle) => Number(bottle.id.slice('potion-professor-potion-'.length));
const vampireWeeks = (s: SliceState) => Math.max(0, (s.potionProfessor.promotionWeek ?? s.week) - (s.vampire.promotionWeek ?? s.week));
const supplyExhausted = (state: PotionProfessorState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${POTION_PROFESSOR_GUIDE}的独立魔药教授成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6魔药教授魔药，原瓶potion-professor-potion-${number}，非药师、驯兽师或吸血鬼旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: PotionProfessorAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.potionProfessor.cases).some(value => value.contactOpen)) return '先实际结束本次魔药教授实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原夜间药房，找到艾琳。';
  if (!knownChannel(s)) return '成为吸血鬼并保有艾琳的指导渠道后，才能继续了解魔药教授之路。';
  if (s.tamer.companionId !== null) return '先让当前同行动物安全回到原主人处，再进行这次晋升准备。';
  if (promoted(s)) return '你已完成魔药教授晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.potionProfessor.guidanceKnown) return '已经听过魔药教授成品魔药的用药说明。';
    return s.cash < POTION_PROFESSOR_PRICES.guidance ? '魔药教授用药指导需要360便士。' : null;
  }
  if (!s.potionProfessor.guidanceKnown) return '先听艾琳说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.potionProfessor.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.potionProfessor) ? null : '须先用完现有全部魔药教授原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.potionProfessor.resupply.requestedWeek === null) return '尚未申请下一批魔药教授补给。';
    if (s.week <= s.potionProfessor.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.potionProfessor) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.potionProfessor.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选魔药教授原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `吸血鬼魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.vampire.promotionWeek === null || vampireWeeks(s) < POTION_PROFESSOR_MIN_VAMPIRE_WEEKS) return `成为吸血鬼后已度过${vampireWeeks(s)}/${POTION_PROFESSOR_MIN_VAMPIRE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原夜间药房劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyPotionProfessorCommand(s: SliceState, command: PotionProfessorAcquisitionCommand, c: SeerContext): void {
  rule(validatePotionProfessorCommand(command) && isPotionProfessorAcquisitionCommand(command), '魔药教授准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= POTION_PROFESSOR_PRICES.guidance;
      s.potionProfessor.guidanceKnown = true;
      c.note('听取魔药教授用药说明', `花费1行动、360便士，你向已认识的本作原创成年${POTION_PROFESSOR_GUIDE}继续请教，他向你说明从独立魔药教授成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的药师、驯兽师或吸血鬼存药。${POTION_PROFESSOR_FORMULA_STATUS}吸血鬼消化须达100，晋升吸血鬼后满12整周才能服用；可提前筹备。${POTION_PROFESSOR_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.potionProfessor.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = POTION_PROFESSOR_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在艾琳的原夜间药房实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.potionProfessor.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('魔药教授原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原夜间药房劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；吸血鬼消化100且晋升吸血鬼后满12整周时，再独立确认服药。${POTION_PROFESSOR_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.potionProfessor.resupply.requestedWeek = s.week;
      c.note('申请下一批魔药教授魔药', `现有魔药教授原瓶全部耗尽且未晋升。你花费1行动，请${POTION_PROFESSOR_GUIDE}从同一新渠道订下一批三瓶，并实际核验原夜间药房的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.potionProfessor.bottles.length + 1;
      s.potionProfessor.resupply.deliveries += 1;
      for (let offset = 0; offset < POTION_PROFESSOR_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.potionProfessor.bottles.push({ id: `potion-professor-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.potionProfessor.resupply.requestedWeek = null;
      c.note('下一批魔药教授原瓶到货', `第${s.week}周，艾琳的独立魔药教授成品交接渠道本作G成品供给第${s.potionProfessor.resupply.deliveries + 1}批三瓶实际到货，原瓶potion-professor-potion-${firstNumber}至potion-professor-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.potionProfessor.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.potionProfessor.vampireActingAtPromotion = s.progression.acting;
        s.potionProfessor.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of POTION_PROFESSOR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为魔药教授', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。药师、驯兽师与吸血鬼全部原能力及原ID掌握完整继承，新增有限辅助药剂与药剂研究教学，两项均从0掌握开始；吸血鬼消化成果与吸血鬼晋升周保留，魔药教授扮演从0开始。灵性上限提高到80，当前灵性没有补满。药剂须按已知G教学卡以真实灵性材料事先配好，成功才有独立原瓶；身体透明不会隐去普通衣物和气味，仍须分别准备。原血食与体能规则完整保留；没有获得序列5满月场域、月光闪现或重组。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了魔药教授晋升' : '魔药教授魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是吸血鬼，消化与全部原有掌握保留，没有获得魔药教授能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectPotionProfessor(s: SliceState): PotionProfessorProjection {
  const actions: PotionProfessorAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0)))?s.crimsonScholar.potionProfessorActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: PotionProfessorAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.potionProfessor.guidanceKnown) add('learn-potion-professor-guidance', '请艾琳说明魔药教授成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.potionProfessor.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${POTION_PROFESSOR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶魔药教授魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.potionProfessor.resupply.requestedWeek !== null) add('receive-potion-professor-supply', '确认下一批三瓶魔药教授到货', `0行动 · 第${s.potionProfessor.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.potionProfessor)) add('request-potion-professor-supply', '向艾琳订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.potionProfessor.guidanceKnown) {
    for (const bottle of s.potionProfessor.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶魔药教授魔药`, `0行动 · 独立确认 · 吸血鬼消化${isPromoted ? s.potionProfessor.vampireActingAtPromotion : s.progression.acting}/100 · 晋升后${vampireWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.potionProfessor.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.potionProfessor.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '魔药教授 · 序列6' : '魔药教授之路', discovered: available,
    guidanceKnown: available && s.potionProfessor.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    laboratory: isPromoted ? {
      summary: `原夜间药房G封闭教学：已购买${s.potionProfessor.laboratory.kitsBought}包材料，调配${s.potionProfessor.laboratory.brewAttempts}次、失败${s.potionProfessor.laboratory.brewFailures}次。${s.potionProfessor.laboratory.kitStock === 0 ? `本批三包已售尽，第${s.potionProfessor.laboratory.restockAfterWeek! + 1}周起才能实际补进下一批。` : `本批剩余${s.potionProfessor.laboratory.kitStock}包。`}四种辅助药分别预配；有限短效只在本阶段原室核验，结束后才可离开。`,
      materials: `持有明确标为原创G的封装低强灵性材料${s.potionProfessor.laboratory.materials}份。每包100便士含4份；每次调配耗1行动、2灵性与1份材料，失败照耗，不输出真实材料或操作配方。`,
      potions: s.potionProfessor.laboratory.potions.map(p => ({ ...p, title: POTION_PROFESSOR_ASSISTANCE[p.kind].title, status: p.status === 'PLAYER' ? '玩家持有 · 未用独立原瓶' : '原瓶已用尽 · 不复原' })),
      effects: { ...s.potionProfessor.laboratory.effects },
    } : { summary: '', materials: '', potions: [], effects: { quietStep: false, odorVeil: false, bodyVeil: false, clothVeil: false } },
    cases: [], environment: '', insideCase: Object.values(s.potionProfessor.cases).some(value => value.contactOpen),
    ...(available ? { story: POTION_PROFESSOR_SOURCE_STATUS } : {}),
    supplies: available ? `${POTION_PROFESSOR_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.potionProfessor.resupply.requestedWeek === null ? `已实际接收后续供给${s.potionProfessor.resupply.deliveries}批。` : `第${s.potionProfessor.resupply.requestedWeek}周提出请求，第${s.potionProfessor.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.potionProfessor.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 魔药教授魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? POTION_PROFESSOR_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: (s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0)))?'魔药教授魔药已消化；原药剂、材料、本人教学与实际用药记录保留。':isPromoted ? `吸血鬼消化成果${s.potionProfessor.vampireActingAtPromotion}/100已保留；魔药教授扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成吸血鬼消化（${s.progression.acting}/100），并在晋升吸血鬼后度过12整周（${vampireWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完吸血鬼之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${POTION_PROFESSOR_CONSUMPTION_RISK}` : '成为吸血鬼后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isPotionProfessorAcquisitionCommand(command: unknown): command is PotionProfessorAcquisitionCommand {
  return validatePotionProfessorCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validatePotionProfessorCommand(value: unknown): value is PotionProfessorCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'BUY_KIT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (value.type === 'BREW_ASSISTANCE') return shape(value, ['type', 'kind']) && POTION_PROFESSOR_ASSISTANCE_KINDS.includes(value.kind as typeof POTION_PROFESSOR_ASSISTANCE_KINDS[number]);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^potion-professor-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^potion-professor-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && POTION_PROFESSOR_CASE_IDS.includes(value.caseId as typeof POTION_PROFESSOR_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && POTION_PROFESSOR_CASE_IDS.includes(value.caseId as typeof POTION_PROFESSOR_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validatePotionProfessorState(s: SliceState): boolean {
  const raw: unknown = s.potionProfessor;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'vampireActingAtPromotion', 'cases', 'laboratory', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.apothecary) || !record(s.tamer) || !record(s.vampire)) return false;
  const firstVampireWeek = s.vampire.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstVampireWeek + POTION_PROFESSOR_MIN_VAMPIRE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== POTION_PROFESSOR_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, POTION_PROFESSOR_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'QUIET_STEP_VERIFIED', 'SIGNALS_VERIFIED', 'LESSON_VERIFIED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const potionProfessor = raw as unknown as PotionProfessorState, isPromoted = promoted(s);
  if (potionProfessor.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!potionProfessor.guidanceKnown || !integer(s.vampire.promotionWeek, 1, s.week) || !integer(potionProfessor.promotionWeek, firstConsumptionWeek, s.week) || potionProfessor.vampireActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS,...((s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0)))?CRIMSON_SCHOLAR_ABILITY_IDS:[]),...(([4, 3, 2].includes(s.progression.sequence ?? 0))?WITCH_KING_ABILITY_IDS:[]),...([3, 2].includes(s.progression.sequence ?? 0) ? SUMMONING_MASTER_ABILITY_IDS : []),...(s.progression.sequence === 2 ? LIFE_GIVER_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (potionProfessor.promotionWeek !== null || potionProfessor.vampireActingAtPromotion !== null || POTION_PROFESSOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (potionProfessor.reflected || Object.values(potionProfessor.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of potionProfessor.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `potion-professor-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of potionProfessor.bottles.entries()) {
    let stockWeek = firstVampireWeek;
    if (index < POTION_PROFESSOR_BOTTLE_IDS.length) {
      if (bottle.source !== POTION_PROFESSOR_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!potionProfessor.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / POTION_PROFESSOR_BOTTLE_IDS.length) - 1;
      if (index % POTION_PROFESSOR_BOTTLE_IDS.length === 0) {
        const previous = potionProfessor.bottles.slice(index - POTION_PROFESSOR_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > potionProfessor.promotionWeek!) return false;
    }
    if (!potionProfessor.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > potionProfessor.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > potionProfessor.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== potionProfessor.promotionWeek) return false;
    }
  }
  if (potionProfessor.resupply.requestedWeek !== null && (!potionProfessor.guidanceKnown || isPromoted || !supplyExhausted(potionProfessor) || potionProfessor.bottles.some(bottle => bottle.consumedWeek! > potionProfessor.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = potionProfessor.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, potionProfessor.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'POTION_PROFESSOR_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(potionProfessor.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && Object.values(potionProfessor.cases).some(r => r.contactOpen)) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'potion-professor-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validatePotionProfessorLife(s);
}

export { POTION_PROFESSOR_ABILITIES } from './content.js';
export type * from './types.js';
