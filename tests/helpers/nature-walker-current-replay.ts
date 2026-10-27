import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

// Expected CURRENT replay output only. Captured/migrated originals never pass
// through this adapter when asserting historical state or file hashes.
export const NATURE_WALKER_CAPTURE_GUIDE_INDEX = 1323;
export const NATURE_WALKER_CAPTURE_GUIDE_REVISION = 853;
const GUIDE_ID = 'record-853-1323';
const GUIDE_TITLE = '听取自然行者独立成品与专业准备指导';
export const NATURE_WALKER_CAPTURE_GUIDE_TEXT = "花1行动、500便士。苗圃照料员伊芙·莫兰介绍的专业交接处的独立自然行者成品渠道说明当前渠道记录。交接处只交付独立封存的自然行者成品，不提供完整配方或自行调配方案。先核对耕种者至荒芜主母八阶真实经历与同一原人原物，检查原活苗回应及本人可见冲量的有限边界，再走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。已有女性身体保持，不发生新的性别变化，也可以继续作为荒芜主母生活。荒芜主母消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，15项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，已有性别与身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。";
export const NATURE_WALKER_CURRENT_GUIDE_TEXT = "花1行动、500便士。苗圃照料员伊芙·莫兰介绍的专业交接处的独立自然行者成品渠道说明当前渠道记录。交接处只交付独立封存的自然行者成品，不提供完整配方或自行调配方案。先核对耕种者至荒芜主母八阶真实经历与同一原人原物，检查原活苗回应及本人可见冲量的有限边界，再走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。已有女性身体保持，不发生新的性别变化，也可以继续作为荒芜主母生活。荒芜主母消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，15项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，已有性别与身体保持。最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。";

function assertExactGuide(entry: SliceState['chronicle'][number] | undefined): void {
  if (!entry || entry.id !== GUIDE_ID || entry.week !== 212 || entry.title !== GUIDE_TITLE ||
      (entry.text !== NATURE_WALKER_CAPTURE_GUIDE_TEXT && entry.text !== NATURE_WALKER_CURRENT_GUIDE_TEXT)) {
    throw new Error('Unexpected original Nature Walker guidance record; refusing replay expectation adaptation.');
  }
}

export function currentNatureWalkerReplayExpectation(captured: SliceState): SliceState {
  if (captured.schemaVersion !== CURRENT_SCHEMA_VERSION || captured.contentVersion !== CURRENT_CONTENT_VERSION) {
    throw new Error('Migrate the capture before constructing a CURRENT replay expectation.');
  }
  const guide = captured.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX];
  assertExactGuide(guide);
  if (captured.chronicle.filter(entry => entry.id === GUIDE_ID).length !== 1) {
    throw new Error('Unexpected duplicate Nature Walker guidance record.');
  }
  const mirrored = captured.lastResult?.id === GUIDE_ID;
  if (mirrored) {
    assertExactGuide(captured.lastResult!);
    if (captured.lastResult!.text !== guide!.text) throw new Error('Nature Walker guidance lastResult mirror differs.');
  }
  const expected = structuredClone(captured);
  expected.chronicle[NATURE_WALKER_CAPTURE_GUIDE_INDEX]!.text = NATURE_WALKER_CURRENT_GUIDE_TEXT;
  if (mirrored) expected.lastResult!.text = NATURE_WALKER_CURRENT_GUIDE_TEXT;
  return expected;
}


// The104 immutable public rows contain exactly these two presentation changes.
// Match whole old/new strings and the three observed original-bottle inventories;
// never strip fields or normalize an arbitrary public projection.
export const NATURE_WALKER_CAPTURE_PUBLIC_RISK = "荒芜主母消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，15项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，已有性别与身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。";
export const NATURE_WALKER_CURRENT_PUBLIC_RISK = "荒芜主母消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，15项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，已有性别与身体保持。最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。";
const PUBLIC_SUPPLIES = [
  ["供应方尚持3瓶，你持未服原瓶0瓶，已耗尽0瓶。每瓶7200便士，或为本瓶完成五项真实劳动后支付1200便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。", "供应方尚持3瓶，你持未服原瓶0瓶，已耗尽0瓶。每瓶7200便士，或为本瓶完成五项真实劳动后支付1200便士；最初三瓶全部失败后可调查同一原特性，隔周付费交接；新普通药物900便士，或五项新劳动后90便士。当周场地检查另付180便士，不增加第四份原特性。"],
  ["供应方尚持2瓶，你持未服原瓶1瓶，已耗尽0瓶。每瓶7200便士，或为本瓶完成五项真实劳动后支付1200便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。", "供应方尚持2瓶，你持未服原瓶1瓶，已耗尽0瓶。每瓶7200便士，或为本瓶完成五项真实劳动后支付1200便士；最初三瓶全部失败后可调查同一原特性，隔周付费交接；新普通药物900便士，或五项新劳动后90便士。当周场地检查另付180便士，不增加第四份原特性。"],
  ["供应方尚持2瓶，你持未服原瓶0瓶，已耗尽1瓶。每瓶7200便士，或为本瓶完成五项真实劳动后支付1200便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。", "供应方尚持2瓶，你持未服原瓶0瓶，已耗尽1瓶。每瓶7200便士，或为本瓶完成五项真实劳动后支付1200便士；最初三瓶全部失败后可调查同一原特性，隔周付费交接；新普通药物900便士，或五项新劳动后90便士。当周场地检查另付180便士，不增加第四份原特性。"],
 ] as const;

export function currentNatureWalkerPublicReplayExpectation<T extends { natureWalker: { risk: string; supplies: string } }>(captured: T): T {
  const { risk, supplies } = captured.natureWalker;
  if (risk !== NATURE_WALKER_CAPTURE_PUBLIC_RISK && risk !== NATURE_WALKER_CURRENT_PUBLIC_RISK) {
    throw new Error('Unexpected original Nature Walker public risk; refusing replay expectation adaptation.');
  }
  const pair = PUBLIC_SUPPLIES.find(([oldText, currentText]) => supplies === oldText || supplies === currentText);
  if (!pair) throw new Error('Unexpected original Nature Walker public supplies; refusing replay expectation adaptation.');
  const expected = structuredClone(captured);
  expected.natureWalker.risk = NATURE_WALKER_CURRENT_PUBLIC_RISK;
  expected.natureWalker.supplies = pair[1];
  return expected;
}
