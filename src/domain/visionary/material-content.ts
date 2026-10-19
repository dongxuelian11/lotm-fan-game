/** Original campaign custody and ordinary carrier supplies. These are not a
 * purported complete canonical S0 formula or a claim about Adam's history. */
export const VISIONARY_MATERIAL_LOCATIONS = {
  supplier: 'backlund:professional-handoff', archive: 'backlund:custody-archive',
  vault: 'backlund:sealed-vault', workshop: 'backlund:ritual-workshop',
} as const;
export const VISIONARY_CHARACTERISTIC_BOTTLES = ['writer-potion-1', 'writer-potion-2', 'writer-potion-3'] as const;
export const VISIONARY_LABOUR_TASKS = [
  { id: 'SEAL_REGISTER', label: '核验这瓶原封签与存放登记' },
  { id: 'CRATE_AUDIT', label: '清点这瓶实际交付箱与封签' },
  { id: 'SUPPLY_LIST', label: '校对这瓶独立供货清单' },
  { id: 'TRANSIT_RECEIPT', label: '整理这瓶原运输与收货凭据' },
  { id: 'DELIVERY_REVIEW', label: '完成这瓶当面交付复核' },
] as const;
export const VISIONARY_MATERIAL_PRICES = {
  characteristic: 6400, labourCreditPerTask: 1100, uniqueness: 1600,
  chain: 80, vacancy: 140, seal: 100, compose: 120,
  abilitySeal: 60, professionalSeal: 260, recovery: 100,
  repairOrder: 220, repairDelivery: 100, legacyInvestigation: 80, legacySealing: 180, legacyRecovery: 100,
} as const;
export const VISIONARY_UNIQUENESS_ID = 'audience-uniqueness:original-branch-1352' as const;
export const VISIONARY_UNIQUENESS_SOURCE = {
  branchId: 'white-bell-custody-1352', uniqueId: VISIONARY_UNIQUENESS_ID,
  title: '白钟封存所的观众唯一性',
  distinction: '本作1352年独立原创世界分支；不宣称原书亚当死亡，不据此改写原书历史。此分支当前没有在位空想家。',
  formerHolder: '奥尔文·凯德，原创旧物保管人，未容纳唯一性、不是空想家',
  loss: '1351年11月4日，凯德死于白钟仓库坍塌；验尸登记CK-1351-1104与完整封箱回收单WB-17共同记录失主及原物去向。',
  records: [
    { id: 'CK-1351-1104', location: VISIONARY_MATERIAL_LOCATIONS.archive, detail: '旧保管人身份、死亡日期与未容纳声明；不能用失踪传闻替代死亡记录。' },
    { id: 'WB-17', location: VISIONARY_MATERIAL_LOCATIONS.archive, detail: '从坍塌仓库回收同一封箱，由成年保管员玛蕾娜·沃斯签收；同一唯一性编号从未注销或重发。' },
    { id: 'WB-1352-VACANCY', location: VISIONARY_MATERIAL_LOCATIONS.vault, detail: '当代三方保管簿与现场独一性响应互核：仅此原件，无另一容纳者或在位空想家；交付前再核，不能只凭旧档领物。' },
  ],
  chain: [
    { custodian: '奥尔文·凯德', from: '1350-03-12', until: '1351-11-04', location: 'backlund:white-bell-storehouse', record: 'CK-1351-1104' },
    { custodian: '玛蕾娜·沃斯', from: '1351-11-04', until: null, location: VISIONARY_MATERIAL_LOCATIONS.vault, record: 'WB-17' },
  ],
} as const;
export const VISIONARY_UNIQUENESS_STEPS = [
  { id: 'CHAIN', label: '查验失主、回收单与唯一保管链', location: VISIONARY_MATERIAL_LOCATIONS.archive, cost: 80 },
  { id: 'VACANCY', label: '当场核实没有另一容纳者或在位者', location: VISIONARY_MATERIAL_LOCATIONS.vault, cost: 140 },
  { id: 'SEAL', label: '核验同一原件封签与当代交付许可', location: VISIONARY_MATERIAL_LOCATIONS.vault, cost: 100 },
] as const;
export const VISIONARY_CARRIER_BATCHES = [
  { id: 'visionary-carrier-1', label: '一号普通调配包', price: 360, contents: '蒸馏水、过滤纸、标记墨、洁净玻璃容器与一次性密封材料' },
  { id: 'visionary-carrier-2', label: '二号普通调配包', price: 390, contents: '独立有价的普通溶剂、过滤纸、洁净容器与密封材料' },
  { id: 'visionary-carrier-3', label: '三号普通调配包', price: 420, contents: '另一批独立有价的普通溶剂、标记墨、洁净容器与密封材料' },
] as const;
export const VISIONARY_CARRIER_REFILLS = ['carrier-refill-1', 'carrier-refill-2', 'carrier-refill-3', 'carrier-refill-4', 'carrier-refill-5', 'carrier-refill-6'] as const;
export const VISIONARY_FORMULA_NOTICE = '完整原生辅料配方仍未知。这里的有价普通调配包只是本作实验性承载与封存耗材，不是新增非凡特性，也不冒充原书完整配方。成神必须另行具备唯一性、三份真实序列1与已完成的成神仪式。';
export const VISIONARY_RECOVERY_NOTICE = '失败会真正损耗当批普通药液。原两特性与唯一性留在实际残留物中；本人仍活着且实际封存后才能清理回收。死亡时原件留在现场并脱离本人控制，不消灭、不复制、不自动复起。';
