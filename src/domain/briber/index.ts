import {FRENZY_MAGE_ABILITY_IDS} from '../frenzy-mage/types.js';
import {FALLEN_EARL_ABILITY_IDS} from '../fallen-earl/types.js';
import {MENTOR_DISORDER_ABILITY_IDS} from '../mentor-disorder/types.js';
import {CORRUPTION_BARON_ABILITY_IDS} from '../corruption-baron/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { LAWYER_ABILITY_IDS } from '../lawyer/types.js';
import { BARBARIAN_ABILITY_IDS } from '../barbarian/types.js';
import {
  BRIBER_ABILITIES, BRIBER_BATCH_IDS, BRIBER_CONSUMPTION_RISK, BRIBER_FORMULA,
  BRIBER_FORMULA_SOURCE, BRIBER_GUIDE, BRIBER_MIN_BARBARIAN_WEEKS, BRIBER_PRICES, BRIBER_LABOUR_STEPS,
  BRIBER_LABOUR_TASKS, BRIBER_SOURCE_STATUS,
} from './content.js';
import {
  BRIBER_ABILITY_IDS, BRIBER_CASE_IDS, type BriberCommand, type BriberAcquisitionCommand, type BriberAction, type BriberBatch,
  type BriberProjection, type BriberState,
} from './types.js';

function createBatch(number: number): BriberBatch {
  const id = `briber-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: BRIBER_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.supplyQuantity, unit: material.unit,
      source: `契约铺备料间贿赂者备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createBriberState(): BriberState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: BRIBER_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, barbarianActingAtPromotion: null,
    cases: Object.fromEntries(BRIBER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    reflected: false, gifts: [], giftPacks: 0,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && (s.progression.sequence === 7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))));
const isBarbarian = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.lawyer.discovered && s.lawyer.guidanceKnown && (isBarbarian(s) || promoted(s));
const materialPrice = (batch: BriberBatch) => BRIBER_PRICES.auxiliaryMaterials + (batch.labourSteps === BRIBER_LABOUR_STEPS ? 0 : BRIBER_PRICES.mainMaterials);
const bottleId = (batch: BriberBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<BriberBatch, 'id'>) => Number(batch.id.slice('briber-batch-'.length));
const barbarianWeeks = (s: SliceState) => Math.max(0, (s.briber.promotionWeek ?? s.week) - (s.barbarian.promotionWeek ?? s.week));
const failedBatch = (briber: BriberState, batch: BriberBatch) => batch.brewed && briber.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (briber: BriberState) => briber.batches.length >= 3 && briber.bottles.length === briber.batches.length && briber.batches.every(batch => failedBatch(briber, batch));

