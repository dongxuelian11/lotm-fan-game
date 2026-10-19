import {FATE_TROJAN_ABILITY_IDS} from '../fate-trojan/types.js';
import {DECEIT_MENTOR_ABILITY_IDS} from '../deceit-mentor/types.js';
import {PARASITE_ABILITY_IDS} from '../parasite/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { MARAUDER_ABILITY_IDS } from '../marauder/types.js';
import { SWINDLER_ABILITY_IDS } from '../swindler/types.js';
import { CRYPTOLOGIST_ABILITY_IDS } from '../cryptologist/types.js';
import { FIRE_THIEF_ABILITY_IDS } from '../fire-thief/types.js';
import { validateDreamStealerLife } from './life.js';
import { validateDreamStealerEncounter } from './encounter.js';
import {
  DREAM_STEALER_ABILITIES, DREAM_STEALER_BOTTLE_IDS, DREAM_STEALER_CONSUMPTION_RISK, DREAM_STEALER_FORMULA_STATUS,
  DREAM_STEALER_GUIDE, DREAM_STEALER_LABOUR_TASKS, DREAM_STEALER_MIN_FIRE_THIEF_WEEKS, DREAM_STEALER_POTION_SOURCES, DREAM_STEALER_PRICES, DREAM_STEALER_SOURCE_STATUS,
} from './content.js';
import {
  DREAM_STEALER_ABILITY_IDS, DREAM_STEALER_CASE_IDS, type DreamStealerAcquisitionCommand, type DreamStealerAction,
  type DreamStealerBottle, type DreamStealerCommand, type DreamStealerProjection, type DreamStealerState,
} from './types.js';

