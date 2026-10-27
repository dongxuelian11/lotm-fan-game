import {MIRACLE_WORKER_ABILITY_IDS} from '../miracle-worker/content.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import {
  CLOWN_ABILITIES, CLOWN_BATCH_IDS, CLOWN_CONSUMPTION_RISK, CLOWN_FORMULA,
  CLOWN_FORMULA_SOURCE, CLOWN_GUIDE, CLOWN_MIN_SEER_WEEKS, CLOWN_PAPER_STOCK, CLOWN_PRICES,
} from './content.js';
import {
  CLOWN_ABILITY_IDS, type ClownAcquisitionCommand, type ClownAction, type ClownBatch,
  type ClownProjection, type ClownState,
} from './types.js';

function createBatch(number: number): ClownBatch {
  const id = `clown-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: CLOWN_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.quantity, unit: material.unit,
      source: `占卜俱乐部小丑备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createClownState(): ClownState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: CLOWN_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, seerActingAtPromotion: null,
    paperStock: CLOWN_PAPER_STOCK, paperSheets: 0, paperSpent: 0,
    practices: [], trainingAttempts: {},
    rescue: { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, enemyStatus: 'RESISTING', parcelHolder: 'COURIER', parcelOwner: 'courier-elsie' },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'diviner' && (s.progression.sequence === 8||s.progression.sequence === 7||(s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isSeer = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.seer.discovered && (isSeer(s) || promoted(s));
const materialPrice = (batch: ClownBatch) => CLOWN_PRICES.auxiliaryMaterials + (batch.labourSteps === 3 ? 0 : CLOWN_PRICES.mainMaterials);
const bottleId = (batch: ClownBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<ClownBatch, 'id'>) => Number(batch.id.slice('clown-batch-'.length));
const seerWeeks = (s: SliceState) => Math.max(0, (s.clown.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const failedBatch = (clown: ClownState, batch: ClownBatch) => batch.brewed && clown.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (clown: ClownState) => clown.batches.length >= 3 && clown.bottles.length === clown.batches.length && clown.batches.every(batch => failedBatch(clown, batch));

function commandBlock(s: SliceState, command: ClownAcquisitionCommand): string | null {
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的占卜俱乐部。';
  if (!knownChannel(s)) return '成为占卜家并保有指导者渠道后，才能继续小丑之路。';
  if (command.type === 'BUY_PAPER') {
    if (!promoted(s)) return '成为小丑后才能购买纸张飞刀的备料。';
    if (s.clown.paperStock <= 0) return '供应方的纸张已经售罄，这批纸不会自动补货。';
    const quantity = Math.min(10, s.clown.paperStock);
    return s.cash < quantity * CLOWN_PRICES.paperSheet ? `纸张需要${quantity * CLOWN_PRICES.paperSheet}便士。` : null;
  }
  if (promoted(s)) return '你已完成小丑晋升，不能重复服用或继续准备这份魔药。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.clown.formulaKnown) return '已经掌握小丑配方。';
    return s.cash < CLOWN_PRICES.formula ? '小丑配方指导需要180便士。' : null;
  }
  if (!s.clown.formulaKnown) return '先完成小丑配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.clown.resupply.requestedWeek !== null) return '已经向指导者申请下一轮小丑材料，请等到下一个真实周。';
    return exhaustedSupply(s.clown) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.clown.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮小丑材料并完成备料准备。';
    if (!exhaustedSupply(s.clown)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.clown.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选小丑原瓶不存在或已经用完。';
    if (s.progression.acting < 100) return `占卜家魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || seerWeeks(s) < CLOWN_MIN_SEER_WEEKS) return `成为占卜家后已度过${seerWeeks(s)}/${CLOWN_MIN_SEER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  const batch = s.clown.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批小丑材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= 3 ? '这批三次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成小丑原瓶。';
  if (batch.materials.length !== CLOWN_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = CLOWN_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.holder === 'PLAYER' && material.quantity === expected.quantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < CLOWN_PRICES.brewing ? '调配台使用需要80便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyClownCommand(s: SliceState, command: ClownAcquisitionCommand, c: SeerContext): void {
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= CLOWN_PRICES.formula;
      s.clown.formulaKnown = true;
      c.note('记下小丑配方', `花费1行动、180便士，向同一位${CLOWN_GUIDE}学习七项材料。先放入五项辅材，再投入完整人脸玫瑰，最后加入成年霍纳奇斯灰山羊独角结晶。${CLOWN_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.clown.resupply.requestedWeek = s.week;
      c.note('申请下一轮小丑材料', `花费1行动，向原${CLOWN_GUIDE}申请下一轮三批材料，并核对七料清单、整理新的调配顺序记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批三次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.clown.batches.length + 1;
      s.clown.batches.push(...CLOWN_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.clown.resupply.deliveries += 1;
      s.clown.resupply.requestedWeek = null;
      c.note('小丑新一轮备料到货', `原${CLOWN_GUIDE}确认第${firstNumber}至${firstNumber + 2}批七料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成三次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.clown.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      const tasks = ['抄录配方目录', '整理备料记录', '清理调配场地'];
      c.note(`完成${tasks[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/3。${batch.labourSteps === 3 ? '三次劳动抵本批1200便士主材费；仍须支付90便士辅材费，才会交付整批材料。' : '完成全部三次才能抵本批1200便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.clown.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('小丑材料交付', `第${batchNumber(batch)}批七项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === 3 ? '三次劳动已抵本批主材费，仅支付90便士辅材费。' : '主材1200便士、辅材90便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.clown.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= CLOWN_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.clown.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶小丑魔药', `花费1行动、80便士，把第${batchNumber(batch)}批五项辅材依次加入，再投入完整人脸玫瑰，最后加入独角结晶。七项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。占卜家扮演100且晋升后满6整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.clown.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.clown.seerActingAtPromotion = s.progression.acting;
        s.clown.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of CLOWN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 6], ['perception', 4], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为小丑', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+6、感知+4、意志+2、知识+1。四项占卜家掌握完整继承，五项小丑能力从0开始；占卜家消化成果保留，小丑扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了小丑晋升' : '小丑魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是占卜家，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }
    case 'BUY_PAPER': {
      const quantity = Math.min(10, s.clown.paperStock);
      s.cash -= quantity * CLOWN_PRICES.paperSheet;
      s.clown.paperStock -= quantity;
      s.clown.paperSheets += quantity;
      c.note('纸张入袋', `购买${quantity}张普通纸，共${quantity * CLOWN_PRICES.paperSheet}便士，0行动。现在持有${s.clown.paperSheets}张，供应方剩余${s.clown.paperStock}张；投掷后实际消耗，战斗中不能购买。`);
      return;
    }
  }
}

// Historical inheritance only; existing stage command predicates stay unchanged.
const hasAttendantHistory = (s: SliceState) => s.progression.pathwayId === 'diviner' &&
  s.progression.sequence === 1 && s.attendantMysteries?.promotionWeek != null;
const historicallyPromoted = (s: SliceState) => promoted(s) || hasAttendantHistory(s);
const historicallyKnownChannel = (s: SliceState) => s.seer.discovered && (isSeer(s) || historicallyPromoted(s));
export function projectClown(s: SliceState): ClownProjection {
  const actions: ClownAction[] = [];
  const available = historicallyKnownChannel(s), isPromoted = historicallyPromoted(s);
  const add = (id: string, label: string, cost: string, command: ClownAcquisitionCommand) => {
    if (hasAttendantHistory(s)) return;
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.clown.formulaKnown) add('learn-clown-formula', '请指导者讲解小丑配方', '1行动 · 180便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.clown.resupply.requestedWeek !== null) {
        add('receive-clown-supply', '确认下一轮三批小丑材料到货', `0行动 · 最早第${s.clown.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.clown)) {
        add('request-clown-supply', '向原指导者申请下一轮小丑材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      const workLabels = ['抄录配方目录', '整理备料记录', '清理调配场地'];
      for (const batch of s.clown.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < 3) add(`work-${batch.id}`, `第${number}批 · ${workLabels[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/3，完成三次抵1200便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取七项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === 3 ? '（仅付五项辅材）' : '（主材1200＋辅材90）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配小丑魔药`, '1行动 · 80便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.clown.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批小丑原瓶`, `0行动 · 独立确认 · 占卜家扮演${s.progression.acting}/100 · 晋升后${seerWeeks(s)}/6整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  if (available && isPromoted) {
    const quantity = Math.min(10, s.clown.paperStock);
    add('buy-clown-paper', quantity > 0 ? `购买${quantity}张纸` : '纸张已售罄', `0行动 · ${quantity * CLOWN_PRICES.paperSheet}便士 · 供应方剩${s.clown.paperStock}张`, { type: 'BUY_PAPER' });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.clown.batches.filter(batch => !batch.acquired).length;
  const prepared = s.clown.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    rescueCombatStarted: s.clown.rescue.startHistoryIndex !== null,
    title: isPromoted ? '小丑 · 序列8' : '小丑之路', discovered: available,
    formulaKnown: available && s.clown.formulaKnown, promoted: isPromoted,
    formula: available && s.clown.formulaKnown ? CLOWN_FORMULA.map(({ name, quantity, unit }) => ({ name, quantity, unit })) : [],
    actions,
    bottles: available ? s.clown.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 小丑魔药`,
      source: `${CLOWN_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的七项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? CLOWN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s))))))?s.magician.clownActingAtPromotion??100:s.progression.acting) : 0,
    digestion: s.progression.pathwayId==='diviner'&&(s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s))))))?'小丑魔药已消化，原纸张与实践卷宗保留。':isPromoted ? `占卜家消化成果${s.clown.seerActingAtPromotion}/100已保留；小丑扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成占卜家消化（${s.progression.acting}/100），并在占卜家晋升后度过6整周（${seerWeeks(s)}/6）。配方与材料可以提前准备。` : '先走完占卜家之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：配方指导 → 采购或三次劳动后领取材料 → 调配 → 独立确认服药。小丑材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${CLOWN_CONSUMPTION_RISK}` : '成为占卜家后，可向原有指导者了解下一序列。',
    paperStock: isPromoted ? s.clown.paperStock : 0,
    paperSheets: isPromoted ? s.clown.paperSheets : 0,
    paperSpent: isPromoted ? s.clown.paperSpent : 0,
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Local finite-supply and original-bottle invariants; adventure validates its own history. */
export function validateClownState(s: SliceState): boolean {
  const raw: unknown = s.clown;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'seerActingAtPromotion', 'paperStock', 'paperSheets', 'paperSpent', 'practices', 'trainingAttempts', 'rescue']) || typeof raw.formulaKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.seer)) return false;
  const firstConsumptionWeek = (s.progression.promotionWeek ?? s.week) + CLOWN_MIN_SEER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== 3 * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (![raw.paperStock, raw.paperSheets, raw.paperSpent].every(value => integer(value, 0, CLOWN_PAPER_STOCK)) || (raw.paperStock as number) + (raw.paperSheets as number) + (raw.paperSpent as number) !== CLOWN_PAPER_STOCK) return false;
  if (!Array.isArray(raw.practices) || !raw.practices.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) || new Set(raw.practices).size !== raw.practices.length || !record(raw.trainingAttempts) || !Object.values(raw.trainingAttempts).every(week => integer(week, 1, s.week))) return false;
  if (!record(raw.rescue) || !shape(raw.rescue, ['status', 'attemptWeek', 'startHistoryIndex', 'enemyStatus', 'parcelHolder', 'parcelOwner']) || !['AVAILABLE', 'FIGHTING', 'RESCUED', 'RETREATED', 'LOST'].includes(raw.rescue.status as string) || raw.rescue.attemptWeek !== null && !integer(raw.rescue.attemptWeek, 1, s.week) || raw.rescue.startHistoryIndex !== null && !integer(raw.rescue.startHistoryIndex, 0)) return false;
  if (!['RESISTING', 'SURRENDERED', 'DEAD'].includes(raw.rescue.enemyStatus as string) || raw.rescue.parcelHolder !== 'COURIER' || raw.rescue.parcelOwner !== 'courier-elsie') return false;
  const clown = raw as unknown as ClownState, isPromoted = historicallyPromoted(s);
  if (clown.formulaKnown && !historicallyKnownChannel(s)) return false;
  if (isPromoted) {
    if (!clown.formulaKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(clown.promotionWeek, s.progression.promotionWeek! + CLOWN_MIN_SEER_WEEKS, s.week) || clown.seerActingAtPromotion !== 100) return false;
    if (!CLOWN_ABILITY_IDS.every(id => integer(s.progression.mastery[id], 0, 500))) return false;
  } else if (clown.promotionWeek !== null || clown.seerActingAtPromotion !== null || clown.paperStock !== CLOWN_PAPER_STOCK || clown.paperSheets !== 0 || clown.paperSpent !== 0 || CLOWN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [index, batch] of clown.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `clown-batch-${index + 1}` || !integer(batch.labourSteps, 0, 3) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== CLOWN_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !clown.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = CLOWN_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || typeof material.source !== 'string' || !material.source.length || material.source.length > 500) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.quantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
    if (clown.bottles.filter(bottle => record(bottle) && bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  }
  let successfulBottles = 0;
  for (const bottle of clown.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, s.progression.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
    if (isPromoted && bottle.brewedWeek > clown.promotionWeek!) return false;
    const batch = clown.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== CLOWN_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.progression.promotionWeek === null || s.week - s.progression.promotionWeek < CLOWN_MIN_SEER_WEEKS) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (clown.promotionWeek === null || bottle.brewedWeek > clown.promotionWeek) return false;
    }
  }
  if (!clown.batches.slice(0, deliveries * 3).every(batch => failedBatch(clown, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(clown.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = clown.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (clown.resupply.requestedWeek !== null && (!clown.formulaKnown || isPromoted || !exhaustedSupply(clown) || clown.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...clown.bottles.map(bottle => bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0);
}
