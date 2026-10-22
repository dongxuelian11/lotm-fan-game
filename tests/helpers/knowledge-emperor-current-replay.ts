import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

// Expected CURRENT replay output only. Captured/migrated originals never pass
// through this adapter when asserting historical state or file hashes.
export const KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX = 1019;
const GUIDE_ID = 'record-665-1019';
const GUIDE_TITLE = '听取知识皇帝独立成品与专业准备指导';
export const KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_TEXT = "花1行动、500便士。贝克兰德原档案馆专业交接处的独立知识皇帝成品渠道说明当前渠道记录。交接处只交付独立封存的知识皇帝成品，不提供可自行调配的完整配方。先核对窥秘人至贤者的八阶真实经历与当前凭据，复核知识和实际力量的有限往返，走查停止与普通返程。三项专业准备完成后，还须检查本周服药场地，再独立确认饮用所选原瓶。贤者消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备均耗尽，专业支持只将本次排异后的健康精神保底到1。成功四属性各+1，13项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满。姓名、性别、身体、旧伤与既有性格保留。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。";
export const KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT = "花1行动、500便士。贝克兰德原档案馆专业交接处的独立知识皇帝成品渠道说明当前渠道记录。交接处只交付独立封存的知识皇帝成品，不提供可自行调配的完整配方。先核对窥秘人至贤者的八阶真实经历与当前凭据，复核知识和实际力量的有限往返，走查停止与普通返程。三项专业准备完成后，还须检查本周服药场地，再独立确认饮用所选原瓶。贤者消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备均耗尽，专业支持只将本次排异后的健康精神保底到1。成功四属性各+1，13项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满。姓名、性别、身体、旧伤与既有性格保留。最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。";

function assertExactGuide(entry: SliceState['chronicle'][number] | undefined): void {
  if (!entry || entry.id !== GUIDE_ID || entry.week !== 155 || entry.title !== GUIDE_TITLE ||
      (entry.text !== KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_TEXT && entry.text !== KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT)) {
    throw new Error('Unexpected original Knowledge Emperor guidance record; refusing replay expectation adaptation.');
  }
}

export function currentKnowledgeEmperorReplayExpectation(captured: SliceState): SliceState {
  if (captured.schemaVersion !== CURRENT_SCHEMA_VERSION || captured.contentVersion !== CURRENT_CONTENT_VERSION) {
    throw new Error('Migrate the capture before constructing a CURRENT replay expectation.');
  }
  const guide = captured.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX];
  assertExactGuide(guide);
  if (captured.chronicle.filter(entry => entry.id === GUIDE_ID).length !== 1) {
    throw new Error('Unexpected duplicate Knowledge Emperor guidance record.');
  }
  const mirrored = captured.lastResult?.id === GUIDE_ID;
  if (mirrored) {
    assertExactGuide(captured.lastResult!);
    if (captured.lastResult!.text !== guide!.text) throw new Error('Knowledge Emperor guidance lastResult mirror differs.');
  }
  const expected = structuredClone(captured);
  expected.chronicle[KNOWLEDGE_EMPEROR_CAPTURE_GUIDE_INDEX]!.text = KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT;
  if (mirrored) expected.lastResult!.text = KNOWLEDGE_EMPEROR_CURRENT_GUIDE_TEXT;
  return expected;
}
