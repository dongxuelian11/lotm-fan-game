import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { AlchemistAction } from './types.js';

/** The scale, price and finite nursery setup are this game's G proposal, not a canon threshold. */
export const ALCHEMIST_PLOT_PRICE = 720;
export const ALCHEMIST_GARDEN_SOURCE = '原创G：持照隔离苗圃交付的独立研究园地；土地、12株陆生原植株、2株水生原植株、活土与80升原池水均实际归玩家所有。没有野生生态、他人土地或隐秘搬入的人与动物。';
export const ALCHEMIST_RITUAL_BOUNDARY = '仪式特征已知、完整条件待核；本作导师方案G：隔离边界6×4米，有限研究园地与小池，沿原园门及普通道路进入和退出。面积、数量、价格及实施方式都是本作G，不是原著完整晋升条件。';
export const ALCHEMIST_DRAIN_CONSEQUENCE = '抽取同一边界内全部生命力：14株原植物全部死亡，原活土生命力100降至0并沙化，原池80升水归0并干涸。即使服药失败或直接离开，原地损毁仍保留，不免费复苏；再次尝试须另购真正独立的新园地、原植物、活土与水并等待下一真实周。';

export interface AlchemistPlant {
  id: string; kind: 'LAND' | 'AQUATIC'; source: string; owner: 'PLAYER'; location: string;
  status: 'LIVING' | 'DEAD';
}
export interface AlchemistSoil {
  id: string; source: string; owner: 'PLAYER'; location: string;
  status: 'LIVING' | 'SAND'; vitality: number;
}
export interface AlchemistPool {
  id: string; source: string; owner: 'PLAYER'; location: string;
  status: 'FILLED' | 'DRY'; waterLitres: number;
}
export interface AlchemistPlot {
  id: string; source: string; owner: 'PLAYER'; widthMetres: 6; lengthMetres: 4; bounded: true; paidPennies: number;
  status: 'PURCHASED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  purchasedWeek: number; plannedWeek: number; openedWeek: number | null; surveyedWeek: number | null;
  drainedWeek: number | null; drainConfirmed: boolean; windowWeek: number | null; closedWeek: number | null;
  consumedBottleId: string | null; plants: AlchemistPlant[]; soil: AlchemistSoil; pool: AlchemistPool;
}
export interface AlchemistRitualState {
  playerLocation: 'OUTSIDE' | 'PLOT'; activePlotId: string | null; plots: AlchemistPlot[];
}
export type AlchemistRitualCommand =
  | { type: 'PURCHASE_PLOT' | 'OPEN_RITUAL' | 'SURVEY' | 'LEAVE_RITUAL' }
  | { type: 'DRAIN_LIFE'; confirmed: true };
