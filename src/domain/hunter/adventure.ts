import { computeCheckChance } from '../../resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { HUNTER_TRAP_KIT, HUNTER_TRAP_STOCK } from './content.js';
import type { HunterAction, HunterCommand } from './types.js';

/** Original small stories and balance values, not additional pathway powers. */
const PRACTICES: readonly {
  id: string; title: string; body: string; result: string;
  stat: PublicCoreStatKey; difficulty: number; needsKit?: boolean;
}[] = [
  {
    id: 'muddy-cart', title: '雨后岔口的车辙',
    body: '搬运工艾达的手推车被同伴推去了另一处货位。她请你从院门的两道新车辙开始，在泥水与石板交界处判断转向，沿仍看得见的擦痕寻找。',
    result: '你沿右侧较深的车辙找到院内停着的原手推车，由艾达当面确认。痕迹说明经过的方向，没有告诉你推车人的身份或动机。',
    stat: 'perception', difficulty: 12,
  },
  {
    id: 'missing-hound', title: '面包房外的狗脚印',
    body: '面包师诺拉请你帮忙寻找溜出后院的成年猎犬。湿泥上留着爪印，后街两处门边各有相似污点；你跟她沿实际足迹辨认，而不是凭名字感应位置。',
    result: '连续爪印通向后街棚下，你在那里实际看见猎犬，诺拉把自己的狗领回。你没有追溯出没有留下的行程，也没有得到宠物。',
    stat: 'perception', difficulty: 13,
  },
  {
    id: 'shifted-crate', title: '地板上的两道擦痕',
    body: '木匠埃文发现刚交回的工具箱不在旧货位，请你查看地板。你对比箱底旧磨痕与地面新擦痕，分清搬动方向和那些早已留下的痕迹。',
    result: '擦痕在隔壁货位终止，你和埃文实际看见并核对原工具箱。只能确认这次搬动的终点，不能据此指认幕后人物；箱子仍由埃文持有。',
    stat: 'knowledge', difficulty: 12,
  },
  {
    id: 'rolling-barrel', title: '斜坡上滚动的空桶',
    body: '桶匠哈罗德在封闭院内试滚一只空木桶，请你练习沿侧面追上它，在终点挡板前稳住桶身。院门关着，没有旁人被当作练习目标。',
    result: '你控制步幅，从侧面稳住原空桶，再交回哈罗德。身体强化帮助了动作，但没有让木桶或你的身体免于受力；这次受控练习没有新增伤势。',
    stat: 'physique', difficulty: 13,
  },
  {
    id: 'blind-corner', title: '拐角前停住的脚步',
    body: '搬运工丽莎正练习推空车通过院内拐角。她请你站在能看清两边的位置，根据可见脚步、车轮与身体倾斜判断何时示意她停下，再让迎面的同伴先过。',
    result: '你从迎面同伴的站位和车轮转动中抓住时机，示意丽莎停下，等通道空出再走。判断只来自眼前动作，没有读取拐角后未知的事。',
    stat: 'perception', difficulty: 14,
  },
  {
    id: 'rope-inspection', title: '重新检查自己的绳结',
    body: '你把实际买来的一套原绳与木楔放在导师的空桌上，练习辨认受力方向、结扣松紧和绳上磨损。检查完解除练习绳结，收好同一套原件。',
    result: '你辨清了受力时容易松开的结扣并重新检查原绳。桌上没有布置可触发的陷阱；同一套原件完整回到袋中，没有复制或消耗库存。',
    stat: 'knowledge', difficulty: 12, needsKit: true,
  },
];

export const HUNTER_PRACTICE_IDS = PRACTICES.map(practice => practice.id);
export const HUNTER_CARGO_STORY = '货主米洛请你陪他处理仓库西门的一次运货争议：一名持短棍的拦路者索要没有凭据的费用。原铜管箱始终由米洛看管并归他所有。西门与石墙之间有一处只能单人通过的狭口，院内一侧可以提前绕行准备；货主和拦路者实际到场后，你才可当面交涉或选择有真实受伤、死亡风险的介入。追踪不揭示幕后身份，退离也不会自动带走货主和原箱。';

