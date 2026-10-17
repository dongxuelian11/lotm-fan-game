# 0.212.0 月亮阶段验收说明

状态：自然结果、原捕获冻结版本的26次保存专项、公开字段修复后的254条重放与真实终态SQLite、39份输入的独立完整恢复均已通过；最终定点及相关回归去重59个文件、834项断言通过，0失败、0未完成；59项Node契约另计。最终严格类型与生产构建通过，全部4,423份运行冻结成员重新核等。未合并main，远端Windows检查以对应分支实际终值为准。本文分别记录捕获版本、修复版本与未完成范围，不把专项通过视为全量通过。

## 实际自然结果

从美神阶段原670条命令的活截点，按原种子继续254条，共924条。起点为序列2、第160周、健康85、精神75、灵性120、现金14便士、1行动、污染30。原三瓶均已失败，三次44%检定的48、67、86及费用保持。

后续五个普通载体均由付费劳务、准备与同一失败原特性的实际回收取得，前四次失败，第五次在第763条命令晋1。因此是原三次失败加新四次失败后，累计第八次服药成功；瓶身份与原特性身份分开，未产生第四份独立特性。原21项继承掌握、原人物、物品和旧身体记录连续保留。

三站六名原乘客实际抵岸，另两份原特性及唯一原件交接后，第903条命令、第207周首次服用月亮魔药，以70%成功率掷12晋0。

最终为第211周、ACTIVE、序列0，健康92、精神83、灵性128、现金2996便士、0行动，一处轻伤、风险1。“月照航道”掷93失败；“柔和渡行”掷55成功，但六十秒窗口在真正转移前已过期，两项新掌握均为0。原船员以原缆绳、付费灯油和普通划船真实转移两名原乘客并交接；没有重抽、补施或为了掌握重跑。

### 旧912条路线的兼容边界

旧912条美神路线是另一条保留历史，其中九份独立来源特性不能折算成当前路线的三份原件。当前迁移与读取保留它的历史事实，不重写成670条起点的后续，不据此授予当前月亮三原件的合法来历。存在第四份及以后独立来源冲突的历史，在矛盾未解决时不能进入本路线的材料资格。

## 已完成验证，按版本与范围区分

1. 自然捕获前：17个去重测试文件、231项通过。下文另列当前59项Node契约检查；两类结果分列，不相加声称同一组或全量历史测试。
2. 原捕获冻结版本：34份完整捕获成员及原始、压缩字节校验已固定；26/26个选定唯一SQLite转换全部通过，无别名、无合成转换。各转换覆盖保存前状态、只读启动、写入前与COMMIT失败回滚、重开、同一意图重试、私态/随机/被检查的公开结果一致、提交重开和重复幂等。捕获冻结与该次运行冻结完全相同。
3. 首次新增尾段复验：完整254条新命令的逐态重放2项通过，比较私态、随机、收据、所选章节公开结果与最终状态；3个真实SQLite代表转换也通过。原670条仅在该组中做输入字节认证及迁移验证，没有重新执行。26个选定边界与3个代表均不是924条逐命令SQLite全覆盖。
4. 初次真实终态界面检查实际失败，发现旧生命给予者战斗数据进入全局公开结果时带出内部来源与随机游标。前述限定章节投影的通过不能证明当时的完整公开结果安全。此失败保留，没有作为通过计入。
5. 捕获后的窄修仅修改两个源文件的公开字段白名单：对旧生命给予者战斗公开结果移除内部 `source` 与 `randomCursorAfter`，保留真实骰值、代价、原物和位置。五个关键状态的旧/新完整全局公开结果精确差分通过：原670起点、旧序列2首轮及战斗终态、903晋0、924最终报告；只允许声明的字段删除，私态保持，泄漏与过度删除负例均被拒绝。
6. 修复后：4项生命给予者公开边界测试、1项真实月亮终态界面测试通过，严格main/完整renderer类型检查及生产构建通过。终态界面核验包含打开、重新打开、实际代价和轻伤、两名原乘客转移与两项新技巧零掌握。
7. 修复后完整254条新增命令逐态重放通过2项：逐步私态、随机和原章节公开hash保持，每步另做完整全局公开敏感字段检查。最终第924条真实SQLite代表通过1项，覆盖写入前与COMMIT失败回滚、同一意图重试、提交重开和重复幂等；该次定点选择未重跑另外两个先前已通过的代表。

