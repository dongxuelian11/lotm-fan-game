import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {MarauderCommand,MarauderActivityCommand,MarauderAction,MarauderProjection} from './types.js';

const CASES = [
 {id:'training-purse',item:'training-token',label:'原练习铜片',title:'愿意配合的练习袋',owner:'艾德温·洛克',initialCustodian:'HOLDER',initialLocation:'training-purse',sealed:false,
 story:'艾德温当面拿出有记号的铜片，放入自己的练习袋，同意你试取后交还。只许可这件铜片，不包括他的其它口袋或随身物。',
 facts:['你亲见铜片上的三角刻痕，原物属于艾德温。','练习袋在面前，艾德温清醒、同意本次练习；未公开其它物件。'],
 dex:'按本次同意范围练习巧手，只尝试这件亲见铜片。',ordinary:'请艾德温普通递出原铜片，再核对记号。',
 result:'你取得的是同一件带三角刻痕的铜片。练习可以失败，实际取得并不转让所有权。',report:'你记录了亲见原件、本人同意与实际取放，原铜片已交回艾德温。'},
 {id:'fallen-token',item:'brass-token',label:'露茜的原铜牌',title:'长凳缝里的铜牌',owner:'维修员露茜',initialCustodian:'SITE',initialLocation:'bench-gap',sealed:false,
 story:'露茜指给你看落在长凳浅缝里的铜牌，请你帮忙取回。另一位路人自称也丢了东西，但没有提供这件原牌的记号。',
 facts:['露茜在你取回前描述了背面缺角与绳孔旁刻线，正面在缝中可见。','浅缝可接近，不需破坏原长凳；路人的说法仍未核实。'],
 dex:'用灵活手指谨慎取出浅缝里的原铜牌。',ordinary:'借现场的普通小钩取原牌，用后当面放回。',
 result:'原牌已取出，背面的缺角与刻线和露茜事先描述相符；这只核实本件，不证明任何路人的全部说法。',report:'你把原牌交还露茜，说明是原记号的对照，没有把未经核实的路人说法当失主证明。'},
 {id:'sealed-dispatch',item:'sealed-letter',label:'安娜的原封信',title:'未交割的封信',owner:'委托人安娜',initialCustodian:'HOLDER',initialLocation:'dispatch-counter',sealed:true,
 story:'安娜在柜前核对一封原信，柜员尚未办妥交接。你可以等她和柜员当面同意后正常接过，也可以选择擅自伸手。后者会引起注意，不代表你取得所有权。',
 facts:['原信封口完整，内容没有公开，也没有许可拆封。','安娜仍是原主人；现在没有擅自取走的同意。柜员会保留对越过交割的注意。'],
 dex:'明确选择未等交割擅自取原信；可能失败，会留下柜员注意，成功也须归还。',ordinary:'等安娜与柜员完成当面核对，再短暂接过原封信。',
 result:'同一封信仍未拆封。持在手上只改变保管位置，不能把它变成自己的财物。',report:'你在安娜当面接回原信后记录了交接；若曾擅取，柜员的注意与当面说明仍保留，不被成功手法抹去。'},
] as const;
export const MARAUDER_ENVIRONMENT='三个有限原现场均为G原创：清醒成年当事人、亲见实物与实际交还。巧手是身体实践，不偷能力、灵性或记忆，不从远处读取库存。柜员注意与物主所有权分别保留；没有默认宝物雷达或全知失主识别。';
export const isMarauderActivity=(c:MarauderCommand):c is MarauderActivityCommand=>['OBSERVE','PREPARE','PERFORM','RETURN','REPORT','WITHDRAW','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:MarauderActivityCommand):string|null {
 if(s.status!=='ACTIVE')return '当前周目已结束。';
 if(s.progression.pathwayId!=='error'||s.progression.sequence!==9)return '先成为偷盗者。';
 if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';
 if(s.world.city!=='BACKLUND')return '需要回到贝克兰德原现场。';
 const r='caseId'in c?s.marauder.cases[c.caseId]:null;
 if(c.type==='WITHDRAW')return r?.status==='PREPARED'?null:'没有待结束的准备。';
 if(s.health<=0||s.mind<=0)return '先休养，恢复本人身体与精神。';
 if(c.type==='RETURN'){const p=CASES.find(p=>p.id===c.caseId);return r?.status==='EXAMINED'&&p&&s.marauder.originals[p.item]?.custodian==='PLAYER'?null:'需要先实际取得并仍持有该原件。';}
 if(s.actionsRemaining<1)return '需要1行动。';
 if(c.type==='REFLECT')return s.marauder.reflected?'已经回看本次经历。':CASES.some(p=>s.marauder.cases[p.id]?.status!=='RESOLVED')?'先完成三件原物的交还与报告。':null;
 if(!r)return '未知现场。';
 if(r.status==='RESOLVED')return '本次已经完成。';
 if(c.type==='OBSERVE')return r.status==='AVAILABLE'?null:'已保留原观察。';
 if(c.type==='PREPARE')return r.status!=='OBSERVED'?'先观察原物、范围与当事人。':r.attemptWeek===s.week?'本周尝试未成，下周可再准备。':null;
 if(c.type==='PERFORM')return r.status==='PREPARED'?null:'先准备本次实际方法。';
 const p=CASES.find(p=>p.id===c.caseId)!;
 return r.status==='EXAMINED'&&s.marauder.originals[p.item]?.custodian==='OWNER'?null:'先实际取得并交还同一原件，再报告。';
}
export function applyMarauderActivity(s:SliceState,c:MarauderActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void):void {
 const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.marauder;
 if(c.type==='WITHDRAW'){const r=m.cases[c.caseId]!;r.status='OBSERVED';r.method=null;r.withdrawals++;ctx.note('取消这次准备','0行动结束准备，原物未移动，已花行动不返。');return;}
 if(c.type==='RETURN'){const p=CASES.find(p=>p.id===c.caseId)!,o=m.originals[p.item]!;o.custodian='OWNER';o.location=`owner:${p.owner}`;o.version++;ctx.note('交还同一原物',`${p.owner}在原现场当面接回${p.label}。所有权一直未变，当前保管从你交回本人，原件版本+1；本次实际归还0行动。`);return;}
 s.actionsRemaining--;
 if(c.type==='REFLECT'){m.reflected=true;s.seer.completedSources.push('marauder-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('手中的东西与他人的界限','你回看了同意练习、核对失物与尚未交割的原信。灵活手法不等于全知、不会抹去注意，也不会自动取得财物所有权。扮演+25。');return;}
 const p=CASES.find(p=>p.id===c.caseId)!,r=m.cases[c.caseId]!,o=m.originals[p.item]!;
 if(c.type==='OBSERVE'){r.status='OBSERVED';ctx.note(p.title,p.story+' '+p.facts.join(' '));return;}
 if(c.type==='PREPARE'){r.status='PREPARED';r.method=c.method;ctx.note(p.title,c.method==='DEXTERITY'?p.dex:p.ordinary);return;}
 if(c.type==='REPORT'){r.conclusion=c.conclusion;if(c.conclusion==='CERTAIN'){r.mistakes++;ctx.note('报告越过了实际证据','你宣称熟练手法不会被发现、取得原物就等于所有。原当事人指出这不成立；没有扮演奖励，可按真实经历改正。');return;}r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`marauder-case:${p.id}`,8);ctx.note(p.title,p.report+'扮演+25，已知能力单项掌握+8。');return;}
 r.attemptWeek=s.week;
 if(p.id==='sealed-dispatch'&&r.method==='DEXTERITY')r.attention++;
 const result=ctx.check(r.method==='DEXTERITY'?'perception':'knowledge',r.method==='DEXTERITY'?8:10);
 if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){o.custodian='PLAYER';o.location='player:hand';o.version++;r.status='EXAMINED';ctx.note(p.title,p.result+' 原件当前由你保管，所有权未变，请当面交还。'+(r.attention?'柜员注意已保留。':''));}
 else{r.status='OBSERVED';if(result.tier==='GREAT_FAILURE')s.mind=Math.max(0,s.mind-5);ctx.note(p.title,'本次没能完成取放，原物仍在原处；实际尝试和'+(r.attention?'柜员注意':'消耗')+'保留，下周可改普通方法。'+(result.tier==='GREAT_FAILURE'?'精神−5。':''));}
}
export function marauderActions(s:SliceState):MarauderAction[]{if(s.progression.pathwayId!=='error'||s.progression.sequence!==9)return [];const out:MarauderAction[]=[];const add=(id:string,label:string,cost:string,command:MarauderActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};for(const p of CASES){const r=s.marauder.cases[p.id]!;if(r.status==='AVAILABLE')add(p.id+'-observe','观察原物与当事人','1行动',{type:'OBSERVE',caseId:p.id});if(r.status==='OBSERVED'){add(p.id+'-dexterity',p.id==='sealed-dispatch'?'准备擅自取原信（会留下注意）':'准备巧手取回亲见原件','1行动',{type:'PREPARE',caseId:p.id,method:'DEXTERITY'});add(p.id+'-ordinary','准备普通当面方法','1行动',{type:'PREPARE',caseId:p.id,method:'ORDINARY'});}if(r.status==='PREPARED'){add(p.id+'-perform','实际尝试原物取放','1行动 · '+(r.method==='DEXTERITY'?'感知难度8':'知识难度10'),{type:'PERFORM',caseId:p.id});add(p.id+'-withdraw','取消本次准备','0行动 · 不返已花行动',{type:'WITHDRAW',caseId:p.id});}if(r.status==='EXAMINED'){if(s.marauder.originals[p.item]!.custodian==='PLAYER')add(p.id+'-return','当面交还同一原物','0行动 · 需要本人可行动',{type:'RETURN',caseId:p.id});else{add(p.id+'-limited','如实报告取放与物权边界','1行动',{type:'REPORT',caseId:p.id,conclusion:'LIMITED'});add(p.id+'-certain','声称巧手不会被发现、拿到即归我','1行动 · 超出事实',{type:'REPORT',caseId:p.id,conclusion:'CERTAIN'});}}}if(!s.marauder.reflected)add('marauder-reflect','回看巧手与财物的界限','1行动 · 三案后',{type:'REFLECT'});return out;}
export function marauderCases(s:SliceState):MarauderProjection['cases']{if(s.progression.pathwayId!=='error')return [];return CASES.map(p=>{const r=s.marauder.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.facts,`现场注意：${r.attention}次；所有权始终属于${p.owner}。`],preparation:r.status==='PREPARED'?(r.method==='DEXTERITY'?p.dex:p.ordinary):null,result:r.status==='RESOLVED'?p.report+(r.mistakes?` 曾有${r.mistakes}次错误报告，现已更正。`:''):r.status==='EXAMINED'?(s.marauder.originals[p.item]!.custodian==='PLAYER'?'已实际取得，原物在你手中，尚待归还。':r.conclusion==='CERTAIN'?'原物已还，错误报告仍待更正。':'已实际交回原主人，待报告。'):r.attemptWeek!==null?'此前未能完成，原物未移动，实际尝试保留。':r.withdrawals?'准备已取消，原物未动。':null,status:r.status};});}
export function marauderOriginals(s:SliceState):MarauderProjection['originals']{return CASES.filter(p=>s.marauder.cases[p.id]!.status!=='AVAILABLE').map(p=>{const o=s.marauder.originals[p.item]!;return{id:o.id,label:p.label,owner:o.owner,custodian:({HOLDER:'原当面持有人',SITE:'原现场',PLAYER:'你',OWNER:'原主人'} as const)[o.custodian],location:o.location==='player:hand'?'你的手中':o.location.startsWith('owner:')?'原现场本人手中':p.id==='fallen-token'?'原长凳浅缝':'原现场持有人处',sealed:o.sealed,version:o.version};});}
export function validateMarauderLife(s:SliceState):boolean{const m=s.marauder;if(!m?.cases||!m.originals)return false;for(const p of CASES){const r=m.cases[p.id],o=m.originals[p.item];if(!r||!o||o.id!==p.item||o.owner!==p.owner||o.sealed!==p.sealed)return false;const obtained=['EXAMINED','RESOLVED'].includes(r.status);if(!obtained){if(o.version!==1||o.custodian!==p.initialCustodian||o.location!==p.initialLocation)return false;}else{if(!r.method||r.attemptWeek===null)return false;if(o.custodian==='PLAYER'){if(o.version!==2||o.location!=='player:hand'||r.status==='RESOLVED')return false;}else if(o.custodian!=='OWNER'||o.version!==3||o.location!==`owner:${p.owner}`)return false;}if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`marauder-case:${p.id}`))return false;if(r.status==='RESOLVED'&&r.conclusion!=='LIMITED')return false;if(r.status!=='RESOLVED'&&r.conclusion==='LIMITED')return false;if(r.conclusion==='CERTAIN'&&(r.status!=='EXAMINED'||r.mistakes<1||o.custodian!=='OWNER'))return false;if(r.status==='PREPARED'&&r.method===null)return false;if(r.status==='AVAILABLE'&&(r.attemptWeek!==null||r.method!==null||r.withdrawals||r.attention||r.mistakes||r.conclusion!==null))return false;if(p.id!=='sealed-dispatch'&&r.attention!==0)return false;if(p.id==='sealed-dispatch'&&obtained&&r.method==='DEXTERITY'&&r.attention<1)return false;}return m.reflected===s.seer.completedSources.includes('marauder-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));}
