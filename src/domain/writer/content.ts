import { DISCERNER_GUIDE } from '../discerner/content.js';
import type { WriterAbilityId, WriterPreparationId } from './types.js';

/** Canon names S1 作家 and S0 空想家. L215675 ties mutual knowledge to what
 * another person knows of oneself; L208831 describes directing developments.
 * All precise costs, distances, durations, checks and scenes here are bounded
 * original game design. The full S1 formula/ritual remain unknown. The city-
 * range inference about 0-08, S0 era arrangements and imaginary S1 traits are
 * not granted. Developer provenance is deliberately absent from player prose. */
export const WRITER_GUIDE = DISCERNER_GUIDE;
export const WRITER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140, recovery: 120, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
export const WRITER_MIN_DISCERNER_WEEKS = 12;
export const WRITER_LABOUR_STEPS = 5;
export const WRITER_BOTTLE_IDS = ['writer-potion-1', 'writer-potion-2', 'writer-potion-3'] as const;
export const WRITER_FORMULA_STATUS = '原指导者介绍独立封存的作家成品魔药。核对观众至洞察者的八阶原瓶与既往报告，检查互知线索和合理安排的使用边界，亲自走查本次服药处的普通出口。三项准备分别完成后，另付费检查当周安静房间，最后独立确认饮用所选原瓶。';
export const WRITER_SOURCE_STATUS = '互知线索须从对方真实知道的本人信息出发，只能获得有限线索。合理安排须有已存在的动机、物件和通路，只推动一次尚未发生的事件；对方可以拒绝，条件改变会使安排失效。已发生的事实、真实消耗与原人物经历继续保留。';
export const WRITER_POTION_SOURCES = WRITER_BOTTLE_IDS.map((id, index) => ({ id,
  source: `${WRITER_GUIDE}介绍的专业交接处初始批次第${index + 1}瓶序列1作家成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const WRITER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const WRITER_PREPARATIONS: { id: WriterPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对八阶原瓶与既往报告', description: '本人核读观众至洞察者的八阶真实晋升、已耗原瓶和洞察者三份报告。旧伤、支持者意愿、人物生死、外部身份、原物去向与已有掌握继续保留。' },
  { id: 'CHECK_LIMITS', title: '检查互知与安排的使用边界', description: '确认对方须实际知道本人信息，互知只能提供有限线索。核对还书者既有动机、原书和普通通路；一次待发生安排须面对真实抵抗，不能创造身体、动机或物件，也不能改写已完成的事件。拒绝和撤回均有效。' },
  { id: 'MARK_EXIT', title: '走查普通出口与中止求助', description: '本人走完安静房的普通退路，核对求助位置和原封存箱，演练暂停与身份锚定。专业支持仅处理本次服药排异，不保护普通死亡；中止后未服原瓶保留，已付费用与行动不退。' },
];
export const WRITER_ABILITIES: { id: WriterAbilityId; label: string; description: string }[] = [
  { id: 'audience.s1.reciprocal-insight', label: '互知线索', description: '先让对方真实了解本人的姓名与实际经历，再在六米内、当前接触和许可下支付6灵性与2精神，进行意志18检定。成功只得到对方本已知道的一条有限线索，失败同样付费；不能凭空读取秘密或保证判断。' },
  { id: 'audience.s1.plausible-arrangement', label: '合理安排', description: '在还书者本有归还动机、原书与通路真实存在时，支付8灵性与3精神，进行意志20检定，形成至多三十秒的一次待发生还书安排。等待后仍须真实移动交接；条件改变或抵抗可使其失败，取消不退款，不能改写已发生事实。' },
];
export const WRITER_CONSUMPTION_RISK = '洞察者消化100、实际晋升后12整周，三份洞察者生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧23项掌握与八阶消化保留，两项新掌握从0开始，共25项；灵性上限120，当前不补满。角色性别、年龄、特质、旧伤、支持者状态、人物生死和原物去向不因晋升改变。';
export const WRITER_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  ['audience.observation', '观察'], ['audience.behavior-analysis', '行为分析'], ['audience.memory-deduction', '记忆推断'], ['audience.mind-reading', '读心'],
  ['audience.s7.awe', '震慑'], ['audience.s7.frenzy', '狂乱'], ['audience.s7.suggestion', '心理暗示'], ['audience.s7.soothe', '安抚'], ['audience.s7.mental-communication', '心灵沟通'],
  ['audience.s6.hypnosis', '催眠'], ['audience.s6.combat-hypnosis', '战斗催眠'], ['audience.s6.psychological-invisibility', '心理学隐身'], ['audience.s6.scales', '鳞片'],
  ['audience.s5.dream-guidance', '梦境引导'], ['audience.s5.dream-modification', '梦境修改'], ['audience.s5.dream-travel', '梦境穿梭'],
  ['audience.s4.mind-island', '心灵岛屿'], ['audience.s4.virtual-persona', '虚拟人格'], ['audience.s4.mental-plague', '精神瘟疫'],
  ['audience.s3.external-identity', '外部身份'], ['audience.s3.woven-image', '编织梦像'],
  ['audience.s2.mental-imprint', '近距心灵印记'], ['audience.s2.insight-window', '洞察窗口'],
].map(([id, label]) => ({ id: id!, label: label!, description: '保留此项原有掌握和使用条件；原物、目标许可、灵性与失败成本分别结算。晋升不会增加此项熟练度，也不改变过去的实际结果。' }));
