/** Stage222 bounded archive movement and two finite information applications.
 * Parent integration owns validation, reducers, projection, fixtures and tests.
 * Canon anchors: S1 name L128225; ordinary S0/recipe L236504 + L236639.
 * L242070–94 describes the anomalous Secret Sage, not a complete normal S0 kit.
 * Knowledge/power conversion already exists at S1 (L229395–97); information form
 * already exists in the local S2 history. These are two bounded S0 applications.
 * Particular route, ritual, auxiliaries, costs and numbers are original gameplay.
 */
export const HERMIT_ORIGINAL_IDS = ['knowledge-emperor-potion-1', 'knowledge-emperor-potion-2', 'knowledge-emperor-potion-3'] as const;
export const HERMIT_ABILITY_IDS = ['hermit.s0.finite-self-information', 'hermit.s0.contact-readline-transfer'] as const;
export type HermitOriginalId = typeof HERMIT_ORIGINAL_IDS[number];
export type HermitAbilityId = typeof HERMIT_ABILITY_IDS[number];
export type HermitPosition = 'OUTSIDE' | 'ENTRY' | 'MIDPOINT' | 'DESTINATION';
export type HermitArchivistId = 'HM222-MIRA' | 'HM222-NILES';
export type HermitSegmentId = 'A' | 'B';
export type HermitConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';

export interface HermitArchivist {
  id: HermitArchivistId; name: string; age: number; alive: boolean; health: number; energy: number;
  position: HermitPosition; walkedMetres: number; consent: HermitConsent; permissionVersion: number;
  arrivalEventId: string | null; permissionEventId: string | null;
  passage: { a: string | null; b: string | null; sideExit: string | null };
}
export interface HermitReading {
  recordId: 'PM3-BOUNDARY-RECORD'; ownerPermissionEventId: string; permissionVersion: number;
  recordVersion: number; readEventId: string; readAt: number; position: HermitPosition;
  /** A finite explicitly read line; no unknown text inferred from the legacy record. */
  actualText: string;
}
export interface HermitWindow {
  kind: 'PERSONAL_FORM' | 'READLINE'; createdAt: number; expiresAt: number;
  startPosition: HermitPosition; permissionVersion: number; targetVersion: number;
  readingEventId: string | null; recordId: 'PM3-BOUNDARY-RECORD' | null; sealId: string | null;
}
export interface HermitCustody {
  recordId: 'PM3-BOUNDARY-RECORD'; quantity: 1; ownerId: 'PM3-IRIS';
  holder: 'OWNER' | HermitArchivistId | 'LOCKED_BOX'; position: HermitPosition;
  handoverEventId: string | null; receivedEventId: string | null; returnEventId: string | null;
  boxId: 'HM222-ARCHIVE-BOX'; sealed: boolean;
}
export interface HermitRecovery {
  originalId: HermitOriginalId; failedConsumptionRevision: number | null;
  holder: 'UNLOCATED_REMNANT' | 'LOCATED' | 'SEALED_REMNANT' | 'PLAYER' | 'COMPOUND' | 'EMBODIED' | 'FUSED' | 'DEATH_REMAINS';
  permissionEventId: string | null; investigationEventId: string | null;
  sealedEventId: string | null; sealedWeek: number | null; recoveredEventId: string | null;
}
export type HermitCandidateCommand =
  | { type: 'LEARN_GUIDANCE' | 'WORK' | 'REST' | 'CLINIC' | 'NEXT_WEEK' }
  | { type: 'ASK_OWNER' | 'WITHDRAW_OWNER' | 'REGISTER_MOVE_LINE' | 'READ_RECORD' | 'BUY_SEAL' | 'HANDOVER_RECORD' | 'RECEIVE_RECORD' | 'RETURN_RECORD' }
  | { type: 'ASK_ARCHIVIST' | 'WITHDRAW_ARCHIVIST' | 'ARRIVE_ARCHIVIST' | 'EXIT_ARCHIVIST'; archivistId: HermitArchivistId }
  | { type: 'INSPECT_SEGMENT' | 'OPEN_SEGMENT' | 'CLOSE_SEGMENT'; segment: HermitSegmentId }
  | { type: 'CROSS'; actorId: 'PLAYER' | HermitArchivistId; segment: HermitSegmentId }
  | { type: 'ASK_RECOVERY_PERMISSION' | 'INVESTIGATE_REMAINS' | 'SEAL_ORIGINAL' | 'RECOVER_ORIGINAL'; originalId: HermitOriginalId }
  | { type: 'VERIFY_UNIQUENESS' | 'ACQUIRE_UNIQUENESS' | 'BUY_CARRIER' | 'COMPOSE' | 'REPORT_PASSAGE' }
  | { type: 'STABILIZE_PROMOTION' | 'SEAL_REMAINS' | 'RECOVER_REMAINS'; compoundId: string }
  | { type: 'CONSUME'; compoundId: string; confirmed: true }
  | { type: 'ENTER_INFORMATION_FORM' | 'CROSS_INFORMATION_ROUTE' | 'RECONSTRUCT' | 'TOUCH_READ_RECORD' | 'TRANSFER_READ_LINE' | 'END_CONTACT' | 'ORDINARY_COPY_SEAL' | 'CLEAR_SHUTTER' | 'WALK_SIDE_PATH' | 'REPORT_RETURN' };

