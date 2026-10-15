import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameDays, addGameYears, compareGameDates, formatGameDate, gameDaysBetween } from '../game-calendar.js';
import { hasLongChapterHandoff, isLongChapterEraClosed } from '../long-chapter/index.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { activeFerrymanChannel, hasFerrymanRitualLock } from './index.js';
import { hasFerrymanLifeLock } from './life.js';
import { hasFerrymanEncounterLock } from './encounter.js';
import { hasDeathConsulLifeLock } from '../death-consul/life.js';

export type FerrymanEraCommand = { type: 'ERA_ENTER' | 'ERA_LEAVE' | 'ERA_WORK' | 'ERA_REST' | 'ERA_NEXT_WEEK' | 'ERA_CARE' };
export interface FerrymanEraState {
  location: 'OUTSIDE' | 'RECEPTION'; elapsedSeconds: number; travelledMetres: number;
  works: number; rests: number; weeksAdvanced: number; income: number; expenses: number;
  emergencyWorks: number; emergencyWorkUsed: boolean; treatments: number;
}
export interface FerrymanEraAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FerrymanEraCommand }
export interface FerrymanEraProjection {
  available: boolean; location: string; current: string; history: string[]; economy: string; counters: string[]; actions: FerrymanEraAction[];
}
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const COMMANDS = ['ERA_ENTER', 'ERA_LEAVE', 'ERA_WORK', 'ERA_REST', 'ERA_NEXT_WEEK', 'ERA_CARE'] as const;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export function createFerrymanEraState(): FerrymanEraState {
  return { location: 'OUTSIDE', elapsedSeconds: 0, travelledMetres: 0, works: 0, rests: 0, weeksAdvanced: 0, income: 0, expenses: 0, emergencyWorks: 0, emergencyWorkUsed: false, treatments: 0 };
}
/** The public residence handoff initializes only the same-week emergency allowance, never live resources. */
export function initializeFerrymanEra(s: SliceState): void {
  if (!hasLongChapterHandoff(s) || !same(s.ferryman.era, createFerrymanEraState())) throw new Error('只有首次居所交接可以登记当代生活，不能重置已发生的行动。');
  s.ferryman.era.emergencyWorkUsed = s.longChapter.newLife.emergencyWorkUsed;
}
/** Called by the first actual post-cycle introduction, or by the guarded public re-entry command. */
export function arriveFerrymanEra(s: SliceState): void {
  if (!hasLongChapterHandoff(s)) throw new Error('须先完成真实居所交接，才能沿普通道路到当代接待处。');
  if (s.ferryman.era.location === 'RECEPTION') return;
  s.ferryman.era.location = 'RECEPTION'; s.ferryman.era.elapsedSeconds += 12; s.ferryman.era.travelledMetres += 12;
}
export function validateFerrymanEraCommand(v: unknown): v is FerrymanEraCommand {
  return record(v) && shape(v, ['type']) && COMMANDS.includes(v.type as typeof COMMANDS[number]);
}
export const isFerrymanEraCommand = validateFerrymanEraCommand;
export function blockFerrymanEraCommand(s: SliceState, c: FerrymanEraCommand): string | null {
  if (!validateFerrymanEraCommand(c)) return '摆渡人当代生活命令无效。';
  if (!hasLongChapterHandoff(s) || !isLongChapterEraClosed(s)) return '须先实际完成居所交接；原时代仍使用普通生活。当代普通劳动不要求先购买专业药源指导。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.progression.pathwayId !== 'death' || ![4, 3, 2].includes(s.progression.sequence!)) return '只有当前仍在世的序列4、3或2可以行动；普通致命伤不能靠休整或旧周期复活。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前真实战斗或事件，不能同时劳动、治疗或推进日期。';
  if (hasFerrymanRitualLock(s) || hasFerrymanLifeLock(s) || hasFerrymanEncounterLock(s)) return '先实际收束当前服药准备、实践或遭遇，再回接待处继续生活。';
  if (s.deathConsul && (s.deathConsul.preparedWeek !== null || hasDeathConsulLifeLock(s) || ['READY', 'FIGHTING'].includes(s.deathConsul.encounter.status))) return '先实际收束当前死亡执政官服药准备、现场或遭遇，再回当代接待处劳动、治疗或推进日期。';
  const era = s.ferryman.era;
  if (c.type === 'ERA_ENTER') return era.location === 'OUTSIDE' ? null : '本人已经实际在当代摆渡人接待处。';
  if (era.location !== 'RECEPTION') return '本人须先沿普通12米道路进入本渠道的当代接待处。';
  if (c.type === 'ERA_LEAVE') return null;
  if (c.type === 'ERA_NEXT_WEEK') {
    if (s.actionsRemaining !== 0) return '须用完本周行动，再实付生活费并推进七天。';
    if (s.cash < 24) return '七天基本生活需24便士；低于此数时，本周尚未使用的补劳动可实做一次。';
    if (s.progression.sequence === 4) {
      const originalCycle = s.undying.lifecycle.expectedCycleDate;
      if (originalCycle === null || compareGameDates(addGameDays(s.date, 7), addGameYears(originalCycle, 60)) >= 0) return '本版序列4只经历首周期；第二个六十年周年前暂停，须先真实晋升3，不生成新周期。';
    }
    return null;
  }
  if (c.type === 'ERA_WORK') return s.actionsRemaining > 0 || s.cash < 24 && !era.emergencyWorkUsed ? null : '工作需要1行动；现金不足24便士时每周只有一次实做补劳动，居所同周已用次数不重置。';
  if (s.actionsRemaining < 1) return '本次实际休整或治疗需要1行动。';
  if (c.type === 'ERA_CARE') return !s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) ? '当前没有尚待实际处置的重伤；普通轻伤按后续休整恢复。' : s.cash < 60 ? '当代普通伤口处置需实际支付60便士。' : null;
  return s.cash < 8 ? '本次休整需实付8便士。' : null;
}
export function applyFerrymanEraCommand(s: SliceState, c: FerrymanEraCommand, ctx: SeerContext): void {
  const reason = blockFerrymanEraCommand(s, c); if (reason) throw new Error(reason);
  const era = s.ferryman.era;
  if (c.type === 'ERA_ENTER') { arriveFerrymanEra(s); ctx.note('沿普通道路实际走入当代接待处', '同一身体沿12米普通道路走12秒G到当代普通接待处；不花行动、不补资源、不接回六十年前的约定。'); return; }
  if (c.type === 'ERA_LEAVE') { era.location = 'OUTSIDE'; era.elapsedSeconds += 12; era.travelledMetres += 12; ctx.note('沿普通道路实际离开当代接待处', '同一身体普通走12米、12秒G到门外；当前渠道与实物记录保留，完成的居所仍只是历史。'); return; }
  if (c.type === 'ERA_WORK') {
    const emergency = s.actionsRemaining === 0;
    if (emergency) { era.emergencyWorkUsed = true; era.emergencyWorks += 1; } else s.actionsRemaining -= 1;
    s.cash += 24; era.works += 1; era.income += 24;
    ctx.note('在当代摆渡人接待处实做普通劳动', `实际整理当代普通档案，收入24便士。${emergency ? '本周现金不足生活费，实做一次额外补劳动；居所与本渠道共用同周一次机会。' : '实际花1行动。'}不发旧职业工资、非凡掌握或扮演。`); return;
  }
  if (c.type === 'ERA_CARE') {
    s.actionsRemaining -= 1; s.cash -= 60; era.treatments += 1; era.expenses += 60;
    for (const injury of s.injuries) if (injury.severity === 'HEAVY' && injury.treatedRevision === null) injury.treatedRevision = s.revision + 1;
    ctx.note('当代普通伤口实际处置', '实付60便士及1行动G，为现有未治重伤作普通处置，保留同一伤势记录。健康与带伤风险不重置；之后至少一次真实休整并达到健康80，才按既有规则痊愈。'); return;
  }
  if (c.type === 'ERA_REST') {
    s.actionsRemaining -= 1; s.cash -= 8; era.rests += 1; era.expenses += 8;
    s.health = Math.min(100, s.health + 5); s.mind = Math.min(100, s.mind + 8); s.spirituality = Math.min(120, s.spirituality + 10); s.seer.pollution = Math.max(0, s.seer.pollution - 4);
    const oldInjuries = s.injuries.length;
    s.injuries = s.injuries.filter(i => !(s.health >= 80 && i.acquiredRevision < s.revision + 1 && (i.severity === 'LIGHT' || i.treatedRevision !== null && i.treatedRevision < s.revision + 1)));
    if (oldInjuries > s.injuries.length && s.injuries.length === 0) s.injuryRisk = 0;
    ctx.note('当代接待处实际付费休整', `花1行动及8便士G，健康+5、精神+8、灵性+10（上限100/100/120）、污染−4至最低0；失败服药的消耗与原瓶记录保留。${oldInjuries > s.injuries.length ? `健康达到80且已有休整间隔，实际解除${oldInjuries - s.injuries.length}条符合既有规则的伤势。` : '未满足普通痊愈条件的伤势仍保留。'}不能复活已死亡身体。`); return;
  }
  s.cash -= 24; era.expenses += 24; era.weeksAdvanced += 1; era.emergencyWorkUsed = false;
  s.date = addGameDays(s.date, 7); s.week = Math.floor(gameDaysBetween(ORIGIN, s.date) / 7) + 1; s.actionsRemaining = 4; s.weeklyBudget = 4;
  ctx.note('当代生活实际过去七天', `${formatGameDate(s.date)}第${s.week}周，实付24便士，本周4行动。日期保留原日历余数，不运行旧职业工资、旧债、旧人事件或旧供货；新补货仍须本渠道实际领取。${s.progression.sequence === 3 ? '已真实晋升摆渡人，序列4专属六十年周期不再触发；普通死亡后果仍有效。' : s.progression.sequence === 2 ? '已真实晋升死亡执政官，原序列4专属六十年周期不再触发；旧周期历史与普通死亡后果保留。' : ''}`);
}
export function validateFerrymanEra(s: SliceState): boolean {
  try {
    const raw: unknown = s.ferryman?.era, base = createFerrymanEraState();
    if (!record(raw) || !shape(raw, Object.keys(base))) return false;
    const era = raw as unknown as FerrymanEraState;
    if (!['OUTSIDE', 'RECEPTION'].includes(era.location) || typeof era.emergencyWorkUsed !== 'boolean' || !['elapsedSeconds', 'travelledMetres', 'works', 'rests', 'weeksAdvanced', 'income', 'expenses', 'emergencyWorks', 'treatments'].every(k => integer(era[k as 'works']))) return false;
    if (!hasLongChapterHandoff(s)) return same(era, base);
    const h = s.longChapter.handoff!;
    if (!isLongChapterEraClosed(s) || !same(s.date, addGameDays(h.date, era.weeksAdvanced * 7)) || s.week !== Math.floor(gameDaysBetween(ORIGIN, s.date) / 7) + 1 || s.weeklyBudget !== 4) return false;
    if (era.income !== era.works * 24 || era.expenses !== era.rests * 8 + era.weeksAdvanced * 24 + era.treatments * 60 || era.emergencyWorks > era.works || era.emergencyWorks > era.weeksAdvanced + (s.longChapter.newLife.emergencyWorkUsed ? 0 : 1)) return false;
    if (era.weeksAdvanced === 0 && s.longChapter.newLife.emergencyWorkUsed && !era.emergencyWorkUsed || era.emergencyWorkUsed && era.emergencyWorks === 0 && !(era.weeksAdvanced === 0 && s.longChapter.newLife.emergencyWorkUsed)) return false;
    if (era.elapsedSeconds !== era.travelledMetres || era.travelledMetres % 12 !== 0 || (era.travelledMetres / 12 % 2 === 1) !== (era.location === 'RECEPTION')) return false;
    const channel = activeFerrymanChannel(s);
    if (channel && (channel.id !== 'POST_CYCLE' || era.travelledMetres < 12)) return false;
    // Current resources, injuries, combat and promotion are validated by their live domains.
    return true;
  } catch { return false; }
}
export function ferrymanEraActions(s: SliceState): FerrymanEraAction[] {
  if (!hasLongChapterHandoff(s)) return [];
  const actions: FerrymanEraAction[] = [];
  const add = (type: FerrymanEraCommand['type'], label: string, cost: string) => { const command: FerrymanEraCommand = { type }, reason = blockFerrymanEraCommand(s, command); actions.push({ id: `ferryman-${type.toLowerCase().replaceAll('_', '-')}`, label, cost, enabled: reason === null, reason, command }); };
  if (s.ferryman.era.location === 'OUTSIDE') add('ERA_ENTER', '沿普通道路进入当代接待处', '0行动 · 12米/12秒G');
  else {
    add('ERA_WORK', '实做当代普通档案劳动', s.actionsRemaining === 0 ? '本周低于24便士时一次补劳动 · +24便士' : '1行动 · +24便士');
    add('ERA_REST', '付费休整并缓和污染', '1行动 · 8便士 · 健康+5/精神+8/灵性+10/污染−4G');
    add('ERA_NEXT_WEEK', '支付生活费，实际过去七天', '0行动时 · 24便士 · 下周4行动');
    add('ERA_CARE', '实际处置当前未治重伤', '1行动 · 60便士G · 后续休整健康80才痊愈');
    add('ERA_LEAVE', '沿普通道路离开当代接待处', '0行动 · 12米/12秒G');
  }
  return actions;
}
export function projectFerrymanEra(s: SliceState): FerrymanEraProjection {
  const h = s.longChapter.handoff, era = s.ferryman.era, channel = activeFerrymanChannel(s), available = hasLongChapterHandoff(s);
  const place = era.location === 'RECEPTION' ? 'FR3-POST-RECEPTION 当代摆渡人接待处' : '当代接待处外普通道路';
  return { available, location: available ? place : '原时代普通生活',
    current: available ? `实际当前${formatGameDate(s.date)} · 第${s.week}周 · ${place}。${hasFerrymanLifeLock(s) ? '当前正在本渠道中转室实践，具体身体位置见现场。' : hasFerrymanEncounterLock(s) ? '当前已进入本渠道独立干院，具体身体位置见遭遇。' : ''}健康${s.health}/精神${s.mind}/灵性${s.spirituality}，现金${s.cash}便士、行动${s.actionsRemaining}。` : '原时代渠道继续使用共享普通生活；没有后世居所交接或新年代免费资源。',
    history: h ? [`居所于${formatGameDate(h.date)}第${h.week}周实际完成交接；当时LC-OUTSIDE、现金${h.cash}、健康${h.health}/精神${h.mind}/灵性${h.spirituality}、行动${h.actionsRemaining}。这是历史结余。`, channel ? `本渠道${channel.provider.name}（${channel.provider.id}）于${formatGameDate(channel.introducedDate)}第${channel.introducedWeek}周实际介绍；独立原瓶和当前约定不继承旧供应人。` : '尚未实际介绍专业供药人；普通到场、基础劳动和付费生活不提供药瓶库存。'] : [],
    economy: '当代有限G：普通劳动1行动收入24便士；休整1行动实付8便士；每真实七天生活24便士、下周4行动。当前重伤普通处置1行动60便士，之后实际休整且健康80才痊愈。原职业、旧债与旧事件不在此重跑。',
    counters: available ? [`当代劳动${era.works}次、休整${era.rests}次、普通处置${era.treatments}次、真实付费周${era.weeksAdvanced}次。`, `本渠道生活收入${era.income}/支出${era.expenses}便士；额外补劳动${era.emergencyWorks}次，本周${era.emergencyWorkUsed ? '已用（包含居所同周）' : '尚未使用'}。`, `普通进出共${era.travelledMetres}米/${era.elapsedSeconds}秒G；旧居所账目、位置与原身体入驻伤势保持原记录。`] : [], actions: ferrymanEraActions(s) };
}
