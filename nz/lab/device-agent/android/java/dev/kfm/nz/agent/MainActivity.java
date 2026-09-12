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
import android.widget.TextView;
import android.view.Gravity;
import android.view.View;
import android.view.MotionEvent;

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

    // ========== R3 排障黑匣子+启动面包屑（2026-09-09 闪退案）：同步遗言
    // ========== （异步 mark 会被紧随的进程死亡掐断）。静态旗防重入。

    private static boolean crashBoxInstalled = false;

    public static void installCrashBlackbox() {
        if (crashBoxInstalled) return;
        crashBoxInstalled = true;
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((th, ex) -> {
            try {
                java.io.StringWriter sw = new java.io.StringWriter();
                ex.printStackTrace(new java.io.PrintWriter(sw));
                String stack = sw.toString().replace('\n', '|');
                if (stack.length() > 900) stack = stack.substring(0, 900);
                syncCrashPost("crash:" + stack);
            } catch (Throwable ignore) { /* 遗言写不出就算了 */ }
            if (prev != null) prev.uncaughtException(th, ex);
        });
    }

    /** 同步面包屑（闪退定位：崩到哪步，最后一枚停在哪） */
    private static void dbg(String tag) { syncCrashPost("dbg:" + tag); }

    /** 遗言公开口（服务/接收器的 catch 用） */
    public static void syncCrashPostPublic(String mark) { syncCrashPost(mark); }

    /** 同步遗言（网络走工作线程+join(4s)：主线程直发必抛 NOME 被吞） */
    private static void syncCrashPost(String mark) {
        Thread w = new Thread(() -> {
            try {
                java.net.HttpURLConnection c = (java.net.HttpURLConnection)
                        new java.net.URL(MARKS_URL).openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(2000);
                c.setReadTimeout(2000);
                c.setDoOutput(true);
                byte[] body = ("{\"wall\":" + System.currentTimeMillis()
                        + ",\"rel\":-1,\"mark\":\"" + mark.replace("\"", "'") + "\"}").getBytes();
                c.setFixedLengthStreamingMode(body.length);
                c.setRequestProperty("Content-Type", "application/json");
                java.io.OutputStream os = c.getOutputStream();
                os.write(body);
                os.flush();
                os.close();
                c.getResponseCode();
            } catch (Throwable ignore) { /* 网络不通也死得成 */ }
        });
        w.start();
        try { w.join(4000); } catch (InterruptedException ignore) { /* 等不到就算了 */ }
    }


    /** 点击（onCreate）墙钟——全程启动账的零点 */
    private long t0;
    private WebView termWeb;
    private WebView splashWeb;
    private FrameLayout root;

    // ── 浏览器器官（B-线 2026-09-11 用户拍板）：三层堆叠 ──
    // termWeb(nz SPA) ← browserWeb(全屏目标站) ← floatContainer(浮窗=完整
    // 终端专态，第二 WebView 世界 attach 同一 tmux 会话=多路复用；透明壳，
    // 窗体由页面 DOM 绘制、左檐 26px 透明挂外置会话标签轨) + 顶条三合一
    // (拖拽/点按折叠/长按隐身让位) + 原生 orb(线框地球图标，召唤/退回)
    private WebView browserWeb;
    private WebView floatWeb;
    private FrameLayout floatContainer;
    private View orbBtn;
    private boolean browserMode = false;
    private boolean floatCollapsed = false;
    private boolean ghostOn = false;     // 隐身态（透明让位看浏览器，松手恢复）
    private int floatLeft = 0, floatTop = 0;   // 浮窗位置（px，可拖拽）
    private int floatW = 0, floatH = 0;
    private int imeBottom = 0;                 // IME insets（浮窗避键盘钳位）
    private int dpv = 3;                       // 密度换算（onCreate 取真值）
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
        installCrashBlackbox();
        try {
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

        dpv = Math.max(1, Math.round(getResources().getDisplayMetrics().density));
        buildBrowserStack();

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
        } catch (Throwable eBoot) {
            syncCrashPost("crash-oncreate:" + eBoot);
            throw eBoot;
        }
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

        /** R3 长任务通知（判据稿签收；方法名 pushNotice 避 Object.notify
         *  撞名雷区）：页面非聚焦会话有「需要注意」事件时调。 */
        @JavascriptInterface
        public void pushNotice(final String title, final String body) {
            runOnUiThread(() -> {
                try {
                    android.app.NotificationManager nm =
                            getSystemService(android.app.NotificationManager.class);
                    final String ch = "nz_notify";
                    nm.createNotificationChannel(new android.app.NotificationChannel(
                            ch, "nz 任务通知", android.app.NotificationManager.IMPORTANCE_DEFAULT));
                    android.app.Notification.Builder b;
                    if (android.os.Build.VERSION.SDK_INT >= 26) {
                        b = new android.app.Notification.Builder(MainActivity.this, ch);
                    } else {
                        b = new android.app.Notification.Builder(MainActivity.this);
                    }
                    b.setContentTitle(title == null ? "nz" : title)
                            .setContentText(body == null ? "" : body)
                            .setSmallIcon(android.R.drawable.ic_dialog_info)
                            .setAutoCancel(true);
                    // 稳定 id=标题哈希：同会话再通知=替换旧条（不堆叠刷屏）
                    nm.notify((title == null ? "nz" : title).hashCode(), b.build());
                    mark("notify-posted");
                } catch (Exception e) {
                    mark("notify-fail");
                }
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

        /** 全窗合成截屏（PixelCopy 合成眼，body 见外层 doFullShot） */
        @JavascriptInterface
        public String fullShot() {
            return doFullShot();
        }

        /** 浏览器器官：进浏览器模式（目标站全屏+终端浮窗化）。session=
         *  浮窗终端附着的 tmux 会话名（nz 面板传当前附着会话）。 */
        @JavascriptInterface
        public void enterBrowser(final String url, final String session) {
            runOnUiThread(() -> doEnterBrowser(url, session));
        }

        /** 浏览器器官：退回普通模式 */
        @JavascriptInterface
        public void exitBrowser() {
            runOnUiThread(() -> doExitBrowser());
        }

        // ── 浮窗哑原语（2026-09-11 二轮：chrome 手势全在页面 DOM 顶条，
        // 壳只执行——此后浮窗交互迭代走热更，不再打包装机）──

        /** 窗口平移：dx/dy=物理 px 增量（页面侧乘 devicePixelRatio），
         *  (0,0)=收笔提交。语义见 doFloatDragBy（拖拽热路径） */
        @JavascriptInterface
        public void floatDragBy(final int dx, final int dy) {
            runOnUiThread(() -> doFloatDragBy(dx, dy));
        }

        /** 折叠/展开：收起=容器压成 24dp 浮标（页面圆角窗随视口压扁自画），
         *  WebView 保活不摘显 */
        @JavascriptInterface
        public void floatCollapse(final boolean c) {
            runOnUiThread(() -> {
                floatCollapsed = c;
                layoutFloat();
                mark("float-collapse-" + c);
            });
        }

        /** 临时隐身让位看浏览器：alpha 0.12 保触摸（INVISIBLE 连触摸一起
         *  关，隐身中还要能拖），false 恢复 */
        @JavascriptInterface
        public void floatGhost(final boolean on) {
            runOnUiThread(() -> {
                ghostOn = on;
                floatContainer.setAlpha(on ? 0.12f : 1f);
            });
        }

        /** 观测钩（C 档/守视直读） */
        @JavascriptInterface
        public String browserState() {
            return "mode=" + (browserMode ? "on" : "off")
                    + ";collapsed=" + floatCollapsed
                    + ";ghost=" + ghostOn;
        }
    }

    /** 浮窗页专用桥（子集）：chrome 手势哑原语 + 观测钩。刻意不含
     *  firstFrame/tap/ime——float 页调它们没意义且 firstFrame 会把开屏
     *  bye 预测锚拉歪。方法名与 NzNative 保持同形，页面代码无差别 */
    private class NzFloatBridge {
        @JavascriptInterface
        public void floatDragBy(final int dx, final int dy) {
            runOnUiThread(() -> doFloatDragBy(dx, dy));
        }

        @JavascriptInterface
        public void floatCollapse(final boolean c) {
            runOnUiThread(() -> {
                floatCollapsed = c;
                layoutFloat();
                mark("float-collapse-" + c);
            });
        }

        @JavascriptInterface
        public void floatGhost(final boolean on) {
            runOnUiThread(() -> {
                ghostOn = on;
                floatContainer.setAlpha(on ? 0.12f : 1f);
            });
        }

        @JavascriptInterface
        public String browserState() {
            return "mode=" + (browserMode ? "on" : "off")
                    + ";collapsed=" + floatCollapsed
                    + ";ghost=" + ghostOn;
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

    private void doEnterBrowser(String url, String session) {
        runOnUiThread(() -> {
            if (url == null || url.length() < 4) return;
            browserMode = true;
            floatCollapsed = false;
            ghostOn = false;
            floatContainer.setAlpha(1f);
            browserWeb.setVisibility(View.VISIBLE);
            browserWeb.loadUrl(url);
            String fs = "dsh";
            try { fs = java.net.URLEncoder.encode(session == null || session.length() == 0 ? "dsh" : session, "UTF-8"); } catch (Exception e) { /* 编码失败回落 dsh */ }
            floatWeb.loadUrl(TERM_URL + "?nosplash&float=1&fs=" + fs);
            floatContainer.setVisibility(View.VISIBLE);
            layoutFloat();
            android.view.inputmethod.InputMethodManager imm =
                    (android.view.inputmethod.InputMethodManager)
                            getSystemService(INPUT_METHOD_SERVICE);
            imm.hideSoftInputFromWindow(termWeb.getWindowToken(), 0);
            mark("browser-enter");
        });
    }

    private void doExitBrowser() {
        runOnUiThread(() -> {
            browserMode = false;
            ghostOn = false;
            floatContainer.setAlpha(1f);
            browserWeb.setVisibility(View.GONE);
            browserWeb.loadUrl("about:blank");
            floatContainer.setVisibility(View.GONE);
            layoutFloat();
            mark("browser-exit");
        });
    }

    // ── 浏览器器官：堆叠构建/布局/手势 ──

    private void buildBrowserStack() {
        browserWeb = new WebView(this);
        configWeb(browserWeb);
        browserWeb.setVisibility(View.GONE);
        root.addView(browserWeb, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        floatContainer = new FrameLayout(this);
        // 透明容器（2026-09-11 标签朝外改）：窗体底色/圆角/描边由页面 DOM
        // 绘制——终端层右移 26px 成圆角窗，左檐 26px 透明=外挂标签轨，容器
        // 只当定位/手势壳。不裁剪不设底，WebView 透底处露出下层 browserWeb
        floatContainer.setClipToOutline(false);
        floatContainer.setElevation(8 * dpv);
        floatContainer.setVisibility(View.GONE);
        root.addView(floatContainer, new FrameLayout.LayoutParams(1, 1));

        floatWeb = new WebView(this);
        configWeb(floatWeb);
        // 透明檐区（标签朝外的根基）：0x00000000 在部分 WebView 实现里被
        // 当「未设置」回退默认深底（2026-09-12 用户实拍檐区暗色一体），
        // 业界偏方=alpha 置 1 的透明（0x01000000），页面侧 html/body 透底
        floatWeb.setBackgroundColor(0x01000000);
        // 浮窗页也必须有桥：chrome 手势在页面 DOM，靠哑原语三桥驱动壳。
        // 但不给全量 NzNative——float 页的 firstFrame 会把开屏 bye 预测
        // 锚拉歪（浮窗首帧远晚于终端页），tap/ime 对浮窗也无意义，只挂
        // NzFloatBridge 子集（2026-09-11 手势失灵案：浮窗无桥，effect
        // 首行判空直接 return，监听器没装）
        floatWeb.addJavascriptInterface(new NzFloatBridge(), "NzNative");
        floatContainer.addView(floatWeb, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // 顶条/把手/顶条手势全部在页面 DOM（float 插件顶条），壳只留哑原语
        // 桥 floatDragBy/floatCollapse/floatGhost——chrome 迭代走热更不装机
        // （2026-09-11 二轮拍板）。此处不再建任何触摸目标。

        // 线框地球图标（用户拍板「不要加字，至少画个 svg」：原生侧 Path
        // 手绘——外圆+赤道线+中央经线椭圆，无字）
        orbBtn = new View(this) {
            @Override protected void onDraw(android.graphics.Canvas c) {
                android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
                p.setStyle(android.graphics.Paint.Style.STROKE);
                p.setStrokeWidth(1.4f * dpv);
                p.setColor(0xFFD8DADE);
                float cx = getWidth() / 2f, cy = getHeight() / 2f;
                float r = Math.min(getWidth(), getHeight()) / 2f - 6 * dpv;
                c.drawCircle(cx, cy, r, p);
                c.drawLine(cx - r, cy, cx + r, cy, p);
                android.graphics.RectF mer = new android.graphics.RectF(
                        cx - r * 0.45f, cy - r, cx + r * 0.45f, cy + r);
                c.drawOval(mer, p);
            }
        };
        android.graphics.drawable.GradientDrawable obg = new android.graphics.drawable.GradientDrawable();
        obg.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        obg.setColor(0xE8232427); obg.setStroke(Math.max(1, dpv), 0xFF3A3B3F);
        orbBtn.setBackground(obg);
        orbBtn.setOnClickListener(v -> {
            if (browserMode) { doExitBrowser(); return; }
            if (termWeb != null) termWeb.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('kfm-browser-panel-open'))", null);
        });
        root.addView(orbBtn, new FrameLayout.LayoutParams(36 * dpv, 36 * dpv));
        // 首定位必须等 root 真有尺寸：onCreate 期 View.post 走
        // HandlerActionQueue，随首次 traversal 的 dispatchAttachedToWindow
        // 执行——在 performLayout **之前**，root.getWidth()==0，layoutFloat
        // 早退，orb 永远停 (0,0) 且此后无人再调（2026-09-11 装机案预修）。
        // 未布局就重排队，量到尺寸才定位
        orbBtn.post(new Runnable() {
            @Override public void run() {
                if (root.getWidth() == 0) { orbBtn.post(this); return; }
                layoutFloat();
            }
        });
    }

    private void layoutFloat() {
        if (floatContainer == null || root == null) return;
        int W = root.getWidth(), H = root.getHeight() - imeBottom;
        if (W <= 0 || H <= 0) return;
        int gutter = 26 * dpv;   // 窗外左檐=外挂标签轨宽（页面 DOM 同值，改需两头同步）
        if (floatW == 0) {
            // 0.34：首版 0.44 用户实拍「有点长，短一点」（2026-09-11 浮窗首轮反馈）
            floatW = (int) (W * 0.48f); floatH = (int) (H * 0.34f);
            floatLeft = W - floatW - dpv * 50;
            floatTop = H - floatH - dpv * 50;
        }
        int boxW = floatW + gutter;
        floatLeft = Math.max(dpv * 8, Math.min(floatLeft, W - boxW - dpv * 8));
        floatTop = Math.max(dpv * 60, Math.min(floatTop, H - floatH - dpv * 8));
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) floatContainer.getLayoutParams();
        lp.leftMargin = floatLeft; lp.topMargin = floatTop;
        lp.width = boxW; lp.height = floatCollapsed ? 24 * dpv : floatH;
        floatContainer.setLayoutParams(lp);
        FrameLayout.LayoutParams ob = (FrameLayout.LayoutParams) orbBtn.getLayoutParams();
        if (browserMode) { ob.leftMargin = floatLeft + gutter + floatW / 2 - dpv * 18; ob.topMargin = Math.max(dpv * 8, floatTop - dpv * 44); }
        else { ob.leftMargin = W - dpv * 12 - dpv * 36; ob.topMargin = H / 2 - dpv * 18; }
        orbBtn.setLayoutParams(ob);
    }

    /** 浮窗拖拽（2026-09-12 拖影案终案）：真窗纹丝不动，幻影框跟手。
     *  WebView 重绘滞后无论 margins 还是 translation 都出残影（用户实拍
     *  「扩盖 tmux 栏→恢复」循环=滞后表面与框架错位的观感；双端监控证
     *  实拖拽期几何恒定无振荡，纯渲染层伪影）。dx/dy=0 即收笔：真窗
     *  一次性落到幻影位+钳位 */
    private void doFloatDragBy(int dx, int dy) {
        if (floatContainer == null || root == null) return;
        int W = root.getWidth(), H = root.getHeight();
        if (W <= 0 || H <= 0 || floatW <= 0) return;
        int boxW = floatW + 26 * dpv;
        int boxH = floatCollapsed ? 24 * dpv : floatH;
        if (dx == 0 && dy == 0) {
            floatLeft = floatContainer.getLeft();
            floatTop = floatContainer.getTop();
            layoutFloat();
            mark("float-drop");
            return;
        }
        // 真窗 1:1 跟手（用户拍板弃幻影）：offsetLeftAndRight/TopAndBottom
        // 走原生脏区重绘，不触发 requestLayout 全量重排（闪烁主因），也
        // 无 translation 的表面滞后帧（闪烁主因二）。orb 同步随移防脱手
        int curL = floatContainer.getLeft(), curT = floatContainer.getTop();
        int newL = Math.max(dpv * 2, Math.min(curL + dx, W - boxW - dpv * 2));
        int newT = Math.max(dpv * 40, Math.min(curT + dy, H - boxH - dpv * 2));
        floatContainer.offsetLeftAndRight(newL - curL);
        floatContainer.offsetTopAndBottom(newT - curT);
        if (orbBtn != null) {
            orbBtn.offsetLeftAndRight(newL - curL);
            orbBtn.offsetTopAndBottom(newT - curT);
        }
    }

    /** 全窗合成截屏（PixelCopy，API 24+）：整窗合成帧原样抄下来——硬件
     *  加速 WebView/原生层全入镜（decor 软绘全黑的坑绕开），「用户所见=
     *  agent 所见」的合成眼（檐区透明/幻影拖拽/轨位置验收用）。
     *  返回 PNG base64，失败 null。两个桥（NzNative/NzFloatBridge）共用 */
    private String doFullShot() {
        final String[] out = { null };
        final java.util.concurrent.CountDownLatch latch =
                new java.util.concurrent.CountDownLatch(1);
        runOnUiThread(() -> {
            try {
                android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(
                        root.getWidth(), root.getHeight(), android.graphics.Bitmap.Config.ARGB_8888);
                android.view.PixelCopy.request(getWindow(), bmp,
                        (int r) -> {
                            if (r == android.view.PixelCopy.SUCCESS) {
                                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                                bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 90, bos);
                                out[0] = android.util.Base64.encodeToString(
                                        bos.toByteArray(), android.util.Base64.NO_WRAP);
                            }
                            latch.countDown();
                        },
                        new android.os.Handler(getMainLooper()));
            } catch (Throwable t) {
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

    @Override
    public void onBackPressed() {
        if (browserMode) { doExitBrowser(); return; }
        if (termWeb != null && termWeb.canGoBack()) {
            termWeb.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
