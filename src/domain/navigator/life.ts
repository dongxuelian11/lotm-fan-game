import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import {NAVIGATOR_PLAN_IDS,type NavigatorCommand,type NavigatorActivityCommand,type NavigatorAction,type NavigatorProjection,type NavigatorCaseId} from './types.js';
const CASES=[
 {id:'tide-crossing',title:'潮口的两条短路',story:'码头信差要把原封班次单送到同一岸边的值守棚。直穿两条船之间看起来更短，沿护岸绕行较长；艾洛让你先看当前水流、船位与原出口，而非凭职业名称保证平安。',facts:['原两船之间的流向正与船体摆动交错，不是当前可用的穿越窗口。','同一岸边有原护岸短路，值守员愿意同行，原入口仍可退回。'],plans:[['SHORE_GUIDE','沿原护岸短路带路'],['CROSS_CURRENT','假定现在能直穿交错流道']],good:['SHORE_GUIDE'],prepared:'你指明原护岸短路和退回点，与本人愿意同行的值守员确认后才开始；班次单仍由信差本人保管。',result:'你们沿本次已观察的原护岸短路抵达值守棚，信差把原封班次单交给原收件人，再沿原路返回。没有把一次成功解释成任何潮流都安全。',attribute:'perception',difficulty:16},
 {id:'harbour-weather',title:'云层压低时的返港判断',story:'一艘原维修艇正停在内港系泊位，三名成年当班人员询问接下来该如何转移到遮蔽泊位。远处风云在变化，本次不要求你探索未知海域。',facts:['远处云层加厚，外水域能见度正变差；现有资料不能保证出港后的天气。','内港沿岸回路和原遮蔽泊位仍可见，原船员能操作本艇并保留退回原泊位的选择。'],plans:[['INSHORE_RETURN','选择已见内港回路与遮蔽泊位'],['OPEN_WATER','把航向直觉当作外海安全保证']],good:['INSHORE_RETURN'],prepared:'你把已见趋势与未知明确告诉原船员，大家同意只走有限内港回路，检查本次原艇与原系泊安排；没有自动招来船或船员。',result:'原船员依据本次有限判断转移到原遮蔽泊位并完成系泊。你交回记录，经原岸侧步道离开；外海天气仍没有被你的能力改变。',attribute:'knowledge',difficulty:16},
 {id:'waterline-cleanup',title:'被泥渍遮住的岸侧刻度',story:'维修站的一块原岸侧刻度牌沾上泥渍，管理员同意清洁牌面但要求不要磨掉原刻度，也别把污水引到人的站位上。这是小范围练习，不是治疗或净化污染。',facts:['原刻度牌固定在岸侧工作台，所有人都在干燥站位，不需下水。','管理员提供原布具与接水浅盘；泥渍是普通污渍，清洁后仍须本人复核刻线。'],plans:[['WATER_RINSE','凝出少量清水清洁，再擦干核对'],['CLOTH_CLEAN','借原布具逐段擦净并核对']],good:['WATER_RINSE','CLOTH_CLEAN'],prepared:'你把原接水盘放到刻度牌下，借好原布具，与管理员约定清洁范围。有限水法2灵性；普通布具方法不耗灵性，原工具都要交还。',result:'原刻度重新可读，你与管理员逐段复核后擦干牌面并交还原布具、接水盘。清水和污水都不是可反复出售的新增物品，牌与工具的物权未变。',attribute:'knowledge',difficulty:14},
] as const;
export const NAVIGATOR_ENVIRONMENT='航向、天气与水法都须面对当前条件。原著支持有限水术和更久水下活动，不保证任何深度、负重或未知海域安全。本作仅有限内港作业；不提供现实下水操作教程。水法清洁2灵性、判定与行动数是G，未授予风、雷或海啸。';
export const isNavigatorActivity=(c:NavigatorCommand):c is NavigatorActivityCommand=>['SURVEY','PLAN','PERFORM','WITHDRAW','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:NavigatorActivityCommand):string|null{
 if(s.status!=='ACTIVE')return '当前周目已结束。';
 if(s.progression.pathwayId!=='tyrant'||s.progression.sequence!==7)return '先成为航海家。';
 if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';
 if(s.world.city!=='BACKLUND')return '需要本人回到内港原现场。';
 const r='caseId'in c?s.navigator.cases[c.caseId]:null;
 if(c.type==='WITHDRAW')return r?.status==='PLANNED'?null:'没有正在准备的本次路线。';
 if(s.health<=0||s.mind<=0)return '先休养恢复身体与精神。';
 if(s.actionsRemaining<1)return '需要1行动。';
 if(c.type==='REFLECT')return s.navigator.reflected?'已经回看本次三项实践。':CASES.some(p=>s.navigator.cases[p.id]?.status!=='RESOLVED')?'先完成三项有限实践。':null;
 if(!r)return '未知现场。';if(r.status==='RESOLVED')return '本次已经完成，不重复发奖。';
 if(c.type==='SURVEY')return r.status==='AVAILABLE'?null:'已经保留这次观察。';
 if(c.type==='PLAN')return r.status!=='SURVEYED'?'先亲见当前条件。':r.attemptWeek===s.week?'本周尝试已经结束，下周再安排。':!(NAVIGATOR_PLAN_IDS[c.caseId as NavigatorCaseId] as readonly string[]).includes(c.planId)?'本场没有这条已知方案。':null;
 if(r.status!=='PLANNED')return '先提出可行的有限方案并准备。';
 return r.planId==='WATER_RINSE'&&s.spirituality<2?'本次小范围水法需要2灵性，可取消后选普通布具方法或先休养。':null;
}
export function applyNavigatorActivity(s:SliceState,c:NavigatorActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void):void{
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.navigator;
 if(c.type==='WITHDRAW'){const r=m.cases[c.caseId]!;r.status='SURVEYED';r.planId=null;r.withdrawals++;ctx.note('在出发前收回方案','0行动取消本次准备，原船和原物仍处在未启动时的稳定位置，参与者解除临时安排；观察与已花行动保留，再开须重新花准备行动。');return;}
 s.actionsRemaining--;
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('navigator-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('掌握航向，也承认未知','你回看流向、天气和有限水法：能辨出一条路不意味着所有海域都安全，选择已见退路、如实报告未知、交还原工具也属于航海家的实践。扮演+25。');return;}
 const p=CASES.find(x=>x.id===c.caseId)!,r=m.cases[c.caseId]!;
 if(c.type==='SURVEY'){r.status='SURVEYED';ctx.note(p.title,p.story+' 亲见记录：'+p.facts.join(' '));return;}
 if(c.type==='PLAN'){
  if(!(p.good as readonly string[]).includes(c.planId)){r.mistakes++;r.attemptWeek=s.week;r.planId=null;ctx.note(p.title,'你提出的方案与已见流向或天气相冲突。原在场人员指出依据不足，本次未启程；行动已花，原船、人员和物件仍在原稳定位置，下周可以依据保留的观察重新安排。没有用失败假造受害者。');return;}
  r.planId=c.planId;r.status='PLANNED';ctx.note(p.title,p.prepared);return;
 }
 r.attemptWeek=s.week;const water=r.planId==='WATER_RINSE';if(water)s.spirituality-=2;
 const result=ctx.check(water?'will':p.attribute,water?14:p.difficulty);
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`navigator-case:${p.id}`,8);ctx.note(p.title,p.result+(water?' 本次实际消耗2灵性。':'')+' 扮演+25，已知能力单项掌握+8。');}
 else{r.status='SURVEYED';r.mistakes++;const severe=result.tier==='GREAT_FAILURE';if(severe)s.health-=5;ctx.note(p.title,'本次判断或操作未能完成目标，原人员按已约定退路返回原稳定位置，原布具和船仍在原保管下。'+(water?'本次2灵性已消耗。':'')+(severe?'你在收尾时擦伤，健康−5。':'')+'原观察保留，下周可重新准备，不凭空改变天气或追加水域能力。');}
}
export function navigatorActions(s:SliceState):NavigatorAction[]{
 if(s.progression.pathwayId!=='tyrant'||s.progression.sequence!==7)return [];
 const out:NavigatorAction[]=[];const add=(id:string,label:string,cost:string,command:NavigatorActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};
 for(const p of CASES){const r=s.navigator.cases[p.id]!;if(r.status==='AVAILABLE')add(p.id+'-survey','观察本次水流、天气或原物','1行动',{type:'SURVEY',caseId:p.id});if(r.status==='SURVEYED')for(const [planId,label]of p.plans)add(p.id+'-'+planId,label,'1行动 · 依据已见条件',{type:'PLAN',caseId:p.id,planId});if(r.status==='PLANNED'){add(p.id+'-perform','按已准备方案行动并返回','1行动'+(r.planId==='WATER_RINSE'?' · 2灵性':''),{type:'PERFORM',caseId:p.id});add(p.id+'-withdraw','取消本次准备，保留观察','0行动 · 已花行动不退',{type:'WITHDRAW',caseId:p.id});}}
 if(!s.navigator.reflected)add('navigator-reflect','回看航向与未知边界','1行动 · 三项实践后',{type:'REFLECT'});return out;
}
export function navigatorCases(s:SliceState):NavigatorProjection['cases']{if(s.navigator.promotionWeek===null)return [];return CASES.map(p=>{const r=s.navigator.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts],preparation:r.status==='PLANNED'?p.prepared:null,result:r.status==='RESOLVED'?p.result:r.mistakes?'此前方案或操作未成，原观察和已花行动保留；原人原物已经留在或退回稳定位置。':r.withdrawals?'此前准备已取消，观察保留。':null,status:r.status};});}
export function validateNavigatorLife(s:SliceState):boolean{const m=s.navigator;if(!m?.cases)return false;for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`navigator-case:${p.id}`))return false;if((r.status==='PLANNED'||r.status==='RESOLVED')&&!(p.good as readonly unknown[]).includes(r.planId))return false;if(r.status==='AVAILABLE'&&(r.planId!==null||r.attemptWeek!==null||r.mistakes||r.withdrawals))return false;if((r.status==='RESOLVED'||r.mistakes>0)&&r.attemptWeek===null)return false;}return m.reflected===s.seer.completedSources.includes('navigator-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));}
