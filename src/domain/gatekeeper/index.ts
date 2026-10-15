import {DEATH_CONSUL_ABILITY_IDS} from '../death-consul/types.js';
import {FERRYMAN_ABILITY_IDS} from '../ferryman/types.js';
import {UNDYING_ABILITY_IDS} from '../undying/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../corpsecollector/types.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../gravedigger/types.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../spiritmedium/types.js';
import { SPIRIT_GUIDE_ABILITY_IDS } from '../spirit-guide/types.js';
import { validateGatekeeperLife } from './life.js';
import { validateGatekeeperEncounter } from './encounter.js';
import {
  GATEKEEPER_ABILITIES, GATEKEEPER_BOTTLE_IDS, GATEKEEPER_CONSUMPTION_RISK, GATEKEEPER_FORMULA_STATUS,
  GATEKEEPER_GUIDE, GATEKEEPER_LABOUR_TASKS, GATEKEEPER_MIN_SPIRIT_GUIDE_WEEKS, GATEKEEPER_POTION_SOURCES, GATEKEEPER_PRICES, GATEKEEPER_SOURCE_STATUS,
} from './content.js';
import {
  GATEKEEPER_ABILITY_IDS, GATEKEEPER_CASE_IDS, type GatekeeperAcquisitionCommand, type GatekeeperAction,
  type GatekeeperBottle, type GatekeeperCommand, type GatekeeperProjection, type GatekeeperState,
} from './types.js';

