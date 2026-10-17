/**
 * 本章编审原创 G：完整世界历史迷雾的有限归一化目录。
 *
 * 这里的分区、4096 等权单位、原始雾层、原物来历、固定双端联系及
 * 「本人留现实、同一主体的实际灵之虫入雾」均是本作原创规则和内容。
 * 本文件不声称这些事件、物件、数值或入雾方法已经获得原著事实核验。
 * 来源目录不是阅读证明，不初始化库存、原锚、灵之虫或任何当前控制。
 */

export const FOG_STATION_IDS = Object.freeze([
  'quarry',
  'reed-cave',
  'salt-vault',
  'rain-ruin',
] as const);

export type FogStationId = (typeof FOG_STATION_IDS)[number];

export const WORLD_HISTORY_MANIFEST_ID = 'WORLD_HISTORY_208_V1' as const;
export const WORLD_HISTORY_DENOMINATOR = 4096 as const;
export const FOG_DOMAIN_UNITS = 64 as const;

type FogSeamIds = readonly [string, string, string, string, string];

export interface WorldHistoryDomain {
  readonly id: string;
  readonly spaceId: string;
  readonly eraId: string;
  readonly spaceBoundary: string;
  readonly timeBoundary: string;
  readonly units: 64;
  readonly reachable: boolean;
  readonly unreachableReason: string | null;
  readonly sourceId: string;
  readonly sourceDescription: string;
  readonly seamIds: FogSeamIds;
  readonly historicalAnchorId: string;
  readonly stationId: FogStationId | null;
  readonly unitIds: readonly string[];
}

interface SpacePartition {
  readonly id: string;
  readonly boundary: string;
  readonly unavailableReason: string;
}

interface EraPartition {
  readonly id: string;
  readonly boundary: string;
}

/** 顺序即同一原发生事件出现多重空间标签时的唯一归属优先级。 */
const SPACE_AXIS: readonly SpacePartition[] = Object.freeze([
  Object.freeze({
    id: 'spirit-realm',
    boundary: '原发生域明确属于灵界自身的事件；先于其他空间标签判定。物质事件的灵界映像、记录或后世副本不另计。',
    unavailableReason: '本章没有编审并开放灵界自身雾层的实物原锚与可执行入雾通路。',
  }),
  Object.freeze({
    id: 'astral-realm',
    boundary: '未归灵界，且原发生域明确属于星界自身的事件；其余空间标签不得重复归入。',
    unavailableReason: '本章没有编审并开放星界自身雾层的实物原锚与可执行入雾通路。',
  }),
  Object.freeze({
    id: 'earth-north',
    boundary: '未归前两项，原发生域明确在地球物质层且原地点带北大陆地理标签；大陆边界重叠时北优先于南、西。',
    unavailableReason: '本章未为这个北大陆时代域开放独立原物保管链及连续入雾通路。',
  }),
  Object.freeze({
    id: 'earth-south',
    boundary: '未归前三项，原发生域明确在地球物质层且原地点带南大陆地理标签；南优先于西。',
    unavailableReason: '本章未为这个南大陆时代域开放独立原物保管链及连续入雾通路。',
  }),
  Object.freeze({
    id: 'earth-west',
    boundary: '未归前四项，原发生域明确在地球物质层且原地点带西大陆地理标签。',
    unavailableReason: '本章未为这个西大陆时代域开放独立原物保管链及连续入雾通路。',
  }),
  Object.freeze({
    id: 'earth-remainder',
    boundary: '未归前五项，但确定在地球物质层；包含海洋、无大陆地表标签的地下、未绘地及大陆归属不明的地球事件。',
    unavailableReason: '本章未为这个其余地球时代域开放独立原物保管链及连续入雾通路。',
  }),
  Object.freeze({
    id: 'extraterrestrial-matter',
    boundary: '未归前六项，且确定发生于地球以外的物质层；不把星界事件仅因名称相近归到这里。',
    unavailableReason: '本章没有编审并开放其他地外物质雾层的实物原锚与可执行入雾通路。',
  }),
  Object.freeze({
    id: 'unlocated-remainder',
    boundary: '未命中前七项的全部已发生事件；包含无地理落点、发生层未知及现有分类不能判定的历史，保留完整权重。',
    unavailableReason: '空间未定或现有分区外的兜底雾层仍占分母；本章没有可核实的固定进入端点。',
  }),
]);

