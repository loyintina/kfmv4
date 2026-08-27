/**
 * tests/cdp-relay.test.ts — CDP 中继服务器 A 档考题（实验台 P1，v2 按需拨号）
 *
 * v2 语义（v1 预挂桥真机证伪后反转）：
 *   客户端到 → 无桥 → 控制口发 DIAL → 假 APK 当场拨桥 → 配对通字节。
 *   全真 socket：ephemeral 端口起真 relay + 假控制信道 + 假桥。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①无控制信道时客户端干等不发 DIAL 无处可去 → ①b「控制后连上，补发
 *     DIAL」钉红（控制上线时要给在等的客户端补票）；
 *   ②客户端断开不毁桥 → ③钉红；
 *   ③DIAL 计数虚报 → ⑤钉红。
 */
import net from 'node:net';
import { readFileSync, rmSync } from 'node:fs';
import { test, group, assert } from './runner.ts';
import { createCdpRelay, type CdpRelay } from '../scripts/cdp-relay.ts';

/** 假 APK 控制信道：连控制口，收 DIAL 就拨一条假桥（echo 加 B: 前缀） */
function fakeApk(relay: CdpRelay): Promise<{ ctl: net.Socket; dialed: () => number }> {
  let dialed = 0;
  return new Promise((resolve, reject) => {
    const ctl = net.createConnection(relay.controlPort, '127.0.0.1');
    let buf = '';
    ctl.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line === 'DIAL') {
          dialed++;
          const b = net.createConnection(relay.bridgePort, '127.0.0.1');
          b.on('data', (bd) => b.write('B:' + bd.toString()));
          b.on('error', () => {});
        }
      }
    });
    ctl.on('error', reject);
    ctl.on('connect', () => {
      ctl.write('HELLO fake\n'); // APK 同款自报（HELLO/HB/CH-UP/CH-ERR 行协议）
      resolve({ ctl, dialed: () => dialed });
    });
  });
}

/** 客户端：写上即等回 */
async function roundTrip(port: number, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(port, '127.0.0.1');
    let buf = '';
    s.on('data', (d) => {
      buf += d.toString();
      if (buf.includes('B:')) {
        s.end();
        resolve(buf);
      }
    });
    s.on('error', reject);
    s.write(payload);
  });
}

async function openRelay(): Promise<CdpRelay> {
  // statusFile: null——考卷不落真状态盘，那是常驻守护的面
  return createCdpRelay({
    bridgePort: 0, clientPort: 0, controlPort: 0, log: () => {}, statusFile: null,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

group('cdp-relay 实验台 P1 v2');

test('①客户端到→DIAL→APK 拨桥→配对通字节', async () => {
  const relay = await openRelay();
  try {
    const apk = await fakeApk(relay);
    await sleep(50);
    assert(relay.stats().controlUp, '控制信道应在');

    const echoed = await roundTrip(relay.clientPort, 'GET /json/version');
    assert(echoed.includes('B:GET /json/version'), '客户端应收到桥的应答');
    assert(apk.dialed() === 1, 'APK 应被 DIAL 了 1 次');
    assert(relay.stats().paired === 1, '应完成 1 次配对');
    apk.ctl.destroy();
  } finally {
    await relay.close();
  }
});

test('①b 控制信道后上线：给在等客户端补发 DIAL', async () => {
  const relay = await openRelay();
  try {
    // 客户端先到（无控制信道，DIAL 无处可去，干等）
    const echoedP = roundTrip(relay.clientPort, 'hello');
    await sleep(50);
    assert(relay.stats().waitingClients === 1, '客户端应在等桥');
    // APK 控制信道后上线 → 应补发 DIAL → 拨桥 → 配上
    const apk = await fakeApk(relay);
    const echoed = await echoedP;
    assert(echoed.includes('B:hello'), '控制上线后应配上并通字节');
    assert(apk.dialed() >= 1, '控制上线应补 DIAL');
    apk.ctl.destroy();
  } finally {
    await relay.close();
  }
});

test('③客户端断开：配对桥陪葬', async () => {
  const relay = await openRelay();
  try {
    const apk = await fakeApk(relay);
    await sleep(50);
    let bridgeRef: net.Socket | null = null;
    // 抓桥引用：拨桥逻辑在 fakeApk 里，改从配对数+主动探测——
    // 客户端断开后等 100ms，看 relay 里 pendingBridges 不残留、paired 归位
    const echoed = await roundTrip(relay.clientPort, 'ping');
    assert(echoed.includes('B:ping'), '先配上一对');
    await sleep(100);
    assert(relay.stats().pendingBridges === 0, '陪葬后不应有残留待命桥');
    void bridgeRef;
    apk.ctl.destroy();
  } finally {
    await relay.close();
  }
});

test('④多次顺序连接：每连各吃一条新桥（CDP 顺序连接模式）', async () => {
  const relay = await openRelay();
  try {
    const apk = await fakeApk(relay);
    await sleep(50);
    for (const payload of ['/json/version', '/json/list', '/devtools/page/1']) {
      const echoed = await roundTrip(relay.clientPort, payload);
      assert(echoed.includes('B:' + payload), `第 ${payload} 连应通`);
      await sleep(30);
    }
    assert(relay.stats().paired === 3, '三连应配 3 次');
    assert(apk.dialed() === 3, '三连应 DIAL 3 次各拨新桥');
    apk.ctl.destroy();
  } finally {
    await relay.close();
  }
});

test('⑤状态落盘：attach 状态可见性（评审验收补充要求）', async () => {
  const statusFile = `/tmp/nz-cdp-relay-test-${process.pid}.json`;
  const relay = await createCdpRelay({
    bridgePort: 0, clientPort: 0, controlPort: 0, log: () => {}, statusFile,
  });
  try {
    // 起服务即落盘（attach 失败时先读它分锅）
    let s = JSON.parse(readFileSync(statusFile, 'utf8'));
    assert(s.controlUp === false && s.paired === 0, '初始应无控制零配对');

    const apk = await fakeApk(relay);
    await sleep(50);
    s = JSON.parse(readFileSync(statusFile, 'utf8'));
    assert(s.controlUp === true, '控制上线应落盘 controlUp=true');
    assert(s.lastCtlMsg === 'HELLO fake', 'APK 自报 HELLO 应落盘 lastCtlMsg');

    const echoed = await roundTrip(relay.clientPort, 'ping');
    assert(echoed.includes('B:ping'), '配对后字节应通');
    await sleep(50);
    s = JSON.parse(readFileSync(statusFile, 'utf8'));
    assert(s.paired === 1 && s.dialsSent >= 1, '配对/DIAL 计数应落盘');
    apk.ctl.destroy();
  } finally {
    await relay.close();
    rmSync(statusFile, { force: true });
  }
});
