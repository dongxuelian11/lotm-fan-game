import { DREAM_WEAVER_GUIDE } from '../dream-weaver/content.js';
import type { DiscernerAbilityId, DiscernerPreparationId } from './types.js';
export const DISCERNER_GUIDE = DREAM_WEAVER_GUIDE;
export const DISCERNER_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const DISCERNER_MIN_DREAM_WEAVER_WEEKS = 12;
export const DISCERNER_LABOUR_STEPS = 5;
export const DISCERNER_BOTTLE_IDS = ['discerner-potion-1', 'discerner-potion-2', 'discerner-potion-3'] as const;
export const DISCERNER_FORMULA_STATUS = '洞察者2与下一阶作家1的名称编号已核；完整2阶配方和晋升仪式尚未披露，材料、用量、步骤保持未知，不能声称无需仪式。本阶段采用本作原创G专业支持、三项准备与独立序列2成品渠道，不重用操纵师万人集会或织梦人原瓶作为本阶原著仪式。';
export const DISCERNER_SOURCE_STATUS = '原文特定心灵印记感应发生在近处、目标虚拟人格活动于集体潜意识海时，巨龙的2阶身份本身仍是奥黛丽推断。不能据此推出全图读心、必知恶意、任意往事或无条件梦境迷宫。这里的三张原卡形成有限G印记、近距接触、保护媒介、现实复核及战斗洞察窗口全为保守原创扩展。旧21项能力与原人物原物完整保留；不下放作家故事编排或神级现实创造。';
export const DISCERNER_POTION_SOURCES = DISCERNER_BOTTLE_IDS.map((id,index)=>({id,source:`${DISCERNER_GUIDE}的独立洞察者成品交接渠道本作G初始批次第${index+1}瓶序列2原瓶${id}；非织梦人或更早原瓶改装，完整配方与原著仪式未知，G专业支持必须另行准备。`}));
export const DISCERNER_LABOUR_TASKS = ['核验本瓶独立封存记录','清点本瓶原交接箱与封签','整理本瓶批次供货清单','核对本瓶运输与收货凭据','完成本瓶独立交付复核'] as const;
export const DISCERNER_PREPARATIONS: {id:DiscernerPreparationId;title:string;description:string}[] = [
 {id:'INSPECT_ROUTE',title:'亲自踏查核验室原路',description:'本人实际确认近桌、远桌及普通出口的三米通路，记录停止接触不等于身体瞬移；不自动扫描其他房间。'},
 {id:'CHECK_ORIGINALS',title:'核对三张原卡与本人状态',description:'逐件核对新场原卡与保护媒介的实体ID及持有者，只记录封存外观，不提前读取卡内印记，不复制旧织梦人原纸。'},
 {id:'PLAN_WITHDRAWAL',title:'实际演练撤回与原物返还',description:'本人练习停止接触、询问当前许可、沿原路归还唯一原件，再返回出口；专业演练是G，不冒充未知原著仪式。'},
];
export const DISCERNER_ABILITIES: {id:DiscernerAbilityId;label:string;description:string}[] = [
 {id:'audience.s2.mental-imprint',label:'近距有限心灵印记（G）',description:'当次本人接近、对象确已接触本场原卡并自愿展现有限G印记后，6灵性与本人2精神、意志18，最多一次尝试。成功仅得到有限象征线索，还须亲取同一原卡现实核对；保护或拒绝不证明恶意。战斗可在抵抗后有限干扰，不全知或控制人格。'},
 {id:'audience.s2.insight-window',label:'有限洞察窗口（G）',description:'本场战斗每次付5灵性与本人1精神、意志18，每轮至多一次短暂判断窗口；对手既有精神护持可抵抗。具体优势42×掌握为G，不读取未知能力库，不保证命中或存活，结束不抹除真实消耗。'},
];
export const DISCERNER_CONSUMPTION_RISK = '全部具体执行条件为本作G：织梦人消化100、实际晋3后12整周、健康>20且精神>40，三项1行动专业准备完成，另付1行动和120便士检查当周场地；独立确认所选原瓶后0行动服药，意志难度30。大成功：晋2且精神−8；成功：晋2且精神−15；失败：仍3，健康−15、精神−25、排异+30；灾难：仍3，健康−25、精神−45、排异+60。原瓶及本次准备真实耗尽，支持仅使药物排异后的健康精神保底1，不保护战斗或普通死亡。成功四属性各+1，两项新掌握0，21项旧掌握和织梦人消化100留存；上限120且当前灵性不补满，不改变身体性别。';
