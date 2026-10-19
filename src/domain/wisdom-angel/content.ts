import { INSIGHT_SCHOLAR_GUIDE } from '../insight-scholar/content.js';
import type { WisdomAngelAbilityId, WisdomAngelPreparationId } from './types.js';

/** Both the S2 mapping and all new powers, scenes and quantities remain unverified original G candidates. */
export const WISDOM_ANGEL_GUIDE = INSIGHT_SCHOLAR_GUIDE;
export const WISDOM_ANGEL_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const WISDOM_ANGEL_MIN_INSIGHT_SCHOLAR_WEEKS = 12;
export const WISDOM_ANGEL_LABOUR_STEPS = 5;
export const WISDOM_ANGEL_BOTTLE_IDS = ['wisdom-angel-potion-1', 'wisdom-angel-potion-2', 'wisdom-angel-potion-3'] as const;
export const WISDOM_ANGEL_FORMULA_STATUS = '智慧天使·阅读者序列2候选（G扩展）：名称与序列2的对应、新能力、完整配方及晋升仪式均未核实。材料、用量、调配顺序与仪式要求保持未知，不能断言无需仪式。本阶段只采用塞缪尔介绍的本作原创G独立候选成品渠道；三项专业准备与当次场地检查为G支持，不冒充原著仪式，不将洞悉者或更早原瓶改装，不复用已耗尽的预言家仪式包。';
export const WISDOM_ANGEL_SOURCE_STATUS = '既有核验未找到“洞悉者”对应阅读者序列3的直接证据；“智慧天使”仅见圣典称号，尚无阅读者序列2编号证据。两阶名称编号均保持未核实候选，新条件综合、已见方法应对、玛拉和维克托、原纸原器与所有定量均为明确原创G。能力只利用本人实际读过的有限记录和当前亲眼观察，不从后台未知内容、未来动作盘或尚未发生的事件取答案。推断须实际核验，条件变更可使旧模型失效，成功窗口与真正应用分开；失败可普通核对。不会自动判定真话、生成证据、任意复制技能、修改现实或历史，不提供全知、免费治疗、复活或库存补充。下一“全知之眼”序列1仅保留跨链推断，本阶段不开放，也不冒称已核原著直接编号。';
export const WISDOM_ANGEL_POTION_SOURCES = WISDOM_ANGEL_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WISDOM_ANGEL_GUIDE}介绍的独立智慧天使候选成品交接渠道本作G初始批次第${index + 1}瓶序列2候选成品魔药，独立封存原瓶${id}；非洞悉者或更早原瓶改装。候选名称、编号与能力尚未核实，配方和原著仪式仍未知，专业准备另行实际完成。`,
}));
export const WISDOM_ANGEL_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const WISDOM_ANGEL_PREPARATIONS: { id: WisdomAngelPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_SOURCE', title: '实际核验原记录与成品来源', description: '在原导师塞缪尔指导下普通核对实际出示的原记录、日期、持有者和独立候选原瓶封存记录，区分亲自读到与仍未知的内容。此准备不提前读取玛拉原页、不生成新证据，也不将两份记忆当成两份物理原件。' },
  { id: 'STATE_CONDITIONS', title: '实际写明条件、版本与检验方式', description: '用指导场普通记录练习写明有限假说依赖的当前条件、变化后须重新观察之处和实际核验步骤。准备不预知新现场未来操作、不触动原器或补充储能；一次正确猜测也不等于自动学会新技能。' },
  { id: 'CHECK_LIMITS', title: '实际核对许可撤回、停止与归还边界', description: '普通演练分别确认当次许可、受撤回时停止窗口、逐件归还同一原页原器并沿原路离开。准备不授予玛拉未来现场的同意、不把成功窗口算成实际应用，也不复用旧洞悉者、预言家或更早人物的旧许可。' },
];
export const WISDOM_ANGEL_ABILITIES: { id: WisdomAngelAbilityId; label: string; description: string }[] = [
  { id: 'reader.s2.conditional-synthesis', label: '条件综合（G候选）', description: '原创G：一次5灵性、知识20，只对本人实际读过的原记录与当前已见条件尝试有限综合。成功提示仍须原交接或实际演示核验，不直接判定谁说谎；条件改变后旧模型失效，须重新亲眼观察。战斗只在本场当前条件版本已实际看见敌人付费FLASH和WARD后尝试，成功获得本次有限位置优势65G；缺少来源时普通避让10且0灵性，不读取未来盘。生活每案每项仅真正应用后最多增加8掌握。' },
  { id: 'reader.s2.observed-response', label: '已见方法应对（G候选）', description: '原创G：一次6灵性、知识20，只依据当前亲眼见过的方法尝试短暂应对窗口。生活中仅预判同一有限原器的实际演示，原器初始仅两次储能，不生成第三次或复制技能。战斗须本场当前条件版本实际看见FLASH或WARD，成功对最近亲见方法开启最多20秒窗口；只可能对下一次实际、付费、同方法行动减势45G，动作不匹配或佯变则耗窗而无效果，不倒改已结算动作。尝试、成功和真正应用分记，未用成功窗不给掌握。' },
];
export const WISDOM_ANGEL_CONSUMPTION_RISK = '以下全部具体规则为本作G：洞悉者候选消化100、从其实际晋升周起12整周、健康>20且精神>40；三项不同的1行动专业准备完成后，另付1行动与120便士检查当周场地，再0行动独立确认饮用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和本次场地准备均消耗，三项实际专业经历保留，再次服药须休养筹另一原瓶并重新检查。每瓶6200便士或该瓶五次真实劳动抵5400后付800便士，三瓶全部失败耗尽才能另花1行动申请，下一真实周起收到三瓶独立付费库存。G支持仅将此次药物排异后的健康和精神保底到1，不保护普通死亡或战斗。成功四属性各+1、冻结原洞悉者消化100，全部旧17项掌握及更早快照原值保留；只增加两项新掌握0，合计19项。灵性上限仍120且当前不补满，身体性别不改变，原伤势与累计风险不治疗、不重置。原样本、原微光片来源、阿尔顿和平或战斗结局、哈罗德伤势投降及两人的原棍、旧原纸原匣原包与所有人的实际历史全部保留；治疗仍须真实发现诊所、支付实际费用并后续休养。';
