import {DISCERNER_ABILITY_IDS} from '../discerner/types.js';
import {DREAM_WEAVER_ABILITY_IDS} from '../dream-weaver/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { AUDIENCE_ABILITY_IDS } from '../audience/types.js';
import { MINDREADER_ABILITY_IDS } from '../mindreader/types.js';
import { PSYCHOLOGIST_ABILITY_IDS } from '../psychologist/types.js';
import { HYPNOTIST_ABILITY_IDS } from '../hypnotist/types.js';
import { DREAMWALKER_ABILITY_IDS } from '../dreamwalker/types.js';
import {
  createManipulatorRitualState, validateManipulatorRitualState, projectManipulatorRitual, manipulatorRitualActions,
  validateManipulatorRitualCommand, applyManipulatorRitualCommand, hasManipulatorRitualLock,
  canConsumeManipulatorRitual, closeManipulatorRitual, currentManipulatorGathering,
} from './ritual.js';
import {
  createManipulatorLifeState, validateManipulatorLifeState, projectManipulatorLife, manipulatorLifeActions,
  isManipulatorActivity, manipulatorInside,
} from './life.js';
import {
  createManipulatorEncounterState, validateManipulatorEncounter, projectManipulatorEncounter,
  manipulatorEncounterActions, validateManipulatorEncounterCommand, applyManipulatorEncounterCommand, isInsideManipulatorEncounter,
} from './encounter.js';
import {
  MANIPULATOR_ABILITIES, MANIPULATOR_BATCH_IDS, MANIPULATOR_CONSUMPTION_RISK, MANIPULATOR_DONORS,
  MANIPULATOR_FORMULA, MANIPULATOR_FORMULA_ALTERNATIVES, MANIPULATOR_FORMULA_STATUS, MANIPULATOR_GUIDE,
  MANIPULATOR_LABOUR_STEPS, MANIPULATOR_LABOUR_TASKS, MANIPULATOR_MIN_DREAMWALKER_WEEKS,
  MANIPULATOR_PRICES, MANIPULATOR_RITUAL_SOURCE, MANIPULATOR_SOURCE_STATUS,
} from './content.js';
import {
  MANIPULATOR_ABILITY_IDS, MANIPULATOR_DONOR_IDS, type ManipulatorAcquisitionCommand, type ManipulatorAction,
  type ManipulatorBatch, type ManipulatorCommand, type ManipulatorDonor, type ManipulatorDonorId,
  type ManipulatorMaterial, type ManipulatorProjection, type ManipulatorState,
} from './types.js';