export function createDreamStealerState(): DreamStealerState {
  return {
    guidanceKnown: false,
    bottles: DREAM_STEALER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, fireThiefActingAtPromotion: null,
    cases: Object.fromEntries(DREAM_STEALER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { playerPose: 'STANDING', targetPaused: false, targetRecovered: true, token: 'TARGET_DESK', thefts: 0, executions: 0, recoveries: 0, tokenMoves: 0 },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'error' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isFireThief = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.marauder.discovered && s.marauder.guidanceKnown && s.swindler.guidanceKnown && s.cryptologist.guidanceKnown && s.fireThief.guidanceKnown && s.fireThief.promotionWeek !== null && (isFireThief(s) || promoted(s));
const potionPrice = (bottle: DreamStealerBottle) => DREAM_STEALER_PRICES.potion - (bottle.labourSteps === 5 ? DREAM_STEALER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: DreamStealerBottle) => Number(bottle.id.slice('dream-stealer-potion-'.length));
const fireThiefWeeks = (s: SliceState) => Math.max(0, (s.dreamStealer.promotionWeek ?? s.week) - (s.fireThief.promotionWeek ?? s.week));
const supplyExhausted = (state: DreamStealerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${DREAM_STEALER_GUIDE}的独立窃梦家成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5窃梦家魔药，原瓶dream-stealer-potion-${number}，非偷盗者、诈骗师、解密学者或盗火人旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: DreamStealerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if ((Object.values(s.dreamStealer.cases).some(value => value.contactOpen) || s.dreamStealer.practice.playerPose !== 'STANDING' || s.dreamStealer.practice.targetPaused || s.dreamStealer.practice.token === 'TARGET_HAND')) return '先实际结束本次窃梦家实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原练习室，找到艾德温·洛克。';
  if (!knownChannel(s)) return '成为盗火人并保有艾德温·洛克的指导渠道后，才能继续了解窃梦家之路。';
  if (promoted(s)) return '你已完成窃梦家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.dreamStealer.guidanceKnown) return '已经听过窃梦家成品魔药的用药说明。';
    return s.cash < DREAM_STEALER_PRICES.guidance ? '窃梦家用药指导需要460便士。' : null;
  }
  if (!s.dreamStealer.guidanceKnown) return '先听艾德温·洛克说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.dreamStealer.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.dreamStealer) ? null : '须先用完现有全部窃梦家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.dreamStealer.resupply.requestedWeek === null) return '尚未申请下一批窃梦家补给。';
    if (s.week <= s.dreamStealer.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.dreamStealer) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.dreamStealer.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选窃梦家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `盗火人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.fireThief.promotionWeek === null || fireThiefWeeks(s) < DREAM_STEALER_MIN_FIRE_THIEF_WEEKS) return `成为盗火人后已度过${fireThiefWeeks(s)}/${DREAM_STEALER_MIN_FIRE_THIEF_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原练习室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyDreamStealerCommand(s: SliceState, command: DreamStealerAcquisitionCommand, c: SeerContext): void {
  rule(validateDreamStealerCommand(command) && isDreamStealerAcquisitionCommand(command), '窃梦家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= DREAM_STEALER_PRICES.guidance;
      s.dreamStealer.guidanceKnown = true;
      c.note('听取窃梦家用药说明', `花费1行动、460便士，你向已认识的本作原创成年${DREAM_STEALER_GUIDE}继续请教，导师向你说明从独立窃梦家成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原练习室安静场地与在场照护安排。这些不是原来的偷盗者、诈骗师、解密学者或盗火人存药。${DREAM_STEALER_FORMULA_STATUS}盗火人消化须达100，晋升盗火人后满12整周才能服用；可提前筹备。${DREAM_STEALER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.dreamStealer.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = DREAM_STEALER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在艾德温·洛克的原练习室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.dreamStealer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('窃梦家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原练习室劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；盗火人消化100且晋升盗火人后满12整周时，再独立确认服药。${DREAM_STEALER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.dreamStealer.resupply.requestedWeek = s.week;
      c.note('申请下一批窃梦家魔药', `现有窃梦家原瓶全部耗尽且未晋升。你花费1行动，请${DREAM_STEALER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原练习室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.dreamStealer.bottles.length + 1;
      s.dreamStealer.resupply.deliveries += 1;
      for (let offset = 0; offset < DREAM_STEALER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.dreamStealer.bottles.push({ id: `dream-stealer-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.dreamStealer.resupply.requestedWeek = null;
      c.note('下一批窃梦家原瓶到货', `第${s.week}周，艾德温·洛克的独立窃梦家成品交接渠道本作G成品供给第${s.dreamStealer.resupply.deliveries + 1}批三瓶实际到货，原瓶dream-stealer-potion-${firstNumber}至dream-stealer-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.dreamStealer.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次窃梦家服药准备', `原成年${DREAM_STEALER_GUIDE}在原练习室实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.dreamStealer.fireThiefActingAtPromotion = s.progression.acting;
        s.dreamStealer.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of DREAM_STEALER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为窃梦家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。偷盗者、诈骗师、解密学者与盗火人全部原能力及原ID掌握完整继承，只新增当前念头窃取一项，从0掌握开始；盗火人消化成果、原晋升周、真实演示、借用、原主恢复与已解决的敌人记录均保持原样，窃梦家扮演从0开始。灵性上限提高到100，当前灵性没有补满。成功窃取目标当前将要执行的念头时，你必须在同一动作立即亲身执行对应行动，不能先储存或免除执行；不因窃得念头同时获得所需非凡能力。目标仅短暂忘记这一次念头，随后能够恢复决定，不是永久删除意志。原桌椅、成年志愿者与诺汀的原蓝色木盘保持真实位置和归属；没有凭空得到物品、能力或全局梦境系统。梦境与理想可被窃取的能力边界已知，完整操作细节尚未核实，不生成未经核实的主动按钮；不提前获得序列4寄生者的寄生、念头储存或免除自身执行。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了窃梦家晋升' : '窃梦家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是盗火人，消化与全部原有掌握保留，没有获得窃梦家能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectDreamStealer(s: SliceState): DreamStealerProjection {
  const actions: DreamStealerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.parasite.dreamStealerActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: DreamStealerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.dreamStealer.guidanceKnown) add('learn-dream-stealer-guidance', '请艾德温·洛克说明窃梦家成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.dreamStealer.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${DREAM_STEALER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶窃梦家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.dreamStealer.resupply.requestedWeek !== null) add('receive-dream-stealer-supply', '确认下一批三瓶窃梦家到货', `0行动 · 第${s.dreamStealer.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.dreamStealer)) add('request-dream-stealer-supply', '向艾德温·洛克订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.dreamStealer.guidanceKnown) {
    for (const bottle of s.dreamStealer.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶窃梦家魔药`, `0行动 · 独立确认 · 盗火人消化${isPromoted ? s.dreamStealer.fireThiefActingAtPromotion : s.progression.acting}/100 · 晋升后${fireThiefWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.dreamStealer.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.dreamStealer.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '窃梦家 · 序列5' : '窃梦家之路', discovered: available,
    guidanceKnown: available && s.dreamStealer.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: null,
    cases: [], environment: '', insideCase: (Object.values(s.dreamStealer.cases).some(value => value.contactOpen) || s.dreamStealer.practice.playerPose !== 'STANDING' || s.dreamStealer.practice.targetPaused || s.dreamStealer.practice.token === 'TARGET_HAND'),
    ...(available ? { story: DREAM_STEALER_SOURCE_STATUS } : {}),
    supplies: available ? `${DREAM_STEALER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.dreamStealer.resupply.requestedWeek === null ? `已实际接收后续供给${s.dreamStealer.resupply.deliveries}批。` : `第${s.dreamStealer.resupply.requestedWeek}周提出请求，第${s.dreamStealer.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.dreamStealer.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 窃梦家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? DREAM_STEALER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `盗火人消化成果${s.dreamStealer.fireThiefActingAtPromotion}/100已保留；窃梦家扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成盗火人消化（${s.progression.acting}/100），并在晋升盗火人后度过12整周（${fireThiefWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完盗火人之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${DREAM_STEALER_CONSUMPTION_RISK}` : '成为盗火人后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isDreamStealerAcquisitionCommand(command: unknown): command is DreamStealerAcquisitionCommand {
  return validateDreamStealerCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateDreamStealerCommand(value: unknown): value is DreamStealerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^dream-stealer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^dream-stealer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && DREAM_STEALER_CASE_IDS.includes(value.caseId as typeof DREAM_STEALER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && DREAM_STEALER_CASE_IDS.includes(value.caseId as typeof DREAM_STEALER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateDreamStealerState(s: SliceState): boolean {
  const raw: unknown = s.dreamStealer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'fireThiefActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.marauder) || !record(s.swindler) || !record(s.cryptologist) || !record(s.fireThief)) return false;
  const firstFireThiefWeek = s.fireThief.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstFireThiefWeek + DREAM_STEALER_MIN_FIRE_THIEF_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== DREAM_STEALER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, DREAM_STEALER_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateDreamStealerLife(s)) return false;
  const dreamStealer = raw as unknown as DreamStealerState, isPromoted = promoted(s);
  if (dreamStealer.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!dreamStealer.guidanceKnown || !integer(s.fireThief.promotionWeek, 1, s.week) || !integer(dreamStealer.promotionWeek, firstConsumptionWeek, s.week) || dreamStealer.fireThiefActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS, ...CRYPTOLOGIST_ABILITY_IDS, ...FIRE_THIEF_ABILITY_IDS, ...DREAM_STEALER_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?PARASITE_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?DECEIT_MENTOR_ABILITY_IDS:[]),...(s.progression.sequence===2?FATE_TROJAN_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (dreamStealer.promotionWeek !== null || dreamStealer.fireThiefActingAtPromotion !== null || DREAM_STEALER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (dreamStealer.practice.playerPose !== 'STANDING' || dreamStealer.practice.targetPaused || !dreamStealer.practice.targetRecovered || dreamStealer.practice.token !== 'TARGET_DESK' || dreamStealer.practice.thefts !== 0 || dreamStealer.practice.executions !== 0 || dreamStealer.practice.recoveries !== 0 || dreamStealer.practice.tokenMoves !== 0) return false;
    if (dreamStealer.reflected || Object.values(dreamStealer.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of dreamStealer.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `dream-stealer-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of dreamStealer.bottles.entries()) {
    let stockWeek = firstFireThiefWeek;
    if (index < DREAM_STEALER_BOTTLE_IDS.length) {
      if (bottle.source !== DREAM_STEALER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!dreamStealer.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / DREAM_STEALER_BOTTLE_IDS.length) - 1;
      if (index % DREAM_STEALER_BOTTLE_IDS.length === 0) {
        const previous = dreamStealer.bottles.slice(index - DREAM_STEALER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > dreamStealer.promotionWeek!) return false;
    }
    if (!dreamStealer.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > dreamStealer.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > dreamStealer.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== dreamStealer.promotionWeek) return false;
    }
  }
  if (dreamStealer.resupply.requestedWeek !== null && (!dreamStealer.guidanceKnown || isPromoted || !supplyExhausted(dreamStealer) || dreamStealer.bottles.some(bottle => bottle.consumedWeek! > dreamStealer.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = dreamStealer.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, dreamStealer.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'DREAM_STEALER_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(dreamStealer.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || Object.values(dreamStealer.cases).some(r => r.contactOpen || r.status === 'PREPARED') || dreamStealer.practice.playerPose !== 'STANDING' || dreamStealer.practice.targetPaused || dreamStealer.practice.token !== 'TARGET_DESK')) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'dream-stealer-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateDreamStealerEncounter(s);
}

export { DREAM_STEALER_ABILITIES } from './content.js';
export type * from './types.js';