type Award = (source: string, amount: 5 | 8 | 25) => void;
const successful = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 9;
const statNames: Record<PublicCoreStatKey, string> = { physique: '体质', perception: '感知', will: '意志', knowledge: '知识' };

function commonBlock(s: SliceState): string | null {
  if (s.status !== 'ACTIVE') return '当前周目无法行动。';
  if (!promoted(s)) return '成为猎人后才能进行这些实践。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，亲自到场。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  return s.actionsRemaining < 1 ? '本周剩余行动不足。' : null;
}

function blocked(s: SliceState, command: HunterCommand): string | null {
  const common = commonBlock(s);
  if (common) return common;
  const h = s.hunter;
  if (command.type === 'REFLECT') {
    if (s.seer.completedSources.includes('hunter-reflection')) return '这些经历已经复盘过，不重复增加扮演。';
    if (!HUNTER_PRACTICE_IDS.every(id => h.observations.includes(id))) return '先完成六项猎人实践，再复盘亲见经历。';
    return h.cargo.status !== 'RESCUED' ? '先实际解决货运争议，和平交涉同样可以完成。' : null;
  }
  if (command.type === 'PRACTICE') {
    const practice = PRACTICES.find(candidate => candidate.id === command.practiceId);
    if (!practice) return '未知的猎人实践。';
    if (h.observations.includes(practice.id)) return '这项实践已经完成，不重复发奖。';
    if (h.practiceAttempts[practice.id] === s.week) return '本周已经尝试过，下周再来。';
    if (practice.needsKit && h.trapHeld < 1) return '需要一套实际持有的原绳与木楔，不能拿现场的原件隔空练习。';
    return null;
  }
  if (command.type === 'RECOVER_TRAP') {
    if (h.trapDeployed !== 1 || h.trapLocation !== 'HUNTER_CARGO') {
      return h.trapLocation === 'FIRST_CASE'
        ? '首案现场已经封存，原件仍在那里；不能从货运入口回收。'
        : '货运狭口没有未触发的陷阱原件可回收。';
    }
    if (h.cargo.status === 'RETREATED' || h.cargo.status === 'LOST') return '你已离开仍有抵抗的货运现场，不能远程取回原件。';
    if (h.cargo.status !== 'AVAILABLE' && (h.cargo.status !== 'RESCUED' || h.cargo.enemyStatus === 'RESISTING')) return '现场仍有人抵抗，不能安全回收。';
    return null;
  }
  if (!['SET_TRAP', 'CARGO_TALK', 'CARGO_FIGHT'].includes(command.type)) return '未知的猎人行动。';
  if (!h.observations.length) return '先完成至少一项猎人实践，再接货运争议。';
  if (h.cargo.status !== 'AVAILABLE') return '这次货运争议已经有了结果，不能重开刷取。';
  if (command.type === 'SET_TRAP') {
    if (command.location !== 'HUNTER_CARGO') return '只能在已知的货运狭口准备。';
    if (h.trapDeployed > 0 || h.trapLocation !== null) return '已有原件留在现场，先处理那套原件，不能同时另设一套。';
    return h.trapHeld < 1 ? '需要先购买并实际持有一套陷阱原件。' : null;
  }
  if (command.type === 'CARGO_TALK' && h.cargo.attemptWeek === s.week) return '本周的交涉已经尝试过；可另花1行动介入，或下周再谈。';
  return null;
}

