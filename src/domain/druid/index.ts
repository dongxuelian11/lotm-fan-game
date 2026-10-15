import { BARREN_MATRIARCH_ABILITY_IDS } from '../barren-matriarch/types.js';
import {COFFIN_BEARER_ABILITY_IDS} from '../coffin-bearer/types.js';
import {ANCIENT_ALCHEMIST_ABILITY_IDS} from '../ancient-alchemist/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../cultivator/types.js';
import { PHYSICIAN_ABILITY_IDS } from '../physician/types.js';
import { HARVESTPRIEST_ABILITY_IDS } from '../harvestpriest/types.js';
import { BIOLOGIST_ABILITY_IDS } from '../biologist/types.js';
import { druidInside, validateDruidLife } from './life.js';
import { hasBiologistOpenPractice } from '../biologist/encounter.js';
import { validateDruidEncounter } from './encounter.js';
import {
  DRUID_ABILITIES, DRUID_BOTTLE_IDS, DRUID_CONSUMPTION_RISK, DRUID_FORMULA_STATUS,
  DRUID_GUIDE, DRUID_LABOUR_TASKS, DRUID_STUDY_SOURCES, DRUID_NOTEBOOK_ID, DRUID_MIN_BIOLOGIST_WEEKS, DRUID_POTION_SOURCES, DRUID_PRICES, DRUID_SOURCE_STATUS,
} from './content.js';
import {
  DRUID_ABILITY_IDS, DRUID_CASE_IDS, type DruidAcquisitionCommand, type DruidAction,
  freshDruidPractice, DRUID_STUDY_SOURCE_IDS, type DruidStudySourceId, type DruidBottle, type DruidCommand, type DruidPractice, type DruidProjection, type DruidState,
} from './types.js';