原捕获冻结标识为 `b69820c9a81ce5a39daa27a54c72fa5cd675ec595fbe5e382bfdc21c2d283604`；这是该次捕获/运行时证据，不是发布提交或输入压缩包的hash。公开字段修复后源码已变化，不能把旧26/26结果写成当前最终源码重新执行过26次转换。

## 最终本地验收与未验证范围

- 当前定点及受影响历史回归：59个唯一文件、834项断言，0失败、0未完成；同一案例复跑只计一次。内含33个相关文件537项、智慧天使生活33项独立进程和完整愚者215条已提交命令逐态重放。冻结前已过且未受影响的结果保留，未宣称最终全仓库重跑。
- 最终全部变更后，严格main、完整renderer类型检查和生产构建全部通过；运行冻结的4,423个源码、依赖、产物与原输入成员逐字节/SHA256核等，仍为 `835f0c21ba65c7183f95145807a9987e6af1a7b59c128bbdf48ea4184d1352b4`。Vite大分块警告仍存在。
- 代码发布分支为 `feature/0.212.0-moon`。提交与远端Windows状态以该分支及其PR实际记录为准；本地通过不等于Windows全绿。

本阶段Windows尚未执行；可见Electron窗口、桌面实机体验和安装包未验收。没有重新运行全部历史测试；测试文件枚举、部分相关回归或Linux后端通过均不代替这些验收。

## 公开输入与复验命令

在发布分支仓库根目录，使用Node.js 24.15–24.x，先执行 `npm ci`。安装与启动见[README](../README.md)。以下命令说明复验方法；未完成项目仍以上节状态为准。

现有原始来源可由公共恢复器恢复：

```sh
npm run fixtures:restore -- --only-prefix life-giver-v01680 --only-prefix beauty-goddess-v01900
```

本阶段已打包34份月亮完整捕获文件及5份原特性回收输入，共39份。完整文件包已登记公共清单，并通过公共恢复器在独立目录实际恢复全部39份，集合无缺漏或多余、逐字节等于原件。使用同一公共恢复器：

```sh
npm run fixtures:restore -- --only-prefix moon-v02120 --only-prefix beauty-recovery-components
```

本阶段包为 `test-inputs/lotm_release_0.212.0_moon_test_inputs_1_2026-10-17.tar.gz`，13,926,765字节，SHA256 `07ef444eecdfc17ee4f735f80ceb7a835ef3eeb55f700ed3aba32d993a13cc4e`。39份成员合计15,963,887字节，独立完整恢复及原件逐字节比对通过。默认清单为 `test-inputs/manifest.json`；`test-inputs/moon-v02120-capture-files.json` 是捕获成员校验清单，不是压缩包恢复器的替代清单。

输入恢复后，可逐组运行公开测试；串行执行以避免同时载入多份大存档：

```sh
npm run typecheck
npm run build
node --test scripts/play/moon-stage.test.mjs scripts/verify/moon-stage-saves.test.mjs
npx vitest run tests/domain/beauty-goddess-original-recovery.test.ts tests/domain/moon-material-custody.test.ts tests/domain/moon-services.test.ts tests/domain/moon-epilogue.test.ts --maxWorkers=1 --no-file-parallelism
npx vitest run tests/domain/moon-natural.test.ts --maxWorkers=1 --no-file-parallelism
npx vitest run tests/backend/moon-capture-save.test.ts --maxWorkers=1 --no-file-parallelism
npx vitest run tests/domain/life-giver-public.test.ts tests/renderer/moon-captured-result.test.tsx --maxWorkers=1 --no-file-parallelism
npx vitest run tests/renderer/moon-panel.test.tsx tests/renderer/moon-success-navigation.test.tsx --maxWorkers=1 --no-file-parallelism
npm run test:fixture-restore
```

