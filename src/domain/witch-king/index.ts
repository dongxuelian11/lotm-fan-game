import { LIFE_GIVER_ABILITY_IDS } from '../life-giver/types.js';
import {SUMMONING_MASTER_ABILITY_IDS} from '../summoning-master/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APOTHECARY_ABILITY_IDS } from '../apothecary/types.js';
import { TAMER_ABILITY_IDS } from '../tamer/types.js';
import { VAMPIRE_ABILITY_IDS } from '../vampire/types.js';
import { POTION_PROFESSOR_ABILITY_IDS } from '../potion-professor/types.js';
import { CRIMSON_SCHOLAR_ABILITY_IDS } from '../crimson-scholar/types.js';
import {
  createWitchKingRitualState, currentWitchKingVisit, hasWitchKingRitualLock, canConsumeWitchKingRitual,
  closeWitchKingRitual, validateWitchKingRitualState, validateWitchKingRitualCommand,
  applyWitchKingRitualCommand, witchKingRitualActions, projectWitchKingRitual,
} from './ritual.js';
import {
  createWitchKingLifeState, validateWitchKingLife, projectWitchKingLife, witchKingLifeActions,
  hasWitchKingLifeLock, validateWitchKingActivityCommand,
} from './life.js';
import {
  createWitchKingEncounterState, validateWitchKingEncounter, projectWitchKingEncounter,
  witchKingEncounterActions, hasWitchKingEncounterLock, validateWitchKingEncounterCommand,
  applyWitchKingEncounter,
} from './encounter.js';
import {
  WITCH_KING_ABILITIES, WITCH_KING_BOTTLE_IDS, WITCH_KING_CONSUMPTION_RISK, WITCH_KING_FORMULA_STATUS,
  WITCH_KING_GUIDE, WITCH_KING_LABOUR_STEPS, WITCH_KING_LABOUR_TASKS, WITCH_KING_MIN_CRIMSON_SCHOLAR_WEEKS,
  WITCH_KING_POTION_SOURCES, WITCH_KING_PRICES, WITCH_KING_RITUAL_SOURCE, WITCH_KING_SOURCE_STATUS,
} from './content.js';
import {
  WITCH_KING_ABILITY_IDS, type WitchKingAcquisitionCommand, type WitchKingAction, type WitchKingBottle,
  type WitchKingCommand, type WitchKingProjection, type WitchKingState,
} from './types.js';

