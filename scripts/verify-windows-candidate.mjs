// One-off exact 0.229.0 Windows ZIP check. Node 24 built-ins only; no product hooks.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const EXPECTED = {
  zipSha256: '592c9d37a3410e66cb5cb934fa4ba985ec600cf0dfb3c4a4580aec7a33bcf512',
  zipBytes: 175488288,
};
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(app|evidence)=(.+)$/.exec(arg);
  assert(match, `Unexpected argument: ${arg}`);
  return [match[1], resolve(match[2])];
}));
assert(args.app && args.evidence, 'Required: --app=... --evidence=...');
assert.equal(process.platform, 'win32', 'Windows native execution only; no bypass mode');
assert.equal(process.arch, 'x64', 'Use native Windows x64 Node');
assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Node 24 required');
const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
};
assert(!inside(args.app, args.evidence) && !inside(args.evidence, args.app), 'Evidence must be outside extracted package');
await mkdir(args.evidence); // Refuse an existing directory, including any prior user data.
const userData = join(args.evidence, 'test-user-data');
await mkdir(userData);
const proof = {
  status: 'RUNNING', startedAt: new Date().toISOString(),
  node: process.versions.node, platform: process.platform, architecture: process.arch,
  targetArchive: EXPECTED, archiveHashCheckedHere: false,
  archiveVerification: 'Verify the exact ZIP before extraction; workflow records download-proof.json separately',
  packageDirectory: args.app, testUserData: userData,
  workflow: { runId: process.env.GITHUB_RUN_ID ?? null, commit: process.env.GITHUB_SHA ?? null },
  launches: [], checks: {},
  limits: ['Not human player acceptance', 'Not a clean consumer Windows installation',
    'Not a full campaign, installer, signing, high-DPI or GPU compatibility test',
    'Creation uses the actual preload/IPC API with packaged defaults, not the six-step creation UI'],
};
const save = (file, value) => writeFile(join(args.evidence, file), JSON.stringify(value, null, 2) + '\n');
const sha = value => createHash('sha256').update(value).digest('hex');
async function until(label, operation, milliseconds = 30000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    const value = await operation();
    if (value) return value;
    await delay(200);
  }
  throw new Error(`Timed out: ${label}`);
}

