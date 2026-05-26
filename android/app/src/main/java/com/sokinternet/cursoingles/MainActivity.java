package com.sokinternet.cursoingles;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Rect;
import android.view.Window;
import android.view.WindowManager;

import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.sokinternet.plugins.p4w4.P4w4PluginPlugin;

import androidx.core.graphics.Insets;
import androidx.core.view.WindowCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;


//import androidx.core.view.WindowCompat;
//import androidx.core.view.WindowInsetsControllerCompat;



public class MainActivity extends BridgeActivity {
    private static final int LEGACY_ANDROID_MAX_SDK = 31;
    private static final String TRANSPARENT_STATUSBAR = "#00000000";
    private static final String TRANSPARENT_NAVBAR = "#00000000";
    private static final String LEGACY_STATUSBAR_COLOR = "#A7C6F7";
    private static final String LEGACY_NAVBAR_COLOR = "#EEF3FF";
    private boolean legacyWebViewLayoutWatcherInstalled = false;
    private boolean legacyWebViewInsetsPaddingInstalled = false;
    private boolean legacyContentPaddingCaptured = false;
    private int legacyContentBasePaddingLeft = 0;
    private int legacyContentBasePaddingTop = 0;
    private int legacyContentBasePaddingRight = 0;
    private int legacyContentBasePaddingBottom = 0;

    private boolean isLegacyAndroidDevice() {
        return android.os.Build.VERSION.SDK_INT <= LEGACY_ANDROID_MAX_SDK;
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

    private void applyLegacyWebViewInsetsMargins(String reason) {
        if (!isLegacyAndroidDevice()) {
            return;
        }
        try {
            View contentRoot = findViewById(android.R.id.content);
            if (contentRoot == null) {
                return;
            }

            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(contentRoot);
            Insets systemBars = insets != null ? insets.getInsets(WindowInsetsCompat.Type.systemBars()) : Insets.NONE;
            int left = Math.max(0, systemBars.left);
            int top = Math.max(0, systemBars.top);
            int right = Math.max(0, systemBars.right);
            int bottom = Math.max(0, systemBars.bottom);
            if (!legacyContentPaddingCaptured) {
                legacyContentPaddingCaptured = true;
                legacyContentBasePaddingLeft = contentRoot.getPaddingLeft();
                legacyContentBasePaddingTop = contentRoot.getPaddingTop();
                legacyContentBasePaddingRight = contentRoot.getPaddingRight();
                legacyContentBasePaddingBottom = contentRoot.getPaddingBottom();
            }
            contentRoot.setPadding(
                legacyContentBasePaddingLeft + left,
                legacyContentBasePaddingTop + top,
                legacyContentBasePaddingRight + right,
                legacyContentBasePaddingBottom + bottom
            );
            contentRoot.requestLayout();

            Log.i(
                ">#N00#> MainActivity",
                "[legacy-layout-trace] applyLegacyWebViewInsetsMargins reason="
                    + reason
                    + " contentPadding="
                    + left
                    + ","
                    + top
                    + ","
                    + right
                    + ","
                    + bottom
            );
        } catch (Exception error) {
            Log.e(">#N00#> MainActivity", "[legacy-layout-trace] applyLegacyWebViewInsetsMargins error=" + error.getMessage());
        }
    }

    private void installLegacyWebViewInsetsMargins() {
        if (!isLegacyAndroidDevice() || legacyWebViewInsetsPaddingInstalled) {
            return;
        }
        try {
            View contentRoot = findViewById(android.R.id.content);
            if (contentRoot == null) {
                getWindow().getDecorView().postDelayed(this::installLegacyWebViewInsetsMargins, 50);
                return;
            }
            legacyWebViewInsetsPaddingInstalled = true;
            applyLegacyWebViewInsetsMargins("installLegacyWebViewInsetsMargins");
            ViewCompat.setOnApplyWindowInsetsListener(contentRoot, (view, insets) -> {
                try {
                    Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                    int left = Math.max(0, systemBars.left);
                    int top = Math.max(0, systemBars.top);
                    int right = Math.max(0, systemBars.right);
                    int bottom = Math.max(0, systemBars.bottom);
                    if (!legacyContentPaddingCaptured) {
                        legacyContentPaddingCaptured = true;
                        legacyContentBasePaddingLeft = view.getPaddingLeft();
                        legacyContentBasePaddingTop = view.getPaddingTop();
                        legacyContentBasePaddingRight = view.getPaddingRight();
                        legacyContentBasePaddingBottom = view.getPaddingBottom();
                    }
                    view.setPadding(
                        legacyContentBasePaddingLeft + left,
                        legacyContentBasePaddingTop + top,
                        legacyContentBasePaddingRight + right,
                        legacyContentBasePaddingBottom + bottom
                    );
                    view.requestLayout();
                    Log.i(
                        ">#N00#> MainActivity",
                        "[legacy-layout-trace] onApplyWindowInsets(contentRoot) padding="
                            + left
                            + ","
                            + top
                            + ","
                            + right
                            + ","
                            + bottom
                    );
                } catch (Exception error) {
                    Log.e(">#N00#> MainActivity", "[legacy-layout-trace] onApplyWindowInsets(contentRoot) error=" + error.getMessage());
                }
                return insets;
            });
            contentRoot.requestApplyInsets();
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
            window.setStatusBarColor(Color.parseColor(LEGACY_STATUSBAR_COLOR));
            window.setNavigationBarColor(Color.parseColor(LEGACY_NAVBAR_COLOR));
        } else {
            window.setStatusBarColor(Color.parseColor(TRANSPARENT_STATUSBAR));
            window.setNavigationBarColor(Color.parseColor(TRANSPARENT_NAVBAR));
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        window.setBackgroundDrawableResource(R.drawable.legacy_window_background);
        window.getDecorView().setBackgroundResource(R.drawable.legacy_window_background);
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



        // Esperamos un poco a que el WebView esté montado
        getWindow().getDecorView().postDelayed(() -> {
            View webView = this.bridge.getWebView();

            if (webView != null) {
                int offsetPx = getStatusBarHeight();
                ViewGroup.LayoutParams params = webView.getLayoutParams();

                if (params != null) {
                    int newHeight = webView.getHeight() - offsetPx;
                    webView.setTranslationY(offsetPx);
                    params.height = newHeight;
                    webView.setLayoutParams(params);
                    webView.requestLayout();

                    Log.i(">#N00#> MainActivity", "✅ WebView desplazado " + offsetPx + "px hacia abajo en onCreate()");
                } else {
                    Log.e(">#N00#> MainActivity", "❌ No se pudo acceder a LayoutParams del WebView");
                }
            } else {
                Log.e(">#N00#> MainActivity", "❌ WebView es null");
            }
        }, 50); // Delay leve para que el WebView esté creado
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
            window.setStatusBarColor(Color.parseColor(backgroundColor));
            window.getDecorView().setBackgroundColor(Color.parseColor(backgroundColor));
            applyStatusBarIcons(window, lightIcons);
            Log.i(">#N00#> MainActivity", "reapplyStoredChrome reason=" + reason + " bg=" + backgroundColor + " lightIcons=" + lightIcons);
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
            View contentRoot = findViewById(android.R.id.content);
            if (contentRoot != null) {
                contentRoot.requestApplyInsets();
            }
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
            View contentRoot = findViewById(android.R.id.content);
            if (contentRoot != null) {
                contentRoot.requestApplyInsets();
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

    private int getStatusBarHeight() {
        int result = 0;
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            result = getResources().getDimensionPixelSize(resourceId);
        }
        return result;
    }
    
}
