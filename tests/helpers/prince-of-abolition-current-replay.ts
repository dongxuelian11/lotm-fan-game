import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

// Expected CURRENT full-campaign replay output only. Migration, historical
// boundaries, captured state and file hashes keep the original guidance verbatim.
export const PRINCE_OF_ABOLITION_CAPTURE_GUIDE_INDEX = 1188;
export const PRINCE_OF_ABOLITION_CAPTURE_GUIDE_REVISION = 745;
const GUIDE_ID = 'record-745-1188';
const GUIDE_TITLE = '听取弑序亲王独立成品与专业准备指导';
export const PRINCE_OF_ABOLITION_CAPTURE_GUIDE_TEXT = "花1行动、500便士。米蕾介绍的专业交接处的独立弑序亲王成品渠道说明当前渠道记录。专业交接处只交付独立封存的弑序亲王成品，不提供完整配方或自行调配方案。先核对律师至熵之公爵八阶真实经历、同一原演练房与原包球纸，检查本人的待执行动作和未结束效果的有限边界，并走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。也可以继续作为熵之公爵生活。熵之公爵消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，14项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，性别与既有身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。";
export const PRINCE_OF_ABOLITION_CURRENT_GUIDE_TEXT = "花1行动、500便士。米蕾介绍的专业交接处的独立弑序亲王成品渠道说明当前渠道记录。专业交接处只交付独立封存的弑序亲王成品，不提供完整配方或自行调配方案。先核对律师至熵之公爵八阶真实经历、同一原演练房与原包球纸，检查本人的待执行动作和未结束效果的有限边界，并走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。也可以继续作为熵之公爵生活。熵之公爵消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，14项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，性别与既有身体保持。最初三瓶全部失败耗尽后，只能在原服药准备交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。";

function assertExactGuide(entry: SliceState['chronicle'][number] | undefined): void {
  if (!entry || entry.id !== GUIDE_ID || entry.week !== 185 || entry.title !== GUIDE_TITLE ||
      (entry.text !== PRINCE_OF_ABOLITION_CAPTURE_GUIDE_TEXT && entry.text !== PRINCE_OF_ABOLITION_CURRENT_GUIDE_TEXT)) {
    throw new Error('Unexpected original Prince of Abolition guidance record; refusing replay expectation adaptation.');
  }
}

export function currentPrinceOfAbolitionReplayExpectation(captured: SliceState): SliceState {
  if (captured.schemaVersion !== CURRENT_SCHEMA_VERSION || captured.contentVersion !== CURRENT_CONTENT_VERSION) {
    throw new Error('Migrate the capture before constructing a CURRENT replay expectation.');
  }
  const guide = captured.chronicle[PRINCE_OF_ABOLITION_CAPTURE_GUIDE_INDEX];
  const matches = captured.chronicle.filter(entry => entry.id === GUIDE_ID);
  if (captured.revision < PRINCE_OF_ABOLITION_CAPTURE_GUIDE_REVISION) {
    if (matches.length || captured.lastResult?.id === GUIDE_ID || captured.princeOfAbolition.guidanceKnown) {
      throw new Error('Unexpected early Prince of Abolition guidance record.');
    }
    return captured;
  }
  assertExactGuide(guide);
  if (matches.length !== 1) throw new Error('Unexpected duplicate Prince of Abolition guidance record.');
  const mirrored = captured.lastResult?.id === GUIDE_ID;
  if (mirrored) {
    assertExactGuide(captured.lastResult!);
    if (captured.lastResult!.text !== guide!.text) throw new Error('Prince of Abolition guidance lastResult mirror differs.');
  }
  const expected = structuredClone(captured);
  expected.chronicle[PRINCE_OF_ABOLITION_CAPTURE_GUIDE_INDEX]!.text = PRINCE_OF_ABOLITION_CURRENT_GUIDE_TEXT;
  if (mirrored) expected.lastResult!.text = PRINCE_OF_ABOLITION_CURRENT_GUIDE_TEXT;
  return expected;
}
