import { RECORDER_GUIDE } from '../recorder/content.js';
import type { TravelerAbilityId, TravelerRitualSiteId } from './types.js';
export { TRAVELER_CASE_IDS, TRAVELER_RITUAL_SITE_IDS } from './types.js';

/** Canonical boundaries are distinct from this bounded, original G route. */
export const TRAVELER_GUIDE = RECORDER_GUIDE;
export const TRAVELER_ESCORT = '艾文·盖尔';
export const TRAVELER_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const TRAVELER_MIN_RECORDER_WEEKS = 12;
export const TRAVELER_LABOUR_STEPS = 5;
export const TRAVELER_RITUAL_FEE = 80;
export const TRAVELER_ESCORT_MAX_SPIRITUALITY = 24;
export const TRAVELER_BOTTLE_IDS = ['traveler-potion-1', 'traveler-potion-2', 'traveler-potion-3'] as const;
export const TRAVELER_RITUAL_SITES: Record<TravelerRitualSiteId, { label: string; description: string }> = {
  BRONZE_STEPS: { label: '无声铜阶', description: '灵界深处层叠上升的无声铜色阶面区；与其余三处环境完全不同、彼此相距极远。' },
  INVERTED_REEF: { label: '倒悬礁群', description: '灵界深处在上方倒悬的灰蓝礁群区；与其余三处环境完全不同、彼此相距极远。' },
  ASH_GARDEN: { label: '余烬花园', description: '灵界深处只有苍白余烬轮廓的花园区；与其余三处环境完全不同、彼此相距极远。' },
  ECHO_WELL: { label: '回声井环', description: '灵界深处围绕空井层层回响的环带区；与其余三处环境完全不同、彼此相距极远。' },
};
export const TRAVELER_SOURCE_STATUS = '门途径序列5旅行家通过灵界旅行和定位，可以携带同伴，但旅行可能受阻或失败；没有已核实的统一公里数、载重或人数上限。无形之手可以拿取物品，不等于隔着不透明墙或密封容器随意取物。晋升仪式是在灵界深处四个完全不同、彼此相距极远的地方留下属于自己的特殊坐标，使服药后无法控制的灵界漂流有助于定位、保持自我并返回。新晋旅行家的半神记录容量为4；低序列20、中序列8暂沿用已知记录官实现，不声称已核实旅行家新的对应上限。容量不赠送已记录技能，所有旧记录、示范、教师资源与使用历史原样保留。空间隐藏、空间口袋与放逐属于更高序列，本段不下放。原成年导师诺拉·维恩仍是序列8戏法大师，只负责原瓶交接、指导和照护；本次由另一位原创成年序列5旅行家艾文·盖尔担任有限仪式护送人。四处场景、已核实往返路径、人物、服务、同意、价格、灵性、周数与判定均为本作原创G，不是开放全地图的免费旅行菜单。';
export const TRAVELER_FORMULA_STATUS = '旅行家完整配方尚未核实，材料名称、用量与调配顺序保持未知；已核实的四处特殊坐标晋升仪式不等于掌握配方。本作原创G渠道只交付独立序列5成品原瓶，不解锁材料采购或调配，不沿用学徒、戏法大师、占星人或记录官旧药。';
export const TRAVELER_POTION_SOURCES = TRAVELER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${TRAVELER_GUIDE}经独立旅行家成品交接渠道实际取得的第${index + 1}瓶序列5旅行家成品魔药，独立封存原瓶${id}；供给为本作原创G，非学徒、戏法大师、占星人或记录官旧瓶改装，未声称掌握完整配方。`,
}));
export const TRAVELER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原教学室公开交接册', '检查原教学室普通坐椅', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const TRAVELER_ABILITIES: { id: TravelerAbilityId; label: string; description: string }[] = [
  { id: 'door.s5.travel', label: '灵界旅行与定位', description: '经由灵界移动实际身体并定位，可携带本人同意的同伴，可能失败或受阻；没有通用固定距离、载重或人数保证。本阶段G只实践原空厅已核对的6米入口与落点，独行3灵性知识14；携一位原成年场务米拉5灵性知识16，须事先面对面取得本次有限同意。返回另沿原6米普通路径真实步行，不免费传送，不下放隐藏空间、空间口袋或放逐。' },
  { id: 'door.s5.invisible-hand', label: '无形之手', description: '使用无形之手拿取原物。本阶段G只在原可见、未上锁的两米桌面上，以2灵性、知识14拿取导师明确许可的同一张木制图卡TR5-CARD-1；成功才从DESK实际转到PLAYER，失败不移动。必须另行本人步行归还原卡，不穿不透明墙、不打开未知容器、不复制物品或改变物权。' },
];
export const TRAVELER_RITUAL_STATUS = '四个场所均由原成年序列5护送人艾文·盖尔事先核实为灵界深处、环境完全不同且彼此相距极远的原创G区域。每趟必须明确选择一处，实付1行动与80便士，护送人耗3灵性带你的实际身体抵达，并保留另3灵性返程；玩家不支付运输灵性。出发须有2灵性，抵达后本人另以0行动、2灵性亲自留下唯一坐标，随后明确0行动返程，护送人再实耗3灵性。也可不放置就返回，原费用与去回消耗保留；不能在上一趟未返回时再出发。护送人独立池初始24，只有下一次实际出访时按真实间隔每周休息恢复2、上限24，不按点击、读档或周结免费补满；四次常规去回正好24。';
export const TRAVELER_CONSUMPTION_RISK = '以下费用、时间、风险数值与有界照护为原创G：四处本人坐标全部实际放置、四趟实际返回原教学室后，记录官消化100且晋升后满12整周，健康高于20、精神高于40，方可独立确认服用选定原瓶。0行动、意志26；所有四档都实际经历无法控制的灵界漂流，由已放置的四处原坐标帮助定位、保持自我并返回，诺拉在原教学室照护。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。本次有界G照护不随机即死，不保证一切新晋旅行家或战斗安全。失败保留四个唯一坐标、原记录官消化、全部掌握和旧记录；下一瓶不重造坐标。成功只新增两项0掌握，四属性各+1，灵性上限100但当前值不补满；没有附送记录，半神容量4并不表示已有四种半神能力。';
