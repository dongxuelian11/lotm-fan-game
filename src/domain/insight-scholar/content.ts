import { PROPHET_GUIDE } from '../prophet/content.js';
import type { InsightScholarAbilityId, InsightScholarPreparationId } from './types.js';

/** The S3 name, new abilities, supply and preparations are explicitly original G candidates. */
export const INSIGHT_SCHOLAR_GUIDE = PROPHET_GUIDE;
export const INSIGHT_SCHOLAR_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const INSIGHT_SCHOLAR_MIN_PROPHET_WEEKS = 12;
export const INSIGHT_SCHOLAR_LABOUR_STEPS = 5;
export const INSIGHT_SCHOLAR_BOTTLE_IDS = ['insight-scholar-potion-1', 'insight-scholar-potion-2', 'insight-scholar-potion-3'] as const;
export const INSIGHT_SCHOLAR_FORMULA_STATUS = '洞悉者·阅读者序列3候选（G扩展）：名称与序列3的对应、新增能力、完整配方与晋升仪式尚未核实。材料、用量、调配顺序及完整仪式保持未知，不能断言无需仪式。本阶段只采用本作原创G独立成品渠道与专业指导；三项准备和当次场地检查均为G支持流程，不冒充原著仪式，不复用预言家的旧仪式包，不开放自制配方。';
export const INSIGHT_SCHOLAR_SOURCE_STATUS = '原文核验未命中“洞悉者”，尚无直接证据证明该名称对应阅读者序列3；本页候选名称、两项新增能力、全部人物原物、场景及定量均为明确原创G。下一“智慧天使”只见圣典称号，尚无阅读者序列2编号证据，本次不开放。已核实的原序列4预言仍是需要解释、可能偏差的有限片段与梦象，不因晋升成为全知。新知识路线只关联已经亲自取得的有限证据、辨析实际读到与亲眼见过的方法；不会生成证据、自动判定谁说谎、揭穿任意弱点、读取未知内容或复制新技能。阅读者至预言家的全部原ID、掌握、实际样本、原联系物、原微光片与真实人物后果继续保留。';
export const INSIGHT_SCHOLAR_POTION_SOURCES = INSIGHT_SCHOLAR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${INSIGHT_SCHOLAR_GUIDE}介绍的独立洞悉者候选成品交接渠道本作G初始批次第${index + 1}瓶序列3候选成品魔药，独立封存原瓶${id}；非预言家或更早原瓶改装。候选名称、能力、配方和原著仪式仍未核实，专业准备另行实际完成。`,
}));
export const INSIGHT_SCHOLAR_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const INSIGHT_SCHOLAR_PREPARATIONS: { id: InsightScholarPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_RECORDS', title: '亲自练习原记录与证据来源核对', description: '在指导场普通练习区分亲眼见到的原记录、转述与未证实猜测，记录尚缺什么证据。准备不预读芬娜的原件、不替任何原人下结论，也不将有限预见变成全知。' },
  { id: 'COMPARE_METHODS', title: '实际练习辨析已见方法与可检验预测', description: '实际阅读指导用记录并比较已经看见的步骤，写明需要以后现场检验的预测；没有学习新的超凡能力，不自动复制未知方法，也未获得新校验台任何人的同意。' },
  { id: 'PLAN_EXIT', title: '实际核对普通退出与原物归还次序', description: '本人实际查看指导场普通出口，练习取得原物许可、逐件归还和普通离场的顺序。新档案室的转角、封栏与侧路仍须到场观察；准备不移动原包、打开封栏或重置旧窗销与原物。' },
];
export const INSIGHT_SCHOLAR_ABILITIES: { id: InsightScholarAbilityId; label: string; description: string }[] = [
  { id: 'reader.s3.evidence-link', label: '有限证据关联（G候选）', description: '一次6灵性、知识18，只把本人已经读到的两份真实原件或现场观察作有限关联。成功给出对应行或旧记录未含当次封栏的提示，失败如实无提示；真假假说仍须原主人出示交接签注或本人现场核验。每案一次，普通逐行比对和实际侧路始终可用，不生成证据、不遥读物件、不强制真话。' },
  { id: 'reader.s3.method-analysis', label: '已见方法辨析（G候选）', description: '一次5灵性、知识18，生活中只比较本人读过的原记录与原人实际演示过的同一低强示范匣；预测须再看原人实际操作，失败也能普通核对。战斗中只分析眼前新敌本场已经实际施展过的FLASH或WARD，成功减势35G、失败0；尚无实见时普通避让10且不扣5灵性。不会读取后台未来动作、修造器具、永久学会匣的能力或自动复制新技能。' },
];
export const INSIGHT_SCHOLAR_CONSUMPTION_RISK = '以下全部具体规则为本作G：预言家消化100、从预言家实际晋升周起12整周、健康>20且精神>40，三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1、预言家消化100和全部旧掌握保留，两项新能力掌握0；灵性上限仍120且当前不补满，身体性别不改变。原哈罗德伤势与原棍、诺拉等三人的原经历、原窗销与旧页和包裹、全部FLASH/FROST/COURAGE样本及原微光片的来源和已消耗记录保留，不免费补片、不重造原物或复活旧人。';