export function hunterAdventureActions(s: SliceState): HunterAction[] {
  if (!promoted(s)) return [];
  const add = (id: string, label: string, cost: string, command: HunterCommand): HunterAction => {
    const reason = blocked(s, command);
    return { id, label, cost, command, enabled: reason === null, reason };
  };
  const actions = PRACTICES.filter(practice => !s.hunter.observations.includes(practice.id)).map(practice => add(
    practice.id, practice.title,
    `1行动 · 0灵性 · ${statNames[practice.stat]}难度${practice.difficulty} · 成功率${computeCheckChance({ baseAbility: s.character.coreStats[practice.stat], difficulty: practice.difficulty, modifiers: [] })}% · 成功扮演+12、单项掌握+8。${practice.body}`,
    { type: 'PRACTICE', practiceId: practice.id },
  ));
  if (s.hunter.cargo.status === 'AVAILABLE') {
    actions.push(
      add('hunter-cargo-talk', '陪货主当面交涉', '1行动 · 意志难度14 · 成功扮演+20、单项掌握+8；原箱仍归货主', { type: 'CARGO_TALK' }),
      add('hunter-cargo-fight', '到西门介入货运冲突', '1行动 · 双方实际到场后开战；可能受伤或死亡，原箱不作战利品', { type: 'CARGO_FIGHT' }),
      add('hunter-cargo-set-trap', '提前在西门狭口布置原件', `1行动 · 将实际持有的${HUNTER_TRAP_KIT}移到现场；仅敌人实际踏入时触发`, { type: 'SET_TRAP', location: 'HUNTER_CARGO' }),
    );
  }
  if (s.hunter.trapDeployed > 0) actions.push(add(
    'hunter-recover-trap', '原路回访，拆回未触发原件',
    '1行动 · 亲自返回货运狭口、确认无人抵抗后拆回原绳与木楔；不跨地免费回收',
    { type: 'RECOVER_TRAP' },
  ));
  if (HUNTER_PRACTICE_IDS.every(id => s.hunter.observations.includes(id)) && s.hunter.cargo.status === 'RESCUED' && !s.seer.completedSources.includes('hunter-reflection')) actions.push(add(
    'hunter-reflection', '复盘亲见的追踪与货运经历',
    '1行动 · 扮演+8，仅一次 · 六项实践与货运争议均已完成；不增加能力掌握',
    { type: 'REFLECT' },
  ));
  return actions;
}

