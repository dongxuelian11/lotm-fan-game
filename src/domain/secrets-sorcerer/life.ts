import { stableStringify } from '../canonical.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { hasSecretsSorcererRitualLock } from './ritual.js';

export const SECRETS_SORCERER_CASE_IDS = ['hidden-room', 'original-pocket', 'temporary-banishment'] as const;
export type SecretsSorcererCaseId = typeof SECRETS_SORCERER_CASE_IDS[number];
export const SECRETS_SORCERER_ITEM_IDS = ['SS4-CARD-1', 'SS4-COIN-1', 'SS4-SEALED-STONE-1'] as const;
export type SecretsSorcererItemId = typeof SECRETS_SORCERER_ITEM_IDS[number];
export type SecretsSorcererActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: SecretsSorcererCaseId }
  | { type: 'PREPARE'; caseId: SecretsSorcererCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'STORE_ITEM' | 'TAKE_ITEM' | 'RETURN_ITEM'; itemId: SecretsSorcererItemId }
  | { type: 'EXIT_ROOM' | 'STOP_HIDING' | 'STOP_POCKET' | 'MAINTAIN_POCKET' | 'SECURE_TARGET' | 'WAIT_RETURN' | 'RELEASE_RESTRAINT' | 'REFLECT' };
export interface SecretsSorcererCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; outcome: 'NONE' | 'ABILITY' | 'ORDINARY';
  contactOpen: boolean; suspended: boolean; closes: number; withdrawals: number; filmId: string | null;
}
export interface SecretsSorcererPocketItem {
  id: SecretsSorcererItemId; owner: 'ARCHIVE' | 'PLAYER'; location: 'DESK' | 'PLAYER' | 'POCKET' | 'BAG';
  stores: number; takes: number; returns: number;
}
export interface SecretsSorcererLifeState {
  cases: Record<SecretsSorcererCaseId, SecretsSorcererCaseState>; reflected: boolean;
  room: { id: 'SS4-ROOM'; doorId: 'SS4-DOOR'; position: 'OUTSIDE' | 'INSIDE'; hidden: boolean; entries: number; exits: number; folds: number; unfoldings: number; companionId: 'MIRA'; companionAge: 29; companionGender: 'FEMALE'; companionPosition: 'OUTSIDE'; consent: boolean };
  pocket: { id: 'SS4-BAG-1'; owner: 'PLAYER'; capacity: 3; coordinate: 'SS4-ROOM:SS4-BAG-1:ANCHOR'; mode: 'NONE' | 'ABILITY' | 'ORDINARY'; linked: boolean; expiresWeek: number | null; items: SecretsSorcererPocketItem[]; films: { id: string; purpose: 'PREPARE' | 'MAINTAIN'; purchasedWeek: number; consumedWeek: number | null }[]; storesThisAttempt: SecretsSorcererItemId[]; takesThisAttempt: SecretsSorcererItemId[]; links: number; stops: number; maintenances: number; buzzCosts: number };
  banishment: { id: 'SS4-ECHO-G'; cageId: 'SS4-CAGE-1'; nature: 'LICENSED_WEAK_HOSTILE_ECHO'; alive: true; hostile: true; cageClosed: true; location: 'ORIGINAL_CAGE' | 'AWAY'; restrained: boolean; sceneSeconds: number; returnAtSeconds: number | null; restraints: number; releases: number; banishments: number; returns: number };
}
export interface SecretsSorcererLifeAction { id: string; label: string; cost: string; command: SecretsSorcererActivityCommand; enabled: boolean; reason: string | null }
export interface SecretsSorcererLifeProjection {
  title: string; environment: string;
  cases: { id: SecretsSorcererCaseId; title: string; story: string; status: string; observations: string[]; preparation: string | null; result: string | null; contactOpen: boolean }[];
  room: { id: string; doorId: string; position: 'OUTSIDE' | 'INSIDE'; hidden: boolean; companion: string; history: string[] };
  pocket: { id: string; mode: 'NONE' | 'ABILITY' | 'ORDINARY'; linked: boolean; capacity: 3; expiresWeek: number | null; expired: boolean; coordinate: string; items: { id: SecretsSorcererItemId; title: string; owner: 'ARCHIVE' | 'PLAYER'; location: 'DESK' | 'PLAYER' | 'POCKET' | 'BAG'; effect: string }[]; history: string[] };
  banishment: { id: string; cageId: string; location: 'ORIGINAL_CAGE' | 'AWAY'; restrained: boolean; remainingSeconds: number; history: string[] };
  reflected: boolean;
}
const CASES: { id: SecretsSorcererCaseId; title: string; story: string; facts: string[] }[] = [
  { id: 'hidden-room', title: '原房间与唯一出入门', story: '在获准使用的原创教学室SS4-ROOM，你可暂时隐藏其中同一部分。唯一原门SS4-DOOR始终是实际出口。原成年场务米拉独立来到门外，明确同意在外见证本次练习，不进入隐藏部分。（原创G）', facts: ['准备不移动身体；实施时本人先穿过唯一原门步行进入原房间。', '能力6灵性、知识18；成功才实际隐藏原房间的一部分，失败仍须从同一门步行出去。', '普通方法知识16、0灵性，只检查帘幕与原门，不产生隐藏空间。', '先EXIT_ROOM实际走过原门，才可STOP_HIDING恢复原房间；两项均0行动。'] },
  { id: 'original-pocket', title: '原挎包的三个实际物位', story: '自有唯一挎包SS4-BAG-1最多容纳三件指定小物。档案室只出借原木卡SS4-CARD-1与原弱鸣封石SS4-SEALED-STONE-1，你带来同一枚自有SS4-COIN-1；原物各一件，归属不变。（原创G）', facts: ['能力准备购买80便士的原锚膜；实施另6灵性、知识18，失败仍消耗膜与灵性。固定正确坐标只通向这一原包的有限空间。', '实际STORE_ITEM、TAKE_ITEM逐件操作，不自动发放或复制。普通方法只使用同一包的物理隔层。', '原封石每次存入、取出都使精神−1，能力空间不消除它的负面作用；不是高危封印物。', '空间链接到下一真实周到期；到期阻止存取而保留原内容。MAINTAIN_POCKET花1行动、2灵性、20便士新原膜恢复同一链接。', '三件都实际存取后，归还两件借物、保留自有原币、清空原包并STOP_POCKET，才可完成本案。可WITHDRAW暂时离开，保留链接与原物，普通工作休养后回来维护。'] },
  { id: 'temporary-banishment', title: '同一个已受约束的弱回响', story: '原许可笼SS4-CAGE-1内只有一个原创低强敌意回响SS4-ECHO-G。它并非半神，不能替代晋升仪式目标；这里没有被拿来试法的见习者。（原创G）', facts: ['先SECURE_TARGET使用原笼的实际束缚，才可施放放逐；没有先制约便不能凭放逐夺取敌人。', '能力6灵性、意志18；成功使同一原回响短暂进入有限时空乱流，失败仍在原笼且成本保留。', 'WAIT_RETURN推进本场真实30秒，同一原回响返回原笼；没有删除、替身或永久流放。', '返回后RELEASE_RESTRAINT解除附加束缚，原笼仍关闭；普通方法知识16只实际检查闭笼，不放逐。'] },
];
export const SECRETS_SORCERER_LIFE_STORY = '三个原创G有限实践：原房间隐藏与唯一原门进出、三物位原包及到期维护、已受制约的同一弱回响短暂放逐和原笼返回。观察、准备、实施、报告各1行动，显式退出、停止、原物存取归还、等待返回与关闭0行动。能力均6灵性、知识18或意志18，普通方法知识16、0灵性；实际失败保留成本，下一真实周才能重试。每案报告G扮演25，三案反思25；只有成功使用能力并真正收束后取得一次掌握5、报告8。普通方法不增加能力掌握。空间能力不复制原物、消除负面作用、无条件先制或永久删去敌人。';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'door' && [4,3,2].includes(s.progression.sequence!);
export function createSecretsSorcererLifeState(): SecretsSorcererLifeState {
  const newCase = (): SecretsSorcererCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, outcome: 'NONE', contactOpen: false, suspended: false, closes: 0, withdrawals: 0, filmId: null });
  return { cases: { 'hidden-room': newCase(), 'original-pocket': newCase(), 'temporary-banishment': newCase() }, reflected: false,
    room: { id: 'SS4-ROOM', doorId: 'SS4-DOOR', position: 'OUTSIDE', hidden: false, entries: 0, exits: 0, folds: 0, unfoldings: 0, companionId: 'MIRA', companionAge: 29, companionGender: 'FEMALE', companionPosition: 'OUTSIDE', consent: false },
    pocket: { id: 'SS4-BAG-1', owner: 'PLAYER', capacity: 3, coordinate: 'SS4-ROOM:SS4-BAG-1:ANCHOR', mode: 'NONE', linked: false, expiresWeek: null, items: SECRETS_SORCERER_ITEM_IDS.map(id => ({ id, owner: id === 'SS4-COIN-1' ? 'PLAYER' : 'ARCHIVE', location: id === 'SS4-COIN-1' ? 'PLAYER' : 'DESK', stores: 0, takes: 0, returns: 0 })), films: [], storesThisAttempt: [], takesThisAttempt: [], links: 0, stops: 0, maintenances: 0, buzzCosts: 0 },
    banishment: { id: 'SS4-ECHO-G', cageId: 'SS4-CAGE-1', nature: 'LICENSED_WEAK_HOSTILE_ECHO', alive: true, hostile: true, cageClosed: true, location: 'ORIGINAL_CAGE', restrained: false, sceneSeconds: 0, returnAtSeconds: null, restraints: 0, releases: 0, banishments: 0, returns: 0 } };
}
export function validateSecretsSorcererActivityCommand(v: unknown): v is SecretsSorcererActivityCommand {
  if (!record(v)) return false;
  if (['EXIT_ROOM', 'STOP_HIDING', 'STOP_POCKET', 'MAINTAIN_POCKET', 'SECURE_TARGET', 'WAIT_RETURN', 'RELEASE_RESTRAINT', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (['STORE_ITEM', 'TAKE_ITEM', 'RETURN_ITEM'].includes(String(v.type))) return shape(v, ['type', 'itemId']) && SECRETS_SORCERER_ITEM_IDS.includes(v.itemId as SecretsSorcererItemId);
  if (!SECRETS_SORCERER_CASE_IDS.includes(v.caseId as SecretsSorcererCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isSecretsSorcererActivityCommand = validateSecretsSorcererActivityCommand;
export const isSecretsSorcererActivity = validateSecretsSorcererActivityCommand;
export const hasSecretsSorcererLifeLock = (s: SliceState): boolean => {
  const l = s.secretsSorcerer.life;
  return l.room.position === 'INSIDE' || l.room.hidden || l.banishment.location === 'AWAY' || l.banishment.restrained || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
};
export const secretsSorcererInside = hasSecretsSorcererLifeLock;
const expired = (s: SliceState) => { const p = s.secretsSorcerer.life.pocket; return p.linked && p.expiresWeek !== null && s.week >= p.expiresWeek; };
const pocketClean = (l: SecretsSorcererLifeState) => l.pocket.mode === 'NONE' && !l.pocket.linked && l.pocket.items.every(i => i.location === (i.owner === 'PLAYER' ? 'PLAYER' : 'DESK'));
const allStoredAndTaken = (l: SecretsSorcererLifeState) => SECRETS_SORCERER_ITEM_IDS.every(id => l.pocket.storesThisAttempt.includes(id) && l.pocket.takesThisAttempt.includes(id));
const pocketPending = (l: SecretsSorcererLifeState) => l.cases['original-pocket'].status === 'ACTIVE' && (l.cases['original-pocket'].contactOpen || l.cases['original-pocket'].suspended);
const oldPractice = (s: SliceState) => s.traveler.ritual.at !== 'HOME' || Object.values(s.traveler.cases).some(r => r.contactOpen || r.status === 'PREPARED') || Object.values(s.recorder.cases).some(r => r.contactOpen) || Object.values(s.apprentice.cases).some(r => r.position === 'INSIDE');
export function secretsSorcererActivityReason(s: SliceState, c: SecretsSorcererActivityCommand): string | null {
  if (!validateSecretsSorcererActivityCommand(c)) return '秘法师实践命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s) || s.progression.sequence!==4) return '须仍活着并已实际晋升秘法师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际来到贝克兰德原教学室，不能遥距操作原门、原物或原笼。';
  if (hasSecretsSorcererRitualLock(s) || oldPractice(s)) return '先实际结束原仪式或旧实践，不能由新练习传回。';
  const l = s.secretsSorcerer.life, p = l.pocket, b = l.banishment, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'EXIT_ROOM') return l.room.position === 'INSIDE' && l.cases['hidden-room'].contactOpen ? null : '原身体不在这个原房间内。';
  if (c.type === 'STOP_HIDING') return l.room.hidden && l.room.position === 'OUTSIDE' ? null : '须先经唯一原门实际走到外面，且确有尚未解除的隐藏。';
  if (c.type === 'WAIT_RETURN') return b.location === 'AWAY' && b.returnAtSeconds !== null && l.cases['temporary-banishment'].contactOpen ? null : '没有正在等待同体返回的原回响。';
  if (c.type === 'RELEASE_RESTRAINT') return b.restrained && b.location === 'ORIGINAL_CAGE' ? null : '须同一个原回响已经在原笼，才能解除附加束缚。';
  if (c.type === 'SECURE_TARGET') return l.cases['temporary-banishment'].status === 'PREPARED' && l.cases['temporary-banishment'].contactOpen && b.location === 'ORIGINAL_CAGE' && !b.restrained && b.cageClosed ? null : '须先准备本案，且同一原回响在关闭的原笼内、尚未加上束缚。';
  if (c.type === 'WITHDRAW') {
    if (!r?.contactOpen) return '没有本项尚待取消或暂停的实际接触。';
    if (r.status === 'PREPARED') return b.restrained ? '先0行动解除原笼附加束缚。' : null;
    return c.caseId === 'original-pocket' && r.status === 'ACTIVE' ? null : '已实施的本案须先显式退出、停止或等同体返回，再关闭。';
  }
  if (c.type === 'CLOSE') {
    if (!r || r.status !== 'ACTIVE' || (!r.contactOpen && !r.suspended)) return '没有本项尚待实际收束的已实施接触。';
    if (c.caseId === 'hidden-room' && (l.room.position !== 'OUTSIDE' || l.room.hidden)) return '先EXIT_ROOM经唯一原门走出，再STOP_HIDING恢复原房间。';
    if (c.caseId === 'original-pocket') {
      if (!pocketClean(l)) return '先实际取回原物、归还两件借物，并在原包为空时STOP_POCKET。';
      if (r.outcome !== 'NONE' && !allStoredAndTaken(l)) return '本次三件原物都须真正存入和取出，不能只建立链接便报告。';
    }
    if (c.caseId === 'temporary-banishment' && (b.location !== 'ORIGINAL_CAGE' || b.restrained)) return '先WAIT_RETURN等待同一个原回响返回，再RELEASE_RESTRAINT；原笼继续关闭。';
    return null;
  }
  if (['STORE_ITEM', 'TAKE_ITEM', 'RETURN_ITEM', 'STOP_POCKET', 'MAINTAIN_POCKET'].includes(c.type)) {
    if (!pocketPending(l) || Object.entries(l.cases).some(([id, v]) => id !== 'original-pocket' && (v.contactOpen || v.status === 'PREPARED'))) return '须有本项已实施或保留的原包接触，先结束其他实际接触。';
    if (c.type === 'STOP_POCKET') return p.mode === 'NONE' ? '原包已经没有空间链接或打开的普通隔层。' : p.items.some(i => ['POCKET', 'BAG'].includes(i.location)) ? '原包中仍有同一原物，不能停止链接并抹掉内容。' : l.cases['original-pocket'].outcome !== 'NONE' && !allStoredAndTaken(l) ? '先把本次三件原物都实际存入和取出，再停止链接或合上隔层。' : null;
    if (c.type === 'MAINTAIN_POCKET') {
      if (!p.linked || p.mode !== 'ABILITY' || !expired(s)) return '只维护这个已经到期、仍保留原内容的实际空间链接。';
      return s.actionsRemaining < 1 ? '维护需要1行动；可先WITHDRAW保留原物，再普通休养、工作或换周。' : s.spirituality < 2 ? '维护需要2灵性；保留原物，休养后回来。' : s.cash < 20 ? '维护需要20便士购买新原锚膜；原内容不会因缺钱丢失。' : s.health <= 0 || s.mind <= 0 ? '先普通休养，原内容继续保留。' : null;
    }
    if (c.type === 'STORE_ITEM' || c.type === 'TAKE_ITEM' || c.type === 'RETURN_ITEM') {
      const item = p.items.find(i => i.id === c.itemId);
      if (!item) return '不存在这件获准原物。';
      if (c.type === 'RETURN_ITEM') return item.owner === 'ARCHIVE' && item.location === 'PLAYER' ? null : '只可本人把仍在手中的同一件档案室借物放回原桌。';
      if (p.mode === 'NONE' || l.cases['original-pocket'].outcome === 'NONE') return '本次尚未成功建立空间链接或完成普通隔层核对。';
      if (p.mode === 'ABILITY' && expired(s)) return '同一空间链接已经到期；原物保留，先实际MAINTAIN_POCKET才能存取。';
      if (c.type === 'TAKE_ITEM') return item.location === (p.mode === 'ABILITY' ? 'POCKET' : 'BAG') ? null : '同一原物当前不在这个原包内，不能重复取出。';
      if (!['DESK', 'PLAYER'].includes(item.location)) return '这件原物已经在原包内，不能重复存入。';
      return p.items.filter(i => ['POCKET', 'BAG'].includes(i.location)).length >= p.capacity ? '原包的三个有限物位已满。' : null;
    }
  }
  if (c.type === 'PERFORM') {
    if (!r || r.status !== 'PREPARED' || !r.contactOpen || r.attemptWeek === s.week) return '先准备本项；本周已尝试则须下一真实周再试。';
    if (c.caseId === 'hidden-room' && (!l.room.consent || l.room.companionPosition !== 'OUTSIDE' || l.room.position !== 'OUTSIDE')) return '原米拉须明确同意本次门外见证并实际在门外，你也须从原门外开始。';
    if (c.caseId === 'original-pocket' && r.method === 'ABILITY' && !p.films.some(f => f.id === r.filmId && f.purpose === 'PREPARE' && f.consumedWeek === null)) return '本次缺少已经购买、尚未消耗的那张原锚膜。';
    if (c.caseId === 'temporary-banishment' && (b.location !== 'ORIGINAL_CAGE' || !b.cageClosed || r.method === 'ABILITY' && !b.restrained)) return '须先用原笼实际制约同一个原回响，不能把放逐当作自动先制。';
    if (r.method === 'ABILITY' && s.spirituality < 6) return '本次能力需要6灵性；可0行动取消尚未实施的准备后休养。';
  } else {
    if (hasSecretsSorcererLifeLock(s)) return '先实际收束当前原门、原物或原回响；未实施可WITHDRAW。';
    if (c.type === 'REFLECT') {
      if (l.reflected || SECRETS_SORCERER_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED')) return '须完成三份真实报告，且未进行过本次反思。';
    } else {
      if (!r || !('caseId' in c)) return '未知原实践事项。';
      if (r.status === 'RESOLVED') return '这份原报告已完成。';
      if (pocketPending(l)) return '先回来实际维护、取还原物并关闭原包事项，再开始其他实践。';
      if (c.type === 'OBSERVE' && r.status !== 'AVAILABLE') return '已经核对过这个原现场。';
      if (c.type === 'PREPARE') {
        if (r.status !== 'OBSERVED' || r.attemptWeek === s.week) return '先观察；失败成本保留，下一真实周才能重新准备。';
        if (c.caseId === 'original-pocket' && !pocketClean(l)) return '原包与原物尚未实际收束。';
        if (c.caseId === 'original-pocket' && c.method === 'ABILITY' && !p.films.some(f => f.purpose === 'PREPARE' && f.consumedWeek === null) && s.cash < 80) return '需要80便士实际购买一张原锚膜。';
      }
      if (c.type === 'REPORT' && r.status !== 'EXAMINED') return '须先成功实施，并显式完成原物、原身体与原回响的实际收束。';
    }
  }
  return s.health <= 0 || s.mind <= 0 ? '先恢复身体与精神；0行动的实际退出与归还仍可进行。' : s.actionsRemaining < 1 ? '本次需要1行动。' : null;
}
const itemTitle = (id: SecretsSorcererItemId) => id === 'SS4-CARD-1' ? '原木卡' : id === 'SS4-COIN-1' ? '自有原币' : '原弱鸣封石';
function notePocket(s: SliceState): string {
  const p = s.secretsSorcerer.life.pocket;
  return `唯一原包${p.id}，最多${p.capacity}物位；${p.items.map(i => `${i.id}在${i.location}`).join('，')}。${p.linked ? `同一链接到第${p.expiresWeek}周需维护，当前${expired(s) ? '已到期，原内容仍保留' : '有效'}` : p.mode === 'ORDINARY' ? '只打开普通物理隔层' : '没有空间链接'}。弱鸣累计实扣精神${p.buzzCosts}。`;
}
export function applySecretsSorcererActivity(s: SliceState, c: SecretsSorcererActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  const reason = secretsSorcererActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.secretsSorcerer.life, p = l.pocket, b = l.banishment;
  if (c.type === 'EXIT_ROOM') { l.room.position = 'OUTSIDE'; l.room.exits++; ctx.note('经唯一原门实际走出', '0行动，你的同一个原身体亲自穿过SS4-DOOR到原房间外；米拉仍在门外。隐藏如仍生效，尚须明确停止，不能借此远程逃脱。'); return; }
  if (c.type === 'STOP_HIDING') { l.room.hidden = false; l.room.unfoldings++; ctx.note('恢复同一原房间', '你在原门外实际撤去这一次空间隐藏，SS4-ROOM原被折起部分重新成为普通房间；没有新建房屋或删除原处。'); return; }
  if (c.type === 'SECURE_TARGET') { b.restrained = true; b.restraints++; ctx.note('先用原笼制约原回响', '0行动，实际合上SS4-CAGE-1内部束架，制约同一个SS4-ECHO-G；它仍活着且有敌意。这不是捕获半神或完成晋升仪式。'); return; }
  if (c.type === 'WAIT_RETURN') { b.sceneSeconds = b.returnAtSeconds!; b.returnAtSeconds = null; b.location = 'ORIGINAL_CAGE'; b.returns++; ctx.note('真实等待30秒，同一原回响返回', '0行动推进本场实际30秒；同一个SS4-ECHO-G从有限时空乱流返回关闭的SS4-CAGE-1，原身份、敌意与束缚保留。没有复制替身、永久删除或把它放到人群中。'); return; }
  if (c.type === 'RELEASE_RESTRAINT') { b.restrained = false; b.releases++; ctx.note('解除附加束缚，原笼仍闭合', '0行动，打开原笼内束架；同一个原回响仍在关闭的原笼里，没有放出伤人。'); return; }
  if (c.type === 'STORE_ITEM' || c.type === 'TAKE_ITEM' || c.type === 'RETURN_ITEM') {
    const item = p.items.find(i => i.id === c.itemId)!;
    if (c.type === 'RETURN_ITEM') { item.location = 'DESK'; item.returns++; ctx.note('本人亲手归还同一原借物', `0行动，把仍在手中的${item.id}亲手放回原桌，归属仍为档案室，不制造第二件。` + notePocket(s)); return; }
    if (c.type === 'STORE_ITEM') { item.location = p.mode === 'ABILITY' ? 'POCKET' : 'BAG'; item.stores++; if (!p.storesThisAttempt.includes(item.id)) p.storesThisAttempt.push(item.id); }
    else { item.location = 'PLAYER'; item.takes++; if (!p.takesThisAttempt.includes(item.id)) p.takesThisAttempt.push(item.id); }
    if (item.id === 'SS4-SEALED-STONE-1') { s.mind = Math.max(0, s.mind - 1); p.buzzCosts++; }
    ctx.note(c.type === 'STORE_ITEM' ? '实际存入同一件原物' : '实际取出同一件原物', `0行动，${item.id}实际${c.type === 'STORE_ITEM' ? '离开原桌或本人手中进入原包' : '离开原包到本人手中'}；没有复制。${item.id === 'SS4-SEALED-STONE-1' ? '弱鸣仍影响本人，精神−1；空间不能消除负面作用。' : ''}` + notePocket(s)); return;
  }
  if (c.type === 'STOP_POCKET') { if (p.linked) p.stops++; p.linked = false; p.expiresWeek = null; p.mode = 'NONE'; ctx.note('实际关闭已经清空的原包', '0行动，空的SS4-BAG-1停止有限空间链接或合上普通隔层；原物仍各在真实位置，没有自动倒出或抹掉内容。' + notePocket(s)); return; }
  if (c.type === 'MAINTAIN_POCKET') {
    s.actionsRemaining--; s.spirituality -= 2; s.cash -= 20; p.maintenances++;
    p.films.push({ id: `SS4-FILM-${p.films.length + 1}`, purpose: 'MAINTAIN', purchasedWeek: s.week, consumedWeek: s.week }); p.expiresWeek = s.week + 1;
    ctx.note('实际维护同一到期空间链接', '花1行动、2灵性、20便士，购买并消耗下一张唯一原锚膜，重新校对同一固定坐标。没有创建新包、清空原内容或免除原封石弱鸣。' + notePocket(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = l.cases[c.caseId]; r.contactOpen = false; r.withdrawals++;
    if (r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.filmId = null; if (c.caseId === 'hidden-room') l.room.consent = false; }
    else r.suspended = true;
    ctx.note(c.caseId === 'original-pocket' && r.suspended ? '本人暂离，原包内容与链接保留' : '取消尚未实施的准备', c.caseId === 'original-pocket' && r.suspended ? '0行动，你沿普通门离开原教学室；原物、实际链接、到期周与本次结果全部保留，不自动倒出、不复制、不退款。现在可普通工作、休养和换周，回来实付维护后取还同一原物。' + notePocket(s) : '0行动，沿原普通门结束尚未实施的本次接触，成本不退；未用的原锚膜仍在本人手中，原米拉本次见证同意结束。'); return;
  }
  if (c.type === 'CLOSE') {
    const r = l.cases[c.caseId]; r.contactOpen = false; r.suspended = false; r.closes++; r.status = r.outcome === 'NONE' ? 'OBSERVED' : 'EXAMINED';
    if (c.caseId === 'hidden-room') l.room.consent = false;
    if (r.outcome === 'ABILITY') award(`secrets-sorcerer-practice:${c.caseId}`, 5);
    ctx.note('实际收束原现场', '0行动，原身体已经在门外、对应原物已归还或同一原回响已返回并解除附加束缚，沿普通门结束本次接触。失败成本保留，下一真实周才可再试；只有成功能力实践取得一次掌握5。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('secrets-sorcerer-reflection'); ctx.note('回看有限空间与同一原物', '原门实际进出、三个有限物位与负面作用、已受制约者暂时离开又同体返回，三项均已真实报告。G扮演+25；没有无限背包、永久流放或高阶免费记录。'); return; }
  if (!('caseId' in c)) throw new Error('秘法师实践命令无效。');
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(definition.title, definition.story + ' ' + definition.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.outcome = 'NONE'; r.contactOpen = true; r.suspended = false; r.filmId = null;
    if (c.caseId === 'hidden-room') l.room.consent = true;
    if (c.caseId === 'original-pocket') {
      p.storesThisAttempt = []; p.takesThisAttempt = [];
      if (c.method === 'ABILITY') {
        let film = p.films.find(f => f.purpose === 'PREPARE' && f.consumedWeek === null);
        if (!film) { s.cash -= 80; film = { id: `SS4-FILM-${p.films.length + 1}`, purpose: 'PREPARE', purchasedWeek: s.week, consumedWeek: null }; p.films.push(film); }
        r.filmId = film.id;
      }
    }
    ctx.note(definition.title, `1行动明确准备${c.method === 'ABILITY' ? '本人的有限能力' : '普通方法'}，没有施法、移动原物或放逐原回响。${c.caseId === 'hidden-room' ? '原米拉当面明确答应本次门外见证；本人和米拉仍在原门外。' : c.caseId === 'original-pocket' && c.method === 'ABILITY' ? `实际持有已付款原锚膜${r.filmId}，实施才消耗；没有免费新增膜。` : ''}`); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); const source = `secrets-sorcerer-case:${c.caseId}`; if (r.outcome === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source); ctx.note(definition.title, '报告已经亲自实施并实际收束的有限结果。G扮演+25；' + (r.outcome === 'ABILITY' ? '成功能力报告一次掌握+8。' : '普通方法没有伪造能力掌握。')); return; }
  r.attemptWeek = s.week; r.status = 'ACTIVE';
  if (r.method === 'ABILITY') s.spirituality -= 6;
  if (c.caseId === 'hidden-room') { l.room.position = 'INSIDE'; l.room.entries++; }
  if (c.caseId === 'original-pocket') {
    if (r.method === 'ABILITY') p.films.find(f => f.id === r.filmId)!.consumedWeek = s.week;
    else p.mode = 'ORDINARY';
  }
  const stat = c.caseId === 'temporary-banishment' && r.method === 'ABILITY' ? 'will' : 'knowledge';
  const result = ctx.check(stat, r.method === 'ABILITY' ? 18 : 16);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.outcome = r.method!;
    if (r.method === 'ABILITY') {
      if (c.caseId === 'hidden-room') { l.room.hidden = true; l.room.folds++; }
      if (c.caseId === 'original-pocket') { p.mode = 'ABILITY'; p.linked = true; p.expiresWeek = s.week + 1; p.links++; }
      if (c.caseId === 'temporary-banishment') { b.location = 'AWAY'; b.returnAtSeconds = b.sceneSeconds + 30; b.banishments++; }
    }
    ctx.note(definition.title, r.method === 'ABILITY' ? c.caseId === 'hidden-room' ? '实付6灵性成功隐藏SS4-ROOM原有部分；你的原身体仍在里面，原米拉在外，只能经唯一SS4-DOOR实际走出后停止隐藏。' : c.caseId === 'original-pocket' ? '实付6灵性与同一原锚膜，正确固定坐标建立唯一原包三物位链接。还没有任何物品被存入；须逐件真实存取与归还。' : '实付6灵性，把已经受原笼制约的同一个SS4-ECHO-G暂时送入有限时空乱流。它处于AWAY，尚须真实等待30秒返回原笼。' : '普通知识核对成功；仅实际检查原帘幕与门、原包物理隔层或原笼，没有施放空间能力。原身体和原物仍需对应的实际收束。');
  } else { r.outcome = 'NONE'; ctx.note(definition.title, '本次核对失败，行动及已经付出的6灵性、原锚膜等实际成本保留，没有成功能力效果。原房间内身体、普通隔层或原笼束缚仍依真实状态保留；先0行动显式收束，下一真实周才可重试。'); }
}

export function secretsSorcererLifeActions(s: SliceState): SecretsSorcererLifeAction[] {
  if (!promoted(s)) return [];
  const out: SecretsSorcererLifeAction[] = [], l = s.secretsSorcerer.life;
  const add = (id: string, label: string, cost: string, command: SecretsSorcererActivityCommand) => { const reason = secretsSorcererActivityReason(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (l.room.position === 'INSIDE') add('ss4-exit-room', '经唯一原门实际走出', '0行动 · SS4-DOOR · 同一原身体', { type: 'EXIT_ROOM' });
  if (l.room.hidden) add('ss4-stop-hiding', '在原门外停止空间隐藏', '0行动 · 恢复同一原房间', { type: 'STOP_HIDING' });
  if (pocketPending(l)) {
    for (const item of l.pocket.items) {
      if (['DESK', 'PLAYER'].includes(item.location) && l.pocket.mode !== 'NONE') add('ss4-store-' + item.id, '实际存入' + itemTitle(item.id), item.id === 'SS4-SEALED-STONE-1' ? '0行动 · 原封石精神−1' : '0行动 · 同一原物占一个物位', { type: 'STORE_ITEM', itemId: item.id });
      if (['POCKET', 'BAG'].includes(item.location)) add('ss4-take-' + item.id, '实际取出' + itemTitle(item.id), item.id === 'SS4-SEALED-STONE-1' ? '0行动 · 原封石精神−1' : '0行动 · 不复制原物', { type: 'TAKE_ITEM', itemId: item.id });
      if (item.owner === 'ARCHIVE' && item.location === 'PLAYER') add('ss4-return-' + item.id, '亲手归还' + itemTitle(item.id), '0行动 · 放回原桌', { type: 'RETURN_ITEM', itemId: item.id });
    }
    if (l.pocket.mode !== 'NONE') add('ss4-stop-pocket', '清空后停止原包链接或合上隔层', '0行动 · 原物不会自动倒出', { type: 'STOP_POCKET' });
    if (expired(s)) add('ss4-maintain-pocket', '维护同一到期原包链接', '1行动 · 2灵性 · 20便士新原锚膜', { type: 'MAINTAIN_POCKET' });
  }
  const banish = l.cases['temporary-banishment'];
  if (banish.status === 'PREPARED' && !l.banishment.restrained) add('ss4-secure-target', '先以原笼实际制约同一回响', '0行动 · 不替代半神仪式', { type: 'SECURE_TARGET' });
  if (l.banishment.location === 'AWAY') add('ss4-wait-return', '等待30秒，同一原回响返回', '0行动 · 本场实际时间 · 返回同一原笼', { type: 'WAIT_RETURN' });
  if (l.banishment.restrained) add('ss4-release-restraint', '返回后解除原笼附加束缚', '0行动 · 原笼仍关闭', { type: 'RELEASE_RESTRAINT' });
  for (const definition of CASES) {
    const r = l.cases[definition.id], caseId = definition.id;
    if (r.status === 'AVAILABLE') add('ss4-' + caseId + '-observe', '核对' + definition.title, '1行动 · 原现场与原物', { type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') {
      add('ss4-' + caseId + '-ability', '准备本人的有限空间能力', '1行动' + (caseId === 'original-pocket' ? ' · 80便士原锚膜（未用原膜可复用）' : '') + ' · 实施另6灵性', { type: 'PREPARE', caseId, method: 'ABILITY' });
      add('ss4-' + caseId + '-ordinary', '准备普通方法核对原物', '1行动 · 实施知识16 · 0灵性', { type: 'PREPARE', caseId, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add('ss4-' + caseId + '-perform', '实际实施这一次原现场实践', r.method === 'ABILITY' ? `1行动 · 6灵性 · ${caseId === 'temporary-banishment' ? '意志' : '知识'}18` : '1行动 · 0灵性 · 知识16', { type: 'PERFORM', caseId });
      add('ss4-' + caseId + '-withdraw', '取消尚未实施的本次准备', '0行动 · 已付成本保留', { type: 'WITHDRAW', caseId });
    }
    if (r.status === 'ACTIVE') {
      add('ss4-' + caseId + '-close', '完成原物收束并实际结束接触', '0行动 · 先完成实际退出、取还或同体返回', { type: 'CLOSE', caseId });
      if (caseId === 'original-pocket' && r.contactOpen) add('ss4-pocket-suspend', '暂离原教学室，保留原包和物品', '0行动 · 可工作休养后回来维护 · 不自动倒出', { type: 'WITHDRAW', caseId });
    }
    if (r.status === 'EXAMINED') add('ss4-' + caseId + '-report', '报告已完成的实际结果', '1行动 · G扮演+25', { type: 'REPORT', caseId });
  }
  if (!l.reflected) add('ss4-life-reflect', '回看原门、原物与暂时返回的边界', '1行动 · 三份报告后 · G扮演+25', { type: 'REFLECT' });
  return out;
}
export function projectSecretsSorcererLife(s: SliceState): SecretsSorcererLifeProjection {
  const l = s.secretsSorcerer.life, p = l.pocket, b = l.banishment;
  return { title: '秘法师的三个有限空间实践', environment: SECRETS_SORCERER_LIFE_STORY,
    cases: CASES.map(d => {
      const r = l.cases[d.id];
      const location = d.id === 'hidden-room' ? `原身体${l.room.position}，原房间${l.room.hidden ? '仍隐藏' : '普通可见'}，唯一原门${l.room.doorId}。` : d.id === 'original-pocket' ? notePocket(s) : `同一个${b.id}在${b.location}，原笼${b.cageId}始终关闭，附加束缚${b.restrained ? '仍在' : '已解除'}。`;
      return { id: d.id, title: d.title, story: d.story, status: r.status, observations: r.status === 'AVAILABLE' ? [] : [...d.facts, location], preparation: r.status === 'PREPARED' ? `${r.method === 'ABILITY' ? '准备本人的有限能力，实施另6灵性与18难度' : '准备普通方法，知识16、0灵性'}。尚未实施，原膜如已付款保留。` : null,
        result: r.attemptWeek === null ? null : `第${r.attemptWeek}周实际${r.outcome === 'NONE' ? '核对失败，成本保留' : r.outcome === 'ABILITY' ? '有限能力成功' : '普通核对成功'}。${r.suspended ? '本人已暂离，原链接与原物仍保留，回来维护和取还后才能报告。' : r.contactOpen ? '本次接触尚未实际结束。' : '本次已经完成对应的实际收束。'}${location}`, contactOpen: r.contactOpen };
    }),
    room: { id: l.room.id, doorId: l.room.doorId, position: l.room.position, hidden: l.room.hidden, companion: `同一原成年米拉，29岁女性，始终在原门外；${l.room.consent ? '本人当面明确同意本次门外见证' : '没有尚在生效的本次见证同意'}。旧旅行家同行记录保留。`, history: [`原门实际进入${l.room.entries}次、走出${l.room.exits}次`, `原房间实际隐藏${l.room.folds}次、恢复${l.room.unfoldings}次`, '只有唯一原门可实际进出隐藏部分；普通帘幕不生成隐藏空间'] },
    pocket: { id: p.id, mode: p.mode, linked: p.linked, capacity: p.capacity, expiresWeek: p.expiresWeek, expired: expired(s), coordinate: p.coordinate, items: p.items.map(i => ({ id: i.id, title: itemTitle(i.id), owner: i.owner, location: i.location, effect: i.id === 'SS4-SEALED-STONE-1' ? '每次存入或取出精神−1；空间不消除弱鸣。' : '同一件获准小物，数量始终1。' })), history: [`实际建立${p.links}次链接、停止${p.stops}次、维护${p.maintenances}次；原包最多3物位`, ...p.films.map(f => `${f.id} · 第${f.purchasedWeek}周实购${f.purpose === 'PREPARE' ? '80' : '20'}便士 · ${f.consumedWeek === null ? '未用，仍由本人保有' : `第${f.consumedWeek}周已消耗`}`), ...p.items.map(i => `${i.id}实际存入${i.stores}次、取出${i.takes}次、归还${i.returns}次`), `原弱鸣实际累计精神成本${p.buzzCosts}；到期原内容不丢失、不自动倒出`] },
    banishment: { id: b.id, cageId: b.cageId, location: b.location, restrained: b.restrained, remainingSeconds: b.returnAtSeconds === null ? 0 : b.returnAtSeconds - b.sceneSeconds, history: [`原笼先制约${b.restraints}次、解除附加束缚${b.releases}次，笼门始终关闭`, `同一原回响实际暂时放逐${b.banishments}次、同体返回${b.returns}次；本场真实等待${b.sceneSeconds}秒`, '这是原创许可低强敌意回响，不是半神，不能替代晋升仪式目标'] }, reflected: l.reflected };
}

/** Original identity, finite contents, paid upkeep and same-body return survive persistence. */
export function validateSecretsSorcererLife(s: SliceState): boolean {
  const l = s.secretsSorcerer.life;
  if (!record(l) || !shape(l, ['cases', 'reflected', 'room', 'pocket', 'banishment']) || !record(l.cases) || !shape(l.cases, SECRETS_SORCERER_CASE_IDS) || !record(l.room) || !record(l.pocket) || !record(l.banishment) || typeof l.reflected !== 'boolean' || !Array.isArray(s.seer.completedSources)) return false;
  const firstWeek = s.secretsSorcerer.promotionWeek ?? s.week;
  let active = 0, prepared = 0, resolved = 0;
  for (const id of SECRETS_SORCERER_CASE_IDS) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'attemptWeek', 'method', 'outcome', 'contactOpen', 'suspended', 'closes', 'withdrawals', 'filmId'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.outcome)) return false;
    if (![r.closes, r.withdrawals].every(x => integer(x)) || typeof r.contactOpen !== 'boolean' || typeof r.suspended !== 'boolean' || (r.filmId !== null && typeof r.filmId !== 'string')) return false;
    if (r.observedWeek !== null && !integer(r.observedWeek, firstWeek, s.week) || r.attemptWeek !== null && !integer(r.attemptWeek, r.observedWeek ?? firstWeek, s.week)) return false;
    if (r.status === 'AVAILABLE') { if (r.observedWeek !== null || r.attemptWeek !== null || r.method !== null || r.outcome !== 'NONE' || r.contactOpen || r.suspended || r.closes || r.withdrawals || r.filmId !== null) return false; }
    else if (r.observedWeek === null) return false;
    if (r.status === 'PREPARED') { prepared++; if (!r.contactOpen || r.method === null || r.outcome !== 'NONE' || r.suspended || r.attemptWeek === s.week) return false; }
    if (r.status === 'ACTIVE') { active++; if (r.attemptWeek === null || r.method === null || r.contactOpen === r.suspended) return false; }
    if (!['PREPARED', 'ACTIVE'].includes(r.status) && (r.contactOpen || r.suspended)) return false;
    if (r.suspended && id !== 'original-pocket') return false;
    if (r.outcome !== 'NONE' && (r.outcome !== r.method || !['ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status))) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (r.outcome === 'NONE' || r.attemptWeek === null || r.closes < 1)) return false;
    if (r.attemptWeek === null && r.closes !== 0 || r.attemptWeek !== null && r.closes > r.attemptWeek - firstWeek + 1) return false;
    if (r.status === 'OBSERVED' && r.outcome !== 'NONE') return false;
    if (id !== 'original-pocket' && r.filmId !== null) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(x => x === `secrets-sorcerer-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    const closedAbility = r.outcome === 'ABILITY' && ['EXAMINED', 'RESOLVED'].includes(r.status);
    if (s.seer.completedSources.filter(x => x === `secrets-sorcerer-practice:${id}`).length !== (closedAbility ? 1 : 0)) return false;
  }
  if (active + prepared > 1) return false;
  const h = l.cases['hidden-room'], r = l.room, p = l.pocket, pc = l.cases['original-pocket'], b = l.banishment, bc = l.cases['temporary-banishment'];
  if (!shape(r, ['id', 'doorId', 'position', 'hidden', 'entries', 'exits', 'folds', 'unfoldings', 'companionId', 'companionAge', 'companionGender', 'companionPosition', 'consent'])) return false;
  if (r.id !== 'SS4-ROOM' || r.doorId !== 'SS4-DOOR' || !['OUTSIDE', 'INSIDE'].includes(r.position) || typeof r.hidden !== 'boolean' || typeof r.consent !== 'boolean' || r.companionId !== 'MIRA' || r.companionAge !== 29 || r.companionGender !== 'FEMALE' || r.companionPosition !== 'OUTSIDE') return false;
  if (![r.entries, r.exits, r.folds, r.unfoldings].every(x => integer(x))) return false;
  if (r.entries !== h.closes + (h.status === 'ACTIVE' ? 1 : 0) || r.entries - r.exits !== (r.position === 'INSIDE' ? 1 : 0) || r.folds - r.unfoldings !== (r.hidden ? 1 : 0) || r.folds !== (h.outcome === 'ABILITY' ? 1 : 0)) return false;
  if ((r.position === 'INSIDE' || r.hidden) && (h.status !== 'ACTIVE' || !h.contactOpen) || r.consent !== h.contactOpen) return false;
  if (!shape(p, ['id', 'owner', 'capacity', 'coordinate', 'mode', 'linked', 'expiresWeek', 'items', 'films', 'storesThisAttempt', 'takesThisAttempt', 'links', 'stops', 'maintenances', 'buzzCosts'])) return false;
  if (p.id !== 'SS4-BAG-1' || p.owner !== 'PLAYER' || p.capacity !== 3 || p.coordinate !== 'SS4-ROOM:SS4-BAG-1:ANCHOR' || !['NONE', 'ABILITY', 'ORDINARY'].includes(p.mode) || typeof p.linked !== 'boolean' || p.linked !== (p.mode === 'ABILITY')) return false;
  if (p.linked ? !integer(p.expiresWeek, firstWeek + 1, s.week + 1) : p.expiresWeek !== null) return false;
  if (![p.links, p.stops, p.maintenances, p.buzzCosts].every(x => integer(x)) || p.links - p.stops !== (p.linked ? 1 : 0) || p.links !== (pc.outcome === 'ABILITY' ? 1 : 0)) return false;
  if (!Array.isArray(p.items) || p.items.length !== 3 || !Array.isArray(p.films) || !Array.isArray(p.storesThisAttempt) || !Array.isArray(p.takesThisAttempt)) return false;
  for (const list of [p.storesThisAttempt, p.takesThisAttempt]) if (new Set(list).size !== list.length || list.some(id => !SECRETS_SORCERER_ITEM_IDS.includes(id))) return false;
  if (p.takesThisAttempt.some(id => !p.storesThisAttempt.includes(id))) return false;
  for (const [index, item] of p.items.entries()) {
    if (!record(item) || !shape(item, ['id', 'owner', 'location', 'stores', 'takes', 'returns']) || item.id !== SECRETS_SORCERER_ITEM_IDS[index] || item.owner !== (item.id === 'SS4-COIN-1' ? 'PLAYER' : 'ARCHIVE') || !['DESK', 'PLAYER', 'POCKET', 'BAG'].includes(item.location) || ![item.stores, item.takes, item.returns].every(x => integer(x))) return false;
    if (item.stores - item.takes !== (['POCKET', 'BAG'].includes(item.location) ? 1 : 0) || item.returns > item.takes || item.owner === 'PLAYER' && (item.location === 'DESK' || item.returns > 0)) return false;
    if (item.location === 'POCKET' && p.mode !== 'ABILITY' || item.location === 'BAG' && p.mode !== 'ORDINARY') return false;
    if (p.storesThisAttempt.includes(item.id) && item.stores === 0 || p.takesThisAttempt.includes(item.id) && item.takes === 0) return false;
  }
  const stone = p.items[2]!;
  if (p.buzzCosts !== stone.stores + stone.takes) return false;
  if (p.mode !== 'NONE' && (pc.status !== 'ACTIVE' || pc.method !== (p.mode === 'ABILITY' ? 'ABILITY' : 'ORDINARY'))) return false;
  if (pc.status !== 'ACTIVE' && !pocketClean(l)) return false;
  if (['EXAMINED', 'RESOLVED'].includes(pc.status) && !allStoredAndTaken(l)) return false;
  let maintenanceFilms = 0, unused = 0;
  for (const [index, film] of p.films.entries()) {
    if (!record(film) || !shape(film, ['id', 'purpose', 'purchasedWeek', 'consumedWeek']) || film.id !== `SS4-FILM-${index + 1}` || !['PREPARE', 'MAINTAIN'].includes(film.purpose) || !integer(film.purchasedWeek, firstWeek, s.week) || film.consumedWeek !== null && !integer(film.consumedWeek, film.purchasedWeek, s.week)) return false;
    if (film.purpose === 'MAINTAIN') { maintenanceFilms++; if (film.consumedWeek !== film.purchasedWeek || p.links === 0) return false; }
    else if (film.consumedWeek === null) unused++;
  }
  if (maintenanceFilms !== p.maintenances || unused > 1) return false;
  if (pc.filmId !== null) { const film = p.films.find(f => f.id === pc.filmId); if (!film || film.purpose !== 'PREPARE' || pc.method !== 'ABILITY' || (pc.status === 'PREPARED' ? film.consumedWeek !== null : film.consumedWeek !== pc.attemptWeek)) return false; }
  if (pc.method === 'ABILITY' && pc.filmId === null) return false;
  if (!shape(b, ['id', 'cageId', 'nature', 'alive', 'hostile', 'cageClosed', 'location', 'restrained', 'sceneSeconds', 'returnAtSeconds', 'restraints', 'releases', 'banishments', 'returns'])) return false;
  if (b.id !== 'SS4-ECHO-G' || b.cageId !== 'SS4-CAGE-1' || b.nature !== 'LICENSED_WEAK_HOSTILE_ECHO' || b.alive !== true || b.hostile !== true || b.cageClosed !== true || !['ORIGINAL_CAGE', 'AWAY'].includes(b.location) || typeof b.restrained !== 'boolean' || ![b.sceneSeconds, b.restraints, b.releases, b.banishments, b.returns].every(x => integer(x))) return false;
  if (b.restraints - b.releases !== (b.restrained ? 1 : 0) || b.banishments - b.returns !== (b.location === 'AWAY' ? 1 : 0) || b.sceneSeconds !== b.returns * 30 || b.banishments !== (bc.outcome === 'ABILITY' ? 1 : 0)) return false;
  if (b.location === 'AWAY' ? b.returnAtSeconds !== b.sceneSeconds + 30 || !b.restrained || bc.status !== 'ACTIVE' || !bc.contactOpen : b.returnAtSeconds !== null) return false;
  if (b.restrained && !(['PREPARED', 'ACTIVE'].includes(bc.status) && bc.contactOpen)) return false;
  if (s.seer.completedSources.filter(x => x === 'secrets-sorcerer-reflection').length !== (l.reflected ? 1 : 0) || l.reflected && resolved !== 3) return false;
  if (promoted(s) && ((s.progression.sequence===3||s.progression.sequence===2)?s.wanderer.secretsSorcererActingAtPromotion:s.progression.acting) !== resolved * 25 + (l.reflected ? 25 : 0)) return false;
  if (!promoted(s) && stableStringify(l) !== stableStringify(createSecretsSorcererLifeState())) return false;
  return true;
}
