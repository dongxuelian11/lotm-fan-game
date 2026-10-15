import {PLANESWALKER_ABILITY_IDS} from '../planeswalker/types.js';
import {WANDERER_ABILITY_IDS} from '../wanderer/types.js';
import {SECRETS_SORCERER_ABILITY_IDS} from '../secrets-sorcerer/types.js';
import {TRAVELER_ABILITY_IDS} from '../traveler/types.js';
import {RECORDER_ABILITY_IDS} from '../recorder/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APPRENTICE_ABILITY_IDS } from '../apprentice/types.js';
import { TRICKMASTER_ABILITY_IDS } from '../trickmaster/types.js';
import {
  ASTROLOGER_ABILITIES, ASTROLOGER_BOTTLE_IDS, ASTROLOGER_CONSUMPTION_RISK, ASTROLOGER_FORMULA_STATUS,
  ASTROLOGER_GUIDE, ASTROLOGER_LABOUR_TASKS, ASTROLOGER_MIN_TRICKMASTER_WEEKS, ASTROLOGER_POTION_SOURCES, ASTROLOGER_PRICES, ASTROLOGER_SOURCE_STATUS,
} from './content.js';
import {
  ASTROLOGER_ABILITY_IDS, ASTROLOGER_CASE_IDS, type AstrologerAcquisitionCommand, type AstrologerAction,
  type AstrologerBottle, type AstrologerCommand, type AstrologerProjection, type AstrologerState,
} from './types.js';

