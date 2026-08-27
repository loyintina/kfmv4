package dev.kfm.nz.agent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 保活前台服务（kfm-na BAR-029 同款路子，2026-08-27 实测复刻必要性：
 * NZ-Agent 退后台/息屏被 OriginOS cached-app 冻结器整进程冻住——HB
 * 心跳停跳、DIAL 吞黑洞、TCP 半开僵尸，实验台链路全僵。进程一提为
 * 「前台服务」重要性，冻结器就不动它）。
 *
 * 代价：常驻通知一条（Android 硬规矩，IMPORTANCE_MIN 低打扰渠道）。
 * 配套 PARTIAL_WAKE_LOCK：息屏/Doze 下保住 CPU（Termux 同款）。
 *
 * 观测常驻体（2026-08-27 用户拍板「观测全在后台静默，绝不抢前台」）：
 * Service 直接养一个**离屏 WebView** 加载 nz 终端——devtools socket 在、
 * CDP 观测链在，但零 UI：用户在浏览器/任何 App 里开发时本服务完全
 * 后台静默，绝不 startActivity 抢前台、绝不弹安装器。进程被杀 →
 * START_STICKY 拉回本服务 → onCreate 重建 WebView → 链路自愈，全程
 * 无 UI。用户想看终端手点图标（Activity 另有自己的 WebView，用户主动
 * 才存在）。离屏 WebView 不 attach window 不出帧——像素截图仍需前台
 * 态（前台观测闸纪律不变），数值/注入/读屏观测后台全通。
 */
public class KeepAliveService extends Service {
    private static final String CHANNEL_ID = "nz_agent_keepalive";
    private static final int NOTIF_ID = 1;
    private static final String TERM_URL = "http://127.0.0.1:8023/";
    private PowerManager.WakeLock mWakeLock;
    private WebView mObservingWeb;

    @Override
    public void onCreate() {
        super.onCreate();
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(new NotificationChannel(
                    CHANNEL_ID, "NZ-Agent 保活", NotificationManager.IMPORTANCE_MIN));
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        Notification n = b.setContentTitle("NZ-Agent 运行中")
                .setContentText("实验台保活：退后台不冻结（BAR-029 同款）")
                .setSmallIcon(android.R.drawable.stat_notify_more)
                .setOngoing(true)
                .build();
        startForeground(NOTIF_ID, n);
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        mWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nz_agent:keepalive");
        mWakeLock.acquire();
        ensureObservingWeb();
    }

    /** 离屏观测 WebView：不 setContentView 不 attach window，纯跑页面。
     *  幂等——START_STICKY 拉回时 onCreate 重跑，已存在则跳过。 */
    private void ensureObservingWeb() {
        if (mObservingWeb != null) return;
        // setWebContentsDebuggingEnabled 是静态全局（MainActivity 已调；
        // 进程被杀重启后 Service 可能先于 Activity 跑，这里兜一次）
        WebView.setWebContentsDebuggingEnabled(true);
        mObservingWeb = new WebView(getApplicationContext());
        WebSettings s = mObservingWeb.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        mObservingWeb.setWebViewClient(new WebViewClient()); // 导航自持（同 MainActivity 教训）
        mObservingWeb.loadUrl(TERM_URL);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureObservingWeb(); // START_STICKY 拉回后 WebView 必重建（进程死透场景 onCreate 已盖；此处兜 Service 存活 WebView 被单杀的边角）
        return START_STICKY; // 被回收后系统尽力拉起
    }

    @Override
    public void onDestroy() {
        if (mWakeLock != null && mWakeLock.isHeld()) {
            mWakeLock.release();
        }
        if (mObservingWeb != null) {
            mObservingWeb.destroy();
            mObservingWeb = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
