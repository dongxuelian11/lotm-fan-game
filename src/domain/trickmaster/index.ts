import {PLANESWALKER_ABILITY_IDS} from '../planeswalker/types.js';
import {WANDERER_ABILITY_IDS} from '../wanderer/types.js';
import {SECRETS_SORCERER_ABILITY_IDS} from '../secrets-sorcerer/types.js';
import {TRAVELER_ABILITY_IDS} from '../traveler/types.js';
import {RECORDER_ABILITY_IDS} from '../recorder/types.js';
import {ASTROLOGER_ABILITY_IDS} from '../astrologer/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APPRENTICE_ABILITY_IDS } from '../apprentice/types.js';
import {
  TRICKMASTER_ABILITIES, TRICKMASTER_BATCH_IDS, TRICKMASTER_CONSUMPTION_RISK, TRICKMASTER_FORMULA,
  TRICKMASTER_FORMULA_SOURCE, TRICKMASTER_GUIDE, TRICKMASTER_MIN_APPRENTICE_WEEKS, TRICKMASTER_PRICES, TRICKMASTER_LABOUR_STEPS,
  TRICKMASTER_LABOUR_TASKS, TRICKMASTER_SOURCE_STATUS,
} from './content.js';
import {
  TRICKMASTER_ABILITY_IDS, TRICKMASTER_CASE_IDS, type TrickmasterCommand, type TrickmasterAcquisitionCommand, type TrickmasterAction, type TrickmasterBatch,
  type TrickmasterProjection, type TrickmasterState,
} from './types.js';