const batchNumber = (batch: Pick<ManipulatorBatch, 'id'>) => Number(batch.id.slice('manipulator-batch-'.length));
const batchSource = (number: number, week: number | null) => `${MANIPULATOR_GUIDE}的原创G独立原材料渠道，第${number}组${week === null ? '初始原库存' : `，第${week}周实际到货`}；原结晶之心、原龙血、原金叶分别封存，不含任何人的泪水或完成的魔药。`;
function originalMaterials(batchId: string): ManipulatorMaterial[] {
  return [
    { id: `${batchId}-heart`, kind: 'HEART', name: '树人导师的结晶之心', quantity: 1, unit: '颗', source: `原创G供货方独立封存原心${batchId}-heart，完整一颗，不编重量。`, holder: 'SUPPLIER' },
    { id: `${batchId}-blood`, kind: 'DRAGON_BLOOD', name: '老年心灵巨龙的血液', quantity: 80, unit: '毫升', source: `原创G供货方原血液容器${batchId}-blood，共80毫升。`, holder: 'SUPPLIER' },
    { id: `${batchId}-leaves`, kind: 'GOLDEN_LEAVES', name: '树人导师的金色树叶', quantity: 3, unit: '片', source: `原创G供货方原封袋${batchId}-leaves，内有三片原金叶。`, holder: 'SUPPLIER' },
  ];
}
function freshBatch(number: number, week: number | null): ManipulatorBatch {
  const id = `manipulator-batch-${number}`;
  return { id, source: batchSource(number, week), stockedWeek: week, labourSteps: 0, acquiredWeek: null, status: 'SUPPLIER', materials: originalMaterials(id), tears: [], brewedWeek: null, bottleId: null };
}
const donorSource = (id: ManipulatorDonorId) => `原创G成年原人物${id}；本人已了解虚构材料用途，并只同意在当次实际会面仍自愿且出现强烈情绪时贡献一滴泪水，可拒绝。`;
export function createManipulatorState(): ManipulatorState {
  return {
    guidanceKnown: false, batches: MANIPULATOR_BATCH_IDS.map((_, i) => freshBatch(i + 1, null)), bottles: [],
    donors: Object.fromEntries(MANIPULATOR_DONORS.map(donor => [donor.id, { ...donor, source: donorSource(donor.id), willing: true, visits: [] }])) as unknown as Record<ManipulatorDonorId, ManipulatorDonor>,
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, dreamwalkerActingAtPromotion: null,
    ritual: createManipulatorRitualState(), life: createManipulatorLifeState(), encounter: createManipulatorEncounterState(),
  };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isManipulator = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 4;
const hasManipulatorHistory = (s:SliceState) => isManipulator(s)||(s.progression.pathwayId==='audience'&&(s.progression.sequence===3||s.progression.sequence===2));
const isDreamwalker = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.audience.discovered && s.dreamwalker.guidanceKnown && s.dreamwalker.promotionWeek !== null && (isDreamwalker(s) || hasManipulatorHistory(s));
const dreamwalkerWeeks = (s: SliceState) => Math.max(0, (s.manipulator.promotionWeek ?? s.week) - (s.dreamwalker.promotionWeek ?? s.week));
const materialPrice = (batch: ManipulatorBatch) => MANIPULATOR_PRICES.materials - (batch.labourSteps === MANIPULATOR_LABOUR_STEPS ? MANIPULATOR_PRICES.labourCredit : 0);
const exhaustedSupply = (state: ManipulatorState) => state.batches.length >= 3 && state.bottles.length === state.batches.length && state.batches.every(batch => batch.status === 'BREWED') && state.bottles.every(bottle => bottle.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? ''));
const sourceIds = (batch: ManipulatorBatch) => [...batch.materials.map(item => item.id), ...MANIPULATOR_DONOR_IDS.map(id => batch.tears.find(tear => tear.donorId === id)!.id)];
const tearEvent = (donor: ManipulatorDonor, batch: ManipulatorBatch, week: number) => `第${week}周，第${donor.visits.length + 1}次到${donor.location}的实际新会面，供本批${batch.id}。${donor.story}本人当场再次同意；本次强烈${donor.emotion}产生的新一滴实际装入独立原封小瓶，未沿用任何旧泪水。`;

