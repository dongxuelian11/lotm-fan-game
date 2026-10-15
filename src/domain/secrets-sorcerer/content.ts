import { TRAVELER_GUIDE } from '../traveler/content.js';
import type { SecretsSorcererAbilityId } from './types.js';

/** Canonical limits are distinguished from the original people, sites, objects and numerical G mechanics. */
export const SECRETS_SORCERER_GUIDE = TRAVELER_GUIDE;
export const SECRETS_SORCERER_CURATOR = '奥尔德伦·维尔';
export const SECRETS_SORCERER_PRICES = { guidance: 520, potion: 6600, labourCredit: 5100 } as const;
export const SECRETS_SORCERER_MIN_TRAVELER_WEEKS = 12;
export const SECRETS_SORCERER_LABOUR_STEPS = 5;
export const SECRETS_SORCERER_BOTTLE_IDS = ['secrets-sorcerer-potion-1', 'secrets-sorcerer-potion-2', 'secrets-sorcerer-potion-3'] as const;
export const SECRETS_SORCERER_FORMULA_STATUS = '秘法师完整主辅配方、材料名称、用量与调配顺序尚未核实，保持未知；本作只提供来源独立、已经制成的序列4成品原瓶G。原学徒至旅行家魔药、既有记录与四处灵界坐标不是新配方材料，不开放臆造配方或自行调配。';
export const SECRETS_SORCERER_RITUAL_SOURCE = '第七部27章的晋升要求是主要凭自己的力量封印至少半神层次、对自己有明显敌意的生物，过多外来帮助会使仪式失效；自己的实际记录属于自己的力量。多里安推荐一件1级封印物，不等于所有晋升必须使用某件指定原物。本作G实际敌体为三个独立原石拱内的磁门折光兽，均相当于序列4且主动敌对；须本人实地勘察、布置原封框、真实交战和限制其位置，才可尝试收容。原封框只是容纳已经实际受限的目标，不能代抓、攻击或削弱敌人。新原创63岁成年男性持照档案保管员奥尔德伦·维尔（Aldren Vale）负责借还和药物照护，是普通人且不进入战场；原诺拉·维恩仍是序列8。所有守卫留在原地面出口外，不替玩家战斗。';
export const SECRETS_SORCERER_SOURCE_STATUS = '秘法师能把实际场所的一部分隐藏，只有对应的实际特殊门或解除隐藏能使其重新与外部连通；空间口袋须建立联系、使用正确坐标并定期维护，不是无穷容量，也不消除存物的负面效果。放逐须先控制目标，只是暂时送入时空乱流，同一目标仍会返回。星之虫的分化与快速施法不等于永久无限施法，也不赠送高序列记录。下一序列为漫游者3；秘法师4不开放星际旅行。本段只新增空间隐藏、空间口袋、放逐三项0掌握，保留学徒、戏法大师、占星人、记录官、旅行家全部原ID、记录来源、原教师资源、四处实际坐标和往返历史。具体人物、原兽种、场所、距离、道具、价格、灵性、时间与判定均为原创G。';
export const SECRETS_SORCERER_POTION_SOURCES = SECRETS_SORCERER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SECRETS_SORCERER_GUIDE}联系持照档案渠道实际封存的第${index + 1}瓶独立秘法师成品原瓶${id}；供给为原创G，不由学徒至旅行家旧瓶改装。完整配方仍未知，不附送敌体、已完成封印或借用封框。`,
}));
export const SECRETS_SORCERER_LABOUR_TASKS = ['核对本瓶独立封签', '清点本瓶原运输箱', '整理本瓶交接凭据', '核验本瓶原供应记录', '复核本瓶档案封存记录'] as const;
export const SECRETS_SORCERER_ABILITIES: { id: SecretsSorcererAbilityId; label: string; description: string }[] = [
  { id: 'door.s4.space-hiding', label: '空间隐藏', description: '实际分隔并隐藏原场所的一部分，保留唯一真实特殊门；本人须经原门出入，不能凭空消失、复制房间或从未知坐标逃脱。原同伴先留在门外，停止隐藏后恢复原场所。成功、耗灵与短时战斗减势为G。' },
  { id: 'door.s4.space-pocket', label: '空间口袋', description: '为同一原挎包建立有限空间联系，须正确固定坐标和定期维护；原物逐件真实存取，负面效果仍付出。三物位与到期时间为本作G，不是免费无限仓库，到期不销毁或复制内容物。' },
  { id: 'door.s4.banishment', label: '放逐', description: '先实际控制原目标，再尝试将其暂时送入有限时空乱流；同一目标会返回，不能删除敌人、永久囚禁或令弱回声冒充半神仪式目标。本作练习保持原笼关闭，等同一回声实际返回后再结束控制。' },
];
export const SECRETS_SORCERER_CONSUMPTION_RISK = '以下数值与有界药物照护均为G：旅行家消化100、晋升后满12整周、健康>20且精神>40，本人主要凭自己的力量实际封印一只至少半神层次且明确敌对的原生物，原敌体仍活着并封存在本次完整原框内，无外人参战帮助，才可独立确认饮用所选原瓶。0行动、意志难度28，四档均耗尽本瓶且不释放封印。大成功：晋升、精神−4；成功：晋升、精神−8、当前灵性−15；失败：健康−15、精神−25、排异+30；灾难：健康−25、精神−45、排异+60。药物照护只使此次排异健康与精神保底1，战斗仍可真正死亡。成功四属性各+1，旧掌握不变，三项新掌握从0，扮演归0，灵性上限120但当前不补满，原身体性别不变。成败后须0行动沿原地面出口离开并将同一封框连同仍封存的原敌体交还档案保管；不能清空复用。也可不服药保持旅行家并实际交还，未用原瓶保留；失败后另只原目标、新借原框与另一原瓶须下一真实周再尝试。';
