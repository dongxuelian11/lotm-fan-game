import { PUNISHMENT_KNIGHT_GUIDE, PUNISHMENT_KNIGHT_VOLUNTEER } from '../punishment-knight/content.js';
import type { ImperativeMageAbilityId } from './types.js';

/** Sequence and limited ability categories have source support. All numeric mechanics and scenes are original G. */
export const IMPERATIVE_MAGE_GUIDE = PUNISHMENT_KNIGHT_GUIDE;
export const IMPERATIVE_MAGE_VOLUNTEER = PUNISHMENT_KNIGHT_VOLUNTEER;
export const IMPERATIVE_MAGE_PARTNER_ID = 'IM4-ELDEN-VALE';
export const IMPERATIVE_MAGE_PARTNER = '成年戏法大师埃尔登·维尔';
export const IMPERATIVE_MAGE_CARD_ID = 'IM4-CARD-1';
export const IMPERATIVE_MAGE_HOOD_ID = 'IM4-HOOD-1';
export const IMPERATIVE_MAGE_LINE_ID = 'IM4-LINE-1';
export const IMPERATIVE_MAGE_TOKEN_ID = 'IM4-TOKEN-1';
export const IMPERATIVE_MAGE_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const IMPERATIVE_MAGE_MIN_PUNISHMENT_KNIGHT_WEEKS = 12;
export const IMPERATIVE_MAGE_LABOUR_STEPS = 5;
export const IMPERATIVE_MAGE_BOTTLE_IDS = ['imperative-mage-potion-1', 'imperative-mage-potion-2', 'imperative-mage-potion-3'] as const;
export const IMPERATIVE_MAGE_SOURCE_STATUS = '律令法师是审判者途径序列4，承接惩戒骑士5，下一阶混乱猎手3。第八部第13章明确律令法师4，第八部第36章提到完成晋升仪式，但未展示完整配方与仪式步骤；第五部第200章支持混乱猎手名称。第二部第262章的威慑与暂时能力剥夺场景有0-08安排因素，本作只据此实现有限可抵抗的威慑和暂时剥夺，不推导所有目标必定成功、跨阶保证或职业固定两项上限。混合手表的禁止限制不作为职业通用规定。继承仲裁人、治安官、审讯者、法官和惩戒骑士的原能力、原ID与掌握；禁止继续用既有有限规则，不下放高阶改写世界法则、无条件死亡宣告、永久剥夺或神话形态。原民间调解文书员薇娜·贝尔与原成年阿伦仍是同一人，旧迪恩仍保留已解决结局。新成年戏法大师埃尔登·维尔、其本人已会的低功率闪光、原卡IM4-CARD-1、普通遮光罩IM4-HOOD-1、地面线IM4-LINE-1、原木牌IM4-TOKEN-1与新成年罗温·凯尔均为本作原创G；同意、资源、距离、时长、数值和判定也均为G，不保证一般安全消化，不授予官方身份或组织归属。';
export const IMPERATIVE_MAGE_FORMULA_STATUS = '律令法师完整配方与晋升仪式细节尚未核实，原文提及执行仪式，不能据未知细节断言无需仪式。主辅材料、用量、调配顺序与完整仪式步骤保持未知。本作原创G渠道只交付三瓶独立成品原瓶；同一位原成年民间调解文书员薇娜·贝尔实际核对本次原瓶、准备原调解处安静服药位置并在场照护。这是明确的G专业准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或魔药调配。仲裁人、治安官、审讯者、法官与惩戒骑士五个旧阶段的原瓶、晋升、原人物、原物、能力、风险和历史完整保留。';
export const IMPERATIVE_MAGE_POTION_SOURCES = IMPERATIVE_MAGE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${IMPERATIVE_MAGE_GUIDE}经独立律令法师成品交接渠道实际取得的第${index + 1}瓶序列4律令法师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非仲裁人、治安官、审讯者、法官或惩戒骑士旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const IMPERATIVE_MAGE_LABOUR_TASKS = ['核对本瓶独立封签', '整理原调解处公开交接册', '清点原遮光罩与普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const IMPERATIVE_MAGE_ABILITIES: { id: ImperativeMageAbilityId; label: string; description: string }[] = [
  {
    id: 'justiciar.s4.intimidation', label: '有限威慑',
    description: '原成年阿伦在原椅旁重新同意一次有限权威试验。1行动4灵性、知识18，成功短暂牵制注意3秒，失败照付且无持续影响；普通方法知识10、0灵性只为自主专注。RELEASE_ATTENTION实际等完剩余3秒后恢复自由注意；撤回同意停止新增影响，已生效的3秒仍须实际结束，不强迫如实回答或确认罪责。实战B花4灵性、知识18，成功仅使下一次正贡献BODY或ARC乘0.6一次，本轮凝神可以抵抗或清除；敌人防御、凝神与事故不消耗次数，轮末到期。有待生效影响不重付，灵性不足回退旧追踪自保。所有数值、费用、时长和判定为G，不是绝对服从。',
  },
  {
    id: 'justiciar.s4.deprivation', label: '暂时能力剥夺',
    description: '新原成年序列8戏法大师埃尔登·维尔原灵性12，本人已会低功率FLASH。每次准备重新同意，实际先花2灵性在原普通遮光罩内照亮同一卡作为基线。玩家花1行动4灵性、知识18尝试剥夺这项能力10秒，失败照付；CHECK_LIGHT中暂失能力则阻断且不耗本人灵性，否则实际再花2灵性照亮同一卡，资源不足只记耗尽。RESTORE_LIGHT实际等完10秒并解除普通罩试验，再由原本人花2灵性展示原能力；无资源时只确认能力可用，不伪称已复现。能力报告须实际阻断与恢复后实际亮起；开始需本人至少6灵性。普通方法只比较实物遮光，不能声称剥夺。原卡与罩在1米外须实际取回交还，往返2米；本人每真实新周限一次1行动、实际6小时普通休息，恢复6灵性至12，不免费重试补满。实战R花4灵性、知识18成功只禁用原罗温本轮ARC，后续该槽实际回退BODY且0灵性；凝神可抵抗或清除，轮末或终局恢复同一实例原能力。不得复制、学会或永久删去能力，不规定职业剥夺总数固定为二；所有程序和数值为G。',
  },
];
export const IMPERATIVE_MAGE_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年薇娜在场核对本次原瓶、实际准备原调解处安静位置并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，惩戒骑士消化100且晋升后满12整周，并先结束全部新旧接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、精神−25、健康−15、排异+30；灾难：中断晋升、精神−45、健康−25、排异+60。仅本次G指导服药的健康与精神最低1，保护不适用于战斗或其它危险；原瓶必耗，失败保留惩戒骑士消化及所有旧掌握，休养后另购新原瓶。成功四属性各+1，灵性上限120但当前灵性不补满，律令法师扮演从0开始，仅新增威慑、暂时能力剥夺两项0掌握。原五个阶段、原人物、原物和旧迪恩结局完全不改，不重新初始化，不伪造官方身份。';
