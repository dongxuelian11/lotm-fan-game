import { MISFORTUNE_MAGE_GUIDE } from '../misfortune-mage/content.js';
import type { ChaosWalkerAbilityId, ChaosWalkerPreparationId } from './types.js';

/** The S3 mapping and every new skill, finite scene and number here remain explicit game-original G. */
export const CHAOS_WALKER_GUIDE = MISFORTUNE_MAGE_GUIDE;
export const CHAOS_WALKER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const CHAOS_WALKER_MIN_MISFORTUNE_MAGE_WEEKS = 12;
export const CHAOS_WALKER_LABOUR_STEPS = 5;
export const CHAOS_WALKER_BOTTLE_IDS = ['chaos-walker-potion-1', 'chaos-walker-potion-2', 'chaos-walker-potion-3'] as const;
export const CHAOS_WALKER_FORMULA_STATUS = '混乱行者序列3仍为本作候选G映射，厄运法师4至混乱行者3编号尚未获得直接原核；完整配方与晋升仪式尚未核实。主辅材料、用量、调配顺序和完整仪式保持未知，不能因此断言无需仪式。同一位原成年导师艾妲·芬恩只经明确原创G的独立成品渠道交接本批三个独立原瓶，实际准备安静原房、普通退出路线与在场支持。三项真实专业准备和当周原房检查不冒充原著完整仪式，不开放自制魔药。';
export const CHAOS_WALKER_SOURCE_STATUS = '原核第六部77章L215038仅在一件1级封印物的混合特性中推测提到厄运法师和混乱行者，没有给出两者序列编号；不能把该封印物整套权能赋给职业。因此4→3映射保持候选G，没有已核实的原著序列3新增技能表。第二部24章L43514与L43536直接支持后续序列2先知、序列1水银之蛇；不从威尔尊名的混乱与疯狂推导混乱行者全面控制混乱。新增wheel.s3.deviation-buffer与wheel.s3.future-impediment完全是本作原创G的有限延伸实践名，并非发现的原著新技能。继承幸运者7被动幸运波动、灾祸教士6有限感知和精神风暴、赢家5节制积累与有限幸运的既有边界。39岁成年薇拉·霍尔CW3-VERA、46岁成年加雷斯·默瑟CW3-GARETH、独立净空原场、原车与封包、原签袋、原盘、原纸、当前许可及全部距离、成本、时长、概率、检定、价格、奖励与专业准备均为原创G。唯一winner.luck账本容量3，失败照付，晋升不重置或补满；没有第二池、附加等量厄运债、概率之骰、天使权柄、重抽、重启、改写过去、必定成功、无限预知或意志操控。六个旧阶段、原费里斯伤势与实际结局以及原豆袋等原物状态完整保留。';
export const CHAOS_WALKER_POTION_SOURCES = CHAOS_WALKER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CHAOS_WALKER_GUIDE}介绍的独立混乱行者成品交接渠道本作G初始批次第${index + 1}瓶候选序列3成品魔药，独立封存原瓶${id}；非厄运法师或更早原瓶改装。候选映射、成品供给与专业准备均为G；完整配方和原著晋升仪式未核实，专业准备另行实际完成。`,
}));
export const CHAOS_WALKER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const CHAOS_WALKER_PREPARATIONS: { id: ChaosWalkerPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对既有命运之轮经历与原记录', description: '本人核读原厄运法师晋升、原费里斯实际伤势或结局、原豆袋及原记录纸和唯一winner.luck记录；怪物至厄运法师原瓶、掌握、原人物及原物保留。确认旧物已经实际归还、旧效果已结束；新晋升不洗去既往成本或伤势，也不增加原幸运。' },
  { id: 'CHECK_LIMITS', title: '核验有限概率与唯一旧幸运的边界', description: '与原艾妲明确本场原创G安排：施术成功只可能对尚未发生的一次实际物理事件预备有限影响，后续事件另取一次新点，75%或25%都不是保证。原储备实耗不退，没有重抽、追改或全知。成年人当次许可可撤回，停止输入清掉未应用效果；不能控制本人意志或沿用旧许可。' },
  { id: 'MARK_EXIT', title: '标明原安静房与普通退出路线', description: '本人实际核对CW3-QUIET-ROOM与CW3-WORKSHOP，标出START至A4米、A至B或C各4米的原轨与普通去返路线。原车、唯一400g封包、两原签及原袋、原盘和原纸各有一位主人与一个地点；净空原轨没有人在路径中，原挡块真实存在。归还同一原物后本人普通退出，不复制、传送、退款或治疗。' },
];
export const CHAOS_WALKER_ABILITIES: { id: ChaosWalkerAbilityId; label: string; description: string }[] = [
  { id: 'wheel.s3.deviation-buffer', label: '未发生分支的有限偏移（原创G）', description: '不是已核实的原著序列3技能。和平1行动5灵性1精神加1份唯一winner.luck，知识20四档检定；成功只预备30秒内一次后续原车释放的有限修正，朝B概率由普通50%至75%，之后实际释放才新取一次1至100点，仍可能走C。失败照付；取消、过期或未实际应用不退、不奖掌握。本人须实走到真正停点，读原车签，推同一车和原400g包回A再交还。实战显式SPEND_FIRST首个合格B/K共限1份原储备与5灵性，B成功只减半之后下一次真实正贡献BODY/ARC，不追减已经完成的动作，抵抗、失败或轮末到期不退。' },
  { id: 'wheel.s3.future-impediment', label: '一次未来输入的有限阻滞（原创G）', description: '不是已核实的原著序列3技能。和平1行动5灵性1精神加1份唯一旧幸运，知识20；成功只预备30秒内下一次原签抽取或原盘旋转的有限影响，A概率由普通50%至25%，之后物理事件另取一次新点，A仍可能出现。薇拉在本案试施术后立即撤回，必须STOP_INPUT清掉未应用效果，再由她按50%亲手真实抽一次；本案绝不给能力掌握。原盘真实指针不会因反例改写。实战K与B共一个未应用状态及本轮1份储备，成功仅减半下一次实际正贡献BODY/ARC；WARD或ACC不消费，COMPOSE取消且抵抗本轮新判定。HOLD不自动花幸运，无储备或5灵性不足则只按既有3灵性精神风暴普通回退，不能凭空施术。' },
];
export const CHAOS_WALKER_CONSUMPTION_RISK = '以下具体规则均为本作G：厄运法师消化100，从原厄运法师晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周原安静房与普通出口，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，原厄运法师消化100与旧掌握保留，只新增wheel.s3.deviation-buffer和wheel.s3.future-impediment两项0掌握；灵性上限120且当前不补满。六阶段原瓶、原物、原人物、原敌伤势与生死不改，唯一winner.luck原储备不变；身体、身份、年龄与性别不变。候选3映射、新技能、成品与专业准备均G；完整配方与仪式未知。';
