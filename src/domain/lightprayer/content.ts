import { BARD_GUIDE } from '../bard/content.js';
import type { LightprayerAbilityId } from './types.js';
export { LIGHTPRAYER_CASE_IDS } from './types.js';

/** Recipe fragments: novel book one ch140 and book two ch25. Missing quantities,
 * ellipses, solvent and preparation order prohibit claiming a complete recipe.
 * S8 personally seeing in darkness, candle-lighting golden flame and prayer with
 * a fiery light pillar have bounded source support. Fixed range/power, mentor,
 * independent finished supply, jobs and cases are gameplay adaptation G. */
export const LIGHTPRAYER_GUIDE = BARD_GUIDE;
export const LIGHTPRAYER_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const LIGHTPRAYER_MIN_BARD_WEEKS = 4;
export const LIGHTPRAYER_BOTTLE_IDS = ['lightprayer-potion-1', 'lightprayer-potion-2', 'lightprayer-potion-3'] as const;
export const LIGHTPRAYER_SOURCE_STATUS = '祈光人材料片段据《诡秘之主》第一部第140章与第二部第25章；材料清单含省略和未明数量，不能当成完整配方。第二部相关段落中，序列8本人可在暗中视物、以金色火焰点燃蜡烛，并通过祈祷引出含火焰的光柱攻击污染肉条；这些有限表现不等于无条件透视、阵营雷达或清除所有污染。固定距离、范围、威力、灵性成本、导师渠道、生活场景和全部数值均为本作玩法改编G。序列7太阳神官的圣水、序列6公证人的公证不在本阶段。';
export const LIGHTPRAYER_POTION_SOURCES = LIGHTPRAYER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${LIGHTPRAYER_GUIDE}从新灯具库房交接渠道实际购入的第${index + 1}瓶序列8祈光人成品魔药，独立封存原瓶${id}；这批现货并非歌颂者旧瓶改装，导师与成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立永恒烈阳教会或其它组织身份。`,
}));
export const LIGHTPRAYER_FORMULA_STATUS = '已核《诡秘之主》第一部第140章与第二部第25章的祈光人配方片段：主材料可见光辉石1块，或炽白之魂的粉末（数量未明）；另有镜猬的血液、熔浆巨怪的心脏等片段（数量未明，不擅自补定两者关系）。可见辅料为金边太阳花1朵、附子汁液3滴，后续仍有省略号……；溶剂与完整投料顺序未核定。这些片段不构成完整制造配方。当前只开放本作G独立成品原瓶，用药指导不解锁配方学习、材料采购或调配。';
export const LIGHTPRAYER_LABOUR_TASKS = ['核验灯具库房来货封记', '整理原灯具与交接记录', '复核音乐室收货清单'] as const;
export const LIGHTPRAYER_ABILITIES: { id: LightprayerAbilityId; label: string; description: string }[] = [
  { id: 'sun.s8.light', label: '光明感知', description: '依据序列8本人在暗中视物的表现，看清近处实际存在且未被遮挡的细节；这不等于让同伴共享夜视、隔墙透视或自动读出标签。具体距离与细节门槛是玩法G。异常线索必须来自已观察的真实对象，不能扫描阵营、判定善恶或凭空得知污染来源。' },
  { id: 'sun.s8.solar-flame', label: '太阳金焰', description: '依据序列8以金色火焰点燃蜡烛的表现，作用于已经确认、做好防火准备的近处灯芯。战斗中含火光柱的有限攻击也必须面对真实目标；具体威力、距离和灵性消耗为玩法G。不是无限火力、万能净化或序列7圣水，未辨明的物件不能直接焚毁。' },
  { id: 'sun.s8.ritual', label: '有限祈祷', description: '依据序列8祈祷引出含火焰光柱攻击污染肉条的表现，先确认现场与对象，再完成可中断的有限祈祷。仅对场景已确认的异常作有限响应；具体范围、强度和结果为玩法G，不证明任何普通人的善恶或信仰，不授予万能驱邪、治病、复活或序列6公证。' },
];
export const LIGHTPRAYER_CONSUMPTION_RISK = '服药必定消耗所选祈光人原瓶，0行动，意志难度12；歌颂者扮演须达100且首次晋升歌颂者后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
