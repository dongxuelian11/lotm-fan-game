import { COFFIN_BEARER_GUIDE } from '../coffin-bearer/content.js';
import type { BarrenMatriarchAbilityId, BarrenMatriarchPreparationId } from './types.js';

/** Canon confirms Mother S2 荒芜主母 and the female transformation on promotion.
 * Full potion formula and ritual are unspecified. Every bounded ability, cost,
 * procedure, original scene, number and reward below is original game design.
 * This fictional character consequence never describes or changes the player. */
export const BARREN_MATRIARCH_GUIDE = COFFIN_BEARER_GUIDE;
export const BARREN_MATRIARCH_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 } as const;
export const BARREN_MATRIARCH_MIN_COFFIN_BEARER_WEEKS = 12;
export const BARREN_MATRIARCH_LABOUR_STEPS = 5;
export const BARREN_MATRIARCH_BOTTLE_IDS = ['barren-matriarch-potion-1', 'barren-matriarch-potion-2', 'barren-matriarch-potion-3'] as const;
export const BARREN_MATRIARCH_FORMULA_STATUS = '伊芙·莫兰介绍独立封存的荒芜主母成品魔药。须核对本人耕种者至抬棺人的七阶原瓶与既往报告，检查有限休眠和根系缓冲的使用边界，并实际走查本次服药处的普通出口。成功晋升后，角色的身体性别会成为女性；原本为女性则保持女性。失败保留服药前性别。饮用前须明确接受这一角色变化，再独立确认所选原瓶。三项准备完成后，另行付费检查当周安静房间。';
export const BARREN_MATRIARCH_SOURCE_STATUS = '晋升后回到原苗圃，46岁艾达·芬恩、39岁莉娜·肖、两株原活苗、已自然枯萎的原样、唯一转运匣、原牌与原纸保持各自身份。有限休眠只延缓当前仍活原样本的一次暴露损耗；根系缓冲只处理一次有明确来源的轻微实体冲量。逐案重新取得同意，撤回即停止新输入，原物仍须亲手交回，本人普通步行离场。原活性、旧伤、已发生的交接、拒绝及原诺兰的投降继续保留。';
export const BARREN_MATRIARCH_POTION_SOURCES = BARREN_MATRIARCH_BOTTLE_IDS.map((id, index) => ({
  id, source: `${BARREN_MATRIARCH_GUIDE}介绍的专业交接处初始批次第${index + 1}瓶序列2荒芜主母成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回过去已耗尽的原瓶。`,
}));
export const BARREN_MATRIARCH_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶交付复核'] as const;
export const BARREN_MATRIARCH_PREPARATIONS: { id: BarrenMatriarchPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对七阶原瓶与既往记录', description: '本人核读耕种者至抬棺人的七阶真实晋升、原瓶耗尽与旧报告，核对艾达、莉娜、原活苗、原枯样、原匣、原牌、原纸及奥斯里克、诺兰的实际记录。旧伤、拒绝与撤回、人物生死、原物去向和已有掌握继续保留。另行确认成功晋升的角色身体性别变化，既往记录仍保留当时的事实。' },
  { id: 'CHECK_LIMITS', title: '检查有限休眠与根系缓冲边界', description: '休眠只处理已实际核对且仍存活的同一原样本，不能增加活性、治疗、复活或创造新生命。根系缓冲须实际持有另付费取得的唯一植物纤维原垫，只为本人接下来一次可见轻微实体冲量预备三十秒保护，不叠加、不保证免伤。枯样只作普通核验或作为有明确来源的受控实体冲量，不接受休眠。逐案同意可撤回，停止即清除未用效力，已付成本、真实损耗、旧伤和原物磨损不回退。' },
  { id: 'MARK_EXIT', title: '标明原物归还与普通出口', description: '本人走查原安静房和原苗圃，核对原门口至A四米、A至B四米的普通路线。原活苗、枯样、原匣、原牌和原纸各有唯一身份，接触后须亲手交接或归还；本人沿原路步行离场。退出不退款、不治疗或传送，专业照护只处理本次服药排异。' },
];
export const BARREN_MATRIARCH_ABILITIES: { id: BarrenMatriarchAbilityId; label: string; description: string }[] = [
  { id: 'mother.s2.bounded-dormancy', label: '有限休眠', description: '对亲自携带的唯一原匣中、刚实际检查且仍活的同一原苗施加至多60秒休眠。耗1行动、5灵性，知识难度20；成功耗2精神，失败总计耗4精神。普通暴露每10秒损1活性，休眠期间每20秒损1；真实携行继续计时，停止、到期和苏醒均不增加活性。仅首案真实成功保护原苗、减少实际携行损耗后报告可得8掌握；撤回、普通或失败无掌握。不作用于人或原枯样，不治疗、复活或创造生命。' },
  { id: 'mother.s2.root-buffer', label: '根系缓冲', description: '只为本人接下来一次可见的轻微实体冲量预备30秒缓冲，一次用尽、不叠加。耗1行动、6灵性，知识难度20；成功耗2精神，失败总计耗4精神。须实际持有另花1行动、30便士取得的唯一植物纤维原垫，初始完整度65。原100克枯样的受控冲量真实发生后，有效缓冲损2健康，否则损5健康；同一原垫每次磨损15。第三案真实成功缓冲后报告加8掌握；普通承托不受伤、不磨损、不奖掌握。停止、撤回、到期不返成本，不治疗本人或恢复原垫，不改变枯样的死亡事实。' },
];
export const BARREN_MATRIARCH_CONSUMPTION_RISK = '抬棺人消化100、实际晋升后12整周、三份旧生活报告与反思完成，健康>20、精神>40。三项专业准备各1行动，当周另1行动140便士检查服药场地，0行动独立确认饮用所选原瓶并明确接受成功后角色成为女性。意志难度30：大成功晋升、精神−8；成功晋升、精神−15；失败未晋升、健康−15、精神−25、排异+30；严重失败中断晋升、健康−25、精神−45、排异+60。原瓶和当次场地准备耗尽；专业支持仅将这次药物排异后的健康、精神保底到1，普通死亡及战斗照常结算。失败保留服药前性别、旧经历和三项准备，休养后须筹新原瓶并重做当周检查。成功四属性各+1，旧13项掌握与七阶消化保留，两项新掌握从0开始，共15项；灵性上限120，当前不补满。成功后角色身体性别成为女性，原本女性保持女性；年龄、旧伤、原人物生死与原物去向不改写，旧记录保留当时性别。';
export const BARREN_MATRIARCH_INHERITED_ABILITIES: { id: string; label: string; description: string }[] = [
  { id: 'mother.s9.cultivation-knowledge', label: '耕种知识', description: '保留已学种植知识与真实掌握，原土、种子、水和收成各有来源，晋升不凭空补充。' },
  { id: 'mother.s9.season-observation', label: '时令观察', description: '核对眼前可查的时令和生长迹象，未见事实仍须观察，不获得全知。' },
  { id: 'mother.s9.careful-practice', label: '细致照料', description: '沿原对象和实际工具完成照料，消耗与产物均保留，不追改旧收成。' },
  { id: 'mother.s8.limited-healing', label: '有限治疗', description: '在原有范围和许可内处理真实伤势，沿用原成本与效果限制，不凭晋升自动治愈。' },
  { id: 'mother.s8.condition-observation', label: '状态观察', description: '核对实际可见状态，不以推测代替诊断，不据此重写生命或既往记录。' },
  { id: 'mother.s7.harvest-care', label: '丰收照料', description: '沿原有种植和照料条件施行，实际材料、生长与收获各自结算。' },
  { id: 'mother.s7.life-support', label: '生命支持', description: '保留原有有限生命支持范围与真实消耗，不是普遍免伤、免死或复活。' },
  { id: 'mother.s6.specimen-study', label: '样本研究', description: '核对当前同一原样和可查记录，未知仍须实验，不凭名称制造新物种或器官。' },
  { id: 'mother.s6.controlled-trial', label: '受控试验', description: '依原许可和操作边界作一次实际试验，失败、材料和对象自主性均保留。' },
  { id: 'mother.s5.ground-passage', label: '有限土行', description: '只沿原有可通行土体与已知路线移动，真实距离、退出点和成本有效，不任意传送。' },
  { id: 'mother.s4.vital-knit', label: '活性编结', description: '保留原活茎、纤维和已付成本，不能把惰性或死亡原物改写成活体。' },
  { id: 'mother.s4.living-matrix', label: '活性基质', description: '保留原基质、使用时限与消耗记录，停止不会返还材料或自动补充旧护腕。' },
  { id: 'mother.s3.finite-preservation', label: '有限活性保全', description: '只减慢已核仍活原样本的一次暴露损耗；不增加活性、治疗、改死亡或赋予免死。原护腕、各段耗用、原纸与样本去向继续保留。' },
];
