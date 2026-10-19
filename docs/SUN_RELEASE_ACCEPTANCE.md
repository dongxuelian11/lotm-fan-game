# 0.216.0 太阳：本地验收记录

## 范围与状态

基线为0.215.0本地提交 `e6212f77df0f37a3a3f45751b153021334f8542a`，当前候选分支为 `feature/0.216.0-sun`。本报告记录已完成的自然结果与分轮验收；25个受影响旧文件已完成整文件复验；全部范围去重为38个完整文件621项，另3项根适配聚焦与24项脚本纯合同检查。公开输入独立恢复、最终严格类型与生产构建均已通过。

已有22条途径的9→2有限切片与有限序列1；本章加入后共有九条有限序列0实现，其余13条序列0及完整1.0仍未完成。已有实际自然晋0路线为愚者、红祭司、空想家、月亮、黑暗、白塔、太阳七条。完美者自然线服药失败死亡，重建暴君自然线挑战太阳神死亡且未晋0，其成功分支来自独立受控用例。门、银骑士部分高阶证据使用定向起点，不据此称所有途径自然通关。

GitHub重新授权待用户完成，本候选尚未push、创建新PR或合并；远端CI、Windows实机、可见Electron窗口、安装包、干净机器及玩家实际验收均未完成。本地通过不等于发布。玩法、三份原特性和原著/原创边界见[太阳阶段记录](stages/0216-sun.md)。

## 真实自然结果

- 起点是0.194.0原853命令后的完整活态：序列1、第196周、健康100、精神98、灵性106、1250便士、3行动、无伤；保留原随机种子及游标385。
- 实际继续81条，共934条。没有重新执行前853条，没有换种子、重抽、补刷掌握或使用受控成功作为自然结果。
- 第923条、第214周首次晋0，实际成功率74%、掷57；第929条辉光70%、掷14成功，第930条实际应用才增长8掌握；第931条护持70%、掷95失败，健康减8并留一处轻伤。
- 第932—934条普通停炉泄压、沿十八米侧道实际撤人、如实报告。失败费用、耗材、伤势和原炉损耗全部保留。
- 终态 `ACTIVE`、序列0、第215周、1353年8月4日，健康92、精神64、灵性38、36便士、0行动、风险1、污染0、无未付本金，新掌握8/0，随机游标388。原22项掌握逐值不变，其中六项仍为0。
- 托马斯健康100；莉娜在院内且原脚踝伤保留；原炉状况72，两份原燃料耗尽，四份残留中和4、封闭0、外露0。原采光廊、旧许可及拒绝、旧人物去向、投降且重伤的西拉斯与原杆剩余3/4储能没有重置。

自然生产器只声明严格终态验证，不自行声明SQLite恢复；实际SQLite证据来自下列独立专项。完整捕获和终态checkpoint曾在独立目录恢复，零新增动作重开保持完整checkpoint不变。

## 已完成验证，按实际运行轮次记录

以下范围去重，不把早期失败中的部分通过、重复复验或聚焦检查重复累加。最终去重为38个完整文件621项，来自各完整文件的最终通过回执；不是同一次全游戏矩阵运行。

| 范围 | 已通过 | 回执与边界 |
|---|---:|---|
| 服务、材料、事故、同原份回收、继承公开边界 | 5文件76项 | `components-final.log/.exit`；分别9、32、12、20、3项 |
| 私有运行会话与导航 | 2文件17项 | `owned-runtime-save-ui.log` 中runtime8与navigation9整文件通过；同轮backend未执行不计 |
| 共享schema及面板 | 2文件13项 | `boundary-ui-initial.log` 中shared6与panel7整文件通过；当轮导航失败另由上项闭环 |
| 受控成功真实SQLite | 1文件4项 | `success-sqlite-owned-wired.log/.exit`；付费完整路线、保存冷重开、两写故障、同意图重试、伪造拒绝 |
| 新自然捕获逐态回放 | 1文件11项 | `sun-natural-public-fix2.log/.exit`；81条分为三个连续27条块，每条完整私态、RNG与公开边界核等 |
| 修后自然捕获保存代表 | 1文件2项 | `sun-capture-save-public-fix2.log/.exit`；真实第923、934条，每条均验两类故障、相同意图重试、冷重开及幂等 |
| 修后实际捕获界面 | 1文件7项 | `sun-captured-ui-public-fix.log/.exit`；使用真实捕获的完整界面文件 |
| 25个受影响旧文件 | 25文件491项 | `related-batch1..5` 的已过整文件，加 `light-seeker-combat-public-fix`、`pure-white-related-final`、`perfecter-schema-final` 最终整文件复验；集合恰好覆盖计划，无漏重 |

