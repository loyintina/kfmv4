package dev.kfm.nz.agent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 开机自启（2026-08-27 用户拍板「加了也没关系」）：只拉保活 Service——
 * 零 UI（绝不 startActivity 抢前台），观测常驻体（离屏 WebView）随
 * Service 重建。用户重启手机后实验台链路自动恢复，全程无人值守。
 * 前置：用户已给 NZ-Agent 自启动权限（对齐 kfm-na 那轮）。
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            context.startForegroundService(new Intent(context, KeepAliveService.class));
        }
    }
}
