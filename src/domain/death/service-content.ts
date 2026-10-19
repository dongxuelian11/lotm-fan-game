import type { DeathServiceId } from './types.js';

/** Only these two ordinary, finite jobs count. No old S1 person or object is moved here. */
export const DEATH_SERVICES = [
  { id: 'residue-sealing', location: 'DE0-RESIDUE-ROOM', title: '封存保管室残余', price: 4, actions: 2,
    residentId: 'DE0-RESIDUE-KEEPER', supplyId: 'DE0-RESIDUE-SEAL-1',
    apparatusIds: ['DE0-RESIDUE-CONTAINER', 'DE0-RESIDUE-LID', 'DE0-RESIDUE-SCREEN'],
    summary: '先询问保管人并观察传播线，买下一份封材，手动屏蔽、合盖、封存、归还同一容器，最后当面复核。' },
  { id: 'old-wharf-exit', location: 'DE0-OLD-WHARF', title: '护送两名码头工人退出', price: 4, actions: 2,
    residentIds: ['DE0-WHARF-WORKER-1', 'DE0-WHARF-WORKER-2'], supplyId: 'DE0-WHARF-ROPE-1',
    apparatusIds: ['DE0-WHARF-BRIDGE', 'DE0-WHARF-ROPE-1'],
    summary: '询问两名工人的意愿，实查桥与两端，买下一段绳、布绳扶桥，再分别陪两人走完普通退出路线并交接。' },
] as const satisfies readonly { id: DeathServiceId; location: string; title: string; price: number; actions: number;
  residentId?: string; residentIds?: readonly string[]; supplyId: string; apparatusIds: readonly string[]; summary: string }[];

/** New, finite adults, never historical Nora/Alden or substitute souls. */
export const DEATH_RESIDENT_IDENTITIES = {
  residueCustodian: { id: 'DE0-RESIDUE-KEEPER', bodyId: 'DE0-RESIDUE-KEEPER-BODY', name: '街区保管人', adult: true, age: 46, health: 100, energy: 90 },
  firstWorker: { id: 'DE0-WHARF-WORKER-1', bodyId: 'DE0-WHARF-WORKER-1-BODY', name: '码头工人埃文', adult: true, age: 34, health: 100, energy: 80 },
  secondWorker: { id: 'DE0-WHARF-WORKER-2', bodyId: 'DE0-WHARF-WORKER-2-BODY', name: '码头工人西蒙', adult: true, age: 41, health: 100, energy: 76 },
  legacyCustodian: { id: 'DE0-S1-RESIDUE-CUSTODIAN', bodyId: 'DE0-S1-RESIDUE-CUSTODIAN-BODY', name: '原服药支持室保管人', adult: true },
} as const;

/** Parent-authorized fixed ORIGINAL candidate scenes. This is authored game
 * content, not a claim about canonical abilities or a successful playthrough.
 * A metre of ordinary walking takes one actual second; simultaneous movements
 * (player + escorted body, or carried vessel + its lid) share that interval. */
export const DEATH_SERVICE_SCENE = {
  residue: {
    location: 'DE0-RESIDUE-ROOM', entrancePosition: 0, workbenchPosition: 6,
    keeperPosition: 0, returnedPosition: 0, total: 4, initiallyExposed: 2,
    initiallyContained: 2, initialDissipated: 0, supplyPrice: 4,
    containerOwner: 'DE0-RESIDUE-KEEPER', sealStock: 1,
    permissionSeconds: 60, surveySeconds: 60, observationSeconds: 45,
    screenSeconds: 120, lidSeconds: 60, sealSeconds: 90,
    handoverSeconds: 45, reviewSeconds: 60,
    description: '同一浅口容器中只有四份无智能残余，两份处于盖下隔仓、两份处于开口承接槽。原盖盖住整个容器；竖起原屏、合原盖后四份都在其中，不产生新的残余或灵魂。容器和盖归保管人，屏留在六米外原工作台。',
  },
  wharf: {
    location: 'DE0-OLD-WHARF', unsafePosition: 0, safePosition: 12,
    unsafeId: 'DE0-WHARF-WORK-DECK', safeId: 'DE0-WHARF-SHORE',
    bridgeMetres: 12, initialBridgeCondition: 60, initialRopeCondition: 100,
    ropeMetres: 16, anchorMetresPerEnd: 2, supplyPrice: 4, ropeStock: 1,
    soloBridgeWear: 1, soloRopeWear: 1, escortedBridgeWear: 2, escortedRopeWear: 4,
    ropeLayingWear: 2, ropeTensionWear: 2, minimumSoloBridgeCondition: 20,
    minimumEscortBridgeCondition: 40, minimumEscortRopeCondition: 20,
    firstWorkerEnergyCost: 6, secondWorkerEnergyCost: 8,
    secondWorkerInjury: 'DE0-WHARF-WORKER-2:OLD-ANKLE-SPRAIN',
    permissionSeconds: 60, surveySeconds: 90, purchaseSeconds: 30,
    layingSeconds: 120, supportSeconds: 120, escortHandlingSeconds: 30, reviewSeconds: 60,
    retreatPathId: 'DE0-WHARF-SHORE-FOOTPATH', retreatMetres: 18,
    description: '普通木桥十二米。唯一十六米绳段铺过桥面，两端各用两米系固；旧桥仍保留实际磨损，拉紧绳子只增加支撑，不恢复木料。两人分别同意、分别步行过桥；西蒙原脚踝旧伤不会因护送消失。另有已存在的十八米岸边公共绕行道，器件损坏或同意撤回时本人仍能步行停工退场；这不算护送，不移动任何工人。',
  },
  stopSeconds: 5,
  initialWillingness: 'ALLOW',
  walkMetresPerSecond: 1,
  permissionIsVisitBound: true,
  noRandomCheck: true,
} as const;
/** Exactly two principal actions per job; all other physical substeps remain
 * real, separately receipted operations with their own elapsed time. */
export const DEATH_SERVICE_PRINCIPAL_ACTIONS = {
  'residue-sealing': [{ type: 'POSITION_SCREEN', actions: 1 }, { type: 'SEAL_CONTAINER', actions: 1 }],
  'old-wharf-exit': [{ type: 'ESCORT_WORKER', workerId: 'DE0-WHARF-WORKER-1', actions: 1 },
    { type: 'ESCORT_WORKER', workerId: 'DE0-WHARF-WORKER-2', actions: 1 }],
} as const;
export const DEATH_SERVICE_BOUNDARIES = {
  finiteResidueId: 'DE0-RESIDUE-1', propagationLineId: 'DE0-RESIDUE-LINE-1', intelligentResidue: false,
  ordinarySealing: true, sealSupplyCount: 1, ropeSupplyCount: 1, workerCount: 2,
  sharedPermissionAcrossVisits: false, completedReceiptsExpireByWeek: false,
  blockOnRefusal: true, blockOnAbsentCustodian: true, blockOnDamagedRope: true, blockOnBlockedBridge: true,
  fallback: 'STOP_AND_RETREAT',
} as const;
