import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import type { MiracleWorkerAction } from './types.js';

export const MIRACLE_WORKER_CASE_IDS = ['small-repairs', 'limited-odds', 'familiar-court'] as const;
export type MiracleWorkerCaseId = typeof MIRACLE_WORKER_CASE_IDS[number];
export const MIRACLE_WORKER_OWNER_IDS = ['mara', 'oswin', 'tessa'] as const;
export type MiracleWorkerOwnerId = typeof MIRACLE_WORKER_OWNER_IDS[number];
export type MiracleWorkerLifeAbilityId = 'diviner.s2.wish' | 'diviner.s2.probability' | 'diviner.s2.scene-projection';
export type MiracleWorkerActivityCommand =
  | { type: 'OBSERVE' | 'START' | 'STOP' | 'REPORT'; caseId: MiracleWorkerCaseId }
  | { type: 'TAKE_ITEM' | 'INSPECT_ITEM' | 'FIX_ITEM' | 'RETURN_ITEM'; ownerId: MiracleWorkerOwnerId }
  | { type: 'CHOOSE_PROBABILITY'; direction: 'UP' | 'DOWN' | 'NONE' }
  | { type: 'BUY_REPAIR_KIT' | 'BUY_OWN_BOX' | 'SELF_WISH' | 'FINISH_ORDINARY' | 'ROLL_PROBABILITY'
      | 'SUMMON_SCENE' | 'LOOK_SCENE' | 'WAIT_SCENE' | 'END_SCENE' | 'REFLECT' };
