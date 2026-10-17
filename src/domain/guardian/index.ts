import { GLORY_ABILITY_IDS } from '../glory/types.js';
import {SILVER_KNIGHT_ABILITY_IDS} from '../silver-knight/types.js';
import {DEMON_HUNTER_ABILITY_IDS} from '../demon-hunter/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { WARRIOR_ABILITY_IDS } from '../warrior/types.js';
import { GLADIATOR_ABILITY_IDS } from '../gladiator/types.js';
import { WEAPONMASTER_ABILITY_IDS } from '../weaponmaster/types.js';
import { DAWN_PALADIN_ABILITY_IDS } from '../dawn-paladin/types.js';
import { guardianInside, validateGuardianLife } from './life.js';
import { dawnPaladinInside } from '../dawn-paladin/life.js';
import { validateGuardianEncounter } from './encounter.js';
import {
  GUARDIAN_ABILITIES, GUARDIAN_BOTTLE_IDS, GUARDIAN_CONSUMPTION_RISK, GUARDIAN_FORMULA_STATUS,
  GUARDIAN_GUIDE, GUARDIAN_LABOUR_TASKS, GUARDIAN_MIN_DAWN_PALADIN_WEEKS, GUARDIAN_POTION_SOURCES, GUARDIAN_PRICES, GUARDIAN_SOURCE_STATUS,
} from './content.js';
import {
  GUARDIAN_ABILITY_IDS, GUARDIAN_CASE_IDS, type GuardianAcquisitionCommand, type GuardianAction,
  type GuardianBottle, type GuardianCommand, type GuardianPractice, type GuardianProjection, type GuardianState,
} from './types.js';

export function freshGuardianPractice(): GuardianPractice {
  return { guardActive: false, playerAttacked: false, probes: 0, playerDamageTaken: 0, allyPresent: false, allyDistance: null, allyHealth: 100, allyDamageTaken: 0, sharedDamage: 0, target: 'INTACT' };
}

