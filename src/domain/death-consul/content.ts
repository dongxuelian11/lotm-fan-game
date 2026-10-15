import { FERRYMAN_PROVIDERS } from '../ferryman/content.js';
import type { DeathConsulAbilityId, DeathConsulPreparationId, DeathConsulPrices, DeathConsulSourceEra } from './types.js';

/** Death S2's name is source-attested. Formula, complete rite, and all bounded playable powers and quantities below are authored game design.
 * Azik's split-soul exception is not a general resurrection mechanic. Historical people, objects and spirits are never renewed by this module. */
export const DEATH_CONSUL_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, labourBalance: 800, preparation: 120 } as const;
export const DEATH_CONSUL_POST_CYCLE_PRICES = { guidance: 120, potion: 1200, labourCredit: 1120, labourBalance: 80, preparation: 20 } as const;
export const deathConsulPrices = (era: DeathConsulSourceEra): DeathConsulPrices => era === 'POST_CYCLE' ? DEATH_CONSUL_POST_CYCLE_PRICES : DEATH_CONSUL_PRICES;
export function deathConsulSourceLabel(era: DeathConsulSourceEra): string {
  const provider = FERRYMAN_PROVIDERS[era];
  return `${era === 'POST_CYCLE' ? '首次周期后的当代渠道' : '原时代渠道'} · ${provider.name}（${provider.id}）介绍的死亡执政官独立成品来源`;
}
export const DEATH_CONSUL_MIN_FERRYMAN_WEEKS = 12;
export const DEATH_CONSUL_LABOUR_STEPS = 5;
export const DEATH_CONSUL_BOTTLE_IDS = ['death-consul-potion-1', 'death-consul-potion-2', 'death-consul-potion-3'] as const;
export const DEATH_CONSUL_FORMULA_STATUS = '死亡执政官是死神途径序列2。当前渠道只提供独立封存的成品药瓶与服药前的专业准备，没有可供自行调配的完整配方。须先充分消化摆渡人魔药，从实际晋升周起留出十二整周，再逐项准备并承担服药风险。';
export const DEATH_CONSUL_SOURCE_STATUS = '双室封存场保留两间相隔6米的实际房间、12米普通迂回路和同一扇门。苍白焰只作用于已核实的有限残余，灵界短渡只连接本次确认的两端。人员、原封存物、许可、疲劳与损耗都按实际保留；退出时仍须停止作用并沿普通道路返回。';
export const DEATH_CONSUL_POTION_SOURCES = DEATH_CONSUL_BOTTLE_IDS.map(id => ({ id, source: `死亡执政官独立封存药瓶${id}；尚待本次专业介绍登记实际渠道与入库周，当前不能领取。` }));
export function deathConsulPotionSource(era: DeathConsulSourceEra, number: number, week: number): string {
  return `${deathConsulSourceLabel(era)}，第${Math.ceil(number / 3)}批、第${week}周实际登记入库，独立封存药瓶death-consul-potion-${number}。本瓶费用与专业准备分别结算。`;
}
export const DEATH_CONSUL_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const DEATH_CONSUL_PREPARATIONS: { id: DeathConsulPreparationId; title: string; description: string }[] = [
  { id: 'CHECK_ANCHORS', title: '核对两端锚点与成品来源', description: '在本次指导场亲自核对两个实际端点、原药瓶封存记录与普通路线。专业演练不打开之后的短渡，也不提前登记后来现场的人或物。' },
  { id: 'REVIEW_RESIDUAL', title: '复核残余边界与当前许可', description: '区分封存物中的有限残余与独立的人格，检查热量、焦痕和容器风险。人员参与须当面取得当前许可；过去的约定不能替代后来现场的同意。' },
  { id: 'PLAN_RETURN', title: '演练停止作用与普通返程', description: '按停止火焰、关闭短渡、收好原物、沿普通道路返回的次序演练收尾。人员和物品不会随能力结束自动回到起点，伤势、疲劳与耗材也不会恢复。' },
];
export const DEATH_CONSUL_ABILITIES: { id: DeathConsulAbilityId; label: string; description: string }[] = [
  { id: 'death.s2.pale-flame', label: '苍白焰', description: '生活实践消耗7灵性、10秒，进行意志20检验；成功后打开20秒窗口。还须用4秒将苍白焰实际作用于同一原封存残余，才使强度由3降到1，并在原容器留下1处焦痕；余热从20秒随这4秒施用实际递减至16秒。失败照付消耗，仍可普通封存。战斗每次7灵性、意志20，清楚且通畅的作用线提供105优势；闭门时该槽改为普通开门，0灵性、5秒且不攻击，门受阻则只普通观察。' },
  { id: 'death.s2.spirit-passage', label: '灵界短渡', description: '生活实践先核实两端并取得当前许可，再消耗6灵性、10秒进行知识20检验；成功后打开20秒窗口。两名原人携同一原罐用6秒通过6米，成人实耗2精力，才算实际应用；随后沿12米普通路用12秒返回，再耗成人2精力。许可撤回后停止通行，已付施术费保留且不奖掌握。战斗每轮最多付费尝试一次，消耗6灵性、知识20；成功后本人实际短移2米，只抵减本轮随后一次实际成功的身体攻击40，使用即耗尽，不抵灵体攻击。' },
];
export function deathConsulConsumptionRisk(era: DeathConsulSourceEra): string {
  const prices = deathConsulPrices(era);
  return `要求摆渡人消化100、从实际晋升周起满12整周、健康>20且精神>40。先完成三项各1行动的专业准备，再付1行动与${prices.preparation}便士检查当周服药场地，最后单独确认所选药瓶，饮用需要0行动。意志难度30：大成功晋升并消耗8精神；成功晋升并消耗15精神；失败不晋升，健康−15、精神−25、排异+30；严重失败不晋升，健康−25、精神−45、排异+60。每次药瓶与本次场地准备都会耗尽；三项专业经历保留，重试需要另一瓶和新的当周检查。现场专业照护使本次排异后的健康与精神最低为1。当前渠道指导${prices.guidance}便士，每瓶${prices.potion}便士，或完成本瓶五项劳务后付${prices.labourBalance}便士；全部现有药瓶失败耗尽后，可花1行动申请下一批，下一真实周起确认到货，新药瓶仍须逐瓶付费。成功使四项属性各+1，摆渡人消化100留存，七阶已有掌握保持，两项新掌握从0开始。灵性上限120，当前灵性、身体性别、已有伤势、累计风险与过去人物物品记录均保持。已结束的序列4周期不会重开，普通死亡没有即时复活。`;
}
