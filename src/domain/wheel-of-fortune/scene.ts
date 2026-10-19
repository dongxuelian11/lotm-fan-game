import { stableStringify } from '../canonical.js';
import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import { WHEEL_OF_FORTUNE_ABILITY_IDS, WHEEL_OF_FORTUNE_COMMISSIONS, WHEEL_OF_FORTUNE_EXIT_METRES, WHEEL_OF_FORTUNE_PRACTICE_COSTS, WHEEL_OF_FORTUNE_WORKERS, type WheelOfFortunePosition, type WheelOfFortuneWorkerId } from './content.js';
import type { WheelOfFortuneCommand, WheelOfFortuneEffect, WheelOfFortuneScene, WheelOfFortuneSceneHost, WheelOfFortuneSource } from './types.js';
const TYPES = ['LEAVE_ORIGINAL_COURT','ASK_OWNER','WITHDRAW_OWNER','VERIFY_PAPERS','INSPECT_EXIT','BUY_TOOLS','OPEN_EXIT','CLOSE_EXIT','APPROACH','INSPECT_DEVICE','ASK_WORKER','WITHDRAW_WORKER','ARRIVE_WORKER','CHOOSE_DESTINATION','HAND_OVER','EXIT_WORKER','REPORT_JUNCTION','NEXT_COMMISSION','START_PRACTICE','BUFFER_IMPACT','SECURE_LOAD','RELEASE_LOAD','CAPTURE_RETURN','WALK_THREE','APPLY_RETURN','WALK_BACK','STOP_METHOD','END_CONTACT','WAIT_10','WALK_EXIT','REPORT_RETURN'];
const CLEANUP = ['WITHDRAW_OWNER','WITHDRAW_WORKER','STOP_METHOD','END_CONTACT','WAIT_10','WALK_EXIT','WALK_BACK','EXIT_WORKER','CLOSE_EXIT','REPORT_RETURN'];
export const wheelOfFortuneCurrentCommission = (s: WheelOfFortuneScene) => s.commissions[s.commissionIndex]!;
const worker = (s: WheelOfFortuneScene, id: WheelOfFortuneWorkerId) => wheelOfFortuneCurrentCommission(s).workers.find(w => w.id === id);
const permitted = (s: WheelOfFortuneScene, h: WheelOfFortuneSceneHost) => s.owner.alive && s.owner.consent === 'GRANTED' && s.owner.permissionWeek === h.week;
const atRest = (s: WheelOfFortuneScene) => s.playerPosition === 'OUTSIDE' && s.commissions.every(c => c.workers.every(w => w.position !== 'ENTRY')) && !s.window && !s.contact && s.exit.door === 'CLOSED';
const done = (s: WheelOfFortuneScene) => wheelOfFortuneCurrentCommission(s).workers.every(w => w.decisionEventId && w.handoverEventId && w.destinationEventId && w.position === w.destination && w.cargo.position === w.destination);
const has = (s: WheelOfFortuneScene, type: string) => s.receipts.some(r => r.kind === type);
function windowCurrent(s: WheelOfFortuneScene, h: WheelOfFortuneSceneHost, seconds = 0): boolean {
 const w = s.window;
 if (!w || w.actorId !== h.actorId || !permitted(s,h) || w.permissionVersion !== s.owner.permissionVersion || h.second < w.createdAt || h.second + seconds >= w.expiresAt) return false;
 if (w.kind === 'IMPACT_BUFFER') return s.playerPosition === 'ENTRY' && w.targetId === s.load.id && w.targetVersion === s.load.version && s.load.visible && !s.load.releasedEventId && !s.load.secured;
 return w.targetId === h.actorId && w.recordedPosition === 'ENTRY' && (s.playerPosition === 'ENTRY' && !w.movedEventId || s.playerPosition === 'THREE' && !!w.movedEventId);
}
function cost(c: WheelOfFortuneCommand, s: WheelOfFortuneScene): WheelOfFortuneEffect {
 const e: WheelOfFortuneEffect = { actions:0,cash:0,spirituality:0,mind:0,health:0,seconds:1 };
 if(c.type==='ASK_WORKER'&&!worker(s,c.workerId)?.paidEventId)e.cash=20;
 if(c.type==='BUY_TOOLS')e.cash=30;
 if(['VERIFY_PAPERS','INSPECT_EXIT','INSPECT_DEVICE','SECURE_LOAD','REPORT_JUNCTION'].includes(c.type))e.seconds=30;
 if(c.type==='REPORT_RETURN'){e.actions=1;e.seconds=30;}
 if(c.type==='BUFFER_IMPACT'||c.type==='CAPTURE_RETURN'){e.actions=1;e.spirituality=12;e.mind=5;}
 if(c.type==='LEAVE_ORIGINAL_COURT')e.seconds=4;
 if(c.type==='APPROACH'||c.type==='ARRIVE_WORKER')e.seconds=2;
 if(c.type==='WALK_THREE'||c.type==='WALK_BACK'||c.type==='APPLY_RETURN'||c.type==='EXIT_WORKER')e.seconds=3;
 if(c.type==='RELEASE_LOAD')e.seconds=2;
 if(c.type==='WALK_EXIT')e.seconds=WHEEL_OF_FORTUNE_EXIT_METRES[s.playerPosition];
 if(c.type==='WAIT_10')e.seconds=10;
 return e;
}
export function createWheelOfFortuneScene(source: WheelOfFortuneSource): WheelOfFortuneScene {
 const site=source.originals.site;
 return { phase:'PREPARATION',status:'ACTIVE',playerPosition:site.playerLocation==='START'?'ORIGINAL_ENTRY':'OUTSIDE',playerTravelMetres:site.playerTravelMetres,originalDepartureEventId:null,
 owner:{id:'WF226-KEEPER',name:'伯纳德',age:42,alive:true,position:'OUTSIDE',consent:'CLOSED',permissionVersion:0,permissionWeek:null,permissionEventId:null},
 commissions:WHEEL_OF_FORTUNE_COMMISSIONS.map(c=>({id:c.id,title:c.title,registeredWeek:source.budget.week,workers:c.workers.map(w=>({...w,alive:true,health:100,energy:80,position:'OUTSIDE',walkedMetres:0,consent:'UNASKED',permissionVersion:0,permissionEventId:null,paidEventId:null,arrivalEventId:null,destination:null,decisionEventId:null,handoverEventId:null,destinationEventId:null,
 paper:{id:`${w.id}-ORIGINAL-PAPER`,originalOwnerId:w.id,holderId:w.id,location:'OUTSIDE',signedEventId:null,travelMetres:0},cargo:{id:`${w.id}-ORIGINAL-CARGO`,originalOwnerId:w.id,holderId:w.id,position:'OUTSIDE',travelMetres:0,version:0}})),papersVerifiedEventId:null,reportEventId:null,opportunityWeek:null,consumedEventId:null})),commissionIndex:0,
 originalOperation:structuredClone(source.originals.operation),originalLuck:structuredClone(source.originals.luck),exit:{inspectedEventId:null,door:'CLOSED'},toolsBoughtEventId:null,
 device:{inspectedEventId:null,loadFinishedEventId:null,returnFinishedEventId:null,loadMethod:'NONE',returnMethod:'NONE'},load:{id:'WF226-ORIGINAL-CRATE',position:'ENTRY',visible:false,secured:false,releasedEventId:null,dropCentimetres:0,version:0},rope:{id:'WF226-ORIGINAL-ROPE',integrity:100,wear:0,supportUsedEventId:null},returnWalkEventId:null,contact:false,window:null,moves:[],receipts:[],evacuationReportEventId:null,returnReportEventId:null,impactBufferApplied:false,shortReturnApplied:false };
}
export const isWheelOfFortuneSceneCommand=(c:WheelOfFortuneCommand):boolean=>TYPES.includes(c.type);
export const wheelOfFortuneSceneInside=(s:WheelOfFortuneScene):boolean=>!atRest(s)||s.owner.consent==='GRANTED'||wheelOfFortuneCurrentCommission(s).workers.some(w=>w.consent==='GRANTED');
export function wheelOfFortuneSceneBlock(s:WheelOfFortuneScene,c:WheelOfFortuneCommand,h:WheelOfFortuneSceneHost):string|null {
 if(!isWheelOfFortuneSceneCommand(c))return '这不是交接站的现场行动。';
 if(h.health<=0||h.mind<=0)return '本人已经不能继续行动。';
 if(s.playerPosition==='ORIGINAL_ENTRY'&&c.type!=='LEAVE_ORIGINAL_COURT')return '先沿开放原门亲走四米到原工坊外。';
 const e=cost(c,s),commission=wheelOfFortuneCurrentCommission(s),w='workerId'in c?worker(s,c.workerId):null;
 if(h.actions<e.actions||h.cash<e.cash||h.spirituality<e.spirituality||h.mind<=e.mind)return '实际行动、费用、灵性或精神不足。';
 if('workerId'in c&&!w)return '这位成年人不属于当前独立委托。';
 if(s.returnReportEventId)return '本轮已经如实报告，原结果保留。';
 if(s.status==='ABORTED'&&!CLEANUP.includes(c.type)&&c.type!=='ASK_OWNER')return '本次已停止，先按实际位置沿普通侧路退出。';
 if(s.window&&!windowCurrent(s,h)&&!CLEANUP.includes(c.type))return '短前态联系已经失效，先结束短窗，成本保留。';
 if(['APPROACH','ASK_WORKER','ARRIVE_WORKER','CHOOSE_DESTINATION','HAND_OVER','INSPECT_DEVICE','BUFFER_IMPACT','SECURE_LOAD','RELEASE_LOAD','CAPTURE_RETURN','WALK_THREE','APPLY_RETURN'].includes(c.type)&&!permitted(s,h))return '先当面取得本周这次作业许可。';
 switch(c.type){
 case 'LEAVE_ORIGINAL_COURT':return s.playerPosition!=='ORIGINAL_ENTRY'||s.originalDepartureEventId?'已经实际离开原门口。':null;
 case 'INSPECT_EXIT':return s.playerPosition!=='OUTSIDE'||s.exit.inspectedEventId?'须在站外实际查明尚未检查的普通支撑与侧路。':null;
 case 'VERIFY_PAPERS':return s.phase!=='PREPARATION'||s.playerPosition!=='OUTSIDE'||commission.papersVerifiedEventId?'须在站外核对本项独立委托尚未核验的同一原凭证。':null;
 case 'BUY_TOOLS':return s.playerPosition!=='OUTSIDE'||s.toolsBoughtEventId?'须在站外实购尚未领取的同一套普通绳索与支撑。':null;
 case 'ASK_OWNER':return !atRest(s)||permitted(s,h)?'须在站外收好通路后询问本周本次许可。':null;
 case 'WITHDRAW_OWNER':return s.owner.consent!=='GRANTED'?'当前没有可撤回的许可。':null;
 case 'OPEN_EXIT':return !s.exit.inspectedEventId||s.exit.door==='OPEN'?'先实查普通侧路，再打开尚未开启的站门。':null;
 case 'CLOSE_EXIT':return s.playerPosition!=='OUTSIDE'||commission.workers.some(w=>w.position==='ENTRY')||s.exit.door!=='OPEN'?'先让本人和入口当事人实际退出，再关闭站门。':null;
 case 'APPROACH':return s.playerPosition!=='OUTSIDE'||!s.exit.inspectedEventId||s.exit.door!=='OPEN'?'先实查并打开普通站门，再亲走两米到交接台。':null;
 case 'WALK_EXIT':return ['OUTSIDE','ORIGINAL_ENTRY'].includes(s.playerPosition)?'本人当前不在交接站内。':null;
 case 'ASK_WORKER':return s.phase!=='PREPARATION'||!commission.papersVerifiedEventId||w!.consent==='GRANTED'||w!.destinationEventId?'先核对原凭证，已完成新去处者不能重新作同一决定。':null;
 case 'WITHDRAW_WORKER':return w!.consent!=='GRANTED'?'当前没有可撤回的同意。':null;
 case 'ARRIVE_WORKER':return s.phase!=='PREPARATION'||w!.position!=='OUTSIDE'||w!.consent!=='GRANTED'||w!.destinationEventId||!s.toolsBoughtEventId||s.playerPosition!=='ENTRY'?'本人须在安全交接台见证，成年人须本次同意后携原物实际步行进入。':null;
 case 'CHOOSE_DESTINATION':case 'HAND_OVER':
  if(s.phase!=='PREPARATION'||s.playerPosition!=='ENTRY'||w!.position!=='ENTRY'||w!.consent!=='GRANTED')return '须本人亲见仍在台前的本次同意者自行决定和交接。';
  if(!h.dosePrepared||!h.mature)return '先备妥同一成药，成为水银之蛇满十二周后再进行最后不可撤销的决定与交接。';
  if(c.type==='CHOOSE_DESTINATION')return w!.decisionEventId?'既成去处不可重选，也不会因失败改写。':null;
  return !w!.decisionEventId||!w!.destination||w!.handoverEventId?'须先由本人选择新去处；同一凭证货物仅交接一次。':null;
 case 'EXIT_WORKER':return w!.position!=='ENTRY'?'当事人须确实在交接台前才能步行离开。':null;
 case 'REPORT_JUNCTION':return s.phase!=='PREPARATION'||!done(s)||!atRest(s)||commission.reportEventId?'先亲见两人原物实际交接、走到各自新去处，本人退出并关闭站门。':null;
 case 'NEXT_COMMISSION':return s.phase!=='PREPARATION'||h.sequence!==1||!atRest(s)||!commission.reportEventId||!commission.consumedEventId&&commission.opportunityWeek===h.week?'当前尚无可继续的独立委托，已经发生的决定不能重做。':s.commissionIndex>=s.commissions.length-1?'三项原已登记的独立委托均已经历，不再补发。':null;
 case 'START_PRACTICE':return h.sequence!==0||s.phase!=='PREPARATION'||!atRest(s)?'须本人实际晋升并在站外开始有限应用。':null;
 case 'INSPECT_DEVICE':return s.phase!=='PRACTICE'||s.playerPosition!=='ENTRY'||s.device.inspectedEventId?'须亲到交接台查明同一原箱件、下一次载荷和三米侧路。':null;
 case 'BUFFER_IMPACT':return s.phase!=='PRACTICE'||!s.device.inspectedEventId||s.playerPosition!=='ENTRY'||s.load.releasedEventId||s.load.secured||s.window||has(s,'BUFFER_IMPACT')?'须亲见尚未释放的同一箱件，只开一次有代价短窗。':null;
 case 'SECURE_LOAD':return s.phase!=='PRACTICE'||s.playerPosition!=='ENTRY'||!s.device.inspectedEventId||!s.toolsBoughtEventId||s.load.releasedEventId||s.load.secured||s.window?'须在原箱件旁结束短窗后用实购绳索固定同一载荷。':null;
 case 'RELEASE_LOAD':return s.phase!=='PRACTICE'||s.playerPosition!=='ENTRY'||!s.device.inspectedEventId||s.load.releasedEventId||(!s.load.secured&&!(s.window?.kind==='IMPACT_BUFFER'&&windowCurrent(s,h,e.seconds)))?'须用普通绳索支撑，或在有效缓冲短窗内实际释放同一箱件。':null;
 case 'CAPTURE_RETURN':return s.phase!=='PRACTICE'||s.playerPosition!=='ENTRY'||!s.device.inspectedEventId||s.returnWalkEventId||s.window||has(s,'CAPTURE_RETURN')?'须在三米移动前记录本人当前位置，一次前态联系不能刷新。':null;
 case 'WALK_THREE':return s.phase!=='PRACTICE'||s.playerPosition!=='ENTRY'||!s.device.inspectedEventId||s.returnWalkEventId||s.window?.kind==='IMPACT_BUFFER'?'须从已查明入口首次真实步行三米，物件留原处。':null;
 case 'APPLY_RETURN':return s.phase!=='PRACTICE'||s.playerPosition!=='THREE'||s.window?.kind!=='SHORT_RETURN'||!s.window.movedEventId||!windowCurrent(s,h,e.seconds)?'须先实际走出三米，并在同一短前态联系有效时仅让本人返回。':null;
 case 'WALK_BACK':return s.playerPosition!=='THREE'?'本人须在真实三米处才能普通走回。':null;
 case 'END_CONTACT':return !s.window&&!s.contact?'当前没有待结束短窗。':null;
 case 'WAIT_10':return !s.window?'当前没有有限短窗可观察。':null;
 case 'STOP_METHOD':return s.status==='ABORTED'?'本次已经停止。':null;
 case 'REPORT_RETURN':return s.phase!=='PRACTICE'||!atRest(s)||!(s.status==='ABORTED'||s.device.loadFinishedEventId&&s.device.returnFinishedEventId)?'先普通退出并收好站门，完成有限操作或如实保留停止。':null;
 default:return '当前没有这项现场行动。';
 }
}
function closeConsent(s:WheelOfFortuneScene):void {if(s.owner.consent==='GRANTED'){s.owner.consent='CLOSED';s.owner.permissionVersion++;}for(const w of wheelOfFortuneCurrentCommission(s).workers)if(w.consent==='GRANTED'){w.consent='CLOSED';w.permissionVersion++;}}
function end(s:WheelOfFortuneScene):void{s.window=null;s.contact=false;}
function move(s:WheelOfFortuneScene,h:WheelOfFortuneSceneHost,actorId:'PLAYER'|WheelOfFortuneWorkerId,to:WheelOfFortunePosition,metres:number,mode:'WALK'|'RETURN'='WALK'):void {
 const w=actorId==='PLAYER'?null:worker(s,actorId)!,from=w?w.position:s.playerPosition;
 if(w){w.position=to;w.energy-=metres;w.walkedMetres+=metres;w.cargo.position=to;w.cargo.travelMetres+=metres;w.cargo.version++;if(!w.handoverEventId){w.paper.location=to;w.paper.travelMetres+=metres;}}
 else{s.playerPosition=to;s.playerTravelMetres+=metres;}
 s.moves.push({eventId:h.eventId,actorId,from,to,metres,seconds:metres,cargoId:w?.cargo.id??null,mode});
}
export function applyWheelOfFortuneScene(scene:WheelOfFortuneScene,c:WheelOfFortuneCommand,h:WheelOfFortuneSceneHost,check:(ability:PublicCoreStatKey,difficulty:number)=>PublicCheckResult):{state:WheelOfFortuneScene;effect:WheelOfFortuneEffect;notes:string[]} {
 const reason=wheelOfFortuneSceneBlock(scene,c,h);if(reason)throw Error(reason);
 const s=structuredClone(scene),e=cost(c,s),notes:string[]=[],commission=wheelOfFortuneCurrentCommission(s),w='workerId'in c?worker(s,c.workerId)!:null;
 switch(c.type){
 case 'LEAVE_ORIGINAL_COURT':move(s,h,'PLAYER','OUTSIDE',4);s.originalDepartureEventId=h.eventId;notes.push('本人沿原门真实走四米到工坊外。艾妲、薇拉、原车包盘袋签、旧预测与奥斯温既有投降伤势全部保持。');break;
 case 'INSPECT_EXIT':s.exit.inspectedEventId=h.eventId;notes.push('实查站门、各处通往街边的普通侧路及承重支撑，门关或技巧失败仍能步行出去。');break;
 case 'VERIFY_PAPERS':commission.papersVerifiedEventId=h.eventId;notes.push('逐件核对本项两位成年人原凭证、旧地点及本人仍持有的同一货物，排除现场干扰。此时没有预见或锁定未来契机。');break;
 case 'BUY_TOOLS':s.toolsBoughtEventId=h.eventId;notes.push('实付30便士领取同一套普通绳索与承重支撑，旧工具之后仍可使用。');break;
 case 'ASK_OWNER':s.status='ACTIVE';s.owner.consent='GRANTED';s.owner.permissionWeek=h.week;s.owner.permissionEventId=h.eventId;s.owner.permissionVersion++;notes.push('伯纳德当面同意本周这次现场作业；普通退路和撤回权保留。');break;
 case 'WITHDRAW_OWNER':s.owner.consent='WITHDRAWN';s.owner.permissionVersion++;s.status='ABORTED';end(s);notes.push('场地主撤回同意，短窗终止，既成人物决定与费用保留。');break;
 case 'OPEN_EXIT':s.exit.door='OPEN';notes.push('亲手打开普通站门。');break;
 case 'CLOSE_EXIT':s.exit.door='CLOSED';notes.push('确认无人仍在交接台，亲手关闭站门；街边侧路继续可用。');break;
 case 'APPROACH':move(s,h,'PLAYER','ENTRY',2);notes.push('本人真实走两米到交接台。');break;
 case 'ASK_WORKER':w!.consent='GRANTED';w!.permissionVersion++;w!.permissionEventId=h.eventId;w!.paidEventId??=h.eventId;notes.push(`${w!.name}独立同意本次交接，${e.cash?'实收20便士劳务费':'已收费用不重复收取'}；仍可撤回尚未实施部分。`);break;
 case 'WITHDRAW_WORKER':w!.consent='WITHDRAWN';w!.permissionVersion++;s.status='ABORTED';end(s);notes.push(`${w!.name}撤回后续同意；已经签定的去处、交接及费用不倒退。`);break;
 case 'ARRIVE_WORKER':move(s,h,w!.id,'ENTRY',2);w!.arrivalEventId??=h.eventId;notes.push(`${w!.name}携同一原凭证和货物真实走两米到交接台，消耗两点精力。`);break;
 case 'CHOOSE_DESTINATION':w!.destination=c.destination;w!.decisionEventId=h.eventId;w!.paper.signedEventId=h.eventId;notes.push(`${w!.name}亲自在原凭证上确认${c.destination==='NORTH_DEPOT'?'北侧新址':'南侧新址'}，决定不可撤销。尚未把未来机会当作保证。`);break;
 case 'HAND_OVER':w!.handoverEventId=h.eventId;w!.paper.holderId=`WF226-RECIPIENT-${w!.destination}`;w!.cargo.holderId=w!.paper.holderId;w!.cargo.version++;notes.push(`${w!.name}亲手将同一原凭证与货物交给新址收件人；凭证留交接台，原货物由其继续实际送往已选新址。旧决定和所有权转移不能重演。`);break;
 case 'EXIT_WORKER':{const delivered=!!w!.handoverEventId&&!!w!.destination,to=delivered?w!.destination!:'OUTSIDE';move(s,h,w!.id,to,delivered?3:2);e.seconds=delivered?3:2;if(delivered)w!.destinationEventId=h.eventId;w!.consent='CLOSED';w!.permissionVersion++;if(delivered&&done(s)&&s.playerPosition==='ENTRY'&&commission.opportunityWeek===null)commission.opportunityWeek=h.week;notes.push(`${w!.name}携同一货物真实走${e.seconds}米到${delivered?'已选新址':'站外'}，交接台可直接看见；精力、货物路程和已付费用保留。`);break;}
 case 'WALK_EXIT':{const metres=WHEEL_OF_FORTUNE_EXIT_METRES[s.playerPosition];end(s);move(s,h,'PLAYER','OUTSIDE',metres);notes.push(`本人沿普通侧路真实走${metres}米到站外，不借能力退出。`);break;}
 case 'REPORT_JUNCTION':commission.reportEventId=h.eventId;s.evacuationReportEventId=h.eventId;s.status='COMPLETED';closeConsent(s);notes.push(commission.opportunityWeek===h.week?'如实记录刚亲见的两项独立决定、同一原物交接与真实去处；契机已在第二次实际到达时察觉，只在该周有效。没有提前预言时刻，也不改写任何已经发生的决定。':commission.opportunityWeek===null?'如实记录两项原物交接与实际去处；本人未在汇合当下亲见完整变化，没有取得当周契机。已成人物决定与费用保留。':`如实记录第${commission.opportunityWeek}周已经亲见的独立变化；该周已经过去，迟报不会产生新的当周契机，已成人物决定与费用保留。`);break;
 case 'NEXT_COMMISSION':s.commissionIndex++;s.evacuationReportEventId=null;s.status='ACTIVE';closeConsent(s);notes.push('转向事先登记的下一项独立委托及另外两位成年人。全部旧委托、原人物决定、交接、费用和伤势保留，没有重置过去。');break;
 case 'START_PRACTICE':s.phase='PRACTICE';s.status='ACTIVE';closeConsent(s);notes.push('本人开始一次有限应用，已到新址的成年人及其原物不被召回。');break;
 case 'INSPECT_DEVICE':s.device.inspectedEventId=h.eventId;s.load.visible=true;notes.push('亲见同一箱件与下一次放下时对本人产生的八健康冲击，查清普通绳索支撑及可步行的三米侧路。');break;
 case 'BUFFER_IMPACT':case 'CAPTURE_RETURN':{const buffer=c.type==='BUFFER_IMPACT';s.window={kind:buffer?'IMPACT_BUFFER':'SHORT_RETURN',actorId:h.actorId,recordedPosition:'ENTRY',targetId:buffer?s.load.id:h.actorId,targetVersion:buffer?s.load.version:0,permissionVersion:s.owner.permissionVersion,createdAt:h.second+e.seconds,expiresAt:h.second+e.seconds+20,movedEventId:null};notes.push(buffer?'实付1行动、12灵性和5精神，开启只针对本人下一次已见载荷的二十秒缓冲短窗；物件尚未释放。':'实付1行动、12灵性和5精神，只记录同一本人当前入口位置并建立二十秒联系；健康、物件、时间与资源均未记录。');break;}
 case 'SECURE_LOAD':s.load.secured=true;s.load.version++;s.rope.supportUsedEventId=h.eventId;notes.push('用同一实购绳索和承重支撑固定原箱件，随后可普通下放。');break;
 case 'RELEASE_LOAD':{const ability=s.window?.kind==='IMPACT_BUFFER';let success=false;if(ability){const result=check('perception',WHEEL_OF_FORTUNE_PRACTICE_COSTS.impactBuffer.difficulty);success=['SUCCESS','GREAT_SUCCESS'].includes(result.tier);e.health=success?3:8;if(!success)e.mind+=2;}s.load.releasedEventId=h.eventId;s.load.dropCentimetres=8;s.load.version++;s.rope.wear++;s.rope.integrity--;s.device.loadFinishedEventId=h.eventId;s.device.loadMethod=ability?'ABILITY':'ORDINARY';if(success){s.impactBufferApplied=true;e.mastery=[WHEEL_OF_FORTUNE_ABILITY_IDS[0]];}end(s);notes.push(`本人实际放下同一箱件八厘米，由普通支撑接住；原绳磨损加一，物件不会复位。${ability?`本人这一次实际损失${e.health}健康${success?'，只减轻本次冲击':'，检定失败另减2精神'}`:'普通绳索已经受力，本人没有该次冲击伤害'}。`);break;}
 case 'WALK_THREE':move(s,h,'PLAYER','THREE',3);s.returnWalkEventId=h.eventId;if(s.window?.kind==='SHORT_RETURN')s.window.movedEventId=h.eventId;notes.push('本人确实从入口走出三米；原箱件、凭证和其他人全部留在原实际位置。');break;
 case 'APPLY_RETURN':{const result=check('will',WHEEL_OF_FORTUNE_PRACTICE_COSTS.shortReturn.difficulty),success=['SUCCESS','GREAT_SUCCESS'].includes(result.tier);if(success){move(s,h,'PLAYER','ENTRY',3,'RETURN');s.shortReturnApplied=true;s.device.returnFinishedEventId=h.eventId;s.device.returnMethod='ABILITY';e.mastery=[WHEEL_OF_FORTUNE_ABILITY_IDS[1]];notes.push('同一短前态联系使本人由真实三米处回到记录的入口；只发生位置变化，健康、精神、灵性、费用、时间和物件不回退。');}else{e.mind+=2;notes.push('短距回返检定失败，本人仍在真实三米处，额外损2精神；可沿普通侧路走回。');}end(s);break;}
 case 'WALK_BACK':end(s);move(s,h,'PLAYER','ENTRY',3);s.device.returnFinishedEventId=h.eventId;s.device.returnMethod='ORDINARY';notes.push('本人沿普通侧路实走三米返回入口，不增加未应用成功的技巧掌握。');break;
 case 'END_CONTACT':end(s);notes.push('结束当前短窗，已付成本与原物结果保留。');break;
 case 'WAIT_10':notes.push('实际等待十秒，不刷新联系或回退时间。');break;
 case 'STOP_METHOD':end(s);closeConsent(s);s.status='ABORTED';notes.push('停止本次操作，人物、原物和既成决定留在实际位置，普通退出仍可行。');break;
 case 'REPORT_RETURN':s.returnReportEventId=h.eventId;s.status='COMPLETED';closeConsent(s);notes.push('如实报告有限操作或停止以及普通返程。技巧失败同样能收束，仅确实应用成功才增加掌握。');break;
 }
 s.receipts.push({eventId:h.eventId,kind:c.type,actorId:w?.id??'PLAYER',position:s.playerPosition,targetVersion:s.load.version});
 if(s.window&&!windowCurrent(s,{...h,second:h.second+e.seconds})){end(s);notes.push('短窗因到期或条件改变结束，实际成本不退。');}
 return {state:s,effect:e,notes};
}
export function desiredWheelOfFortuneSceneCommand(s:WheelOfFortuneScene,h:WheelOfFortuneSceneHost):WheelOfFortuneCommand|null {
 const commission=wheelOfFortuneCurrentCommission(s);
 const cleanup=():WheelOfFortuneCommand|null=>{if(s.window)return {type:'END_CONTACT'};const w=commission.workers.find(w=>w.position==='ENTRY');if(w)return {type:'EXIT_WORKER',workerId:w.id};if(s.playerPosition!=='OUTSIDE')return {type:'WALK_EXIT'};if(s.exit.door==='OPEN')return {type:'CLOSE_EXIT'};return null;};
 if(s.playerPosition==='ORIGINAL_ENTRY')return {type:'LEAVE_ORIGINAL_COURT'};
 if(s.returnReportEventId)return null;
 if(s.status==='ABORTED'){const c=cleanup();if(c)return c;if(s.phase==='PRACTICE')return {type:'REPORT_RETURN'};return {type:'ASK_OWNER'};}
 if(s.phase==='PREPARATION'){
  if(commission.reportEventId){if(h.sequence===0)return {type:'START_PRACTICE'};return commission.consumedEventId||commission.opportunityWeek!==h.week?{type:'NEXT_COMMISSION'}:null;}
  if(!s.exit.inspectedEventId)return {type:'INSPECT_EXIT'};
  if(!commission.papersVerifiedEventId)return {type:'VERIFY_PAPERS'};
  if(!s.toolsBoughtEventId)return {type:'BUY_TOOLS'};
  if(!h.dosePrepared||!h.mature)return null;
  if(done(s)){const c=cleanup();return c??{type:'REPORT_JUNCTION'};}
 } else if(s.device.loadFinishedEventId&&s.device.returnFinishedEventId){return cleanup()??{type:'REPORT_RETURN'};}
 if(s.window){if(!windowCurrent(s,h))return {type:'END_CONTACT'};return {type:s.window.kind==='IMPACT_BUFFER'?'RELEASE_LOAD':s.playerPosition==='ENTRY'?'WALK_THREE':'APPLY_RETURN'};}
 if(!permitted(s,h)){if(!atRest(s))return {type:'STOP_METHOD'};return {type:'ASK_OWNER'};}
 if(s.exit.door==='CLOSED')return {type:'OPEN_EXIT'};
 if(s.playerPosition==='OUTSIDE')return {type:'APPROACH'};
 if(s.phase==='PREPARATION'){
  const w=commission.workers.find(w=>!w.destinationEventId)!;
  if(w.consent!=='GRANTED')return {type:'ASK_WORKER',workerId:w.id};
  if(w.position==='OUTSIDE')return {type:'ARRIVE_WORKER',workerId:w.id};
  if(!w.decisionEventId)return {type:'CHOOSE_DESTINATION',workerId:w.id,destination:commission.workers.indexOf(w)===0?'NORTH_DEPOT':'SOUTH_DEPOT'};
  if(!w.handoverEventId)return {type:'HAND_OVER',workerId:w.id};
  return {type:'EXIT_WORKER',workerId:w.id};
 }
 if(!s.device.inspectedEventId)return {type:'INSPECT_DEVICE'};
 if(!s.device.loadFinishedEventId){if(!has(s,'BUFFER_IMPACT')&&h.actions>=3)return {type:'BUFFER_IMPACT'};return {type:s.load.secured?'RELEASE_LOAD':'SECURE_LOAD'};}
 if(!s.returnWalkEventId){if(!has(s,'CAPTURE_RETURN')&&h.actions>=2)return {type:'CAPTURE_RETURN'};return {type:'WALK_THREE'};}
 if(s.playerPosition==='THREE')return {type:'WALK_BACK'};
 return cleanup()??{type:'REPORT_RETURN'};
}
function label(c:WheelOfFortuneCommand):string {
 if('workerId'in c){const name=WHEEL_OF_FORTUNE_WORKERS.find(w=>w.id===c.workerId)?.name??'当事人';const action={ASK_WORKER:'独立同意并核付劳务费',WITHDRAW_WORKER:'撤回尚未实施部分',ARRIVE_WORKER:'携同一原物实走到交接台',CHOOSE_DESTINATION:'亲自选择并签定新去处',HAND_OVER:'亲手交出同一原凭证与货物',EXIT_WORKER:'携同一货物真实走到新去处'}[c.type];return `${name}${action}`;}
 const labels:Partial<Record<WheelOfFortuneCommand['type'],string>>={LEAVE_ORIGINAL_COURT:'沿原门真实步行四米退出',ASK_OWNER:'当面取得本周现场许可',WITHDRAW_OWNER:'撤回本次现场许可',VERIFY_PAPERS:'核对本项两人的同一原凭证',INSPECT_EXIT:'查明普通支撑与侧路',BUY_TOOLS:'实购同一套普通绳索与支撑',OPEN_EXIT:'打开普通站门',CLOSE_EXIT:'退出后关闭普通站门',APPROACH:'本人实走两米到交接台',INSPECT_DEVICE:'亲查同一箱件与三米侧路',REPORT_JUNCTION:'亲历后记录本次独立变化汇合',NEXT_COMMISSION:'查看下一项原已登记的独立委托',START_PRACTICE:'开始本人有限应用',BUFFER_IMPACT:'实付开启下一次已见冲击缓冲',SECURE_LOAD:'用普通绳索固定同一箱件',RELEASE_LOAD:'实际放下同一原箱件',CAPTURE_RETURN:'实付记录本人当前入口短前态',WALK_THREE:'本人先真实步行三米',APPLY_RETURN:'沿同一短前态联系尝试本人回返',WALK_BACK:'本人普通步行三米返回',STOP_METHOD:'停止并保留实际结果',END_CONTACT:'结束当前短窗',WAIT_10:'实际等待十秒',WALK_EXIT:'本人沿普通侧路步行退出',REPORT_RETURN:'如实报告操作或停止与返程'};
 return labels[c.type]??'继续实际行动';
}
export function wheelOfFortuneSceneActions(s:WheelOfFortuneScene,h:WheelOfFortuneSceneHost):{command:WheelOfFortuneCommand;label:string;cost:string}[]{
 const commands:WheelOfFortuneCommand[]=[],add=(c:WheelOfFortuneCommand)=>{if(isWheelOfFortuneSceneCommand(c)&&!commands.some(x=>stableStringify(x)===stableStringify(c)))commands.push(c);};
 const next=desiredWheelOfFortuneSceneCommand(s,h);if(next)add(next);
 if(!s.returnReportEventId){
  if(s.window){add({type:'END_CONTACT'});add({type:'WAIT_10'});}
  if(!['OUTSIDE','ORIGINAL_ENTRY'].includes(s.playerPosition))add({type:'WALK_EXIT'});
  if(s.playerPosition==='THREE')add({type:'WALK_BACK'});
  for(const w of wheelOfFortuneCurrentCommission(s).workers){if(w.position==='ENTRY')add({type:'EXIT_WORKER',workerId:w.id});if(w.consent==='GRANTED')add({type:'WITHDRAW_WORKER',workerId:w.id});if(next?.type==='CHOOSE_DESTINATION'&&next.workerId===w.id)for(const destination of ['NORTH_DEPOT','SOUTH_DEPOT']as const)add({type:'CHOOSE_DESTINATION',workerId:w.id,destination});}
  if(s.owner.consent==='GRANTED')add({type:'WITHDRAW_OWNER'});
  if(s.status==='ACTIVE')add({type:'STOP_METHOD'});
  if(s.phase==='PRACTICE'&&s.playerPosition==='ENTRY'&&!s.window)for(const type of ['BUFFER_IMPACT','SECURE_LOAD','RELEASE_LOAD','CAPTURE_RETURN','WALK_THREE']as const)if(!wheelOfFortuneSceneBlock(s,{type},h))add({type});
 }
 return commands.map(c=>{const e=cost(c,s);return {command:c,label:label(c),cost:[`${e.actions}行动`,...(e.cash?[`${e.cash}便士`]:[]),...(e.spirituality?[`${e.spirituality}灵性`]:[]),...(e.mind?[`${e.mind}精神`]:[]),`${e.seconds}秒`].join(' · ')};});
}
