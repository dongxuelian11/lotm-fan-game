import { WAR_BISHOP_GUIDE } from '../war-bishop/content.js';
import type { WeatherWarlockAbilityId, WeatherWarlockPreparationId } from './types.js';
export const WEATHER_WARLOCK_GUIDE = WAR_BISHOP_GUIDE;
export const WEATHER_WARLOCK_PRICES = {guidance:500,potion:6200,labourCredit:5400,preparation:120} as const;
export const WEATHER_WARLOCK_MIN_WAR_BISHOP_WEEKS = 12;
export const WEATHER_WARLOCK_LABOUR_STEPS = 5;
export const WEATHER_WARLOCK_BOTTLE_IDS = ['weather-warlock-potion-1','weather-warlock-potion-2','weather-warlock-potion-3'] as const;
export const WEATHER_WARLOCK_FORMULA_STATUS = '天气术士2完整主辅配方和晋升仪式尚未核到，保持未知。本作采用明确G专业指导、独立序列2成品与实际准备，不宣称原著无需仪式；红祭司0的大陆战争胜利条件不属于本阶。原药失败消耗与排异保留，全部耗尽后可以申请新的独立原瓶并跨真实周收货。';
export const WEATHER_WARLOCK_SOURCE_STATUS = '第五部3章明列战争主教3→天气术士2→征服者1。已核天气方向包含冰霜，以及天气术士阿霍马托瓦的战场迷雾、天气变化、暴风闪电称号；近百公里隐蔽行军是角色对个案的推测，不是固定半径。本章三个有限天气场、实际水源约束、时间/距离/消耗/强度与人物全部为原创G。现场会影响本人和真实同伴，不提供全球天气控制、队友自动免疫、免费兵库、无条件命中或神级战场。下一征服者1能力仍未开放。';
export const WEATHER_WARLOCK_POTION_SOURCES = WEATHER_WARLOCK_BOTTLE_IDS.map((id,index)=>({id,source:`${WEATHER_WARLOCK_GUIDE}保管的原创G独立天使层级成品交接记录，初批第${index+1}瓶序列2原瓶${id}。非战争主教旧瓶升级或复制；配方与完整仪式未知，交接不附赠晋升、军队或安全保证。`}));
export const WEATHER_WARLOCK_LABOUR_TASKS = ['核验独立原瓶封存来源','清点本瓶原交接箱','整理本瓶保管记录','复核本瓶运输凭据','完成本瓶原件交付核对'] as const;
export const WEATHER_WARLOCK_PREPARATIONS: {id:WeatherWarlockPreparationId;title:string;description:string}[] = [
 {id:'INSPECT_ROUTE',title:'沿原场走完撤离路线',description:'本人实际走到准备场出口，辨认普通退路与求助位置。没有施展天气、传送或完成原著未知仪式。'},
 {id:'CHECK_EQUIPMENT',title:'核对原场防护与水源记录',description:'本人核对准备场原容器、排水口、记录牌和原封存箱，写明现有资源与中止条件。新生活场与战斗水池仍须另到实际场地，不赠无限水。'},
 {id:'PLAN_SUPPORT',title:'演练暂停与身份锚定',description:'本人对照已有姓名、原队共同经历和原记录，按原创G专业方案演练求援与停止；不凭空获得信徒或宣称完整神话形态稳定。'}
];
export const WEATHER_WARLOCK_ABILITIES: {id:WeatherWarlockAbilityId;label:string;description:string}[] = [
 {id:'hunter.s2.battle-fog',label:'有限战场迷雾',description:'依已核天气方向实施本作G有限雾场；自身视线与同伴同受影响。战斗8灵性、原水2升，减势60并付本人视线不利−10贡献；实际在场同伴各1精力。本轮天气只一次，条件不足普通回退。'},
 {id:'hunter.s2.frost',label:'有限冰霜',description:'在明确原件与有限环境实施G降温。战斗8灵性、原水1升，减势50但本人也受地面影响−8贡献；同伴各1精力。不当永久冻结、治疗、全图绝对控制。'},
 {id:'hunter.s2.storm',label:'有限风雨雷势',description:'在本场操纵有限天气，环境与旁人有真实代价。战斗10灵性、原水4升，90贡献扣本人风势不利15；同伴各1精力，原木挡板新增一处损坏、地面保持湿滑。仍需共同胜负与伤势判定。'}
];
export const WEATHER_WARLOCK_CONSUMPTION_RISK = '以下为本作G：战争主教消化100且晋3后12整周、健康>20精神>40、三项不同专业准备完成，另付1行动120便士检查本周场地后独立确认原瓶。意志难度30；大成功/成功晋升分别精神−8/15，失败未晋升健康−15精神−25排异+30，大失败健康−25精神−45排异+60。当次原瓶与准备消耗，排异支持仅保健康精神至少1，不保护战死。可普通退出、停留3、真实休养重筹。成功四属性各+1、旧掌握和消化保存、新三能力0、灵性上限120但当前不回满；不改变角色身体性别、不重建旧30人、不恢复任何死者或旧物。';
