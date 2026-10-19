/** Error219 original, finite escape scene. Distances, prices and timings are
 * local game balance, not universal Error authority or canonical hard limits. */
export const ERROR_ASCENT_EPILOGUE_POLICY = {
  theft: { actions: 1, cashCost: 0, spirituality: 14, mind: 6, seconds: 1,
    windowSeconds: 3, ability: 'will', difficulty: 45, modifier: 30,
    source: '亲见单一守卫尚未开始的短程移动', masteryGain: 8 },
  diversion: { actions: 1, cashCost: 0, spirituality: 12, mind: 6, seconds: 2,
    windowSeconds: 20, ability: 'perception', difficulty: 48, modifier: 25,
    source: '近处原联索连接的两个同型机械锁扣', masteryGain: 8 },
  observeSeconds: 2, approachSeconds: 4, leverSeconds: 1, releaseDelaySeconds: 5,
  mainExitSeconds: 5, sideEntrySeconds: 1, sideStairMetres: 24,
  stopSeconds: 1, waitSeconds: 21, reportSeconds: 1,
  guardPreparationSeconds: 4, guardAdvanceSeconds: 4, guardCutSeconds: 3,
  guardStrikeHealthLoss: 8, latchWear: 2, grilleWear: 3, exitWear: 3,
} as const;

export const ERROR_ASCENT_EPILOGUE_SCENE = {
  id: 'error-original-clocktower-escape', location: 'ER219-TOWER-EXIT-GALLERY',
  title: '钟塔出口的短短几秒', guardId: 'ER219-EXIT-GUARD-MAREK',
  guardName: '马雷克·肖', guardAge: 39, guardHealth: 92,
  movementId: 'ER219-GUARD-PENDING-ADVANCE', releaseId: 'ER219-EXIT-PENDING-RELEASE',
  exitId: 'ER219-SAME-OUTER-SHUTTER', grilleId: 'ER219-INNER-GRILLE',
  exitLatchId: 'ER219-OUTER-STEEL-CATCH', grilleLatchId: 'ER219-INNER-STEEL-CATCH',
  linkId: 'ER219-ORIGINAL-MAINTENANCE-CABLE', leverId: 'ER219-ORIGINAL-RELEASE-LEVER',
  knifeId: 'ER219-GUARD-ORIGINAL-KNIFE', batonId: 'ER219-GUARD-ORIGINAL-BATON',
  sideExitId: 'ER219-ORDINARY-SIDE-STAIR', mainExitId: 'ER219-SAME-MAIN-EXIT',
  guardStartMetres: -8, leverMetres: 4, grilleMetres: 2, exitMetres: 8,
  outsideMetres: 9, cableCutMetres: 1,
  story: '钟塔外廊的出口仍开着。新来的守卫马雷克在八米外准备冲向你，随后会用自己的小刀切断检修联索。四米处原扳杆经延时器连接外门锁扣，同一条旧联索又连着两米处的同型栅栏锁扣。可以利用这几秒走出去，并让原栅栏挡住追兵；旁边二十四米侧阶始终能普通撤离。',
} as const;
