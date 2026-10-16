import { SLICE_LEARNING_TOPICS, SLICE_LIFE, SLICE_ORIGIN_EVENTS } from '../../content/slice-events.js';
import type { SliceChoice, SliceEvent, SliceState, SliceTarget } from './types.js';

const c = (id:string,label:string,preview='0行动 · 无额外费用',enabled=true,disabledReason='条件尚未满足'):SliceChoice => ({id,label,preview,enabled,...(enabled?{}:{disabledReason})});
export function currentEvent(s:SliceState):SliceEvent|null {
  if(!s.activeEvent) return null;
  let id=s.activeEvent.id;
  const facts:string[]=[];
  let title='',body='',choices:SliceChoice[]=[];
  const origin=SLICE_ORIGIN_EVENTS.find(x=>x.id===id);
  if(origin){ title=origin.title;body=origin.body;choices=[c('.accept',origin.accept,'0行动 · 记下可主动核实的普通线索'),c('.decline',origin.decline,'0行动 · 不影响首案调查入口')]; }
  else {
    if(id==='ARC-B'&&(s.world.audrey==='GONE'||!s.world.intermediaryAvailable))id='ARC-B-CANCEL';
    if(id==='ARC-C'){
      if(s.world.city!=='BACKLUND') id='ARC-REMOTE-CLOSE';
      else if(s.health<=0||s.mind<=0) id='C_WITHDRAW_UNFIT';
      else if(s.world.bell==='DESTROYED_VERIFIED') id='ARC-C-DESTROYED';
      else if(s.world.manager!=='ACTIVE') id='ARC-C-MANAGER';
    }
    switch(id){
      case 'ARC-A': title='消失的夜班';body=s.world.maeveAvailable?'梅芙的兄长连续数日没有回家。工场声称他已经离职，但未结的工资和宿舍物品并不支持这个说法。':'梅芙留下的工资凭据仍在。工场声称失踪工人已经离职，但工资与宿舍记录并不支持这个说法。';
        facts.push('可核材料：补写过的排班簿、未领取的工资尾款、工友证词。');
        choices=[c('A_LEDGER','核对工资与排班账','知识难度14 · 不再扣行动 · 失败仍有最小线索'),c('A_WORKERS','私下询问工友','感知难度15 · 不再扣行动 · 失败仍有最小线索'),c('A_FOREMAN','当面追问工头','意志难度18 · 不再扣行动 · 失败可能提高警觉')]; if(s.progression.pathwayId==='audience')choices.unshift(c('A_OBSERVE','留意工友的迟疑，再私下询问','感知难度12 · 本次调查内交谈 · 动作只提示该问什么，不直接证明真相')); if(s.progression.pathwayId==='hunter')choices.unshift(c('A_TRACK','辨认雨后货车痕迹','感知难度10 · 本次调查内观察原轮印 · 只确认实际方向'));break;
      case 'ARC-B': title='慈善账与工资账';body='一名私人代理人带来没有署名的委托信与工伤救济支出记录。一位关心东区状况的女士希望核实失踪者人数。你不需要加入任何组织。';
        facts.push('救济姓名、工资删改与已有证词可以交叉核对。');choices=[c('B_SHARE','接受并共享已证实事实','调查费 +240便士 · 完整交叉账 · 共享已有证人及调查路径'),c('B_LIMITED','接受费用，只共享必要事实','调查费 +120便士 · 必要交叉账 · 保留敏感来源'),c('B_REFUSE','拒绝委托，独立追查','0便士 · 仍可调查锅炉房')];break;
      case 'ARC-B-CANCEL': title='委托无法继续';body='原委托方已无法继续这次联系。尚未支付的费用不会凭空发放；你保留已经掌握的事实，可以独立追查。';choices=[c('CONTINUE_INDEPENDENT','保留记录，独立调查')];break;
      case 'ARC-REPORT': title='是否提交证据';body='你已经定位旧锅炉房。可以向可达的教会举报渠道提交允许分享的事实，也可以独自继续。收到报告不等于已经到场。';
        facts.push(s.arc.originalLedger||s.arc.credibleWitness?'已有可信原始账目或证词，可以组成可信报告。':'现有材料不足以组成可信报告；必要交叉账本身不能替代证人或原始账目。');
        choices=[c('REPORT','提交当前可共享证据','0行动 · 只有可信报告且经过下一周才可能到场',s.world.organizationAvailable,'目前没有可达接收方'),c('SKIP','暂不举报')];break;
      case 'ARC-CRISIS': title='管理方准备转移';body='追查窗口即将关闭。你必须决定现在介入，或明确停止本次追查。';
        if(s.arc.crisis) facts.push('现场已经出现严重伤亡；后来救援不能让死者回来。');
        choices=[c('INTERVENE','现在介入','0额外行动 · 进入现场选择'),c('ABANDON','放弃追查','0行动 · 保存已有记录并结束本次试玩')];break;
      case 'ARC-C': case 'ARC-C-MANAGER': title=id==='ARC-C'?'沉默的锅炉房':'责任人已经换了';
        body=id==='ARC-C'?'旧锅炉房仍有工人重复已经没有意义的劳动。此刻只能先保住一个目标：人、证据或危害控制。':(s.world.successorRegistered?'原管理者已无法出面。工人与记录仍能说明已发生的事；接手者不会因此继承原人的全部责任。':'原管理者已无法出面，现场无人主持。留下的工人和记录仍能说明已经发生的事。');
        if(s.world.bellAtScene&&['ACTIVE','TRANSFERRED'].includes(s.world.bell)) facts.push('现场铃声仍有影响；现场行动失败可能损失健康或精神。');
        if(s.arc.crisis) facts.push('已有严重伤亡，仍可帮助幸存者。');
        if(s.world.organizationArrived) facts.push('收到你可信报告的值夜者已实际到场。');
        choices=[c('C_EVACUATE',id==='ARC-C'?'先疏散工人':'先处理工人处境','意志难度17 · 大失败可能健康-4、精神-8 · 无额外行动'),c('C_EVIDENCE',id==='ARC-C'?'先固定罪证':'先核对责任记录','知识难度16 · 工人救援较迟 · 大失败可能精神-4')];
        if(s.progression.pathwayId==='diviner'&&s.world.bellAtScene&&['ACTIVE','TRANSFERRED'].includes(s.world.bell)&&!s.seer.completedSources.includes('first-case-sight-attempt'))choices.unshift(c('C_SIGHT','用灵视核对眼前异常','感知难度8（灵视-4） · 本次到场内一次 · 不揭露幕后身份'));
        if(s.world.bellAtScene&&s.world.bellHolder==='CARRIER'&&s.world.carrierAlive&&s.world.carrierCanResist&&s.world.bell==='ACTIVE') choices.push(c('C_PURSUIT','追踪携铃者',s.world.organizationArrived?'感知难度18 · 协助到场者追踪':'进入多回合战斗 · 可能受伤或死亡 · 不保证胜利'));
        if(s.progression.pathwayId==='hunter'&&s.world.bellAtScene&&s.world.bellHolder==='CARRIER'&&s.world.carrierAlive&&s.world.carrierCanResist&&s.world.bell==='ACTIVE'&&!s.world.organizationArrived)choices.push(c('C_TRAP_PURSUIT','在窄门布置绳套再追击','本次到场内布置1套实际绳索与木桩；敌人沿门接近打击才触发一次 · 战斗有死亡风险',s.hunter.trapHeld>0&&s.hunter.trapDeployed===0,'需实际持有一套原件，且没有另一处未收陷阱'));
        break;
      case 'ARC-C-DESTROYED': title='铃已经不在了';body='使工人反复劳动的影响已经停止，但伤者和被篡改的账目还在。你现在能做的是照顾人，或保住证据。';
        choices=[c('HELP',s.arc.crisis?'记录并安置幸存者':'照顾幸存工人','0行动 · 无新增铃声危险'),c('RECORD','固定剩下的账证',s.world.recordsAvailable?'知识难度16 · 无铃声损失':'确定记录已有证据 · 不掷无意义骰')];break;
      case 'ARC-C-TRANSFER': title=s.world.transferKnown?'箱子换了手':'箱子已不在现场';body=s.world.transferKnown?'箱子已经被另一个人带离现场。你保住的证据仍然有效。':'箱子已不在现场，去向尚未确认。你保住的证据仍然有效。';
        if(s.world.organizationAvailable&&s.world.transferKnown) choices.push(c('REPORT_TRANSFER','提交已知转移线索','只提交已知事实 · 不保证即时收容'));
        choices.push(c('KEEP',s.world.transferKnown?'记下去向，结束追击':'保留已知记录，结束追查'));break;
      case 'ARC-REMOTE-CLOSE': title='离开以后';body='贝克兰德的追查窗口已经结束。你不能在远方进行现场救援。';
        if(s.world.messageChannel&&s.world.organizationAvailable) choices.push(c('SEND_KNOWN','提交已知且允许分享的证据'));
        choices.push(c('KEEP_RECORD','保留已知记录'));break;
      case 'C_WITHDRAW_UNFIT':title='已经无法继续现场行动';body='当前健康或精神不足以支撑现场操作。可以保留已有证据，停止本次追查；本次试玩将在退出后收尾，存档保留当前身心状态供后续内容续接。';choices=[c('WITHDRAW','保留证据，停止现场追查')];break;
      case 'ZERO-BELL-01':title='先离开这里';body='你已经无法继续支撑现场行动。本次损失已结算，眼下只能离开危险处。';facts.push(`当前健康 ${s.health}，精神 ${s.mind}。不会重复扣损失或追加死亡盘。`);choices=[c('ACKNOWLEDGE','保留结果，离开现场')];break;
      case 'LIFE-BILL-01':title='本周尚未付清';body=`生活费应付 ${s.billAmount}便士，现有 ${s.cash}便士，差额 ${Math.max(0,s.billAmount-s.cash)}便士。先处理账单，再推进下一周。`;choices=[c('PAY_PART','支付现款，余款记欠','用现款支付至多应付额 · 余款周还30 · 下周转赤贫'),c('KEEP_RESERVE','保留现款，全部记欠','本周费用全部转应付款 · 下周转赤贫')];break;
      case 'LIFE-CARE-01':title='先处理伤口';body='休息让你缓过来一些，但重伤还没有处理好。普通处置不会立刻让伤势痊愈。';facts.push('处置后至少再休养一次，且健康达到80%，才可痊愈。');
        choices=[c('PAY','支付60便士处置','60便士 · 0额外行动',s.cash>=60,'现款不足60便士')];if(s.credit!=='SUSPENDED') choices.push(c('CREDIT','记下医疗欠款','欠款60便士 · 下周起周还12 · 无复利'));choices.push(c('DECLINE','暂不处置'));break;
      case 'CARE-WORK-OFFER':title='用一次帮忙换处置';body='诊疗点有一批退回的物资签条需要核对。你可以坐着比较图记和编号，完成后换一次普通伤口处置；旧债另还。';choices=[c('ACCEPT','接下核对','需1次调查 · 感知难度12 · 失败可再花1次行动确定复核'),c('DECLINE','暂不接下')];break;
      case 'MARKET-CONTACT-01':title='先问清交易规矩';body='中间人愿意说明固定货目与交易方式。这里不保证出售任何特定魔药材料。可以核实这条渠道，也可以离开。';choices=[c('VERIFY','核实联系人','开放已核实渠道 · 本试玩尚无可售货目'),c('LEAVE','暂不建立渠道')];break;
      case 'DEBT-NOTICE-01':title='还款提醒';body=`你已连续 ${s.missedWeeks}周未付足约定款项。欠款余额 ${s.debts.reduce((n,d)=>n+d.remaining,0)}便士。对方要求说明接下来的安排。`;choices=[c('PLAN','说明下周按约偿还','只记承诺 · 不减债或重置欠付周数'),c('DECLINE','现在不作承诺')];break;
      case 'DEBT-SETTLE-01':title='给出处理办法';body='多次延期后，对方暂停增加赊账额度。你仍可以工作、调查和用现款交易，欠款需要实际偿还。';if(s.cash>0) choices.push(c('PAY','用现款偿还',`支付至多 ${Math.min(s.cash,s.debts.reduce((n,d)=>n+d.remaining,0))}便士`));choices.push(c('DEFER','保留欠款，继续谋生'));break;
      default: if(!origin) throw new Error('Unknown slice event definition');
    }
  }
  return {id,instanceId:s.activeEvent.instanceId,title,body,facts,choices,...(id==='ARC-A'&&s.world.maeveAvailable?{actor:'MAEVE' as const}:id==='ARC-B'?{actor:'INTERMEDIARY' as const}:{})};
}
export function learnTargets(s:SliceState):SliceTarget[]{return [...SLICE_LEARNING_TOPICS,...(s.progression.pathwayId==='diviner'?[{id:'learn.seer-notes',label:'整理已学占卜笔记',description:'1行动 · 神秘学记忆辅助，成功额外知识+2'}]:[])].filter(t=>!s.completedTopics.includes(t.id)).map(t=>({...t}));}
export function investigationTargets(s:SliceState):SliceTarget[]{
  const targets:SliceTarget[]=[];
  if(s.aid==='ACCEPTED'||s.aid==='CORRECT') targets.push({id:s.aid==='CORRECT'?'CARE-WORK-CORRECT':'CARE-WORK-CHECK',label:s.aid==='CORRECT'?'按标记复核签条':'核对退货签条',description:s.aid==='CORRECT'?'1行动 · 确定复核，完成后兑现处置':'1行动 · 感知难度12；失败不罚钱，可再复核'});
  if(s.arc.stage==='C_AVAILABLE'&&s.world.city==='BACKLUND') targets.push({id:'ARC-C',label:'调查旧锅炉房',description:'1行动 · 选择救人、取证或危险追击'});
  if(s.arc.stage==='NOT_STARTED') targets.push({id:'LIFE-LEAD-NIGHTSHIFT',label:'核对夜班工钱告示',description:'1行动 · 核对普通公开记录，开启首案'});
  for(const o of SLICE_ORIGIN_EVENTS) if(s.knownTargets.includes(o.lead)) targets.push({id:o.lead,label:o.label,description:'1行动 · 核实已知的普通线索，不额外收费'});
  if(!s.careKnown) targets.push({id:'CARE-ACCESS-01',label:'核实普通诊疗点',description:'1行动 · 仅核实渠道，不治疗、不收费'});
  if(s.knownTargets.includes('lead.market.contact')&&!s.marketUnlocked) targets.push({id:'lead.market.contact',label:'核实旧物中间人',description:'1行动 · 核实渠道，当前无正式商品'});
  return targets.slice(0,3);
}
export function nextStep(s:SliceState):string{
  if(s.status==='REVIVAL_PENDING')return '本人已真实战死；在有限复起页选择就近重组、等待或明确放弃，普通休养不能代替。';
  if(s.status==='ACTIVE'&&s.arc.stage==='ENDED'&&!s.activeEvent&&s.health>0&&s.mind>0)return s.progression.pathwayId==='error'?'首案卷宗已保存。偷盗者页可观察原物、选择实际取放并交还；财物所有权和柜员注意不会随手法成功消失，也可继续谋生休养。':s.progression.pathwayId==='hunter'&&s.progression.sequence===7?'首案卷宗已保存。纵火家页可练习有限火焰、查看砖院火险并处理原争议，也可继续普通生活。':s.progression.pathwayId==='diviner'&&s.progression.sequence===7?'首案卷宗已保存。魔术师页可准备原纸人与油灯，进行有限术式实践或处理剧场后巷事件。':s.progression.pathwayId==='moon'&&s.progression.sequence===8?'首案卷宗已保存。驯兽师页可了解动物意图、训练并参与有限协助，动物仍归原主人。':s.progression.pathwayId==='moon'?'首案卷宗已保存。药师页可准备有限护理药剂、观察伤情并选择护理或转诊，也可继续普通生活。':s.progression.pathwayId==='paragon'&&s.progression.sequence===8?'首案卷宗已保存。考古学家页可查阅现场资料、实地核对结构和安全路线，也可继续普通生活。':s.progression.pathwayId==='paragon'?'首案卷宗已保存。通识者页可学习原图纸、借用工具完成普通修理并交付，也可继续工作休养。':s.progression.pathwayId==='audience'?(s.progression.sequence===8?'首案卷宗已保存。读心者页可进行浅层读取和当面核实，也可继续工作、休养与整理行囊。':'首案卷宗已保存。观众页可接取观察与核实的社会实践，也可继续普通生活。'):s.progression.pathwayId==='hunter'&&s.progression.sequence===8?'首案卷宗已保存。挑衅者页可观察真实人物、选择激化或缓和争议，也可继续工作休养。':s.progression.pathwayId==='hunter'?'首案卷宗已保存。猎人页可接取有限追踪实践、布置实际陷阱和处理货道冲突。':s.progression.pathwayId==='diviner'&&s.progression.sequence===8?'首案卷宗已保存。小丑晋升页可购买纸张、进行实践与护送，也可继续工作或休养。':s.progression.pathwayId==='diviner'?'首案卷宗已保存。可在非凡成长中接取俱乐部委托，也可工作、学习或休养。':'首案卷宗已保存。继续谋生休养，也可在非凡成长中查看已开放途径及其任务。';
  if(s.status==='DEAD')return '本周目已最终死亡，只读封存。';
  if(s.status==='SLICE_COMPLETE')return '首案已收尾。可查看卷宗，或保留全部经历继续生活。';
  if(s.activeEvent)return '先处理当前事件，再继续行动。';
  if(s.combat)return '选择本回合姿态；所有转盘结果一次提交。';
  if(s.health<=0||s.mind<=0)return '先休养，恢复身体与精神。';
  if(s.arc.stage==='WAIT_B')return '继续日常生活，下一周会有案件消息。';
  if(s.arc.stage==='C_AVAILABLE')return s.arc.startWeek!==null&&s.week>=s.arc.startWeek+2?'追查窗口正在收紧。尽快调查旧锅炉房；继续等待可能造成无法挽回的后果。':'可调查旧锅炉房；也可等下一周，让可信报告有时间送达。';
  return `每周 ${s.weeklyBudget}次行动。工作 → 调查告示 → 休养是一个可选起步。当前生活：${SLICE_LIFE[s.lifeTier].label}。`;
}
