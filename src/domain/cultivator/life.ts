import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {CultivatorCommand,CultivatorActivityCommand,CultivatorAction,CultivatorProjection} from './types.js';
const CASES=[
 {id:'soil-record',title:'阴处和日照处不是同一块地',story:'伊芙带你查看苗圃内已经划好的两小块原土：廊檐下较阴湿，另一块当下有日照。你可以用本作G栽培知识整理差异，或按普通观察逐项记录。记录的是眼前土壤、光照和这一时段，不能由此确定下月天气或所有种子的真名。',facts:['两块原土仍在伊芙苗圃，观察不改变所有权。','本场已知的是当下阴湿与日照差异，未来天气仍不确定。'],ability:'以G栽培知识整理已见条件，再同伊芙的原记录核对，不凭空知道未知植物。',ordinary:'普通观察并记录当下光照和湿润差异，不施用催生或控天气。',result:'两块原土的当下差异已记入原记录，适用范围和未知时段保留。',outcome:'SOIL_RECORDED'},
 {id:'seed-bed',title:'把种子种下，然后等待',story:'伊芙允许你使用原苗圃的一只固定小种植箱。一次60便士的普通物资包含3枚本作叶菜种子和2份照护用水：播种耗全部种子与1份水，至少下一周再用另一份实际照护；至少种下两周后才可收取本场有限2份叶菜。箱子仍属伊芙，种子不是魔药材料，等待不是即时催熟。',facts:['只有实际购买的一包3枚种子、2份水，不能同周反复刷新。','固定原箱留苗圃，收获条件与2份产量为明确G场景，不是现实种植保证。'],ability:'把已有G栽培知识用于原箱播种与记录；它不能取消实际种子、用水与跨周等待。',ordinary:'依原苗圃安排普通播种，之后同样实际照护并等待。',result:'原种子与用水实际用于这一箱；完成跨周照护和有限收获后才可报告，不能凭一句丰收得到粮食。',outcome:'GROWTH_RECORDED'},
 {id:'shared-basket',title:'篮里的一份确实来自这一箱',story:'苗圃旁成年帮厨托马同意接收你本次原箱收获中的一份叶菜，用于原休息间。你需要先真的种出它，再当面交出1份；另一份仍由你保管。没有交出便没有收到的故事，也没有额外金币或无穷收成。',facts:['托马明确接受本场这一份原叶菜，交付不使其自动加入队伍。','原收获一共2份，交出1份后只能保留1份。'],ability:'以G照护知识核对原箱记录与本次实际收获，再交出已同意的一份；不额外催生。',ordinary:'直接核对原收获数量，再当面交出一份。',result:'托马已实际收到本箱的一份叶菜；你保留另一份。产量、去向与成本可核，不因成长奖励恢复种子或作物。',outcome:'PORTION_DELIVERED'},
] as const;
export const CULTIVATOR_ENVIRONMENT='耕种者→医师→丰收祭司的阶序已有原文依据；本次没有核到S9独立能力表或完整配方。栽培知识、时令观察、细致实践及本场产量时间均明确为原创G。只有原种子、用水、种植箱和实际跨周照护带来有限收获，不控制天气，不使用弗兰克S6杂交能力。';
export const cultivatorInside=(s:SliceState)=>Object.values(s.cultivator.cases).some(r=>r.contactOpen);
export const isCultivatorActivity=(c:CultivatorCommand):c is CultivatorActivityCommand=>['OBSERVE','PREPARE','PERFORM','CLOSE','REPORT','WITHDRAW','REFLECT','BUY_GARDEN','CARE','HARVEST'].includes(c.type);
function blocked(s:SliceState,c:CultivatorActivityCommand):string|null{
 if(s.status!=='ACTIVE')return'当前周目已结束。';
 if(s.progression.pathwayId!=='mother'||s.progression.sequence!==9)return'先完成耕种者晋升。';
 const m=s.cultivator,g=m.garden,r='caseId'in c?m.cases[c.caseId]:null;
 if(c.type==='CLOSE')return r?.contactOpen?null:'没有尚未结束的原现场操作。';
 if(cultivatorInside(s))return'先0行动放稳原物并退开。';
 if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';
 if(s.world.city!=='BACKLUND')return'需要回到伊芙的原苗圃。';
 if(c.type==='WITHDRAW')return r?.status==='PREPARED'?null:'没有尚待取消的准备。';
 if(s.health<=0||s.mind<=0)return'先休养恢复身体与精神。';
 if(c.type==='BUY_GARDEN')return g.suppliesBought?'这一有限普通物资包已经购买。':s.cash<60?'原种子与用水包需要60便士。':null;
 if(s.actionsRemaining<1)return'需要1行动。';
 if(c.type==='CARE')return g.plantedWeek===null?'先实际播种。':g.caredWeek!==null?'本箱实际照护已经完成。':s.week<=g.plantedWeek?'至少下一周再照护，不能同周跳过等待。':g.water<1?'原用水不足。':null;
 if(c.type==='HARVEST')return g.plantedWeek===null||g.caredWeek===null?'先播种并在下一实际周照护。':g.harvestWeek!==null?'这一箱已经收完。':s.week<g.plantedWeek+2?'种下至少两整周后才到本场收获时点。':null;
 if(c.type==='REFLECT')return m.reflected?'已经回看这段经历。':CASES.some(p=>m.cases[p.id]?.status!=='RESOLVED')?'先完成三项真实报告。':null;
 if(!r)return'未知原事项。';if(r.status==='RESOLVED')return'这项记录已经完成。';
 if(c.type==='OBSERVE')return r.status!=='AVAILABLE'?'原观察已经保留。':c.caseId==='shared-basket'&&g.harvestWeek===null?'先实际收获，才有可交付的原作物。':null;
 if(c.type==='PREPARE')return r.status!=='OBSERVED'?'先观察本场原物与许可。':r.attemptWeek===s.week?'本周未成，下周可重新核对。':null;
 if(c.type==='REPORT')return r.status!=='EXAMINED'?'先完成原现场操作并退开。':c.caseId==='seed-bed'&&g.harvestWeek===null?'原箱仍在生长；完成照护与跨周收获后再报告。':null;
 if(r.status!=='PREPARED')return'先选择本次方法。';
 if(c.caseId==='seed-bed')return !g.suppliesBought||g.seeds!==3||g.water<1||g.plantedWeek!==null?'需要未用的原种子与用水包，且本箱尚未播种。':null;
 if(c.caseId==='shared-basket')return g.produce<1||g.delivered!==0?'需要本箱实际收获且尚未交出的1份。':null;
 return null;
}
export function applyCultivatorActivity(s:SliceState,c:CultivatorActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.cultivator,g=m.garden;
 if(c.type==='CLOSE'){const r=m.cases[c.caseId]!;r.contactOpen=false;r.closes++;ctx.note('放稳原物并退开','你结束本次观察或原箱操作，原箱留在苗圃，已种下的种子继续留土中；实际交出的作物不收回。0行动，不退成本、不治疗、不另抽盘。');return;}
 if(c.type==='WITHDRAW'){const r=m.cases[c.caseId]!;r.status='OBSERVED';r.method=null;r.withdrawals++;ctx.note('取消尚未实施的准备','原观察和已付行动保留；未实施的播种或交付没有发生。0行动取消。');return;}
 if(c.type==='BUY_GARDEN'){s.cash-=60;g.suppliesBought=true;g.seeds=3;g.water=2;ctx.note('有限普通物资实际交付','伊芙将本场3枚叶菜种子、2份用水放入你在原苗圃的标记格。支付60便士；只有这一包，不是魔药材料。');return;}
 s.actionsRemaining--;
 if(c.type==='CARE'){g.water--;g.caredWeek=s.week;ctx.note('下一实际周照护原箱','你到原苗圃使用最后1份原水照护这一箱，记录当前生长状态。没有再造种子、提前收获或改变天气。');return;}
 if(c.type==='HARVEST'){g.harvestWeek=s.week;g.produce=2;ctx.note('等到时点，实际收获','本箱完成跨周照护后收出本场G的2份叶菜，原种子与水不会恢复，空箱仍留伊芙苗圃。');return;}
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('cultivator-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('照料不能跳过时间','你保留观察、种子与用水的来源，等待与交付均实际发生。G扮演+25，不以成长创造额外作物。');return;}
 const p=CASES.find(p=>p.id===c.caseId)!,r=m.cases[c.caseId]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(p.title,p.story+' '+p.facts.join(' '));return;}
 if(c.type==='PREPARE'){r.status='PREPARED';r.method=c.method;ctx.note(p.title,c.method==='ABILITY'?p.ability:p.ordinary);return;}
 if(c.type==='REPORT'){r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`cultivator-case:${p.id}`,8);ctx.note(p.title,p.result+'G扮演+25、已知单项掌握+8。');return;}
 r.attemptWeek=s.week;r.contactOpen=true;
 if(c.caseId==='seed-bed'){g.seeds-=3;g.water--;g.plantedWeek=s.week;r.status='EXAMINED';r.outcome='GROWTH_RECORDED';ctx.note(p.title,'3枚原种子与1份水实际用于原箱，种植周已记录。先0行动退开，至少下一周再照护、两周后才可收获。');return;}
 if(c.caseId==='shared-basket'){g.produce--;g.delivered++;r.status='EXAMINED';r.outcome='PORTION_DELIVERED';ctx.note(p.title,p.result+'先0行动放回空交付篮并结束本次事项。');return;}
 const result=ctx.check('knowledge',r.method==='ABILITY'?8:10);
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='EXAMINED';r.outcome='SOIL_RECORDED';ctx.note(p.title,p.result+'先0行动放稳原记录并退开。');}else{r.status='OBSERVED';if(result.tier==='GREAT_FAILURE')s.mind=Math.max(0,s.mind-5);ctx.note(p.title,'本次记录不够清楚，不能据此确定种植判断。成本保留，先实际退开，下周可再核对。');}
}
export function cultivatorGarden(s:SliceState):string{const g=s.cultivator.garden;return `原种子${g.seeds}/3，原用水${g.water}/2；${g.plantedWeek===null?'尚未播种':`第${g.plantedWeek}周播种`}，${g.caredWeek===null?'尚未跨周照护':`第${g.caredWeek}周照护`}，${g.harvestWeek===null?'尚未收获':`第${g.harvestWeek}周收获2份`}。现有原叶菜${g.produce}份，已实际交出${g.delivered}份。`;}
export function cultivatorActions(s:SliceState):CultivatorAction[]{if(s.progression.pathwayId!=='mother'||s.progression.sequence!==9)return[];const out:CultivatorAction[]=[];const add=(id:string,label:string,cost:string,command:CultivatorActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};const g=s.cultivator.garden;
 if(!g.suppliesBought)add('garden-buy','购买本场原种子与用水包','60便士 · 0行动 · 仅一包',{type:'BUY_GARDEN'});
 if(g.plantedWeek!==null&&g.caredWeek===null)add('garden-care','下一周照护原箱','1行动 · 原水1份',{type:'CARE'});
 if(g.plantedWeek!==null&&g.harvestWeek===null)add('garden-harvest','到时实际收获这一箱','1行动 · 播种两周后且已照护',{type:'HARVEST'});
 for(const p of CASES){const r=s.cultivator.cases[p.id]!;if(r.contactOpen)add(p.id+'-close','放稳原物并退开','0行动',{type:'CLOSE',caseId:p.id});if(r.status==='AVAILABLE')add(p.id+'-observe','查看原现场与许可','1行动',{type:'OBSERVE',caseId:p.id});if(r.status==='OBSERVED'){add(p.id+'-ability','准备G栽培知识实践','1行动',{type:'PREPARE',caseId:p.id,method:'ABILITY'});add(p.id+'-ordinary','准备普通核对与操作','1行动',{type:'PREPARE',caseId:p.id,method:'ORDINARY'});}if(r.status==='PREPARED'){add(p.id+'-perform','实际执行已准备的方法','1行动',{type:'PERFORM',caseId:p.id});add(p.id+'-withdraw','取消尚未实施的准备','0行动',{type:'WITHDRAW',caseId:p.id});}if(r.status==='EXAMINED')add(p.id+'-report','报告本场原事实','1行动',{type:'REPORT',caseId:p.id});}if(!s.cultivator.reflected)add('cultivator-reflect','回看照护、时间与收获','1行动 · 三报告后',{type:'REFLECT'});return out;}