function createBatch(number: number): TrickmasterBatch {
  const id = `trickmaster-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: TRICKMASTER_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.supplyQuantity, unit: material.unit,
      source: `档案工作间收货处戏法大师备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createTrickmasterState(): TrickmasterState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: TRICKMASTER_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, apprenticeActingAtPromotion: null,
    cases: Object.fromEntries(TRICKMASTER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' }])),
    reflected: false, cupSurface: 'WARM', signalUsed: false, walkwayCleared: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'door' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isApprentice = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.apprentice.discovered && s.apprentice.guidanceKnown && (isApprentice(s) || promoted(s));
const materialPrice = (batch: TrickmasterBatch) => TRICKMASTER_PRICES.auxiliaryMaterials + (batch.labourSteps === TRICKMASTER_LABOUR_STEPS ? 0 : TRICKMASTER_PRICES.mainMaterials);
const bottleId = (batch: TrickmasterBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<TrickmasterBatch, 'id'>) => Number(batch.id.slice('trickmaster-batch-'.length));
const apprenticeWeeks = (s: SliceState) => Math.max(0, (s.trickmaster.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const failedBatch = (trickmaster: TrickmasterState, batch: TrickmasterBatch) => batch.brewed && trickmaster.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (trickmaster: TrickmasterState) => trickmaster.batches.length >= 3 && trickmaster.bottles.length === trickmaster.batches.length && trickmaster.batches.every(batch => failedBatch(trickmaster, batch));

function commandBlock(s: SliceState, command: TrickmasterAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (Object.values(s.apprentice.cases).some(scene => scene.position === 'INSIDE')) return '你仍在原门内，先沿已打开的原门返回，再办理戏法大师准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的档案工作间收货处。';
  if (!knownChannel(s)) return '成为学徒并保有指导者渠道后，才能继续戏法大师之路。';
  if (promoted(s)) return '你已完成戏法大师晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.trickmaster.formulaKnown) return '已经掌握戏法大师配方。';
    return s.cash < TRICKMASTER_PRICES.formula ? '戏法大师配方指导需要180便士。' : null;
  }
  if (!s.trickmaster.formulaKnown) return '先完成戏法大师配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.trickmaster.resupply.requestedWeek !== null) return '已经向指导者申请下一轮戏法大师材料，请等到下一个真实周。';
    return exhaustedSupply(s.trickmaster) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.trickmaster.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮戏法大师材料并完成备料准备。';
    if (!exhaustedSupply(s.trickmaster)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.trickmaster.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选戏法大师原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `学徒魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || apprenticeWeeks(s) < TRICKMASTER_MIN_APPRENTICE_WEEKS) return `成为学徒后已度过${apprenticeWeeks(s)}/${TRICKMASTER_MIN_APPRENTICE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.trickmaster.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批戏法大师材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= TRICKMASTER_LABOUR_STEPS ? '这批三次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成戏法大师原瓶。';
  if (batch.materials.length !== TRICKMASTER_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = TRICKMASTER_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `档案工作间收货处戏法大师备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.supplyQuantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < TRICKMASTER_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyTrickmasterCommand(s: SliceState, command: TrickmasterAcquisitionCommand, c: SeerContext): void {
  rule(validateTrickmasterAcquisitionCommand(command), '戏法大师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= TRICKMASTER_PRICES.formula;
      s.trickmaster.formulaKnown = true;
      c.note('记下戏法大师配方', `花费1行动、180便士，向同一位${TRICKMASTER_GUIDE}学习六项材料。六项材料已核；胃袋原著未给数量，本作供货按1份；逐项投料顺序未获原著核定，本次按导师的本作G批次操作规程调配。${TRICKMASTER_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.trickmaster.resupply.requestedWeek = s.week;
      c.note('申请下一轮戏法大师材料', `花费1行动，向原${TRICKMASTER_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批三次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.trickmaster.batches.length + 1;
      s.trickmaster.batches.push(...TRICKMASTER_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.trickmaster.resupply.deliveries += 1;
      s.trickmaster.resupply.requestedWeek = null;
      c.note('戏法大师新一轮备料到货', `原${TRICKMASTER_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成三次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.trickmaster.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${TRICKMASTER_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/3。${batch.labourSteps === TRICKMASTER_LABOUR_STEPS ? '三次劳动抵本批1050便士主材费；仍须支付100便士辅材费，才会交付整批材料。' : '完成全部三次才能抵本批1050便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.trickmaster.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('戏法大师材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === TRICKMASTER_LABOUR_STEPS ? '三次劳动已抵本批主材费，仅支付100便士辅材费。' : '主材1050便士、辅材100便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.trickmaster.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= TRICKMASTER_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.trickmaster.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶戏法大师魔药', `花费1行动、60便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。六项材料有原著依据，胃袋的1份是本作G供货计量、非原著精确数量；具体操作次序采用本作G导师规程，不把该次序称作原著事实。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。学徒扮演100且晋升后满4整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.trickmaster.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.trickmaster.apprenticeActingAtPromotion = s.progression.acting;
        s.trickmaster.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of TRICKMASTER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 2], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为戏法大师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+2、意志+2、知识+1。学徒的开门掌握完整继承，戏法大师的一组共享戏法掌握从0开始；学徒消化成果保留，戏法大师扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了戏法大师晋升' : '戏法大师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是学徒，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectTrickmaster(s: SliceState): TrickmasterProjection {
  const actions: TrickmasterAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: TrickmasterAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.trickmaster.formulaKnown) add('learn-trickmaster-formula', '请指导者讲解戏法大师配方', '1行动 · 180便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.trickmaster.resupply.requestedWeek !== null) {
        add('receive-trickmaster-supply', '确认下一轮三批戏法大师材料到货', `0行动 · 最早第${s.trickmaster.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.trickmaster)) {
        add('request-trickmaster-supply', '向原指导者申请下一轮戏法大师材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.trickmaster.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < TRICKMASTER_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${TRICKMASTER_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/3，完成三次抵1050便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === TRICKMASTER_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材1050＋辅材100）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配戏法大师魔药`, '1行动 · 60便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.trickmaster.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批戏法大师原瓶`, `0行动 · 独立确认 · 学徒扮演${s.progression.acting}/100 · 晋升后${apprenticeWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.trickmaster.batches.filter(batch => !batch.acquired).length;
  const prepared = s.trickmaster.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '戏法大师 · 序列8' : '戏法大师之路', discovered: available,
    formulaKnown: available && s.trickmaster.formulaKnown, promoted: isPromoted,
    formula: available && s.trickmaster.formulaKnown ? TRICKMASTER_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.quantity === null ? '' : material.unit, ...('note' in material ? { note: material.note } : {}) })) : [],
    actions,
    bottles: available ? s.trickmaster.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 戏法大师魔药`,
      source: `${TRICKMASTER_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? TRICKMASTER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?(s.astrologer.trickmasterActingAtPromotion??100):s.progression.acting) : 0,
    digestion: s.progression.pathwayId==='door'&&(s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?'戏法大师魔药已消化（100/100），原料、原瓶与三次实际展示记录保留。':isPromoted ? `学徒消化成果${s.trickmaster.apprenticeActingAtPromotion}/100已保留；戏法大师扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成学徒消化（${s.progression.acting}/100），并在学徒晋升后度过4整周（${apprenticeWeeks(s)}/4）。配方与材料可以提前准备。` : '先走完学徒之路。',
    pollution: s.seer.pollution,
    cases: [], environment: '',
    ...(available ? { story: `${TRICKMASTER_FORMULA_SOURCE}${TRICKMASTER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。胃袋按本作G每批1份供货，原著未给明确数量或重量。${s.trickmaster.resupply.requestedWeek === null ? `已实际接收后续材料${s.trickmaster.resupply.deliveries}批。` : `第${s.trickmaster.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或三次劳动后领取材料 → 调配 → 独立确认服药。戏法大师材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${TRICKMASTER_CONSUMPTION_RISK}` : '成为学徒后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validateTrickmasterAcquisitionCommand(value: unknown): value is TrickmasterAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^trickmaster-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^trickmaster-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}

export function isTrickmasterAcquisitionCommand(command: TrickmasterCommand): command is TrickmasterAcquisitionCommand {
  return validateTrickmasterAcquisitionCommand(command);
}

/** Reject unknown case IDs, methods and extra fields at both intent entry points. */
export function validateTrickmasterCommand(value: unknown): value is TrickmasterCommand {
  if (validateTrickmasterAcquisitionCommand(value)) return true;
  if (!record(value)) return false;
  if (value.type === 'REFLECT') return shape(value, ['type']);
  if (['OBSERVE', 'PERFORM', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && TRICKMASTER_CASE_IDS.includes(value.caseId as typeof TRICKMASTER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && TRICKMASTER_CASE_IDS.includes(value.caseId as typeof TRICKMASTER_CASE_IDS[number]) && ['TRICK', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns physical materials, bottle lineage, promotion and stock conservation.
 * Life owns exact case transitions and the scene evidence behind each limited trick. */
export function validateTrickmasterState(s: SliceState): boolean {
  const raw: unknown = s.trickmaster;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'apprenticeActingAtPromotion', 'cases', 'reflected', 'cupSurface', 'signalUsed', 'walkwayCleared']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.apprentice)) return false;
  const firstConsumptionWeek = (s.progression.promotionWeek ?? s.week) + TRICKMASTER_MIN_APPRENTICE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== TRICKMASTER_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.cases) || !shape(raw.cases, TRICKMASTER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['TRICK', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'CHILLED', 'SIGNALLED', 'CLEARED', 'REFERRED'].includes(value.outcome as string)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  if (!['WARM', 'THIN_ICE', 'COOLED'].includes(raw.cupSurface as string) || typeof raw.signalUsed !== 'boolean' || typeof raw.walkwayCleared !== 'boolean') return false;
  const trickmaster = raw as unknown as TrickmasterState, isPromoted = promoted(s);
  if (trickmaster.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!trickmaster.formulaKnown || !integer(s.progression.promotionWeek, 1, s.week) || !integer(trickmaster.promotionWeek, firstConsumptionWeek, s.week) || trickmaster.apprenticeActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?ASTROLOGER_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?RECORDER_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?TRAVELER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?SECRETS_SORCERER_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?WANDERER_ABILITY_IDS:[]),...(s.progression.sequence===2?PLANESWALKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (trickmaster.promotionWeek !== null || trickmaster.apprenticeActingAtPromotion !== null || TRICKMASTER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (trickmaster.reflected || trickmaster.cupSurface !== 'WARM' || trickmaster.signalUsed || trickmaster.walkwayCleared || Object.values(trickmaster.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0)) return false;
  }
  // Validate every record before following cross-references, including hostile save input.
  for (const [index, batch] of trickmaster.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `trickmaster-batch-${index + 1}` || !integer(batch.labourSteps, 0, TRICKMASTER_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== TRICKMASTER_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !trickmaster.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = TRICKMASTER_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `档案工作间收货处戏法大师备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.supplyQuantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of trickmaster.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.progression.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of trickmaster.batches) if (trickmaster.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of trickmaster.bottles) {
    if (isPromoted && bottle.brewedWeek > trickmaster.promotionWeek!) return false;
    const batch = trickmaster.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== TRICKMASTER_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.progression.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (trickmaster.promotionWeek === null || bottle.brewedWeek > trickmaster.promotionWeek) return false;
    }
  }
  if (!trickmaster.batches.slice(0, deliveries * 3).every(batch => failedBatch(trickmaster, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(trickmaster.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = trickmaster.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (trickmaster.resupply.requestedWeek !== null && (!trickmaster.formulaKnown || isPromoted || !exhaustedSupply(trickmaster) || trickmaster.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...trickmaster.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}

export type * from './types.js';