export interface MiracleWorkerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; startedWeek: number | null; closes: number;
  attempted: boolean; outcome: PublicResolutionTier | null; result: 'NONE' | 'ABILITY' | 'ORDINARY';
}
export interface MiracleWorkerRepairItem {
  id: string; ownerId: MiracleWorkerOwnerId; holder: 'OWNER' | 'PLAYER';
  step: 0 | 1 | 2; handovers: number; requested: boolean;
  confirmedSecond: number | null; similarWishBlockedUntil: number | null;
}
export interface MiracleWorkerLifeState {
  cases: Record<MiracleWorkerCaseId, MiracleWorkerCaseState>; activeCase: MiracleWorkerCaseId | null;
  reflected: boolean; elapsedSeconds: number;
  items: MiracleWorkerRepairItem[];
  kit: { id: 'MW2-REPAIR-KIT-1'; holder: 'SHOP' | 'PLAYER'; location: 'SHOP' | 'RECEPTION_WORKBENCH'; purchaseWeek: number | null;
    purchaseRevision: number | null; pricePaid: number; packets: { id: string; usedFor: string | null }[] };
  ownBox: { id: 'MW2-OWN-BOX-1'; holder: 'SHOP' | 'PLAYER'; location: 'SHOP' | 'RECEPTION_WORKBENCH'; purchaseWeek: number | null;
    purchaseRevision: number | null; pricePaid: number; repair: 'NONE' | 'WISH' | 'ORDINARY' };
  probability: { direction: 'UP' | 'DOWN' | 'NONE' | null; choiceRevision: number | null;
    rollRevision: number | null; bonus: -10 | 0 | 10; chance: number; roll: number | null };
  scene: { source: { id: string; place: 'MW2-CURRENT-COURTYARD'; bodyId: string; week: number;
      revision: number; year: number; source: 'PERSONALLY_OBSERVED_CURRENT_ORIGINAL' } | null;
    imageRecord: { id: string; sourceId: string; revision: number } | null;
    image: { id: string; sourceId: string; revision: number; remainingSeconds: number } | null;
    elapsedSeconds: number; viewed: boolean; ended: 'NONE' | 'EARLY' | 'EXPIRED' };
  spent: { cash: number; spirituality: number; mind: number };
}
export interface MiracleWorkerLifeProjection {
  insideCase: boolean; environment: string;
  cases: { id: MiracleWorkerCaseId; title: string; story: string; observations: string[];
    preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  practice: (MiracleWorkerLifeState & { facts: string[] }) | null;
}
const OWNERS = [
  { id: 'mara', itemId: 'MW2-MARA-CLASP-1', name: '玛拉', age: 27, object: '松动的普通衣扣',
    wish: '我希望这枚母亲送我的衣扣能重新扣紧，还是这一枚。' },
  { id: 'oswin', itemId: 'MW2-OSWIN-HANDLE-1', name: '奥斯温', age: 34, object: '脱落的木杯柄',
    wish: '能让我的这只旧木杯重新拿得稳吗？别换掉原杯。' },
  { id: 'tessa', itemId: 'MW2-TESSA-LATCH-1', name: '泰莎', age: 46, object: '卡住的小匣扣',
    wish: '我只想这只小匣子重新正常开合。修好后请还给我。' },
] as const;
const CASES = [
  { id: 'small-repairs', title: '先替别人修好三件小东西', ability: 'diviner.s2.wish',
    story: '当代原创成年人玛拉、奥斯温、泰莎分别主动提出小器物维修愿望。你接过原物，实际买工具与材料，做普通检查和修复，再由主人试用确认取回。随后另买一只原破损小盒，尝试对应规模的有限自许。（G）',
    facts: ['三个不同祈求者、三个不同原物；修复中物权始终属于原主人。主人确认取回才记录同类真实愿望。',
      '工具材料包60便士、四份一次性材料，自用原破盒24便士（均G）；购入后实际放在接待处原工作台。普通步骤仅抽象为检查、修复，不提供现实维修教程。',
      '至少三条同类真实愿望后，仅一次自许修好已买到的同一原盒；6灵性、2精神、知识16（G）。失败费用不退，可普通修完。',
      '同一祈求者类似愿望冷却120分钟G；本案每人最多一条，不能刷同人，也不恢复灵性或复活。'] },
  { id: 'limited-odds', title: '先付代价，再让小指示片落下', ability: 'diviner.s2.probability',
    story: '你用自己已购工具包中的原检验盘放下一枚普通指示片。先决定本次落入标记区的概率小幅增、减或不变，付清代价，之后才进行一次真实随机检验。（原创G）',
    facts: ['原检验盘、原指示片都是已付费工具包里的实体工具，不是能力生成的财产。',
      '基准50%，选择增减仅±10个百分点，当前盘40%/50%/60%，总上限95%（均G）。预选能力先实耗4灵性、1精神，不能看骰后选。',
      '只有一次1—100真实骰；失败保留骰和费用，可亲手摆回指示片普通完成。未调整与失败均不给能力掌握。'] },
  { id: 'familiar-court', title: '自己刚刚走过的当代庭院', ability: 'diviner.s2.scene-projection',
    story: '你本人走到当代接待处的原庭院，确认石阶、空墙与地面，记下这一处真实亲历的场景。在旁边净空观察区，仅试召这个熟悉场景的短时影像。（原创G）',
    facts: ['先实际亲观原庭院，再保存本人、时间与原场景来源；不接受外部图片、未知地点或别人的技能记忆。',
      '6灵性、2精神、知识16；初晋仅一个场景影像，最长30秒G。看10秒、等待真实剩余时长或主动终止都会推进本现场时钟。',
      '影像不变成永久房产或实体物品，不复制财产、人物权能；不是大幅消化后的九场景容量，没有天使神国或嫁接。'] },
] as const;
export const MIRACLE_WORKER_LIFE_ENVIRONMENT = '奇迹先从实际满足他人小愿望积累同类经历，再尝试相应有限自许。三案、人物、物价、费用、检定、120分钟冷却、初晋一场景/30秒与奖励均为原创G。观察、进入、报告各1行动，内部步骤已计入现场时间而不再扣行动；主动停止不退款。每案真实报告25消化、反思25，共100G；能力实际成功完成才触发一次8点成长包，沿共同规则随机分配到一项已知能力；活动成功记录与掌握值分别显示。概率只能有限增减，不能保证骰成功；没有复活、灵性回满、永久复制或未知能力库。';
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const ready = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 2 && s.miracleWorker.promotionWeek !== null;
const freshCase = (): MiracleWorkerCaseState => ({ status: 'AVAILABLE', observedWeek: null, startedWeek: null, closes: 0, attempted: false, outcome: null, result: 'NONE' });
export function createMiracleWorkerLifeState(): MiracleWorkerLifeState {
  return { cases: { 'small-repairs': freshCase(), 'limited-odds': freshCase(), 'familiar-court': freshCase() }, activeCase: null, reflected: false, elapsedSeconds: 0,
    items: OWNERS.map(o => ({ id: o.itemId, ownerId: o.id, holder: 'OWNER', step: 0, handovers: 0, requested: false, confirmedSecond: null, similarWishBlockedUntil: null })),
    kit: { id: 'MW2-REPAIR-KIT-1', holder: 'SHOP', location: 'SHOP', purchaseWeek: null, purchaseRevision: null, pricePaid: 0,
      packets: [1, 2, 3, 4].map(n => ({ id: `MW2-REPAIR-MATERIAL-${n}`, usedFor: null })) },
    ownBox: { id: 'MW2-OWN-BOX-1', holder: 'SHOP', location: 'SHOP', purchaseWeek: null, purchaseRevision: null, pricePaid: 0, repair: 'NONE' },
    probability: { direction: null, choiceRevision: null, rollRevision: null, bonus: 0, chance: 50, roll: null },
    scene: { source: null, imageRecord: null, image: null, elapsedSeconds: 0, viewed: false, ended: 'NONE' }, spent: { cash: 0, spirituality: 0, mind: 0 } };
}
export const hasMiracleWorkerLifeLock = (s: SliceState): boolean => s.miracleWorker.life.activeCase !== null || s.miracleWorker.life.items.some(i => i.holder === 'PLAYER') || s.miracleWorker.life.scene.image !== null;
const SIMPLE = ['BUY_REPAIR_KIT', 'BUY_OWN_BOX', 'SELF_WISH', 'FINISH_ORDINARY', 'ROLL_PROBABILITY', 'SUMMON_SCENE', 'LOOK_SCENE', 'WAIT_SCENE', 'END_SCENE', 'REFLECT'];
export function validateMiracleWorkerActivityCommand(v: unknown): v is MiracleWorkerActivityCommand {
  if (!isRecord(v)) return false;
  if (SIMPLE.includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'CHOOSE_PROBABILITY') return shape(v, ['type', 'direction']) && ['UP', 'DOWN', 'NONE'].includes(String(v.direction));
  if (['TAKE_ITEM', 'INSPECT_ITEM', 'FIX_ITEM', 'RETURN_ITEM'].includes(String(v.type))) return shape(v, ['type', 'ownerId']) && MIRACLE_WORKER_OWNER_IDS.includes(v.ownerId as MiracleWorkerOwnerId);
  return ['OBSERVE', 'START', 'STOP', 'REPORT'].includes(String(v.type)) && shape(v, ['type', 'caseId']) && MIRACLE_WORKER_CASE_IDS.includes(v.caseId as MiracleWorkerCaseId);
}
const wishCount = (l: MiracleWorkerLifeState) => l.items.filter(i => i.confirmedSecond !== null).length;
const spareMaterial = (l: MiracleWorkerLifeState) => l.kit.holder === 'PLAYER' && l.kit.packets.some(p => p.usedFor === null);
const canPay = (s: SliceState, spirituality: number, mind: number) => s.spirituality >= spirituality && s.mind > mind;
/** The root module additionally owns ritual/encounter locks; do not infer their phases here. */
export function blockMiracleWorkerActivity(s: SliceState, c: MiracleWorkerActivityCommand): string | null {
  if (!validateMiracleWorkerActivityCommand(c)) return '无效奇迹师生活命令；不能提交愿望记录、物品、影像或骰结果。';
  if (s.status !== 'ACTIVE' || !ready(s)) return '须本人已经真实晋升占卜家途径序列2奇迹师。';
  if (s.combat || s.activeEvent) return '先处理真实战斗或当前事件。';
  const l = s.miracleWorker.life, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  if (c.type === 'STOP') return l.activeCase !== c.caseId ? '没有这一项正在进行的现场。' : l.items.some(i => i.holder === 'PLAYER') ? '先把持有的同一原物实际归还；未修好的也能归还。' : l.scene.image ? '先等待影像到期或主动结束。' : null;
  if (c.type === 'RETURN_ITEM') return l.activeCase !== 'small-repairs' || l.items.find(i => i.ownerId === c.ownerId)!.holder !== 'PLAYER' ? '没有由本人持有的这一件原物。' : null;
  if (c.type === 'END_SCENE' || c.type === 'LOOK_SCENE' || c.type === 'WAIT_SCENE') return l.activeCase !== 'familiar-court' || !l.scene.image ? '没有仍然存在的这一幅场景影像。' : null;
  if (s.health <= 0 || s.mind <= 0) return '须有实际可行动的身体和精神。';
  if (['OBSERVE', 'START', 'REPORT', 'REFLECT'].includes(c.type)) {
    if (hasMiracleWorkerLifeLock(s)) return '先归还原物、结束影像并停止当前现场。';
    if (s.actionsRemaining < 1) return '需要1行动G。';
    if (c.type === 'REFLECT') return l.reflected ? '已经反思，不能重复领取。' : MIRACLE_WORKER_CASE_IDS.some(k => l.cases[k].status !== 'RESOLVED') ? '先完成三项不同的真实报告。' : null;
    if (!id || !r) return '未知生活案件。';
    if (c.type === 'OBSERVE') {
      const previous = MIRACLE_WORKER_CASE_IDS[MIRACLE_WORKER_CASE_IDS.indexOf(id) - 1];
      return r.status !== 'AVAILABLE' ? '本项真实来源已经观察并保留。' : previous && l.cases[previous].status !== 'RESOLVED' ? '先完成前一项实际报告。' : null;
    }
    if (c.type === 'START') return r.status !== 'OBSERVED' ? '须先观察，或在原现场停止后继续同一进度。' : null;
    return r.status === 'EXAMINED' && r.result !== 'NONE' && r.closes > 0 ? null : '先得到实际结果、归还原物并停止现场。';
  }
  if (!r || r.status !== 'ACTIVE') return '先进入对应真实现场；不能在场外补造结果。';
  if (r.result !== 'NONE') return '本项已经有实际结果；只可归还、结束临时影像并停止现场。';
  if (c.type === 'BUY_REPAIR_KIT' || c.type === 'BUY_OWN_BOX') {
    if (id !== 'small-repairs') return '只能在维修案实际购入。';
    const obj = c.type === 'BUY_REPAIR_KIT' ? l.kit : l.ownBox, cost = c.type === 'BUY_REPAIR_KIT' ? 60 : 24;
    return obj.holder !== 'SHOP' ? '同一原物已经买到，不重复扣款或补货。' : s.cash < cost ? `需要真实${cost}便士G。` : null;
  }
  if ('ownerId' in c) {
    const item = l.items.find(i => i.ownerId === c.ownerId)!;
    if (id !== 'small-repairs' || !item.requested) return '须先听到这位实际成年主人的主动愿望。';
    if (item.confirmedSecond !== null) return '此人已确认取回，本案只记一条；120分钟G内更不能重复类似愿望。';
    if (c.type === 'TAKE_ITEM') return item.holder !== 'OWNER' ? '原物已经由本人持有。' : null;
    if (item.holder !== 'PLAYER') return '先由原主人把同一原物实际交给你。';
    if (c.type === 'INSPECT_ITEM') return item.step !== 0 ? '已经检查过同一原物。' : l.kit.holder !== 'PLAYER' ? '先实际买到普通工具材料包。' : null;
    return item.step !== 1 ? '先实际检查，已修好的不能重复修复。' : !spareMaterial(l) ? '没有购入且未消耗的实际材料。' : null;
  }
  if (c.type === 'SELF_WISH') return id !== 'small-repairs' || wishCount(l) !== 3 ? '须三位不同主人已实际确认取回修好的原物。' : l.ownBox.holder !== 'PLAYER' || l.ownBox.repair !== 'NONE' ? '须先买到自己的同一原破盒，且它还未修好。' : r.attempted ? '本案自许已经尝试一次，不能补骰；可普通完成。' : !canPay(s, 6, 2) ? '需要6灵性、2精神并保留正精神G。' : null;
  if (c.type === 'CHOOSE_PROBABILITY') return id !== 'limited-odds' || l.kit.holder !== 'PLAYER' ? '须在实际检验盘前。' : l.probability.direction !== null || r.attempted ? '选择已锁定，不能改选或看骰后调整。' : c.direction !== 'NONE' && !canPay(s, 4, 1) ? '先付4灵性、1精神并保留正精神G。' : null;
  if (c.type === 'ROLL_PROBABILITY') return id !== 'limited-odds' || l.probability.direction === null ? '先公开选择并付清对应代价，再进行检验。' : r.attempted ? '原骰已落定，不能再抽。' : null;
  if (c.type === 'SUMMON_SCENE') return id !== 'familiar-court' || !l.scene.source ? '没有本人实际亲观的当代原庭院。' : r.attempted ? '本案召唤已尝试一次，失败可普通核验。' : !canPay(s, 6, 2) ? '需要6灵性、2精神并保留正精神G。' : null;
  if (c.type === 'FINISH_ORDINARY') {
    if (l.scene.image) return '先结束仍在场的短时影像。';
    if (id === 'small-repairs') return wishCount(l) !== 3 || l.ownBox.holder !== 'PLAYER' || !spareMaterial(l) ? '先真实修复并归还三位主人的原物、买下自用原破盒且留一份材料。' : null;
    if (id === 'limited-odds' && l.probability.direction !== null && !r.attempted) return '已为原检验锁定选择；先掷这一次原骰，不能拿普通完成退款或改选。';
    return null;
  }
  return '当前现场不能进行这项操作。';
}
export const miracleWorkerActivityReason = blockMiracleWorkerActivity;
export function applyMiracleWorkerActivity(s: SliceState, c: MiracleWorkerActivityCommand, ctx: SeerContext,
  award?: (id: MiracleWorkerLifeAbilityId, amount: number) => void): void {
  const reason = blockMiracleWorkerActivity(s, c); if (reason) throw new Error(reason);
  const l = s.miracleWorker.life, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  const pay = (spirituality: number, mind: number) => { s.spirituality -= spirituality; s.mind -= mind; l.spent.spirituality += spirituality; l.spent.mind += mind; };
  const useMaterial = (itemId: string) => { l.kit.packets.find(p => p.usedFor === null)!.usedFor = itemId; };
  if (c.type === 'STOP') { r!.closes++; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; ctx.note('实际停止本项现场', '借用原物已经归还，影像已经结束；已购原工具包和原盒留在接待处原工作台，不跟随远处身体。原进度、原骰、消耗与失败保留，可继续未完成的同一事项。'); return; }
  if (c.type === 'BUY_REPAIR_KIT' || c.type === 'BUY_OWN_BOX') {
    const obj = c.type === 'BUY_REPAIR_KIT' ? l.kit : l.ownBox, cost = c.type === 'BUY_REPAIR_KIT' ? 60 : 24;
    s.cash -= cost; l.spent.cash += cost; obj.holder = 'PLAYER'; obj.location = 'RECEPTION_WORKBENCH';
    obj.purchaseWeek = s.week; obj.purchaseRevision = s.revision; obj.pricePaid = cost; l.elapsedSeconds += 60;
    ctx.note('真实付费并取得同一原物', `${obj.id}从店家交到本人，实际放在接待处原工作台由本人保管；实付${cost}便士G。${c.type === 'BUY_REPAIR_KIT' ? '普通工具、原检验盘和四份一次性维修材料均有实体来源。' : '小盒仍是原本破损状态；购买不是修复愿望的成功。'}`); return;
  }
  if ('ownerId' in c) {
    const item = l.items.find(i => i.ownerId === c.ownerId)!, owner = OWNERS.find(o => o.id === c.ownerId)!;
    l.elapsedSeconds += c.type === 'FIX_ITEM' ? 600 : 60;
    if (c.type === 'TAKE_ITEM') { item.holder = 'PLAYER'; item.handovers++; }
    else if (c.type === 'INSPECT_ITEM') item.step = 1;
    else if (c.type === 'FIX_ITEM') { useMaterial(item.id); item.step = 2; }
    else { item.holder = 'OWNER'; item.handovers++; if (item.step === 2) { item.confirmedSecond = l.elapsedSeconds; item.similarWishBlockedUntil = l.elapsedSeconds + 7200; } }
    ctx.note(c.type === 'RETURN_ITEM' ? '原主人接回同一原物' : '亲手进行普通小器物维修', `${owner.name}（原创成年人${owner.age}岁）的${owner.object}：${c.type === 'TAKE_ITEM' ? '原主人实际交付，物权不变。' : c.type === 'INSPECT_ITEM' ? '用已购普通工具检查原损坏，未施法。' : c.type === 'FIX_ITEM' ? '实耗一份原材料，完成抽象的普通修复和试用检查。' : item.step === 2 ? '主人亲自试用、确认愿望已实现并取回。此人仅计一条，同类愿望120分钟G冷却。' : '按原状归还未修好的原物，没有满足愿望记录。'}`); return;
  }
  if (c.type === 'SELF_WISH' || c.type === 'SUMMON_SCENE') {
    pay(6, 2); r!.attempted = true; r!.outcome = ctx.check('knowledge', 16).tier; l.elapsedSeconds += 5;
    if (success(r!.outcome)) {
      if (c.type === 'SELF_WISH') { l.ownBox.repair = 'WISH'; r!.result = 'ABILITY'; }
      else {
        l.scene.imageRecord = { id: `${s.runId}:MW2-IMAGE:${s.revision}`, sourceId: l.scene.source!.id, revision: s.revision };
        l.scene.image = { ...l.scene.imageRecord, remainingSeconds: 30 };
      }
    }
    ctx.note(c.type === 'SELF_WISH' ? '一次对应小器物修复的自许' : '一次亲历庭院的有限场景召唤', `实耗6灵性、2精神，知识16G：${r!.outcome}。${success(r!.outcome) ? c.type === 'SELF_WISH' ? '三条不同真实维修愿望支撑同一自购原盒的有限修复，未生成新物。' : '唯一场景影像出现，最多30秒G；原庭院和全部实物仍在原处。须实际观察并结束。' : '失败，原物原场景不改变，费用保留；可以普通完成。'}`); return;
  }
  if (c.type === 'CHOOSE_PROBABILITY') {
    const p = l.probability; p.direction = c.direction; p.choiceRevision = s.revision; p.bonus = c.direction === 'UP' ? 10 : c.direction === 'DOWN' ? -10 : 0; p.chance = 50 + p.bonus;
    if (c.direction !== 'NONE') pay(4, 1); l.elapsedSeconds += 5;
    ctx.note('在骰前锁定有限概率选择', `基准50%，本次${p.bonus >= 0 ? '+' : ''}${p.bonus}个百分点，实际${p.chance}%，上限95%G。${c.direction === 'NONE' ? '普通检验，不施法、不扣能力费用。' : '已实付4灵性、1精神G，仍可能失败；未掷骰。'}`); return;
  }
  if (c.type === 'ROLL_PROBABILITY') {
    const p = l.probability; p.roll = ctx.roll(1, 100); p.rollRevision = s.revision; r!.attempted = true;
    r!.outcome = p.roll <= 5 ? 'GREAT_SUCCESS' : p.roll >= 96 ? 'GREAT_FAILURE' : p.roll <= p.chance ? 'SUCCESS' : 'FAILURE';
    if (success(r!.outcome)) r!.result = p.direction === 'NONE' ? 'ORDINARY' : 'ABILITY'; l.elapsedSeconds += 5;
    ctx.note('同一原指示片的一次真实落点', `基准50%${p.bonus >= 0 ? '+' : ''}${p.bonus}点＝${p.chance}%G；实际骰${p.roll}，${r!.outcome}。${success(r!.outcome) ? '原指示片落入标记区。' : '原指示片落在区外，原代价不退；可亲手普通摆回。'}未重投或保证成功。`); return;
  }
  if (c.type === 'LOOK_SCENE' || c.type === 'WAIT_SCENE' || c.type === 'END_SCENE') {
    const image = l.scene.image!, elapsed = c.type === 'WAIT_SCENE' ? image.remainingSeconds : Math.min(image.remainingSeconds, c.type === 'LOOK_SCENE' ? 10 : 1);
    image.remainingSeconds -= elapsed; l.scene.elapsedSeconds += elapsed; l.elapsedSeconds += elapsed;
    if (c.type !== 'END_SCENE') { l.scene.viewed = true; r!.result = 'ABILITY'; }
    if (image.remainingSeconds === 0 || c.type === 'END_SCENE') { l.scene.ended = image.remainingSeconds === 0 ? 'EXPIRED' : 'EARLY'; l.scene.image = null; }
    ctx.note(l.scene.image ? '亲自观察仍在时限内的影像' : '场景影像已经实际结束', `本次经过${elapsed}秒、累计${l.scene.elapsedSeconds}/30秒G；${l.scene.image ? `仅剩${l.scene.image.remainingSeconds}秒。` : l.scene.ended === 'EXPIRED' ? '已经到期消散。' : '主动停止，剩余时限作废。'}来源${image.sourceId}；没有实体财产复制或永久库存。`); return;
  }
  if (c.type === 'FINISH_ORDINARY') {
    r!.result = 'ORDINARY'; l.elapsedSeconds += id === 'small-repairs' ? 600 : 30;
    if (id === 'small-repairs') { useMaterial(l.ownBox.id); l.ownBox.repair = 'ORDINARY'; }
    ctx.note('亲手普通完成同一事项', id === 'small-repairs' ? '实耗剩余一份原材料，普通检查、修复自购原盒；此前真实他人愿望仍有效，未把失败自许记作成功。' : id === 'limited-odds' ? '亲手把原指示片摆回原检验盘，原骰与施法代价不变，没有概率成功掌握。' : '本人沿原庭院实际走过、核对原石阶和地面，没有生成影像或未知场景。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('miracle-worker-reflection'); ctx.note('从小愿望到有限奇迹的反思', '三案真实报告后一次25消化G；奇迹有积累、来源、限度和代价，失败没有被改写。'); return; }
  if (c.type === 'OBSERVE') {
    r!.status = 'OBSERVED'; r!.observedWeek = s.week; l.elapsedSeconds += 60;
    if (id === 'small-repairs') l.items.forEach(i => { i.requested = true; });
    if (id === 'familiar-court') l.scene.source = { id: `${s.runId}:MW2-COURT:${s.revision}`, place: 'MW2-CURRENT-COURTYARD', bodyId: `${s.runId}:body`, week: s.week, revision: s.revision, year: s.date.year, source: 'PERSONALLY_OBSERVED_CURRENT_ORIGINAL' };
    ctx.note('本人亲自建立当代真实来源', id === 'small-repairs' ? OWNERS.map(o => `${o.name}主动说：“${o.wish}”`).join(' ') : CASES.find(x => x.id === id)!.facts.join(' ')); return;
  }
  if (c.type === 'START') { r!.status = 'ACTIVE'; r!.startedWeek = s.week; l.activeCase = id; ctx.note('进入同一有限生活现场', '本次现场时间已付，内部步骤不会重复扣行动；保留原人物、原物、旧结果与消耗，停止前须真实收束。'); return; }
  if (c.type === 'REPORT') {
    r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`miracle-worker-case:${id}`);
    if (r!.result === 'ABILITY') { const ability = CASES.find(x => x.id === id)!.ability; if (award) award(ability, 8); else awardSeerMastery(s, ability, 8, ctx); }
    ctx.note('报告原现场的实际结果', `一次25消化G；${r!.result === 'ABILITY' ? '本项真实能力成功已记录；8点成长包按共同规则随机分配到一项已知能力G。' : '普通完成或失败回退不给能力掌握。'}报告不改骰、不退费用、不再刷同一愿望。`);
  }
}
export function miracleWorkerLifeActions(s: SliceState): MiracleWorkerAction[] {
  if (!ready(s)) return [];
  const out: MiracleWorkerAction[] = [], l = s.miracleWorker.life;
  const add = (command: MiracleWorkerActivityCommand, label: string, cost = '0行动G · 原现场子步骤') => { const reason = blockMiracleWorkerActivity(s, command); out.push({ id: `MW2-LIFE:${command.type}:${'caseId' in command ? command.caseId : 'ownerId' in command ? command.ownerId : 'direction' in command ? command.direction : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const item of CASES) {
    const r = l.cases[item.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: item.id }, `观察：${item.title}`, '1行动G · 实际建立来源');
    if (r.status === 'OBSERVED') add({ type: 'START', caseId: item.id }, `进入：${item.title}`, '1行动G · 保留同一进度');
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: item.id }, `报告：${item.title}`, '1行动 · 消化25G');
  }
  if (l.activeCase === 'small-repairs') {
    if (l.kit.holder === 'SHOP') add({ type: 'BUY_REPAIR_KIT' }, '购买普通工具与四份原材料', '0行动 · 实付60便士G');
    for (const owner of OWNERS) {
      const item = l.items.find(i => i.ownerId === owner.id)!; if (item.confirmedSecond !== null) continue;
      if (item.holder === 'OWNER') add({ type: 'TAKE_ITEM', ownerId: owner.id }, `接过${owner.name}的${owner.object}`);
      else {
        if (item.step === 0) add({ type: 'INSPECT_ITEM', ownerId: owner.id }, `普通检查${owner.object}`);
        if (item.step === 1) add({ type: 'FIX_ITEM', ownerId: owner.id }, `普通修复${owner.object}`, '0行动 · 消耗一份原材料G');
        add({ type: 'RETURN_ITEM', ownerId: owner.id }, item.step === 2 ? `让${owner.name}试用确认并取回原物` : `把未修好的原物还给${owner.name}`);
      }
    }
    if (l.ownBox.holder === 'SHOP') add({ type: 'BUY_OWN_BOX' }, '另买自己的同一原破盒', '0行动 · 实付24便士G');
    if (!l.cases['small-repairs'].attempted && l.ownBox.repair === 'NONE') add({ type: 'SELF_WISH' }, '用三条同类愿望尝试一次自许修复', '0行动 · 6灵性2精神 · 知识16G');
  }
  if (l.activeCase === 'limited-odds') {
    if (l.probability.direction === null) for (const direction of ['UP', 'DOWN', 'NONE'] as const) add({ type: 'CHOOSE_PROBABILITY', direction }, `检定前选择：${direction === 'UP' ? '+10点，实际60%' : direction === 'DOWN' ? '−10点，实际40%' : '不调整，实际50%'}`, direction === 'NONE' ? '0行动 · 普通选择G' : '0行动 · 先付4灵性1精神G');
    if (!l.cases['limited-odds'].attempted) add({ type: 'ROLL_PROBABILITY' }, '按已锁定概率掷唯一一次原骰', `0行动 · 实际${l.probability.chance}% · 上限95%G`);
  }
  if (l.activeCase === 'familiar-court') {
    if (!l.cases['familiar-court'].attempted) add({ type: 'SUMMON_SCENE' }, '召唤本人亲历庭院的唯一短时影像', '0行动 · 6灵性2精神 · 知识16G');
    if (l.scene.image) { add({ type: 'LOOK_SCENE' }, '实际看这幅影像10秒G'); add({ type: 'WAIT_SCENE' }, '观察并等待剩余时限到期'); add({ type: 'END_SCENE' }, '主动结束同一影像'); }
  }
  if (l.activeCase) { if (l.cases[l.activeCase].result === 'NONE') add({ type: 'FINISH_ORDINARY' }, '亲手普通完成同一事项'); add({ type: 'STOP', caseId: l.activeCase }, '归还完毕后停止本项现场', '0行动 · 费用与原结果保留'); }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思三项真实经历与奇迹限度', '1行动 · 消化25G');
  return out;
}
export function projectMiracleWorkerLife(s: SliceState): MiracleWorkerLifeProjection {
  if (!ready(s)) return { insideCase: false, environment: '', cases: [], practice: null };
  const l = s.miracleWorker.life;
  return { insideCase: hasMiracleWorkerLifeLock(s), environment: MIRACLE_WORKER_LIFE_ENVIRONMENT,
    cases: CASES.map(c => { const r = l.cases[c.id]; return { id: c.id, title: c.title, story: c.story, observations: r.status === 'AVAILABLE' ? [] : [...c.facts], preparation: null, status: r.status, closes: r.closes,
      result: r.result !== 'NONE' ? `${r.result === 'ABILITY' ? '本项有限能力实际成功' : '本项普通完成'}；${r.status === 'ACTIVE' ? '仍须停止现场' : '原现场已经收束'}。` : r.attempted ? `原能力结果${r.outcome}，原费用保留，可普通完成。` : null,
      contactOpen: r.status === 'ACTIVE' ? '原现场正在进行，停止前须归还/结束' : '没有未结束现场' }; }),
    practice: { ...structuredClone(l), facts: [
      `已确认的不同祈求者${wishCount(l)}/3；未取回不算愿望，原物没有替换。`,
      `真实支出${l.spent.cash}便士、${l.spent.spirituality}灵性、${l.spent.mind}精神；材料已用${l.kit.packets.filter(p => p.usedFor !== null).length}/4（G）。`,
      `原工具包位置${l.kit.location}，原盒位置${l.ownBox.location}；已购原物留在接待处工作台，不随远处身体转移。`,
      `概率基准50%，预选${l.probability.bonus >= 0 ? '+' : ''}${l.probability.bonus}点，实际${l.probability.chance}%；原骰${l.probability.roll ?? '尚未落定'}。`,
      `场景来源${l.scene.source?.id ?? '尚未亲观'}；影像记录${l.scene.imageRecord?.id ?? '尚未成功召出'}，当前剩余${l.scene.image?.remainingSeconds ?? 0}秒G。`,
      '普通成年祈求者、费用与冷却均G；不恢复灵性、不复活，不召未知场景或生成永久财产。' ] } };
}
export function validateMiracleWorkerLife(s: SliceState): boolean {
  try {
    const l = s.miracleWorker.life, initial = createMiracleWorkerLifeState();
    if (!isRecord(l) || !shape(l, ['cases', 'activeCase', 'reflected', 'elapsedSeconds', 'items', 'kit', 'ownBox', 'probability', 'scene', 'spent']) ||
        !isRecord(l.cases) || !shape(l.cases, MIRACLE_WORKER_CASE_IDS) || typeof l.reflected !== 'boolean' ||
        !integer(l.elapsedSeconds) || ![null, ...MIRACLE_WORKER_CASE_IDS].includes(l.activeCase)) return false;

    // Case lifecycle, one live scene, one report per actual case.
    let open = 0, resolved = 0;
    for (const [i, id] of MIRACLE_WORKER_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!isRecord(r) || !shape(r, ['status', 'observedWeek', 'startedWeek', 'closes', 'attempted', 'outcome', 'result']) ||
          !['AVAILABLE', 'OBSERVED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) ||
          !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) ||
          ![null, 'SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(r.outcome) ||
          typeof r.attempted !== 'boolean' || !integer(r.closes)) return false;
      if (r.status === 'AVAILABLE') {
        if (stableStringify(r) !== stableStringify(freshCase())) return false;
      } else if (s.miracleWorker.promotionWeek === null ||
          !integer(r.observedWeek, s.miracleWorker.promotionWeek, s.week) ||
          i > 0 && l.cases[MIRACLE_WORKER_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
      if (r.startedWeek !== null && !integer(r.startedWeek, r.observedWeek ?? 0, s.week) ||
          r.attempted !== (r.outcome !== null) || r.result === 'ABILITY' && (!r.attempted || !success(r.outcome))) return false;
      if (r.status === 'ACTIVE') {
        open++;
        if (l.activeCase !== id || !ready(s) || s.status !== 'ACTIVE' || s.combat || s.activeEvent || r.startedWeek !== s.week) return false;
      }
      if (['EXAMINED', 'RESOLVED'].includes(r.status) &&
          (r.closes < 1 || r.result === 'NONE' || r.startedWeek === null)) return false;
      if (r.status === 'OBSERVED' && r.result !== 'NONE' ||
          (r.attempted || r.closes > 0) && r.startedWeek === null) return false;
      if (r.status === 'RESOLVED') resolved++;
      if (s.seer.completedSources.filter(x => x === `miracle-worker-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    }
    if (open > 1 || (l.activeCase !== null) !== (open === 1)) return false;

    // Three original adults and their fixed original objects; actual custody must alternate.
    if (!Array.isArray(l.items) || l.items.length !== 3) return false;
    for (const [i, owner] of OWNERS.entries()) {
      const item = l.items[i]!;
      if (!isRecord(item) || !shape(item, ['id', 'ownerId', 'holder', 'step', 'handovers', 'requested', 'confirmedSecond', 'similarWishBlockedUntil']) ||
          item.id !== owner.itemId || item.ownerId !== owner.id || !['OWNER', 'PLAYER'].includes(item.holder) ||
          ![0, 1, 2].includes(item.step) || !integer(item.handovers) ||
          item.requested !== (l.cases['small-repairs'].status !== 'AVAILABLE')) return false;
      if ((item.handovers % 2 === 1) !== (item.holder === 'PLAYER') ||
          item.holder === 'PLAYER' && l.activeCase !== 'small-repairs' ||
          item.handovers > 0 && l.cases['small-repairs'].startedWeek === null ||
          item.step > 0 && (item.handovers < 1 || l.kit.holder !== 'PLAYER') ||
          !item.requested && stableStringify(item) !== stableStringify(initial.items[i])) return false;
      if (item.confirmedSecond === null) {
        if (item.similarWishBlockedUntil !== null || item.step === 2 && item.holder === 'OWNER') return false;
      } else if (!integer(item.confirmedSecond, 1, l.elapsedSeconds) ||
          item.similarWishBlockedUntil !== item.confirmedSecond + 7200 ||
          item.holder !== 'OWNER' || item.step !== 2 || item.handovers < 2) return false;
    }

    // Actual paid shop inputs remain at the original workbench; every consumed packet has one target.
    for (const [obj, expectedId, cost, extra] of [[l.kit, 'MW2-REPAIR-KIT-1', 60, 'packets'], [l.ownBox, 'MW2-OWN-BOX-1', 24, 'repair']] as const) {
      if (!isRecord(obj) || !shape(obj, ['id', 'holder', 'location', 'purchaseWeek', 'purchaseRevision', 'pricePaid', extra]) ||
          obj.id !== expectedId || !['SHOP', 'PLAYER'].includes(obj.holder) ||
          obj.location !== (obj.holder === 'SHOP' ? 'SHOP' : 'RECEPTION_WORKBENCH')) return false;
      if (obj.holder === 'SHOP') {
        if (obj.purchaseWeek !== null || obj.purchaseRevision !== null || obj.pricePaid !== 0) return false;
      } else if (!integer(obj.purchaseWeek, l.cases['small-repairs'].observedWeek ?? s.week + 1, s.week) ||
          !integer(obj.purchaseRevision, 0, s.revision) || obj.pricePaid !== cost ||
          l.cases['small-repairs'].startedWeek === null) return false;
    }
    if (!Array.isArray(l.kit.packets) || l.kit.packets.length !== 4 ||
        !['NONE', 'WISH', 'ORDINARY'].includes(l.ownBox.repair) || l.ownBox.holder === 'SHOP' && l.ownBox.repair !== 'NONE') return false;
    const allowedUses = [...OWNERS.map(o => o.itemId), 'MW2-OWN-BOX-1'], used: string[] = [];
    for (const [i, p] of l.kit.packets.entries()) {
      if (!isRecord(p) || !shape(p, ['id', 'usedFor']) || p.id !== `MW2-REPAIR-MATERIAL-${i + 1}` ||
          p.usedFor !== null && (typeof p.usedFor !== 'string' || !allowedUses.includes(p.usedFor) ||
            l.kit.holder !== 'PLAYER' || used.includes(p.usedFor))) return false;
      if (p.usedFor !== null) used.push(p.usedFor);
    }
    if (l.items.some(i => (i.step === 2) !== used.includes(i.id)) || (l.ownBox.repair === 'ORDINARY') !== used.includes(l.ownBox.id)) return false;
    const repair = l.cases['small-repairs'], odds = l.cases['limited-odds'], court = l.cases['familiar-court'], p = l.probability, sc = l.scene;
    if ((repair.attempted || l.ownBox.repair !== 'NONE') && (wishCount(l) !== 3 || l.ownBox.holder !== 'PLAYER') ||
        (l.ownBox.repair === 'WISH') !== (repair.attempted && success(repair.outcome)) ||
        repair.result !== (l.ownBox.repair === 'WISH' ? 'ABILITY' : l.ownBox.repair === 'ORDINARY' ? 'ORDINARY' : 'NONE')) return false;

    // Locked, prepaid adjustment precedes the sole recorded die. No result replacement.
    if (!isRecord(p) || !shape(p, ['direction', 'choiceRevision', 'rollRevision', 'bonus', 'chance', 'roll']) ||
        ![null, 'UP', 'DOWN', 'NONE'].includes(p.direction) ||
        p.bonus !== (p.direction === 'UP' ? 10 : p.direction === 'DOWN' ? -10 : 0) ||
        p.chance !== 50 + p.bonus || p.chance >= 100) return false;
    if (p.direction === null ? p.choiceRevision !== null || p.roll !== null :
        !integer(p.choiceRevision, 0, s.revision) || odds.startedWeek === null || l.kit.holder !== 'PLAYER') return false;
    if (odds.attempted !== (p.roll !== null) || p.roll === null && p.rollRevision !== null) return false;
    if (p.roll !== null && (!integer(p.roll, 1, 100) || p.direction === null ||
        !integer(p.rollRevision, (p.choiceRevision ?? -1) + 1, s.revision) || odds.outcome !==
        (p.roll <= 5 ? 'GREAT_SUCCESS' : p.roll >= 96 ? 'GREAT_FAILURE' : p.roll <= p.chance ? 'SUCCESS' : 'FAILURE'))) return false;
    if (odds.result === 'ABILITY' && (p.direction === 'NONE' || p.direction === null) ||
        odds.result !== 'NONE' && p.direction !== null && !odds.attempted ||
        odds.attempted && success(odds.outcome) && odds.result !== (p.direction === 'NONE' ? 'ORDINARY' : 'ABILITY')) return false;

    // The source and successful image identity survive expiry; active payload never becomes inventory.
    if (!isRecord(sc) || !shape(sc, ['source', 'imageRecord', 'image', 'elapsedSeconds', 'viewed', 'ended']) ||
        !integer(sc.elapsedSeconds, 0, 30) || typeof sc.viewed !== 'boolean' ||
        !['NONE', 'EARLY', 'EXPIRED'].includes(sc.ended) || (sc.source !== null) !== (court.status !== 'AVAILABLE')) return false;
    if (sc.source) {
      const f = sc.source;
      if (!isRecord(f) || !shape(f, ['id', 'place', 'bodyId', 'week', 'revision', 'year', 'source']) ||
          f.id !== `${s.runId}:MW2-COURT:${f.revision}` || f.place !== 'MW2-CURRENT-COURTYARD' ||
          f.bodyId !== `${s.runId}:body` || f.week !== court.observedWeek || !integer(f.revision, 0, s.revision) ||
          !integer(f.year, 1, s.date.year) || f.source !== 'PERSONALLY_OBSERVED_CURRENT_ORIGINAL') return false;
    }
    if ((sc.imageRecord !== null) !== success(court.outcome)) return false;
    if (sc.imageRecord) {
      const record = sc.imageRecord;
      if (!isRecord(record) || !shape(record, ['id', 'sourceId', 'revision']) || !sc.source ||
          record.id !== `${s.runId}:MW2-IMAGE:${record.revision}` || record.sourceId !== sc.source.id ||
          !integer(record.revision, sc.source.revision + 1, s.revision)) return false;
    }
    if (sc.image) {
      const im = sc.image;
      if (!isRecord(im) || !shape(im, ['id', 'sourceId', 'revision', 'remainingSeconds']) ||
          l.activeCase !== 'familiar-court' || !sc.imageRecord || im.id !== sc.imageRecord.id ||
          im.sourceId !== sc.imageRecord.sourceId || im.revision !== sc.imageRecord.revision ||
          ![10, 20, 30].includes(im.remainingSeconds) || im.remainingSeconds + sc.elapsedSeconds !== 30 ||
          sc.ended !== 'NONE' || sc.viewed !== (sc.elapsedSeconds > 0)) return false;
    }
    if (sc.ended === 'EXPIRED' && (sc.elapsedSeconds !== 30 || !sc.viewed) ||
        sc.ended === 'EARLY' && (![1, 11, 21].includes(sc.elapsedSeconds) || sc.viewed !== (sc.elapsedSeconds > 1)) ||
        sc.ended !== 'NONE' && (sc.image !== null || !success(court.outcome)) ||
        sc.viewed && (!success(court.outcome) || sc.elapsedSeconds < 10) || (court.result === 'ABILITY') !== sc.viewed) return false;
    if ((!court.attempted || !success(court.outcome)) &&
        (sc.image || sc.elapsedSeconds !== 0 || sc.ended !== 'NONE' || sc.viewed) ||
        success(court.outcome) && !sc.image && sc.ended === 'NONE') return false;

    // Exact non-refundable costs derive from immutable purchases, locked choice and one-shot attempts.
    const changedOdds = p.direction !== null && p.direction !== 'NONE';
    if (!isRecord(l.spent) || !shape(l.spent, ['cash', 'spirituality', 'mind']) ||
        l.spent.cash !== l.kit.pricePaid + l.ownBox.pricePaid ||
        l.spent.spirituality !== (repair.attempted ? 6 : 0) + (changedOdds ? 4 : 0) + (court.attempted ? 6 : 0) ||
        l.spent.mind !== (repair.attempted ? 2 : 0) + (changedOdds ? 1 : 0) + (court.attempted ? 2 : 0)) return false;
    if (s.seer.completedSources.filter(x => x === 'miracle-worker-reflection').length !== (l.reflected ? 1 : 0) || l.reflected && resolved !== 3) return false;
    if (s.miracleWorker.promotionWeek === null && stableStringify(l) !== stableStringify(initial)) return false;
    return !ready(s) || s.progression.acting === resolved * 25 + (l.reflected ? 25 : 0);
  } catch { return false; }
}