export function createGatekeeperState(): GatekeeperState {
  return {
    guidanceKnown: false,
    bottles: GATEKEEPER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, spiritGuideActingAtPromotion: null, inviteAttemptWeek: null,
    cases: Object.fromEntries(GATEKEEPER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    companion: { source: 'SG6-GRAY-FEATHER', status: 'OUTSIDE', agreementWeek: null, entries: 0, releases: 0, deployments: 0, recalls: 0, feePaid: 0 },
    practice: { marker: 'DESK', gateOpen: false, deliveries: 0, returns: 0, gateTests: 0 },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'death' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isSpiritGuide = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.corpsecollector.discovered && s.corpsecollector.guidanceKnown && s.gravedigger.guidanceKnown && s.spiritmedium.guidanceKnown && s.spiritGuide.guidanceKnown && s.spiritGuide.promotionWeek !== null && (isSpiritGuide(s) || promoted(s));
const potionPrice = (bottle: GatekeeperBottle) => GATEKEEPER_PRICES.potion - (bottle.labourSteps === 5 ? GATEKEEPER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: GatekeeperBottle) => Number(bottle.id.slice('gatekeeper-potion-'.length));
const spiritGuideWeeks = (s: SliceState) => Math.max(0, (s.gatekeeper.promotionWeek ?? s.week) - (s.spiritGuide.promotionWeek ?? s.week));
const supplyExhausted = (state: GatekeeperState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${GATEKEEPER_GUIDE}的独立看门人成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5看门人魔药，原瓶gatekeeper-potion-${number}，非收尸人、掘墓人、通灵者或死灵导师旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: GatekeeperAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if ((Object.values(s.gatekeeper.cases).some(value => value.contactOpen) || s.gatekeeper.practice.marker === 'RECIPIENT' || s.gatekeeper.practice.gateOpen || s.gatekeeper.companion.status === 'DEPLOYED')) return '先实际结束本次看门人实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原纪念工作室，找到伊芙琳·沃斯。';
  if (!knownChannel(s)) return '成为死灵导师并保有伊芙琳·沃斯的指导渠道后，才能继续了解看门人之路。';
  if (promoted(s)) return '你已完成看门人晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.gatekeeper.guidanceKnown) return '已经听过看门人成品魔药的用药说明。';
    return s.cash < GATEKEEPER_PRICES.guidance ? '看门人用药指导需要460便士。' : null;
  }
  if (!s.gatekeeper.guidanceKnown) return '先听伊芙琳·沃斯说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.gatekeeper.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.gatekeeper) ? null : '须先用完现有全部看门人原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.gatekeeper.resupply.requestedWeek === null) return '尚未申请下一批看门人补给。';
    if (s.week <= s.gatekeeper.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.gatekeeper) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.gatekeeper.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选看门人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `死灵导师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.spiritGuide.promotionWeek === null || spiritGuideWeeks(s) < GATEKEEPER_MIN_SPIRIT_GUIDE_WEEKS) return `成为死灵导师后已度过${spiritGuideWeeks(s)}/${GATEKEEPER_MIN_SPIRIT_GUIDE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原纪念工作室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyGatekeeperCommand(s: SliceState, command: GatekeeperAcquisitionCommand, c: SeerContext): void {
  rule(validateGatekeeperCommand(command) && isGatekeeperAcquisitionCommand(command), '看门人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= GATEKEEPER_PRICES.guidance;
      s.gatekeeper.guidanceKnown = true;
      c.note('听取看门人用药说明', `花费1行动、460便士，你向已认识的本作原创成年${GATEKEEPER_GUIDE}继续请教，导师向你说明从独立看门人成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原纪念工作室安静场地与在场照护安排。这些不是原来的收尸人、掘墓人、通灵者或死灵导师存药。${GATEKEEPER_FORMULA_STATUS}死灵导师消化须达100，晋升死灵导师后满12整周才能服用；可提前筹备。${GATEKEEPER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.gatekeeper.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = GATEKEEPER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊芙琳·沃斯的原纪念工作室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.gatekeeper.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('看门人原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原纪念工作室劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；死灵导师消化100且晋升死灵导师后满12整周时，再独立确认服药。${GATEKEEPER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.gatekeeper.resupply.requestedWeek = s.week;
      c.note('申请下一批看门人魔药', `现有看门人原瓶全部耗尽且未晋升。你花费1行动，请${GATEKEEPER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原纪念工作室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.gatekeeper.bottles.length + 1;
      s.gatekeeper.resupply.deliveries += 1;
      for (let offset = 0; offset < GATEKEEPER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.gatekeeper.bottles.push({ id: `gatekeeper-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.gatekeeper.resupply.requestedWeek = null;
      c.note('下一批看门人原瓶到货', `第${s.week}周，伊芙琳·沃斯的独立看门人成品交接渠道本作G成品供给第${s.gatekeeper.resupply.deliveries + 1}批三瓶实际到货，原瓶gatekeeper-potion-${firstNumber}至gatekeeper-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.gatekeeper.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次看门人服药准备', `原成年${GATEKEEPER_GUIDE}在原纪念工作室实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.gatekeeper.spiritGuideActingAtPromotion = s.progression.acting;
        s.gatekeeper.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of GATEKEEPER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为看门人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。收尸人、掘墓人、通灵者与死灵导师全部原能力及原ID掌握完整继承，只新增体内冥界与实际灵体协助、有限冥界之门两项，从0掌握开始；死灵导师消化成果与原晋升周保留，看门人扮演从0开始。灵性上限提高到100，当前灵性没有补满。体内冥界属于原身体且容量有限，本阶段G只接纳同一只原灰羽；必须另行获得本人自愿短驻同意并实际支付成本，晋升没有附赠灵体，旧单信约定不自动延长。旧信位置与原记录保持；新原木牌仍在导师原桌上，尚未使用。冥界之门不是任意目标的无敌监狱，可被抵抗并须维持、关闭；没有获得鲁德维尔的特殊戒指、高位灵或序列4不死者与死亡复活。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了看门人晋升' : '看门人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是死灵导师，消化与全部原有掌握保留，没有获得看门人能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectGatekeeper(s: SliceState): GatekeeperProjection {
  const actions: GatekeeperAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.undying.gatekeeperActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: GatekeeperAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.gatekeeper.guidanceKnown) add('learn-gatekeeper-guidance', '请伊芙琳·沃斯说明看门人成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.gatekeeper.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${GATEKEEPER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶看门人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.gatekeeper.resupply.requestedWeek !== null) add('receive-gatekeeper-supply', '确认下一批三瓶看门人到货', `0行动 · 第${s.gatekeeper.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.gatekeeper)) add('request-gatekeeper-supply', '向伊芙琳·沃斯订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.gatekeeper.guidanceKnown) {
    for (const bottle of s.gatekeeper.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶看门人魔药`, `0行动 · 独立确认 · 死灵导师消化${isPromoted ? s.gatekeeper.spiritGuideActingAtPromotion : s.progression.acting}/100 · 晋升后${spiritGuideWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.gatekeeper.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.gatekeeper.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '看门人 · 序列5' : '看门人之路', discovered: available,
    guidanceKnown: available && s.gatekeeper.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    companion: null, practice: null,
    cases: [], environment: '', insideCase: (Object.values(s.gatekeeper.cases).some(value => value.contactOpen) || s.gatekeeper.practice.marker === 'RECIPIENT' || s.gatekeeper.practice.gateOpen || s.gatekeeper.companion.status === 'DEPLOYED'),
    ...(available ? { story: GATEKEEPER_SOURCE_STATUS } : {}),
    supplies: available ? `${GATEKEEPER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.gatekeeper.resupply.requestedWeek === null ? `已实际接收后续供给${s.gatekeeper.resupply.deliveries}批。` : `第${s.gatekeeper.resupply.requestedWeek}周提出请求，第${s.gatekeeper.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.gatekeeper.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 看门人魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? GATEKEEPER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?'看门人魔药已消化，原灰羽、原门与旧实践结果保留，不新增原灵。':isPromoted ? `死灵导师消化成果${s.gatekeeper.spiritGuideActingAtPromotion}/100已保留；看门人扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成死灵导师消化（${s.progression.acting}/100），并在晋升死灵导师后度过12整周（${spiritGuideWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完死灵导师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${GATEKEEPER_CONSUMPTION_RISK}` : '成为死灵导师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isGatekeeperAcquisitionCommand(command: unknown): command is GatekeeperAcquisitionCommand {
  return validateGatekeeperCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateGatekeeperCommand(value: unknown): value is GatekeeperCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_MARKER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^gatekeeper-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^gatekeeper-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && GATEKEEPER_CASE_IDS.includes(value.caseId as typeof GATEKEEPER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && GATEKEEPER_CASE_IDS.includes(value.caseId as typeof GATEKEEPER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateGatekeeperState(s: SliceState): boolean {
  const raw: unknown = s.gatekeeper;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'spiritGuideActingAtPromotion', 'inviteAttemptWeek', 'cases', 'companion', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.corpsecollector) || !record(s.gravedigger) || !record(s.spiritmedium) || !record(s.spiritGuide)) return false;
  const firstSpiritGuideWeek = s.spiritGuide.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstSpiritGuideWeek + GATEKEEPER_MIN_SPIRIT_GUIDE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== GATEKEEPER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, GATEKEEPER_CASE_IDS) || !record(raw.companion) || !record(raw.practice) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateGatekeeperLife(s)) return false;
  const gatekeeper = raw as unknown as GatekeeperState, isPromoted = promoted(s);
  if (gatekeeper.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!gatekeeper.guidanceKnown || !integer(s.spiritGuide.promotionWeek, 1, s.week) || !integer(gatekeeper.promotionWeek, firstConsumptionWeek, s.week) || gatekeeper.spiritGuideActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...SPIRIT_GUIDE_ABILITY_IDS, ...GATEKEEPER_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?UNDYING_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?FERRYMAN_ABILITY_IDS:[]),...(s.progression.sequence===2?DEATH_CONSUL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (gatekeeper.promotionWeek !== null || gatekeeper.spiritGuideActingAtPromotion !== null || GATEKEEPER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (gatekeeper.practice.marker !== 'DESK' || gatekeeper.practice.gateOpen || gatekeeper.practice.deliveries !== 0 || gatekeeper.practice.returns !== 0 || gatekeeper.practice.gateTests !== 0) return false;
    const companion = gatekeeper.companion;
    if (companion.status !== 'OUTSIDE' || companion.agreementWeek !== null || companion.entries !== 0 || companion.releases !== 0 || companion.deployments !== 0 || companion.recalls !== 0 || companion.feePaid !== 0 || companion.source !== 'SG6-GRAY-FEATHER' || gatekeeper.inviteAttemptWeek !== null) return false;
    if (gatekeeper.reflected || Object.values(gatekeeper.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of gatekeeper.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `gatekeeper-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of gatekeeper.bottles.entries()) {
    let stockWeek = firstSpiritGuideWeek;
    if (index < GATEKEEPER_BOTTLE_IDS.length) {
      if (bottle.source !== GATEKEEPER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!gatekeeper.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / GATEKEEPER_BOTTLE_IDS.length) - 1;
      if (index % GATEKEEPER_BOTTLE_IDS.length === 0) {
        const previous = gatekeeper.bottles.slice(index - GATEKEEPER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > gatekeeper.promotionWeek!) return false;
    }
    if (!gatekeeper.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > gatekeeper.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > gatekeeper.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== gatekeeper.promotionWeek) return false;
    }
  }
  if (gatekeeper.resupply.requestedWeek !== null && (!gatekeeper.guidanceKnown || isPromoted || !supplyExhausted(gatekeeper) || gatekeeper.bottles.some(bottle => bottle.consumedWeek! > gatekeeper.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = gatekeeper.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, gatekeeper.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'GATEKEEPER_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(gatekeeper.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || Object.values(gatekeeper.cases).some(r => r.contactOpen || r.status === 'PREPARED') || gatekeeper.practice.marker !== 'DESK' || gatekeeper.practice.gateOpen || gatekeeper.companion.status === 'DEPLOYED')) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'gatekeeper-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateGatekeeperEncounter(s);
}

export { GATEKEEPER_ABILITIES } from './content.js';
export type * from './types.js';