/**
 * 年份均指本作采用的第五纪年号；不同纪元的同名年份不可直接比较。
 * 最后一项有“已知晚近”和“年代未定”两个互斥子集，未知不冒充晚近。
 * current-and-undated 的连续四段共同覆盖整个固定域，必须同时包含
 * 已知晚近与年代未定两支，不能只走原物自身已知年代对应的部分。
 * 这里冻结的是包含未知历史的原创通路边界，不是把未知事件变成已知
 * 知识；通过完整边界不授予百科全知，也不声称已经逐事核验世界史。
 */
const ERA_AXIS: readonly EraPartition[] = Object.freeze([
  Object.freeze({
    id: 'before-first',
    boundary: '仅收已确认早于第一纪开始的已发生历史；不能确认纪元的事件不放在这里。',
  }),
  Object.freeze({
    id: 'first-era',
    boundary: '仅收已确认属于第一纪的事件，含本纪开始、不含第二纪开始。',
  }),
  Object.freeze({
    id: 'second-era',
    boundary: '仅收已确认属于第二纪的事件，含本纪开始、不含第三纪开始。',
  }),
  Object.freeze({
    id: 'third-era',
    boundary: '仅收已确认属于第三纪的事件，含本纪开始、不含第四纪开始。',
  }),
  Object.freeze({
    id: 'fourth-era',
    boundary: '仅收已确认属于第四纪的事件，含本纪开始、不含第五纪开始。',
  }),
  Object.freeze({
    id: 'fifth-before-1349',
    boundary: '仅收已确认属于第五纪且早于1349年起点的事件，含第五纪开始；不能判定年份在哪侧时走年代未定兜底。',
  }),
  Object.freeze({
    id: 'fifth-1349-1351',
    boundary: '仅收已确认属于第五纪且不早于1349年起点、早于1352年起点的事件，即1349至1351三个整年。',
  }),
  Object.freeze({
    id: 'current-and-undated',
    boundary: '互斥并集：已确认第五纪1352年起至当前真实游戏时刻的已发生历史（含本作1655及后续分支、能确认在其后的纪元）；或未命中此前七项的年代未知、区间跨界且无法细分、年号不能映射事件。未知子集不被断言发生在1352年后；未来不入目录。',
  }),
]);

interface AuthoredReachableSource {
  readonly spaceId: string;
  readonly eraId: string;
  readonly stationId: FogStationId;
  readonly sourceId: string;
  readonly description: string;
  readonly custody: readonly [string, string, string, string];
  readonly seamIds: FogSeamIds;
  readonly historicalAnchorId: string;
}

/**
 * 十六个彼此独立的本章原创来源，不能用一个见闻或一份档案替换。
 * custody 是本章编审的原物来源/交接身份约束，不是声称玩家已经持有，
 * 更不是“读完保管记录便控制整域”。实际批次、交接与运输须另行落账。
 * 每一件原物只固定本域入口；四段连续归一化雾层覆盖的是整个固定域，
 * 全域覆盖必须由四段真实连续追索取得，不能拿原物自身年代替代。
 * 对 current-and-undated 也必须覆盖已知晚近与年代未定两支；入口原物
 * 年代明确，不意味着它只连接晚近支，更不意味着未知历史已被知识化。
 *
 * 十六件来源原物各只有一件，初始由状态层放在对应供应方保管。
 * 每站首份48便士包交易交接该站四件唯一来源原物及原锚硬件；custody
 * 中的“独立批次”指原物的交接封装与硬件批次，绝非源物可批量再生。
 * 后续替件包只能补充硬件，修复时迁装同一身份的来源原物；新批号、
 * 重新付款或重新读记录都不能复刻原石芯等来源原物，也不能补发一件
 * 具有相同sourceId的新原物。原物失踪或不可用必须保留真实状态。
 */
