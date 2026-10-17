/** 1353 onward is an original game branch. Every head count, price, distance,
 * supply quantity, timetable and combat parameter in this module is fictional
 * balancing data. It is neither canonical demographic evidence nor a model of
 * real military operations. The old mutual-aid roster is deliberately absent. */
export const RED_PRIEST_CAMPAIGN_VERSION = 1 as const;
export const RED_PRIEST_CAMPAIGN_POLITY_IDS = ['feysac', 'loen', 'intis', 'feneport'] as const;
export type CampaignPolityId = typeof RED_PRIEST_CAMPAIGN_POLITY_IDS[number];
export const RED_PRIEST_CAMPAIGN_COALITION = ['loen', 'intis', 'feneport'] as const;
export type CampaignCoalitionId = typeof RED_PRIEST_CAMPAIGN_COALITION[number];
export const RED_PRIEST_CAMPAIGN_THEATER_IDS = ['north-east', 'west-south', 'east-south'] as const;
export type CampaignTheaterId = typeof RED_PRIEST_CAMPAIGN_THEATER_IDS[number];
export const RED_PRIEST_CAMPAIGN_POLITIES = [
  { id: 'feysac', name: '弗萨克', direction: '北方', treasury: 18000, reserves: 1800, supplyReserve: 600, residents: 68000 },
  { id: 'loen', name: '鲁恩', direction: '东方', treasury: 10000, reserves: 1200, supplyReserve: 240, residents: 72000 },
  { id: 'intis', name: '因蒂斯', direction: '西方', treasury: 10000, reserves: 1200, supplyReserve: 240, residents: 64000 },
  { id: 'feneport', name: '费内波特', direction: '南方', treasury: 10000, reserves: 1200, supplyReserve: 240, residents: 76000 },
] as const;
export const RED_PRIEST_CAMPAIGN_THEATERS = [
  { id: 'north-east', name: '北东战区', geography: '弗萨克南缘与鲁恩北境', purpose: '边境通路与东向转运' },
  { id: 'west-south', name: '西南战区', geography: '因蒂斯南境与费内波特西境', purpose: '西南水陆运输与居民迁离' },
  { id: 'east-south', name: '东南战区', geography: '鲁恩南境与费内波特东境', purpose: '东南仓储、港路与停战通道' },
] as const;
export const RED_PRIEST_CAMPAIGN_LEGIONS = [
  { id: 'loen-expedition', name: '鲁恩东境军团', polityId: 'loen', role: 'FIELD', personnel: 2600, supply: 88, morale: 72 },
  { id: 'intis-expedition', name: '因蒂斯西境军团', polityId: 'intis', role: 'FIELD', personnel: 2600, supply: 88, morale: 72 },
  { id: 'feneport-expedition', name: '费内波特南境军团', polityId: 'feneport', role: 'FIELD', personnel: 2600, supply: 88, morale: 72 },
  { id: 'feysac-north', name: '弗萨克北关守备团', polityId: 'feysac', role: 'OPPOSITION', personnel: 900, supply: 75, morale: 70 },
  { id: 'feysac-east', name: '弗萨克东桥守备团', polityId: 'feysac', role: 'OPPOSITION', personnel: 1000, supply: 75, morale: 70 },
  { id: 'feysac-west', name: '弗萨克西线行军团', polityId: 'feysac', role: 'OPPOSITION', personnel: 1050, supply: 75, morale: 70 },
  { id: 'feysac-river', name: '弗萨克南河行军团', polityId: 'feysac', role: 'OPPOSITION', personnel: 1100, supply: 75, morale: 70 },
  { id: 'feysac-store', name: '弗萨克东南行军团', polityId: 'feysac', role: 'OPPOSITION', personnel: 1150, supply: 75, morale: 70 },
  { id: 'feysac-port', name: '弗萨克海路行军团', polityId: 'feysac', role: 'OPPOSITION', personnel: 1200, supply: 75, morale: 70 },
  { id: 'intis-local', name: '因蒂斯西南转运守备', polityId: 'intis', role: 'GARRISON', personnel: 240, supply: 30, morale: 65 },
  { id: 'feneport-river-local', name: '费内波特河埠守备', polityId: 'feneport', role: 'GARRISON', personnel: 240, supply: 30, morale: 65 },
  { id: 'loen-local', name: '鲁恩南境仓区守备', polityId: 'loen', role: 'GARRISON', personnel: 240, supply: 30, morale: 65 },
  { id: 'feneport-port-local', name: '费内波特东港守备', polityId: 'feneport', role: 'GARRISON', personnel: 240, supply: 30, morale: 65 },
] as const;
export type CampaignLegionId = typeof RED_PRIEST_CAMPAIGN_LEGIONS[number]['id'];
export const RED_PRIEST_CAMPAIGN_NODES = [
  { id: 'northern-pass', name: '灰脊北关', theaterId: 'north-east', owner: 'feysac', originalDefenderId: 'feysac-north', opponentId: 'feysac-north', facility: '北境关口与军用转运场', residents: 1400, enemyAdvanceAfter: 0, difficulty: 42 },
  { id: 'eastern-bridge', name: '晨河东桥', theaterId: 'north-east', owner: 'feysac', originalDefenderId: 'feysac-east', opponentId: 'feysac-east', facility: '东向桥路与粮秣站', residents: 1800, enemyAdvanceAfter: 0, difficulty: 45 },
  { id: 'western-depot', name: '白石转运地', theaterId: 'west-south', owner: 'intis', originalDefenderId: 'intis-local', opponentId: 'feysac-west', facility: '因蒂斯西南转运站', residents: 2100, enemyAdvanceAfter: 4, difficulty: 48 },
  { id: 'southern-river', name: '青岸河埠', theaterId: 'west-south', owner: 'feneport', originalDefenderId: 'feneport-river-local', opponentId: 'feysac-river', facility: '费内波特西境河运设施', residents: 1900, enemyAdvanceAfter: 5, difficulty: 49 },
  { id: 'eastern-stores', name: '东南粮仓地', theaterId: 'east-south', owner: 'loen', originalDefenderId: 'loen-local', opponentId: 'feysac-store', facility: '鲁恩南境粮仓与车站', residents: 2400, enemyAdvanceAfter: 7, difficulty: 52 },
  { id: 'southern-harbor', name: '南灯港路', theaterId: 'east-south', owner: 'feneport', originalDefenderId: 'feneport-port-local', opponentId: 'feysac-port', facility: '费内波特东港与撤离码头', residents: 2600, enemyAdvanceAfter: 8, difficulty: 54 },
] as const;
export type CampaignNodeId = typeof RED_PRIEST_CAMPAIGN_NODES[number]['id'];
export type CampaignLocation = 'loen-headquarters' | CampaignNodeId;
export const RED_PRIEST_CAMPAIGN_ROUTES: readonly { from: CampaignLocation; to: CampaignNodeId; weeks: number; label: string }[] = [
  { from: 'loen-headquarters', to: 'northern-pass', weeks: 1, label: '鲁恩北境至弗萨克灰脊关口' },
  { from: 'northern-pass', to: 'eastern-bridge', weeks: 1, label: '灰脊关口至晨河东桥' },
  { from: 'eastern-bridge', to: 'western-depot', weeks: 2, label: '北东转运线至因蒂斯西南' },
  { from: 'western-depot', to: 'southern-river', weeks: 1, label: '因蒂斯西南至费内波特西境' },
  { from: 'southern-river', to: 'eastern-stores', weeks: 2, label: '西南河运线至鲁恩南境' },
  { from: 'eastern-stores', to: 'southern-harbor', weeks: 1, label: '鲁恩南境至费内波特东港' },
];
export const RED_PRIEST_CAMPAIGN_LIMITS = {
  reviewAfterWeeks: 48, maxEntries: 512, minimumArmyPersonnel: 3000, minimumLegionMorale: 40,
  // Per-legion upkeep covers army maintenance only, never personal bills/debt.
  weeklySupply: 1, weeklyTreasury: 24, convoyWeeks: 2, convoyPersonnel: 300,
  convoySupply: 24, convoyMorale: 16, convoyTreasury: 600, mobilizationTreasury: 300,
  marchSupply: 2, battleSupply: 4, consolidateSupply: 2, victoryLoss: 180,
  defeatLoss: 600, independentVictories: 5, requiredTheaters: 3,
} as const;
export const RED_PRIEST_CAMPAIGN_STORY = '北大陆四方仍处在危机对峙。鲁恩、因蒂斯与费内波特各有军队、国库和居民，弗萨克自行决定动员与拒绝。你须先取得三方实际委托，另行签发发动命令，再亲自执行首次跨境行动。旧日互助成员仍是原来的同伴，并未成为军团。';

export const RED_PRIEST_CAMPAIGN_LABOUR_TASKS = [
  { id: 'SUPPLY_INVENTORY', title: '核对实际军需清单' },
  { id: 'CASUALTY_REGISTER', title: '整理原伤员交接名册' },
  { id: 'HANDOVER_RECONCILIATION', title: '核对原军务交接账' },
] as const;
export type CampaignLabourTaskId = typeof RED_PRIEST_CAMPAIGN_LABOUR_TASKS[number]['id'];
