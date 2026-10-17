/** Future-side-story boundary: the 1352 institutions, adult personnel, budgets,
 * incidents and reform are original game content, not claims about canon events.
 * All cohorts and quarterly meetings exist when the campaign is created. */
export const VISIONARY_ERA_CITY_IDS = ['BACKLUND', 'TINGEN', 'PRITZ', 'TRIER', 'EINHORN', 'FENEPOTTER'] as const;
export type VisionaryEraCityId = typeof VISIONARY_ERA_CITY_IDS[number];
export const VISIONARY_ERA_GOVERNMENT_IDS = ['LOEN', 'INTIS', 'FUSAC', 'FENEPOTTER'] as const;
export type VisionaryEraGovernmentId = typeof VISIONARY_ERA_GOVERNMENT_IDS[number];
export const VISIONARY_ERA_LOCATIONS: Readonly<Record<VisionaryEraCityId, string>> = {
  BACKLUND: 'backlund:public-relay-headquarters', TINGEN: 'tingen:relay-station',
  PRITZ: 'pritz:relay-station', TRIER: 'trier:relay-station',
  EINHORN: 'einhorn:relay-station', FENEPOTTER: 'fenepotter:relay-station',
};
export const VISIONARY_ERA_GOVERNMENTS = [
  { id: 'LOEN', name: '鲁恩王国', budget: 240, rule: '市政救济款只可支出给已核对的原居民与原货运单；跨境不得挪用军资。' },
  { id: 'INTIS', name: '因蒂斯共和国', budget: 180, rule: '外来通报必须由本地成年值班员复核；试办费用由原市政维修款列支。' },
  { id: 'FUSAC', name: '弗萨克帝国', budget: 180, rule: '封闭仓库不向外国执行者开放；原保管员核单后才可放行指定救济物资。' },
  { id: 'FENEPOTTER', name: '费内波特王国', budget: 180, rule: '农仓储备不得私售；须先保留本地过冬底额，再办理跨城调拨。' },
] as const;
export const VISIONARY_ERA_CITIES = [
  { id: 'BACKLUND', name: '贝克兰德', governmentId: 'LOEN', keeper: '市政报务员玛琳·沃德', facility: '原南岸公共电报室', stock: 80, population: 260, staff: 6, closure: '未核准的境外灾报不得进入公共班表。' },
  { id: 'TINGEN', name: '廷根', governmentId: 'LOEN', keeper: '铁路调度员埃德温·格雷', facility: '原铁路货运值班间', stock: 60, population: 180, staff: 4, closure: '须先完成原班组交接，不能从客运值班表抽空人手。' },
  { id: 'PRITZ', name: '普利兹港', governmentId: 'LOEN', keeper: '仓库保管员艾达·布朗', facility: '原港口救济仓与信号亭', stock: 80, population: 240, staff: 6, closure: '涨潮封港时只准原持证救济车通行，旅客不能借通报强闯封锁。' },
  { id: 'TRIER', name: '特里尔', governmentId: 'INTIS', keeper: '市政工程员露西安·莫雷', facility: '原下城区泵站值班所', stock: 80, population: 300, staff: 6, closure: '污染水段封闭期间禁止市民自行取水，原工程员负责交接净水储备。' },
  { id: 'EINHORN', name: '艾因霍恩', governmentId: 'FUSAC', keeper: '港务书记官叶莲娜·沃林', facility: '原港务所冬季救助室', stock: 80, population: 220, staff: 6, closure: '风暴封港时救济货不得伪装普通商货出境。' },
  { id: 'FENEPOTTER', name: '费内波特', governmentId: 'FENEPOTTER', keeper: '农仓核算员米蕾雅·桑托斯', facility: '原粮仓联络所', stock: 80, population: 260, staff: 6, closure: '农仓原封签与居民名单均须本地核实，不接受远方直接改账。' },
] as const;
export const VISIONARY_ERA_QUARTER_OFFSETS = [39, 52, 65, 78] as const;
/** Fixed original incidents, not generated in response to attempts or waiting. */
export const VISIONARY_ERA_INCIDENTS = [
  { id: 'harbor-tide', cityId: 'PRITZ', node: 0, round: 1, residents: 18, supplies: 12, title: '普利兹港既定汛期的堤外转运', message: '港务所原观测点报告潮位越过警戒线，堤外十八名居民与原救济车被挡在外侧。' },
  { id: 'trier-water', cityId: 'TRIER', node: 0, round: 2, residents: 24, supplies: 16, title: '特里尔旧泵管污染水段', message: '原泵站停水记录送达：老旧管段进污水，二十四名居民须改由原净水仓领取供应。' },
  { id: 'einhorn-weather', cityId: 'EINHORN', node: 1, round: 1, residents: 20, supplies: 14, title: '艾因霍恩封港后的原候船旅客', message: '冬季港务班报确认航路封闭，原候船所二十名成年旅客缺少防寒供应。' },
  { id: 'fenepotter-sluice', cityId: 'FENEPOTTER', node: 1, round: 2, residents: 22, supplies: 14, title: '费内波特旧灌渠闸口停用', message: '灌渠检修员确认原闸口卡死，二十二名河岸居民的原取水路线中断。' },
  { id: 'tingen-rail', cityId: 'TINGEN', node: 2, round: 1, residents: 16, supplies: 10, title: '廷根原铁路边坡封路', message: '原巡线工发现边坡开裂并封路，十六名成年货运工滞留原值班所。' },
  { id: 'backlund-pump', cityId: 'BACKLUND', node: 2, round: 2, residents: 26, supplies: 18, title: '贝克兰德南岸旧排水泵停机', message: '市政报务员收到原泵房停机记录，二十六名南岸居民需要转到原避雨屋。' },
  { id: 'pritz-beacon', cityId: 'PRITZ', node: 3, round: 1, residents: 18, supplies: 12, title: '普利兹港原信号灯检修封航', message: '原信号灯因线路腐蚀停用，十八名原船坞工需经原救济码头转运。' },
  { id: 'trier-cold', cityId: 'TRIER', node: 3, round: 2, residents: 24, supplies: 16, title: '特里尔原公共供暖管断裂', message: '原公共供暖管断裂，二十四名已登记居民等待原储备站配送燃料。' },
] as const;
export type VisionaryEraIncidentId = typeof VISIONARY_ERA_INCIDENTS[number]['id'];
export type VisionaryEraNodeId = 'quarter-1' | 'quarter-2' | 'quarter-3' | 'quarter-4';
export const VISIONARY_ERA_NODE_IDS: readonly VisionaryEraNodeId[] = ['quarter-1', 'quarter-2', 'quarter-3', 'quarter-4'];