前四行合计10个完整新增/变更文件110项；捕获11、2、7项另为三个完整文件20项；旧相关25文件491项。三组文件集合互不重叠，合计38文件621项。每个文件都有完整通过回执，未将失败调用中失败文件的部分通过计入，也不冒充最终树单次全游戏矩阵。详见 `final-acceptance-scope.json`。

另列：

- `scripts/play/sun-stage.test.mjs` 生产器纯合同9项，日志 `sun-producer-pure-tests.log/.exit`。
- `scripts/play/verify-sun-real-saves.test.mjs` 核验器纯合同15项，日志 `sqlite-verifier-pure.log/.exit`。这些纯合同检查不等于真实SQLite事务。
- 旧黑暗、月亮、空想家根适配共3项聚焦检查，日志 `historical-root-focused.log/.exit`、`visionary-root-focused.log/.exit`；未选中的旧历史用例不计通过。
- main及完整renderer严格类型、生产构建均通过，最终日志 `typecheck-final.log/.exit`、`build-final.log/.exit`；构建仍提示大分块。构建后4586运行成员逐字节仍与当前冻结完全相同，见 `final-runtime-after-validation-proof.json`。

上列日志均位于 `output/rebuild-0216/`，结果索引为 `output/rebuild-0216/active-validation.json`。这些是本地验收产物路径，需从对应证据链恢复，不表示已经随代码公开交付。最终范围见 `final-acceptance-scope.json`；保存的早期索引和失败调用不能替代各最终完整日志。CI仅做文件枚举，1387文件 = 分片[174,173,173,173,173,173,173,173] + 两隔离文件，无漏重；此枚举不表示已执行远端矩阵。

## 原冻结34个唯一真实SQLite边界

原自然捕获冻结SHA256为 `d7f35f65cbf1da3d02842825314b8d30acb5ddbe94e121abb68a3c715b4bb883`，共4586成员。91个完整输入文件核验通过，34个选定边界均为不同实际转换，别名0。

完整结果为 `passed=true`、`complete=true`、`exitCode=0`、`completedTransitions=34`、`selectedUniqueTransitions=34`。每个边界均覆盖严格前态导入、只读bootstrap、beforeWrite及COMMIT失败回滚、私头/RNG/回执/选中周目/时间戳/备份保持、回滚后重开、完全相同意图重试、完整私态与章节/全局公开投影、提交后冷重开、重复意图幂等及最终重开。

34条为：854、856、857、858、859、860、861、862、864、865、866、868、869、871、878、879、881、900、904、905、909、917、919、922、923、926、927、928、929、930、931、932、933、934。

证据：

- `sqlite-natural-v1/report.json`、同目录 `manifest.json`、`completed.json`、`status.json`。
- `sqlite-natural-whole34.log` 及 `.exit`，`sqlite-original34-final-proof.json`。
- 原终报SHA256：`b0cfb1e685efa8ee6d604e71f58efaf08ed7450ec2ede662e25e15a81a7b6612`。

此专项使用原捕获冻结，只执行选中的真实转换；没有重放原853历史，也没有连续重跑全部81条。34边界之后的公开显示修正须由下一节单独说明。

## 公开显示修正及最终冻结

原捕获在真实晋0后，中央 `maxSpirituality` 错显示30，而太阳身体段已显示实际38/150；中央行动锁定也未完整接入太阳章节。最终只修正中央 `maxSpirituality`、`canAct`、`actionBlockedReason`，同一锁定条件自然影响 `projectRecovery` 的精确12个派生叶：

