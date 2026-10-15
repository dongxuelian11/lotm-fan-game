import { SCROLL_PROFESSOR_GUIDE } from '../scroll-professor/content.js';
import type { StarMysticAbilityId } from './types.js';
export { STAR_MYSTIC_CASE_IDS } from './types.js';

/** Verified supernatural boundaries are distinct from every original G cost and procedure. */
export const STAR_MYSTIC_GUIDE = SCROLL_PROFESSOR_GUIDE;
export const STAR_MYSTIC_VOLUNTEER = '成年志愿者达芙宁（Daphnie）';
export const STAR_MYSTIC_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const STAR_MYSTIC_LENSES_PRICE = 80;
export const STAR_MYSTIC_LENSES_ID = 'SM5-LENS-1';
export const STAR_MYSTIC_MIN_SCROLL_PROFESSOR_WEEKS = 12;
export const STAR_MYSTIC_LABOUR_STEPS = 5;
export const STAR_MYSTIC_BOTTLE_IDS = ['star-mystic-potion-1', 'star-mystic-potion-2', 'star-mystic-potion-3'] as const;
export const STAR_MYSTIC_SOURCE_STATUS = '星象师是窥秘人途径（HERMIT）的序列5，承接卷轴教授6；不是通识者途径（PARAGON）的天文学家5。第三部第83章展示成熟星象师嘉德丽雅增强的窥秘之眼，能够看到数十米内障碍后的船员与虚幻事物，也有视觉纷乱、仿佛被注视的风险，厚玻璃眼镜可过滤额外视野；不是无风险全知，更不是任意距离透视或读取未来随机结果。第三部第175章在卷轴麻痹失败后另行直接施展星光囚笼，支持不烧新卷施展限制移动的星光囚笼，但没有统一固定射程、持续时间或必中保证。第三部第192章的特定海域占卜保留条件与不确定性，不能据一次观察承诺未来天气。序列4是神秘学家，序列2才是贤者；序列4神秘再现及从神秘知识取用更强力量不提前下放，也没有从任意故事免费创术。原成年导师伊蕾·莫文、成年志愿者达芙宁（Daphnie）、原教学室与相连的六米普通走廊、原薄布屏风、约定木牌SM5-MARKER-1、原厚玻璃眼镜SM5-LENS-1、地面边界标记、三条互有矛盾的历史天气记录及当前院内阴天均为本作原创G。木牌的具体细节只有实际查看后才公开，当前阴天不代表全局天气模拟。眼镜须花1行动80便士实际购买并戴上，不因晋升赠送；离开练习仍保有且佩戴原镜，本切片只模拟主动开启的有限专注，不虚构日常自动透视或额外精神扣除。所有指导、成熟周数、价格、判定、资源费用、距离和效果比例均为原创G。';
export const STAR_MYSTIC_FORMULA_STATUS = '星象师完整配方、主辅材料及其用量、调配顺序与6→5晋升仪式细节尚未核实，不能据未知细节断言无需仪式；不把5→4仪式中的神话生物血液分析错移为本次条件。本作原创G渠道只交付独立成品原瓶；同一位原成年导师伊蕾·莫文实际核对本次原瓶、准备原法术教学室的安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。此前窥秘人、格斗学者、巫师与卷轴教授原瓶、材料、法术课程与卷轴制作历史完整保留。';
export const STAR_MYSTIC_POTION_SOURCES = STAR_MYSTIC_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${STAR_MYSTIC_GUIDE}经独立星象师成品交接渠道实际取得的第${index + 1}瓶序列5星象师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非窥秘人、格斗学者、巫师或卷轴教授旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const STAR_MYSTIC_LABOUR_TASKS = ['核对本瓶独立封签', '整理原教学室公开交接册', '清点原教学室普通标记', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const STAR_MYSTIC_ABILITIES: { id: StarMysticAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s5.mystic-sight', label: '增强的窥秘之眼', description: '主动抬起自己确实持有的原厚玻璃眼镜，在有限当前现场增强窥秘观察。原著展示障碍后与虚幻事物视野，也有纷乱与风险，不是全知。G木牌实践支付3灵性、2精神，知识14成功才确认同一原牌内容；失败仍实际付费并产生纷乱，不捏造高位存在。实战有限专注同样支付3灵性、2精神且先有佩戴中的原镜，只使下一次本场星光囚笼判定增加5个百分点，不揭示隐藏能力、物品或未来随机。实际戴回原镜后成本不退，已实际获得的观察知识保留。' },
  { id: 'hermit.s5.star-cage', label: '星光囚笼', description: '可不烧新卷轴而直接施展星光囚笼，有限限制当前真实目标移动。G和平实践对明确同意的原成年达芙宁支付3灵性、知识14判定，成功才真实限制她在两米外原地标的移动；0行动主动结束后她实际走回原等待位，失败也耗灵性。实战仅限制当前普通持棍者下一次实际正贡献身体攻击一次，修正为一半、即时胜势0；不控制精神、话语或所有行动，不直接扣健康、自动死亡或保证命中。距离、难度与比例为G。' },
];
export const STAR_MYSTIC_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原法术教学室安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；卷轴教授消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊蕾·莫文处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留卷轴教授消化及全部原掌握；成功仅新增hermit.s5.mystic-sight与hermit.s5.star-cage两项0掌握，四属性各+1，灵性上限100但当前灵性不补满。全部旧ID、原材料、原瓶、原卷轴、已学课程和已解决敌人记录完整保留；不免费赠送眼镜、材料、未知法术或序列4神秘再现。';
