import { ARCANE_SCHOLAR_GUIDE } from '../arcane-scholar/content.js';
import type { KnowledgeMentorAbilityId, KnowledgeMentorPreparationId } from './types.js';
export const KNOWLEDGE_MENTOR_GUIDE = ARCANE_SCHOLAR_GUIDE;
export const KNOWLEDGE_MENTOR_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const KNOWLEDGE_MENTOR_MIN_ARCANE_SCHOLAR_WEEKS = 12;
export const KNOWLEDGE_MENTOR_LABOUR_STEPS = 5;
export const KNOWLEDGE_MENTOR_BOTTLE_IDS = ['knowledge-mentor-potion-1', 'knowledge-mentor-potion-2', 'knowledge-mentor-potion-3'] as const;
export const KNOWLEDGE_MENTOR_FORMULA_STATUS = '知识导师作为通识者序列2的名称与编号，本次上传原文未核实，当前职业映射为本作候选G；完整配方、晋升仪式与专属能力也未知，不能断言原著无需仪式。本阶段使用明确G专业支持、独立序列2原瓶与实际准备，不重复炼金术士抽取原园生命的旧仪式。';
export const KNOWLEDGE_MENTOR_SOURCE_STATUS = '旧奥秘学者3的编号为跨段推定。新有限工序封装与现场校准全部原创G，只使用亲自读取的原制造记录、实际原件和有来源的一次性指令片，不凭名字取得万能知识或神器制造。原著直接编号的下一阶是文明启蒙者1；工业革命是其消化经历，真神文明画卷表现不属于本阶，均不提前开放。';
export const KNOWLEDGE_MENTOR_POTION_SOURCES = KNOWLEDGE_MENTOR_BOTTLE_IDS.map((id,index)=>({id,source:`${KNOWLEDGE_MENTOR_GUIDE}的独立知识导师候选G成品交接渠道本作G初始批次第${index+1}瓶序列2原瓶${id}；非奥秘学者或更早原瓶改装，名称映射、完整配方及原著仪式均未核，G专业支持必须另行准备。`}));
export const KNOWLEDGE_MENTOR_LABOUR_TASKS = ['核验本瓶独立封存记录','清点本瓶原箱与封签','整理本瓶批次供货清单','核对本瓶运输与收货凭据','完成本瓶独立交付复核'] as const;
export const KNOWLEDGE_MENTOR_PREPARATIONS: {id:KnowledgeMentorPreparationId;title:string;description:string}[] = [
 {id:'INSPECT_RECORDS',title:'查阅原制造与实际使用记录',description:'本人读取两原件的原装配、消耗、故障与回收记录，区分可证步骤和未验证推测，不下载他人记忆或补出隐藏知识；本次查阅不能代做新练习的两次实测。'},
 {id:'CHECK_ORIGINALS',title:'核对原件与本人状态',description:'逐件核对AL4-BOX-1与AL4-FRAME-1的原制造身份、位置、真实储能及耐久，记录旧园损毁与旧人结局；不免费补能、修复或复制原物。'},
 {id:'PLAN_WITHDRAWAL',title:'演练停机与普通返回',description:'本人沿原2米工作台演练原手柄停机、取回唯一原件与普通退出；指令中止不传送原物。三项准备均G支持，不冒充原著未知仪式。'},
];
export const KNOWLEDGE_MENTOR_ABILITIES: {id:KnowledgeMentorAbilityId;label:string;description:string}[] = [
 {id:'paragon.s2.protocol-binding',label:'有限工序封装（候选G）',description:'只把已实际核验的三个指定步骤封入一块真实取得的指令片，绑定原盒与原架。新片、安装、一次运行和原能量都须实际存在；失败不能重骰或退材料。战斗每轮至多一次，消耗已准备原片、5灵性及两原件各1储能，知识18，可失败或被干扰，有限贡献40/减势20均G；不生成额外行动者或第二轮盘。'},
 {id:'paragon.s2.bounded-calibration',label:'现场有限校准（候选G）',description:'仅针对当前实际可见原工序的有限设置；生活可以尝试停止低载受阻程序，失败仍能用原手柄停机。战斗每轮一次4灵性与本人1精神、知识18，成功仅给本轮下一次实际成功原造物动作增加18G贡献；纯防守原件动作则增加18G减势；没有后续动作便到期，不修耐久、不补能、不读取敌方隐藏弱点。'},
];
export const KNOWLEDGE_MENTOR_CONSUMPTION_RISK = '全部具体条件均为本作G：奥秘学者消化100、实际晋3后12整周、健康>20且精神>40；三项1行动专业准备完成，另付1行动及120便士检查当周场地。0行动独立确认服所选原瓶，意志30。大成功：晋2精神−8；成功：晋2精神−15；失败：仍3、健康−15精神−25排异+30；灾难：仍3、健康−25精神−45排异+60。原瓶与本次准备均耗尽。G专业支持仅为药物排异保底1，不保护战斗或普通死亡。成功四属性各+1，原17项掌握与奥秘学者消化100保留，两新项从0起；上限120且当前灵性不补满，原造物不充能不修复，原园不复绿、旧人不复活。';