```text
recovery.locked
recovery.blockedReason
recovery.actions.rest.enabled
recovery.actions.rest.reason
recovery.actions.discover.enabled
recovery.actions.discover.reason
recovery.actions.work.enabled
recovery.actions.work.reason
recovery.actions.aid.enabled
recovery.actions.aid.reason
recovery.nextAction.enabled
recovery.nextAction.reason
```

指导第854条前态保持原值；真实指导后中央普通行动锁定，并提示在当前街区与筹备处继续。第923条真实晋0后上限显示150，实际灵性及费用不补充。支付/赊欠事件选项、其他公开字段、私态、原种子、游标和检定均不改动；没有忽略整个recovery对象或放宽输入冻结。

原始捕获文件与原公开hash保持原样。修后11项整文件对81条每一前后态核验完整私态和RNG相同，并精确限定上述公开差分；反例覆盖遗漏修正、多余字段、错误动作、错误版本、伪造晋升及越界recovery改动。第923、934条真实SQLite代表整2项与捕获UI整7项随后通过。**原冻结34/34与修后2/2是两项独立证据，不称最终树全34重跑。**

当前运行冻结为 `74775def96b35c09b00247e3191de8570a60b0c0aa242005c26a2bddfe6ab80e`，4586成员已核。相对原冻结只变更 `src/domain/slice/index.ts` 及对应 `dist/domain/slice/index.js`、`.js.map` 三个运行文件；原运行备份加精确三文件增量可以恢复当前冻结。

证据为 `public-fix-runtime-delta.json`、`runtime-public-fix-restore-proof.json`、`final-runtime-freeze.json`，最终验证状态以上述完整日志为准。

## 保留的失败记录

- 服务模块尚未交付时的导入受阻、导航入口缺失、受控准备路线漏记真实劳动均保留原失败日志。最终受控路线保留实际过周与补款，不能把跳过测试写成通过。
- 受控SQLite曾发现中央两处owned途径名单漏SUN；窄修接线后，原私头发布、丢弃草稿、失败回滚断言未删，整4项通过。
- 首次修后自然用例未列入既有recovery派生差分，11项中4项失败；补入精确12叶和反例后整11项通过，未改变私态、RNG或原捕获。
- 修后SQLite代表首次第934条实际耗时201633毫秒，超过180000毫秒预算；两代表的局部测试预算改为300000毫秒后整2项通过，没有全局放宽或删除事务断言。
- 终态打包的归档与独立恢复已完成后，最终控制台打印曾报错；仅修报告元数据，原退出1记录保留。恢复证明确认完整checkpoint未改、实际新增动作0。
- 旧相关首次失败包括：原纯白指导句精确变更、完成S1后成长入口转太阳准备页、旧逐光者公开期望仍含两项私有随机游标，以及Perfecter历史205逐个拒绝未来根用例5587毫秒超过5000毫秒。仅测试期望或该205实例预算修正，206/207仍5000毫秒；全部原事实与拒绝断言保留，最终相关25文件491项闭环。原194完整853条命令在旧相关回放中实际重验，指导差分只限一条已定位完整纪事句与该指导当回合结果；这不表示重新启动或改写新太阳自然捕获。

## 安装与当前树复验

应用要求Node.js 24.15–24.x；桌面启动还需图形环境及Electron运行时。浏览器内存试玩不代替真实SQLite桌面保存。

```sh
npm ci
npm run typecheck
npm run build
npm start
```

如安装时跳过Electron下载，可按现有流程执行 `npx --no-install install-electron`。浏览器开发为 `npm run dev:renderer`，桌面开发为 `npm run dev`。

本地公开输入候选已生成并独立恢复：新太阳6包共97,688,427字节，含91个完整文件共99,861,288字节。每包SHA256、每个安全成员路径/原字节及完整集合均核验；用已保存原捕获和独立recipe重新生成六包，压缩字节与SHA全部相同。