export function manipulatorAcquisitionBlock(s: SliceState, command: ManipulatorAcquisitionCommand): string | null {
  const state = s.manipulator, ap = ['LEARN_GUIDANCE', 'MATERIAL_WORK', 'COLLECT_TEAR', 'BREW', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (Object.values(s.dreamwalker.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED') || s.dreamwalker.practice.dream !== 'NONE' || s.dreamwalker.practice.location !== 'SOURCE_ROOM' || s.dreamwalker.ritual.activeVisitId !== null || manipulatorInside(s) || isInsideManipulatorEncounter(s)) return '先实际结束旧梦境会面、心智接触、人格任务或当前冲突。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '须实际返回贝克兰德的原导师、材料与七位成人所在地。';
  if (!knownChannel(s)) return '先成为梦境行者并保有原指导者渠道。';
  if (hasManipulatorHistory(s)) return '已经完成操纵师晋升，不能重复准备或服药；未用原物保留。';
  if (hasManipulatorRitualLock(s) && command.type !== 'CONSUME') return '当前集会实际占用礼堂；先独立确认饮药或0行动实际散场。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (state.guidanceKnown) return '已经掌握操纵师完整材料清单与仪式风险。';
    return s.cash < MANIPULATOR_PRICES.guidance ? '本次指导需要520便士。' : null;
  }
  if (!state.guidanceKnown) return '先向原导师学习配方、来源、万人共鸣仪式与四档风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (state.resupply.requestedWeek !== null) return '已申请后续三批原材料，须等下一真实周。';
    return exhaustedSupply(state) ? null : '已有各批材料须全部实际调成原瓶并耗尽失败，才能请求补货。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (state.resupply.requestedWeek === null) return '尚未申请后续原材料。';
    if (s.week <= state.resupply.requestedWeek) return '下一真实周起才能实际接收原材料。';
    return exhaustedSupply(state) ? null : '现有原物尚未全部耗尽失败，不能重复补货。';
  }
  if (command.type === 'CONSUME') {
    const bottle = state.bottles.find(item => item.id === command.bottleId);
    if (command.confirmed !== true) return '须独立确认饮用所选原瓶。';
    if (!bottle || bottle.status !== 'PLAYER') return '所选原瓶尚未调成或已经耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '服药须健康>20且精神>40；可以0行动散场后休养。';
    if (s.progression.acting !== 100) return `梦境行者消化须100，目前${s.progression.acting}/100。`;
    if (dreamwalkerWeeks(s) < MANIPULATOR_MIN_DREAMWALKER_WEEKS) return `成为梦境行者后已度过${dreamwalkerWeeks(s)}/12整周。`;
    return canConsumeManipulatorRitual(s) ? null : '须当前同一礼堂至少10000名实际参与者仍在场，并处于本周真实共同情绪窗口；登记人数和旧集会不能替代。';
  }
  const batch = 'batchId' in command ? state.batches.find(item => item.id === command.batchId) : undefined;
  if (!batch) return '所选原材料批次不存在。';
  if (command.type === 'MATERIAL_WORK' || command.type === 'BUY_MATERIALS') {
    if (batch.status !== 'SUPPLIER') return '本批已交付，不能重复购买或追溯抵扣劳动。';
    if (command.type === 'MATERIAL_WORK') return batch.labourSteps === 5 ? '本批五次实际劳务已完成。' : null;
    return s.cash < materialPrice(batch) ? `领取本批三组原材料需要${materialPrice(batch)}便士。` : null;
  }
  if (batch.status !== 'PLAYER' || batch.materials.length !== 3 || batch.materials.some(item => item.holder !== 'PLAYER')) return '先实际取得本批三组原材料；已调配批次不能重复使用。';
  if (command.type === 'COLLECT_TEAR') {
    const donor = state.donors[command.donorId];
    if (!donor || !donor.willing) return '该原成人当前不同意贡献泪水；不能施加暗示或代替其同意。';
    return batch.tears.some(item => item.donorId === command.donorId) ? '本批已有这位原成人的新一滴，必须来自七名不同成人。' : null;
  }
  return batch.tears.length === 7 && MANIPULATOR_DONOR_IDS.every(id => batch.tears.filter(tear => tear.donorId === id && tear.holder === 'PLAYER' && tear.consent).length === 1) ? null : '调配还需七名不同原成人各自当次自愿的一滴；购买材料不附赠泪水。';
}

export function applyManipulatorAcquisition(s: SliceState, command: ManipulatorAcquisitionCommand, c: SeerContext): void {
  rule(validateManipulatorAcquisitionCommand(command), '操纵师获取命令无效。');
  const reason = manipulatorAcquisitionBlock(s, command); rule(reason === null, reason ?? '当前无法继续。');
  const state = s.manipulator;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1; s.cash -= MANIPULATOR_PRICES.guidance; state.guidanceKnown = true;
      c.note('学习操纵师完整材料与真实仪式', `1行动、520便士。${MANIPULATOR_FORMULA_STATUS}${MANIPULATOR_FORMULA_ALTERNATIVES}${MANIPULATOR_RITUAL_SOURCE}`); return;
    case 'MATERIAL_WORK': {
      const batch = state.batches.find(item => item.id === command.batchId)!;
      s.actionsRemaining -= 1; batch.labourSteps += 1;
      c.note(MANIPULATOR_LABOUR_TASKS[batch.labourSteps - 1]!, `在原货栈完成${batch.id}第${batch.labourSteps}/5次实际劳动，1行动。五次只抵本批5600便士，余900便士；部分劳动不折现，不给泪水、魔药或参与者。`); return;
    }
    case 'BUY_MATERIALS': {
      const batch = state.batches.find(item => item.id === command.batchId)!, paid = materialPrice(batch);
      s.cash -= paid; batch.status = 'PLAYER'; batch.acquiredWeek = s.week;
      for (const item of batch.materials) item.holder = 'PLAYER';
      c.note('交付本批三组独立原材料', `0行动、${paid}便士，原结晶之心1颗、原龙血80毫升、原金叶3片实际归你持有。批次${batch.id}。七滴泪水一滴也没有附送；当前没有成品魔药。`); return;
    }
    case 'COLLECT_TEAR': {
      const batch = state.batches.find(item => item.id === command.batchId)!, donor = state.donors[command.donorId];
      const id = `${batch.id}-${donor.id}-tear`, eventId = `${batch.id}-${donor.id}-visit`;
      const event = tearEvent(donor, batch, s.week);
      s.actionsRemaining -= 1;
      batch.tears.push({ id, donorId: donor.id, batchId: batch.id, eventId, event, quantity: 1, unit: '滴', collectedWeek: s.week, consent: true, holder: 'PLAYER' });
      donor.visits.push({ batchId: batch.id, eventId, week: s.week, tearId: id });
      c.note(`实际取得${donor.name}自愿的一滴`, `1行动。${donor.name}，${donor.age}岁，原人物${donor.id}。${event}原小瓶${id}，本批${batch.tears.length}/7名不同成人；没有制造悲伤或隐秘控制。`); return;
    }
    case 'BREW': {
      const batch = state.batches.find(item => item.id === command.batchId)!, bottleId = `manipulator-potion-${batchNumber(batch)}`;
      s.actionsRemaining -= 1; batch.status = 'BREWED'; batch.brewedWeek = s.week; batch.bottleId = bottleId;
      for (const item of [...batch.materials, ...batch.tears]) item.holder = 'CONSUMED';
      state.bottles.push({ id: bottleId, batchId: batch.id, sourceItemIds: sourceIds(batch), brewedWeek: s.week, status: 'PLAYER', consumedWeek: null, outcome: null, ritualId: null, ritualWindowWeek: null });
      c.note('十份真实原来源调成一瓶操纵师魔药', `1行动，${batch.id}的三组原材料与七名不同成人各一滴全部实际耗尽，调成唯一原瓶${bottleId}。材料清单经过核对，不编造原著未给的调配先后；尚未饮用，万人仪式须另行实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week;
      c.note('申请后三批原材料', `已有原瓶全部真实耗尽且失败。1行动提出申请，最早第${s.week + 1}周到货；现在没有新材料，后续每批仍要独立付款、新访七人、新取七滴。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.batches.length + 1;
      for (let offset = 0; offset < 3; offset += 1) state.batches.push(freshBatch(first + offset, s.week));
      state.resupply.deliveries += 1; state.resupply.requestedWeek = null;
      c.note('后三批三组原材料实际入库', `第${s.week}周，批次${first}至${first + 2}进入原供应方库存，0行动，尚未付款交付。没有附送泪水、魔药或旧集会窗口；原失败瓶与全部原事件保留。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, gathering = currentManipulatorGathering(s)!;
      const result = c.check('will', 28), success = result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS';
      bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.outcome = result.tier;
      bottle.ritualId = gathering.id; bottle.ritualWindowWeek = gathering.windowWeek;
      if (success) {
        const mindCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mindCost); state.dreamwalkerActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 4; s.progression.acting = 0;
        for (const id of MANIPULATOR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        closeManipulatorRitual(s, bottle.id);
        c.note('在当前万人共鸣中成为操纵师', `${bottle.id}在真实集会${gathering.id}的本周共鸣窗口耗尽。意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}；精神−${mindCost}，四属性各+1。梦境行者消化100与全部旧掌握保留，三项新掌握从0开始；灵性上限120但当前不补满。参与者实际沿原路回家，旧共鸣不能再次用药。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        closeManipulatorRitual(s, bottle.id);
        c.note(severe ? '操纵师魔药严重排异' : '操纵师魔药排异', `${bottle.id}在${gathering.id}真实共鸣中耗尽；意志${result.roll}/${result.chance}，健康−${healthCost}、精神−${mindCost}、排异+${pollution}。本作G监督仅让此次药物排异保底1。仍为梦境行者，旧消化与掌握不变。参与者实际散场，过去经历保留；另一原瓶须另付集会费用、等下一真实周并形成新的真实共鸣。`);
      }
      return;
    }
  }
}
export function applyManipulatorCommand(s: SliceState, command: ManipulatorCommand, c: SeerContext): void {
  rule(validateManipulatorCommand(command), '操纵师命令无效。');
  if (validateManipulatorAcquisitionCommand(command)) return applyManipulatorAcquisition(s, command, c);
  if (validateManipulatorRitualCommand(command)) return applyManipulatorRitualCommand(s, command, c);
  if (validateManipulatorEncounterCommand(command)) return applyManipulatorEncounterCommand(s, command, c);
  throw new Error('操纵师生活实践须由共享入口结算实际掌握与消化。');
}

