import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { TOWN_CLUB_ID, type TownAction, type TownCommand, type TownItem, type TownProjection, type TownState } from './types.js';

// Original playtest prices and first-aid balance, not claims about canon equipment.
const CLUB_PRICE = 80;
const CLUB_RESALE = 40;
const BANDAGE_PRICE = 12;
const BANDAGE_HEAL = 8;
const BANDAGE_TOTAL = 3;
const COMMANDS = ['VISIT_SHOP', 'BUY_CLUB', 'SELL_CLUB', 'EQUIP_CLUB', 'UNEQUIP_CLUB', 'BUY_BANDAGE', 'USE_BANDAGE'] as const;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: readonly string[]) => Object.keys(v).sort().join('|') === [...expected].sort().join('|');
const rule = (ok: unknown, message: string): void => { if (!ok) throw new Error(message); };

export function createTownState(): TownState {
  return { shopKnown: false, clubLocation: 'SHOP', bandagesStock: BANDAGE_TOTAL, bandagesHeld: 0, bandagesUsed: 0 };
}

export function validateTownCommand(value: unknown): value is TownCommand {
  return record(value) && keys(value, ['type']) && COMMANDS.some(type => value.type === type);
}

function commandBlock(s: SliceState, command: TownCommand): string | null {
  if(s.tamer.companionId!==null)return '先完成动物协助，或0行动送回原动物。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  const actionCost = command.type === 'VISIT_SHOP' || command.type === 'USE_BANDAGE' ? 1 : 0;
  if (s.actionsRemaining < actionCost) return '本周剩余行动不足。';
  if (['VISIT_SHOP', 'BUY_CLUB', 'SELL_CLUB', 'BUY_BANDAGE'].includes(command.type)) {
    if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的街角杂货铺。';
    if (command.type === 'VISIT_SHOP') return s.town.shopKnown ? '已经认识这家街角杂货铺。' : null;
    if (!s.town.shopKnown) return '先拜访街角杂货铺，确认普通用品的买卖渠道。';
  }
  switch (command.type) {
    case 'BUY_CLUB':
      if (s.town.clubLocation !== 'SHOP') return '这根短棍已经属于你，没有第二根库存。';
      return s.cash < CLUB_PRICE ? '购买短棍需要80便士。' : null;
    case 'SELL_CLUB':
      if (s.town.clubLocation !== 'BAG') return s.town.clubLocation === 'HAND' ? '先收起手中的短棍，再交给店主。' : '你没有可出售的短棍。';
      return Number.isSafeInteger(s.cash + CLUB_RESALE) ? null : '当前现金无法记录这笔回收款。';
    case 'EQUIP_CLUB': return s.town.clubLocation === 'BAG' ? null : '需要先拥有并随身收好这根短棍。';
    case 'UNEQUIP_CLUB': return s.town.clubLocation === 'HAND' ? null : '当前没有持用这根短棍。';
    case 'BUY_BANDAGE':
      if (s.town.bandagesStock <= 0) return '这批三份绷带已经售完，不会自动补货。';
      return s.cash < BANDAGE_PRICE ? '一份绷带需要12便士。' : null;
    case 'USE_BANDAGE':
      if (s.town.bandagesHeld <= 0) return '没有随身持有的绷带。';
      return s.health >= 100 ? '健康已经恢复，无需消耗绷带。' : null;
    case 'VISIT_SHOP': return null;
  }
}

/** Mutates only the caller's working copy; the shared intent commits all changes together. */
export function applyTownCommand(s: SliceState, command: TownCommand, c: SeerContext): void {
  rule(validateTownCommand(command), '普通用品命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'VISIT_SHOP':
      s.actionsRemaining -= 1;
      s.town.shopKnown = true;
      c.note('认识街角杂货铺', '花费1行动，确认一家普通杂货铺的买卖渠道。店主出售一根木制短棍和三份绷带，也愿意回收原短棍；这次拜访不开放非凡市场。价格、库存与急救效果是本作原创试玩数值。');
      return;
    case 'BUY_CLUB':
      s.cash -= CLUB_PRICE;
      s.town.clubLocation = 'BAG';
      c.note('买下原短棍', '支付80便士，0行动。店中的原短棍已转归你所有，收在随身行李中；需要持用后才影响普通打击，不增加基础属性或非凡掌握。');
      return;
    case 'SELL_CLUB':
      s.cash += CLUB_RESALE;
      s.town.clubLocation = 'SHOP';
      c.note('交回原短棍', '收到40便士，0行动。原短棍的所有权与保管位置一并交回店主；你已不再持有它，店内仍只有这一根。');
      return;
    case 'EQUIP_CLUB':
      s.town.clubLocation = 'HAND';
      c.note('持用短棍', '0行动，把自己的原短棍拿到手中。普通人与观众路线的普通打击基础收益由12变为16；不会叠加到其他途径的专属体术、能力或魔法上。');
      return;
    case 'UNEQUIP_CLUB':
      s.town.clubLocation = 'BAG';
      c.note('收起短棍', '0行动，原短棍回到随身行李，不再提供持用效果。所有权保持不变。');
      return;
    case 'BUY_BANDAGE':
      s.cash -= BANDAGE_PRICE;
      s.town.bandagesStock -= 1;
      s.town.bandagesHeld += 1;
      c.note('领取一份绷带', '支付12便士，0行动。一份普通绷带从这批店内库存转入随身行李；使用时另花1行动，健康最多恢复8点。不会代替诊所的重伤医疗处置。');
      return;
    case 'USE_BANDAGE': {
      const restored = Math.min(BANDAGE_HEAL, 100 - s.health);
      s.actionsRemaining -= 1;
      s.town.bandagesHeld -= 1;
      s.town.bandagesUsed += 1;
      s.health += restored;
      c.note('使用随身绷带', `花费1行动并实际消耗1份绷带，健康恢复${restored}点。急救不会解除轻伤或重伤，不记为重伤医疗处置，也不清除带伤风险；原有诊所与休养流程仍然适用。`);
      return;
    }
  }
}

