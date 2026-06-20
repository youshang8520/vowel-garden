package com.vowelgarden.app;

import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.media.AudioManager;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.WindowInsetsController;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        registerPlugin(NativeSpeechPlugin.class);
        registerPlugin(NativeRecorderPlugin.class);
        registerPlugin(ContactLauncherPlugin.class);
        super.onCreate(savedInstanceState);
        configureEdgeToEdgeStatusBar();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setBackgroundColor(Color.TRANSPARENT);
            WebSettings settings = webView.getSettings();
            settings.setTextZoom(100);
            applyWebViewSystemInsets(webView);
        }
    }

    private void configureEdgeToEdgeStatusBar() {
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getDecorView().getWindowInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                );
            }
            return;
        }
        int flags =
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);
    }

    private void applyWebViewSystemInsets(WebView webView) {
        int fallbackStatusTopPx = getSystemBarDimensionPx("status_bar_height");
        int fallbackNavBottomPx = getSystemBarDimensionPx("navigation_bar_height");
        setWebViewSafeArea(webView, fallbackStatusTopPx, fallbackNavBottomPx);
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            int statusTopPx;
            int navBottomPx;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets statusBars = insets.getInsets(WindowInsets.Type.statusBars());
                Insets navigationBars = insets.getInsets(WindowInsets.Type.navigationBars());
                statusTopPx = statusBars.top;
                navBottomPx = navigationBars.bottom;
            } else {
                statusTopPx = insets.getSystemWindowInsetTop();
                navBottomPx = insets.getSystemWindowInsetBottom();
            }
            setWebViewSafeArea(webView, Math.max(statusTopPx, fallbackStatusTopPx), Math.max(navBottomPx, fallbackNavBottomPx));
            return insets;
        });
        webView.requestApplyInsets();
        webView.postDelayed(webView::requestApplyInsets, 500);
        webView.postDelayed(webView::requestApplyInsets, 1500);
    }

    private int getSystemBarDimensionPx(String resourceName) {
        int resourceId = getResources().getIdentifier(resourceName, "dimen", "android");
        if (resourceId <= 0) return 0;
        return getResources().getDimensionPixelSize(resourceId);
    }

    private void setWebViewSafeArea(WebView webView, int statusTopPx, int navBottomPx) {
        float density = getResources().getDisplayMetrics().density;
        int statusTopCssPx = Math.max(0, Math.round(statusTopPx / density));
        int navBottomCssPx = Math.max(0, Math.round(navBottomPx / density));
        webView.post(() -> webView.evaluateJavascript(
            "document.documentElement.style.setProperty('--native-safe-area-top','" + statusTopCssPx + "px');" +
                "document.documentElement.style.setProperty('--native-safe-area-bottom','" + navBottomCssPx + "px');",
            null
        ));
    }
}
