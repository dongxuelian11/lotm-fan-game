/** Stage229 finite greenhouse mechanics are authored game design. Canon establishes
 * Mother S0 / Nature Walker S1, uniqueness and three S1 characteristics; a full
 * S0 formula, ritual and these numerical new abilities are not established. */
export const MOTHER_ORIGINAL_IDS = ['nature-walker-potion-1', 'nature-walker-potion-2', 'nature-walker-potion-3'] as const;
export const MOTHER_ABILITY_IDS = ['mother.s0.short-vitality-maintenance', 'mother.s0.existing-branch-support'] as const;
export const MOTHER_SAMPLE_IDS = ['CB3-LIVE-1', 'CB3-LIVE-2'] as const;
export const MOTHER_PERSON_IDS = ['CB3-ADA', 'CB3-LENA'] as const;
export type MotherOriginalId = typeof MOTHER_ORIGINAL_IDS[number];
export type MotherAbilityId = typeof MOTHER_ABILITY_IDS[number];
export type MotherSampleId = typeof MOTHER_SAMPLE_IDS[number];
export type MotherPersonId = typeof MOTHER_PERSON_IDS[number];
export type MotherPosition = 'ORIGINAL_ENTRY' | 'OUTSIDE' | 'GREENHOUSE';
export type MotherConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export const MOTHER_PLACES = [
 { id: 'MO229-NURSERY-ENTRY', title: '原苗圃门口' },
 { id: 'MO229-NURSERY-OUTSIDE', title: '原苗圃室外' },
 { id: 'MO229-GREENHOUSE', title: '风损温室' },
 { id: 'MO229-RECOVERY', title: '原成品交接处' },
 { id: 'MO229-VAULT', title: '唯一性保管室' },
 { id: 'MO229-WORKSHOP', title: '封闭调配室' },
] as const;
export type MotherPlaceId = typeof MOTHER_PLACES[number]['id'];
export const MOTHER_MIN_NATURE_WALKER_WEEKS = 12;
export const MOTHER_SPIRITUALITY_CAP = 150;
export const MOTHER_GUIDANCE = { actions: 1, cash: 100 } as const;
export const MOTHER_PRICES = { greenhouseRepair: 120, supplies: 40, residueInspection: 120, originalRecovery: 30, uniquenessVerification: 100, uniquenessHandover: 150, carrier: 50, compose: 40, sealedRecovery: 60 } as const;
export const MOTHER_PREPARATION = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
/** The real source will24 gives70% after the paid, single-bottle +40 preparation. */
export const MOTHER_CONSUMPTION = { difficulty: 54, preparedBonus: 40, actions: 1, spirituality: 30, successMind: 12, minimumHealth: 80, minimumMind: 70, maximumPollution: 0, failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const MOTHER_PRACTICE_COSTS = {
 maintenance: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 14, water: 1, ordinaryVitalityLoss: 1, seconds: 10 },
 branch: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 14, water: 1, vitality: 2, ordinaryDeflectionMillimetres: 3, supportedDeflectionMillimetres: 1 },
} as const;
/** New independent background evidence; all three dates precede the actual
 * first Nature Walker guidance at1353-07-14. Never edits predecessor receipts. */
export const MOTHER_SUCCESSION = {
 branchId: 'mother-independent-original-1353', formerOwnerId: 'MO229-PRIOR-OWNER', formerOwnerAlive: false,
 death: { id: 'MO229-PRIOR-DEATH', date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 6, day: 20 } },
 separation: { id: 'MO229-SEPARATION', date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 6, day: 20 } },
 custody: { id: 'MO229-UNIQUENESS-CUSTODY', date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 6, day: 21 }, custodianId: 'MO229-CUSTODIAN', custodyOnly: true },
 originalIds: [...MOTHER_ORIGINAL_IDS], uniquenessId: 'MO229-UNIQUENESS', objectCount: 1, currentIncumbent: null,
} as const;
export const MOTHER_ABILITIES = [
 { id: MOTHER_ABILITY_IDS[0], label: '单株短时活性维持', description: '本次许可有效、亲见同一原活苗时，实付1行动、12灵性与5精神，开启20秒一次短窗。实际检修另耗一份实购水并作知识检定：成功维持该株这10秒的当前活性，失败仍损1活性与2精神。没有补回已失活性；移位、换目标、撤回、停止或到期失效。普通供水同样可以完成检修。' },
 { id: MOTHER_ABILITY_IDS[1], label: '原活枝有限支撑', description: '接触眼前同一植株既有活枝，实付1行动、12灵性与5精神，开启20秒一次短窗。实际应用耗一份实购水和原苗2活性，作意志检定，仅让这段原枝在一次轻小检修中偏移由3毫米降至1毫米；失败仍偏移3毫米并损2精神。普通木楔承接，不能长出新枝、复制植物、承托建筑或复活枯样。松手、移位、撤回、换目标或到期立即结束。' },
] as const;
export const MOTHER_STORY = '艾达的温室遭风损，原有框架需要有价修复。46岁的艾达与39岁的莉娜仍持有各自原苗，旧记录许可只限记录。必须分别重新询问本次照料、短距搬运与归还；从两人当前实际持有处亲领同一两株原活苗，沿四米普通路线搬入、供水和楔撑，再原路各自亲还。原100克枯样继续死亡，旧根垫与全部已耗材料保持原状。';
export const MOTHER_GOAL = '先真实诊疗、休养并维持工作生活，核清本体内的一份自然行者特性，实购另外两份原件与同一唯一性。完成风损温室普通维护及两苗原路归还后，成为自然行者满十二个真实周，才可付费稳定准备并独立决定晋升。';
export const MOTHER_RISK = '充分准备也不保证成功，机会随当前意志和本瓶准备变化。失败消耗原成本并留下真实重伤、精神损耗与污染；严重排异可致死亡。存活失败须封存、真实等待七日并付费回收同一残余，有限载体不能增加第四份特性。';
export const MOTHER_STOP_TEXT = '停止短窗、松开原枝，沿已检查普通路线携实际借用原苗退出，当面交回原持有人并如实报告；费用、耗水、木楔、活性损耗、伤势和实际路程保留。';
