import { FATE_PROPHET_ABILITIES, FATE_PROPHET_INHERITED_ABILITIES } from '../fate-prophet/content.js';
import type { MercurySnakeAbilityId, MercurySnakePreparationId, MercurySnakePrices } from './types.js';

/** S1 local restart is supported; the exact cost, distance and timing below are
 * this finite implementation's bounds. It is not whole-person rebirth, global
 * time reversal, resurrection or S0 fate authority. */
export const MERCURY_SNAKE_GUIDE = '原机械工坊旁的专业交接处';
export const MERCURY_SNAKE_PRICES = { guidance: 500, potion: 7200, labourCredit: 6000, labourBalance: 1200, preparation: 180, resupply: 100 } as const;
export const mercurySnakePrices = (): MercurySnakePrices => MERCURY_SNAKE_PRICES;
export const mercurySnakeSourceLabel = (): string => `${MERCURY_SNAKE_GUIDE}的独立水银之蛇成品渠道`;
export const MERCURY_SNAKE_MIN_FATE_PROPHET_WEEKS = 12;
export const MERCURY_SNAKE_LABOUR_STEPS = 5;
export const MERCURY_SNAKE_BOTTLE_IDS = ['mercury-snake-potion-1', 'mercury-snake-potion-2', 'mercury-snake-potion-3'] as const;
export const MERCURY_SNAKE_POTION_SOURCES = MERCURY_SNAKE_BOTTLE_IDS.map((id, index) => ({ id, source: `尚未当面登记来源的水银之蛇第${index + 1}号独立封存原瓶；原瓶分别交付和耗用。` }));
export const mercurySnakePotionSource = (number: number, week: number): string => `${mercurySnakeSourceLabel()}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}号独立封存原瓶，内含序列1成品；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const MERCURY_SNAKE_FORMULA_STATUS = '专业交接处交付独立封存的水银之蛇成品，不提供完整配方或自行调配方案。先核对怪物至先知八阶真实经历、同一原工坊和车包袋签盘纸，核对原幸运账，检查局部重启与片刻维系的有限边界，并亲自走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。也可以继续作为先知生活。';
export const MERCURY_SNAKE_SOURCE_STATUS = '原导师艾妲与39岁的薇拉起初在室外，邀请后须本人沿室外、门口、A逐段走八米。本人从门口走四米到A，再走四米到B亲读原记录，沿四米路返回。原车和唯一密封400克原包属于导师，原袋和两签属于薇拉；原转盘与指针继续保持。每案重新取得可撤回许可、真实购买有限连接片。记录同一原车和原包的一次有限关系，重启仅使仍在场的这两个原物回到捕获时的A。日历、钟表、记忆、既有放车次数、伤势、费用、原幸运支出与耗材不回退，移除原包或改变关系后不能复制或召回。';
export const MERCURY_SNAKE_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const MERCURY_SNAKE_PREPARATIONS: { id: MercurySnakePreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶经历、原物与幸运账', description: '核对八阶真实晋升与失败原瓶、先知三份报告和反思、原工坊艾妲与薇拉、原车与唯一400克封包、原袋签盘纸。核对原储备、累计积运和已花幸运，历史记录不能成为另一份储备；洛温投降与双方旧伤保持。' },
  { id: 'CHECK_LIMITS', title: '检查选择性返回与有限维系边界', description: '只记录同一在场原车和原包的身份、所有权、密封质量、位置与条件。仅在四米内、可见无阻且许可仍有效时尝试局部返回。维系只保存同一关系二十秒，不保证重启成功，不恢复人物资源、耗材、钟表、记忆或死亡。' },
  { id: 'CHECK_RETURN', title: '走查撤回、归物与普通返程', description: '实查门口至A四米、A至B四米的路线，核对普通推回、归还连接片和逐段离场的顺序。撤回取消待用联系，已经完成的真实返回仍保留；已用成本不退，服药照护只处理本次排异，不治疗旧伤。' },
];
export const MERCURY_SNAKE_ABILITIES: { id: MercurySnakeAbilityId; label: string; description: string }[] = [
  { id: 'wheel.s1.local-restart', label: '局部重启', description: '支付8灵性2精神，知识20检定；失败总计损4精神。只在四米内、可见无阻且当前许可有效时，把同一原车和仍在车上的同一原封包从B返回已捕获的A。实际应用耗一份新连接片充能与磨损；移除原物、换主、遮挡、撤回、条件改变或到期均不得复制或召回。保留过去放车、时间、记忆、费用与伤势。实战只处理活着的本人刚亲见的位置和未结算冲量，贡献最多降低30。' },
  { id: 'wheel.s1.moment-anchor', label: '片刻维系', description: '支付8灵性2精神，知识20检定；失败总计损4精神。把当次真实捕获的同一局部关系维系二十秒，须再独立支付和检定局部重启。实际维系耗自己的有限充能，后续真实返回另耗另一份，不能一份付两次。不能无限刷新、叠加、冻结全局或恢复任何人物资源；移动、遮挡、条件改变、撤回、停止或到期使待用联系失效。' },
];
export const MERCURY_SNAKE_INHERITED_ABILITIES = [...FATE_PROPHET_INHERITED_ABILITIES, ...FATE_PROPHET_ABILITIES];
export function mercurySnakeConsumptionRisk(): string {
  return '先知消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，17项原掌握与六项原零值不变，两项新掌握从0开始；灵性上限120，当前不补满，性别、既有身体与原幸运账保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
}
export const MERCURY_SNAKE_CONSUMPTION_RISK = mercurySnakeConsumptionRisk();
