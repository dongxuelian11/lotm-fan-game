import type { DoorJobDefinition, DoorJobId } from './service-types.js';

/** Three approved finite original jobs, each with its own people and objects. */
export const DOOR_JOBS: Readonly<Record<DoorJobId, DoorJobDefinition>> = {
  'ledger-threshold': {
    id: 'ledger-threshold', title: '修整账房门槛并交付原账箱', location: 'DR0-LEDGER-HOUSE',
    ends: { FROM: { id: 'DR0-LEDGER-DISPATCH', name: '账房前厅发件台' }, TO: { id: 'DR0-LEDGER-RECEIPT', name: '后室收件台' } },
    owner: { id: 'DR0-ADA', bodyId: 'DR0-ADA-BODY', name: '阿妲·芬', age: 39 },
    receiver: { id: 'DR0-NELL', bodyId: 'DR0-NELL-BODY', name: '内尔·肖', age: 45 },
    payload: { kind: 'CARGO', id: 'DR0-LEDGER-CHEST', name: '同一封闭账箱', ownerId: 'DR0-ADA' },
    apparatusId: 'DR0-LEDGER-THRESHOLD', oldPartId: 'DR0-LEDGER-SPLIT-STRIP',
    supplyId: 'DR0-LEDGER-STRIP-1', supplyName: '唯一新门槛嵌条',
    directMetres: 6, bypassId: 'DR0-LEDGER-SIDE-PASSAGE', bypassMetres: 18,
    pricePennies: 8, repair: 'FIT_THRESHOLD', transfer: 'CARRY_LEDGER',
    repairSeconds: 120, handlingSeconds: 30, initialCondition: 65,
    defect: '原门槛嵌条开裂翘起，不能安全携箱直过；侧廊一直可普通步行。',
    repairedDescription: '把同一裂条移到前厅一侧，装入已购新嵌条；旧门框仍是原门框，不恢复其条件值。',
  },
  'courtyard-stair': {
    id: 'courtyard-stair', title: '清出后阶并陪原搬运工到院门', location: 'DR0-COURTYARD-STAIR',
    ends: { FROM: { id: 'DR0-STAIR-LANDING', name: '后阶上方工作平台' }, TO: { id: 'DR0-COURTYARD-RECEIVING', name: '院门内接应处' } },
    owner: { id: 'DR0-IRENE', bodyId: 'DR0-IRENE-BODY', name: '艾琳·帕克', age: 50 },
    receiver: { id: 'DR0-OSCAR', bodyId: 'DR0-OSCAR-BODY', name: '奥斯卡·里德', age: 37 },
    payload: { kind: 'PERSON', id: 'DR0-BEN', bodyId: 'DR0-BEN-BODY', name: '本·沃德', age: 33 },
    apparatusId: 'DR0-COURTYARD-STEPS', oldPartId: 'DR0-STAIR-EMPTY-HANDCART',
    supplyId: 'DR0-STAIR-CHOCK-1', supplyName: '唯一停车木楔',
    directMetres: 10, bypassId: 'DR0-STAIR-PUBLIC-RAMP', bypassMetres: 26,
    pricePennies: 6, repair: 'CLEAR_STAIR', transfer: 'ESCORT_PORTER',
    repairSeconds: 180, handlingSeconds: 30, initialCondition: 70,
    defect: '同一空手推车横在阶口；外侧缓坡始终能供本人普通绕行和退场。',
    repairedDescription: '把原空车推到平台侧边，实用已购木楔制动；原车不消失，旧阶与原人的身体都不修复。',
  },
  'warehouse-gate': {
    id: 'warehouse-gate', title: '修好库院原门并交付工具箱', location: 'DR0-WAREHOUSE-YARD',
    ends: { FROM: { id: 'DR0-WAREHOUSE-INNER', name: '库房内侧发货台' }, TO: { id: 'DR0-WAREHOUSE-OUTER', name: '院外工具接收台' } },
    owner: { id: 'DR0-EDITH', bodyId: 'DR0-EDITH-BODY', name: '伊迪丝·布朗', age: 44 },
    receiver: { id: 'DR0-HUGH', bodyId: 'DR0-HUGH-BODY', name: '休·莫尔', age: 48 },
    payload: { kind: 'CARGO', id: 'DR0-TOOL-CHEST', name: '同一封闭工具箱', ownerId: 'DR0-EDITH' },
    apparatusId: 'DR0-YARD-GATE', oldPartId: 'DR0-YARD-BENT-PIN',
    supplyId: 'DR0-YARD-PIN-1', supplyName: '唯一新铰轴',
    directMetres: 14, bypassId: 'DR0-WAREHOUSE-SIDE-ALLEY', bypassMetres: 32,
    pricePennies: 10, repair: 'REFIT_GATE', transfer: 'CARRY_TOOL_CHEST',
    repairSeconds: 240, handlingSeconds: 30, initialCondition: 60,
    defect: '原院门铰轴弯曲而卡住，短路不通；已存在的侧巷可供普通出返。',
    repairedDescription: '卸下并保留同一弯轴，装入已购新轴再手动开原门；不新造门、不复制箱内工具。',
  },
};

export const DOOR_SERVICE_TERMS = {
  provenance: 'ORIGINAL_GAME_DESIGN', status: 'FINITE_ORIGINAL_SERVICES',
  jobs: 3, principalActionsPerJob: 2, totalSupplyPennies: 24,
  askSeconds: 30, surveySeconds: 45, buySeconds: 30, verifySeconds: 45,
  stopSeconds: 1, enterSeconds: 1, leaveSeconds: 1, metresPerSecond: 1,
  travellerEnergyCost: 4, directConditionWear: 1,
  cashReward: 0, masteryReward: 0, ritualCredit: 'NONE',
  canonicalRitual: 'UNKNOWN', canonicalAuxiliaryMaterials: 'UNKNOWN',
} as const;