组合清单 `test-inputs/sun216-required-inputs.manifest.json` 含原194三包的全部139成员，以及新216六包91成员。公共恢复器在全新目录真实解出230文件、546,226,280字节，全部逐字节/SHA和精确集合核等。必须列全原194成员，因为恢复器也严格核验包内未单独使用的文件，不能只在清单中保留natural.json。最初不完整组合清单在任何文件写入前被拒，修正清单后整组恢复通过；产品与原输入未变。

新太阳清单SHA256：`b35c304d250622bbb9dccf1894d61ce40d97f112d7e9b013204723747fa17a9c`；完整组合清单SHA256：`63c8a53873f5755f03eb564499395135ae4ced12e1866ed13069b639d3d0ffd1`。恢复证明见 `public-full-restore-proof.json`，独立recipe证明见 `recipe-recreated-inputs/recipe-proof.json`。这些文件目前在本地候选和独立持久备份链中，尚未上传GitHub。

| 新输入包 | 字节 | SHA256 |
|---|---:|---|
| `lotm_release_0.216.0_sun_test_inputs_1_2026-10-18.tar.gz` | 17359090 | `e14d56bd3596bb942766d498468a8b2f9bbe42033ce278cbebc45be53d354ac1` |
| `lotm_release_0.216.0_sun_test_inputs_2_2026-10-18.tar.gz` | 17577661 | `fc15c9de26bc673c49178876c4683e834f4c16acce675e448b4464bc875c032f` |
| `lotm_release_0.216.0_sun_test_inputs_3_2026-10-18.tar.gz` | 16497810 | `c48d2204d58062e572b4587a809c27c95d5fb170adcf5347b29fb54cc438f954` |
| `lotm_release_0.216.0_sun_test_inputs_4_2026-10-18.tar.gz` | 16592562 | `f89ffc0f233cdd3ce7781673efccae0ae42c260df0693accd63c9ba80eb2e25e` |
| `lotm_release_0.216.0_sun_test_inputs_5_2026-10-18.tar.gz` | 16665350 | `28ce15ea4e19b78c8e3189a8fd811573f957ece1e3491a93cca558a1bdfe02cb` |
| `lotm_release_0.216.0_sun_test_inputs_6_2026-10-18.tar.gz` | 12995954 | `13ca2cd7d346b0a2314be55d51bef0a80b5cd6e6406b528fbc4f65c028465f82` |

```sh
node test-inputs/restore-test-inputs.mjs --manifest test-inputs/sun216-required-inputs.manifest.json
npm test -- tests/domain/sun-natural.test.ts --maxWorkers=1 --no-file-parallelism
npm test -- tests/backend/sun-capture-save.test.ts --maxWorkers=1 --no-file-parallelism
npm test -- tests/renderer/sun-captured-result.test.tsx --maxWorkers=1 --no-file-parallelism
node --test scripts/play/sun-stage.test.mjs scripts/play/verify-sun-real-saves.test.mjs
```

前10个完整文件的精确范围为：

```text
tests/domain/sun-services.test.ts
tests/domain/sun-materials.test.ts
tests/domain/sun-epilogue.test.ts
tests/domain/pure-white-angel-recovery-v216.test.ts
tests/domain/sun-inherited-public.test.ts
tests/domain/sun-runtime.test.ts
tests/backend/sun-owned-transaction.test.ts
tests/shared/sun.test.ts
tests/renderer/sun-panel.test.tsx
tests/renderer/sun-navigation.test.tsx
```

这些测试另有前阶历史输入依赖，不能假设仅恢复太阳组合清单就已覆盖。全部历史输入使用总清单恢复，既有大文件按隔离入口执行；这不是本轮已经跑完整矩阵的声明。

```sh
npm run fixtures:restore
npm run test:catastrophe-isolated
npm run test:wisdom-angel-life-isolated
```

## 单独复验原34边界

原34核验器严格绑定原冻结。当前修正版本运行时不满足原hash，应正常拒绝；不能更改冻结断言、换捕获或将新冻结冒充原验收。

