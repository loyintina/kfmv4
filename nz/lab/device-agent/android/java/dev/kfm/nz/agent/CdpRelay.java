package dev.kfm.nz.agent;

import android.net.LocalSocket;
import android.net.LocalSocketAddress;
import android.os.Process;
import android.util.Log;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * CDP 中继线程：WebView 调试口 ⇄ 服务器，零 adb、零 Termux 依赖。
 *
 *   WebView 调试口（localabstract socket「webview_devtools_remote_<pid>」，
 *   本进程同 uid 直连，SELinux 无障）
 *       ⇅ 出站 TCP 127.0.0.1:8025（kalo 隧道 -L 8025 转发到服务器 loopback）
 *   服务器 cdp-relay.mjs（8025 接桥 / 8026 供评审 CDP 客户端）
 *
 * 为什么出站反连而不是监听：手机在 NAT 后、无 adb——APK 主动出连，
 * 服务器被动接受，断线重连全在本地自维护（指数退避 1s→15s 封顶）。
 *
 * devtools socket 讲 HTTP + WebSocket（/json/list 枚举页、
 * /devtools/page/<id> 协议面），纯字节管道即可，本线程不解协议。
 */
public final class CdpRelay {

    private static final String TAG = "CdpRelay";
    private static final String HOST = "127.0.0.1";
    private static final int PORT = 8025;

    private static volatile boolean started = false;

    private CdpRelay() {}

    public static synchronized void start() {
        if (started) return;
        started = true;
        Thread t = new Thread(new Runnable() {
            @Override public void run() { loop(); }
        }, "cdp-relay");
        t.setDaemon(true);
        t.start();
    }

    private static void loop() {
        int backoffMs = 1000;
        while (true) {
            LocalSocket dev = null;
            Socket out = null;
            boolean bridged = false;
            try {
                // devtools socket 在 WebView 建好、调试开关开后才出现——
                // 先连它，连不上就退避重试（启动竞态也走这条路自愈）
                dev = new LocalSocket(LocalSocket.SOCKET_STREAM);
                dev.connect(new LocalSocketAddress(
                        "webview_devtools_remote_" + Process.myPid(),
                        LocalSocketAddress.Namespace.ABSTRACT));

                out = new Socket();
                out.connect(new InetSocketAddress(HOST, PORT), 5000);
                out.setTcpNoDelay(true);

                Log.i(TAG, "bridge up: devtools <-> " + HOST + ":" + PORT);
                bridged = true;
                pipeBoth(dev, out);
                Log.i(TAG, "bridge closed, reconnecting");
            } catch (Exception e) {
                Log.w(TAG, "relay: " + e);
            } finally {
                closeQuietly(dev);
                closeQuietly(out);
            }
            // 干净桥断开（CDP 客户端用完了）= 立刻补新桥待命——CDP 是
            // 多次顺序连接（/json/version→/json/list→WS），每次要一条新桥；
            // 只有「连不上」（启动竞态/隧道断）才走退避
            if (bridged) {
                backoffMs = 1000;
                continue;
            }
            try {
                Thread.sleep(backoffMs);
            } catch (InterruptedException ie) {
                return;
            }
            backoffMs = Math.min(backoffMs * 2, 15000);
        }
    }

    /** 双向裸管道：任一头 EOF/出错，两头一起关，回外层重连。 */
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
        }, "cdp-relay-up");
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
