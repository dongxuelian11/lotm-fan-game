/** Canonical hard requirements: one's own country, widely known name and emperor
 * title, intricate abnormal implemented order including buildings, nine secret
 * pyramidal mausoleums built by subjects, and the majority of the population
 * sacrificing across cities while the candidate consumes inside one mausoleum.
 * Complete auxiliaries, numeric sufficiency and generic S0 techniques are unknown.
 * This independent future country, all exact costs/counts/timings and two bounded
 * municipal techniques are authored gameplay, never universal canon mechanics. */
export const BLACK_EMPEROR_ORIGINAL_IDS = ['prince-of-abolition-potion-1','prince-of-abolition-potion-2','prince-of-abolition-potion-3'] as const;
export const BLACK_EMPEROR_ABILITY_IDS = ['black-emperor.s0.bounded-order-distortion','black-emperor.s0.delayed-impact'] as const;
export type BlackEmperorOriginalId = typeof BLACK_EMPEROR_ORIGINAL_IDS[number];
export type BlackEmperorAbilityId = typeof BLACK_EMPEROR_ABILITY_IDS[number];
export type BlackEmperorPosition = 'ORIGINAL_ENTRY' | 'OUTSIDE' | 'MAUSOLEUM' | 'FACILITY';
export type BlackEmperorConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export const BLACK_EMPEROR_PLACES = [
 {id:'BE227-COURT-ENTRY',title:'原演练房门口'},{id:'BE227-COURT-OUTSIDE',title:'原演练房外'},
 {id:'BE227-REALM',title:'三城共同议事所'},{id:'BE227-RECOVERY',title:'原成品交接处'},
 {id:'BE227-VAULT',title:'唯一性保管室'},{id:'BE227-WORKSHOP',title:'封闭调配室'},
] as const;
export type BlackEmperorPlaceId = typeof BLACK_EMPEROR_PLACES[number]['id'];
export const BLACK_EMPEROR_CITIES = [
 {id:'BE227-NORTH',name:'苇港',population:30000,adultWorkers:900,task:'SUPPLY',taskTitle:'实际打开滞留粮仓并完成六区供粮',stock:{cash:6000,stone:900,timber:600,food:8000,labourDays:12000}},
 {id:'BE227-EAST',name:'石桥',population:27000,adultWorkers:900,task:'ROAD',taskTitle:'组织工人修通三百米被毁公路与桥口',stock:{cash:6000,stone:1100,timber:600,food:8000,labourDays:12000}},
 {id:'BE227-SOUTH',name:'梧庭',population:33000,adultWorkers:900,task:'ADJUDICATION',taskTitle:'依实物界标解决六处供水及通行争议并执行裁决',stock:{cash:6000,stone:900,timber:600,food:8000,labourDays:12000}},
] as const;
export type BlackEmperorCityId = typeof BLACK_EMPEROR_CITIES[number]['id'];
/** Each bundle has six explicit interlocking clauses, including actual building
 * and gate/street practice. Inhabitants execute them; publishing alone does not. */
