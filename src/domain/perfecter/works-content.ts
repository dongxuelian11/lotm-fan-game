/** A bounded original 1353 civic maintenance story. These municipal apparatus
 * have independent identities; none is a copy of a player-owned creation.
 * This local practice is not a claim about the canonical promotion ritual. */
export const PERFECTER_WORKS_STATION_IDS = ['ARCHIVE', 'WORKSHOP', 'SOUTH_BANK'] as const;
export type PerfecterWorksStationId = typeof PERFECTER_WORKS_STATION_IDS[number];
export const WORKS_LOCATIONS: Readonly<Record<PerfecterWorksStationId, string>> = {
  ARCHIVE: 'backlund:old-civic-archive',
  WORKSHOP: 'backlund:civic-repair-workshop',
  SOUTH_BANK: 'backlund:south-bank-relay',
};
export const PERFECTER_WORKS_LOCATIONS = WORKS_LOCATIONS;
export const PERFECTER_WORKS_STATIONS = [
  { id: 'ARCHIVE', name: '旧市政档案馆', apparatusId: 'BC-ARC-17', apparatus: '纸带检索机',
    recordId: 'BC-ARC-17:maintenance-ledger', initialDurability: 42,
    operatorId: 'civic-iris-ward', operator: '艾丽丝·沃德', operatorAge: 38,
    defect: '送纸齿轮缺齿，旧索引无法准确停在所需卷页。',
    repair: '更换两枚有编号的齿轮与衬套，清理原轴上的碎屑',
    calibration: '用实存目录与原刻度尺逐项校正停止位置',
    function: '从实存目录找到并交付指定卷页',
    outcome: '六名已登记的成年居民领到原本查不出的住址证明',
    residents: ['archive-elin-reed', 'archive-jonas-vale', 'archive-ruth-hill', 'archive-edgar-stone', 'archive-leah-cole', 'archive-finn-marsh'],
    stock: 6, serviceStock: 3,
  },
  { id: 'WORKSHOP', name: '市政维修工坊', apparatusId: 'BC-WKS-04', apparatus: '水泵调速校验台',
    recordId: 'BC-WKS-04:maintenance-ledger', initialDurability: 48,
    operatorId: 'civic-emil-holt', operator: '埃米尔·霍尔特', operatorAge: 46,
    defect: '调速联杆松旷，送修水泵在正常负荷下反复停转。',
    repair: '更换两枚磨损轴套与锁销，按原尺寸复位联杆',
    calibration: '以原砝码和已知负荷复核转速与停机界限',
    function: '校验并交还实际送修的街区水泵调速器',
    outcome: '六名已登记的成年取水员恢复各自负责水点的日常取水',
    residents: ['workshop-anna-moss', 'workshop-peter-dunn', 'workshop-rose-king', 'workshop-otto-bell', 'workshop-nora-park', 'workshop-will-green'],
    stock: 6, serviceStock: 3,
  },
  { id: 'SOUTH_BANK', name: '南岸中继所', apparatusId: 'BC-SBR-09', apparatus: '有线水位信号转发器',
    recordId: 'BC-SBR-09:maintenance-ledger', initialDurability: 38,
    operatorId: 'civic-nadia-bell', operator: '娜迪娅·贝尔', operatorAge: 31,
    defect: '触点烧蚀，沿岸泵房收到的水位信号连续缺段。',
    repair: '更换两组烧蚀触点与绝缘座，检查原线路连续性',
    calibration: '对照原水尺读数逐段校准传输时序',
    function: '将现场水尺读数送达原岸边泵房并取得回报',
    outcome: '六名已登记的成年岸边值守员按准确水位开闭各自泵闸',
    residents: ['relay-clara-brook', 'relay-hugh-wood', 'relay-vera-gray', 'relay-noel-lake', 'relay-mira-west', 'relay-alan-fox'],
    stock: 6, serviceStock: 3,
  },
] as const;
export const WORKS_STATIONS = PERFECTER_WORKS_STATIONS;
export const PERFECTER_ARCHIVE_RESIDENTS = [
  { id: 'archive-elin-reed', name: '艾琳·里德', age: 34, injury: '先前搬运留下的腕伤' },
  { id: 'archive-jonas-vale', name: '乔纳斯·维尔', age: 51, injury: '先前跌倒留下的腿伤' },
] as const;
