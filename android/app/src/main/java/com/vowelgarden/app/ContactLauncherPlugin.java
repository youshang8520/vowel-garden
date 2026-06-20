package com.vowelgarden.app;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ContactLauncher")
public class ContactLauncherPlugin extends Plugin {
    @PluginMethod
    public void openWeChat(PluginCall call) {
        JSObject result = new JSObject();
        if (openPackageUri("weixin://", "com.tencent.mm") || openLaunchPackage("com.tencent.mm")) {
            result.put("opened", true);
            result.put("target", "wechat");
            call.resolve(result);
            return;
        }
        call.reject("WeChat is not installed");
    }

    private boolean openPackageUri(String uriText, String packageName) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriText));
        intent.setPackage(packageName);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean openLaunchPackage(String packageName) {
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(packageName);
        if (intent == null) {
            return false;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }
}
