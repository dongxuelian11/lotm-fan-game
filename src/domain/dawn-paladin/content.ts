import { WEAPONMASTER_GUIDE } from '../weaponmaster/content.js';
import type { DawnPaladinAbilityId } from './types.js';
export { DAWN_PALADIN_CASE_IDS } from './types.js';

export const DAWN_PALADIN_GUIDE = WEAPONMASTER_GUIDE;
export const DAWN_PALADIN_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const DAWN_PALADIN_MIN_WEAPONMASTER_WEEKS = 12;
export const DAWN_PALADIN_LABOUR_STEPS = 5;
export const DAWN_PALADIN_BOTTLE_IDS = ['dawn-paladin-potion-1', 'dawn-paladin-potion-2', 'dawn-paladin-potion-3'] as const;
export const DAWN_PALADIN_SOURCE_STATUS = '第二部第94章支持黎明骑士的晨曦、晨曦铠甲、凝聚武器和光之风暴。晨曦可覆盖约四五十米、驱散幻觉并轻微伤害幽灵等对象，但不是对普通人额外神圣伤害或所有幻术永久免疫。晨曦铠甲有防护力但可破损，恢复缓慢；能凝聚武器，以双手巨剑威力最强；光之风暴危险，原文有自身铠甲受损实例。序列5守护者的高防状态、伤害分担与幻术免疫不提前下放。继承战士、格斗家、武器大师全部原ID与掌握。导师奥斯温·布莱克特、成年序列7志愿者瑟恩·维克、三个有限训练现场、成品来源、检定、成本与全部数值均为本作原创G。';
export const DAWN_PALADIN_FORMULA_STATUS = '黎明骑士完整配方尚未核实，不拼补材料名称、剂量或调配顺序。本阶段G用药指导不解锁配方、材料采购或调配，只提供独立成品原瓶，不能沿用战士、格斗家或武器大师旧药。';
export const DAWN_PALADIN_POTION_SOURCES = DAWN_PALADIN_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${DAWN_PALADIN_GUIDE}经独立黎明骑士成品交接渠道实际取得的第${index + 1}瓶序列6黎明骑士成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非战士、格斗家或武器大师旧瓶改装，未声称掌握完整配方。`,
}));
export const DAWN_PALADIN_LABOUR_TASKS = ['核对本瓶独立封签', '整理原训练场公开交接册', '清点原训练场普通隔栏', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const DAWN_PALADIN_ABILITIES: { id: DawnPaladinAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s6.dawn-light', label: '晨曦', description: '晨曦范围约四五十米，可驱散幻觉并轻微伤害幽灵等适用对象。本段只对成年志愿者实付2灵性制造的原低强度幻象尝试3灵性、知识14驱散；成功也不是永久幻术免疫，不给予普通人额外神圣伤害。成本与检定为G。' },
  { id: 'warrior.s6.dawn-armor', label: '晨曦铠甲', description: '凝聚有防护力的光甲，但它能够破损且恢复缓慢。本段对本人自愿接受的原软垫摆锤轻量试压，以3灵性、意志14检验并记录实际裂纹；不能冒充不受伤、治疗或序列5守护者的伤害分担。' },
  { id: 'warrior.s6.dawn-weapon', label: '晨曦武器', description: '以晨曦凝聚武器，双手巨剑威力最强；原物与物权不改变，不免费发放库存武器。本段光之风暴试验内有限凝剑并在风暴中消散，战斗重新支付实际使用代价，不继承训练中的光剑。' },
  { id: 'warrior.s6.light-storm', label: '光之风暴', description: '危险的光芒风暴，本段仅在实际净空的原12米练习场内，先实际凝剑3灵性、凝甲3灵性，再以4灵性风暴打击唯一原纸靶；同1行动总10灵性、知识14；成功毁靶并留下焦黑原框，凝剑消散且自身光甲留裂纹。这一有限G后果不授予群体免疫、永久护盾或免费重置现场。' },
];
export const DAWN_PALADIN_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；武器大师消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留武器大师消化及全部原掌握；成功只新增四项0掌握，四属性各+1，灵性上限80但当前灵性不补满。';