export const HERMIT_PLACES = [
  { id: 'HM222-ARCHIVE-OUTSIDE', title: '档案馆外' },
  { id: 'HM222-RECEPTION', title: '搬迁接待处' },
  { id: 'HM222-PASSAGE', title: '两段短搬迁廊' },
  { id: 'HM222-RECOVERY', title: '旧服药场地' },
  { id: 'HM222-VAULT', title: '封存保管室' },
  { id: 'HM222-WORKSHOP', title: '封闭调配室' },
] as const;
export const HERMIT_ARCHIVISTS = [
  { id: 'HM222-MIRA', name: '米拉', age: 38 },
  { id: 'HM222-NILES', name: '奈尔斯', age: 41 },
] as const;
export const HERMIT_SEGMENTS = [
  { id: 'A', from: 'ENTRY', to: 'MIDPOINT', metres: 3 },
  { id: 'B', from: 'MIDPOINT', to: 'DESTINATION', metres: 3 },
] as const;
export const HERMIT_GUIDANCE = { actions: 1, cash: 100 } as const;
export const HERMIT_MIN_KNOWLEDGE_EMPEROR_WEEKS = 12;
export const HERMIT_SPIRITUALITY_CAP = 150;
/** Written now by the consenting owner; never retrofitted into an old journal. */
export const HERMIT_MOVE_LINE = '档案归艾瑞丝；侧廊交接';
export const HERMIT_PRICES = {
  archivistService: 20, seal: 20, shutterKit: 30, residueInspection: 120, originalRecovery: 30,
  uniquenessVerification: 100, uniquenessHandover: 150, carrier: 50, compose: 40, sealedRecovery: 60,
} as const;
export const HERMIT_PREPARATION = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
export const HERMIT_CONSUMPTION = {
  difficulty: 57, preparedBonus: 40, actions: 1, spirituality: 30, successMind: 12,
  failureHealth: 45, failureMind: 40, failurePollution: 35,
  greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70,
} as const;
export const HERMIT_PRACTICE_COSTS = {
  informationForm: { actions: 1, spirituality: 18, mind: 6, energy: 10, seconds: 10, metres: 3 },
  readline: { actions: 1, spirituality: 12, mind: 5, energy: 3, seconds: 15, maxCharacters: 16, sealUses: 1 },
} as const;

/** Internal independent branch only. No changes to the old acquisition journals.
 * Every date precedes the actual first Knowledge Emperor guidance on 1352-06-10.
 * Old failed consumption does NOT establish recovered inventory or a known location.
 */
export const HERMIT_SUCCESSION = {
  branchId: 'hermit-independent-original-1352', formerOwnerId: 'HM222-PRIOR-OWNER', formerOwnerAlive: false,
  death: { id: 'HM222-PRIOR-DEATH', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 5, day: 30 } },
  separation: { id: 'HM222-SEPARATION', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 5, day: 30 } },
  custody: { id: 'HM222-UNIQUENESS-CUSTODY', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 6, day: 1 }, custodianId: 'HM222-MIRA', custodyOnly: true },
  originalIds: [...HERMIT_ORIGINAL_IDS], uniquenessId: 'HM222-UNIQUENESS', objectCount: 1, currentIncumbent: null,
} as const;

export const HERMIT_ABILITIES = [
  {
    id: 'hermit.s0.finite-self-information', label: '有限信息行走',
    description: '花1行动、18灵性、6精神与10精力，让本人短暂化为信息。只沿亲自查验且连通的三米检修缝通过一次，最多10秒；封箱、档页、封签和其他物品由留在原地的人保管。须在已查验的空位重新凝聚，完成后才增长掌握。通路封闭、遮断、撤回或到期即停止前进，并在当前有效停靠位凝聚；不穿越未经查验的屏障，不治伤，也不带走任何人的灵魂。',
  },
  {
    id: 'hermit.s0.contact-readline-transfer', label: '接触已读转录',
    description: '获得当前许可，亲手读过同一记录后，持续触碰原页与一枚实购空白封签。花1行动、12灵性、5精神与3精力，在15秒内将亲自读到的不超过16字转录到这枚封签，实际写成才增长掌握；封签随即用尽。松手、换页、移动、遮挡、撤回或到期即失效。原页仍是同一件实物，未读、模糊和缺失文字仍未知，不能复制纸张或凭空生成知识。',
  },
] as const;

export const HERMIT_STORY = '米拉与奈尔斯要把艾瑞丝保管的一份记录送过两段各三米的搬迁廊。艾瑞丝的许可、两人的到场与每一次接交都须当面确认，档案始终只有一份。搬迁结束后，一道卡住的检修挡板需要处理；你可以检查短缝、转录已读封签，也可以用工具清障、手写封签。最后由实际持箱的人沿普通侧廊把封箱带出去。';
export const HERMIT_GOAL = '查明两次旧服药留下的特性去向，核对唯一性的保管链；第三份特性仍在你体内。完成两位档案员的实际通行、接交和退出，成为知识皇帝满十二个实际周后，自行决定是否饮用。';
export const HERMIT_RISK = '成功率取决于当前意志与这一次实付的稳定准备。失败保留费用、重伤和污染，严重失败可能死亡。幸存者须封存同一份残余，隔周付费回收后再配制；已耗封签不会恢复，也不会多出第四份特性。';
export const HERMIT_STOP_TEXT = '先停止信息短窗并凝聚为实体，结束接触；核对同一记录、封签与封箱的位置，再让仍在廊内的人沿已检查的普通侧路离开。退出不会退回已经支付的费用，也不会代替记录接收人的当面签收。';