export interface AlchemistPlotProjection {
  id: string; status: string; source: string; owner: string; boundary: string;
  purchasedWeek: number; plannedWeek: number; openedWeek: number | null; surveyedWeek: number | null;
  drainedWeek: number | null; closedWeek: number | null; consumedBottleId: string | null;
  livePlants: number; deadPlants: number;
  plants: { id: string; kind: string; source: string; location: string; status: string }[];
  soil: { id: string; source: string; status: string; vitality: number };
  pool: { id: string; source: string; status: string; waterLitres: number };
  summary: string;
}
export interface AlchemistRitualProjection {
  title: string; status: string; boundary: string; source: string; appointment: string; consequence: string;
  currentPlotId: string | null; playerLocation: string; windowOpen: boolean;
  livePlants: number; deadPlants: number; soilVitality: number; poolWaterLitres: number;
  plots: AlchemistPlotProjection[];
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const plantId = (id: string, index: number) => `${id}-PLANT-${String(index + 1).padStart(2, '0')}`;
const plantSource = (id: string) => `原创G持照隔离苗圃：原植株${id}，随独立园地实际移栽交付，不是纸面额度。`;
const soilSource = (id: string) => `原创G持照隔离苗圃：原活土${id}-SOIL，交付时生命力100。`;
const poolSource = (id: string) => `原创G持照隔离苗圃：原池${id}-POOL，交付80升水与两株原水生植物。`;
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function freshPlot(id: string, week: number): AlchemistPlot {
  return {
    id, source: ALCHEMIST_GARDEN_SOURCE, owner: 'PLAYER', widthMetres: 6, lengthMetres: 4, bounded: true, paidPennies: ALCHEMIST_PLOT_PRICE,
    status: 'PURCHASED', purchasedWeek: week, plannedWeek: week + 1, openedWeek: null, surveyedWeek: null,
    drainedWeek: null, drainConfirmed: false, windowWeek: null, closedWeek: null, consumedBottleId: null,
    plants: Array.from({ length: 14 }, (_, index): AlchemistPlant => {
      const originalId = plantId(id, index);
      return { id: originalId, kind: index < 12 ? 'LAND' : 'AQUATIC', source: plantSource(originalId), owner: 'PLAYER', location: index < 12 ? id : `${id}-POOL`, status: 'LIVING' };
    }),
    soil: { id: `${id}-SOIL`, source: soilSource(id), owner: 'PLAYER', location: id, status: 'LIVING', vitality: 100 },
    pool: { id: `${id}-POOL`, source: poolSource(id), owner: 'PLAYER', location: id, status: 'FILLED', waterLitres: 80 },
  };
}
/** Check the actual original resources; an empty plot or a claimed percentage cannot qualify. */
function originalResourcesMatch(g: AlchemistPlot, drained: boolean): boolean {
  if (!record(g) || g.source !== ALCHEMIST_GARDEN_SOURCE || g.owner !== 'PLAYER' || g.widthMetres !== 6 || g.lengthMetres !== 4 || g.bounded !== true || g.paidPennies !== ALCHEMIST_PLOT_PRICE) return false;
  if (!Array.isArray(g.plants) || g.plants.length !== 14 || !record(g.soil) || !record(g.pool)) return false;
  if (!g.plants.every((plant, index) => record(plant) && shape(plant, ['id', 'kind', 'source', 'owner', 'location', 'status'])
    && plant.id === plantId(g.id, index) && plant.source === plantSource(plant.id)
    && plant.kind === (index < 12 ? 'LAND' : 'AQUATIC') && plant.owner === 'PLAYER'
    && plant.location === (index < 12 ? g.id : `${g.id}-POOL`) && plant.status === (drained ? 'DEAD' : 'LIVING'))) return false;
  if (!shape(g.soil, ['id', 'source', 'owner', 'location', 'status', 'vitality']) || g.soil.id !== `${g.id}-SOIL` || g.soil.source !== soilSource(g.id) || g.soil.owner !== 'PLAYER' || g.soil.location !== g.id || g.soil.status !== (drained ? 'SAND' : 'LIVING') || g.soil.vitality !== (drained ? 0 : 100)) return false;
  return shape(g.pool, ['id', 'source', 'owner', 'location', 'status', 'waterLitres']) && g.pool.id === `${g.id}-POOL` && g.pool.source === poolSource(g.id)
    && g.pool.owner === 'PLAYER' && g.pool.location === g.id && g.pool.status === (drained ? 'DRY' : 'FILLED') && g.pool.waterLitres === (drained ? 0 : 80);
}
export function createAlchemistRitualState(): AlchemistRitualState { return { playerLocation: 'OUTSIDE', activePlotId: null, plots: [] }; }
export function currentAlchemistPlot(s: SliceState): AlchemistPlot | undefined {
  return s.alchemist.ritual.plots.find(plot => plot.id === s.alchemist.ritual.activePlotId);
}
/** Paid land waiting for next week leaves ordinary life and time advancement available. */
export function hasAlchemistRitualLock(s: SliceState): boolean {
  return currentAlchemistPlot(s)?.status === 'OPEN' && s.alchemist.ritual.playerLocation === 'PLOT';
}
export function canConsumeAlchemistRitual(s: SliceState): boolean {
  const g = currentAlchemistPlot(s);
  return !!g && s.alchemist.guidanceKnown && g.status === 'OPEN' && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0
    && !s.activeEvent && !s.combat && s.world.city === 'BACKLUND' && s.alchemist.ritual.playerLocation === 'PLOT'
    && g.purchasedWeek < s.week && g.plannedWeek === g.purchasedWeek + 1 && g.openedWeek === s.week
    && g.surveyedWeek === s.week && g.drainedWeek === s.week && g.drainConfirmed && g.windowWeek === s.week
    && g.closedWeek === null && g.consumedBottleId === null && originalResourcesMatch(g, true);
}
/** All exits preserve the same original plants, soil and water, whether living or destroyed. */
export function closeAlchemistRitual(s: SliceState, bottleId: string | null = null): void {
  const r = s.alchemist.ritual, g = currentAlchemistPlot(s);
  if (!g) return;
  rule(g.status === 'PURCHASED' || g.status === 'OPEN', '本块原园地的仪式已结束。');
  if (bottleId !== null) {
    rule(canConsumeAlchemistRitual(s), '只有本人仍在本周同一原地抽取窗口中才能记录服药。');
    const bottle = s.alchemist.bottles.find(value => value.id === bottleId);
    rule(bottle?.status === 'CONSUMED' && bottle.consumedWeek === s.week && bottle.ritualId === g.id && bottle.ritualWindowWeek === g.windowWeek, '须先实际耗尽当前窗口对应的同一原瓶，不能仅填写瓶号。');
  }
  g.status = g.status === 'PURCHASED' ? 'CANCELLED' : 'CLOSED'; g.closedWeek = s.week; g.consumedBottleId = bottleId;
  r.playerLocation = 'OUTSIDE'; r.activePlotId = null;
}
export function validateAlchemistRitualCommand(v: unknown): v is AlchemistRitualCommand {
  if (!record(v)) return false;
  if (v.type === 'DRAIN_LIFE') return shape(v, ['type', 'confirmed']) && v.confirmed === true;
  return ['PURCHASE_PLOT', 'OPEN_RITUAL', 'SURVEY', 'LEAVE_RITUAL'].includes(String(v.type)) && shape(v, ['type']);
}
export const isAlchemistRitualCommand = validateAlchemistRitualCommand;
export function blockAlchemistRitualCommand(s: SliceState, command: AlchemistRitualCommand): string | null {
  if (!validateAlchemistRitualCommand(command)) return '仪式命令无效；抽取必须独立明确确认，不能直接设定生命力。';
  const g = currentAlchemistPlot(s);
  if (command.type === 'LEAVE_RITUAL') return g && ['PURCHASED', 'OPEN'].includes(g.status) ? null : '没有待取消或本人仍在场的原园地仪式。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体与精神可以行动。';
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 5 || s.astronomer.promotionWeek === null || !s.alchemist.guidanceKnown) return '须成为天文学家，并取得原导师的炼金术士指导。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德隔离研究园地所在城区。';
  if (Object.values(s.astronomer.cases).some(value => value.contactOpen || value.status === 'PREPARED')) return '先实际结束天文学家实践的接触与原物处理，再赴园地。';
  if (command.type === 'PURCHASE_PLOT') {
    if (g) return '已有待用或正在进行的原园地；先0行动取消或沿原路离开。';
    if (!s.alchemist.bottles.some(value => value.status === 'PLAYER')) return '须先实际持有一瓶炼金术士原瓶，再购买本次研究园地。';
    if (s.actionsRemaining < 1) return '实际购地、接收并移栽原植株需要1行动。';
    return s.cash < ALCHEMIST_PLOT_PRICE ? '新园地、14株原植物、活土与80升池水实际交付合计720便士。' : null;
  }
  if (!g) return '先实际购买含原植物、活土和水的独立园地；空地或过往死地不合格。';
  if (command.type === 'OPEN_RITUAL') {
    if (g.status !== 'PURCHASED') return '这块原园地已经入场，不能重复开启。';
    if (s.week < g.plannedWeek) return `须到下一真实周，第${g.plannedWeek}周起才能沿普通道路亲自入园。`;
    if (!originalResourcesMatch(g, false)) return '同一原园地的14株原植物、活土与80升水须仍实际齐备且存活；空地、死地与替换原物不合格。';
    if (!s.alchemist.bottles.some(value => value.status === 'PLAYER')) return '尚未持有可服的原瓶，可以0行动取消并保留活园。';
    return s.actionsRemaining < 1 ? '亲自入园与开启本次仪式需要1行动，之后勘验、独立抽取、服药或离开均0行动。' : null;
  }
  if (g.status !== 'OPEN' || s.alchemist.ritual.playerLocation !== 'PLOT' || g.openedWeek !== s.week) return '须在本周本人实际在场的同一原园地内操作。';
  if (g.drainedWeek !== null) return '这块原地已被抽尽生命，不能重抽、再勘验取得窗口或免费复苏。';
  if (!originalResourcesMatch(g, false)) return '须有当前齐备的14株原活植物、生命力100的原活土与80升原池水，空地不能提供生命代价。';
  if (command.type === 'SURVEY') return g.surveyedWeek === null ? null : '本场原物与边界已勘验，可独立选择抽取或退出。';
  return g.surveyedWeek !== s.week ? '先亲自勘验这块原地的真实植物、活土与水，明确全部损毁代价后再独立确认。' : null;
}
export function applyAlchemistRitualCommand(s: SliceState, command: AlchemistRitualCommand, c: SeerContext): void {
  rule(validateAlchemistRitualCommand(command), '仪式命令无效，破坏性抽取须独立确认。');
  const blocked = blockAlchemistRitualCommand(s, command); rule(!blocked, blocked ?? '当前无法继续仪式。');
  const r = s.alchemist.ritual;
  if (command.type === 'PURCHASE_PLOT') {
    const g = freshPlot(`AL4-PLOT-${r.plots.length + 1}`, s.week);
    s.actionsRemaining -= 1; s.cash -= ALCHEMIST_PLOT_PRICE; r.plots.push(g); r.activePlotId = g.id;
    c.note('实际购入独立活园与全部原物', `1行动、720便士，${g.id}实际归你所有；12株原陆生植物已移栽，2株原水生植物在80升原池中，原活土生命力100。第${g.plannedWeek}周起可沿普通道路亲自入园；购买不产生抽取窗口。本周可正常生活，也可0行动取消仪式并保留归你所有的活园，费用不退。${ALCHEMIST_RITUAL_BOUNDARY}`); return;
  }
  const g = currentAlchemistPlot(s)!;
  if (command.type === 'OPEN_RITUAL') {
    s.actionsRemaining -= 1; g.status = 'OPEN'; g.openedWeek = s.week; r.playerLocation = 'PLOT';
    c.note('本人实际进入原隔离园地', `1行动，沿普通道路与原园门进入${g.id}，本周尚未抽取。14株原植物存活、原活土生命力100、原池水80升；先0行动勘验，再独立选择是否全部抽取。原园门可随时0行动退出，退出不恢复资源。`); return;
  }
  if (command.type === 'SURVEY') {
    g.surveyedWeek = s.week;
    c.note('勘验真实原植物、活土与池水', `0行动。${g.id}为6×4米自有隔离边界；${g.plants.map(plant => plant.id).join('、')}共14株仍活着且都在本园，原活土${g.soil.id}生命力100，原池${g.pool.id}水80升。${ALCHEMIST_DRAIN_CONSEQUENCE}现在尚未损毁，仍可离开并保持天文学家。`); return;
  }
  if (command.type === 'DRAIN_LIFE') {
    g.drainConfirmed = true; g.drainedWeek = s.week; g.windowWeek = s.week;
    for (const plant of g.plants) plant.status = 'DEAD';
    g.soil.status = 'SAND'; g.soil.vitality = 0; g.pool.status = 'DRY'; g.pool.waterLitres = 0;
    c.note('独立确认后抽尽同一原园地生命', `0行动，${g.id}的14株原植物全部死亡、原活土沙化且生命力0、原池干涸且水0升。没有随机仪式检查，实际全部损毁本身是本作G的前置代价。仅第${s.week}周本人仍在这块原地内可另行确认服一原瓶；也可0行动离开并留在天文学家，损毁不会撤销。${ALCHEMIST_RITUAL_BOUNDARY}`); return;
  }
  const drained = g.drainedWeek !== null, unopened = g.status === 'PURCHASED';
  closeAlchemistRitual(s);
  c.note(unopened ? '取消这块原园地的仪式安排' : '沿原园门与道路实际离开', `0行动，${g.id}结束，本人在园外；当前窗口失效，原瓶不耗，720便士不退，身心与灵性不恢复。${drained ? '同一14株原植物仍死亡、原土仍沙化、原池仍干涸，永久留在原地记录中。' : '原14株植物仍存活、原活土生命力100、原池水80升，保留为归你所有且继续维护的活园；此场已结束，不将原园重置为新场。'}下次尝试须重新购入另一块独立活园并等下一真实周。`);
}