/** Mutates the slice's working copy; the shared intent owns commit and rollback. */
export function applyHunterAdventure(s: SliceState, command: HunterCommand, ctx: SeerContext, award: Award): void {
  const reason = blocked(s, command);
  if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const h = s.hunter;
  if (command.type === 'REFLECT') {
    s.seer.completedSources.push('hunter-reflection');
    s.progression.acting = Math.min(100, s.progression.acting + 8);
    ctx.note('亲见经历的复盘', '你花费1行动，回顾六项实践和已经解决的货运争议：追踪只依据真实痕迹，方向不等于幕后身份；绳结检查与陷阱只能依托实际原件，货主的原箱也不因争议解决而归你。和平交涉同样是真实经历，无须为了成长强迫战斗。扮演+8，最高100；这次复盘不增加能力掌握，不改写先前失败，也不重新结算旧奖励。');
    return;
  }
  if (command.type === 'PRACTICE') {
    const practice = PRACTICES.find(candidate => candidate.id === command.practiceId)!;
    h.practiceAttempts[practice.id] = s.week;
    const result = ctx.check(practice.stat, practice.difficulty), ok = successful(result.tier);
    if (ok) {
      h.observations.push(practice.id);
      award(`hunter-practice:${practice.id}`, 8);
      s.progression.acting = Math.min(100, s.progression.acting + 12);
    }
    ctx.note(practice.title, `${practice.body} ${ok ? practice.result + ' 扮演+12，已知能力中一项掌握+8。' : '本次未能可靠完成，没有成长奖励；已花费1行动，下周可以再试，不凭空补出线索或物品。'}${practice.needsKit ? '原件持有数量不变。' : ''}`);
    return;
  }
  if (command.type === 'SET_TRAP') {
    h.trapHeld -= 1;
    h.trapDeployed += 1;
    h.trapLocation = 'HUNTER_CARGO';
    ctx.note('西门狭口的原绳', `你花费1行动，亲自从米洛院内一侧绕到西门，将实际持有的${HUNTER_TRAP_KIT}固定在无人通行的狭口，再退回院内。原件已从袋中移到这里，没有新增库存，也没有远程操纵。此时没有敌人踏入，不触发、不造成伤害；只有之后开战时拦路者实际持短棍冲过狭口，才可能触发一次、损耗这套原件并削减20优势。`);
    return;
  }
  if (command.type === 'RECOVER_TRAP') {
    h.trapDeployed -= 1;
    h.trapHeld += 1;
    h.trapLocation = null;
    ctx.note('原路回访，拆回原件', '你花费1行动，沿米洛院内一侧的原路亲自回到货运狭口，确认那里无人抵抗，解除原绳并拔回木楔。同一套未触发原件回到袋中；没有从远处召回，也没有刷新货源或货运结果。');
    return;
  }
  h.cargo.attemptWeek = s.week;
  if (command.type === 'CARGO_TALK') {
    const result = ctx.check('will', 14), ok = successful(result.tier);
    if (ok) {
      h.cargo.status = 'RESCUED';
      h.cargo.enemyStatus = 'SURRENDERED';
      award('hunter-cargo', 8);
      s.progression.acting = Math.min(100, s.progression.acting + 20);
      ctx.note('货主带走原箱', '你花费1行动陪米洛实际来到西门，向在场的拦路者要求拿出收费依据。对方在当面交涉后放下短棍、让开道路。米洛带走自己原有的铜管箱，原箱没有进入你的库存；没有虚构身份或支付不存在的费用。扮演+20，单项掌握+8。现场未触发的陷阱原件仍留在原处，回收另花1行动。');
    } else {
      ctx.note('西门的争执仍未解决', '你花费1行动陪米洛到西门当面交涉，拦路者拒绝退让。你和米洛退回院内，原箱仍由货主看管；没有自动开战，也无人踏入准备的狭口。下周可再谈，或另花1行动明确选择有风险的介入。');
    }
    return;
  }
  h.cargo.status = 'FIGHTING';
  h.cargo.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'HUNTER_CARGO', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('西门货运冲突', `${HUNTER_CARGO_STORY} 你已花费1行动，陪米洛实际走到西门；持短棍的拦路者也已站到门外，双方在场。你立于狭口院内一侧，米洛带着原箱站在你身后；敌人若选择持棍进逼，才会实际穿过狭口。${h.trapLocation === 'HUNTER_CARGO' ? '那里仅有你先前布置的同一套原件，开战本身不会触发。' : '这里没有你的货运陷阱，不能凭空获得陷阱效果。'}`);
}

export function settleHunterCargo(s: SliceState, outcome: string, ctx: SeerContext, award: Award): void {
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('未知的货运战斗结果。');
  const cargo = s.hunter.cargo;
  if (cargo.status !== 'FIGHTING' || s.combat?.encounterId !== 'HUNTER_CARGO' || cargo.startHistoryIndex === null) throw new Error('当前没有进行中的货运战斗。');
  cargo.enemyStatus = s.combat.enemyStatus;
  const survived = outcome !== 'PLAYER_DEAD' && s.health > 0;
  if (!survived) cargo.status = 'LOST';
  else if (outcome === 'RETREATED') cargo.status = 'RETREATED';
  else {
    cargo.status = 'RESCUED';
    s.progression.acting = Math.min(100, s.progression.acting + 20);
  }
  const effective = s.combatHistory.slice(cargo.startHistoryIndex).some(round =>
    round.retreat === 'NONE' && round.stance !== 'RETREAT' && round.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)),
  );
  if (survived && effective) award('hunter-cargo', 25);
  ctx.note('西门货运结果', cargo.status === 'RESCUED'
    ? `拦路者的抵抗已经结束，米洛带走自己的原铜管箱；原箱没有成为战利品。扮演+20。${effective ? '本场有效行动且存活，单项掌握+25。' : '没有有效行动记录，不发能力成长。'}未触发的原件仍留在原处，亲自回收另花1行动。`
    : cargo.status === 'RETREATED'
      ? `你已撤离本场，没有自动带走米洛或原箱；原物仍归货主，后续情况尚未确认。${effective ? '本场已有有效行动且存活，单项掌握+25；货运未完成，不发完成扮演。' : '本场只有撤退或无效行动，不发成长奖励。'}若原件尚未触发，它仍在货运狭口；抵抗未结束，不能远程回收。`
      : '你已死亡，货运没有被记作完成，不发成长奖励；原铜管箱始终归米洛，没有转入你的库存，尚未触发的原件也不会自动回收。');
  s.combat = null;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const weekOrNull = (value: unknown, week: number) => value === null || Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= week;

