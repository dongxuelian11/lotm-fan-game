import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APPRENTICE_ABILITY_IDS } from '../apprentice/types.js';
import { TRICKMASTER_ABILITY_IDS } from '../trickmaster/types.js';
import { ASTROLOGER_ABILITY_IDS } from '../astrologer/types.js';
import { RECORDER_ABILITY_IDS } from '../recorder/types.js';
import { TRAVELER_ABILITY_IDS } from '../traveler/types.js';
import { SECRETS_SORCERER_ABILITY_IDS } from '../secrets-sorcerer/types.js';
import { WANDERER_ABILITY_IDS } from '../wanderer/types.js';
import { hasSecretsSorcererOldPractice } from '../secrets-sorcerer/index.js';
import { hasSecretsSorcererRitualLock } from '../secrets-sorcerer/ritual.js';
import { hasSecretsSorcererLifeLock } from '../secrets-sorcerer/life.js';
import { hasWandererRitualLock } from '../wanderer/index.js';
import { hasWandererLifeLock } from '../wanderer/life.js';
import { hasWandererEncounterLock } from '../wanderer/encounter.js';
import { createPlaneswalkerLifeState, applyPlaneswalkerActivity, projectPlaneswalkerLife, planeswalkerLifeActions, validatePlaneswalkerLife, validatePlaneswalkerActivityCommand, hasPlaneswalkerLifeLock } from './life.js';
import { createPlaneswalkerEncounterState, applyPlaneswalkerEncounterCommand, projectPlaneswalkerEncounter, planeswalkerEncounterActions, validatePlaneswalkerEncounter, validatePlaneswalkerEncounterCommand, hasPlaneswalkerEncounterLock } from './encounter.js';
import { createPlaneswalkerRitualState, applyPlaneswalkerRitualCommand as applyPlaneswalkerRitual, projectPlaneswalkerRitual, planeswalkerRitualActions, validatePlaneswalkerRitual, validatePlaneswalkerRitualCommand, hasPlaneswalkerRitualLock, planeswalkerRitualQualified } from './ritual.js';
import { PLANESWALKER_ABILITIES, PLANESWALKER_AUXILIARY_DONORS, PLANESWALKER_BOTTLE_IDS, PLANESWALKER_CONSUMPTION_RISK, PLANESWALKER_FORMULA_STATUS, PLANESWALKER_GUIDE, PLANESWALKER_LABOUR_STEPS, PLANESWALKER_LABOUR_TASKS, PLANESWALKER_MIN_WANDERER_WEEKS, PLANESWALKER_POTION_SOURCES, PLANESWALKER_PREPARATIONS, PLANESWALKER_PRICES, PLANESWALKER_SOURCE_STATUS, planeswalkerPotionSource } from './content.js';
import { PLANESWALKER_ABILITY_IDS, PLANESWALKER_PREPARATION_IDS, type PlaneswalkerAcquisitionCommand, type PlaneswalkerAction, type PlaneswalkerAuxiliaryKit, type PlaneswalkerBottle, type PlaneswalkerCommand, type PlaneswalkerProjection, type PlaneswalkerState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const PLANESWALKER_INHERITED_ABILITY_IDS = [...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS, ...ASTROLOGER_ABILITY_IDS, ...RECORDER_ABILITY_IDS, ...TRAVELER_ABILITY_IDS, ...SECRETS_SORCERER_ABILITY_IDS, ...WANDERER_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = PLANESWALKER_INHERITED_ABILITY_IDS;
const bottleNumber = (b: Pick<PlaneswalkerBottle, 'id'>) => Number(b.id.slice('planeswalker-potion-'.length));
export function createPlaneswalkerAuxiliaryKit(number: number): PlaneswalkerAuxiliaryKit {
  return { id: `PW2-KIT-${number}`, sealId: `PW2-SEAL-${number}`, status: 'SUPPLIER', acquiredWeek: null, openedWeek: null, consumedWeek: null, checkedWeeks: [],
    items: PLANESWALKER_AUXILIARY_DONORS.map(d => ({ id: `PW2-${d.kind}-${number}`, kind: d.kind, name: d.name, quantity: 1 as const,
      donorId: d.donorId, donorName: d.donorName, donorAge: d.donorAge, donorPathway: d.donorPathway, donorSequence: d.donorSequence,
      receiptId: `PW2-RECEIPT-${d.kind}-${number}`,
      source: `${d.donorName}（${d.donorAge}岁，${d.sequenceName}序列4，${d.donorId}）为第${number}瓶单独提供的一条${d.name}，交接凭据PW2-RECEIPT-${d.kind}-${number}；仅属于本瓶辅助箱。`,
      handedOverWeek: null, status: 'SUPPLIER' as const })),
  };
}
const freshBottle = (id: string, source: string, stockedWeek: number | null): PlaneswalkerBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null, auxiliaryKit: createPlaneswalkerAuxiliaryKit(bottleNumber({ id })) });
export function createPlaneswalkerState(): PlaneswalkerState {
  return { guidanceKnown: false, bottles: PLANESWALKER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, wandererActingAtPromotion: null, preparations: [], preparedWeek: null,
    ritual: createPlaneswalkerRitualState(), life: createPlaneswalkerLifeState(), encounter: createPlaneswalkerEncounterState() };
}
export const isPlaneswalker = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 2;
export const isPlaneswalkerAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 3;
export const hasPlaneswalkerHistory = (s: SliceState) => isPlaneswalker(s) && s.planeswalker.promotionWeek !== null;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'door' && [3, 2].includes(s.progression.sequence ?? 0) && s.apprentice.discovered && s.wanderer.guidanceKnown && integer(s.wanderer.promotionWeek, 1, s.week) && s.wanderer.bottles.filter(b => success(b.outcome) && b.status === 'CONSUMED' && b.consumedWeek === s.wanderer.promotionWeek).length === 1;
export const hasPlaneswalkerLock = (s: SliceState): boolean => s.planeswalker.preparedWeek !== null || hasPlaneswalkerRitualLock(s) || hasPlaneswalkerLifeLock(s) || hasPlaneswalkerEncounterLock(s);
const potionPrice = (b: PlaneswalkerBottle) => PLANESWALKER_PRICES.potion - (b.labourSteps === PLANESWALKER_LABOUR_STEPS ? PLANESWALKER_PRICES.labourCredit : 0);
const wandererWeeks = (s: SliceState) => Math.max(0, (s.planeswalker.promotionWeek ?? s.week) - (s.wanderer.promotionWeek ?? s.week));
const exhaustedSupply = (state: PlaneswalkerState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && failed(b.outcome));
const hasPreparations = (s: SliceState) => PLANESWALKER_PREPARATION_IDS.every(id => s.planeswalker.preparations.some(p => p.taskId === id));
const heldAuxiliaries = (b: PlaneswalkerBottle) => b.auxiliaryKit.status === 'PLAYER' && b.auxiliaryKit.items.length === 3 && b.auxiliaryKit.items.every(i => i.status === 'PLAYER' && i.quantity === 1);
/** Unfinished original scenes remain authoritative. Historical remote packets and spent energy are not repaired. */
export function hasPlaneswalkerOldSceneLock(s: SliceState): boolean {
  return hasWandererRitualLock(s) || hasWandererLifeLock(s) || hasWandererEncounterLock(s) ||
    Object.values(s.wanderer.life.cases).some(v => v.contactOpen || v.status === 'PREPARED' || v.status === 'ACTIVE') ||
    hasSecretsSorcererRitualLock(s) || hasSecretsSorcererLifeLock(s) || hasSecretsSorcererOldPractice(s) ||
    s.secretsSorcerer.life.pocket.linked || s.secretsSorcerer.life.pocket.mode !== 'NONE' ||
    Object.values(s.secretsSorcerer.life.cases).some(v => v.suspended) ||
    s.secretsSorcerer.life.pocket.items.some(i => i.location !== (i.owner === 'PLAYER' ? 'PLAYER' : 'DESK'));
}
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可先实际退出准备再休养，未服原瓶和原辅助箱保留，旧伤须实际护理。';
  if (s.progression.acting !== 100) return `漫游者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.wanderer.promotionWeek === null || wandererWeeks(s) < PLANESWALKER_MIN_WANDERER_WEEKS) return `从漫游者实际晋升周起已过${wandererWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!hasPreparations(s)) return '须先实际完成坐标复核、防护检查与回程演练三项不同专业准备。';
  return planeswalkerRitualQualified(s) ? null : '须先在本星球外九处真实留下传说：逐地实际帮助、当地亲见，隔真实周回访听取转述并核原记录；旧秘法师的封印经历不能替代。';
}
export function validatePlaneswalkerAcquisitionCommand(v: unknown): v is PlaneswalkerAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(v.type)) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && PLANESWALKER_PREPARATION_IDS.includes(v.taskId as typeof PLANESWALKER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^planeswalker-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(v.type)) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isPlaneswalkerAcquisitionCommand = validatePlaneswalkerAcquisitionCommand;
export function validatePlaneswalkerCommand(v: unknown): v is PlaneswalkerCommand {
  return validatePlaneswalkerAcquisitionCommand(v) || validatePlaneswalkerRitualCommand(v) || validatePlaneswalkerActivityCommand(v) || validatePlaneswalkerEncounterCommand(v);
}
export function planeswalkerAcquisitionBlock(s: SliceState, command: PlaneswalkerAcquisitionCommand): string | null {
  if (!validatePlaneswalkerAcquisitionCommand(command)) return '旅法师准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受专业服药照护保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if (hasPlaneswalkerOldSceneLock(s) || hasPlaneswalkerRitualLock(s) || hasPlaneswalkerLifeLock(s) || hasPlaneswalkerEncounterLock(s)) return '先按实际位置收束原现场、远行与原物，身体从异星真实返回并结束当次路线；普通退出不能瞬间回城。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德的独立旅法师指导场。';
  if (!knownChannel(s)) return '实际成为漫游者并保留原指导渠道后，才能了解旅法师之路。';
  if (!isPlaneswalkerAcquisitionStage(s)) return '已经真实晋升旅法师，不能重复准备或服药；未服原瓶及对应原箱保留。';
  const state = s.planeswalker;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已实际检查好服药场地与原辅助箱；先独立确认饮药，或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取本渠道、九处传说仪式与本次服药风险。' : s.cash < PLANESWALKER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听专业指导说明真实九处传说、独立成品和三种辅助原件，以及当次服药的四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    const held = state.bottles.filter(b => b.status === 'PLAYER');
    if (!held.length) return '先实际取得至少一瓶未服旅法师原瓶及其独立辅助封存箱。';
    if (held.some(b => !heldAuxiliaries(b))) return '所持原瓶须各自附带原封存箱及三条未耗辅助原件；不能复用另一瓶的已耗材料。';
    return s.cash < PLANESWALKER_PRICES.preparation ? '当次场地与原辅助箱检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已申请下一批，须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶和各自辅助原件须真实服用且失败耗尽，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批旅法师原瓶与独立原箱。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部失败耗尽。';
  if (!('bottleId' in command)) return '未知旅法师准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选旅法师独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER' || !heldAuxiliaries(bottle)) return '须实际持有所选未服原瓶和属于本瓶的三条未耗辅助原件。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week && bottle.preparationWeek === s.week && bottle.auxiliaryKit.checkedWeeks.at(-1) === s.week ? null : '须另付1行动与140便士，完成本周九处履历复核、服药场地及所选原瓶辅助箱检查；旧检查不能续用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= PLANESWALKER_LABOUR_STEPS ? '本瓶五项实际劳务已完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶与对应三件辅助原件需要${potionPrice(bottle)}便士。` : null;
}

