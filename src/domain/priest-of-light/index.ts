import { LIGHT_SEEKER_ABILITY_IDS } from '../light-seeker/types.js';
import {JUSTICE_MENTOR_ABILITY_IDS} from '../justice-mentor/types.js';
import {UNSHADOWED_ABILITY_IDS} from '../unshadowed/types.js';
import { validatePriestOfLightEncounter } from './encounter.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { BARD_ABILITY_IDS } from '../bard/types.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../lightprayer/types.js';
import { SUNPRIEST_ABILITY_IDS } from '../sunpriest/types.js';
import { NOTARY_ABILITY_IDS } from '../notary/types.js';
import { priestOfLightInside, validatePriestOfLightLife } from './life.js';
import { notaryInside } from '../notary/life.js';
import {
  PRIEST_OF_LIGHT_ABILITIES, PRIEST_OF_LIGHT_BATCH_IDS, PRIEST_OF_LIGHT_CONSUMPTION_RISK, PRIEST_OF_LIGHT_FORMULA,
  PRIEST_OF_LIGHT_FORMULA_SOURCE, PRIEST_OF_LIGHT_GUIDE, PRIEST_OF_LIGHT_MIN_NOTARY_WEEKS, PRIEST_OF_LIGHT_PRICES, PRIEST_OF_LIGHT_LABOUR_STEPS,
  PRIEST_OF_LIGHT_LABOUR_TASKS, PRIEST_OF_LIGHT_SOURCE_STATUS, PRIEST_OF_LIGHT_RITUAL_SOURCE,
} from './content.js';
import {
  PRIEST_OF_LIGHT_ABILITY_IDS, PRIEST_OF_LIGHT_CASE_IDS, type PriestOfLightCommand, type PriestOfLightAcquisitionCommand, type PriestOfLightAction, type PriestOfLightBatch,
  type PriestOfLightProjection, type PriestOfLightState,
} from './types.js';

