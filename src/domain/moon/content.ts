/** Original finite future branch. Three S1 originals and one uniqueness are
 * the known principal materials; the full ritual and auxiliary recipe/quantities
 * remain unknown. This content does not assert a canon
 * deity's death or vacancy. All three stations and six adults are authored. */
export { MOON_ABILITY_IDS } from './types.js';
export const MOON_ABILITIES = [
  { id: 'moon.s0.moonlit-channel', label: '月照航道', description: '亲眼观察后，用真实灯油照明已知水道，最多维持随后两次现场动作。不能平息风暴或看见未知水域；仍须有人实际划船、转移。失败照常消耗。' },
  { id: 'moon.s0.gentle-crossing', label: '柔和渡行', description: '借一枚实际付费的反光配件，短暂稳定眼前同一渡船的一次靠泊或转移，至多六十秒。不能创造船只、强迫配合、治疗伤势；失败损坏这枚配件。' },
] as const;
export const MOON_GUIDANCE = { cash: 100, actions: 1 } as const;
export const MOON_HOME = 'backlund:moon-shore-office';
export const MOON_WORKSHOP = 'backlund:moon-preparation-room';
export const MOON_SUPPLIER = 'backlund:moon-material-handoff';
export const MOON_ARCHIVE = 'backlund:moon-custody-archive';
export const MOON_VAULT = 'backlund:moon-sealed-room';
export const MOON_STATIONS = [
  { id: 'NORTH', title: '北堤渡口', location: 'backlund:moon-north-ferry', lampId: 'MN-NORTH-LAMP', boatId: 'MN-NORTH-BOAT', crew: { id: 'MN-CREW-NORTH', name: '埃莉斯·沃德', age: 42 }, passengers: [{ id: 'MN-ADULT-1', name: '米拉·赫恩', age: 34 }, { id: 'MN-ADULT-2', name: '西蒙·里德', age: 51 }], incident: 'DAMAGE' },
  { id: 'REED', title: '芦湾码头', location: 'backlund:moon-reed-landing', lampId: 'MN-REED-LAMP', boatId: 'MN-REED-BOAT', crew: { id: 'MN-CREW-REED', name: '乔治·佩恩', age: 39 }, passengers: [{ id: 'MN-ADULT-3', name: '诺拉·戴尔', age: 28 }, { id: 'MN-ADULT-4', name: '埃德加·莫斯', age: 46 }], incident: 'PERMISSION' },
  { id: 'EAST', title: '东岸小栈', location: 'backlund:moon-east-quay', lampId: 'MN-EAST-LAMP', boatId: 'MN-EAST-BOAT', crew: { id: 'MN-CREW-EAST', name: '露西·费恩', age: 37 }, passengers: [{ id: 'MN-ADULT-5', name: '赫莲·布鲁克', age: 31 }, { id: 'MN-ADULT-6', name: '奥斯卡·贝尔', age: 57 }], incident: 'NONE' },
] as const;
export type MoonStationId = typeof MOON_STATIONS[number]['id'];
export const MOON_CITY_PLACES = [
  { id: MOON_HOME, title: '岸边事务所' }, ...MOON_STATIONS.map(s => ({ id: s.location, title: s.title })),
  { id: MOON_SUPPLIER, title: '原物交接处' }, { id: MOON_ARCHIVE, title: '银湾保管档案室' },
  { id: MOON_VAULT, title: '银湾封存室' }, { id: MOON_WORKSHOP, title: '岸边封闭调配室' },
];
export const MOON_STORY = '三处旧渡口仍使用原灯、原船和原班船员。六名自愿的成年乘客各有要去的彼岸；先走查设备和普通退路，再按实际夜航时刻修整、接送并核对到达。';
export const MOON_GOAL = '完成三站的六次真实到达，核清三份原特性与同一唯一性，再为本瓶付费准备并独立决定是否服药。';
export const MOON_RISK = '服药失败会实际损伤健康、精神并增加污染，可能死亡。准备不保证成功；幸存者须在原地封存残留，隔周付费回收，另购普通承载物与重新准备。';
export const MOON_CONSUMPTION = { difficulty: 58, healthMinimum: 80, mindMinimum: 70, spirituality: 30, failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const MOON_PROMOTION_STABILITY = { actions: 1, cash: 100, spirituality: 12, mind: 8, effectiveBonus: 40 } as const;
export const MOON_EPILOGUE_BONUS = 30;
export const MOON_SPIRITUALITY_CAP = 150;
export const MOON_VACANCY_DATE = { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 8 } as const;
export const MOON_UNIQUENESS_ID = 'moon-uniqueness:original-1353';
export const MOON_UNIQUENESS_SEAL = 'SILVER-BAY-MOON-ONE';
export const MOON_FUTURE_BRANCH = {
  id: 'silver-bay-future-1353', predecessorId: 'moon-future-predecessor:selene-voss', predecessorName: '塞琳·沃斯',
  custodianId: 'moon-custodian:ada-finch', custodianName: '艾达·芬奇',
  story: '这是未来已经分岔的一段经历：在这条人生中，曾容纳月亮唯一性的塞琳·沃斯于1353年1月8日银湾决裂中死亡，原身体已在现场确认死亡，唯一性从其遗体析出。她是此段经历中的前任，古老传说中的神明并未因此被宣告死亡。随后发生的交接只移动析出的同一原件。',
  records: [
    { id: 'MOON-VACANCY-1353', date: '1353-01-08', detail: '银湾现场的原身体死亡、原唯一性析出和容纳终止均已发生；原封签只对应这一件，没有仍在容纳的前任。' },
    { id: 'MOON-TRANSFER-01', date: '1353-01-09', detail: '成年见证人伊文·克雷与蕾娜·斯通共同见证，同一原件封入银湾一号封匣，由从未容纳的艾达·芬奇接管。' },
    { id: 'MOON-DELIVERY-01', date: null, detail: '交付时当场再核同一封签、实际空位及唯一保管人；存在另一在位者或第二件原物即不得交付。' },
  ],
} as const;