const AUTHORED_REACHABLE_SOURCES: readonly AuthoredReachableSource[] = [
  {
    spaceId: 'earth-north', eraId: 'fourth-era', stationId: 'quarry',
    sourceId: 'fog-source-northern-fracture-face',
    description: '原创北大陆第四纪断崖采石层。原物是断裂石芯，双面凿痕与未补合矿脉固定该域原始雾层的唯一开口；不是今日quarry的年代倒推。',
    custody: ['第四纪原创断崖石场原断面取出的同一石芯', '石场废弃时连同原凿痕封入石匣', '后世山路清理从原石匣逐件交接至本章石材保管人', '本章独立石芯封装批次待采购并实运quarry'],
    seamIds: ['north-fracture-seam-0', 'north-fracture-seam-1', 'north-fracture-seam-2', 'north-fracture-seam-3', 'north-fracture-seam-4'],
    historicalAnchorId: 'history-anchor-northern-fracture-face',
  },
  {
    spaceId: 'earth-south', eraId: 'fifth-before-1349', stationId: 'quarry',
    sourceId: 'fog-source-southern-kiln-bed',
    description: '原创南大陆第五纪1349年前烧窑层。原物是窑底结釉垫，原胎裂纹保留点火、封窑、塌顶之间的同一雾层接续；它不等同于一篇制陶记载。',
    custody: ['原创南方旧窑在1348年以前停烧后留下的原窑垫', '窑户后人在原窑址将垫与附着灰层整体入箱', '海运转交时保留原箱封口与逐手接收印', '本章独立结釉垫批次待采购并实运quarry'],
    seamIds: ['south-kiln-seam-0', 'south-kiln-seam-1', 'south-kiln-seam-2', 'south-kiln-seam-3', 'south-kiln-seam-4'],
    historicalAnchorId: 'history-anchor-southern-kiln-bed',
  },
  {
    spaceId: 'earth-west', eraId: 'fifth-1349-1351', stationId: 'quarry',
    sourceId: 'fog-source-western-cistern-key',
    description: '原创西大陆1350年闭合水窖层。原物是窖门石键，石键断口与水线把原层同后世重刻石件区分；西大陆地点、外运路线及雾路均为本章原创。',
    custody: ['原创西方水窖在1350年封闭时留存的原石键', '本章原创保管家系在窖门外侧保留石键而未复制替换', '本章原创远路交换以原断口配对完成逐手转交', '本章独立石键批次待采购并实运quarry'],
    seamIds: ['west-cistern-seam-0', 'west-cistern-seam-1', 'west-cistern-seam-2', 'west-cistern-seam-3', 'west-cistern-seam-4'],
    historicalAnchorId: 'history-anchor-western-cistern-key',
  },
  {
    spaceId: 'earth-remainder', eraId: 'current-and-undated', stationId: 'quarry',
    sourceId: 'fog-source-open-sea-ballast',
    description: '原创地球公海沉降层。原物是1352年后一次已发生的测深投放留下的压舱铅；源年代明确属晚近子集，原发生位置不属于三大陆地表标签。',
    custody: ['原创远洋测深船在已发生航次使用的原压舱铅', '同一航次循原绳回收并保留海底压痕', '港口称量后以原船批号交接给本章金属保管人', '本章独立压舱铅批次待采购并实运quarry'],
    seamIds: ['sea-ballast-seam-0', 'sea-ballast-seam-1', 'sea-ballast-seam-2', 'sea-ballast-seam-3', 'sea-ballast-seam-4'],
    historicalAnchorId: 'history-anchor-open-sea-ballast',
  },
  {
    spaceId: 'earth-north', eraId: 'fifth-before-1349', stationId: 'reed-cave',
    sourceId: 'fog-source-northern-weir-pin',
    description: '原创北大陆第五纪1349年前旧堰层。原物是带交错磨纹的堰轴铜销，原销而非后来修堰用的替件固定这一条独立雾层。',
    custody: ['原创北方河堰在1349年前拆检时取出的原轴销', '河工将铜销与原轴木套同匣封存', '河道改线时原匣由旧库逐手转交本章水工保管人', '本章独立堰销批次待采购并实运reed-cave'],
    seamIds: ['north-weir-seam-0', 'north-weir-seam-1', 'north-weir-seam-2', 'north-weir-seam-3', 'north-weir-seam-4'],
    historicalAnchorId: 'history-anchor-northern-weir-pin',
  },
  {
    spaceId: 'earth-south', eraId: 'fifth-1349-1351', stationId: 'reed-cave',
    sourceId: 'fog-source-southern-landing-ring',
    description: '原创南大陆1349年卸舟坡层。原物是原泊舟环，环内绳痕与坡石铆孔共同固定原发生雾层；港口消息与航海故事不能替代它。',
    custody: ['原创南方卸舟坡于1349年涨潮后拆下的原泊舟环', '坡主把原环及铆孔石套同时交给修岸库', '修岸库封装经本章原创商路逐手交给绳具保管人', '本章独立泊舟环批次待采购并实运reed-cave'],
    seamIds: ['south-landing-seam-0', 'south-landing-seam-1', 'south-landing-seam-2', 'south-landing-seam-3', 'south-landing-seam-4'],
    historicalAnchorId: 'history-anchor-southern-landing-ring',
  },
  {
    spaceId: 'earth-west', eraId: 'current-and-undated', stationId: 'reed-cave',
    sourceId: 'fog-source-western-reed-spindle',
    description: '原创西大陆1352年后苇席工棚层。原物是折断纺苇锭，锭槽保留同一批芦苇纤维；年代明确属晚近子集，不借西大陆传闻取得源身份。',
    custody: ['原创西方工棚在已发生的晚近作业中折断的原锭', '工棚保管人以原断面将两截分隔封装', '本章原创远路交换保持两截共同封号逐手转交', '本章独立苇锭批次待采购并实运reed-cave'],
    seamIds: ['west-spindle-seam-0', 'west-spindle-seam-1', 'west-spindle-seam-2', 'west-spindle-seam-3', 'west-spindle-seam-4'],
    historicalAnchorId: 'history-anchor-western-reed-spindle',
  },
  {
    spaceId: 'earth-remainder', eraId: 'fourth-era', stationId: 'reed-cave',
    sourceId: 'fog-source-seafloor-bell-clapper',
    description: '原创地球海底第四纪沉钟层。原物是留在沉钟喉部的钟舌，海床原压层与锈连边固定原雾层；原发生点是海床而非制造钟的大陆。',
    custody: ['原创第四纪海床沉钟中同一枚钟舌', '本章原创打捞在原锈连边处连托架整体起取', '打捞封箱经海岸库逐手交给本章旧铜保管人', '本章独立钟舌批次待采购并实运reed-cave'],
    seamIds: ['seafloor-clapper-seam-0', 'seafloor-clapper-seam-1', 'seafloor-clapper-seam-2', 'seafloor-clapper-seam-3', 'seafloor-clapper-seam-4'],
    historicalAnchorId: 'history-anchor-seafloor-bell-clapper',
  },
  {
    spaceId: 'earth-north', eraId: 'fifth-1349-1351', stationId: 'salt-vault',
    sourceId: 'fog-source-northern-salt-pan-gate',
    description: '原创北大陆1351年盐田闸层。原物是结晶夹层中的旧闸齿，切勿用本章salt-vault现成盐料替代该独立年代原物。',
    custody: ['原创北方盐田1351年换下并结盐的原闸齿', '盐户将完整晶壳连同原齿入陶筒封存', '旧盐库清点时按原陶筒封号逐手转交本章盐工保管人', '本章独立闸齿批次待采购并实运salt-vault'],
    seamIds: ['north-salt-gate-seam-0', 'north-salt-gate-seam-1', 'north-salt-gate-seam-2', 'north-salt-gate-seam-3', 'north-salt-gate-seam-4'],
    historicalAnchorId: 'history-anchor-northern-salt-pan-gate',
  },
  {
    spaceId: 'earth-south', eraId: 'current-and-undated', stationId: 'salt-vault',
    sourceId: 'fog-source-southern-dry-well-chain',
    description: '原创南大陆1352年后旱井层。原物是原井链最末一节，矿痕与牵引变形固定原层；它属于已知晚近子集，井下原地点有南大陆标签。',
    custody: ['原创南方旱井在已发生清井中取出的原末节井链', '井工在原铆缝两侧打入配对封钉', '清井库以配对封钉逐手交给本章铁件保管人', '本章独立井链批次待采购并实运salt-vault'],
    seamIds: ['south-well-chain-seam-0', 'south-well-chain-seam-1', 'south-well-chain-seam-2', 'south-well-chain-seam-3', 'south-well-chain-seam-4'],
    historicalAnchorId: 'history-anchor-southern-dry-well-chain',
  },
  {
    spaceId: 'earth-west', eraId: 'fourth-era', stationId: 'salt-vault',
    sourceId: 'fog-source-western-terrace-plumb',
    description: '原创西大陆第四纪梯台砌筑层。原物是石工留下的测垂坠，原绳孔磨面与底层砌缝固定原始雾层；这项年代与来历仅是本作编审设定。',
    custody: ['原创西方第四纪梯台底层封入的原测垂坠', '本章原创修台从底层原槽连泥壳取出', '本章原创远路交换按原绳孔和泥壳成对交接', '本章独立测垂坠批次待采购并实运salt-vault'],
    seamIds: ['west-terrace-seam-0', 'west-terrace-seam-1', 'west-terrace-seam-2', 'west-terrace-seam-3', 'west-terrace-seam-4'],
    historicalAnchorId: 'history-anchor-western-terrace-plumb',
  },
  {
    spaceId: 'earth-remainder', eraId: 'fifth-before-1349', stationId: 'salt-vault',
    sourceId: 'fog-source-midsea-vent-core',
    description: '原创地球海底第五纪1349年前喷口层。原物是喷口外壳石芯，按原生成事件归海床域；后世在船上取样不是第二份历史控制来源。',
    custody: ['原创海底喷口在第五纪1349年前凝成的同一外壳石芯', '本章原创取样以原喷口断口套完整收存', '样品船靠港后将原套逐手交给本章岩样保管人', '本章独立喷口石芯批次待采购并实运salt-vault'],
    seamIds: ['midsea-vent-seam-0', 'midsea-vent-seam-1', 'midsea-vent-seam-2', 'midsea-vent-seam-3', 'midsea-vent-seam-4'],
    historicalAnchorId: 'history-anchor-midsea-vent-core',
  },
  {
    spaceId: 'earth-north', eraId: 'current-and-undated', stationId: 'rain-ruin',
    sourceId: 'fog-source-northern-rain-gutter',
    description: '原创北大陆1352年后落雨工舍层。原物是落水槽原接头，凹槽中的泥纹固定一次已发生积雨与排空的原层；不是把rain-ruin当前天气当历史证明。',
    custody: ['原创北方工舍在已发生晚近整修中取下的原槽接头', '工舍保管人封住两端并保留内部原泥纹', '屋面材料库以封口未启状态逐手交给本章雨具保管人', '本章独立槽接头批次待采购并实运rain-ruin'],
    seamIds: ['north-gutter-seam-0', 'north-gutter-seam-1', 'north-gutter-seam-2', 'north-gutter-seam-3', 'north-gutter-seam-4'],
    historicalAnchorId: 'history-anchor-northern-rain-gutter',
  },
  {
    spaceId: 'earth-south', eraId: 'fourth-era', stationId: 'rain-ruin',
    sourceId: 'fog-source-southern-basalt-step',
    description: '原创南大陆第四纪玄岩阶层。原物是原台阶剥落片，踏面与下层岩理共同固定原层，不能用后世拓印或同矿场新石片替换。',
    custody: ['原创南方第四纪阶台原位剥落的同一玄岩片', '阶台后世清理将原片与原位岩理对照后入夹盒', '夹盒随本章原创石料交换逐手到达石刻保管人', '本章独立玄岩片批次待采购并实运rain-ruin'],
    seamIds: ['south-basalt-seam-0', 'south-basalt-seam-1', 'south-basalt-seam-2', 'south-basalt-seam-3', 'south-basalt-seam-4'],
    historicalAnchorId: 'history-anchor-southern-basalt-step',
  },
  {
    spaceId: 'earth-west', eraId: 'fifth-before-1349', stationId: 'rain-ruin',
    sourceId: 'fog-source-western-storm-shutter',
    description: '原创西大陆第五纪1349年前风雨棚层。原物是百叶棚门原转轴，原木鞘压痕固定封棚至拆棚的同一雾层；本章自写的来历不冒充原著证据。',
    custody: ['原创西方风雨棚在第五纪1349年前拆下的原转轴', '原棚维护者把转轴连原木鞘干燥封存', '本章原创远路交换逐手保留轴鞘配对与封条', '本章独立棚门轴批次待采购并实运rain-ruin'],
    seamIds: ['west-shutter-seam-0', 'west-shutter-seam-1', 'west-shutter-seam-2', 'west-shutter-seam-3', 'west-shutter-seam-4'],
    historicalAnchorId: 'history-anchor-western-storm-shutter',
  },
  {
    spaceId: 'earth-remainder', eraId: 'fifth-1349-1351', stationId: 'rain-ruin',
    sourceId: 'fog-source-open-water-survey-weight',
    description: '原创地球公海1351年测流层。原物是流标配重，原碰痕与回收结固定水中原发生层；不能按船员出生地改归大陆域。',
    custody: ['原创公海测流船在1351年放下并收回的原流标配重', '船上保管人连原回收结封进测流器盒', '后世器材清库保持原盒封号逐手交给本章航具保管人', '本章独立测流配重批次待采购并实运rain-ruin'],
    seamIds: ['open-water-weight-seam-0', 'open-water-weight-seam-1', 'open-water-weight-seam-2', 'open-water-weight-seam-3', 'open-water-weight-seam-4'],
    historicalAnchorId: 'history-anchor-open-water-survey-weight',
  },
];