function createBatch(number: number): PriestOfLightBatch {
  const id = `priest-of-light-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: PRIEST_OF_LIGHT_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.supplyQuantity, unit: material.unit,
      source: `原礼拜堂工作间光之祭司备料第${number}批`, holder: 'SUPPLIER',
    })),
  };
}

export function createPriestOfLightState(): PriestOfLightState {
  return {
    formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: PRIEST_OF_LIGHT_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], promotionWeek: null, notaryActingAtPromotion: null,
    cases: Object.fromEntries(PRIEST_OF_LIGHT_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])) as PriestOfLightState['cases'],
    practice: { lanternPosition: 'NEAR', auraOpen: false, spiritDistressed: false, lightChecks: 0, trace: 'PRESENT', auraChecks: 0 },
    reflected: false,
    ritual: { requestedWeek: null, visitWeek: null, location: 'GUIDE', helperPresent: false, darkness: false, nonMeltingIce: false, visits: 0, consumptions: 0, history: [] },
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'sun' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isNotary = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.bard.discovered && s.bard.guidanceKnown && s.lightprayer.guidanceKnown && s.sunpriest.formulaKnown && s.notary.formulaKnown && s.notary.promotionWeek !== null && (isNotary(s) || promoted(s));
const materialPrice = (batch: PriestOfLightBatch) => PRIEST_OF_LIGHT_PRICES.auxiliaryMaterials + (batch.labourSteps === PRIEST_OF_LIGHT_LABOUR_STEPS ? 0 : PRIEST_OF_LIGHT_PRICES.mainMaterials);
const bottleId = (batch: PriestOfLightBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<PriestOfLightBatch, 'id'>) => Number(batch.id.slice('priest-of-light-batch-'.length));
const notaryWeeks = (s: SliceState) => Math.max(0, (s.priestOfLight.promotionWeek ?? s.week) - (s.notary.promotionWeek ?? s.week));
const failedBatch = (priestOfLight: PriestOfLightState, batch: PriestOfLightBatch) => batch.brewed && priestOfLight.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (priestOfLight: PriestOfLightState) => priestOfLight.batches.length >= 3 && priestOfLight.bottles.length === priestOfLight.batches.length && priestOfLight.batches.every(batch => failedBatch(priestOfLight, batch));

function commandBlock(s: SliceState, command: PriestOfLightAcquisitionCommand): string | null {
  const m = s.priestOfLight, r = m.ritual;
  // Original assistants can always remove the original body at zero AP, before or after a dose.
  if (command.type === 'END_RITUAL') return r.location === 'ICE' ? null : '你的原身体当前不在原不融冰内。';
  if (command.type === 'RETURN_GUIDE') return r.location === 'CHAMBER' ? null : r.location === 'ICE' ? '先0行动请原助手实际移冰撤出，再按已付原路返回。' : '你已在原指导者处，无须重复返回。';
  const ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW', 'REQUEST_RITUAL', 'GO_RITUAL'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (Object.values(m.cases).some(scene => scene.contactOpen) || m.practice.auraOpen || m.practice.spiritDistressed || m.practice.lanternPosition !== 'NEAR' || notaryInside(s)) return '先实际收束原实践、关闭光环、请原主人安抚栖灯并沿原路归还原灯。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德原礼拜堂工作间。';
  if (!knownChannel(s)) return '成为公证人并保有原指导者渠道后，才能继续光之祭司之路。';
  if (promoted(s)) return '你已完成光之祭司晋升，不能重复服用或继续准备这份魔药；仍可0行动实际撤出并返回。';
  if (r.location !== 'GUIDE' && !['BEGIN_RITUAL', 'CONSUME'].includes(command.type)) return '先实际撤出原冰室并按已付普通原路返回指导者处，再进行筹备。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.priestOfLight.formulaKnown) return '已经掌握光之祭司配方。';
    return s.cash < PRIEST_OF_LIGHT_PRICES.formula ? '光之祭司配方指导需要460便士。' : null;
  }
  if (!s.priestOfLight.formulaKnown) return '先完成光之祭司配方指导。';
  if (command.type === 'REQUEST_RITUAL') return r.requestedWeek !== null ? '已预约原冰室，最早下一真实周实际出发。' : null;
  if (command.type === 'GO_RITUAL') {
    if (r.requestedWeek === null) return '先向原导师预约原地窖冰室与成年助手。';
    if (s.week <= r.requestedWeek) return `最早第${r.requestedWeek + 1}周出发，必须跨过真实周末。`;
    return s.cash < PRIEST_OF_LIGHT_PRICES.ritualTravel ? '本地普通往返须预付180便士。' : null;
  }
  if (command.type === 'BEGIN_RITUAL') {
    if (r.location !== 'CHAMBER' || !r.helperPresent) return '须实际到达原地窖，原成年导师与助手真实在场。';
    if (r.history.at(-1)?.consumedBottleId !== null) return '本次到访已用过一原瓶，须返回后重新预约下一真实周。';
    return s.cash < PRIEST_OF_LIGHT_PRICES.ritualAssistance ? '本次原冰室操作与实际喂药、撤出协助须另付120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.priestOfLight.resupply.requestedWeek !== null) return '已经向指导者申请下一轮光之祭司材料，请等到下一个真实周。';
    return exhaustedSupply(s.priestOfLight) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.priestOfLight.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮光之祭司材料并完成备料准备。';
    if (!exhaustedSupply(s.priestOfLight)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.priestOfLight.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选光之祭司原瓶不存在或已经用完。';
    if (r.location !== 'ICE' || !r.helperPresent || !r.darkness || !r.nonMeltingIce || !r.history.at(-1)?.entered) return '原身体必须实际埋在原正常不融冰内，现场普通完全遮光，原成年导师在场协助喂服真实原瓶。';
    if (r.history.at(-1)?.consumedBottleId !== null) return '本次到访已经用过一原瓶，请先实际撤出并返回，下一真实周另约。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先0行动撤出返程休养。';
    if (s.progression.acting < 100) return `公证人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.notary.promotionWeek === null || notaryWeeks(s) < PRIEST_OF_LIGHT_MIN_NOTARY_WEEKS) return `成为公证人后已度过${notaryWeeks(s)}/${PRIEST_OF_LIGHT_MIN_NOTARY_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (!('batchId' in command)) return '未知准备事项。';
  const batch = s.priestOfLight.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批光之祭司材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= PRIEST_OF_LIGHT_LABOUR_STEPS ? '这批五次劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成光之祭司原瓶。';
  if (batch.materials.length !== PRIEST_OF_LIGHT_FORMULA.length || !batch.materials.every((material, index) => {
    const expected = PRIEST_OF_LIGHT_FORMULA[index]!;
    return material.id === `${batch.id}:${expected.id}` && material.name === expected.name && material.unit === expected.unit && material.source === `原礼拜堂工作间光之祭司备料第${batchNumber(batch)}批` && material.holder === 'PLAYER' && material.quantity === expected.supplyQuantity;
  })) return '这一批现有材料不完整，不能混用其它批次材料。';
  return s.cash < PRIEST_OF_LIGHT_PRICES.brewing ? '调配台使用需要100便士。' : null;
}

/** The shared slice owns the working copy and commits the whole intent atomically. */
export function applyPriestOfLightAcquisition(s: SliceState, command: PriestOfLightAcquisitionCommand, c: SeerContext): void {
  rule(validPriestOfLightAcquisitionCommand(command), '光之祭司准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'REQUEST_RITUAL':
      s.actionsRemaining -= 1; s.priestOfLight.ritual.requestedWeek = s.week;
      c.note('预约原地窖黑暗冰室', `花1行动，由原导师预约既有冰室与成年助手，记录第${s.week}周请求，最早第${s.week + 1}周实际出发。现在没有移动、遮光、埋冰或服药。${PRIEST_OF_LIGHT_RITUAL_SOURCE}`); return;
    case 'GO_RITUAL': {
      const r = s.priestOfLight.ritual;
      s.actionsRemaining -= 1; s.cash -= PRIEST_OF_LIGHT_PRICES.ritualTravel;
      r.history.push({ number: r.visits + 1, requestedWeek: r.requestedWeek!, visitWeek: s.week, entered: false, returned: false, consumedBottleId: null });
      r.requestedWeek = null; r.visitWeek = s.week; r.visits += 1; r.location = 'CHAMBER';
      r.helperPresent = true; r.darkness = false; r.nonMeltingIce = false;
      c.note('沿普通本地行程到达原地窖', '花1行动、180便士，沿原礼拜堂步道实际抵达封闭地窖，普通往返已预付。原成年导师与助手在场，专业封存的原正常不融冰PL5-ICE-1仍在原装置内；你的原身体尚未入冰，地窖尚未完全遮光。世界城市仍是贝克兰德。即使行动用尽，也可0行动按已付普通原路返回，没有传送或凭空制造冰。'); return;
    }
    case 'BEGIN_RITUAL': {
      const r = s.priestOfLight.ritual;
      s.cash -= PRIEST_OF_LIGHT_PRICES.ritualAssistance;
      r.location = 'ICE'; r.darkness = true; r.nonMeltingIce = true; r.history.at(-1)!.entered = true;
      c.note('原身体实际进入黑暗中的原不融冰', '另付120便士、0行动，原成年导师与受训助手操作既有冰室，核验普通完全遮光后，将你的原身体实际埋在正常情况下不会融化的原冰PL5-ICE-1内。冰源与安全装置为本作虚构G，普通冰不能替代，没有施法造冰或创造黑暗领域。尚未服药；确认后由原导师通过既有狭窄仪式通道喂服所选真实原瓶。可随时0行动请求原助手实际移冰撤出。'); return;
    }
    case 'END_RITUAL': {
      const r = s.priestOfLight.ritual;
      r.location = 'CHAMBER'; r.darkness = false; r.nonMeltingIce = false;
      c.note('原助手实际移冰并撤出原身体', '0行动，原助手打开原冰室并实际移开原冰，将你的原身体移回同一地窖，普通遮光随开门解除。原冰PL5-ICE-1仍保存在原装置，不被施法消耗，也不进入玩家背包。服药前后、成功或失败都能撤出，120便士不退，原瓶与健康、精神、灵性不恢复；尚须0行动按已付原路返回。'); return;
    }
    case 'RETURN_GUIDE': {
      const r = s.priestOfLight.ritual;
      r.history.at(-1)!.returned = true; r.location = 'GUIDE'; r.visitWeek = null;
      r.helperPresent = false; r.darkness = false; r.nonMeltingIce = false;
      c.note('沿已付普通原路回到指导者处', '0行动，你实际沿地窖原步道回到贝克兰德原礼拜堂工作间，原成年导师结束本次协助。可不服药就离开，已付180便士普通往返不退款、不另收费；原瓶、伤势、精神、灵性与实际到访记录保留。下一次须重新预约并至少跨到下一真实周。'); return;
    }

    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= PRIEST_OF_LIGHT_PRICES.formula;
      s.priestOfLight.formulaKnown = true;
      c.note('记下光之祭司配方', `花费1行动、460便士，向同一位${PRIEST_OF_LIGHT_GUIDE}学习六项材料。红冠没有已核重量，本作每批供货一份原红冠；本次使用导师的本作G操作规程，不冒称原著投料次序。${PRIEST_OF_LIGHT_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.priestOfLight.resupply.requestedWeek = s.week;
      c.note('申请下一轮光之祭司材料', `花费1行动，向原${PRIEST_OF_LIGHT_GUIDE}申请下一轮三批材料，并核对六料清单、整理备料记录。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批五次劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.priestOfLight.batches.length + 1;
      s.priestOfLight.batches.push(...PRIEST_OF_LIGHT_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.priestOfLight.resupply.deliveries += 1;
      s.priestOfLight.resupply.requestedWeek = null;
      c.note('光之祭司新一轮备料到货', `原${PRIEST_OF_LIGHT_GUIDE}确认第${firstNumber}至${firstNumber + 2}批六料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成五次劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.priestOfLight.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(`完成${PRIEST_OF_LIGHT_LABOUR_TASKS[batch.labourSteps - 1]}`, `你为第${batchNumber(batch)}批完成一次实际劳动，消耗1行动，进度${batch.labourSteps}/5。${batch.labourSteps === PRIEST_OF_LIGHT_LABOUR_STEPS ? '五次劳动抵本批4200便士主材费；仍须支付600便士辅材费，才会交付整批材料。' : '完成全部五次才能抵本批4200便士主材费；目前材料仍由供应方持有。'}`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.priestOfLight.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('光之祭司材料交付', `第${batchNumber(batch)}批六项材料已交到你手中，支付${paid}便士，0行动。${batch.labourSteps === PRIEST_OF_LIGHT_LABOUR_STEPS ? '五次劳动已抵本批主材费，仅支付600便士辅材费。' : '主材4200便士、辅材600便士；未完成的劳动不能折现。'}本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.priestOfLight.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= PRIEST_OF_LIGHT_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.priestOfLight.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null, consumedWeek: null, ritualVisit: null });
      c.note('一瓶光之祭司魔药', `花费1行动、100便士，在导师指导下将第${batchNumber(batch)}批六项原材料调配成药。六项材料有原著依据，红冠每批1份是本作G供货计量、非原著精确重量；具体操作次序采用本作G导师规程，不把该次序称作原著事实。六项材料已全部消耗，得到独立原瓶${bottleId(batch)}，尚未服用。公证人扮演100且晋升后满12整周才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.priestOfLight.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('原导师实际喂服所选原瓶', `原成年导师在原黑暗冰室旁，通过原预设狭窄仪式通道将真实原瓶${bottle.id}喂给实际埋在原正常不融冰PL5-ICE-1中的原身体。不是梦中、幻象或虚假药液；此瓶本次全部耗尽，随后进行独立意志判定。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      bottle.consumedWeek = s.week; bottle.ritualVisit = s.priestOfLight.ritual.visits;
      s.priestOfLight.ritual.consumptions += 1;
      s.priestOfLight.ritual.history.at(-1)!.consumedBottleId = bottle.id;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.priestOfLight.notaryActingAtPromotion = s.progression.acting;
        s.priestOfLight.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of PRIEST_OF_LIGHT_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为光之祭司', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质、感知、意志与知识各+1。原歌颂者、祈光人、太阳神官与公证人的全部能力掌握完整继承，光之祭司新增两项从0开始；公证人消化成果保留，光之祭司扮演从0开始。灵性上限提高到100，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了光之祭司晋升' : '光之祭司魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是公证人，原有消化与掌握保留。指导者处理了这次服药排异，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }

  }
}

export function projectPriestOfLight(s: SliceState): PriestOfLightProjection {
  const actions: PriestOfLightAction[] = [];
  const available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: PriestOfLightAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.priestOfLight.formulaKnown) add('learn-priest-of-light-formula', '请指导者讲解光之祭司配方', '1行动 · 460便士', { type: 'LEARN_FORMULA' });
    else {
      if (s.priestOfLight.resupply.requestedWeek !== null) {
        add('receive-priest-of-light-supply', '确认下一轮三批光之祭司材料到货', `0行动 · 最早第${s.priestOfLight.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
      } else if (exhaustedSupply(s.priestOfLight)) {
        add('request-priest-of-light-supply', '向原指导者申请下一轮光之祭司材料', '1行动 · 核对清单并整理调配记录 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
      }
      for (const batch of s.priestOfLight.batches) {
        const number = batchNumber(batch);
        if (!batch.acquired) {
          if (batch.labourSteps < PRIEST_OF_LIGHT_LABOUR_STEPS) add(`work-${batch.id}`, `第${number}批 · ${PRIEST_OF_LIGHT_LABOUR_TASKS[batch.labourSteps]}`, `1行动 · 劳动${batch.labourSteps}/5，完成五次抵4200便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
          add(`buy-${batch.id}`, `第${number}批 · 领取六项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === PRIEST_OF_LIGHT_LABOUR_STEPS ? '（仅付四项辅材）' : '（主材4200＋辅材600）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
        } else if (!batch.brewed) add(`brew-${batch.id}`, `第${number}批 · 调配光之祭司魔药`, '1行动 · 100便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
      for (const bottle of s.priestOfLight.bottles) if (bottle.status === 'PREPARED') {
        add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批光之祭司原瓶`, `0行动 · 独立确认 · 公证人扮演${s.progression.acting}/100 · 晋升后${notaryWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const ritual = s.priestOfLight.ritual;
  if (ritual.location === 'ICE') add('priest-of-light-end-ritual', '请原助手实际移冰并撤出原身体', '0行动 · 打开冰室结束遮光 · 不退款或补资源', { type: 'END_RITUAL' });
  if (ritual.location === 'CHAMBER') {
    if (available && !isPromoted && ritual.history.at(-1)?.consumedBottleId === null) add('priest-of-light-begin-ritual', '付协助费并让原身体实际埋入黑暗中的原不融冰', '0行动 · 120便士 · 原成年导师与助手操作原装置', { type: 'BEGIN_RITUAL' });
    add('priest-of-light-return-guide', '沿已付普通原路实际返回指导者处', '0行动 · 可未服药离开 · 原步道返程', { type: 'RETURN_GUIDE' });
  }
  if (available && !isPromoted && s.priestOfLight.formulaKnown && ritual.location === 'GUIDE') {
    if (ritual.requestedWeek === null) add('priest-of-light-request-ritual', '向原导师预约黑暗冰室仪式', '1行动 · 最早下一真实周出发', { type: 'REQUEST_RITUAL' });
    else add('priest-of-light-go-ritual', '实际前往预约的原地窖', `1行动 · 180便士普通往返 · 最早第${ritual.requestedWeek + 1}周`, { type: 'GO_RITUAL' });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.priestOfLight.batches.filter(batch => !batch.acquired).length;
  const prepared = s.priestOfLight.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    title: isPromoted ? '光之祭司 · 序列5' : '光之祭司之路', discovered: available,
    formulaKnown: available && s.priestOfLight.formulaKnown, promoted: isPromoted,
    formula: available && s.priestOfLight.formulaKnown ? PRIEST_OF_LIGHT_FORMULA.map(material => ({ name: material.name, quantity: material.quantity, unit: material.quantity === null ? '' : material.unit, ...('note' in material ? { note: material.note } : {}) })) : [],
    actions,
    ritual: projectPriestOfLightRitual(s), practice: null,
    bottles: available ? s.priestOfLight.bottles.map(bottle => ({
      id: bottle.id, title: `第${batchNumber({ id: bottle.batchId })}批 · 光之祭司魔药`,
      source: `${PRIEST_OF_LIGHT_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的六项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PRIEST_OF_LIGHT_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.unshadowed.priestOfLightActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?'光之祭司魔药已消化；原冰、原灯与旧善后结果保留，能力掌握仍按实际使用记录。':isPromoted ? `公证人消化成果${s.priestOfLight.notaryActingAtPromotion}/100已保留；光之祭司扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成公证人消化（${s.progression.acting}/100），并在公证人晋升后度过12整周（${notaryWeeks(s)}/12）。配方与材料可以提前准备。` : '先走完公证人之路。',
    pollution: s.seer.pollution,
    cases: [], insideCase: priestOfLightInside(s), environment: '',
    ...(available ? { story: `${PRIEST_OF_LIGHT_FORMULA_SOURCE}${PRIEST_OF_LIGHT_RITUAL_SOURCE}${PRIEST_OF_LIGHT_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。红冠按本作G每批供货一份原批，原著未给明确重量，其余五项按已核用量供货。${s.priestOfLight.resupply.requestedWeek === null ? `已实际接收后续材料${s.priestOfLight.resupply.deliveries}轮，每轮3批。` : `第${s.priestOfLight.resupply.requestedWeek}周申请，下一个真实周起收货。`}` : '',
    risk: available ? `步骤：配方指导 → 采购或五次劳动后领取材料 → 调配 → 预约 → 真实跨周出行 → 支付原助手协助并实际进入黑暗原不融冰 → 独立确认原导师喂服真实原瓶 → 0行动实际移冰撤出 → 0行动按已付普通原路返回。光之祭司材料每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${PRIEST_OF_LIGHT_CONSUMPTION_RISK}` : '成为公证人后，可向原有指导者了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validPriestOfLightAcquisitionCommand(value: unknown): value is PriestOfLightAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REQUEST_RITUAL', 'GO_RITUAL', 'BEGIN_RITUAL', 'END_RITUAL', 'RETURN_GUIDE'].includes(value.type as string)) return shape(value, ['type']);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(value.type as string)) return shape(value, ['type', 'batchId']) && typeof value.batchId === 'string' && /^priest-of-light-batch-[1-9]\d{0,14}$/.test(value.batchId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^priest-of-light-batch-[1-9]\d{0,14}:bottle$/.test(value.bottleId);
  return false;
}
export function isPriestOfLightAcquisitionCommand(command: unknown): command is PriestOfLightAcquisitionCommand { return validPriestOfLightAcquisitionCommand(command); }
export function validPriestOfLightCommand(value: unknown): value is PriestOfLightCommand {
  if (validPriestOfLightAcquisitionCommand(value)) return true;
  if (!record(value)) return false;
  if (['REFLECT', 'MOVE_LANTERN', 'RETURN_LANTERN', 'CLEAR_SPIRIT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && PRIEST_OF_LIGHT_CASE_IDS.includes(value.caseId as typeof PRIEST_OF_LIGHT_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && PRIEST_OF_LIGHT_CASE_IDS.includes(value.caseId as typeof PRIEST_OF_LIGHT_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Original materials, independent bottles, finite replenishment and inherited progression. */
export function validPriestOfLightState(s: SliceState): boolean {
  const raw: unknown = s.priestOfLight;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'resupply', 'batches', 'bottles', 'promotionWeek', 'notaryActingAtPromotion', 'cases', 'reflected', 'ritual', 'encounter', 'practice']) || typeof raw.formulaKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.seer) || !record(s.bard) || !record(s.lightprayer) || !record(s.sunpriest) || !record(s.notary)) return false;
  const firstConsumptionWeek = (s.notary.promotionWeek ?? s.week) + PRIEST_OF_LIGHT_MIN_NOTARY_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  const deliveries = raw.resupply.deliveries;
  if (!Array.isArray(raw.batches) || raw.batches.length !== PRIEST_OF_LIGHT_BATCH_IDS.length * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  if (raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0, s.combatHistory.length) || raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, firstConsumptionWeek, s.week)) return false;
  if (!record(raw.cases) || !shape(raw.cases, PRIEST_OF_LIGHT_CASE_IDS) || !Object.values(raw.cases).every(record)) return false;
  if (!record(raw.practice) || !shape(raw.practice, ['lanternPosition', 'auraOpen', 'spiritDistressed', 'lightChecks', 'trace', 'auraChecks']) || !record(raw.ritual)) return false;
  const f = raw as unknown as PriestOfLightState, isPromoted = promoted(s);
  if (f.formulaKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!f.formulaKnown || !integer(s.notary.promotionWeek, 1, s.week) || !integer(f.promotionWeek, firstConsumptionWeek, s.week) || f.notaryActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS, ...NOTARY_ABILITY_IDS, ...PRIEST_OF_LIGHT_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?UNSHADOWED_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?JUSTICE_MENTOR_ABILITY_IDS:[]),...(s.progression.sequence===2?LIGHT_SEEKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
    if (f.encounter.attemptWeek !== null && f.encounter.attemptWeek < f.promotionWeek) return false;
  } else {
    if (f.promotionWeek !== null || f.notaryActingAtPromotion !== null || PRIEST_OF_LIGHT_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (f.encounter.status !== 'AVAILABLE' || f.encounter.startHistoryIndex !== null || f.encounter.attemptWeek !== null) return false;
  }
  if (!validatePriestOfLightLife(s)) return false;
  const e = f.encounter;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'PRIEST_OF_LIGHT_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(f.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && priestOfLightInside(s)) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  // Check records before following cross-references; hostile saves return false, not a crash.
  for (const [index, batch] of f.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `priest-of-light-batch-${index + 1}` || !integer(batch.labourSteps, 0, PRIEST_OF_LIGHT_LABOUR_STEPS) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== PRIEST_OF_LIGHT_FORMULA.length) return false;
    if (batch.brewed && !batch.acquired || !f.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = PRIEST_OF_LIGHT_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || material.source !== `原礼拜堂工作间光之祭司备料第${index + 1}批`) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.supplyQuantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
  }
  for (const bottle of f.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome', 'consumedWeek', 'ritualVisit']) || !integer(bottle.brewedWeek, s.notary.promotionWeek ?? s.week, s.week) || !Array.isArray(bottle.inputIds)) return false;
  }
  let successfulBottles = 0;
  for (const batch of f.batches) if (f.bottles.filter(bottle => bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  for (const bottle of f.bottles) {
    if (isPromoted && bottle.brewedWeek > f.promotionWeek!) return false;
    const batch = f.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== PRIEST_OF_LIGHT_FORMULA.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null || bottle.consumedWeek !== null || bottle.ritualVisit !== null) return false; }
    else if (bottle.status === 'CONSUMED') {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.notary.promotionWeek === null || s.week < firstConsumptionWeek || !isPromoted && s.progression.acting !== 100) return false;
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.brewedWeek), s.week) || !integer(bottle.ritualVisit, 1)) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successfulBottles += 1;
      if (f.promotionWeek === null || bottle.consumedWeek !== f.promotionWeek) return false;
    }
  }
  if (!f.batches.slice(0, deliveries * 3).every(batch => failedBatch(f, batch))) return false;
  let earliestRoundWeek = firstConsumptionWeek;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(f.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = f.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.consumedWeek ?? bottle.brewedWeek)) + 1;
  }
  if (f.resupply.requestedWeek !== null && (!f.formulaKnown || isPromoted || !exhaustedSupply(f) || f.resupply.requestedWeek < Math.max(firstConsumptionWeek + deliveries, ...f.bottles.map(bottle => bottle.consumedWeek ?? bottle.brewedWeek)))) return false;
  return successfulBottles === (isPromoted ? 1 : 0) && validatePriestOfLightRitual(s) && validatePriestOfLightEncounter(s);
}

// Conventional aliases keep the domain entry points consistent with older stages.
export const applyPriestOfLightCommand = applyPriestOfLightAcquisition;
export const validatePriestOfLightState = validPriestOfLightState;
export const validatePriestOfLightCommand = validPriestOfLightCommand;
export const validatePriestOfLightAcquisitionCommand = validPriestOfLightAcquisitionCommand;
export { applyPriestOfLightActivity } from './life.js';
export type * from './types.js';

export function projectPriestOfLightRitual(s: SliceState): PriestOfLightProjection['ritual'] {
  const r = s.priestOfLight.ritual;
  return {
    location: r.location, helperPresent: r.helperPresent, darkness: r.darkness, nonMeltingIce: r.nonMeltingIce, visits: r.visits, consumptions: r.consumptions,
    source: knownChannel(s) ? PRIEST_OF_LIGHT_RITUAL_SOURCE : '',
    status: r.location === 'ICE' ? '原身体实际埋在原正常不融冰内，普通完全遮光有效'
      : r.location === 'CHAMBER' ? '已实际到达原地窖，当前在原冰室外'
        : r.requestedWeek !== null ? `第${r.requestedWeek}周已预约，最早第${r.requestedWeek + 1}周实际出发` : '当前在原指导者处，尚未预约下一次黑暗冰室仪式',
    summary: r.location !== 'GUIDE' ? `本次为第${r.visits}次真实到访，原成年导师与助手${r.helperPresent ? '真实在场' : '不在场'}；同一原正常不融冰PL5-ICE-1保留在专业原装置。${r.history.at(-1)?.consumedBottleId ? `本次已实际喂服原瓶${r.history.at(-1)!.consumedBottleId}，不能再服一瓶。` : '本次尚未服药，可以放弃后返回。'}${r.location === 'ICE' ? '先0行动请原助手开室、实际移冰并撤出原身体；' : ''}再0行动按已付普通原路返回。没有退款、隐式撤出或补资源。`
      : '180便士预付本地普通往返；实际埋入原不融冰、完全遮光与原成年导师喂药协助另付120便士。每次最多服一真实原瓶，下一次须重新预约并至少等下一真实周。',
  };
}

/** Every consumed original bottle must point to one entered actual visit after a prior-week request. */
export function validatePriestOfLightRitual(s: SliceState): boolean {
  const m = s.priestOfLight, r = m.ritual;
  if (!record(r) || !shape(r, ['requestedWeek', 'visitWeek', 'location', 'helperPresent', 'darkness', 'nonMeltingIce', 'visits', 'consumptions', 'history'])) return false;
  if (!['GUIDE', 'CHAMBER', 'ICE'].includes(r.location) || ![r.helperPresent, r.darkness, r.nonMeltingIce].every(v => typeof v === 'boolean') || !integer(r.visits, 0) || !integer(r.consumptions, 0, r.visits) || !Array.isArray(r.history) || r.history.length !== r.visits) return false;
  const earliest = s.notary.promotionWeek ?? s.week;
  if (r.requestedWeek !== null && !integer(r.requestedWeek, earliest, s.week)) return false;
  if (r.visitWeek !== null && !integer(r.visitWeek, earliest + 1, s.week)) return false;
  if (!m.formulaKnown && (r.requestedWeek !== null || r.visits !== 0)) return false;
  let lastVisitWeek = 0, consumed = 0;
  const consumedIds = new Set<string>();
  for (const [i, h] of r.history.entries()) {
    if (!record(h) || !shape(h, ['number', 'requestedWeek', 'visitWeek', 'entered', 'returned', 'consumedBottleId']) || h.number !== i + 1 || !integer(h.requestedWeek, Math.max(earliest, lastVisitWeek), s.week) || !integer(h.visitWeek, h.requestedWeek + 1, s.week) || typeof h.entered !== 'boolean' || typeof h.returned !== 'boolean') return false;
    if (promoted(s) && h.visitWeek > m.promotionWeek!) return false;
    if (!h.returned && (i !== r.history.length - 1 || r.location === 'GUIDE')) return false;
    lastVisitWeek = h.visitWeek;
    if (h.consumedBottleId !== null) {
      if (typeof h.consumedBottleId !== 'string' || !h.entered || consumedIds.has(h.consumedBottleId)) return false;
      const bottle = m.bottles.find(b => b.id === h.consumedBottleId);
      if (!bottle || bottle.status !== 'CONSUMED' || bottle.ritualVisit !== h.number || bottle.consumedWeek !== h.visitWeek) return false;
      consumedIds.add(h.consumedBottleId); consumed += 1;
    }
  }
  if (r.consumptions !== consumed || consumed !== m.bottles.filter(b => b.status === 'CONSUMED').length) return false;
  if (r.requestedWeek !== null && (r.location !== 'GUIDE' || promoted(s) || r.requestedWeek < lastVisitWeek)) return false;
  if (r.location === 'GUIDE') return r.visitWeek === null && !r.helperPresent && !r.darkness && !r.nonMeltingIce && r.history.every(h => h.returned);
  if (r.darkness !== (r.location === 'ICE') || r.nonMeltingIce !== (r.location === 'ICE')) return false;
  return r.visits > 0 && r.requestedWeek === null && r.visitWeek === s.week && s.world.city === 'BACKLUND' && s.activeEvent === null && s.combat === null && r.helperPresent && r.history.at(-1)?.returned === false && r.history.at(-1)?.visitWeek === r.visitWeek && (r.location !== 'ICE' || r.history.at(-1)?.entered === true) && !Object.values(m.cases).some(c => c.contactOpen) && !m.practice.auraOpen && !m.practice.spiritDistressed && m.practice.lanternPosition === 'NEAR' && !notaryInside(s);
}
export { priestOfLightInside } from './life.js';
export { PRIEST_OF_LIGHT_ABILITIES } from './content.js';
