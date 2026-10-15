import { ENTROPY_DUKE_ABILITY_IDS } from '../entropy-duke/types.js';
import {FRENZY_MAGE_ABILITY_IDS} from '../frenzy-mage/types.js';
import {FALLEN_EARL_ABILITY_IDS} from '../fallen-earl/types.js';
import {MENTOR_DISORDER_ABILITY_IDS} from '../mentor-disorder/types.js';
import {CORRUPTION_BARON_ABILITY_IDS} from '../corruption-baron/types.js';
import {BRIBER_ABILITY_IDS} from '../briber/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { LAWYER_ABILITY_IDS } from '../lawyer/types.js';
import {
  BARBARIAN_ABILITIES, BARBARIAN_BATCH_IDS, BARBARIAN_CONSUMPTION_RISK, BARBARIAN_FORMULA,
  BARBARIAN_FORMULA_SOURCE, BARBARIAN_GUIDE, BARBARIAN_MIN_LAWYER_WEEKS, BARBARIAN_PRICES, BARBARIAN_LABOUR_STEPS,
  BARBARIAN_LABOUR_TASKS, BARBARIAN_SOURCE_STATUS,
} from './content.js';
import {
  BARBARIAN_ABILITY_IDS, BARBARIAN_CASE_IDS, type BarbarianCommand, type BarbarianAcquisitionCommand, type BarbarianAction, type BarbarianBatch,
  type BarbarianProjection, type BarbarianState,
} from './types.js';

