import { SPIRIT_GUIDE_GUIDE } from '../spirit-guide/content.js';
import type { GatekeeperAbilityId } from './types.js';
export { GATEKEEPER_CASE_IDS } from './types.js';

/** Canonical capability boundaries; all concrete people, scenes, prices and checks are original G. */
export const GATEKEEPER_GUIDE = SPIRIT_GUIDE_GUIDE;
export const GATEKEEPER_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const GATEKEEPER_MIN_SPIRIT_GUIDE_WEEKS = 12;
export const GATEKEEPER_LABOUR_STEPS = 5;
export const GATEKEEPER_SPIRIT_FEE = 12;
export const GATEKEEPER_BOTTLE_IDS = ['gatekeeper-potion-1', 'gatekeeper-potion-2', 'gatekeeper-potion-3'] as const;
export const GATEKEEPER_SOURCE_STATUS = '死神途径序列5看门人的身体具有独属的有限体内冥界，实际取得的灵可在其中停留并协助；这不等于自动获得灵体或全能力库。冥界之门可牵引灵体与身体、物体，但可被抵抗，高位存在可以挣脱；需要维持并明确关闭，不是任意目标的无敌监狱。本阶段G容量仅容纳原纪念工作室同一只弱小鸟形灵灰羽（SG6-GRAY-FEATHER），须另行获得本次自愿短驻同意并支付代价。死灵导师阶段的一封原信约定不自动延长，也不改写旧信位置或记录。新原木牌GK5-MARKER-1与原锚定布GK5-CLOTH-1均保持原物权；短门仅在已核对的有限空场或原战斗现场试验，不能据此任意放逐、运送或取得目标。鲁德维尔的特殊戒指、高位灵体与船只旅行不作为默认能力；不提前获得序列4不死者或死亡复活。继承收尸人、掘墓人、通灵者和死灵导师全部原ID与原掌握。原成年导师伊芙琳·沃斯、其他成年人、原房间、各路径、同意、价格、供给、成熟周数、容量、成本与判定均为原创G。';
export const GATEKEEPER_FORMULA_STATUS = '看门人完整配方与晋升仪式细节尚未核实；原著存在由教会准备晋升仪式的情节，不能据未知细节断言无需仪式。材料、用量、调配顺序及仪式步骤保持未知。本作原创G渠道只提供独立成品原瓶；伊芙琳·沃斯实际核对原瓶、准备原工作室的安静服药场地和在场照护，再指导本次服药。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。';
export const GATEKEEPER_POTION_SOURCES = GATEKEEPER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${GATEKEEPER_GUIDE}经独立看门人成品交接渠道实际取得的第${index + 1}瓶序列5看门人成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非收尸人、掘墓人、通灵者或死灵导师旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const GATEKEEPER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原纪念工作室公开交接册', '清点原工作室普通隔栏', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const GATEKEEPER_ABILITIES: { id: GatekeeperAbilityId; label: string; description: string }[] = [
  { id: 'death.s5.inner-underworld', label: '体内冥界与实际灵体协助', description: '身体拥有独属的有限体内冥界，实际取得的灵才可停留并有限协助。本阶段G容量1，只能另行邀请同一只原灰羽，自愿同意且实际付12便士后进入；旧一封信约定不自动延长。释放、派出与召回记录真实原灵的位置与成本，不复制灵体、不自动取得灵体库。晋升不附赠任何灵。' },
  { id: 'death.s5.underworld-door', label: '有限冥界之门', description: '冥界之门可产生有限牵引，但目标能够抵抗，高位存在可能挣脱；需要支付灵性、维持并明确关闭。本阶段只在原空室3米有限试验场牵动原锚定布，或在原战斗现场短暂干扰原敌站姿后同动作关闭。没有把人或物永久放逐，不瞬杀、不复活、不跨界运送，不借用鲁德维尔的特殊戒指或高位灵。具体范围、代价与判定为G。' },
];
export const GATEKEEPER_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原工作室安静场地并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；死灵导师消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊芙琳·沃斯处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留死灵导师消化及全部原掌握；成功只新增两项0掌握，四属性各+1，灵性上限100但当前灵性不补满。晋升不自动招募灰羽，也不续签旧单信约定；必须独立取得本次同意。';