export function createGuardianState(): GuardianState {
  return {
    guidanceKnown: false,
    bottles: GUARDIAN_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, dawnPaladinActingAtPromotion: null,
    cases: Object.fromEntries(GUARDIAN_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshGuardianPractice(),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, swordReady: false, swordLostRound: null, armorReady: false, armorExpiresRound: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'warrior' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isDawnPaladin = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.warrior.discovered && s.warrior.guidanceKnown && s.gladiator.guidanceKnown && s.weaponmaster.guidanceKnown && s.dawnPaladin.guidanceKnown && s.dawnPaladin.promotionWeek !== null && (isDawnPaladin(s) || promoted(s));
const potionPrice = (bottle: GuardianBottle) => GUARDIAN_PRICES.potion - (bottle.labourSteps === 5 ? GUARDIAN_PRICES.labourCredit : 0);
const bottleNumber = (bottle: GuardianBottle) => Number(bottle.id.slice('guardian-potion-'.length));
const dawnPaladinWeeks = (s: SliceState) => Math.max(0, (s.guardian.promotionWeek ?? s.week) - (s.dawnPaladin.promotionWeek ?? s.week));
const supplyExhausted = (state: GuardianState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${GUARDIAN_GUIDE}的独立守护者成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5守护者魔药，原瓶guardian-potion-${number}，非战士、格斗家、武器大师或黎明骑士旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: GuardianAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (guardianInside(s) || dawnPaladinInside(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原训练场，找到奥斯温·布莱克特。';
  if (!knownChannel(s)) return '成为黎明骑士并保有奥斯温·布莱克特的指导渠道后，才能继续了解守护者之路。';
  if (promoted(s)) return '你已完成守护者晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.guardian.guidanceKnown) return '已经听过守护者成品魔药的用药说明。';
    return s.cash < GUARDIAN_PRICES.guidance ? '守护者用药指导需要460便士。' : null;
  }
  if (!s.guardian.guidanceKnown) return '先听奥斯温·布莱克特说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.guardian.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.guardian) ? null : '须先用完现有全部守护者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.guardian.resupply.requestedWeek === null) return '尚未申请下一批守护者补给。';
    if (s.week <= s.guardian.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.guardian) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.guardian.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选守护者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `黎明骑士魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.dawnPaladin.promotionWeek === null || dawnPaladinWeeks(s) < GUARDIAN_MIN_DAWN_PALADIN_WEEKS) return `成为黎明骑士后已度过${dawnPaladinWeeks(s)}/${GUARDIAN_MIN_DAWN_PALADIN_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原训练场劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyGuardianCommand(s: SliceState, command: GuardianAcquisitionCommand, c: SeerContext): void {
  rule(validateGuardianCommand(command) && isGuardianAcquisitionCommand(command), '守护者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= GUARDIAN_PRICES.guidance;
      s.guardian.guidanceKnown = true;
      c.note('听取守护者用药说明', `花费1行动、460便士，你向已认识的本作原创成年${GUARDIAN_GUIDE}继续请教，导师向你说明从独立守护者成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原训练场安静场地与在场照护安排。这些不是原来的战士、格斗家、武器大师或黎明骑士存药。${GUARDIAN_FORMULA_STATUS}黎明骑士消化须达100，晋升黎明骑士后满12整周才能服用；可提前筹备。${GUARDIAN_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.guardian.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = GUARDIAN_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在奥斯温·布莱克特的原训练场实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.guardian.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('守护者原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原训练场劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；黎明骑士消化100且晋升黎明骑士后满12整周时，再独立确认服药。${GUARDIAN_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.guardian.resupply.requestedWeek = s.week;
      c.note('申请下一批守护者魔药', `现有守护者原瓶全部耗尽且未晋升。你花费1行动，请${GUARDIAN_GUIDE}从同一新渠道订下一批三瓶，并实际核验原训练场的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.guardian.bottles.length + 1;
      s.guardian.resupply.deliveries += 1;
      for (let offset = 0; offset < GUARDIAN_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.guardian.bottles.push({ id: `guardian-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.guardian.resupply.requestedWeek = null;
      c.note('下一批守护者原瓶到货', `第${s.week}周，奥斯温·布莱克特的独立守护者成品交接渠道本作G成品供给第${s.guardian.resupply.deliveries + 1}批三瓶实际到货，原瓶guardian-potion-${firstNumber}至guardian-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.guardian.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次守护者服药准备', `原成年${GUARDIAN_GUIDE}在原训练场实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.guardian.dawnPaladinActingAtPromotion = s.progression.acting;
        s.guardian.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of GUARDIAN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为守护者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。战士、格斗家、武器大师与黎明骑士全部原能力及原ID掌握完整继承，只新增守护状态与附近同伴伤害分担两项，从0掌握开始；黎明骑士消化成果、原晋升周、真实演示、原棍借还与已解决敌人记录均保持原样，守护者扮演从0开始。灵性上限提高到100，当前灵性没有补满。守护状态要求放弃攻击，主动攻击时防御降低；可替附近实际同伴承担伤害，不能召来同伴或远程免伤。不会被幻术迷惑是被动边界，不是读心、自动识别邪恶或污染。原成年维拉与原训练器具留在各自原位置，未收到免费光剑、光甲、材料或治疗。序列4猎魔者的辨识、针对性药膏与神话形态尚未获得。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了守护者晋升' : '守护者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是黎明骑士，消化与全部原有掌握保留，没有获得守护者能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectGuardian(s: SliceState): GuardianProjection {
  const actions: GuardianAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.demonHunter.guardianActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: GuardianAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.guardian.guidanceKnown) add('learn-guardian-guidance', '请奥斯温·布莱克特说明守护者成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.guardian.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${GUARDIAN_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶守护者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.guardian.resupply.requestedWeek !== null) add('receive-guardian-supply', '确认下一批三瓶守护者到货', `0行动 · 第${s.guardian.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.guardian)) add('request-guardian-supply', '向奥斯温·布莱克特订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.guardian.guidanceKnown) {
    for (const bottle of s.guardian.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶守护者魔药`, `0行动 · 独立确认 · 黎明骑士消化${isPromoted ? s.guardian.dawnPaladinActingAtPromotion : s.progression.acting}/100 · 晋升后${dawnPaladinWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.guardian.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.guardian.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '守护者 · 序列5' : '守护者之路', discovered: available,
    guidanceKnown: available && s.guardian.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: null,
    battleEquipment: { swordReady: s.guardian.encounter.swordReady, swordLostRound: s.guardian.encounter.swordLostRound, armorReady: s.guardian.encounter.armorReady, armorExpiresRound: s.guardian.encounter.armorExpiresRound },
    cases: [], environment: '', insideCase: (guardianInside(s) || dawnPaladinInside(s)),
    ...(available ? { story: GUARDIAN_SOURCE_STATUS } : {}),
    supplies: available ? `${GUARDIAN_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.guardian.resupply.requestedWeek === null ? `已实际接收后续供给${s.guardian.resupply.deliveries}批。` : `第${s.guardian.resupply.requestedWeek}周提出请求，第${s.guardian.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions: s.progression.sequence === 2 ? [] : actions,
    bottles: available ? s.guardian.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 守护者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? GUARDIAN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `黎明骑士消化成果${s.guardian.dawnPaladinActingAtPromotion}/100已保留；守护者扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成黎明骑士消化（${s.progression.acting}/100），并在晋升黎明骑士后度过12整周（${dawnPaladinWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完黎明骑士之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${GUARDIAN_CONSUMPTION_RISK}` : '成为黎明骑士后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isGuardianAcquisitionCommand(command: unknown): command is GuardianAcquisitionCommand {
  return validateGuardianCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateGuardianCommand(value: unknown): value is GuardianCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^guardian-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^guardian-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && GUARDIAN_CASE_IDS.includes(value.caseId as typeof GUARDIAN_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && GUARDIAN_CASE_IDS.includes(value.caseId as typeof GUARDIAN_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateGuardianState(s: SliceState): boolean {
  const raw: unknown = s.guardian;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'dawnPaladinActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.warrior) || !record(s.gladiator) || !record(s.weaponmaster) || !record(s.dawnPaladin)) return false;
  const firstDawnPaladinWeek = s.dawnPaladin.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstDawnPaladinWeek + GUARDIAN_MIN_DAWN_PALADIN_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== GUARDIAN_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, GUARDIAN_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateGuardianLife(s)) return false;
  const guardian = raw as unknown as GuardianState, isPromoted = promoted(s);
  if (guardian.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!guardian.guidanceKnown || !integer(s.dawnPaladin.promotionWeek, 1, s.week) || !integer(guardian.promotionWeek, firstConsumptionWeek, s.week) || guardian.dawnPaladinActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS, ...DAWN_PALADIN_ABILITY_IDS, ...GUARDIAN_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DEMON_HUNTER_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?SILVER_KNIGHT_ABILITY_IDS:[]),...(s.progression.sequence===2?GLORY_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (guardian.promotionWeek !== null || guardian.dawnPaladinActingAtPromotion !== null || GUARDIAN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshGuardianPractice()).some(([key, value]) => guardian.practice[key as keyof GuardianPractice] !== value)) return false;
    if (guardian.reflected || Object.values(guardian.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of guardian.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `guardian-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of guardian.bottles.entries()) {
    let stockWeek = firstDawnPaladinWeek;
    if (index < GUARDIAN_BOTTLE_IDS.length) {
      if (bottle.source !== GUARDIAN_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!guardian.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / GUARDIAN_BOTTLE_IDS.length) - 1;
      if (index % GUARDIAN_BOTTLE_IDS.length === 0) {
        const previous = guardian.bottles.slice(index - GUARDIAN_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > guardian.promotionWeek!) return false;
    }
    if (!guardian.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > guardian.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > guardian.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== guardian.promotionWeek) return false;
    }
  }
  if (guardian.resupply.requestedWeek !== null && (!guardian.guidanceKnown || isPromoted || !supplyExhausted(guardian) || guardian.bottles.some(bottle => bottle.consumedWeek! > guardian.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'swordReady', 'swordLostRound', 'armorReady', 'armorExpiresRound']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = guardian.encounter;
  if (typeof e.swordReady !== 'boolean' || typeof e.armorReady !== 'boolean') return false;
  if (e.swordLostRound !== null && !integer(e.swordLostRound, 1, s.combat?.round ?? 0) || e.armorExpiresRound !== null && !integer(e.armorExpiresRound, 1, (s.combat?.round ?? 0) + 1)) return false;
  if (e.armorReady !== (e.armorExpiresRound !== null) || e.swordReady && e.swordLostRound === s.combat?.round) return false;
  if (e.status !== 'FIGHTING' && (e.swordReady || e.swordLostRound !== null || e.armorReady || e.armorExpiresRound !== null)) return false;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, guardian.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'GUARDIAN_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(guardian.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || Object.values(guardian.cases).some(r => r.status === 'PREPARED') || guardianInside(s))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'guardian-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateGuardianEncounter(s);
}

export { GUARDIAN_ABILITIES } from './content.js';
export type * from './types.js';