export const WORLD_HISTORY_PARTITION_RULES: readonly string[] = Object.freeze([
  '本清单是全本作世界历史迷雾的固定归一化测度：8个互斥空间格×8个互斥时代格×每域64单位=4096；等权、目录与入雾机制均属本作原创G，不宣称是原著数字或已核原著规则。',
  '先排除尚未发生的未来。正在发生的过程仅纳入截至当前真实游戏时刻已经发生的部分；当前时刻推进不增减4096分母，已控域接缝变动须由状态层推进historyEpoch并使旧证明失效。',
  '事件以唯一原发生身份计一次。文字记载、记忆、灵界映像、历史影像、原物后世复制品及多份档案不能复制原事件；后来真实发生的搬运是另一事件，不能篡改原来源的空间或时代。',
  '跨域过程先按可分离的原发生片段确定身份；确实无法分割的同一事件用原发生起点作为主发生域。若起点同时命中多个空间标签，严格按灵界→星界→地球北大陆→地球南大陆→地球西大陆→其余地球→地外物质→未知兜底的首个命中项归属，禁止重复登记。',
  '大陆地理标签表示原地点在本作编审空间分类中的归属，不按人物国籍、文献保管地、现站位置或物件制造地归类。地球上无大陆标签的海洋、地下、未绘地进入其余地球；连发生层都不能判定则进入空间未知兜底。',
  '时间先使用已核定且唯一的原事件纪元：第一纪前、第一纪、第二纪、第三纪、第四纪分别独占一格；第五纪再按[起点,1349)、[1349,1352)、[1352,当前]分格。纪元边界属于新纪元，年份边界属于较晚区间。各纪元同名年份不能横向等同。',
  '年代来源相互矛盾、纪元未知、年份区间跨越分界且不能细分、不同年号无法映射的已发生事件，一律进入current-and-undated的年代未定子集；这不是把未知历史判成1352年以后。其已知晚近子集包含本作1655及继续实际发生的后世分支，二者互斥但共用固定64单位域。',
  '空间未知、年代未知、未探索和本章不可达的历史都有真实目录席位。未开放48域仍合计3072单位；既不能删除，也不能按已读、已探索或已开放来源重算分母。',
  '每域unit:01至unit:64是该整个归一化原始雾层的固定单位身份，不是64篇记录或单个故事的64次复述。目录中的原物只钉住本域独立入口，不凭一件原物或保管说明宣告占有整个历史域。',
  '每域五个seamIds按0→1→2→3→4形成唯一四段连续路径。段0覆盖unit:01至16，段1覆盖17至32，段2覆盖33至48，段3覆盖49至64；前段终点必须就是后段起点，不能跳接、重排或把其他域接缝拼入。',
  '十六个开放原始雾层有互异sourceId、historicalAnchorId和接缝，覆盖四个物质空间与第四纪、第五纪1349年前、1349至1351及晚近/未定格。四座现实站只是各四条固定廊的入口，站本身和四份资料没有控制权重。',
  '十六条来源的具体原物、保管交接和远路交换均为本章编审原创设定；尚须购买真实独立组件、完成实物交接和沿原路运输。sourceDescription不是书籍来源证明、玩家已知证明、已有库存证明或免费领取凭证。',
  '入雾只指同一现实主体实际分出的独立灵之虫沿批准的固定双端联系进入对应原始雾层；本体留现实，不生成第二身体、全局导航、任意传送或跨界镇民控制。原锚必须为实物，不能用历史影像代替。',
  '只有状态层核实同一实际虫连续经过四段、独立原锚在指定历史端点实装且守住扰动、费用已付且同一时刻仍有效时，才可把该域64个固定单位加入并集。阅读、到站、发现、原物在手、安装未维持、曾经控制及休眠均不产生当前单位。',
  '当前控制以有效廊固定单位ID的并集除以4096派生。16廊同时有效为1024/4096；任何一廊失效即至960/4096。不同时间的控制不得累加，目录不能接受界面传入的百分比或动态缩小分母。',
]);