export function createDruidState(): DruidState {
  return {
    guidanceKnown: false,
    bottles: DRUID_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, biologistActingAtPromotion: null,
    ritual: { studies: Object.fromEntries(DRUID_STUDY_SOURCE_IDS.map(id => [id, { attemptWeek: null, completedWeek: null }])) as DruidState['ritual']['studies'], recordAttemptWeek: null, recordWrittenWeek: null, readyWeek: null, attempts: 0 },
    cases: Object.fromEntries(DRUID_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshDruidPractice(),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isBiologist = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.cultivator.discovered && s.cultivator.guidanceKnown && s.physician.guidanceKnown && s.harvestpriest.guidanceKnown && s.biologist.guidanceKnown && s.biologist.promotionWeek !== null && (isBiologist(s) || promoted(s));
const potionPrice = (bottle: DruidBottle) => DRUID_PRICES.potion - (bottle.labourSteps === 5 ? DRUID_PRICES.labourCredit : 0);
const bottleNumber = (bottle: DruidBottle) => Number(bottle.id.slice('druid-potion-'.length));
const biologistWeeks = (s: SliceState) => Math.max(0, (s.druid.promotionWeek ?? s.week) - (s.biologist.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => hasBiologistOpenPractice(s) || [s.cultivator, s.physician, s.harvestpriest, s.biologist].some(previous => Object.values(previous.cases).some(value => value.contactOpen || value.status === 'PREPARED'));
const supplyExhausted = (state: DruidState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${DRUID_GUIDE}的独立德鲁伊成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5德鲁伊魔药，原瓶druid-potion-${number}，非耕种者、医师、丰收祭司或生物学家旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: DruidAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'STUDY', 'WRITE_RECORD', 'PREPARE_RITE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (druidInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原苗圃训练园，找到伊芙·莫兰。';
  if (!knownChannel(s)) return '成为生物学家并保有伊芙·莫兰的指导渠道后，才能继续了解德鲁伊之路。';
  if (promoted(s)) return '你已完成德鲁伊晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.druid.guidanceKnown) return '已经听过德鲁伊成品魔药的用药说明。';
    return s.cash < DRUID_PRICES.guidance ? '德鲁伊用药指导需要460便士。' : null;
  }
  if (!s.druid.guidanceKnown) return '先听伊芙·莫兰说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.druid.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.druid) ? null : '须先用完现有全部德鲁伊原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.druid.resupply.requestedWeek === null) return '尚未申请下一批德鲁伊补给。';
    if (s.week <= s.druid.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.druid) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  if (command.type === 'STUDY') {
    const study = s.druid.ritual.studies[command.sourceId];
    if (study.completedWeek !== null) return '这份原资料已经实际研习完成，不重复领取知识记录。';
    return study.attemptWeek === s.week ? '本周已研读这份原资料；保留本次笔记，下一真实周才能重试。' : null;
  }
  if (command.type === 'WRITE_RECORD') {
    if (s.druid.ritual.recordWrittenWeek !== null) return '原册已经完成本人知识与经验的书写，不重复完成。';
    if (DRUID_STUDY_SOURCE_IDS.some(id => s.druid.ritual.studies[id].completedWeek === null)) return '先实际完成普通动物与三种不同超凡生物的四项资料研习。';
    return s.druid.ritual.recordAttemptWeek === s.week ? '本周已书写原册；现有文字保留，下一真实周再复核完成。' : null;
  }
  if (command.type === 'PREPARE_RITE') {
    if (s.druid.ritual.recordWrittenWeek === null) return '先完成四项实际研习，并亲自在原册写好知识与经验。';
    if (s.druid.ritual.readyWeek !== null) return '已有本次未使用的实际仪式准备，不能重复付费准备。';
    return s.cash < DRUID_PRICES.rite ? '本次仪式准备需要90便士与1行动。' : null;
  }
  const bottle = s.druid.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选德鲁伊原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.druid.ritual.readyWeek === null) return '每次服药前必须完成四项研习、原册书写，并另付1行动与90便士准备本次仪式。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `生物学家魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.biologist.promotionWeek === null || biologistWeeks(s) < DRUID_MIN_BIOLOGIST_WEEKS) return `成为生物学家后已度过${biologistWeeks(s)}/${DRUID_MIN_BIOLOGIST_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原苗圃训练园劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyDruidCommand(s: SliceState, command: DruidAcquisitionCommand, c: SeerContext): void {
  rule(validateDruidCommand(command) && isDruidAcquisitionCommand(command), '德鲁伊准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= DRUID_PRICES.guidance;
      s.druid.guidanceKnown = true;
      c.note('听取德鲁伊用药说明', `花费1行动、460便士，你向已认识的本作原创成年${DRUID_GUIDE}继续请教，导师向你说明从独立德鲁伊成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、说明四份原资料、同一本原册与每次另付费的仪式准备安排。这些不是原来的耕种者、医师、丰收祭司或生物学家存药。${DRUID_FORMULA_STATUS}生物学家消化须达100，晋升生物学家后满12整周才能服用；可提前筹备。${DRUID_SOURCE_STATUS}`);
      return;
    case 'STUDY': {
      const source = DRUID_STUDY_SOURCES.find(value => value.id === command.sourceId)!;
      const study = s.druid.ritual.studies[command.sourceId];
      s.actionsRemaining -= 1;
      study.attemptWeek = s.week;
      const result = c.check('knowledge', 14);
      const passed = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
      if (passed) study.completedWeek = s.week;
      c.note(`实际研习${source.title}`, `你花费1行动、0灵性，在伊芙原资料柜实际打开同一教学册${source.referenceId}，与导师比较其中${source.creatures.join('、')}的习性和身体构造，把本次亲自理解的简短笔记写入自己的同一本原册${DRUID_NOTEBOOK_ID}，当次将参考册原位归还。${source.source}知识判定${result.roll}/${result.chance}：${passed ? '本项研习完成。' : '本项尚未完成；已付行动与现有笔记保留，下一真实周可再读同一原资料。'}没有取得参考原册、标本或活体，也没有自动得知未读资料。`);
      return;
    }
    case 'WRITE_RECORD': {
      s.actionsRemaining -= 1;
      s.druid.ritual.recordAttemptWeek = s.week;
      const result = c.check('knowledge', 12);
      const passed = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
      if (passed) s.druid.ritual.recordWrittenWeek = s.week;
      c.note('亲自书写德鲁伊知识与经验原册', `花费1行动、0灵性，你用自己的文字在同一本原册${DRUID_NOTEBOOK_ID}整理四项实际资料研习所得：犬、猫、鼠与拉瓦章鱼、成年霍纳奇斯灰山羊、六翼石像鬼的记录所述习性、身体构造及本人学习经验，同时记下仍不清楚的部分。不是抄入未见事实或获得全知。知识判定${result.roll}/${result.chance}：${passed ? '书写与核对完成，原册保留。' : '整理尚未达到要求，已有文字留在原册中，下一真实周可再核对。'}这只是已核实的晋升仪式部分，不声称完整仪式已知。`);
      return;
    }
    case 'PREPARE_RITE':
      s.actionsRemaining -= 1;
      s.cash -= DRUID_PRICES.rite;
      s.druid.ritual.readyWeek = s.week;
      s.druid.ritual.attempts += 1;
      c.note('实际准备本次德鲁伊仪式', `花费1行动和90便士，伊芙当面复核同一本已完成的${DRUID_NOTEBOOK_ID}与四项研习记录，在原苗圃训练园的同一安静房间实际布置本次服药与在场照护。未核实的剩余仪式安排仅作明确原创G的指导准备，不捏造原著完整步骤。本次准备只供接下来一瓶实际服药使用，无论服药成败都会耗去；原研习与书写保留，失败重试必须重新付费准备。没有恢复健康、精神、灵性或行动。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.druid.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = DRUID_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊芙·莫兰的原苗圃训练园实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.druid.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('德鲁伊原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原苗圃训练园劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；生物学家消化100且晋升生物学家后满12整周时，再独立确认服药。${DRUID_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.druid.resupply.requestedWeek = s.week;
      c.note('申请下一批德鲁伊魔药', `现有德鲁伊原瓶全部耗尽且未晋升。你花费1行动，请${DRUID_GUIDE}从同一新渠道订下一批三瓶，并实际核验原苗圃训练园的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.druid.bottles.length + 1;
      s.druid.resupply.deliveries += 1;
      for (let offset = 0; offset < DRUID_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.druid.bottles.push({ id: `druid-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.druid.resupply.requestedWeek = null;
      c.note('下一批德鲁伊原瓶到货', `第${s.week}周，伊芙·莫兰的独立德鲁伊成品交接渠道本作G成品供给第${s.druid.resupply.deliveries + 1}批三瓶实际到货，原瓶druid-potion-${firstNumber}至druid-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.druid.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('使用本次德鲁伊仪式准备', `伊芙在已实际准备的同一安静房间，当面核对原册${DRUID_NOTEBOOK_ID}和你手中的原瓶${bottle.id}，执行本次指导服药。第${s.druid.ritual.readyWeek}周付费完成的这一次准备现在耗去，不能供第二瓶重复使用；已核实的研习与书写部分保留，完整配方与其余原著仪式细节仍未知。`);
      s.druid.ritual.readyWeek = null;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.druid.biologistActingAtPromotion = s.progression.acting;
        s.druid.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of DRUID_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为德鲁伊', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。耕种者、医师、丰收祭司与生物学家全部原能力及原ID掌握完整继承，只新增地下潜行一项，从0掌握开始；生物学家消化成果、原晋升周、原瓶、已完成实践、原物去向和已解决敌人记录均保持原样，德鲁伊扮演从0开始。灵性上限提高到100，当前灵性没有补满。原文地下潜行仅在本作已知普通浅层壤土中有限表达，所有实际距离和代价为G，可失败，必须由同一身体实际返回。没有取得动物变形、全地形穿行或序列4赋灵创造；没有获得组织身份。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了德鲁伊晋升' : '德鲁伊魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是生物学家，消化与全部原有掌握保留，没有获得德鲁伊能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品，并重新花1行动与90便士准备本次仪式；四项研习与原册书写保留。`);
      }
      return;
    }
  }
}

export function projectDruid(s: SliceState): DruidProjection {
  const actions: DruidAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.ancientAlchemist.druidActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: DruidAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    const action: DruidAction = { id, label, cost, command, enabled: reason === null, reason };
    actions.push(action);
    return action;
  };
  const studies = available ? DRUID_STUDY_SOURCES.map(source => {
    const study = s.druid.ritual.studies[source.id];
    const command: DruidAcquisitionCommand = { type: 'STUDY', sourceId: source.id };
    const reason = commandBlock(s, command);
    const action: DruidAction = { id: `study-druid-${source.id}`, label: `研习${source.title}`, cost: '1行动 · 0灵性 · 知识14 · 原册当次归还', enabled: reason === null, reason, command };
    if (!isPromoted) actions.push(action);
    return { id: source.id, title: source.title, source: source.source, creatures: [...source.creatures], completed: study.completedWeek !== null, status: study.completedWeek !== null ? `第${study.completedWeek}周实际完成` : study.attemptWeek === null ? '尚未实际研读' : `第${study.attemptWeek}周已研读但未完成；笔记保留`, action };
  }) : [];
  if (available && !isPromoted) {
    if (!s.druid.guidanceKnown) add('learn-druid-guidance', '请伊芙·莫兰说明德鲁伊成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      add('write-druid-record', '亲自书写知识与经验原册', '1行动 · 0灵性 · 知识12 · 四项研习实际完成后', { type: 'WRITE_RECORD' });
      add('prepare-druid-rite', '复核原册并准备本次仪式', '1行动 · 90便士 · 每瓶都须重新准备', { type: 'PREPARE_RITE' });
      for (const bottle of s.druid.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${DRUID_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶德鲁伊魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.druid.resupply.requestedWeek !== null) add('receive-druid-supply', '确认下一批三瓶德鲁伊到货', `0行动 · 第${s.druid.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.druid)) add('request-druid-supply', '向伊芙·莫兰订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.druid.guidanceKnown) {
    for (const bottle of s.druid.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶德鲁伊魔药`, `0行动 · 独立确认 · 生物学家消化${isPromoted ? s.druid.biologistActingAtPromotion : s.progression.acting}/100 · 晋升后${biologistWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.druid.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.druid.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '德鲁伊 · 序列5' : '德鲁伊之路', discovered: available,
    guidanceKnown: available && s.druid.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.druid.practice }, studies,
    ritual: {
      notebook: DRUID_NOTEBOOK_ID,
      recordStatus: s.druid.ritual.recordWrittenWeek !== null ? `第${s.druid.ritual.recordWrittenWeek}周本人书写并核对完成` : s.druid.ritual.recordAttemptWeek !== null ? `第${s.druid.ritual.recordAttemptWeek}周已写但未完成；原文字保留` : '尚未亲自整理书写',
      readyStatus: s.druid.ritual.readyWeek !== null ? `第${s.druid.ritual.readyWeek}周已付费准备，供下一瓶实际服药使用` : '没有尚未使用的本次仪式准备',
      attempts: s.druid.ritual.attempts,
      summary: available ? `普通动物与三种不同超凡生物须实际研习并书写同一原册；各项知识14、书写知识12，失败下一真实周重试。每瓶服药前另花1行动和90便士完成G准备，服药成败均消耗准备，原知识与原册保留。完整配方与剩余原著仪式细节未知。` : '',
    },
    cases: [], environment: '', insideCase: (druidInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: DRUID_SOURCE_STATUS } : {}),
    supplies: available ? `${DRUID_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.druid.resupply.requestedWeek === null ? `已实际接收后续供给${s.druid.resupply.deliveries}批。` : `第${s.druid.resupply.requestedWeek}周提出请求，第${s.druid.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.druid.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 德鲁伊魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? DRUID_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `生物学家消化成果${s.druid.biologistActingAtPromotion}/100已保留；德鲁伊扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成生物学家消化（${s.progression.acting}/100），并在晋升生物学家后度过12整周（${biologistWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完生物学家之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 四项实际研习与亲自书写原册 → 购买，或完成对应五次劳务后付款领取 → 每瓶实际付费准备本次仪式 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${DRUID_CONSUMPTION_RISK}` : '成为生物学家后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['STUDY', 'WRITE_RECORD', 'PREPARE_RITE', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isDruidAcquisitionCommand(command: unknown): command is DruidAcquisitionCommand {
  return validateDruidCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateDruidCommand(value: unknown): value is DruidCommand {
  if (!record(value)) return false;
  if (['WRITE_RECORD', 'PREPARE_RITE', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (value.type === 'STUDY') return shape(value, ['type', 'sourceId']) && DRUID_STUDY_SOURCE_IDS.includes(value.sourceId as DruidStudySourceId);
  if (value.type === 'RETURN') return shape(value, ['type', 'caseId', 'method']) && value.caseId === 'known-soil' && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^druid-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^druid-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && DRUID_CASE_IDS.includes(value.caseId as typeof DRUID_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && DRUID_CASE_IDS.includes(value.caseId as typeof DRUID_CASE_IDS[number]) && (value.method === 'ORDINARY' || value.method === 'ABILITY' && value.caseId === 'known-soil');
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateDruidState(s: SliceState): boolean {
  const raw: unknown = s.druid;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'biologistActingAtPromotion', 'ritual', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.cultivator) || !record(s.physician) || !record(s.harvestpriest) || !record(s.biologist)) return false;
  const firstBiologistWeek = s.biologist.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstBiologistWeek + DRUID_MIN_BIOLOGIST_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== DRUID_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, DRUID_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateDruidLife(s)) return false;
  if (!record(raw.ritual) || !shape(raw.ritual, ['studies', 'recordAttemptWeek', 'recordWrittenWeek', 'readyWeek', 'attempts']) || !record(raw.ritual.studies) || !shape(raw.ritual.studies, DRUID_STUDY_SOURCE_IDS)) return false;
  const lastPreparationWeek = typeof raw.promotionWeek === 'number' ? Math.min(raw.promotionWeek, s.week) : s.week;
  const ritual = raw.ritual, studies = raw.ritual.studies;
  let allStudied = true, latestStudyWeek = firstBiologistWeek;
  for (const id of DRUID_STUDY_SOURCE_IDS) {
    const study = studies[id];
    if (!record(study) || !shape(study, ['attemptWeek', 'completedWeek'])) return false;
    if (study.attemptWeek !== null && (!raw.guidanceKnown || !integer(study.attemptWeek, firstBiologistWeek, lastPreparationWeek))) return false;
    if (study.completedWeek !== null && (!integer(study.completedWeek, firstBiologistWeek, lastPreparationWeek) || study.completedWeek !== study.attemptWeek)) return false;
    if (study.completedWeek === null) allStudied = false;
    else latestStudyWeek = Math.max(latestStudyWeek, study.completedWeek as number);
  }
  if (ritual.recordAttemptWeek !== null && (!allStudied || !integer(ritual.recordAttemptWeek, latestStudyWeek, lastPreparationWeek))) return false;
  if (ritual.recordWrittenWeek !== null && (!integer(ritual.recordWrittenWeek, latestStudyWeek, lastPreparationWeek) || ritual.recordWrittenWeek !== ritual.recordAttemptWeek)) return false;
  if (!integer(ritual.attempts, 0, raw.bottles.length + 1)) return false;
  if (ritual.readyWeek !== null && (ritual.recordWrittenWeek === null || !integer(ritual.readyWeek, ritual.recordWrittenWeek as number, lastPreparationWeek) || raw.promotionWeek !== null)) return false;
  if (ritual.attempts !== 0 && (!raw.guidanceKnown || ritual.recordWrittenWeek === null)) return false;
  const druid = raw as unknown as DruidState, isPromoted = promoted(s);
  if (druid.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!druid.guidanceKnown || !integer(s.biologist.promotionWeek, 1, s.week) || !integer(druid.promotionWeek, firstConsumptionWeek, s.week) || druid.biologistActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS, ...BIOLOGIST_ABILITY_IDS, ...DRUID_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?ANCIENT_ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?COFFIN_BEARER_ABILITY_IDS:[]),...(s.progression.sequence===2?BARREN_MATRIARCH_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (druid.promotionWeek !== null || druid.biologistActingAtPromotion !== null || DRUID_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshDruidPractice()).some(([key, value]) => druid.practice[key as keyof DruidPractice] !== value)) return false;
    if (druid.reflected || Object.values(druid.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of druid.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `druid-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of druid.bottles.entries()) {
    let stockWeek = firstBiologistWeek;
    if (index < DRUID_BOTTLE_IDS.length) {
      if (bottle.source !== DRUID_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!druid.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / DRUID_BOTTLE_IDS.length) - 1;
      if (index % DRUID_BOTTLE_IDS.length === 0) {
        const previous = druid.bottles.slice(index - DRUID_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > druid.promotionWeek!) return false;
    }
    if (!druid.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > druid.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > druid.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== druid.promotionWeek) return false;
    }
  }
  const consumed = druid.bottles.filter(bottle => bottle.status === 'CONSUMED');
  if (druid.ritual.attempts !== consumed.length + (druid.ritual.readyWeek === null ? 0 : 1)) return false;
  if (consumed.some(bottle => druid.ritual.recordWrittenWeek === null || bottle.consumedWeek! < druid.ritual.recordWrittenWeek || druid.ritual.readyWeek !== null && druid.ritual.readyWeek < bottle.consumedWeek!)) return false;
  if (druid.resupply.requestedWeek !== null && (!druid.guidanceKnown || isPromoted || !supplyExhausted(druid) || druid.bottles.some(bottle => bottle.consumedWeek! > druid.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validateDruidEncounter(s);
}

export { freshDruidPractice } from './types.js';
export { DRUID_ABILITIES } from './content.js';
export type * from './types.js';
