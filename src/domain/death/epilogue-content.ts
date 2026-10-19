import type { DeathEpiloguePolicy } from './types.js';

/** Original game balance only. Full canonical S0 ritual and numeric costs are
 * unknown. Neither this incident nor its two finite checks claims to be one. */
export const DEATH_EPILOGUE_POLICY = {
  windowSeconds: 20, maximumCompanions: 1, maximumPropagationLines: 1, attemptsPerAbility: 1,
  passage: { actions: 0, cash: 0, spirituality: 10, mind: 4, seconds: 3,
    difficulty: 37, distanceMetres: 6, traverseSeconds: 6, energyCost: 3, masteryGain: 8 },
  barrier: { actions: 0, cash: 0, spirituality: 8, mind: 3, seconds: 3,
    difficulty: 37, propagationHealthCost: 4, masteryGain: 8 },
  ordinaryExit: { actions: 0, cash: 0, metres: 6, seconds: 6, energyCost: 2 },
} as const satisfies DeathEpiloguePolicy;

export const DEATH_EPILOGUE_SCENE = {
  id: 'death-original-wharf-aftershock', location: 'DE0-OLD-WHARF', roomLocation: 'DE0-RESIDUE-ROOM',
  title: '岸边转运架的一次余震',
  receivingRackId: 'DE0-WHARF-SHORE-TRANSFER-RACK',
  receivingPurpose: '把原封存罐从保管室送到岸边既有安全转运架，由已到岸的埃文接管，供后续正规保管转运。',
  startSummary: '接下同罐取送委托：最多往返3600米、步行3600秒，另有当面询问及装卸65秒；实际运输耗2精神，不用行动或现金。途中真实满七天仍结算生活费。拒绝交接时不擅取原罐。',
  playerCarryMind: 2, cityLegMetres: 1800, cityLegSeconds: 1800,
  receiverAskSeconds: 10, keeperAskSeconds: 30, loadingSeconds: 10, unloadingSeconds: 10, tideSeconds: 5,
  shorePosition: 12, clearPosition: 18,
  clearEndpointId: 'DE0-WHARF-UPPER-SHORE', ordinaryShorePathId: 'DE0-WHARF-SHORE-ROAD-6M',
  homeLocation: 'DE0-RECEPTION',
  tideCause: '独立涌潮牵动仍带实际旧磨损的原桥与已装原绳，岸端木料下沉使同一绳尾扫到转运架上的原罐；原盖倾斜，原已用封条撕开。',
  bridgeWear: 2, tideRopeWear: 3, castRopeWear: 2,
  finiteExposedPortions: 1, pulseDelaySeconds: 120,
  observeSeconds: 5, permissionSeconds: 5, surveySeconds: 8, propagationObservationSeconds: 5,
  lowerLidSeconds: 2, manualLidSeconds: 8, barrierApplySeconds: 2, stopSeconds: 1, reportSeconds: 5,
  castModifier: 20, castModifierSource: '实查近岸端点与同一有限目标',
  checkFormula: 'clamp(50 + 2 × (当前意志 + 20 − 37), 5, 95)',
  passageDescription: '仅带西蒙的同一身体走完已实查的六米近岸短途；一次有价开窗，二十秒内另行实际通过。',
  barrierDescription: '仅处理从原罐到西蒙原站位的一条已见传播线、一个有限脉冲；不生成、吸取或储存灵魂。',
  ordinaryDescription: '原盖可手动闭合，旧封条仍破损；本人可零行动、零现金走六米公共岸路，再沿一千八百米普通城路回接待处。原桥与十八米工作岸绕行道保持原几何，不把已到岸的人送回工作岸。',
} as const;