function domainId(spaceId: string, eraId: string): string {
  return `world-history-${spaceId}-${eraId}`;
}

function unavailableSeams(id: string): FogSeamIds {
  // 固定的完整域边界身份，不代表已测得或已经允许进入。
  return Object.freeze([
    `${id}:seam:0`,
    `${id}:seam:1`,
    `${id}:seam:2`,
    `${id}:seam:3`,
    `${id}:seam:4`,
  ] as const);
}

function buildDomain(space: SpacePartition, era: EraPartition): WorldHistoryDomain {
  const id = domainId(space.id, era.id);
  const source = AUTHORED_REACHABLE_SOURCES.find(
    (candidate) => candidate.spaceId === space.id && candidate.eraId === era.id,
  );
  const unitIds: readonly string[] = Object.freeze(
    Array.from({ length: FOG_DOMAIN_UNITS }, (_, index) =>
      `${id}:unit:${String(index + 1).padStart(2, '0')}`,
    ),
  );
  const seamIds: FogSeamIds = source
    ? Object.freeze([...source.seamIds] as [string, string, string, string, string])
    : unavailableSeams(id);

  return Object.freeze({
    id,
    spaceId: space.id,
    eraId: era.id,
    spaceBoundary: space.boundary,
    timeBoundary: era.boundary,
    units: FOG_DOMAIN_UNITS,
    reachable: source !== undefined,
    unreachableReason: source ? null : space.unavailableReason,
    sourceId: source ? source.sourceId : `fog-source-unopened-${id}`,
    sourceDescription: source
      ? `本章编审原创来源，非原著核验声明。${source.description} 原物保管链（custody）：${source.custody.join(' → ')}。保管链为来源约束，不替代真实交接、运输、入雾与全域连续控制。`
      : `本章完整目录中${space.id}/${era.id}的独立原始雾层身份。该固定sourceId仅保留整个64单位域的来源席位；原物保管链尚未开放，没有可执行入口，不表示已经发现、持有、进入或控制。`,
    seamIds,
    historicalAnchorId: source ? source.historicalAnchorId : `history-anchor-unopened-${id}`,
    stationId: source ? source.stationId : null,
    unitIds,
  });
}

/** 固定全部64域；禁止按reachable过滤后作为世界分母。 */
export const WORLD_HISTORY_DOMAINS: readonly WorldHistoryDomain[] = Object.freeze(
  SPACE_AXIS.reduce<WorldHistoryDomain[]>((domains, space) => {
    for (const era of ERA_AXIS) domains.push(buildDomain(space, era));
    return domains;
  }, []),
);

const STATION_TITLES: Readonly<Record<FogStationId, string>> = Object.freeze({
  quarry: '采石场原锚站',
  'reed-cave': '苇洞原锚站',
  'salt-vault': '盐窖原锚站',
  'rain-ruin': '雨墟原锚站',
});

export const FOG_STATION_CONTENT: readonly {
  readonly id: FogStationId;
  readonly title: string;
  readonly domainIds: readonly string[];
}[] = Object.freeze(
  FOG_STATION_IDS.map((id) => Object.freeze({
    id,
    title: STATION_TITLES[id],
    domainIds: Object.freeze(
      AUTHORED_REACHABLE_SOURCES
        .filter((source) => source.stationId === id)
        .map((source) => domainId(source.spaceId, source.eraId)),
    ),
  })),
);