1. 在独立目录检出 `665fb045d111ff8c98006ceca263447be2be276d`，不要把当前工作树回退。该提交增加原34核验器，尚未包含后来的中央公开显示修正；本地提交未上传前，公共克隆不能假设能取得它。
2. 使用Node.js **v24.19.0**，按 `lotm_sun216_natural854_runtime_manifest_20261018.json` 核验并恢复两份原运行包，再按 `lotm_sun216_natural855-934_delta_manifest_20261018.json` 恢复完整934捕获；恢复原194 `natural.json`。运行包、捕获与原输入必须逐项匹配原清单，不能用重新安装/构建代替精确恢复。
3. 恢复位于捕获目录之外的 `output/rebuild-0216/sqlite-inputs-final.json`。其SHA256必须为 `6facc9c327f39601f694ac226f46bf73231dea50dcc4cf0f2a75dbab550f617f`；核验器SHA256必须为 `268435659fc5216acba0436e6e47366c7f3ae058b76e3afa7078c91e24c810f1`。原源文件、编译产物、依赖、生产器与Node版本均须一致。
4. 先运行只读preflight，再改为新的空输出目录执行真实事务；不覆盖已有证据。完整执行返回34/34才可声称本次复验完成。续跑只能使用同一冻结、同一输入和同一输出目录。

```sh
git worktree add --detach ../sun216-original34 665fb045d111ff8c98006ceca263447be2be276d
cd ../sun216-original34
# 完成上述原运行、完整捕获和外置清单恢复后执行：
node --expose-gc scripts/play/verify-sun-real-saves.mjs \
  --input-manifest output/rebuild-0216/sqlite-inputs-final.json \
  --input-manifest-sha256 6facc9c327f39601f694ac226f46bf73231dea50dcc4cf0f2a75dbab550f617f \
  --freeze-sha256 d7f35f65cbf1da3d02842825314b8d30acb5ddbe94e121abb68a3c715b4bb883 \
  --verifier-sha256 268435659fc5216acba0436e6e47366c7f3ae058b76e3afa7078c91e24c810f1 \
  --expected-boundaries 34 --preflight-only
```

执行时将最后的 `--preflight-only` 换为 `--output-directory output/rebuild-0216/sqlite-original34-recheck`；中断恢复时改为 `--resume-directory output/rebuild-0216/sqlite-original34-recheck`。这些原运行恢复包为单独保存的证据链，不等同于正在交付的公开测试输入包；缺任何一项时保持 `NOT_AVAILABLE`，不以当前树宽松替代。

## 完整证据定位

- 原输入：`tests/fixtures/pure-white-angel-v01940/natural.json`，8199835字节，SHA256 `3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1`。
- 完整自然链：`output/rebuild-0216/natural-v1/` 下 `summary.json`、`checkpoint.json.gz`、`natural.json.gz`、`commands.ndjson.gz`、`action-854.json.gz` 至 `action-934.json.gz`、`boundaries.index.json`、`input-freeze.json`、`runtime-freeze.json`。
- 最终私态SHA256：`4d547a735ec49c0988ffdf398cb54fea623e7137d044dbf88ecccb497261b52d`；严格保留原853命令前缀，完整新81条捕获逐条绑定hash。
- 本地恢复链在仓库相邻 `../checkpoints/`：`lotm_sun216_natural854_runtime_manifest_20261018.json`、`lotm_sun216_natural854_runtime_restore_proof_20261018.json`、`lotm_sun216_natural855-934_delta_manifest_20261018.json`；终态恢复证明记录4586运行成员、85个增量成员逐字节核验及零新增动作。
- 原34证据归档为 `lotm_sun216_original34_sqlite_evidence_20261018.tar.gz`；归档不含SQLite实体，原专项本地数据库另以无损gzip及原始/压缩hash保留。报告与数据库存在、可恢复是独立事实。
- 公开输入清单与6包全部生成；组合9包230文件完整恢复通过，见 `public-full-restore-proof.json`；25旧文件最终去重汇总：491项通过，见 `final-acceptance-scope.json`；本阶段公开提交与远端CI：`NOT_RUN`。
