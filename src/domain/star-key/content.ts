import { PLANESWALKER_GUIDE } from '../planeswalker/content.js';
import type { StarKeyAbilityId, StarKeyPreparationId } from './types.js';

/** L189036/L238183 name Door S1 Star Key directly. L243145 concerns positioning
 * in Amon's dual-god/decryption context, including scouts and a false-target
 * counterexample; it does not give ordinary S1 a true-target oracle. The full
 * formula and ritual remain unknown. Finished potion supply, preparation and
 * these finite paid/checkable mechanics are original game design. */
export const STAR_KEY_GUIDE = PLANESWALKER_GUIDE;
export const STAR_KEY_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 } as const;
export const STAR_KEY_MIN_PLANESWALKER_WEEKS = 12;
export const STAR_KEY_LABOUR_STEPS = 5;
export const STAR_KEY_BOTTLE_IDS = ['star-key-potion-1', 'star-key-potion-2', 'star-key-potion-3'] as const;
export const STAR_KEY_FORMULA_STATUS = '赫斯特介绍独立封存的星之匙成品魔药。当前渠道只交付成品。服用前先核对学徒至旅法师的八阶原瓶、三份实际报告与反思，记录已亲见的本地端点，再走查停止、归物与普通返回路线。完成三项准备后，另付费检查当周场地，再独立确认饮用所选原瓶。';
export const STAR_KEY_SOURCE_STATUS = '玛拉与同一通行室、原封包、遮门、油灯和屏幕保留当前状态。每案重新征得她的许可，使用近台与远台之间四米的普通通路。端点定位须随后亲自步行核验，锚点维系须随后实际携包通过；成功窗口不移动人或物。遮挡、条件变化、到时或许可撤回后，旧窗口失效，仍可手动归物并沿普通路离开。';
export const STAR_KEY_POTION_SOURCES = STAR_KEY_BOTTLE_IDS.map((id, index) => ({ id, source: `赫斯特介绍的独立供货处初始批次第${index + 1}瓶序列1星之匙成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装或补回以前耗尽的原瓶。` }));
export const STAR_KEY_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const STAR_KEY_PREPARATIONS: { id: StarKeyPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶原瓶与既往记录', description: '本人核对八阶真实晋升、失败原瓶、旅法师三份报告与反思。戏法大师保留真实调配材料来源，原九处传说、异星行程与各套护具余量不变。原包、原人和旧敌人的结局不因新瓶重置。' },
  { id: 'RECORD_ENDPOINTS', title: '写明已见端点与实际核验步骤', description: '记录通行室近台、远台与四米通路。能力只对当前亲见的有限条件尝试建立短窗口，随后须本人实际走过和核验；未知目标、遮挡和变化不能凭名称补全。' },
  { id: 'MARK_RETURN', title: '走查停止、归物与普通返回路线', description: '本人走查原通行室入口与近台、远台的普通道路，核对原返回标记。每案重新确认许可，撤回后停止新施术，原包带回原架、手工关闭遮门，双方沿普通路离开。专业支持只处理本次服药排异，已付费用与行动不退。' },
];
export const STAR_KEY_ABILITIES: { id: StarKeyAbilityId; label: string; description: string }[] = [
  { id: 'door.s1.endpoint-location', label: '端点定位', description: '支付8灵性与2精神，感知18。只依当前亲见的本地端点尝试形成20秒有限线索，随后还须沿四米通路真实步行核验；实战仅为同一已见条件下随后一次自己的合格实际动作增加30优势。过期、遮挡、变化或撤回使窗口失效，开窗本身不增加掌握。' },
  { id: 'door.s1.anchor-maintenance', label: '锚点维系', description: '支付7灵性与2精神，知识18。只维持当前已知两端20秒的有限关联，随后须本人携同一原包普通步行四米才算应用；实战须先亲见待发空间或精神标记，只削弱随后一次合格作用30，不挡已经结算的攻击或普通棍击。失败、取消和撤回保留成本。' },
];
export const STAR_KEY_INHERITED_ABILITIES = [
  ['door.s9.door-opening', '开门', '本人穿过眼前适用的有限障碍，位置实际改变；同伴仍须走已经打开的普通通路。'],
  ['door.s8.tricks', '有限戏法', '对现场已确认的小范围对象施行已学戏法，保留真实成本、失败和原掌握。'],
  ['door.s7.astrology', '有限占星', '处理有依据的有限问题，再与亲见现场和原记录核对。'],
  ['door.s7.divination-interference', '占卜干扰', '尝试干扰一次实际占卜，对方独立检定仍可能成功。'],
  ['door.s6.recording', '亲见记录', '只有亲自在场看见且符合原条件的能力，才可付出成本尝试记录。'],
  ['door.s6.release', '消耗原记录释放', '须拥有匹配的实际原记录，每次消耗一份，失败也不返还。'],
  ['door.s5.travel', '灵界旅行与定位', '在已经核实的有限端点间移动实际身体，原成本、通路和抵抗条件继续适用。'],
  ['door.s5.invisible-hand', '无形之手', '依原场景的可见距离与许可拿取同一原物，须实际归还。'],
  ['door.s4.space-hiding', '空间隐藏', '隐藏原场所的有限部分，原特殊门、出入路线与原人原物保留。'],
  ['door.s4.space-pocket', '空间口袋', '维护同一原挎包的有限联系，物品逐件真实存取，不是无限仓库。'],
  ['door.s4.banishment', '放逐', '先实际控制目标，再尝试有限时空作用；同一目标的真实返回不能省略。'],
  ['door.s3.star-wandering', '星空漫游', '只沿已经核实的原航标、回程标记与有限护具能源实际出返，旧异星包仍在原处。'],
  ['door.s3.astral-positioning', '星界定位', '辅助核对本人已读取的原坐标和航标，失败仍须普通复核，不生成未知地点。'],
  ['door.s2.symbolic-transit', '象征通行', '在原场景已核实的两端间尝试有限象征通行，成功窗口后仍须身体与同一原物实际通过。'],
  ['door.s2.pattern-reproduction', '光纹复现', '只对本人亲见并理解的原灯式样尝试短时复现，实际投到原屏并核对才计应用。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export const STAR_KEY_CONSUMPTION_RISK = '要求旅法师消化100、从其实际晋升周起满12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动；另付1行动与150便士检查当周场地，再以0行动独立确认饮用所选原瓶，意志30。大成功晋升、精神−8；成功晋升、精神−15；失败仍为旅法师、健康−15精神−25排异+30；严重排异仍为旅法师、健康−25精神−45排异+60。原瓶与本次准备均耗尽；专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，十五项旧掌握保持原值，两项新掌握从0开始，灵性上限120且当前不补满。姓名、性别、年龄、性格、取向、原伤势与旧人的结局不变。最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查、核验并封存同一原特性，至少下一真实周以1行动和30便士当面回收；新普通药物与调配服务900便士，或五项新劳动后90便士。当周准备仍另行付费，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。';

/** R218 future recovery only. Legacy records remain readable without mutation. */
export const STAR_KEY_RECOVERY_SCHEMA_VERSION = 218;
export const STAR_KEY_RECOVERY_SITE_ID = 'BACKLUND_ORIGINAL_STAR_KEY_PREPARATION' as const;
export const STAR_KEY_RECOVERY_PRICES = { recovery: 120, recoveryHandover: 30, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
