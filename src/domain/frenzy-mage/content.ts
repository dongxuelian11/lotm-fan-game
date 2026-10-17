import { FALLEN_EARL_GUIDE } from '../fallen-earl/content.js';
import type { FrenzyMageAbilityId, FrenzyMagePreparationId } from './types.js';

/** The sequence names are source-backed; every new skill, scene, price and procedure is original G. */
export const FRENZY_MAGE_GUIDE = FALLEN_EARL_GUIDE;
export const FRENZY_MAGE_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const FRENZY_MAGE_MIN_FALLEN_EARL_WEEKS = 12;
export const FRENZY_MAGE_LABOUR_STEPS = 5;
export const FRENZY_MAGE_BOTTLE_IDS = ['frenzy-mage-potion-1', 'frenzy-mage-potion-2', 'frenzy-mage-potion-3'] as const;
export const FRENZY_MAGE_FORMULA_STATUS = '原核直接确认4堕落伯爵→3狂乱法师→2熵之公爵→1弑序亲王；狂乱法师完整主辅配方、材料用量、调配顺序与晋升仪式尚未披露，仍保持未知，不能因此断言无需仪式。同一位原成年导师米蕾·沃德只经明确原创G的独立成品渠道交接本批三个独立原瓶，实际准备原契约铺旁安静原房、普通退出路线与在场支持。三项真实专业准备和当周原房检查完全为G，不冒充原著完整仪式，不开放自制魔药。';
export const FRENZY_MAGE_SOURCE_STATUS = '第二部110《开启咒文》L58310–L58322的黑皇帝牌直接列出序列4堕落伯爵、序列3狂乱法师、序列2熵之公爵与序列1弑序亲王，名称和编号可靠；没有展示3的完整配方、晋升仪式或新增能力机制。L58340–L58346建国、异常规则和九座陵寝属于1→0黑皇帝条件，不能给3。L158935对纳斯特“应该”是3的说法与扭曲炮弹轨迹属于人物推测及个例，不能直接作新晋3通用数值；黑皇帝号灵界跳跃属于船。black-emperor.s3.ordered-deviation完全是本作原创G的有限既有动作偏转，并非新发现的原著能力条目。原42岁成年信差FM3-DARIAN达里安·维尔、45岁成年FM3-ALDEN阿尔登·鲁克、场地、原纸与原物、有限方向偏转、当前许可、30秒窗口、全部距离、成本、检定、数值和奖励均为原创G。只能影响当前已明确而尚未执行的一个动作，不修改原纸、不追改既发事实、不传送、不替代独立心智、不授永久服从或随意命令。2能力尚未核实，不因熵之公爵名称创造热力学万能。六个旧阶段、原马洛永久死亡、原伊芙与原箱原垫的收束历史完整保留；只允许仍在briber.gifts中由PLAYER持有的同一旧礼物在新战实际给出，没有新礼物池、幸运池、召回或复制。';
export const FRENZY_MAGE_POTION_SOURCES = FRENZY_MAGE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${FRENZY_MAGE_GUIDE}介绍的独立狂乱法师成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非堕落伯爵或更早原瓶改装。名称编号有直接原核，成品供给与专业准备均为G；完整配方和原著晋升仪式未披露，专业准备另行实际完成。`,
}));
export const FRENZY_MAGE_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const FRENZY_MAGE_PREPARATIONS: { id: FrenzyMagePreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对既有黑皇帝经历与原记录', description: '本人核读原堕落伯爵晋升、原马洛实际伤势与永久死亡、原伊芙当前状态和已归还的原箱原垫、唯一briber.gifts中每件原礼物的位置、去向与给出周。律师至堕落伯爵原瓶、掌握、原人物与原物均保留；本次晋升不治疗、不复活、不复制或召回旧礼物。' },
  { id: 'CHECK_LIMITS', title: '核验有限动作与当前许可的边界', description: '与原米蕾明确本场原创G安排：成功只预备30秒内一个已经明确而尚未执行的动作偏转，必须之后实际执行才形成事实。原纸从A到B不改写；成人自主心智不变，当次许可可撤回，停止输入清掉未用影响。失败、取消或过期成本不退，已发生的行走或投球不倒转，不以成功检定代替实际应用。' },
  { id: 'MARK_EXIT', title: '标明原安静房与普通退出路线', description: '本人实际核对FM3-QUIET-ROOM与协会净空投递演练房FM3-DELIVERY-ROOM，标出START至A4米、A至B或C各4米的普通去返路线，两接收台独立空置有垫。唯一400g原封包、唯一80g软布球与原纸各有原主人和一个地点；原人亲自行走、球真实飞过4米，不复制或传送。归还同一原物后本人普通返回START再退出。' },
];
export const FRENZY_MAGE_ABILITIES: { id: FrenzyMageAbilityId; label: string; description: string }[] = [
  { id: 'black-emperor.s3.ordered-deviation', label: '既有待行动作的有限偏转（原创G）', description: '本作G有限延伸，不是已核实的原著3新增机制。和平1行动5灵性2精神、知识20四档检定；成功只预备30秒内一个已明确且尚未执行的动作，达里安之后亲自普通走4米或本人亲手投原80g球，才使原定B偏到C。失败或普通仍到B，原纸不变；撤回须STOP_INPUT清未用状态。实际成功应用才加8掌握，失败、取消、撤回或过期都不退成本、不奖掌握。实战K实耗5灵性、知识20，成功只留下一个待用影响，减半下一次真实正贡献BODY/ARC或实际正WARD；不消耗未发生动作、不改先前已用招、没有即时伤害或强迫投降。敌COMPOSE实际付4灵性获得8贡献并清未用影响、抵抗本轮新K；已应用事实保留。轮末未用即清。与旧原礼物独立，R只延旧礼物窗口、不延K。' },
];
export const FRENZY_MAGE_CONSUMPTION_RISK = '以下具体规则均为本作G：堕落伯爵消化100，从原堕落伯爵晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周原安静房与普通出口，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，原堕落伯爵消化100与旧掌握保留，只新增black-emperor.s3.ordered-deviation一项0掌握；灵性上限120且当前不补满。六阶段原瓶、原物、原人物与原敌伤势生死不改，原马洛永久死亡；唯一briber.gifts旧库存原样保留，没有新礼物或回收旧赠物。身体、身份、年龄与性别不变。序列3名称编号有原核，全部新增机制、成品与专业准备均G；完整配方与仪式未知。';
