package dev.kfm.v4.shell;

import android.net.LocalSocket;
import android.net.LocalSocketAddress;
import android.os.Process;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * CDP 中继：控制信道 + 按需拨号（v2，2026-08-27 改版）。
 *
 * v1 的「APK 预挂桥待命」被真机证伪：Chromium devtools socket 不养闲连
 * 接——/json 应答后连接进半死态，预挂的桥等到客户端来时已烂（真机实
 * 测：connectOverCDP 第二次连接恒等不到活桥）。
 *
 * v2 反转为按需拨号：
 *   控制信道（8028，常驻）：APK 出连服务器，服务器见客户端排队就发
 *     「DIAL」一行；
 *   数据信道（8025，一次性）：APK 收到 DIAL 才当场连 devtools socket
 *     + 出连 8025，管道跑到任一头关就整条报废——每个 CDP 客户端连接
 *     配一条崭新的桥，永不吃烂桥。
 * 断线重连只需控住控制信道（指数退避 1s→15s）；数据信道死了等下一个
 * DIAL 自然重建。
 *
 * devtools socket 讲 HTTP + WebSocket（/json/list 枚举页、
 * /devtools/page/<id> 协议面），纯字节管道不解协议。
 */
public final class CdpRelay {

    private static final String TAG = "CdpRelay";
    private static final String HOST = "127.0.0.1";
    private static final int CHANNEL_PORT = 8029;  // 数据信道（一次性桥）
    private static final int CONTROL_PORT = 8031;  // 控制信道（常驻，收 DIAL）

    private static volatile boolean started = false;
    /** 当前控制信道的写出端（dialChannel 自报用）；null=控制不在 */
    private static volatile OutputStream ctlOut = null;
    /** 最近一次收到 PONG 的毫秒时刻（看门狗判活）：0=本会话还没收到过 */
    private static volatile long lastPongAt = 0;

    private CdpRelay() {}

    public static synchronized void start() {
        if (started) return;
        started = true;
        Thread t = new Thread(new Runnable() {
            @Override public void run() { controlLoop(); }
        }, "cdp-relay-ctl");
        t.setDaemon(true);
        t.start();
    }

    /** 控制信道自报（服务器侧只读行）：HELLO/HB/CH-UP/CH-ERR <msg> */
    private static void report(String line) {
        OutputStream o = ctlOut;
        if (o == null) return;
        try {
            synchronized (CdpRelay.class) {
                o.write((line + "\n").getBytes("UTF-8"));
                o.flush();
            }
        } catch (Exception e) {
            Log.w(TAG, "report fail: " + e);
        }
    }