function createBatch(number: number): BarbarianBatch {
  const id = `barbarian-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: BARBARIAN_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.supplyQuantity, unit: material.unit,
      source: `契约铺备料间野蛮人备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createBarbarianState(): BarbarianState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: BARBARIAN_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, lawyerActingAtPromotion: null,
    cases: Object.fromEntries(BARBARIAN_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const isLawyer = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.lawyer.discovered && s.lawyer.guidanceKnown && (isLawyer(s) || promoted(s));
const materialPrice = (batch: BarbarianBatch) => BARBARIAN_PRICES.auxiliaryMaterials + (batch.labourSteps === BARBARIAN_LABOUR_STEPS ? 0 : BARBARIAN_PRICES.mainMaterials);
const bottleId = (batch: BarbarianBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<BarbarianBatch, 'id'>) => Number(batch.id.slice('barbarian-batch-'.length));
const lawyerWeeks = (s: SliceState) => Math.max(0, (s.barbarian.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const failedBatch = (barbarian: BarbarianState, batch: BarbarianBatch) => batch.brewed && barbarian.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (barbarian: BarbarianState) => barbarian.batches.length >= 3 && barbarian.bottles.length === barbarian.batches.length && barbarian.batches.every(batch => failedBatch(barbarian, batch));

function commandBlock(s: SliceState, command: BarbarianAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (Object.values(s.lawyer.cases).some(scene => scene.contactOpen)) return '先实际结束律师阶段尚未结束的交涉，再办理野蛮人准备。';
  if (Object.values(s.barbarian.cases).some(scene => scene.contactOpen)) return '先实际结束本次野蛮人实践的接触，再继续。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的契约铺备料间。';
  if (!knownChannel(s)) return '成为律师并保有指导者渠道后，才能继续野蛮人之路。';
  if (promoted(s)) return '你已完成野蛮人晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.barbarian.formulaKnown) return '已经掌握野蛮人配方。';
    return s.cash < BARBARIAN_PRICES.formula ? '野蛮人配方指导需要180便士。' : null;
  }
  if (!s.barbarian.formulaKnown) return '先完成野蛮人配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.barbarian.resupply.requestedWeek !== null) return '已经向指导者申请下一轮野蛮人材料，请等到下一个真实周。';
    return exhaustedSupply(s.barbarian) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.barbarian.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮野蛮人材料并完成备料准备。';
    if (!exhaustedSupply(s.barbarian)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.barbarian.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选野蛮人原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `律师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || lawyerWeeks(s) < BARBARIAN_MIN_LAWYER_WEEKS) return `成为律师后已度过${lawyerWeeks(s)}/${BARBARIAN_MIN_LAWYER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.barbarian.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批野蛮人材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= BARBARIAN_LABOUR_STEPS ? '这批三次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成野蛮人原瓶。';
  if (batch.materials.length !== BARBARIAN_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = BARBARIAN_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `契约铺备料间野蛮人备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.supplyQuantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < BARBARIAN_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyBarbarianCommand(s: SliceState, command: BarbarianAcquisitionCommand, c: SeerContext): void {
  rule(validateBarbarianAcquisitionCommand(command), '野蛮人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= BARBARIAN_PRICES.formula;
      s.barbarian.formulaKnown = true;
      c.note('记下野蛮人配方', `花费1行动、180便士，向同一位${BARBARIAN_GUIDE}学习六项材料。六项材料已核；实心独角结晶原著未给数量，本作供货按1份；逐项投料顺序未获原著核定，本次按导师的本作G批次操作规程调配。${BARBARIAN_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.barbarian.resupply.requestedWeek = s.week;
      c.note('申请下一轮野蛮人材料', `花费1行动，向原${BARBARIAN_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批三次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.barbarian.batches.length + 1;
      s.barbarian.batches.push(...BARBARIAN_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.barbarian.resupply.deliveries += 1;
      s.barbarian.resupply.requestedWeek = null;
      c.note('野蛮人新一轮备料到货', `原${BARBARIAN_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成三次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.barbarian.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${BARBARIAN_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/3。${batch.labourSteps === BARBARIAN_LABOUR_STEPS ? '三次劳动抵本批1050便士主材费；仍须支付100便士辅材费，才会交付整批材料。' : '完成全部三次才能抵本批1050便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.barbarian.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('野蛮人材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === BARBARIAN_LABOUR_STEPS ? '三次劳动已抵本批主材费，仅支付100便士辅材费。' : '主材1050便士、辅材100便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.barbarian.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= BARBARIAN_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.barbarian.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶野蛮人魔药', `花费1行动、60便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。六项材料有原著依据，实心独角结晶的1份是本作G供货计量、非原著精确数量；具体操作次序采用本作G导师规程，不把该次序称作原著事实。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。律师扮演100且晋升后满4整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.barbarian.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.barbarian.lawyerActingAtPromotion = s.progression.acting;
        s.barbarian.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of BARBARIAN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 3], ['perception', 0], ['will', 2], ['knowledge', 0]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为野蛮人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+3、意志+2，感知与知识不变。律师的三项原能力掌握完整继承，野蛮人的非凡体能与精神抗性分别从0开始；律师消化成果保留，野蛮人扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了野蛮人晋升' : '野蛮人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是律师，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectBarbarian(s: SliceState): BarbarianProjection {
  const actions: BarbarianAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: BarbarianAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.barbarian.formulaKnown) add('learn-barbarian-formula', '请指导者讲解野蛮人配方', '1行动 · 180便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.barbarian.resupply.requestedWeek !== null) {
        add('receive-barbarian-supply', '确认下一轮三批野蛮人材料到货', `0行动 · 最早第${s.barbarian.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.barbarian)) {
        add('request-barbarian-supply', '向原指导者申请下一轮野蛮人材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.barbarian.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < BARBARIAN_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${BARBARIAN_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/3，完成三次抵1050便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === BARBARIAN_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材1050＋辅材100）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配野蛮人魔药`, '1行动 · 60便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.barbarian.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批野蛮人原瓶`, `0行动 · 独立确认 · 律师扮演${s.progression.acting}/100 · 晋升后${lawyerWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.barbarian.batches.filter(batch => !batch.acquired).length;
  const prepared = s.barbarian.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '野蛮人 · 序列8' : '野蛮人之路', discovered: available,
    formulaKnown: available && s.barbarian.formulaKnown, promoted: isPromoted,
    formula: available && s.barbarian.formulaKnown ? BARBARIAN_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.quantity === null ? '' : material.unit, ...('note' in material ? { note: material.note } : {}) })) : [],
    actions,
    bottles: available ? s.barbarian.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 野蛮人魔药`,
      source: `${BARBARIAN_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? BARBARIAN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? (s.progression.sequence===8?s.progression.acting:s.briber.barbarianActingAtPromotion??0) : 0,
    digestion: isPromoted ? `律师消化成果${s.barbarian.lawyerActingAtPromotion}/100已保留；野蛮人扮演${s.progression.sequence===8?s.progression.acting:s.briber.barbarianActingAtPromotion??0}/100，能力掌握分别记录。`
      : available ? `服药前需完成律师消化（${s.progression.acting}/100），并在律师晋升后度过4整周（${lawyerWeeks(s)}/4）。配方与材料可以提前准备。` : '先走完律师之路。',
    pollution: s.seer.pollution,
    cases: [], insideCase: available && Object.values(s.barbarian.cases).some(scene => scene.contactOpen), environment: '',
    ...(available ? { story: `${BARBARIAN_FORMULA_SOURCE}${BARBARIAN_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。实心独角结晶按本作G每批1份供货，原著未给明确数量或重量。${s.barbarian.resupply.requestedWeek === null ? `已实际接收后续材料${s.barbarian.resupply.deliveries}轮，每轮3批。` : `第${s.barbarian.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或三次劳动后领取材料 → 调配 → 独立确认服药。野蛮人材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${BARBARIAN_CONSUMPTION_RISK}` : '成为律师后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validateBarbarianAcquisitionCommand(value: unknown): value is BarbarianAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^barbarian-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^barbarian-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}

export function isBarbarianAcquisitionCommand(command: BarbarianCommand): command is BarbarianAcquisitionCommand {
  return validateBarbarianAcquisitionCommand(command);
}

/** Reject unknown case IDs, methods and extra fields at both intent entry points. */
export function validateBarbarianCommand(value: unknown): value is BarbarianCommand {
  if (validateBarbarianAcquisitionCommand(value)) return true;
  if (!record(value)) return false;
  if (value.type === 'REFLECT') return shape(value, ['type']);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && BARBARIAN_CASE_IDS.includes(value.caseId as typeof BARBARIAN_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && BARBARIAN_CASE_IDS.includes(value.caseId as typeof BARBARIAN_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns physical materials, bottle lineage, promotion and stock conservation.
 * Life owns exact case transitions, actual closure and evidence for each bounded practice. */
export function validateBarbarianState(s: SliceState): boolean {
  const raw: unknown = s.barbarian;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'lawyerActingAtPromotion', 'cases', 'reflected']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.lawyer)) return false;
  const firstConsumptionWeek = (s.progression.promotionWeek ?? s.week) + BARBARIAN_MIN_LAWYER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== BARBARIAN_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.cases) || !shape(raw.cases, BARBARIAN_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'CART_SECURED', 'BOX_PLACED', 'PRESSURE_ENDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const barbarian = raw as unknown as BarbarianState, isPromoted = promoted(s);
  if (barbarian.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!barbarian.formulaKnown || !integer(s.progression.promotionWeek, 1, s.week) || !integer(barbarian.promotionWeek, firstConsumptionWeek, s.week) || barbarian.lawyerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?BRIBER_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?CORRUPTION_BARON_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?MENTOR_DISORDER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?FALLEN_EARL_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?FRENZY_MAGE_ABILITY_IDS:[]),...(s.progression.sequence===2?ENTROPY_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (barbarian.promotionWeek !== null || barbarian.lawyerActingAtPromotion !== null || BARBARIAN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (barbarian.reflected || Object.values(barbarian.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Validate every record before following cross-references, including hostile save input.
  for (const [index, batch] of barbarian.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `barbarian-batch-${index + 1}` || !integer(batch.labourSteps, 0, BARBARIAN_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== BARBARIAN_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !barbarian.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = BARBARIAN_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `契约铺备料间野蛮人备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.supplyQuantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of barbarian.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.progression.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of barbarian.batches) if (barbarian.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of barbarian.bottles) {
    if (isPromoted && bottle.brewedWeek > barbarian.promotionWeek!) return false;
    const batch = barbarian.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== BARBARIAN_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.progression.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (barbarian.promotionWeek === null || bottle.brewedWeek > barbarian.promotionWeek) return false;
    }
  }
  if (!barbarian.batches.slice(0, deliveries * 3).every(batch => failedBatch(barbarian, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(barbarian.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = barbarian.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (barbarian.resupply.requestedWeek !== null && (!barbarian.formulaKnown || isPromoted || !exhaustedSupply(barbarian) || barbarian.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...barbarian.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}

export type * from './types.js';
