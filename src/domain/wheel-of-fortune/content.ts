/** Stage226 original gameplay. Canon gives the S0 principle: remove interference,
 * experience and seek the unforecastable precise opportunity. The reusable exact
 * implementation criterion and auxiliary formula are unknown. This limited,
 * witnessed meeting of independent irreversible choices
 * is an authored criterion, not a claim that a draw, flood or uniqueness alone
 * is the canonical ritual. No general fate/contract or global probability engine. */
export const WHEEL_OF_FORTUNE_ORIGINAL_IDS = ['mercury-snake-potion-1', 'mercury-snake-potion-2', 'mercury-snake-potion-3'] as const;
export const WHEEL_OF_FORTUNE_ABILITY_IDS = ['wheel.s0.impact-buffer', 'wheel.s0.short-return'] as const;
export type WheelOfFortuneOriginalId = typeof WHEEL_OF_FORTUNE_ORIGINAL_IDS[number];
export type WheelOfFortuneAbilityId = typeof WHEEL_OF_FORTUNE_ABILITY_IDS[number];
export type WheelOfFortunePosition = 'ORIGINAL_ENTRY' | 'OUTSIDE' | 'ENTRY' | 'THREE' | 'NORTH_DEPOT' | 'SOUTH_DEPOT';
export type WheelOfFortuneWorkerId = 'WF226-MARA' | 'WF226-OSWIN' | 'WF226-IRENE' | 'WF226-HUGO' | 'WF226-NORA' | 'WF226-ELIAS';
export type WheelOfFortuneDestination = 'NORTH_DEPOT' | 'SOUTH_DEPOT';
export type WheelOfFortuneConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export const WHEEL_OF_FORTUNE_PLACES = [
 { id: 'WF226-COURT-ENTRY', title: '原机械工坊门口' }, { id: 'WF226-COURT-OUTSIDE', title: '原机械工坊外' },
 { id: 'WF226-JUNCTION', title: '有限岔路交接站' }, { id: 'WF226-RECOVERY', title: '原成品交接处' },
 { id: 'WF226-VAULT', title: '唯一性保管室' }, { id: 'WF226-WORKSHOP', title: '封闭调配室' },
] as const;
export type WheelOfFortunePlaceId = typeof WHEEL_OF_FORTUNE_PLACES[number]['id'];
/** These six adults and three independent commissions exist before guidance.
 * Advancing commission never reuses or clears a previous person's decision. */
export const WHEEL_OF_FORTUNE_COMMISSIONS = [
 { id: 'WF226-COMMISSION-1', title: '印刷铺迁址与修表材料交接', workers: [{ id: 'WF226-MARA', name: '玛拉', age: 36, purpose: '关闭旧印刷柜台，携原迁址凭证到新铺登记' }, { id: 'WF226-OSWIN', name: '卢卡斯', age: 44, purpose: '交出旧修表材料，去新作坊任职' }] },
 { id: 'WF226-COMMISSION-2', title: '染坊退租与织工转岗交接', workers: [{ id: 'WF226-IRENE', name: '艾琳', age: 32, purpose: '交还旧染坊租据，携原样布去新店' }, { id: 'WF226-HUGO', name: '雨果', age: 47, purpose: '交出旧工位工具凭据，赴新织坊报到' }] },
 { id: 'WF226-COMMISSION-3', title: '装订铺转让与木工迁居交接', workers: [{ id: 'WF226-NORA', name: '诺拉', age: 41, purpose: '交出旧装订铺交接凭证，赴新街铺面' }, { id: 'WF226-ELIAS', name: '伊莱亚斯', age: 38, purpose: '交出旧木工间钥匙凭证，携原工具到新工位' }] },
] as const;
export const WHEEL_OF_FORTUNE_WORKERS = WHEEL_OF_FORTUNE_COMMISSIONS.flatMap(x => [...x.workers]);
export const WHEEL_OF_FORTUNE_EXIT_METRES = { ORIGINAL_ENTRY: 4, OUTSIDE: 0, ENTRY: 2, THREE: 5, NORTH_DEPOT: 5, SOUTH_DEPOT: 5 } as const;
export const WHEEL_OF_FORTUNE_MIN_MERCURY_SNAKE_WEEKS = 12;
export const WHEEL_OF_FORTUNE_SPIRITUALITY_CAP = 150;
export const WHEEL_OF_FORTUNE_GUIDANCE = { actions: 1, cash: 20 } as const;
export const WHEEL_OF_FORTUNE_PRICES = { workerService: 20, ordinaryTools: 30, residueInspection: 120, originalRecovery: 30, uniquenessVerification: 100, uniquenessHandover: 150, carrier: 50, compose: 40, sealedRecovery: 60 } as const;
export const WHEEL_OF_FORTUNE_PREPARATION = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
/** Source will24 gives70% only after this actual +40 paid preparation. */
export const WHEEL_OF_FORTUNE_CONSUMPTION = { difficulty: 54, preparedBonus: 40, actions: 1, spirituality: 30, successMind: 12, minimumHealth: 80, minimumMind: 70, maximumPollution: 0, failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
/** Dynamic source perception26/difficulty14 and will24/difficulty12 give74%. */
export const WHEEL_OF_FORTUNE_PRACTICE_COSTS = {
 impactBuffer: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 14, impact: 8, reducedImpact: 3 },
 shortReturn: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 12, metres: 3 },
 report: { actions: 1, seconds: 30 },
} as const;
/** Independent future succession, explicitly one item and no duplicate holder.
 * These original dates precede actual first guidance1352-11-11. */