export function cultivatorCases(s:SliceState):CultivatorProjection['cases']{if(s.progression.pathwayId!=='mother')return[];return CASES.map(p=>{const r=s.cultivator.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts],preparation:r.status==='PREPARED'?(r.method==='ABILITY'?p.ability:p.ordinary):null,result:['EXAMINED','RESOLVED'].includes(r.status)?p.result:r.attemptWeek!==null?'此前结果不足，原成本与未知保留。':r.withdrawals?'未实施的准备已取消。':null,status:r.status,contactOpen:r.contactOpen?'本次原操作仍须实际结束':'没有尚未结束的现场操作',closes:r.closes};});}
export function validateCultivatorLife(s:SliceState):boolean{const m=s.cultivator,g=m?.garden;if(!m?.cases||!g)return false;
 for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`cultivator-case:${p.id}`))return false;if(['EXAMINED','RESOLVED'].includes(r.status)){if(r.attemptWeek===null||r.method===null||r.outcome!==p.outcome)return false;}else if(r.outcome!=='NONE')return false;if(r.status==='RESOLVED'&&r.closes<1)return false;if(r.status==='PREPARED'&&r.method===null)return false;if(r.status==='AVAILABLE'&&(r.method!==null||r.attemptWeek!==null||r.withdrawals||r.closes))return false;if(r.closes>0&&r.attemptWeek===null)return false;if(r.contactOpen&&(!['OBSERVED','EXAMINED'].includes(r.status)||r.attemptWeek===null||r.method===null||s.activeEvent!==null||s.combat!==null||s.status!=='ACTIVE'||s.world.city!=='BACKLUND'))return false;}
 if(!g.suppliesBought&&(g.seeds||g.water||g.plantedWeek!==null||g.caredWeek!==null||g.harvestWeek!==null||g.produce||g.delivered))return false;
 if(g.suppliesBought&&(g.seeds!==(g.plantedWeek===null?3:0)||g.water!==(g.plantedWeek===null?2:g.caredWeek===null?1:0)))return false;
 if(g.caredWeek!==null&&(g.plantedWeek===null||g.caredWeek<=g.plantedWeek))return false;
 if(g.harvestWeek!==null&&(g.plantedWeek===null||g.caredWeek===null||g.harvestWeek<g.plantedWeek+2||g.harvestWeek<g.caredWeek))return false;
 if(g.produce+g.delivered!==(g.harvestWeek===null?0:2))return false;
 if((g.plantedWeek!==null)!==['EXAMINED','RESOLVED'].includes(m.cases['seed-bed']!.status))return false;
 if((g.delivered===1)!==['EXAMINED','RESOLVED'].includes(m.cases['shared-basket']!.status))return false;
 if(m.cases['seed-bed']!.status==='RESOLVED'&&g.harvestWeek===null)return false;
 return m.reflected===s.seer.completedSources.includes('cultivator-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));
}