export function projectManipulator(s: SliceState): ManipulatorProjection {
  const state = s.manipulator, available = knownChannel(s), promoted = hasManipulatorHistory(s), known = available && state.guidanceKnown, actions: ManipulatorAction[] = [];
  const add = (id: string, label: string, cost: string, command: ManipulatorAcquisitionCommand) => {
    const reason = manipulatorAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!known) add('learn-manipulator-guidance', '了解完整材料、万人共鸣与四档风险', '1行动 · 520便士', { type: 'LEARN_GUIDANCE' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-manipulator-supply', '确认后三批原材料实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周 · 尚须付款`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-manipulator-supply', '申请后三批原材料', '1行动 · 下一真实周起到货', { type: 'REQUEST_SUPPLY' });
      for (const batch of state.batches) {
        const number = batchNumber(batch);
        if (batch.status === 'SUPPLIER') {
          if (batch.labourSteps < 5) add(`work-${batch.id}`, `第${number}批 · ${MANIPULATOR_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/5 · 五次抵5600便士`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `领取第${number}批三组原材料`, `0行动 · ${materialPrice(batch)}便士 · 不含七滴泪水`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (batch.status === 'PLAYER') {
          for (const donor of Object.values(state.donors)) if (!batch.tears.some(tear => tear.donorId === donor.id)) add(`tear-${batch.id}-${donor.id}`, `第${number}批 · 亲访${donor.name}取得自愿一滴`, `1行动 · ${donor.age}岁 · ${donor.location} · ${donor.emotion}`, { type: 'COLLECT_TEAR', batchId: batch.id, donorId: donor.id });
          add(`brew-${batch.id}`, `核对十份原来源，调配第${number}批`, `1行动 · 三组材料 + 七位不同成人各1滴（${batch.tears.length}/7）`, { type: 'BREW', batchId: batch.id });
        }
      }
      for (const bottle of state.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `在当前万人共鸣中服用${bottle.id}`, `0行动 · 独立确认 · 梦境行者${s.progression.acting}/100 · ${dreamwalkerWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '操纵师 · 序列4' : '操纵师之路', discovered: available, guidanceKnown: known, promoted,
    formulaKnown: known, formula: known ? MANIPULATOR_FORMULA.map(item => ({ ...item })) : [], formulaAlternatives: known ? MANIPULATOR_FORMULA_ALTERNATIVES : '',
    actions: available && ![3,2].includes(s.progression.sequence??0) ? [...actions, ...manipulatorRitualActions(s), ...manipulatorLifeActions(s), ...manipulatorEncounterActions(s)] : [],
    batches: known ? state.batches.map(batch => ({
      id: batch.id, title: `第${batchNumber(batch)}批 · 三组材料与七滴泪水`, source: batch.source,
      status: batch.status === 'SUPPLIER' ? '原供应方保管' : batch.status === 'PLAYER' ? '三组原材料已交付，等待七滴与调配' : `十份原来源已耗尽，原瓶${batch.bottleId}`,
      labourSteps: batch.labourSteps, price: materialPrice(batch), bottleId: batch.bottleId,
      materials: batch.materials.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit, status: item.holder === 'SUPPLIER' ? '未交付' : item.holder === 'PLAYER' ? '你实际持有' : '调配已耗尽' })),
      tears: batch.tears.map(tear => ({ id: tear.id, donorId: tear.donorId, source: tear.event, status: tear.holder === 'PLAYER' ? '本批原封小瓶 · 1滴' : '本批调配已耗尽 · 1滴' })),
    })) : [],
    donors: known ? Object.values(state.donors).map(donor => ({ id: donor.id, name: donor.name, age: donor.age, location: donor.location, emotion: donor.emotion, story: donor.story, consent: donor.willing ? '当前本人自愿，现场仍须再次确认；不同意便不能取得' : '当前拒绝，不可强取或施加暗示', willing: donor.willing, collectedBatchIds: donor.visits.map(visit => visit.batchId) })) : [],
    bottles: known ? state.bottles.map(bottle => ({
      id: bottle.id, title: `${bottle.id} · 独立操纵师原瓶`, source: `由${bottle.batchId}十份实际原来源于第${bottle.brewedWeek}周调成：${bottle.sourceItemIds.join('、')}。${bottle.ritualId ? `在${bottle.ritualId}第${bottle.ritualWindowWeek}周真实共鸣窗口服用。` : '尚未用于任何集会。'}`,
      status: bottle.status === 'PLAYER' ? '你实际持有，尚未服用' : `原瓶已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，仍为梦境行者' : '排异，仍为梦境行者'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? MANIPULATOR_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.dreamWeaver.manipulatorActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `梦境行者消化${state.dreamwalkerActingAtPromotion}/100与全部旧掌握保留；操纵师扮演${(s.progression.sequence===3||s.progression.sequence===2)?s.dreamWeaver.manipulatorActingAtPromotion:s.progression.acting}/100。` : available ? `梦境行者消化需100（当前${s.progression.acting}/100），晋升后12整周（${dreamwalkerWeeks(s)}/12）；材料、七次实际自愿贡献和当前万人共鸣须分别完成。` : '先完成梦境行者之路。',
    pollution: s.seer.pollution, risk: known ? MANIPULATOR_CONSUMPTION_RISK : '先通过原导师了解操纵师材料与仪式。',
    supplies: known ? `原供应方保管${state.batches.filter(batch => batch.status === 'SUPPLIER').length}批三组材料；持有未用原瓶${state.bottles.filter(bottle => bottle.status === 'PLAYER').length}瓶。${state.resupply.requestedWeek === null ? `后续实际到货${state.resupply.deliveries}次。` : `第${state.resupply.requestedWeek}周申请，下一真实周起实际到货。`}购买不附送泪水，补货不复用旧泪水或旧共鸣。` : '',
    ...(available ? { story: `${MANIPULATOR_FORMULA_STATUS}${MANIPULATOR_RITUAL_SOURCE}${MANIPULATOR_SOURCE_STATUS}` } : {}),
    ritual: projectManipulatorRitual(s), life: projectManipulatorLife(s), encounter: projectManipulatorEncounter(s),
    insideCase: hasManipulatorRitualLock(s) || manipulatorInside(s) || isInsideManipulatorEncounter(s),
    environment: available ? '原导师货栈、七位有独立生活的成年原人物与市民纪念礼堂。采购、会面、调配与入场分别改变真实原物和当前人物状态。' : '',
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateManipulatorAcquisitionCommand(v: unknown): v is ManipulatorAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'CONSUME') return shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true && typeof v.bottleId === 'string' && /^manipulator-potion-[1-9]\d{0,14}$/.test(v.bottleId);
  if (typeof v.batchId !== 'string' || !/^manipulator-batch-[1-9]\d{0,14}$/.test(v.batchId)) return false;
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(String(v.type))) return shape(v, ['type', 'batchId']);
  return v.type === 'COLLECT_TEAR' && shape(v, ['type', 'batchId', 'donorId']) && MANIPULATOR_DONOR_IDS.includes(v.donorId as ManipulatorDonorId);
}
export const isManipulatorAcquisitionCommand = validateManipulatorAcquisitionCommand;
export function validateManipulatorCommand(v: unknown): v is ManipulatorCommand {
  return validateManipulatorAcquisitionCommand(v) || validateManipulatorRitualCommand(v) || isManipulatorActivity(v) || validateManipulatorEncounterCommand(v);
}
export function validateManipulatorState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.manipulator;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'batches', 'bottles', 'donors', 'resupply', 'promotionWeek', 'dreamwalkerActingAtPromotion', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week)) return false;
  if (!Array.isArray(raw.batches) || raw.batches.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length || !record(raw.donors) || !shape(raw.donors, MANIPULATOR_DONOR_IDS)) return false;
  const state = raw as unknown as ManipulatorState, promoted = hasManipulatorHistory(s), firstWeek = s.dreamwalker.promotionWeek ?? s.week, earliestConsumption = firstWeek + 12;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.dreamwalker.promotionWeek, 1, s.week) || !integer(state.promotionWeek, earliestConsumption, s.week) || state.dreamwalkerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===2?DISCERNER_ABILITY_IDS:[]),...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS, ...PSYCHOLOGIST_ABILITY_IDS, ...HYPNOTIST_ABILITY_IDS, ...DREAMWALKER_ABILITY_IDS, ...MANIPULATOR_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?DREAM_WEAVER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.dreamwalkerActingAtPromotion !== null || MANIPULATOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  const latestAcquisition = state.promotionWeek ?? s.week, allTears = new Set<string>(), allBottles = new Set<string>();
  for (const definition of MANIPULATOR_DONORS) {
    const donor = state.donors[definition.id];
    if (!record(donor) || !shape(donor, ['id', 'name', 'age', 'location', 'emotion', 'story', 'source', 'willing', 'visits']) || !Object.entries(definition).every(([key, value]) => donor[key] === value) || donor.source !== donorSource(definition.id) || typeof donor.willing !== 'boolean' || !Array.isArray(donor.visits)) return false;
  }
  let brewedCount = 0;
  for (const [index, batch] of state.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'status', 'materials', 'tears', 'brewedWeek', 'bottleId']) || batch.id !== `manipulator-batch-${index + 1}` || !integer(batch.labourSteps, 0, 5) || !Array.isArray(batch.materials) || batch.materials.length !== 3 || !Array.isArray(batch.tears) || batch.tears.length > 7) return false;
    if (index < 3 ? batch.stockedWeek !== null : !integer(batch.stockedWeek, earliestConsumption + 1, latestAcquisition)) return false;
    if (batch.source !== batchSource(index + 1, batch.stockedWeek)) return false;
    const stockWeek = batch.stockedWeek ?? firstWeek;
    if (index >= 3) {
      const groupStart = Math.floor(index / 3) * 3;
      if (batch.stockedWeek !== state.batches[groupStart]!.stockedWeek) return false;
      if (index === groupStart && state.batches.slice(0, index).some(old => !state.bottles.some(bottle => bottle.batchId === old.id && bottle.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? '') && integer(bottle.consumedWeek, earliestConsumption, stockWeek - 1)))) return false;
    }
    if (!state.guidanceKnown && (batch.labourSteps !== 0 || batch.status !== 'SUPPLIER')) return false;
    if (batch.status === 'SUPPLIER') {
      if (batch.acquiredWeek !== null || batch.tears.length || batch.brewedWeek !== null || batch.bottleId !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(batch.acquiredWeek, stockWeek, latestAcquisition)) return false;
      if (batch.status === 'PLAYER') { if (batch.brewedWeek !== null || batch.bottleId !== null) return false; }
      else if (batch.status === 'BREWED') {
        brewedCount += 1;
        if (!integer(batch.brewedWeek, batch.acquiredWeek, latestAcquisition) || batch.bottleId !== `manipulator-potion-${index + 1}` || batch.tears.length !== 7) return false;
      } else return false;
    }
    const holder = batch.status === 'BREWED' ? 'CONSUMED' : batch.status;
    for (const [i, item] of batch.materials.entries()) {
      if (!record(item) || !shape(item, ['id', 'kind', 'name', 'quantity', 'unit', 'source', 'holder'])) return false;
      const original = originalMaterials(batch.id)[i]!;
      if (!Object.entries(original).every(([key, value]) => key === 'holder' ? item.holder === holder : item[key] === value)) return false;
    }
    const donorIds = new Set<string>();
    for (const tear of batch.tears) {
      if (!record(tear) || !shape(tear, ['id', 'donorId', 'batchId', 'eventId', 'event', 'quantity', 'unit', 'collectedWeek', 'consent', 'holder']) || !MANIPULATOR_DONOR_IDS.includes(tear.donorId) || donorIds.has(tear.donorId) || allTears.has(tear.id)) return false;
      donorIds.add(tear.donorId); allTears.add(tear.id);
      if (tear.batchId !== batch.id || tear.id !== `${batch.id}-${tear.donorId}-tear` || tear.eventId !== `${batch.id}-${tear.donorId}-visit` || tear.quantity !== 1 || tear.unit !== '滴' || tear.consent !== true || tear.holder !== holder || !integer(tear.collectedWeek, batch.acquiredWeek!, batch.brewedWeek ?? latestAcquisition)) return false;
      const donor = state.donors[tear.donorId], matches = donor.visits.filter(visit => visit.batchId === batch.id);
      if (matches.length !== 1 || matches[0]!.eventId !== tear.eventId || matches[0]!.tearId !== tear.id || matches[0]!.week !== tear.collectedWeek) return false;
      const visitIndex = donor.visits.indexOf(matches[0]!);
      const eventDonor = { ...donor, visits: donor.visits.slice(0, visitIndex) };
      if (tear.event !== tearEvent(eventDonor, batch, tear.collectedWeek)) return false;
    }
  }
  for (const donor of Object.values(state.donors)) {
    const visitedBatches = new Set<string>(); let lastWeek = firstWeek;
    for (const visit of donor.visits) {
      if (!record(visit) || !shape(visit, ['batchId', 'eventId', 'week', 'tearId']) || typeof visit.batchId !== 'string' || visitedBatches.has(visit.batchId) || !integer(visit.week, lastWeek, latestAcquisition)) return false;
      visitedBatches.add(visit.batchId); lastWeek = visit.week;
      if (!state.batches.some(batch => batch.id === visit.batchId && batch.tears.some(tear => tear.id === visit.tearId && tear.donorId === donor.id && tear.eventId === visit.eventId && tear.collectedWeek === visit.week))) return false;
    }
  }
  if (brewedCount !== state.bottles.length) return false;
  let successes = 0; const usedRituals = new Set<string>();
  for (const bottle of state.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'sourceItemIds', 'brewedWeek', 'status', 'consumedWeek', 'outcome', 'ritualId', 'ritualWindowWeek']) || typeof bottle.id !== 'string' || allBottles.has(bottle.id) || !Array.isArray(bottle.sourceItemIds)) return false;
    allBottles.add(bottle.id);
    const batch = state.batches.find(item => item.id === bottle.batchId);
    if (!batch || batch.status !== 'BREWED' || batch.bottleId !== bottle.id || batch.brewedWeek !== bottle.brewedWeek || bottle.sourceItemIds.length !== 10 || !sourceIds(batch).every((id, i) => bottle.sourceItemIds[i] === id)) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null || bottle.ritualId !== null || bottle.ritualWindowWeek !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(earliestConsumption, bottle.brewedWeek), latestAcquisition) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? '') || typeof bottle.ritualId !== 'string' || usedRituals.has(bottle.ritualId) || bottle.ritualWindowWeek !== bottle.consumedWeek) return false;
      usedRituals.add(bottle.ritualId);
      const gathering = state.ritual.gatherings.find(item => item.id === bottle.ritualId);
      if (!gathering || gathering.consumedBottleId !== bottle.id || gathering.windowWeek !== bottle.consumedWeek || gathering.closedWeek !== bottle.consumedWeek) return false;
      if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (bottle.consumedWeek !== state.promotionWeek) return false; }
      else if (!promoted && s.progression.acting !== 100) return false;
    } else return false;
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, earliestConsumption, s.week) || promoted || !state.guidanceKnown || !exhaustedSupply(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0)) return false;
  return validateManipulatorRitualState(s) && validateManipulatorLifeState(s) && validateManipulatorEncounter(s);
}

export { MANIPULATOR_ABILITIES } from './content.js';
export type * from './types.js';