export const WHEEL_OF_FORTUNE_SUCCESSION = {
 branchId: 'wheel-independent-future-1352', formerOwnerId: 'WF226-PRIOR-OWNER', formerOwnerAlive: false,
 death: { id: 'WF226-PRIOR-DEATH', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 20 } },
 separation: { id: 'WF226-SEPARATION', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 20 } },
 custody: { id: 'WF226-UNIQUENESS-CUSTODY', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 21 }, custodianId: 'WF226-CUSTODIAN', custodyOnly: true },
 originalIds: [...WHEEL_OF_FORTUNE_ORIGINAL_IDS], uniquenessId: 'WF226-UNIQUENESS', objectCount: 1, currentIncumbent: null,
} as const;
export const WHEEL_OF_FORTUNE_ABILITIES = [
 { id: WHEEL_OF_FORTUNE_ABILITY_IDS[0], label: '有限冲击缓冲', description: '亲见眼前同一原箱件及其下一次实际释放的载荷后，支付1行动、12灵性、5精神开启20秒单次短窗。真实放下箱件时按当前感知检定，成功只把本人这次8健康冲击减至3；失败承受8并额外损2精神。物件实际释放且不复位；普通绳索和承重支撑始终可用。移动、停止、撤回、目标改变或到期均失效。' },
 { id: WHEEL_OF_FORTUNE_ABILITY_IDS[1], label: '本人短距回返', description: '在入口记录同一活着本人的当前位置，支付1行动、12灵性、5精神建立20秒短前态联系。本人必须先真实走出三米，再按当前意志检定尝试回到记录位置；失败原地保留，可普通走回。只返回位置，不返回健康、精神、灵性、物件、时间、费用或死亡。一次联系只用一次，停止、遮挡或到期即失效。' },
] as const;
export const WHEEL_OF_FORTUNE_STORY = '先核对岔路交接站的原凭证、普通支撑与侧路。备妥同一成药后，两位成年人各自选择新去处，亲手交出同一凭证与货物，随后真实走到新目的地。准确契机无法提前占卜、预言或以其他办法锁定；只能排除干扰，亲身经历并继续寻觅。活着失败后仅余两项事先登记的独立委托，旧人物选择与费用永远保留。';
export const WHEEL_OF_FORTUNE_GOAL = '实际取得三份原特性与同一唯一性，先备妥成药与本次准备，再见证两位成年人不可回退的交接和新去处；晋1满十二周后，在机会当周独立决定服药。';
export const WHEEL_OF_FORTUNE_RISK = '准确契机不能通过占卜、预言或预定手续提前锁定，必须在实际经历中察觉。准备后的实际成功率仍随当前意志变化；失败保留费用、伤势、污染和既成人物决定，严重失败可能死亡。同一残余须封存七日并付费回收，最多三只载体和三项独立委托。';
export const WHEEL_OF_FORTUNE_STOP_TEXT = '结束有限短窗，沿普通侧路步行退出。既有人物决定、交接、物件位置、费用与伤势全部保留。';
