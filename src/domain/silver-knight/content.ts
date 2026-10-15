import type { SilverKnightAbilityId, SilverKnightPreparationId } from './types.js';

/** Verified directions are paraphrased. All people, finite scenes and quantities are original G. */
export const SILVER_KNIGHT_GUIDE = '58岁导师奥斯里克·韦尔（SK3-OSRIC，独立原创G人物）';
export const SILVER_KNIGHT_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const SILVER_KNIGHT_MIN_DEMON_HUNTER_WEEKS = 12;
export const SILVER_KNIGHT_LABOUR_STEPS = 5;
export const SILVER_KNIGHT_BOTTLE_IDS = ['silver-knight-potion-1', 'silver-knight-potion-2', 'silver-knight-potion-3'] as const;
export const SILVER_KNIGHT_FORMULA_STATUS = '战士途径序列3银骑士已原核。完整魔药配方、材料用量与祭坛精确布局尚未核实，配方保持未知，不开放自制。原核仪式要求复杂祭坛、本人猎杀六种强大生物的遗骸正确放位，以及神的祝福；天使也可给予祝福。本作六种强生物、六角布局、独立成品原瓶与原创天使奥瑞尔均明确为G实现，不将六种遗骸当六味药材。';
export const SILVER_KNIGHT_SOURCE_STATUS = '第五部第174章记载实质银甲、借光隐藏、常规维持晨曦剑及可传送绕过大部分屏障的银白细剑；细剑仍可闪避，并非必中或穿全部屏障。第五部第176章给出亲猎六种强大生物遗骸、复杂祭坛与祝福的仪式要素；第六部支持天使给予祝福。第六部第26章说明祝福差异及高位锚的需要，生命中具有神秘意义的鲜明经历可作锚。不把科林获得的特殊祝福、水银化或随机好运普授；序列2名称与能力本次未核。以下全部独立人物、地点、数值与操作方案均为原创G。';
export const SILVER_KNIGHT_POTION_SOURCES = SILVER_KNIGHT_BOTTLE_IDS.map((id, i) => ({ id, source: `${SILVER_KNIGHT_GUIDE}介绍的独立银骑士成品交接渠道G初始批次第${i + 1}瓶序列3成品魔药，独立封存原瓶${id}；非旧猎魔者原瓶改装。完整配方未知，六种亲猎与实际祝福另行完成。` }));
export const SILVER_KNIGHT_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const SILVER_KNIGHT_PREPARATIONS: { id: SilverKnightPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_HUNT', title: '核读亲猎条件与原目标边界', description: '本人实际核读六种不同强生物、原地点、本人击杀和原遗骸的条件。旧已投降灰烬哨卫、原低强度灰蛾及购买材料都不能冒充亲猎；未发生的战斗不预写成成功。' },
  { id: 'RECORD_ANCHOR', title: '亲笔记录原训练与护人经历', description: '本人将原战士训练和守护者护人报告写入唯一SK3-ANCHOR-JOURNAL，关联原奥斯温、原事件编号和已有结果；记住自己的经历，不免费生成信众、信仰或新人物同意。' },
  { id: 'READ_ALTAR', title: '实读六角祭坛布局与普通退路', description: '读奥斯里克提出的G六角方案：北岩壳、东北烬翼、东南雾角、南棘影、西南鸣骨、西北霜脊。每件须源于本人实际击杀的原个体；礼堂门至祭坛4米、会见点6米，均须普通走返。' },
];
export const SILVER_KNIGHT_ABILITIES: { id: SilverKnightAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s3.silver-armor', label: '实质银甲', description: '凝聚实际银甲，有有限防护和完整度，实际负载会损耗；不免所有伤势。有限演练6灵性、知识18，失败照耗，负载与数值均G。' },
  { id: 'warrior.s3.light-concealment', label: '借光隐藏', description: '本人须实际走到原光区，借现存光隐藏，观察者可察觉；光熄或停止即在同一原位置显露。不穿墙、不免碰撞、不令所有人自动看不见。有限演练6灵性、知识18为G。' },
  { id: 'warrior.s3.silver-thrust', label: '传送银白细剑', description: '核实真实目标后使有限银白细剑绕过普通屏障，仍可能失手或遭高位封锁。不是本人传送，不复制原晨曦剑。有限演练6灵性、知识18为G。' },
];
export const SILVER_KNIGHT_CONSUMPTION_RISK = '全部定量均G：猎魔者消化100、晋4后12整周、健康>20且精神>40，三个不同1行动准备、六种本人实际击杀并收集的原遗骸、原锚记录及奥瑞尔当周实际祝福齐全。本人逐一正确放位后，1行动与140便士实际应用本次封护粉及祭坛材料一份；0行动独立确认饮用所选原瓶，意志难度30。大成功：晋3、精神−8；成功：晋3、精神−15；失败：留4、健康−15、精神−25、排异+30；灾难：留4、健康−25、精神−45、排异+60。无论药物结果，原瓶、本次六遗骸、祝福与已用祭坛耗材均耗尽。药败后下一真实周可调查同种新的原个体，再实际亲猎采集；旧尸不会复活。取消未喝不退款、不复原已用耗材，原遗骸仍在祭坛原槽。G专业支持仅将本次药物排异后的健康与精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，灵性上限120且当前不补满，性别不改变；旧六阶全部原人、原物、掌握和伤势保留，新三项掌握0。';