function commandBlock(s: SliceState, command: BriberAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (Object.values(s.lawyer.cases).some(scene => scene.contactOpen)) return '先实际结束律师阶段尚未结束的交涉，再办理贿赂者准备。';
  if (Object.values(s.barbarian.cases).some(scene => scene.contactOpen)) return '先实际结束野蛮人阶段尚未结束的接触，再办理贿赂者准备。';
  if (Object.values(s.briber.cases).some(scene => scene.contactOpen)) return '先实际结束本次贿赂者实践的接触，再继续。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的契约铺备料间。';
  if (!knownChannel(s)) return '成为野蛮人并保有指导者渠道后，才能继续贿赂者之路。';
  if (promoted(s)) return '你已完成贿赂者晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.briber.formulaKnown) return '已经掌握贿赂者配方。';
    return s.cash < BRIBER_PRICES.formula ? '贿赂者配方指导需要240便士。' : null;
  }
  if (!s.briber.formulaKnown) return '先完成贿赂者配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.briber.resupply.requestedWeek !== null) return '已经向指导者申请下一轮贿赂者材料，请等到下一个真实周。';
    return exhaustedSupply(s.briber) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.briber.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮贿赂者材料并完成备料准备。';
    if (!exhaustedSupply(s.briber)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.briber.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选贿赂者原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `野蛮人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.barbarian.promotionWeek === null || barbarianWeeks(s) < BRIBER_MIN_BARBARIAN_WEEKS) return `成为野蛮人后已度过${barbarianWeeks(s)}/${BRIBER_MIN_BARBARIAN_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.briber.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批贿赂者材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= BRIBER_LABOUR_STEPS ? '这批四次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成贿赂者原瓶。';
  if (batch.materials.length !== BRIBER_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = BRIBER_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `契约铺备料间贿赂者备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.supplyQuantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < BRIBER_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyBriberCommand(s: SliceState, command: BriberAcquisitionCommand, c: SeerContext): void {
  rule(validateBriberAcquisitionCommand(command), '贿赂者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= BRIBER_PRICES.formula;
      s.briber.formulaKnown = true;
      c.note('记下贿赂者配方', `花费1行动、240便士，向同一位${BRIBER_GUIDE}学习六项材料。六项材料已核；怪脸大麻结晶原著未给数量，本作供货按1份；逐项投料顺序未获原著核定，本次按导师的本作G批次操作规程调配。${BRIBER_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.briber.resupply.requestedWeek = s.week;
      c.note('申请下一轮贿赂者材料', `花费1行动，向原${BRIBER_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批四次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.briber.batches.length + 1;
      s.briber.batches.push(...BRIBER_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.briber.resupply.deliveries += 1;
      s.briber.resupply.requestedWeek = null;
      c.note('贿赂者新一轮备料到货', `原${BRIBER_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成四次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.briber.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${BRIBER_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/4。${batch.labourSteps === BRIBER_LABOUR_STEPS ? '四次劳动抵本批1800便士主材费；仍须支付150便士辅材费，才会交付整批材料。' : '完成全部四次才能抵本批1800便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.briber.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('贿赂者材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === BRIBER_LABOUR_STEPS ? '四次劳动已抵本批主材费，仅支付150便士辅材费。' : '主材1800便士、辅材150便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.briber.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= BRIBER_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.briber.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶贿赂者魔药', `花费1行动、60便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。六项材料有原著依据，怪脸大麻结晶的1份是本作G供货计量、非原著精确数量；具体操作次序采用本作G导师规程，不把该次序称作原著事实。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。野蛮人扮演100且晋升后满8整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.briber.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.briber.barbarianActingAtPromotion = s.progression.acting;
        s.briber.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of BRIBER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为贿赂者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质、感知、意志与知识各+1。律师的三项与野蛮人的两项原能力掌握完整继承，贿赂者的贿赂削弱从0开始；野蛮人消化成果保留，贿赂者扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了贿赂者晋升' : '贿赂者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是野蛮人，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectBriber(s: SliceState): BriberProjection {
  const actions: BriberAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: BriberAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.briber.formulaKnown) add('learn-briber-formula', '请指导者讲解贿赂者配方', '1行动 · 240便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.briber.resupply.requestedWeek !== null) {
        add('receive-briber-supply', '确认下一轮三批贿赂者材料到货', `0行动 · 最早第${s.briber.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.briber)) {
        add('request-briber-supply', '向原指导者申请下一轮贿赂者材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.briber.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < BRIBER_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${BRIBER_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/4，完成四次抵1800便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === BRIBER_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材1800＋辅材150）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配贿赂者魔药`, '1行动 · 60便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.briber.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批贿赂者原瓶`, `0行动 · 独立确认 · 野蛮人扮演${s.progression.acting}/100 · 晋升后${barbarianWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.briber.batches.filter(batch => !batch.acquired).length;
  const prepared = s.briber.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '贿赂者 · 序列7' : '贿赂者之路', discovered: available,
    formulaKnown: available && s.briber.formulaKnown, promoted: isPromoted,
    formula: available && s.briber.formulaKnown ? BRIBER_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.quantity === null ? '' : material.unit, ...('note' in material ? { note: material.note } : {}) })) : [],
    actions,
    gifts: { held: 0, given: 0, summary: '' },
    bottles: available ? s.briber.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 贿赂者魔药`,
      source: `${BRIBER_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? BRIBER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?s.corruptionBaron.briberActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?'贿赂者魔药已消化；原木筹的真实去向与有限削弱能力继续保留。':isPromoted ? `野蛮人消化成果${s.briber.barbarianActingAtPromotion}/100已保留；贿赂者扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成野蛮人消化（${s.progression.acting}/100），并在野蛮人晋升后度过8整周（${barbarianWeeks(s)}/8）。配方与材料可以提前准备。` : '先走完野蛮人之路。',
    pollution: s.seer.pollution,
    cases: [], insideCase: available && Object.values(s.briber.cases).some(scene => scene.contactOpen), environment: '',
    ...(available ? { story: `${BRIBER_FORMULA_SOURCE}${BRIBER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。怪脸大麻结晶按本作G每批1份供货，原著未给明确数量或重量。${s.briber.resupply.requestedWeek === null ? `已实际接收后续材料${s.briber.resupply.deliveries}轮，每轮3批。` : `第${s.briber.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或四次劳动后领取材料 → 调配 → 独立确认服药。贿赂者材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${BRIBER_CONSUMPTION_RISK}` : '成为野蛮人后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validateBriberAcquisitionCommand(value: unknown): value is BriberAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^briber-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^briber-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}

export function isBriberAcquisitionCommand(command: BriberCommand): command is BriberAcquisitionCommand {
  return validateBriberAcquisitionCommand(command);
}

/** Reject unknown case IDs, methods and extra fields at both intent entry points. */
export function validateBriberCommand(value: unknown): value is BriberCommand {
  if (validateBriberAcquisitionCommand(value)) return true;
  if (!record(value)) return false;
  if (value.type === 'REFLECT' || value.type === 'BUY_GIFTS') return shape(value, ['type']);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && BRIBER_CASE_IDS.includes(value.caseId as typeof BRIBER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && BRIBER_CASE_IDS.includes(value.caseId as typeof BRIBER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns physical materials, bottle lineage, promotion and stock conservation.
 * Life owns exact case transitions, actual closure and evidence for each bounded practice. */
export function validateBriberState(s: SliceState): boolean {
  const raw: unknown = s.briber;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'barbarianActingAtPromotion', 'cases', 'reflected', 'gifts', 'giftPacks']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.lawyer) || !record(s.barbarian)) return false;
  const firstConsumptionWeek = (s.barbarian.promotionWeek ?? s.week) + BRIBER_MIN_BARBARIAN_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== BRIBER_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.cases) || !shape(raw.cases, BRIBER_CASE_IDS)) return false;
  if (!integer(raw.giftPacks, 0, Math.floor(Number.MAX_SAFE_INTEGER / 3)) || !Array.isArray(raw.gifts) || raw.gifts.length !== (raw.giftPacks as number) * 3) return false;
  for (const [index, gift] of raw.gifts.entries()) {
    if (!record(gift) || !shape(gift, ['id', 'location', 'destination', 'givenWeek']) || gift.id !== `BR7-GIFT-${index + 1}`) return false;
    if (gift.location === 'PLAYER') {
      if (gift.destination !== null || gift.givenWeek !== null) return false;
    } else if (gift.location === 'GIVEN') {
      if (typeof gift.destination !== 'string' || gift.destination.trim().length === 0 || !integer(raw.promotionWeek, firstConsumptionWeek, s.week) || !integer(gift.givenWeek, raw.promotionWeek as number, s.week)) return false;
    } else return false;
  }
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'TEST_RECORDED', 'REFUSAL_RECORDED', 'DEPARTURE_RECORDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const briber = raw as unknown as BriberState, isPromoted = promoted(s);
  if (briber.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!briber.formulaKnown || !integer(s.barbarian.promotionWeek, 1, s.week) || !integer(briber.promotionWeek, firstConsumptionWeek, s.week) || briber.barbarianActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS,...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?CORRUPTION_BARON_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?MENTOR_DISORDER_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3)?FALLEN_EARL_ABILITY_IDS:[]),...(s.progression.sequence===3?FRENZY_MAGE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (briber.promotionWeek !== null || briber.barbarianActingAtPromotion !== null || BRIBER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (briber.giftPacks !== 0 || briber.gifts.length !== 0) return false;
    if (briber.reflected || Object.values(briber.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Validate every record before following cross-references, including hostile save input.
  for (const [index, batch] of briber.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `briber-batch-${index + 1}` || !integer(batch.labourSteps, 0, BRIBER_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== BRIBER_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !briber.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = BRIBER_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `契约铺备料间贿赂者备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.supplyQuantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of briber.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.barbarian.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of briber.batches) if (briber.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of briber.bottles) {
    if (isPromoted && bottle.brewedWeek > briber.promotionWeek!) return false;
    const batch = briber.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== BRIBER_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.barbarian.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (briber.promotionWeek === null || bottle.brewedWeek > briber.promotionWeek) return false;
    }
  }
  if (!briber.batches.slice(0, deliveries * 3).every(batch => failedBatch(briber, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(briber.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = briber.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (briber.resupply.requestedWeek !== null && (!briber.formulaKnown || isPromoted || !exhaustedSupply(briber) || briber.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...briber.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}

export type * from './types.js';
