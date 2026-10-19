import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

// Expected CURRENT replay output only. Captured/migrated originals never pass
// through this adapter when asserting historical state or file hashes.
export const TIME_WORM_CAPTURE_GUIDE_INDEX = 863;
const GUIDE_ID = 'record-565-863';
const GUIDE_TITLE = '听取时之虫独立成品与专业准备指导';
export const TIME_WORM_CAPTURE_GUIDE_TEXT = "花1行动、500便士。贝克兰德时之虫独立成品交接处说明原渠道记录。交接处供应分别封存的时之虫成品魔药。服用前先核对偷盗者至命运木马的八阶原瓶、三份实际报告与反思，写明一次尚未发生的查看动作，再走查停止和普通返回路线。三项专业准备分别完成后，另付费检查当周场地，再独立确认饮用所选原瓶。要求命运木马消化100、从其实际晋升周起满12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动；另付1行动与150便士检查当周场地，再以0行动独立确认饮用所选原瓶，意志30。大成功晋升、精神−8；成功晋升、精神−15；失败仍为命运木马、健康−15精神−25排异+30；严重排异仍为命运木马、健康−25精神−45排异+60。原瓶与本次准备均耗尽；专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，十四项旧掌握保持原值，两项新掌握从0开始，灵性上限120且当前不补满。姓名、性别、年龄、性格、取向、原伤势与旧人的结局不变。三瓶全部失败耗尽后，可花1行动与100便士申请下一批，至少跨一真实周再接收三瓶；各瓶费用与准备单独结算。";
export const TIME_WORM_CURRENT_GUIDE_TEXT = "花1行动、500便士。贝克兰德时之虫独立成品交接处说明原渠道记录。交接处供应分别封存的时之虫成品魔药。服用前先核对偷盗者至命运木马的八阶原瓶、三份实际报告与反思，写明一次尚未发生的查看动作，再走查停止和普通返回路线。三项专业准备分别完成后，另付费检查当周场地，再独立确认饮用所选原瓶。要求命运木马消化100、从其实际晋升周起满12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动；另付1行动与150便士检查当周场地，再以0行动独立确认饮用所选原瓶，意志30。大成功晋升、精神−8；成功晋升、精神−15；失败仍为命运木马、健康−15精神−25排异+30；严重排异仍为命运木马、健康−25精神−45排异+60。原瓶与本次准备均耗尽；专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，十四项旧掌握保持原值，两项新掌握从0开始，灵性上限120且当前不补满。姓名、性别、年龄、性格、取向、原伤势与旧人的结局不变。最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查、核验并封存同一原特性，至少下一真实周以1行动和30便士当面回收；新普通药物与调配服务900便士，或五项新劳动后90便士。当周准备仍另行付费，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。";

function assertExactGuide(entry: SliceState['chronicle'][number] | undefined): void {
  if (!entry || entry.id !== GUIDE_ID || entry.week !== 130 || entry.title !== GUIDE_TITLE ||
      (entry.text !== TIME_WORM_CAPTURE_GUIDE_TEXT && entry.text !== TIME_WORM_CURRENT_GUIDE_TEXT)) {
    throw new Error('Unexpected original Time Worm guidance record; refusing replay expectation adaptation.');
  }
}

export function currentTimeWormReplayExpectation(captured: SliceState): SliceState {
  if (captured.schemaVersion !== CURRENT_SCHEMA_VERSION || captured.contentVersion !== CURRENT_CONTENT_VERSION) {
    throw new Error('Migrate the capture before constructing a CURRENT replay expectation.');
  }
  const guide = captured.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX];
  assertExactGuide(guide);
  if (captured.chronicle.filter(entry => entry.id === GUIDE_ID).length !== 1) {
    throw new Error('Unexpected duplicate Time Worm guidance record.');
  }
  const mirrored = captured.lastResult?.id === GUIDE_ID;
  if (mirrored) {
    assertExactGuide(captured.lastResult!);
    if (captured.lastResult!.text !== guide!.text) throw new Error('Time Worm guidance lastResult mirror differs.');
  }
  const expected = structuredClone(captured);
  expected.chronicle[TIME_WORM_CAPTURE_GUIDE_INDEX]!.text = TIME_WORM_CURRENT_GUIDE_TEXT;
  if (mirrored) expected.lastResult!.text = TIME_WORM_CURRENT_GUIDE_TEXT;
  return expected;
}