export function projectTown(s: SliceState): TownProjection {
  const actions: TownAction[] = [];
  const add = (id: string, label: string, cost: string, command: TownCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, enabled: reason === null, reason, command });
  };
  if (!s.town.shopKnown) add('visit-shop', '拜访街角杂货铺', '1行动 · 建立普通用品渠道', { type: 'VISIT_SHOP' });
  else {
    if (s.town.clubLocation === 'SHOP') add('buy-club', '购买短棍', '0行动 · 80便士', { type: 'BUY_CLUB' });
    else add('sell-club', '卖回原短棍', '0行动 · 收入40便士 · 先收起', { type: 'SELL_CLUB' });
    add('buy-bandage', '购买一份绷带', '0行动 · 12便士', { type: 'BUY_BANDAGE' });
  }
  if (s.town.clubLocation === 'BAG') add('equip-club', '持用短棍', '0行动 · 战斗外更换', { type: 'EQUIP_CLUB' });
  if (s.town.clubLocation === 'HAND') add('unequip-club', '收起短棍', '0行动 · 战斗外更换', { type: 'UNEQUIP_CLUB' });
  if (s.town.bandagesHeld > 0) add('use-bandage', '使用一份绷带', '1行动 · 健康+8，上限100 · 不处置重伤', { type: 'USE_BANDAGE' });
  const items: TownItem[] = [];
  if (s.town.shopKnown || s.town.clubLocation !== 'SHOP') items.push({
    id: TOWN_CLUB_ID, label: '普通木制短棍', quantity: 1, location: s.town.clubLocation,
    owner: s.town.clubLocation === 'SHOP' ? 'SHOP' : 'PLAYER', equipped: s.town.clubLocation === 'HAND',
    description: '独立原件。持用时，普通人与观众路线的普通打击基础收益12→16；无魔法、无掌握增长，不与其他途径专属体术叠加。买80、回收40便士，均为原创试玩数值。',
  });
  if (s.town.shopKnown && s.town.bandagesStock > 0) items.push({
    id: 'town-bandage-stock', label: '店内普通绷带', quantity: s.town.bandagesStock, location: 'SHOP', owner: 'SHOP', equipped: false,
    description: '本批有限三份，每份12便士，不自动补货。价格与急救效果为原创试玩数值。',
  });
  if (s.town.bandagesHeld > 0) items.push({
    id: 'town-bandage-held', label: '随身普通绷带', quantity: s.town.bandagesHeld, location: 'BAG', owner: 'PLAYER', equipped: false,
    description: '消耗一份与1行动，健康+8，上限100；不解除伤势、不处置重伤、不清带伤风险。健康已满时不能使用。',
  });
  return {
    title: '行囊与街角杂货铺', shopKnown: s.town.shopKnown, items, actions,
    stockSummary: s.town.shopKnown ? `只有一根原短棍；绷带店内${s.town.bandagesStock}份、随身${s.town.bandagesHeld}份、已用${s.town.bandagesUsed}份。普通用品渠道，不是非凡市场。`
      : '先拜访普通杂货铺，了解可买的用品。诊所医疗与原有生活行动仍可照常使用。',
  };
}

/** Shape and finite ownership/conservation only; no speculative economy history is persisted. */
export function validateTownState(s: SliceState): boolean {
  const t: unknown = s.town;
  if (!record(t) || !keys(t, ['shopKnown', 'clubLocation', 'bandagesStock', 'bandagesHeld', 'bandagesUsed']) || typeof t.shopKnown !== 'boolean' || !['SHOP', 'BAG', 'HAND'].includes(t.clubLocation as string)) return false;
  const counts = [t.bandagesStock, t.bandagesHeld, t.bandagesUsed];
  return counts.every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= BANDAGE_TOTAL)
    && counts.reduce<number>((total, value) => total + (value as number), 0) === BANDAGE_TOTAL;
}
