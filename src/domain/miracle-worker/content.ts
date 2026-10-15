export const MIRACLE_WORKER_FORMULA = [
 {id:'dark-wolf-heart',name:'乌黯魔狼（愿望之神）心脏',quantity:1,unit:'颗',note:'本批采用心脏路线；原著另可用另一奇迹师非凡特性替代主材，不能同时收两份。'},
 {id:'dark-wolf-blood',name:'乌黯魔狼血',quantity:300,unit:'mL'},
 {id:'worm-of-time',name:'时之虫',quantity:1,unit:'条'},
 {id:'worm-of-stars',name:'星之虫',quantity:1,unit:'条'},
] as const;
export const MIRACLE_WORKER_ABILITY_IDS=['diviner.s2.wish','diviner.s2.probability','diviner.s2.scene-projection'] as const;
export const MIRACLE_WORKER_ABILITIES=[
 {id:'diviner.s2.wish',label:'积累同类愿望后的有限奇迹',description:'先实际满足他人的愿望，再尝试相应规模自许；真实原物、灵性与有限冷却，不是一句话任意改写现实。'},
 {id:'diviner.s2.probability',label:'有限概率影响',description:'先选择和付费，再有限增减一次机会；上限不是100%，不重抽已发生的结果。'},
 {id:'diviner.s2.scene-projection',label:'熟悉场景的历史影像',description:'真实观察过的有限庭院，初版一次一幅30秒G；无独立人物/装备库存，不能改过去或带出永久财产。'},
] as const;
export const MIRACLE_WORKER_SOURCE='原著第六部20—21章：已核完整配方，以及让一段遗落历史重回当前时代的仪式；仅写出、传播古史不够。第七部2—3章：先满足他人、同类愿望积累，有限概率与场景历史影像。';
export const MIRACLE_WORKER_BOUNDARY='本作后世1651年的隔绝空间、代际聚落、通路维修、两位自愿代表、费用和600秒药窗均为G；不是冻结古人，也不是原著规定两人/固定规模。回归永久保留，药败不重置居民。原著4次复起上限；本角色无源堡预支，累计账本不因重载/晋阶补发。当前仅新石场遭遇建模有限复起，其他旧遭遇不提供已核通用复活，覆盖列入1.0验收。';
export const MIRACLE_WORKER_RISK='饮药成功/大成功晋升2，失败原瓶耗尽、身心损害与排异保留。完成回归并非保证晋升；本作G专业支持仅对该药败保底1，不保护普通战死。现有来源用尽可付费调查、跨真实周实核新独立旧址；新原人原件、新材料与回归全部须实际完成，不重复已回归聚落。';