export function alchemistRitualActions(s: SliceState): AlchemistAction[] {
  if (!s.alchemist.guidanceKnown) return [];
  const g = currentAlchemistPlot(s), result: AlchemistAction[] = [];
  const add = (id: string, label: string, cost: string, command: AlchemistRitualCommand) => {
    const reason = blockAlchemistRitualCommand(s, command); result.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!g && s.progression.pathwayId === 'paragon' && s.progression.sequence === 5) add('purchase-alchemist-plot', '购入独立活园与14株原植物', '1行动 · 720便士 · 活土100与80升原池水 · 下一真实周入园', { type: 'PURCHASE_PLOT' });
  if (g?.status === 'PURCHASED') add('open-alchemist-ritual', '沿普通道路亲自进入原园地', `1行动 · 第${g.plannedWeek}周起 · 尚不损毁`, { type: 'OPEN_RITUAL' });
  if (g?.status === 'OPEN' && g.drainedWeek === null) {
    if (g.surveyedWeek === null) add('survey-alchemist-plot', '勘验原植物、活土、水和边界', '0行动 · 说明全部损毁代价 · 仍可退出', { type: 'SURVEY' });
    else add('drain-alchemist-plot', '独立确认，抽尽整块原园地生命', '0行动 · 14株原植物死亡 · 原土沙化 · 原池干涸 · 不可撤销', { type: 'DRAIN_LIFE', confirmed: true });
  }
  if (g) add('leave-alchemist-ritual', g.status === 'PURCHASED' ? '取消仪式，保留原活园' : '沿原路离开，保留土地当前后果', '0行动 · 费用不退 · 不消耗原瓶 · 不恢复资源', { type: 'LEAVE_RITUAL' });
  return result;
}
export function projectAlchemistRitual(s: SliceState): AlchemistRitualProjection {
  const known = s.alchemist.guidanceKnown, g = known ? currentAlchemistPlot(s) : undefined;
  const shown = g ?? (known ? s.alchemist.ritual.plots.at(-1) : undefined);
  const live = (plot: AlchemistPlot) => plot.plants.filter(plant => plant.status === 'LIVING').length;
  return {
    title: '有界自有活园的全部生命代价',
    status: !known ? '尚未了解仪式' : !g ? '没有当前仪式；旧地不能提供新窗口' : g.status === 'PURCHASED' ? '已实际购入活园，等待下一真实周亲自入园' : canConsumeAlchemistRitual(s) ? '同一原地已全部抽尽，当前本周服药窗口开放' : g.surveyedWeek === null ? '本人在园内，先勘验全部原物与损毁代价' : '已勘验，可独立选择抽取或退出并留在天文学家',
    boundary: known ? ALCHEMIST_RITUAL_BOUNDARY : '', source: known ? ALCHEMIST_GARDEN_SOURCE : '', consequence: known ? ALCHEMIST_DRAIN_CONSEQUENCE : '',
    appointment: !g ? '没有待入园地。' : `第${g.purchasedWeek}周实际支付720便士，第${g.plannedWeek}周起可入园；${g.openedWeek === null ? '本人在园外，本周普通生活不受锁定。' : `第${g.openedWeek}周本人实际入园，沿原路0行动离开后才能继续普通生活与推进时间。`}`,
    currentPlotId: g?.id ?? null, playerLocation: g?.status === 'OPEN' ? `本人在${g.id}原园内` : '本人在园外', windowOpen: known && canConsumeAlchemistRitual(s),
    livePlants: shown ? live(shown) : 0, deadPlants: shown ? shown.plants.length - live(shown) : 0, soilVitality: shown?.soil.vitality ?? 0, poolWaterLitres: shown?.pool.waterLitres ?? 0,
    plots: known ? s.alchemist.ritual.plots.map(plot => ({
      id: plot.id, status: plot.status === 'PURCHASED' ? '已购活园，待入场' : plot.status === 'OPEN' ? '本人本周在场' : plot.status === 'CANCELLED' ? '已取消，原活园继续维护' : plot.drainedWeek === null ? '已离开，原活园继续维护' : '已结束，原地仍死寂沙化干涸',
      source: plot.source, owner: '玩家自有', boundary: `${plot.widthMetres}×${plot.lengthMetres}米，原园门和普通道路，导师方案G`,
      purchasedWeek: plot.purchasedWeek, plannedWeek: plot.plannedWeek, openedWeek: plot.openedWeek, surveyedWeek: plot.surveyedWeek, drainedWeek: plot.drainedWeek, closedWeek: plot.closedWeek, consumedBottleId: plot.consumedBottleId,
      livePlants: live(plot), deadPlants: plot.plants.length - live(plot),
      plants: plot.plants.map(plant => ({ id: plant.id, kind: plant.kind === 'LAND' ? '原陆生植物' : '原水生植物', source: plant.source, location: plant.location, status: plant.status === 'LIVING' ? '存活' : '死亡，未复苏' })),
      soil: { id: plot.soil.id, source: plot.soil.source, status: plot.soil.status === 'LIVING' ? '原活土' : '原土已沙化', vitality: plot.soil.vitality },
      pool: { id: plot.pool.id, source: plot.pool.source, status: plot.pool.status === 'FILLED' ? '原池有水' : '原池已干涸', waterLitres: plot.pool.waterLitres },
      summary: `第${plot.purchasedWeek}周付720便士取得独立原地；${plot.openedWeek === null ? '没有入场' : `第${plot.openedWeek}周实际入场`}，${plot.drainedWeek === null ? '从未抽取，14株原植物、原活土和原池水保留' : `第${plot.drainedWeek}周独立确认全部抽取，14株原植物死亡、原土生命力0并沙化、原池水0升且干涸`}；${plot.consumedBottleId === null ? '未服原瓶' : `同一原瓶${plot.consumedBottleId}已耗尽`}；${plot.closedWeek === null ? '本次尚未结束' : `第${plot.closedWeek}周结束，土地与原物后果仍保留`}。`,
    })) : [],
  };
}

