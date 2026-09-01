package dev.kfm.v4.shell;

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
 * kfm-v4 主线日常壳（kfmv4-review-shell-apk-verdict 2026-09-02 批准开工；
 * 复刻实验台 nz/lab/device-agent 模式，装载 8.x 主线 8021）。
 *
 * 与实验台壳（dev.kfm.nz.agent）的结构差异——开屏退役：
 *   P1 是「双层 WebView+asset 动画+firstFrame 摘层」；8.x 无 splash-core、
 *   无 NzNative.firstFrame 桥调用，摘层信号永远不到=必然落到 15s 看门狗。
 *   故本壳单 WebView，主题 windowBackground=静态徽标帧（styles.xml+
 *   drawable/splash_static）盖住点击→首绘盲窗，页面首绘自然盖过。裁决 §三。
 *
 * 承袭实验台的三张牌与四件套（语义不变）：
 *   - WebView 真机光栅化 / setWebContentsDebuggingEnabled 暴露 CDP /
 *     CdpRelay 桥到服务器（8029 桥/8031 控制；8030 服务器本机客户端口）；
 *   - 盲窗自监控：onCreate→首绘逐拍墙钟 POST /__boot-marks（8.x 尚无此
 *     端点=404 静默，端点一上链路即通——结构先行的自观测延伸）；
 *   - 真触摸原语 tap()/ime()：未来主线自动化观测的接口面，与实验台同款；
 *   - 自毁钩子：intent extra nz_exit=true → 退进程（冷启动闭环测试用，
 *     参数名与实验台对称，运维手册一条命令两壳通用）。
 */
public class MainActivity extends Activity {

    private static final String TERM_URL = "http://127.0.0.1:8021/";
    private static final String MARKS_URL = TERM_URL + "__boot-marks";

    /** 点击（onCreate）墙钟——全程启动账的零点 */
    private long t0;
    private WebView termWeb;
    private FrameLayout root;

    /** 自毁：退进程（冷启动闭环测试用） */
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

        // 自毁钩子（ssh am start --ez nz_exit true → 旧进程自杀，下一次 am start 即真冷启动）
        if (getIntent().getBooleanExtra("nz_exit", false)) {
            selfDestruct();
            return;
        }
        mark("onCreate");

        // edge-to-edge（2026-08-31 用户拍板全面屏）：窗口铺进刘海区；
        // 声明式（styles.xml cutout shortEdges）+运行时双保险。
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.view.WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    android.view.WindowManager.LayoutParams
                            .LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }

        // 必须在创建任何 WebView 之前调（静态全局开关）
        WebView.setWebContentsDebuggingEnabled(true);

        root = new FrameLayout(this);
        // 根布局背景=主题底色：页面首绘前无一帧白
        root.setBackground(new android.graphics.drawable.ColorDrawable(0xFF09080D));

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

        setContentView(root);
        mark("webview-created");

        // _tApk=点击墙钟，页面算「点击→出生」差值入账+防强缓存
        // （notice 技术备忘；nosplash 8.x 用不上不带）
        termWeb.loadUrl(TERM_URL + "?_tApk=" + t0);
        mark("loadUrl");

        // 保活前台服务（BAR-029 同款）：退后台/息屏不被冻结器冻住
        startService(new Intent(this, KeepAliveService.class));

        // CDP 中继：自己进程（同 uid）连自己的 devtools socket，SELinux 无障
        CdpRelay.start();
    }

    private void configWeb(WebView w) {
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);   // 8.x 主线是 JS 页
        s.setDomStorageEnabled(true);   // 页面本地态
        // WebView 默认白底——内容首绘前会闪白。钉底色与主题/根布局同色
        w.setBackgroundColor(0xFF09080D);
        // 缺它=JS 发起的导航（热更自愈的 location.reload）被外部化到系统
        // 浏览器（实验台 2026-08-27 C 档实锤）。空 Client=全部导航自持。
        w.setWebViewClient(new WebViewClient());
    }

    /** 页面侧桥（8.x 现无调用者；接口面与实验台对称，页面侧接入即生效） */
    private class NzNative {
        @JavascriptInterface
        public void firstFrame() {
            runOnUiThread(() -> {
                mark("native-first-frame");
                // 「点击→就绪」入账（与实验台同语义；当前无开屏预测消费者，
                // 账先记着——8.x 若做开机动画，预测锚现成）
                getSharedPreferences("boot", MODE_PRIVATE).edit()
                        .putInt("readyMs", (int) (System.currentTimeMillis() - t0)).apply();
            });
        }

        /** 真触摸原语：dispatchTouchEvent 派发真实 DOWN/UP，产出与用户手指
         *  完全同款的真点击（坐标=物理像素，JS 侧 cssX*devicePixelRatio） */
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

        /** 收键盘（弹起走 tap 真触摸，收起用这个） */
        @JavascriptInterface
        public void ime(final boolean show) {
            runOnUiThread(() -> {
                if (show) {
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
    }

    /** 盲窗时间戳：每拍一行 JSON POST 服务器（墙钟+相对点击毫秒） */
    private void mark(String name) {
        long now = System.currentTimeMillis();
        String line = "{\"wall\":" + now + ",\"rel\":" + (now - t0)
                + ",\"mark\":\"" + name + "\"}";
        new Thread(() -> {
            try { post(MARKS_URL, line.getBytes(StandardCharsets.UTF_8), "application/json"); }
            catch (Exception e) { /* 上报失败不挡启动（8.x 无端点=404 同此） */ }
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
