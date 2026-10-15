import { CATASTROPHE_ABILITY_IDS } from '../catastrophe/types.js';
import {SEA_KING_ABILITY_IDS} from '../sea-king/types.js';
import {CATACLYSM_PRIEST_ABILITY_IDS} from '../cataclysm-priest/types.js';
import {OCEAN_SINGER_ABILITY_IDS} from '../ocean-singer/types.js';
import {WIND_BLESSED_ABILITY_IDS} from '../wind-blessed/types.js';
import {NAVIGATOR_ABILITY_IDS} from '../navigator/types.js';
import {RAGER_ABILITY_IDS} from '../rager/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  SAILOR_ABILITIES, SAILOR_BOTTLE_IDS, SAILOR_CONSUMPTION_RISK, SAILOR_FORMULA_STATUS,
  SAILOR_GUIDE, SAILOR_POTION_SOURCES, SAILOR_PRICES, SAILOR_SOURCE_STATUS,
} from './content.js';
import {
  SAILOR_ABILITY_IDS, SAILOR_CASE_IDS, type SailorAcquisitionCommand, type SailorAction,
  type SailorBottle, type SailorCommand, type SailorProjection, type SailorState,
} from './types.js';

export function createSailorState(): SailorState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: SAILOR_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(SAILOR_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, rope: 'OWNER', target: 'WAITING', withdrawals: 0,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'tyrant' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const potionPrice = (bottle: SailorBottle) => SAILOR_PRICES.potion - (bottle.labourSteps === 2 ? SAILOR_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SailorBottle) => Number(bottle.id.slice('sailor-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (sailor: SailorState) => sailor.bottles.length > 0 && sailor.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SAILOR_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的水手成品魔药，原瓶sailor-potion-${number}。码头维修站供给为本作原创，完整配方资料待核，未声称在码头维修站配制。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isSailorAcquisitionCommand(command: SailorCommand): command is SailorAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateSailorCommand(value: unknown): value is SailorCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^sailor-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^sailor-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['SURVEY', 'PREPARE', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SAILOR_CASE_IDS.includes(value.caseId as typeof SAILOR_CASE_IDS[number]);
  if (value.type === 'PERFORM') return shape(value, ['type', 'caseId', 'method']) && SAILOR_CASE_IDS.includes(value.caseId as typeof SAILOR_CASE_IDS[number]) && ['ABILITY', 'TEAM'].includes(value.method as string);
  return false;
}

function commandBlock(s: SliceState, command: SailorAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到码头维修站导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服水手魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.sailor.discovered ? '已经认识这位码头维修站导师。' : null;
  if (!s.sailor.discovered) return '先拜访码头维修站导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.sailor.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < SAILOR_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.sailor.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.sailor.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.sailor) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.sailor.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.sailor.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.sailor) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.sailor.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选水手原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次码头维修站劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy. Dockside activities are dispatched separately. */
export function applySailorCommand(s: SliceState, command: SailorAcquisitionCommand, c: SeerContext): void {
  rule(validateSailorCommand(command) && isSailorAcquisitionCommand(command), '水手准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.sailor.discovered = true;
      c.note('认识独立码头维修站导师', `你在贝克兰德拜访了${SAILOR_GUIDE}，消耗1行动。这间独立码头维修站保管三瓶独立封存的水手成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。导师与成品药渠道为本作原创G，不代表已知配方或可以在码头维修站制造魔药。${SAILOR_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SAILOR_PRICES.guidance;
      s.sailor.guidanceKnown = true;
      c.note('听取水手用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${SAILOR_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。${SAILOR_SOURCE_STATUS}水生亲和、体魄与平衡分别记录；实践须有实际水域或湿滑支撑、原绳具与撤离方案。不获得无限呼吸、深水压免疫、防弹、序列8暴怒或序列7水系法术。接触导师与服药都不建立教会或其它组织身份。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.sailor.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成绳具清点' : '完成码头护栏养护', bottle.labourSteps === 1
        ? `你照维修站清单核对现存绳具的编号、磨损与归属，完成一次实际码头维修站劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由码头维修站保管。完成第二次护栏养护后可抵该瓶600便士。清点不赋予水生亲和、非凡体魄或平衡。`
        : `你在维修工监督下擦拭既有护栏、清理普通积垢并归还所借工具，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.sailor.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('水手原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次码头维修站劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${SAILOR_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.sailor.resupply.requestedWeek = s.week;
      c.note('申请下一批水手魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${SAILOR_GUIDE}提出下一批三瓶的补给请求，并清点码头维修站收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.sailor.resupply.deliveries += 1;
      const firstNumber = s.sailor.resupply.deliveries * SAILOR_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < SAILOR_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.sailor.bottles.push({ id: `sailor-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.sailor.resupply.requestedWeek = null;
      c.note('下一批水手原瓶到货', `第${s.week}周，本作G供给第${s.sailor.resupply.deliveries + 1}批三瓶实际送到码头维修站，原瓶sailor-potion-${firstNumber}至sailor-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.sailor.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'tyrant';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(SAILOR_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 4], ['perception', 2], ['will', 1], ['knowledge', 0]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为水手', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+4、感知+2、意志+1、知识不变。三项水手能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。在真实水域与船上拥有有限水生亲和、体魄和平衡，仍须准备原绳具与撤离路线。不获得无限呼吸、深水压免疫、防弹、序列8暴怒或序列7水系法术，也不自动加入教会。${SAILOR_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了水手晋升' : '水手魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** The activity module adds finite dockside cases and observations actually made. */
export function projectSailor(s: SliceState): SailorProjection {
  const actions: SailorAction[] = [], isPromoted = promoted(s), known = s.sailor.discovered;
  const acting = isPromoted ? (s.progression.sequence !== 9 ? (s.rager.sailorActingAtPromotion ?? 100) : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: SailorAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-sailor', `拜访${SAILOR_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.sailor.guidanceKnown) add('learn-sailor-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.sailor.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '绳具清点' : '护栏养护'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶水手魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.sailor.resupply.requestedWeek !== null) add('receive-sailor-supply', '确认下一批三瓶到货', `0行动 · 第${s.sailor.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.sailor)) add('request-sailor-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.sailor.guidanceKnown) {
    for (const bottle of s.sailor.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶水手魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.sailor.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.sailor.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '水手 · 序列9' : '水手之路', discovered: known, guidanceKnown: s.sailor.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${SAILOR_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.sailor.resupply.requestedWeek === null ? `已实际接收后续供给${s.sailor.resupply.deliveries}批。` : `第${s.sailor.resupply.requestedWeek}周提出补给请求，第${s.sailor.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: SAILOR_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.sailor.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 水手成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SAILOR_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : acting >= 100 ? '水手魔药已消化；能力掌握仍按实际水域、搬运与平衡实践分别记录。'
        : acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先勘察实际码头环境，再准备原绳具与协作撤离；勇气不等于无视危险。'
          : `已留下水手扮演经历（${acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${SAILOR_CONSUMPTION_RISK}`
      : '拜访码头维修站导师，了解水手成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], environment: '',
  };
}

/** Finite-original conservation and provenance. The activity module validates case transitions, original ropes and targets. */
export function validateSailorState(s: SliceState): boolean {
  const raw: unknown = s.sailor;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SAILOR_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SAILOR_CASE_IDS)) return false;
  for (const caseState of Object.values(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'rope', 'target', 'withdrawals'])) return false;
    if (!['AVAILABLE', 'SURVEYED', 'PREPARED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0)) return false;
    if (!['OWNER', 'ANCHORED', 'RETURNED'].includes(caseState.rope as string) || !['WAITING', 'SAFE'].includes(caseState.target as string)) return false;
    if (caseState.method !== null && !['ABILITY', 'TEAM'].includes(caseState.method as string)) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const sailor = raw as unknown as SailorState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'tyrant' && !isPromoted) return false;
  if (isPromoted) {
    if (!sailor.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...SAILOR_ABILITY_IDS,...(s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?RAGER_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?NAVIGATOR_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?WIND_BLESSED_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?OCEAN_SINGER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?CATACLYSM_PRIEST_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?SEA_KING_ABILITY_IDS:[]),...(s.progression.sequence===2?CATASTROPHE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (SAILOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || sailor.reflected
    || Object.values(sailor.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.rope !== 'OWNER' || caseState.target !== 'WAITING')) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of sailor.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `sailor-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < SAILOR_BOTTLE_IDS.length) {
      if (bottle.source !== SAILOR_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!sailor.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SAILOR_BOTTLE_IDS.length) - 1;
      if (index % SAILOR_BOTTLE_IDS.length === 0) {
        const previous = sailor.bottles.slice(index - SAILOR_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!sailor.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week)) return false;
    if (s.progression.promotionWeek !== null && bottle.acquiredWeek! > s.progression.promotionWeek) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(5, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (s.progression.promotionWeek !== null && bottle.consumedWeek! > s.progression.promotionWeek) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== s.progression.promotionWeek) return false;
    }
  }
  if (sailor.resupply.requestedWeek !== null && (!sailor.guidanceKnown || !supplyExhausted(sailor) || sailor.bottles.some(bottle => bottle.consumedWeek! > sailor.resupply.requestedWeek!) || s.progression.promotionWeek !== null && sailor.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { SAILOR_ABILITIES } from './content.js';
export { SAILOR_CASE_IDS } from './types.js';
export type { SailorActivityCommand, SailorAction, SailorProjection } from './types.js';
