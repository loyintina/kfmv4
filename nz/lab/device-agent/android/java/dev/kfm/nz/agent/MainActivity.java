package dev.kfm.nz.agent;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * nz 设备代理壳：全屏 WebView 加载 nz 终端 + 开 CDP 调试口 + 起中继线程。
 *
 * 三张牌（评审信 kfmv4-9.0-nz-device-agent-p1-review §二）：
 *   1. WebView（Android 系统 Chromium）加载 nz 终端——真机光栅化，
 *      中文居上/字宽这类像素级问题直接现形（headless 永远做不到）。
 *   2. setWebContentsDebuggingEnabled(true)——暴露 localabstract
 *      socket webview_devtools_remote_<pid>（chrome://inspect 同款）。
 *   3. CdpRelay——把那个 socket 桥到服务器（见 CdpRelay.java 文件头）。
 *
 * 路由：全部走 127.0.0.1 回环 + kalo 隧道（nz TASK.md 定案：8023 绑
 * loopback，手机经 SSH 本地转发访问）——APK 与 Via 浏览器同姿势，
 * 无公网暴露面。
 */
public class MainActivity extends Activity {

    private static final String TERM_URL = "http://127.0.0.1:8023/";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 必须在创建任何 WebView 之前调（静态全局开关）
        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);   // nz 终端是 TS web 页
        s.setDomStorageEnabled(true);   // 终端本地态
        setContentView(web);

        web.loadUrl(TERM_URL);

        // 保活前台服务（BAR-029 同款）：退后台/息屏不被 cached-app 冻结器
        // 冻住——冻结=心跳停跳、DIAL 黑洞、实验台链路全僵（2026-08-27 实测）
        startService(new Intent(this, KeepAliveService.class));

        // CDP 中继：自己进程（同 uid）连自己的 devtools socket，SELinux 无障
        CdpRelay.start();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