/** The application commits these mutations atomically with the rest of the working copy. */
export function applyPlaneswalkerAcquisition(s: SliceState, command: PlaneswalkerAcquisitionCommand, ctx: SeerContext): void {
  const reason = planeswalkerAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.planeswalker;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= PLANESWALKER_PRICES.guidance; state.guidanceKnown = true;
      state.bottles.forEach((b, i) => { b.source = planeswalkerPotionSource(i + 1, s.week); b.stockedWeek = s.week; });
      ctx.note('听取旅法师成品与九处传说指导', `花1行动、500便士，第${s.week}周登记独立渠道与三瓶库存。${PLANESWALKER_FORMULA_STATUS}${PLANESWALKER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = PLANESWALKER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}此项不替代任何一处异星帮助或传说，也不提前检查服药场地。`); return;
    }
    case 'PREPARE_PROMOTION': {
      s.actionsRemaining--; s.cash -= PLANESWALKER_PRICES.preparation; state.preparedWeek = s.week;
      const checked: string[] = [];
      for (const b of state.bottles.filter(v => v.status === 'PLAYER')) {
        b.preparationWeek = s.week; b.auxiliaryKit.openedWeek ??= s.week; b.auxiliaryKit.checkedWeeks.push(s.week);
        checked.push(`${b.id}／${b.auxiliaryKit.id}／原封签${b.auxiliaryKit.sealId}`);
      }
      ctx.note('复核九处传说并检查本周原瓶与辅助箱', `花1行动、140便士，核对已实际完成的九处履历和当周场地。逐一打开检查${checked.join('，')}，核星之虫、时之虫、灵体之虫各一条及三位序列4提供者的独立凭据。原件尚未消耗；须另行确认所选原瓶。可0行动沿原出口取消，费用不退，原检查历史保留。`); return;
    }
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次旅法师服药准备', '0行动实际退出，本次场地检查失效；已付行动与140便士不返。未服原瓶、三条原辅助件和已开原封签的检查历史都保留，既有九处传说不变；下次须重新付费核验。'); return;
    case 'POTION_WORK': {
      const b = state.bottles.find(v => v.id === command.bottleId)!;
      s.actionsRemaining--; b.labourSteps++;
      ctx.note(PLANESWALKER_LABOUR_TASKS[b.labourSteps - 1]!, `花1行动，完成${b.id}第${b.labourSteps}/5项实际工作。五项只抵本瓶5500便士，另付900便士；不折现、不转瓶，不生成原件，不替代九处传说与三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const b = state.bottles.find(v => v.id === command.bottleId)!, paid = potionPrice(b), kit = b.auxiliaryKit;
      s.cash -= paid; b.status = 'PLAYER'; b.acquiredWeek = s.week; kit.status = 'PLAYER'; kit.acquiredWeek = s.week;
      for (const item of kit.items) { item.status = 'PLAYER'; item.handedOverWeek = s.week; }
      ctx.note('旅法师原瓶与专属三件辅助原物交付', `0行动、${paid}便士，实际取得${b.id}、原箱${kit.id}和封签${kit.sealId}。${kit.items.map(i => `${i.name}一条（${i.id}，提供者${i.donorName}，凭据${i.receiptId}）`).join('；')}。尚未开箱核对或服药；本瓶不能借用另一瓶的耗尽材料。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批旅法师原瓶与辅助箱', `花1行动核对全部失败原瓶与已耗辅助原件，最早第${s.week + 1}周接收另三瓶和各自新箱。此刻没有新库存，九处履历、失败、成本与各原瓶检查历史保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < PLANESWALKER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`planeswalker-potion-${number}`, planeswalkerPotionSource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新三瓶旅法师成品与独立辅助箱实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入供应方库存，各附新的独立原封签和三条有各自交接凭据的辅助原件，0行动。尚未交付；每瓶仍需6400便士，或本瓶五项劳务后900便士。旧瓶、旧虫和旧路线耗材均不复原。`); return;
    }
    case 'CONSUME': {
      const b = state.bottles.find(v => v.id === command.bottleId)!, result = ctx.check('will', 30), kit = b.auxiliaryKit;
      b.status = 'CONSUMED'; b.outcome = result.tier; b.consumedWeek = s.week; b.preparationWeek = state.preparedWeek;
      kit.status = 'CONSUMED'; kit.consumedWeek = s.week; for (const item of kit.items) item.status = 'CONSUMED';
      state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind -= mentalCost; state.wandererActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of PLANESWALKER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为旅法师·门序列2', `${b.id}及原箱${kit.id}中的三条辅助原件全部耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；漫游者消化100留存，${INHERITED_ABILITY_IDS.length}项旧掌握原值保留，两项新掌握从0开始。灵性上限120且当前不补满，性别、伤势、累计风险不变。九处真实传说与原人物、原物和每次出返记录保留，旧护具与旧能源不回填。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '旅法师魔药严重排异' : '旅法师魔药排异', `${b.id}与原箱${kit.id}的三条原辅助件实际耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。本次专业照护使健康和精神最低为1，普通死亡不受保护。仍为漫游者，消化100与十三项旧掌握保留；九处真实传说和三项专业经历不回滚。本人沿原出口实际离开，休养后须筹另一独立原瓶和对应新辅助原件，再付1行动、140便士复核；失败原箱不能复用。`);
      }
      return;
    }
  }
}
export function applyPlaneswalkerCommand(s: SliceState, command: PlaneswalkerCommand, ctx: SeerContext): void {
  if (!validatePlaneswalkerCommand(command)) throw new Error('旅法师命令无效。');
  if (validatePlaneswalkerAcquisitionCommand(command)) return applyPlaneswalkerAcquisition(s, command, ctx);
  if (hasPlaneswalkerOldSceneLock(s)) throw new Error('先按原位置收束此前现场、原物与尚未结束的实践，再开始旅法师行程。');
  if (validatePlaneswalkerRitualCommand(command)) {
    if (!knownChannel(s) || !isPlaneswalkerAcquisitionStage(s) || !s.planeswalker.guidanceKnown) throw new Error('九处传说行程只向当前已听取指导的漫游者开放；晋升后仅保留真实履历。');
    if (s.planeswalker.preparedWeek !== null || hasPlaneswalkerLifeLock(s) || hasPlaneswalkerEncounterLock(s)) throw new Error('先实际结束当前准备或现场，再安排新的远行。');
    return applyPlaneswalkerRitual(s, command, ctx);
  }
  if (!isPlaneswalker(s) || !hasPlaneswalkerHistory(s)) throw new Error('旅法师新实践与遭遇只向当前门序列2开放，旧漫游者经历不能代替当前资格。');
  if (hasPlaneswalkerRitualLock(s) || s.planeswalker.preparedWeek !== null) throw new Error('先实际完成当前远行的回程与收尾，再进入新的实践现场。');
  if (validatePlaneswalkerActivityCommand(command)) return applyPlaneswalkerActivity(s, command, ctx);
  if (validatePlaneswalkerEncounterCommand(command)) return applyPlaneswalkerEncounterCommand(s, command, ctx);
  throw new Error('未知旅法师命令。');
}

