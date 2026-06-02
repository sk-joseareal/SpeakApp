package com.sokinternet.cursoingles;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.graphics.Rect;
import android.view.Window;
import android.view.WindowManager;

import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.sokinternet.plugins.p4w4.P4w4PluginPlugin;

import androidx.core.graphics.Insets;
import androidx.core.view.WindowCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONObject;


//import androidx.core.view.WindowCompat;
//import androidx.core.view.WindowInsetsControllerCompat;



public class MainActivity extends BridgeActivity {
    private static final int LEGACY_ANDROID_MAX_SDK = 31;
    private static final String TRANSPARENT_STATUSBAR = "#00000000";
    private static final String TRANSPARENT_NAVBAR = "#00000000";
    private static final String LEGACY_STATUSBAR_COLOR = "#A7C6F7";
    private static final String LEGACY_NAVBAR_COLOR = "#EEF3FF";
    private static final String LEGACY_TEST_WINDOW_COLOR = "#00ffff";
    private static final String LEGACY_TEST_STATUSBAR_COLOR = "#ffff00";
    private static final String LEGACY_TEST_NAVBAR_COLOR = "#ff8800";
    private boolean legacyWebViewLayoutWatcherInstalled = false;

    private boolean isLegacyAndroidDevice() {
        return android.os.Build.VERSION.SDK_INT <= LEGACY_ANDROID_MAX_SDK;
    }

    private boolean isCallbackIntent(Intent intent) {
        if (intent == null || intent.getData() == null) {
            return false;
        }
        Uri data = intent.getData();
        return Intent.ACTION_VIEW.equals(intent.getAction())
            && "app".equals(data.getScheme())
            && "callback".equals(data.getHost());
    }

    private String jsonStringLiteral(String value) {
        return JSONObject.quote(value != null ? value : "");
    }

    private void dispatchOpenUrlToWebView(Intent intent, String reason) {
        if (!isCallbackIntent(intent)) {
            return;
        }
        String url = intent.getDataString();
        Log.i(">#C02#> MainActivity", "openURL recibido (" + reason + "): " + url);
        String urlLiteral = jsonStringLiteral(url);
        String reasonLiteral = jsonStringLiteral(reason);
        String js =
            "(() => {"
                + "try {"
                + "const payload = { url: " + urlLiteral + ", reason: " + reasonLiteral + " };"
                + "if (typeof window.__handleNativeOpenUrlFallback === 'function') {"
                + "window.__handleNativeOpenUrlFallback(payload.url, payload.reason);"
                + "} else {"
                + "window.__pendingNativeOpenUrls = window.__pendingNativeOpenUrls || [];"
                + "window.__pendingNativeOpenUrls.push(payload);"
                + "window.dispatchEvent(new CustomEvent('app:native-open-url', { detail: payload }));"
                + "}"
                + "console.log('>#C02#> native Android openURL fallback dispatched', payload.url);"
                + "return true;"
                + "} catch (err) {"
                + "return String(err && err.message ? err.message : err);"
                + "}"
                + "})();";
        Handler handler = new Handler(Looper.getMainLooper());
        int[] delaysMs = new int[] { 50, 500, 1500 };
        for (int delayMs : delaysMs) {
            handler.postDelayed(() -> {
                if (this.bridge == null || this.bridge.getWebView() == null) {
                    Log.i(">#C02#> MainActivity", "openURL fallback: webView no disponible (" + reason + ")");
                    return;
                }
                this.bridge.getWebView().evaluateJavascript(js, result -> {
                    Log.i(
                        ">#C02#> MainActivity",
                        "openURL fallback injected (" + reason + "): " + result
                    );
                });
            }, delayMs);
        }
    }