// Single browser-level WebSocket, flattened target session. No installed CDP client.
class Cdp {
  constructor(socket, events) {
    this.socket = socket; this.events = events; this.pending = new Map(); this.next = 0;
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) { this.events.push(message); return; }
      const request = this.pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer); this.pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
    const closed = () => {
      for (const request of this.pending.values()) {
        clearTimeout(request.timer); request.reject(new Error('CDP socket closed'));
      }
      this.pending.clear();
    };
    socket.addEventListener('close', closed);
    socket.addEventListener('error', closed);
  }
  static async open(url, events) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'ws:');
    assert.equal(parsed.hostname, '127.0.0.1', 'CDP must be IPv4 loopback only');
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('CDP connect timed out')); }, 10000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connect failed')); }, { once: true });
    });
    return new Cdp(socket, events);
  }
  send(method, params = {}, sessionId, timeout = 15000) {
    return new Promise((resolveResult, reject) => {
      assert.equal(this.socket.readyState, WebSocket.OPEN, 'CDP is not connected');
      const id = ++this.next;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeout);
      this.pending.set(id, { resolve: resolveResult, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  close() { this.socket.close(); }
}
let current;
async function launch(phase) {
  const launchRecord = { phase, args: ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'], normalClose: false };
  proof.launches.push(launchRecord);
  const env = { ...process.env, LOTM_TEST_USER_DATA: userData };
  // Keep the launch independent of inherited development/injection switches.
  for (const key of Object.keys(env)) {
    if (/^(ELECTRON_|NODE_OPTIONS$|NODE_PATH$|VITE_DEV_SERVER_URL$|GH_TOKEN$|GITHUB_TOKEN$)/i.test(key)) delete env[key];
  }
  const stdout = createWriteStream(join(args.evidence, `${phase}.stdout.log`), { flags: 'wx' });
  const stderr = createWriteStream(join(args.evidence, `${phase}.stderr.log`), { flags: 'wx' });
  const child = spawn(join(args.app, 'lotm-fan-game.exe'), launchRecord.args, {
    cwd: args.app, env, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'],
  });
  current = { child, launchRecord, events: [], exited: false, endpoint: null, error: null };
  const run = current;
  launchRecord.pid = child.pid;
  child.stdout.pipe(stdout); child.stderr.pipe(stderr);
  let diagnostic = '';
  child.stderr.on('data', chunk => {
    diagnostic = (diagnostic + chunk.toString()).slice(-32768);
    const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(diagnostic);
    if (match) run.endpoint = match[1];
  });
  child.on('error', error => { run.error = error; });
  child.on('exit', (code, signal) => { run.exited = true; launchRecord.exit = { code, signal }; });
  run.logsDone = Promise.all([stdout, stderr].map(stream => new Promise((done, reject) => {
    stream.once('finish', done); stream.once('error', reject);
  })));
  run.logsDone.catch(error => { run.error = error; });
  await until(`${phase}: debugging endpoint`, () => {
    if (run.error) throw run.error;
    assert(!run.exited, `EXE exited before CDP: ${JSON.stringify(launchRecord.exit)}`);
    return run.endpoint;
  }, 60000);
  run.cdp = await Cdp.open(run.endpoint, run.events);
  launchRecord.loopbackCdp = true;
  launchRecord.browserVersion = await run.cdp.send('Browser.getVersion');
  const expectedUrl = pathToFileURL(join(args.app, 'resources/app/dist/renderer/index.html')).href;
  const target = await until(`${phase}: packaged renderer target`, async () => {
    const { targetInfos } = await run.cdp.send('Target.getTargets');
    return targetInfos.find(item => item.type === 'page' && item.url === expectedUrl);
  });
  launchRecord.rendererUrl = target.url;
  const attached = await run.cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  run.session = attached.sessionId;
  await run.cdp.send('Runtime.enable', {}, run.session);
  await run.cdp.send('Page.enable', {}, run.session);
  return run;
}
async function evaluate(expression) {
  const result = await current.cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, current.session);
  assert(!result.exceptionDetails, `Renderer exception: ${JSON.stringify(result.exceptionDetails)}`);
  return result.result.value;
}
async function bridge(method, value) {
  assert(['getBootstrap', 'loadRun', 'submitIntent'].includes(method));
  const result = await evaluate(`window.sliceGame.${method}(${value === undefined ? '' : JSON.stringify(value)})`);
  assert.equal(result?.ok, true, `Bridge ${method} failed: ${JSON.stringify(result?.error)}`);
  return result.value;
}
async function checkMenu(phase, hasSave) {
  await until(`${phase}: real loaded title menu`, () => evaluate(`Boolean(document.querySelector('.slice-title-actions') && window.sliceGame)`));
  const menu = await evaluate(`(() => ({
    url: location.href, title: document.title, text: document.body.innerText,
    userAgent: navigator.userAgent, require: typeof globalThis.require,
    process: typeof globalThis.process, Buffer: typeof globalThis.Buffer,
    bridgeKeys: Object.keys(window.sliceGame).sort(), frozenBridge: Object.isFrozen(window.sliceGame),
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
    buttons: [...document.querySelectorAll('.slice-title-actions button')].map(b => ({text: b.innerText, disabled: b.disabled}))
  }))()`);
  assert.match(menu.userAgent, /Electron\/44\.0\.0/);
  assert.match(menu.title, /诡秘/);
  assert.match(menu.text, /桌面版/);
  assert.match(menu.text, /开始一段新生活/);
  for (const name of ['require', 'process', 'Buffer']) assert.equal(menu[name], 'undefined');
  assert.deepEqual(menu.bridgeKeys, ['getBootstrap', 'loadRun', 'submitIntent']);
  assert.equal(menu.frozenBridge, true);
  assert.match(menu.csp, /script-src 'self'/);
  const create = menu.buttons.find(b => b.text.startsWith('新建角色'));
  const resume = menu.buttons.find(b => b.text.startsWith('继续游戏'));
  assert(create && !create.disabled); assert(resume); assert.equal(resume.disabled, !hasSave);
  await save(`${phase}.menu.json`, menu);
  proof.checks[`${phase}MenuAndBridge`] = 'PASS';
}
async function screenshot(name) {
  await evaluate('document.fonts.ready.then(() => true)');
  const { data } = await current.cdp.send('Page.captureScreenshot', { format: 'png' }, current.session);
  const png = Buffer.from(data, 'base64');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  await writeFile(join(args.evidence, name), png);
}
async function normalClose() {
  const run = current;
  run.launchRecord.closeMethod = 'Page.close (normal window close / beforeunload)';
  // Closing the page may close its protocol session before the response arrives.
  try { await run.cdp.send('Page.close', {}, run.session, 5000); }
  catch (error) { run.launchRecord.closeProtocolNote = String(error); }
  await until('normal EXE exit', () => run.exited, 20000);
  assert.equal(run.launchRecord.exit.code, 0, 'Normal application exit must return 0');
  assert.equal(run.launchRecord.exit.signal, null);
  run.launchRecord.normalClose = true;
  await Promise.race([run.logsDone, delay(5000).then(() => { throw new Error('Log streams did not finish after normal exit'); })]);
  await save(`${run.launchRecord.phase}.cdp-events.json`, run.events);
  run.cdp.close(); current = null;
}
async function failureCleanup() {
  const run = current;
  if (!run) return;
  if (run.cdp && !run.exited) {
    try { await run.cdp.send('Page.close', {}, run.session, 3000); } catch {}
    try { await until('cleanup normal close', () => run.exited, 5000); } catch {}
  }
  if (!run.exited && run.cdp) {
    try { await run.cdp.send('Browser.close', {}, undefined, 3000); } catch {}
    try { await until('cleanup browser close', () => run.exited, 5000); } catch {}
  }
  if (!run.exited && run.child.pid) {
    // Failure only: terminate this still-live spawned child handle, never by name,
    // a recycled PID, /IM, taskkill wildcard, or another task's processes.
    run.launchRecord.forcedCleanup = true;
    run.child.kill();
    try { await until('owned child cleanup', () => run.exited, 5000); } catch {}
  }
  run.launchRecord.cleanupExited = run.exited;
  run.cdp?.close();
  await save(`${run.launchRecord.phase}.cdp-events.json`, run.events);
  if (run.exited) await Promise.race([run.logsDone, delay(3000)]);
  run.child.stdout?.destroy(); run.child.stderr?.destroy(); run.child.unref();
  current = null;
}

try {
  const metadata = JSON.parse(await readFile(join(args.app, 'resources/app/package.json'), 'utf8'));
  assert.equal(metadata.main, 'dist/main/main.js');
  assert.equal(metadata.version, '0.229.0');
  // Import only immutable packaged content defaults. The application itself is
  // launched through its EXE/main.js, never by a replacement Electron harness.
  const { sliceDefaultCreationSelection } = createRequire(import.meta.url)(join(args.app, 'resources/app/dist/content/slice-creation.js'));
  const command = { intentId: `zip-smoke-${randomUUID()}`, runId: null, expectedRevision: 0,
    payload: { type: 'CREATE', selection: structuredClone(sliceDefaultCreationSelection) } };
  await launch('create');
  await checkMenu('create', false);
  const empty = await bridge('getBootstrap');
  assert.equal(empty.mode, 'desktop'); assert.deepEqual(empty.runs, []); assert.equal(empty.activeState, null);
  await screenshot('01-first-menu.png');
  const receipt = await bridge('submitIntent', command);
  assert.equal(receipt.replayed, false); assert.equal(receipt.previousRevision, 0); assert.equal(receipt.newRevision, 1);
  assert.equal(receipt.intentId, command.intentId); assert.equal(receipt.runId, receipt.state.runId);
  assert.equal(receipt.state.character.name, command.payload.selection.displayName);
  assert.equal(receipt.state.revision, 1); assert(receipt.state.activeEvent);
  assert(!('random' in receipt.state)); assert(!('world' in receipt.state));
  const beforeClose = await bridge('getBootstrap');
  assert.equal(beforeClose.runs.length, 1); assert.deepEqual(beforeClose.activeState, receipt.state);
  await save('create-command.json', command); await save('create-receipt.json', receipt); await save('before-close.json', beforeClose);
  proof.checks.createViaPreloadIpc = 'PASS';
  await normalClose();
  const database = join(userData, 'playable-slice.sqlite');
  const databaseBytes = (await stat(database)).size;
  assert(databaseBytes > 0);

  await launch('recover');
  await checkMenu('recover', true);
  const recovered = await bridge('getBootstrap');
  assert.deepEqual(recovered, beforeClose, 'Complete bootstrap must survive a fresh EXE process');
  assert.deepEqual(await bridge('loadRun', receipt.runId), receipt.state);
  await save('recovered-bootstrap.json', recovered);
  await screenshot('02-recovered-menu.png');
  // Exercise real React navigation and slot load; do not patch UI state or bridge.
  await evaluate(`document.querySelectorAll('.slice-title-actions button')[1].click()`);
  await until('saved slot visible', () => evaluate(`document.querySelectorAll('.slice-run-card').length === 1`));
  await evaluate(`document.querySelector('.slice-run-card').click()`);
  await until('loaded dashboard and opening event', () => evaluate(`Boolean(document.querySelector('.slice-dashboard') && document.querySelector('.slice-event-body'))`));
  const playText = await evaluate('document.body.innerText');
  assert(playText.includes(receipt.state.character.name)); assert(playText.includes('人物卷宗'));
  await writeFile(join(args.evidence, 'recovered-play-text.txt'), playText);
  await screenshot('03-recovered-game.png');
  const replay = await bridge('submitIntent', command);
  assert.deepEqual(replay, { ...receipt, replayed: true }, 'Only replayed may change in the persisted receipt');
  const afterReplay = await bridge('getBootstrap');
  assert.deepEqual(afterReplay, beforeClose, 'Duplicate submission must not create another run or advance any state');
  await save('replayed-receipt.json', replay); await save('after-replay.json', afterReplay);
  proof.checks.exactRestartRecovery = 'PASS'; proof.checks.realResumeUi = 'PASS'; proof.checks.duplicateIdempotency = 'PASS';
  proof.save = { runId: receipt.runId, revision: receipt.newRevision, publicStateSha256: sha(JSON.stringify(receipt.state)),
    databaseBytes };
  await normalClose();
  proof.checks.bothNormalExits = 'PASS';
  proof.status = 'PASS';
} catch (error) {
  proof.status = 'FAIL'; proof.error = { message: error.message, stack: error.stack };
  console.error(error);
  try { if (current?.cdp && !current.exited) await screenshot('failure.png'); } catch {}
  await failureCleanup();
  process.exitCode = 1;
} finally {
  proof.finishedAt = new Date().toISOString();
  await save('proof.json', proof);
}
console.log(`${proof.status === 'PASS' ? 'WINDOWS_DIRECT_ZIP_PASS' : 'WINDOWS_DIRECT_ZIP_FAIL'} ${args.evidence}`);