export const BLACK_EMPEROR_ORDER_BUNDLES:Record<BlackEmperorCityId,readonly string[]> = {
 'BE227-NORTH': ['东街只准由西向东运粮，空车必须从南街反向返还','北门入城车先出门绕行外廊，再由同门入城','粮仓新建双层验秤廊，下层记重量，上层先盖收讫再实际交付','每三车粮只按第三车先卸、第一车次卸、第二车最后卸','市钟第三响宣布第一轮开仓，第一响宣布第三轮停仓','日落后交班先在东廊登记翌日姓名，再回西廊注销今日职守'],
 'BE227-EAST': ['石桥东行在北侧南向桥坡候行，西行在南侧北向桥坡候行','新建折返门廊要求过门后回身签前一段，再进入下一段','三段公路依中、前、后次序放行，任何一段不得越序','工队先提交次日完工牌，再领取当日工单；实物验收仍逐件进行','桥钟第二响开始第一班，第四响开始第三班，第三响结束第二班','空车需在实建旁路绕行一圈，载重车由主桥慢行并向空车先致意'],
 'BE227-SOUTH': ['新建三门裁判廊，申诉从右门进、证人从左门进、裁定从中门退行送出','每件争议先公开最终执行日期，再依证物审理原因和责任','上游水闸按下游先敲钟、中游次敲、上游最后敲的顺序开闸','街口通行先取退出牌、走完一街再换进入牌，牌只记实际已走路程','六区轮值按第三、六、第二、五、第一、第四区顺序交接','每次裁决由前案执行人读下一案编号，当前当事人当众复述本案实际执行界线'],
};
export const BLACK_EMPEROR_MIN_PRINCE_OF_ABOLITION_WEEKS = 12;
export const BLACK_EMPEROR_SPIRITUALITY_CAP = 150;
export const BLACK_EMPEROR_GUIDANCE = {actions:1,cash:20} as const;
export const BLACK_EMPEROR_PRICES = {workerService:20,ordinaryTools:30,residueInspection:120,originalRecovery:30,uniquenessVerification:100,uniquenessHandover:150,carrier:50,compose:40,sealedRecovery:60} as const;
export const BLACK_EMPEROR_PREPARATION = {actions:1,cash:150,spirituality:12,mind:8,seconds:3600,validSeconds:604800} as const;
/** Actual original205 will26 gives70% after paid +40 preparation, never fixed. */
export const BLACK_EMPEROR_CONSUMPTION = {difficulty:56,preparedBonus:40,actions:1,spirituality:30,successMind:12,minimumHealth:80,minimumMind:70,maximumPollution:0,failureHealth:45,failureMind:40,failurePollution:35,greatFailureHealth:110,greatFailureMind:100,greatFailurePollution:70} as const;
export const BLACK_EMPEROR_CONSTRUCTION = {weeks:3,actions:1,stonePerTomb:60,timberPerTomb:30,wagesPerTomb:150,workersPerTomb:40,labourDaysPerTomb:720,repairStone:30,repairTimber:15,repairWages:80,repairLabourDays:60} as const;
export const BLACK_EMPEROR_FESTIVAL = {cashPerCity:150,foodPerCity:600,labourDaysPerCity:180,personalCash:30,participationRatio:0.8} as const;
export const BLACK_EMPEROR_PRACTICE_COSTS = {orderDistortion:{actions:1,spirituality:12,mind:5,validSeconds:20,difficulty:14},delayedImpact:{actions:1,spirituality:12,mind:5,delaySeconds:20,difficulty:16},report:{actions:1,seconds:30}} as const;
export const BLACK_EMPEROR_SUCCESSION = {
 branchId:'black-emperor-independent-future-1352',formerOwnerId:'BE227-PRIOR-OWNER',formerOwnerAlive:false,
 death:{id:'BE227-PRIOR-DEATH',date:{epoch:'FIFTH_EPOCH',year:1352,month:12,day:20}},
 separation:{id:'BE227-SEPARATION',date:{epoch:'FIFTH_EPOCH',year:1352,month:12,day:20}},
 custody:{id:'BE227-UNIQUENESS-CUSTODY',date:{epoch:'FIFTH_EPOCH',year:1352,month:12,day:21},custodianId:'BE227-CUSTODIAN',custodyOnly:true},
 originalIds:[...BLACK_EMPEROR_ORIGINAL_IDS],uniquenessId:'BE227-UNIQUENESS',objectCount:1,currentIncumbent:null,
} as const;
export const BLACK_EMPEROR_ABILITIES = [
 {id:BLACK_EMPEROR_ABILITY_IDS[0],label:'局部秩序扭曲',description:'只对眼前市政绞盘尚未释放的同一载荷，实付1行动、12灵性、5精神开启20秒窗口。实际放下时按当前知识检定，对抗仍啮合的导向闩；成功把本次主槽路径改走已有侧槽，失败仍走主槽。载荷与工人不复位；普通绳索可固定载荷，停机杆始终可用。'},
 {id:BLACK_EMPEROR_ABILITY_IDS[1],label:'一次冲击延迟',description:'只对同一已启动但尚未落下的可见冲击，实付1行动、12灵性、5精神按当前意志检定。成功把既定撞击延后二十秒且不能叠加，冲击不消失。本人和成年工人可趁窗口普通退出，或用停机杆锁住机构；失败和停止不退还成本。'},
] as const;
export const BLACK_EMPEROR_STORY = '三座已有九万人居住的城镇分别面临供粮、通路与裁判难题。亲自完成实际任务后取得各城委托，再共同订立主权章程，形成属于本人的国度。国库来自三城可核的有限旧库存；人民实际执行三组反常秩序，秘密建起九座独立金字塔式陵寝。多城祭祀时绝大多数居民实际参与，本人进入一座完好陵寝饮药。';
export const BLACK_EMPEROR_GOAL = '先恢复身体并核清同一三份原特性；完成三城真实任务与共同章程，再执行秩序、按实付工期建成九陵，筹备多城祭祀并在陵内独立决定服药。基础施工九节点、每节点三周，共二十七周。';
export const BLACK_EMPEROR_RISK = '准备后的成功率由当前意志与本瓶实付准备计算，仍可能失败或死亡。施工、祭祀和失败费用不回退；同一材料存活封存七日后可付费回收，新祭祀另行筹备。死亡结束并封存周目。本章没有复活、全球操控或重写历史的可玩系统。';
