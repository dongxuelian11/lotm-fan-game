import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {HarvestpriestCommand,HarvestpriestActivityCommand,HarvestpriestAction,HarvestpriestProjection} from './types.js';
const CASES=[
 {id:'wilting-bed',title:'原苗畦没有因为称号自动丰收',story:'伊芙有一畦已经长成的6株本作叶菜苗，近期局部偏干。她明确允许你照护，并将本场照护后的一次有限3份收获赠与你。你可以买2份原水30便士，每次尝试用1份；可用G有限丰收照护配合原水，或普通照护。成功后仍至少到下一实际周才能收取，不改变天气，不凭空长出新苗。',facts:['6株原苗一直属于伊芙；她只授权本次照护并赠与这一回的有限收获。','本场最多3份，原苗畦不会重置或因成长再生作物。'],ability:'用1份原水并耗3灵性作G有限照护检定；成功支持眼前原苗，仍需实际等待。',ordinary:'用1份原水普通照护原苗，再按原生长状况记录，不施超凡催生。',result:'原苗畦得到实际支持，原水和已付灵性保留；到下一实际周才可收出本场3份原作物。',outcome:'BED_SUPPORTED'},
 {id:'shared-yield',title:'给出的两份不会留在行囊',story:'帮厨托马为原休息间提出两份叶菜需求，并同意接收伊芙已经赠与你的本场原收获。你要先确实收出3份，再当面交出2份；自己只能保留1份。人情与成长不会把交出去的食物复制回来，也不自动改变粮价或解救整座城市。',facts:['需求和本人接受均明确，本次只交出实际收获的2份。','原畦收获3份，交出2份后仅剩1份。'],ability:'以G丰收照护的责任核对数量和去向，实际交付；本次不再施术或耗灵性。',ordinary:'普通核对原物数量并交给本人，不另造收获。',result:'托马收到2份原作物，你保留1份。原畦、赠与和实际交付来源保留，没有额外钱款或粮食。',outcome:'YIELD_SHARED'},
 {id:'next-season',title:'计划不是下一季的粮食',story:'伊芙与你回看本次水源、照护、等待和实际去向。你们记录下一季仍需真实种子、原土地、时间与合适条件；眼前保留的一份只是本次食物，不把它自动变成种子或保证下季产量。计划可以调整，不能替代未来实际行动。',facts:['只有本季已发生的照护与3份收获，没有预支下季作物。','未来水源、天气、材料和产量仍需重新核实。'],ability:'整理G照护经验与限制，保留实际观察，不预知所有天气或操控自然。',ordinary:'普通整理账本与等待记录，写明未来未知条件。',result:'下季计划仅是一份记录，不生成种子、金币或新的作物，也没有改写天气。',outcome:'PLAN_RECORDED'},
] as const;
export const HARVESTPRIEST_ENVIRONMENT='原文核到丰收祭司7的名称，但本次没有独立法术表和完整配方。有限丰收照护与生命支持均为明确原创G，必须依赖眼前原苗、原水、实际等待与有限收获。不下放弗兰克S6杂交、高阶生命手杖区域催生，不保证未来天气或凭空粮食。';
export const harvestpriestInside=(s:SliceState)=>Object.values(s.harvestpriest.cases).some(r=>r.contactOpen);
export const isHarvestpriestActivity=(c:HarvestpriestCommand):c is HarvestpriestActivityCommand=>['OBSERVE','PREPARE','PERFORM','CLOSE','REPORT','WITHDRAW','REFLECT','BUY_WATER','HARVEST'].includes(c.type);
function blocked(s:SliceState,c:HarvestpriestActivityCommand):string|null{
 if(s.status!=='ACTIVE')return'当前周目已结束。';
 if(s.progression.pathwayId!=='mother'||(s.progression.sequence!==7&&!(s.progression.sequence===6&&c.type==='BUY_WATER')))return'先完成丰收祭司晋升。';
 const m=s.harvestpriest,g=m.plot,r='caseId'in c?m.cases[c.caseId]:null;
 if(c.type==='CLOSE')return r?.contactOpen?null:'没有尚未结束的原现场操作。';
 if(harvestpriestInside(s))return'先0行动放稳原物并退开。';
 if(s.activeEvent||s.combat)return'先处理当前事件或战斗。';
 if(s.world.city!=='BACKLUND')return'需要回到伊芙的原苗圃。';
 if(c.type==='WITHDRAW')return r?.status==='PREPARED'?null:'没有尚待取消的准备。';
 if(s.health<=0||s.mind<=0)return'先休养恢复身体与精神。';
 if(c.type==='BUY_WATER')return g.water>0?'先使用现有原水，不重复堆购。':s.cash<30?'本次2份原水需要30便士。':null;
 if(s.actionsRemaining<1)return'需要1行动。';
 if(c.type==='HARVEST')return g.careWeek===null?'先实际照护成功。':g.harvestWeek!==null?'这一原苗畦已经收完。':s.week<=g.careWeek?'至少下一实际周才能收获，不能瞬间催熟。':null;
 if(c.type==='REFLECT')return m.reflected?'已经回看这段经历。':CASES.some(p=>m.cases[p.id]?.status!=='RESOLVED')?'先完成三项真实报告。':null;
 if(!r)return'未知原事项。';if(r.status==='RESOLVED')return'这项记录已经完成。';
 if(c.type==='OBSERVE')return r.status!=='AVAILABLE'?'原观察已经保留。':c.caseId==='shared-yield'&&g.harvestWeek===null?'先实际收获，才有可交付的原作物。':null;
 if(c.type==='PREPARE')return r.status!=='OBSERVED'?'先观察本场原物与许可。':r.attemptWeek===s.week?'本周未成，下周可重新核对。':null;
 if(c.type==='REPORT')return r.status!=='EXAMINED'?'先完成原现场操作并退开。':c.caseId==='wilting-bed'&&g.harvestWeek===null?'原畦仍需等待，下一实际周收获后再报告。':null;
 if(r.status!=='PREPARED')return'先选择本次方法。';
 if(c.caseId==='wilting-bed')return g.careWeek!==null?'本场原苗已获支持，不能重置。':g.water<1?'本次照护需要1份原水。':r.method==='ABILITY'&&s.spirituality<3?'本次G有限照护另需3灵性。':null;
 if(c.caseId==='shared-yield')return g.produce<2||g.delivered!==0?'需要实际收获且尚未交出的2份。':null;
 return null;
}
export function applyHarvestpriestActivity(s:SliceState,c:HarvestpriestActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.harvestpriest,g=m.plot;
 if(c.type==='CLOSE'){const r=m.cases[c.caseId]!;r.contactOpen=false;r.closes++;ctx.note('放稳原物并退开','你结束本次观察或原箱操作，原畦留在伊芙苗圃，实际用水和照护记录保留；已经交出的作物不收回。0行动，不退成本、不治疗、不另抽盘。');return;}
 if(c.type==='WITHDRAW'){const r=m.cases[c.caseId]!;r.status='OBSERVED';r.method=null;r.withdrawals++;ctx.note('取消尚未实施的准备','原观察和已付行动保留；未实施的照护或交付没有发生。0行动取消。');return;}
 if(c.type==='BUY_WATER'){s.cash-=30;g.waterPacks++;g.water+=2;ctx.note('原照护用水实际交付','支付30便士取得2份本场原水，放在伊芙原畦旁的标记格。每次照护实际使用，不能凭能力生成。');return;}
 s.actionsRemaining--;
 if(c.type==='HARVEST'){g.harvestWeek=s.week;g.produce=3;ctx.note('原畦有限收获','经过实际照护和下一周等待，伊芙按原约定将这一回的3份叶菜交给你。原畦不重置，没有额外长出新苗。');return;}
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('harvestpriest-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('照料不能跳过时间','你区分有限支持、原水、实际等待和本人接受；计划不预支未来粮食。G扮演+25，原物不随成长恢复。');return;}
 const p=CASES.find(p=>p.id===c.caseId)!,r=m.cases[c.caseId]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(p.title,p.story+' '+p.facts.join(' '));return;}
 if(c.type==='PREPARE'){r.status='PREPARED';r.method=c.method;ctx.note(p.title,c.method==='ABILITY'?p.ability:p.ordinary);return;}
 if(c.type==='REPORT'){r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`harvestpriest-case:${p.id}`,8);ctx.note(p.title,p.result+'G扮演+25、已知单项掌握+8。');return;}
 r.attemptWeek=s.week;r.contactOpen=true;
 if(c.caseId==='shared-yield'){g.produce-=2;g.delivered+=2;r.status='EXAMINED';r.outcome='YIELD_SHARED';ctx.note(p.title,p.result+'先0行动结束本次交付。');return;}
 if(c.caseId==='next-season'){g.planRecorded=true;r.status='EXAMINED';r.outcome='PLAN_RECORDED';ctx.note(p.title,p.result+'先0行动放回记录并退开。');return;}
 g.water--;g.waterUsed++;if(r.method==='ABILITY')s.spirituality-=3;
 const result=ctx.check('knowledge',r.method==='ABILITY'?10:12);
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='EXAMINED';r.outcome='BED_SUPPORTED';g.careWeek=s.week;ctx.note(p.title,p.result+'先0行动放稳原记录并退开。');}else{r.status='OBSERVED';if(result.tier==='GREAT_FAILURE')s.mind=Math.max(0,s.mind-5);ctx.note(p.title,'本次记录不够清楚，不能据此确定种植判断。成本保留，先实际退开，下周可再核对。');}
}
export function harvestpriestPlot(s:SliceState):string{const g=s.harvestpriest.plot;return `原水现有${g.water}份、已用${g.waterUsed}份；${g.careWeek===null?'原苗尚未完成支持':`第${g.careWeek}周实际照护`}，${g.harvestWeek===null?'仍未收获':`第${g.harvestWeek}周收获3份`}。本次作物现有${g.produce}份，已交出${g.delivered}份；下季计划${g.planRecorded?'已记录，未预支产量':'尚未记录'}。`;}
export function harvestpriestActions(s:SliceState):HarvestpriestAction[]{if(s.progression.pathwayId!=='mother'||s.progression.sequence!==7)return[];const out:HarvestpriestAction[]=[];const add=(id:string,label:string,cost:string,command:HarvestpriestActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};const g=s.harvestpriest.plot;
 if(g.water===0&&g.careWeek===null)add('plot-buy','购买2份原照护用水','30便士 · 0行动',{type:'BUY_WATER'});
 if(g.careWeek!==null&&g.harvestWeek===null)add('plot-harvest','下一周实际收取原畦','1行动 · 照护成功后的下一实际周',{type:'HARVEST'});
 for(const p of CASES){const r=s.harvestpriest.cases[p.id]!;if(r.contactOpen)add(p.id+'-close','放稳原物并退开','0行动',{type:'CLOSE',caseId:p.id});if(r.status==='AVAILABLE')add(p.id+'-observe','查看原现场与许可','1行动',{type:'OBSERVE',caseId:p.id});if(r.status==='OBSERVED'){add(p.id+'-ability','准备G有限丰收照护',p.id==='wilting-bed'?'1行动 · 实施另耗原水1份及3灵性':'1行动 · 仅核对原物与记录',{type:'PREPARE',caseId:p.id,method:'ABILITY'});add(p.id+'-ordinary','准备普通核对与操作',p.id==='wilting-bed'?'1行动 · 实施另耗原水1份':'1行动',{type:'PREPARE',caseId:p.id,method:'ORDINARY'});}if(r.status==='PREPARED'){add(p.id+'-perform','实际执行已准备的方法','1行动',{type:'PERFORM',caseId:p.id});add(p.id+'-withdraw','取消尚未实施的准备','0行动',{type:'WITHDRAW',caseId:p.id});}if(r.status==='EXAMINED')add(p.id+'-report','报告本场原事实','1行动',{type:'REPORT',caseId:p.id});}if(!s.harvestpriest.reflected)add('harvestpriest-reflect','回看照护、时间与收获','1行动 · 三报告后',{type:'REFLECT'});return out;}