const freshBottle = (id: string, source: string, stockedWeek: number | null): WitchKingBottle => ({
  id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
  ritualId: null, ritualWindowWeek: null,
});
export function createWitchKingState(): WitchKingState {
  return {
    guidanceKnown: false, bottles: WITCH_KING_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, crimsonScholarActingAtPromotion: null,
    ritual: createWitchKingRitualState(), life: createWitchKingLifeState(), encounter: createWitchKingEncounterState(),
  };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isWitchKing = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 4;
const hasWitchKingHistory = (s:SliceState) => s.progression.pathwayId === 'moon' && [4, 3, 2].includes(s.progression.sequence ?? 0);
const isCrimsonScholar = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.apothecary.discovered && s.apothecary.guidanceKnown && s.tamer.guidanceKnown && s.vampire.guidanceKnown && s.potionProfessor.guidanceKnown && s.crimsonScholar.guidanceKnown && s.crimsonScholar.promotionWeek !== null && (isCrimsonScholar(s) || hasWitchKingHistory(s));
const bottleNumber = (bottle: Pick<WitchKingBottle, 'id'>) => Number(bottle.id.slice('witch-king-potion-'.length));
const potionPrice = (bottle: WitchKingBottle) => WITCH_KING_PRICES.potion - (bottle.labourSteps === WITCH_KING_LABOUR_STEPS ? WITCH_KING_PRICES.labourCredit : 0);
const crimsonScholarWeeks = (s: SliceState) => Math.max(0, (s.witchKing.promotionWeek ?? s.week) - (s.crimsonScholar.promotionWeek ?? s.week));
const exhaustedSupply = (state: WitchKingState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${WITCH_KING_GUIDE}的独立巫王成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4巫王原瓶witch-king-potion-${number}，非药师至深红学者旧瓶改装。完整配方仍未知，当前专业指导仪式与原封装包须另行准备。`;

export function witchKingAcquisitionBlock(s: SliceState, command: WitchKingAcquisitionCommand): string | null {
  const state = s.witchKing, ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (s.crimsonScholar.ritual.activeVisitId !== null || Object.values(s.crimsonScholar.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED') || s.crimsonScholar.practice.location !== 'START' || s.crimsonScholar.practice.field !== 'NONE' || Object.values(s.potionProfessor.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED') || hasWitchKingLifeLock(s) || hasWitchKingEncounterLock(s)) return '先实际结束原深红学者仪式或现场、原魔药实践与当前冲突，并沿原路返回。';
  if (s.tamer.companionId !== null) return '先让当前同行动物安全回到原主人处。';
  if (Object.values(s.potionProfessor.laboratory.effects).some(Boolean)) return '先实际结束原辅助药剂效果。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '须实际返回贝克兰德的原夜间药房与许可私人仪式厅。';
  if (!knownChannel(s)) return '先成为深红学者并保有艾琳的原指导渠道。';
  if (hasWitchKingHistory(s)) return '已经完成巫王晋升，不能重复准备或服药；未用原瓶保留。';
  if (hasWitchKingRitualLock(s) && command.type !== 'CONSUME') return '你仍实际在原私人仪式厅内；完成当前专业准备后独立确认饮药，或0行动沿原出口离场。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (state.guidanceKnown) return '已经听过巫王成品来源、未知完整仪式与专业指导方案G风险。';
    return s.cash < WITCH_KING_PRICES.guidance ? '本次指导需要520便士。' : null;
  }
  if (!state.guidanceKnown) return '先听艾琳说明成品来源、实际专业准备与四档风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (state.resupply.requestedWeek !== null) return '已申请后续三瓶，须等下一真实周实际到货。';
    return exhaustedSupply(state) ? null : '现有全部原瓶须真实耗尽且失败，才能申请后续供给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (state.resupply.requestedWeek === null) return '尚未申请后续巫王原瓶。';
    if (s.week <= state.resupply.requestedWeek) return '下一真实周起才能实际接收后续原瓶。';
    return exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = state.bottles.find(item => item.id === command.bottleId);
  if (!bottle) return '所选巫王原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '须独立确认本次饮用这瓶原魔药；准备核对的确认不能替代。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未实际交付，或已经耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '服药前须健康>20且精神>40；可0行动退出后正常休养，原预约和付费不回退。';
    if (s.progression.acting !== 100) return `深红学者尚未完全消化，当前扮演${s.progression.acting}/100。`;
    if (s.crimsonScholar.promotionWeek === null || crimsonScholarWeeks(s) < WITCH_KING_MIN_CRIMSON_SCHOLAR_WEEKS) return `成为深红学者后已度过${crimsonScholarWeeks(s)}/12整周。`;
    return canConsumeWitchKingRitual(s) ? null : '须本周亲自到原厅，由当前活着且自愿的格蕾丝使用本次原包完成准备，并明确核对；缺席、离场、失效监督或旧窗口不能替代。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已交付，不能重复购买或追溯抵扣劳动。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= WITCH_KING_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the working copy supplied by the shared, atomic intent boundary. */
export function applyWitchKingAcquisition(s: SliceState, command: WitchKingAcquisitionCommand, c: SeerContext): void {
  rule(validateWitchKingAcquisitionCommand(command), '巫王准备命令无效。');
  const blocked = witchKingAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法继续。');
  const state = s.witchKing;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1; s.cash -= WITCH_KING_PRICES.guidance; state.guidanceKnown = true;
      c.note('听取巫王专业指导方案G', `花1行动、520便士，向原导师${WITCH_KING_GUIDE}了解原瓶来源、专业监督准备与四档风险。${WITCH_KING_FORMULA_STATUS}${WITCH_KING_RITUAL_SOURCE}`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!;
      s.actionsRemaining -= 1; bottle.labourSteps += 1;
      c.note(WITCH_KING_LABOUR_TASKS[bottle.labourSteps - 1]!, `为第${bottleNumber(bottle)}原瓶实际完成一次对应劳务，花1行动，现为${bottle.labourSteps}/5。完成五次仅抵本瓶6300便士，仍须支付900便士；部分劳动不折现或转移。原瓶仍在供应方，不产生完整配方、仪式包或完成的仪式。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      c.note('巫王独立原瓶实际交付', `支付${paid}便士、0行动，实际取得${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五次劳动抵6300便士，另付900便士。' : '原价7200便士，未完成五次劳动不部分抵扣。'}没有附送仪式包、完整配方或完成的仪式；尚未服用。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week;
      c.note('申请后三瓶巫王成品', `现有全部原瓶已耗尽失败。花1行动核对原记录，最早第${s.week + 1}周实际到货三瓶；此刻没有新瓶。每瓶仍需7200便士或本瓶五次劳动后900便士，旧原瓶与已用仪式包不会重置。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < WITCH_KING_BOTTLE_IDS.length; offset += 1) {
        const number = first + offset; state.bottles.push(freshBottle(`witch-king-potion-${number}`, deliverySource(number, s.week), s.week));
      }
      state.resupply.deliveries += 1; state.resupply.requestedWeek = null;
      c.note('后续三瓶巫王成品实际到货', `第${s.week}周，第${first}至${first + 2}独立原瓶实际入供应方库存，0行动，尚未付费交付。所有旧失败原瓶、仪式包及既往月光经历完整保留。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, visit = currentWitchKingVisit(s);
      rule(visit !== undefined && visit.windowWeek === s.week, '缺少本周原厅当前专业准备窗口。');
      const result = c.check('will', 28);
      bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.outcome = result.tier;
      bottle.ritualId = visit.id; bottle.ritualWindowWeek = visit.windowWeek;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mindCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mindCost); state.crimsonScholarActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 4; s.progression.acting = 0;
        for (const id of WITCH_KING_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        closeWitchKingRitual(s, bottle.id);
        c.note('在当前专业准备窗口中成为巫王', `${bottle.id}于原厅本次预约${visit.id}耗尽。意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}；精神−${mindCost}、四属性各+1。深红学者消化100与旧掌握保留，两项新掌握从0，灵性上限120但当前不补满，身体性别不变。本次唯一仪式包实际耗尽，你沿普通出口离场，格蕾丝仍留在原厅。原血食、身体事实与过去真实满月经历保留；旧窗口不能重复使用。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        closeWitchKingRitual(s, bottle.id);
        c.note(severe ? '巫王魔药严重排异' : '巫王魔药排异', `${bottle.id}于${visit.id}耗尽；意志${result.roll}/${result.chance}，健康−${healthCost}、精神−${mindCost}、排异+${pollution}。本作G监督仅让此次药物排异保底1；仍为深红学者，旧消化、身体和血食事实与掌握完整保留。本次唯一仪式包实际耗尽，你沿普通出口离场，格蕾丝仍留原厅。可正常休养，另一原瓶须另付费预约、下一真实周取得新原包并重新到场；旧窗口不能重复使用。`);
      }
      return;
    }
  }
}
export function applyWitchKingCommand(s: SliceState, command: WitchKingCommand, c: SeerContext): void {
  rule(validateWitchKingCommand(command), '巫王命令无效。');
  if (validateWitchKingAcquisitionCommand(command)) return applyWitchKingAcquisition(s, command, c);
  if (validateWitchKingRitualCommand(command)) return applyWitchKingRitualCommand(s, command, c);
  if (validateWitchKingEncounterCommand(command)) return applyWitchKingEncounter(s, command, c);
  throw new Error('巫王生活实践须由共享入口结算实际掌握与消化。');
}

