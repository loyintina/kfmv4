package dev.kfm.nz.agent;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * nz 设备代理壳（8.8.6 壳层开屏版）：点击即纯暗场 → WebView 就绪即动画
 * → 终端首帧可操作才切换。
 *
 * 三张牌（P1 评审信 kfmv4-9.0-nz-device-agent-p1-review §二）不变：
 *   WebView 真机光栅化 / setWebContentsDebuggingEnabled 暴露 CDP /
 *   CdpRelay 桥到服务器。8.8.6 加四件：
 *
 *   1. 壳层开屏（用户拍板「从 apk 壳层点击就播放动画，持续到能操作再
 *      切换」）：FrameLayout 双层 WebView——底=终端（8023，nosplash
 *      让位壳层），顶=splash WebView 加载 asset 本地开屏页（零网络
 *      等待，动画本体 splash-core.js 与页面侧唯一真源同文件）。
 *      主题 windowBackground=纯暗 #05070f，盖住点击→WebView 初始化
 *      盲窗（连渲染体都不存在的一段，任何 App 都只能静态帧；动画
 *      开场本来就是暗场扫线，纯暗帧无缝衔接。曾用静态徽标帧，用户
 *      实拍定罪：徽标→暗场开场接不上=闪帧，2026-08-30 拍板改纯暗）。
 *   2. 盲窗自监控（用户拍板「让它自己监控自己的数据传过来」）：
 *      onCreate→首绘逐拍墙钟 POST /__boot-marks——「点击→页面出生」
 *      这段页面 performance 永远看不到的账由壳记。
 *   3. 盲窗像素取证走 CDP（scripts/boot-splash-capture.mjs）：splash
 *      WebView 本身是独立 CDP target，attach 它 captureScreenshot=
 *      真合成器像素。注：decorView 自绘 Bitmap 抓不到硬件加速
 *      WebView 内容（实测全黑，Android 已知限制），已废弃；点击→
 *      splash-first-picture ~0.2s 的静态帧段声明盲区（内容=主题
 *      windowBackground 纯暗帧，时长有 boot-marks 入账）。
 *   4. 自毁钩子：intent extra nz_exit=true → 退进程（Termux 无权限
 *      force-stop 别的 uid，冷启动闭环测试靠它自杀再由 ssh 拉起）。
 *      singleTask 单实例后对活进程下自杀令走 onNewIntent（裸
 *      am start 即可送达）；onCreate 一路管冷进程。历史坑：standard
 *      时代裸 am start 的 extras 被 filterEquals 吸收（不带 extras
 *      比较）=纯「带回前台」，须 CLEAR_TOP 销毁重建（2026-08-30 实踩）。
 *      注：nz-exit mark 与 System.exit(0) 抢跑，输赢不定=正常，
 *      死透判据=CDP target 消失，不赌这拍日志。
 *
 * 桥：终端页 first-frame → window.NzNative.firstFrame() → 壳令 splash
 * 层 __complete() 收口（扫完定帧）→ 渐隐摘除，露出可操作终端。
 */
public class MainActivity extends Activity {

    private static final String TERM_URL = "http://127.0.0.1:8023/";
    private static final String MARKS_URL = TERM_URL + "__boot-marks";
    private static final String SPLASH_URL = "file:///android_asset/splash/index.html";

    /** 点击（onCreate）墙钟——全程启动账的零点 */
    private long t0;
    private WebView termWeb;
    private WebView splashWeb;
    private FrameLayout root;
    private boolean dismissed = false;

    /** 自毁：退进程（冷启动闭环测试用，见头注 4） */
    private void selfDestruct() {
        mark("nz-exit");
        finish();
        new android.os.Handler().postDelayed(() -> System.exit(0), 300);
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent.getBooleanExtra("nz_exit", false)) selfDestruct();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        t0 = System.currentTimeMillis();
        super.onCreate(savedInstanceState);

        // 自毁钩子（冷启动闭环测试：ssh am start --ez nz_exit true → 旧
        // 进程自杀，下一次 am start 即真冷启动）
        if (getIntent().getBooleanExtra("nz_exit", false)) {
            selfDestruct();
            return;
        }
        mark("onCreate");

        // 必须在创建任何 WebView 之前调（静态全局开关）
        WebView.setWebContentsDebuggingEnabled(true);

        root = new FrameLayout(this);
        // 根布局背景=主题同款纯暗 #05070f：splash WebView 透明隙/摘除
        // 瞬间不透出白底。曾用静态徽标帧，用户实拍定罪：静态徽标→动画
        // 暗场开场接不上=闪帧「很不专业」（2026-08-30 拍板改纯暗）
        root.setBackground(new android.graphics.drawable.ColorDrawable(0xFF05070F));

