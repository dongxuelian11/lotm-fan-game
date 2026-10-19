import { ASTROLOGER_GUIDE } from '../astrologer/content.js';
import type { RecorderAbilityId, RecorderInstructorId, RecorderSampleId } from './types.js';
export { RECORDER_CASE_IDS } from './types.js';

export const RECORDER_GUIDE = ASTROLOGER_GUIDE;
export const RECORDER_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const RECORDER_MIN_ASTROLOGER_WEEKS = 12;
export const RECORDER_LABOUR_STEPS = 5;
export const RECORDER_BOTTLE_IDS = ['recorder-potion-1', 'recorder-potion-2', 'recorder-potion-3'] as const;
export const RECORDER_SOURCE_STATUS = '第五部第68章支持记录官亲眼见到非凡能力、在脑海和灵体内记录后释放；初始低序列7—9容量20、效果接近原版，中序列5—6容量8、约半威力，半神能力容量1且极难记录。容量不等于已填充能力，也没有每日自动清空。第五部第155章中一次已记录旅行用掉后不能返回，支持记录释放一次即消耗；记录官没有自带序列5旅行。此段只开放原成年导师诺拉·维恩的序列8低强闪光，以及本人明确同意的原创成年歌颂者萨芙·里恩的序列9鼓舞，必须亲到原教学室付行动观看本次实际示范并尝试记录。原教师消耗有限灵性，玩家成功才获一份原来源记录，失败不返成本。人物、教学现场、费用、检定、恢复和效果数值均为本作原创G。';
export const RECORDER_FORMULA_STATUS = '记录官完整配方尚未核实；仅有脑与诅咒物等主材线索，不拼补确切名称、剂量或调配顺序。G用药指导不解锁完整配方、材料采购或调配，只交付独立序列6成品原瓶，不沿用学徒、戏法大师或占星人旧药。';
export const RECORDER_POTION_SOURCES = RECORDER_BOTTLE_IDS.map((id, index) => ({ id, source: `${RECORDER_GUIDE}经独立记录官成品交接渠道实际取得的第${index + 1}瓶序列6记录官成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非学徒、戏法大师或占星人旧瓶改装，未声称掌握完整配方。` }));
export const RECORDER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原教学室公开交接册', '检查原教学室不透光屏障', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const RECORDER_CAPACITIES = [
  { tier: 'LOW', label: '低序列7—9', maximum: 20, boundary: '接近原版；当前只有两种实际可见教学样本，空位不会赠送能力。' },
  { tier: 'MID', label: '中序列5—6', maximum: 8, boundary: '约半威力；本阶段没有可亲见记录的中序列来源。' },
  { tier: 'DIVINE', label: '半神', maximum: 1, boundary: '极难记录；本阶段没有已核实可用的半神来源。' },
] as const;
export const RECORDER_SAMPLES: Record<RecorderSampleId, { label: string; actor: RecorderInstructorId; name: string; sequence: 8 | 9; source: string }> = {
  FLASH: { label: '低强闪光', actor: 'NORA', name: RECORDER_GUIDE, sequence: 8, source: '原成年导师诺拉·维恩亲自在贝克兰德原教学室示范序列8低强闪光；不透光原屏障挡住旁观者视线，玩家在已确认的侧面安全观察位亲见空靶上的有限作用。' },
  COURAGE: { label: '有限鼓舞', actor: 'SAFF', name: '萨芙·里恩', sequence: 9, source: '原创成年歌颂者萨芙·里恩明确同意，在同一原教学室向本次自愿听取的玩家示范序列9短句鼓舞；本人随时可停止，示范结束即停止短效，不强迫旁人。' },
};
export const RECORDER_ABILITIES: { id: RecorderAbilityId; label: string; description: string }[] = [
  { id: 'door.s6.recording', label: '亲见记录', description: '亲自在场看见实际非凡能力后，以脑海和灵体尝试记录；不是抄写传闻或从空槽获得能力。本段每样本每真实周最多一次：1行动、玩家3灵性、知识14，原教师另耗2灵性，成功获得一份独立STORED记录。每位教师有限池上限20，仅在下次付行动亲访时按实际间隔每周恢复2。' },
  { id: 'door.s6.release', label: '消耗原记录释放', description: '每次释放必须拥有匹配的原STORED记录，消耗其中恰好一份和2灵性，成功或失败都不会返还。低序列效果接近原版但仍有限且可失败；记录不自动过期，不会从低阶样本生成旅行、复制物品或成为永久技能。' },
];
export const RECORDER_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；占星人消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年导师在场处理中断排异，不随机即死；休养可恢复，原瓶不会复原。这份保护不适用于战斗。失败保留占星人消化和全部原掌握；成功只新增两项0掌握，四属性各+1，灵性上限80但当前值不补满，记录库初始为空。';
