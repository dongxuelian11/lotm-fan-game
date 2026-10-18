/** R218 original finite incident. These costs, distances and timings are game
 * balance, not canonical hard numbers or a complete Door authority. The owning
 * chapter alone authenticates the real living Star Key successor's promotion. */
export const DOOR_EPILOGUE_POLICY = {
  escape: { actions: 1, cashCost: 8, spirituality: 14, mind: 8, seconds: 1,
    windowSeconds: 3, difficulty: 50, ability: 'will', masteryGain: 8 },
  seal: { actions: 1, cashCost: 6, spirituality: 12, mind: 6, seconds: 2,
    windowSeconds: 20, difficulty: 45, ability: 'knowledge', masteryGain: 8 },
  modifier: 30, modifierSource: '已实查的近处单一受力目标',
  observeSeconds: 5, approachSeconds: 8, prepareSeconds: 2, releaseSeconds: 3,
  observeExitSeconds: 2, stopSeconds: 1, openExitSeconds: 1, waitSeconds: 25,
  springDelaySeconds: 4, springHealthLoss: 8,
  exitDelaySeconds: 10, exitPlayerHealthLoss: 4, exitWorkerHealthLoss: 8,
  exitTrolleyWear: 10, exitDoorWear: 12, heldDoorWear: 2,
  isolateSeconds: 60, brakeWear: 6, loadSeconds: 8, sideMetres: 24,
  sideSeconds: 24, reportSeconds: 5,
} as const;

export const DOOR_EPILOGUE_SCENE = {
  id: 'door-original-hoist-shed', location: 'DR0-HOIST-SHED',
  title: '吊运棚里的一次解困', workerId: 'DR0-SHED-ADA-WREN', workerName: '艾达·雷恩',
  workerAge: 34, workerHealth: 96, workerInjury: '本次卡滞留下的手臂挫伤，尚未处理',
  trolleyId: 'DR0-SHED-TOOL-TROLLEY', trolleyCondition: 84,
  latchId: 'DR0-SHED-SPRING-LATCH', brakeId: 'DR0-SHED-HAND-BRAKE',
  counterweightId: 'DR0-SHED-COUNTERWEIGHT', exitId: 'DR0-SHED-MACHINE-EXIT',
  exitHandleId: 'DR0-SHED-EXIT-CONTROL-ROD',
  exitCondition: 78, focusId: 'DR0-SHED-FOCUS-INSERT', sealId: 'DR0-SHED-SEAL-STRIP',
  springImpactId: 'DR0-SHED-SPRING-REBOUND', exitImpactId: 'DR0-SHED-EXIT-THRUST',
  ordinaryExitId: 'DR0-SHED-SIDE-PASSAGE', workingPosition: 8,
  story: '吊运棚内，艾达的衣袖被同一辆工具车的弹簧卡扣夹住。她在八米维修位请求协助；手臂已有挫伤。机房门后还有一块未落下的原配重，二十四米侧道通往棚外。可先用原手刹卸力，也可尝试近处的有限技巧。',
} as const;