        // ---- 底层：终端 WebView（?nosplash=页面内开屏让位壳层；_tApk=
        // 点击墙钟，页面算「点击→出生」差值入账）----
        termWeb = new WebView(this);
        configWeb(termWeb);
        termWeb.addJavascriptInterface(new NzNative(), "NzNative");
        termWeb.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap favicon) {
                mark("term-page-started");
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                mark("term-page-finished");
            }
        });
        root.addView(termWeb, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // ---- 顶层：splash WebView（asset 本地页，零网络等待即播动画）----
        splashWeb = new WebView(this);
        configWeb(splashWeb);
        // 首绘时刻：内容真正画到屏幕的那一刻=盲窗结束的精确时刻。弃
        // PictureListener（API 18 起废弃且现代 WebView 常不回调），用
        // postVisualStateCallback（API 23+，minApi 24 内）——WebView
        // 提交新内容可见时回调。像素取证不在壳里做（见头注 3）
        splashWeb.postVisualStateCallback(1001, new WebView.VisualStateCallback() {
            @Override
            public void onComplete(long requestId) {
                if (requestId == 1001L) mark("splash-first-picture");
            }
        });
        root.addView(splashWeb, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
        mark("webview-created");

        termWeb.loadUrl(TERM_URL + "?nosplash&_tApk=" + t0);
        splashWeb.loadUrl(SPLASH_URL);
        mark("loadUrl");

        // 开屏看门狗（2026-08-30 实踩定罪：用户卡开屏进不去——网络 flap
        // 期 WebView 吃旧缓存 bundle，无 NzNative 桥调用=摘屏信号永远
        // 不到）。壳层开屏绝不能有「卡死永远出不去」的路径：15s 无
        // first-frame 信号也强行摘层放用户进终端（页面侧开屏早有同款
        // 看门狗 max(3×预测,30s)，壳层补上）。
        root.postDelayed(() -> {
            if (!dismissed) {
                mark("splash-watchdog");
                dismissSplash();
            }
        }, 15000);

        // 保活前台服务（BAR-029 同款）：退后台/息屏不被 cached-app 冻结器
        // 冻住——冻结=心跳停跳、DIAL 黑洞、实验台链路全僵（2026-08-27 实测）
        startService(new Intent(this, KeepAliveService.class));

        // CDP 中继：自己进程（同 uid）连自己的 devtools socket，SELinux 无障
        CdpRelay.start();
    }

    private void configWeb(WebView w) {
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);   // nz 终端/开屏都是 JS 页
        s.setDomStorageEnabled(true);   // 终端本地态
        // WebView 默认白底——内容首绘前会闪白。钉纯暗 #05070f 与主题/
        // 根布局同色系，启动全程无一帧白（2026-08-30 纯暗化顺带）
        w.setBackgroundColor(0xFF05070F);
        // 缺它=JS 发起的导航（热更自愈的 location.reload/重定向）不走
        // WebView 而被 ActionView 外部化到系统浏览器（2026-08-27 C 档实测：
        // 用户看见「跳浏览器开 8023」×3，WebView 内页面纹丝不动=reload
        // 「被吞」假象真凶）。空 Client=全部导航自持。
        w.setWebViewClient(new WebViewClient());
    }

    /** 终端页 first-frame 桥（页面侧 mark() 里 window.NzNative?.firstFrame()） */
    private class NzNative {
        @JavascriptInterface
        public void firstFrame() {
            runOnUiThread(() -> {
                mark("native-first-frame");
                dismissSplash();
            });
        }
    }

    /** 首帧可操作才切换：splash 层 __complete() 扫完定帧，渐隐后摘除 */
    private void dismissSplash() {
        if (dismissed || splashWeb == null) return;
        dismissed = true;
        // complete()=扫完帧定帧 SETTLE 500ms+自身淡出 320ms——900ms 后摘层
        splashWeb.evaluateJavascript("window.__complete&&window.__complete()", null);
        splashWeb.animate().alpha(0f).setStartDelay(700).setDuration(400)
                .withEndAction(() -> {
                    root.removeView(splashWeb);
                    splashWeb.destroy();
                    splashWeb = null;
                    mark("splash-dismissed");
                }).start();
    }

    /** 盲窗时间戳：每拍一行 JSON POST 服务器（墙钟+相对点击毫秒） */
    private void mark(String name) {
        long now = System.currentTimeMillis();
        String line = "{\"wall\":" + now + ",\"rel\":" + (now - t0)
                + ",\"mark\":\"" + name + "\"}";
        new Thread(() -> {
            try { post(MARKS_URL, line.getBytes(StandardCharsets.UTF_8), "application/json"); }
            catch (Exception e) { /* 上报失败不挡启动 */ }
        }).start();
    }

    private static void post(String url, byte[] body, String ctype) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setConnectTimeout(5000);
        c.setReadTimeout(5000);
        c.setRequestProperty("Content-Type", ctype);
        OutputStream os = c.getOutputStream();
        os.write(body);
        os.close();
        c.getResponseCode();
        c.disconnect();
    }

    @Override
    public void onBackPressed() {
        if (termWeb != null && termWeb.canGoBack()) {
            termWeb.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
