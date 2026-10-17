import { GLORY_ABILITY_IDS } from '../glory/types.js';
import {SILVER_KNIGHT_ABILITY_IDS} from '../silver-knight/types.js';
import {DEMON_HUNTER_ABILITY_IDS} from '../demon-hunter/types.js';
import {GUARDIAN_ABILITY_IDS} from '../guardian/types.js';
import {DAWN_PALADIN_ABILITY_IDS} from '../dawn-paladin/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { WARRIOR_ABILITY_IDS } from '../warrior/types.js';
import { GLADIATOR_ABILITY_IDS } from '../gladiator/types.js';
import {
  WEAPONMASTER_ABILITIES, WEAPONMASTER_BOTTLE_IDS, WEAPONMASTER_CONSUMPTION_RISK, WEAPONMASTER_FORMULA_STATUS,
  WEAPONMASTER_GUIDE, WEAPONMASTER_LABOUR_TASKS, WEAPONMASTER_MIN_GLADIATOR_WEEKS, WEAPONMASTER_POTION_SOURCES, WEAPONMASTER_PRICES, WEAPONMASTER_SOURCE_STATUS,
} from './content.js';
import {
  WEAPONMASTER_ABILITY_IDS, WEAPONMASTER_CASE_IDS, type WeaponmasterAcquisitionCommand, type WeaponmasterAction,
  type WeaponmasterBottle, type WeaponmasterCommand, type WeaponmasterProjection, type WeaponmasterState,
} from './types.js';