export function projectPlaneswalker(s: SliceState): PlaneswalkerProjection {
  const state = s.planeswalker, available = knownChannel(s), promoted = isPlaneswalker(s), actions: PlaneswalkerAction[] = [];
  const add = (id: string, label: string, cost: string, command: PlaneswalkerAcquisitionCommand) => {
    const reason = planeswalkerAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && isPlaneswalkerAcquisitionStage(s)) {
    if (!state.guidanceKnown) add('learn-planeswalker-guidance', '听取旅法师成品与九处传说指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of PLANESWALKER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`planeswalker-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-planeswalker-promotion', '复核九处传说、场地与原辅助箱', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-planeswalker-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶与原件保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-planeswalker-supply', '确认下一批三瓶与新辅助箱到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-planeswalker-supply', '申请下一批独立成品与三件辅助原物', '1行动 · 下一真实周起到货 · 每瓶另付费用', { type: 'REQUEST_SUPPLY' });
      for (const b of state.bottles) {
        if (b.status === 'SUPPLIER') {
          if (b.labourSteps < PLANESWALKER_LABOUR_STEPS) add(`work-${b.id}`, `第${bottleNumber(b)}瓶 · ${PLANESWALKER_LABOUR_TASKS[b.labourSteps]}`, `1行动 · 劳动${b.labourSteps}/5 · 五项抵5500便士`, { type: 'POTION_WORK', bottleId: b.id });
          add(`buy-${b.id}`, `领取第${bottleNumber(b)}瓶与专属三件辅助原物`, `0行动 · ${potionPrice(b)}便士`, { type: 'BUY_POTION', bottleId: b.id });
        } else if (b.status === 'PLAYER') add(`consume-${b.id}`, `独立确认服用第${bottleNumber(b)}瓶`, `0行动 · 漫游者消化${s.progression.acting}/100 · ${wandererWeeks(s)}/12整周 · 消耗本瓶三条辅助原件`, { type: 'CONSUME', bottleId: b.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '旅法师 · 门序列2' : '旅法师之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    sourceLabel: available ? `${PLANESWALKER_GUIDE}${state.bottles[0]?.stockedWeek === null ? '；尚待购买本次专业指导' : `；第${state.bottles[0]?.stockedWeek}周实际登记`}` : '',
    prices: available ? { ...PLANESWALKER_PRICES } : null,
    formulaKnown: false,
    formula: available && state.guidanceKnown ? PLANESWALKER_AUXILIARY_DONORS.map(d => ({ name: d.name, quantity: 1, unit: '条' })) : [],
    ...(available ? { story: `${PLANESWALKER_FORMULA_STATUS}${PLANESWALKER_SOURCE_STATUS}` } : {}),
    supplies: available ? `${state.guidanceKnown ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。` : '专业介绍后登记三瓶独立成品与各自辅助箱；现在尚未交付。'}每瓶6400便士，或本瓶五项实际劳动后900便士，包含三件专属辅助原物；场地检查另付140便士。现有全部失败耗尽才可花1行动申请，跨真实周到货仍须逐瓶实际付费。` : '',
    actions: available ? [...actions, ...(state.guidanceKnown && isPlaneswalkerAcquisitionStage(s) ? planeswalkerRitualActions(s) : []), ...(promoted ? [...planeswalkerLifeActions(s), ...planeswalkerEncounterActions(s)] : [])] : [],
    bottles: available ? state.bottles.map(b => ({
      id: b.id, title: `第${bottleNumber(b)}瓶 · 旅法师独立成品与辅助箱`,
      source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}原箱${b.auxiliaryKit.id}、原封签${b.auxiliaryKit.sealId}。${b.auxiliaryKit.items.map(i => `${i.name}一条（${i.id}），${i.source}`).join('')} ${b.auxiliaryKit.checkedWeeks.length ? `实际检查周：${b.auxiliaryKit.checkedWeeks.join('、')}；${b.status === 'CONSUMED' ? `第${b.consumedWeek}周全部耗尽。` : '原件尚未耗用，旧检查不会延长本次场地有效期。'}` : '尚未打开核对原辅助箱。'}`,
      status: b.status === 'SUPPLIER' ? `${state.guidanceKnown ? '供应方保管原瓶与原箱' : '待专业介绍'} · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '原瓶与三条辅助原件已交付，尚未服用' : `原瓶与三条辅助原件全部耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为漫游者' : '排异，仍为漫游者'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true },
    })) : [],
    preparations: available ? PLANESWALKER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [],
    preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? PLANESWALKER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `漫游者消化${state.wandererActingAtPromotion}/100留存；旅法师扮演${s.progression.acting}/100。三案各实际报告25、一次反思25，普通完成同样可消化；各项新能力每案只在真实应用后最多增加8掌握，成功而未使用不奖。九处原传说不重复算成本阶生活实践。` : available ? `漫游者需消化100（当前${s.progression.acting}/100）、从实际晋升周起12整周（当前${wandererWeeks(s)}/12）；另须九处真实传说、三项不同专业准备与本周场地及原辅助箱检查。` : '先走完漫游者之路。',
    pollution: s.seer.pollution, risk: available ? PLANESWALKER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `漫游者在第${s.wanderer.promotionWeek}周晋升；${promoted ? `原消化${state.wandererActingAtPromotion}/100已留存` : `当前消化${s.progression.acting}/100`}。旅法师的十二整周从该实际晋升周计算。`,
      `历阶消化：学徒${s.trickmaster.apprenticeActingAtPromotion}、戏法大师${s.astrologer.trickmasterActingAtPromotion}、占星人${s.recorder.astrologerActingAtPromotion}、记录官${s.traveler.recorderActingAtPromotion}、旅行家${s.secretsSorcerer.travelerActingAtPromotion}、秘法师${s.wanderer.secretsSorcererActingAtPromotion}、漫游者${promoted ? state.wandererActingAtPromotion : s.progression.acting}。`,
      `${INHERITED_ABILITY_IDS.length}项已有掌握保持原值：${INHERITED_ABILITY_IDS.map(id => `${id}=${s.progression.mastery[id] ?? 0}`).join('，')}。只有两项旅法师新能力从0开始。`,
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；伤势记录${s.injuries.length}项，未治疗重伤${s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length}项，累计风险${s.injuryRisk}。`,
      `漫游者原护具${s.wanderer.life.suit.id}剩${s.wanderer.life.suit.protectionSeconds}秒；原能源${s.wanderer.life.energy.id}剩${s.wanderer.life.energy.remaining}片、已耗${s.wanderer.life.energy.spent}片；原包${s.wanderer.life.packet.id}仍按原记录位于${s.wanderer.life.packet.location}。新路线装备与辅助原件都有各自独立来源，不回填这些旧物。`,
      `漫游者既有遭遇记录：${s.wanderer.encounter.status}。原卡西安、原武器、既有伤势和原终局均按既有状态保留。秘法师的原门、口袋原物与被封印原活体也不会重置。`,
      '九处聚居点的原居民、实际帮助、见证、隔周转述与出返履历持续保留。药败只耗本次原瓶、专属三件辅助原物和场地检查，重试须真实筹备新原件并专业复核，不能靠旧封箱续杯。',
    ] : [],
    ritual: projectPlaneswalkerRitual(s), life: projectPlaneswalkerLife(s), encounter: projectPlaneswalkerEncounter(s), insideCase: hasPlaneswalkerLock(s),
    environment: available ? '九处独立聚居点位于本星球外同一真实异星，各有原居民、原航标、生活舱和独立事迹记录。每次出返使用当次付费取得的原护具与两片原能源，原身体与携物真实改变位置。晋升后的有限实践仍须核两端、当前许可与原物，普通退出不会替代实际返回。' : '',
  };
}

function validateAuxiliaryKit(b: PlaneswalkerBottle, number: number, s: SliceState, firstConsumptionWeek: number, lastAcquisitionWeek: number): boolean {
  const kit = b.auxiliaryKit, original = createPlaneswalkerAuxiliaryKit(number);
  if (!record(kit) || !shape(kit, ['id', 'sealId', 'status', 'acquiredWeek', 'openedWeek', 'consumedWeek', 'checkedWeeks', 'items']) || kit.id !== original.id || kit.sealId !== original.sealId || kit.status !== b.status || kit.acquiredWeek !== b.acquiredWeek || kit.consumedWeek !== b.consumedWeek || !Array.isArray(kit.checkedWeeks) || !Array.isArray(kit.items) || kit.items.length !== original.items.length) return false;
  for (const [index, item] of kit.items.entries()) {
    const expected = original.items[index]!;
    if (!record(item) || !shape(item, Object.keys(expected)) || item.handedOverWeek !== b.acquiredWeek || item.status !== b.status) return false;
    for (const key of ['id', 'kind', 'name', 'quantity', 'donorId', 'donorName', 'donorAge', 'donorPathway', 'donorSequence', 'receiptId', 'source'] as const) if (item[key] !== expected[key]) return false;
  }
  if (kit.checkedWeeks.length === 0) return kit.openedWeek === null && b.preparationWeek === null && b.status !== 'CONSUMED';
  if (b.status === 'SUPPLIER' || !integer(b.acquiredWeek, 1, lastAcquisitionWeek) || !hasPreparations(s) || !planeswalkerRitualQualified(s) || kit.openedWeek !== kit.checkedWeeks[0] || b.preparationWeek !== kit.checkedWeeks.at(-1)) return false;
  const maxWeek = b.consumedWeek ?? lastAcquisitionWeek;
  for (const [index, week] of kit.checkedWeeks.entries()) if (!integer(week, Math.max(firstConsumptionWeek, b.acquiredWeek), maxWeek) || index > 0 && week < kit.checkedWeeks[index - 1]! || s.planeswalker.preparations.some(p => p.completedWeek > week)) return false;
  return b.status !== 'CONSUMED' || b.preparationWeek === b.consumedWeek;
}
/** Exact original identities, actual chronology, old-history preservation and owned consumables. */
export function validatePlaneswalkerState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.planeswalker;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'wandererActingAtPromotion', 'preparations', 'preparedWeek', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as PlaneswalkerState, promoted = isPlaneswalker(s), acquisitionStage = isPlaneswalkerAcquisitionStage(s);
  const firstWeek = s.wanderer.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + PLANESWALKER_MIN_WANDERER_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  const guidanceWeek = state.bottles[0]?.stockedWeek ?? null;
  if (state.guidanceKnown) {
    if (!knownChannel(s) || !integer(guidanceWeek, firstWeek, lastAcquisitionWeek)) return false;
  } else if (guidanceWeek !== null) return false;
  if (acquisitionStage && (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > PLANESWALKER_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !PLANESWALKER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, guidanceWeek ?? firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, Math.max(firstConsumptionWeek, guidanceWeek ?? firstWeek), s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !planeswalkerRitualQualified(s) || !state.bottles.some(b => b.status === 'PLAYER') || state.bottles.some(b => b.status === 'PLAYER' && (!heldAuxiliaries(b) || b.preparationWeek !== state.preparedWeek || b.auxiliaryKit.checkedWeeks.at(-1) !== state.preparedWeek)) || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasPlaneswalkerOldSceneLock(s) || hasPlaneswalkerRitualLock(s) || hasPlaneswalkerLifeLock(s) || hasPlaneswalkerEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.wanderer.promotionWeek, 1, s.week) || !integer(state.promotionWeek, Math.max(firstConsumptionWeek, guidanceWeek ?? firstWeek), s.week) || state.wandererActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !planeswalkerRitualQualified(s) || hasPlaneswalkerOldSceneLock(s) || hasPlaneswalkerRitualLock(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...PLANESWALKER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.wandererActingAtPromotion !== null || PLANESWALKER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome', 'auxiliaryKit']) || b.id !== `planeswalker-potion-${index + 1}` || !integer(b.labourSteps, 0, PLANESWALKER_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < PLANESWALKER_BOTTLE_IDS.length) {
      if (state.guidanceKnown) {
        if (b.stockedWeek !== guidanceWeek || b.source !== planeswalkerPotionSource(index + 1, guidanceWeek!)) return false;
      } else if (b.stockedWeek !== null || b.source !== PLANESWALKER_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, Math.max(firstConsumptionWeek, guidanceWeek ?? firstWeek) + 1, lastAcquisitionWeek) || b.source !== planeswalkerPotionSource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % PLANESWALKER_BOTTLE_IDS.length;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek) return false;
      if (state.bottles.slice(0, batchStart).some(previous => previous.status !== 'CONSUMED' || !failed(previous.outcome) || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') {
      if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, lastAcquisitionWeek)) return false;
      if (b.status === 'PLAYER') {
        if (b.consumedWeek !== null || b.outcome !== null) return false;
      } else if (b.status === 'CONSUMED') {
        if (!integer(s.wanderer.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || !planeswalkerRitualQualified(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
    if (!validateAuxiliaryKit(b, index + 1, s, firstConsumptionWeek, lastAcquisitionWeek)) return false;
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, Math.max(firstConsumptionWeek, guidanceWeek ?? firstWeek), s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validatePlaneswalkerRitual(s) || !validatePlaneswalkerLife(s) || !validatePlaneswalkerEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { PLANESWALKER_ABILITIES } from './content.js';
export { PLANESWALKER_ABILITY_IDS } from './types.js';
export type * from './types.js';