export function harvestpriestCases(s:SliceState):HarvestpriestProjection['cases']{if(s.progression.pathwayId!=='mother')return[];return CASES.map(p=>{const r=s.harvestpriest.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts],preparation:r.status==='PREPARED'?(r.method==='ABILITY'?p.ability:p.ordinary):null,result:['EXAMINED','RESOLVED'].includes(r.status)?p.result:r.attemptWeek!==null?'此前结果不足，原成本与未知保留。':r.withdrawals?'未实施的准备已取消。':null,status:r.status,contactOpen:r.contactOpen?'本次原操作仍须实际结束':'没有尚未结束的现场操作',closes:r.closes};});}
export function validateHarvestpriestLife(s:SliceState):boolean{const m=s.harvestpriest,g=m?.plot;if(!m?.cases||!g)return false;
 for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`harvestpriest-case:${p.id}`))return false;if(['EXAMINED','RESOLVED'].includes(r.status)){if(r.attemptWeek===null||r.method===null||r.outcome!==p.outcome)return false;}else if(r.outcome!=='NONE')return false;if(r.status==='RESOLVED'&&r.closes<1)return false;if(r.status==='PREPARED'&&r.method===null)return false;if(r.status==='AVAILABLE'&&(r.method!==null||r.attemptWeek!==null||r.withdrawals||r.closes))return false;if(r.closes>0&&r.attemptWeek===null)return false;if(r.contactOpen&&(!['OBSERVED','EXAMINED'].includes(r.status)||r.attemptWeek===null||r.method===null||s.activeEvent!==null||s.combat!==null||s.status!=='ACTIVE'||s.world.city!=='BACKLUND'))return false;}
 if(g.water+g.waterUsed!==g.waterPacks*2)return false;
 if(g.harvestWeek!==null&&(g.careWeek===null||g.harvestWeek<=g.careWeek))return false;
 if(g.produce+g.delivered!==(g.harvestWeek===null?0:3))return false;
 if((g.careWeek!==null)!==['EXAMINED','RESOLVED'].includes(m.cases['wilting-bed']!.status))return false;
 if((g.delivered===2)!==['EXAMINED','RESOLVED'].includes(m.cases['shared-yield']!.status))return false;
 if(g.planRecorded!==['EXAMINED','RESOLVED'].includes(m.cases['next-season']!.status))return false;
 if(m.cases['wilting-bed']!.status==='RESOLVED'&&g.harvestWeek===null)return false;
 return m.reflected===s.seer.completedSources.includes('harvestpriest-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));
}