    private void logLegacyWindowState(String reason) {
        if (!isLegacyAndroidDevice()) {
            return;
        }
        try {
            View decorView = getWindow().getDecorView();
            Rect visibleFrame = new Rect();
            decorView.getWindowVisibleDisplayFrame(visibleFrame);

            String webViewState = "webView=null";
            View webView = this.bridge != null ? this.bridge.getWebView() : null;
            if (webView != null) {
                Rect webRect = new Rect();
                webView.getGlobalVisibleRect(webRect);
                webViewState =
                    "webView="
                        + webView.getWidth()
                        + "x"
                        + webView.getHeight()
                        + " top="
                        + webRect.top
                        + " left="
                        + webRect.left
                        + " right="
                        + webRect.right
                        + " bottom="
                        + webRect.bottom;
            }

            WindowInsetsCompat compatInsets = ViewCompat.getRootWindowInsets(decorView);
            String insetsState = "insets=null";
            if (compatInsets != null) {
                Insets systemBars = compatInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                Insets systemBarsIgnoring = compatInsets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.systemBars());
                Insets ime = compatInsets.getInsets(WindowInsetsCompat.Type.ime());
                Insets cutout = compatInsets.getInsets(WindowInsetsCompat.Type.displayCutout());
                insetsState =
                    "systemBars="
                        + systemBars
                        + " systemBarsIgnoring="
                        + systemBarsIgnoring
                        + " ime="
                        + ime
                        + " cutout="
                        + cutout;
            }

            Log.i(
                ">#N00#> MainActivity",
                "[legacy-layout-trace] "
                    + reason
                    + " visibleFrame="
                    + visibleFrame.toShortString()
                    + " decor="
                    + decorView.getWidth()
                    + "x"
                    + decorView.getHeight()
                    + " "
                    + webViewState
                    + " "
                    + insetsState
            );
        } catch (Exception error) {
            Log.e(">#N00#> MainActivity", "[legacy-layout-trace] " + reason + " error=" + error.getMessage());
        }
    }

    private void installLegacyInsetsLogger() {
        if (!isLegacyAndroidDevice()) {
            return;
        }
        try {
            View decorView = getWindow().getDecorView();
            ViewCompat.setOnApplyWindowInsetsListener(decorView, (view, insets) -> {
                try {
                    Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                    Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                    Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
                    Log.i(
                        ">#N00#> MainActivity",
                        "[legacy-layout-trace] onApplyWindowInsets systemBars="
                            + systemBars
                            + " ime="
                            + ime
                            + " cutout="
                            + cutout
                    );
                } catch (Exception error) {
                    Log.e(">#N00#> MainActivity", "[legacy-layout-trace] onApplyWindowInsets error=" + error.getMessage());
                }
                return insets;
            });
            decorView.post(() -> logLegacyWindowState("installLegacyInsetsLogger"));
        } catch (Exception error) {
            Log.e(">#N00#> MainActivity", "[legacy-layout-trace] installLegacyInsetsLogger error=" + error.getMessage());
        }
    }

    private void installLegacyWebViewLayoutWatcher() {
        if (!isLegacyAndroidDevice() || legacyWebViewLayoutWatcherInstalled) {
            return;
        }
        try {
            View webView = this.bridge != null ? this.bridge.getWebView() : null;
            if (webView == null) {
                return;
            }
            legacyWebViewLayoutWatcherInstalled = true;
            webView.addOnLayoutChangeListener(
                new View.OnLayoutChangeListener() {
                    @Override
                    public void onLayoutChange(
                        View v,
                        int left,
                        int top,
                        int right,
                        int bottom,
                        int oldLeft,
                        int oldTop,
                        int oldRight,
                        int oldBottom
                    ) {
                        Log.i(
                            ">#N00#> MainActivity",
                            "[legacy-layout-trace] webView onLayoutChange new="
                                + left
                                + ","
                                + top
                                + ","
                                + right
                                + ","
                                + bottom
                                + " old="
                                + oldLeft
                                + ","
                                + oldTop
                                + ","
                                + oldRight
                                + ","
                                + oldBottom
                        );
                    }
                }
            );
            Log.i(">#N00#> MainActivity", "[legacy-layout-trace] installLegacyWebViewLayoutWatcher");
        } catch (Exception error) {
            Log.e(">#N00#> MainActivity", "[legacy-layout-trace] installLegacyWebViewLayoutWatcher error=" + error.getMessage());
        }
    }

    private void installLegacyWebViewInsetsMargins() {
        if (!isLegacyAndroidDevice()) {
            return;
        }
        try {
            View contentRoot = findViewById(android.R.id.content);
            if (contentRoot != null) {
                contentRoot.setPadding(
                    contentRoot.getPaddingLeft(),
                    contentRoot.getPaddingTop(),
                    contentRoot.getPaddingRight(),
                    contentRoot.getPaddingBottom()
                );
                contentRoot.requestLayout();
            }
            Log.i(">#N00#> MainActivity", "[legacy-layout-trace] installLegacyWebViewInsetsMargins disabled");
        } catch (Exception error) {
            Log.e(">#N00#> MainActivity", "[legacy-layout-trace] installLegacyWebViewInsetsMargins error=" + error.getMessage());
        }
    }

    private void applyTransparentStatusBarChrome(String reason) {
        Window window = getWindow();
        // Legacy Android re-applies system window insets on resume/focus unless we keep
        // the window in edge-to-edge mode. If this flips back to true, the WebView gets
        // relaid out and the whole screen shifts vertically.
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        if (isLegacyAndroidDevice()) {
            window.setStatusBarColor(Color.parseColor(LEGACY_TEST_STATUSBAR_COLOR));
            window.setNavigationBarColor(Color.parseColor(LEGACY_TEST_NAVBAR_COLOR));
        } else {
            window.setStatusBarColor(Color.parseColor(TRANSPARENT_STATUSBAR));
            window.setNavigationBarColor(Color.parseColor(TRANSPARENT_NAVBAR));
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        window.setBackgroundDrawableResource(R.drawable.legacy_window_background);
        if (isLegacyAndroidDevice()) {
            window.getDecorView().setBackgroundColor(Color.parseColor(LEGACY_TEST_WINDOW_COLOR));
        } else {
            window.getDecorView().setBackgroundResource(R.drawable.legacy_window_background);
        }
        applyStatusBarIcons(window, true);
        Log.i(">#N00#> MainActivity", "applyTransparentStatusBarChrome reason=" + reason);
    }

    private void applyStatusBarIcons(Window window, boolean lightIcons) {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(!lightIcons);
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            int flags = window.getDecorView().getSystemUiVisibility();
            if (lightIcons) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            window.getDecorView().setSystemUiVisibility(flags);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        dispatchOpenUrlToWebView(getIntent(), "onCreate");

        if (isLegacyAndroidDevice()) {
            // Keep legacy Android pinned to edge-to-edge from the first frame.
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            applyTransparentStatusBarChrome("onCreate-legacy");
            installLegacyInsetsLogger();
            installLegacyWebViewLayoutWatcher();
            installLegacyWebViewInsetsMargins();
            logLegacyWindowState("onCreate-legacy");
            return;
        }

        applyTransparentStatusBarChrome("onCreate");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchOpenUrlToWebView(intent, "onNewIntent");
    }

    private void reapplyStoredChrome(String reason) {
        try {
            SharedPreferences prefs = getSharedPreferences(P4w4PluginPlugin.NATIVE_CHROME_PREFS, Context.MODE_PRIVATE);
            String backgroundColor = prefs.getString(P4w4PluginPlugin.PREF_BG, "");
            boolean lightIcons = prefs.getBoolean(P4w4PluginPlugin.PREF_LIGHT_ICONS, true);
            if (backgroundColor == null || backgroundColor.trim().isEmpty()) {
                Log.i(">#N00#> MainActivity", "reapplyStoredChrome skipped reason=" + reason + " (no stored chrome)");
                return;
            }
            Window window = getWindow();
            WindowCompat.setDecorFitsSystemWindows(window, false);
            int color = Color.parseColor(backgroundColor);
            boolean transparentChrome = Color.alpha(color) == 0;
            if (transparentChrome && isLegacyAndroidDevice()) {
                window.setStatusBarColor(Color.parseColor(LEGACY_TEST_STATUSBAR_COLOR));
                window.setNavigationBarColor(Color.parseColor(LEGACY_TEST_NAVBAR_COLOR));
                window.setBackgroundDrawableResource(R.drawable.legacy_window_background);
                window.getDecorView().setBackgroundColor(Color.parseColor(LEGACY_TEST_WINDOW_COLOR));
            } else {
                window.setStatusBarColor(color);
                window.setNavigationBarColor(color);
                if (transparentChrome) {
                    window.getDecorView().setBackgroundResource(R.drawable.legacy_window_background);
                } else {
                    window.getDecorView().setBackgroundColor(color);
                }
            }
            View webView = this.bridge != null ? this.bridge.getWebView() : null;
            if (webView != null && isLegacyAndroidDevice()) {
                webView.setBackgroundColor(Color.parseColor("#00ff00"));
            }
            applyStatusBarIcons(window, lightIcons);
            Log.i(">#N00#> MainActivity", "reapplyStoredChrome reason=" + reason + " bg=" + backgroundColor + " transparentChrome=" + transparentChrome + " lightIcons=" + lightIcons);
        } catch (Exception error) {
            Log.e(">#N00#> MainActivity", "reapplyStoredChrome error reason=" + reason + " " + error.getMessage());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (isLegacyAndroidDevice()) {
            // Reassert the same window mode on hot resume; Android old WebViews may
            // otherwise shrink the visible frame and recut the bottom of the page.
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            installLegacyWebViewLayoutWatcher();
            getWindow().getDecorView().post(() -> reapplyStoredChrome("onResume-legacy"));
            getWindow().getDecorView().postDelayed(() -> reapplyStoredChrome("onResume-legacy+250"), 250);
            getWindow().getDecorView().postDelayed(() -> reapplyStoredChrome("onResume-legacy+900"), 900);
            logLegacyWindowState("onResume-legacy");
            return;
        }
        getWindow().getDecorView().post(() -> reapplyStoredChrome("onResume"));
        getWindow().getDecorView().postDelayed(() -> reapplyStoredChrome("onResume+250"), 250);
        getWindow().getDecorView().postDelayed(() -> reapplyStoredChrome("onResume+900"), 900);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (isLegacyAndroidDevice()) {
            // Same reassertion on focus regain: do not allow a second insets pass.
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            installLegacyWebViewLayoutWatcher();
            if (hasFocus) {
                getWindow().getDecorView().post(() -> reapplyStoredChrome("onWindowFocusChanged-legacy"));
            }
            if (hasFocus) {
                logLegacyWindowState("onWindowFocusChanged-legacy");
            }
            return;
        }
        if (hasFocus) {
            getWindow().getDecorView().post(() -> reapplyStoredChrome("onWindowFocusChanged"));
        }
    }

}