    /** 控制信道主循环：连上先自报 HELLO，5s 一跳 HB，读 DIAL 拨数据信道。 */
    private static void controlLoop() {
        int backoffMs = 1000;
        while (true) {
            Socket ctl = null;
            try {
                ctl = new Socket();
                ctl.connect(new InetSocketAddress(HOST, CONTROL_PORT), 5000);
                ctl.setTcpNoDelay(true);
                ctlOut = ctl.getOutputStream();
                Log.i(TAG, "control up: " + HOST + ":" + CONTROL_PORT);
                report("HELLO " + Process.myPid());
                lastPongAt = System.currentTimeMillis(); // 新会话宽限
                backoffMs = 1000;

                // 心跳线程：证明 手机→服务器 方向活着（服务器回 PONG）
                final Socket heartbeatSock = ctl;
                Thread hb = new Thread(new Runnable() {
                    @Override public void run() {
                        while (!heartbeatSock.isClosed()) {
                            report("HB");
                            try { Thread.sleep(5000); } catch (InterruptedException ie) { return; }
                        }
                    }
                }, "cdp-relay-hb");
                hb.setDaemon(true);
                hb.start();

                // 看门狗：PONG 超 15s 没来 = 半开黑洞（隧道中间死了两端
                // 都不知），主动关控制连接 → 外层重连——僵尸会话自愈
                final Socket watchdogSock = ctl;
                Thread wd = new Thread(new Runnable() {
                    @Override public void run() {
                        while (!watchdogSock.isClosed()) {
                            try { Thread.sleep(5000); } catch (InterruptedException ie) { return; }
                            if (System.currentTimeMillis() - lastPongAt > 15000) {
                                Log.w(TAG, "watchdog: PONG silence > 15s, killing control");
                                closeQuietly(watchdogSock);
                                return;
                            }
                        }
                    }
                }, "cdp-relay-wd");
                wd.setDaemon(true);
                wd.start();

                BufferedReader rd = new BufferedReader(
                        new InputStreamReader(ctl.getInputStream(), "UTF-8"));
                String line;
                while ((line = rd.readLine()) != null) {
                    if ("PONG".equals(line.trim())) {
                        lastPongAt = System.currentTimeMillis();
                    } else if ("DIAL".equals(line.trim())) {
                        Log.i(TAG, "DIAL -> dialing channel");
                        dialChannel();
                    }
                }
                Log.i(TAG, "control closed, reconnecting");
            } catch (Exception e) {
                Log.w(TAG, "control: " + e);
            } finally {
                ctlOut = null;
                closeQuietly(ctl);
            }
            try {
                Thread.sleep(backoffMs);
            } catch (InterruptedException ie) {
                return;
            }
            backoffMs = Math.min(backoffMs * 2, 15000);
        }
    }

    /** 拨一条数据信道：devtools socket ⇄ 服务器 8025，独立线程跑裸管道。
     *  成败都自报——服务器侧据此分锅「DIAL 没到」还是「连不上」。 */
    private static void dialChannel() {
        Thread t = new Thread(new Runnable() {
            @Override public void run() {
                LocalSocket dev = null;
                Socket out = null;
                try {
                    dev = new LocalSocket(LocalSocket.SOCKET_STREAM);
                    dev.connect(new LocalSocketAddress(
                            "webview_devtools_remote_" + Process.myPid(),
                            LocalSocketAddress.Namespace.ABSTRACT));
                    out = new Socket();
                    out.connect(new InetSocketAddress(HOST, CHANNEL_PORT), 5000);
                    out.setTcpNoDelay(true);
                    Log.i(TAG, "channel up");
                    report("CH-UP");
                    pipeBoth(dev, out);
                    Log.i(TAG, "channel closed");
                    report("CH-DONE");
                } catch (Exception e) {
                    Log.w(TAG, "channel: " + e);
                    String msg = String.valueOf(e).replace('\n', ' ');
                    report("CH-ERR " + (msg.length() > 120 ? msg.substring(0, 120) : msg));
                } finally {
                    closeQuietly(dev);
                    closeQuietly(out);
                }
            }
        }, "cdp-relay-ch");
        t.setDaemon(true);
        t.start();
    }

    /** 双向裸管道：任一头 EOF/出错，两头一起关。 */
    private static void pipeBoth(final LocalSocket dev, final Socket out)
            throws Exception {
        final Exception[] box = new Exception[1];
        Thread up = new Thread(new Runnable() {
            @Override public void run() {
                try {
                    copy(dev.getInputStream(), out.getOutputStream());
                } catch (Exception e) {
                    box[0] = e;
                }
            }
        }, "cdp-relay-ch-up");
        up.setDaemon(true);
        up.start();
        try {
            copy(out.getInputStream(), dev.getOutputStream());
        } finally {
            up.join(3000);
            if (box[0] != null) throw box[0];
        }
    }

    private static void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) != -1) {
            out.write(buf, 0, n);
            out.flush();
        }
    }

    private static void closeQuietly(LocalSocket s) {
        if (s != null) try { s.close(); } catch (Exception ignored) {}
    }

    private static void closeQuietly(Socket s) {
        if (s != null) try { s.close(); } catch (Exception ignored) {}
    }
}
