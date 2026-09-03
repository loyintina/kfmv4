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

        // edge-to-edge（2026-08-31 用户拍板全面屏）：窗口铺进刘海区。
        // 现状=主题 Fullscreen 但刘海模式默认 DEFAULT——状态栏隐藏时
        // 短边刘海区拉黑信box（真机实锤：屏 854 而 innerH=812，顶 42px
        // 黑条，env(safe-area-inset-top)=0=窗口层就被切、页面感知不到）。
        // SHORT_EDGES 允许铺进短边刘海区；页面侧 viewport-fit=cover 后
        // env(safe-area-inset-top) 吐真值，内容避让交给页面 padding
        // （背景铺满=黑条消失，摄像头洞下不排内容）。
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.view.WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    android.view.WindowManager.LayoutParams
                            .LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        // decor 不贴系统窗口（API 30+；API 36 实测只设 SHORT_EDGES 仍
        // letterbox——edge-to-edge 时代要显式放行，内容才真铺进刘海/
        // 状态栏区）。配合主题声明式 windowLayoutInDisplayCutoutMode。
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }

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

        // 预测驱动退场（2026-08-30 用户拍板「隐去结束后刚好赶上准备完毕，
        // 而不是准备完毕后开始隐去」）：上次实测「点击→就绪」毫秒存
        // SharedPreferences，本次开机传给开屏页 ?bye=预测-320——开屏自己
        // 提前渐隐，隐去完正好终端就绪。无数据（首启）不传=就绪才退场
        // 的安全行为；预测偏慢=bye 晚于 first-frame=complete() 先走正常
        // 路径（bye 作废）；预测偏快=bye 早隐去后露纯暗终端（WebView 底
        // 已钉 #05070f），可接受的降级。实测就绪波动 ±100ms，锚很稳。
        int predReady = getSharedPreferences("boot", MODE_PRIVATE).getInt("readyMs", -1);
        String splashUrl = SPLASH_URL;
        if (predReady > 0) {
            // bye 不得早于 intro 扫完（1500）+一点余量，否则扫线途中渐隐=断帧；
            // hash 传参不用 ?query——file:// 资源解析对 query 行为不赌
            int bye = Math.max(predReady - 320, 1600);
            splashUrl = SPLASH_URL + "#bye=" + bye;
            // bye 路径的硬摘层保险：JS 已隐但 first-frame 迟迟不到时，
            // 透明层仍会挡触摸——预测+1s 后无论如何摘（15s 看门狗是最终底）
            root.postDelayed(this::removeSplashNow, predReady + 1000);
        }

        termWeb.loadUrl(TERM_URL + "?nosplash&_tApk=" + t0);
        splashWeb.loadUrl(splashUrl);
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
                // 实测「点击→就绪」入账，作下次开屏 bye 预测锚（预测驱动退场）
                getSharedPreferences("boot", MODE_PRIVATE).edit()
                        .putInt("readyMs", (int) (System.currentTimeMillis() - t0)).apply();
                dismissSplash();
            });
        }

        /** 真触摸原语（2026-08-30 用户拍板，实验台通用基建）：给自己的
         *  WebView dispatchTouchEvent 派发真实 DOWN/UP——无需任何权限
         *  （只有注入*别的* uid 才要 INJECT_EVENTS），产出与用户手指
         *  完全同款的真点击：容器 click→聚焦诱饵→键盘自然弹起，整个
         *  链路走系统真触摸管道，无任何「模拟」差异。坐标=物理像素
         *  （JS 侧用 cssX*devicePixelRatio 换算）。为什么不用
         *  showSoftInput 直控键盘：窗口焦点被 IME 抢走后 ROM 拒调
         *  （ime-show-rej/forced 三连实测），不可靠。 */
        @JavascriptInterface
        public void tap(final float x, final float y) {
            runOnUiThread(() -> {
                long now = android.os.SystemClock.uptimeMillis();
                android.view.MotionEvent down = android.view.MotionEvent.obtain(
                        now, now, android.view.MotionEvent.ACTION_DOWN, x, y, 0);
                android.view.MotionEvent up = android.view.MotionEvent.obtain(
                        now, now + 60, android.view.MotionEvent.ACTION_UP, x, y, 0);
                termWeb.dispatchTouchEvent(down);
                termWeb.dispatchTouchEvent(up);
                down.recycle();
                up.recycle();
                mark("tap-" + (int) x + "-" + (int) y);
            });
        }

        /** 收键盘（弹起走 tap 真触摸，收起用这个——hideSoftInputFromWindow
         *  不依赖窗口焦点，实测可靠） */
        @JavascriptInterface
        public void ime(final boolean show) {
            runOnUiThread(() -> {
                if (show) {
                    // 弹起统一走 tap（见上）；保留此分支只为兼容旧调用
                    mark("ime-show-use-tap");
                    return;
                }
                android.view.inputmethod.InputMethodManager imm =
                        (android.view.inputmethod.InputMethodManager)
                                getSystemService(INPUT_METHOD_SERVICE);
                imm.hideSoftInputFromWindow(termWeb.getWindowToken(), 0);
                mark("ime-hide");
            });
        }

        /** 软件层截屏（na 线提案 2026-09-03，实验②）：LAYER_TYPE_SOFTWARE
         *  强制软件光栅后 webView.draw(canvas)。实测边界：前台 DOM 活、
         *  canvas 黑（软件光栅不吃 canvas/WebGL）；后台=冻结帧（隐藏态
         *  光栅不再推进，DOM 变化不反映，setWebLifecycleState 也救不回）。
         *  拍完恢复原层类型，不常驻 SOFTWARE。返回 PNG base64，失败 null。 */
        @JavascriptInterface
        public String softShot() {
            final String[] out = { null };
            final java.util.concurrent.CountDownLatch latch =
                    new java.util.concurrent.CountDownLatch(1);
            runOnUiThread(() -> {
                int origLayer = termWeb.getLayerType();
                try {
                    int w = termWeb.getWidth(), h = termWeb.getHeight();
                    termWeb.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null);
                    android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(
                            w, h, android.graphics.Bitmap.Config.ARGB_8888);
                    termWeb.draw(new android.graphics.Canvas(bmp));
                    java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                    bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, bos);
                    bmp.recycle();
                    out[0] = android.util.Base64.encodeToString(
                            bos.toByteArray(), android.util.Base64.NO_WRAP);
                    mark("soft-shot-" + bos.size());
                } catch (Throwable t) {
                    mark("soft-shot-err");
                } finally {
                    termWeb.setLayerType(origLayer, null);
                    latch.countDown();
                }
            });
            try {
                latch.await(5, java.util.concurrent.TimeUnit.SECONDS);
            } catch (InterruptedException ie) {
                return null;
            }
            return out[0];
        }
    }

    /** 幂等摘层：removeView+destroy+入账，各路（complete 回报/bye 硬摘/
     *  看门狗）共用，先到先摘后到空转 */
    private void removeSplashNow() {
        if (splashWeb == null) return;
        WebView sw = splashWeb;
        splashWeb = null;
        root.removeView(sw);
        sw.destroy();
        mark("splash-dismissed");
    }

    /** 首帧可操作才切换：splash 层 __complete() 扫完定帧渐隐——剩余毫秒
     *  由 JS 唯一真源回报，壳只按回报值延时摘层（不再写死猜 JS 行为：
     *  700+400ms 固定猜曾是双时间源，终端就绪后白盖 ~1.1s）。回报 0=
     *  JS 已自行隐去（bye 预测路径先走了）=100ms 快摘；无回报/离谱=
     *  旧版兜底 900ms */
    private void dismissSplash() {
        if (dismissed || splashWeb == null) return;
        dismissed = true;
        splashWeb.evaluateJavascript(
                "window.__complete ? window.__complete() : -1",
                v -> {
                    int ms;
                    try { ms = Integer.parseInt(v == null ? "-1" : v.trim()); }
                    catch (Exception e) { ms = -1; }
                    if (ms == 0) ms = 100;            // JS 已隐（bye 先走）=快摘
                    else if (ms < 0 || ms > 2000) ms = 900; // 无 __complete=旧版兜底
                    root.postDelayed(this::removeSplashNow, ms);
                });
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