export function validateHunterAdventure(s: SliceState): boolean {
  const h = s.hunter;
  if (!record(h) || !Array.isArray(h.observations) || new Set(h.observations).size !== h.observations.length || h.observations.some(id => !HUNTER_PRACTICE_IDS.includes(id))) return false;
  if (!record(h.practiceAttempts) || Object.entries(h.practiceAttempts).some(([id, week]) => !HUNTER_PRACTICE_IDS.includes(id) || week === null || !weekOrNull(week, s.week))) return false;
  if (h.observations.some(id => !Object.hasOwn(h.practiceAttempts, id) || !s.seer.completedSources.includes(`hunter-practice:${id}`))) return false;
  if (s.seer.completedSources.some(source => source.startsWith('hunter-practice:') && !h.observations.includes(source.slice('hunter-practice:'.length)))) return false;
  if (![h.trapStock, h.trapHeld, h.trapDeployed, h.trapSpent].every(value => Number.isSafeInteger(value) && value >= 0 && value <= HUNTER_TRAP_STOCK)) return false;
  if (h.trapStock + h.trapHeld + h.trapDeployed + h.trapSpent !== HUNTER_TRAP_STOCK || h.trapDeployed > 1) return false;
  if (h.trapDeployed === 0 ? h.trapLocation !== null : h.trapLocation !== 'FIRST_CASE' && h.trapLocation !== 'HUNTER_CARGO') return false;
  const cargo = h.cargo;
  if (!record(cargo) || !['AVAILABLE', 'FIGHTING', 'RESCUED', 'RETREATED', 'LOST'].includes(cargo.status) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(cargo.enemyStatus)) return false;
  if (cargo.originalId !== 'milo-copper-crate' || cargo.owner !== 'cargo-owner-milo' || cargo.holder !== 'OWNER') return false;
  if (!weekOrNull(cargo.attemptWeek, s.week) || cargo.startHistoryIndex !== null && (!Number.isSafeInteger(cargo.startHistoryIndex) || cargo.startHistoryIndex < 0 || cargo.startHistoryIndex > s.combatHistory.length)) return false;
  if ((cargo.status === 'FIGHTING') !== (s.combat?.encounterId === 'HUNTER_CARGO')) return false;
  if (cargo.status === 'AVAILABLE' && (cargo.enemyStatus !== 'RESISTING' || cargo.startHistoryIndex !== null)) return false;
  if (cargo.status !== 'AVAILABLE' && (cargo.attemptWeek === null || h.observations.length === 0)) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(cargo.status) && cargo.startHistoryIndex === null) return false;
  if (cargo.status === 'RESCUED' && cargo.enemyStatus === 'RESISTING') return false;
  if (cargo.status === 'RETREATED' && cargo.enemyStatus !== 'RESISTING') return false;
  if (cargo.status === 'RESCUED' && cargo.startHistoryIndex === null && !s.seer.completedSources.includes('hunter-cargo')) return false;
  if (s.seer.completedSources.includes('hunter-cargo') && !['RESCUED', 'RETREATED'].includes(cargo.status)) return false;
  const reflections = s.seer.completedSources.filter(source => source === 'hunter-reflection').length;
  if (reflections > 1 || reflections === 1 && (cargo.status !== 'RESCUED' || !HUNTER_PRACTICE_IDS.every(id => h.observations.includes(id)))) return false;
  if (h.trapLocation === 'HUNTER_CARGO' && h.observations.length === 0) return false;
  return true;
}