/** Persist original identities, real paid investment, chronological entry/consent and permanent damage. */
export function validateAlchemistRitualState(s: SliceState): boolean {
  const raw: unknown = s.alchemist.ritual;
  if (!record(raw) || !shape(raw, ['playerLocation', 'activePlotId', 'plots']) || !['OUTSIDE', 'PLOT'].includes(String(raw.playerLocation)) || !Array.isArray(raw.plots)) return false;
  if (raw.activePlotId !== null && typeof raw.activePlotId !== 'string') return false;
  const r = raw as unknown as AlchemistRitualState, week = (value: unknown) => integer(value, 1, s.week);
  if (r.plots.length && (!s.alchemist.guidanceKnown || s.progression.pathwayId !== 'paragon' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0) || !week(s.astronomer.promotionWeek))) return false;
  let active: AlchemistPlot | undefined;
  const usedBottles = new Set<string>();
  for (const [index, g] of r.plots.entries()) {
    if (!record(g) || !shape(g, ['id', 'source', 'owner', 'widthMetres', 'lengthMetres', 'bounded', 'paidPennies', 'status', 'purchasedWeek', 'plannedWeek', 'openedWeek', 'surveyedWeek', 'drainedWeek', 'drainConfirmed', 'windowWeek', 'closedWeek', 'consumedBottleId', 'plants', 'soil', 'pool'])) return false;
    if (g.id !== `AL4-PLOT-${index + 1}` || !['PURCHASED', 'OPEN', 'CLOSED', 'CANCELLED'].includes(g.status) || !week(g.purchasedWeek) || g.purchasedWeek < s.astronomer.promotionWeek! || g.plannedWeek !== g.purchasedWeek + 1) return false;
    if (s.alchemist.promotionWeek !== null && g.purchasedWeek > s.alchemist.promotionWeek) return false;
    if (!s.alchemist.bottles.some(bottle => week(bottle.acquiredWeek) && bottle.acquiredWeek! <= g.purchasedWeek && (bottle.consumedWeek === null || bottle.consumedWeek >= g.purchasedWeek))) return false;
    if (index > 0 && (r.plots[index - 1]!.closedWeek === null || r.plots[index - 1]!.closedWeek! > g.purchasedWeek)) return false;
    const opened = g.status === 'OPEN' || g.status === 'CLOSED', closed = g.status === 'CLOSED' || g.status === 'CANCELLED';
    if (opened ? !week(g.openedWeek) || g.openedWeek! < g.plannedWeek : g.openedWeek !== null) return false;
    if (closed ? !week(g.closedWeek) || g.closedWeek! < g.purchasedWeek : g.closedWeek !== null) return false;
    if (g.status === 'OPEN' && g.openedWeek !== s.week || g.status === 'CLOSED' && g.closedWeek !== g.openedWeek) return false;
    if (!closed) { if (active || index !== r.plots.length - 1) return false; active = g; }
    if (g.surveyedWeek !== null && (!opened || g.surveyedWeek !== g.openedWeek)) return false;
    if (typeof g.drainConfirmed !== 'boolean') return false;
    if (g.drainedWeek === null) {
      if (g.drainConfirmed || g.windowWeek !== null || g.consumedBottleId !== null || !originalResourcesMatch(g, false)) return false;
    } else {
      if (!opened || g.drainedWeek !== g.openedWeek || g.surveyedWeek !== g.openedWeek || !g.drainConfirmed || g.windowWeek !== g.drainedWeek || !originalResourcesMatch(g, true)) return false;
    }
    if (g.consumedBottleId !== null) {
      if (g.status !== 'CLOSED' || g.windowWeek === null || typeof g.consumedBottleId !== 'string' || usedBottles.has(g.consumedBottleId)) return false;
      const bottle = s.alchemist.bottles.find(value => value.id === g.consumedBottleId);
      if (!bottle || bottle.status !== 'CONSUMED' || bottle.consumedWeek !== g.closedWeek || bottle.ritualId !== g.id || bottle.ritualWindowWeek !== g.windowWeek) return false;
      usedBottles.add(g.consumedBottleId);
    }
  }
  if (r.activePlotId !== (active?.id ?? null) || r.playerLocation !== (active?.status === 'OPEN' ? 'PLOT' : 'OUTSIDE')) return false;
  if (active?.status === 'OPEN' && (s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0)) return false;
  return true;
}