export function createWeaponmasterState(): WeaponmasterState {
  return {
    guidanceKnown: false,
    bottles: WEAPONMASTER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, gladiatorActingAtPromotion: null,
    cases: Object.fromEntries(WEAPONMASTER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'warrior' && (s.progression.sequence === 7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const isGladiator = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.warrior.discovered && s.warrior.guidanceKnown && s.gladiator.guidanceKnown && (isGladiator(s) || promoted(s));
const potionPrice = (bottle: WeaponmasterBottle) => WEAPONMASTER_PRICES.potion - (bottle.labourSteps === 4 ? WEAPONMASTER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: WeaponmasterBottle) => Number(bottle.id.slice('weaponmaster-potion-'.length));
const gladiatorWeeks = (s: SliceState) => Math.max(0, (s.weaponmaster.promotionWeek ?? s.week) - (s.gladiator.promotionWeek ?? s.week));
const supplyExhausted = (state: WeaponmasterState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${WEAPONMASTER_GUIDE}的新兵器训练成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7武器大师魔药，原瓶weaponmaster-potion-${number}，非战士或格斗家旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: WeaponmasterAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的独立训练场，找到奥斯温·布莱克特。';
  if (!knownChannel(s)) return '成为格斗家并保有奥斯温·布莱克特的指导渠道后，才能继续武器大师之路。';
  if (promoted(s)) return '你已完成武器大师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.weaponmaster.guidanceKnown) return '已经听过武器大师成品魔药的用药说明。';
    return s.cash < WEAPONMASTER_PRICES.guidance ? '武器大师用药指导需要240便士。' : null;
  }
  if (!s.weaponmaster.guidanceKnown) return '先听奥斯温·布莱克特说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.weaponmaster.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.weaponmaster) ? null : '须先用完现有全部武器大师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.weaponmaster.resupply.requestedWeek === null) return '尚未申请下一批武器大师补给。';
    if (s.week <= s.weaponmaster.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.weaponmaster) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.weaponmaster.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选武器大师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `格斗家魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.gladiator.promotionWeek === null || gladiatorWeeks(s) < WEAPONMASTER_MIN_GLADIATOR_WEEKS) return `成为格斗家后已度过${gladiatorWeeks(s)}/${WEAPONMASTER_MIN_GLADIATOR_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次独立训练场劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyWeaponmasterCommand(s: SliceState, command: WeaponmasterAcquisitionCommand, c: SeerContext): void {
  rule(validateWeaponmasterCommand(command) && isWeaponmasterAcquisitionCommand(command), '武器大师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= WEAPONMASTER_PRICES.guidance;
      s.weaponmaster.guidanceKnown = true;
      c.note('听取武器大师用药说明', `花费1行动、240便士，${WEAPONMASTER_GUIDE}向你说明从新兵器训练成品交接渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的格斗家存药。${WEAPONMASTER_FORMULA_STATUS}格斗家消化须达100，晋升格斗家后满8整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.weaponmaster.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = WEAPONMASTER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在奥斯温·布莱克特的独立训练场实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.weaponmaster.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('武器大师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次独立训练场劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；格斗家消化100且晋升格斗家后满8整周时，再独立确认服药。${WEAPONMASTER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.weaponmaster.resupply.requestedWeek = s.week;
      c.note('申请下一批武器大师魔药', `现有武器大师原瓶全部耗尽且未晋升。你花费1行动，请${WEAPONMASTER_GUIDE}从同一新渠道订下一批三瓶，并实际核验独立训练场的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.weaponmaster.bottles.length + 1;
      s.weaponmaster.resupply.deliveries += 1;
      for (let offset = 0; offset < WEAPONMASTER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.weaponmaster.bottles.push({ id: `weaponmaster-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.weaponmaster.resupply.requestedWeek = null;
      c.note('下一批武器大师原瓶到货', `第${s.week}周，奥斯温·布莱克特的新兵器训练成品交接渠道本作G成品供给第${s.weaponmaster.resupply.deliveries + 1}批三瓶实际到货，原瓶weaponmaster-potion-${firstNumber}至weaponmaster-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.weaponmaster.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.weaponmaster.gladiatorActingAtPromotion = s.progression.acting;
        s.weaponmaster.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of WEAPONMASTER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为武器大师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+1、意志+2、知识+1。三项战士训练分类与格斗技巧及其原ID掌握完整继承，新增兵器运用与弱点观察两项本作G实践分类从0掌握开始；格斗家消化成果和晋升周保留，武器大师扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了武器大师晋升' : '武器大师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是格斗家，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectWeaponmaster(s: SliceState): WeaponmasterProjection {
  const actions: WeaponmasterAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: WeaponmasterAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.weaponmaster.guidanceKnown) add('learn-weaponmaster-guidance', '请奥斯温·布莱克特说明武器大师成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.weaponmaster.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${WEAPONMASTER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶武器大师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.weaponmaster.resupply.requestedWeek !== null) add('receive-weaponmaster-supply', '确认下一批三瓶武器大师到货', `0行动 · 第${s.weaponmaster.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.weaponmaster)) add('request-weaponmaster-supply', '向奥斯温·布莱克特订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.weaponmaster.guidanceKnown) {
    for (const bottle of s.weaponmaster.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶武器大师魔药`, `0行动 · 独立确认 · 格斗家消化${isPromoted ? s.weaponmaster.gladiatorActingAtPromotion : s.progression.acting}/100 · 晋升后${gladiatorWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.weaponmaster.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.weaponmaster.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '武器大师 · 序列7' : '武器大师之路', discovered: available,
    guidanceKnown: available && s.weaponmaster.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '',
    ...(available ? { story: WEAPONMASTER_SOURCE_STATUS } : {}),
    supplies: available ? `${WEAPONMASTER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.weaponmaster.resupply.requestedWeek === null ? `已实际接收后续供给${s.weaponmaster.resupply.deliveries}批。` : `第${s.weaponmaster.resupply.requestedWeek}周提出请求，第${s.weaponmaster.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions: s.progression.sequence === 2 ? [] : actions,
    bottles: available ? s.weaponmaster.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 武器大师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? WEAPONMASTER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?s.dawnPaladin.weaponmasterActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?'武器大师魔药已消化，原训练工具、技击与守望经历保留。':isPromoted ? `格斗家消化成果${s.weaponmaster.gladiatorActingAtPromotion}/100已保留；武器大师扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成格斗家消化（${s.progression.acting}/100），并在晋升格斗家后度过8整周（${gladiatorWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完格斗家之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${WEAPONMASTER_CONSUMPTION_RISK}` : '成为格斗家后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isWeaponmasterAcquisitionCommand(command: unknown): command is WeaponmasterAcquisitionCommand {
  return validateWeaponmasterCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateWeaponmasterCommand(value: unknown): value is WeaponmasterCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'RETURN_TOOL', 'BORROW_TOOL'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^weaponmaster-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^weaponmaster-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && WEAPONMASTER_CASE_IDS.includes(value.caseId as typeof WEAPONMASTER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && WEAPONMASTER_CASE_IDS.includes(value.caseId as typeof WEAPONMASTER_CASE_IDS[number]) && ['TECHNIQUE', 'TEAM'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, bounded practice outcomes and original-tool custody. */
export function validateWeaponmasterState(s: SliceState): boolean {
  const raw: unknown = s.weaponmaster;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'gladiatorActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.warrior) || !record(s.gladiator)) return false;
  const firstGladiatorWeek = s.gladiator.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstGladiatorWeek + WEAPONMASTER_MIN_GLADIATOR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== WEAPONMASTER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, WEAPONMASTER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['TECHNIQUE', 'TEAM'].includes(value.method as string)) return false;
    if (!['NONE', 'FIT_CHECKED', 'MARK_RECHECKED', 'WATCH_ENDED'].includes(value.outcome as string)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const weaponmaster = raw as unknown as WeaponmasterState, isPromoted = promoted(s);
  if (weaponmaster.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!weaponmaster.guidanceKnown || !integer(s.gladiator.promotionWeek, 1, s.week) || !integer(weaponmaster.promotionWeek, firstConsumptionWeek, s.week) || weaponmaster.gladiatorActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS,...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?DAWN_PALADIN_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?GUARDIAN_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DEMON_HUNTER_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?SILVER_KNIGHT_ABILITY_IDS:[]),...(s.progression.sequence===2?GLORY_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (weaponmaster.promotionWeek !== null || weaponmaster.gladiatorActingAtPromotion !== null || WEAPONMASTER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (weaponmaster.reflected || Object.values(weaponmaster.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of weaponmaster.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `weaponmaster-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of weaponmaster.bottles.entries()) {
    let stockWeek = firstGladiatorWeek;
    if (index < WEAPONMASTER_BOTTLE_IDS.length) {
      if (bottle.source !== WEAPONMASTER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!weaponmaster.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / WEAPONMASTER_BOTTLE_IDS.length) - 1;
      if (index % WEAPONMASTER_BOTTLE_IDS.length === 0) {
        const previous = weaponmaster.bottles.slice(index - WEAPONMASTER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > weaponmaster.promotionWeek!) return false;
    }
    if (!weaponmaster.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > weaponmaster.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > weaponmaster.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== weaponmaster.promotionWeek) return false;
    }
  }
  if (weaponmaster.resupply.requestedWeek !== null && (!weaponmaster.guidanceKnown || isPromoted || !supplyExhausted(weaponmaster) || weaponmaster.bottles.some(bottle => bottle.consumedWeek! > weaponmaster.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { WEAPONMASTER_ABILITIES } from './content.js';
export type * from './types.js';
