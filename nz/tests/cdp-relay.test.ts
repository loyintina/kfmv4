/**
 * tests/cdp-relay.test.ts — CDP 中继服务器 A 档考题（实验台 P1）
 *
 * 全真 socket：ephemeral 端口起真 relay + 假桥（回环 echo，模拟 APK 桥到
 * devtools socket 的纯字节管道）+ 假客户端，验：
 *   ①桥先待命、客户端后来 → 配对，字节双向通
 *   ②客户端先等、桥后来 → 配对（反序）
 *   ③客户端断开 → 桥陪葬（干净断开，APK 侧补新桥模式的前提）
 *   ④多次顺序连接（模拟 CDP 的 /json/version→/json/list→WS）每次配到新桥
 *
 * 变异抽检靶子（本文件指定）：
 *   ①配对只配一次就丢队列 → ④钉红；
 *   ②客户端断开不毁桥 → ③钉红。
 */
import net from 'node:net';
import { readFileSync, rmSync } from 'node:fs';
import { test, group, assert } from './runner.ts';
import { createCdpRelay, type CdpRelay } from '../scripts/cdp-relay.ts';

/** 连一管 socket，写上即等回（echo 假设对端会原样弹回） */
async function roundTrip(port: number, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(port, '127.0.0.1');
    let buf = '';
    s.on('data', (d) => {
      buf += d.toString();
      if (buf.includes(payload)) {
        s.end();
        resolve(buf);
      }
    });
    s.on('error', reject);
    s.write(payload);
  });
}

/** 假桥：连桥口，把收到的字节加上 B: 前缀弹回（模拟 devtools 应答） */
function fakeBridge(port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(port, '127.0.0.1', () => resolve(s));
    s.on('data', (d) => s.write('B:' + d.toString()));
    s.on('error', reject);
  });
}

async function openRelay(): Promise<CdpRelay> {
  // statusFile: null——考卷不落真状态盘，那是常驻守护的面
  return createCdpRelay({ bridgePort: 0, clientPort: 0, log: () => {}, statusFile: null });
}

group('cdp-relay 实验台 P1');

test('①桥先待命客户端后来：配对+字节双向通', async () => {
  const relay = await openRelay();
  try {
    const bridge = await fakeBridge(relay.bridgePort);
    await new Promise((r) => setTimeout(r, 50));
    assert(relay.stats().pendingBridges === 1, '桥应待命 1 条');

    const s = net.createConnection(relay.clientPort, '127.0.0.1');
    await new Promise<void>((r) => s.on('connect', r));
    s.write('GET /json/version');
    const echoed = await new Promise<string>((r) => {
      let buf = '';
      s.on('data', (d) => {
        buf += d.toString();
        if (buf.includes('B:')) r(buf);
      });
    });
    assert(echoed.includes('B:GET /json/version'), '客户端应收到桥的应答');
    assert(relay.stats().paired === 1, '应完成 1 次配对');
    s.destroy();
    bridge.destroy();
  } finally {
    await relay.close();
  }
});

test('②客户端先等桥后来：反序也配上', async () => {
  const relay = await openRelay();
  try {
    const echoedP = roundTrip(relay.clientPort, 'hello'); // 先挂着等桥
    await new Promise((r) => setTimeout(r, 50));
    assert(relay.stats().waitingClients === 1, '客户端应在等桥');
    const bridge = await fakeBridge(relay.bridgePort);
    const echoed = await echoedP;
    assert(echoed.includes('B:hello'), '桥到场后应配上并通字节');
    bridge.destroy();
  } finally {
    await relay.close();
  }
});

test('③客户端断开：配对桥陪葬（APK 补新桥模式前提）', async () => {
  const relay = await openRelay();
  try {
    const bridge = await fakeBridge(relay.bridgePort);
    await new Promise((r) => setTimeout(r, 50));
    const client = net.createConnection(relay.clientPort, '127.0.0.1');
    await new Promise<void>((r) => client.on('connect', r));
    await new Promise((r) => setTimeout(r, 50));
    assert(relay.stats().paired === 1, '应已配对');

    const bridgeClosed = new Promise<boolean>((r) => {
      bridge.once('close', () => r(true));
      setTimeout(() => r(false), 1000);
    });
    client.destroy();
    assert(await bridgeClosed, '客户端断开后桥应被毁（陪葬）');
  } finally {
    await relay.close();
  }
});

test('④多次顺序连接：每条客户端连配到一条新桥（CDP 顺序连接模式）', async () => {
  const relay = await openRelay();
  try {
    // 模拟 playwright connectOverCDP 的三连：每次新客户端+新桥
    for (const payload of ['/json/version', '/json/list', '/devtools/page/1']) {
      const echoedP = roundTrip(relay.clientPort, payload);
      await new Promise((r) => setTimeout(r, 20));
      const bridge = await fakeBridge(relay.bridgePort);
      const echoed = await echoedP;
      assert(echoed.includes('B:' + payload), `第 ${payload} 连应通`);
      bridge.destroy();
      await new Promise((r) => setTimeout(r, 20));
    }
    assert(relay.stats().paired === 3, '三连应配 3 次');
  } finally {
    await relay.close();
  }
});

test('⑤状态落盘：attach 状态可见性（评审验收补充要求）', async () => {
  const statusFile = `/tmp/nz-cdp-relay-test-${process.pid}.json`;
  const relay = await createCdpRelay({
    bridgePort: 0,
    clientPort: 0,
    log: () => {},
    statusFile,
  });
  try {
    // 起服务即落盘（attach 失败时先读它分锅）
    let s = JSON.parse(readFileSync(statusFile, 'utf8'));
    assert(s.pendingBridges === 0 && s.paired === 0, '初始应零桥零配对');

    const bridge = await fakeBridge(relay.bridgePort);
    await new Promise((r) => setTimeout(r, 50));
    s = JSON.parse(readFileSync(statusFile, 'utf8'));
    assert(s.pendingBridges === 1 && s.lastEvent === 'bridge-up',
      '桥到场应落盘 pendingBridges=1/lastEvent=bridge-up');

    const echoed = await roundTrip(relay.clientPort, 'ping');
    assert(echoed.includes('B:ping'), '配对后字节应通');
    await new Promise((r) => setTimeout(r, 50));
    s = JSON.parse(readFileSync(statusFile, 'utf8'));
    assert(s.paired === 1, '配对应落盘 paired=1（lastEvent 可能已被陪葬覆盖，不锚）');
    bridge.destroy();
  } finally {
    await relay.close();
    rmSync(statusFile, { force: true });
  }
});
