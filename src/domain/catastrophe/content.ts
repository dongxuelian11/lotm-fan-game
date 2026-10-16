import { SEA_KING_GUIDE } from '../sea-king/content.js';
import type { CatastropheAbilityId, CatastrophePreparationId } from './types.js';

/** S2 天灾 / S1 雷神 names are directly source-verified; precise new powers and all finite rules below are original G. */
export const CATASTROPHE_GUIDE = SEA_KING_GUIDE;
export const CATASTROPHE_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const CATASTROPHE_MIN_SEA_KING_WEEKS = 12;
export const CATASTROPHE_LABOUR_STEPS = 5;
export const CATASTROPHE_BOTTLE_IDS = ['catastrophe-potion-1', 'catastrophe-potion-2', 'catastrophe-potion-3'] as const;
export const CATASTROPHE_FORMULA_STATUS = '暴君序列2天灾与序列1雷神的名称编号已由原著直接列名核实。天灾完整配方、材料用量、调配顺序、晋升仪式与新增权能的精确范围尚未核实，不能断言无需仪式。本阶段采用本作原创G独立成品渠道；三项准备与当周场地检查均是G专业支持，不冒充原著晋升仪式，不复用序列4地震海啸、旧封装包或序列0挑战神灵的仪式，不开放自制配方。';
export const CATASTROPHE_SOURCE_STATUS = '原著已核天灾2、雷神1的名称编号；本作新增有限风浪场和原水压力的具体机制，以及原小湾、诺拉45岁、维尔47岁、12米边界、20抽象水量单位、10秒窗口和全部成本、效果均为原创G。只操作当前实际存在、来源固定的海水、原闸与原浮标轮具。原人当前许可、实际位置和普通干路分别核验，能力成功开窗不等于实际应用。闭闸、撤回许可、缺水或磨损均会真实限制后续动作，不生成海水、原人、原物或自动友军免伤，不复活旧人、不改身体性别、不免费治伤或补满当前灵性。下一雷神1只保留已核名称，本阶段不开放。';
export const CATASTROPHE_POTION_SOURCES = CATASTROPHE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CATASTROPHE_GUIDE}介绍的独立天灾成品交接渠道本作G初始批次第${index + 1}瓶序列2成品魔药，独立封存原瓶${id}；非海王或更早原瓶改装。天灾2名称编号已核实，完整配方、原著晋升仪式与新权能精确边界仍未知，专业准备另行实际完成。`,
}));
export const CATASTROPHE_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const CATASTROPHE_PREPARATIONS: { id: CatastrophePreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_WATER', title: '实际核验原水与独立成品来源', description: '在原指导场普通核对实际原水、相连水路与独立原瓶封存记录，区分已有水量和未知配方。此准备不提前引入新小湾的水、不修复原闸，也不把旧海王原瓶或旧海岸损毁改成新库存。' },
  { id: 'AGREE_BOUNDARY', title: '实际核对有限边界与当次许可', description: '在指导场普通练习测定有限作用区、确认当前原人的位置及可撤回许可。新小湾仍须重新观察、询问诺拉并请她实际沿干路走出作用区；此项不提前授予未来同意，不赋予同伴自动免伤。' },
  { id: 'PLAN_RETURN', title: '实际演练停止、回流与普通返程', description: '本人沿指导场普通出口演练停术、原水经实际回流路返回、原闸收口与原人普通返程的次序。成功窗口不能替代真实效用，停止不能自动送回原水或原人；新现场仍须逐步实际支付时间、精力与耐久。' },
];
export const CATASTROPHE_ABILITIES: { id: CatastropheAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s2.storm-field', label: '有限风浪场（原创G）', description: '一次7灵性、意志20，在实测12米原小湾和当次许可内，只借当前真实海水开启10秒有限窗口。须另行实际推动同一原浮标至最多8米标位才算应用，再停止并用同一原轮具与系索普通回收；原人先付实际精力沿干路退出。生活每案实际应用后最多+8掌握，成功但未用不奖。战斗有真实湾水时成功产生75G有限优势；没有当前水源或灵性时普通回退，不自动排除友军、制造海水或恢复磨损。' },
  { id: 'tyrant.s2.water-pressure', label: '原水有限压力（原创G）', description: '一次6灵性、知识20，只在原闸当前OPEN且原相连水道有真实引入水时开启10秒窗口。生活先普通引入同一4单位水，另行实际推动原轮一转才算应用，并真实消耗原轮耐久；随后停止、普通回流与关闸分步完成。撤回许可或闭闸会阻断继续作用，未用成功窗无掌握。战斗成功减势45G且每次作用将1单位同一水从CHANNEL排回BAY；缺闸或水的抽中槽只做明确普通开闸/引水准备，不重抽、不施法、不从空水道免费补水。' },
];
export const CATASTROPHE_CONSUMPTION_RISK = '以下所有具体数值均为本作G：海王消化100、从海王实际晋升周起12整周、健康>20且精神>40；分别完成三项各1行动的专业准备后，另付1行动与120便士检查当周场地，再0行动独立确认饮用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：未晋升、健康−25、精神−45、排异+60。每次均耗尽独立原瓶及本次场地准备；三项真实专业经历保留，再试须休养、另筹原瓶及重新检查。本瓶6200便士或本瓶五次真实劳动抵5400后付800；全部现有原瓶失败耗尽后，另花1行动申请，下一真实周起收到三瓶仍须逐瓶付费的独立库存。G支持仅将此次药物排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，只在此次晋升冻结海王消化100，全部旧20个掌握及七旧域历史原值保留，仅增两项新掌握0，合计22项。灵性上限仍120且当前不补满；身体性别不改变，旧伤势与累计风险不治疗、不重置。旧本尼迪克特、昆廷的实际伤亡与原棍、旧原瓶失败、原海王水域与原人原物全部保持，不重新发旧来源奖励。';
