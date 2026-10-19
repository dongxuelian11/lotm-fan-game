/** Bounded original 1353 branch. These supplies are ordinary experimental
 * carriers, not a purported canonical S0 formula. Provenance stays internal. */
export const PERFECTER_MATERIAL_LOCATIONS = {
  supplier: 'backlund:professional-handoff', archive: 'backlund:custody-archive',
  vault: 'backlund:sealed-vault', workshop: 'backlund:ritual-workshop',
} as const;
export const PERFECTER_CHARACTERISTIC_BOTTLES = ['civilization-enlightener-potion-1', 'civilization-enlightener-potion-2', 'civilization-enlightener-potion-3'] as const;
export const PERFECTER_LABOUR_TASKS = [
  { id: 'SEAL_REGISTER', label: '核验这瓶原封签与存放登记' },
  { id: 'CRATE_AUDIT', label: '清点这瓶实际交付箱与封签' },
  { id: 'SUPPLY_LIST', label: '校对这瓶独立供货清单' },
  { id: 'TRANSIT_RECEIPT', label: '整理这瓶原运输与收货凭据' },
  { id: 'DELIVERY_REVIEW', label: '完成这瓶当面交付复核' },
] as const;
export const PERFECTER_MATERIAL_PRICES = {
  characteristic: 6600, labourCreditPerTask: 1100, uniqueness: 1600,
  chain: 80, vacancy: 140, seal: 100, compose: 120,
  abilitySeal: 60, professionalSeal: 260, recovery: 100,
  repairOrder: 220, repairDelivery: 100, legacyInvestigation: 80, legacySealing: 180, legacyRecovery: 100,
} as const;
export const PERFECTER_UNIQUENESS_ID = 'paragon-uniqueness:original-branch-1353' as const;
export const PERFECTER_UNIQUENESS_SOURCE = {
  branchId: 'brass-lantern-custody-1353', uniqueId: PERFECTER_UNIQUENESS_ID,
  title: '铜灯保管所的完美者唯一性',
  distinction: '1353年的当代保管记录须与现场原件共同核对：目前没有在位完美者，没有另一容纳者，也没有另一份同类原件。',
  formerHolder: '埃德温·莫尔，旧物保管人，从未容纳该唯一性',
  loss: '1352年10月9日，莫尔死于铜灯库房事故。死亡登记EM-1352-1009与当日封箱转移单BL-26记录本人死亡、同一封箱及接收保管人。',
  records: [
    { id: 'EM-1352-1009', location: PERFECTER_MATERIAL_LOCATIONS.archive, detail: '本人身份、死亡日期与未容纳记录；死亡只结束保管职责，未生成新原件。' },
    { id: 'BL-26', location: PERFECTER_MATERIAL_LOCATIONS.archive, detail: '成年保管员莉迪亚·芬奇当日接收同一封箱。编号、封签和交接重量连续，原件没有注销、重发或复制。' },
    { id: 'BL-1353-VACANCY', location: PERFECTER_MATERIAL_LOCATIONS.vault, detail: '当代三方保管簿、现场唯一性响应与现任保管人共同核对：没有另一容纳者、在位者或第二原件。交付周须再核实封签与现状。' },
  ],
  chain: [
    { custodian: '埃德温·莫尔', from: '1351-02-18', until: '1352-10-09', location: 'backlund:brass-lantern-storehouse', record: 'EM-1352-1009' },
    { custodian: '莉迪亚·芬奇', from: '1352-10-09', until: null, location: PERFECTER_MATERIAL_LOCATIONS.vault, record: 'BL-26' },
  ],
} as const;
export const PERFECTER_UNIQUENESS_STEPS = [
  { id: 'CHAIN', label: '查验失主、转移单与唯一保管链', location: PERFECTER_MATERIAL_LOCATIONS.archive, cost: 80 },
  { id: 'VACANCY', label: '当场核实没有另一容纳者或在位者', location: PERFECTER_MATERIAL_LOCATIONS.vault, cost: 140 },
  { id: 'SEAL', label: '核验同一原件封签与当代交付许可', location: PERFECTER_MATERIAL_LOCATIONS.vault, cost: 100 },
] as const;
export const PERFECTER_CARRIER_BATCHES = [
  { id: 'perfecter-carrier-1', label: '一号专业实验承载包', price: 360, contents: '蒸馏水、过滤纸、标记墨、洁净玻璃容器与一次性密封材料' },
  { id: 'perfecter-carrier-2', label: '二号专业实验承载包', price: 390, contents: '独立有价的普通溶剂、过滤纸、洁净容器与密封材料' },
  { id: 'perfecter-carrier-3', label: '三号专业实验承载包', price: 420, contents: '另一批独立有价的普通溶剂、标记墨、洁净容器与密封材料' },
] as const;
export const PERFECTER_CARRIER_REFILLS = ['perfecter-refill-1', 'perfecter-refill-2', 'perfecter-refill-3', 'perfecter-refill-4', 'perfecter-refill-5', 'perfecter-refill-6'] as const;
export const PERFECTER_FORMULA_NOTICE = '专业实验承载使用有价普通药液、容器与封存耗材。每次调配须实际具备三份原特性、同一唯一性及已完成的成神准备；药液会损耗，成功没有保证，现场支持不能代替普通医疗或免除死亡。';
export const PERFECTER_RECOVERY_NOTICE = '失败会真正损耗当批普通药液。原两特性与唯一性留在实际残留物中；本人仍活着且实际封存后才能清理回收。死亡时原件留在现场并脱离本人控制，不消灭、不复制、不自动复起。';