`moon-natural.test.ts`核验原输入并重放全部254条新增命令；`moon-capture-save.test.ts`验证真实第763、903、924条命令的3个代表转换；二者范围不同。公开字段修复后的测试另检查完整公开结果，而非仅章节投影。

原26转换验证器的冻结要求已完成一项明确受限的兼容调整：保留原捕获freeze，只允许从已固定旧版本到已固定公开修复版本的精确源码及对应编译产物hash变化，其他漂移仍拒绝；续跑继续绑定完整运行时冻结与验证脚本。59项生产器/专项Node契约检查通过，真实只读预检通过。完整新运行时hash为 `835f0c21ba65c7183f95145807a9987e6af1a7b59c128bbdf48ea4184d1352b4`。此调整不会将原26/26标成修后重跑；本轮已补修后最终代表。

下列专项命令用于在严格冻结环境复做26个真实捕获转换。输出目录必须是新的目录；先执行只读预检，再执行事务验证。修后只读预检已通过，完整26次事务本轮未重跑。该专项严格绑定Node v24.19.0、依赖、源码和编译产物；普通当前历史回归使用上面的Vitest命令。

```sh
node --expose-gc scripts/verify/moon-stage-saves.mjs --source-directory tests/fixtures/moon-v02120 --input-manifest test-inputs/moon-v02120-capture-files.json --input-manifest-sha256 2a0184b5618aba7601e9a516b3a721b32b0dc58bfca34589209877f9093dd79c --freeze-sha256 b69820c9a81ce5a39daa27a54c72fa5cd675ec595fbe5e382bfdc21c2d283604 --verifier-sha256 ca34f50307ded911a30410a3c5e8efd55538aeb8226da05d5dd12dc964027280 --expected-boundaries 26 --preflight
node --expose-gc scripts/verify/moon-stage-saves.mjs --source-directory tests/fixtures/moon-v02120 --input-manifest test-inputs/moon-v02120-capture-files.json --input-manifest-sha256 2a0184b5618aba7601e9a516b3a721b32b0dc58bfca34589209877f9093dd79c --freeze-sha256 b69820c9a81ce5a39daa27a54c72fa5cd675ec595fbe5e382bfdc21c2d283604 --verifier-sha256 ca34f50307ded911a30410a3c5e8efd55538aeb8226da05d5dd12dc964027280 --expected-boundaries 26 --output-directory moon-sqlite-recheck
```

验证器SHA256已在命令中固定。不能改写原freeze、删除校验或自行放宽允许变化。是否在当前源码实际重做全部26转换，必须以该次完整报告为准；本次保留的原26/26与修后代表结果分别计数。

全量历史测试需要完整恢复。天灾共享15项、智慧天使生活33项在此环境采用仓库的独立进程入口；本阶段智慧天使33项已实际通过，天灾15项未重复执行。完整复验命令为：

```sh
npm run fixtures:restore
npm test -- --exclude tests/domain/catastrophe-shared.test.ts --exclude tests/domain/wisdom-angel-life.test.ts --maxWorkers=1 --no-file-parallelism
npm run test:catastrophe-isolated
npm run test:wisdom-angel-life-isolated
```

## 完成范围与来源

当前22条途径均有有限序列1；愚者、红祭司、空想家、完美者、月亮共五条有限序列0实现。自然晋0实路为愚者、红祭司、空想家、月亮。完美者自然路线死亡，独立受控成功只替换明确声明的一次新骰，不改变其自然结局。仍余17条序列0，完整1.0未完成。

玩法、有限能力、三原件守恒与原创设定边界见[月亮阶段记录](MOON_PLAYABLE_STAGE.md)。历史路线见[美神阶段记录](BEAUTY_GODDESS_PLAYABLE_STAGE.md)，自然死亡与受控成功的分列记录见[完美者阶段记录](PERFECTER_PLAYABLE_STAGE.md)。