export function createAstrologerState(): AstrologerState {
  return {
    guidanceKnown: false,
    bottles: ASTROLOGER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, trickmasterActingAtPromotion: null,
    cases: Object.fromEntries(ASTROLOGER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' }])),
    reflected: false, probe: { spirituality: 6, roll: null, chance: null, tier: null, interferenceApplied: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'door' && (s.progression.sequence === 7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isTrickmaster = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.apprentice.discovered && s.apprentice.guidanceKnown && s.trickmaster.formulaKnown && (isTrickmaster(s) || promoted(s));
const potionPrice = (bottle: AstrologerBottle) => ASTROLOGER_PRICES.potion - (bottle.labourSteps === 4 ? ASTROLOGER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: AstrologerBottle) => Number(bottle.id.slice('astrologer-potion-'.length));
const trickmasterWeeks = (s: SliceState) => Math.max(0, (s.astrologer.promotionWeek ?? s.week) - (s.trickmaster.promotionWeek ?? s.week));
const supplyExhausted = (state: AstrologerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ASTROLOGER_GUIDE}的新观测器具档案交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7占星人魔药，原瓶astrologer-potion-${number}，非学徒或戏法大师旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: AstrologerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (Object.values(s.apprentice.cases).some(scene => scene.position === 'INSIDE')) return '你仍在原门内，先沿已打开的原门返回，再办理占星人准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的档案工作间收货处，找到诺拉·维恩。';
  if (!knownChannel(s)) return '成为戏法大师并保有诺拉·维恩的指导渠道后，才能继续占星人之路。';
  if (promoted(s)) return '你已完成占星人晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.astrologer.guidanceKnown) return '已经听过占星人成品魔药的用药说明。';
    return s.cash < ASTROLOGER_PRICES.guidance ? '占星人用药指导需要240便士。' : null;
  }
  if (!s.astrologer.guidanceKnown) return '先听诺拉·维恩说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.astrologer.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.astrologer) ? null : '须先用完现有全部占星人原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.astrologer.resupply.requestedWeek === null) return '尚未申请下一批占星人补给。';
    if (s.week <= s.astrologer.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.astrologer) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.astrologer.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选占星人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `戏法大师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.trickmaster.promotionWeek === null || trickmasterWeeks(s) < ASTROLOGER_MIN_TRICKMASTER_WEEKS) return `成为戏法大师后已度过${trickmasterWeeks(s)}/${ASTROLOGER_MIN_TRICKMASTER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次档案工作间收货处劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyAstrologerCommand(s: SliceState, command: AstrologerAcquisitionCommand, c: SeerContext): void {
  rule(validateAstrologerCommand(command) && isAstrologerAcquisitionCommand(command), '占星人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ASTROLOGER_PRICES.guidance;
      s.astrologer.guidanceKnown = true;
      c.note('听取占星人用药说明', `花费1行动、240便士，${ASTROLOGER_GUIDE}向你说明从新观测器具档案交接渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的戏法大师存药。${ASTROLOGER_FORMULA_STATUS}戏法大师消化须达100，晋升戏法大师后满8整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.astrologer.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = ASTROLOGER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在诺拉·维恩的档案工作间收货处实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.astrologer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('占星人原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次档案工作间收货处劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；戏法大师消化100且晋升戏法大师后满8整周时，再独立确认服药。${ASTROLOGER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.astrologer.resupply.requestedWeek = s.week;
      c.note('申请下一批占星人魔药', `现有占星人原瓶全部耗尽且未晋升。你花费1行动，请${ASTROLOGER_GUIDE}从同一新渠道订下一批三瓶，并实际核验档案工作间收货处的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.astrologer.bottles.length + 1;
      s.astrologer.resupply.deliveries += 1;
      for (let offset = 0; offset < ASTROLOGER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.astrologer.bottles.push({ id: `astrologer-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.astrologer.resupply.requestedWeek = null;
      c.note('下一批占星人原瓶到货', `第${s.week}周，诺拉·维恩的新观测器具档案交接渠道本作G成品供给第${s.astrologer.resupply.deliveries + 1}批三瓶实际到货，原瓶astrologer-potion-${firstNumber}至astrologer-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.astrologer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.astrologer.trickmasterActingAtPromotion = s.progression.acting;
        s.astrologer.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of ASTROLOGER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 3], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为占星人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+3、意志+2、知识+1。学徒开门与戏法大师有限戏法两项能力及掌握完整继承，有限占星与占卜干扰两项G掌握从0开始；戏法大师消化成果和晋升周保留，占星人扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了占星人晋升' : '占星人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是戏法大师，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectAstrologer(s: SliceState): AstrologerProjection {
  const actions: AstrologerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: AstrologerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.astrologer.guidanceKnown) add('learn-astrologer-guidance', '请诺拉·维恩说明占星人成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.astrologer.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${ASTROLOGER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶占星人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.astrologer.resupply.requestedWeek !== null) add('receive-astrologer-supply', '确认下一批三瓶占星人到货', `0行动 · 第${s.astrologer.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.astrologer)) add('request-astrologer-supply', '向诺拉·维恩订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.astrologer.guidanceKnown) {
    for (const bottle of s.astrologer.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶占星人魔药`, `0行动 · 独立确认 · 戏法大师消化${isPromoted ? s.astrologer.trickmasterActingAtPromotion : s.progression.acting}/100 · 晋升后${trickmasterWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.astrologer.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.astrologer.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '占星人 · 序列7' : '占星人之路', discovered: available,
    guidanceKnown: available && s.astrologer.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '',
    ...(available ? { story: ASTROLOGER_SOURCE_STATUS } : {}),
    supplies: available ? `${ASTROLOGER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.astrologer.resupply.requestedWeek === null ? `已实际接收后续供给${s.astrologer.resupply.deliveries}批。` : `第${s.astrologer.resupply.requestedWeek}周提出请求，第${s.astrologer.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.astrologer.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 占星人魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? ASTROLOGER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.recorder.astrologerActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?'占星人魔药已消化，原画像、短路核实和自愿对照记录保留。':isPromoted ? `戏法大师消化成果${s.astrologer.trickmasterActingAtPromotion}/100已保留；占星人扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成戏法大师消化（${s.progression.acting}/100），并在晋升戏法大师后度过8整周（${trickmasterWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完戏法大师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${ASTROLOGER_CONSUMPTION_RISK}` : '成为戏法大师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isAstrologerAcquisitionCommand(command: unknown): command is AstrologerAcquisitionCommand {
  return validateAstrologerCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateAstrologerCommand(value: unknown): value is AstrologerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^astrologer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^astrologer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && ASTROLOGER_CASE_IDS.includes(value.caseId as typeof ASTROLOGER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && ASTROLOGER_CASE_IDS.includes(value.caseId as typeof ASTROLOGER_CASE_IDS[number]) && ['STAR', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, probe resolution and evidence. */
export function validateAstrologerState(s: SliceState): boolean {
  const raw: unknown = s.astrologer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'trickmasterActingAtPromotion', 'cases', 'reflected', 'probe']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.probe) || !shape(raw.probe, ['spirituality', 'roll', 'chance', 'tier', 'interferenceApplied'])) return false;
  if (!integer(raw.probe.spirituality, 0, 6) || typeof raw.probe.interferenceApplied !== 'boolean') return false;
  if (raw.probe.roll !== null && !integer(raw.probe.roll, 1, 100)) return false;
  if (raw.probe.chance !== null && !integer(raw.probe.chance, 0, 100)) return false;
  if (raw.probe.tier !== null && !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(raw.probe.tier as string)) return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.apprentice) || !record(s.trickmaster)) return false;
  const firstTrickmasterWeek = s.trickmaster.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstTrickmasterWeek + ASTROLOGER_MIN_TRICKMASTER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ASTROLOGER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, ASTROLOGER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['STAR', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'CORRELATED', 'CAUTIOUS', 'TESTED'].includes(value.outcome as string)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const astrologer = raw as unknown as AstrologerState, isPromoted = promoted(s);
  if (astrologer.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!astrologer.guidanceKnown || !integer(s.trickmaster.promotionWeek, 1, s.week) || !integer(astrologer.promotionWeek, firstConsumptionWeek, s.week) || astrologer.trickmasterActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS, ...ASTROLOGER_ABILITY_IDS,...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?RECORDER_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?TRAVELER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?SECRETS_SORCERER_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?WANDERER_ABILITY_IDS:[]),...(s.progression.sequence===2?PLANESWALKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (astrologer.promotionWeek !== null || astrologer.trickmasterActingAtPromotion !== null || ASTROLOGER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (astrologer.reflected || astrologer.probe.spirituality !== 6 || astrologer.probe.roll !== null || astrologer.probe.chance !== null || astrologer.probe.tier !== null || astrologer.probe.interferenceApplied || Object.values(astrologer.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of astrologer.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `astrologer-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of astrologer.bottles.entries()) {
    let stockWeek = firstTrickmasterWeek;
    if (index < ASTROLOGER_BOTTLE_IDS.length) {
      if (bottle.source !== ASTROLOGER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!astrologer.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ASTROLOGER_BOTTLE_IDS.length) - 1;
      if (index % ASTROLOGER_BOTTLE_IDS.length === 0) {
        const previous = astrologer.bottles.slice(index - ASTROLOGER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > astrologer.promotionWeek!) return false;
    }
    if (!astrologer.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > astrologer.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > astrologer.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== astrologer.promotionWeek) return false;
    }
  }
  if (astrologer.resupply.requestedWeek !== null && (!astrologer.guidanceKnown || isPromoted || !supplyExhausted(astrologer) || astrologer.bottles.some(bottle => bottle.consumedWeek! > astrologer.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { ASTROLOGER_ABILITIES } from './content.js';
export type * from './types.js';
