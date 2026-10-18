import { PUPPET_GUIDE } from '../puppet/content.js';
import type { SilentDiscipleAbilityId, SilentDisciplePreparationId } from './types.js';

/** S3 name and curse/transfiguration directions are sourced; every finite scenario and number below is explicit G. */
export const SILENT_DISCIPLE_GUIDE = PUPPET_GUIDE;
export const SILENT_DISCIPLE_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const SILENT_DISCIPLE_MIN_PUPPET_WEEKS = 12;
export const SILENT_DISCIPLE_LABOUR_STEPS = 5;
export const SILENT_DISCIPLE_BOTTLE_IDS = ['silent-disciple-potion-1', 'silent-disciple-potion-2', 'silent-disciple-potion-3'] as const;
export const SILENT_DISCIPLE_FORMULA_STATUS = '沉默门徒是被缚者途径序列3，古称诅咒之物有直接原核；完整配方与晋升仪式尚未核实。主辅材料、用量、调配顺序和完整仪式均保持未知，不能因此断言无需仪式。同一位原成年导师哈伦·维斯只经明确原创G的独立成品渠道介绍本批原瓶，实际准备安静原房、普通撤离路线与在场支持。三项真实专业准备和当周原房检查不冒充原著完整仪式，不把莎伦特定木乃伊推广成通用材料，不开放自制魔药。';
export const SILENT_DISCIPLE_SOURCE_STATUS = '原核Fifthpart96L183176直接列出序列3沉默门徒、古称诅咒之物，后续序列2古代邪物与序列1神孽。Sixth86L216695–701说明序列4诅咒之源在3发生质变，不证明零自伤或无限反射。Sixth8L202933–937以序列2更强变形诅咒比较序列3类似诅咒，仅支持方向，兔形、目标限制、时长、成本与抵抗规则均未由此确定。不从职业名推导自动沉默或永久禁言。原4诅咒之源仍须实际联系、本人实际诅咒形态和真实受伤，目标可抵抗；新有限施术名不是免费无伤升级。各阶段诅咒取代旧发作，不叠加，3具体月相规则未知。本阶段新增chained.s3.short-transfiguration和chained.s3.measured-curse两个有限G能力；独立成年埃尔莎·莫尔43岁SD3-ELSA、卡尔德·里德47岁SD3-CALDER、原场、原衣物、原包、原盘、原纸、当前同意及全部数量、距离、时长、检定、价格、奖励与专业准备均为原创G。旧囚犯至木偶人物、原物、原敌伤势与月相历史保留；普通和平100只是有成本G替代，不保证原著安全消化或治愈诅咒，不送第二身体、尸体、天使权限或永久变形。';
export const SILENT_DISCIPLE_POTION_SOURCES = SILENT_DISCIPLE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SILENT_DISCIPLE_GUIDE}介绍的独立沉默门徒成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非木偶或更早原瓶改装。名阶有直接原核，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const SILENT_DISCIPLE_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const SILENT_DISCIPLE_PREPARATIONS: { id: SilentDisciplePreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对既有被缚者经历与原记录', description: '本人核读原木偶晋升、原埃德林实际伤势或结局、原木块与原诺兰联系及撤回记录；囚犯至木偶原瓶、掌握、原物与月相历史保留。确认旧本人身体已经还原、退出旧宿主、原镜盖好、真实联系已释放；新晋升不洗去既往成本或伤势。' },
  { id: 'CHECK_LIMITS', title: '核验同一身体与有代价诅咒的边界', description: '与原哈伦明确本场有限G安排：志愿者只能在当前明确同意内接受一次有限演示，原身体及资源保持同一，原衣物和物品须先实际安全存放；还原不自动穿回。撤回后停止新输入，已生效形态仍须实际等待或支付解除成本；联系演示不允许伤害，实战诅咒之源仍有本人真实伤害，不授零自伤反射。' },
  { id: 'MARK_EXIT', title: '标明原安静房与普通退出路线', description: '本人实际核对SD3-QUIET-ROOM与私密原盘SD3-TRAY，标出入口START、4米A和8米B的普通去返路线；不布置未经核实的木乃伊仪式。原衣物和原包各一件且原属埃尔莎，变形前私下存放，实际还原后另行归还并私下穿回；本人另实走4米退出，不退款、不治疗或传送。' },
];
export const SILENT_DISCIPLE_ABILITIES: { id: SilentDiscipleAbilityId; label: string; description: string }[] = [
  { id: 'chained.s3.short-transfiguration', label: '同一身体的短时变形（有限G）', description: '本作原创G：当前实际2米内原身体，5灵性2精神、知识20四档检定；两成功档只将同一身体变为RABBIT60秒，身份、健康、精神、灵性及伤势保留，两失败档照付且仍HUMAN。和平场景需埃尔莎当前明确同意及原衣物原包先放私密原盘；撤回后不得重施，等待剩余时长或另付2灵性有限解除，原衣物须真实归还。实战还须先建立当前联系，原卡尔德手持原棍真实掉在院中；兔形阻碍依赖手部的既定动作但不抹去精神挣咒，本轮结束还原后原棍仍在院中，另占一动作真实捡起。不能叠加或重置当前形态时限，不保证高阶目标失能。' },
  { id: 'chained.s3.measured-curse', label: '有边界联系与有代价诅咒（有限G）', description: '本作原创G训练名：和平只在本次明确非伤害同意内接近2米以内，4灵性1精神、知识18检定建立30秒有限联系，再主动释放或实际等完；没有伤害、反射或身体控制，成功只奖励建立联系的掌握。实战先付4灵性1精神建立同一原敌联系，默认选择有代价短时变形；只有显式开启既有木偶诅咒策略后，才另付旧规则4灵性尝试本人木偶诅咒形态，仍须本人实际受轻伤10或重伤30，才按原算法向有有效联系的目标映射5或15及对应伤势。本人完整承受原伤，双方可能死亡，反制可断开联系；不声称序列3必定零自伤、免费反射或免死。' },
];
export const SILENT_DISCIPLE_CONSUMPTION_RISK = '以下具体规则均为本作G：木偶消化100，从原木偶晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周原安静房与普通出口，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，木偶消化100与旧掌握保留，只新增chained.s3.short-transfiguration和chained.s3.measured-curse两项0掌握；灵性上限120且当前不补满。囚犯至木偶全部原瓶、原物、原人物、旧月相和原敌生死保留，身体、身份、年龄与性别不变；完整配方与仪式未知，不送尸体、第二身体、自动禁言、永久变形或零自伤反射。';