export function projectWitchKing(s: SliceState): WitchKingProjection {
  const state = s.witchKing, available = knownChannel(s), promoted = hasWitchKingHistory(s), known = available && state.guidanceKnown, actions: WitchKingAction[] = [];
  const add = (id: string, label: string, cost: string, command: WitchKingAcquisitionCommand) => {
    const reason = witchKingAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!known) add('learn-witch-king-guidance', '了解巫王成品、未知完整仪式与专业指导方案G', '1行动 · 520便士', { type: 'LEARN_GUIDANCE' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-witch-king-supply', '确认后三瓶成品实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周 · 尚须逐瓶付费`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-witch-king-supply', '申请后三瓶独立成品', '1行动 · 下一真实周起到货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${WITCH_KING_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵6300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶巫王魔药`, `0行动 · ${potionPrice(bottle)}便士 · 不附送仪式包`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `在当前专业准备窗口服用第${bottleNumber(bottle)}瓶`, `0行动 · 独立确认 · 深红学者${s.progression.acting}/100 · ${crimsonScholarWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '巫王 · 序列4' : '巫王之路', discovered: available, guidanceKnown: known, promoted,
    formulaKnown: false, formula: [], actions: available && ![3, 2].includes(s.progression.sequence ?? 0) ? [...actions, ...witchKingRitualActions(s), ...witchKingLifeActions(s), ...witchKingEncounterActions(s)] : [],
    bottles: known ? state.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 独立巫王成品`, source: `${bottle.source}${bottle.ritualId ? `第${bottle.ritualWindowWeek}周在原厅预约${bottle.ritualId}专业准备窗口服用；本次原包与原瓶均耗尽。` : ''}`,
      status: bottle.status === 'SUPPLIER' ? '原供应方持有，未交付' : bottle.status === 'PLAYER' ? '你实际持有，尚未服用' : `原瓶已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，仍为深红学者' : '排异，仍为深红学者'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? WITCH_KING_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: promoted ? ([3, 2].includes(s.progression.sequence ?? 0)?s.summoningMaster.witchKingActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `深红学者消化${state.crimsonScholarActingAtPromotion}/100与原掌握保留；巫王扮演${[3, 2].includes(s.progression.sequence ?? 0)?s.summoningMaster.witchKingActingAtPromotion:s.progression.acting}/100。` : available ? `深红学者消化需100（当前${s.progression.acting}/100），晋升后满12整周（${crimsonScholarWeeks(s)}/12）；当前专业准备与原封装包须另行完成，可选择保持深红学者。` : '先完成深红学者之路。',
    pollution: s.seer.pollution, risk: known ? WITCH_KING_CONSUMPTION_RISK : '先通过原导师了解巫王成品来源与实际仪式风险。',
    supplies: known ? `供应方持有${state.bottles.filter(bottle => bottle.status === 'SUPPLIER').length}瓶，你持有未用原瓶${state.bottles.filter(bottle => bottle.status === 'PLAYER').length}瓶。${state.resupply.requestedWeek === null ? `后续实际到货${state.resupply.deliveries}批。` : `第${state.resupply.requestedWeek}周申请，下一真实周起实际到货。`}成品配方仍未知，原瓶、付费预约与专业准备分别结算，旧仪式不能代替。` : '',
    ...(available ? { story: `${WITCH_KING_FORMULA_STATUS}${WITCH_KING_RITUAL_SOURCE}${WITCH_KING_SOURCE_STATUS}` } : {}),
    ritual: projectWitchKingRitual(s), life: projectWitchKingLife(s), encounter: projectWitchKingEncounter(s),
    insideCase: hasWitchKingRitualLock(s) || hasWitchKingLifeLock(s) || hasWitchKingEncounterLock(s),
    environment: available ? '原夜间药房、格蕾丝所在的许可私人仪式厅与原有限训练院。原血食、原纸、身体位置和过去真实月相仪式持续保存，不以文字重置或复制。' : '',
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateWitchKingAcquisitionCommand(v: unknown): v is WitchKingAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (typeof v.bottleId !== 'string' || !/^witch-king-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isWitchKingAcquisitionCommand = validateWitchKingAcquisitionCommand;
export function validateWitchKingCommand(v: unknown): v is WitchKingCommand {
  return validateWitchKingAcquisitionCommand(v) || validateWitchKingRitualCommand(v) || validateWitchKingActivityCommand(v) || validateWitchKingEncounterCommand(v);
}
export function validateWitchKingState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.witchKing;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'crimsonScholarActingAtPromotion', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.crimsonScholar) || !record(s.apothecary)) return false;
  const firstWeek = s.crimsonScholar.promotionWeek ?? s.week, earliestConsumption = firstWeek + WITCH_KING_MIN_CRIMSON_SCHOLAR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - earliestConsumption))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, earliestConsumption, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1)) return false;
  const state = raw as unknown as WitchKingState, promoted = hasWitchKingHistory(s), latestAcquisition = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.crimsonScholar.promotionWeek, 1, s.week) || !integer(state.promotionWeek, earliestConsumption, s.week) || state.crimsonScholarActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS, ...CRIMSON_SCHOLAR_ABILITY_IDS, ...WITCH_KING_ABILITY_IDS,...([3, 2].includes(s.progression.sequence ?? 0) ? SUMMONING_MASTER_ABILITY_IDS : []),...(s.progression.sequence === 2 ? LIFE_GIVER_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.crimsonScholarActingAtPromotion !== null || WITCH_KING_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome', 'ritualId', 'ritualWindowWeek']) || bottle.id !== `witch-king-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  if (!validateWitchKingRitualState(s) || !validateWitchKingLife(s) || !validateWitchKingEncounter(s)) return false;
  let successes = 0;
  const usedVisits = new Set<string>();
  for (const [index, bottle] of state.bottles.entries()) {
    if (index < 3) {
      if (bottle.stockedWeek !== null || bottle.source !== WITCH_KING_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(bottle.stockedWeek, earliestConsumption + 1, latestAcquisition) || bottle.source !== deliverySource(index + 1, bottle.stockedWeek)) return false;
      const start = Math.floor(index / 3) * 3;
      if (bottle.stockedWeek !== state.bottles[start]!.stockedWeek || state.bottles.slice(0, start).some(old => old.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(old.outcome ?? '') || !integer(old.consumedWeek, earliestConsumption, bottle.stockedWeek! - 1))) return false;
    }
    const stockWeek = bottle.stockedWeek ?? firstWeek;
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(bottle.acquiredWeek, stockWeek, latestAcquisition)) return false;
      if (bottle.status === 'PLAYER') { if (bottle.consumedWeek !== null || bottle.outcome !== null) return false; }
      else if (bottle.status === 'CONSUMED') {
        if (!integer(s.crimsonScholar.promotionWeek, 1, s.week) || !integer(bottle.consumedWeek, Math.max(earliestConsumption, bottle.acquiredWeek), latestAcquisition) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? '')) return false;
        if (!promoted && s.progression.acting !== 100) return false;
        if (typeof bottle.ritualId !== 'string' || usedVisits.has(bottle.ritualId) || bottle.ritualWindowWeek !== bottle.consumedWeek) return false;
        usedVisits.add(bottle.ritualId);
        const visit = state.ritual.visits.find(item => item.id === bottle.ritualId);
        if (!visit || visit.consumedBottleId !== bottle.id || visit.windowWeek !== bottle.consumedWeek || visit.closedWeek !== bottle.consumedWeek) return false;
      } else return false;
    }
    if (bottle.status !== 'CONSUMED' && (bottle.ritualId !== null || bottle.ritualWindowWeek !== null)) return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (bottle.consumedWeek !== state.promotionWeek) return false; }
  }
  if (state.ritual.visits.some(visit => visit.consumedBottleId !== null && !state.bottles.some(bottle => bottle.id === visit.consumedBottleId && bottle.ritualId === visit.id && bottle.status === 'CONSUMED'))) return false;
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0);
}

export { WITCH_KING_ABILITIES } from './content.js';
export type * from './types.js';
