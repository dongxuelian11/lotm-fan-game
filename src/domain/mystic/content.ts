import { STAR_MYSTIC_GUIDE, STAR_MYSTIC_VOLUNTEER } from '../star-mystic/content.js';
import type { MysticAbilityId } from './types.js';

export const MYSTIC_GUIDE = STAR_MYSTIC_GUIDE;
export const MYSTIC_VOLUNTEER = STAR_MYSTIC_VOLUNTEER;
export const MYSTIC_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const MYSTIC_MIN_STAR_MYSTIC_WEEKS = 12;
export const MYSTIC_LABOUR_STEPS = 5;
export const MYSTIC_BOTTLE_IDS = ['mystic-potion-1', 'mystic-potion-2', 'mystic-potion-3'] as const;
export const MYSTIC_SOURCE_STATUS = '神秘学家是窥秘人途径（HERMIT）序列4。已知晋升仪式的一部分是完全解析一滴神话生物血液，不是喝下血液；完整配方与仪式其余细节尚未核实。血液所属途径可能影响擅长方向，不能据此免费取得命运幸运。神秘再现必须来自本人真实研究的神秘知识，只有少数故事适用；广泛传播会使效果近乎消失，不是把任意文字变成法术。没有防护不开放背叛之宴，不免费解锁丑小鸭、神话形态或下一序列3预言大师的模糊预见。把眼睛放在另一个人身上并分享视野有依据，但具体距离、成本与受试同意流程均为本作原创G。原成年导师伊蕾·莫文、成年达芙宁、原星象师眼镜SM5-LENS-1、木牌、天气、囚笼及原布莱斯的真实结果不变；所有旧能力ID、掌握、原材料、原卷轴和逐张授权原样保留。新成年捐赠者奥蕾莉娅·维尔、原一滴样本MY4-BLOOD-1、防护罩MY4-SHIELD-1、记录册MY4-RECORD-1、保密往事、原钟、神秘学家实践及卢坎·维伊冲突均为本作原创G。所有价格、成熟周数、研究步骤、有限效果、距离和战斗数值均为G，不冒充原著完整配方、仪式或法术目录。';
export const MYSTIC_FORMULA_STATUS = '神秘学家完整配方、材料、用量与调配顺序未知。已核实仪式的一部分：完全解析一滴神话生物血液，不饮用；其余仪式细节未知，不能声称只需这一步。原成年伊蕾·莫文经独立G渠道交付三瓶成品原瓶，并在服药前核对真实分析记录、原瓶、安静场地与在场照护；这部分专业准备明确为G，不冒充完整原著仪式。血液、成品魔药与旧材料相互独立，不开放真实采血、处理血液或药物调配操作。';
export const MYSTIC_POTION_SOURCES = MYSTIC_BOTTLE_IDS.map((id, index) => ({
  id, source: `${MYSTIC_GUIDE}经独立神秘学家成品交接渠道实际取得的第${index + 1}瓶序列4神秘学家成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非窥秘人至星象师任一旧瓶改装，未声称掌握完整配方或还原完整晋升仪式。`,
}));
export const MYSTIC_LABOUR_TASKS = ['核对本瓶独立封签', '整理原教学室公开交接册', '清点本次原安全架位', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const MYSTIC_ABILITIES: { id: MysticAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s4.mystical-reenactment', label: '本人研究后的有限神秘再现', description: '只有真实研究原保密往事并成功才学会G迟钟回声：有限的延迟听觉与注意错觉，不操纵时间。未知故事、随手编造文本或通用故事库不能施法。原钟不移动，受试者可退出；公开传播会不可逆削弱这项已学原术。实战4灵性、知识18，成功只令下一项实际正贡献敌方法术乘0.7；公开后仅乘0.955。仍付原施法成本，不抹去回合或控制思想；没有学会时只可使用持有原眼镜的旧有限专注。' },
  { id: 'hermit.s4.shared-sight', label: '放置眼睛并分享有限视野', description: '经原成年达芙宁当次同意，3灵性、知识18成功才把一只有限观察眼放在她身上。她本人沿原净空走廊实际走六米，你留在原室，通过该视野看见当前原标记。失败不补造视野；不是读心、远程控制、全知或传送。原参与者可自由撤回同意；0行动停止视野、本人真实步行返回、关闭本次接触后才报告。范围、时长与资源均为G。' },
];
export const MYSTIC_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：先真实完成原一滴样本的三项不同成功分析、安全关闭并归还同一原滴，再由原成年导师核对本次原魔药与分析记录、实际准备安静服药位置并照护；不饮血，完整仪式其余细节仍未知。服药必耗选定原魔药，0行动、意志难度28。健康须高于20、精神须高于40，星象师消化100且晋升后满12整周，所有旧接触、新研究、事件与战斗须已收束。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。仅本次G指导服药的健康与精神最低保留1，导师照护后仍需休养，保护不适用于战斗或其它危险。失败保留星象师消化、真实研究记录与全部旧掌握，原魔药不会复原。成功四属性各+1，只新增两项神秘学家0掌握，扮演从0开始，星象师100快照保留；灵性上限120而当前灵性不补满。无新增身体或性别变化，不赠法术、眼镜、材料、原卷或神话形态，未获得序列3预言大师能力。';
